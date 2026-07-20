"""Test hardening vòng đời OTP ở tầng CRUD:
- Khóa OTP theo số lần verify sai (attempts) + đếm nguyên tử ($inc) chống race.
- Cooldown tạo OTP (has_recent_otp) chống email bombing.

Dùng lại logic khớp filter của fake mongo trong tests/agent/_fake_mongo.py, mở rộng
find_one để nhận tham số sort (crud/otps.py::find_valid_otp có dùng sort)."""

from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from bson import ObjectId

import app.crud.otps as crud_otps
from app.core.config import MAX_OTP_ATTEMPTS
from app.schemas.otps import OtpTypeEnum
from app.utils.otp_utils import hash_otp_code
from tests.agent._fake_mongo import FakeCollection, _matches


class _SortableCollection(FakeCollection):
    """FakeCollection nhưng find_one hỗ trợ kwarg sort (base không có)."""

    async def find_one(self, flt: dict, projection: Any = None, sort: Any = None) -> Optional[dict]:
        docs = [d for d in self.docs if _matches(d, flt)]
        if sort:
            for field, direction in reversed(sort):
                docs = sorted(
                    docs,
                    key=lambda x: (x.get(field) is not None, x.get(field)),
                    reverse=direction < 0,
                )
        return dict(docs[0]) if docs else None


class FakeDB:
    def __init__(self) -> None:
        self._colls: dict[str, _SortableCollection] = {}

    def __getitem__(self, name: str) -> _SortableCollection:
        return self._colls.setdefault(name, _SortableCollection())


def _insert_otp(
    db: FakeDB,
    user_id: str,
    plain_code: str = "123456",
    otp_type: OtpTypeEnum = OtpTypeEnum.RESET_PASSWORD,
    attempts: int = 0,
    expires_in_min: int = 5,
    created_ago_sec: int = 0,
    verified: bool = False,
) -> dict:
    now = datetime.now(timezone.utc)
    doc = {
        "_id": ObjectId(),
        "user_id": ObjectId(user_id),
        "hashed_otp_code": hash_otp_code(plain_code),
        "otp_type": otp_type.value,
        "expires_at": now + timedelta(minutes=expires_in_min),
        "verified_at": now if verified else None,
        "created_at": now - timedelta(seconds=created_ago_sec),
        "attempts": attempts,
        "updated_at": now,
    }
    db[crud_otps.OTP_COLLECTION].docs.append(doc)
    return doc


# --- Attempt locking -------------------------------------------------------


async def test_verify_correct_otp_succeeds() -> None:
    db = FakeDB()
    uid = str(ObjectId())
    _insert_otp(db, uid, plain_code="654321", otp_type=OtpTypeEnum.RESET_PASSWORD)

    ok = await crud_otps.verify_and_use_otp(db, uid, OtpTypeEnum.RESET_PASSWORD, "654321")

    assert ok is True
    doc = db[crud_otps.OTP_COLLECTION].docs[0]
    assert doc["verified_at"] is not None
    assert doc["attempts"] == 1


async def test_wrong_otp_increments_and_locks_after_max() -> None:
    db = FakeDB()
    uid = str(ObjectId())
    _insert_otp(db, uid, plain_code="111111", otp_type=OtpTypeEnum.RESET_PASSWORD)

    for _ in range(MAX_OTP_ATTEMPTS):
        ok = await crud_otps.verify_and_use_otp(db, uid, OtpTypeEnum.RESET_PASSWORD, "000000")
        assert ok is False

    doc = db[crud_otps.OTP_COLLECTION].docs[0]
    assert doc["attempts"] == MAX_OTP_ATTEMPTS

    # Sau khi đạt trần: mã ĐÚNG cũng bị từ chối (OTP đã bị khóa).
    ok = await crud_otps.verify_and_use_otp(db, uid, OtpTypeEnum.RESET_PASSWORD, "111111")
    assert ok is False


async def test_failed_attempt_uses_atomic_inc() -> None:
    # Chống race: nhánh verify-sai phải dùng $inc nguyên tử, không $set(read-modify-write).
    db = FakeDB()
    uid = str(ObjectId())
    _insert_otp(db, uid, plain_code="222222", otp_type=OtpTypeEnum.RESET_PASSWORD)

    captured: list[dict] = []
    coll = db[crud_otps.OTP_COLLECTION]
    orig_update = coll.update_one

    async def spy_update(flt, update, upsert=False):
        captured.append(update)
        return await orig_update(flt, update, upsert=upsert)

    coll.update_one = spy_update  # type: ignore[method-assign]

    ok = await crud_otps.verify_and_use_otp(db, uid, OtpTypeEnum.RESET_PASSWORD, "999999")

    assert ok is False
    assert captured, "update_one phải được gọi ở nhánh verify sai"
    last = captured[-1]
    assert "$inc" in last and last["$inc"].get("attempts") == 1


# --- Cooldown tạo OTP (chống email bombing) --------------------------------


async def test_has_recent_otp_true_within_cooldown() -> None:
    db = FakeDB()
    uid = str(ObjectId())
    _insert_otp(db, uid, otp_type=OtpTypeEnum.RESET_PASSWORD, created_ago_sec=5)

    assert await crud_otps.has_recent_otp(db, uid, OtpTypeEnum.RESET_PASSWORD) is True


async def test_has_recent_otp_false_after_cooldown() -> None:
    db = FakeDB()
    uid = str(ObjectId())
    _insert_otp(
        db,
        uid,
        otp_type=OtpTypeEnum.RESET_PASSWORD,
        created_ago_sec=crud_otps.OTP_RESEND_COOLDOWN_SECONDS + 5,
    )

    assert await crud_otps.has_recent_otp(db, uid, OtpTypeEnum.RESET_PASSWORD) is False


async def test_has_recent_otp_scoped_per_type() -> None:
    db = FakeDB()
    uid = str(ObjectId())
    _insert_otp(db, uid, otp_type=OtpTypeEnum.RESET_PASSWORD, created_ago_sec=5)

    # OTP loại khác không bị chặn bởi cooldown của reset_password.
    assert await crud_otps.has_recent_otp(db, uid, OtpTypeEnum.EMAIL_VERIFICATION) is False


async def test_has_recent_otp_invalid_user_id() -> None:
    db = FakeDB()
    assert await crud_otps.has_recent_otp(db, "not-an-objectid", OtpTypeEnum.RESET_PASSWORD) is False

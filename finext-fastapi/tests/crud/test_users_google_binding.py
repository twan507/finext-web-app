"""Test SEC-01/SEC-04 — google_id không nhận từ input, và tài khoản bị admin khoá
không thể tự kích hoạt lại qua Google.
"""
from datetime import datetime, timezone

import pytest
from bson import ObjectId

import app.crud.users as crud_users
from app.schemas.users import GoogleUserSchema, UserCreate
from tests.crud._fake_mongo import FakeDB


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _seed_role(db: FakeDB) -> ObjectId:
    rid = ObjectId()
    db["roles"].docs.append({"_id": rid, "name": "user"})
    return rid


def _seed_user(db: FakeDB, email: str, **over) -> ObjectId:
    uid = ObjectId()
    doc = {
        "_id": uid,
        "email": email,
        "full_name": "Người Dùng",
        "role_ids": [],
        "referral_code": None,
        "subscription_id": None,
        "hashed_password": "x",
        "google_id": None,
        "is_active": True,
        "suspended_by_admin": False,
        "created_at": _now(),
        "updated_at": _now(),
    }
    doc.update(over)
    db["users"].docs.append(doc)
    return uid


@pytest.mark.asyncio
async def test_register_khong_luu_google_id_do_client_gui(monkeypatch):
    """SEC-01: google_id trong body register phải bị loại, không được ghi vào DB."""
    db = FakeDB()
    _seed_role(db)
    monkeypatch.setattr(crud_users.crud_subscriptions, "assign_free_subscription_if_needed", _noop)

    created = await crud_users.create_user_db(
        db,
        user_create_data=UserCreate(
            email="victim@example.com",
            full_name="Victim",
            password="motmatkhaudai",
            google_id="attacker-google-sub-123",
        ),
        set_active_on_create=False,
    )

    assert created is not None
    stored = db["users"].docs[0]
    assert stored["google_id"] is None, "google_id do client gửi phải bị loại bỏ"
    assert stored["is_active"] is False


@pytest.mark.asyncio
async def test_google_sub_tro_toi_email_khac_bi_tu_choi():
    """SEC-01: nếu google_id trỏ tới account có email khác → không trao account."""
    db = FakeDB()
    _seed_user(db, "victim@example.com", google_id="sub-123")

    with pytest.raises(ValueError, match="không hợp lệ"):
        await crud_users.get_or_create_user_from_google_sub_email(
            db,
            GoogleUserSchema(id="sub-123", email="attacker@example.com", verified_email=True),
        )


@pytest.mark.asyncio
async def test_tai_khoan_bi_khoa_khong_tu_kich_hoat_qua_google_id():
    """SEC-04: user bị admin khoá, login bằng Google đã liên kết → từ chối."""
    db = FakeDB()
    _seed_user(db, "banned@example.com", google_id="sub-999", is_active=False, suspended_by_admin=True)

    with pytest.raises(ValueError, match="bị khóa"):
        await crud_users.get_or_create_user_from_google_sub_email(
            db,
            GoogleUserSchema(id="sub-999", email="banned@example.com", verified_email=True),
        )
    assert db["users"].docs[0]["is_active"] is False, "không được kích hoạt lại"


@pytest.mark.asyncio
async def test_tai_khoan_bi_khoa_khong_tu_kich_hoat_qua_lien_ket_email():
    """SEC-04: user bị khoá, chưa có google_id, login Google cùng email → từ chối."""
    db = FakeDB()
    _seed_user(db, "banned2@example.com", is_active=False, suspended_by_admin=True)

    with pytest.raises(ValueError, match="bị khóa"):
        await crud_users.get_or_create_user_from_google_sub_email(
            db,
            GoogleUserSchema(id="sub-new", email="banned2@example.com", verified_email=True),
        )
    assert db["users"].docs[0]["is_active"] is False
    assert db["users"].docs[0]["google_id"] is None


@pytest.mark.asyncio
async def test_user_pending_van_kich_hoat_duoc_qua_google():
    """Không chặn nhầm: user chưa xác thực email (không bị khoá) vẫn activate được."""
    db = FakeDB()
    _seed_user(db, "pending@example.com", is_active=False, suspended_by_admin=False)

    result = await crud_users.get_or_create_user_from_google_sub_email(
        db,
        GoogleUserSchema(id="sub-abc", email="pending@example.com", verified_email=True),
    )

    assert result is not None
    assert db["users"].docs[0]["is_active"] is True
    assert db["users"].docs[0]["google_id"] == "sub-abc"


async def _noop(*args, **kwargs):
    return None

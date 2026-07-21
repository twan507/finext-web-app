"""Test 4A — chống N+1 lấy email ở màn brokers/sessions/otps.

Kiểm tra helper crud_users.get_emails_by_user_ids (join email trong 1 query) và
các schema *Public đã có field user_email optional (mặc định None, gán được).
"""
from datetime import datetime, timezone

from bson import ObjectId

import app.crud.users as crud_users


# --- Fake Mongo tối giản: chỉ hỗ trợ find({_id: {$in: [...]}}, projection).to_list() ---
class _FakeCursor:
    def __init__(self, docs: list[dict]) -> None:
        self._docs = docs

    async def to_list(self, length: int | None = None) -> list[dict]:
        docs = self._docs if length is None else self._docs[:length]
        return [dict(d) for d in docs]


class _FakeUsers:
    def __init__(self, docs: list[dict]) -> None:
        self._docs = docs
        self.last_projection: dict | None = None

    def find(self, flt: dict, projection: dict | None = None) -> _FakeCursor:
        self.last_projection = projection
        wanted = flt.get("_id", {}).get("$in", [])
        matched = [d for d in self._docs if d["_id"] in wanted]
        # Mô phỏng projection: chỉ giữ _id + các field được chọn (=1)
        if projection:
            fields = {k for k, v in projection.items() if v}
            matched = [{k: v for k, v in d.items() if k == "_id" or k in fields} for d in matched]
        return _FakeCursor(matched)


class _FakeDB:
    def __init__(self, users: _FakeUsers) -> None:
        self._users = users

    def __getitem__(self, name: str) -> _FakeUsers:
        assert name == "users"
        return self._users


async def test_get_emails_returns_correct_map_and_only_email():
    id1, id2 = ObjectId(), ObjectId()
    users = _FakeUsers(
        [
            {"_id": id1, "email": "a@example.com", "hashed_password": "SECRET1", "full_name": "A"},
            {"_id": id2, "email": "b@example.com", "hashed_password": "SECRET2", "role_ids": ["r"]},
        ]
    )
    db = _FakeDB(users)

    result = await crud_users.get_emails_by_user_ids(db, [str(id1), str(id2)])

    assert result == {str(id1): "a@example.com", str(id2): "b@example.com"}
    # Chỉ project email -> không kéo hashed_password/role_ids ra khỏi DB.
    assert users.last_projection == {"email": 1}
    for value in result.values():
        assert "@" in value  # chỉ chứa email, không lộ field nhạy cảm


async def test_get_emails_skips_invalid_and_dedupes():
    id1 = ObjectId()
    users = _FakeUsers([{"_id": id1, "email": "a@example.com"}])
    db = _FakeDB(users)

    # Có id không hợp lệ, chuỗi rỗng và id trùng lặp.
    result = await crud_users.get_emails_by_user_ids(db, [str(id1), "not-an-objectid", "", str(id1)])

    assert result == {str(id1): "a@example.com"}


async def test_get_emails_empty_or_all_invalid_returns_empty_without_query():
    users = _FakeUsers([{"_id": ObjectId(), "email": "a@example.com"}])
    db = _FakeDB(users)

    assert await crud_users.get_emails_by_user_ids(db, []) == {}
    assert await crud_users.get_emails_by_user_ids(db, ["bad", ""]) == {}
    # Không có id hợp lệ -> không đụng tới collection (không set projection).
    assert users.last_projection is None


async def test_get_emails_missing_user_id_absent_from_map():
    id_present = ObjectId()
    id_missing = ObjectId()
    users = _FakeUsers([{"_id": id_present, "email": "present@example.com"}])
    db = _FakeDB(users)

    result = await crud_users.get_emails_by_user_ids(db, [str(id_present), str(id_missing)])

    assert result == {str(id_present): "present@example.com"}
    assert str(id_missing) not in result


def test_public_schemas_have_optional_user_email():
    from app.schemas.brokers import BrokerPublic
    from app.schemas.sessions import SessionPublic
    from app.schemas.otps import OtpPublic

    for model in (BrokerPublic, SessionPublic, OtpPublic):
        assert "user_email" in model.model_fields, f"{model.__name__} thiếu user_email"
        assert model.model_fields["user_email"].default is None, f"{model.__name__}.user_email phải mặc định None"


def test_otp_public_user_email_assignable():
    # Router gán item.user_email sau model_validate -> đảm bảo Pydantic cho phép gán.
    from app.schemas.otps import OtpPublic, OtpTypeEnum

    otp = OtpPublic(
        id=str(ObjectId()),
        user_id=str(ObjectId()),
        otp_type=OtpTypeEnum.EMAIL_VERIFICATION,
        expires_at=datetime.now(timezone.utc),
        created_at=datetime.now(timezone.utc),
    )
    assert otp.user_email is None
    otp.user_email = "x@y.com"
    assert otp.user_email == "x@y.com"

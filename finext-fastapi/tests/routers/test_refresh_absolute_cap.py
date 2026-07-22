"""REL-02 — refresh token có trần tuổi TUYỆT ĐỐI tính từ lúc login.

Refresh là cửa sổ trượt (mỗi lần gia hạn 7 ngày). Nếu không có trần tuyệt đối,
một session hoạt động đều đặn sẽ sống vĩnh viễn. Test xác nhận session quá
SESSION_ABSOLUTE_MAX_DAYS bị buộc đăng nhập lại (401 + xoá session), còn session
trong hạn vẫn refresh bình thường.
"""
import json
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from bson import ObjectId

import app.routers.auth as auth
from app.core.config import SESSION_ABSOLUTE_MAX_DAYS
from tests.auth._fake_mongo import FakeDB


def _seed_session(db: FakeDB, uid: ObjectId, refresh_jti: str, created_ago_days: int) -> ObjectId:
    sid = ObjectId()
    now = datetime.now(timezone.utc)
    db["sessions"].docs.append(
        {
            "_id": sid,
            "user_id": uid,
            "access_jti": f"acc-{sid}",
            "refresh_jti": refresh_jti,
            "device_info": "pytest",
            "ip_address": "127.0.0.1",
            "location": None,
            "created_at": now - timedelta(days=created_ago_days),
            "last_active_at": now,
        }
    )
    return sid


def _patch_common(monkeypatch, uid: ObjectId, refresh_jti: str) -> None:
    monkeypatch.setattr(auth, "decode_refresh_token", lambda _t: {"user_id": str(uid), "jti": refresh_jti})

    async def _fake_get_user(_db, user_id):
        return SimpleNamespace(id=user_id, email="u@example.com", is_active=True)

    monkeypatch.setattr(auth, "get_user_by_id_db", _fake_get_user)


async def test_refresh_qua_tran_tuyet_doi_buoc_dang_nhap_lai(monkeypatch):
    db = FakeDB()
    uid = ObjectId()
    sid = _seed_session(db, uid, "R", created_ago_days=SESSION_ABSOLUTE_MAX_DAYS + 1)
    _patch_common(monkeypatch, uid, "R")

    resp = await auth.refresh_access_token(refresh_token_str="dummy", db=db)

    assert resp.status_code == 401
    assert "expired" in json.loads(bytes(resp.body))["message"].lower()
    # Session bị xoá để không refresh lại được.
    assert await db["sessions"].find_one({"_id": sid}) is None


async def test_refresh_trong_han_van_hoat_dong(monkeypatch):
    db = FakeDB()
    uid = ObjectId()
    sid = _seed_session(db, uid, "R", created_ago_days=1)
    _patch_common(monkeypatch, uid, "R")

    resp = await auth.refresh_access_token(refresh_token_str="dummy", db=db)

    assert resp.status_code == 200
    # Session vẫn còn, access_jti đã rotate.
    doc = await db["sessions"].find_one({"_id": sid})
    assert doc is not None
    assert doc["refresh_jti"] == "R"  # refresh_jti giữ nguyên (chống race đa-tab)

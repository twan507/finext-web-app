"""Test P0 — IDOR: user A KHÔNG được đọc/sửa/xóa tài nguyên của user B.

Đi qua ĐÚNG logic thật của app:
- require_permission("session","manage_own") kiểm tra ownership session (biên chạy trước handler).
- Router watchlist read/update/delete: ownership qua kiểm tra inline + lọc user_id ở CRUD.
- require_permission("user","update"): update_own chỉ sửa được chính mình, không sửa người khác.
- Guard tự-bảo-vệ: admin không tự xóa session của mình qua endpoint admin.

Router được bọc @api_response_wrapper nên trả JSONResponse (HTTPException bị bắt) —
ta assert theo status_code + body thay vì pytest.raises.
"""
import json
from datetime import datetime, timezone

import pytest
from bson import ObjectId
from fastapi import HTTPException
from fastapi.responses import JSONResponse

from app.auth.access import require_permission
from app.routers.sessions import admin_delete_any_session, delete_my_specific_session
from app.routers.watchlists import (
    delete_my_watchlist,
    read_my_watchlist_by_id,
    update_my_watchlist,
)
from app.schemas.watchlists import WatchlistUpdate
import app.crud.watchlists as crud_watchlists
from tests.auth._fake_mongo import FakeDB
from tests.routers.test_permission_matrix import _FakeRequest, _grant, _make_user


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _body(resp: JSONResponse) -> dict:
    return json.loads(bytes(resp.body))


def _seed_session(db: FakeDB, owner_id: ObjectId) -> ObjectId:
    sid = ObjectId()
    db["sessions"].docs.append(
        {
            "_id": sid,
            "user_id": owner_id,
            "access_jti": f"acc-{sid}",
            "refresh_jti": f"ref-{sid}",
            "device_info": "pytest",
            "ip_address": "127.0.0.1",
            "location": None,
            "created_at": _now(),
            "last_active_at": _now(),
        }
    )
    return sid


def _seed_watchlist(db: FakeDB, owner_id: ObjectId, name: str = "WL") -> ObjectId:
    wid = ObjectId()
    db["watchlists"].docs.append(
        {
            "_id": wid,
            "user_id": owner_id,
            "name": name,
            "coordinate": [0, 0],
            "stock_symbols": ["VCB"],
            "page": 1,
            "sort": "manual",
            "collapsed": False,
            "created_at": _now(),
            "updated_at": _now(),
        }
    )
    return wid


# --------------------------------------------------------------------------- #
# SESSION — ownership tại require_permission (biên trước handler)
# --------------------------------------------------------------------------- #


async def test_session_manage_own_owner_allowed() -> None:
    db = FakeDB()
    a_id = ObjectId()
    user_a = _make_user(_grant(db, ["session:manage_own"]), user_id=a_id, email="a@example.com")
    sid = _seed_session(db, owner_id=a_id)

    dep = require_permission("session", "manage_own")
    result = await dep(_FakeRequest(session_id=str(sid)), user_a, db)
    assert result is user_a


async def test_session_manage_own_cannot_touch_others_session() -> None:
    # IDOR cốt lõi: A có quyền manage_own nhưng session thuộc B -> 403.
    db = FakeDB()
    a_id, b_id = ObjectId(), ObjectId()
    user_a = _make_user(_grant(db, ["session:manage_own"]), user_id=a_id, email="a@example.com")
    sid_of_b = _seed_session(db, owner_id=b_id)

    dep = require_permission("session", "manage_own")
    with pytest.raises(HTTPException) as exc:
        await dep(_FakeRequest(session_id=str(sid_of_b)), user_a, db)
    assert exc.value.status_code == 403


async def test_session_router_delete_others_session_forbidden() -> None:
    # Phòng thủ theo lớp: handler tự kiểm tra ownership lần nữa -> 403.
    db = FakeDB()
    a_id, b_id = ObjectId(), ObjectId()
    user_a = _make_user(_grant(db, ["session:manage_own"]), user_id=a_id, email="a@example.com")
    sid_of_b = _seed_session(db, owner_id=b_id)

    resp = await delete_my_specific_session(session_id=str(sid_of_b), current_user=user_a, db=db)
    assert resp.status_code == 403
    # Session của B vẫn còn nguyên (không bị xóa).
    assert any(d["_id"] == sid_of_b for d in db["sessions"].docs)


async def test_session_router_delete_own_session_ok() -> None:
    db = FakeDB()
    a_id = ObjectId()
    user_a = _make_user(_grant(db, ["session:manage_own"]), user_id=a_id, email="a@example.com")
    sid = _seed_session(db, owner_id=a_id)

    resp = await delete_my_specific_session(session_id=str(sid), current_user=user_a, db=db)
    assert resp.status_code == 200
    assert not any(d["_id"] == sid for d in db["sessions"].docs)


async def test_admin_cannot_delete_own_session_via_admin_endpoint() -> None:
    # Guard tự-bảo-vệ: admin không được tự xóa session của chính mình qua endpoint admin.
    db = FakeDB()
    admin_id = ObjectId()
    admin = _make_user(_grant(db, ["session:manage_any"]), user_id=admin_id, email="admin@example.com")
    own_sid = _seed_session(db, owner_id=admin_id)

    resp = await admin_delete_any_session(session_id=str(own_sid), current_admin=admin, db=db)
    assert resp.status_code == 403
    assert any(d["_id"] == own_sid for d in db["sessions"].docs)


# --------------------------------------------------------------------------- #
# WATCHLIST — ownership tại router + lọc user_id ở CRUD
# --------------------------------------------------------------------------- #


async def test_watchlist_read_others_returns_404() -> None:
    db = FakeDB()
    a_id, b_id = ObjectId(), ObjectId()
    user_a = _make_user(_grant(db, ["watchlist:manage_own"]), user_id=a_id, email="a@example.com")
    wid_of_b = _seed_watchlist(db, owner_id=b_id)

    resp = await read_my_watchlist_by_id(watchlist_id=str(wid_of_b), current_user=user_a, db=db)
    assert resp.status_code == 404


async def test_watchlist_read_own_ok() -> None:
    db = FakeDB()
    a_id = ObjectId()
    user_a = _make_user(_grant(db, ["watchlist:manage_own"]), user_id=a_id, email="a@example.com")
    wid = _seed_watchlist(db, owner_id=a_id)

    resp = await read_my_watchlist_by_id(watchlist_id=str(wid), current_user=user_a, db=db)
    assert resp.status_code == 200
    assert _body(resp)["data"]["name"] == "WL"


async def test_watchlist_update_others_returns_404_and_no_mutation() -> None:
    db = FakeDB()
    a_id, b_id = ObjectId(), ObjectId()
    user_a = _make_user(_grant(db, ["watchlist:manage_own"]), user_id=a_id, email="a@example.com")
    wid_of_b = _seed_watchlist(db, owner_id=b_id, name="B-list")

    resp = await update_my_watchlist(
        watchlist_id=str(wid_of_b),
        watchlist_data=WatchlistUpdate(name="hacked"),
        current_user=user_a,
        db=db,
    )
    assert resp.status_code == 404
    # Tên watchlist của B KHÔNG bị đổi.
    doc = next(d for d in db["watchlists"].docs if d["_id"] == wid_of_b)
    assert doc["name"] == "B-list"


async def test_watchlist_delete_others_returns_404_and_survives() -> None:
    db = FakeDB()
    a_id, b_id = ObjectId(), ObjectId()
    user_a = _make_user(_grant(db, ["watchlist:manage_own"]), user_id=a_id, email="a@example.com")
    wid_of_b = _seed_watchlist(db, owner_id=b_id)

    resp = await delete_my_watchlist(watchlist_id=str(wid_of_b), current_user=user_a, db=db)
    assert resp.status_code == 404
    assert any(d["_id"] == wid_of_b for d in db["watchlists"].docs)


async def test_watchlist_crud_ownership_filter_direct() -> None:
    # Kiểm tra primitive chống IDOR ở CRUD: thao tác luôn kèm điều kiện user_id.
    db = FakeDB()
    a_id, b_id = ObjectId(), ObjectId()
    wid_of_b = _seed_watchlist(db, owner_id=b_id, name="B-list")

    # A không sửa/xóa được của B.
    assert await crud_watchlists.update_watchlist(db, str(wid_of_b), str(a_id), WatchlistUpdate(name="x")) is None
    assert await crud_watchlists.delete_watchlist(db, str(wid_of_b), str(a_id)) is False
    # B thao tác được trên chính mình.
    assert await crud_watchlists.update_watchlist(db, str(wid_of_b), str(b_id), WatchlistUpdate(name="B2")) is not None
    assert await crud_watchlists.delete_watchlist(db, str(wid_of_b), str(b_id)) is True


# --------------------------------------------------------------------------- #
# USER — update_own không sửa được người khác (IDOR nâng quyền)
# --------------------------------------------------------------------------- #


async def test_user_update_own_cannot_edit_other_user() -> None:
    db = FakeDB()
    a_id, b_id = ObjectId(), ObjectId()
    user_a = _make_user(_grant(db, ["user:update_own"]), user_id=a_id, email="a@example.com")
    dep = require_permission("user", "update")

    # A sửa hồ sơ của B -> 403.
    with pytest.raises(HTTPException) as exc:
        await dep(_FakeRequest(user_id=str(b_id)), user_a, db)
    assert exc.value.status_code == 403

    # A sửa chính mình -> OK.
    assert await dep(_FakeRequest(user_id=str(a_id)), user_a, db) is user_a

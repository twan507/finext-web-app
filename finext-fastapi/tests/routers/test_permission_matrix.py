"""Test P0 — Ma trận phân quyền qua require_permission THẬT.

Mỗi test gọi trực tiếp dependency do `require_permission(resource, action)` trả về,
đi qua `get_user_permissions` thật (resolve role -> permission qua FakeDB). Không mock
rỗng: nếu user thiếu quyền => HTTPException 403; đủ quyền => trả lại current_user.

Đây là biên bảo mật chạy TRƯỚC handler; mỗi lỗ hổng ở đây = leo quyền.
"""
from datetime import datetime, timezone

import pytest
from bson import ObjectId
from fastapi import HTTPException

from app.auth.access import require_permission
from app.schemas.users import UserInDB
from tests.auth._fake_mongo import FakeDB


class _FakeRequest:
    """Chỉ cần .path_params — thứ duy nhất require_permission đọc từ Request."""

    def __init__(self, **path_params: str) -> None:
        self.path_params = dict(path_params)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _grant(db: FakeDB, perm_names: list[str]) -> ObjectId:
    """Seed 1 role gắn các permission tên cho trước; trả role_id."""
    role_id = ObjectId()
    perm_ids: list[ObjectId] = []
    for name in perm_names:
        pid = ObjectId()
        db["permissions"].docs.append({"_id": pid, "name": name})
        perm_ids.append(pid)
    db["roles"].docs.append({"_id": role_id, "permission_ids": perm_ids})
    return role_id


def _make_user(role_id: ObjectId, user_id: ObjectId | None = None, email: str = "u@example.com") -> UserInDB:
    return UserInDB(
        _id=user_id or ObjectId(),
        email=email,
        full_name="User",
        role_ids=[role_id],
        is_active=True,
        hashed_password="x",
        created_at=_now(),
        updated_at=_now(),
    )


async def _assert_denied(dep, user: UserInDB, db: FakeDB, **path_params: str) -> None:
    with pytest.raises(HTTPException) as exc:
        await dep(_FakeRequest(**path_params), user, db)
    assert exc.value.status_code == 403


async def _assert_allowed(dep, user: UserInDB, db: FakeDB, **path_params: str) -> None:
    result = await dep(_FakeRequest(**path_params), user, db)
    assert result is user


# --------------------------------------------------------------------------- #
# USER resource
# --------------------------------------------------------------------------- #


async def test_user_create_denied_without_perm() -> None:
    db = FakeDB()
    user = _make_user(_grant(db, []))
    await _assert_denied(require_permission("user", "create"), user, db)


async def test_user_create_allowed_with_perm() -> None:
    db = FakeDB()
    user = _make_user(_grant(db, ["user:create"]))
    await _assert_allowed(require_permission("user", "create"), user, db)


async def test_user_list_denied_and_allowed() -> None:
    db = FakeDB()
    await _assert_denied(require_permission("user", "list"), _make_user(_grant(db, [])), db)
    db2 = FakeDB()
    await _assert_allowed(require_permission("user", "list"), _make_user(_grant(db2, ["user:list"])), db2)


async def test_user_read_any_denied_and_allowed() -> None:
    db = FakeDB()
    await _assert_denied(require_permission("user", "read_any"), _make_user(_grant(db, [])), db)
    db2 = FakeDB()
    await _assert_allowed(require_permission("user", "read_any"), _make_user(_grant(db2, ["user:read_any"])), db2)


async def test_user_update_own_can_update_self_only() -> None:
    # user:update_own cho phép sửa CHÍNH MÌNH nhưng KHÔNG cho sửa người khác.
    db = FakeDB()
    uid = ObjectId()
    user = _make_user(_grant(db, ["user:update_own"]), user_id=uid)
    dep = require_permission("user", "update")

    await _assert_allowed(dep, user, db, user_id=str(uid))  # self
    await _assert_denied(dep, user, db, user_id=str(ObjectId()))  # other -> cần update_any


async def test_user_update_any_can_update_others() -> None:
    db = FakeDB()
    uid = ObjectId()
    user = _make_user(_grant(db, ["user:update_any"]), user_id=uid)
    dep = require_permission("user", "update")
    await _assert_allowed(dep, user, db, user_id=str(ObjectId()))  # other
    await _assert_allowed(dep, user, db, user_id=str(uid))  # self cũng được


async def test_user_delete_any_cannot_delete_self() -> None:
    # Có quyền delete_any nhưng KHÔNG được tự xóa mình qua endpoint chung.
    db = FakeDB()
    uid = ObjectId()
    user = _make_user(_grant(db, ["user:delete_any"]), user_id=uid)
    dep = require_permission("user", "delete_any")

    await _assert_allowed(dep, user, db, user_id=str(ObjectId()))  # other
    await _assert_denied(dep, user, db, user_id=str(uid))  # self -> chặn


async def test_user_delete_any_denied_without_perm() -> None:
    db = FakeDB()
    user = _make_user(_grant(db, []))
    await _assert_denied(require_permission("user", "delete_any"), user, db, user_id=str(ObjectId()))


async def test_user_change_password_any_denied_and_allowed() -> None:
    db = FakeDB()
    await _assert_denied(require_permission("user", "change_password_any"), _make_user(_grant(db, [])), db)
    db2 = FakeDB()
    await _assert_allowed(
        require_permission("user", "change_password_any"),
        _make_user(_grant(db2, ["user:change_password_any"])),
        db2,
    )


async def test_user_manage_roles_denied_and_allowed() -> None:
    db = FakeDB()
    await _assert_denied(require_permission("user", "manage_roles"), _make_user(_grant(db, [])), db)
    db2 = FakeDB()
    await _assert_allowed(
        require_permission("user", "manage_roles"), _make_user(_grant(db2, ["user:manage_roles"])), db2
    )


async def test_user_unknown_action_denied() -> None:
    db = FakeDB()
    # Kể cả có nhiều quyền, action lạ vẫn phải bị từ chối (fail-closed).
    user = _make_user(_grant(db, ["user:create", "user:update_any", "user:delete_any"]))
    await _assert_denied(require_permission("user", "frobnicate"), user, db, user_id=str(ObjectId()))


# --------------------------------------------------------------------------- #
# SESSION resource (gating theo quyền; ownership riêng ở test_idor.py)
# --------------------------------------------------------------------------- #


async def test_session_manage_own_denied_without_perm() -> None:
    db = FakeDB()
    user = _make_user(_grant(db, []))
    await _assert_denied(require_permission("session", "manage_own"), user, db)


async def test_session_manage_own_allowed_listing_no_id() -> None:
    db = FakeDB()
    user = _make_user(_grant(db, ["session:manage_own"]))
    await _assert_allowed(require_permission("session", "manage_own"), user, db)  # list -> không cần session_id


async def test_session_manage_any_denied_and_allowed() -> None:
    db = FakeDB()
    await _assert_denied(require_permission("session", "manage_any"), _make_user(_grant(db, [])), db)
    db2 = FakeDB()
    await _assert_allowed(
        require_permission("session", "manage_any"), _make_user(_grant(db2, ["session:manage_any"])), db2
    )


# --------------------------------------------------------------------------- #
# WATCHLIST resource
# --------------------------------------------------------------------------- #


async def test_watchlist_manage_own_denied_and_allowed() -> None:
    db = FakeDB()
    await _assert_denied(require_permission("watchlist", "manage_own"), _make_user(_grant(db, [])), db)
    db2 = FakeDB()
    await _assert_allowed(
        require_permission("watchlist", "manage_own"), _make_user(_grant(db2, ["watchlist:manage_own"])), db2
    )


async def test_watchlist_manage_any_denied_and_allowed() -> None:
    db = FakeDB()
    await _assert_denied(require_permission("watchlist", "manage_any"), _make_user(_grant(db, [])), db)
    db2 = FakeDB()
    await _assert_allowed(
        require_permission("watchlist", "manage_any"), _make_user(_grant(db2, ["watchlist:manage_any"])), db2
    )


# --------------------------------------------------------------------------- #
# ROLE / PERMISSION resource
# --------------------------------------------------------------------------- #


async def test_role_manage_denied_and_allowed() -> None:
    db = FakeDB()
    await _assert_denied(require_permission("role", "manage"), _make_user(_grant(db, [])), db)
    db2 = FakeDB()
    await _assert_allowed(require_permission("role", "manage"), _make_user(_grant(db2, ["role:manage"])), db2)


async def test_permission_read_own_always_allowed_for_authenticated() -> None:
    # Endpoint liệt kê quyền của chính mình: chỉ cần đăng nhập, không cần permission cụ thể.
    db = FakeDB()
    user = _make_user(_grant(db, []))
    await _assert_allowed(require_permission("permission", "read_own"), user, db)


async def test_permission_manage_denied_and_allowed() -> None:
    db = FakeDB()
    await _assert_denied(require_permission("permission", "manage"), _make_user(_grant(db, [])), db)
    db2 = FakeDB()
    await _assert_allowed(
        require_permission("permission", "manage"), _make_user(_grant(db2, ["permission:manage"])), db2
    )


# --------------------------------------------------------------------------- #
# Các resource còn lại: subscription / transaction / broker / promotion /
# upload / license / feature
# --------------------------------------------------------------------------- #


async def test_subscription_read_own_denied_and_allowed() -> None:
    db = FakeDB()
    await _assert_denied(require_permission("subscription", "read_own"), _make_user(_grant(db, [])), db)
    db2 = FakeDB()
    await _assert_allowed(
        require_permission("subscription", "read_own"), _make_user(_grant(db2, ["subscription:read_own"])), db2
    )


async def test_transaction_read_any_denied_and_allowed() -> None:
    db = FakeDB()
    await _assert_denied(require_permission("transaction", "read_any"), _make_user(_grant(db, [])), db)
    db2 = FakeDB()
    await _assert_allowed(
        require_permission("transaction", "read_any"), _make_user(_grant(db2, ["transaction:read_any"])), db2
    )


async def test_broker_create_denied_and_allowed() -> None:
    db = FakeDB()
    await _assert_denied(require_permission("broker", "create"), _make_user(_grant(db, [])), db)
    db2 = FakeDB()
    await _assert_allowed(require_permission("broker", "create"), _make_user(_grant(db2, ["broker:create"])), db2)


async def test_promotion_manage_denied_and_allowed() -> None:
    db = FakeDB()
    await _assert_denied(require_permission("promotion", "manage"), _make_user(_grant(db, [])), db)
    db2 = FakeDB()
    await _assert_allowed(
        require_permission("promotion", "manage"), _make_user(_grant(db2, ["promotion:manage"])), db2
    )


async def test_upload_create_denied_and_allowed() -> None:
    db = FakeDB()
    await _assert_denied(require_permission("upload", "create"), _make_user(_grant(db, [])), db)
    db2 = FakeDB()
    await _assert_allowed(require_permission("upload", "create"), _make_user(_grant(db2, ["upload:create"])), db2)


async def test_license_manage_denied_and_allowed() -> None:
    db = FakeDB()
    await _assert_denied(require_permission("license", "manage"), _make_user(_grant(db, [])), db)
    db2 = FakeDB()
    await _assert_allowed(require_permission("license", "manage"), _make_user(_grant(db2, ["license:manage"])), db2)


async def test_feature_manage_denied_and_allowed() -> None:
    db = FakeDB()
    await _assert_denied(require_permission("feature", "manage"), _make_user(_grant(db, [])), db)
    db2 = FakeDB()
    await _assert_allowed(require_permission("feature", "manage"), _make_user(_grant(db2, ["feature:manage"])), db2)


async def test_empty_permissions_deny_everything() -> None:
    # User không có role/permission nào: mọi endpoint có gating đều 403.
    db = FakeDB()
    user = _make_user(_grant(db, []))
    for resource, action in [
        ("user", "create"),
        ("user", "list"),
        ("session", "manage_any"),
        ("watchlist", "manage_any"),
        ("role", "manage"),
        ("permission", "manage"),
        ("transaction", "read_any"),
    ]:
        await _assert_denied(require_permission(resource, action), user, db)

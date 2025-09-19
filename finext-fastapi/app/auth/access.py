# finext-fastapi/app/auth/access.py
import logging
from typing import Set, Optional, List

from fastapi import Depends, HTTPException, status, Request
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId

from app.auth.dependencies import get_current_active_user
from app.schemas.users import UserInDB
from app.core.database import get_database
import app.crud.brokers as crud_brokers
import app.crud.watchlists as crud_watchlists
# import app.crud.otps as crud_otps # Sẽ cần nếu có logic kiểm tra OTP ownership phức tạp ở đây

logger = logging.getLogger(__name__)


async def _get_user_permissions(db: AsyncIOMotorDatabase, user_id_str: str) -> Set[str]:
    """Lấy tất cả các tên permission mà user sở hữu thông qua các vai trò."""
    if not ObjectId.is_valid(user_id_str):
        logger.error(f"Định dạng user_id không hợp lệ khi lấy permissions: {user_id_str}")
        return set()

    user_obj_id = ObjectId(user_id_str)
    user_doc = await db.users.find_one({"_id": user_obj_id}, {"role_ids": 1})

    if not user_doc or not user_doc.get("role_ids"):
        return set()

    role_object_ids_from_user: List[ObjectId] = user_doc.get("role_ids", [])
    if not role_object_ids_from_user:
        return set()

    roles_cursor = db.roles.find({"_id": {"$in": role_object_ids_from_user}}, {"permission_ids": 1})

    all_permission_object_ids: Set[ObjectId] = set()
    async for role in roles_cursor:
        for perm_obj_id in role.get("permission_ids", []):
            if isinstance(perm_obj_id, ObjectId):
                all_permission_object_ids.add(perm_obj_id)
            elif ObjectId.is_valid(str(perm_obj_id)):
                all_permission_object_ids.add(ObjectId(str(perm_obj_id)))

    if not all_permission_object_ids:
        return set()

    user_permissions_names: Set[str] = set()
    permissions_docs_cursor = db.permissions.find({"_id": {"$in": list(all_permission_object_ids)}}, {"name": 1})
    async for perm_doc in permissions_docs_cursor:
        if "name" in perm_doc:
            user_permissions_names.add(perm_doc["name"])

    return user_permissions_names


def require_permission(resource: str, action: str):
    async def dependency(
        request: Request,
        current_user: UserInDB = Depends(get_current_active_user),
        db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
    ) -> UserInDB:
        user_permissions = await _get_user_permissions(db, str(current_user.id))

        allowed = False
        required_permission_context = f"{resource}:{action}"

        # ---- USER RESOURCE ----
        if resource == "user":
            target_user_id_str: Optional[str] = request.path_params.get("user_id")
            is_own_operation = target_user_id_str and (str(current_user.id) == target_user_id_str)

            if action == "create":  # user:create
                allowed = "user:create" in user_permissions
            elif action == "list":  # user:list
                allowed = "user:list" in user_permissions
            elif action == "read_any":  # user:read_any
                allowed = "user:read_any" in user_permissions
            elif action == "update":  # user:update_own hoặc user:update_any
                if is_own_operation:
                    allowed = "user:update_own" in user_permissions or "user:update_any" in user_permissions
                    required_permission_context = "user:update_own (or user:update_any for self)"
                else:
                    allowed = "user:update_any" in user_permissions
                    required_permission_context = "user:update_any (for others)"
            elif action == "delete_any":  # user:delete_any
                # Admin không nên tự xóa mình qua endpoint chung này
                if target_user_id_str and not is_own_operation and "user:delete_any" in user_permissions:
                    allowed = True
                required_permission_context = "user:delete_any (for others)"
            elif action == "change_password_any":  # user:change_password_any
                allowed = "user:change_password_any" in user_permissions
            elif action == "manage_roles":  # user:manage_roles
                allowed = "user:manage_roles" in user_permissions
            else:
                logger.error(f"Unknown action '{action}' for resource 'user' in permission check.")

        # ---- ROLE RESOURCE ----
        elif resource == "role":
            if action == "manage":  # role:manage (CRUD tất cả vai trò)
                allowed = "role:manage" in user_permissions
            elif action == "read":  # role:read (đọc thông tin role - ai cũng có thể)
                allowed = "role:read" in user_permissions
                required_permission_context = "role:read"
            else:
                # Fallback cho các action cụ thể nếu có (create, list, update_any, delete_any)
                permission_to_check = f"role:{action}"
                allowed = permission_to_check in user_permissions or "role:manage" in user_permissions

        # ---- PERMISSION RESOURCE ----
        elif resource == "permission":
            if action == "read_own":  # Endpoint GET /permissions/ (lấy quyền của user hiện tại)
                allowed = True  # Chỉ cần user đăng nhập
                required_permission_context = "authenticated_user (for listing own permissions)"
            elif action == "manage":  # permission:manage (CRUD tất cả permissions)
                allowed = "permission:manage" in user_permissions
            elif action == "list_all_definitions":  # Endpoint GET /permissions/admin/definitions
                # Cho phép cả permission:manage hoặc quyền cụ thể này
                allowed = "permission:manage" in user_permissions or "permission:list_all_definitions" in user_permissions
                required_permission_context = "permission:manage or permission:list_all_definitions"
            else:  # Các action khác cho permission (nếu có)
                permission_to_check = f"permission:{action}"
                allowed = permission_to_check in user_permissions or "permission:manage" in user_permissions

        # ---- SESSION RESOURCE ----
        elif resource == "session":
            if action == "manage_own":  # session:manage_own (xem, xóa session của chính mình)
                allowed = "session:manage_own" in user_permissions
                if allowed:
                    target_session_id_str = request.path_params.get("session_id")
                    if target_session_id_str and ObjectId.is_valid(target_session_id_str):
                        session_doc = await db.sessions.find_one({"_id": ObjectId(target_session_id_str)})
                        if session_doc and session_doc.get("user_id") == ObjectId(str(current_user.id)):
                            allowed = True
                        else:
                            allowed = False
                            required_permission_context = "session:manage_own (failed: session not found or not owned)"
                    else:
                        # Cho phép list sessions của mình mà không cần session_id
                        allowed = True
            elif action == "manage_any":  # session:manage_any (xem, xóa session của bất kỳ ai)
                allowed = "session:manage_any" in user_permissions
            elif action in ["list_own", "delete_own"]:  # Backward compatibility
                base_permission = "session:manage_own"
                allowed = base_permission in user_permissions
                if allowed and action == "delete_own":
                    target_session_id_str = request.path_params.get("session_id")
                    if target_session_id_str and ObjectId.is_valid(target_session_id_str):
                        session_doc = await db.sessions.find_one({"_id": ObjectId(target_session_id_str)})
                        if session_doc and session_doc.get("user_id") == ObjectId(str(current_user.id)):
                            allowed = True
                        else:
                            allowed = False
                            required_permission_context = f"{base_permission} (failed: session not found or not owned)"
                    else:
                        allowed = False
                        required_permission_context = f"{base_permission} (failed: invalid or missing session_id)"
            elif action in ["list_any", "delete_any"]:  # Backward compatibility
                base_permission = "session:manage_any"
                allowed = base_permission in user_permissions
            else:
                permission_to_check = f"session:{action}"
                allowed = permission_to_check in user_permissions

        # ---- SUBSCRIPTION RESOURCE ----
        elif resource == "subscription":
            permission_to_check = f"subscription:{action}"
            if permission_to_check in user_permissions:
                # Logic kiểm tra ownership cho read_own đã được xử lý ở router
                # Các action *_any và create chỉ cần user có quyền là được
                allowed = True
            else:
                # Kiểm tra thêm các action cụ thể
                if action == "delete_any":  # subscription:delete_any
                    allowed = "subscription:delete_any" in user_permissions
                    required_permission_context = "subscription:delete_any"

        # ---- TRANSACTION RESOURCE ----
        elif resource == "transaction":
            # create_any, create_own, read_any, update_any, delete_any, confirm_payment_any, cancel_any, read_own, read_referred
            permission_to_check = f"transaction:{action}"
            if permission_to_check in user_permissions:
                if action == "read_referred":
                    broker_details = await crud_brokers.get_broker_by_user_id(db, current_user.id)  # type: ignore
                    allowed = bool(broker_details and broker_details.is_active)
                    if not allowed:
                        required_permission_context = "transaction:read_referred (failed: user is not an active broker)"
                else:
                    allowed = True

        # ---- BROKER RESOURCE ----
        elif resource == "broker":
            # create, list, read_any, read_own, update_any, delete_any (deactivate), validate
            if action == "validate":  # broker:validate (kiểm tra tính hợp lệ broker_code)
                allowed = "broker:validate" in user_permissions
            elif action == "read_own":  # broker:read_own
                allowed = "broker:read_own" in user_permissions
                if allowed:
                    broker_details = await crud_brokers.get_broker_by_user_id(db, current_user.id)  # type: ignore
                    allowed = bool(broker_details)  # Không cần active, chỉ cần là broker
                    if not allowed:
                        required_permission_context = "broker:read_own (failed: user is not a broker record)"
            else:  # Các action khác (create, list, read_any, update_any, delete_any)
                permission_to_check = f"broker:{action}"
                allowed = permission_to_check in user_permissions

        # ---- PROMOTION RESOURCE ----
        elif resource == "promotion":
            if action == "manage":  # promotion:manage (CRUD mã khuyến mãi)
                allowed = "promotion:manage" in user_permissions
            elif action == "validate":  # promotion:validate (kiểm tra tính hợp lệ mã khuyến mãi)
                allowed = "promotion:validate" in user_permissions
            else:
                permission_to_check = f"promotion:{action}"
                allowed = permission_to_check in user_permissions

        # ---- LICENSE & FEATURE RESOURCE ----
        elif resource == "license" or resource == "feature":
            if action == "manage":  # license:manage hoặc feature:manage
                permission_to_check = f"{resource}:manage"
                allowed = permission_to_check in user_permissions
                required_permission_context = permission_to_check
            else:
                permission_to_check = f"{resource}:{action}"
                allowed = permission_to_check in user_permissions
                required_permission_context = permission_to_check

        # ---- UPLOAD RESOURCE ----
        elif resource == "upload":
            if action == "create":  # upload:create
                allowed = "upload:create" in user_permissions
            else:
                permission_to_check = f"upload:{action}"
                allowed = permission_to_check in user_permissions

        # ---- WATCHLIST RESOURCE ----
        elif resource == "watchlist":
            if action in ["read_any", "delete_any", "manage_any"]:  # Admin actions
                permission_to_check = f"watchlist:{action}"
                allowed = permission_to_check in user_permissions
            elif action in ["create_own", "read_own", "update_own", "delete_own", "manage_own"]:  # User's own actions
                permission_to_check = f"watchlist:{action}"
                if permission_to_check in user_permissions:
                    if action in ["update_own", "delete_own", "read_own"]:  # "read_own" cho /watchlist/{id}
                        target_watchlist_id_str = request.path_params.get("watchlist_id")
                        if target_watchlist_id_str:  # Thao tác trên watchlist cụ thể
                            if not ObjectId.is_valid(target_watchlist_id_str):
                                required_permission_context = f"{permission_to_check} (failed: invalid watchlist_id format)"
                            else:
                                watchlist_doc = await crud_watchlists.get_watchlist_by_id(db, target_watchlist_id_str)  # type: ignore
                                if watchlist_doc and str(watchlist_doc.user_id) == str(current_user.id):
                                    allowed = True
                                else:
                                    required_permission_context = f"{permission_to_check} (failed: watchlist not found or not owned)"
                        elif action == "read_own":  # Áp dụng cho GET /me/watchlists (không có watchlist_id)
                            allowed = True
                        else:  # update_own, delete_own cần watchlist_id
                            required_permission_context = f"{permission_to_check} (failed: missing watchlist_id)"
                    elif action in ["create_own", "manage_own"]:
                        allowed = True
            else:
                logger.warning(f"Unknown action '{action}' for watchlist resource in permission check.")

        # ---- OTP RESOURCE ----
        elif resource == "otp":
            if action == "manage":  # otp:manage (quản lý tất cả OTP)
                allowed = "otp:manage" in user_permissions
            elif action in ["read_any", "invalidate_any"]:  # Backward compatibility
                base_permission = "otp:manage"
                allowed = base_permission in user_permissions
                if not allowed:
                    # Fallback cho các quyền cụ thể nếu có
                    permission_to_check = f"otp:{action}"
                    allowed = permission_to_check in user_permissions
            else:  # Các action khác cho OTP (nếu có trong tương lai)
                logger.warning(f"Unknown action '{action}' for otp resource in permission check.")

        # --- FINAL CHECK ---
        if not allowed:
            log_message = (
                f"User {current_user.email} (ID: {str(current_user.id)}) does not have permission for resource '{resource}', action '{action}'. "
                f"Contextual permission needed: '{required_permission_context}'. User has: {user_permissions}"
            )
            logger.warning(log_message)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Bạn không có quyền thực hiện hành động '{action}' trên tài nguyên '{resource}'.",
            )

        logger.info(
            f"User {current_user.email} authorized for resource '{resource}', action '{action}'. Contextual permission: '{required_permission_context}'."
        )
        return current_user

    return dependency

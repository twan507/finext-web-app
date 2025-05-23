# finext-fastapi/app/auth/access.py
import logging
from typing import Set, Optional

from fastapi import Depends, HTTPException, status, Request
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId

from app.auth.dependencies import get_current_active_user
from app.schemas.users import UserInDB
from app.core.database import get_database

logger = logging.getLogger(__name__)


async def _get_user_permissions(db: AsyncIOMotorDatabase, user_id_str: str) -> Set[str]:
    """
    Lấy tất cả các tên permission của một user dựa trên user_id (string).
    """
    if not ObjectId.is_valid(user_id_str):
        logger.error(f"Invalid user_id format for permission retrieval: {user_id_str}")
        return set()

    user_obj_id = ObjectId(user_id_str)
    user_doc = await db.users.find_one({"_id": user_obj_id}, {"role_ids": 1})

    if not user_doc or not user_doc.get("role_ids"):
        return set()

    role_ids_str_list = user_doc["role_ids"]

    object_role_ids = []
    for r_id_str in role_ids_str_list:
        if ObjectId.is_valid(r_id_str):
            object_role_ids.append(ObjectId(r_id_str))
        else:
            logger.warning(
                f"Invalid role_id string '{r_id_str}' in user '{user_id_str}'. Skipping."
            )

    if not object_role_ids:
        return set()

    roles_cursor = db.roles.find(
        {"_id": {"$in": object_role_ids}}, {"permission_ids": 1}
    )

    all_permission_ids_str: Set[str] = set()
    async for role in roles_cursor:
        for perm_id_str in role.get("permission_ids", []):
            all_permission_ids_str.add(perm_id_str)

    if not all_permission_ids_str:
        return set()

    object_permission_ids = []
    for p_id_str in all_permission_ids_str:
        if ObjectId.is_valid(p_id_str):
            object_permission_ids.append(ObjectId(p_id_str))
        else:
            logger.warning(
                f"Invalid permission_id string '{p_id_str}' in roles. Skipping."
            )

    if not object_permission_ids:
        return set()

    user_permissions_names: Set[str] = set()
    permissions_docs_cursor = db.permissions.find(
        {"_id": {"$in": object_permission_ids}}, {"name": 1}
    )
    async for perm_doc in permissions_docs_cursor:
        if "name" in perm_doc:
            user_permissions_names.add(perm_doc["name"])

    return user_permissions_names


def require_permission(resource: str, action: str):
    """
    Dependency factory để kiểm tra quyền của người dùng cho một resource và action cụ thể.
    """

    async def dependency(
        request: Request,  # Thêm Request để lấy path_params
        current_user: UserInDB = Depends(get_current_active_user),
        db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
    ) -> UserInDB:
        user_permissions = await _get_user_permissions(db, str(current_user.id))

        allowed = False
        required_permission_context = ""

        if resource == "user":
            target_user_id_str: Optional[str] = (
                request.path_params.get("user_id") if request.path_params else None
            )
            is_self_operation = target_user_id_str and (
                str(current_user.id) == target_user_id_str
            )

            if action == "create":
                if "user:create" in user_permissions:
                    allowed = True
                required_permission_context = "user:create"
            elif action == "list":
                if "user:list" in user_permissions:
                    allowed = True
                required_permission_context = "user:list"
            elif action == "read_any":
                if target_user_id_str:
                    if "user:read_any" in user_permissions:
                        allowed = True
                required_permission_context = "user:read_any"
            elif action == "update":
                if not target_user_id_str:
                    logger.error(
                        "User permission check for 'user:update' called without target_user_id."
                    )
                elif is_self_operation:
                    if (
                        "user:update_self" in user_permissions
                        or "user:update_any" in user_permissions
                    ):
                        allowed = True
                    required_permission_context = (
                        "user:update_self or user:update_any (for self)"
                    )
                else:
                    if "user:update_any" in user_permissions:
                        allowed = True
                    required_permission_context = "user:update_any (for others)"
            elif action == "delete_any":
                if (
                    target_user_id_str and not is_self_operation
                ):  # Không cho tự xóa bằng quyền này
                    if "user:delete_any" in user_permissions:
                        allowed = True
                required_permission_context = "user:delete_any (for others, not self)"
            elif action == "manage_roles":
                if target_user_id_str:
                    if "user:manage_roles" in user_permissions:
                        allowed = True
                required_permission_context = "user:manage_roles"
            else:
                logger.error(
                    f"Unknown action '{action}' for resource 'user' in permission check."
                )

        elif resource == "role":
            permission_to_check = f"role:{action}"
            if permission_to_check in user_permissions:
                allowed = True
            required_permission_context = permission_to_check

        elif (
            resource == "permission"
        ):  # Endpoint GET /permissions/ hiện tại không dùng require_permission này
            if (
                action == "list_all"
            ):  # Ví dụ nếu có endpoint cho admin xem tất cả định nghĩa permission
                if "permission:list_all" in user_permissions:
                    allowed = True  # Cần định nghĩa perm này
                required_permission_context = "permission:list_all"

        # THÊM LOGIC CHO RESOURCE 'SESSION'
        elif resource == "session":
            permission_to_check = f"session:{action}"
            required_permission_context = permission_to_check

            if permission_to_check in user_permissions:
                # Với delete_own, cần kiểm tra thêm session_id có thuộc về user không
                if action == "delete_own":
                    target_session_id_str = request.path_params.get("session_id")
                    if target_session_id_str and ObjectId.is_valid(
                        target_session_id_str
                    ):
                        session_doc = await db.sessions.find_one(
                            {"_id": ObjectId(target_session_id_str)}
                        )
                        if session_doc and str(session_doc.get("user_id")) == str(
                            current_user.id
                        ):
                            allowed = True
                        else:  # Session không tồn tại hoặc không thuộc user
                            allowed = False
                            required_permission_context = "session:delete_own (failed: session not found or not owned by user)"
                    else:  # Không có session_id hoặc không hợp lệ
                        allowed = False
                        required_permission_context = (
                            "session:delete_own (failed: invalid or missing session_id)"
                        )
                else:  # Cho các action khác của session (list_own, list_any, delete_any)
                    allowed = True
            else:  # User không có permission cơ bản (ví dụ session:list_any)
                allowed = False
        # Kết thúc logic cho 'session'

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

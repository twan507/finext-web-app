# finext-fastapi/app/auth/access.py
import logging
from typing import Set, Optional, List

from fastapi import Depends, HTTPException, status, Request
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId

from app.auth.dependencies import get_current_active_user
from app.schemas.users import UserInDB  # UserInDB có role_ids là List[PyObjectId] (str)
from app.core.database import get_database

logger = logging.getLogger(__name__)


async def _get_user_permissions(db: AsyncIOMotorDatabase, user_id_str: str) -> Set[str]:
    if not ObjectId.is_valid(user_id_str):
        logger.error(f"Invalid user_id format for permission retrieval: {user_id_str}")
        return set()

    user_obj_id = ObjectId(user_id_str)
    # Lấy trực tiếp từ DB, role_ids sẽ là List[ObjectId]
    user_doc = await db.users.find_one({"_id": user_obj_id}, {"role_ids": 1})

    if not user_doc or not user_doc.get("role_ids"):
        return set()

    # user_doc.get("role_ids") ở đây là List[ObjectId] từ DB
    role_object_ids_from_user: List[ObjectId] = user_doc.get("role_ids", [])
    if not role_object_ids_from_user:
        return set()

    # Truy vấn roles collection bằng List[ObjectId]
    roles_cursor = db.roles.find(
        {"_id": {"$in": role_object_ids_from_user}}, {"permission_ids": 1}
    )

    all_permission_object_ids: Set[ObjectId] = set()
    async for role in roles_cursor:
        # role.get("permission_ids", []) ở đây là List[ObjectId] từ DB roles
        for perm_obj_id in role.get("permission_ids", []):
            if isinstance(perm_obj_id, ObjectId):  # Đảm bảo là ObjectId
                all_permission_object_ids.add(perm_obj_id)
            elif ObjectId.is_valid(str(perm_obj_id)):  # Nếu lỡ là str
                all_permission_object_ids.add(ObjectId(str(perm_obj_id)))

    if not all_permission_object_ids:
        return set()

    user_permissions_names: Set[str] = set()
    # Truy vấn permissions collection bằng List[ObjectId]
    permissions_docs_cursor = db.permissions.find(
        {"_id": {"$in": list(all_permission_object_ids)}}, {"name": 1}
    )
    async for perm_doc in permissions_docs_cursor:
        if "name" in perm_doc:
            user_permissions_names.add(perm_doc["name"])

    return user_permissions_names


# Hàm require_permission không thay đổi logic chính,
# vì nó nhận current_user (UserInDB) có role_ids là List[str]
# và _get_user_permissions đã được điều chỉnh để làm việc với user_id_str.
def require_permission(resource: str, action: str):
    # ... (Giữ nguyên logic của require_permission)
    async def dependency(
        request: Request,
        current_user: UserInDB = Depends(
            get_current_active_user
        ),  # current_user.id là PyObjectId (str)
        db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
    ) -> UserInDB:
        # current_user.id là str, _get_user_permissions nhận user_id_str
        user_permissions = await _get_user_permissions(db, str(current_user.id))

        allowed = False
        required_permission_context = ""

        if resource == "user":
            target_user_id_str: Optional[str] = (
                request.path_params.get("user_id") if request.path_params else None
            )
            is_self_operation = target_user_id_str and (
                str(current_user.id) == target_user_id_str  # So sánh str với str
            )
            # ... (phần còn lại của user resource)
            if action == "create":
                if "user:create" in user_permissions:
                    allowed = True
                required_permission_context = "user:create"
            elif action == "list":
                if "user:list" in user_permissions:
                    allowed = True
                required_permission_context = "user:list"
            elif action == "read_any":
                if target_user_id_str:  # Chỉ cần có target_user_id
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
                else:  # Cập nhật cho người khác
                    if "user:update_any" in user_permissions:
                        allowed = True
                    required_permission_context = "user:update_any (for others)"
            elif action == "delete_any":  # Admin xóa user khác
                if target_user_id_str and not is_self_operation:
                    if "user:delete_any" in user_permissions:
                        allowed = True
                required_permission_context = "user:delete_any (for others, not self)"
            elif action == "manage_roles":  # Admin gán role
                if target_user_id_str:  # Cần có target user
                    if "user:manage_roles" in user_permissions:
                        allowed = True
                required_permission_context = "user:manage_roles"
            else:
                logger.error(f"Unknown action '{action}' for resource 'user'")

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

        elif resource == "session":
            permission_to_check = f"session:{action}"
            required_permission_context = permission_to_check
            if permission_to_check in user_permissions:
                if action == "delete_own":  # Kiểm tra session_id có thuộc về user không
                    target_session_id_str = request.path_params.get("session_id")
                    if target_session_id_str and ObjectId.is_valid(
                        target_session_id_str
                    ):
                        session_doc = await db.sessions.find_one(
                            {"_id": ObjectId(target_session_id_str)}
                        )
                        # So sánh user_id (ObjectId) từ session_doc với current_user.id (chuyển sang ObjectId)
                        if session_doc and session_doc.get("user_id") == ObjectId(
                            str(current_user.id)
                        ):
                            allowed = True
                        else:
                            allowed = False
                            required_permission_context = "session:delete_own (failed: session not found or not owned)"
                    else:
                        allowed = False
                        required_permission_context = (
                            "session:delete_own (failed: invalid or missing session_id)"
                        )
                else:  # Các action khác của session (list_own, list_any, delete_any)
                    allowed = True
            else:  # User không có permission cơ bản
                allowed = False

        elif resource == "subscription":
            permission_to_check = f"subscription:{action}"
            required_permission_context = permission_to_check

            if permission_to_check in user_permissions:  # Kiểm tra quyền chung trước
                if action == "read_own":
                    # ID của user mà subscription thuộc về (từ path param hoặc body)
                    target_user_id_for_sub_str: Optional[str] = request.path_params.get(
                        "user_id"
                    )
                    # ID của subscription cụ thể (từ path param)
                    target_sub_id_str: Optional[str] = request.path_params.get(
                        "subscription_id"
                    )

                    if (
                        target_user_id_for_sub_str
                        and str(current_user.id) == target_user_id_for_sub_str
                    ):
                        allowed = True  # User đang xem subscription của chính mình (qua user_id)
                    elif target_sub_id_str and ObjectId.is_valid(target_sub_id_str):
                        sub_doc = await db.subscriptions.find_one(
                            {"_id": ObjectId(target_sub_id_str)}
                        )
                        if sub_doc and sub_doc.get("user_id") == ObjectId(
                            str(current_user.id)
                        ):
                            allowed = True  # User đang xem subscription của chính mình (qua sub_id)
                        else:  # Sub không tồn tại hoặc không thuộc user
                            allowed = False
                            required_permission_context = "subscription:read_own (failed: sub not found or not owned)"
                    else:  # Không có ID hợp lệ để kiểm tra ownership
                        allowed = False
                        required_permission_context = "subscription:read_own (failed: no valid ID for ownership check)"
                else:  # Các action khác như create, read_any, update_any, deactivate_any đã được check bằng perm chung
                    allowed = True
            else:  # Không có quyền chung
                allowed = False

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

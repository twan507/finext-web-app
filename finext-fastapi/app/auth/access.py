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
    user_doc = await db.users.find_one({"_id": user_obj_id}, {"role_ids": 1})

    if not user_doc or not user_doc.get("role_ids"):
        return set()

    role_object_ids_from_user: List[ObjectId] = user_doc.get("role_ids", [])
    if not role_object_ids_from_user:
        return set()

    roles_cursor = db.roles.find(
        {"_id": {"$in": role_object_ids_from_user}}, {"permission_ids": 1}
    )

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
    permissions_docs_cursor = db.permissions.find(
        {"_id": {"$in": list(all_permission_object_ids)}}, {"name": 1}
    )
    async for perm_doc in permissions_docs_cursor:
        if "name" in perm_doc:
            user_permissions_names.add(perm_doc["name"])

    return user_permissions_names


def require_permission(resource: str, action: str):
    async def dependency(
        request: Request,
        current_user: UserInDB = Depends(
            get_current_active_user
        ),
        db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")), # Sửa lại get_database("user_db")
    ) -> UserInDB:
        user_permissions = await _get_user_permissions(db, str(current_user.id))

        allowed = False
        required_permission_context = f"{resource}:{action}" # Mặc định

        if resource == "user":
            target_user_id_str: Optional[str] = (
                request.path_params.get("user_id") if request.path_params else None
            )
            is_self_operation = target_user_id_str and (
                str(current_user.id) == target_user_id_str
            )
            
            if action == "create": # Admin tạo user
                if "user:create" in user_permissions:
                    allowed = True
                required_permission_context = "user:create"
            elif action == "list": # Admin xem danh sách user
                if "user:list" in user_permissions:
                    allowed = True
                required_permission_context = "user:list"
            elif action == "read_any": # Admin đọc user bất kỳ
                if target_user_id_str:  
                    if "user:read_any" in user_permissions:
                        allowed = True
                required_permission_context = "user:read_any"
            elif action == "update": # Cập nhật user
                if not target_user_id_str:
                    logger.error("User permission check for 'user:update' called without target_user_id.")
                elif is_self_operation: # Tự cập nhật
                    if ("user:update_self" in user_permissions or "user:update_any" in user_permissions):
                        allowed = True
                    required_permission_context = "user:update_self or user:update_any (for self)"
                else:  # Admin cập nhật người khác
                    if "user:update_any" in user_permissions:
                        allowed = True
                    required_permission_context = "user:update_any (for others)"
            elif action == "delete_any":  # Admin xóa user khác
                if target_user_id_str and not is_self_operation:
                    if "user:delete_any" in user_permissions:
                        allowed = True
                required_permission_context = "user:delete_any (for others, not self)"
            elif action == "manage_roles":  # Admin gán role
                if target_user_id_str: 
                    if "user:manage_roles" in user_permissions:
                        allowed = True
                required_permission_context = "user:manage_roles"
            else:
                logger.error(f"Unknown action '{action}' for resource 'user'")

        elif resource == "role":
            # Các action: create, list, read_any, update_any, delete_any
            permission_to_check = f"role:{action}"
            if permission_to_check in user_permissions:
                allowed = True
            required_permission_context = permission_to_check

        elif resource == "permission": 
            # Hiện tại chỉ có GET /permissions/ (lấy quyền của user hiện tại), không cần check perm cụ thể ở đây
            # Nếu có endpoint admin xem tất cả định nghĩa permission thì cần:
            if action == "list_all_definitions": # Ví dụ
                 if "permission:list_all_definitions" in user_permissions: # Cần định nghĩa perm này
                     allowed = True
                 required_permission_context = "permission:list_all_definitions"
            else: # Mặc định cho các actions khác của permission (nếu có)
                permission_to_check = f"permission:{action}"
                if permission_to_check in user_permissions:
                    allowed = True
                required_permission_context = permission_to_check


        elif resource == "session":
            # Các action: list_self, list_any, delete_self, delete_any
            permission_to_check = f"session:{action}"
            required_permission_context = permission_to_check
            if permission_to_check in user_permissions:
                if action == "delete_self": 
                    target_session_id_str = request.path_params.get("session_id")
                    if target_session_id_str and ObjectId.is_valid(target_session_id_str):
                        session_doc = await db.sessions.find_one({"_id": ObjectId(target_session_id_str)})
                        if session_doc and session_doc.get("user_id") == ObjectId(str(current_user.id)):
                            allowed = True
                        else:
                            allowed = False
                            required_permission_context = "session:delete_self (failed: session not found or not owned)"
                    else:
                        allowed = False
                        required_permission_context = "session:delete_self (failed: invalid or missing session_id)"
                else: 
                    allowed = True
            else: 
                allowed = False

        elif resource == "subscription":
            # Actions: create, read_own, read_any, update_any, deactivate_any
            permission_to_check = f"subscription:{action}"
            required_permission_context = permission_to_check

            if permission_to_check in user_permissions: 
                if action == "read_own":
                    target_user_id_for_sub_str: Optional[str] = request.path_params.get("user_id")
                    target_sub_id_str: Optional[str] = request.path_params.get("subscription_id")

                    if (target_user_id_for_sub_str and str(current_user.id) == target_user_id_for_sub_str):
                        allowed = True 
                    elif target_sub_id_str and ObjectId.is_valid(target_sub_id_str):
                        sub_doc = await db.subscriptions.find_one({"_id": ObjectId(target_sub_id_str)})
                        if sub_doc and sub_doc.get("user_id") == ObjectId(str(current_user.id)):
                            allowed = True 
                        else:  
                            allowed = False
                            required_permission_context = "subscription:read_own (failed: sub not found or not owned)"
                    else: 
                        # Nếu API không yêu cầu user_id hay subscription_id trong path để xác định ownership
                        # và chỉ dựa vào current_user, thì không cần logic if/else này
                        # Ví dụ: GET /subscriptions/me (không cần check ownership qua path param)
                        # Tuy nhiên, với cấu trúc hiện tại của bạn cho get_subscription_by_id và get_user_subscriptions
                        # thì cần kiểm tra ownership nếu action là read_own.
                        # Nếu đây là endpoint chung như /subscriptions/me, thì allowed=True là đủ.
                        # Hiện tại, `read_subscription_by_id` và `read_user_subscriptions` dùng `read_any`,
                        # nên logic `read_own` ở đây có thể chưa được dùng trực tiếp bởi router.
                        allowed = False # Hoặc True tùy theo logic endpoint cụ thể
                        required_permission_context = "subscription:read_own (failed: no valid ID for ownership check or endpoint logic mismatch)"
                else: 
                    allowed = True
            else: 
                allowed = False
        
        # --- THÊM LOGIC CHO TRANSACTION RESOURCE ---
        elif resource == "transaction":
            permission_to_check = f"transaction:{action}"
            required_permission_context = permission_to_check
            
            if permission_to_check in user_permissions:
                if action == "read_own":
                    # Endpoint /me/history không có transaction_id trong path params
                    # Quyền "transaction:read_own" là đủ để user xem lịch sử của chính họ
                    allowed = True
                elif action in ["create_any", "read_any", "update_details_any", "confirm_payment_any", "cancel_any"]:
                    # Đây là các quyền của Admin, chỉ cần có permission là đủ
                    allowed = True
                elif action == "create_own":
                    # User tự tạo đơn hàng, chỉ cần có permission "transaction:create_own"
                    allowed = True
                # Không cần kiểm tra ownership phức tạp ở đây vì
                # API của user (/me/...) đã tự động lấy current_user.id
                # API của Admin (/admin/...) được bảo vệ bởi các quyền "_any"
                else: # Các action không xác định cho transaction
                    allowed = False
                    logger.warning(f"Unknown action '{action}' for transaction resource in permission check.")
            else:
                allowed = False
        # --- KẾT THÚC LOGIC TRANSACTION ---

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
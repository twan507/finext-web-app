# finext-fastapi/app/auth/access.py
import logging
from typing import Set, Optional, List

from fastapi import Depends, HTTPException, status, Request
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId

from app.auth.dependencies import get_current_active_user
from app.schemas.users import UserInDB 
from app.core.database import get_database
import app.crud.brokers as crud_brokers # Thêm import này

logger = logging.getLogger(__name__)


async def _get_user_permissions(db: AsyncIOMotorDatabase, user_id_str: str) -> Set[str]:
    """Lấy tất cả các tên permission mà user sở hữu thông qua các vai trò."""
    if not ObjectId.is_valid(user_id_str):
        logger.error(f"Định dạng user_id không hợp lệ khi lấy permissions: {user_id_str}")
        return set()

    user_obj_id = ObjectId(user_id_str)
    user_doc = await db.users.find_one({"_id": user_obj_id}, {"role_ids": 1})

    if not user_doc or not user_doc.get("role_ids"):
        return set() # User không có vai trò nào

    role_object_ids_from_user: List[ObjectId] = user_doc.get("role_ids", [])
    if not role_object_ids_from_user:
        return set()

    # Lấy tất cả permission_ids từ các vai trò của user
    roles_cursor = db.roles.find(
        {"_id": {"$in": role_object_ids_from_user}}, {"permission_ids": 1}
    )

    all_permission_object_ids: Set[ObjectId] = set()
    async for role in roles_cursor:
        for perm_obj_id in role.get("permission_ids", []):
            if isinstance(perm_obj_id, ObjectId): 
                all_permission_object_ids.add(perm_obj_id)
            elif ObjectId.is_valid(str(perm_obj_id)): # Chuyển đổi nếu nó là string
                all_permission_object_ids.add(ObjectId(str(perm_obj_id)))

    if not all_permission_object_ids:
        return set() # Không có permission_id nào được liên kết với các vai trò

    # Lấy tên của các permissions đó
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
        request: Request, # Giữ Request để lấy path_params nếu cần
        current_user: UserInDB = Depends(get_current_active_user),
        db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
    ) -> UserInDB:
        user_permissions = await _get_user_permissions(db, str(current_user.id))

        allowed = False
        required_permission_context = f"{resource}:{action}" # Mặc định

        # ---- USER RESOURCE ----
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
                    logger.error("User permission check for 'user:update' called without target_user_id.")
                    # allowed vẫn là False
                elif is_self_operation: 
                    if ("user:update_self" in user_permissions or "user:update_any" in user_permissions):
                        allowed = True
                    required_permission_context = "user:update_self or user:update_any (for self)"
                else:  
                    if "user:update_any" in user_permissions:
                        allowed = True
                    required_permission_context = "user:update_any (for others)"
            elif action == "delete_any":  
                if target_user_id_str and not is_self_operation:
                    if "user:delete_any" in user_permissions:
                        allowed = True
                # Không cho phép tự xóa qua endpoint này, logic xóa self thường ở chỗ khác (vd: user settings)
                required_permission_context = "user:delete_any (for others, not self)"
            elif action == "manage_roles":  
                if target_user_id_str: 
                    if "user:manage_roles" in user_permissions:
                        allowed = True
                required_permission_context = "user:manage_roles"
            else:
                logger.error(f"Unknown action '{action}' for resource 'user'")

        # ---- ROLE RESOURCE ----
        elif resource == "role":
            permission_to_check = f"role:{action}"
            if permission_to_check in user_permissions:
                allowed = True
            required_permission_context = permission_to_check
        
        # ---- PERMISSION RESOURCE ----
        elif resource == "permission": 
            # Endpoint GET /permissions/ (lấy quyền của user hiện tại) không yêu cầu perm cụ thể, chỉ cần đăng nhập.
            # Nếu có endpoint admin xem tất cả định nghĩa permission thì cần:
            if action == "list_all_definitions": # Ví dụ
                 if "permission:list_all_definitions" in user_permissions: 
                     allowed = True
                 required_permission_context = "permission:list_all_definitions"
            elif action == "read_self": # Đây là trường hợp cho GET /permissions/
                allowed = True # Chỉ cần user đăng nhập là được, get_current_active_user đã xử lý
                required_permission_context = "authenticated_user (for listing own permissions)"
            else: 
                permission_to_check = f"permission:{action}"
                if permission_to_check in user_permissions:
                    allowed = True
                required_permission_context = permission_to_check

        # ---- SESSION RESOURCE ----
        elif resource == "session":
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
                            allowed = False # Không log ở đây vì có thể là session không tồn tại
                            required_permission_context = "session:delete_self (failed: session not found or not owned by current user)"
                    else: # session_id không hợp lệ hoặc không có
                        allowed = False
                        required_permission_context = "session:delete_self (failed: invalid or missing session_id in path)"
                else: 
                    allowed = True # Cho list_self, list_any, delete_any (nếu user có quyền)
            else: 
                allowed = False

        # ---- SUBSCRIPTION RESOURCE ----
        elif resource == "subscription":
            permission_to_check = f"subscription:{action}"
            required_permission_context = permission_to_check

            if permission_to_check in user_permissions: 
                if action == "read_own":
                    # Endpoint GET /subscriptions/user/{user_id} hoặc GET /subscriptions/{subscription_id}
                    # cần kiểm tra ownership nếu user chỉ có quyền "read_own"
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
                            required_permission_context = "subscription:read_own (failed: sub not found or not owned by current user)"
                    # Nếu không có user_id hay sub_id trong path, và action là read_own, giả định là cho endpoint /me/...
                    elif not target_user_id_for_sub_str and not target_sub_id_str:
                        allowed = True # User đang xem subscription của chính mình qua một endpoint /me/...
                    else: 
                        allowed = False 
                        required_permission_context = "subscription:read_own (failed: no valid ID for ownership check or endpoint logic mismatch)"
                else: # Cho các action *_any hoặc create
                    allowed = True
            else: 
                allowed = False
        
        # ---- TRANSACTION RESOURCE ----
        elif resource == "transaction":
            permission_to_check = f"transaction:{action}"
            required_permission_context = permission_to_check
            
            if permission_to_check in user_permissions:
                if action == "read_own" or action == "create_own":
                    # User xem lịch sử của mình hoặc tạo đơn hàng cho mình
                    allowed = True
                elif action == "read_referred":
                    # Kiểm tra thêm user có phải là broker không (dù vai trò broker đã có quyền này)
                    # Điều này đảm bảo người dùng thực sự là broker mới được dùng quyền này.
                    broker_details = await crud_brokers.get_broker_by_user_id(db, current_user.id)
                    if broker_details and broker_details.is_active:
                        allowed = True
                    else:
                        allowed = False
                        required_permission_context = "transaction:read_referred (failed: user is not an active broker)"
                elif action in ["create_any", "read_any", "update_details_any", "confirm_payment_any", "cancel_any"]:
                    # Các quyền của Admin
                    allowed = True
                else: 
                    allowed = False
                    logger.warning(f"Unknown action '{action}' for transaction resource in permission check.")
            else:
                allowed = False
        
        # ---- BROKER RESOURCE (MỚI) ----
        elif resource == "broker":
            permission_to_check = f"broker:{action}"
            required_permission_context = permission_to_check

            if permission_to_check in user_permissions:
                if action == "read_self":
                    # Endpoint /brokers/me không có path param để check ownership,
                    # quyền broker:read_self là đủ để user (phải là broker) xem thông tin của mình.
                    # Kiểm tra thêm user có phải là broker không.
                    broker_details = await crud_brokers.get_broker_by_user_id(db, current_user.id)
                    if broker_details: # Không cần check is_active ở đây, chỉ cần là broker
                        allowed = True
                    else:
                        allowed = False
                        required_permission_context = "broker:read_self (failed: user is not a broker)"
                elif action == "validate": # broker:validate là quyền cho user/public
                    allowed = True # Chỉ cần user có quyền này là được phép gọi API
                else: # Cho các action *_any hoặc create (của admin)
                    allowed = True
            else:
                allowed = False


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
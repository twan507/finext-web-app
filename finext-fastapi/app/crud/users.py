# app/crud/user_crud.py
import logging
from typing import Optional, List
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.schemas.users import UserCreate, UserInDB # PyObjectId đã có trong UserInDB và UserCreate
from app.utils.security import get_password_hash
from datetime import datetime, timezone
from app.utils.types import PyObjectId

logger = logging.getLogger(__name__)

async def get_user_by_email_db(db: AsyncIOMotorDatabase, email: str) -> Optional[UserInDB]:
    """
    (Helper) Lấy thông tin người dùng từ database dựa trên email.
    """
    user_doc = await db.users.find_one({"email": email})
    if user_doc:
        return UserInDB(**user_doc)
    return None

async def get_user_by_id_db(db: AsyncIOMotorDatabase, user_id: str) -> Optional[UserInDB]:
    """
    (Helper) Lấy thông tin người dùng từ database dựa trên ID (dạng string).
    """
    if not ObjectId.is_valid(user_id):
        return None
    user_doc = await db.users.find_one({"_id": ObjectId(user_id)})
    if user_doc:
        return UserInDB(**user_doc)
    return None

async def create_user_db(db: AsyncIOMotorDatabase, user_create_data: UserCreate) -> Optional[UserInDB]:
    """
    (Helper) Tạo người dùng mới trong database.
    """
    existing_user = await get_user_by_email_db(db, email=user_create_data.email)
    if existing_user:
        logger.warning(f"Email {user_create_data.email} đã tồn tại.")
        return None

    hashed_password = get_password_hash(user_create_data.password)
    user_document_to_insert = user_create_data.model_dump(exclude={"password"})
    user_document_to_insert["hashed_password"] = hashed_password
    
    # Gán role_ids mặc định
    roles_collection = db.get_collection("roles")
    user_role = await roles_collection.find_one({"name": "user"})
    if user_role:
        user_document_to_insert["role_ids"] = [str(user_role["_id"])] # Đảm bảo là list các string ObjectId
    else:
        user_document_to_insert["role_ids"] = [] # Hoặc để trống nếu UserCreate có default

    try:
        insert_result = await db.users.insert_one(user_document_to_insert)
        if insert_result.inserted_id:
            created_user_doc = await db.users.find_one({"_id": insert_result.inserted_id})
            if created_user_doc:
                return UserInDB(**created_user_doc)
        logger.error(f"Không thể tạo người dùng với email: {user_create_data.email}")
        return None
    except Exception as e:
        logger.error(f"Lỗi khi tạo người dùng {user_create_data.email}: {e}", exc_info=True)
        return None
    
async def assign_roles_to_user(db: AsyncIOMotorDatabase, user_id: PyObjectId, role_ids_to_assign: List[PyObjectId]) -> Optional[UserInDB]:
    if not ObjectId.is_valid(user_id): 
        return None
    
    user_obj_id = ObjectId(user_id)
    user = await db.users.find_one({"_id": user_obj_id})
    if not user: 
        return None

    # Validate role_ids_to_assign (chuyển thành ObjectId và kiểm tra tồn tại)
    valid_role_obj_ids_to_add: List[ObjectId] = []
    for r_id_str in role_ids_to_assign:
        if ObjectId.is_valid(r_id_str):
            role_obj_id = ObjectId(r_id_str)
            role_exists = await db.roles.find_one({"_id": role_obj_id})
            if role_exists:
                valid_role_obj_ids_to_add.append(role_obj_id)
            else:
                logger.warning(f"Role ID '{r_id_str}' not found. Skipping for user assignment.")
        else:
            logger.warning(f"Invalid ObjectId format for role ID '{r_id_str}'. Skipping for user assignment.")
    
    if not valid_role_obj_ids_to_add: # Không có role nào hợp lệ để gán
        # Nếu muốn trả về user hiện tại mà không thay đổi gì:
        # return UserInDB(**user)
        # Hoặc nếu coi đây là lỗi client:
        raise ValueError("No valid roles provided to assign.")


    # Lấy các role_ids hiện tại của user (dưới dạng string)
    current_role_ids_str_set = set(user.get("role_ids", []))
    
    # Thêm các role_id mới (dưới dạng string) vào set để tránh trùng lặp
    for role_obj_id in valid_role_obj_ids_to_add:
        current_role_ids_str_set.add(str(role_obj_id))
    
    updated_role_ids_str_list = list(current_role_ids_str_set)

    await db.users.update_one(
        {"_id": user_obj_id},
        {"$set": {"role_ids": updated_role_ids_str_list, "updated_at": datetime.now(timezone.utc)}}
    )
    
    updated_user_doc = await db.users.find_one({"_id": user_obj_id})
    return UserInDB(**updated_user_doc) if updated_user_doc else None


async def revoke_roles_from_user(db: AsyncIOMotorDatabase, user_id: PyObjectId, role_ids_to_revoke: List[PyObjectId]) -> Optional[UserInDB]:
    if not ObjectId.is_valid(user_id): 
        return None

    user_obj_id = ObjectId(user_id)
    user = await db.users.find_one({"_id": user_obj_id})
    if not user:
        return None

    current_role_ids_str_set = set(user.get("role_ids", []))
    
    # Loại bỏ các role_ids cần thu hồi (chuyển role_ids_to_revoke sang string để so sánh)
    role_ids_to_revoke_str_set = {r_id_str for r_id_str in role_ids_to_revoke if ObjectId.is_valid(r_id_str)}

    # Không cho phép thu hồi vai trò 'admin' từ chính người dùng admin nếu họ chỉ còn vai trò đó
    # (Logic này có thể phức tạp hơn, ví dụ: không cho thu hồi role admin cuối cùng của hệ thống)
    # For simplicity, this check is not added here but could be a business rule.

    remaining_role_ids_str_list = list(current_role_ids_str_set - role_ids_to_revoke_str_set)

    await db.users.update_one(
        {"_id": user_obj_id},
        {"$set": {"role_ids": remaining_role_ids_str_list, "updated_at": datetime.now(timezone.utc)}}
    )
    
    updated_user_doc = await db.users.find_one({"_id": user_obj_id})
    return UserInDB(**updated_user_doc) if updated_user_doc else None
# finext-fastapi/app/crud/users.py
import logging
from typing import Optional, List
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.schemas.users import UserCreate, UserInDB
from app.utils.security import get_password_hash
from datetime import datetime, timezone
from app.utils.types import PyObjectId

logger = logging.getLogger(__name__)

async def get_user_by_email_db(db: AsyncIOMotorDatabase, email: str) -> Optional[UserInDB]:
    user_doc = await db.users.find_one({"email": email})
    if user_doc:
        # Chuyển đổi role_ids từ List[ObjectId] (trong DB) sang List[str] (cho PyObjectId)
        if "role_ids" in user_doc and user_doc["role_ids"]:
            user_doc["role_ids"] = [str(r_id) for r_id in user_doc["role_ids"]]
        if "subscription_id" in user_doc and user_doc["subscription_id"]:
            user_doc["subscription_id"] = str(user_doc["subscription_id"])
        return UserInDB(**user_doc)
    return None

async def get_user_by_id_db(db: AsyncIOMotorDatabase, user_id: str) -> Optional[UserInDB]:
    if not ObjectId.is_valid(user_id):
        return None
    user_doc = await db.users.find_one({"_id": ObjectId(user_id)})
    if user_doc:
        # Chuyển đổi role_ids và subscription_id
        if "role_ids" in user_doc and user_doc["role_ids"]:
            user_doc["role_ids"] = [str(r_id) for r_id in user_doc["role_ids"]]
        if "subscription_id" in user_doc and user_doc["subscription_id"]:
            user_doc["subscription_id"] = str(user_doc["subscription_id"])
        return UserInDB(**user_doc)
    return None

async def create_user_db(db: AsyncIOMotorDatabase, user_create_data: UserCreate) -> Optional[UserInDB]:
    existing_user = await get_user_by_email_db(db, email=user_create_data.email)
    if existing_user:
        logger.warning(f"Email {user_create_data.email} đã tồn tại.")
        return None

    hashed_password = get_password_hash(user_create_data.password)
    user_document_to_insert = user_create_data.model_dump(exclude={"password", "role_ids"})
    user_document_to_insert["hashed_password"] = hashed_password
    user_document_to_insert["subscription_id"] = None

    # Chuyển đổi role_ids từ List[str] (PyObjectId) sang List[ObjectId] để lưu vào DB
    role_object_ids = []
    if user_create_data.role_ids: # Nếu user_create_data có role_ids (mặc định là rỗng)
        for r_id_str in user_create_data.role_ids:
            if ObjectId.is_valid(r_id_str):
                role_object_ids.append(ObjectId(r_id_str))
            else:
                logger.warning(f"Role ID string không hợp lệ khi tạo user: {r_id_str}")
    else: # Nếu không có role_ids nào được cung cấp, gán role "user" mặc định
        user_role_doc = await db.roles.find_one({"name": "user"})
        if user_role_doc and "_id" in user_role_doc:
            role_object_ids.append(user_role_doc["_id"]) # Đây đã là ObjectId

    user_document_to_insert["role_ids"] = role_object_ids

    try:
        insert_result = await db.users.insert_one(user_document_to_insert)
        if insert_result.inserted_id:
            # Khi đọc lại từ DB để trả về UserInDB, get_user_by_id_db sẽ xử lý chuyển đổi lại sang str
            return await get_user_by_id_db(db, str(insert_result.inserted_id))
        logger.error(f"Không thể tạo người dùng với email: {user_create_data.email}")
        return None
    except Exception as e:
        logger.error(f"Lỗi khi tạo người dùng {user_create_data.email}: {e}", exc_info=True)
        return None

async def assign_roles_to_user(db: AsyncIOMotorDatabase, user_id_str: PyObjectId, role_ids_to_assign_str: List[PyObjectId]) -> Optional[UserInDB]:
    if not ObjectId.is_valid(user_id_str):
        return None

    user_obj_id = ObjectId(user_id_str)
    user = await db.users.find_one({"_id": user_obj_id})
    if not user:
        return None

    # Lấy role_ids hiện tại từ DB (chúng là List[ObjectId])
    current_role_obj_ids_set = set(user.get("role_ids", [])) # Đây là Set[ObjectId]

    valid_role_obj_ids_to_add: List[ObjectId] = []
    for r_id_str in role_ids_to_assign_str: # Đây là List[str] từ request
        if ObjectId.is_valid(r_id_str):
            role_obj_id_to_add = ObjectId(r_id_str)
            role_exists = await db.roles.find_one({"_id": role_obj_id_to_add})
            if role_exists:
                valid_role_obj_ids_to_add.append(role_obj_id_to_add)
            else:
                logger.warning(f"Role ID '{r_id_str}' not found. Skipping for user assignment.")
        else:
            logger.warning(f"Invalid ObjectId format for role ID '{r_id_str}'. Skipping.")

    if not valid_role_obj_ids_to_add:
        raise ValueError("No valid roles provided to assign or all provided roles already exist or are invalid.")

    for role_obj_id in valid_role_obj_ids_to_add:
        current_role_obj_ids_set.add(role_obj_id) # Thêm ObjectId vào Set[ObjectId]

    updated_role_obj_ids_list = list(current_role_obj_ids_set) # Đây là List[ObjectId]

    await db.users.update_one(
        {"_id": user_obj_id},
        {"$set": {"role_ids": updated_role_obj_ids_list, "updated_at": datetime.now(timezone.utc)}}
    )
    return await get_user_by_id_db(db, user_id_str)


async def revoke_roles_from_user(db: AsyncIOMotorDatabase, user_id_str: PyObjectId, role_ids_to_revoke_str: List[PyObjectId]) -> Optional[UserInDB]:
    if not ObjectId.is_valid(user_id_str):
        return None

    user_obj_id = ObjectId(user_id_str)
    user = await db.users.find_one({"_id": user_obj_id})
    if not user:
        return None

    current_role_obj_ids_set = set(user.get("role_ids", [])) # Đây là Set[ObjectId]

    # Chuyển role_ids_to_revoke_str (List[str]) thành Set[ObjectId]
    role_obj_ids_to_revoke_set = set()
    for r_id_str in role_ids_to_revoke_str:
        if ObjectId.is_valid(r_id_str):
            role_obj_ids_to_revoke_set.add(ObjectId(r_id_str))
        else:
            logger.warning(f"Invalid ObjectId format for role ID to revoke '{r_id_str}'. Skipping.")

    remaining_role_obj_ids_list = list(current_role_obj_ids_set - role_obj_ids_to_revoke_set) # Đây là List[ObjectId]

    await db.users.update_one(
        {"_id": user_obj_id},
        {"$set": {"role_ids": remaining_role_obj_ids_list, "updated_at": datetime.now(timezone.utc)}}
    )
    return await get_user_by_id_db(db, user_id_str)
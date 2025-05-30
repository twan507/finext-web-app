# finext-fastapi/app/crud/users.py
import logging
from typing import Optional, List
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.schemas.users import UserCreate, UserInDB # UserUpdate is not directly used in CRUD for full updates
from app.utils.security import get_password_hash
from datetime import datetime, timezone
from app.utils.types import PyObjectId
import app.crud.brokers as crud_brokers

logger = logging.getLogger(__name__)

async def get_user_by_email_db(db: AsyncIOMotorDatabase, email: str) -> Optional[UserInDB]:
    user_doc = await db.users.find_one({"email": email})
    if user_doc:
        if "role_ids" in user_doc and user_doc["role_ids"]:
            user_doc["role_ids"] = [str(r_id) for r_id in user_doc["role_ids"]]
        if "subscription_id" in user_doc and user_doc["subscription_id"]:
            if isinstance(user_doc["subscription_id"], ObjectId):
                 user_doc["subscription_id"] = str(user_doc["subscription_id"])
        # avatar_url is already a string or None, no conversion needed from DB if stored correctly
        return UserInDB(**user_doc)
    return None

async def get_user_by_id_db(db: AsyncIOMotorDatabase, user_id: str) -> Optional[UserInDB]:
    if not ObjectId.is_valid(user_id):
        return None
    user_doc = await db.users.find_one({"_id": ObjectId(user_id)})
    if user_doc:
        if "role_ids" in user_doc and user_doc["role_ids"]:
            user_doc["role_ids"] = [str(r_id) for r_id in user_doc["role_ids"]]
        if "subscription_id" in user_doc and user_doc["subscription_id"]:
            if isinstance(user_doc["subscription_id"], ObjectId):
                 user_doc["subscription_id"] = str(user_doc["subscription_id"])
        # avatar_url is already a string or None
        return UserInDB(**user_doc)
    return None

async def create_user_db(
    db: AsyncIOMotorDatabase,
    user_create_data: UserCreate, # UserCreate giờ không có role_ids
    set_active_on_create: bool = False
) -> Optional[UserInDB]:
    existing_user = await get_user_by_email_db(db, email=user_create_data.email)
    if existing_user:
        if existing_user.is_active:
            logger.warning(f"Email {user_create_data.email} đã tồn tại và đã được kích hoạt.")
            raise ValueError(f"Email '{user_create_data.email}' đã được đăng ký và kích hoạt.")
        else:
            logger.warning(f"Email {user_create_data.email} đã tồn tại nhưng chưa kích hoạt. Cân nhắc cho phép xác thực lại.")
            raise ValueError(f"Email '{user_create_data.email}' đã được đăng ký nhưng chưa kích hoạt. Vui lòng kiểm tra email để xác thực hoặc liên hệ hỗ trợ.")


    hashed_password = get_password_hash(user_create_data.password)

    # Lấy các trường từ UserCreate
    user_document_to_insert = user_create_data.model_dump(exclude={"password", "referral_code"}) # avatar_url is included

    user_document_to_insert["hashed_password"] = hashed_password
    user_document_to_insert["is_active"] = set_active_on_create
    user_document_to_insert["created_at"] = datetime.now(timezone.utc)
    user_document_to_insert["updated_at"] = datetime.now(timezone.utc)
    user_document_to_insert["subscription_id"] = None
    # avatar_url is already in user_document_to_insert from model_dump if provided, defaults to None if not

    if user_create_data.referral_code:
        is_valid_ref_code = await crud_brokers.is_broker_code_valid_and_active(db, user_create_data.referral_code)
        if is_valid_ref_code:
            user_document_to_insert["referral_code"] = user_create_data.referral_code.upper()
        else:
            logger.warning(f"Mã giới thiệu '{user_create_data.referral_code}' không hợp lệ. User '{user_create_data.email}' sẽ được tạo không có mã giới thiệu.")
            user_document_to_insert["referral_code"] = None
    else:
        user_document_to_insert["referral_code"] = None

    role_object_ids = []
    user_role_doc = await db.roles.find_one({"name": "user"})
    if user_role_doc and "_id" in user_role_doc:
        role_object_ids.append(user_role_doc["_id"])
    else:
        logger.error("Quan trọng: Không tìm thấy vai trò 'user' mặc định trong database. User mới sẽ không có vai trò nào được gán.")
        raise Exception("Lỗi hệ thống: Không tìm thấy vai trò 'user' mặc định.")

    user_document_to_insert["role_ids"] = role_object_ids

    try:
        insert_result = await db.users.insert_one(user_document_to_insert)
        if insert_result.inserted_id:
            # Fetch the created user to return UserInDB object
            created_user_doc = await db.users.find_one({"_id": insert_result.inserted_id})
            if created_user_doc:
                # Ensure related IDs are strings for Pydantic model
                if "role_ids" in created_user_doc and created_user_doc["role_ids"]:
                    created_user_doc["role_ids"] = [str(r_id) for r_id in created_user_doc["role_ids"]]
                if "subscription_id" in created_user_doc and created_user_doc["subscription_id"]:
                    if isinstance(created_user_doc["subscription_id"], ObjectId):
                        created_user_doc["subscription_id"] = str(created_user_doc["subscription_id"])
                return UserInDB(**created_user_doc)
        logger.error(f"Không thể tạo người dùng với email: {user_create_data.email}")
        return None
    except Exception as e:
        logger.error(f"Lỗi khi tạo người dùng {user_create_data.email}: {e}", exc_info=True)
        return None

async def set_user_avatar(db: AsyncIOMotorDatabase, user_id: PyObjectId, avatar_url: Optional[str]) -> bool:
    """
    Updates the avatar_url for a specific user.
    """
    if not ObjectId.is_valid(user_id):
        logger.error(f"Invalid user_id format for updating avatar: {user_id}")
        return False
    
    user_obj_id = ObjectId(user_id)
    update_result = await db.users.update_one(
        {"_id": user_obj_id},
        {"$set": {"avatar_url": avatar_url, "updated_at": datetime.now(timezone.utc)}}
    )
    if update_result.modified_count > 0:
        logger.info(f"Avatar updated for user {user_id}. New URL: {avatar_url}")
        return True
    elif update_result.matched_count > 0 and update_result.modified_count == 0:
        logger.info(f"Avatar URL for user {user_id} is already '{avatar_url}'. No update needed.")
        return True # Considered success as the state is as requested
    
    logger.warning(f"Failed to update avatar for user {user_id} or user not found.")
    return False


async def assign_roles_to_user(db: AsyncIOMotorDatabase, user_id_str: PyObjectId, role_ids_to_assign_str: List[PyObjectId]) -> Optional[UserInDB]:
    if not ObjectId.is_valid(user_id_str):
        logger.error(f"User ID không hợp lệ khi gán role: {user_id_str}")
        return None

    user_obj_id = ObjectId(user_id_str)
    user = await db.users.find_one({"_id": user_obj_id})
    if not user:
        logger.error(f"User với ID {user_id_str} không tìm thấy để gán role.")
        return None

    current_role_obj_ids_set = set(user.get("role_ids", []))

    valid_role_obj_ids_to_add: List[ObjectId] = []
    for r_id_str in role_ids_to_assign_str:
        if ObjectId.is_valid(r_id_str):
            role_obj_id_to_add = ObjectId(r_id_str)
            role_exists = await db.roles.find_one({"_id": role_obj_id_to_add})
            if role_exists:
                valid_role_obj_ids_to_add.append(role_obj_id_to_add)
            else:
                logger.warning(f"Role ID '{r_id_str}' không tồn tại. Bỏ qua khi gán role cho user.")
        else:
            logger.warning(f"Định dạng ObjectId không hợp lệ cho Role ID '{r_id_str}'. Bỏ qua.")

    if not valid_role_obj_ids_to_add and not role_ids_to_assign_str: # Nếu list rỗng được truyền vào, không làm gì cả
        pass
    elif not valid_role_obj_ids_to_add and role_ids_to_assign_str: # Nếu list có phần tử nhưng không có cái nào valid
        raise ValueError("Không có vai trò hợp lệ nào được cung cấp để gán hoặc tất cả vai trò cung cấp không tồn tại.")


    for role_obj_id in valid_role_obj_ids_to_add:
        current_role_obj_ids_set.add(role_obj_id)

    updated_role_obj_ids_list = list(current_role_obj_ids_set)

    await db.users.update_one(
        {"_id": user_obj_id},
        {"$set": {"role_ids": updated_role_obj_ids_list, "updated_at": datetime.now(timezone.utc)}}
    )
    return await get_user_by_id_db(db, user_id_str)


async def revoke_roles_from_user(db: AsyncIOMotorDatabase, user_id_str: PyObjectId, role_ids_to_revoke_str: List[PyObjectId]) -> Optional[UserInDB]:
    if not ObjectId.is_valid(user_id_str):
        logger.error(f"User ID không hợp lệ khi thu hồi role: {user_id_str}")
        return None

    user_obj_id = ObjectId(user_id_str)
    user = await db.users.find_one({"_id": user_obj_id})
    if not user:
        logger.error(f"User với ID {user_id_str} không tìm thấy để thu hồi role.")
        return None

    current_role_obj_ids_set = set(user.get("role_ids", []))

    role_obj_ids_to_revoke_set = set()
    for r_id_str in role_ids_to_revoke_str:
        if ObjectId.is_valid(r_id_str):
            role_obj_ids_to_revoke_set.add(ObjectId(r_id_str))
        else:
            logger.warning(f"Định dạng ObjectId không hợp lệ cho Role ID '{r_id_str}' cần thu hồi. Bỏ qua.")

    remaining_role_obj_ids_list = list(current_role_obj_ids_set - role_obj_ids_to_revoke_set)

    await db.users.update_one(
        {"_id": user_obj_id},
        {"$set": {"role_ids": remaining_role_obj_ids_list, "updated_at": datetime.now(timezone.utc)}}
    )
    return await get_user_by_id_db(db, user_id_str)

async def update_user_password(db: AsyncIOMotorDatabase, user_id: PyObjectId, new_password: str) -> bool:
    new_hashed_password = get_password_hash(new_password)
    update_result = await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"hashed_password": new_hashed_password, "updated_at": datetime.now(timezone.utc)}}
    )
    return update_result.modified_count > 0
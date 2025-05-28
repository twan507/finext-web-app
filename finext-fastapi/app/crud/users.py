# finext-fastapi/app/crud/users.py
import logging
from typing import Optional, List
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.schemas.users import UserCreate, UserInDB
from app.utils.security import get_password_hash
from datetime import datetime, timezone
from app.utils.types import PyObjectId
import app.crud.brokers as crud_brokers # MỚI: import crud_brokers

logger = logging.getLogger(__name__)

async def get_user_by_email_db(db: AsyncIOMotorDatabase, email: str) -> Optional[UserInDB]:
    user_doc = await db.users.find_one({"email": email})
    if user_doc:
        # Chuyển đổi role_ids từ List[ObjectId] (trong DB) sang List[str] (cho PyObjectId)
        if "role_ids" in user_doc and user_doc["role_ids"]:
            user_doc["role_ids"] = [str(r_id) for r_id in user_doc["role_ids"]]
        if "subscription_id" in user_doc and user_doc["subscription_id"]:
            user_doc["subscription_id"] = str(user_doc["subscription_id"])
        # referral_code đã là string trong DB (nếu có)
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
        # referral_code đã là string
        return UserInDB(**user_doc)
    return None

async def create_user_db(db: AsyncIOMotorDatabase, user_create_data: UserCreate) -> Optional[UserInDB]:
    existing_user = await get_user_by_email_db(db, email=user_create_data.email)
    if existing_user:
        logger.warning(f"Email {user_create_data.email} đã tồn tại.")
        return None # Hoặc raise HTTPException(status_code=400, detail="Email already registered")

    hashed_password = get_password_hash(user_create_data.password)
    # Bỏ referral_code khỏi model_dump ban đầu để xử lý riêng
    user_document_to_insert = user_create_data.model_dump(exclude={"password", "role_ids", "referral_code"})
    user_document_to_insert["hashed_password"] = hashed_password
    user_document_to_insert["subscription_id"] = None # User mới chưa có sub active

    # Xử lý referral_code (MỚI)
    if user_create_data.referral_code:
        is_valid_ref_code = await crud_brokers.is_broker_code_valid_and_active(db, user_create_data.referral_code)
        if is_valid_ref_code:
            user_document_to_insert["referral_code"] = user_create_data.referral_code.upper()
            logger.info(f"Referral code '{user_create_data.referral_code}' hợp lệ và được gán cho user '{user_create_data.email}'.")
        else:
            # Quyết định: Bỏ qua mã không hợp lệ hay báo lỗi?
            # Hiện tại: Bỏ qua và ghi log
            logger.warning(f"Referral code '{user_create_data.referral_code}' không hợp lệ hoặc không active. User '{user_create_data.email}' sẽ được tạo không có referral code.")
            user_document_to_insert["referral_code"] = None # Hoặc không set trường này
    else:
        user_document_to_insert["referral_code"] = None


    role_object_ids = []
    if user_create_data.role_ids: 
        for r_id_str in user_create_data.role_ids:
            if ObjectId.is_valid(r_id_str):
                # Kiểm tra xem role_id có tồn tại trong collection 'roles' không
                role_exists = await db.roles.find_one({"_id": ObjectId(r_id_str)})
                if role_exists:
                    role_object_ids.append(ObjectId(r_id_str))
                else:
                    logger.warning(f"Role ID '{r_id_str}' không tồn tại. Bỏ qua khi tạo user.")
            else:
                logger.warning(f"Role ID string không hợp lệ khi tạo user: {r_id_str}")
    
    if not role_object_ids: # Nếu không có role_ids nào được cung cấp HOẶC các role_ids cung cấp không hợp lệ
        user_role_doc = await db.roles.find_one({"name": "user"})
        if user_role_doc and "_id" in user_role_doc:
            role_object_ids.append(user_role_doc["_id"]) 
        else:
            logger.error("Không tìm thấy vai trò 'user' mặc định để gán cho người dùng mới.")
            # Có thể raise lỗi ở đây nếu vai trò mặc định là bắt buộc

    user_document_to_insert["role_ids"] = role_object_ids

    try:
        insert_result = await db.users.insert_one(user_document_to_insert)
        if insert_result.inserted_id:
            return await get_user_by_id_db(db, str(insert_result.inserted_id))
        logger.error(f"Không thể tạo người dùng với email: {user_create_data.email}")
        return None
    except Exception as e:
        logger.error(f"Lỗi khi tạo người dùng {user_create_data.email}: {e}", exc_info=True)
        return None

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
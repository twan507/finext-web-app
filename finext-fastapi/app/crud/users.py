# app/crud/user_crud.py
import logging
from typing import Optional
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.schemas.users import UserCreate, UserInDB # PyObjectId đã có trong UserInDB và UserCreate
from app.utils.security import get_password_hash

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
# finext-fastapi/app/crud/users.py
import logging
from typing import Optional, List
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

# THÊM LicenseInfo VÀ LicenseInDB
from app.schemas.users import UserCreate, UserInDB, LicenseInfo
from app.utils.security import get_password_hash
from datetime import datetime, timezone, timedelta # THÊM timedelta
from app.utils.types import PyObjectId
import app.crud.licenses as crud_licenses # THÊM

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
    user_document_to_insert = user_create_data.model_dump(exclude={"password", "license_info"}) # Bỏ license_info tạm thời
    user_document_to_insert["hashed_password"] = hashed_password

    # Gán role_ids mặc định
    roles_collection = db.get_collection("roles")
    user_role = await roles_collection.find_one({"name": "user"})
    if user_role:
        user_document_to_insert["role_ids"] = [str(user_role["_id"])] # Đảm bảo là list các string ObjectId
    else:
        user_document_to_insert["role_ids"] = []

    # Xử lý license_info nếu có, nếu không thì gán default 'free'
    if user_create_data.license_info:
         user_document_to_insert["license_info"] = user_create_data.license_info.model_dump()
    else:
        free_license = await crud_licenses.get_license_by_key(db, "free")
        if free_license:
            now = datetime.now(timezone.utc)
            expiry_date = now + timedelta(days=free_license.duration_days)
            user_document_to_insert["license_info"] = LicenseInfo(
                active_license_id=free_license.id,
                license_start_date=now,
                license_expiry_date=expiry_date
            ).model_dump()
        else:
            user_document_to_insert["license_info"] = None # Hoặc xử lý lỗi


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

    if not valid_role_obj_ids_to_add:
        raise ValueError("No valid roles provided to assign.")


    current_role_ids_str_set = set(user.get("role_ids", []))

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

    role_ids_to_revoke_str_set = {r_id_str for r_id_str in role_ids_to_revoke if ObjectId.is_valid(r_id_str)}

    remaining_role_ids_str_list = list(current_role_ids_str_set - role_ids_to_revoke_str_set)

    await db.users.update_one(
        {"_id": user_obj_id},
        {"$set": {"role_ids": remaining_role_ids_str_list, "updated_at": datetime.now(timezone.utc)}}
    )

    updated_user_doc = await db.users.find_one({"_id": user_obj_id})
    return UserInDB(**updated_user_doc) if updated_user_doc else None

# HÀM MỚI ĐỂ GÁN LICENSE
async def assign_license_to_user_db(
    db: AsyncIOMotorDatabase,
    user_id: PyObjectId,
    license_key: str,
    duration_override_days: Optional[int] = None
) -> Optional[UserInDB]:
    """Gán một license cho người dùng và cập nhật ngày hết hạn."""
    user = await get_user_by_id_db(db, str(user_id))
    if not user:
        logger.error(f"User with ID {user_id} not found for license assignment.")
        return None

    license_to_assign = await crud_licenses.get_license_by_key(db, license_key)
    if not license_to_assign:
        logger.error(f"License with key '{license_key}' not found.")
        return None

    now = datetime.now(timezone.utc)
    duration = duration_override_days if duration_override_days is not None else license_to_assign.duration_days
    expiry_date = now + timedelta(days=duration)

    new_license_info = LicenseInfo(
        active_license_id=license_to_assign.id,
        license_start_date=now,
        license_expiry_date=expiry_date
    )

    update_result = await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"license_info": new_license_info.model_dump(), "updated_at": now}}
    )

    if update_result.matched_count > 0:
        return await get_user_by_id_db(db, str(user_id))
    else:
        logger.error(f"Failed to update license for user {user_id}.")
        return None
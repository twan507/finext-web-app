# finext-fastapi/app/crud/roles.py
import logging
from typing import List, Optional
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timezone

from app.schemas.roles import RoleCreate, RoleUpdate, RoleInDB
from app.utils.types import PyObjectId

logger = logging.getLogger(__name__)

async def get_role_by_id(db: AsyncIOMotorDatabase, role_id: PyObjectId) -> Optional[RoleInDB]:
    if not ObjectId.is_valid(role_id):
        return None
    role_doc = await db.roles.find_one({"_id": ObjectId(role_id)})
    if role_doc:
        return RoleInDB(**role_doc)
    return None

async def get_role_by_name(db: AsyncIOMotorDatabase, name: str) -> Optional[RoleInDB]:
    role_doc = await db.roles.find_one({"name": name})
    if role_doc:
        return RoleInDB(**role_doc)
    return None

async def get_roles(db: AsyncIOMotorDatabase, skip: int = 0, limit: int = 100) -> List[RoleInDB]:
    roles_cursor = db.roles.find().skip(skip).limit(limit)
    roles = await roles_cursor.to_list(length=limit)
    return [RoleInDB(**role) for role in roles]

async def create_role(db: AsyncIOMotorDatabase, role_create_data: RoleCreate) -> Optional[RoleInDB]:
    if await get_role_by_name(db, role_create_data.name):
        logger.warning(f"Role with name '{role_create_data.name}' already exists.")
        return None # Hoặc raise HTTPException nếu muốn router xử lý

    # Validate permission_ids (chuyển đổi và kiểm tra sự tồn tại nếu cần)
    valid_permission_ids_str: List[PyObjectId] = []
    if role_create_data.permission_ids:
        for perm_id_str in role_create_data.permission_ids:
            if ObjectId.is_valid(perm_id_str):
                # Kiểm tra xem permission_id này có tồn tại trong 'permissions' collection không
                permission_exists = await db.permissions.find_one({"_id": ObjectId(perm_id_str)})
                if permission_exists:
                    valid_permission_ids_str.append(perm_id_str)
                else:
                    logger.warning(f"Permission ID '{perm_id_str}' not found. Skipping for role '{role_create_data.name}'.")
            else:
                logger.warning(f"Invalid ObjectId format for permission ID '{perm_id_str}'. Skipping for role '{role_create_data.name}'.")
    
    dt_now = datetime.now(timezone.utc)
    role_doc_to_insert = {
        "name": role_create_data.name,
        "description": role_create_data.description,
        "permission_ids": valid_permission_ids_str, # Chỉ lưu các permission_ids hợp lệ và tồn tại
        "created_at": dt_now,
        "updated_at": dt_now
    }
    
    try:
        insert_result = await db.roles.insert_one(role_doc_to_insert)
        if insert_result.inserted_id:
            created_role_doc = await db.roles.find_one({"_id": insert_result.inserted_id})
            if created_role_doc:
                return RoleInDB(**created_role_doc)
        logger.error(f"Failed to create role with name: {role_create_data.name}")
        return None
    except Exception as e:
        logger.error(f"Error creating role {role_create_data.name}: {e}", exc_info=True)
        return None

async def update_role(db: AsyncIOMotorDatabase, role_id: PyObjectId, role_update_data: RoleUpdate) -> Optional[RoleInDB]:
    if not ObjectId.is_valid(role_id):
        logger.error(f"Invalid role_id format for update: {role_id}")
        return None

    existing_role = await db.roles.find_one({"_id": ObjectId(role_id)})
    if not existing_role:
        return None

    update_data = role_update_data.model_dump(exclude_unset=True)

    # Nếu tên role được cập nhật, kiểm tra xem tên mới có bị trùng không
    if "name" in update_data and update_data["name"] != existing_role.get("name"):
        if await db.roles.find_one({"name": update_data["name"], "_id": {"$ne": ObjectId(role_id)}}):
            logger.warning(f"Role name '{update_data['name']}' already exists.")
            # Có thể raise lỗi ở đây để router bắt, hoặc trả về một giá trị đặc biệt
            raise ValueError(f"Role name '{update_data['name']}' already exists.")


    # Validate và cập nhật permission_ids nếu có trong payload
    if "permission_ids" in update_data:
        valid_permission_ids_str: List[PyObjectId] = []
        if update_data["permission_ids"] is not None: # Check if it's explicitly set (even to empty list)
            for perm_id_str in update_data["permission_ids"]:
                if ObjectId.is_valid(perm_id_str):
                    permission_exists = await db.permissions.find_one({"_id": ObjectId(perm_id_str)})
                    if permission_exists:
                        valid_permission_ids_str.append(perm_id_str)
                    else:
                        logger.warning(f"Permission ID '{perm_id_str}' not found. Skipping for role update.")
                else:
                    logger.warning(f"Invalid ObjectId format for permission ID '{perm_id_str}'. Skipping for role update.")
            update_data["permission_ids"] = valid_permission_ids_str
        # If "permission_ids" key is in update_data but its value is None, it will be set to None
        # If "permission_ids" is not in update_data, it won't be changed.

    if not update_data: # Không có gì để cập nhật
        return RoleInDB(**existing_role)

    update_data["updated_at"] = datetime.now(timezone.utc)

    updated_result = await db.roles.update_one(
        {"_id": ObjectId(role_id)},
        {"$set": update_data}
    )

    if updated_result.matched_count > 0:
        updated_role_doc = await db.roles.find_one({"_id": ObjectId(role_id)})
        if updated_role_doc:
            return RoleInDB(**updated_role_doc)
    return None


async def delete_role(db: AsyncIOMotorDatabase, role_id: PyObjectId) -> bool:
    if not ObjectId.is_valid(role_id):
        return False
    
    # Optional: Kiểm tra xem role này có đang được sử dụng bởi user nào không trước khi xóa.
    # Ví dụ: users_using_role = await db.users.count_documents({"role_ids": role_id_str})
    # if users_using_role > 0:
    #     raise HTTPException(status_code=400, detail="Role is currently in use by users and cannot be deleted.")

    delete_result = await db.roles.delete_one({"_id": ObjectId(role_id)})
    return delete_result.deleted_count > 0
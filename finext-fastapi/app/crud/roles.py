# finext-fastapi/app/crud/roles.py
import logging
from typing import List, Optional
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timezone

from app.schemas.roles import RoleCreate, RoleUpdate, RoleInDB
from app.utils.types import PyObjectId
from app.core.config import PROTECTED_ROLE_NAMES # Import danh sách tên role được bảo vệ

logger = logging.getLogger(__name__)

async def get_role_by_id(db: AsyncIOMotorDatabase, role_id_str: PyObjectId) -> Optional[RoleInDB]:
    if not ObjectId.is_valid(role_id_str):
        return None
    role_doc = await db.roles.find_one({"_id": ObjectId(role_id_str)})
    if role_doc:
        if "permission_ids" in role_doc and role_doc["permission_ids"]:
            role_doc["permission_ids"] = [str(p_id) for p_id in role_doc["permission_ids"]]
        return RoleInDB(**role_doc)
    return None

async def get_role_by_name(db: AsyncIOMotorDatabase, name: str) -> Optional[RoleInDB]:
    role_doc = await db.roles.find_one({"name": name})
    if role_doc:
        if "permission_ids" in role_doc and role_doc["permission_ids"]:
            role_doc["permission_ids"] = [str(p_id) for p_id in role_doc["permission_ids"]]
        return RoleInDB(**role_doc)
    return None

async def get_roles(db: AsyncIOMotorDatabase, skip: int = 0, limit: int = 100) -> List[RoleInDB]:
    roles_cursor = db.roles.find().skip(skip).limit(limit)
    roles_from_db = await roles_cursor.to_list(length=limit)
    
    processed_roles = []
    for role_doc in roles_from_db:
        if "permission_ids" in role_doc and role_doc["permission_ids"]:
            role_doc["permission_ids"] = [str(p_id) for p_id in role_doc["permission_ids"]]
        processed_roles.append(RoleInDB(**role_doc))
    return processed_roles


async def create_role(db: AsyncIOMotorDatabase, role_create_data: RoleCreate) -> Optional[RoleInDB]:
    if await get_role_by_name(db, role_create_data.name):
        logger.warning(f"Role with name '{role_create_data.name}' already exists.")
        return None

    valid_permission_obj_ids: List[ObjectId] = []
    if role_create_data.permission_ids: 
        for perm_id_str in role_create_data.permission_ids:
            if ObjectId.is_valid(perm_id_str):
                perm_obj_id = ObjectId(perm_id_str)
                permission_exists = await db.permissions.find_one({"_id": perm_obj_id})
                if permission_exists:
                    valid_permission_obj_ids.append(perm_obj_id)
                else:
                    logger.warning(f"Permission ID '{perm_id_str}' not found. Skipping for role '{role_create_data.name}'.")
            else:
                logger.warning(f"Invalid ObjectId format for permission ID '{perm_id_str}'.")
    
    dt_now = datetime.now(timezone.utc)
    role_doc_to_insert = {
        "name": role_create_data.name,
        "description": role_create_data.description,
        "permission_ids": valid_permission_obj_ids, 
        "created_at": dt_now,
        "updated_at": dt_now
    }
    
    try:
        insert_result = await db.roles.insert_one(role_doc_to_insert)
        if insert_result.inserted_id:
            return await get_role_by_id(db, str(insert_result.inserted_id))
        logger.error(f"Failed to create role with name: {role_create_data.name}")
        return None
    except Exception as e:
        logger.error(f"Error creating role {role_create_data.name}: {e}", exc_info=True)
        return None

async def update_role(db: AsyncIOMotorDatabase, role_id_str: PyObjectId, role_update_data: RoleUpdate) -> Optional[RoleInDB]:
    if not ObjectId.is_valid(role_id_str):
        logger.error(f"Invalid role_id format for update: {role_id_str}")
        return None

    role_obj_id = ObjectId(role_id_str)
    existing_role = await db.roles.find_one({"_id": role_obj_id})
    if not existing_role:
        return None

    # Prevent renaming protected roles
    if "name" in role_update_data.model_dump(exclude_unset=True) and existing_role.get("name") in PROTECTED_ROLE_NAMES and role_update_data.name != existing_role.get("name"):
        logger.warning(f"Attempt to rename protected role '{existing_role.get('name')}' to '{role_update_data.name}'. Denied.")
        raise ValueError(f"Cannot rename protected role '{existing_role.get('name')}'.")


    update_data = role_update_data.model_dump(exclude_unset=True)

    if "name" in update_data and update_data["name"] != existing_role.get("name"):
        if await db.roles.find_one({"name": update_data["name"], "_id": {"$ne": role_obj_id}}):
            raise ValueError(f"Role name '{update_data['name']}' already exists.")

    if "permission_ids" in update_data: 
        valid_permission_obj_ids: List[ObjectId] = []
        if update_data["permission_ids"] is not None:
            for perm_id_str in update_data["permission_ids"]:
                if ObjectId.is_valid(perm_id_str):
                    perm_obj_id = ObjectId(perm_id_str)
                    permission_exists = await db.permissions.find_one({"_id": perm_obj_id})
                    if permission_exists:
                        valid_permission_obj_ids.append(perm_obj_id)
                    else:
                        logger.warning(f"Permission ID '{perm_id_str}' not found during role update.")
                else:
                    logger.warning(f"Invalid ObjectId format for permission ID '{perm_id_str}' during role update.")
            update_data["permission_ids"] = valid_permission_obj_ids 
        
    if not update_data:
        return await get_role_by_id(db, role_id_str)

    update_data["updated_at"] = datetime.now(timezone.utc)

    updated_result = await db.roles.update_one(
        {"_id": role_obj_id},
        {"$set": update_data}
    )

    if updated_result.matched_count > 0:
        return await get_role_by_id(db, role_id_str)
    return None


async def delete_role(db: AsyncIOMotorDatabase, role_id_str: PyObjectId) -> bool:
    if not ObjectId.is_valid(role_id_str):
        return False
    
    role_obj_id = ObjectId(role_id_str)
    role_to_delete = await db.roles.find_one({"_id": role_obj_id})

    if not role_to_delete:
        logger.warning(f"Role ID {role_id_str} not found for deletion.")
        return False

    # Check if the role is a protected system role
    if role_to_delete.get("name") in PROTECTED_ROLE_NAMES:
        logger.warning(f"Attempt to delete protected system role: {role_to_delete.get('name')} (ID: {role_id_str}). Deletion denied.")
        raise ValueError(f"Cannot delete protected system role: '{role_to_delete.get('name')}'.")

    users_using_role_count = await db.users.count_documents({"role_ids": role_obj_id})
    if users_using_role_count > 0:
        logger.warning(f"Role ID {role_id_str} is in use by {users_using_role_count} users. Cannot delete.")
        raise ValueError(f"Role '{role_to_delete.get('name')}' is currently in use by {users_using_role_count} users and cannot be deleted.")

    delete_result = await db.roles.delete_one({"_id": role_obj_id})
    return delete_result.deleted_count > 0
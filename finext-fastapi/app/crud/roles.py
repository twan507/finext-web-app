# finext-fastapi/app/crud/roles.py
import logging
from typing import List, Optional, Tuple # Thêm Tuple
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timezone

from app.schemas.roles import RoleCreate, RoleUpdate, RoleInDB
from app.utils.types import PyObjectId
from app.core.config import PROTECTED_ROLE_NAMES 

logger = logging.getLogger(__name__)
ROLES_COLLECTION = "roles" # Định nghĩa tên collection
PERMISSIONS_COLLECTION = "permissions" # Định nghĩa tên collection permissions
USERS_COLLECTION = "users" # Định nghĩa tên collection users


async def get_role_by_id(db: AsyncIOMotorDatabase, role_id_str: PyObjectId) -> Optional[RoleInDB]:
    if not ObjectId.is_valid(role_id_str):
        return None
    role_doc = await db[ROLES_COLLECTION].find_one({"_id": ObjectId(role_id_str)})
    if role_doc:
        # Chuyển đổi ObjectId list sang str list cho Pydantic
        if "permission_ids" in role_doc and role_doc["permission_ids"]:
            role_doc["permission_ids"] = [str(p_id) for p_id in role_doc["permission_ids"]]
        return RoleInDB(**role_doc)
    return None

async def get_role_by_name(db: AsyncIOMotorDatabase, name: str) -> Optional[RoleInDB]:
    role_doc = await db[ROLES_COLLECTION].find_one({"name": name})
    if role_doc:
        if "permission_ids" in role_doc and role_doc["permission_ids"]:
            role_doc["permission_ids"] = [str(p_id) for p_id in role_doc["permission_ids"]]
        return RoleInDB(**role_doc)
    return None

# <<<< PHẦN CẬP NHẬT >>>>
async def get_roles(
    db: AsyncIOMotorDatabase, 
    skip: int = 0, 
    limit: int = 100,
    # Thêm các filter nếu cần, ví dụ:
    # name_filter: Optional[str] = None,
) -> Tuple[List[RoleInDB], int]: # Trả về Tuple
    """
    Lấy danh sách roles với filter và phân trang, trả về cả total count.
    """
    query = {}
    # if name_filter:
    #     query["name"] = {"$regex": name_filter, "$options": "i"}
    
    total_count = await db[ROLES_COLLECTION].count_documents(query)
    roles_cursor = (
        db[ROLES_COLLECTION].find(query)
        .sort("name", 1) # Sắp xếp theo tên
        .skip(skip)
        .limit(limit)
    )
    roles_from_db_docs = await roles_cursor.to_list(length=limit)
    
    results: List[RoleInDB] = []
    for role_doc in roles_from_db_docs:
        if "permission_ids" in role_doc and role_doc["permission_ids"]:
            role_doc["permission_ids"] = [str(p_id) for p_id in role_doc["permission_ids"]]
        results.append(RoleInDB(**role_doc))
    return results, total_count
# <<<< KẾT THÚC PHẦN CẬP NHẬT >>>>


async def create_role(db: AsyncIOMotorDatabase, role_create_data: RoleCreate) -> Optional[RoleInDB]:
    if await get_role_by_name(db, role_create_data.name):
        logger.warning(f"Role with name '{role_create_data.name}' already exists.")
        raise ValueError(f"Vai trò với tên '{role_create_data.name}' đã tồn tại.")

    valid_permission_obj_ids: List[ObjectId] = []
    if role_create_data.permission_ids: 
        for perm_id_str in role_create_data.permission_ids:
            if ObjectId.is_valid(perm_id_str):
                perm_obj_id = ObjectId(perm_id_str)
                permission_exists = await db[PERMISSIONS_COLLECTION].find_one({"_id": perm_obj_id})
                if permission_exists:
                    valid_permission_obj_ids.append(perm_obj_id)
                else:
                    logger.warning(f"Permission ID '{perm_id_str}' không tồn tại. Bỏ qua khi tạo role '{role_create_data.name}'.")
                    # Hoặc raise ValueError nếu muốn việc tạo role thất bại
                    # raise ValueError(f"Permission ID '{perm_id_str}' không hợp lệ.")
            else:
                logger.warning(f"Định dạng ObjectId không hợp lệ cho permission ID '{perm_id_str}'. Bỏ qua.")
                # raise ValueError(f"Định dạng Permission ID '{perm_id_str}' không hợp lệ.")
    
    dt_now = datetime.now(timezone.utc)
    role_doc_to_insert = {
        "name": role_create_data.name,
        "description": role_create_data.description,
        "permission_ids": valid_permission_obj_ids, 
        "created_at": dt_now,
        "updated_at": dt_now
    }
    
    try:
        insert_result = await db[ROLES_COLLECTION].insert_one(role_doc_to_insert)
        if insert_result.inserted_id:
            return await get_role_by_id(db, str(insert_result.inserted_id))
        logger.error(f"Không thể tạo role với tên: {role_create_data.name} sau khi insert.")
        return None
    except Exception as e:
        logger.error(f"Lỗi khi tạo role {role_create_data.name}: {e}", exc_info=True)
        raise ValueError(f"Không thể tạo vai trò: {str(e)}")

async def update_role(db: AsyncIOMotorDatabase, role_id_str: PyObjectId, role_update_data: RoleUpdate) -> Optional[RoleInDB]:
    if not ObjectId.is_valid(role_id_str):
        logger.error(f"Invalid role_id format for update: {role_id_str}")
        return None # Hoặc raise ValueError

    role_obj_id = ObjectId(role_id_str)
    existing_role = await db[ROLES_COLLECTION].find_one({"_id": role_obj_id})
    if not existing_role:
        return None # Hoặc raise HTTPException(404) ở router

    # Ngăn chặn đổi tên của các role được bảo vệ
    if "name" in role_update_data.model_dump(exclude_unset=True) and \
       existing_role.get("name") in PROTECTED_ROLE_NAMES and \
       role_update_data.name != existing_role.get("name"):
        logger.warning(f"Attempt to rename protected role '{existing_role.get('name')}' to '{role_update_data.name}'. Denied.")
        raise ValueError(f"Không thể đổi tên vai trò hệ thống được bảo vệ '{existing_role.get('name')}'.")


    update_data = role_update_data.model_dump(exclude_unset=True)

    # Kiểm tra trùng tên nếu tên được cập nhật
    if "name" in update_data and update_data["name"] != existing_role.get("name"):
        if await db[ROLES_COLLECTION].find_one({"name": update_data["name"], "_id": {"$ne": role_obj_id}}):
            raise ValueError(f"Tên vai trò '{update_data['name']}' đã tồn tại.")

    if "permission_ids" in update_data: 
        valid_permission_obj_ids: List[ObjectId] = []
        if update_data["permission_ids"] is not None: # Cho phép gửi mảng rỗng để xóa hết permissions
            for perm_id_str in update_data["permission_ids"]:
                if ObjectId.is_valid(perm_id_str):
                    perm_obj_id = ObjectId(perm_id_str)
                    permission_exists = await db[PERMISSIONS_COLLECTION].find_one({"_id": perm_obj_id})
                    if permission_exists:
                        valid_permission_obj_ids.append(perm_obj_id)
                    else:
                        logger.warning(f"Permission ID '{perm_id_str}' không tồn tại khi cập nhật role. Bỏ qua.")
                        # Hoặc raise ValueError
                else:
                    logger.warning(f"Định dạng ObjectId không hợp lệ cho permission ID '{perm_id_str}' khi cập nhật role. Bỏ qua.")
                    # Hoặc raise ValueError
            update_data["permission_ids"] = valid_permission_obj_ids
        # Nếu update_data["permission_ids"] là None (do exclude_unset=True), trường này sẽ không được cập nhật
        
    if not update_data: # Nếu không có trường nào hợp lệ để cập nhật
        return await get_role_by_id(db, role_id_str) # Trả về role hiện tại

    update_data["updated_at"] = datetime.now(timezone.utc)

    updated_result = await db[ROLES_COLLECTION].update_one(
        {"_id": role_obj_id},
        {"$set": update_data}
    )

    if updated_result.matched_count > 0:
        return await get_role_by_id(db, role_id_str)
    
    logger.warning(f"Không tìm thấy role với ID {role_id_str} để cập nhật.")
    return None


async def delete_role(db: AsyncIOMotorDatabase, role_id_str: PyObjectId) -> bool:
    if not ObjectId.is_valid(role_id_str):
        return False
    
    role_obj_id = ObjectId(role_id_str)
    role_to_delete_doc = await db[ROLES_COLLECTION].find_one({"_id": role_obj_id})

    if not role_to_delete_doc:
        logger.warning(f"Role ID {role_id_str} not found for deletion.")
        return False # Hoặc raise HTTPException(404) từ router

    role_name_to_delete = role_to_delete_doc.get("name")
    if role_name_to_delete in PROTECTED_ROLE_NAMES:
        logger.warning(f"Attempt to delete protected system role: {role_name_to_delete} (ID: {role_id_str}). Deletion denied.")
        raise ValueError(f"Không thể xóa vai trò hệ thống mặc định: '{role_name_to_delete}'.")

    users_using_role_count = await db[USERS_COLLECTION].count_documents({"role_ids": role_obj_id})
    if users_using_role_count > 0:
        logger.warning(f"Role '{role_name_to_delete}' (ID: {role_id_str}) is in use by {users_using_role_count} users. Cannot delete.")
        raise ValueError(f"Vai trò '{role_name_to_delete}' đang được sử dụng bởi {users_using_role_count} người dùng và không thể xóa.")

    delete_result = await db[ROLES_COLLECTION].delete_one({"_id": role_obj_id})
    return delete_result.deleted_count > 0
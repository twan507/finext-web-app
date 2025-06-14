# finext-fastapi/app/crud/permissions.py
import logging
from typing import List, Tuple, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime
from bson import ObjectId

from app.schemas.permissions import PermissionInDB, PermissionCreate, PermissionUpdate

logger = logging.getLogger(__name__)
PERMISSIONS_COLLECTION = "permissions"  # Định nghĩa tên collection


# <<<< PHẦN CẬP NHẬT >>>>
async def get_permissions(
    db: AsyncIOMotorDatabase,
    skip: int = 0,
    limit: int = 1000,  # Mặc định limit cao vì danh sách permission thường không quá lớn
    sort_by: str = "name",
    sort_order: str = "asc",
) -> Tuple[List[PermissionInDB], int]:  # Trả về Tuple
    """
    Lấy danh sách tất cả các permissions với phân trang, sorting và trả về total count.
    """
    query = {}  # Có thể thêm filter nếu cần trong tương lai

    # Xây dựng sort order
    sort_direction = 1 if sort_order.lower() == "asc" else -1
    sort_field = sort_by if sort_by in ["name", "description", "created_at", "updated_at"] else "name"

    total_count = await db[PERMISSIONS_COLLECTION].count_documents(query)
    permissions_cursor = db[PERMISSIONS_COLLECTION].find(query).sort(sort_field, sort_direction).skip(skip).limit(limit)
    permissions_docs = await permissions_cursor.to_list(length=limit)

    results = [PermissionInDB(**perm) for perm in permissions_docs]
    return results, total_count


async def create_permission(db: AsyncIOMotorDatabase, permission: PermissionCreate) -> PermissionInDB:
    """
    Tạo permission mới.
    """
    # Kiểm tra xem permission đã tồn tại chưa
    existing = await db[PERMISSIONS_COLLECTION].find_one({"name": permission.name})
    if existing:
        raise ValueError(f"Permission with name '{permission.name}' already exists")

    permission_dict = permission.model_dump()
    permission_dict["created_at"] = datetime.now()
    permission_dict["updated_at"] = datetime.now()

    # Đảm bảo field roles luôn là mảng rỗng khi tạo mới (sẽ được cập nhật từ roles API)
    permission_dict["roles"] = []

    result = await db[PERMISSIONS_COLLECTION].insert_one(permission_dict)
    permission_dict["_id"] = result.inserted_id

    return PermissionInDB(**permission_dict)


async def get_permission_by_id(db: AsyncIOMotorDatabase, permission_id: str) -> Optional[PermissionInDB]:
    """
    Lấy permission theo ID.
    """
    try:
        object_id = ObjectId(permission_id)
        permission_doc = await db[PERMISSIONS_COLLECTION].find_one({"_id": object_id})
        if permission_doc:
            return PermissionInDB(**permission_doc)
        return None
    except Exception as e:
        logger.error(f"Error getting permission by ID {permission_id}: {e}")
        return None


async def get_permission_by_name(db: AsyncIOMotorDatabase, name: str) -> Optional[PermissionInDB]:
    """
    Lấy permission theo tên.
    """
    permission_doc = await db[PERMISSIONS_COLLECTION].find_one({"name": name})
    if permission_doc:
        return PermissionInDB(**permission_doc)
    return None


async def update_permission(db: AsyncIOMotorDatabase, permission_id: str, permission_update: PermissionUpdate) -> Optional[PermissionInDB]:
    """
    Cập nhật permission.
    """
    try:
        object_id = ObjectId(permission_id)

        # Lấy dữ liệu hiện tại
        existing = await db[PERMISSIONS_COLLECTION].find_one({"_id": object_id})
        if not existing:
            return None

        # Chuẩn bị dữ liệu cập nhật (chỉ các field không None)
        update_data = {k: v for k, v in permission_update.model_dump().items() if v is not None}

        # Kiểm tra tên trùng lặp nếu đang cập nhật tên
        if "name" in update_data and update_data["name"] != existing["name"]:
            name_exists = await db[PERMISSIONS_COLLECTION].find_one({"name": update_data["name"], "_id": {"$ne": object_id}})
            if name_exists:
                raise ValueError(f"Permission with name '{update_data['name']}' already exists")

        if update_data:
            update_data["updated_at"] = datetime.now()
            await db[PERMISSIONS_COLLECTION].update_one({"_id": object_id}, {"$set": update_data})
        # Lấy dữ liệu đã cập nhật
        updated_doc = await db[PERMISSIONS_COLLECTION].find_one({"_id": object_id})
        if updated_doc:
            return PermissionInDB(**updated_doc)
        return None

    except Exception as e:
        logger.error(f"Error updating permission {permission_id}: {e}")
        raise


async def delete_permission(db: AsyncIOMotorDatabase, permission_id: str) -> bool:
    """
    Xóa permission.
    """
    try:
        object_id = ObjectId(permission_id)

        # Kiểm tra permission có tồn tại không
        existing = await db[PERMISSIONS_COLLECTION].find_one({"_id": object_id})
        if not existing:
            return False

        # Xóa permission
        result = await db[PERMISSIONS_COLLECTION].delete_one({"_id": object_id})
        return result.deleted_count > 0

    except Exception as e:
        logger.error(f"Error deleting permission {permission_id}: {e}")
        return False


# <<<< KẾT THÚC PHẦN CẬP NHẬT >>>>

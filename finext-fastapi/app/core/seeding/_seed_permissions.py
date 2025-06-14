# finext-fastapi/app/core/seeding/_seed_permissions.py
import logging
from datetime import datetime, timezone
from typing import Dict, Set
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.utils.types import PyObjectId
from ._config import DEFAULT_PERMISSIONS_DATA, ALL_DEFAULT_PERMISSION_NAMES

logger = logging.getLogger(__name__)


async def seed_permissions(db: AsyncIOMotorDatabase) -> Dict[str, PyObjectId]:
    permissions_collection = db.get_collection("permissions")
    created_permission_ids: Dict[str, PyObjectId] = {}  # name -> str(ObjectId)

    existing_permissions_names: Set[str] = set()
    async for perm_doc in permissions_collection.find({}, {"name": 1}):
        existing_permissions_names.add(perm_doc["name"])

    permissions_to_add = [p for p in DEFAULT_PERMISSIONS_DATA if p["name"] not in existing_permissions_names]

    if permissions_to_add:
        logger.info(f"Tìm thấy {len(permissions_to_add)} permissions mới cần seed...")
        for perm_data in permissions_to_add:
            # Tạo permission với roles từ config
            permission_doc = {
                "name": perm_data["name"],
                "description": perm_data.get("description"),
                "category": perm_data["category"],
                "roles": perm_data.get("roles", []),  # Seed với roles từ config
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
            }
            result = await permissions_collection.insert_one(permission_doc)
            logger.info(f"Đã tạo permission: {perm_data['name']} với roles {perm_data.get('roles', [])} và ID: {result.inserted_id}")
    else:
        logger.info("Không có permissions mới nào cần seed.")

    # Thu thập tất cả permission IDs
    async for perm_doc in permissions_collection.find({"name": {"$in": list(ALL_DEFAULT_PERMISSION_NAMES)}}):
        if perm_doc["name"] in ALL_DEFAULT_PERMISSION_NAMES:
            created_permission_ids[perm_doc["name"]] = str(perm_doc["_id"])
    return created_permission_ids


async def sync_permission_roles(db: AsyncIOMotorDatabase) -> None:
    """Đồng bộ field roles trong permissions dựa trên config sau khi seed roles"""
    permissions_collection = db.get_collection("permissions")

    logger.info("Bắt đầu đồng bộ field roles trong permissions...")

    # Tạo mapping từ config: permission_name -> roles
    permission_roles_map = {}
    for perm_data in DEFAULT_PERMISSIONS_DATA:
        permission_roles_map[perm_data["name"]] = perm_data.get("roles", [])

    # Cập nhật từng permission
    updated_count = 0
    for perm_name, roles in permission_roles_map.items():
        result = await permissions_collection.update_one(
            {"name": perm_name}, {"$set": {"roles": roles, "updated_at": datetime.now(timezone.utc)}}
        )
        if result.modified_count > 0:
            updated_count += 1

    logger.info(f"Đã đồng bộ field roles cho {updated_count} permissions.")

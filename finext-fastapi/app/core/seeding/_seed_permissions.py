# finext-fastapi/app/core/seeding/_seed_permissions.py
import logging
from datetime import datetime, timezone
from typing import Dict, Set
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.schemas.permissions import PermissionCreate
from app.utils.types import PyObjectId
from ._config import DEFAULT_PERMISSIONS_DATA, ALL_DEFAULT_PERMISSION_NAMES

logger = logging.getLogger(__name__)

async def seed_permissions(db: AsyncIOMotorDatabase) -> Dict[str, PyObjectId]:
    permissions_collection = db.get_collection("permissions")
    created_permission_ids: Dict[str, PyObjectId] = {}  # name -> str(ObjectId)

    existing_permissions_names: Set[str] = set()
    async for perm_doc in permissions_collection.find({}, {"name": 1}):
        existing_permissions_names.add(perm_doc["name"])

    permissions_to_add = [
        p
        for p in DEFAULT_PERMISSIONS_DATA
        if p["name"] not in existing_permissions_names
    ]

    if permissions_to_add:
        logger.info(f"Tìm thấy {len(permissions_to_add)} permissions mới cần seed...")
        for perm_data in permissions_to_add:
            permission_to_create = PermissionCreate(**perm_data)
            dt_now = datetime.now(timezone.utc)
            result = await permissions_collection.insert_one(
                {
                    **permission_to_create.model_dump(),
                    "created_at": dt_now,
                    "updated_at": dt_now,
                }
            )
            logger.info(
                f"Đã tạo permission: {perm_data['name']} với ID: {result.inserted_id}"
            )
    else:
        logger.info("Không có permissions mới nào cần seed.")

    async for perm_doc in permissions_collection.find(
        {"name": {"$in": list(ALL_DEFAULT_PERMISSION_NAMES)}}
    ):
        if perm_doc["name"] in ALL_DEFAULT_PERMISSION_NAMES:
            created_permission_ids[perm_doc["name"]] = str(
                perm_doc["_id"]
            )
    return created_permission_ids
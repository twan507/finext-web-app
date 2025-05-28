# finext-fastapi/app/core/seeding/_seed_roles.py
import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional, Set

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.utils.types import PyObjectId
from ._config import ALL_DEFAULT_PERMISSION_NAMES

logger = logging.getLogger(__name__)

async def seed_roles(
    db: AsyncIOMotorDatabase, permission_ids_map: Dict[str, PyObjectId]
) -> Optional[Dict[str, PyObjectId]]:
    roles_collection = db.get_collection("roles")
    created_role_ids: Dict[str, PyObjectId] = {}  # name -> str(ObjectId)

    default_roles_data_template = [
        {
            "name": "admin",
            "description": "Quản trị viên hệ thống, có tất cả quyền.",
            "permission_names": list(ALL_DEFAULT_PERMISSION_NAMES),
        },
        {
            "name": "user",
            "description": "Người dùng thông thường.",
            "permission_names": [
                "user:update_self",
                "session:list_self",
                "session:delete_self",
                "subscription:read_own",
                "transaction:create_own", # Added based on access.py
                "transaction:read_own",   # Added based on access.py
            ],
        },
        {
            "name": "broker",
            "description": "Nhà môi giới.",
            "permission_names": [
                "user:update_self",
                "session:list_self",
                "session:delete_self",
                "subscription:read_own",
                "transaction:create_own", # Assuming broker can also create their own
                "transaction:read_own",   # Assuming broker can also read their own
            ],
        },
    ]

    required_permission_names_for_default_roles: Set[str] = set()
    for role_template in default_roles_data_template:
        for perm_name in role_template.get("permission_names", []):
            required_permission_names_for_default_roles.add(perm_name)

    missing_permissions_for_roles: Set[str] = {
        perm_name
        for perm_name in required_permission_names_for_default_roles
        if perm_name not in permission_ids_map
    }
    if missing_permissions_for_roles:
        logger.error(
            f"Không thể seeding roles do thiếu các permissions ID trong map: {missing_permissions_for_roles}."
        )
        # return None # Consider if this should halt further role seeding

    existing_roles_names: Set[str] = set()
    async for role_doc in roles_collection.find({}, {"name": 1}):
        existing_roles_names.add(role_doc["name"])

    roles_to_seed_data = [
        role_data
        for role_data in default_roles_data_template
        if role_data["name"] not in existing_roles_names
    ]

    if roles_to_seed_data:
        logger.info(f"Bắt đầu seeding {len(roles_to_seed_data)} roles mới...")
        for role_data_template in roles_to_seed_data:
            current_role_permission_obj_ids: List[ObjectId] = []
            for perm_name in role_data_template.get("permission_names", []):
                perm_id_str = permission_ids_map.get(perm_name)
                if perm_id_str and ObjectId.is_valid(perm_id_str):
                    current_role_permission_obj_ids.append(ObjectId(perm_id_str))
                elif perm_id_str:
                    logger.warning(
                        f"Permission ID '{perm_id_str}' (từ map cho '{perm_name}') không hợp lệ. Bỏ qua cho role '{role_data_template['name']}'."
                    )

            role_doc_to_insert = {
                "name": role_data_template["name"],
                "description": role_data_template.get("description"),
                "permission_ids": current_role_permission_obj_ids,
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
            }
            result = await roles_collection.insert_one(role_doc_to_insert)
            logger.info(
                f"Đã tạo role: {role_data_template['name']} với ID: {result.inserted_id}"
            )
    else:
        logger.info("Không có roles mới nào cần seed dựa trên template.")

    async for role_doc in roles_collection.find(
        {"name": {"$in": [r["name"] for r in default_roles_data_template]}}
    ):
        created_role_ids[role_doc["name"]] = str(role_doc["_id"])
    return created_role_ids
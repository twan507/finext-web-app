# finext-fastapi/app/core/seeding/_seed_licenses.py
import logging
from datetime import datetime, timezone
from typing import Dict, Set, List, Any
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.schemas.licenses import LicenseCreate
from app.utils.types import PyObjectId
from ._config import ALL_DEFAULT_FEATURE_KEYS

logger = logging.getLogger(__name__)


async def seed_licenses(db: AsyncIOMotorDatabase) -> Dict[str, PyObjectId]:
    licenses_collection = db.get_collection("licenses")
    created_license_ids: Dict[str, PyObjectId] = {}  # key -> str(ObjectId)

    default_licenses_data: List[Dict[str, Any]] = [
        {
            "key": "ADMIN",
            "name": "License Quản Trị Viên",
            "price": 0,
            "duration_days": 99999,
            "feature_keys": list(ALL_DEFAULT_FEATURE_KEYS),
            "color": "#D32F2F",  # 🔴 Đỏ đậm - Quyền cao nhất, mạnh mẽ, cảnh báo
        },
        {
            "key": "MANAGER",
            "name": "License Quản Lý",
            "price": 0,
            "duration_days": 99999,
            "feature_keys": [fkey for fkey in ALL_DEFAULT_FEATURE_KEYS if fkey != "admin_feature"],
            "color": "#FB8C00",  # 🟠 Cam - Quản lý, điều phối, nổi bật nhưng thấp hơn Admin
        },
        {
            "key": "PARTNER",
            "name": "License Đối Tác",
            "price": 0,
            "duration_days": 99999,
            "feature_keys": [
                "basic_feature",
                "broker_feature",
                "advanced_feature",
            ],
            "color": "#7B1FA2",  # 🟣 Tím - Hợp tác, tin cậy, khác biệt với nội bộ
        },
        {
            "key": "BASIC",
            "name": "License Cơ bản",
            "price": 0,
            "duration_days": 99999,
            "feature_keys": [
                "basic_feature",
                "advanced_feature",
            ],
            "color": "#1976D2",  # 🔵 Xanh dương - Phổ biến, thân thiện, mặc định
        },
        {
            "key": "PRO",
            "name": "License Chuyên Nghiệp",
            "price": 1000000,
            "duration_days": 30,
            "feature_keys": [
                "basic_feature",
            ],
            "color": "#C2185B",  # 💜🌸 Tím hồng - Cao cấp, sang trọng, nhấn mạnh "pro"
        },
    ]
    existing_license_keys: Set[str] = set()
    async for lic_doc in licenses_collection.find({}, {"key": 1}):
        existing_license_keys.add(lic_doc["key"])

    licenses_to_add = [lic for lic in default_licenses_data if lic["key"] not in existing_license_keys]
    if licenses_to_add:
        logger.info(f"Tìm thấy {len(licenses_to_add)} licenses mới cần seed...")
        for lic_data in licenses_to_add:
            valid_feature_keys_for_license = []
            # Đảm bảo lic_data["feature_keys"] tồn tại và là list trước khi lặp
            for f_key in lic_data.get("feature_keys", []):
                feature_exists = await db.features.find_one({"key": f_key})
                if feature_exists:
                    valid_feature_keys_for_license.append(f_key)
                else:
                    logger.warning(f"Feature key '{f_key}' cho license '{lic_data['key']}' không tồn tại trong DB. Bỏ qua.")

            license_to_create = LicenseCreate(
                key=lic_data["key"],
                name=lic_data["name"],
                price=lic_data["price"],
                duration_days=lic_data["duration_days"],
                feature_keys=valid_feature_keys_for_license,
                color=lic_data["color"],
            )
            dt_now = datetime.now(timezone.utc)
            result = await licenses_collection.insert_one(
                {
                    **license_to_create.model_dump(),
                    "created_at": dt_now,
                    "updated_at": dt_now,
                }
            )
            logger.info(f"Đã tạo license: {lic_data['key']} với ID: {result.inserted_id}")
    else:
        logger.info("Không có licenses mới nào cần seed.")

    # Cập nhật created_license_ids để trả về map các ID đã được tạo/tồn tại
    all_default_license_keys = {d["key"] for d in default_licenses_data}
    async for lic_doc in licenses_collection.find({"key": {"$in": list(all_default_license_keys)}}):
        created_license_ids[lic_doc["key"]] = str(lic_doc["_id"])

    return created_license_ids

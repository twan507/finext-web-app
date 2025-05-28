# finext-fastapi/app/core/seeding/_seed_licenses.py
import logging
from datetime import datetime, timezone
from typing import Dict, Set
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.schemas.licenses import LicenseCreate
from app.utils.types import PyObjectId
from ._config import ALL_DEFAULT_FEATURE_KEYS  # Import from new config

logger = logging.getLogger(__name__)


async def seed_licenses(db: AsyncIOMotorDatabase) -> Dict[str, PyObjectId]:
    licenses_collection = db.get_collection("licenses")
    created_license_ids: Dict[str, PyObjectId] = {}  # key -> str(ObjectId)

    default_licenses_data = [
        {
            "key": "FREE",
            "name": "Gói Miễn Phí",
            "price": 0.0,
            "duration_days": 99999,
            "feature_keys": ["view_basic_chart", "sse_access"],
        },
        {
            "key": "ADMIN",
            "name": "License Quản Trị Viên",
            "price": 0.0,
            "duration_days": 99999,
            "feature_keys": list(ALL_DEFAULT_FEATURE_KEYS),
        },
        {
            "key": "PARTNER",
            "name": "License Nhà Môi Giới",
            "price": 0.0,
            "duration_days": 99999,
            "feature_keys": [
                "view_basic_chart",
                "view_advanced_chart",
                "export_data",
                "sse_access",
            ],
        },
        {
            "key": "pro",
            "name": "Gói Chuyên Nghiệp",
            "price": 99.0,
            "duration_days": 30,
            "feature_keys": [
                "view_advanced_chart",
                "export_data",
                "enable_pro_indicator",
                "sse_access",
            ],
        },
        {
            "key": "premium",
            "name": "Gói Cao Cấp",
            "price": 199.0,
            "duration_days": 30,
            "feature_keys": [
                "view_advanced_chart",
                "export_data",
                "enable_pro_indicator",
                "api_access",
                "sse_access",
            ],
        },
    ]
    existing_license_keys: Set[str] = set()
    async for lic_doc in licenses_collection.find({}, {"key": 1}):
        existing_license_keys.add(lic_doc["key"])

    licenses_to_add = [
        lic for lic in default_licenses_data if lic["key"] not in existing_license_keys
    ]
    if licenses_to_add:
        logger.info(f"Tìm thấy {len(licenses_to_add)} licenses mới cần seed...")
        for lic_data in licenses_to_add:
            valid_feature_keys_for_license = []
            for f_key in lic_data.get("feature_keys", []):
                feature_exists = await db.features.find_one({"key": f_key})
                if feature_exists:
                    valid_feature_keys_for_license.append(f_key)
                else:
                    logger.warning(
                        f"Feature key '{f_key}' cho license '{lic_data['key']}' không tồn tại trong DB. Bỏ qua."
                    )

            license_to_create = LicenseCreate(
                key=lic_data["key"],
                name=lic_data["name"],
                price=lic_data["price"],
                duration_days=lic_data["duration_days"],
                feature_keys=valid_feature_keys_for_license,
            )
            dt_now = datetime.now(timezone.utc)
            result = await licenses_collection.insert_one(
                {
                    **license_to_create.model_dump(),
                    "created_at": dt_now,
                    "updated_at": dt_now,
                }
            )
            logger.info(
                f"Đã tạo license: {lic_data['key']} với ID: {result.inserted_id}"
            )
    else:
        logger.info("Không có licenses mới nào cần seed.")

    async for lic_doc in licenses_collection.find(
        {"key": {"$in": [d["key"] for d in default_licenses_data]}}
    ):
        created_license_ids[lic_doc["key"]] = str(lic_doc["_id"])
    return created_license_ids

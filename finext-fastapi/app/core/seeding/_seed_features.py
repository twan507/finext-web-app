# finext-fastapi/app/core/seeding/_seed_features.py
import logging
from datetime import datetime, timezone
from typing import Dict, Set
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.schemas.features import FeatureCreate
from app.utils.types import PyObjectId
from ._config import DEFAULT_FEATURES_DATA, ALL_DEFAULT_FEATURE_KEYS

logger = logging.getLogger(__name__)


async def seed_features(db: AsyncIOMotorDatabase) -> Dict[str, PyObjectId]:
    features_collection = db.get_collection("features")
    created_feature_ids: Dict[str, PyObjectId] = {}  # key -> str(ObjectId)

    existing_feature_keys: Set[str] = set()
    async for feature_doc in features_collection.find({}, {"key": 1}):
        existing_feature_keys.add(feature_doc["key"])

    features_to_add = [
        f for f in DEFAULT_FEATURES_DATA if f["key"] not in existing_feature_keys
    ]

    if features_to_add:
        logger.info(f"Tìm thấy {len(features_to_add)} features mới cần seed...")
        for feature_data in features_to_add:
            feature_to_create = FeatureCreate(**feature_data)
            dt_now = datetime.now(timezone.utc)
            result = await features_collection.insert_one(
                {
                    **feature_to_create.model_dump(),
                    "created_at": dt_now,
                    "updated_at": dt_now,
                }
            )
            logger.info(
                f"Đã tạo feature: {feature_data['key']} với ID: {result.inserted_id}"
            )
    else:
        logger.info("Không có features mới nào cần seed.")

    async for feature_doc in features_collection.find(
        {"key": {"$in": list(ALL_DEFAULT_FEATURE_KEYS)}}
    ):
        if feature_doc["key"] in ALL_DEFAULT_FEATURE_KEYS:
            created_feature_ids[feature_doc["key"]] = str(feature_doc["_id"])
    return created_feature_ids

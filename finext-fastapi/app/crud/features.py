# finext-fastapi/app/crud/features.py
import logging
from typing import List, Optional
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timezone

from app.schemas.features import FeatureCreate, FeatureUpdate, FeatureInDB
from app.utils.types import PyObjectId

logger = logging.getLogger(__name__)

async def get_feature_by_key(db: AsyncIOMotorDatabase, key: str) -> Optional[FeatureInDB]:
    feature_doc = await db.features.find_one({"key": key})
    if feature_doc:
        return FeatureInDB(**feature_doc)
    return None

async def get_feature_by_id(db: AsyncIOMotorDatabase, feature_id: PyObjectId) -> Optional[FeatureInDB]:
    if not ObjectId.is_valid(feature_id):
        return None
    feature_doc = await db.features.find_one({"_id": ObjectId(feature_id)})
    if feature_doc:
        return FeatureInDB(**feature_doc)
    return None

async def get_features(db: AsyncIOMotorDatabase, skip: int = 0, limit: int = 100) -> List[FeatureInDB]:
    features_cursor = db.features.find().skip(skip).limit(limit)
    features = await features_cursor.to_list(length=limit)
    return [FeatureInDB(**feature) for feature in features]

async def create_feature(db: AsyncIOMotorDatabase, feature_create_data: FeatureCreate) -> Optional[FeatureInDB]:
    if await get_feature_by_key(db, feature_create_data.key):
        logger.warning(f"Feature with key '{feature_create_data.key}' already exists.")
        return None

    dt_now = datetime.now(timezone.utc)
    feature_doc_to_insert = {
        **feature_create_data.model_dump(),
        "created_at": dt_now,
        "updated_at": dt_now
    }

    try:
        insert_result = await db.features.insert_one(feature_doc_to_insert)
        if insert_result.inserted_id:
            created_feature_doc = await db.features.find_one({"_id": insert_result.inserted_id})
            if created_feature_doc:
                return FeatureInDB(**created_feature_doc)
        logger.error(f"Failed to create feature with key: {feature_create_data.key}")
        return None
    except Exception as e:
        logger.error(f"Error creating feature {feature_create_data.key}: {e}", exc_info=True)
        return None

async def update_feature(db: AsyncIOMotorDatabase, feature_id: PyObjectId, feature_update_data: FeatureUpdate) -> Optional[FeatureInDB]:
    if not ObjectId.is_valid(feature_id):
        return None

    update_data = feature_update_data.model_dump(exclude_unset=True)
    if not update_data:
        return await get_feature_by_id(db, feature_id)

    update_data["updated_at"] = datetime.now(timezone.utc)

    updated_result = await db.features.update_one(
        {"_id": ObjectId(feature_id)},
        {"$set": update_data}
    )

    if updated_result.matched_count > 0:
        return await get_feature_by_id(db, feature_id)
    return None

async def delete_feature(db: AsyncIOMotorDatabase, feature_id: PyObjectId) -> bool:
    if not ObjectId.is_valid(feature_id):
        return False
    # TODO: Add check if feature is used by any license before deleting
    delete_result = await db.features.delete_one({"_id": ObjectId(feature_id)})
    return delete_result.deleted_count > 0
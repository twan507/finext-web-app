# finext-fastapi/app/crud/features.py
import logging
from typing import List, Optional, Tuple # Thêm Tuple
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timezone

from app.schemas.features import FeatureCreate, FeatureUpdate, FeatureInDB
from app.utils.types import PyObjectId

logger = logging.getLogger(__name__)
FEATURES_COLLECTION = "features" # Định nghĩa tên collection

async def get_feature_by_key(db: AsyncIOMotorDatabase, key: str) -> Optional[FeatureInDB]:
    feature_doc = await db[FEATURES_COLLECTION].find_one({"key": key})
    if feature_doc:
        return FeatureInDB(**feature_doc)
    return None

async def get_feature_by_id(db: AsyncIOMotorDatabase, feature_id: PyObjectId) -> Optional[FeatureInDB]:
    if not ObjectId.is_valid(feature_id):
        return None
    feature_doc = await db[FEATURES_COLLECTION].find_one({"_id": ObjectId(feature_id)})
    if feature_doc:
        return FeatureInDB(**feature_doc)
    return None

# <<<< PHẦN CẬP NHẬT >>>>
async def get_features(
    db: AsyncIOMotorDatabase, 
    skip: int = 0, 
    limit: int = 100,
    # Thêm các filter nếu cần cho trang admin, ví dụ:
    # key_filter: Optional[str] = None,
    # name_filter: Optional[str] = None,
) -> Tuple[List[FeatureInDB], int]:
    """
    Lấy danh sách features với filter và phân trang, trả về cả total count.
    """
    query = {}
    # if key_filter:
    #     query["key"] = {"$regex": key_filter, "$options": "i"} # Tìm kiếm không phân biệt hoa thường
    # if name_filter:
    #     query["name"] = {"$regex": name_filter, "$options": "i"}

    total_count = await db[FEATURES_COLLECTION].count_documents(query)
    features_cursor = db[FEATURES_COLLECTION].find(query).sort("key", 1).skip(skip).limit(limit)
    features_docs = await features_cursor.to_list(length=limit)
    
    results = [FeatureInDB(**feature) for feature in features_docs]
    return results, total_count
# <<<< KẾT THÚC PHẦN CẬP NHẬT >>>>

async def create_feature(db: AsyncIOMotorDatabase, feature_create_data: FeatureCreate) -> Optional[FeatureInDB]:
    if await get_feature_by_key(db, feature_create_data.key):
        logger.warning(f"Feature with key '{feature_create_data.key}' already exists.")
        raise ValueError(f"Feature với key '{feature_create_data.key}' đã tồn tại.") # Raise error

    dt_now = datetime.now(timezone.utc)
    feature_doc_to_insert = {
        **feature_create_data.model_dump(),
        "created_at": dt_now,
        "updated_at": dt_now
    }

    try:
        insert_result = await db[FEATURES_COLLECTION].insert_one(feature_doc_to_insert)
        if insert_result.inserted_id:
            created_feature_doc = await db[FEATURES_COLLECTION].find_one({"_id": insert_result.inserted_id})
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
    
    existing_feature = await get_feature_by_id(db, feature_id)
    if not existing_feature:
        return None # Hoặc raise HTTPException(404) ở router

    update_data = feature_update_data.model_dump(exclude_unset=True)
    if not update_data:
        return existing_feature # Không có gì để cập nhật

    update_data["updated_at"] = datetime.now(timezone.utc)

    updated_result = await db[FEATURES_COLLECTION].update_one(
        {"_id": ObjectId(feature_id)},
        {"$set": update_data}
    )

    if updated_result.matched_count > 0:
        return await get_feature_by_id(db, feature_id)
    return None

async def delete_feature(db: AsyncIOMotorDatabase, feature_id: PyObjectId) -> bool:
    if not ObjectId.is_valid(feature_id):
        return False
    
    feature_to_delete = await get_feature_by_id(db, feature_id)
    if not feature_to_delete:
        return False # Hoặc raise 404 ở router

    # Kiểm tra xem feature có đang được sử dụng bởi license nào không
    licenses_using_feature_count = await db.licenses.count_documents({"feature_keys": feature_to_delete.key})
    if licenses_using_feature_count > 0:
        logger.warning(f"Feature key '{feature_to_delete.key}' (ID: {feature_id}) is in use by {licenses_using_feature_count} licenses. Cannot delete.")
        raise ValueError(f"Feature '{feature_to_delete.name}' (key: {feature_to_delete.key}) đang được sử dụng bởi {licenses_using_feature_count} gói license và không thể xóa.")

    delete_result = await db[FEATURES_COLLECTION].delete_one({"_id": ObjectId(feature_id)})
    return delete_result.deleted_count > 0
# finext-fastapi/app/crud/licenses.py
import logging
from typing import List, Optional
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timezone

from app.schemas.licenses import LicenseCreate, LicenseUpdate, LicenseInDB
from app.utils.types import PyObjectId
from app.core.config import PROTECTED_LICENSE_KEYS 

logger = logging.getLogger(__name__)

async def get_license_by_key(db: AsyncIOMotorDatabase, key: str) -> Optional[LicenseInDB]:
    license_doc = await db.licenses.find_one({"key": key})
    if license_doc:
        return LicenseInDB(**license_doc)
    return None

async def get_license_by_id(db: AsyncIOMotorDatabase, license_id: PyObjectId) -> Optional[LicenseInDB]:
    if not ObjectId.is_valid(license_id):
        return None
    license_doc = await db.licenses.find_one({"_id": ObjectId(license_id)})
    if license_doc:
        return LicenseInDB(**license_doc)
    return None

async def get_licenses(db: AsyncIOMotorDatabase, skip: int = 0, limit: int = 100, include_inactive: bool = False) -> List[LicenseInDB]:
    query = {}
    if not include_inactive:
        query["is_active"] = True
    licenses_cursor = db.licenses.find(query).skip(skip).limit(limit)
    licenses = await licenses_cursor.to_list(length=limit)
    return [LicenseInDB(**lic) for lic in licenses]

async def create_license(db: AsyncIOMotorDatabase, license_create_data: LicenseCreate) -> Optional[LicenseInDB]:
    if await get_license_by_key(db, license_create_data.key):
        logger.warning(f"License with key '{license_create_data.key}' already exists.")
        return None

    valid_feature_keys = []
    if license_create_data.feature_keys:
        for f_key in license_create_data.feature_keys:
            if await db.features.find_one({"key": f_key}):
                valid_feature_keys.append(f_key)
            else:
                logger.warning(f"Feature key '{f_key}' not found. Skipping for license '{license_create_data.key}'.")

    dt_now = datetime.now(timezone.utc)
    # is_active đã có default=True trong LicenseBase, sẽ được bao gồm trong model_dump()
    license_doc_to_insert = {
        **license_create_data.model_dump(exclude={"feature_keys"}),
        "feature_keys": valid_feature_keys,
        "created_at": dt_now,
        "updated_at": dt_now
    }

    try:
        insert_result = await db.licenses.insert_one(license_doc_to_insert)
        if insert_result.inserted_id:
            created_license_doc = await db.licenses.find_one({"_id": insert_result.inserted_id})
            if created_license_doc:
                return LicenseInDB(**created_license_doc)
        logger.error(f"Failed to create license with key: {license_create_data.key}")
        return None
    except Exception as e:
        logger.error(f"Error creating license {license_create_data.key}: {e}", exc_info=True)
        return None

async def update_license(db: AsyncIOMotorDatabase, license_id: PyObjectId, license_update_data: LicenseUpdate) -> Optional[LicenseInDB]:
    if not ObjectId.is_valid(license_id):
        return None
    
    existing_license = await get_license_by_id(db, license_id)
    if not existing_license:
        return None

    if existing_license.key in PROTECTED_LICENSE_KEYS:
        # Ngăn chặn thay đổi is_active của license được bảo vệ nếu is_active đang là True và muốn đổi thành False
        if license_update_data.is_active is False and existing_license.is_active is True:
             logger.warning(f"Attempt to deactivate protected license '{existing_license.key}'. Denied.")
             raise ValueError(f"Cannot deactivate protected license: '{existing_license.key}'.")
        if 'duration_days' in license_update_data.model_dump(exclude_unset=True) or \
           'price' in license_update_data.model_dump(exclude_unset=True):
            logger.warning(f"Attempt to modify critical fields of protected license '{existing_license.key}'. Denied.")
            # Hoặc chỉ log và không cho phép thay đổi các trường này
            if 'duration_days' in license_update_data.model_dump(exclude_unset=True):
                del license_update_data.duration_days
            if 'price' in license_update_data.model_dump(exclude_unset=True):
                del license_update_data.price


    update_data = license_update_data.model_dump(exclude_unset=True)

    if "feature_keys" in update_data and update_data["feature_keys"] is not None:
        valid_feature_keys = []
        for f_key in update_data["feature_keys"]:
            if await db.features.find_one({"key": f_key}):
                valid_feature_keys.append(f_key)
            else:
                logger.warning(f"Feature key '{f_key}' not found. Skipping for license update.")
        update_data["feature_keys"] = valid_feature_keys

    if not update_data:
        return await get_license_by_id(db, license_id)

    update_data["updated_at"] = datetime.now(timezone.utc)

    updated_result = await db.licenses.update_one(
        {"_id": ObjectId(license_id)},
        {"$set": update_data}
    )

    if updated_result.matched_count > 0:
        return await get_license_by_id(db, license_id)
    return None

async def deactivate_license_db(db: AsyncIOMotorDatabase, license_id: PyObjectId) -> Optional[LicenseInDB]:
    """Vô hiệu hóa một license bằng cách đặt is_active = False."""
    if not ObjectId.is_valid(license_id):
        logger.warning(f"Invalid license ID for deactivation: {license_id}")
        return None

    license_to_deactivate = await get_license_by_id(db, license_id)
    if not license_to_deactivate:
        logger.warning(f"License ID {license_id} not found for deactivation.")
        return None # Hoặc raise ValueError

    if license_to_deactivate.key in PROTECTED_LICENSE_KEYS:
        logger.warning(f"Attempt to deactivate protected license key: {license_to_deactivate.key}. Deactivation denied.")
        raise ValueError(f"Cannot deactivate protected license: '{license_to_deactivate.key}'.")

    if not license_to_deactivate.is_active:
        logger.info(f"License ID {license_id} (key: {license_to_deactivate.key}) is already inactive.")
        return license_to_deactivate

    # Check if license is used by any active subscription
    active_subscriptions_count = await db.subscriptions.count_documents(
        {"license_id": ObjectId(license_id), "is_active": True}
    )
    if active_subscriptions_count > 0:
        logger.warning(f"License ID {license_id} (key: {license_to_deactivate.key}) is in use by {active_subscriptions_count} active subscriptions. Cannot deactivate.")
        raise ValueError(f"License '{license_to_deactivate.key}' is in use by active subscriptions and cannot be deactivated.")

    update_result = await db.licenses.update_one(
        {"_id": ObjectId(license_id)},
        {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc)}}
    )

    if update_result.modified_count > 0:
        logger.info(f"License ID {license_id} (key: {license_to_deactivate.key}) has been deactivated.")
        return await get_license_by_id(db, license_id)
    
    logger.error(f"Failed to deactivate license ID {license_id} (key: {license_to_deactivate.key}) despite passing checks.")
    return None # Should ideally not happen if previous checks passed and update_one was called
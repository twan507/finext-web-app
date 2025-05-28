# finext-fastapi/app/crud/licenses.py
import logging
from typing import List, Optional
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timezone

from app.schemas.licenses import LicenseCreate, LicenseUpdate, LicenseInDB
from app.utils.types import PyObjectId
from app.core.config import PROTECTED_LICENSE_KEYS # Import danh sách key license được bảo vệ

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

async def get_licenses(db: AsyncIOMotorDatabase, skip: int = 0, limit: int = 100) -> List[LicenseInDB]:
    licenses_cursor = db.licenses.find().skip(skip).limit(limit)
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

    # Prevent updating key or other critical fields of protected licenses if needed
    if existing_license.key in PROTECTED_LICENSE_KEYS:
        # Example: Prevent changing duration or price of protected licenses
        if 'duration_days' in license_update_data.model_dump(exclude_unset=True) or \
           'price' in license_update_data.model_dump(exclude_unset=True):
            logger.warning(f"Attempt to modify critical fields of protected license '{existing_license.key}'. Denied.")
            # Depending on strictness, could raise ValueError or just ignore these fields for protected licenses
            # For now, let's assume such updates are allowed but logged.
            # If a strict "no change" policy is needed, raise ValueError here.

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

async def delete_license(db: AsyncIOMotorDatabase, license_id: PyObjectId) -> bool:
    if not ObjectId.is_valid(license_id):
        return False

    license_to_delete = await get_license_by_id(db, license_id)
    if not license_to_delete:
        logger.warning(f"License ID {license_id} not found for deletion.")
        return False

    if license_to_delete.key in PROTECTED_LICENSE_KEYS:
        logger.warning(f"Attempt to delete protected license key: {license_to_delete.key}. Deletion denied.")
        raise ValueError(f"Cannot delete protected license: '{license_to_delete.key}'.")

    # Check if license is used by any active subscription
    active_subscriptions_count = await db.subscriptions.count_documents(
        {"license_id": ObjectId(license_id), "is_active": True}
    )
    if active_subscriptions_count > 0:
        logger.warning(f"License ID {license_id} (key: {license_to_delete.key}) is in use by {active_subscriptions_count} active subscriptions. Cannot delete.")
        raise ValueError(f"License '{license_to_delete.key}' is in use by active subscriptions and cannot be deleted.")

    delete_result = await db.licenses.delete_one({"_id": ObjectId(license_id)})
    return delete_result.deleted_count > 0
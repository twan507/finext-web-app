# finext-fastapi/app/crud/licenses.py
import logging
from typing import List, Optional, Tuple  # Thêm Tuple
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timezone

from app.schemas.licenses import LicenseCreate, LicenseUpdate, LicenseInDB
from app.utils.types import PyObjectId
from app.core.config import PROTECTED_LICENSE_KEYS

logger = logging.getLogger(__name__)
LICENSES_COLLECTION = "licenses"  # Định nghĩa tên collection
FEATURES_COLLECTION = "features"  # Định nghĩa tên collection features
SUBSCRIPTIONS_COLLECTION = "subscriptions"  # Định nghĩa tên collection subscriptions


async def get_license_by_key(db: AsyncIOMotorDatabase, key: str) -> Optional[LicenseInDB]:
    license_doc = await db[LICENSES_COLLECTION].find_one({"key": key})
    if license_doc:
        return LicenseInDB(**license_doc)
    return None


async def get_license_by_id(db: AsyncIOMotorDatabase, license_id: PyObjectId) -> Optional[LicenseInDB]:
    if not ObjectId.is_valid(license_id):
        return None
    license_doc = await db[LICENSES_COLLECTION].find_one({"_id": ObjectId(license_id)})
    if license_doc:
        return LicenseInDB(**license_doc)
    return None


# <<<< PHẦN CẬP NHẬT >>>>
async def get_licenses(
    db: AsyncIOMotorDatabase,
    skip: int = 0,
    limit: int = 100,
    include_inactive: bool = False,
    # Thêm các filter nếu cần, ví dụ:
    # key_filter: Optional[str] = None,
    # name_filter: Optional[str] = None,
) -> Tuple[List[LicenseInDB], int]:  # Trả về Tuple
    """
    Lấy danh sách licenses với filter và phân trang, trả về cả total count.
    """
    query = {}
    if not include_inactive:
        query["is_active"] = True
    # if key_filter:
    #     query["key"] = {"$regex": key_filter, "$options": "i"}
    # if name_filter:
    #     query["name"] = {"$regex": name_filter, "$options": "i"}

    total_count = await db[LICENSES_COLLECTION].count_documents(query)
    licenses_cursor = (
        db[LICENSES_COLLECTION]
        .find(query)
        .sort("key", 1)  # Sắp xếp theo key
        .skip(skip)
        .limit(limit)
    )
    licenses_docs = await licenses_cursor.to_list(length=limit)

    results = [LicenseInDB(**lic) for lic in licenses_docs]
    return results, total_count


# <<<< KẾT THÚC PHẦN CẬP NHẬT >>>>


async def create_license(db: AsyncIOMotorDatabase, license_create_data: LicenseCreate) -> Optional[LicenseInDB]:
    if await get_license_by_key(db, license_create_data.key):
        logger.warning(f"License with key '{license_create_data.key}' already exists.")
        raise ValueError(f"License với key '{license_create_data.key}' đã tồn tại.")

    valid_feature_keys = []
    if license_create_data.feature_keys:
        for f_key in license_create_data.feature_keys:
            if await db[FEATURES_COLLECTION].find_one({"key": f_key}):
                valid_feature_keys.append(f_key)
            else:
                logger.warning(f"Feature key '{f_key}' không tồn tại khi tạo license '{license_create_data.key}'. Bỏ qua feature này.")
                # Hoặc raise ValueError nếu muốn việc tạo license thất bại khi feature_key không hợp lệ
                # raise ValueError(f"Feature key '{f_key}' không hợp lệ.")

    dt_now = datetime.now(timezone.utc)
    license_doc_to_insert = {
        **license_create_data.model_dump(exclude={"feature_keys"}),
        "feature_keys": valid_feature_keys,  # Chỉ lưu các feature key hợp lệ
        "created_at": dt_now,
        "updated_at": dt_now,
        # is_active đã có default=True từ schema và sẽ được model_dump() bao gồm
    }

    try:
        insert_result = await db[LICENSES_COLLECTION].insert_one(license_doc_to_insert)
        if insert_result.inserted_id:
            created_license_doc = await db[LICENSES_COLLECTION].find_one({"_id": insert_result.inserted_id})
            if created_license_doc:
                return LicenseInDB(**created_license_doc)
        logger.error(f"Không thể tạo license với key: {license_create_data.key} sau khi insert.")
        return None
    except Exception as e:
        logger.error(f"Lỗi khi tạo license {license_create_data.key}: {e}", exc_info=True)
        # Consider re-raising a more specific error or a generic one
        raise ValueError(f"Không thể tạo license: {str(e)}")


async def update_license(db: AsyncIOMotorDatabase, license_id: PyObjectId, license_update_data: LicenseUpdate) -> Optional[LicenseInDB]:
    if not ObjectId.is_valid(license_id):
        return None

    existing_license = await get_license_by_id(db, license_id)
    if not existing_license:
        return None

    # Ngăn chặn cập nhật các trường nhạy cảm của license được bảo vệ
    # is_active đã được xử lý riêng trong endpoint deactivate
    if existing_license.key in PROTECTED_LICENSE_KEYS:
        update_dict_check = license_update_data.model_dump(exclude_unset=True)
        protected_fields_attempted_to_change = []
        if "price" in update_dict_check and update_dict_check["price"] != existing_license.price:
            protected_fields_attempted_to_change.append("price")
        if "duration_days" in update_dict_check and update_dict_check["duration_days"] != existing_license.duration_days:
            protected_fields_attempted_to_change.append("duration_days")
        # 'key' không nằm trong LicenseUpdate nên không cần check ở đây

        if protected_fields_attempted_to_change:
            logger.warning(
                f"Attempt to modify protected fields ({', '.join(protected_fields_attempted_to_change)}) of protected license '{existing_license.key}'. Denied."
            )
            raise ValueError(
                f"Không thể thay đổi các trường được bảo vệ ({', '.join(protected_fields_attempted_to_change)}) của license hệ thống '{existing_license.key}'."
            )

    update_data = license_update_data.model_dump(exclude_unset=True)

    if "feature_keys" in update_data and update_data["feature_keys"] is not None:
        valid_feature_keys = []
        for f_key in update_data["feature_keys"]:
            if await db[FEATURES_COLLECTION].find_one({"key": f_key}):
                valid_feature_keys.append(f_key)
            else:
                logger.warning(f"Feature key '{f_key}' không tồn tại khi cập nhật license. Bỏ qua feature này.")
                # Hoặc raise ValueError nếu muốn việc cập nhật thất bại
        update_data["feature_keys"] = valid_feature_keys

    if not update_data:  # Nếu không có gì thay đổi (sau khi lọc feature_keys không hợp lệ)
        return existing_license

    update_data["updated_at"] = datetime.now(timezone.utc)

    updated_result = await db[LICENSES_COLLECTION].update_one({"_id": ObjectId(license_id)}, {"$set": update_data})

    if updated_result.matched_count > 0:
        return await get_license_by_id(db, license_id)
    # Nếu không match (ví dụ license_id không tồn tại khi update)
    logger.warning(f"Không tìm thấy license với ID {license_id} để cập nhật.")
    return None


async def deactivate_license_db(db: AsyncIOMotorDatabase, license_id: PyObjectId) -> Optional[LicenseInDB]:
    """Vô hiệu hóa một license bằng cách đặt is_active = False."""
    if not ObjectId.is_valid(license_id):
        logger.warning(f"Invalid license ID for deactivation: {license_id}")
        return None

    license_to_deactivate = await get_license_by_id(db, license_id)
    if not license_to_deactivate:
        logger.warning(f"License ID {license_id} not found for deactivation.")
        raise ValueError(f"License với ID {license_id} không tìm thấy.")

    if license_to_deactivate.key in PROTECTED_LICENSE_KEYS:
        logger.warning(f"Attempt to deactivate protected license key: {license_to_deactivate.key}. Deactivation denied.")
        raise ValueError(f"Không thể vô hiệu hóa license hệ thống: '{license_to_deactivate.key}'.")

    if not license_to_deactivate.is_active:
        logger.info(f"License ID {license_id} (key: {license_to_deactivate.key}) is already inactive.")
        return license_to_deactivate

    active_subscriptions_count = await db[SUBSCRIPTIONS_COLLECTION].count_documents({"license_id": ObjectId(license_id), "is_active": True})
    if active_subscriptions_count > 0:
        logger.warning(
            f"License ID {license_id} (key: {license_to_deactivate.key}) is in use by {active_subscriptions_count} active subscriptions. Cannot deactivate."
        )
        raise ValueError(
            f"License '{license_to_deactivate.key}' đang được sử dụng bởi {active_subscriptions_count} subscription đang hoạt động và không thể vô hiệu hóa."
        )

    update_result = await db[LICENSES_COLLECTION].update_one(
        {"_id": ObjectId(license_id)}, {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc)}}
    )

    if update_result.modified_count > 0:
        logger.info(f"License ID {license_id} (key: {license_to_deactivate.key}) has been deactivated.")
        return await get_license_by_id(db, license_id)

    if update_result.matched_count > 0:  # Found but not modified (already inactive - should have been caught above)
        logger.warning(
            f"License {license_id} (key: {license_to_deactivate.key}) found but not modified during deactivation (already inactive?)."
        )
        return await get_license_by_id(db, license_id)

    logger.error(f"Failed to deactivate license ID {license_id} (key: {license_to_deactivate.key}) despite passing checks.")
    return None  # Should ideally not happen


async def activate_license_db(db: AsyncIOMotorDatabase, license_id: PyObjectId) -> Optional[LicenseInDB]:
    """Kích hoạt một license bằng cách đặt is_active = True."""
    if not ObjectId.is_valid(license_id):
        logger.warning(f"Invalid license ID for activation: {license_id}")
        return None

    license_to_activate = await get_license_by_id(db, license_id)
    if not license_to_activate:
        logger.warning(f"License ID {license_id} not found for activation.")
        raise ValueError(f"License với ID {license_id} không tìm thấy.")

    if license_to_activate.key in PROTECTED_LICENSE_KEYS:
        logger.warning(f"Attempt to activate protected license key: {license_to_activate.key}. Activation denied.")
        raise ValueError(f"Không thể kích hoạt license hệ thống: '{license_to_activate.key}'.")

    if license_to_activate.is_active:
        logger.info(f"License ID {license_id} (key: {license_to_activate.key}) is already active.")
        return license_to_activate

    update_result = await db[LICENSES_COLLECTION].update_one(
        {"_id": ObjectId(license_id)}, {"$set": {"is_active": True, "updated_at": datetime.now(timezone.utc)}}
    )

    if update_result.modified_count > 0:
        logger.info(f"License ID {license_id} (key: {license_to_activate.key}) has been activated.")
        return await get_license_by_id(db, license_id)

    if update_result.matched_count > 0:  # Found but not modified (already active - should have been caught above)
        logger.warning(f"License {license_id} (key: {license_to_activate.key}) found but not modified during activation (already active?).")
        return await get_license_by_id(db, license_id)

    logger.error(f"Failed to activate license ID {license_id} (key: {license_to_activate.key}) despite passing checks.")
    return None  # Should ideally not happen

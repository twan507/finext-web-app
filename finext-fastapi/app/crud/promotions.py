# finext-fastapi/app/crud/promotions.py
import logging
from typing import List, Optional, Tuple  # Thêm Tuple
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timezone

from app.schemas.promotions import PromotionCreate, PromotionUpdate, PromotionInDB, DiscountTypeEnum
from app.utils.types import PyObjectId

logger = logging.getLogger(__name__)
PROMOTIONS_COLLECTION = "promotions"  # Định nghĩa tên collection


async def get_promotion_by_id(db: AsyncIOMotorDatabase, promotion_id: PyObjectId) -> Optional[PromotionInDB]:
    if not ObjectId.is_valid(promotion_id):
        return None
    promo_doc = await db[PROMOTIONS_COLLECTION].find_one({"_id": ObjectId(promotion_id)})
    if promo_doc:
        return PromotionInDB(**promo_doc)
    return None


async def get_promotion_by_code(db: AsyncIOMotorDatabase, promotion_code: str) -> Optional[PromotionInDB]:
    promo_doc = await db[PROMOTIONS_COLLECTION].find_one({"promotion_code": promotion_code.upper()})
    if promo_doc:
        return PromotionInDB(**promo_doc)
    return None


# <<<< PHẦN CẬP NHẬT >>>>
async def get_promotions(
    db: AsyncIOMotorDatabase,
    skip: int = 0,
    limit: int = 100,
    is_active: Optional[bool] = None,
    # Thêm các filter nếu cần cho trang admin, ví dụ:
    # promotion_code_filter: Optional[str] = None,
    # discount_type_filter: Optional[DiscountTypeEnum] = None,
) -> Tuple[List[PromotionInDB], int]:  # Trả về Tuple
    """
    Lấy danh sách promotions với filter và phân trang, trả về cả total count.
    """
    query = {}
    if is_active is not None:
        query["is_active"] = is_active
    # if promotion_code_filter:
    #     query["promotion_code"] = {"$regex": promotion_code_filter.upper(), "$options": "i"}
    # if discount_type_filter:
    #     query["discount_type"] = discount_type_filter.value

    total_count = await db[PROMOTIONS_COLLECTION].count_documents(query)
    promos_cursor = (
        db[PROMOTIONS_COLLECTION]
        .find(query)
        .sort("created_at", -1)  # Sắp xếp theo ngày tạo mới nhất
        .skip(skip)
        .limit(limit)
    )
    promos_list_docs = await promos_cursor.to_list(length=limit)

    results = [PromotionInDB(**promo) for promo in promos_list_docs]
    return results, total_count


# <<<< KẾT THÚC PHẦN CẬP NHẬT >>>>


async def create_promotion(db: AsyncIOMotorDatabase, promotion_data: PromotionCreate) -> Optional[PromotionInDB]:
    promo_code_upper = promotion_data.promotion_code.upper()

    existing_promo = await db[PROMOTIONS_COLLECTION].find_one({"promotion_code": promo_code_upper})
    if existing_promo:
        raise ValueError(f"Mã khuyến mãi '{promo_code_upper}' đã tồn tại.")

    if promotion_data.start_date and promotion_data.end_date and promotion_data.start_date >= promotion_data.end_date:
        raise ValueError("Ngày bắt đầu phải trước ngày kết thúc.")

    now = datetime.now(timezone.utc)

    promo_doc_to_insert = promotion_data.model_dump()
    promo_doc_to_insert["promotion_code"] = promo_code_upper
    if promo_doc_to_insert.get("start_date") and promo_doc_to_insert["start_date"].tzinfo is None:
        promo_doc_to_insert["start_date"] = promo_doc_to_insert["start_date"].replace(tzinfo=timezone.utc)
    elif promo_doc_to_insert.get("start_date"):
        promo_doc_to_insert["start_date"] = promo_doc_to_insert["start_date"].astimezone(timezone.utc)

    if promo_doc_to_insert.get("end_date") and promo_doc_to_insert["end_date"].tzinfo is None:
        promo_doc_to_insert["end_date"] = promo_doc_to_insert["end_date"].replace(tzinfo=timezone.utc)
    elif promo_doc_to_insert.get("end_date"):
        promo_doc_to_insert["end_date"] = promo_doc_to_insert["end_date"].astimezone(timezone.utc)

    promo_doc_to_insert["created_at"] = now
    promo_doc_to_insert["updated_at"] = now
    promo_doc_to_insert["usage_count"] = 0  # Khởi tạo usage_count

    try:
        result = await db[PROMOTIONS_COLLECTION].insert_one(promo_doc_to_insert)
        if result.inserted_id:
            created_doc = await db[PROMOTIONS_COLLECTION].find_one({"_id": result.inserted_id})
            if created_doc:
                return PromotionInDB(**created_doc)
        logger.error(f"Không thể tạo mã khuyến mãi '{promo_code_upper}' sau khi insert.")
        return None
    except Exception as e:
        logger.error(f"Lỗi khi tạo mã khuyến mãi {promo_code_upper}: {e}", exc_info=True)
        raise ValueError(f"Không thể tạo mã khuyến mãi: {str(e)}")


async def update_promotion(
    db: AsyncIOMotorDatabase, promotion_id: PyObjectId, promotion_update_data: PromotionUpdate
) -> Optional[PromotionInDB]:
    if not ObjectId.is_valid(promotion_id):
        return None

    existing_promo = await get_promotion_by_id(db, promotion_id)
    if not existing_promo:
        return None  # Hoặc raise HTTPException 404 từ router

    update_data = promotion_update_data.model_dump(exclude_unset=True)
    if not update_data:
        return existing_promo

    start_date_to_check = update_data.get("start_date", existing_promo.start_date)
    end_date_to_check = update_data.get("end_date", existing_promo.end_date)

    if "start_date" in update_data and update_data["start_date"]:
        if update_data["start_date"].tzinfo is None:
            start_date_to_check = update_data["start_date"].replace(tzinfo=timezone.utc)
        else:
            start_date_to_check = update_data["start_date"].astimezone(timezone.utc)
        update_data["start_date"] = start_date_to_check

    if "end_date" in update_data and update_data["end_date"]:
        if update_data["end_date"].tzinfo is None:
            end_date_to_check = update_data["end_date"].replace(tzinfo=timezone.utc)
        else:
            end_date_to_check = update_data["end_date"].astimezone(timezone.utc)
        update_data["end_date"] = end_date_to_check

    if start_date_to_check and end_date_to_check and start_date_to_check >= end_date_to_check:
        raise ValueError("Ngày bắt đầu phải trước ngày kết thúc.")

    if "promotion_code" in update_data:  # Không cho phép cập nhật promotion_code
        del update_data["promotion_code"]
    if "usage_count" in update_data:  # Không cho phép cập nhật usage_count trực tiếp
        del update_data["usage_count"]

    update_data["updated_at"] = datetime.now(timezone.utc)

    await db[PROMOTIONS_COLLECTION].update_one({"_id": ObjectId(promotion_id)}, {"$set": update_data})
    return await get_promotion_by_id(db, promotion_id)


async def deactivate_promotion(db: AsyncIOMotorDatabase, promotion_id: PyObjectId) -> Optional[PromotionInDB]:
    if not ObjectId.is_valid(promotion_id):
        return None

    promo = await get_promotion_by_id(db, promotion_id)
    if not promo:
        raise ValueError(f"Không tìm thấy mã khuyến mãi với ID: {promotion_id}")

    if not promo.is_active:
        return promo  # Đã inactive rồi

    await db[PROMOTIONS_COLLECTION].update_one(
        {"_id": ObjectId(promotion_id)}, {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc)}}
    )
    return await get_promotion_by_id(db, promotion_id)


async def delete_promotion(db: AsyncIOMotorDatabase, promotion_id: PyObjectId) -> Optional[PromotionInDB]:
    """
    Delete a promotion by ID.
    - Cannot delete active promotions, must deactivate first
    """
    if not ObjectId.is_valid(promotion_id):
        logger.warning(f"Promotion ID không hợp lệ để xóa: {promotion_id}")
        return None

    promo_obj_id = ObjectId(promotion_id)
    promo_before_delete = await db[PROMOTIONS_COLLECTION].find_one({"_id": promo_obj_id})
    if not promo_before_delete:
        logger.warning(f"Không tìm thấy mã khuyến mãi với ID {promotion_id} để xóa.")
        return None

    # Check if promotion is currently active
    if promo_before_delete.get("is_active", False):
        logger.warning(f"Attempt to delete active promotion {promotion_id}. Must deactivate first.")
        raise ValueError("Không thể xóa mã khuyến mãi đang hoạt động. Vui lòng vô hiệu hóa mã khuyến mãi trước khi xóa.")

    # Store promotion data before deletion
    promotion_to_return = await get_promotion_by_id(db, promotion_id)

    # Delete the promotion
    delete_result = await db[PROMOTIONS_COLLECTION].delete_one({"_id": promo_obj_id})

    if delete_result.deleted_count > 0:
        logger.info(f"Đã xóa mã khuyến mãi {promotion_id}.")
        return promotion_to_return
    else:
        logger.warning(f"Không thể xóa mã khuyến mãi {promotion_id} (có thể do lỗi hoặc không tìm thấy).")
        return None


async def increment_promotion_usage(db: AsyncIOMotorDatabase, promotion_code: str) -> bool:
    result = await db[PROMOTIONS_COLLECTION].update_one(
        {"promotion_code": promotion_code.upper()}, {"$inc": {"usage_count": 1}, "$set": {"updated_at": datetime.now(timezone.utc)}}
    )
    return result.modified_count > 0


async def is_promotion_code_valid_and_active(
    db: AsyncIOMotorDatabase,
    promotion_code: str,
    license_key_to_check: Optional[str] = None,
) -> Optional[PromotionInDB]:
    promo = await get_promotion_by_code(db, promotion_code)

    if not promo:
        logger.debug(f"Mã khuyến mãi '{promotion_code}' không tồn tại.")
        return None

    if not promo.is_active:
        logger.debug(f"Mã khuyến mãi '{promotion_code}' không hoạt động.")
        return None

    now = datetime.now(timezone.utc)

    promo_start_date_utc = promo.start_date
    if promo_start_date_utc:
        if promo_start_date_utc.tzinfo is None:
            promo_start_date_utc = promo_start_date_utc.replace(tzinfo=timezone.utc)
        elif promo_start_date_utc.tzinfo != timezone.utc:
            promo_start_date_utc = promo_start_date_utc.astimezone(timezone.utc)
        if promo_start_date_utc > now:
            logger.debug(f"Mã khuyến mãi '{promotion_code}' chưa đến ngày bắt đầu.")
            return None

    promo_end_date_utc = promo.end_date
    if promo_end_date_utc:
        if promo_end_date_utc.tzinfo is None:
            promo_end_date_utc = promo_end_date_utc.replace(tzinfo=timezone.utc)
        elif promo_end_date_utc.tzinfo != timezone.utc:
            promo_end_date_utc = promo_end_date_utc.astimezone(timezone.utc)
        if promo_end_date_utc < now:
            logger.debug(f"Mã khuyến mãi '{promotion_code}' đã hết hạn.")
            return None

    if promo.usage_limit is not None and promo.usage_count >= promo.usage_limit:
        logger.debug(f"Mã khuyến mãi '{promotion_code}' đã hết lượt sử dụng.")
        return None

    if promo.applicable_license_keys and license_key_to_check not in promo.applicable_license_keys:
        logger.debug(f"Mã khuyến mãi '{promotion_code}' không áp dụng cho license key '{license_key_to_check}'.")
        return None

    return promo


def calculate_discounted_amount(original_amount: float, promo: PromotionInDB) -> tuple[float, float]:
    discount_applied = 0.0
    if promo.discount_type == DiscountTypeEnum.PERCENTAGE:
        discount_applied = original_amount * (promo.discount_value / 100)
    elif promo.discount_type == DiscountTypeEnum.FIXED_AMOUNT:
        discount_applied = promo.discount_value

    final_amount = original_amount - discount_applied
    if final_amount < 0:
        final_amount = 0.0  # Giá trị không thể âm
        discount_applied = original_amount  # Giảm giá tối đa bằng giá gốc

    return round(discount_applied, 2), round(final_amount, 2)


async def run_deactivate_expired_promotions_task(db: AsyncIOMotorDatabase) -> int:
    """
    Tìm và gọi hàm deactivate_promotion cho tất cả các promotions
    đã qua end_date và vẫn đang is_active.
    """
    now = datetime.now(timezone.utc)
    query = {"is_active": True, "end_date": {"$lt": now}}

    promos_to_deactivate_cursor = db[PROMOTIONS_COLLECTION].find(query)
    deactivated_count = 0

    async for promo_doc in promos_to_deactivate_cursor:
        promo_id_str = str(promo_doc["_id"])
        try:
            updated_promo = await deactivate_promotion(db, promo_id_str)  # type: ignore
            if updated_promo and not updated_promo.is_active:
                logger.info(f"Cron Task: Deactivated expired promotion ID: {promo_id_str}, Code: {promo_doc.get('promotion_code')}")
                deactivated_count += 1
            elif updated_promo and updated_promo.is_active:  # Không nên xảy ra
                logger.warning(f"Cron Task: Attempted to deactivate promo {promo_id_str}, but it remained active.")
        except ValueError as ve:
            logger.warning(f"Cron Task: Skipped deactivating promotion {promo_id_str} due to: {ve}")
        except Exception as e:
            logger.error(f"Cron Task: Error deactivating promotion {promo_id_str}: {e}", exc_info=True)

    if deactivated_count > 0:
        logger.info(f"Cron Task: Finished deactivating {deactivated_count} expired promotions.")
    else:
        logger.info("Cron Task: No active and expired promotions found to deactivate.")
    return deactivated_count

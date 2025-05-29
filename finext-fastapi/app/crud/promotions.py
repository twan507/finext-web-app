# finext-fastapi/app/crud/promotions.py
import logging
from typing import List, Optional
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timezone  # Đảm bảo timezone được import

from app.schemas.promotions import PromotionCreate, PromotionUpdate, PromotionInDB, DiscountTypeEnum
from app.utils.types import PyObjectId

logger = logging.getLogger(__name__)


async def get_promotion_by_id(db: AsyncIOMotorDatabase, promotion_id: PyObjectId) -> Optional[PromotionInDB]:
    if not ObjectId.is_valid(promotion_id):
        return None
    promo_doc = await db.promotions.find_one({"_id": ObjectId(promotion_id)})
    if promo_doc:
        return PromotionInDB(**promo_doc)
    return None


async def get_promotion_by_code(db: AsyncIOMotorDatabase, promotion_code: str) -> Optional[PromotionInDB]:
    promo_doc = await db.promotions.find_one({"promotion_code": promotion_code.upper()})
    if promo_doc:
        return PromotionInDB(**promo_doc)
    return None


async def get_promotions(
    db: AsyncIOMotorDatabase, skip: int = 0, limit: int = 100, is_active: Optional[bool] = None
) -> List[PromotionInDB]:
    query = {}
    if is_active is not None:
        query["is_active"] = is_active

    promos_cursor = db.promotions.find(query).sort("created_at", -1).skip(skip).limit(limit)
    promos_list = await promos_cursor.to_list(length=limit)
    return [PromotionInDB(**promo) for promo in promos_list]


async def create_promotion(db: AsyncIOMotorDatabase, promotion_data: PromotionCreate) -> Optional[PromotionInDB]:
    promo_code_upper = promotion_data.promotion_code.upper()

    existing_promo = await db.promotions.find_one({"promotion_code": promo_code_upper})
    if existing_promo:
        raise ValueError(f"Mã khuyến mãi '{promo_code_upper}' đã tồn tại.")

    if promotion_data.start_date and promotion_data.end_date and promotion_data.start_date >= promotion_data.end_date:
        raise ValueError("Ngày bắt đầu phải trước ngày kết thúc.")

    now = datetime.now(timezone.utc)

    promo_doc_to_insert = promotion_data.model_dump()
    promo_doc_to_insert["promotion_code"] = promo_code_upper
    # Đảm bảo start_date và end_date được lưu trữ với timezone UTC nếu chúng được cung cấp
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
    promo_doc_to_insert["usage_count"] = 0

    try:
        result = await db.promotions.insert_one(promo_doc_to_insert)
        if result.inserted_id:
            created_doc = await db.promotions.find_one({"_id": result.inserted_id})
            if created_doc:
                return PromotionInDB(**created_doc)
        return None
    except Exception as e:
        logger.error(f"Error creating promotion '{promo_code_upper}': {e}", exc_info=True)
        raise ValueError(f"Không thể tạo mã khuyến mãi: {str(e)}")


async def update_promotion(
    db: AsyncIOMotorDatabase, promotion_id: PyObjectId, promotion_update_data: PromotionUpdate
) -> Optional[PromotionInDB]:
    if not ObjectId.is_valid(promotion_id):
        return None

    existing_promo = await get_promotion_by_id(db, promotion_id)
    if not existing_promo:
        return None

    update_data = promotion_update_data.model_dump(exclude_unset=True)
    if not update_data:
        return existing_promo

    start_date_to_check = update_data.get("start_date", existing_promo.start_date)
    end_date_to_check = update_data.get("end_date", existing_promo.end_date)

    # Chuẩn hóa timezone cho start_date_to_check và end_date_to_check nếu chúng được cập nhật
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

    if "promotion_code" in update_data:
        del update_data["promotion_code"]

    update_data["updated_at"] = datetime.now(timezone.utc)

    await db.promotions.update_one({"_id": ObjectId(promotion_id)}, {"$set": update_data})
    return await get_promotion_by_id(db, promotion_id)


async def deactivate_promotion(db: AsyncIOMotorDatabase, promotion_id: PyObjectId) -> Optional[PromotionInDB]:
    if not ObjectId.is_valid(promotion_id):
        return None

    promo = await get_promotion_by_id(db, promotion_id)
    if not promo:
        raise ValueError(f"Không tìm thấy mã khuyến mãi với ID: {promotion_id}")

    if not promo.is_active:
        return promo

    await db.promotions.update_one(
        {"_id": ObjectId(promotion_id)}, {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc)}}
    )
    return await get_promotion_by_id(db, promotion_id)


async def increment_promotion_usage(db: AsyncIOMotorDatabase, promotion_code: str) -> bool:
    result = await db.promotions.update_one(
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

    now = datetime.now(timezone.utc)  # Đây là offset-aware (UTC)

    # Đảm bảo promo.start_date và promo.end_date là offset-aware (UTC) trước khi so sánh
    promo_start_date_utc = promo.start_date
    if promo_start_date_utc:
        if promo_start_date_utc.tzinfo is None:  # Nếu naive, giả định là UTC
            promo_start_date_utc = promo_start_date_utc.replace(tzinfo=timezone.utc)
        elif promo_start_date_utc.tzinfo != timezone.utc:  # Nếu aware nhưng khác TZ, chuyển sang UTC
            promo_start_date_utc = promo_start_date_utc.astimezone(timezone.utc)
        # Nếu đã là UTC aware thì giữ nguyên

        if promo_start_date_utc > now:
            logger.debug(f"Mã khuyến mãi '{promotion_code}' chưa đến ngày bắt đầu. Start UTC: {promo_start_date_utc}, Now UTC: {now}")
            return None

    promo_end_date_utc = promo.end_date
    if promo_end_date_utc:
        if promo_end_date_utc.tzinfo is None:  # Nếu naive, giả định là UTC
            promo_end_date_utc = promo_end_date_utc.replace(tzinfo=timezone.utc)
        elif promo_end_date_utc.tzinfo != timezone.utc:  # Nếu aware nhưng khác TZ, chuyển sang UTC
            promo_end_date_utc = promo_end_date_utc.astimezone(timezone.utc)
        # Nếu đã là UTC aware thì giữ nguyên

        if promo_end_date_utc < now:
            logger.debug(f"Mã khuyến mãi '{promotion_code}' đã hết hạn. End UTC: {promo_end_date_utc}, Now UTC: {now}")
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
        final_amount = 0
        discount_applied = original_amount

    return round(discount_applied, 2), round(final_amount, 2)

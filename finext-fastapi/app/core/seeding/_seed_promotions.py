# finext-fastapi/app/core/seeding/_seed_promotions.py
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Any
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.schemas.promotions import PromotionCreate, DiscountTypeEnum
# Không cần PyObjectId ở đây nếu không trả về map ID

logger = logging.getLogger(__name__)

async def seed_promotions(db: AsyncIOMotorDatabase) -> None:
    promotions_collection = db.get_collection("promotions")

    default_promotions_data: List[Dict[str, Any]] = [
        {
            "promotion_code": "WELCOME20",
            "description": "Giảm 20% cho người dùng mới đăng ký gói bất kỳ lần đầu.",
            "discount_type": DiscountTypeEnum.PERCENTAGE,
            "discount_value": 20,
            "is_active": True,
            "start_date": datetime.now(timezone.utc) - timedelta(days=1), # Đã bắt đầu
            "end_date": datetime.now(timezone.utc) + timedelta(days=365), # Hết hạn sau 1 năm
            "usage_limit": 1, # Mỗi user chỉ dùng 1 lần (logic này cần xử lý ở tầng cao hơn, hiện tại là tổng lượt)
                             # Hoặc để None nếu không giới hạn tổng lượt, chỉ giới hạn theo logic nghiệp vụ
            "applicable_license_keys": None, # Áp dụng cho tất cả
        },
        {
            "promotion_code": "SAVE50K",
            "description": "Giảm trực tiếp 50.000 VNĐ cho đơn hàng trên 200.000 VNĐ.",
            "discount_type": DiscountTypeEnum.FIXED_AMOUNT,
            "discount_value": 50000,
            "is_active": True,
            "start_date": None, # Không có ngày bắt đầu cụ thể (luôn active nếu is_active=True)
            "end_date": None,   # Không có ngày kết thúc cụ thể
            "usage_limit": 1000,
            # "min_purchase_amount": 200000, # Đã bỏ
            "applicable_license_keys": None,
        },
    ]

    for promo_data in default_promotions_data:
        existing_promo = await promotions_collection.find_one({"promotion_code": promo_data["promotion_code"].upper()})
        if not existing_promo:
            try:
                promo_to_create = PromotionCreate(**promo_data) # type: ignore

                now = datetime.now(timezone.utc)
                doc_to_insert = promo_to_create.model_dump()
                doc_to_insert["promotion_code"] = promo_to_create.promotion_code.upper()
                doc_to_insert["created_at"] = now
                doc_to_insert["updated_at"] = now
                doc_to_insert["usage_count"] = 0

                await promotions_collection.insert_one(doc_to_insert)
                logger.info(f"Đã seed mã khuyến mãi: {promo_to_create.promotion_code}")
            except Exception as e:
                logger.error(f"Lỗi khi seed mã khuyến mãi {promo_data.get('promotion_code')}: {e}", exc_info=True)
        else:
            logger.info(f"Mã khuyến mãi '{promo_data['promotion_code']}' đã tồn tại. Bỏ qua seeding.")
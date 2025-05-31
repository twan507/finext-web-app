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
            "promotion_code": "DEMO_NEWUSER",
            "description": "🎉 Demo: Giảm 15% cho người dùng mới",
            "discount_type": DiscountTypeEnum.PERCENTAGE,
            "discount_value": 15,
            "is_active": True,
            "start_date": datetime.now(timezone.utc) - timedelta(days=1), 
            "end_date": datetime.now(timezone.utc) + timedelta(days=30),
            "usage_limit": 100,
            "applicable_license_keys": None,
        },
        {
            "promotion_code": "DEMO_FLASH30K",
            "description": "⚡ Demo: Flash Sale - Giảm 30.000 VNĐ cho tất cả sản phẩm",
            "discount_type": DiscountTypeEnum.FIXED_AMOUNT,
            "discount_value": 30000,
            "is_active": True,
            "start_date": datetime.now(timezone.utc), 
            "end_date": datetime.now(timezone.utc) + timedelta(days=7), # Demo 7 ngày
            "usage_limit": 2,
            "applicable_license_keys": None,
        },
    ]

    existing_codes = []
    for promo_data in default_promotions_data:
        existing_promo = await promotions_collection.find_one({"promotion_code": promo_data["promotion_code"].upper()})
        if existing_promo:
            existing_codes.append(promo_data["promotion_code"])

    # Nếu tất cả mã đã tồn tại, báo và bỏ qua
    if len(existing_codes) == len(default_promotions_data):
        logger.info("Không có promotions mới nào cần seed.")
        return

    # Chỉ seed những mã chưa tồn tại
    for promo_data in default_promotions_data:
        if promo_data["promotion_code"] not in existing_codes:
            try:
                promo_to_create = PromotionCreate(**promo_data)

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
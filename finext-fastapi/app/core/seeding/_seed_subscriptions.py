# finext-fastapi/app/core/seeding/_seed_subscriptions.py
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional # Thêm List
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId

from app.schemas.subscriptions import SubscriptionBase
from app.utils.types import PyObjectId
from app.core.config import ADMIN_EMAIL, BROKER_EMAIL_1, BROKER_EMAIL_2 # Sử dụng broker emails mới

logger = logging.getLogger(__name__)


async def seed_subscriptions(
    db: AsyncIOMotorDatabase,
    user_ids_map: Dict[str, PyObjectId],
    license_ids_map: Dict[str, PyObjectId],
):
    subscriptions_collection = db.get_collection("subscriptions")
    users_collection = db.get_collection("users")
    licenses_collection = db.get_collection("licenses")

    subs_to_create_config: List[Dict[str, Optional[str]]] = [] # Sử dụng list các dict

    if ADMIN_EMAIL:
        subs_to_create_config.append({"email": ADMIN_EMAIL, "license_key": "ADMIN"})
    
    broker_emails_for_sub = [BROKER_EMAIL_1, BROKER_EMAIL_2]
    for broker_email_val in broker_emails_for_sub:
        if broker_email_val:
            subs_to_create_config.append({"email": broker_email_val, "license_key": "PARTNER"})

    now = datetime.now(timezone.utc)
    
    for sub_config_item in subs_to_create_config:
        email = sub_config_item.get("email")
        license_key = sub_config_item.get("license_key")

        if not email or not license_key: 
            logger.warning(f"Config seeding subscription thiếu email hoặc license_key: {sub_config_item}")
            continue

        user_id_str = user_ids_map.get(email)
        license_id_str_from_map = license_ids_map.get(license_key)

        if not user_id_str or not license_id_str_from_map:
            logger.warning(
                f"Bỏ qua seeding subscription cho {email} do thiếu User ID (str: {user_id_str}) hoặc License ID (str: {license_id_str_from_map} cho key {license_key})."
            )
            continue

        if not ObjectId.is_valid(user_id_str) or not ObjectId.is_valid(
            license_id_str_from_map
        ):
            logger.warning(
                f"User ID {user_id_str} hoặc License ID {license_id_str_from_map} không phải ObjectId hợp lệ cho email {email}. Bỏ qua."
            )
            continue

        license_doc = await licenses_collection.find_one(
            {"_id": ObjectId(license_id_str_from_map)}
        )
        if not license_doc:
            logger.warning(
                f"License document for ID {license_id_str_from_map} (key: {license_key}) not found. Skipping subscription for {email}."
            )
            continue

        user_obj_id_for_sub = ObjectId(user_id_str)
        license_obj_id_for_sub = ObjectId(license_id_str_from_map)

        user_current_doc = await users_collection.find_one({"_id": user_obj_id_for_sub})
        if not user_current_doc:
            logger.warning(
                f"User document for ID {user_id_str} not found. Skipping subscription seeding for {email}."
            )
            continue

        create_new_sub = True
        if user_current_doc.get("subscription_id"):
            current_sub_id_in_user = user_current_doc.get("subscription_id")
            if current_sub_id_in_user and isinstance(current_sub_id_in_user, ObjectId):
                active_sub_check = await subscriptions_collection.find_one(
                    {
                        "_id": current_sub_id_in_user,
                        "is_active": True,
                        "expiry_date": {"$gt": now},
                        "license_key": license_key 
                    }
                )
                if active_sub_check: # Đã có sub active đúng loại -> không tạo mới
                    logger.info(
                        f"User {email} đã có active subscription ({str(current_sub_id_in_user)}) với license key '{license_key}'. Bỏ qua seeding."
                    )
                    create_new_sub = False
                # Nếu có active sub nhưng khác loại, create_new_sub vẫn là True (sẽ deactivate sub cũ và tạo sub mới)
            elif (
                current_sub_id_in_user
            ):  
                logger.warning(
                    f"User {email} has subscription_id {current_sub_id_in_user} but it is not an ObjectId. Will attempt to create new sub."
                )

        if create_new_sub:
            logger.info(f"Seeding subscription '{license_key}' cho user '{email}'...")
            duration_days = license_doc.get("duration_days", 99999)
            expiry_date = now + timedelta(days=duration_days)

            sub_base_payload = SubscriptionBase(
                user_id=user_id_str,
                user_email=email,
                license_id=license_id_str_from_map,
                license_key=license_key,
                is_active=True,
                start_date=now,
                expiry_date=expiry_date,
            )
            sub_doc_to_insert = {
                **sub_base_payload.model_dump(),
                "created_at": now,
                "updated_at": now,
            }
            sub_doc_to_insert["user_id"] = user_obj_id_for_sub
            sub_doc_to_insert["license_id"] = license_obj_id_for_sub

            try:
                # Trước khi tạo sub mới, hủy các sub active cũ của user (nếu có)
                await subscriptions_collection.update_many(
                    {"user_id": user_obj_id_for_sub, "is_active": True},
                    {"$set": {"is_active": False, "updated_at": now}}
                )
                logger.info(f"Đã hủy các active subscriptions cũ của user {email} (nếu có).")

                result = await subscriptions_collection.insert_one(sub_doc_to_insert)
                if result.inserted_id:
                    await users_collection.update_one(
                        {"_id": user_obj_id_for_sub},
                        {
                            "$set": {
                                "subscription_id": result.inserted_id,  
                                "updated_at": now,
                            }
                        },
                    )
                    logger.info(
                        f"Đã tạo subscription ID {result.inserted_id} và cập nhật cho user {email}."
                    )
                else:
                    logger.error(f"Không thể tạo subscription cho {email}.")
            except Exception as e_insert_sub:
                logger.error(
                    f"Lỗi khi insert subscription cho {email}: {e_insert_sub}",
                    exc_info=True,
                )
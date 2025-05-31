# finext-fastapi/app/core/seeding/_seed_subscriptions.py
import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId

from app.schemas.subscriptions import SubscriptionCreate
from app.utils.types import PyObjectId
from app.core.config import ADMIN_EMAIL, BROKER_EMAIL_1, BROKER_EMAIL_2, BASIC_LICENSE_KEY
import app.crud.subscriptions as crud_subscriptions

logger = logging.getLogger(__name__)


async def seed_subscriptions(
    db: AsyncIOMotorDatabase,
    user_ids_map: Dict[str, PyObjectId],
    license_ids_map: Dict[str, PyObjectId],
):
    subs_to_create_config: List[Dict[str, Optional[str]]] = []

    if ADMIN_EMAIL and ADMIN_EMAIL in user_ids_map and "ADMIN" in license_ids_map:
        subs_to_create_config.append({"email": ADMIN_EMAIL, "license_key": "ADMIN"})
    
    broker_emails_for_sub = [BROKER_EMAIL_1, BROKER_EMAIL_2]
    for broker_email_val in broker_emails_for_sub:
        if broker_email_val and broker_email_val in user_ids_map and "PARTNER" in license_ids_map:
            subs_to_create_config.append({"email": broker_email_val, "license_key": "PARTNER"})

    # Kiểm tra subscriptions đã tồn tại
    existing_subs = []
    valid_subs = []
    
    for sub_config_item in subs_to_create_config:
        email = sub_config_item.get("email")
        license_key = sub_config_item.get("license_key")

        if not email or not license_key: 
            logger.warning(f"Config seeding specific subscription thiếu email hoặc license_key: {sub_config_item}")
            continue
        
        user_id_str = user_ids_map.get(email) 

        if not user_id_str:
             logger.warning(f"Skipping seeding specific sub for {email} as user_id not found in map.")
             continue
        
        if not ObjectId.is_valid(user_id_str):
            logger.warning(f"User ID {user_id_str} for {email} is not valid for specific sub.")
            continue

        valid_subs.append((email, license_key, user_id_str))
        
        user_obj_id = ObjectId(user_id_str)
        existing_specific_active_sub = await db.subscriptions.find_one({
            "user_id": user_obj_id,
            "license_key": license_key,
            "is_active": True,
            "expiry_date": {"$gt": datetime.now(timezone.utc)}
        })
        if existing_specific_active_sub:
            existing_subs.append((email, license_key))
            # Ensure user.subscription_id is correctly set
            await db.users.update_one(
                {"_id": user_obj_id},
                {"$set": {"subscription_id": existing_specific_active_sub["_id"], "updated_at": datetime.now(timezone.utc)}}
            )

    # Nếu tất cả subscriptions đã tồn tại, báo và bỏ qua
    if len(existing_subs) == len(valid_subs):
        logger.info("Không có subscriptions mới nào cần seed.")
    else:
        # Chỉ seed những subscriptions chưa tồn tại
        for email, license_key, user_id_str in valid_subs:
            if (email, license_key) not in existing_subs:
                try:
                    sub_create_payload = SubscriptionCreate(user_id=user_id_str, license_key=license_key) # type: ignore
                    created_sub = await crud_subscriptions.create_subscription_db(db, sub_create_payload)
                    if created_sub:
                        logger.info(f"Successfully seeded specific subscription '{license_key}' for user '{email}' (Sub ID: {created_sub.id}).")
                    else:
                        logger.error(f"Failed to seed specific subscription '{license_key}' for user '{email}'.")
                except ValueError as ve:
                    logger.error(f"ValueError while seeding specific subscription '{license_key}' for '{email}': {ve}")
                except Exception as e:
                    logger.error(f"Unexpected error seeding specific subscription '{license_key}' for '{email}': {e}", exc_info=True)

    # Now, iterate through ALL users in user_ids_map and assign FREE if they don't have any active sub
    free_license_id_str = license_ids_map.get(BASIC_LICENSE_KEY)
    if not free_license_id_str:
        logger.error(f"'{BASIC_LICENSE_KEY}' license key not found in license_ids_map. Cannot seed FREE subscriptions.")
        return

    for email, user_id_str_from_map in user_ids_map.items():
        if not user_id_str_from_map or not ObjectId.is_valid(user_id_str_from_map):
            logger.warning(f"Invalid or missing user ID for email '{email}' in user_ids_map. Skipping FREE sub check.")
            continue
        
        user_obj_id_for_free_check = ObjectId(user_id_str_from_map)
        try:
            # assign_free_subscription_if_needed will check for any other active sub
            # and only assign FREE if none exist.
            await crud_subscriptions.assign_free_subscription_if_needed(db, user_obj_id_for_free_check)
        except Exception as e:
            logger.error(f"Error during assign_free_subscription_if_needed for user {email} (ID: {user_id_str_from_map}): {e}", exc_info=True)
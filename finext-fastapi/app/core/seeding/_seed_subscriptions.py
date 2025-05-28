# finext-fastapi/app/core/seeding/_seed_subscriptions.py
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId

from app.schemas.subscriptions import SubscriptionBase
from app.utils.types import PyObjectId
from app.core.config import ADMIN_EMAIL, BROKER_EMAIL, USER_EMAIL

logger = logging.getLogger(__name__)


async def seed_subscriptions(
    db: AsyncIOMotorDatabase,
    user_ids_map: Dict[str, PyObjectId],
    license_ids_map: Dict[str, PyObjectId],
):
    subscriptions_collection = db.get_collection("subscriptions")
    users_collection = db.get_collection("users")
    licenses_collection = db.get_collection("licenses")

    subs_to_create_map = {}
    if ADMIN_EMAIL:
        subs_to_create_map[ADMIN_EMAIL] = "ADMIN"
    if BROKER_EMAIL:
        subs_to_create_map[BROKER_EMAIL] = "PARTNER"
    if USER_EMAIL:
        subs_to_create_map[USER_EMAIL] = "FREE"

    now = datetime.now(timezone.utc)

    for email, license_key in subs_to_create_map.items():
        if not email:  # Should not happen if keys are from config
            continue

        user_id_str = user_ids_map.get(email)
        license_id_str_from_map = license_ids_map.get(license_key)

        if not user_id_str or not license_id_str_from_map:
            logger.warning(
                f"Bỏ qua seeding subscription cho {email} do thiếu User ID (str: {user_id_str}) hoặc License ID (str: {license_id_str_from_map})."
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
                    }
                )
                if active_sub_check:
                    logger.info(
                        f"User {email} đã có active subscription ({str(current_sub_id_in_user)}). Bỏ qua seeding."
                    )
                    create_new_sub = False
            elif (
                current_sub_id_in_user
            ):  # Is present but not ObjectId (shouldn't happen with correct saving)
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
                result = await subscriptions_collection.insert_one(sub_doc_to_insert)
                if result.inserted_id:
                    await users_collection.update_one(
                        {"_id": user_obj_id_for_sub},
                        {
                            "$set": {
                                "subscription_id": result.inserted_id,  # This is an ObjectId
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

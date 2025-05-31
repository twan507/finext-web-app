# finext-fastapi/app/crud/subscriptions.py
import logging
from typing import List, Optional
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timezone, timedelta
from app.utils.email_utils import send_subscription_expiry_reminder_email

from app.schemas.subscriptions import (
    SubscriptionCreate,
    SubscriptionInDB,
    SubscriptionBase,
)
from app.utils.types import PyObjectId
import app.crud.licenses as crud_licenses
from app.core.config import PROTECTED_LICENSE_KEYS, BASIC_LICENSE_KEY  # MỚI

logger = logging.getLogger(__name__)


async def assign_free_subscription_if_needed(db: AsyncIOMotorDatabase, user_id_obj: ObjectId) -> Optional[SubscriptionInDB]:
    """
    Assigns a BASIC subscription to the user if they don't have any other active subscription.
    """
    logger.debug(f"Checking if user {user_id_obj} needs a BASIC subscription.")
    # Check for any active subscription for the user
    now = datetime.now(timezone.utc)
    active_sub = await db.subscriptions.find_one(
        {
            "user_id": user_id_obj,
            "is_active": True,
            "expiry_date": {"$gt": now},
        }
    )

    if active_sub:
        logger.debug(
            f"User {user_id_obj} already has an active subscription (ID: {active_sub['_id']}, Key: {active_sub.get('license_key')}). No BASIC sub needed."
        )
        return None  # User already has an active subscription

    # User does not have any active subscription, assign BASIC
    logger.info(f"User {user_id_obj} has no active subscription. Assigning BASIC subscription.")
    user_doc = await db.users.find_one({"_id": user_id_obj})
    if not user_doc:
        logger.error(f"Cannot assign BASIC subscription: User {user_id_obj} not found.")
        return None

    free_license = await crud_licenses.get_license_by_key(db, BASIC_LICENSE_KEY)
    if not free_license or not free_license.id:
        logger.error(f"Cannot assign BASIC subscription: License with key '{BASIC_LICENSE_KEY}' not found.")
        return None
    if not free_license.is_active:
        logger.error(f"Cannot assign BASIC subscription: License '{BASIC_LICENSE_KEY}' is not active.")
        return None

    # Deactivate any other inactive BASIC subscriptions for this user to avoid duplicates if any exist
    await db.subscriptions.update_many(
        {"user_id": user_id_obj, "license_key": BASIC_LICENSE_KEY, "is_active": False},
        {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc)}},  # Ensure they stay inactive
    )

    free_sub_create_payload = SubscriptionCreate(
        user_id=str(user_id_obj),  # type: ignore
        license_key=BASIC_LICENSE_KEY,
    )
    try:
        # create_subscription_db will handle deactivation of other non-protected subs (though there shouldn't be any active at this point)
        created_free_sub = await create_subscription_db(db, free_sub_create_payload)
        if created_free_sub:
            logger.info(f"Successfully assigned BASIC subscription (ID: {created_free_sub.id}) to user {user_id_obj}.")
            return created_free_sub
        else:
            logger.error(f"Failed to create BASIC subscription for user {user_id_obj} using create_subscription_db.")
            return None
    except Exception as e:
        logger.error(f"Exception during assign_free_subscription_if_needed for user {user_id_obj}: {e}", exc_info=True)
        return None


async def get_subscription_by_id_db(db: AsyncIOMotorDatabase, subscription_id_str: PyObjectId) -> Optional[SubscriptionInDB]:
    if not ObjectId.is_valid(subscription_id_str):
        return None
    sub_doc = await db.subscriptions.find_one({"_id": ObjectId(subscription_id_str)})
    if sub_doc:
        sub_doc["user_id"] = str(sub_doc["user_id"])
        sub_doc["license_id"] = str(sub_doc["license_id"])
        return SubscriptionInDB(**sub_doc)
    return None


async def get_active_subscription_for_user_db(db: AsyncIOMotorDatabase, user_id_str: PyObjectId) -> Optional[SubscriptionInDB]:
    if not ObjectId.is_valid(user_id_str):
        return None
    now = datetime.now(timezone.utc)
    sub_doc = await db.subscriptions.find_one(
        {
            "user_id": ObjectId(user_id_str),
            "is_active": True,
            "expiry_date": {"$gt": now},
        }
    )
    if sub_doc:
        sub_doc["user_id"] = str(sub_doc["user_id"])
        sub_doc["license_id"] = str(sub_doc["license_id"])
        return SubscriptionInDB(**sub_doc)
    return None


async def find_inactive_partner_subscription_for_user(db: AsyncIOMotorDatabase, user_id_str: PyObjectId) -> Optional[SubscriptionInDB]:
    if not ObjectId.is_valid(user_id_str):
        return None

    partner_license = await crud_licenses.get_license_by_key(db, "PARTNER")
    if not partner_license or not partner_license.id:
        logger.warning("Không tìm thấy license 'PARTNER' khi tìm inactive sub.")
        return None

    sub_doc = await db.subscriptions.find_one(
        {
            "user_id": ObjectId(user_id_str),
            "license_key": "PARTNER",
            "is_active": False,
        },
        sort=[("updated_at", -1)],
    )
    if sub_doc:
        sub_doc["user_id"] = str(sub_doc["user_id"])
        sub_doc["license_id"] = str(sub_doc["license_id"])
        return SubscriptionInDB(**sub_doc)
    return None


async def get_subscriptions_for_user_db(
    db: AsyncIOMotorDatabase, user_id_str: PyObjectId, skip: int = 0, limit: int = 100
) -> List[SubscriptionInDB]:
    if not ObjectId.is_valid(user_id_str):
        return []
    subs_cursor = db.subscriptions.find({"user_id": ObjectId(user_id_str)}).skip(skip).limit(limit).sort("created_at", -1)
    subs_from_db = await subs_cursor.to_list(length=limit)

    processed_subs = []
    for sub_doc in subs_from_db:
        sub_doc["user_id"] = str(sub_doc["user_id"])
        sub_doc["license_id"] = str(sub_doc["license_id"])
        processed_subs.append(SubscriptionInDB(**sub_doc))
    return processed_subs


async def deactivate_all_active_subscriptions_for_user(
    db: AsyncIOMotorDatabase,
    user_id_obj: ObjectId,
    exclude_sub_id: Optional[ObjectId] = None,
) -> int:
    query = {
        "user_id": user_id_obj,
        "is_active": True,
        "license_key": {"$nin": PROTECTED_LICENSE_KEYS},  # BASIC_LICENSE_KEY is not in PROTECTED_LICENSE_KEYS
    }
    if exclude_sub_id:
        query["_id"] = {"$ne": exclude_sub_id}

    update_result = await db.subscriptions.update_many(
        query,
        {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc)}},
    )
    if update_result.modified_count > 0:
        logger.info(f"Deactivated {update_result.modified_count} other active non-protected subscription(s) for user {user_id_obj}.")
    return update_result.modified_count


async def create_subscription_db(db: AsyncIOMotorDatabase, sub_create_data: SubscriptionCreate) -> Optional[SubscriptionInDB]:
    user_id_str_from_req = str(sub_create_data.user_id)
    if not ObjectId.is_valid(user_id_str_from_req):
        logger.error(f"User ID không hợp lệ khi tạo subscription: {user_id_str_from_req}")
        return None

    user_obj_id = ObjectId(user_id_str_from_req)
    user = await db.users.find_one({"_id": user_obj_id})
    if not user:
        logger.error(f"User {user_id_str_from_req} not found for subscription creation.")
        return None

    license_template = await crud_licenses.get_license_by_key(db, sub_create_data.license_key)
    if not license_template or not license_template.id:
        logger.error(f"License key '{sub_create_data.license_key}' not found.")
        return None

    if not license_template.is_active:
        logger.error(
            f"Cannot create subscription for user {user_id_str_from_req} with inactive license key '{sub_create_data.license_key}'."
        )
        raise ValueError(f"License '{sub_create_data.license_key}' is not active and cannot be used to create new subscriptions.")

    license_obj_id = ObjectId(license_template.id)

    # Deactivate other non-protected active subscriptions (this will include BASIC if license_key is not BASIC)
    if sub_create_data.license_key != BASIC_LICENSE_KEY:
        await deactivate_all_active_subscriptions_for_user(db, user_obj_id)
    else:  # If creating a BASIC sub, ensure no other sub (even protected) is active, unless it's another BASIC one being reactivated
        # This case is mostly handled by assign_free_subscription_if_needed which calls this function.
        # Direct creation of BASIC sub via API by admin should also deactivate others if it's intended to be the *only* active one.
        # For simplicity, if admin directly creates BASIC, other non-protected will be deactivated.
        await deactivate_all_active_subscriptions_for_user(db, user_obj_id)

    dt_now = datetime.now(timezone.utc)
    duration = sub_create_data.duration_override_days or license_template.duration_days

    start_date_for_new_sub = dt_now
    expiry_date = start_date_for_new_sub + timedelta(days=duration)

    sub_base_payload = SubscriptionBase(
        user_id=user_id_str_from_req,
        user_email=user["email"],
        license_id=str(license_obj_id),
        license_key=license_template.key,
        is_active=True,
        start_date=start_date_for_new_sub,
        expiry_date=expiry_date,
    )

    sub_doc_to_insert = {
        **sub_base_payload.model_dump(),
        "created_at": dt_now,
        "updated_at": dt_now,
    }
    sub_doc_to_insert["user_id"] = user_obj_id
    sub_doc_to_insert["license_id"] = license_obj_id

    try:
        insert_result = await db.subscriptions.insert_one(sub_doc_to_insert)
        if insert_result.inserted_id:
            await db.users.update_one(
                {"_id": user_obj_id},
                {
                    "$set": {
                        "subscription_id": insert_result.inserted_id,
                        "updated_at": dt_now,
                    }
                },
            )
            return await get_subscription_by_id_db(db, str(insert_result.inserted_id))
        logger.error(f"Failed to create subscription for user: {user['email']}")
        return None
    except Exception as e:
        logger.error(f"Error creating subscription for {user['email']}: {e}", exc_info=True)
        return None


async def activate_specific_subscription_for_user(
    db: AsyncIOMotorDatabase,
    user_id_str: PyObjectId,
    subscription_id_to_activate_str: PyObjectId,
    new_expiry_date: Optional[datetime] = None,
) -> Optional[SubscriptionInDB]:
    if not ObjectId.is_valid(user_id_str) or not ObjectId.is_valid(subscription_id_to_activate_str):
        logger.error("User ID hoặc Subscription ID không hợp lệ để kích hoạt.")
        return None

    user_obj_id = ObjectId(user_id_str)
    sub_to_activate_obj_id = ObjectId(subscription_id_to_activate_str)

    sub_to_activate_doc = await db.subscriptions.find_one({"_id": sub_to_activate_obj_id, "user_id": user_obj_id})
    if not sub_to_activate_doc:
        logger.warning(f"Subscription {subscription_id_to_activate_str} không tìm thấy hoặc không thuộc user {user_id_str}.")
        return None

    license_id_of_sub = sub_to_activate_doc.get("license_id")
    if not license_id_of_sub or not ObjectId.is_valid(str(license_id_of_sub)):
        logger.error(f"Subscription {subscription_id_to_activate_str} has invalid license_id {license_id_of_sub}.")
        raise ValueError("Không thể kích hoạt subscription do lỗi dữ liệu license.")

    license_doc = await crud_licenses.get_license_by_id(db, str(license_id_of_sub))
    if not license_doc:
        logger.error(f"License (ID: {license_id_of_sub}) associated with subscription {subscription_id_to_activate_str} not found.")
        raise ValueError("License gốc của subscription này không còn tồn tại.")

    if not license_doc.is_active:
        logger.warning(
            f"Cannot activate subscription {subscription_id_to_activate_str} because its license '{license_doc.key}' (ID: {license_doc.id}) is inactive."
        )
        raise ValueError(f"Không thể kích hoạt subscription vì gói license '{license_doc.key}' liên kết với nó hiện không hoạt động.")

    # If activating a non-BASIC sub, deactivate other non-protected ones (including BASIC)
    if sub_to_activate_doc.get("license_key") != BASIC_LICENSE_KEY:
        await deactivate_all_active_subscriptions_for_user(db, user_obj_id, exclude_sub_id=sub_to_activate_obj_id)
    # If activating a BASIC sub, other non-protected subs should also be deactivated.
    # The exclude_sub_id ensures the one being activated is not touched.
    else:
        await deactivate_all_active_subscriptions_for_user(db, user_obj_id, exclude_sub_id=sub_to_activate_obj_id)

    dt_now = datetime.now(timezone.utc)
    update_fields = {"is_active": True, "updated_at": dt_now}
    if new_expiry_date:
        if new_expiry_date.tzinfo is None:
            new_expiry_date = new_expiry_date.replace(tzinfo=timezone.utc)
        update_fields["expiry_date"] = new_expiry_date
        update_fields["start_date"] = dt_now  # Reset start_date if expiry_date is being changed

    update_result = await db.subscriptions.update_one({"_id": sub_to_activate_obj_id, "user_id": user_obj_id}, {"$set": update_fields})

    if update_result.modified_count > 0 or update_result.matched_count > 0:
        await db.users.update_one(
            {"_id": user_obj_id},
            {"$set": {"subscription_id": sub_to_activate_obj_id, "updated_at": dt_now}},
        )
        logger.info(f"Đã kích hoạt subscription {subscription_id_to_activate_str} và cập nhật cho user {user_id_str}.")
        return await get_subscription_by_id_db(db, subscription_id_to_activate_str)

    logger.warning(f"Không thể kích hoạt subscription {subscription_id_to_activate_str} cho user {user_id_str}.")
    return None


async def deactivate_subscription_db(
    db: AsyncIOMotorDatabase,
    subscription_id_str: PyObjectId,
    # assign_free_if_none_active: bool = False, # This param is removed, logic is now inside
) -> Optional[SubscriptionInDB]:
    if not ObjectId.is_valid(subscription_id_str):
        logger.warning(f"Subscription ID không hợp lệ để hủy kích hoạt: {subscription_id_str}")
        return None

    sub_obj_id = ObjectId(subscription_id_str)
    sub_before_update = await db.subscriptions.find_one({"_id": sub_obj_id})
    if not sub_before_update:
        logger.warning(f"Không tìm thấy subscription với ID {subscription_id_str} để hủy kích hoạt.")
        return None

    if sub_before_update.get("license_key") in PROTECTED_LICENSE_KEYS:
        logger.warning(
            f"Attempt to deactivate protected subscription {subscription_id_str} (License: {sub_before_update.get('license_key')}). Denied."
        )
        raise ValueError(f"Cannot deactivate protected subscription with license '{sub_before_update.get('license_key')}'.")

    if not sub_before_update.get("is_active", False):
        logger.info(f"Subscription {subscription_id_str} đã ở trạng thái inactive.")
        # Even if it was already inactive, check if user needs BASIC sub
        user_id_of_sub_obj = sub_before_update.get("user_id")
        if user_id_of_sub_obj and isinstance(user_id_of_sub_obj, ObjectId):
            await assign_free_subscription_if_needed(db, user_id_of_sub_obj)
        return await get_subscription_by_id_db(db, subscription_id_str)

    update_result = await db.subscriptions.update_one(
        {"_id": sub_obj_id},
        {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc)}},
    )

    deactivated_sub: Optional[SubscriptionInDB] = None
    user_id_of_sub_obj = sub_before_update.get("user_id")

    if update_result.modified_count > 0:
        deactivated_sub = await get_subscription_by_id_db(db, subscription_id_str)
        if user_id_of_sub_obj and isinstance(user_id_of_sub_obj, ObjectId):
            user = await db.users.find_one({"_id": user_id_of_sub_obj})
            if user and user.get("subscription_id") == sub_obj_id:
                await db.users.update_one(
                    {"_id": user_id_of_sub_obj},
                    {
                        "$set": {
                            "subscription_id": None,
                            "updated_at": datetime.now(timezone.utc),
                        }
                    },
                )
                logger.info(f"Đã xóa subscription_id khỏi user {str(user_id_of_sub_obj)} sau khi hủy sub {subscription_id_str}.")
            # After deactivation, assign BASIC if needed
            await assign_free_subscription_if_needed(db, user_id_of_sub_obj)
        return deactivated_sub
    else:  # No modification, but sub was found
        if user_id_of_sub_obj and isinstance(user_id_of_sub_obj, ObjectId):
            await assign_free_subscription_if_needed(db, user_id_of_sub_obj)

    logger.warning(f"Không thể hủy kích hoạt subscription {subscription_id_str} (có thể do lỗi hoặc không tìm thấy).")
    return None


async def send_expiry_reminders_task(db: AsyncIOMotorDatabase, days_before_expiry: int = 7) -> int:
    now = datetime.now(timezone.utc)
    reminder_threshold_date = now + timedelta(days=days_before_expiry)

    query = {
        "is_active": True,
        "expiry_date": {"$gt": now, "$lte": reminder_threshold_date},
        "license_key": {"$nin": PROTECTED_LICENSE_KEYS + [BASIC_LICENSE_KEY]},  # Exclude BASIC from reminders
    }

    subs_to_remind_cursor = db.subscriptions.find(query)
    email_sent_count = 0

    async for sub_doc in subs_to_remind_cursor:
        try:
            user_id = sub_doc.get("user_id")
            user_doc = await db.users.find_one({"_id": user_id})
            license_doc = await db.licenses.find_one({"_id": sub_doc.get("license_id")})

            if not user_doc or not license_doc:
                logger.warning(f"Skipping reminder for sub {sub_doc['_id']}: User or License info missing.")
                continue

            user_email = user_doc.get("email")
            user_full_name = user_doc.get("full_name", "Quý khách")
            license_name = license_doc.get("name", sub_doc.get("license_key"))
            license_key = sub_doc.get("license_key")
            expiry_date_dt = sub_doc.get("expiry_date")

            if not all([user_email, license_key, expiry_date_dt]):
                logger.warning(f"Skipping reminder for sub {sub_doc['_id']}: Missing critical data (email, license_key, expiry_date).")
                continue

            time_left = expiry_date_dt - now
            days_left_exact = time_left.days
            if time_left.total_seconds() > 0 and days_left_exact == 0:
                days_left_exact = 1
            elif time_left.total_seconds() <= 0:
                days_left_exact = 0

            if days_left_exact <= 0:
                logger.info(
                    f"Subscription {sub_doc['_id']} for user {user_email} seems already expired or expiring today. Days left: {days_left_exact}. Skipping reminder."
                )
                continue

            email_successful = await send_subscription_expiry_reminder_email(
                email_to=user_email,
                full_name=user_full_name,
                license_name=license_name,
                license_key=license_key,
                expiry_date=expiry_date_dt,
                days_left=days_left_exact,
            )
            if email_successful:
                email_sent_count += 1
        except Exception as e:
            logger.error(f"Error processing reminder for subscription {sub_doc.get('_id')}: {e}", exc_info=True)

    if email_sent_count > 0:
        logger.info(f"Cron Task: Successfully sent {email_sent_count} subscription expiry reminders.")
    else:
        logger.info("Cron Task: No subscriptions found needing an expiry reminder today.")
    return email_sent_count


async def run_deactivate_expired_subscriptions_task(db: AsyncIOMotorDatabase) -> int:
    now = datetime.now(timezone.utc)
    # We also exclude BASIC_LICENSE_KEY here, as its expiry is typically very far in the future
    # and its deactivation/activation is handled by assign_free_subscription_if_needed
    query = {"is_active": True, "expiry_date": {"$lt": now}, "license_key": {"$nin": PROTECTED_LICENSE_KEYS + [BASIC_LICENSE_KEY]}}

    expired_subs_cursor = db.subscriptions.find(query)
    deactivated_count = 0

    async for sub_doc in expired_subs_cursor:
        sub_id_str = str(sub_doc["_id"])
        user_id_of_sub_obj = sub_doc.get("user_id")
        try:
            updated_sub = await deactivate_subscription_db(db, sub_id_str)  # This will call assign_free_subscription_if_needed
            if updated_sub and not updated_sub.is_active:
                logger.info(f"Cron Task: Deactivated expired subscription ID: {sub_id_str} for user ID: {user_id_of_sub_obj}")
                deactivated_count += 1
                # User's subscription_id update and assignment of BASIC sub is handled within deactivate_subscription_db
            elif updated_sub and updated_sub.is_active:
                logger.warning(f"Cron Task: Attempted to deactivate {sub_id_str}, but it remained active.")
        except ValueError as ve:
            logger.warning(f"Cron Task: Skipped deactivating subscription {sub_id_str} due to: {ve}")
        except Exception as e:
            logger.error(f"Cron Task: Error deactivating subscription {sub_id_str}: {e}", exc_info=True)

    if deactivated_count > 0:
        logger.info(f"Cron Task: Finished deactivating {deactivated_count} expired subscriptions and assigned BASIC where needed.")
    else:
        logger.info("Cron Task: No active and expired non-protected/non-free subscriptions found to deactivate.")
    return deactivated_count

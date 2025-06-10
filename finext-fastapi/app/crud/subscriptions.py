# finext-fastapi/app/crud/subscriptions.py
import logging
from typing import List, Optional, Tuple  # Thêm Tuple
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timezone, timedelta
from app.utils.email_utils import send_subscription_expiry_reminder_email

from app.schemas.subscriptions import (
    SubscriptionCreate,
    SubscriptionInDB,  # Sử dụng SubscriptionInDB để lấy từ DB
    SubscriptionBase,
)
from app.utils.types import PyObjectId
import app.crud.licenses as crud_licenses
from app.core.config import PROTECTED_LICENSE_KEYS, BASIC_LICENSE_KEY

logger = logging.getLogger(__name__)


async def get_basic_subscription_for_user(db: AsyncIOMotorDatabase, user_id_obj: ObjectId) -> Optional[SubscriptionInDB]:
    """Helper to find any BASIC subscription for a user, active or not."""
    basic_sub_doc = await db.subscriptions.find_one(
        {"user_id": user_id_obj, "license_key": BASIC_LICENSE_KEY},
        sort=[("created_at", -1)],  # Get the latest one if multiple somehow exist
    )
    if basic_sub_doc:
        # Ensure IDs are strings for Pydantic model
        if "user_id" in basic_sub_doc and isinstance(basic_sub_doc["user_id"], ObjectId):
            basic_sub_doc["user_id"] = str(basic_sub_doc["user_id"])
        if "license_id" in basic_sub_doc and isinstance(basic_sub_doc["license_id"], ObjectId):
            basic_sub_doc["license_id"] = str(basic_sub_doc["license_id"])
        return SubscriptionInDB(**basic_sub_doc)
    return None


async def assign_free_subscription_if_needed(db: AsyncIOMotorDatabase, user_id_obj: ObjectId) -> Optional[SubscriptionInDB]:
    """
    Ensures the user has an active BASIC subscription if no other non-BASIC, non-protected subscription is active.
    It will try to activate an existing BASIC subscription first. If none exists, it creates one.
    """
    logger.debug(f"Ensuring BASIC subscription for user {user_id_obj}.")
    now = datetime.now(timezone.utc)  # 1. Check for any active non-BASIC subscription for the user (including protected ones)
    active_non_basic_sub = await db.subscriptions.find_one(
        {
            "user_id": user_id_obj,
            "is_active": True,
            "expiry_date": {"$gt": now},
            "license_key": {"$ne": BASIC_LICENSE_KEY},
        }
    )

    if active_non_basic_sub:
        logger.debug(
            f"User {user_id_obj} already has an active non-BASIC subscription (ID: {active_non_basic_sub['_id']}, Key: {active_non_basic_sub.get('license_key')}). "
            f"No need to activate/create BASIC."
        )
        # Ensure user.subscription_id points to this active non-BASIC sub if it's not already
        # This can happen if admin manually changes things or if there was an inconsistency.
        user_doc_check_for_non_basic = await db.users.find_one({"_id": user_id_obj})
        if user_doc_check_for_non_basic and user_doc_check_for_non_basic.get("subscription_id") != active_non_basic_sub["_id"]:
            await db.users.update_one(
                {"_id": user_id_obj}, {"$set": {"subscription_id": active_non_basic_sub["_id"], "updated_at": datetime.now(timezone.utc)}}
            )
            logger.info(f"Updated user {user_id_obj}'s primary subscription_id to active non-BASIC sub {active_non_basic_sub['_id']}")
        return SubscriptionInDB(
            **active_non_basic_sub
        )  # Return the active non-basic sub    # 2. User does not have an active non-BASIC subscription.
    #    Try to find and activate an existing BASIC subscription.
    logger.info(f"User {user_id_obj} has no active non-BASIC subscription. Checking for existing BASIC subscription.")
    existing_basic_sub = await get_basic_subscription_for_user(db, user_id_obj)

    if existing_basic_sub and existing_basic_sub.id:
        # Ensure expiry_date is timezone-aware for comparison
        expiry_date = existing_basic_sub.expiry_date
        if expiry_date and expiry_date.tzinfo is None:
            expiry_date = expiry_date.replace(tzinfo=timezone.utc)

        if existing_basic_sub.is_active and expiry_date and expiry_date > now:
            logger.info(
                f"User {user_id_obj} already has an active and valid BASIC subscription (ID: {existing_basic_sub.id}). Ensuring it's primary."
            )
            user_doc_check = await db.users.find_one({"_id": user_id_obj})
            if user_doc_check and user_doc_check.get("subscription_id") != ObjectId(existing_basic_sub.id):
                await db.users.update_one(
                    {"_id": user_id_obj},
                    {"$set": {"subscription_id": ObjectId(existing_basic_sub.id), "updated_at": datetime.now(timezone.utc)}},
                )
                logger.info(f"Updated user {user_id_obj}'s primary subscription_id to active BASIC sub {existing_basic_sub.id}")
            return existing_basic_sub
        else:
            logger.info(
                f"Found existing BASIC subscription (ID: {existing_basic_sub.id}) for user {user_id_obj}. Attempting to activate/renew it."
            )
            basic_license = await crud_licenses.get_license_by_key(db, BASIC_LICENSE_KEY)
            if not basic_license or not basic_license.id or not basic_license.is_active:
                logger.error(
                    f"Cannot activate BASIC subscription: License '{BASIC_LICENSE_KEY}' not found or inactive for user {user_id_obj}."
                )
                return None

            new_expiry = datetime.now(timezone.utc) + timedelta(
                days=basic_license.duration_days if basic_license.duration_days else 36500
            )  # Default 100 years

            try:
                # activate_specific_subscription_for_user for BASIC will deactivate other non-protected, non-BASIC subs.
                activated_sub = await activate_specific_subscription_for_user(
                    db, str(user_id_obj), str(existing_basic_sub.id), new_expiry_date=new_expiry
                )
                if activated_sub:
                    logger.info(
                        f"Successfully activated/renewed existing BASIC subscription (ID: {activated_sub.id}) for user {user_id_obj}."
                    )
                    return activated_sub
                else:
                    logger.error(
                        f"Failed to activate existing BASIC subscription (ID: {existing_basic_sub.id}) for user {user_id_obj}. This might lead to user having no active sub if creation also fails."
                    )
                    # Attempt to create a new one as a last resort if activation failed.
                    # This path should ideally not be hit if activate_specific_subscription_for_user is robust.
                    pass  # Fall through to creation logic
            except ValueError as ve:
                logger.error(
                    f"ValueError activating existing BASIC subscription for user {user_id_obj}: {ve}. Will attempt to create a new one."
                )
                pass  # Fall through to creation logic
            except Exception as e_act:
                logger.error(
                    f"Exception activating existing BASIC subscription for user {user_id_obj}: {e_act}. Will attempt to create a new one.",
                    exc_info=True,
                )
                pass  # Fall through to creation logic

    # 3. No existing BASIC subscription record found for the user, or activation of existing one failed. Create a new one.
    if existing_basic_sub:  # Log if we are here after a failed activation attempt
        logger.info(
            f"Attempting to create a new BASIC subscription for user {user_id_obj} after failed activation/renewal of existing one."
        )
    else:
        logger.info(f"User {user_id_obj} has no existing BASIC subscription record. Creating a new one.")

    user_doc = await db.users.find_one({"_id": user_id_obj})
    if not user_doc:
        logger.error(f"Cannot assign/create BASIC subscription: User {user_id_obj} not found.")
        return None

    # Re-fetch basic_license in case it wasn't fetched or to ensure it's up-to-date
    basic_license_for_creation = await crud_licenses.get_license_by_key(db, BASIC_LICENSE_KEY)
    if not basic_license_for_creation or not basic_license_for_creation.id:
        logger.error(f"Cannot create BASIC subscription: License with key '{BASIC_LICENSE_KEY}' not found for user {user_id_obj}.")
        return None
    if not basic_license_for_creation.is_active:
        logger.error(f"Cannot create BASIC subscription: License '{BASIC_LICENSE_KEY}' is not active for user {user_id_obj}.")
        return None

    free_sub_create_payload = SubscriptionCreate(
        user_id=str(user_id_obj),
        license_key=BASIC_LICENSE_KEY,
        duration_override_days=basic_license_for_creation.duration_days if basic_license_for_creation.duration_days else None,
    )
    try:
        created_free_sub = await create_subscription_db(db, free_sub_create_payload)
        if created_free_sub:
            logger.info(f"Successfully created and assigned new BASIC subscription (ID: {created_free_sub.id}) to user {user_id_obj}.")
            return created_free_sub
        else:
            logger.error(f"Failed to create new BASIC subscription for user {user_id_obj} using create_subscription_db.")
            return None
    except Exception as e_create:
        logger.error(f"Exception during new BASIC subscription creation for user {user_id_obj}: {e_create}", exc_info=True)
        return None


async def get_subscription_by_id_db(db: AsyncIOMotorDatabase, subscription_id_str: PyObjectId) -> Optional[SubscriptionInDB]:
    if not ObjectId.is_valid(subscription_id_str):
        return None
    sub_doc = await db.subscriptions.find_one({"_id": ObjectId(subscription_id_str)})
    if sub_doc:
        # Convert ObjectId fields to str before Pydantic validation if necessary
        if "user_id" in sub_doc and isinstance(sub_doc["user_id"], ObjectId):
            sub_doc["user_id"] = str(sub_doc["user_id"])
        if "license_id" in sub_doc and isinstance(sub_doc["license_id"], ObjectId):
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
        if "user_id" in sub_doc and isinstance(sub_doc["user_id"], ObjectId):
            sub_doc["user_id"] = str(sub_doc["user_id"])
        if "license_id" in sub_doc and isinstance(sub_doc["license_id"], ObjectId):
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
        if "user_id" in sub_doc and isinstance(sub_doc["user_id"], ObjectId):
            sub_doc["user_id"] = str(sub_doc["user_id"])
        if "license_id" in sub_doc and isinstance(sub_doc["license_id"], ObjectId):
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
        if "user_id" in sub_doc and isinstance(sub_doc["user_id"], ObjectId):
            sub_doc["user_id"] = str(sub_doc["user_id"])
        if "license_id" in sub_doc and isinstance(sub_doc["license_id"], ObjectId):
            sub_doc["license_id"] = str(sub_doc["license_id"])
        processed_subs.append(SubscriptionInDB(**sub_doc))
    return processed_subs


async def deactivate_all_active_subscriptions_for_user(
    db: AsyncIOMotorDatabase,
    user_id_obj: ObjectId,
    exclude_sub_id: Optional[ObjectId] = None,
    deactivate_basic_too: bool = False,  # New parameter
) -> int:
    query = {
        "user_id": user_id_obj,
        "is_active": True,
    }

    excluded_keys = list(PROTECTED_LICENSE_KEYS)  # Make a mutable copy
    if not deactivate_basic_too:
        excluded_keys.append(BASIC_LICENSE_KEY)

    if excluded_keys:  # Only add $nin if there are keys to exclude
        query["license_key"] = {"$nin": excluded_keys}
    # If deactivate_basic_too is True, excluded_keys might only contain PROTECTED_LICENSE_KEYS.
    # If PROTECTED_LICENSE_KEYS is empty and deactivate_basic_too is True,
    # then query["license_key"] will not be set here, meaning all license keys are targeted.
    # This is fine as we want to deactivate BASIC in that scenario.

    if exclude_sub_id:
        query["_id"] = {"$ne": exclude_sub_id}

    update_result = await db.subscriptions.update_many(
        query,
        {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc)}},
    )
    if update_result.modified_count > 0:
        logger.info(
            f"Deactivated {update_result.modified_count} other active subscription(s) for user {user_id_obj} "
            f"(deactivate_basic_too={deactivate_basic_too}, excluded_keys_for_nin_filter={excluded_keys if excluded_keys else 'None'})."
        )
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

    # If the new subscription is NOT BASIC, deactivate all other subscriptions, INCLUDING BASIC.
    if sub_create_data.license_key != BASIC_LICENSE_KEY:
        logger.info(
            f"Creating non-BASIC subscription ({sub_create_data.license_key}) for user {user_obj_id}. Deactivating other subscriptions, including BASIC if active."
        )
        await deactivate_all_active_subscriptions_for_user(db, user_obj_id, deactivate_basic_too=True)
    # If creating a BASIC subscription (e.g. by assign_free_subscription_if_needed or admin):
    # - We do NOT deactivate other subscriptions here.
    # - `assign_free_subscription_if_needed` ensures other non-BASIC are inactive before calling this.
    # - If an admin creates BASIC directly, it becomes active alongside any existing non-BASIC, non-protected one.
    #   Then, `assign_free_subscription_if_needed` (if called later, e.g. on next login/event) would sort it out,
    #   or the next non-BASIC sub creation/activation would deactivate this BASIC.
    #   This behavior is acceptable as direct admin creation of BASIC is a specific override.

    dt_now = datetime.now(timezone.utc)
    duration = sub_create_data.duration_override_days or license_template.duration_days

    start_date_for_new_sub = dt_now
    expiry_date = start_date_for_new_sub + timedelta(days=duration)

    sub_base_payload = SubscriptionBase(
        user_id=user_id_str_from_req,  # type: ignore
        user_email=user["email"],
        license_id=str(license_obj_id),  # type: ignore
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

    is_activating_basic = sub_to_activate_doc.get("license_key") == BASIC_LICENSE_KEY

    if is_activating_basic:
        logger.info(
            f"Activating BASIC subscription {subscription_id_to_activate_str} for user {user_obj_id}. Deactivating other non-protected, non-BASIC subscriptions."
        )  # Deactivate other active subscriptions, EXCLUDING other BASIC ones (though there shouldn't be multiple active BASIC)
        # and protected ones. The `deactivate_basic_too=False` (default) handles this.
        await deactivate_all_active_subscriptions_for_user(
            db,
            user_obj_id,
            exclude_sub_id=sub_to_activate_obj_id,
            deactivate_basic_too=False,  # Explicitly false
        )
    else:  # Activating a non-BASIC subscription
        logger.info(
            f"Activating non-BASIC subscription {subscription_id_to_activate_str} (key: {sub_to_activate_doc.get('license_key')}) for user {user_obj_id}. Deactivating other subscriptions, INCLUDING BASIC if active."
        )
        # Deactivate all other active subscriptions, INCLUDING BASIC.
        await deactivate_all_active_subscriptions_for_user(
            db,
            user_obj_id,
            exclude_sub_id=sub_to_activate_obj_id,
            deactivate_basic_too=True,  # Explicitly true
        )

    # Declare dt_now here so it's available for both branches
    dt_now = datetime.now(timezone.utc)
    update_fields = {"is_active": True, "updated_at": dt_now}
    if new_expiry_date:
        if new_expiry_date.tzinfo is None:
            new_expiry_date = new_expiry_date.replace(tzinfo=timezone.utc)
        update_fields["expiry_date"] = new_expiry_date
        # Khi admin set ngày hết hạn mới, start_date nên giữ nguyên hoặc set là now nếu sub đã hết hạn trước đó
        current_expiry_date = sub_to_activate_doc.get("expiry_date", dt_now)
        if current_expiry_date.tzinfo is None:
            current_expiry_date = current_expiry_date.replace(tzinfo=timezone.utc)
        if current_expiry_date < dt_now:
            update_fields["start_date"] = dt_now
        # else giữ nguyên start_date gốc

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
        logger.info(f"Subscription {subscription_id_str} was already inactive.")
        user_id_of_sub_obj = sub_before_update.get("user_id")
        if user_id_of_sub_obj and isinstance(user_id_of_sub_obj, ObjectId):
            logger.debug(
                f"Calling assign_free_subscription_if_needed for user {user_id_of_sub_obj} as sub {subscription_id_str} was already inactive."
            )
            await assign_free_subscription_if_needed(db, user_id_of_sub_obj)
        # Return the sub as is, Pydantic model will be formed by caller if needed
        # For consistency, let's fetch it properly.
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
            # Chỉ xóa user.subscription_id nếu sub đang hủy là sub chính của user
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
                logger.info(
                    f"Cleared subscription_id from user {str(user_id_of_sub_obj)} after deactivating main sub {subscription_id_str}."
                )

            logger.debug(
                f"Calling assign_free_subscription_if_needed for user {user_id_of_sub_obj} after deactivating sub {subscription_id_str}."
            )
            await assign_free_subscription_if_needed(db, user_id_of_sub_obj)
        return deactivated_sub
    else:  # No modification, but sub was found. Could be a concurrent update.
        logger.warning(
            f"Subscription {subscription_id_str} was found but not modified by updateOne during deactivation. Matched: {update_result.matched_count}"
        )
        # Still, ensure BASIC is handled if user context is available
        if user_id_of_sub_obj and isinstance(user_id_of_sub_obj, ObjectId):
            logger.debug(
                f"Calling assign_free_subscription_if_needed for user {user_id_of_sub_obj} even if sub {subscription_id_str} deactivation didn't modify doc (e.g. race condition or already inactive)."
            )
            await assign_free_subscription_if_needed(db, user_id_of_sub_obj)
        # Return the current state of the subscription
        return await get_subscription_by_id_db(db, subscription_id_str)

    # This part might be unreachable if the above always returns or raises.
    # logger.warning(f"Không thể hủy kích hoạt subscription {subscription_id_str} (có thể do lỗi hoặc không tìm thấy).")
    # return None # Should have returned based on sub_before_update or successful deactivation.


async def send_expiry_reminders_task(db: AsyncIOMotorDatabase, days_before_expiry: int = 7) -> int:
    now = datetime.now(timezone.utc)
    reminder_threshold_date = now + timedelta(days=days_before_expiry)

    query = {
        "is_active": True,
        "expiry_date": {"$gt": now, "$lte": reminder_threshold_date},
        "license_key": {"$nin": PROTECTED_LICENSE_KEYS + [BASIC_LICENSE_KEY]},
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
    query = {"is_active": True, "expiry_date": {"$lt": now}, "license_key": {"$nin": PROTECTED_LICENSE_KEYS + [BASIC_LICENSE_KEY]}}

    expired_subs_cursor = db.subscriptions.find(query)
    deactivated_count = 0

    async for sub_doc in expired_subs_cursor:
        sub_id_str = str(sub_doc["_id"])
        user_id_of_sub_obj = sub_doc.get("user_id")
        try:
            updated_sub = await deactivate_subscription_db(db, sub_id_str)
            if updated_sub and not updated_sub.is_active:
                logger.info(f"Cron Task: Deactivated expired subscription ID: {sub_id_str} for user ID: {user_id_of_sub_obj}")
                deactivated_count += 1
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


# <<<< PHẦN BỔ SUNG MỚI >>>>
async def get_all_subscriptions_admin(
    db: AsyncIOMotorDatabase,
    skip: int = 0,
    limit: int = 100,
    user_id_filter: Optional[PyObjectId] = None,
    license_key_filter: Optional[str] = None,
    is_active_filter: Optional[bool] = None,
) -> Tuple[List[SubscriptionInDB], int]:
    """
    Admin: Lấy danh sách tất cả subscriptions với filter và phân trang.
    """
    query = {}
    if user_id_filter and ObjectId.is_valid(user_id_filter):
        query["user_id"] = ObjectId(user_id_filter)
    if license_key_filter:
        query["license_key"] = license_key_filter.upper()
    if is_active_filter is not None:
        query["is_active"] = is_active_filter

    total_count = await db.subscriptions.count_documents(query)
    subs_cursor = db.subscriptions.find(query).sort("created_at", -1).skip(skip).limit(limit)
    subscriptions_docs = await subs_cursor.to_list(length=limit)

    results: List[SubscriptionInDB] = []
    for sub_doc in subscriptions_docs:
        # Chuyển đổi ObjectId sang str cho Pydantic model
        if "user_id" in sub_doc and isinstance(sub_doc["user_id"], ObjectId):
            sub_doc["user_id"] = str(sub_doc["user_id"])
        if "license_id" in sub_doc and isinstance(sub_doc["license_id"], ObjectId):
            sub_doc["license_id"] = str(sub_doc["license_id"])
        results.append(SubscriptionInDB(**sub_doc))

    return results, total_count


# <<<< KẾT THÚC PHẦN BỔ SUNG MỚI >>>>

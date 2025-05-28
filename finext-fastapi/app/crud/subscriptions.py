# finext-fastapi/app/crud/subscriptions.py
import logging
from typing import List, Optional
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timezone, timedelta

from app.schemas.subscriptions import (
    SubscriptionCreate,
    SubscriptionInDB,
    SubscriptionBase,
)
from app.utils.types import PyObjectId
import app.crud.licenses as crud_licenses
from app.core.config import PROTECTED_LICENSE_KEYS

logger = logging.getLogger(__name__)


async def get_subscription_by_id_db(
    db: AsyncIOMotorDatabase, subscription_id_str: PyObjectId
) -> Optional[SubscriptionInDB]:
    if not ObjectId.is_valid(subscription_id_str):
        return None
    sub_doc = await db.subscriptions.find_one({"_id": ObjectId(subscription_id_str)})
    if sub_doc:
        sub_doc["user_id"] = str(sub_doc["user_id"])
        sub_doc["license_id"] = str(sub_doc["license_id"])
        return SubscriptionInDB(**sub_doc)
    return None


async def get_active_subscription_for_user_db(
    db: AsyncIOMotorDatabase, user_id_str: PyObjectId
) -> Optional[SubscriptionInDB]:
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


async def find_inactive_partner_subscription_for_user(
    db: AsyncIOMotorDatabase, user_id_str: PyObjectId
) -> Optional[SubscriptionInDB]:
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
    subs_cursor = (
        db.subscriptions.find({"user_id": ObjectId(user_id_str)})
        .skip(skip)
        .limit(limit)
        .sort("created_at", -1)
    )
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
        "license_key": {"$nin": PROTECTED_LICENSE_KEYS},
    }
    if exclude_sub_id:
        query["_id"] = {"$ne": exclude_sub_id}

    update_result = await db.subscriptions.update_many(
        query,
        {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc)}},
    )
    return update_result.modified_count


async def create_subscription_db(
    db: AsyncIOMotorDatabase, sub_create_data: SubscriptionCreate
) -> Optional[SubscriptionInDB]:
    user_id_str_from_req = str(sub_create_data.user_id)
    if not ObjectId.is_valid(user_id_str_from_req):
        logger.error(
            f"User ID không hợp lệ khi tạo subscription: {user_id_str_from_req}"
        )
        return None

    user_obj_id = ObjectId(user_id_str_from_req)
    user = await db.users.find_one({"_id": user_obj_id})
    if not user:
        logger.error(
            f"User {user_id_str_from_req} not found for subscription creation."
        )
        return None

    license_template = await crud_licenses.get_license_by_key(
        db, sub_create_data.license_key
    )
    if not license_template or not license_template.id:
        logger.error(f"License key '{sub_create_data.license_key}' not found.")
        return None

    # THÊM KIỂM TRA: License phải active để tạo subscription mới
    if not license_template.is_active:
        logger.error(
            f"Cannot create subscription for user {user_id_str_from_req} with inactive license key '{sub_create_data.license_key}'."
        )
        raise ValueError(
            f"License '{sub_create_data.license_key}' is not active and cannot be used to create new subscriptions."
        )

    license_obj_id = ObjectId(license_template.id)

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
        logger.error(
            f"Error creating subscription for {user['email']}: {e}", exc_info=True
        )
        return None


async def activate_specific_subscription_for_user(
    db: AsyncIOMotorDatabase,
    user_id_str: PyObjectId,
    subscription_id_to_activate_str: PyObjectId,
    new_expiry_date: Optional[datetime] = None,
) -> Optional[SubscriptionInDB]:
    if not ObjectId.is_valid(user_id_str) or not ObjectId.is_valid(
        subscription_id_to_activate_str
    ):
        logger.error("User ID hoặc Subscription ID không hợp lệ để kích hoạt.")
        return None

    user_obj_id = ObjectId(user_id_str)
    sub_to_activate_obj_id = ObjectId(subscription_id_to_activate_str)

    sub_to_activate_doc = await db.subscriptions.find_one(
        {"_id": sub_to_activate_obj_id, "user_id": user_obj_id}
    )
    if not sub_to_activate_doc:
        logger.warning(
            f"Subscription {subscription_id_to_activate_str} không tìm thấy hoặc không thuộc user {user_id_str}."
        )
        return None

    # --- THÊM KIỂM TRA LICENSE ---
    license_id_of_sub = sub_to_activate_doc.get("license_id")
    if not license_id_of_sub or not ObjectId.is_valid(str(license_id_of_sub)):
        logger.error(
            f"Subscription {subscription_id_to_activate_str} has invalid license_id {license_id_of_sub}."
        )
        raise ValueError("Không thể kích hoạt subscription do lỗi dữ liệu license.")

    license_doc = await crud_licenses.get_license_by_id(db, str(license_id_of_sub))
    if not license_doc:
        logger.error(
            f"License (ID: {license_id_of_sub}) associated with subscription {subscription_id_to_activate_str} not found."
        )
        raise ValueError("License gốc của subscription này không còn tồn tại.")

    if not license_doc.is_active:
        logger.warning(
            f"Cannot activate subscription {subscription_id_to_activate_str} because its license '{license_doc.key}' (ID: {license_doc.id}) is inactive."
        )
        raise ValueError(
            f"Không thể kích hoạt subscription vì gói license '{license_doc.key}' liên kết với nó hiện không hoạt động."
        )
    # --- KẾT THÚC KIỂM TRA LICENSE ---

    await deactivate_all_active_subscriptions_for_user(
        db, user_obj_id, exclude_sub_id=sub_to_activate_obj_id
    )

    dt_now = datetime.now(timezone.utc)
    update_fields = {"is_active": True, "updated_at": dt_now}
    if new_expiry_date:
        if new_expiry_date.tzinfo is None:
            new_expiry_date = new_expiry_date.replace(tzinfo=timezone.utc)
        update_fields["expiry_date"] = new_expiry_date
        update_fields["start_date"] = dt_now

    update_result = await db.subscriptions.update_one(
        {"_id": sub_to_activate_obj_id, "user_id": user_obj_id}, {"$set": update_fields}
    )

    if update_result.modified_count > 0 or update_result.matched_count > 0:
        await db.users.update_one(
            {"_id": user_obj_id},
            {"$set": {"subscription_id": sub_to_activate_obj_id, "updated_at": dt_now}},
        )
        logger.info(
            f"Đã kích hoạt subscription {subscription_id_to_activate_str} và cập nhật cho user {user_id_str}."
        )
        return await get_subscription_by_id_db(db, subscription_id_to_activate_str)

    logger.warning(
        f"Không thể kích hoạt subscription {subscription_id_to_activate_str} cho user {user_id_str}."
    )
    return None


async def deactivate_subscription_db(
    db: AsyncIOMotorDatabase,
    subscription_id_str: PyObjectId,
    assign_free_if_none_active: bool = False,
) -> Optional[SubscriptionInDB]:
    if not ObjectId.is_valid(subscription_id_str):
        logger.warning(
            f"Subscription ID không hợp lệ để hủy kích hoạt: {subscription_id_str}"
        )
        return None

    sub_obj_id = ObjectId(subscription_id_str)
    sub_before_update = await db.subscriptions.find_one({"_id": sub_obj_id})
    if not sub_before_update:
        logger.warning(
            f"Không tìm thấy subscription với ID {subscription_id_str} để hủy kích hoạt."
        )
        return None

    if sub_before_update.get("license_key") in PROTECTED_LICENSE_KEYS:
        logger.warning(
            f"Attempt to deactivate protected subscription {subscription_id_str} (License: {sub_before_update.get('license_key')}). Denied."
        )
        raise ValueError(
            f"Cannot deactivate protected subscription with license '{sub_before_update.get('license_key')}'."
        )

    if not sub_before_update.get("is_active", False):
        logger.info(f"Subscription {subscription_id_str} đã ở trạng thái inactive.")
        return await get_subscription_by_id_db(db, subscription_id_str)

    update_result = await db.subscriptions.update_one(
        {"_id": sub_obj_id},
        {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc)}},
    )

    deactivated_sub: Optional[SubscriptionInDB] = None
    if update_result.modified_count > 0:
        deactivated_sub = await get_subscription_by_id_db(db, subscription_id_str)
        user_obj_id_of_sub = sub_before_update.get("user_id")

        if user_obj_id_of_sub and isinstance(user_obj_id_of_sub, ObjectId):
            user = await db.users.find_one({"_id": user_obj_id_of_sub})
            if user and user.get("subscription_id") == sub_obj_id:
                await db.users.update_one(
                    {"_id": user_obj_id_of_sub},
                    {
                        "$set": {
                            "subscription_id": None,
                            "updated_at": datetime.now(timezone.utc),
                        }
                    },
                )
                logger.info(
                    f"Đã xóa subscription_id khỏi user {str(user_obj_id_of_sub)} sau khi hủy sub {subscription_id_str}."
                )

        return deactivated_sub

    logger.warning(
        f"Không thể hủy kích hoạt subscription {subscription_id_str} (có thể do lỗi hoặc không tìm thấy)."
    )
    return None

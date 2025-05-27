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

logger = logging.getLogger(__name__)


async def get_subscription_by_id_db(
    db: AsyncIOMotorDatabase, subscription_id_str: PyObjectId
) -> Optional[SubscriptionInDB]:
    if not ObjectId.is_valid(subscription_id_str):
        return None
    sub_doc = await db.subscriptions.find_one({"_id": ObjectId(subscription_id_str)})
    if sub_doc:
        # Chuyển đổi các trường ObjectId sang str cho Pydantic model
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
    db: AsyncIOMotorDatabase, user_id_obj: ObjectId
) -> int:
    # user_id_obj đã là ObjectId
    update_result = await db.subscriptions.update_many(
        {"user_id": user_id_obj, "is_active": True},
        {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc)}},
    )
    return update_result.modified_count


async def create_subscription_db(
    db: AsyncIOMotorDatabase, sub_create_data: SubscriptionCreate
) -> Optional[SubscriptionInDB]:
    user_id_str_from_req = str(sub_create_data.user_id)  # Đây là PyObjectId (str)
    if not ObjectId.is_valid(user_id_str_from_req):
        logger.error(f"User ID không hợp lệ: {user_id_str_from_req}")
        return None

    user_obj_id = ObjectId(user_id_str_from_req)
    user = await db.users.find_one({"_id": user_obj_id})  # Lấy trực tiếp từ DB users
    if not user:
        logger.error(
            f"User {user_id_str_from_req} not found for subscription creation."
        )
        return None

    license_template = await crud_licenses.get_license_by_key(
        db, sub_create_data.license_key
    )
    if not license_template:  # license_template là LicenseInDB, ID của nó là str
        logger.error(f"License key '{sub_create_data.license_key}' not found.")
        return None

    license_obj_id = ObjectId(
        license_template.id
    )  # Chuyển ID của license thành ObjectId

    await deactivate_all_active_subscriptions_for_user(db, user_obj_id)

    now = datetime.now(timezone.utc)
    start_date = sub_create_data.start_date_override or now
    duration = sub_create_data.duration_override_days or license_template.duration_days
    expiry_date = start_date + timedelta(days=duration)

    dt_now = datetime.now(timezone.utc)
    # Tạo payload cho SubscriptionBase, các ID ở đây là str (PyObjectId)
    sub_base_payload = SubscriptionBase(
        user_id=user_id_str_from_req,  # PyObjectId (str)
        user_email=user["email"],  # Lấy email từ user document
        license_id=str(license_obj_id),  # PyObjectId (str)
        license_key=license_template.key,
        is_active=True,
        start_date=start_date,
        expiry_date=expiry_date,
    )

    sub_doc_to_insert = {
        **sub_base_payload.model_dump(),
        "created_at": dt_now,
        "updated_at": dt_now,
    }
    # Chuyển đổi ID sang ObjectId TRƯỚC KHI INSERT
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
            # get_subscription_by_id_db sẽ xử lý chuyển đổi ID sang str cho Pydantic
            return await get_subscription_by_id_db(db, str(insert_result.inserted_id))
        logger.error(f"Failed to create subscription for user: {user['email']}")
        return None
    except Exception as e:
        logger.error(
            f"Error creating subscription for {user['email']}: {e}", exc_info=True
        )
        return None


async def deactivate_subscription_db(
    db: AsyncIOMotorDatabase, subscription_id_str: PyObjectId
) -> Optional[SubscriptionInDB]:
    if not ObjectId.is_valid(subscription_id_str):
        return None

    sub_obj_id = ObjectId(subscription_id_str)
    sub_before_update = await db.subscriptions.find_one(
        {"_id": sub_obj_id}
    )  # Lấy sub trước khi update
    if not sub_before_update:
        return None

    update_result = await db.subscriptions.update_one(
        {"_id": sub_obj_id},
        {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc)}},
    )

    if update_result.modified_count > 0:
        user_obj_id_of_sub = sub_before_update.get("user_id")  # Đây là ObjectId
        if user_obj_id_of_sub:
            user = await db.users.find_one({"_id": user_obj_id_of_sub})
            if user and user.get("subscription_id") == sub_obj_id:  # So sánh ObjectId
                await db.users.update_one(
                    {"_id": user_obj_id_of_sub},
                    {
                        "$set": {
                            "subscription_id": None,
                            "updated_at": datetime.now(timezone.utc),
                        }
                    },
                )
        return await get_subscription_by_id_db(db, subscription_id_str)
    return None  # Trả về None nếu không có gì được cập nhật

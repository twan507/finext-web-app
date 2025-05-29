# finext-fastapi/app/crud/subscriptions.py
import logging
from typing import List, Optional
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timezone, timedelta
from app.utils.email_utils import send_subscription_expiry_reminder_email # IMPORT MỚI

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

async def send_expiry_reminders_task(db: AsyncIOMotorDatabase, days_before_expiry: int = 7) -> int:
    """
    Tìm các subscriptions sắp hết hạn (trong vòng `days_before_expiry` ngày tới)
    và gửi email nhắc nhở.
    """
    now = datetime.now(timezone.utc)
    reminder_threshold_date = now + timedelta(days=days_before_expiry)
    
    query = {
        "is_active": True,
        "expiry_date": {
            "$gt": now,  # Vẫn còn hạn
            "$lte": reminder_threshold_date # Sắp hết hạn trong khoảng thời gian đặt trước
        },
        "license_key": {"$nin": PROTECTED_LICENSE_KEYS} # Không gửi nhắc nhở cho các gói bảo vệ
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
            
            # Tính số ngày còn lại một cách chính xác hơn
            # (expiry_date_dt - now).days có thể làm tròn xuống nếu chưa đủ 24h
            time_left = expiry_date_dt - now
            days_left_exact = time_left.days
            if time_left.total_seconds() > 0 and days_left_exact == 0: # Nếu còn vài tiếng trong ngày cuối
                 days_left_exact = 1 # Coi như còn 1 ngày
            elif time_left.total_seconds() <= 0: # Đã hết hạn (không nên xảy ra do query)
                 days_left_exact = 0
            
            if days_left_exact <= 0 : # Kiểm tra lại để chắc chắn không gửi email cho sub đã hết hạn
                logger.info(f"Subscription {sub_doc['_id']} for user {user_email} seems already expired or expiring today. Days left: {days_left_exact}. Skipping reminder.")
                continue

            # Gửi email
            # Cân nhắc thêm một trường trong `subscriptions` để đánh dấu đã gửi email nhắc nhở cho ngày đó/tuần đó
            # để tránh gửi nhiều lần nếu job chạy lại do lỗi.
            # Ví dụ: last_reminder_sent_at: datetime

            email_successful = await send_subscription_expiry_reminder_email(
                email_to=user_email,
                full_name=user_full_name,
                license_name=license_name,
                license_key=license_key,
                expiry_date=expiry_date_dt,
                days_left=days_left_exact
            )
            if email_successful:
                email_sent_count += 1
                # (Tùy chọn) Cập nhật sub_doc.last_reminder_sent_at = now
        except Exception as e:
            logger.error(f"Error processing reminder for subscription {sub_doc.get('_id')}: {e}", exc_info=True)
            
    if email_sent_count > 0:
        logger.info(f"Cron Task: Successfully sent {email_sent_count} subscription expiry reminders.")
    else:
        logger.info("Cron Task: No subscriptions found needing an expiry reminder today.")
    return email_sent_count

async def run_deactivate_expired_subscriptions_task(db: AsyncIOMotorDatabase) -> int:
    """
    Tìm và gọi hàm deactivate_subscription_db cho tất cả các subscription
    đã hết hạn và vẫn đang active (trừ các license được bảo vệ).
    """
    now = datetime.now(timezone.utc)
    query = {
        "is_active": True,
        "expiry_date": {"$lt": now},
        "license_key": {"$nin": PROTECTED_LICENSE_KEYS} # Loại trừ các license được bảo vệ
    }
    
    expired_subs_cursor = db.subscriptions.find(query)
    deactivated_count = 0
    
    async for sub_doc in expired_subs_cursor:
        sub_id_str = str(sub_doc["_id"])
        try:
            # Gọi hàm deactivate_subscription_db hiện có của bạn
            # assign_free_if_none_active có thể là False hoặc True tùy theo logic bạn muốn khi cron job chạy
            updated_sub = await deactivate_subscription_db(db, sub_id_str, assign_free_if_none_active=False)
            if updated_sub and not updated_sub.is_active:
                logger.info(f"Cron Task: Deactivated expired subscription ID: {sub_id_str} for user ID: {sub_doc.get('user_id')}")
                deactivated_count += 1
                
                # Logic cập nhật user.subscription_id nếu cần (tương tự như trong hàm cũ bạn đã có)
                user_id_of_sub = sub_doc.get("user_id")
                if user_id_of_sub and isinstance(user_id_of_sub, ObjectId):
                    user_doc_check = await db.users.find_one({"_id": user_id_of_sub, "subscription_id": sub_doc["_id"]})
                    if user_doc_check:
                        await db.users.update_one(
                            {"_id": user_id_of_sub},
                            {"$set": {"subscription_id": None, "updated_at": now}}
                        )
                        logger.info(f"Cron Task: Cleared subscription_id for user {user_id_of_sub} as their active sub {sub_id_str} expired.")
            elif updated_sub and updated_sub.is_active:
                # Trường hợp này không nên xảy ra nếu logic của deactivate_subscription_db là đúng
                logger.warning(f"Cron Task: Attempted to deactivate {sub_id_str}, but it remained active.")
        except ValueError as ve: # Bắt lỗi từ deactivate_subscription_db (ví dụ: cố gắng hủy sub được bảo vệ)
            logger.warning(f"Cron Task: Skipped deactivating subscription {sub_id_str} due to: {ve}")
        except Exception as e:
            logger.error(f"Cron Task: Error deactivating subscription {sub_id_str}: {e}", exc_info=True)
            
    if deactivated_count > 0:
        logger.info(f"Cron Task: Finished deactivating {deactivated_count} expired subscriptions.")
    else:
        logger.info("Cron Task: No active and expired subscriptions found to deactivate (excluding protected ones).")
    return deactivated_count
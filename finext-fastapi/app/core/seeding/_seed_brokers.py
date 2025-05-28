# finext-fastapi/app/core/seeding/_seed_brokers.py
import logging
from typing import Dict, Optional, List
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId
from datetime import datetime, timezone

from app.utils.types import PyObjectId
from app.core.config import BROKER_EMAIL_1, BROKER_EMAIL_2 # Sử dụng các broker email mới
import app.crud.brokers as crud_brokers

logger = logging.getLogger(__name__)


async def seed_brokers(
    db: AsyncIOMotorDatabase, user_ids_map: Dict[str, PyObjectId]
) -> Optional[Dict[str, Dict[str, str]]]: # Sửa type hint để rõ ràng hơn
    created_broker_info_map: Dict[
        str, Dict[str, str]
    ] = {}  # email -> {"broker_id": id, "broker_code": code}
    users_collection = db.get_collection("users")

    broker_emails_to_seed: List[Optional[str]] = [BROKER_EMAIL_1, BROKER_EMAIL_2]
    
    any_broker_seeded = False

    for broker_email_val in broker_emails_to_seed:
        if not broker_email_val:
            logger.info("Một trong các BROKER_EMAIL không được cấu hình. Bỏ qua seeding cho email đó.")
            continue

        broker_user_id_str = user_ids_map.get(broker_email_val)
        if not broker_user_id_str:
            logger.warning(
                f"Không tìm thấy User ID cho BROKER_EMAIL ('{broker_email_val}') trong user_ids_map. Không thể seed broker."
            )
            continue

        if not ObjectId.is_valid(broker_user_id_str):
            logger.error(
                f"User ID '{broker_user_id_str}' cho BROKER_EMAIL '{broker_email_val}' không hợp lệ. Không thể seed broker."
            )
            continue

        existing_broker = await crud_brokers.get_broker_by_user_id(db, broker_user_id_str) # type: ignore
        if existing_broker:
            logger.info(
                f"User '{broker_email_val}' (ID: {broker_user_id_str}) đã là một Đối tác (Broker code: {existing_broker.broker_code}). Không cần seed broker mới."
            )
            user_doc = await users_collection.find_one(
                {"_id": ObjectId(broker_user_id_str)}
            )
            if user_doc and user_doc.get("referral_code") != existing_broker.broker_code:
                await users_collection.update_one(
                    {"_id": ObjectId(broker_user_id_str)},
                    {
                        "$set": {
                            "referral_code": existing_broker.broker_code,
                            "updated_at": datetime.now(timezone.utc),
                        }
                    },
                )
                logger.info(
                    f"Đã cập nhật referral_code cho user BROKER '{broker_email_val}' thành '{existing_broker.broker_code}'."
                )

            if hasattr(existing_broker, "id") and existing_broker.id:
                created_broker_info_map[broker_email_val] = {
                    "broker_id": str(existing_broker.id),
                    "broker_code": existing_broker.broker_code,
                }
            any_broker_seeded = True
            continue

        logger.info(
            f"User '{broker_email_val}' (ID: {broker_user_id_str}) chưa phải là Đối tác. Tiến hành tạo bản ghi broker..."
        )
        try:
            new_broker_record = await crud_brokers.create_or_reactivate_broker_for_user(
                db, user_id=broker_user_id_str # type: ignore
            )
            if new_broker_record and new_broker_record.id and new_broker_record.broker_code:
                logger.info(
                    f"Đã tạo thành công bản ghi Broker cho user '{broker_email_val}' với broker_code: {new_broker_record.broker_code} và ID: {new_broker_record.id}"
                )
                created_broker_info_map[broker_email_val] = {
                    "broker_id": str(new_broker_record.id),
                    "broker_code": new_broker_record.broker_code,
                }
                any_broker_seeded = True
                await users_collection.update_one(
                    {"_id": ObjectId(broker_user_id_str)},
                    {
                        "$set": {
                            "referral_code": new_broker_record.broker_code,
                            "updated_at": datetime.now(timezone.utc),
                        }
                    },
                )
                logger.info(
                    f"Đã gán referral_code '{new_broker_record.broker_code}' cho chính user BROKER '{broker_email_val}'."
                )
            else:
                logger.error(
                    f"Không thể tạo bản ghi Broker cho user '{broker_email_val}' (ID: {broker_user_id_str})."
                )

        except ValueError as ve:
            logger.error(f"Lỗi khi tạo broker cho {broker_email_val}: {ve}")
        except Exception as e:
            logger.error(
                f"Lỗi không mong muốn khi seeding broker cho {broker_email_val}: {e}",
                exc_info=True,
            )

    if any_broker_seeded:
        return created_broker_info_map
    return None
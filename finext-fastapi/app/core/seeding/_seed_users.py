# finext-fastapi/app/core/seeding/_seed_users.py
import logging
from typing import Dict, Optional

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.schemas.users import UserSeed
from app.utils.security import get_password_hash
from app.utils.types import PyObjectId
from app.core.config import (
    ADMIN_EMAIL, ADMIN_PWD,
    BROKER_EMAIL_1, BROKER_EMAIL_2,
    USER_EMAIL_1, USER_EMAIL_2, USER_EMAIL_3
)

logger = logging.getLogger(__name__)


async def seed_users(
    db: AsyncIOMotorDatabase, role_ids_map: Optional[Dict[str, PyObjectId]]
) -> Dict[str, PyObjectId]:
    created_user_ids: Dict[str, PyObjectId] = {}
    if not role_ids_map:
        logger.warning("role_ids_map không tồn tại. Bỏ qua việc tạo sample users.")
        return created_user_ids

    users_collection = db.get_collection("users")

    admin_role_id_str = role_ids_map.get("admin")
    broker_role_id_str = role_ids_map.get("broker")
    user_role_id_str = role_ids_map.get("user")

    sample_users_data_dicts = []

    # 1 Admin User
    if ADMIN_EMAIL and ADMIN_PWD and admin_role_id_str:
        sample_users_data_dicts.append(
            {
                "email": ADMIN_EMAIL,
                "password": ADMIN_PWD,
                "full_name": "System Administrator",
                "phone_number": "0000000000",
                "role_ids_str": list([admin_role_id_str, broker_role_id_str, user_role_id_str]),
                "is_active": True,
            }
        )

    # 2 Broker Users
    broker_emails_to_seed = [BROKER_EMAIL_1, BROKER_EMAIL_2]
    for i, broker_email_val in enumerate(broker_emails_to_seed):
        if broker_email_val and ADMIN_PWD and broker_role_id_str and user_role_id_str:
            sample_users_data_dicts.append(
                {
                    "email": broker_email_val,
                    "password": ADMIN_PWD,
                    "full_name": f"Default Broker {i+1}",
                    "phone_number": f"011111111{i+1}",
                    "role_ids_str": list(set([broker_role_id_str, user_role_id_str])), # Broker cũng là user
                    "is_active": True,
                }
            )

    # 3 Standard Users
    user_emails_to_seed = [USER_EMAIL_1, USER_EMAIL_2, USER_EMAIL_3]
    for i, user_email_val in enumerate(user_emails_to_seed):
        if user_email_val and ADMIN_PWD and user_role_id_str:
            sample_users_data_dicts.append(
                {
                    "email": user_email_val,
                    "password": ADMIN_PWD,
                    "full_name": f"Default User {i+1}",
                    "phone_number": f"099999999{i+1}",
                    "role_ids_str": [user_role_id_str],
                    "is_active": True,
                }
            )

    for user_data_dict in sample_users_data_dicts:
        if not user_data_dict.get("email"): # Bỏ qua nếu email không được cấu hình
            logger.warning(f"Bỏ qua seeding user vì email không được cung cấp trong user_data_dict: {user_data_dict.get('full_name')}")
            continue

        existing_user = await users_collection.find_one(
            {"email": user_data_dict["email"]}
        )
        if existing_user is None:
            user_create_instance = UserSeed(
                email=user_data_dict["email"],
                full_name=user_data_dict["full_name"],
                phone_number=user_data_dict["phone_number"],
                password=user_data_dict["password"],
                is_active=user_data_dict["is_active"],
                role_ids=user_data_dict["role_ids_str"],
                subscription_id=None,
            )

            user_document_for_db = user_create_instance.model_dump(
                exclude={"password", "role_ids"}
            )
            user_document_for_db["hashed_password"] = get_password_hash(
                user_create_instance.password
            )
            user_document_for_db["created_at"] = user_create_instance.created_at
            user_document_for_db["updated_at"] = user_create_instance.updated_at

            role_obj_ids_for_db = []
            if user_create_instance.role_ids:
                for r_id_str in user_create_instance.role_ids:
                    if ObjectId.is_valid(r_id_str):
                        role_obj_ids_for_db.append(ObjectId(r_id_str))
            user_document_for_db["role_ids"] = role_obj_ids_for_db

            result = await users_collection.insert_one(user_document_for_db)
            logger.info(
                f"Đã tạo user: {user_data_dict['email']} với ID: {result.inserted_id}"
            )
            created_user_ids[user_data_dict["email"]] = str(result.inserted_id)
        else:
            logger.info(f"User '{user_data_dict['email']}' đã tồn tại.")
            created_user_ids[user_data_dict["email"]] = str(existing_user["_id"])
    return created_user_ids
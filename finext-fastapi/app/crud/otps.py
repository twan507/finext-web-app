# finext-fastapi/app/crud/otps.py
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.schemas.otps import OtpInDB, OtpTypeEnum, OtpCreateInternal
from app.utils.otp_utils import hash_otp_code, verify_otp_code
from app.core.config import OTP_EXPIRE_MINUTES
from app.utils.types import PyObjectId

logger = logging.getLogger(__name__)


async def create_otp_record(db: AsyncIOMotorDatabase, otp_data: OtpCreateInternal) -> Optional[OtpInDB]:
    """
    Creates and stores a new OTP record in the database.
    The otp_data.otp_code should be the raw OTP. It will be hashed here.
    """
    if not ObjectId.is_valid(otp_data.user_id):
        logger.error(f"Invalid user_id format for OTP creation: {otp_data.user_id}")
        return None

    hashed_code = hash_otp_code(otp_data.otp_code)
    expires_at_val = datetime.now(timezone.utc) + timedelta(minutes=OTP_EXPIRE_MINUTES)

    otp_doc_to_insert = {
        "user_id": ObjectId(otp_data.user_id),
        "hashed_otp_code": hashed_code,
        "otp_type": otp_data.otp_type.value,
        "expires_at": expires_at_val,
        "verified_at": None,
        "created_at": otp_data.created_at,
    }

    try:
        # Invalidate previous active OTPs of the same type for this user
        await db.otps.update_many(
            {
                "user_id": ObjectId(otp_data.user_id),
                "otp_type": otp_data.otp_type.value,
                "verified_at": None,
                "expires_at": {"$gt": datetime.now(timezone.utc)},
            },
            {"$set": {"expires_at": datetime.now(timezone.utc) - timedelta(seconds=1)}},  # Expire them immediately
        )
        logger.info(f"Invalidated previous active OTPs for user {otp_data.user_id}, type {otp_data.otp_type.value}")

        insert_result = await db.otps.insert_one(otp_doc_to_insert)
        if insert_result.inserted_id:
            created_otp_doc = await db.otps.find_one({"_id": insert_result.inserted_id})
            if created_otp_doc:
                return OtpInDB(**created_otp_doc)
        logger.error(f"Failed to create OTP record for user_id: {otp_data.user_id}")
        return None
    except Exception as e:
        logger.error(f"Error creating OTP for user {otp_data.user_id}: {e}", exc_info=True)
        return None


async def find_valid_otp(db: AsyncIOMotorDatabase, user_id: PyObjectId, otp_type: OtpTypeEnum) -> Optional[OtpInDB]:
    """
    Finds the latest, non-expired, non-used OTP for a user and type.
    """
    if not ObjectId.is_valid(user_id):
        return None

    now = datetime.now(timezone.utc)
    otp_doc = await db.otps.find_one(
        {"user_id": ObjectId(user_id), "otp_type": otp_type.value, "verified_at": None, "expires_at": {"$gt": now}},
        sort=[("created_at", -1)],  # Get the most recent one
    )
    if otp_doc:
        return OtpInDB(**otp_doc)
    return None


async def verify_and_use_otp(db: AsyncIOMotorDatabase, user_id: PyObjectId, otp_type: OtpTypeEnum, plain_otp_code: str) -> bool:
    """
    Verifies the OTP and marks it as used if valid.
    """
    valid_otp_record = await find_valid_otp(db, user_id, otp_type)
    if not valid_otp_record:
        logger.warning(f"No valid OTP found for user {user_id}, type {otp_type.value} for verification.")
        return False

    if verify_otp_code(plain_otp_code, valid_otp_record.hashed_otp_code):
        # Mark OTP as used
        update_result = await db.otps.update_one(
            {"_id": ObjectId(valid_otp_record.id)}, {"$set": {"verified_at": datetime.now(timezone.utc)}}
        )
        if update_result.modified_count > 0:
            logger.info(f"OTP {valid_otp_record.id} for user {user_id}, type {otp_type.value} verified and marked as used.")
            return True
        else:
            logger.error(f"Failed to mark OTP {valid_otp_record.id} as used for user {user_id}, type {otp_type.value}.")
            return False
    else:
        logger.warning(f"OTP verification failed for user {user_id}, type {otp_type.value}. Incorrect code.")
        # Here you might want to implement attempt tracking if MAX_OTP_ATTEMPTS is used
        return False


async def delete_otp_record(db: AsyncIOMotorDatabase, otp_id: PyObjectId) -> bool:
    """Deletes an OTP record by its ID."""
    if not ObjectId.is_valid(otp_id):
        return False
    delete_result = await db.otps.delete_one({"_id": ObjectId(otp_id)})
    return delete_result.deleted_count > 0


async def delete_all_otps_for_user_by_type(db: AsyncIOMotorDatabase, user_id: PyObjectId, otp_type: OtpTypeEnum) -> int:
    """Deletes all OTPs (used or unused, expired or not) for a specific user and type."""
    if not ObjectId.is_valid(user_id):
        return 0
    delete_result = await db.otps.delete_many({"user_id": ObjectId(user_id), "otp_type": otp_type.value})
    return delete_result.deleted_count

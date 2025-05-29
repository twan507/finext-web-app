# finext-fastapi/app/crud/otps.py
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.schemas.otps import OtpInDB, OtpTypeEnum, OtpCreateInternal
from app.utils.otp_utils import hash_otp_code, verify_otp_code
from app.core.config import OTP_EXPIRE_MINUTES, MAX_OTP_ATTEMPTS # Thêm MAX_OTP_ATTEMPTS
from app.utils.types import PyObjectId

logger = logging.getLogger(__name__)


async def create_otp_record(db: AsyncIOMotorDatabase, otp_data: OtpCreateInternal) -> Optional[OtpInDB]:
    if not ObjectId.is_valid(otp_data.user_id):
        logger.error(f"Invalid user_id format for OTP creation: {otp_data.user_id}")
        return None

    hashed_code = hash_otp_code(otp_data.otp_code)
    # expires_at sẽ được tính toán lại và ghi đè trong OtpCreateInternal nếu cần
    # Hoặc bạn có thể tính toán lại ở đây nếu muốn đảm bảo
    expires_at_val = datetime.now(timezone.utc) + timedelta(minutes=OTP_EXPIRE_MINUTES)

    otp_doc_to_insert = {
        "user_id": ObjectId(otp_data.user_id),
        "hashed_otp_code": hashed_code,
        "otp_type": otp_data.otp_type.value, # Lưu trữ giá trị của enum
        "expires_at": expires_at_val, # Ghi đè expires_at với giá trị mới
        "verified_at": None,
        "created_at": otp_data.created_at, # Giữ nguyên created_at từ payload
        "attempts": 0 # Khởi tạo attempts là 0
    }

    try:
        # Vô hiệu hóa các OTP cũ cùng loại chưa được xác thực và chưa hết hạn
        await db.otps.update_many(
            {
                "user_id": ObjectId(otp_data.user_id),
                "otp_type": otp_data.otp_type.value,
                "verified_at": None,
                "expires_at": {"$gt": datetime.now(timezone.utc)},
            },
            {"$set": {"expires_at": datetime.now(timezone.utc) - timedelta(seconds=1)}},
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
    Finds the latest, non-expired, non-used OTP for a user and type,
    and hasn't reached max attempts.
    """
    if not ObjectId.is_valid(user_id):
        return None

    now = datetime.now(timezone.utc)
    otp_doc = await db.otps.find_one(
        {
            "user_id": ObjectId(user_id),
            "otp_type": otp_type.value, # So sánh giá trị của enum
            "verified_at": None,
            "expires_at": {"$gt": now},
            "attempts": {"$lt": MAX_OTP_ATTEMPTS} # THÊM ĐIỀU KIỆN NÀY
        },
        sort=[("created_at", -1)],
    )
    if otp_doc:
        return OtpInDB(**otp_doc)
    return None


async def verify_and_use_otp(db: AsyncIOMotorDatabase, user_id: PyObjectId, otp_type: OtpTypeEnum, plain_otp_code: str) -> bool:
    """
    Verifies the OTP and marks it as used if valid. Increments attempt count.
    """
    # Bước 1: Tìm OTP gần nhất, chưa xác thực, chưa hết hạn (find_valid_otp sẽ kiểm tra attempts < MAX_OTP_ATTEMPTS)
    valid_otp_record = await find_valid_otp(db, user_id, otp_type)

    if not valid_otp_record:
        # Ghi log chi tiết hơn nếu không tìm thấy OTP hợp lệ
        logger.warning(f"No valid OTP found for user {user_id}, type {otp_type.value} during verification attempt.")
        # Kiểm tra xem có OTP nào không (dù không hợp lệ) để biết lý do
        now = datetime.now(timezone.utc)
        any_otp_for_user_type = await db.otps.find_one(
            {"user_id": ObjectId(user_id), "otp_type": otp_type.value, "verified_at": None},
            sort=[("created_at", -1)]
        )
        if any_otp_for_user_type:
            if any_otp_for_user_type.get("attempts", 0) >= MAX_OTP_ATTEMPTS:
                logger.warning(f"OTP for user {user_id}, type {otp_type.value} has reached max attempts ({any_otp_for_user_type.get('attempts', 0)}).")
            elif any_otp_for_user_type.get("expires_at") <= now:
                 logger.warning(f"OTP for user {user_id}, type {otp_type.value} has expired at {any_otp_for_user_type.get('expires_at')}.")
            else:
                # Trường hợp này không nên xảy ra nếu find_valid_otp hoạt động đúng
                logger.warning(f"OTP found for user {user_id}, type {otp_type.value} but not considered valid by find_valid_otp. Details: {any_otp_for_user_type}")
        else:
            logger.warning(f"No OTP record (valid or invalid) found at all for user {user_id}, type {otp_type.value}.")
        return False

    # Bước 2: Nếu tìm thấy, xác thực mã OTP
    if verify_otp_code(plain_otp_code, valid_otp_record.hashed_otp_code):
        # Mã OTP đúng -> Đánh dấu đã xác thực, tăng attempts (để log)
        update_result = await db.otps.update_one(
            {"_id": ObjectId(valid_otp_record.id)},
            {"$set": {"verified_at": datetime.now(timezone.utc), "attempts": valid_otp_record.attempts + 1}}
        )
        if update_result.modified_count > 0:
            logger.info(f"OTP {valid_otp_record.id} for user {user_id}, type {otp_type.value} verified and marked as used.")
            return True
        else:
            # Lỗi này hiếm khi xảy ra nếu record đã được tìm thấy
            logger.error(f"Failed to mark OTP {valid_otp_record.id} as used (after successful code verification) for user {user_id}, type {otp_type.value}.")
            return False
    else:
        # Mã OTP sai -> Tăng số lần thử sai
        new_attempts = valid_otp_record.attempts + 1
        set_payload: dict = {"attempts": new_attempts}

        # Nếu số lần thử sai đạt MAX_OTP_ATTEMPTS, làm cho OTP hết hạn ngay lập tức
        if new_attempts >= MAX_OTP_ATTEMPTS:
            set_payload["expires_at"] = datetime.now(timezone.utc) - timedelta(seconds=1)
            logger.warning(f"OTP {valid_otp_record.id} for user {user_id}, type {otp_type.value} has now reached max attempts ({new_attempts}) and is invalidated.")

        await db.otps.update_one(
            {"_id": ObjectId(valid_otp_record.id)},
            {"$set": set_payload}
        )
        logger.warning(f"OTP verification failed for user {user_id}, type {otp_type.value}. Incorrect code. Attempts: {new_attempts}.")
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
    delete_result = await db.otps.delete_many({"user_id": ObjectId(user_id), "otp_type": otp_type.value}) # Sử dụng .value
    return delete_result.deleted_count
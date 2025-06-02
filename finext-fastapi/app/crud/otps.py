# finext-fastapi/app/crud/otps.py
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Tuple # Đảm bảo Tuple được import nếu bạn dùng nó ở đâu đó

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.schemas.otps import OtpInDB, OtpTypeEnum, OtpCreateInternal # Import OtpPublic
from app.utils.otp_utils import hash_otp_code, verify_otp_code
# <<<< SỬA LỖI IMPORT >>>>
from app.core.config import MAX_OTP_ATTEMPTS # Import trực tiếp
# <<<< KẾT THÚC SỬA LỖI IMPORT >>>>
from app.utils.types import PyObjectId

logger = logging.getLogger(__name__)
OTP_COLLECTION = "otps" # Nên định nghĩa tên collection ở một chỗ


async def create_otp_record(db: AsyncIOMotorDatabase, otp_data: OtpCreateInternal) -> Optional[OtpInDB]:
    """Tạo bản ghi OTP mới và lưu vào DB sau khi hash mã OTP."""
    if not ObjectId.is_valid(otp_data.user_id):
        logger.error(f"Định dạng user_id không hợp lệ khi tạo OTP: {otp_data.user_id}")
        return None

    # <<<< SỬA LỖI TRUY CẬP ATTRIBUTE >>>>
    # Sử dụng otp_data.otp_code thay vì plain_otp_code
    hashed_code = hash_otp_code(otp_data.otp_code)
    # <<<< KẾT THÚC SỬA LỖI TRUY CẬP ATTRIBUTE >>>>

    # expires_at đã được tính toán và truyền vào qua otp_data.expires_at
    # created_at cũng được truyền vào qua otp_data.created_at
    
    otp_doc_to_insert = {
        "user_id": ObjectId(otp_data.user_id),
        "hashed_otp_code": hashed_code,
        "otp_type": otp_data.otp_type.value, 
        "expires_at": otp_data.expires_at, # Sử dụng expires_at từ otp_data
        "verified_at": None,
        "created_at": otp_data.created_at, # Sử dụng created_at từ otp_data
        "attempts": 0, 
        "updated_at": otp_data.created_at, # Lúc tạo thì updated_at = created_at
    }

    try:
        # Vô hiệu hóa các OTP cũ cùng loại chưa được xác thực và chưa hết hạn
        await db[OTP_COLLECTION].update_many(
            {
                "user_id": ObjectId(otp_data.user_id),
                "otp_type": otp_data.otp_type.value,
                "verified_at": None,
                "expires_at": {"$gt": datetime.now(timezone.utc)},
            },
            {"$set": {"expires_at": datetime.now(timezone.utc) - timedelta(seconds=1)}},
        )
        logger.info(f"Đã vô hiệu hóa các OTP cũ (type: {otp_data.otp_type.value}) cho user {otp_data.user_id}")

        insert_result = await db[OTP_COLLECTION].insert_one(otp_doc_to_insert)
        if insert_result.inserted_id:
            created_otp_doc = await db[OTP_COLLECTION].find_one({"_id": insert_result.inserted_id})
            if created_otp_doc:
                # Đảm bảo các ObjectId được chuyển thành str cho Pydantic model
                if "user_id" in created_otp_doc and isinstance(created_otp_doc["user_id"], ObjectId):
                    created_otp_doc["user_id"] = str(created_otp_doc["user_id"])
                return OtpInDB(**created_otp_doc)
        logger.error(f"Không thể tạo bản ghi OTP cho user_id: {otp_data.user_id}")
        return None
    except Exception as e:
        logger.error(f"Lỗi khi tạo OTP cho user {otp_data.user_id}: {e}", exc_info=True)
        return None


async def find_valid_otp(db: AsyncIOMotorDatabase, user_id: PyObjectId, otp_type: OtpTypeEnum) -> Optional[OtpInDB]:
    """
    Tìm OTP gần nhất, chưa hết hạn, chưa sử dụng cho user và type,
    và chưa đạt số lần thử tối đa.
    """
    if not ObjectId.is_valid(user_id):
        return None

    now = datetime.now(timezone.utc)
    otp_doc = await db[OTP_COLLECTION].find_one(
        {
            "user_id": ObjectId(user_id),
            "otp_type": otp_type.value, 
            "verified_at": None,
            "expires_at": {"$gt": now},
            "attempts": {"$lt": MAX_OTP_ATTEMPTS} 
        },
        sort=[("created_at", -1)],
    )
    if otp_doc:
        if "user_id" in otp_doc and isinstance(otp_doc["user_id"], ObjectId):
            otp_doc["user_id"] = str(otp_doc["user_id"])
        return OtpInDB(**otp_doc)
    return None


async def verify_and_use_otp(db: AsyncIOMotorDatabase, user_id: PyObjectId, otp_type: OtpTypeEnum, plain_otp_code: str) -> bool:
    """
    Xác thực OTP và đánh dấu là đã sử dụng nếu hợp lệ. Tăng số lần thử.
    """
    valid_otp_record = await find_valid_otp(db, user_id, otp_type)

    if not valid_otp_record:
        logger.warning(f"Không tìm thấy OTP hợp lệ cho user {user_id}, type {otp_type.value} khi xác thực.")
        # Kiểm tra xem có OTP nào không (dù không hợp lệ) để biết lý do
        now = datetime.now(timezone.utc)
        any_otp_for_user_type = await db[OTP_COLLECTION].find_one(
            {"user_id": ObjectId(user_id), "otp_type": otp_type.value, "verified_at": None},
            sort=[("created_at", -1)]
        )
        if any_otp_for_user_type:
            if any_otp_for_user_type.get("attempts", 0) >= MAX_OTP_ATTEMPTS:
                logger.warning(f"OTP cho user {user_id}, type {otp_type.value} đã đạt số lần thử tối đa ({any_otp_for_user_type.get('attempts', 0)}).")
            elif any_otp_for_user_type.get("expires_at") <= now:
                 logger.warning(f"OTP cho user {user_id}, type {otp_type.value} đã hết hạn lúc {any_otp_for_user_type.get('expires_at')}.")
        return False

    if verify_otp_code(plain_otp_code, valid_otp_record.hashed_otp_code):
        update_result = await db[OTP_COLLECTION].update_one(
            {"_id": ObjectId(valid_otp_record.id)},
            {"$set": {"verified_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc)}, "$inc": {"attempts": 1}}
        )
        if update_result.modified_count > 0:
            logger.info(f"OTP {valid_otp_record.id} cho user {user_id}, type {otp_type.value} đã được xác thực và đánh dấu đã sử dụng.")
            return True
        else:
            logger.error(f"Không thể đánh dấu OTP {valid_otp_record.id} là đã sử dụng cho user {user_id}, type {otp_type.value} (sau khi mã OTP đúng).")
            return False
    else:
        new_attempts = valid_otp_record.attempts + 1
        set_payload: dict = {"attempts": new_attempts, "updated_at": datetime.now(timezone.utc)}

        if new_attempts >= MAX_OTP_ATTEMPTS:
            set_payload["expires_at"] = datetime.now(timezone.utc) - timedelta(seconds=1) # Làm cho OTP hết hạn ngay
            logger.warning(f"OTP {valid_otp_record.id} cho user {user_id}, type {otp_type.value} đã đạt số lần thử tối đa ({new_attempts}) và bị vô hiệu hóa.")

        await db[OTP_COLLECTION].update_one(
            {"_id": ObjectId(valid_otp_record.id)},
            {"$set": set_payload}
        )
        logger.warning(f"Xác thực OTP thất bại cho user {user_id}, type {otp_type.value}. Mã không đúng. Số lần thử: {new_attempts}.")
        return False


async def get_otp_by_id(db: AsyncIOMotorDatabase, otp_id: PyObjectId) -> Optional[OtpInDB]:
    """Lấy OTP theo ID."""
    if not ObjectId.is_valid(otp_id):
        return None
    otp_doc = await db[OTP_COLLECTION].find_one({"_id": ObjectId(otp_id)})
    if otp_doc:
        if "user_id" in otp_doc and isinstance(otp_doc["user_id"], ObjectId): # Chuyển đổi user_id sang str
            otp_doc["user_id"] = str(otp_doc["user_id"])
        return OtpInDB(**otp_doc)
    return None

# --- CÁC HÀM CHO ADMIN ---
async def get_all_otps_admin(
    db: AsyncIOMotorDatabase,
    skip: int = 0,
    limit: int = 100,
    user_id_filter: Optional[PyObjectId] = None,
    otp_type_filter: Optional[OtpTypeEnum] = None,
    status_filter: Optional[str] = None, # 'pending', 'verified', 'expired', 'max_attempts'
) -> Tuple[List[OtpInDB], int]:
    """
    Admin: Lấy danh sách tất cả OTPs với filter và phân trang.
    """
    query = {}
    now = datetime.now(timezone.utc)

    if user_id_filter and ObjectId.is_valid(user_id_filter):
        query["user_id"] = ObjectId(user_id_filter)
    if otp_type_filter:
        query["otp_type"] = otp_type_filter.value
    
    if status_filter:
        if status_filter == "pending":
            query["verified_at"] = None
            query["expires_at"] = {"$gt": now}
            query["attempts"] = {"$lt": MAX_OTP_ATTEMPTS}
        elif status_filter == "verified":
            query["verified_at"] = {"$ne": None}
        elif status_filter == "expired":
            query["verified_at"] = None 
            query["expires_at"] = {"$lte": now}
        elif status_filter == "max_attempts":
            query["verified_at"] = None
            query["attempts"] = {"$gte": MAX_OTP_ATTEMPTS}

    total_count = await db[OTP_COLLECTION].count_documents(query)
    otps_cursor = (
        db[OTP_COLLECTION].find(query)
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
    )
    otps_docs = await otps_cursor.to_list(length=limit)

    results: List[OtpInDB] = []
    for otp_doc in otps_docs:
        if "user_id" in otp_doc and isinstance(otp_doc["user_id"], ObjectId):
            otp_doc["user_id"] = str(otp_doc["user_id"])
        results.append(OtpInDB(**otp_doc))
        
    return results, total_count

async def invalidate_otp_by_admin(db: AsyncIOMotorDatabase, otp_id: PyObjectId) -> Optional[OtpInDB]:
    """
    Admin: Vô hiệu hóa một OTP bằng cách set expires_at về quá khứ.
    """
    if not ObjectId.is_valid(otp_id):
        logger.warning(f"Admin: Định dạng OTP ID không hợp lệ để vô hiệu hóa: {otp_id}")
        return None
    
    otp_to_invalidate = await get_otp_by_id(db, otp_id) # Dùng hàm đã có để lấy doc
    if not otp_to_invalidate:
        logger.warning(f"Admin: Không tìm thấy OTP với ID {otp_id} để vô hiệu hóa.")
        return None 
    
    # Không cần kiểm tra verified_at ở đây, admin có quyền vô hiệu hóa bất kỳ OTP nào chưa hết hạn
    # nếu họ muốn.
    
    now = datetime.now(timezone.utc)
    if otp_to_invalidate.expires_at <= now:
        logger.info(f"Admin: OTP {otp_id} đã hết hạn. Không cần vô hiệu hóa thêm.")
        return otp_to_invalidate # Trả về trạng thái hiện tại

    update_result = await db[OTP_COLLECTION].update_one(
        {"_id": ObjectId(otp_id)},
        {"$set": {"expires_at": now - timedelta(seconds=1), "updated_at": now}} 
    )

    if update_result.modified_count > 0:
        logger.info(f"Admin: Đã vô hiệu hóa OTP ID {otp_id}.")
        return await get_otp_by_id(db, otp_id) # Trả về OTP đã cập nhật
    
    # Trường hợp matched nhưng không modified (có thể do race condition hoặc OTP đã được thay đổi)
    if update_result.matched_count > 0:
        logger.warning(f"Admin: OTP {otp_id} được tìm thấy nhưng không được cập nhật khi vô hiệu hóa (có thể đã hết hạn).")
        return await get_otp_by_id(db, otp_id) 

    logger.error(f"Admin: Không thể vô hiệu hóa OTP {otp_id} (không tìm thấy khi update).")
    return None
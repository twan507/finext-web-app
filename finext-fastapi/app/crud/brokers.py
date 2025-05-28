# finext-fastapi/app/crud/brokers.py
import logging
import random
import string
from datetime import datetime, timezone
from typing import List, Optional

from app.schemas.brokers import (  # Đảm bảo import BrokerBase nếu cần
    BrokerInDB,
)
from app.utils.types import PyObjectId
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)

async def generate_unique_broker_code(db: AsyncIOMotorDatabase) -> str:
    """Tạo mã broker_code duy nhất gồm 4 ký tự chữ HOA hoặc số."""
    # Collection 'brokers' được lấy từ db instance
    brokers_collection = db.get_collection("brokers")
    while True:
        # Tạo mã ngẫu nhiên gồm 4 ký tự (chữ HOA và số)
        code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
        # Kiểm tra xem mã đã tồn tại trong DB chưa
        existing_broker = await brokers_collection.find_one({"broker_code": code})
        if not existing_broker:
            return code

async def create_or_reactivate_broker_for_user(db: AsyncIOMotorDatabase, user_id: PyObjectId) -> Optional[BrokerInDB]:
    """
    Tạo mới hoặc kích hoạt lại bản ghi Broker cho user.
    Nếu user đã có bản ghi broker (dù active hay inactive), sẽ kích hoạt lại và sử dụng broker_code cũ.
    Nếu chưa, sẽ tạo mới.
    """
    brokers_collection = db.get_collection("brokers")
    users_collection = db.get_collection("users") # Cần để cập nhật referral_code

    if not ObjectId.is_valid(user_id):
        logger.error(f"User ID không hợp lệ khi tạo/kích hoạt broker: {user_id}")
        return None

    user_obj_id = ObjectId(user_id)
    user_exists = await users_collection.find_one({"_id": user_obj_id})
    if not user_exists:
        logger.error(f"User với ID {user_id} không tồn tại để tạo/kích hoạt broker.")
        raise ValueError(f"User với ID {user_id} không tồn tại.")

    now = datetime.now(timezone.utc)
    existing_broker_record = await brokers_collection.find_one({"user_id": user_obj_id})

    if existing_broker_record:
        # User này đã từng là broker, kích hoạt lại
        logger.info(f"User {user_id} đã có bản ghi broker (ID: {existing_broker_record['_id']}, Code: {existing_broker_record['broker_code']}). Sẽ kích hoạt lại.")
        if not existing_broker_record.get("is_active"): # Chỉ update nếu đang inactive
            update_result = await brokers_collection.update_one(
                {"_id": existing_broker_record["_id"]},
                {"$set": {"is_active": True, "updated_at": now}}
            )
            if update_result.modified_count == 0 and update_result.matched_count == 0:
                logger.error(f"Không thể kích hoạt lại broker cho user {user_id}.")
                return None # Hoặc raise lỗi
        
        # Gán lại referral_code cho user bằng broker_code cũ
        await users_collection.update_one(
            {"_id": user_obj_id},
            {"$set": {"referral_code": existing_broker_record["broker_code"], "updated_at": now}}
        )
        logger.info(f"Đã gán lại referral_code '{existing_broker_record['broker_code']}' cho user {user_id} khi kích hoạt lại broker.")
        
        # Lấy lại bản ghi đã cập nhật để trả về
        updated_broker_doc = await brokers_collection.find_one({"_id": existing_broker_record["_id"]})
        if updated_broker_doc:
            return BrokerInDB(**updated_broker_doc)
        return None # Lỗi không mong muốn
    else:
        # User này chưa từng là broker, tạo mới
        broker_code = await generate_unique_broker_code(db)
        broker_document = {
            "user_id": user_obj_id,
            "broker_code": broker_code,
            "is_active": True,
            "created_at": now,
            "updated_at": now,
        }
        try:
            result = await brokers_collection.insert_one(broker_document)
            if result.inserted_id:
                # Gán referral_code cho user bằng broker_code mới tạo
                await users_collection.update_one(
                    {"_id": user_obj_id},
                    {"$set": {"referral_code": broker_code, "updated_at": now}}
                )
                logger.info(f"Đã gán referral_code '{broker_code}' cho user {user_id} khi tạo broker mới.")
                
                created_doc = await brokers_collection.find_one({"_id": result.inserted_id})
                if created_doc:
                    return BrokerInDB(**created_doc)
            return None
        except Exception as e:
            logger.error(f"Lỗi khi tạo broker mới cho user {user_id}: {e}", exc_info=True)
            return None

async def get_broker_by_id(db: AsyncIOMotorDatabase, broker_id: PyObjectId) -> Optional[BrokerInDB]:
    """Lấy thông tin Broker theo ID của bản ghi Broker."""
    brokers_collection = db.get_collection("brokers")
    if not ObjectId.is_valid(broker_id):
        return None
    broker_doc = await brokers_collection.find_one({"_id": ObjectId(broker_id)})
    if broker_doc:
        return BrokerInDB(**broker_doc)
    return None

async def get_broker_by_code(db: AsyncIOMotorDatabase, broker_code: str) -> Optional[BrokerInDB]:
    """Lấy thông tin Broker theo broker_code."""
    brokers_collection = db.get_collection("brokers")
    broker_doc = await brokers_collection.find_one({"broker_code": broker_code.upper()}) # Đảm bảo tìm kiếm case-insensitive nếu mã lưu là HOA
    if broker_doc:
        return BrokerInDB(**broker_doc)
    return None

async def get_broker_by_user_id(db: AsyncIOMotorDatabase, user_id: PyObjectId) -> Optional[BrokerInDB]:
    """Lấy thông tin Broker theo user_id."""
    brokers_collection = db.get_collection("brokers")
    if not ObjectId.is_valid(user_id):
        return None
    broker_doc = await brokers_collection.find_one({"user_id": ObjectId(user_id)})
    if broker_doc:
        return BrokerInDB(**broker_doc)
    return None

async def get_brokers(db: AsyncIOMotorDatabase, skip: int = 0, limit: int = 100) -> List[BrokerInDB]:
    """Lấy danh sách tất cả các Brokers, hỗ trợ phân trang."""
    brokers_collection = db.get_collection("brokers")
    broker_cursor = brokers_collection.find().skip(skip).limit(limit).sort("created_at", -1)
    brokers_list = await broker_cursor.to_list(length=limit)
    return [BrokerInDB(**broker) for broker in brokers_list]

async def update_broker_status(db: AsyncIOMotorDatabase, broker_id_or_code: str, is_active: bool) -> Optional[BrokerInDB]:
    """Cập nhật trạng thái is_active của Broker. 
       Nếu deactivating, cũng xóa referral_code của user là broker đó.
       Nếu activating, sẽ gán lại referral_code cho user là broker đó.
    """
    brokers_collection = db.get_collection("brokers")
    users_collection = db.get_collection("users")
    query = {}
    
    broker_doc_before_update: Optional[dict] = None # Sử dụng dict để tránh lỗi validate Pydantic sớm

    if ObjectId.is_valid(broker_id_or_code):
        query["_id"] = ObjectId(broker_id_or_code)
        broker_doc_before_update = await brokers_collection.find_one(query)
    else:
        query["broker_code"] = broker_id_or_code.upper()
        broker_doc_before_update = await brokers_collection.find_one(query)


    if not query or not broker_doc_before_update:
        logger.warning(f"Không tìm thấy broker để cập nhật trạng thái với ID/Code: {broker_id_or_code}")
        return None

    now = datetime.now(timezone.utc)
    update_result = await brokers_collection.update_one(
        query,
        {"$set": {"is_active": is_active, "updated_at": now}}
    )

    if update_result.matched_count > 0:
        user_id_of_broker = broker_doc_before_update.get("user_id")
        broker_code_of_broker = broker_doc_before_update.get("broker_code")

        if user_id_of_broker and broker_code_of_broker: # Đảm bảo có user_id và broker_code
            if not is_active: # Nếu đang deactivating broker
                await users_collection.update_one(
                    {"_id": user_id_of_broker}, # user_id_of_broker đã là ObjectId
                    {"$set": {"referral_code": None, "updated_at": now}}
                )
                logger.info(f"Đã xóa referral_code của user {str(user_id_of_broker)} khi hủy kích hoạt broker {broker_id_or_code}.")
            else: # Nếu đang activating broker
                await users_collection.update_one(
                    {"_id": user_id_of_broker},
                    {"$set": {"referral_code": broker_code_of_broker, "updated_at": now}}
                )
                logger.info(f"Đã gán lại referral_code '{broker_code_of_broker}' cho user {str(user_id_of_broker)} khi kích hoạt broker {broker_id_or_code}.")

        updated_doc = await brokers_collection.find_one(query) # Lấy lại bản ghi đã được cập nhật
        if updated_doc:
            return BrokerInDB(**updated_doc)
    return None

async def deactivate_broker_record(db: AsyncIOMotorDatabase, broker_id_or_code: str) -> bool:
    """
    Sửa: Chỉ deactive bản ghi broker, không xóa.
    Trả về True nếu deactive thành công, False nếu không.
    """
    updated_broker = await update_broker_status(db, broker_id_or_code, is_active=False)
    return updated_broker is not None

async def is_broker_code_valid_and_active(db: AsyncIOMotorDatabase, broker_code: str) -> bool:
    """Kiểm tra xem broker_code có tồn tại và đang active không."""
    if not broker_code or len(broker_code) != 4: # Giả sử mã luôn có 4 ký tự
        return False
    brokers_collection = db.get_collection("brokers")
    broker_doc = await brokers_collection.find_one({"broker_code": broker_code.upper(), "is_active": True})
    return broker_doc is not None
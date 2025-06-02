# finext-fastapi/app/crud/brokers.py
import logging
import random
import string
from datetime import datetime, timezone
from typing import List, Optional, Tuple # Thêm Tuple
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.schemas.brokers import (  
    BrokerInDB,
    # BrokerCreate, BrokerUpdate, BrokerPublic # Các schema này vẫn giữ nguyên
)
from app.utils.types import PyObjectId
from app.core.config import BROKER_EMAIL_1, BROKER_EMAIL_2

logger = logging.getLogger(__name__)
BROKERS_COLLECTION = "brokers" # Định nghĩa tên collection
USERS_COLLECTION = "users" # Định nghĩa tên collection users

async def generate_unique_broker_code(db: AsyncIOMotorDatabase) -> str:
    brokers_collection = db.get_collection(BROKERS_COLLECTION)
    while True:
        code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
        existing_broker = await brokers_collection.find_one({"broker_code": code})
        if not existing_broker:
            return code

async def create_or_reactivate_broker_for_user(db: AsyncIOMotorDatabase, user_id: PyObjectId) -> Optional[BrokerInDB]:
    brokers_collection = db.get_collection(BROKERS_COLLECTION)
    users_collection = db.get_collection(USERS_COLLECTION) 

    if not ObjectId.is_valid(user_id):
        logger.error(f"User ID không hợp lệ khi tạo/kích hoạt broker: {user_id}")
        # raise ValueError(f"User ID không hợp lệ: {user_id}") # Hoặc trả về None tùy logic router
        return None


    user_obj_id = ObjectId(user_id)
    user_doc_for_broker = await users_collection.find_one({"_id": user_obj_id}) 
    if not user_doc_for_broker:
        logger.error(f"User với ID {user_id} không tồn tại để tạo/kích hoạt broker.")
        raise ValueError(f"User với ID {user_id} không tồn tại.")

    now = datetime.now(timezone.utc)
    existing_broker_record = await brokers_collection.find_one({"user_id": user_obj_id})

    if existing_broker_record:
        logger.info(f"User {user_id} đã có bản ghi broker (ID: {existing_broker_record['_id']}, Code: {existing_broker_record['broker_code']}). Sẽ kích hoạt lại nếu cần.")
        if not existing_broker_record.get("is_active"): 
            update_result = await brokers_collection.update_one(
                {"_id": existing_broker_record["_id"]},
                {"$set": {"is_active": True, "updated_at": now}}
            )
            if update_result.modified_count == 0 and update_result.matched_count == 0 : # Thêm kiểm tra matched_count
                logger.error(f"Không thể kích hoạt lại broker cho user {user_id} (không tìm thấy broker khi update).")
                return None 
            logger.info(f"Đã kích hoạt lại broker cho user {user_id}.")
        
        # Đảm bảo user có referral_code là broker_code của họ
        if user_doc_for_broker.get("referral_code") != existing_broker_record["broker_code"]:
            await users_collection.update_one(
                {"_id": user_obj_id},
                {"$set": {"referral_code": existing_broker_record["broker_code"], "updated_at": now}}
            )
            logger.info(f"Đã cập nhật/gán lại referral_code '{existing_broker_record['broker_code']}' cho user {user_id} khi kích hoạt lại broker.")
        
        updated_broker_doc = await brokers_collection.find_one({"_id": existing_broker_record["_id"]})
        if updated_broker_doc:
            return BrokerInDB(**updated_broker_doc)
        return None 
    else: # Tạo broker mới
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
                # Gán broker_code vào referral_code của user
                await users_collection.update_one(
                    {"_id": user_obj_id},
                    {"$set": {"referral_code": broker_code, "updated_at": now}}
                )
                logger.info(f"Đã gán referral_code '{broker_code}' cho user {user_id} khi tạo broker mới.")
                
                created_doc = await brokers_collection.find_one({"_id": result.inserted_id})
                if created_doc:
                    return BrokerInDB(**created_doc)
            logger.error(f"Không thể tạo broker mới cho user {user_id} sau khi insert.")
            return None
        except Exception as e:
            logger.error(f"Lỗi khi tạo broker mới cho user {user_id}: {e}", exc_info=True)
            # Cân nhắc rollback nếu cần (ví dụ xóa user.referral_code nếu đã set)
            return None

async def get_broker_by_id(db: AsyncIOMotorDatabase, broker_id: PyObjectId) -> Optional[BrokerInDB]:
    brokers_collection = db.get_collection(BROKERS_COLLECTION)
    if not ObjectId.is_valid(broker_id):
        return None
    broker_doc = await brokers_collection.find_one({"_id": ObjectId(broker_id)})
    if broker_doc:
        return BrokerInDB(**broker_doc)
    return None

async def get_broker_by_code(db: AsyncIOMotorDatabase, broker_code: str) -> Optional[BrokerInDB]:
    brokers_collection = db.get_collection(BROKERS_COLLECTION)
    broker_doc = await brokers_collection.find_one({"broker_code": broker_code.upper()}) 
    if broker_doc:
        return BrokerInDB(**broker_doc)
    return None

async def get_broker_by_user_id(db: AsyncIOMotorDatabase, user_id: PyObjectId) -> Optional[BrokerInDB]:
    brokers_collection = db.get_collection(BROKERS_COLLECTION)
    if not ObjectId.is_valid(user_id):
        return None
    broker_doc = await brokers_collection.find_one({"user_id": ObjectId(user_id)})
    if broker_doc:
        return BrokerInDB(**broker_doc)
    return None

# <<<< PHẦN CẬP NHẬT >>>>
async def get_brokers(
    db: AsyncIOMotorDatabase, 
    skip: int = 0, 
    limit: int = 100,
    # Thêm các filter nếu admin cần, ví dụ:
    # user_id_filter: Optional[PyObjectId] = None,
    # broker_code_filter: Optional[str] = None,
    # is_active_filter: Optional[bool] = None,
) -> Tuple[List[BrokerInDB], int]:
    """
    Lấy danh sách tất cả Brokers với phân trang và trả về tổng số lượng.
    """
    brokers_collection = db.get_collection(BROKERS_COLLECTION)
    query = {}
    # if user_id_filter and ObjectId.is_valid(user_id_filter):
    #     query["user_id"] = ObjectId(user_id_filter)
    # if broker_code_filter:
    #     query["broker_code"] = {"$regex": broker_code_filter.upper(), "$options": "i"} # Tìm gần đúng, không phân biệt hoa thường
    # if is_active_filter is not None:
    #     query["is_active"] = is_active_filter
    
    total_count = await brokers_collection.count_documents(query)
    
    broker_cursor = (
        brokers_collection.find(query)
        .sort("created_at", -1) # Sắp xếp theo ngày tạo mới nhất
        .skip(skip)
        .limit(limit)
    )
    brokers_list_docs = await broker_cursor.to_list(length=limit)
    
    results = [BrokerInDB(**broker) for broker in brokers_list_docs]
    return results, total_count
# <<<< KẾT THÚC PHẦN CẬP NHẬT >>>>

async def update_broker_status(db: AsyncIOMotorDatabase, broker_id_or_code: str, is_active: bool) -> Optional[BrokerInDB]:
    brokers_collection = db.get_collection(BROKERS_COLLECTION)
    users_collection = db.get_collection(USERS_COLLECTION)
    query = {}
    
    broker_doc_before_update: Optional[dict] = None 

    if ObjectId.is_valid(broker_id_or_code):
        query["_id"] = ObjectId(broker_id_or_code)
        broker_doc_before_update = await brokers_collection.find_one(query)
    else: # Giả sử là broker_code
        query["broker_code"] = broker_id_or_code.upper()
        broker_doc_before_update = await brokers_collection.find_one(query)

    if not broker_doc_before_update: # broker_doc_before_update là dict từ DB
        logger.warning(f"Không tìm thấy broker để cập nhật trạng thái với ID/Code: {broker_id_or_code}")
        return None

    # Chuyển đổi broker_doc_before_update (dict) thành BrokerInDB instance để kiểm tra
    broker_instance_before_update = BrokerInDB(**broker_doc_before_update)

    if not is_active: 
        user_of_broker_doc = await users_collection.find_one({"_id": broker_instance_before_update.user_id}) # user_id đã là ObjectId
        if user_of_broker_doc and user_of_broker_doc.get("email") in [BROKER_EMAIL_1, BROKER_EMAIL_2]:
            logger.warning(f"Attempt to deactivate protected broker: {user_of_broker_doc.get('email')}. Deactivation denied.")
            raise ValueError(f"Cannot deactivate protected broker '{user_of_broker_doc.get('email')}'.")

    now = datetime.now(timezone.utc)
    update_result = await brokers_collection.update_one(
        query, # query đã được set ở trên
        {"$set": {"is_active": is_active, "updated_at": now}}
    )

    if update_result.matched_count > 0:
        user_id_of_broker_obj = broker_instance_before_update.user_id # Đây là ObjectId
        broker_code_of_broker = broker_instance_before_update.broker_code

        if not is_active: 
            # Nếu hủy kích hoạt broker, xóa referral_code của user đó
            await users_collection.update_one(
                {"_id": user_id_of_broker_obj}, 
                {"$set": {"referral_code": None, "updated_at": now}}
            )
            logger.info(f"Đã xóa referral_code của user {str(user_id_of_broker_obj)} khi hủy kích hoạt broker {broker_id_or_code}.")
        else: 
            # Nếu kích hoạt lại broker, đảm bảo referral_code của user là broker_code của họ
             await users_collection.update_one(
                {"_id": user_id_of_broker_obj},
                {"$set": {"referral_code": broker_code_of_broker, "updated_at": now}}
            )
             logger.info(f"Đã gán lại referral_code '{broker_code_of_broker}' cho user {str(user_id_of_broker_obj)} khi kích hoạt broker {broker_id_or_code}.")

        updated_doc = await brokers_collection.find_one(query) 
        if updated_doc:
            return BrokerInDB(**updated_doc)
    return None


async def is_broker_code_valid_and_active(db: AsyncIOMotorDatabase, broker_code: str) -> bool:
    if not broker_code or len(broker_code) != 4: 
        return False
    brokers_collection = db.get_collection(BROKERS_COLLECTION)
    broker_doc = await brokers_collection.find_one({"broker_code": broker_code.upper(), "is_active": True})
    return broker_doc is not None
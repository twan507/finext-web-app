# finext-fastapi/app/crud/sessions.py
import logging
from typing import List, Optional, Dict, Any
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timezone

# Đảm bảo tên schema khớp với file app/schemas/active_sessions .py
# Nếu bạn đổi tên file schema thành sessions.py, hãy cập nhật import này.
from app.schemas.sessions import SessionCreate, SessionInDB 
from app.utils.types import PyObjectId

logger = logging.getLogger(__name__)

async def create_session(db: AsyncIOMotorDatabase, session_data: SessionCreate) -> Optional[SessionInDB]:
    """Tạo một bản ghi session mới trong database."""
    session_doc_to_insert = session_data.model_dump()
    dt_now = datetime.now(timezone.utc)
    session_doc_to_insert["created_at"] = dt_now
    session_doc_to_insert["last_active_at"] = dt_now
    
    try:
        # Chuyển đổi user_id (là string từ PyObjectId) sang ObjectId trước khi insert
        if not ObjectId.is_valid(session_data.user_id):
            logger.error(f"Định dạng user_id không hợp lệ: {session_data.user_id}")
            return None
        session_doc_to_insert["user_id"] = ObjectId(session_data.user_id)
        
        insert_result = await db["sessions" ].insert_one(session_doc_to_insert)
        if insert_result.inserted_id:
            created_session_doc = await db["sessions" ].find_one({"_id": insert_result.inserted_id})
            if created_session_doc:
                return SessionInDB(**created_session_doc)
        logger.error(f"Không thể tạo session cho user ID: {session_data.user_id}")
        return None
    except Exception as e:
        logger.error(f"Lỗi khi tạo session cho user {session_data.user_id}: {e}", exc_info=True)
        return None

async def get_sessions_by_user_id(db: AsyncIOMotorDatabase, user_id: str) -> List[SessionInDB]:
    """Lấy danh sách các session đang hoạt động của một user."""
    if not ObjectId.is_valid(user_id):
        logger.warning(f"Định dạng user_id không hợp lệ khi lấy sessions: {user_id}")
        return []
        
    sessions_cursor = db["sessions" ].find({"user_id": ObjectId(user_id)})
    sessions = await sessions_cursor.to_list(length=None) # Lấy tất cả
    return [SessionInDB(**session) for session in sessions]

async def count_sessions_by_user_id(db: AsyncIOMotorDatabase, user_id: str) -> int:
    """Đếm số lượng session đang hoạt động của một user."""
    if not ObjectId.is_valid(user_id):
        logger.warning(f"Định dạng user_id không hợp lệ khi đếm sessions: {user_id}")
        return 0
        
    count = await db["sessions" ].count_documents({"user_id": ObjectId(user_id)})
    return count

async def get_session_by_jti(db: AsyncIOMotorDatabase, jti: str) -> Optional[SessionInDB]:
    """Tìm một session dựa trên JTI (JWT ID)."""
    session_doc = await db["sessions" ].find_one({"jti": jti})
    if session_doc:
        return SessionInDB(**session_doc)
    return None

async def delete_session_by_jti(db: AsyncIOMotorDatabase, jti: str) -> bool:
    """Xóa một session dựa trên JTI."""
    delete_result = await db["sessions" ].delete_one({"jti": jti})
    return delete_result.deleted_count > 0

async def find_and_delete_oldest_session(db: AsyncIOMotorDatabase, user_id: str) -> bool:
    """Tìm và xóa session cũ nhất của user (dựa trên created_at)."""
    if not ObjectId.is_valid(user_id):
        logger.warning(f"Định dạng user_id không hợp lệ khi xóa session cũ nhất: {user_id}")
        return False

    oldest_session = await db["sessions" ].find_one(
        {"user_id": ObjectId(user_id)},
        sort=[("created_at", 1)] # Sắp xếp theo created_at tăng dần để lấy cái cũ nhất
    )

    if oldest_session:
        delete_result = await db["sessions" ].delete_one({"_id": oldest_session["_id"]})
        if delete_result.deleted_count > 0:
            logger.info(f"Đã xóa session cũ nhất (ID: {oldest_session['_id']}, JTI: {oldest_session.get('jti')}) của user {user_id}.")
            return True
        else:
            logger.warning(f"Tìm thấy session cũ nhất (ID: {oldest_session['_id']}) nhưng không thể xóa.")
            return False
    logger.info(f"Không tìm thấy session nào của user {user_id} để xóa (khi tìm session cũ nhất).")
    return False

async def update_last_active(db: AsyncIOMotorDatabase, jti: str) -> bool:
    """Cập nhật trường last_active_at cho một session."""
    result = await db["sessions" ].update_one(
        {"jti": jti},
        {"$set": {"last_active_at": datetime.now(timezone.utc)}}
    )
    return result.modified_count > 0

async def get_all_sessions(db: AsyncIOMotorDatabase, skip: int = 0, limit: int = 100) -> List[SessionInDB]:
    """Lấy danh sách tất cả các session trong hệ thống, có phân trang (cho admin)."""
    sessions_cursor = db["sessions" ].find().skip(skip).limit(limit)
    sessions = await sessions_cursor.to_list(length=limit)
    return [SessionInDB(**session) for session in sessions]

async def delete_session_by_id(db: AsyncIOMotorDatabase, session_id_str: PyObjectId) -> bool:
    """Xóa session theo _id (dạng string đã được PyObjectId validate)."""
    if not ObjectId.is_valid(session_id_str): # PyObjectId đã đảm bảo valid, nhưng check lại cho an toàn
        logger.warning(f"Định dạng session_id không hợp lệ khi xóa: {session_id_str}")
        return False
    
    delete_result = await db["sessions" ].delete_one({"_id": ObjectId(session_id_str)})
    return delete_result.deleted_count > 0

async def delete_sessions_for_user_except_jti(db: AsyncIOMotorDatabase, user_id_str: str, current_jti_to_keep: Optional[str]) -> int:
    """Xóa tất cả các session của một user, ngoại trừ session có JTI được cung cấp."""
    if not ObjectId.is_valid(user_id_str):
        logger.warning(f"User ID không hợp lệ khi xóa sessions: {user_id_str}")
        return 0

    query: Dict[str, Any] = {"user_id": ObjectId(user_id_str)}
    if current_jti_to_keep:
        query["jti"] = {"$ne": current_jti_to_keep}
    # Nếu current_jti_to_keep là None, tất cả sessions của user sẽ bị xóa.

    delete_result = await db["sessions"].delete_many(query)
    if delete_result.deleted_count > 0:
        logger.info(f"Đã xóa {delete_result.deleted_count} session(s) cho user ID {user_id_str} (giữ lại JTI: {current_jti_to_keep if current_jti_to_keep else 'TOÀN BỘ'}).")
    return delete_result.deleted_count
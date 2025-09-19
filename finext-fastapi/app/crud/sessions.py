# finext-fastapi/app/crud/sessions.py
import logging
from typing import List, Optional, Dict, Any, Tuple  # Thêm Tuple
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timezone

from app.schemas.sessions import SessionCreate, SessionInDB
from app.utils.types import PyObjectId

logger = logging.getLogger(__name__)
SESSIONS_COLLECTION = "sessions"  # Định nghĩa tên collection


async def create_session(db: AsyncIOMotorDatabase, session_data: SessionCreate) -> Optional[SessionInDB]:
    """Tạo một bản ghi session mới trong database."""
    logger.info(f"🔄 Creating session for user {session_data.user_id} with access_jti: {session_data.access_jti}")

    session_doc_to_insert = session_data.model_dump()
    dt_now = datetime.now(timezone.utc)
    session_doc_to_insert["created_at"] = dt_now
    session_doc_to_insert["last_active_at"] = dt_now

    try:
        if not ObjectId.is_valid(session_data.user_id):
            logger.error(f"Định dạng user_id không hợp lệ: {session_data.user_id}")
            return None
        session_doc_to_insert["user_id"] = ObjectId(session_data.user_id)

        insert_result = await db[SESSIONS_COLLECTION].insert_one(session_doc_to_insert)
        if insert_result.inserted_id:
            created_session_doc = await db[SESSIONS_COLLECTION].find_one({"_id": insert_result.inserted_id})
            if created_session_doc:
                # Chuyển đổi ObjectId user_id sang str cho Pydantic model
                if "user_id" in created_session_doc and isinstance(created_session_doc["user_id"], ObjectId):
                    created_session_doc["user_id"] = str(created_session_doc["user_id"])
                logger.info(f"✅ Session created successfully with ID: {insert_result.inserted_id}")
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

    sessions_cursor = db[SESSIONS_COLLECTION].find({"user_id": ObjectId(user_id)})
    sessions_docs = await sessions_cursor.to_list(length=None)

    results: List[SessionInDB] = []
    for session_doc in sessions_docs:
        if "user_id" in session_doc and isinstance(session_doc["user_id"], ObjectId):
            session_doc["user_id"] = str(session_doc["user_id"])
        results.append(SessionInDB(**session_doc))
    return results


async def count_sessions_by_user_id(db: AsyncIOMotorDatabase, user_id: str) -> int:
    """Đếm số lượng session đang hoạt động của một user."""
    if not ObjectId.is_valid(user_id):
        logger.warning(f"Định dạng user_id không hợp lệ khi đếm sessions: {user_id}")
        return 0

    count = await db[SESSIONS_COLLECTION].count_documents({"user_id": ObjectId(user_id)})
    return count


async def get_session_by_access_jti(db: AsyncIOMotorDatabase, access_jti: str) -> Optional[SessionInDB]:
    """Tìm một session dựa trên Access Token JTI."""
    logger.info(f"🔍 Looking for session with access_jti: {access_jti}")

    session_doc = await db[SESSIONS_COLLECTION].find_one({"access_jti": access_jti})
    if session_doc:
        if "user_id" in session_doc and isinstance(session_doc["user_id"], ObjectId):
            session_doc["user_id"] = str(session_doc["user_id"])
        logger.info(f"✅ Found session with ID: {session_doc.get('_id')}")
        return SessionInDB(**session_doc)

    logger.warning(f"❌ No session found with access_jti: {access_jti}")
    return None


async def get_session_by_refresh_jti(db: AsyncIOMotorDatabase, refresh_jti: str) -> Optional[SessionInDB]:
    """Tìm một session dựa trên Refresh Token JTI."""
    session_doc = await db[SESSIONS_COLLECTION].find_one({"refresh_jti": refresh_jti})
    if session_doc:
        if "user_id" in session_doc and isinstance(session_doc["user_id"], ObjectId):
            session_doc["user_id"] = str(session_doc["user_id"])
        return SessionInDB(**session_doc)
    return None


async def delete_session_by_access_jti(db: AsyncIOMotorDatabase, access_jti: str) -> bool:
    """Xóa một session dựa trên Access Token JTI."""
    delete_result = await db[SESSIONS_COLLECTION].delete_one({"access_jti": access_jti})
    return delete_result.deleted_count > 0


async def delete_session_by_refresh_jti(db: AsyncIOMotorDatabase, refresh_jti: str) -> bool:
    """Xóa một session dựa trên Refresh Token JTI."""
    delete_result = await db[SESSIONS_COLLECTION].delete_one({"refresh_jti": refresh_jti})
    return delete_result.deleted_count > 0


async def find_and_delete_oldest_session(db: AsyncIOMotorDatabase, user_id: str) -> bool:
    """Tìm và xóa session cũ nhất của user (dựa trên created_at)."""
    if not ObjectId.is_valid(user_id):
        logger.warning(f"Định dạng user_id không hợp lệ khi xóa session cũ nhất: {user_id}")
        return False

    oldest_session = await db[SESSIONS_COLLECTION].find_one({"user_id": ObjectId(user_id)}, sort=[("created_at", 1)])

    if oldest_session:
        delete_result = await db[SESSIONS_COLLECTION].delete_one({"_id": oldest_session["_id"]})
        if delete_result.deleted_count > 0:
            logger.info(
                f"Đã xóa session cũ nhất (ID: {oldest_session['_id']}, Access JTI: {oldest_session.get('access_jti', 'N/A')}) của user {user_id}."
            )
            return True
        else:
            logger.warning(f"Tìm thấy session cũ nhất (ID: {oldest_session['_id']}) nhưng không thể xóa.")
            return False
    logger.info(f"Không tìm thấy session nào của user {user_id} để xóa (khi tìm session cũ nhất).")
    return False


async def update_last_active_by_access_jti(db: AsyncIOMotorDatabase, access_jti: str) -> bool:
    """Cập nhật trường last_active_at cho một session bằng access_jti."""
    result = await db[SESSIONS_COLLECTION].update_one({"access_jti": access_jti}, {"$set": {"last_active_at": datetime.now(timezone.utc)}})
    return result.modified_count > 0


async def update_session_jtis(db: AsyncIOMotorDatabase, session_id: str, new_access_jti: str, new_refresh_jti: str) -> bool:
    """Cập nhật cả access_jti và refresh_jti cho một session."""
    if not ObjectId.is_valid(session_id):
        return False

    result = await db[SESSIONS_COLLECTION].update_one(
        {"_id": ObjectId(session_id)},
        {"$set": {"access_jti": new_access_jti, "refresh_jti": new_refresh_jti, "last_active_at": datetime.now(timezone.utc)}},
    )
    return result.modified_count > 0


# <<<< PHẦN CẬP NHẬT >>>>
async def get_all_sessions(
    db: AsyncIOMotorDatabase,
    skip: int = 0,
    limit: int = 100,
    # Thêm các filter nếu admin cần, ví dụ:
    # user_id_filter: Optional[PyObjectId] = None,
    # device_info_filter: Optional[str] = None, # Tìm kiếm device info (chứa)
) -> Tuple[List[SessionInDB], int]:  # Trả về Tuple
    """
    Lấy danh sách tất cả các session trong hệ thống, có phân trang (cho admin).
    """
    query = {}
    # if user_id_filter and ObjectId.is_valid(user_id_filter):
    #     query["user_id"] = ObjectId(user_id_filter)
    # if device_info_filter:
    #     query["device_info"] = {"$regex": device_info_filter, "$options": "i"}

    total_count = await db[SESSIONS_COLLECTION].count_documents(query)
    sessions_cursor = (
        db[SESSIONS_COLLECTION]
        .find(query)
        .sort("last_active_at", -1)  # Sắp xếp theo last_active_at mới nhất
        .skip(skip)
        .limit(limit)
    )
    sessions_docs = await sessions_cursor.to_list(length=limit)

    results: List[SessionInDB] = []
    for session_doc in sessions_docs:
        if "user_id" in session_doc and isinstance(session_doc["user_id"], ObjectId):
            session_doc["user_id"] = str(session_doc["user_id"])
        results.append(SessionInDB(**session_doc))
    return results, total_count


# <<<< KẾT THÚC PHẦN CẬP NHẬT >>>>


async def delete_session_by_id(db: AsyncIOMotorDatabase, session_id_str: PyObjectId) -> bool:
    """Xóa session theo _id (dạng string đã được PyObjectId validate)."""
    if not ObjectId.is_valid(session_id_str):
        logger.warning(f"Định dạng session_id không hợp lệ khi xóa: {session_id_str}")
        return False

    delete_result = await db[SESSIONS_COLLECTION].delete_one({"_id": ObjectId(session_id_str)})
    return delete_result.deleted_count > 0


async def delete_sessions_for_user_except_jti(db: AsyncIOMotorDatabase, user_id_str: str, current_jti_to_keep: Optional[str]) -> int:
    """Xóa tất cả các session của một user, ngoại trừ session có JTI được cung cấp."""
    if not ObjectId.is_valid(user_id_str):
        logger.warning(f"User ID không hợp lệ khi xóa sessions: {user_id_str}")
        return 0

    query: Dict[str, Any] = {"user_id": ObjectId(user_id_str)}
    if current_jti_to_keep:
        query["jti"] = {"$ne": current_jti_to_keep}

    delete_result = await db[SESSIONS_COLLECTION].delete_many(query)
    if delete_result.deleted_count > 0:
        logger.info(
            f"Đã xóa {delete_result.deleted_count} session(s) cho user ID {user_id_str} (giữ lại JTI: {current_jti_to_keep if current_jti_to_keep else 'TOÀN BỘ'})."
        )
    return delete_result.deleted_count

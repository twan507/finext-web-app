# app/crud/watchlists.py
import logging
from typing import List, Optional, Tuple  # Thêm Tuple
from datetime import datetime, timezone

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.schemas.watchlists import WatchlistCreate, WatchlistUpdate, WatchlistInDB
from app.utils.types import PyObjectId

logger = logging.getLogger(__name__)
WATCHLIST_COLLECTION = "watchlists"


async def create_watchlist(db: AsyncIOMotorDatabase, user_id: PyObjectId, watchlist_data: WatchlistCreate) -> Optional[WatchlistInDB]:
    if not ObjectId.is_valid(user_id):
        logger.error(f"Invalid user_id format for creating watchlist: {user_id}")
        # Return None or raise ValueError, depending on how router handles it
        raise ValueError(f"Định dạng User ID không hợp lệ: {user_id}")

    existing_watchlist = await db[WATCHLIST_COLLECTION].find_one({"user_id": ObjectId(user_id), "name": watchlist_data.name})
    if existing_watchlist:
        logger.warning(f"Watchlist with name '{watchlist_data.name}' already exists for user {user_id}.")
        raise ValueError(f"Bạn đã có một danh sách theo dõi với tên '{watchlist_data.name}'.")

    now = datetime.now(timezone.utc)
    watchlist_doc_to_insert = {
        "user_id": ObjectId(user_id),
        "name": watchlist_data.name,
        "stock_symbols": list(set(watchlist_data.stock_symbols)),
        "created_at": now,
        "updated_at": now,
    }
    try:
        result = await db[WATCHLIST_COLLECTION].insert_one(watchlist_doc_to_insert)
        if result.inserted_id:
            created_doc = await db[WATCHLIST_COLLECTION].find_one({"_id": result.inserted_id})
            if created_doc:
                # Chuyển đổi ObjectId sang str trước khi tạo model Pydantic
                if "user_id" in created_doc and isinstance(created_doc["user_id"], ObjectId):
                    created_doc["user_id"] = str(created_doc["user_id"])
                return WatchlistInDB(**created_doc)
        logger.error(f"Không thể tạo watchlist cho user {user_id} sau khi insert.")
        return None  # Hoặc raise một lỗi cụ thể hơn
    except Exception as e:
        logger.error(f"Lỗi khi tạo watchlist cho user {user_id}: {e}", exc_info=True)
        raise  # Re-raise để router có thể bắt và trả lỗi 500


async def get_watchlist_by_id(db: AsyncIOMotorDatabase, watchlist_id: PyObjectId) -> Optional[WatchlistInDB]:
    if not ObjectId.is_valid(watchlist_id):
        return None
    watchlist_doc = await db[WATCHLIST_COLLECTION].find_one({"_id": ObjectId(watchlist_id)})
    if watchlist_doc:
        if "user_id" in watchlist_doc and isinstance(watchlist_doc["user_id"], ObjectId):
            watchlist_doc["user_id"] = str(watchlist_doc["user_id"])
        return WatchlistInDB(**watchlist_doc)
    return None


async def get_watchlists_by_user_id(db: AsyncIOMotorDatabase, user_id: PyObjectId, skip: int = 0, limit: int = 100) -> List[WatchlistInDB]:
    if not ObjectId.is_valid(user_id):
        return []
    watchlists_cursor = db[WATCHLIST_COLLECTION].find({"user_id": ObjectId(user_id)}).sort("created_at", -1).skip(skip).limit(limit)
    watchlists_docs = await watchlists_cursor.to_list(length=limit)

    results: List[WatchlistInDB] = []
    for wl_doc in watchlists_docs:
        if "user_id" in wl_doc and isinstance(wl_doc["user_id"], ObjectId):
            wl_doc["user_id"] = str(wl_doc["user_id"])
        results.append(WatchlistInDB(**wl_doc))
    return results


async def update_watchlist(
    db: AsyncIOMotorDatabase, watchlist_id: PyObjectId, user_id: PyObjectId, watchlist_update_data: WatchlistUpdate
) -> Optional[WatchlistInDB]:
    if not ObjectId.is_valid(watchlist_id) or not ObjectId.is_valid(user_id):
        return None  # Hoặc raise ValueError

    existing_watchlist_doc = await db[WATCHLIST_COLLECTION].find_one({"_id": ObjectId(watchlist_id), "user_id": ObjectId(user_id)})
    if not existing_watchlist_doc:
        logger.warning(f"Watchlist {watchlist_id} not found or does not belong to user {user_id}")
        return None  # Hoặc raise ValueError("Watchlist không tìm thấy hoặc bạn không có quyền cập nhật.")

    update_data = watchlist_update_data.model_dump(exclude_unset=True)
    if not update_data:
        return WatchlistInDB(**existing_watchlist_doc)

    if "name" in update_data and update_data["name"] != existing_watchlist_doc.get("name"):
        another_watchlist_with_same_name = await db[WATCHLIST_COLLECTION].find_one(
            {"user_id": ObjectId(user_id), "name": update_data["name"], "_id": {"$ne": ObjectId(watchlist_id)}}
        )
        if another_watchlist_with_same_name:
            raise ValueError(f"Bạn đã có một danh sách theo dõi khác với tên '{update_data['name']}'.")

    if "stock_symbols" in update_data and update_data["stock_symbols"] is not None:
        update_data["stock_symbols"] = list(set(update_data["stock_symbols"]))

    update_data["updated_at"] = datetime.now(timezone.utc)

    updated_result = await db[WATCHLIST_COLLECTION].update_one({"_id": ObjectId(watchlist_id)}, {"$set": update_data})
    if updated_result.matched_count > 0:
        return await get_watchlist_by_id(db, watchlist_id)  # Lấy lại doc đã cập nhật
    return None


async def delete_watchlist(db: AsyncIOMotorDatabase, watchlist_id: PyObjectId, user_id: PyObjectId) -> bool:
    if not ObjectId.is_valid(watchlist_id) or not ObjectId.is_valid(user_id):
        return False
    delete_result = await db[WATCHLIST_COLLECTION].delete_one({"_id": ObjectId(watchlist_id), "user_id": ObjectId(user_id)})
    return delete_result.deleted_count > 0


# <<<< PHẦN BỔ SUNG MỚI >>>>
async def get_all_watchlists_admin(
    db: AsyncIOMotorDatabase,
    skip: int = 0,
    limit: int = 100,
    user_id_filter: Optional[PyObjectId] = None,
    name_filter: Optional[str] = None,
) -> Tuple[List[WatchlistInDB], int]:
    """
    Admin: Lấy danh sách tất cả watchlists với filter và phân trang.
    """
    query = {}
    if user_id_filter and ObjectId.is_valid(user_id_filter):
        query["user_id"] = ObjectId(user_id_filter)
    if name_filter:
        query["name"] = {"$regex": name_filter, "$options": "i"}  # Tìm kiếm tên không phân biệt hoa thường

    total_count = await db[WATCHLIST_COLLECTION].count_documents(query)
    watchlists_cursor = (
        db[WATCHLIST_COLLECTION]
        .find(query)
        .sort("created_at", -1)  # Sắp xếp theo ngày tạo mới nhất
        .skip(skip)
        .limit(limit)
    )
    watchlists_docs = await watchlists_cursor.to_list(length=limit)

    results: List[WatchlistInDB] = []
    for wl_doc in watchlists_docs:
        # Đảm bảo các ObjectId được chuyển thành str cho Pydantic
        if "user_id" in wl_doc and isinstance(wl_doc["user_id"], ObjectId):
            wl_doc["user_id"] = str(wl_doc["user_id"])
        # _id sẽ tự động được Pydantic xử lý qua alias
        results.append(WatchlistInDB(**wl_doc))

    return results, total_count


async def delete_watchlist_by_admin(db: AsyncIOMotorDatabase, watchlist_id: PyObjectId) -> bool:
    """
    Admin: Xóa một watchlist bất kỳ theo ID.
    """
    if not ObjectId.is_valid(watchlist_id):
        return False

    # Kiểm tra xem watchlist có tồn tại không trước khi xóa (tùy chọn, delete_one sẽ trả về 0 nếu không tìm thấy)
    # watchlist_to_delete = await get_watchlist_by_id(db, watchlist_id)
    # if not watchlist_to_delete:
    #     return False

    delete_result = await db[WATCHLIST_COLLECTION].delete_one({"_id": ObjectId(watchlist_id)})
    return delete_result.deleted_count > 0


# <<<< KẾT THÚC PHẦN BỔ SUNG MỚI >>>>

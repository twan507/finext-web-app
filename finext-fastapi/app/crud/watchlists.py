# app/crud/watchlists.py
import logging
from typing import List, Optional
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
        return None

    # Check if watchlist with the same name already exists for this user
    existing_watchlist = await db[WATCHLIST_COLLECTION].find_one(
        {"user_id": ObjectId(user_id), "name": watchlist_data.name}
    )
    if existing_watchlist:
        logger.warning(f"Watchlist with name '{watchlist_data.name}' already exists for user {user_id}.")
        raise ValueError(f"Bạn đã có một danh sách theo dõi với tên '{watchlist_data.name}'.")

    now = datetime.now(timezone.utc)
    watchlist_doc_to_insert = {
        "user_id": ObjectId(user_id),
        "name": watchlist_data.name,
        "stock_symbols": list(set(watchlist_data.stock_symbols)), # Ensure unique symbols
        "created_at": now,
        "updated_at": now,
    }
    try:
        result = await db[WATCHLIST_COLLECTION].insert_one(watchlist_doc_to_insert)
        if result.inserted_id:
            created_doc = await db[WATCHLIST_COLLECTION].find_one({"_id": result.inserted_id})
            if created_doc:
                return WatchlistInDB(**created_doc)
        return None
    except Exception as e:
        logger.error(f"Error creating watchlist for user {user_id}: {e}", exc_info=True)
        return None

async def get_watchlist_by_id(db: AsyncIOMotorDatabase, watchlist_id: PyObjectId) -> Optional[WatchlistInDB]:
    if not ObjectId.is_valid(watchlist_id):
        return None
    watchlist_doc = await db[WATCHLIST_COLLECTION].find_one({"_id": ObjectId(watchlist_id)})
    if watchlist_doc:
        return WatchlistInDB(**watchlist_doc)
    return None

async def get_watchlists_by_user_id(db: AsyncIOMotorDatabase, user_id: PyObjectId, skip: int = 0, limit: int = 100) -> List[WatchlistInDB]:
    if not ObjectId.is_valid(user_id):
        return []
    watchlists_cursor = db[WATCHLIST_COLLECTION].find({"user_id": ObjectId(user_id)}).sort("created_at", -1).skip(skip).limit(limit)
    watchlists = await watchlists_cursor.to_list(length=limit)
    return [WatchlistInDB(**wl) for wl in watchlists]

async def update_watchlist(
    db: AsyncIOMotorDatabase,
    watchlist_id: PyObjectId,
    user_id: PyObjectId, # Ensure the user owns the watchlist
    watchlist_update_data: WatchlistUpdate
) -> Optional[WatchlistInDB]:
    if not ObjectId.is_valid(watchlist_id) or not ObjectId.is_valid(user_id):
        return None

    existing_watchlist = await db[WATCHLIST_COLLECTION].find_one({
        "_id": ObjectId(watchlist_id),
        "user_id": ObjectId(user_id)
    })
    if not existing_watchlist:
        logger.warning(f"Watchlist {watchlist_id} not found or does not belong to user {user_id}")
        return None

    update_data = watchlist_update_data.model_dump(exclude_unset=True)
    if not update_data:
        return WatchlistInDB(**existing_watchlist) # No changes

    if "name" in update_data and update_data["name"] != existing_watchlist.get("name"):
        # Check if the new name already exists for this user (excluding the current watchlist)
        another_watchlist_with_same_name = await db[WATCHLIST_COLLECTION].find_one({
            "user_id": ObjectId(user_id),
            "name": update_data["name"],
            "_id": {"$ne": ObjectId(watchlist_id)}
        })
        if another_watchlist_with_same_name:
            raise ValueError(f"Bạn đã có một danh sách theo dõi khác với tên '{update_data['name']}'.")

    if "stock_symbols" in update_data and update_data["stock_symbols"] is not None:
        update_data["stock_symbols"] = list(set(update_data["stock_symbols"])) # Ensure unique

    update_data["updated_at"] = datetime.now(timezone.utc)

    updated_result = await db[WATCHLIST_COLLECTION].update_one(
        {"_id": ObjectId(watchlist_id)},
        {"$set": update_data}
    )
    if updated_result.matched_count > 0:
        updated_doc = await db[WATCHLIST_COLLECTION].find_one({"_id": ObjectId(watchlist_id)})
        if updated_doc:
            return WatchlistInDB(**updated_doc)
    return None

async def delete_watchlist(db: AsyncIOMotorDatabase, watchlist_id: PyObjectId, user_id: PyObjectId) -> bool:
    if not ObjectId.is_valid(watchlist_id) or not ObjectId.is_valid(user_id):
        return False
    delete_result = await db[WATCHLIST_COLLECTION].delete_one({
        "_id": ObjectId(watchlist_id),
        "user_id": ObjectId(user_id) # Ensure user owns it
    })
    return delete_result.deleted_count > 0
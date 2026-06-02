# finext-fastapi/app/crud/sse/_helpers.py
"""
Module chứa các helper functions và constants dùng chung cho SSE queries.
"""

import asyncio
import logging
from typing import Any, Dict, List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo.errors import PyMongoError, ExecutionTimeout

logger = logging.getLogger(__name__)

# ==============================================================================
# DATABASE CONFIGURATION
# ==============================================================================

# Định nghĩa các database names
STOCK_DB = "stock_db"
REF_DB = "ref_db"

# Cấu hình timeout và retry
MAX_RETRIES = 3
OPERATION_TIMEOUT_MS = 30000  # 30 giây
RETRY_DELAY_SECONDS = 1


# ==============================================================================
# HELPER FUNCTIONS
# ==============================================================================


async def get_collection_records(
    db: AsyncIOMotorDatabase,
    collection_name: str,
    find_query: Optional[Dict[str, Any]] = None,
    projection: Optional[Dict[str, Any]] = None,
    sort: Optional[List[tuple]] = None,
    limit: Optional[int] = None,
) -> List[Dict[str, Any]]:
    """
    Query MongoDB collection và trả thẳng list[dict] (raw documents).
    Có retry + timeout. Dùng cho hot path SSE (poll mỗi 3s).

    Args:
        db: Database connection.
        collection_name: Tên collection.
        find_query: Query filter (mặc định {}).
        projection: Projection fields (mặc định {"_id": 0}).
        sort: Sắp xếp kết quả (mặc định None).
        limit: Giới hạn số lượng records (mặc định None = không giới hạn).

    Raises:
        RuntimeError: Nếu không thể lấy dữ liệu sau MAX_RETRIES lần thử.
    """
    if find_query is None:
        find_query = {}
    if projection is None:
        projection = {"_id": 0}

    collection = db.get_collection(collection_name)
    last_exception = None

    for attempt in range(MAX_RETRIES):
        try:
            cursor = collection.find(find_query, projection)
            cursor.max_time_ms(OPERATION_TIMEOUT_MS)
            if sort:
                cursor.sort(sort)
            if limit:
                cursor.limit(limit)
            docs_list = await cursor.to_list(length=None)
            logger.debug(f"Successfully fetched {len(docs_list)} records from '{collection_name}'")
            return docs_list
        except ExecutionTimeout as e:
            last_exception = e
            logger.warning(f"Query timeout for '{collection_name}' (attempt {attempt + 1}/{MAX_RETRIES}): {e}")
        except PyMongoError as e:
            last_exception = e
            logger.error(f"MongoDB error for '{collection_name}' (attempt {attempt + 1}/{MAX_RETRIES}): {e}")
        except Exception as e:
            last_exception = e
            logger.error(f"Unexpected error for '{collection_name}' (attempt {attempt + 1}/{MAX_RETRIES}): {e}", exc_info=True)
        if attempt < MAX_RETRIES - 1:
            await asyncio.sleep(RETRY_DELAY_SECONDS)

    raise RuntimeError(
        f"Failed to fetch data from '{collection_name}' after {MAX_RETRIES} attempts. Last error: {last_exception}"
    ) from last_exception

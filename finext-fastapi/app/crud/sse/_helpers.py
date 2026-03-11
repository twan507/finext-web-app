# finext-fastapi/app/crud/sse/_helpers.py
"""
Module chứa các helper functions và constants dùng chung cho SSE queries.
"""

import asyncio
import logging
import pandas as pd
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


async def get_collection_data(
    db: AsyncIOMotorDatabase,
    collection_name: str,
    find_query: Optional[Dict[str, Any]] = None,
    projection: Optional[Dict[str, Any]] = None,
    sort: Optional[List[tuple]] = None,
    limit: Optional[int] = None,
) -> pd.DataFrame:
    """
    Helper function để query MongoDB collection với retry và timeout.

    Args:
        db: Database connection
        collection_name: Tên collection
        find_query: Query filter (mặc định {})
        projection: Projection fields (mặc định {"_id": 0})
        sort: Sắp xếp kết quả (mặc định None)
        limit: Giới hạn số lượng records (mặc định None = không giới hạn)

    Returns:
        DataFrame chứa dữ liệu từ collection

    Raises:
        RuntimeError: Nếu không thể lấy dữ liệu sau MAX_RETRIES lần thử
    """
    # Thiết lập giá trị mặc định
    if find_query is None:
        find_query = {}
    if projection is None:
        projection = {"_id": 0}

    collection = db.get_collection(collection_name)
    last_exception = None

    for attempt in range(MAX_RETRIES):
        try:
            # Tạo cursor với query và projection
            cursor = collection.find(find_query, projection)

            # Áp dụng timeout
            cursor.max_time_ms(OPERATION_TIMEOUT_MS)

            # Áp dụng sort nếu có
            if sort:
                cursor.sort(sort)

            # Áp dụng limit nếu có
            if limit:
                cursor.limit(limit)

            # Lấy dữ liệu
            docs_list = await cursor.to_list(length=None)

            # Chuyển đổi sang DataFrame
            df = pd.DataFrame(docs_list)

            logger.debug(f"Successfully fetched {len(df)} documents from '{collection_name}'")
            return df

        except ExecutionTimeout as e:
            last_exception = e
            logger.warning(f"Query timeout for '{collection_name}' (attempt {attempt + 1}/{MAX_RETRIES}): {e}")
            if attempt < MAX_RETRIES - 1:
                logger.info(f"Retrying after {RETRY_DELAY_SECONDS} seconds...")
                await asyncio.sleep(RETRY_DELAY_SECONDS)

        except PyMongoError as e:
            last_exception = e
            logger.error(f"MongoDB error for '{collection_name}' (attempt {attempt + 1}/{MAX_RETRIES}): {e}")
            if attempt < MAX_RETRIES - 1:
                logger.info(f"Retrying after {RETRY_DELAY_SECONDS} seconds...")
                await asyncio.sleep(RETRY_DELAY_SECONDS)

        except Exception as e:
            last_exception = e
            logger.error(f"Unexpected error for '{collection_name}' (attempt {attempt + 1}/{MAX_RETRIES}): {e}", exc_info=True)
            if attempt < MAX_RETRIES - 1:
                logger.info(f"Retrying after {RETRY_DELAY_SECONDS} seconds...")
                await asyncio.sleep(RETRY_DELAY_SECONDS)

    # Nếu tất cả các lần thử đều thất bại
    if last_exception:
        raise RuntimeError(
            f"Failed to fetch data from '{collection_name}' after {MAX_RETRIES} attempts. Last error: {last_exception}"
        ) from last_exception
    else:
        raise RuntimeError(f"Failed to fetch data from '{collection_name}' after {MAX_RETRIES} attempts (unknown reason).")

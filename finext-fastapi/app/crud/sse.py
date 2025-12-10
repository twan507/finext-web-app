# finext-fastapi/app/crud/sse.py
"""
Module chứa các hàm query dữ liệu cho SSE stream.
Mỗi keyword sẽ tương ứng với một hàm query riêng biệt.
"""

import asyncio
import logging
import pandas as pd
from typing import Any, Dict, List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo.errors import PyMongoError, ExecutionTimeout

logger = logging.getLogger(__name__)

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
) -> pd.DataFrame:
    """
    Helper function để query MongoDB collection với retry và timeout.

    Args:
        db: Database connection
        collection_name: Tên collection
        find_query: Query filter (mặc định {})
        projection: Projection fields (mặc định {"_id": 0})
        sort: Sắp xếp kết quả (mặc định None)

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


# ==============================================================================
# QUERY FUNCTIONS - Thêm các hàm query mới tại đây
# ==============================================================================


async def eod_market_index_chart(db: AsyncIOMotorDatabase, ticker: Optional[str] = None) -> List[Dict]:
    """Lấy dữ liệu index theo ticker. Nếu không truyền ticker thì lấy tất cả."""
    projection = {"_id": 0, "ticker": 1, "date": 1, "open": 1, "high": 1, "low": 1, "close": 1, "volume": 1, 'diff': 1, 'pct_change': 1}

    # Nếu có ticker thì filter, không thì lấy tất cả
    find_query = {"ticker": {"$in": [ticker]}} if ticker else {}

    # Lấy dữ liệu từ 2 collection dưới dạng DataFrame
    today_df = await get_collection_data(db, "today_index", find_query=find_query, projection=projection)
    history_df = await get_collection_data(db, "history_index", find_query=find_query, projection=projection)

    # Gộp và sắp xếp DataFrame
    combined_df = pd.concat([history_df, today_df], ignore_index=True)

    # Sắp xếp theo date giảm dần
    if not combined_df.empty and "date" in combined_df.columns:
        combined_df = combined_df.sort_values(by="date", ascending=False)

    # Chuyển đổi DataFrame về JSON (List[Dict])
    return combined_df.to_dict(orient="records")


async def itd_market_index_chart(db: AsyncIOMotorDatabase, ticker: Optional[str] = None) -> List[Dict]:
    """Lấy dữ liệu index theo ticker. Nếu không truyền ticker thì lấy tất cả."""
    projection = {"_id": 0, "ticker": 1, "date": 1, "open": 1, "high": 1, "low": 1, "close": 1, "volume": 1, 'diff': 1, 'pct_change': 1}

    # Nếu có ticker thì filter, không thì lấy tất cả
    find_query = {"ticker": {"$in": [ticker]}} if ticker else {}

    # Lấy dữ liệu từ collection dưới dạng DataFrame
    today_df = await get_collection_data(db, "itd_index", find_query=find_query, projection=projection)

    # Sắp xếp theo date giảm dần
    if not today_df.empty and "date" in today_df.columns:
        today_df = today_df.sort_values(by="date", ascending=False)

    # Chuyển đổi DataFrame về JSON (List[Dict])
    return today_df.to_dict(orient="records")


# ==============================================================================
# REGISTRY - Đăng ký các keyword và hàm query tương ứng
# ==============================================================================

SSE_QUERY_REGISTRY: Dict[str, Any] = {
    # Index queries
    "eod_market_index_chart": eod_market_index_chart,
    "itd_market_index_chart": itd_market_index_chart,
}


def get_available_keywords() -> List[str]:
    """Lấy danh sách tất cả các keyword có sẵn."""
    return list(SSE_QUERY_REGISTRY.keys())


async def execute_sse_query(keyword: str, db: AsyncIOMotorDatabase, ticker: Optional[str] = None) -> List[Dict]:
    """
    Thực thi query dựa trên keyword.

    Args:
        keyword: Từ khóa xác định loại query
        db: Database connection
        ticker: Mã ticker (VD: VNINDEX, VN30, ...)

    Returns:
        List các document từ database

    Raises:
        ValueError: Nếu keyword không hợp lệ
    """
    if keyword not in SSE_QUERY_REGISTRY:
        available = ", ".join(get_available_keywords())
        raise ValueError(f"Keyword '{keyword}' không hợp lệ. Các keyword có sẵn: {available}")

    query_func = SSE_QUERY_REGISTRY[keyword]
    logger.debug(f"Executing SSE query for keyword: {keyword}, ticker: {ticker}")

    # Gọi hàm query với ticker nếu có
    if ticker:
        return await query_func(db, ticker)
    else:
        return await query_func(db)

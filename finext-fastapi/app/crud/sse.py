# finext-fastapi/app/crud/sse.py
"""
Module chứa các hàm query dữ liệu cho SSE stream.
Mỗi keyword sẽ tương ứng với một hàm query riêng biệt.
Mỗi hàm tự chọn database phù hợp.
"""

import asyncio
import logging
import pandas as pd
from typing import Any, Dict, List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo.errors import PyMongoError, ExecutionTimeout

from app.core.database import get_database

logger = logging.getLogger(__name__)

# ==============================================================================
# DATABASE CONFIGURATION
# ==============================================================================

# Định nghĩa các database names
DB_TEMP_STOCK = "temp_stock"
DB_TEMP_REF = "temp_ref"

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


async def eod_market_index_chart(ticker: Optional[str] = None) -> List[Dict]:
    """Lấy dữ liệu EOD index theo ticker. Database: temp_stock."""
    stock_db = get_database(DB_TEMP_STOCK)

    # Lấy dữ liệu từ 2 collection dưới dạng DataFrame
    if ticker not in ["all_stock", "top100", "large", "mid", "small"]:
        projection = {"_id": 0, "ticker": 1, "date": 1, "open": 1, "high": 1, "low": 1, "close": 1, "volume": 1, "diff": 1, "pct_change": 1}
        find_query = {"ticker": {"$in": [ticker]}} if ticker else {}
        today_df = await get_collection_data(stock_db, "today_index", find_query=find_query, projection=projection)
        history_df = await get_collection_data(stock_db, "history_index", find_query=find_query, projection=projection)
        combined_df = pd.concat([history_df, today_df], ignore_index=True)
    else:
        projection = {"_id": 0,"ticker": 1,"date": 1,"open": 1,"high": 1,"low": 1,"close": 1,"volume": 1,"diff": 1,"pct_change": 1,"ticker_name": 1}
        find_query = {"ticker": {"$in": [ticker]}} if ticker else {}
        today_df = await get_collection_data(stock_db, "today_group", find_query=find_query, projection=projection)
        history_df = await get_collection_data(stock_db, "history_group", find_query=find_query, projection=projection)
        combined_df = pd.concat([history_df, today_df], ignore_index=True)
        combined_df["ticker"] = combined_df.pop("ticker_name")

    # Chuyển đổi DataFrame về JSON (List[Dict])
    return combined_df.to_dict(orient="records")


async def itd_market_index_chart(ticker: Optional[str] = None) -> List[Dict]:
    """Lấy dữ liệu ITD index theo ticker. Database: temp_stock."""
    stock_db = get_database(DB_TEMP_STOCK)

    # ITD chỉ cần close để vẽ line chart, không cần open/high/low
    if ticker not in ["all_stock", "top100", "large", "mid", "small"]:
        projection = {"_id": 0, "ticker": 1, "date": 1, "close": 1, "volume": 1, "diff": 1, "pct_change": 1}
        find_query = {"ticker": {"$in": [ticker]}} if ticker else {}
        itd_df = await get_collection_data(stock_db, "itd_index", find_query=find_query, projection=projection)
    else:
        projection = {"_id": 0, "ticker": 1, "date": 1, "close": 1, "volume": 1, "diff": 1, "pct_change": 1, "ticker_name": 1}
        find_query = {"ticker": {"$in": [ticker]}} if ticker else {}
        itd_df = await get_collection_data(stock_db, "itd_group", find_query=find_query, projection=projection)
        if not itd_df.empty and "ticker_name" in itd_df.columns:
            itd_df["ticker"] = itd_df.pop("ticker_name")

    # Chuyển đổi DataFrame về JSON (List[Dict])
    return itd_df.to_dict(orient="records")


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


async def execute_sse_query(keyword: str, ticker: Optional[str] = None) -> List[Dict]:
    """
    Thực thi query dựa trên keyword.
    Mỗi hàm query sẽ tự chọn database phù hợp.

    Args:
        keyword: Từ khóa xác định loại query
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
        return await query_func(ticker)
    else:
        return await query_func()

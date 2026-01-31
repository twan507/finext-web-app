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


async def home_itd_index(ticker: Optional[str] = None, **kwargs) -> Dict[str, Any]:
    """Lấy dữ liệu ITD index theo ticker. Database: temp_stock."""
    stock_db = get_database(STOCK_DB)

    # ITD chỉ cần close để vẽ line chart, không cần open/high/low
    projection = {"_id": 0, "ticker": 1, "ticker_name": 1, "date": 1, "close": 1, "volume": 1, "diff": 1, "pct_change": 1}
    find_query = {"ticker": ticker} if ticker else {}
    itd_df = await get_collection_data(stock_db, "itd_index", find_query=find_query, projection=projection)

    # Chuyển đổi DataFrame về JSON (List[Dict]) - không cần pagination cho ITD
    return itd_df.to_dict(orient="records")


async def home_today_index(ticker: Optional[str] = None, **kwargs) -> Dict[str, Any]:
    """
    Lấy dữ liệu today của TẤT CẢ indexes trong 1 lần gọi.
    Không cần ticker param - query tất cả theo group.

    Returns:
        List[Dict] - danh sách các records từ today_index
    """
    stock_db = get_database(STOCK_DB)

    # Query today_index collection
    projection = {
        "_id": 0,
        "ticker": 1,
        "ticker_name": 1,
        "date": 1,
        "open": 1,
        "high": 1,
        "low": 1,
        "close": 1,
        "volume": 1,
        "diff": 1,
        "pct_change": 1,
        "type": 1,
    }
    find_query = {}
    today_df = await get_collection_data(stock_db, "today_index", find_query=find_query, projection=projection)

    return today_df.to_dict(orient="records")


async def home_hist_index(ticker: Optional[str] = None, **kwargs) -> Dict[str, Any]:
    """
    Lấy dữ liệu history index theo ticker (chỉ history, không bao gồm today).
    Database: temp_stock.
    """
    stock_db = get_database(STOCK_DB)

    projection = {
        "_id": 0,
        "ticker": 1,
        "ticker_name": 1,
        "date": 1,
        "open": 1,
        "high": 1,
        "low": 1,
        "close": 1,
        "volume": 1,
        "diff": 1,
        "pct_change": 1,
        "type": 1,
    }
    find_query = {"ticker": ticker} if ticker else {}
    history_df = await get_collection_data(stock_db, "history_index", find_query=find_query, projection=projection)

    # Chuyển đổi DataFrame về JSON (List[Dict])
    return history_df.to_dict(orient="records")


async def news_categories(**kwargs) -> Dict[str, Any]:
    """
    Lấy danh sách tất cả categories duy nhất từ collection news_daily.
    Database: temp_stock.

    Returns:
        Dict chứa danh sách categories với category và category_name
    """
    stock_db = get_database(STOCK_DB)
    collection = stock_db.get_collection("news_daily")

    # Sử dụng aggregation để lấy distinct categories
    pipeline = [
        # Match documents có category và category_name
        {"$match": {"category": {"$exists": True, "$ne": None}, "category_name": {"$exists": True, "$ne": None}}},
        # Group by category để lấy unique values
        {"$group": {"_id": {"category": "$category", "category_name": "$category_name"}}},
        # Project ra format mong muốn
        {"$project": {"_id": 0, "category": "$_id.category", "category_name": "$_id.category_name"}},
        # Sort theo category_name
        {"$sort": {"category_name": 1}},
    ]

    cursor = collection.aggregate(pipeline)
    categories = await cursor.to_list(length=None)

    return {
        "items": categories,
        "total": len(categories),
    }


async def home_today_stock(ticker: Optional[str] = None, **kwargs) -> Dict[str, Any]:
    """
    Lấy dữ liệu today của các mã cổ phiếu (stocks).
    Database: temp_stock.
    Collection: today_stock.
    """
    stock_db = get_database(STOCK_DB)

    projection = {
        "_id": 0,
        "ticker": 1,
        "exchange": 1,
        "open": 1,
        "high": 1,
        "low": 1,
        "close": 1,
        "volume": 1,
        "industry_name": 1,
        "pct_change": 1,
        "t0_score": 1,
        "top100": 1,
        "vsi": 1,
    }

    find_query = {"ticker": ticker} if ticker else {}

    # Nếu không có ticker, có thể cần limit hoặc filter gì đó để tránh lấy ALL stocks nếu collection quá lớn
    # Nhưng theo yêu cầu chỉ là lấy dữ liệu, ta cứ lấy hết nếu không có ticker, hoặc theo logic hiện tại

    today_df = await get_collection_data(stock_db, "today_stock", find_query=find_query, projection=projection)

    return today_df.to_dict(orient="records")


async def home_nn_stock(ticker: Optional[str] = None, **kwargs) -> Dict[str, Any]:
    """
    Lấy dữ liệu nước ngoài (NN) trading.
    1. Lấy max date từ ref_db.date_series.
    2. Query stock_db.nntd_stock với type='NN' và date=max_date.
    """
    # 1. Lấy max date từ ref_db
    ref_db = get_database(REF_DB)

    # Query date_series, sort date desc, limit 1
    date_series_df = await get_collection_data(ref_db, "date_series", find_query={}, projection={"date": 1, "_id": 0}, sort=[("date", -1)])

    if date_series_df.empty:
        logger.warning("No date found in ref_db.date_series")
        return []

    # Lấy max_date (giả sử format date giống nhau giữa 2 collection)
    max_date = date_series_df.iloc[0]["date"]
    logger.debug(f"Max date from ref_db.date_series: {max_date}")

    # 2. Query stock_db.nntd_stock
    stock_db = get_database(STOCK_DB)

    projection = {
        "_id": 0,
        "date": 1,
        "ticker": 1,
        "sell_volume": 1,
        "buy_volume": 1,
        "sell_value": 1,
        "buy_value": 1,
        "net_volume": 1,
        "net_value": 1,
        "type": 1,
    }

    find_query = {"type": "NN", "date": max_date}
    if ticker:
        find_query["ticker"] = ticker

    nntd_df = await get_collection_data(stock_db, "nntd_stock", find_query=find_query, projection=projection)

    return nntd_df.to_dict(orient="records")


async def news_daily(
    ticker: Optional[str] = None,
    source: Optional[str] = None,
    category: Optional[str] = None,
    page: Optional[int] = None,
    limit: Optional[int] = None,
    sort_by: Optional[str] = None,
    sort_order: Optional[str] = None,
    **kwargs,
) -> Dict[str, Any]:
    """
    Lấy dữ liệu tin tức từ collection news_daily với hỗ trợ pagination.
    Database: temp_stock.

    Args:
        ticker: Mã ticker để filter (tuỳ chọn)
        source: Nguồn tin để filter (VD: chinhphu.vn, cafef.vn, vietstock.vn)
        category: Danh mục tin tức để filter (VD: thi-truong, doanh-nghiep)
        page: Số trang (bắt đầu từ 1)
        limit: Số lượng bản ghi mỗi trang
        sort_by: Tên field để sắp xếp (mặc định: created_at)
        sort_order: Thứ tự sắp xếp: asc hoặc desc (mặc định: desc)

    Returns:
        Dict chứa data và pagination info
    """
    stock_db = get_database(STOCK_DB)
    collection = stock_db.get_collection("news_daily")

    # Build query
    find_query = {}
    if ticker:
        # Filter theo tickers array
        find_query["tickers"] = ticker
    if source:
        find_query["source"] = source
    if category:
        find_query["category"] = category

    # Đếm tổng số documents
    total = await collection.count_documents(find_query)

    # Xử lý pagination defaults
    page = page or 1
    limit = limit or 20
    skip = (page - 1) * limit

    # Xử lý sort - mặc định theo created_at giảm dần (tin mới nhất trước)
    sort_field = sort_by or "created_at"
    sort_direction = -1 if (sort_order or "desc") == "desc" else 1

    # Query với pagination
    projection = {"_id": 0}
    cursor = collection.find(find_query, projection)
    cursor.sort(sort_field, sort_direction)
    cursor.skip(skip)
    cursor.limit(limit)
    cursor.max_time_ms(OPERATION_TIMEOUT_MS)

    docs = await cursor.to_list(length=limit)

    # Tính pagination info
    total_pages = (total + limit - 1) // limit if limit > 0 else 1

    return {
        "items": docs,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "total_pages": total_pages,
            "has_next": page < total_pages,
            "has_prev": page > 1,
        },
    }


async def home_today_industry(ticker: Optional[str] = None, **kwargs) -> Dict[str, Any]:
    """
    Lấy dữ liệu today của TẤT CẢ industry trong 1 lần gọi.
    Query từ collection today_index với filter type='industry'.
    Database: temp_stock.
    """
    stock_db = get_database(STOCK_DB)

    projection = {
        "_id": 0,
        "ticker": 1,
        "ticker_name": 1,
        "date": 1,
        "close": 1,
        "volume": 1,
        "diff": 1,
        "pct_change": 1,
        "type": 1,
    }
    # Filter theo type='industry'
    find_query = {"type": "industry"}
    today_df = await get_collection_data(stock_db, "today_index", find_query=find_query, projection=projection)

    return today_df.to_dict(orient="records")


async def home_hist_industry(ticker: Optional[str] = None, **kwargs) -> Dict[str, Any]:
    """
    Lấy dữ liệu history của industry theo ticker.
    Query từ collection history_index với filter type='industry'.
    Database: temp_stock.
    """
    stock_db = get_database(STOCK_DB)

    projection = {
        "_id": 0,
        "ticker": 1,
        "ticker_name": 1,
        "date": 1,
        "open": 1,
        "high": 1,
        "low": 1,
        "close": 1,
        "volume": 1,
        "diff": 1,
        "pct_change": 1,
        "type": 1,
    }
    # Filter theo type='industry' và ticker nếu có
    find_query = {"type": "industry"}
    if ticker:
        find_query["ticker"] = ticker

    history_df = await get_collection_data(stock_db, "history_index", find_query=find_query, projection=projection)

    return history_df.to_dict(orient="records")


# ==============================================================================
# NEWS REPORT QUERIES - Bản tin từ collection news_report
# ==============================================================================


async def news_report_categories(**kwargs) -> Dict[str, Any]:
    """
    Lấy danh sách tất cả categories duy nhất từ collection news_report.
    Database: temp_stock.

    Returns:
        Dict chứa danh sách categories
    """
    stock_db = get_database(STOCK_DB)
    collection = stock_db.get_collection("news_report")

    # Sử dụng aggregation để lấy distinct categories với category_name
    pipeline = [
        # Match documents có category
        {"$match": {"category": {"$exists": True, "$ne": None}}},
        # Group by category và category_name
        {"$group": {"_id": "$category", "category_name": {"$first": "$category_name"}}},
        # Project ra format mong muốn
        {"$project": {"_id": 0, "category": "$_id", "category_name": 1}},
        # Sort theo category
        {"$sort": {"category": 1}},
    ]

    cursor = collection.aggregate(pipeline)
    categories = await cursor.to_list(length=None)

    return {
        "items": categories,
        "total": len(categories),
    }


async def news_report(
    category: Optional[str] = None,
    page: Optional[int] = None,
    limit: Optional[int] = None,
    sort_by: Optional[str] = None,
    sort_order: Optional[str] = None,
    **kwargs,
) -> Dict[str, Any]:
    """
    Lấy dữ liệu bản tin từ collection news_report với hỗ trợ pagination.
    Database: temp_stock.

    Args:
        category: Category để filter (VD: baochinhphu)
        page: Số trang (bắt đầu từ 1)
        limit: Số lượng bản ghi mỗi trang
        sort_by: Tên field để sắp xếp (mặc định: created_at)
        sort_order: Thứ tự sắp xếp: asc hoặc desc (mặc định: desc)

    Returns:
        Dict chứa data và pagination info
    """
    stock_db = get_database(STOCK_DB)
    collection = stock_db.get_collection("news_report")

    # Build query
    find_query = {}
    if category:
        find_query["category"] = category

    # Đếm tổng số documents
    total = await collection.count_documents(find_query)

    # Xử lý pagination defaults
    page = page or 1
    limit = limit or 20
    skip = (page - 1) * limit

    # Xử lý sort - mặc định theo created_at giảm dần (tin mới nhất trước)
    sort_field = sort_by or "created_at"
    sort_direction = -1 if (sort_order or "desc") == "desc" else 1

    # Query với pagination
    projection = {"_id": 0}
    cursor = collection.find(find_query, projection)
    cursor.sort(sort_field, sort_direction)
    cursor.skip(skip)
    cursor.limit(limit)
    cursor.max_time_ms(OPERATION_TIMEOUT_MS)

    docs = await cursor.to_list(length=limit)

    # Tính pagination info
    total_pages = (total + limit - 1) // limit if limit > 0 else 1

    return {
        "items": docs,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "total_pages": total_pages,
            "has_next": page < total_pages,
            "has_prev": page > 1,
        },
    }


# ==============================================================================
# REGISTRY - Đăng ký các keyword và hàm query tương ứng
# ==============================================================================

SSE_QUERY_REGISTRY: Dict[str, Any] = {
    # Index queries
    "home_today_index": home_today_index,
    "home_itd_index": home_itd_index,
    "home_hist_index": home_hist_index,
    # Stock queries
    "home_today_stock": home_today_stock,
    "home_nn_stock": home_nn_stock,
    # News queries
    "news_daily": news_daily,
    "news_categories": news_categories,
    # News report queries
    "news_report": news_report,
    "news_report_categories": news_report_categories,
}


def get_available_keywords() -> List[str]:
    """Lấy danh sách tất cả các keyword có sẵn."""
    return list(SSE_QUERY_REGISTRY.keys())


async def execute_sse_query(
    keyword: str,
    ticker: Optional[str] = None,
    source: Optional[str] = None,
    category: Optional[str] = None,
    page: Optional[int] = None,
    limit: Optional[int] = None,
    sort_by: Optional[str] = None,
    sort_order: Optional[str] = None,
    **kwargs,
) -> Dict[str, Any]:
    """
    Thực thi query dựa trên keyword.
    Mỗi hàm query sẽ tự chọn database phù hợp.

    Args:
        keyword: Từ khóa xác định loại query
        ticker: Mã ticker (VD: VNINDEX, VN30, ...)
        source: Nguồn tin (VD: chinhphu.vn, cafef.vn, ...)
        category: Danh mục tin tức hoặc bản tin (VD: thi-truong, baochinhphu)
        page: Số trang (bắt đầu từ 1)
        limit: Số lượng bản ghi mỗi trang
        sort_by: Tên field để sắp xếp
        sort_order: Thứ tự sắp xếp (asc/desc)

    Returns:
        Dict chứa data và pagination info (nếu có)

    Raises:
        ValueError: Nếu keyword không hợp lệ
    """
    if keyword not in SSE_QUERY_REGISTRY:
        available = ", ".join(get_available_keywords())
        raise ValueError(f"Keyword '{keyword}' không hợp lệ. Các keyword có sẵn: {available}")

    query_func = SSE_QUERY_REGISTRY[keyword]
    logger.debug(
        f"Executing SSE query for keyword: {keyword}, ticker: {ticker}, source: {source}, category: {category}, page: {page}, limit: {limit}"
    )

    # Tạo dict params để truyền vào hàm query
    query_params = {
        "ticker": ticker,
        "source": source,
        "category": category,
        "page": page,
        "limit": limit,
        "sort_by": sort_by,
        "sort_order": sort_order,
    }

    # Gọi hàm query với các params
    return await query_func(**query_params)

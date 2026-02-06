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


async def news_categories(
    news_type: Optional[str] = None,
    **kwargs,
) -> Dict[str, Any]:
    """
    Lấy danh sách tất cả categories duy nhất từ collection news_daily.
    Có thể filter theo news_type (thong_cao, trong_nuoc, doanh_nghiep, quoc_te).
    Database: temp_stock.

    Args:
        news_type: Loại tin tức để filter (VD: thong_cao, trong_nuoc, doanh_nghiep, quoc_te)

    Returns:
        Dict chứa danh sách categories với category và category_name
    """
    stock_db = get_database(STOCK_DB)
    collection = stock_db.get_collection("news_daily")

    # Build match query
    match_query = {"category": {"$exists": True, "$ne": None}, "category_name": {"$exists": True, "$ne": None}}
    if news_type:
        match_query["news_type"] = news_type

    # Sử dụng aggregation để lấy distinct categories
    pipeline = [
        # Match documents có category và category_name (và filter theo news_type nếu có)
        {"$match": match_query},
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
        "vsi": 1,
        "vsma5": 1,
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
    news_type: Optional[str] = None,
    categories: Optional[str] = None,
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
        news_type: Loại tin tức để filter (VD: thong_cao, trong_nuoc, doanh_nghiep, quoc_te)
        categories: Danh mục để filter, có thể 1 hoặc nhiều cách nhau bởi dấu phẩy (VD: thi-truong hoặc thi-truong,doanh-nghiep)
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
    if news_type:
        find_query["news_type"] = news_type

    # Hỗ trợ multiple categories với $in operator
    if categories:
        # Parse comma-separated string to list
        category_list = [c.strip() for c in categories.split(",") if c.strip()]
        if len(category_list) == 1:
            find_query["category"] = category_list[0]
        elif len(category_list) > 1:
            find_query["category"] = {"$in": category_list}

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
# NEWS REPORT QUERIES - Báo cáo từ collection news_report
# ==============================================================================


async def news_count(
    type: Optional[str] = None,
    **kwargs,
) -> Dict[str, Any]:
    """
    Đếm số lượng tin tức theo type.
    - Tin tức (news_daily): đếm ngày hôm nay
    - Báo cáo (news_report): đếm ngày hôm qua
    Chỉ lấy các field cần thiết để đếm, không lấy nội dung.
    Database: temp_stock.

    Args:
        type: Loại tin tức để filter (VD: thong_cao, trong_nuoc, doanh_nghiep, quoc_te)
              Nếu không truyền sẽ trả về tất cả types

    Returns:
        Dict chứa count theo từng type và tổng
    """
    from datetime import datetime, timezone, timedelta

    stock_db = get_database(STOCK_DB)

    # Lấy thời gian theo timezone Vietnam (UTC+7)
    vietnam_offset = timedelta(hours=7)
    vietnam_tz = timezone(vietnam_offset)
    now = datetime.now(vietnam_tz)

    # Ngày hôm nay (cho tin tức)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_start_str = today_start.isoformat()

    # Ngày hôm qua (cho bản tin)
    yesterday = now - timedelta(days=1)
    yesterday_start = yesterday.replace(hour=0, minute=0, second=0, microsecond=0)
    yesterday_start_str = yesterday_start.isoformat()

    logger.info(f"[news_count] Current time (VN): {now.isoformat()}")
    logger.info(f"[news_count] Today start (VN): {today_start_str}")
    logger.info(f"[news_count] Yesterday start (VN): {yesterday_start_str}")

    result = {
        "date": now.strftime("%Y-%m-%d"),
        "today_start": today_start_str,
        "sources": {},
        "total": 0,
        "debug": {},
    }

    # Đếm tin từ news_daily
    news_collection = stock_db.get_collection("news_daily")

    # Các loại tin cần đếm
    news_types = ["thong_cao", "trong_nuoc", "doanh_nghiep", "quoc_te"]

    if type:
        news_types = [type]

    for news_type in news_types:
        # Query đếm tin trong ngày hôm nay theo news_type (tin tức từ news_daily)
        count_query = {"news_type": news_type, "created_at": {"$gte": today_start_str}}
        count = await news_collection.count_documents(count_query)
        result["sources"][news_type] = count
        result["total"] += count
        logger.info(f"[news_count] Type '{news_type}': {count} articles (query: created_at >= {today_start_str})")

        # Debug: lấy tin mới nhất để xem
        newest_doc = await news_collection.find_one({"news_type": news_type}, {"created_at": 1, "_id": 0}, sort=[("created_at", -1)])
        if newest_doc:
            newest_created_at = newest_doc.get("created_at")
            result["debug"][f"{news_type}_newest"] = newest_created_at
            logger.info(f"[news_count] Newest article for '{news_type}': {newest_created_at}")

            # Test: đếm tất cả tin có created_at >= newest - 1 ngày
            if count == 0:
                # Thử parse và so sánh
                try:
                    from datetime import datetime

                    # Parse newest_created_at
                    if isinstance(newest_created_at, str):
                        # Thử lấy tổng số tin của news_type này
                        total_type = await news_collection.count_documents({"news_type": news_type})
                        logger.info(f"[news_count] Total articles for '{news_type}': {total_type}")
                except Exception as e:
                    logger.error(f"[news_count] Error parsing date: {e}")

    # Đếm báo cáo từ news_report - LÙI 1 NGÀY (nếu không filter theo type cụ thể của news_daily)
    if not type or type == "news_report":
        report_collection = stock_db.get_collection("news_report")
        report_count_query = {
            "created_at": {"$gte": yesterday_start_str}  # Dùng yesterday cho bản tin
        }
        report_count = await report_collection.count_documents(report_count_query)
        result["sources"]["news_report"] = report_count
        result["total"] += report_count
        logger.info(f"[news_count] news_report: {report_count} reports (query: created_at >= {yesterday_start_str})")

        # Debug sample
        if report_count == 0:
            sample_report = await report_collection.find_one({}, {"created_at": 1, "_id": 0})
            if sample_report:
                logger.info(f"[news_count] Sample created_at for 'news_report': {sample_report.get('created_at')}")

    return result


async def news_report_categories(
    report_type: Optional[str] = None,
    **kwargs,
) -> Dict[str, Any]:
    """
    Lấy danh sách tất cả categories duy nhất từ collection news_report.
    Có thể filter theo report_type (daily, weekly, monthly).
    Database: temp_stock.

    Args:
        report_type: Loại bản tin để filter (VD: daily, weekly, monthly)

    Returns:
        Dict chứa danh sách categories
    """
    stock_db = get_database(STOCK_DB)
    collection = stock_db.get_collection("news_report")

    # Build match query
    match_query = {"category": {"$exists": True, "$ne": None}}
    if report_type:
        match_query["report_type"] = report_type

    # Sử dụng aggregation để lấy distinct categories với category_name
    pipeline = [
        # Match documents có category (và filter theo report_type nếu có)
        {"$match": match_query},
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
    report_type: Optional[str] = None,
    categories: Optional[str] = None,
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
        report_type: Loại bản tin để filter (VD: daily, weekly, monthly)
        categories: Danh mục để filter, có thể 1 hoặc nhiều cách nhau bởi dấu phẩy (VD: trong_nuoc hoặc trong_nuoc,thong_cao)
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
    if report_type:
        find_query["report_type"] = report_type

    # Hỗ trợ multiple categories với $in operator
    if categories:
        # Parse comma-separated string to list
        category_list = [c.strip() for c in categories.split(",") if c.strip()]
        if len(category_list) == 1:
            find_query["category"] = category_list[0]
        elif len(category_list) > 1:
            find_query["category"] = {"$in": category_list}

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


async def phase_signal(ticker: Optional[str] = None, **kwargs) -> Dict[str, Any]:
    """
    Lấy dữ liệu phase signal từ collection phase_signal.
    Database: temp_stock.

    Args:
        ticker: Mã ticker để filter (optional)

    Returns:
        List[Dict] - danh sách các records từ phase_signal (không bao gồm _id)
    """
    stock_db = get_database(STOCK_DB)

    projection = {
        "_id": 0,
        "date": 1,
        "final_phase": 1,
        "pct_change": 1,
        "pct_return": 1,
        "buy_index_change": 1,
        "buy_ratio_change": 1,
        "buy_ms_score_stt": 1,
        "buy_vsi_volume_stt": 1,
        "buy_ms_value": 1,
        "buy_ms_diff": 1,
        "buy_ratio_strength": 1,
        "buy_ratio_value": 1,
        "sell_ratio_change": 1,
        "sell_ms_score_stt": 1,
        "sell_vsi_volume_stt": 1,
        "sell_ms_value": 1,
        "sell_ms_diff": 1,
        "sell_ratio_strength": 1,
        "sell_ratio_value": 1,
    }

    find_query = {"ticker": ticker} if ticker else {}
    phase_df = await get_collection_data(stock_db, "phase_signal", find_query=find_query, projection=projection)

    return phase_df.to_dict(orient="records")


# ==============================================================================
# NEWS ARTICLE QUERY - Lấy 1 bài viết theo slug
# ==============================================================================


async def news_article(
    article_slug: Optional[str] = None,
    **kwargs,
) -> Dict[str, Any]:
    """
    Lấy thông tin 1 bài viết theo article_slug.
    Query trực tiếp từ DB theo field article_slug.
    Database: temp_stock.

    Args:
        article_slug: Slug của bài viết (URL-friendly title, đã lưu trong DB)

    Returns:
        Dict chứa thông tin bài viết hoặc None nếu không tìm thấy
    """
    if not article_slug:
        return {"article": None, "error": "article_slug is required"}

    stock_db = get_database(STOCK_DB)
    collection = stock_db.get_collection("news_daily")

    # Lấy đầy đủ thông tin cho hiển thị
    projection = {"_id": 0}

    # Query trực tiếp theo article_slug
    doc = await collection.find_one({"article_slug": article_slug}, projection)

    if doc:
        return {"article": doc}

    return {"article": None, "error": "Article not found"}


async def report_article(
    report_slug: Optional[str] = None,
    **kwargs,
) -> Dict[str, Any]:
    """
    Lấy thông tin 1 báo cáo theo report_slug.
    Query trực tiếp từ DB theo field report_slug.
    Database: temp_stock.

    Args:
        report_slug: Slug của báo cáo (URL-friendly title, đã lưu trong DB)

    Returns:
        Dict chứa thông tin báo cáo hoặc None nếu không tìm thấy
    """
    if not report_slug:
        return {"report": None, "error": "report_slug is required"}

    stock_db = get_database(STOCK_DB)
    collection = stock_db.get_collection("news_report")

    # Lấy đầy đủ thông tin cho hiển thị
    projection = {"_id": 0}

    # Query trực tiếp theo report_slug
    doc = await collection.find_one({"report_slug": report_slug}, projection)

    if doc:
        return {"report": doc}

    return {"report": None, "error": "Report not found"}


# ==============================================================================
# TREND QUERIES - Xu hướng thị trường
# ==============================================================================


async def home_history_trend(ticker: Optional[str] = None, **kwargs) -> Dict[str, Any]:
    """
    Lấy dữ liệu lịch sử xu hướng thị trường.
    Database: stock_db. Collection: history_trend.
    """
    stock_db = get_database(STOCK_DB)

    projection = {
        "_id": 0,
        "ticker": 1,
        "ticker_name": 1,
        "date": 1,
        "w_trend": 1,
        "m_trend": 1,
        "q_trend": 1,
        "y_trend": 1,
    }
    find_query = {"ticker": ticker} if ticker else {}
    history_trend_df = await get_collection_data(
        stock_db, "history_trend", find_query=find_query, projection=projection
    )

    return history_trend_df.to_dict(orient="records")


async def home_today_trend(ticker: Optional[str] = None, **kwargs) -> Dict[str, Any]:
    """
    Lấy dữ liệu xu hướng thị trường hôm nay.
    Database: stock_db. Collection: today_trend.
    """
    stock_db = get_database(STOCK_DB)

    projection = {
        "_id": 0,
        "ticker": 1,
        "ticker_name": 1,
        "date": 1,
        "w_trend": 1,
        "m_trend": 1,
        "q_trend": 1,
        "y_trend": 1,
    }
    find_query = {"ticker": ticker} if ticker else {}
    today_trend_df = await get_collection_data(
        stock_db, "today_trend", find_query=find_query, projection=projection
    )

    return today_trend_df.to_dict(orient="records")


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
    # Phase signal
    "phase_signal": phase_signal,
    # Trend queries
    "home_history_trend": home_history_trend,
    "home_today_trend": home_today_trend,
    # News queries
    "news_daily": news_daily,
    "news_categories": news_categories,
    "news_count": news_count,
    "news_article": news_article,
    # News report queries
    "news_report": news_report,
    "news_report_categories": news_report_categories,
    "report_article": report_article,
}


def get_available_keywords() -> List[str]:
    """Lấy danh sách tất cả các keyword có sẵn."""
    return list(SSE_QUERY_REGISTRY.keys())


async def execute_sse_query(
    keyword: str,
    ticker: Optional[str] = None,
    news_type: Optional[str] = None,
    report_type: Optional[str] = None,
    categories: Optional[str] = None,
    article_slug: Optional[str] = None,
    report_slug: Optional[str] = None,
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
        news_type: Loại tin tức (VD: thong_cao, trong_nuoc, doanh_nghiep, quoc_te)
        report_type: Loại bản tin (VD: daily, weekly, monthly)
        categories: Danh mục để filter, có thể 1 hoặc nhiều cách nhau bởi dấu phẩy
        article_slug: Slug của bài viết tin tức
        report_slug: Slug của báo cáo
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
        f"Executing SSE query for keyword: {keyword}, ticker: {ticker}, news_type: {news_type}, report_type: {report_type}, categories: {categories}, page: {page}, limit: {limit}"
    )

    # Tạo dict params để truyền vào hàm query
    query_params = {
        "ticker": ticker,
        "news_type": news_type,
        "report_type": report_type,
        "categories": categories,
        "article_slug": article_slug,
        "report_slug": report_slug,
        "page": page,
        "limit": limit,
        "sort_by": sort_by,
        "sort_order": sort_order,
    }

    # Gọi hàm query với các params
    return await query_func(**query_params)

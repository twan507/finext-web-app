# finext-fastapi/app/crud/sse/search_news.py
"""
Keyword: search_news
Tìm kiếm tin tức theo keyword (regex trên title) + tickers array.
Dùng cho REST endpoint, trả về tối đa 5 kết quả với dữ liệu tối giản.
"""
from typing import Any, Dict, Optional

from app.core.database import get_database
from app.crud.sse._helpers import STOCK_DB, OPERATION_TIMEOUT_MS


async def search_news(
    ticker: Optional[str] = None,
    search: Optional[str] = None,
    limit: Optional[int] = None,
    **kwargs,
) -> Dict[str, Any]:
    """
    Tìm kiếm tin tức theo:
    - `search`: keyword tìm kiếm trên field `title` (case-insensitive regex)
    - `ticker`: filter theo mã cổ phiếu trong field `tickers`
    Kết hợp AND nếu cả hai đều có.

    Projection tối giản: article_slug, title, news_type, created_at, tickers.
    Mặc định limit = 5, tối đa 10.

    Database: stock_db
    Collection: news_daily
    """
    stock_db = get_database(STOCK_DB)
    collection = stock_db.get_collection("news_daily")

    # Build query
    find_query: Dict[str, Any] = {}

    if search:
        # Case-insensitive match trên title HOẶC tickers chứa search term
        find_query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"tickers": {"$regex": f"^{search}", "$options": "i"}},
        ]

    if ticker:
        # Filter theo element trong mảng tickers (exact match)
        find_query["tickers"] = ticker

    # Default limit = 5, max = 10
    result_limit = min(limit or 5, 10)

    projection = {
        "_id": 0,
        "article_slug": 1,
        "title": 1,
        "news_type": 1,
        "created_at": 1,
        "tickers": 1,
    }

    cursor = collection.find(find_query, projection)
    cursor.sort("created_at", -1)
    cursor.limit(result_limit)
    cursor.max_time_ms(OPERATION_TIMEOUT_MS)

    docs = await cursor.to_list(length=result_limit)
    return docs

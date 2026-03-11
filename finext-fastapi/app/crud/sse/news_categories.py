# finext-fastapi/app/crud/sse/news_categories.py
from typing import Any, Dict, Optional

from app.core.database import get_database
from app.crud.sse._helpers import STOCK_DB


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

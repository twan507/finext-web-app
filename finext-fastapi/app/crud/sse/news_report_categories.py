# finext-fastapi/app/crud/sse/news_report_categories.py
from typing import Any, Dict, Optional

from app.core.database import get_database
from app.crud.sse._helpers import STOCK_DB


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

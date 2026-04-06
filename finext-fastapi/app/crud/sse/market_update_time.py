# finext-fastapi/app/crud/sse/market_update_time.py
"""
Keyword: market_update_time
Lấy thời gian cập nhật mới nhất của dữ liệu thị trường
bằng cách lấy max(date) từ itd_index với ticker = HNXINDEX.
"""
from typing import Any, Dict

from app.core.database import get_database
from app.crud.sse._helpers import STOCK_DB


async def market_update_time(**kwargs) -> Dict[str, Any]:
    """Lấy thời gian cập nhật mới nhất của dữ liệu thị trường. Database: stock_db."""
    stock_db = get_database(STOCK_DB)
    collection = stock_db.get_collection("itd_index")

    pipeline = [
        {"$match": {"ticker": "HNXINDEX"}},
        {"$group": {"_id": None, "max_date": {"$max": "$date"}}},
        {"$project": {"_id": 0, "update_time": "$max_date"}},
    ]

    result = await collection.aggregate(pipeline).to_list(length=1)
    if result:
        return result[0]
    return {"update_time": None}

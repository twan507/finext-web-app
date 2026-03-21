# finext-fastapi/app/crud/sse/screener_stock_meta.py
from typing import Dict, List

from app.core.database import get_database
from app.crud.sse._helpers import STOCK_DB


async def screener_stock_meta(**kwargs) -> Dict[str, List[str]]:
    """
    Lấy danh sách giá trị unique cho các dropdown filter của bộ lọc cổ phiếu.
    Database: stock_db.
    Collection: today_stock.

    Trả về dict chứa 4 danh sách:
        - exchange: các sàn giao dịch
        - industry_name: tên ngành
        - marketcap_name: nhóm vốn hóa
        - category_name: nhóm đặc biệt
    """
    stock_db = get_database(STOCK_DB)
    collection = stock_db.get_collection("today_stock")

    # Query distinct values song song
    import asyncio

    exchange_task = collection.distinct("exchange")
    industry_task = collection.distinct("industry_name")
    marketcap_task = collection.distinct("marketcap_name")
    category_task = collection.distinct("category_name")

    exchanges, industries, marketcaps, categories = await asyncio.gather(
        exchange_task, industry_task, marketcap_task, category_task
    )

    # Filter out None/null values and sort
    def clean_sort(values: List) -> List[str]:
        return sorted([v for v in values if v is not None and v != ""])

    return {
        "exchange": clean_sort(exchanges),
        "industry_name": clean_sort(industries),
        "marketcap_name": clean_sort(marketcaps),
        "category_name": clean_sort(categories),
    }

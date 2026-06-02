# finext-fastapi/app/crud/sse/chart_ticker.py
import asyncio
from typing import Any, Dict

from app.core.database import get_database
from app.crud.sse._helpers import get_collection_records, STOCK_DB
from app.crud.sse._constants import INDEX_TICKERS, _is_industry_ticker


async def chart_ticker(**kwargs) -> Dict[str, Any]:
    """
    Lấy danh sách tất cả ticker từ today_index và today_stock.
    Chỉ trả về ticker và ticker_name để phục vụ tìm kiếm.
    - INDEX_TICKERS: thêm suffix "CHỈ SỐ"
    - INDUSTRY_TICKERS: thêm suffix "CHỈ SỐ NGÀNH"

    Returns:
        List[Dict] - danh sách các ticker với ticker và ticker_name
    """
    stock_db = get_database(STOCK_DB)

    ticker_projection = {"_id": 0, "ticker": 1, "ticker_name": 1}

    # Query cả today_index và today_stock song song
    index_records, stock_records = await asyncio.gather(
        get_collection_records(stock_db, "today_index", find_query={}, projection=ticker_projection),
        get_collection_records(stock_db, "today_stock", find_query={}, projection=ticker_projection),
    )

    # Dedup theo ticker — index ưu tiên (insert trước). Dùng dict để giữ thứ tự + dedupe O(N).
    seen: Dict[str, Dict[str, Any]] = {}
    for rec in (*index_records, *stock_records):
        t = rec.get("ticker")
        if t and t not in seen:
            seen[t] = rec

    # Thêm prefix cho ticker_name dựa trên loại ticker
    result = []
    for ticker, rec in seen.items():
        ticker_name = rec.get("ticker_name")
        if _is_industry_ticker(ticker):
            display_name = f"Chỉ số ngành {ticker_name}"
        elif ticker.upper() in INDEX_TICKERS:
            display_name = f"Chỉ số {ticker_name}"
        else:
            display_name = ticker_name
        result.append({"ticker": ticker, "ticker_name": display_name})

    # Sort theo ticker
    result.sort(key=lambda x: x["ticker"])
    return result

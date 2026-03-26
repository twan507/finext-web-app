# finext-fastapi/app/crud/sse/search_stocks.py
"""
Keyword: search_stocks
Lấy danh sách cổ phiếu tối giản cho chức năng tìm kiếm toàn cục.
Dữ liệu tĩnh (không thay đổi thường xuyên), FE cache và filter client-side.
"""
from typing import Any, Dict, Optional

from app.core.database import get_database
from app.crud.sse._helpers import get_collection_data, STOCK_DB


async def search_stocks(
    ticker: Optional[str] = None,
    **kwargs,
) -> Dict[str, Any]:
    """
    Lấy danh sách tối giản tất cả cổ phiếu để hỗ trợ tìm kiếm client-side.
    Chỉ trả về các field cần thiết: ticker, ticker_name, exchange, industry_name, close, pct_change.
    FE sẽ cache và filter local khi user gõ keyword.

    Database: stock_db
    Collection: today_stock
    """
    stock_db = get_database(STOCK_DB)

    projection = {
        "_id": 0,
        "ticker": 1,
        "ticker_name": 1,
        "exchange": 1,
        "industry_name": 1,
        "close": 1,
        "pct_change": 1,
    }

    find_query = {"ticker": ticker} if ticker else {}

    today_df = await get_collection_data(
        stock_db,
        "today_stock",
        find_query=find_query,
        projection=projection,
    )

    return today_df.to_dict(orient="records")

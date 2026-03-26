# finext-fastapi/app/crud/sse/search_index.py
"""
Keyword: search_index
Lấy danh sách nhóm + ngành tối giản cho chức năng tìm kiếm toàn cục.
Gộp cả groups (type != industry) và sectors (type == industry) trong 1 lần gọi.
FE dùng field `type` để navigate đúng route: /groups/{ticker} hoặc /sectors/{ticker}.
"""
from typing import Any, Dict, Optional

from app.core.database import get_database
from app.crud.sse._helpers import get_collection_data, STOCK_DB


async def search_index(
    ticker: Optional[str] = None,
    **kwargs,
) -> Dict[str, Any]:
    """
    Lấy danh sách tối giản tất cả nhóm + ngành để hỗ trợ tìm kiếm client-side.
    Trả về: ticker, ticker_name, type, close, pct_change.
    - type != 'industry' → /groups/{ticker}
    - type == 'industry' → /sectors/{ticker}

    Database: stock_db
    Collection: today_index
    """
    stock_db = get_database(STOCK_DB)

    projection = {
        "_id": 0,
        "ticker": 1,
        "ticker_name": 1,
        "type": 1,
        "close": 1,
        "pct_change": 1,
    }

    find_query = {"ticker": ticker} if ticker else {}

    today_df = await get_collection_data(
        stock_db,
        "today_index",
        find_query=find_query,
        projection=projection,
    )

    return today_df.to_dict(orient="records")

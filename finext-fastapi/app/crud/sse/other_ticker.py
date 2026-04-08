from typing import Any, Dict, Optional

from app.core.database import get_database
from app.crud.sse._helpers import get_collection_data, STOCK_DB


async def other_ticker(ticker: Optional[str] = None, **kwargs) -> Dict[str, Any]:
    """
    Lấy dữ liệu lịch sử của other_ticker.
    """
    stock_db = get_database(STOCK_DB)

    projection = {
        "_id": 0,
        "date": 1,
        "ticker": 1,
        "close": 1,
        "unit": 1,
        "ticker_name": 1,
        "pct_change": 1,
        "w_pct": 1,
        "m_pct": 1,
        "q_pct": 1,
        "y_pct": 1,
        "update_date": 1,
        "chart": 1,
        "name": 1,
        "group": 1,
        "category": 1,
        "cat_order": 1,
    }

    find_query = {}
    if ticker:
        find_query["ticker"] = ticker

    # Hỗ trợ sorting — convert sort_by/sort_order thành format sort tuples
    sort_by = kwargs.get("sort_by", "date")
    sort_order_str = kwargs.get("sort_order", "desc")
    sort_direction = -1 if sort_order_str == "desc" else 1
    sort = [(sort_by, sort_direction)]

    # Hỗ trợ limit
    limit = kwargs.get("limit")
    if limit is not None:
        limit = int(limit)

    df = await get_collection_data(
        stock_db,
        "other_ticker",
        find_query=find_query,
        projection=projection,
        sort=sort,
        limit=limit,
    )

    return df.to_dict(orient="records")

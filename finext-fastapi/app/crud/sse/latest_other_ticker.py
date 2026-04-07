from typing import Any, Dict, Optional

from app.core.database import get_database
from app.crud.sse._helpers import get_collection_data, STOCK_DB


async def latest_other_ticker(
    ticker: Optional[str] = None, categories: Optional[str] = None, **kwargs
) -> Dict[str, Any]:
    """
    Lấy dữ liệu today của latest_other_ticker (Commodities, Crypto, World Index, etc.)
    Có thể filter theo ticker hoặc group (thông qua categories param).
    """
    stock_db = get_database(STOCK_DB)

    projection = {
        "_id": 0,
        "date": 1,
        "ticker": 1,
        "open": 1,
        "high": 1,
        "low": 1,
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
    }

    find_query = {}
    if ticker:
        find_query["ticker"] = ticker
    
    if categories:
        # Sử dụng categories param để filter theo group (VD: 'commodities', 'crypto')
        cats = [c.strip() for c in categories.split(",")]
        if cats:
            find_query["group"] = {"$in": cats}

    df = await get_collection_data(
        stock_db, "latest_other_ticker", find_query=find_query, projection=projection
    )

    return df.to_dict(orient="records")

# finext-fastapi/app/crud/sse/home_hist_industry.py
from typing import Any, Dict, Optional

from app.core.database import get_database
from app.crud.sse._helpers import get_collection_data, STOCK_DB


async def home_hist_industry(ticker: Optional[str] = None, **kwargs) -> Dict[str, Any]:
    """
    Lấy dữ liệu history của industry theo ticker.
    Query từ collection history_index với filter type='industry'.
    Database: temp_stock.
    """
    stock_db = get_database(STOCK_DB)

    projection = {
        "_id": 0,
        "ticker": 1,
        "ticker_name": 1,
        "date": 1,
        "open": 1,
        "high": 1,
        "low": 1,
        "close": 1,
        "volume": 1,
        "diff": 1,
        "pct_change": 1,
        "type": 1,
    }
    # Filter theo type='industry' và ticker nếu có
    find_query = {"type": "industry"}
    if ticker:
        find_query["ticker"] = ticker

    history_df = await get_collection_data(stock_db, "history_index", find_query=find_query, projection=projection)

    return history_df.to_dict(orient="records")

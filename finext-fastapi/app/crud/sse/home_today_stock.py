# finext-fastapi/app/crud/sse/home_today_stock.py
from typing import Any, Dict, Optional

from app.core.database import get_database
from app.crud.sse._helpers import get_collection_data, STOCK_DB


async def home_today_stock(ticker: Optional[str] = None, **kwargs) -> Dict[str, Any]:
    """
    Lấy dữ liệu today của các mã cổ phiếu (stocks).
    Database: temp_stock.
    Collection: today_stock.
    """
    stock_db = get_database(STOCK_DB)

    projection = {
        "_id": 0,
        "ticker": 1,
        "exchange": 1,
        "open": 1,
        "high": 1,
        "low": 1,
        "close": 1,
        "volume": 1,
        "trading_value": 1,
        "industry_name": 1,
        "category_name": 1,
        "marketcap_name": 1,
        "diff": 1,
        "pct_change": 1,
        "t0_score": 1,
        "t5_score": 1,
        "vsi": 1,
        "vsma5": 1,
    }

    find_query = {"ticker": ticker} if ticker else {}

    today_df = await get_collection_data(stock_db, "today_stock", find_query=find_query, projection=projection)

    return today_df.to_dict(orient="records")

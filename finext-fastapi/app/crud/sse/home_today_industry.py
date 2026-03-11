# finext-fastapi/app/crud/sse/home_today_industry.py
from typing import Any, Dict, Optional

from app.core.database import get_database
from app.crud.sse._helpers import get_collection_data, STOCK_DB


async def home_today_industry(ticker: Optional[str] = None, **kwargs) -> Dict[str, Any]:
    """
    Lấy dữ liệu today của TẤT CẢ industry trong 1 lần gọi.
    Query từ collection today_index với filter type='industry'.
    Database: temp_stock.
    """
    stock_db = get_database(STOCK_DB)

    projection = {
        "_id": 0,
        "ticker": 1,
        "ticker_name": 1,
        "date": 1,
        "close": 1,
        "volume": 1,
        "diff": 1,
        "pct_change": 1,
        "type": 1,
    }
    # Filter theo type='industry'
    find_query = {"type": "industry"}
    today_df = await get_collection_data(stock_db, "today_index", find_query=find_query, projection=projection)

    return today_df.to_dict(orient="records")

# finext-fastapi/app/crud/sse/home_history_trend.py
from typing import Any, Dict, Optional

from app.core.database import get_database
from app.crud.sse._helpers import get_collection_data, STOCK_DB


async def home_history_trend(ticker: Optional[str] = None, **kwargs) -> Dict[str, Any]:
    """
    Lấy dữ liệu lịch sử xu hướng thị trường.
    Database: stock_db. Collection: history_trend.
    """
    stock_db = get_database(STOCK_DB)

    projection = {
        "_id": 0,
        "ticker": 1,
        "ticker_name": 1,
        "date": 1,
        "w_trend": 1,
        "m_trend": 1,
        "q_trend": 1,
        "y_trend": 1,
    }
    find_query = {"ticker": ticker} if ticker else {}
    history_trend_df = await get_collection_data(stock_db, "history_trend", find_query=find_query, projection=projection)

    return history_trend_df.to_dict(orient="records")

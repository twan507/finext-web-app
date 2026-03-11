# finext-fastapi/app/crud/sse/home_hist_index.py
from typing import Any, Dict, Optional

from app.core.database import get_database
from app.crud.sse._helpers import get_collection_data, STOCK_DB


async def home_hist_index(ticker: Optional[str] = None, **kwargs) -> Dict[str, Any]:
    """
    Lấy dữ liệu history index theo ticker (chỉ history, không bao gồm today).
    Database: temp_stock.
    Hỗ trợ limit để lấy N records gần nhất.
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
        "t0_score": 1,
        "t5_score": 1,
        "type": 1,
    }
    find_query = {"ticker": ticker} if ticker else {}

    # Lấy limit từ kwargs nếu có
    limit = kwargs.get("limit")

    # Nếu có limit, sort giảm dần theo date để lấy records mới nhất
    if limit:
        sort_criteria = [("date", -1)]
        history_df = await get_collection_data(
            stock_db, "history_index", find_query=find_query, projection=projection, sort=sort_criteria, limit=limit
        )
        # Reverse lại để có thứ tự tăng dần theo date
        records = history_df.to_dict(orient="records")
        return list(reversed(records))
    else:
        # Không có limit, lấy tất cả
        history_df = await get_collection_data(stock_db, "history_index", find_query=find_query, projection=projection)
        return history_df.to_dict(orient="records")

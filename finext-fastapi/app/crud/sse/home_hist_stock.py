# finext-fastapi/app/crud/sse/home_hist_stock.py
from typing import Any, Dict, Optional

from app.core.database import get_database
from app.crud.sse._helpers import get_collection_data, STOCK_DB, OPERATION_TIMEOUT_MS


async def home_hist_stock(ticker: Optional[str] = None, **kwargs) -> Dict[str, Any]:
    """
    Lấy dữ liệu history stock theo ticker (chỉ history, không bao gồm today).
    Database: temp_stock.
    Hỗ trợ limit/skip để lấy N records gần nhất (lazy load).
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
        "market_rank_pct": 1,
        "industry_rank_pct": 1,
        "type": 1,
    }
    find_query = {"ticker": ticker} if ticker else {}

    # Lấy limit và skip từ kwargs nếu có
    limit = kwargs.get("limit")
    skip = kwargs.get("skip")

    # Nếu có limit, dùng cursor trực tiếp để hỗ trợ cả skip (lazy load)
    if limit:
        collection = stock_db.get_collection("history_stock")
        cursor = collection.find(find_query, projection)
        cursor.sort("date", -1)  # Newest first
        if skip is not None and skip > 0:
            cursor.skip(int(skip))
        cursor.limit(int(limit))
        cursor.max_time_ms(OPERATION_TIMEOUT_MS)
        docs = await cursor.to_list(length=int(limit))
        docs.reverse()  # Trả về ASC (oldest → newest)
        return docs
    else:
        # Không có limit, lấy tất cả
        history_df = await get_collection_data(stock_db, "history_stock", find_query=find_query, projection=projection)
        return history_df.to_dict(orient="records")

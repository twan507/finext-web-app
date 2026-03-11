# finext-fastapi/app/crud/sse/home_today_index.py
from typing import Any, Dict, Optional

from app.core.database import get_database
from app.crud.sse._helpers import get_collection_data, STOCK_DB


async def home_today_index(ticker: Optional[str] = None, **kwargs) -> Dict[str, Any]:
    """
    Lấy dữ liệu today của TẤT CẢ indexes trong 1 lần gọi.
    Không cần ticker param - query tất cả theo group.

    Returns:
        List[Dict] - danh sách các records từ today_index
    """
    stock_db = get_database(STOCK_DB)

    # Query today_index collection
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
        "trading_value": 1,
        "diff": 1,
        "pct_change": 1,
        "w_pct": 1,
        "m_pct": 1,
        "q_pct": 1,
        "y_pct": 1,
        "vsi": 1,
        "t0_score": 1,
        "t5_score": 1,
        "breadth_in": 1,
        "breadth_out": 1,
        "breadth_neu": 1,
        "type": 1,
    }
    find_query = {}
    today_df = await get_collection_data(stock_db, "today_index", find_query=find_query, projection=projection)

    return today_df.to_dict(orient="records")

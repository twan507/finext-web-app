# finext-fastapi/app/crud/sse/home_itd_index.py
from typing import Any, Dict, Optional

from app.core.database import get_database
from app.crud.sse._helpers import get_collection_data, STOCK_DB


async def home_itd_index(ticker: Optional[str] = None, **kwargs) -> Dict[str, Any]:
    """Lấy dữ liệu ITD index theo ticker. Database: temp_stock."""
    stock_db = get_database(STOCK_DB)

    # ITD chỉ cần close để vẽ line chart, không cần open/high/low
    projection = {"_id": 0, "ticker": 1, "ticker_name": 1, "date": 1, "close": 1, "volume": 1, "diff": 1, "pct_change": 1, "vsi": 1}
    find_query = {"ticker": ticker} if ticker else {}
    itd_df = await get_collection_data(stock_db, "itd_index", find_query=find_query, projection=projection)

    # Chuyển đổi DataFrame về JSON (List[Dict]) - không cần pagination cho ITD
    return itd_df.to_dict(orient="records")

# finext-fastapi/app/crud/sse/chart_today_data.py
import logging
from typing import Any, Dict, Optional

from app.core.database import get_database
from app.crud.sse._helpers import STOCK_DB, OPERATION_TIMEOUT_MS
from app.crud.sse._constants import CHART_DATA_PROJECTION, _is_index_ticker

logger = logging.getLogger(__name__)


async def chart_today_data(ticker: Optional[str] = None, **kwargs) -> Dict[str, Any]:
    """
    Lấy dữ liệu hôm nay cho biểu đồ kỹ thuật.
    Tự động phân biệt index và stock dựa trên ticker.
    - Index tickers (VNINDEX, VN30, ...) → collection: today_index
    - Stock tickers (VNM, FPT, ...) → collection: today_stock

    Tối ưu: query trực tiếp MongoDB với sort, không qua pandas.

    Args:
        ticker: Mã ticker (bắt buộc). Mặc định: VNINDEX

    Returns:
        List[Dict] - dữ liệu OHLCV + indicators hôm nay theo ticker, sorted by date ASC
    """
    if not ticker:
        ticker = "VNINDEX"

    stock_db = get_database(STOCK_DB)
    find_query = {"ticker": ticker}

    # Chọn collection phù hợp dựa trên loại ticker
    if _is_index_ticker(ticker):
        collection_name = "today_index"
    else:
        collection_name = "today_stock"

    logger.debug(f"chart_today_data: ticker={ticker}, collection={collection_name}")

    # Query trực tiếp với sort, không qua pandas DataFrame
    collection = stock_db.get_collection(collection_name)
    cursor = collection.find(find_query, CHART_DATA_PROJECTION)
    cursor.sort("date", 1)  # Sort ascending by date
    cursor.max_time_ms(OPERATION_TIMEOUT_MS)
    docs = await cursor.to_list(length=None)

    return docs

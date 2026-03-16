# finext-fastapi/app/crud/sse/chart_history_data.py
import logging
from typing import Any, Dict, Optional

from app.core.database import get_database
from app.crud.sse._helpers import STOCK_DB, OPERATION_TIMEOUT_MS
from app.crud.sse._constants import CHART_DATA_PROJECTION, _is_index_ticker

logger = logging.getLogger(__name__)


async def chart_history_data(
    ticker: Optional[str] = None,
    skip: Optional[int] = None,
    limit: Optional[int] = None,
    **kwargs,
) -> Dict[str, Any]:
    """
    Lấy dữ liệu lịch sử cho biểu đồ kỹ thuật (history, không bao gồm today).
    Tự động phân biệt index và stock dựa trên ticker.
    - Index tickers (VNINDEX, VN30, ...) → collection: history_index
    - Stock tickers (VNM, FPT, ...) → collection: history_stock

    Hỗ trợ phân trang: skip/limit lấy N bản ghi MỚI NHẤT (sort DESC → skip → limit → reverse).

    Args:
        ticker: Mã ticker (bắt buộc). Mặc định: VNINDEX
        skip: Số bản ghi bỏ qua từ cuối (mới nhất). Dùng cho lazy load.
        limit: Số bản ghi tối đa trả về.

    Returns:
        List[Dict] - dữ liệu OHLCV + indicators theo ticker, sorted by date ASC
    """
    if not ticker:
        ticker = "VNINDEX"

    stock_db = get_database(STOCK_DB)
    find_query = {"ticker": ticker}

    # Chọn collection phù hợp dựa trên loại ticker
    if _is_index_ticker(ticker):
        collection_name = "history_index"
    else:
        collection_name = "history_stock"

    logger.debug(f"chart_history_data: ticker={ticker}, collection={collection_name}, skip={skip}, limit={limit}")

    collection = stock_db.get_collection(collection_name)

    if limit is not None:
        # Lazy load: sort DESC → skip → limit → reverse kết quả về ASC
        cursor = collection.find(find_query, CHART_DATA_PROJECTION)
        cursor.sort("date", -1)  # Newest first
        if skip is not None and skip > 0:
            cursor.skip(skip)
        cursor.limit(limit)
        cursor.max_time_ms(OPERATION_TIMEOUT_MS)
        docs = await cursor.to_list(length=limit)
        docs.reverse()  # Trả về ASC (oldest → newest)
    else:
        # Legacy: load toàn bộ, sort ASC
        cursor = collection.find(find_query, CHART_DATA_PROJECTION)
        cursor.sort("date", 1)
        cursor.max_time_ms(OPERATION_TIMEOUT_MS)
        docs = await cursor.to_list(length=None)

    return docs

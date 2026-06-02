# finext-fastapi/app/crud/sse/home_nn_stock.py
import logging
from typing import Any, Dict, Optional

from app.core.database import get_database
from app.crud.sse._helpers import get_collection_records, STOCK_DB, REF_DB

logger = logging.getLogger(__name__)


async def home_nn_stock(ticker: Optional[str] = None, **kwargs) -> Dict[str, Any]:
    """
    Lấy dữ liệu nước ngoài (NN) trading.
    1. Lấy max date từ ref_db.date_series.
    2. Query stock_db.nntd_stock với type='NN' và date=max_date.
    """
    # 1. Lấy max date từ ref_db (chỉ cần 1 record đầu sau sort desc)
    ref_db = get_database(REF_DB)
    date_records = await get_collection_records(
        ref_db, "date_series", find_query={}, projection={"date": 1, "_id": 0}, sort=[("date", -1)], limit=1
    )

    if not date_records:
        logger.warning("No date found in ref_db.date_series")
        return []

    max_date = date_records[0]["date"]
    logger.debug(f"Max date from ref_db.date_series: {max_date}")

    # 2. Query stock_db.nntd_stock
    stock_db = get_database(STOCK_DB)

    projection = {
        "_id": 0,
        "date": 1,
        "ticker": 1,
        "sell_volume": 1,
        "buy_volume": 1,
        "sell_value": 1,
        "buy_value": 1,
        "net_volume": 1,
        "net_value": 1,
        "type": 1,
    }

    find_query = {"type": "NN", "date": max_date}
    if ticker:
        find_query["ticker"] = ticker

    return await get_collection_records(stock_db, "nntd_stock", find_query=find_query, projection=projection)

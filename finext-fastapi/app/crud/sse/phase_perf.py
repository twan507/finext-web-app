# finext-fastapi/app/crud/sse/phase_perf.py
from typing import Any, Dict, List

from app.core.database import get_database
from app.crud.sse._helpers import get_collection_records, STOCK_DB

# ret_1d_1x = mặc định (1.0x, khách xem); ret_1d = 2.0x (chưa dùng ở increment 1).
_PROJECTION = {
    "_id": 0,
    "date": 1,
    "product": 1,
    "ret_1d_1x": 1,
    "ret_1d": 1,
}


async def phase_perf(**kwargs) -> List[Dict[str, Any]]:
    """
    Lấy toàn bộ return ngày của 3 rổ + benchmark (product='FNX').
    Database: stock_db. Collection: phase_perf.
    Client tự lọc theo product và cộng dồn Π(1+ret_1d_1x) theo cửa sổ đã chọn.
    """
    stock_db = get_database(STOCK_DB)
    return await get_collection_records(
        stock_db, "phase_perf", projection=_PROJECTION, sort=[("date", 1), ("product", 1)]
    )

# finext-fastapi/app/crud/sse/phase_basket.py
from typing import Any, Dict, List

from app.core.database import get_database
from app.crud.sse._helpers import get_collection_records, STOCK_DB

_PROJECTION = {
    "_id": 0,
    "date": 1,
    "product": 1,
    "display_name_vi": 1,
    "market_phase": 1,
    "market_exposure": 1,
    "n_held": 1,
    "held": 1,
    "book": 1,
    "adds": 1,
    "removes": 1,
    "sectors": 1,
}


async def phase_basket(**kwargs) -> List[Dict[str, Any]]:
    """
    Holdings 3 rổ ở phiên mới nhất. Database: stock_db. Collection: phase_basket.
    Mỗi phiên có 3 dòng (1 rổ/dòng) → limit 3 + sort date desc = phiên mới nhất.
    held/book đã là trọng số (held × exposure); held={} nghĩa là 100% tiền mặt.
    """
    stock_db = get_database(STOCK_DB)
    return await get_collection_records(
        stock_db, "phase_basket", projection=_PROJECTION, sort=[("date", -1)], limit=3
    )

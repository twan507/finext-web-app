# finext-fastapi/app/crud/sse/phase_comment.py
from typing import Any, Dict, List

from app.core.database import get_database
from app.crud.sse._helpers import get_collection_records, STOCK_DB

# Chỉ cột market_cmt là FREE (các cột condition/structure/risk dành cho panel PAID).
_PROJECTION = {
    "_id": 0,
    "date": 1,
    "market_cmt": 1,
    "source": 1,
    "generated_at": 1,
}


async def phase_comment(**kwargs) -> List[Dict[str, Any]]:
    """
    Lấy chẩn đoán phiên mới nhất (FREE).
    Database: stock_db. Collection: phase_comment.
    Bảng comment (fnx11) tới trễ vài phút so với bảng số → có thể rỗng: client ẩn khối.
    """
    stock_db = get_database(STOCK_DB)
    return await get_collection_records(
        stock_db, "phase_comment", projection=_PROJECTION, sort=[("date", -1)], limit=1
    )

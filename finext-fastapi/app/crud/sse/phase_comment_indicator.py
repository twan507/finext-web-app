# finext-fastapi/app/crud/sse/phase_comment_indicator.py
from typing import Any, Dict, List

from app.core.database import get_database
from app.crud.sse._helpers import get_collection_records, STOCK_DB

# Bỏ qua facts + generated_at khi hiển thị.
_PROJECTION = {
    "_id": 0,
    "date": 1,
    "indicator_key": 1,
    "indicator_label_vi": 1,
    "order": 1,
    "comment": 1,
    "source": 1,
}


async def phase_comment_indicator(**kwargs) -> List[Dict[str, Any]]:
    """
    Diễn giải RIÊNG từng chỉ số thị trường (10 dòng/phiên). Database: stock_db. Collection: phase_comment_indicator.
    Append-only, render nguyên văn. Sort date desc + limit 15 → client lọc phiên mới nhất (10 dòng).
    """
    stock_db = get_database(STOCK_DB)
    return await get_collection_records(
        stock_db, "phase_comment_indicator", projection=_PROJECTION, sort=[("date", -1)], limit=15
    )

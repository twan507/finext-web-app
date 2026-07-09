# finext-fastapi/app/crud/sse/phase_comment_basket.py
from typing import Any, Dict, List

from app.core.database import get_database
from app.crud.sse._helpers import get_collection_records, STOCK_DB

_PROJECTION = {
    "_id": 0,
    "date": 1,
    "product": 1,
    "display_name_vi": 1,
    "sector_cmt": 1,  # chỉ CORE có nội dung
    "stock_cmt": 1,
    "source": 1,
    "generated_at": 1,
}


async def phase_comment_basket(**kwargs) -> List[Dict[str, Any]]:
    """
    Diễn giải danh mục (mỗi phiên 3 dòng, 1 rổ/dòng). Database: stock_db. Collection: phase_comment_basket.
    limit 3 + sort date desc = 3 comment của phiên mới nhất. Render nguyên văn.
    """
    stock_db = get_database(STOCK_DB)
    return await get_collection_records(
        stock_db, "phase_comment_basket", projection=_PROJECTION, sort=[("date", -1)], limit=3
    )

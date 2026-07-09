# finext-fastapi/app/crud/sse/phase_rank.py
from typing import Any, Dict, List

from app.core.database import get_database
from app.crud.sse._helpers import get_collection_records, STOCK_DB

# LƯU Ý bảo mật: collection này KHÔNG có vol60/score (đã bị product_serve loại bỏ ở tầng
# tính toán vì lộ tiêu chí xếp hạng). Chỉ project field an-toàn-cho-khách.
_PROJECTION = {
    "_id": 0,
    "date": 1,
    "product": 1,
    "level": 1,
    "ticker": 1,
    "ten": 1,
    "sector": 1,
    "rank": 1,
    "rank_scope": 1,
    "mom120": 1,
    "vma60": 1,
    "composite": 1,
    "held": 1,
    "status": 1,
    "nguong_vao": 1,
    "nguong_giu": 1,
    "next_rebalance_in": 1,
}


async def phase_rank(**kwargs) -> List[Dict[str, Any]]:
    """
    Bảng xếp hạng "sắp vào/ra" (60 phiên gần nhất). Database: stock_db. Collection: phase_rank.
    Trả các phiên gần nhất (sort date desc, limit rộng); client lọc phiên mới nhất theo product/level.
    """
    stock_db = get_database(STOCK_DB)
    return await get_collection_records(
        stock_db, "phase_rank", projection=_PROJECTION, sort=[("date", -1)], limit=500
    )

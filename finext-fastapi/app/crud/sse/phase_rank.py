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
    Bảng xếp hạng "sắp vào/ra" (20 phiên gần nhất). Database: stock_db. Collection: phase_rank.
    Mỗi phiên có RẤT nhiều dòng (mọi mã × product) nên limit cứng không đủ 20 phiên → lấy
    distinct 20 date gần nhất rồi filter date >= min. Client lọc phiên đang chọn theo product/level.
    """
    stock_db = get_database(STOCK_DB)
    # distinct dates desc → lấy tối đa 20 phiên gần nhất (date lưu dạng chuỗi ISO nên sort chuỗi đúng).
    all_dates: List[str] = await stock_db.get_collection("phase_rank").distinct("date")
    if not all_dates:
        return []
    min_date = sorted(all_dates, reverse=True)[:20][-1]
    return await get_collection_records(
        stock_db,
        "phase_rank",
        find_query={"date": {"$gte": min_date}},
        projection=_PROJECTION,
        sort=[("date", -1)],
    )

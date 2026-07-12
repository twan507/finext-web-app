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


# Cửa sổ lịch sử tách theo LEVEL (2026-07-12):
#   - stock : mỗi phiên có RẤT nhiều dòng (mọi mã × product) → chỉ cần 20 phiên cho SessionStrip lookback.
#   - sector: mỗi phiên chỉ ~12 dòng (1 rổ CORE) → lấy 60 phiên, đủ cho heatmap ngành + line sức mạnh
#             + suy ra các mốc kỳ cơ cấu trên toàn chart. Payload tăng không đáng kể.
_STOCK_SESSIONS = 20
_SECTOR_SESSIONS = 60


async def phase_rank(**kwargs) -> List[Dict[str, Any]]:
    """
    Bảng xếp hạng "sắp vào/ra". Database: stock_db. Collection: phase_rank.
    Limit cứng theo số dòng không dùng được (mỗi phiên rất nhiều dòng) → lấy distinct date gần nhất
    rồi filter date >= min, VỚI CỬA SỔ KHÁC NHAU theo level (xem hằng số ở trên).
    Client lọc phiên đang chọn theo product/level.
    """
    stock_db = get_database(STOCK_DB)
    # distinct dates desc (date lưu dạng chuỗi ISO nên sort chuỗi đúng).
    all_dates: List[str] = await stock_db.get_collection("phase_rank").distinct("date")
    if not all_dates:
        return []
    desc = sorted(all_dates, reverse=True)
    min_stock = desc[:_STOCK_SESSIONS][-1]
    min_sector = desc[:_SECTOR_SESSIONS][-1]
    # $or dedup document: dòng sector trong 20 phiên gần nhất khớp cả 2 nhánh nhưng chỉ trả 1 lần.
    # Nhánh 1 không lọc level → level lạ (nếu có) vẫn được trả về, không mất dữ liệu.
    find_query = {
        "$or": [
            {"date": {"$gte": min_stock}},
            {"date": {"$gte": min_sector}, "level": "sector"},
        ]
    }
    return await get_collection_records(
        stock_db,
        "phase_rank",
        find_query=find_query,
        projection=_PROJECTION,
        sort=[("date", -1)],
    )

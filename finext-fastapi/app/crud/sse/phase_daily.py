# finext-fastapi/app/crud/sse/phase_daily.py
from typing import Any, Dict, List

from app.core.database import get_database
from app.crud.sse._helpers import get_collection_records, STOCK_DB

# Schema gọn 12 cột. OUTPUT (đèn phase, % nắm giữ) + HƯỚNG + TIN CẬY + GATE + DIAG
# (chỉ số cho hero + panel "Chỉ số nâng cao"). Bỏ các cột nguyên liệu đã cắt ở pipeline.
_PROJECTION = {
    "_id": 0,
    # OUTPUT
    "date": 1,
    "phase_label": 1,
    "market_exposure": 1,
    "suppressed": 1,  # v3.4.2: phiên tín hiệu giảm chưa xác nhận → exposure bị hạ sâu
    # HƯỚNG
    "breadth_slow": 1,
    "breadth_blend": 1,
    "breadth_aux": 1,
    # TIN CẬY
    "conf_dir": 1,
    "conf_flat": 1,
    # GATE
    "corr60": 1,
    "px_ret20": 1,
    # DIAG
    "market_intensity": 1,
    "sub_signal": 1,
    "fnx_close": 1,
}


async def phase_daily(**kwargs) -> List[Dict[str, Any]]:
    """
    Lấy toàn bộ lịch sử tín hiệu giai đoạn thị trường (FREE).
    Database: stock_db. Collection: phase_daily.
    Trả về list sort theo date tăng dần; client lấy phần tử cuối làm phiên hiện tại,
    dùng cả mảng cho biểu đồ FNX + band.
    """
    stock_db = get_database(STOCK_DB)
    return await get_collection_records(
        stock_db, "phase_daily", projection=_PROJECTION, sort=[("date", 1)]
    )

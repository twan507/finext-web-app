# finext-fastapi/app/crud/sse/phase_daily.py
from typing import Any, Dict, List

from app.core.database import get_database
from app.crud.sse._helpers import get_collection_records, STOCK_DB

# OUTPUT fields (đèn phase, % nắm giữ, cường độ, giá FNX) + chỉ số nâng cao
# (BREADTH/REGIME cho panel "Chỉ số nâng cao").
_PROJECTION = {
    "_id": 0,
    "date": 1,
    "phase_label": 1,
    "market_exposure": 1,
    "market_intensity": 1,
    "fnx_close": 1,
    "conf_dir": 1,
    "breadth_slow": 1,
    "breadth_fast": 1,
    "breadth_mom": 1,
    "breadth_blend": 1,
    "breadth_aux": 1,
    "conf_breadth": 1,
    "breadth_w": 1,
    "breadth_m": 1,
    "breadth_q": 1,
    "breadth_y": 1,
    "vsi_long": 1,
    "corr60": 1,
    "px_ret20": 1,
    "sub_signal": 1,
    "composite_score": 1,
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

# finext-fastapi/app/crud/sse/phase_industry.py
from typing import Any, Dict, List

from app.core.database import get_database
from app.crud.sse._helpers import get_collection_records, STOCK_DB


async def phase_industry(**kwargs) -> List[Dict[str, Any]]:
    """
    Tầng NGÀNH của rổ Sóng Ngành (WIDE, 1 dòng/phiên; cột = ngành, 12 cột).

    Schema 2026-07-12 (BREAKING — trước là 24 cột 0/1 của sản phẩm "rotation top-6" đã bị xoá):
      3 = trong rổ (đang nắm, hạng <=3) | 2 = vùng buffer (đang nắm, hạng đã tụt)
      1 = tiềm năng (chưa nắm, kỳ cơ cấu tới sẽ vào) | 0 = ngoài rổ
      => ĐANG NẮM <=> giá trị >= 2. KHÔNG còn nhân market_exposure (downtrend không tự về 0)
         -> web tự tô xám dựa vào phase_daily.market_exposure == 0.

    Database: stock_db. Collection: phase_industry.
    Trả toàn bộ lịch sử sort date asc; client CHỈ render ngành từng có giá trị >= 1
    (không hiển thị cột always-0 để không lộ universe).
    """
    stock_db = get_database(STOCK_DB)
    return await get_collection_records(
        stock_db, "phase_industry", projection={"_id": 0}, sort=[("date", 1)]
    )

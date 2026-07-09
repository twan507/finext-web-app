# finext-fastapi/app/crud/sse/phase_industry.py
from typing import Any, Dict, List

from app.core.database import get_database
from app.crud.sse._helpers import get_collection_records, STOCK_DB


async def phase_industry(**kwargs) -> List[Dict[str, Any]]:
    """
    Heatmap ngành (WIDE, 1 dòng/phiên; cột = ngành, giá trị 0/1 = có trong rotation).
    Database: stock_db. Collection: phase_industry.
    Trả toàn bộ lịch sử sort date asc; client CHỈ render các ngành từng có giá trị 1
    (không hiển thị cột always-0 để không lộ universe).
    """
    stock_db = get_database(STOCK_DB)
    return await get_collection_records(
        stock_db, "phase_industry", projection={"_id": 0}, sort=[("date", 1)]
    )

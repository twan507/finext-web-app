# finext-fastapi/app/crud/sse/phase_trading.py
from typing import Any, Dict, List

from app.core.database import get_database
from app.crud.sse._helpers import get_collection_records, STOCK_DB

_PROJECTION = {
    "_id": 0,
    "product": 1,
    "ticker": 1,
    "entry_date": 1,
    "exit_date": 1,
    "n_days": 1,
    "entry_price": 1,
    "exit_price": 1,
    "return_pct": 1,
    "avg_weight": 1,
    "status": 1,
    "exit_reason": 1,
}


async def phase_trading(**kwargs) -> List[Dict[str, Any]]:
    """
    Sổ lệnh (mô phỏng backtest) — mỗi dòng 1 lượt nắm giữ 1 mã. Database: stock_db. Collection: phase_trading.
    Trả toàn bộ, sort entry_date desc; client lọc theo product và tách open/closed.
    """
    stock_db = get_database(STOCK_DB)
    return await get_collection_records(
        stock_db, "phase_trading", projection=_PROJECTION, sort=[("entry_date", -1)]
    )

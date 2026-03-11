# finext-fastapi/app/crud/sse/phase_signal.py
from typing import Any, Dict, Optional

from app.core.database import get_database
from app.crud.sse._helpers import get_collection_data, STOCK_DB


async def phase_signal(ticker: Optional[str] = None, **kwargs) -> Dict[str, Any]:
    """
    Lấy dữ liệu phase signal từ collection phase_signal.
    Database: temp_stock.

    Args:
        ticker: Mã ticker để filter (optional)

    Returns:
        List[Dict] - danh sách các records từ phase_signal (không bao gồm _id)
    """
    stock_db = get_database(STOCK_DB)

    projection = {
        "_id": 0,
        "date": 1,
        "final_phase": 1,
        "pct_change": 1,
        "pct_return": 1,
        "buy_index_change": 1,
        "buy_ratio_change": 1,
        "buy_ms_score_stt": 1,
        "buy_vsi_volume_stt": 1,
        "buy_ms_value": 1,
        "buy_ms_diff": 1,
        "buy_ratio_strength": 1,
        "buy_ratio_value": 1,
        "sell_ratio_change": 1,
        "sell_ms_score_stt": 1,
        "sell_vsi_volume_stt": 1,
        "sell_ms_value": 1,
        "sell_ms_diff": 1,
        "sell_ratio_strength": 1,
        "sell_ratio_value": 1,
    }

    find_query = {"ticker": ticker} if ticker else {}
    phase_df = await get_collection_data(stock_db, "phase_signal", find_query=find_query, projection=projection)

    return phase_df.to_dict(orient="records")

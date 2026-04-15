# finext-fastapi/app/crud/sse/finstats_industry.py
from typing import Any, Dict, Optional

import numpy as np

from app.core.database import get_database
from app.crud.sse._helpers import get_collection_data, STOCK_DB

# Whitelist — chỉ lấy các field cần thiết cho 4 loại ngành
_PROJECTION = {
    "_id": 0,
    "industry": 1,
    "industry_name": 1,
    "type": 1,
    "period": 1,
    "n_stocks": 1,
    # Valuation
    "ryd21": 1, "ryd25": 1, "ryd26": 1, "ryq76": 1,
    # Profitability / Efficiency (SXKD & CHUNGKHOAN)
    "ryq12": 1, "ryq14": 1, "ryq25": 1, "ryq27": 1, "ryq29": 1, "ryq31": 1, "ryq91": 1,
    # Financial health (SXKD)
    "ryq1": 1, "ryq2": 1, "ryq3": 1, "ryq6": 1, "ryq71": 1, "ryq77": 1, "cashCycle": 1,
    # Working-capital efficiency (SXKD)
    "ryq16": 1, "ryq18": 1, "ryq20": 1,
    # Growth
    "ryq34": 1, "ryq39": 1,
    # Banking-specific
    "ryq44": 1, "ryq45": 1, "ryq46": 1, "ryq47": 1, "ryq48": 1,
    "ryq58": 1, "ryq59": 1, "ryq60": 1, "ryq61": 1, "ryq57": 1,
    "ryq54": 1, "ryq55": 1,
    "rtq50": 1, "rtq51": 1, "ryq67": 1,
}


async def finstats_industry(
    ticker: Optional[str] = None,
    sort_by: Optional[str] = None,  # 'Q' = quarterly (_1–_4) | 'Y' = yearly (_5)
    **kwargs,
) -> Dict[str, Any]:
    """
    Lấy dữ liệu chỉ số tài chính tổng hợp theo ngành từ collection finstats_industry.
    Database: stock_db. Collection: finstats_industry.

    Args:
        ticker: Mã ngành (VD: XAYDUNG, NGANHANG). Map sang field "industry" trong collection.
        sort_by: Chế độ kỳ — 'Y' (year, period kết thúc _5) | 'Q' (quarter, period _1–_4).
                 Mặc định 'Q'.

    Returns:
        List[Dict] — records sorted by period desc. FE tự compute delta/sparkline/min/max.
    """
    stock_db = get_database(STOCK_DB)

    find_query: Dict[str, Any] = {}

    if ticker:
        find_query["industry"] = ticker.upper()

    mode = (sort_by or "Q").upper()
    if mode == "Y":
        find_query["period"] = {"$regex": "_5$"}
    else:
        find_query["period"] = {"$regex": "_[1-4]$"}

    df = await get_collection_data(
        stock_db,
        "finstats_industry",
        find_query=find_query,
        projection=_PROJECTION,
        sort=[("period", -1)],
        limit=None,
    )

    if df.empty:
        return []

    # Replace NaN/Inf với None để JSON serialization không lỗi
    df = df.replace([np.nan, np.inf, -np.inf], None)

    return df.to_dict(orient="records")

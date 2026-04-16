# finext-fastapi/app/crud/sse/finstats_stock.py
from typing import Any, Dict, Optional

import numpy as np

from app.core.database import get_database
from app.crud.sse._helpers import get_collection_data, STOCK_DB

# Whitelist — tất cả fields cần thiết cho 4 type ngành cấp cổ phiếu
_PROJECTION = {
    "_id": 0,
    "ticker": 1,
    "period": 1,
    "industry": 1,
    "industry_name": 1,
    "type": 1,
    # Profitability / efficiency
    "ryq12": 1, "ryq14": 1, "ryq25": 1, "ryq27": 1, "ryq29": 1, "ryq31": 1, "ryq91": 1,
    # Health / leverage
    "ryq71": 1, "ryq6": 1, "ryq77": 1, "ryq3": 1, "ryq2": 1, "ryq1": 1,
    # Working-capital efficiency
    "ryq16": 1, "ryq18": 1, "ryq20": 1, "cashCycle": 1,
    # Growth & revenue
    "rev": 1, "ryq34": 1, "ryq39": 1,
    # Balance sheet (scale)
    "bsa53": 1, "bsa1": 1, "bsa23": 1, "bsa54": 1, "bsa78": 1, "bsa2": 1, "bsa80": 1,
    "bsa67": 1,
    # Cashflow
    "cfa18": 1, "cfa26": 1, "cfa34": 1,
    # Chứng khoán — investment assets
    "bsa8": 1, "bsa5": 1, "bsa10": 1, "bsa43": 1,
    # Ngân hàng — profitability
    "ryq44": 1, "ryq45": 1, "ryq46": 1, "ryq47": 1, "ryq48": 1,
    # Ngân hàng — asset quality
    "ryq58": 1, "ryq59": 1, "ryq60": 1, "ryq61": 1, "ryq57": 1,
    # Ngân hàng — capital
    "nob151": 1, "ryq54": 1, "ryq55": 1,
    # Ngân hàng — liquidity & CASA
    "casa": 1, "nob66": 1, "bsb113": 1,
    # Ngân hàng — growth
    "ryq67": 1, "rtq50": 1, "rtq51": 1,
    # Ngân hàng — scale
    "nob65": 1, "bsb104": 1, "nob44": 1,
    # Ngân hàng — cashflow

}


async def finstats_stock(
    ticker: Optional[str] = None,
    sort_by: Optional[str] = None,  # 'Q' = quarterly (_1–_4) | 'Y' = yearly (_5)
    **kwargs,
) -> Dict[str, Any]:
    """
    Lấy dữ liệu chỉ số tài chính tổng hợp cấp cổ phiếu từ collection finstats_stock.
    Database: stock_db. Collection: finstats_stock.

    Args:
        ticker: Mã cổ phiếu (VD: HPG, BID, SSI, BVH).
        sort_by: Chế độ kỳ — 'Y' (year, period _5) | 'Q' (quarter, period _1–_4).
                 Mặc định 'Q'.

    Returns:
        List[Dict] — records sorted by period desc.
    """
    stock_db = get_database(STOCK_DB)

    find_query: Dict[str, Any] = {}

    if ticker:
        find_query["ticker"] = ticker.upper()

    mode = (sort_by or "Q").upper()
    if mode == "Y":
        find_query["period"] = {"$regex": "_5$"}
    else:
        find_query["period"] = {"$regex": "_[1-4]$"}

    df = await get_collection_data(
        stock_db,
        "finstats_stock",
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

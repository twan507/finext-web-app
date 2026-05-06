# finext-fastapi/app/crud/sse/info_stock.py
from typing import Any, Dict, Optional

from app.core.database import get_database
from app.crud.sse._helpers import get_collection_data, REF_DB


async def info_stock(ticker: Optional[str] = None, **kwargs) -> Dict[str, Any]:
    """
    Lấy thông tin doanh nghiệp theo ticker từ collection info_stock.
    Database: ref_db. Collection: info_stock.

    Cấu trúc document mẫu:
        _id, ticker, exchange, name, overview, business_area

    Args:
        ticker: Mã ticker để filter (optional)

    Returns:
        List[Dict] - danh sách records (thường chỉ 1 record/ticker)
    """
    ref_db = get_database(REF_DB)

    projection = {
        "_id": 0,
        "ticker": 1,
        "exchange": 1,
        "name": 1,
        "overview": 1,
        "business_area": 1,
    }

    find_query: Dict[str, Any] = {}
    if ticker:
        find_query["ticker"] = ticker

    info_df = await get_collection_data(
        ref_db,
        "info_stock",
        find_query=find_query,
        projection=projection,
    )

    return info_df.to_dict(orient="records")

# finext-fastapi/app/crud/sse/index_map.py
from typing import Any, Dict, List

from app.core.database import get_database
from app.crud.sse._helpers import get_collection_records, REF_DB


async def index_map(**kwargs) -> List[Dict[str, Any]]:
    """
    Lấy map mã → tên đầy đủ (ngành / chỉ số) từ collection index_map.
    Database: ref_db. Collection: index_map.

    Cấu trúc document mẫu:
        _id, ticker, ticker_name, type   (type = "industry" | ...)

    Returns:
        List[Dict] - danh sách {ticker, ticker_name, type}
    """
    ref_db = get_database(REF_DB)

    projection = {
        "_id": 0,
        "ticker": 1,
        "ticker_name": 1,
        "type": 1,
    }

    return await get_collection_records(
        ref_db,
        "index_map",
        find_query={},
        projection=projection,
    )

# finext-fastapi/app/crud/sse/finstats_map.py
from typing import Any, Dict, Optional

from app.core.database import get_database
from app.crud.sse._helpers import get_collection_records, REF_DB


async def finstats_map(ticker: Optional[str] = None, **kwargs) -> Dict[str, Any]:
    """
    Lấy dữ liệu mapping định nghĩa chỉ số tài chính từ collection finstats_map.
    Database: ref_db. Collection: finstats_map.

    Cấu trúc document mẫu:
        _id, code, type, vi, en

    Returns:
        List[Dict] - danh sách các records từ finstats_map
    """
    ref_db = get_database(REF_DB)

    projection = {
        "_id": 0,
        "code": 1,
        "type": 1,
        "vi": 1,
        "en": 1,
    }

    return await get_collection_records(
        ref_db,
        "finstats_map",
        find_query={},
        projection=projection,
    )

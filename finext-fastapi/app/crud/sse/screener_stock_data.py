# finext-fastapi/app/crud/sse/screener_stock_data.py
from typing import Any, Dict, List, Optional

from app.core.database import get_database
from app.crud.sse._helpers import get_collection_data, STOCK_DB


# Fields to exclude from the full projection (internal/redundant)
_EXCLUDE_FIELDS = {"_id", "week", "month", "quarter", "year"}


async def screener_stock_data(
    sort_by: Optional[str] = None,
    sort_order: Optional[str] = None,
    **kwargs,
) -> List[Dict[str, Any]]:
    """
    Lấy toàn bộ dữ liệu today_stock với đầy đủ cột cho bộ lọc cổ phiếu.
    Database: stock_db.
    Collection: today_stock.

    Client sẽ tự filter ở frontend; server chỉ sort nếu được yêu cầu.
    """
    stock_db = get_database(STOCK_DB)

    # Projection: exclude _id và các trường thời gian nội bộ
    projection: Dict[str, int] = {field: 0 for field in _EXCLUDE_FIELDS}

    find_query: Dict[str, Any] = {}

    # Sort trên server nếu được yêu cầu
    sort: Optional[list] = None
    if sort_by:
        direction = -1 if sort_order == "desc" else 1
        sort = [(sort_by, direction)]

    df = await get_collection_data(
        stock_db,
        "today_stock",
        find_query=find_query,
        projection=projection,
        sort=sort,
    )

    return df.to_dict(orient="records")

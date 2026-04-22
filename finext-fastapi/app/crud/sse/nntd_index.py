# finext-fastapi/app/crud/sse/nntd_index.py
from typing import Any, Dict, Optional

from app.core.database import get_database
from app.crud.sse._helpers import get_collection_data, STOCK_DB


async def nntd_index(ticker: Optional[str] = None, nntd_type: Optional[str] = None, **kwargs) -> Dict[str, Any]:
    """
    Lấy dữ liệu giao dịch NNTD (Nước ngoài/Tự doanh) theo index.
    Database: stock_db. Collection: nntd_index.
    Trả về toàn bộ lịch sử giao dịch NNTD cho index được chỉ định.

    Args:
        ticker: Mã index để filter (VD: VNINDEX, HNXINDEX, UPINDEX) (optional)
        nntd_type: Loại giao dịch để filter: 'NN' (nước ngoài) hoặc 'TD' (tự doanh) (optional)

    Returns:
        List[Dict] - danh sách các records từ nntd_index
    """
    stock_db = get_database(STOCK_DB)

    projection = {
        "_id": 0,
        "date": 1,
        "ticker": 1,
        "sell_volume": 1,
        "buy_volume": 1,
        "sell_value": 1,
        "buy_value": 1,
        "net_volume": 1,
        "net_value": 1,
        "type": 1,
    }

    find_query = {}
    if ticker:
        find_query["ticker"] = ticker
    if nntd_type:
        find_query["type"] = nntd_type

    nntd_df = await get_collection_data(stock_db, "nntd_index", find_query=find_query, projection=projection)

    return nntd_df.to_dict(orient="records")

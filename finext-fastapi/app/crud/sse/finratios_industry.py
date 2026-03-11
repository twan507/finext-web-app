# finext-fastapi/app/crud/sse/finratios_industry.py
from typing import Any, Dict, Optional

from app.core.database import get_database
from app.crud.sse._helpers import get_collection_data, STOCK_DB


async def finratios_industry(
    ticker: Optional[str] = None,
    **kwargs,
) -> Dict[str, Any]:
    """
    Lấy dữ liệu chỉ số tài chính trung bình theo ngành.
    Database: stock_db. Collection: finratios_industry.

    Cấu trúc document mẫu:
        _id, date, ticker (mã ngành), ticker_name, type,
        isa22, rev, ryd11, ryd21, ryd25, ryd26, ryd14, ryd7,
        ryq76, ryd28, ryd30

    Args:
        ticker: Mã ngành để filter (VD: BAOHIEM, XAYDUNG) (optional)

    Returns:
        List[Dict] - danh sách các records từ finratios_industry
    """
    stock_db = get_database(STOCK_DB)

    projection = {
        "_id": 0,
        "date": 1,
        "ticker": 1,
        "ticker_name": 1,
        "type": 1,
        "isa22": 1,
        "rev": 1,
        "ryd11": 1,
        "ryd21": 1,
        "ryd25": 1,
        "ryd26": 1,
        "ryd14": 1,
        "ryd7": 1,
        "ryq76": 1,
        "ryd28": 1,
        "ryd30": 1,
    }

    find_query = {}
    if ticker:
        find_query["ticker"] = ticker

    finratios_industry_df = await get_collection_data(
        stock_db,
        "finratios_industry",
        find_query=find_query,
        projection=projection,
        sort=[("date", 1)],
    )

    return finratios_industry_df.to_dict(orient="records")

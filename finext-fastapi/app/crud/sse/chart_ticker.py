# finext-fastapi/app/crud/sse/chart_ticker.py
import asyncio
import pandas as pd
from typing import Any, Dict

from app.core.database import get_database
from app.crud.sse._helpers import get_collection_data, STOCK_DB
from app.crud.sse._constants import INDEX_TICKERS, _is_industry_ticker


async def chart_ticker(**kwargs) -> Dict[str, Any]:
    """
    Lấy danh sách tất cả ticker từ today_index và today_stock.
    Chỉ trả về ticker và ticker_name để phục vụ tìm kiếm.
    - INDEX_TICKERS: thêm suffix "CHỈ SỐ"
    - INDUSTRY_TICKERS: thêm suffix "CHỈ SỐ NGÀNH"

    Returns:
        List[Dict] - danh sách các ticker với ticker và ticker_name
    """
    stock_db = get_database(STOCK_DB)

    ticker_projection = {"_id": 0, "ticker": 1, "ticker_name": 1}

    # Query cả today_index và today_stock song song
    index_task = get_collection_data(stock_db, "today_index", find_query={}, projection=ticker_projection)
    stock_task = get_collection_data(stock_db, "today_stock", find_query={}, projection=ticker_projection)

    index_df, stock_df = await asyncio.gather(index_task, stock_task)

    # Gộp 2 DataFrame
    combined = pd.concat([index_df, stock_df], ignore_index=True)

    # Loại bỏ duplicates theo ticker, giữ bản đầu tiên (index ưu tiên)
    if not combined.empty:
        combined = combined.drop_duplicates(subset=["ticker"], keep="first")

        # Thêm prefix cho ticker_name dựa trên loại ticker
        def add_ticker_prefix(row):
            ticker = row["ticker"]
            ticker_name = row["ticker_name"]

            if _is_industry_ticker(ticker):
                # INDUSTRY_TICKERS: "CHỈ SỐ NGÀNH {ticker_name}"
                return f"Chỉ số ngành {ticker_name}"
            elif ticker.upper() in INDEX_TICKERS:
                # INDEX_TICKERS: "CHỈ SỐ {ticker_name}"
                return f"Chỉ số {ticker_name}"
            else:
                # Stock: giữ nguyên
                return ticker_name

        combined["ticker_name"] = combined.apply(add_ticker_prefix, axis=1)

        # Sort theo ticker
        combined = combined.sort_values("ticker").reset_index(drop=True)

    return combined.to_dict(orient="records")

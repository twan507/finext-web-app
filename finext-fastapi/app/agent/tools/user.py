"""Tool user-scoped DUY NHẤT của v1. user_id LẤY TỪ ctx — không bao giờ là tham số model (doc 02 §4.1)."""

import logging
from typing import Any

from bson import ObjectId

from app.agent.gateway.types import GatewayContext, GatewayProtocol, GatewayResult

logger = logging.getLogger(__name__)

GET_WATCHLIST_SCHEMA: dict[str, Any] = {
    "type": "function",
    "function": {
        "name": "get_my_watchlist",
        "description": "Lấy danh sách theo dõi của chính người dùng đang chat, kèm giá hiện tại.",
        "parameters": {"type": "object", "properties": {}, "required": []},
    },
}

MAX_WATCHLIST_TICKERS = 30


async def run_get_my_watchlist(
    user_db: Any, gateway: GatewayProtocol, ctx: GatewayContext, args: dict[str, Any]
) -> GatewayResult:
    doc = await user_db["watchlists"].find_one({"user_id": ObjectId(ctx.user_id)}, {"tickers": 1})
    tickers = (doc or {}).get("tickers", [])[:MAX_WATCHLIST_TICKERS]
    if not tickers:
        return GatewayResult(ok=True, data=[], meta={"collection": "watchlists", "n": 0})

    quotes = await gateway.find(
        ctx,
        collection="stock_snapshot",
        filter={"ticker": {"$in": tickers}},
        projection={"ticker": 1, "price": 1},  # price là object lồng: có close + pct_change (% phiên)
        limit=MAX_WATCHLIST_TICKERS,
    )
    if not quotes.ok:
        return quotes
    return GatewayResult(ok=True, data=quotes.data, meta={"collection": "watchlists", "n": len(tickers)})

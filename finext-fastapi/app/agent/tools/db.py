"""2 tool generic — model tự viết query, luật do policy quyết (doc 02 §4.1)."""

from typing import Any

from app.agent.gateway.types import GatewayContext, GatewayProtocol, GatewayResult

DB_FIND_SCHEMA: dict[str, Any] = {
    "type": "function",
    "function": {
        "name": "db_find",
        "description": (
            "Đọc document từ agent_db. Luôn kèm projection để chỉ lấy field cần thiết. "
            "Với collection lớn phải lọc theo khoá chính (ví dụ ticker)."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "collection": {"type": "string", "description": "Tên collection trong agent_db"},
                "filter": {"type": "object", "description": "Điều kiện lọc kiểu MongoDB"},
                "projection": {"type": "object", "description": 'Field cần lấy, ví dụ {"ticker": 1, "price": 1}'},
                "sort": {"type": "array", "items": {"type": "array"}, "description": 'Ví dụ [["date", -1]]'},
                "limit": {"type": "integer", "description": "Số doc tối đa"},
            },
            "required": ["collection"],
        },
    },
}

DB_AGGREGATE_SCHEMA: dict[str, Any] = {
    "type": "function",
    "function": {
        "name": "db_aggregate",
        "description": "Chạy aggregation pipeline trên agent_db để tính thống kê (trung bình, xếp hạng, tổng hợp).",
        "parameters": {
            "type": "object",
            "properties": {
                "collection": {"type": "string"},
                "pipeline": {"type": "array", "items": {"type": "object"}},
            },
            "required": ["collection", "pipeline"],
        },
    },
}


async def run_db_find(gateway: GatewayProtocol, ctx: GatewayContext, args: dict[str, Any]) -> GatewayResult:
    return await gateway.find(
        ctx,
        collection=args["collection"],
        filter=args.get("filter"),
        projection=args.get("projection"),
        sort=args.get("sort"),
        limit=args.get("limit"),
    )


async def run_db_aggregate(gateway: GatewayProtocol, ctx: GatewayContext, args: dict[str, Any]) -> GatewayResult:
    return await gateway.aggregate(ctx, collection=args["collection"], pipeline=args["pipeline"])

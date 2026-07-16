"""Tool db_stats — server tính thống kê an toàn trên chuỗi lịch sử dài (doc 02 §4.1).

Đảo quyền so với db_aggregate: model chỉ chọn field/ops từ whitelist; server dựng phép đọc + trả scalar."""

from typing import Any

from app.agent.gateway.types import GatewayContext, GatewayProtocol, GatewayResult

DB_STATS_SCHEMA: dict[str, Any] = {
    "type": "function",
    "function": {
        "name": "db_stats",
        "description": (
            "Tính chỉ số thống kê CHÍNH XÁC trên toàn bộ chuỗi lịch sử dài (ví dụ định giá P/E, P/B qua nhiều năm). "
            "Dùng tool NÀY khi cần min/đỉnh/đáy/percentile/giá trị hiện tại/mức sụt so đỉnh — ĐỪNG lấy chuỗi dài "
            "bằng db_find rồi tự tính (chuỗi bị cắt và dễ sai). Server đọc toàn chuỗi và trả về số vô hướng."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "collection": {"type": "string", "description": "Collection dạng series lịch sử"},
                "field": {"type": "string", "description": 'Field số trong series, ví dụ "series.pe" hoặc "series.pb"'},
                "ops": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": (
                        "Các phép cần tính: min, max, mean, median, p05, p25, p75, p95, count, first, last, "
                        "latest, drawdown_from_peak"
                    ),
                },
                "filter": {
                    "type": "object",
                    "description": 'Lọc theo khoá chính, ví dụ {"industry_name": "Toàn bộ thị trường"} hoặc {"ticker": "FPT"}',
                },
                "range": {
                    "type": "object",
                    "description": '(tùy chọn) giới hạn theo ngày, ví dụ {"from": "2018-01-01", "to": "2024-12-31"}',
                },
            },
            "required": ["collection", "field", "ops"],
        },
    },
}


async def run_db_stats(gateway: GatewayProtocol, ctx: GatewayContext, args: dict[str, Any]) -> GatewayResult:
    return await gateway.stats(
        ctx,
        collection=args["collection"],
        field=args.get("field"),
        ops=args.get("ops"),
        filter=args.get("filter"),
        date_range=args.get("range"),
    )

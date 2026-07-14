"""Sinh label tiếng Việt cho tool chip (doc 02 §4.3). Bảng map ĐƯỢC PHÉP lỗi thời vô hại."""

from typing import Any

from app.agent.events import ToolCall

COLLECTION_LABELS: dict[str, str] = {
    "stock_snapshot": "dữ liệu cổ phiếu",
    "stock_info": "thông tin doanh nghiệp",
    "stock_recent": "diễn biến gần đây",
    "industry_snapshot": "dữ liệu ngành",
    "market_snapshot": "dữ liệu thị trường",
    "market_phase": "pha thị trường",
    "history_stock": "lịch sử giá",
    "data_briefing": "bản tin tổng hợp",
}

FALLBACK = "Đang tra cứu dữ liệu…"


def label_for(call: ToolCall) -> str:
    # arguments đến từ json.loads của model -> có thể không phải dict; label không được raise.
    args: dict[str, Any] = call.arguments if isinstance(call.arguments, dict) else {}
    collection = args.get("collection")
    label = COLLECTION_LABELS.get(collection) if isinstance(collection, str) else None
    if label is None:
        return FALLBACK
    filter_ = args.get("filter")
    ticker = filter_.get("ticker") if isinstance(filter_, dict) else None
    suffix = f" {ticker}" if isinstance(ticker, str) else ""
    return f"Đang đọc {label}{suffix}…"

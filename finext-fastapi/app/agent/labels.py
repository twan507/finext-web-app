"""Sinh label tiếng Việt cho dòng tra cứu (doc 02 §4.3). Cụ thể + thân thiện để user thấy AI đang làm gì
(KHÔNG lộ tên collection nội bộ — chỉ diễn đạt tự nhiên). Bảng map ĐƯỢC PHÉP lỗi thời vô hại."""

from typing import Any

from app.agent.events import ToolCall

# collection nội bộ → cụm tự nhiên (K-hygiene: không bao giờ lộ tên gốc ra UI).
COLLECTION_LABELS: dict[str, str] = {
    # Thị trường
    "market_snapshot": "toàn cảnh thị trường",
    "market_recent": "diễn biến thị trường gần đây",
    "market_itd": "nhịp thị trường trong phiên",
    "market_nntd": "giao dịch khối ngoại & tự doanh",
    "market_phase": "pha & trạng thái thị trường",
    "market_phase_history": "lịch sử pha thị trường",
    "data_briefing": "bản tin tổng hợp",
    # Nhóm vốn hoá / dòng tiền
    "group_snapshot": "sức khoẻ các nhóm vốn hoá",
    "group_recent": "diễn biến nhóm vốn hoá",
    # Ngành
    "industry_snapshot": "sức khoẻ các ngành",
    "industry_recent": "diễn biến ngành gần đây",
    "industry_info": "thông tin ngành",
    "industry_finstats": "tài chính ngành",
    "history_industry": "lịch sử ngành",
    "history_finratios_industry": "lịch sử định giá ngành",
    # Cổ phiếu
    "stock_snapshot": "dữ liệu cổ phiếu",
    "stock_info": "hồ sơ doanh nghiệp",
    "stock_recent": "diễn biến giá gần đây",
    "stock_itd": "nhịp giá trong phiên",
    "stock_nntd": "giao dịch khối ngoại của mã",
    "stock_finstats": "tài chính doanh nghiệp",
    "history_stock": "lịch sử giá",
    "history_finratios_stock": "lịch sử định giá cổ phiếu",
    # Chỉ số & pha
    "history_index": "lịch sử chỉ số",
    "phase_basket": "danh mục theo pha",
    "phase_industry": "ngành ưu tiên theo pha",
    "phase_perf": "hiệu suất theo pha",
    "phase_trading": "tín hiệu giao dịch theo pha",
    # Tin tức
    "news_today_feed": "tin tức hôm nay",
    "news_today_content": "nội dung tin hôm nay",
    "news_history_feed": "dòng tin gần đây",
    "news_history_content": "nội dung tin cũ",
    "other_data": "dữ liệu bổ sung",
}

FALLBACK = "dữ liệu"


def _ticker_suffix(args: dict[str, Any]) -> str:
    """Gắn mã cổ phiếu vào label nếu filter có ticker (VD 'dữ liệu cổ phiếu FPT')."""
    filter_ = args.get("filter")
    ticker = filter_.get("ticker") if isinstance(filter_, dict) else None
    return f" {ticker}" if isinstance(ticker, str) else ""


def label_for(call: ToolCall) -> str:
    """Trả CHI TIẾT (cụm danh từ tự nhiên) cho dòng tra cứu. FE tự thêm ĐỘNG TỪ in đậm theo tool name
    (db_find→Đọc, db_aggregate→Tổng hợp, read_kb→Tham khảo) — kiểu Claude Code: **Đọc** dữ liệu cổ phiếu FPT."""
    if call.name == "read_kb":
        return "tài liệu phương pháp"
    if call.name == "get_my_watchlist":
        return "danh sách theo dõi của bạn"
    # arguments đến từ json.loads của model → có thể không phải dict; label KHÔNG được raise.
    args: dict[str, Any] = call.arguments if isinstance(call.arguments, dict) else {}
    collection = args.get("collection")
    label = COLLECTION_LABELS.get(collection) if isinstance(collection, str) else None
    if label is None:
        return FALLBACK
    return f"{label}{_ticker_suffix(args)}"

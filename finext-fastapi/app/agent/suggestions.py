"""Sinh và validate câu hỏi gợi ý cho màn hình chat rỗng.

Gợi ý được sinh tập trung theo lịch (xem app/core/scheduler.py) và dùng chung cho mọi
user, nên KHÔNG bao giờ gọi LLM theo request của người dùng.
"""
import json
import logging
import re

logger = logging.getLogger(__name__)

# Câu hỏi phải là câu hoàn chỉnh, đủ ngắn để hiển thị một dòng.
MIN_LEN = 8
MAX_LEN = 80
COUNT = 5

# Giọng khuyến nghị — cấm theo lập trường compliance của dự án.
# LƯU Ý: không cấm riêng "mua"/"bán" vì "khối ngoại mua ròng" là mô tả hợp lệ.
_ADVICE_PATTERNS = ("có nên", "khuyến nghị", "nên mua", "nên bán", "giá mục tiêu", "target giá")

# Số từ 3 chữ số trở lên = điểm số/giá → dễ lệch khi gợi ý sinh lúc 10h hiện lúc 11h.
_BIG_NUMBER_RE = re.compile(r"\d{3,}")

# Token 3 ký tự in hoa = ứng viên mã cổ phiếu.
_TICKER_RE = re.compile(r"\b[A-Z]{3}\b")

# Viết tắt tài chính 3 ký tự KHÔNG phải mã cổ phiếu — không được loại nhầm.
_NON_TICKER = {"GDP", "CPI", "FED", "ETF", "IPO", "ROE", "ROA", "EPS", "PMI", "USD", "VND", "FDI"}


def validate_suggestions(raw: str, allowed_tickers: set[str]) -> list[str] | None:
    """Kiểm tra output thô của LLM. Trả list 5 câu đã strip, hoặc None nếu không dùng được.

    Trượt bất kỳ luật nào là loại CẢ SET — thà giữ set cũ còn hơn publish nửa vời.
    """
    try:
        items = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return None

    if not isinstance(items, list) or len(items) != COUNT:
        return None

    out: list[str] = []
    for item in items:
        if not isinstance(item, str):
            return None
        q = item.strip()
        if not (MIN_LEN <= len(q) <= MAX_LEN):
            return None
        if not q.endswith("?"):
            return None
        if "%" in q or _BIG_NUMBER_RE.search(q):
            return None
        low = q.lower()
        if any(p in low for p in _ADVICE_PATTERNS):
            return None
        for token in _TICKER_RE.findall(q):
            if token in _NON_TICKER:
                continue
            if token not in allowed_tickers:
                return None
        out.append(q)
    return out

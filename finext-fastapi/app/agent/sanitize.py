"""Bậc 2 — hiệu chỉnh câu trả lời (deterministic). Dọn residual K-hygiene mà prompt bỏ sót.
CHỈ dọn bề mặt (ký hiệu lộ), KHÔNG đổi số/nội dung/phân tích. An toàn > triệt để.
Denylist đồng bộ §15 system_prompt (finext-fastapi/app/agent/kb/system_prompt.md)."""

import re

# Tên collection/field NỘI BỘ (không nghĩa với khách) → xóa khi lộ.
_INTERNAL_NAMES = (
    "history_finratios_stock", "history_finratios_industry", "industry_finstats", "stock_finstats",
    "valuation_ratios", "market_snapshot", "market_recent", "data_briefing", "stock_snapshot",
    "market_intensity", "technical_zone", "breadth_slow", "breadth_blend", "breadth_aux",
    "px_ret20_pct", "conf_dir", "conf_flat", "rank_pct", "marketcap", "corr60", "period",
    "db_aggregate", "read_kb", "db_find", "core",
)  # dài trước ngắn để regex thay đúng cụm dài (history_finratios_stock trước ...ratios)

# Token CÓ NGHĨA với khách → map §9 (cả trần lẫn trong backtick).
_PHRASE_MAP = {
    "w_trend": "độ rộng xu hướng tuần", "m_trend": "độ rộng xu hướng tháng",
    "q_trend": "độ rộng xu hướng quý", "d_trend": "độ rộng xu hướng ngày",
    "day_score": "điểm dòng tiền ngày", "week_score": "điểm dòng tiền tuần",
    "month_score": "điểm dòng tiền tháng",
}

_VSI_NUM_RE = re.compile(r"`?\bVSI\b`?\s*(=|:|≥|>=|≤|<=|>|<)?\s*(\d+(?:[.,]\d+)?)")
_VSI_BARE_RE = re.compile(r"`?\bVSI\b`?")
_EXPOSURE_RE = re.compile(r"`?\bexposure\b`?")
_BACKTICK_RE = re.compile(r"`([^`]+)`")
_SNAKE_RE = re.compile(r"^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$")
_ZONE_GRADE_RE = re.compile(r"(?<=\w)\s*\(([ABC])\)")


def _vsi_num(m: "re.Match[str]") -> str:
    op = (m.group(1) or "").replace("=", "").replace(":", "").strip()
    return f"{op}{m.group(2)}× TB 5 phiên"


def _unwrap_backtick(m: "re.Match[str]") -> str:
    inner = m.group(1)
    if _SNAKE_RE.match(inner):  # snake_case nội bộ còn sót → xóa
        return ""
    return inner  # ticker / cụm đã dịch → gỡ backtick, giữ nội dung


def sanitize_answer(text: str) -> str:
    """Trả câu đã dọn ký hiệu nội bộ. Bảo toàn số, nhãn pha, URL, ticker."""
    if not text:
        return text
    s = text

    # 1) VSI: có số → giữ số + toán tử; trơ → cụm tự nhiên.
    s = _VSI_NUM_RE.sub(_vsi_num, s)
    s = _VSI_BARE_RE.sub("thanh khoản (×TB5)", s)

    # 2) exposure → tỷ lệ nắm giữ.
    s = _EXPOSURE_RE.sub("tỷ lệ nắm giữ", s)

    # 3) Token điểm/độ rộng → map §9 (nuốt backtick 2 bên nếu có).
    for tok, phrase in _PHRASE_MAP.items():
        s = re.sub(rf"`?\b{tok}\b`?", phrase, s)

    # 4) Tên collection/field nội bộ: trong backtick → xóa span; trơ → xóa token.
    for name in _INTERNAL_NAMES:
        s = re.sub(rf"`{name}`", "", s)
        s = re.sub(rf"\b{name}\b", "", s)

    # 5) Backtick còn lại: snake_case sót → xóa; còn lại (ticker/cụm) → gỡ giữ nội dung.
    s = _BACKTICK_RE.sub(_unwrap_backtick, s)

    # 6) Grade zone (A)/(B)/(C) dính sau từ → xóa (giữ nhãn VN đứng trước).
    s = _ZONE_GRADE_RE.sub("", s)

    # 7) Dọn khoảng trắng/dấu câu thừa do bước xóa. KHÔNG đụng số/nội dung.
    s = re.sub(r"\(\s*\)", "", s)
    s = re.sub(r"[ \t]{2,}", " ", s)
    s = re.sub(r"[ \t]+([,.;:])", r"\1", s)
    s = re.sub(r"\(\s+", "(", s)
    s = re.sub(r"\s+\)", ")", s)
    s = re.sub(r"[ \t]+\n", "\n", s)
    return s.strip()

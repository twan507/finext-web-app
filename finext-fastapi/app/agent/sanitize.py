"""Bậc 2 — hiệu chỉnh câu trả lời (deterministic). Dọn residual K-hygiene mà prompt bỏ sót.
CHỈ dọn bề mặt (ký hiệu lộ), KHÔNG đổi số/nội dung/phân tích. An toàn > triệt để.
Denylist đồng bộ §15 system_prompt (finext-fastapi/app/agent/kb/system_prompt.md)."""

import re

# Tên collection/field NỘI BỘ (không nghĩa với khách) → xóa khi lộ.
_INTERNAL_NAMES = (
    "history_finratios_stock", "history_finratios_industry", "industry_finstats", "stock_finstats",
    "valuation_ratios", "market_snapshot", "market_recent", "data_briefing", "stock_snapshot",
    "market_intensity", "technical_zone", "breadth_slow", "breadth_blend", "breadth_aux",
    "industry_rank_pct", "market_rank_pct", "free_float_pct",
    "px_ret20_pct", "conf_dir", "conf_flat", "rank_pct", "marketcap", "corr60", "period",
    "y_pct", "w_pct", "m_pct", "q_pct",
    "db_aggregate", "read_kb", "db_find", "core",
)  # dài trước ngắn để regex thay đúng cụm dài (history_finratios_stock trước ...ratios)

# Token CÓ NGHĨA với khách → map §9 (cả trần lẫn trong backtick).
_PHRASE_MAP = {
    "w_trend": "xu hướng tuần", "m_trend": "xu hướng tháng",
    "q_trend": "xu hướng quý", "d_trend": "xu hướng ngày",
    "y_trend": "xu hướng năm",
    "day_score": "điểm dòng tiền ngày", "week_score": "điểm dòng tiền tuần",
    "month_score": "điểm dòng tiền tháng",
    "industry_rank": "phân vị xếp hạng trong ngành", "rank_pct": "phân vị xếp hạng thị trường",
    "breadth": "độ rộng",
}

# Câu mở đầu kể tiến trình lọt ở LƯỢT CUỐI (loop chỉ bỏ preamble ở lượt gọi-tool; model đôi khi để ở
# câu trả lời cuối). Cắt DÒNG đầu nếu là narration rõ ràng ("Tôi/Mình sẽ…", "Để trả lời…", "Trước tiên…").
# Chỉ cắt khi narration là 1 dòng riêng (kết bằng \n) → an toàn, không cắt nhầm nội dung liền mạch.
_PREAMBLE_RE = re.compile(
    r"^\s*(?:(?:tôi|mình)\s+(?:sẽ|xin)\b"
    r"|để\s+(?:trả lời|phân tích|tổng hợp|tra cứu)\b"
    r"|trước\s+(?:tiên|hết)\b|đầu tiên\b|hãy để\s+(?:tôi|mình)\b)[^\n]*\n+",
    re.IGNORECASE,
)

_VSI_NUM_RE = re.compile(r"`?\bVSI\b`?\s*(=|:|≥|>=|≤|<=|>|<)?\s*(\d+(?:[.,]\d+)?)")
_VSI_BARE_RE = re.compile(r"`?\bVSI\b`?")
_EXPOSURE_RE = re.compile(r"`?\bexposure\b`?", re.IGNORECASE)  # bắt cả "Exposure" viết hoa (đầu bullet)
_BACKTICK_RE = re.compile(r"`([^`]+)`")
_SNAKE_RE = re.compile(r"^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$")
_ZONE_GRADE_RE = re.compile(r"(?<=\w)\s*\(([ABC])\)")
# VAL/VAH/POC (value area / point of control) — §15 denylist. Dạng ghép "VAL-VAH: 1.837-1.875" bỏ nhãn giữ số.
_VA_COMPOUND_RE = re.compile(r"\bVA[LH]\s*[-–]\s*VA[LH]\s*:?\s*")
_VA_BARE = {"VAL": "cận dưới vùng giá", "VAH": "cận trên vùng giá", "POC": "vùng giá giao dịch nhiều nhất"}
# Grade zone trần "mức A/B/C" → nhãn tiếng Việt (technical_zone letter grade).
_ZONE_WORD = {"A": "tích cực", "B": "trung tính", "C": "yếu"}
_ZONE_MUC_RE = re.compile(r"\bmức\s+([ABC])\b")
# Tháng tiếng Anh lọt vào output Việt → "tháng N". "May" trùng từ Việt "may" nên xử riêng (chỉ khi kề năm).
_MONTH_NUM = {
    "january": 1, "jan": 1, "february": 2, "feb": 2, "march": 3, "mar": 3,
    "april": 4, "apr": 4, "june": 6, "jun": 6, "july": 7, "jul": 7,
    "august": 8, "aug": 8, "september": 9, "sept": 9, "sep": 9,
    "october": 10, "oct": 10, "november": 11, "nov": 11, "december": 12, "dec": 12,
}
# Match Title-case (Oct/Nov/Aug — cách model viết); KHÔNG bắt ALL-CAPS để tránh nuốt nhầm ticker.
_MONTH_RE = re.compile(r"\b(" + "|".join(sorted((k.title() for k in _MONTH_NUM), key=len, reverse=True)) + r")\.?\b")
_MAY_RE = re.compile(r"\bMay\b(?=[\s/.–-]*\d{4})")  # chỉ "May" viết hoa + kề năm 4 số → tháng 5
_MONTH_YEAR_RE = re.compile(r"\btháng (\d{1,2})\s+(\d{4})\b")  # "tháng 10 2023" → "tháng 10/2023"

# Taxonomy nội bộ (§8.5) đôi khi lọt ở TRẦN: "Workflow A-M" / "Kịch bản A-M" → xóa nhãn (giữ nội dung quanh).
_TAXONOMY_RE = re.compile(r"\b(?:Workflow|Kịch bản)\s+[A-M]\b", re.IGNORECASE)

# Khối biểu đồ ```finext-widget``` — sanitize CHỪA NGUYÊN (fence + JSON tới FE verbatim; khớp splitWidgets FE).
# Bắt buộc chừa: _BACKTICK_RE gỡ backtick sẽ phá fence ```→``, và xóa tên nội bộ sẽ phá JSON.
_WIDGET_BLOCK_RE = re.compile(r"```finext-widget\s*\n[\s\S]*?```", re.IGNORECASE)

# Khối reasoning của M3 khi thinking=adaptive: "<think>…</think>" nhả inline trong content → BỎ (không lộ ra khách).
_THINK_BLOCK_RE = re.compile(r"<think>[\s\S]*?</think>\s*", re.IGNORECASE)

# Câu TỰ XIN LỖI / TỰ TỐ ẢO GIÁC vô căn cứ (đo thật multi-turn): model tự nhận "dùng số liệu từ trí nhớ /
# có thể sai hoàn toàn / xin lỗi" giữa hội thoại dù user KHÔNG chê và ĐÃ gọi tool → META vô căn cứ, cắt TRỌN câu.
# AN TOÀN (không cắt nhầm nội dung hợp lệ): câu phải VỪA có ngôi thứ nhất (tôi/mình/em) VỪA có 1 dấu hiệu tự tố.
# Ngôi thứ nhất phân biệt lời tự thú ("số liệu TÔI đưa ra có thể sai hoàn toàn") với nhận định hợp lệ
# ("dự báo có thể sai hoàn toàn"); "anh/chị đúng" khi kèm tự phê luôn đi cùng 1 dấu hiệu mạnh nên không cần liệt kê riêng.
_FIRST_PERSON_RE = re.compile(r"\b(?:tôi|mình|em)\b", re.IGNORECASE)
_APOLOGY_MARKER_RE = re.compile(
    r"xin\s+lỗi"                                                     # xin lỗi
    r"|(?:tôi|mình|em)\s+(?:đang|đã)\s+(?:mắc\s+|có\s+)?(?:lỗi|sai)"  # tôi đang mắc lỗi / tôi đã sai
    r"|dùng\s+số\s+(?:liệu\s+)?từ\s+trí\s+nhớ"                       # dùng số (liệu) từ trí nhớ
    r"|(?:có thể|có lẽ)\s+sai\s+(?:hoàn toàn|rồi)"                   # có thể sai hoàn toàn / có lẽ sai rồi
    r"|(?:tôi|mình|em)\s+nhầm",                                      # tôi nhầm
    re.IGNORECASE,
)
# Ranh giới câu: cụm .!?… đứng ngay trước khoảng trắng/hết chuỗi. KHÔNG tính "." giữa 2 chữ số (1.837 / 0,29%.).
_SENTENCE_END_RE = re.compile(r"[.!?…]+(?=\s|$)")


def _vsi_num(m: "re.Match[str]") -> str:
    op = (m.group(1) or "").replace("=", "").replace(":", "").strip()
    try:
        pct = round(float(m.group(2).replace(",", ".")) * 100)
    except ValueError:
        return m.group(0)
    return f"{op}{pct}% trung bình 5 phiên"


def _unwrap_backtick(m: "re.Match[str]") -> str:
    inner = m.group(1)
    if _SNAKE_RE.match(inner):  # snake_case nội bộ còn sót → xóa
        return ""
    return inner  # ticker / cụm đã dịch → gỡ backtick, giữ nội dung


def _month_vn(m: "re.Match[str]") -> str:
    return f"tháng {_MONTH_NUM[m.group(1).lower()]}"


def _split_sentences(s: str) -> list[str]:
    """Tách theo câu; khoảng trắng trước mỗi câu bám vào đầu câu kế (ghép lại không mất spacing)."""
    parts: list[str] = []
    pos = 0
    for m in _SENTENCE_END_RE.finditer(s):
        parts.append(s[pos:m.end()])
        pos = m.end()
    if pos < len(s):
        parts.append(s[pos:])
    return parts


def _is_self_apology(sentence: str) -> bool:
    """Câu tự tố khi VỪA có ngôi thứ nhất VỪA có dấu hiệu tự nhận lỗi (AND — tránh cắt nhầm)."""
    return bool(_FIRST_PERSON_RE.search(sentence) and _APOLOGY_MARKER_RE.search(sentence))


def _cut_self_apology(s: str) -> str:
    """Cắt TRỌN các câu tự xin lỗi/tự tố; rỗng sau khi cắt → trả nguyên bản (không tạo câu rỗng)."""
    sentences = _split_sentences(s)
    kept = [sent for sent in sentences if not _is_self_apology(sent)]
    if len(kept) == len(sentences):
        return s  # không câu nào bị cắt → giữ nguyên (an toàn spacing/số)
    result = "".join(kept)
    return result if result.strip() else s


def _sanitize_text(s: str) -> str:
    """Dọn ký hiệu nội bộ trên MỘT đoạn văn bản thường (KHÔNG phải khối widget). KHÔNG strip (để wrapper ghép)."""
    # 00) Bỏ khối reasoning <think>…</think> — M3 nhả inline vào content khi thinking=adaptive (English/ký hiệu thô).
    #     Ở non-thinking (disabled) không có → no-op. Bắt buộc để reasoning KHÔNG lộ ra khách nếu bật thinking.
    s = _THINK_BLOCK_RE.sub("", s)

    # 0) Cắt câu TỰ XIN LỖI / TỰ TỐ ẢO GIÁC vô căn cứ (giữ nội dung phân tích thật còn lại).
    s = _cut_self_apology(s)

    # 0a) Cắt câu mở đầu kể tiến trình ở lượt cuối (tối đa 2 dòng narration liên tiếp).
    for _ in range(2):
        new = _PREAMBLE_RE.sub("", s, count=1)
        if new == s:
            break
        s = new

    # 0b) Taxonomy nội bộ lọt ("Workflow E", "Kịch bản A") → xóa nhãn (bước 7 dọn khoảng trắng thừa).
    s = _TAXONOMY_RE.sub("", s)

    # 1) VSI: có số → giữ số + toán tử; trơ → cụm tự nhiên.
    s = _VSI_NUM_RE.sub(_vsi_num, s)
    s = _VSI_BARE_RE.sub("thanh khoản (so với trung bình 5 phiên)", s)

    # 2) exposure → tỷ lệ nắm giữ.
    s = _EXPOSURE_RE.sub("tỷ lệ nắm giữ", s)

    # 2b) VAL/VAH/POC: ghép "VAL-VAH:" → bỏ nhãn giữ số; trơ → cụm §9.
    s = _VA_COMPOUND_RE.sub("", s)
    for code, phrase in _VA_BARE.items():
        s = re.sub(rf"\b{code}\b", phrase, s)

    # 2c) Tháng tiếng Anh → "tháng N" (Oct→tháng 10, Aug→tháng 8…); gộp "tháng N YYYY" → "tháng N/YYYY".
    s = _MAY_RE.sub("tháng 5", s)
    s = _MONTH_RE.sub(_month_vn, s)
    s = _MONTH_YEAR_RE.sub(r"tháng \1/\2", s)

    # 3) Token điểm/độ rộng → map §9 (nuốt backtick 2 bên nếu có).
    for tok, phrase in _PHRASE_MAP.items():
        s = re.sub(rf"`?\b{tok}\b`?", phrase, s)

    # 4) Tên collection/field nội bộ: trong backtick → xóa span; trơ → xóa token.
    for name in _INTERNAL_NAMES:
        s = re.sub(rf"`{name}`", "", s)
        s = re.sub(rf"\b{name}\b", "", s)

    # 5) Backtick còn lại: snake_case sót → xóa; còn lại (ticker/cụm) → gỡ giữ nội dung.
    s = _BACKTICK_RE.sub(_unwrap_backtick, s)

    # 6) Grade zone: "(A)/(B)/(C)" dính sau từ → xóa (giữ nhãn VN trước); "mức A/B/C" → nhãn VN.
    s = _ZONE_GRADE_RE.sub("", s)
    s = _ZONE_MUC_RE.sub(lambda m: f"mức {_ZONE_WORD[m.group(1)]}", s)

    # 7) Dọn khoảng trắng/dấu câu thừa do bước xóa. KHÔNG đụng số/nội dung.
    s = re.sub(r"\(\s*\)", "", s)
    s = re.sub(r"[ \t]{2,}", " ", s)
    s = re.sub(r"[ \t]+([,.;:])", r"\1", s)
    s = re.sub(r"\(\s+", "(", s)
    s = re.sub(r"\s+\)", ")", s)
    s = re.sub(r"[ \t]+\n", "\n", s)
    return s


def sanitize_answer(text: str) -> str:
    """Trả câu đã dọn ký hiệu nội bộ. Bảo toàn số, nhãn pha, URL, ticker.

    Khối ```finext-widget``` (biểu đồ) đi VERBATIM tới FE — KHÔNG sanitize (tránh phá fence 3-backtick + JSON).
    Chỉ các đoạn văn bản NGOÀI khối widget mới được dọn ký hiệu."""
    if not text:
        return text
    out: list[str] = []
    last = 0
    for m in _WIDGET_BLOCK_RE.finditer(text):
        out.append(_sanitize_text(text[last:m.start()]))
        out.append(m.group(0))  # khối widget giữ nguyên
        last = m.end()
    out.append(_sanitize_text(text[last:]))
    return "".join(out).strip()

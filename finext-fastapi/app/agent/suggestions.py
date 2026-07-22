"""Sinh và validate câu hỏi gợi ý cho màn hình chat rỗng.

Gợi ý được sinh tập trung theo lịch (xem app/core/scheduler.py) và dùng chung cho mọi
user, nên KHÔNG bao giờ gọi LLM theo request của người dùng.
"""
import json
import logging
import re
from typing import Any

from app.agent.adapters.base import SystemBlock
from app.agent.loop import _complete, build_adapter
from app.core.config import AGENT_DAILY_TOKEN_BUDGET, LLM_MODEL
from app.crud.chat import DAY_DUR, GLOBAL_QUOTA_KEY, QUOTA, _bump_window, _now, _window_used, billable_units
from app.crud.chat_suggestions import save_suggestions
from app.crud.sse.home_today_stock import home_today_stock
from app.crud.sse.news_daily import news_daily
from app.crud.sse.phase_signal import phase_signal

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


TOP_N = 10
HEADLINE_N = 5


def build_snapshot(phase_rows: list[dict], stock_rows: list[dict], news_rows: list[dict]) -> dict:
    """Rút gọn dữ liệu thô thành snapshot nhỏ cho prompt.

    Hàm THUẦN (nhận sẵn dữ liệu) để test được không cần DB.
    Cố ý KHÔNG giữ giá trị số: prompt chỉ được biết CHIỀU biến động, tránh LLM chép số
    vào câu hỏi rồi lệch khi hiển thị ở nhịp sau.
    """
    phase = None
    if phase_rows:
        latest = max(phase_rows, key=lambda r: r.get("date") or "")
        phase = latest.get("final_phase")

    usable = [
        r for r in stock_rows
        if r.get("ticker") and isinstance(r.get("pct_change"), (int, float)) and r.get("industry_name")
    ]
    ranked = sorted(usable, key=lambda r: r["pct_change"], reverse=True)
    gainers = [{"ticker": r["ticker"], "industry_name": r["industry_name"]} for r in ranked[:TOP_N]]
    losers = [{"ticker": r["ticker"], "industry_name": r["industry_name"]} for r in ranked[::-1][:TOP_N]]

    industries = sorted({r["industry_name"] for r in ranked[:TOP_N] + ranked[-TOP_N:]})
    tickers = sorted({r["ticker"] for r in usable})
    headlines = [r["title"] for r in news_rows[:HEADLINE_N] if r.get("title")]

    return {
        "phase": phase,
        "gainers": gainers,
        "losers": losers,
        "industries": industries,
        "headlines": headlines,
        "tickers": tickers,
    }


_SYS = (
    "Bạn soạn câu hỏi gợi ý cho người dùng ứng dụng phân tích chứng khoán Việt Nam.\n"
    "Trả về DUY NHẤT một JSON array gồm đúng 5 chuỗi tiếng Việt, không kèm giải thích.\n"
    "Mỗi chuỗi là một câu hỏi hoàn chỉnh, 8-80 ký tự, kết thúc bằng dấu hỏi.\n"
    "Cơ cấu: 2 câu về bức tranh chung, 2 câu về ngành/mã đang biến động, "
    "1 câu giúp người dùng khám phá tính năng (pha thị trường, bộ lọc).\n"
    "BẮT BUỘC:\n"
    "- Chỉ nhắc mã và ngành có trong dữ liệu được cung cấp.\n"
    "- TUYỆT ĐỐI KHÔNG đưa con số vào câu hỏi (không phần trăm, không điểm số, không giá).\n"
    "- KHÔNG đưa ra khuyến nghị mua/bán, không hỏi 'có nên'."
)


async def _load_sources(db: Any) -> tuple[list[dict], list[dict], list[dict]]:
    """Đọc 3 nguồn thô. Tách riêng để test monkeypatch được mà không cần Mongo thật.

    phase_signal/home_today_stock trả list; news_daily trả {"items", "pagination"}.
    """
    phase_rows = await phase_signal()
    stock_rows = await home_today_stock()
    news_page = await news_daily(page=1, limit=5, sort_by="created_at", sort_order="desc")
    return list(phase_rows or []), list(stock_rows or []), list((news_page or {}).get("items") or [])


def _user_prompt(snapshot: dict) -> str:
    return (
        "Dữ liệu thị trường hiện tại:\n"
        f"- Pha thị trường: {snapshot.get('phase') or 'không rõ'}\n"
        f"- Mã tăng mạnh: {', '.join(g['ticker'] for g in snapshot['gainers']) or 'không có'}\n"
        f"- Mã giảm mạnh: {', '.join(l['ticker'] for l in snapshot['losers']) or 'không có'}\n"
        f"- Ngành đang biến động: {', '.join(snapshot['industries']) or 'không có'}\n"
        f"- Tin mới: {' | '.join(snapshot['headlines']) or 'không có'}\n\n"
        "Soạn 5 câu hỏi gợi ý theo đúng yêu cầu."
    )


async def _global_budget_exhausted(db: Any) -> bool:
    """Cầu dao chi phí: trần <= 0 nghĩa là TẮT (khớp check_quota trong crud/chat.py)."""
    if AGENT_DAILY_TOKEN_BUDGET <= 0:
        return False
    doc = await db[QUOTA].find_one({"user_id": GLOBAL_QUOTA_KEY}) or {}
    used, _ = _window_used(doc.get("g_start"), doc.get("g_tokens"), _now(), DAY_DUR)
    return used >= AGENT_DAILY_TOKEN_BUDGET


async def generate_and_store(db: Any) -> bool:
    """Sinh 1 bộ gợi ý mới và lưu nếu hợp lệ. Trả True nếu đã publish.

    Never-raise: lỗi ở đây không được ảnh hưởng gì tới hệ thống; bỏ nhịp, 30 phút sau
    tự thử lại. Token KHÔNG tính vào quota user nào — chỉ cộng bộ đếm global.
    """
    try:
        if await _global_budget_exhausted(db):
            logger.warning("Bỏ nhịp sinh gợi ý: ngân sách LLM global đã cạn.")
            return False

        phase_rows, stock_rows, news_rows = await _load_sources(db)
        snapshot = build_snapshot(phase_rows, stock_rows, news_rows)

        usage: dict[str, int] = {}
        raw = await _complete(
            build_adapter(thinking="disabled"),
            [SystemBlock(text=_SYS, cache_hint=False)],
            [{"role": "user", "content": _user_prompt(snapshot)}],
            usage,
        )

        tokens = billable_units(usage)
        if tokens > 0:
            await _bump_window(db, GLOBAL_QUOTA_KEY, "g_start", "g_tokens", _now(), DAY_DUR, tokens)

        questions = validate_suggestions(raw, set(snapshot["tickers"]))
        if questions is None:
            logger.warning("Gợi ý sinh ra không hợp lệ — giữ nguyên bộ cũ. Raw: %r", raw[:300])
            return False

        # context lưu kèm để soi lại khi tinh chỉnh prompt
        await save_suggestions(db, questions, snapshot, LLM_MODEL or "", usage)
        logger.info("Đã publish bộ gợi ý mới (%d token quy đổi).", tokens)
        return True
    except Exception:
        logger.exception("Sinh gợi ý thất bại — bỏ nhịp")
        return False

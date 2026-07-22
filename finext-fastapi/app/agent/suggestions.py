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
from app.crud.chat_suggestions import DISPLAY_COUNT, save_suggestions
from app.crud.sse.home_today_stock import home_today_stock
from app.crud.sse.phase_comment import phase_comment
from app.crud.sse.phase_daily import phase_daily

logger = logging.getLogger(__name__)

# Câu hỏi phải là câu hoàn chỉnh, đủ ngắn để hiển thị một dòng.
MIN_LEN = 8
MAX_LEN = 80
# Số câu MỖI VÒNG. Không xin nhiều hơn trong một lượt: model dừng quanh 170-220 token
# output nên xin 10 câu một lượt là chắc chắn bị cắt (đo thực tế 22/07/2026).
COUNT = 5
# Số vòng sinh mỗi nhịp cron → kho ~10 câu, user vào bốc ngẫu nhiên DISPLAY_COUNT câu.
ROUNDS = 2

# Giọng khuyến nghị — cấm theo lập trường compliance của dự án.
# LƯU Ý: không cấm riêng "mua"/"bán" vì "khối ngoại mua ròng" là mô tả hợp lệ.
_ADVICE_PATTERNS = ("có nên", "khuyến nghị", "nên mua", "nên bán", "giá mục tiêu", "target giá")

# Số từ 3 chữ số trở lên = điểm số/giá → dễ lệch khi gợi ý sinh lúc 10h hiện lúc 11h.
_BIG_NUMBER_RE = re.compile(r"\d{3,}")

# Token 3 ký tự in hoa = ứng viên mã cổ phiếu.
_TICKER_RE = re.compile(r"\b[A-Z]{3}\b")

# Viết tắt tài chính 3 ký tự KHÔNG phải mã cổ phiếu — không được loại nhầm.
_NON_TICKER = {"GDP", "CPI", "FED", "ETF", "IPO", "ROE", "ROA", "EPS", "PMI", "USD", "VND", "FDI"}


# Chuỗi JSON HOÀN CHỈNH (có cả cặp nháy đóng), cho phép ký tự escape bên trong.
_JSON_STR_RE = re.compile(r'"((?:[^"\\]|\\.)*)"')

# Tiền tố model hay thêm dù đã dặn không: "1. ", "- ", "* ", "1) ".
_BULLET_RE = re.compile(r'^\s*(?:[-*•]|\d+[.)])\s*')


def _strip_bullet(line: str) -> str:
    """Bỏ đánh số/gạch đầu dòng và dấu nháy bao ngoài."""
    return _BULLET_RE.sub("", line).strip().strip('"').strip("'").strip()


def _parse_items(raw: str) -> list | None:
    """Đọc mảng từ output thô. Trả None nếu không lấy được gì dùng được.

    Model đôi khi trả mảng THIẾU dấu ']' đóng (quên, hoặc stream bị cắt — adapter có cờ
    DoneEvent.truncated nhưng _complete không dùng tới). Khi đó json.loads hỏng và cả bộ
    gợi ý bị vứt, im lặng giữ bộ cũ.

    Vớt lại bằng cách CHỈ lấy các chuỗi hoàn chỉnh: một câu đang viết dở chưa có nháy
    đóng nên không khớp pattern và bị bỏ — không bao giờ vớt nhầm nội dung cụt.
    """
    try:
        items = json.loads(raw)
        if isinstance(items, list):
            return items
    except (json.JSONDecodeError, TypeError):
        pass

    start = raw.find("[")
    if start >= 0:
        found = _JSON_STR_RE.findall(raw[start:])
        if found:
            try:
                return [json.loads(f'"{s}"') for s in found]
            except json.JSONDecodeError:
                pass

    # Format chính là MỖI DÒNG MỘT CÂU (xem _SYS) vì MiniMax-M3 thường không đóng mảng
    # JSON — đo thực tế 22/07/2026: mọi max_tokens đều thiếu ']' dù finish_reason=stop.
    # Dòng không phải câu hỏi (lời dẫn, ```) bị loại vì không kết thúc bằng '?'.
    lines = [_strip_bullet(ln) for ln in raw.splitlines()]
    questions = [ln for ln in lines if ln.endswith("?")]
    return questions or None


def validate_suggestions(raw: str, allowed_tickers: set[str]) -> list[str] | None:
    """Kiểm tra output thô của LLM. Trả list 5 câu đã strip, hoặc None nếu không dùng được.

    Trượt bất kỳ luật nào là loại CẢ SET — thà giữ set cũ còn hơn publish nửa vời.
    """
    items = _parse_items(raw)
    if items is None or len(items) != COUNT:
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
# Cỡ rổ dự phòng khi dữ liệu thiếu cờ top100 — lấy theo thanh khoản để vẫn ra mã quen mặt.
POPULAR_POOL_SIZE = 100


# phase_label trong DB là tiếng Anh; đưa sang prompt bằng tiếng Việt để LLM viết tự nhiên.
_PHASE_VI = {
    "uptrend": "xu hướng tăng",
    "downtrend": "xu hướng giảm",
    "sideway": "đi ngang",
    "transition": "chuyển tiếp",
}
# Chẩn đoán phiên dài ~800 ký tự/trường; cắt để prompt không phình.
MARKET_CMT_MAX = 700


def _trim_at_sentence(text: str, limit: int) -> str:
    """Cắt ở ranh giới CÂU gần nhất, không cắt giữa từ.

    Cắt mù để lại đuôi cụt kiểu 'Giá đang nghiêng hẳn về phía tiê' — model phải đoán
    nốt hoặc bị nhiễu. Không tìm được dấu câu nào thì lùi về khoảng trắng gần nhất.
    """
    if len(text) <= limit:
        return text
    head = text[:limit]
    cut = max(head.rfind(". "), head.rfind("! "), head.rfind("? "))
    if cut > limit // 2:
        return head[: cut + 1]
    space = head.rfind(" ")
    return head[:space] if space > 0 else head


def build_snapshot(
    phase_rows: list[dict],
    comment_rows: list[dict],
    stock_rows: list[dict],
) -> dict:
    """Rút gọn dữ liệu thô thành snapshot nhỏ cho prompt.

    Hàm THUẦN (nhận sẵn dữ liệu) để test được không cần DB.
    Cố ý KHÔNG giữ giá trị số: prompt chỉ được biết CHIỀU biến động, tránh LLM chép số
    vào câu hỏi rồi lệch khi hiển thị ở nhịp sau.
    """
    # phase_daily sort theo date TĂNG dần → phần tử cuối là phiên hiện tại.
    phase = None
    if phase_rows:
        label = (phase_rows[-1] or {}).get("phase_label")
        phase = _PHASE_VI.get(label, label)

    # Chẩn đoán phiên do hệ thống viết sẵn — nguồn "bám sát diễn biến" chính. Không có nó
    # thì LLM chỉ thấy danh sách mã trần trụi và đặt câu chung chung.
    market_cmt = None
    if comment_rows:
        raw_cmt = (comment_rows[0] or {}).get("market_cmt")
        if isinstance(raw_cmt, str) and raw_cmt.strip():
            market_cmt = _trim_at_sentence(raw_cmt.strip(), MARKET_CMT_MAX)

    usable = [
        r for r in stock_rows
        if r.get("ticker") and isinstance(r.get("pct_change"), (int, float)) and r.get("industry_name")
    ]

    # CHỈ lấy mã phổ biến. Xếp hạng thuần theo pct_change trên toàn sàn sẽ luôn cho ra
    # penny UPCOM/HNX thanh khoản thấp (vài nghìn cp khớp là ±10%) — user không nhận ra
    # mã thì gợi ý mất giá trị. top100 chính là nhóm FNX100 app đang hiển thị ở /groups,
    # nên dùng lại định nghĩa sẵn có thay vì tự đặt ngưỡng mới.
    popular = [r for r in usable if r.get("top100") == 1]
    if not popular:
        # Dữ liệu thiếu cờ top100 (pipeline đổi/chưa kịp cập nhật) → không để tính năng
        # chết, rơi về rổ thanh khoản cao nhất phiên.
        popular = sorted(usable, key=lambda r: r.get("trading_value") or 0, reverse=True)[:POPULAR_POOL_SIZE]

    ranked = sorted(popular, key=lambda r: r["pct_change"], reverse=True)
    gainers = [{"ticker": r["ticker"], "industry_name": r["industry_name"]} for r in ranked[:TOP_N]]
    losers = [{"ticker": r["ticker"], "industry_name": r["industry_name"]} for r in ranked[::-1][:TOP_N]]

    presented = gainers + losers
    # Tách ngành theo CHIỀU. Gộp chung một danh sách thì model không biết ngành nào đang
    # tăng, ngành nào đang giảm → dễ hỏi "Bất động sản dẫn dắt?" trong khi VIC/VHM/VRE
    # đang giảm sâu.
    industries_up = sorted({g["industry_name"] for g in gainers})
    industries_down = sorted({x["industry_name"] for x in losers})
    # Allowlist validate = ĐÚNG những mã đã đưa vào prompt. Trước đây là toàn bộ ~1600 mã
    # nên LLM nhắc mã lạ nào cũng lọt; giờ nhắc ngoài danh sách đã trình bày là bị loại.
    tickers = sorted({r["ticker"] for r in presented})

    return {
        "phase": phase,
        "market_cmt": market_cmt,
        "gainers": gainers,
        "losers": losers,
        "industries_up": industries_up,
        "industries_down": industries_down,
        "tickers": tickers,
    }


_SYS = (
    "Bạn soạn sẵn các câu hỏi để NGƯỜI DÙNG bấm vào và GỬI CHO trợ lý AI của một ứng dụng "
    "phân tích chứng khoán Việt Nam.\n\n"
    "QUAN TRỌNG NHẤT: mỗi câu phải là câu NGƯỜI DÙNG HỎI TRỢ LÝ, viết ở giọng người dùng. "
    "Tuyệt đối không hỏi ngược lại người dùng.\n"
    "  SAI:  'Bạn muốn dùng bộ lọc nào để tìm mã tăng mạnh?'\n"
    "  ĐÚNG: 'Lọc giúp tôi các mã đang tăng mạnh trong phiên?'\n"
    "  SAI:  'Bạn quan tâm nhóm ngành nào?'\n"
    "  ĐÚNG: 'Nhóm ngành nào đang dẫn dắt thị trường?'\n\n"
    "ĐỊNH DẠNG TRẢ VỀ: đúng 5 dòng, MỖI DÒNG MỘT CÂU HỎI tiếng Việt.\n"
    "Không đánh số, không gạch đầu dòng, không nháy, không giải thích, không dòng thừa.\n"
    "NGẮN GỌN: mỗi câu TỐI ĐA 45 ký tự, kết thúc bằng dấu hỏi. Viết cô đọng, bỏ chữ thừa.\n\n"
    "Cơ cấu 5 câu:\n"
    "1-2. Bám vào CHẨN ĐOÁN PHIÊN được cung cấp — hỏi về điều đang thực sự diễn ra "
    "(trạng thái thị trường, vì sao như vậy, điều gì đáng chú ý).\n"
    "3-4. Về nhóm ngành hoặc mã cụ thể trong danh sách được cung cấp.\n"
    "5.   Nhờ trợ lý làm một việc cụ thể (lọc mã, so sánh, giải thích chỉ báo).\n\n"
    "BẮT BUỘC:\n"
    "- Chỉ nhắc mã và ngành CÓ TRONG dữ liệu được cung cấp.\n"
    "- TUYỆT ĐỐI KHÔNG đưa con số vào câu hỏi (không phần trăm, không điểm số, không giá) "
    "vì gợi ý hiển thị trễ so với lúc sinh, số sẽ sai. CHẨN ĐOÁN PHIÊN bên dưới CÓ chứa "
    "số — hãy diễn đạt lại bằng lời và bỏ hết số, tuyệt đối không chép sang câu hỏi.\n"
    "- Ngành tăng và ngành giảm được liệt kê RIÊNG. Không hỏi ngành đang giảm như thể nó "
    "đang dẫn dắt, và ngược lại.\n"
    "- KHÔNG khuyến nghị mua/bán, không hỏi 'có nên'.\n"
    "- Mỗi câu một ý, tự nhiên như người thật gõ vào ô chat."
)


async def _load_sources(db: Any) -> tuple[list[dict], list[dict], list[dict]]:
    """Đọc 3 nguồn thô. Tách riêng để test monkeypatch được mà không cần Mongo thật.

    phase_daily trả list sort theo date TĂNG dần → phần tử CUỐI là phiên hiện tại.
    phase_comment đã sort giảm dần + limit 1 (chẩn đoán phiên mới nhất); có thể rỗng vì
    bảng comment tới trễ vài phút so với bảng số.

    KHÔNG dùng phase_signal: collection đó RỖNG trong DB thật (kiểm 22/07/2026), nên bản
    đầu luôn có phase=None và gợi ý mất hẳn bối cảnh phiên.

    KHÔNG dùng news_daily: tiêu đề tin chứa mã NGOÀI allowlist (VCA, NTP, FPT...) nên
    model dễ nhắc tới rồi cả bộ bị validate loại, im lặng giữ bộ cũ. Cơ cấu 5 câu cũng
    không dùng tới tin — đưa vào chỉ tốn token và tạo bẫy.
    """
    phase_rows = await phase_daily()
    comment_rows = await phase_comment()
    stock_rows = await home_today_stock()
    return list(phase_rows or []), list(comment_rows or []), list(stock_rows or [])


def _user_prompt(snapshot: dict, already: list[str] | None = None) -> str:
    """`already`: câu đã soạn ở vòng trước — vòng sau phải ra ý KHÁC, không trùng."""
    parts = [f"Trạng thái thị trường: {snapshot.get('phase') or 'không rõ'}"]
    if snapshot.get("market_cmt"):
        parts.append(
            "\nCHẨN ĐOÁN PHIÊN (hệ thống viết sẵn — dùng làm bối cảnh chính cho câu 1-2):\n"
            f"{snapshot['market_cmt']}"
        )
    parts += [
        f"\nMã tăng mạnh: {', '.join(g['ticker'] for g in snapshot['gainers']) or 'không có'}",
        f"Mã giảm mạnh: {', '.join(x['ticker'] for x in snapshot['losers']) or 'không có'}",
        f"Ngành của các mã ĐANG TĂNG: {', '.join(snapshot['industries_up']) or 'không có'}",
        f"Ngành của các mã ĐANG GIẢM: {', '.join(snapshot['industries_down']) or 'không có'}",
    ]
    if already:
        parts.append(
            "\nĐÃ CÓ SẴN các câu sau — soạn 5 câu KHÁC HẲN về ý, đừng hỏi lại cùng nội dung:\n"
            + "\n".join(f"- {q}" for q in already)
        )
    parts.append("\nSoạn 5 câu hỏi gợi ý theo đúng yêu cầu.")
    return "\n".join(parts)


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

        phase_rows, comment_rows, stock_rows = await _load_sources(db)
        snapshot = build_snapshot(phase_rows, comment_rows, stock_rows)

        adapter = build_adapter(thinking="disabled")
        allowed = set(snapshot["tickers"])
        usage: dict[str, int] = {}
        collected: list[str] = []

        # Sinh nhiều VÒNG thay vì xin hết trong một lượt: model dừng quanh 170-220 token
        # output (đo 22/07/2026, xem _parse_items) nên 10 câu một lượt chắc chắn bị cắt.
        # Vòng sau được biết vòng trước đã hỏi gì để ra ý khác.
        for round_no in range(ROUNDS):
            raw = await _complete(
                adapter,
                [SystemBlock(text=_SYS, cache_hint=False)],
                [{"role": "user", "content": _user_prompt(snapshot, already=collected)}],
                usage,
            )
            batch = validate_suggestions(raw, allowed)
            if batch is None:
                logger.warning("Vòng %d không hợp lệ — bỏ qua. Raw: %r", round_no + 1, raw[:200])
                continue
            # Trùng câu giữa hai vòng thì bỏ, giữ nguyên thứ tự xuất hiện.
            seen = {q.lower() for q in collected}
            collected += [q for q in batch if q.lower() not in seen]

        tokens = billable_units(usage)
        if tokens > 0:
            await _bump_window(db, GLOBAL_QUOTA_KEY, "g_start", "g_tokens", _now(), DAY_DUR, tokens)

        # Đủ để bốc ngẫu nhiên là publish. Vòng 2 trượt vẫn còn 5 câu dùng được — thà
        # kho nhỏ hơn dự kiến còn hơn giữ bộ cũ đã lỗi thời.
        if len(collected) < DISPLAY_COUNT:
            logger.warning("Chỉ gom được %d câu hợp lệ (<%d) — giữ nguyên bộ cũ.", len(collected), DISPLAY_COUNT)
            return False

        # context lưu kèm để soi lại khi tinh chỉnh prompt
        await save_suggestions(db, collected, snapshot, LLM_MODEL or "", usage)
        logger.info("Đã publish %d câu gợi ý (%d token quy đổi).", len(collected), tokens)
        return True
    except Exception:
        logger.exception("Sinh gợi ý thất bại — bỏ nhịp")
        return False

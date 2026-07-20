"""Vòng lặp LLM ↔ tools. Không biết provider nào, không biết gateway nào (doc 02 §4.2)."""

import asyncio
import hashlib
import json
import logging
import re
from collections.abc import Awaitable, Callable
from typing import Any

import httpx

from app.agent.adapters.anthropic_compat import AnthropicCompatAdapter
from app.agent.adapters.base import ModelAdapter, SystemBlock
from app.agent.adapters.openai_compat import REQUEST_TIMEOUT, OpenAICompatAdapter
from app.agent.events import DoneEvent, ErrorEvent, ToolCall, ToolCallsEvent, TokenEvent
from app.agent.gateway.types import GatewayContext, GatewayProtocol
from app.agent.labels import label_for
from app.agent.sanitize import sanitize_answer
from app.agent.tools.registry import TOOL_SCHEMAS, execute_tool
from app.core.config import (
    LLM_API_KEY,
    LLM_API_STYLE,
    LLM_BASE_URL,
    LLM_MAX_OUTPUT_TOKENS,
    LLM_MODEL,
    LLM_REASONING_EFFORT,
    LLM_TEMPERATURE,
    LLM_THINKING,
)

logger = logging.getLogger(__name__)

MAX_ITERS = 10  # nới từ 8: dư chỗ cho retry + câu phân tích nhiều nguồn
MAX_EMPTY_RETRY = 3  # quota CHUNG cho nudge lượt-cuối: rỗng/preamble + grounding (bịa số chưa gọi tool)
# Trần token/lượt trả lời. Trần cứng v4-flash/pro = 384K; default 64K cho câu phân tích dài, dư đầu cho thinking sau.
MAX_OUTPUT_TOKENS = int(LLM_MAX_OUTPUT_TOKENS) if LLM_MAX_OUTPUT_TOKENS else 64000
MAX_TOTAL_TOOL_CHARS = 30_000
STREAM_CHUNK = 8  # ký tự/đoạn khi nhả lại câu đã sanitize — cắt ở khoảng trắng (nhỏ hơn = mượt hơn).
STREAM_CHUNK_DELAY_S = 0.09  # nhịp giữa các đoạn (~89 ký tự/giây — chậm & tự nhiên hơn, tránh "phọt một đống" sau khi nghĩ lâu).

_REPEAT_FEEDBACK = (
    "Query này đã được thử ở trên và bị lỗi. Đừng lặp lại y hệt — hãy đổi cách: thu hẹp phạm vi, "
    "sửa tham số theo gợi ý lỗi trước, hoặc dùng db_stats để lấy số tổng hợp (min/đỉnh/đáy/percentile) "
    "thay vì tự tính trên chuỗi dài."
)

# Nudge nội bộ hay bị model NHẠI thành lời xin lỗi/tự-nhận-lỗi trước khách (apology ảo giác, multi-turn) → cấm rõ.
_NO_META = "Không xin lỗi, không tự nhận lỗi, không kể việc bạn đã/đang làm — chỉ đưa NỘI DUNG trả lời cho khách."

_CONTINUE_NUDGE = (
    "Bạn chưa trả lời câu hỏi của khách. Nếu cần dữ liệu hãy GỌI TOOL ngay bây giờ; "
    "nếu đã đủ dữ liệu hãy trả lời TRỰC TIẾP nội dung cho khách. "
    "TUYỆT ĐỐI không mô tả việc bạn sắp làm (không 'Tôi sẽ...', không nêu tên bước/tool). " + _NO_META
)
_FORCE_ANSWER_NUDGE = (
    "Đã đủ dữ liệu để trả lời. Hãy trả lời NGAY câu hỏi của khách dựa trên dữ liệu đã lấy được ở trên, "
    "trình bày gọn, không gọi thêm tool, không mô tả tiến trình. " + _NO_META
)
_GROUND_NUDGE = (
    "Bạn đưa số liệu/bảng nhưng CHƯA gọi tool nào để lấy dữ liệu thật. Hãy GỌI TOOL "
    "(db_find/db_aggregate/db_stats) lấy số thật từ hệ thống rồi trả lời lại. " + _NO_META
)
_NUM_GUARD_NUDGE = (
    "Số/giá bạn nêu chưa khớp dữ liệu tool. Đọc lại kết quả tool ở trên, lấy ĐÚNG con số (trường close/price/value) "
    "rồi trả lời lại; nếu tool chưa trả thì gọi lại db_find. " + _NO_META
)
_VERIFY_NODATA_NUDGE = (
    "Bạn kết luận 'không có dữ liệu' — hãy KIỂM TRA KỸ trước khi nói vậy với khách: query lại bằng cách khác "
    "(đúng tên field/collection theo schema, thử db_find/db_stats). Nếu sau khi thử đủ cách VẪN không có thì mới "
    "khẳng định không có; KHÔNG bịa số để lấp chỗ trống. " + _NO_META
)
_MAX_ITERS_ERROR = "Có lỗi khi tra cứu dữ liệu cho câu này. Bạn thử hỏi lại hoặc diễn đạt theo cách khác giúp mình nhé."

# Lượt cuối coi như CHƯA trả lời nếu là câu dẫn "Tôi sẽ..." ngắn (chưa có nội dung thật).
_PREAMBLE_ONLY_RE = re.compile(
    r"^\s*(tôi sẽ|mình sẽ|để (?:tôi|mình)|bắt đầu (?:bằng|với)|trước tiên|trước hết|đầu tiên|hãy để tôi|let me|i'?ll)\b",
    re.IGNORECASE,
)


def _needs_retry(answer: str) -> bool:
    """Lượt cuối coi như CHƯA trả lời nếu: rỗng, hoặc là câu dẫn 'Tôi sẽ...' ngắn (chưa có nội dung thật)."""
    a = answer.strip()
    if not a:
        return True
    return bool(_PREAMBLE_ONLY_RE.match(a) and len(a) < 300)


# Bảng markdown có ô số → dấu hiệu CHẮC CHẮN câu trả lời DỮ LIỆU (từ tool) cần grounding.
_TABLE_ROW_RE = re.compile(r"^\s*\|.*\d.*\|.*\|", re.MULTILINE)
# Đơn vị GIÁ HÀNG HOÁ (luôn raw từ tool, KHÔNG phái sinh) — model bịa được từ trí nhớ
# (cu T10 multi-turn: "593 USD/tấn" trong khi DB thật là 3342 CNY/tấn).
_COMMODITY_UNIT = r"(?:USD|CNY|EUR)\s*/\s*(?:tấn|thùng|oz|ounce|MT|kg|lít|gallon|bushel|barrel)"
# Khẳng định GIÁ cụ thể "138.500 đồng" / "68.000 đ/cp" / "593 USD/tấn" → LUÔN phải từ tool (không có sẵn trong briefing,
# không phải số minh hoạ khái niệm: "10 triệu đồng" KHÔNG khớp vì 'triệu' chen giữa). Diệt bịa giá cổ phiếu + hàng hoá.
_PRICE_CLAIM_RE = re.compile(rf"\d[\d.,]{{2,}}\s*(?:đồng|đ/\s*cp|đ\b|{_COMMODITY_UNIT})", re.IGNORECASE)


# Số thị trường CHÍNH XÁC (thập phân + tỷ/lần): khối ngoại "17.82 tỷ", P/E "8.88 lần" — luôn từ tool, KHÔNG phải
# số minh hoạ khái niệm (số làm tròn "15 lần"/"vài tỷ" KHÔNG khớp vì không có phần thập phân). Bắt bịa inline khi tools=0.
# CHỦ Ý KHÔNG thêm "%": %-thay-đổi thập phân trong HEADLINE ("VNINDEX ... (+1,24%)") là số grounded-từ-briefing,
# thêm "%" sẽ false-trigger đúng lớp headline mà spec muốn tránh (giống lý do loại "điểm"). Xem báo cáo Round 6.
_MARKET_FIGURE_RE = re.compile(r"\d+[.,]\d+\s*(?:tỷ|lần)\b", re.IGNORECASE)


def _looks_like_data_answer(answer: str) -> bool:
    """Câu 'dữ liệu cần grounding': BẢNG markdown số / GIÁ 'X đồng'|hàng hoá / số thị trường thập phân 'X tỷ'|'X lần'.

    BỎ heuristic '>=6 số thập phân' (bắt nhầm câu khái niệm, regression Q04); giữ các tín hiệu CHẮC CHẮN từ-tool."""
    return bool(_TABLE_ROW_RE.search(answer) or _PRICE_CLAIM_RE.search(answer) or _MARKET_FIGURE_RE.search(answer))


# Kết luận "không có dữ liệu" — cần LOOP KĨ xác minh trước khi để khách nghe (M3, nhất là thinking, đôi khi
# tuyên bố thiếu-dữ-liệu DÙ dữ liệu CÓ thật: khai sai tên field, đọc sót kết quả tool, hoặc chưa query gì).
_NO_DATA_RE = re.compile(
    r"(?:không|chưa)\s+có\s+dữ liệu|dữ liệu\s+(?:bị\s+)?thiếu|block\s+dữ liệu(?:\s+bị)?\s+thiếu|"
    r"chưa\s+phát sinh|khoảng trống\s+dữ liệu|không\s+có\s+số\s+để",
    re.IGNORECASE,
)


def _claims_no_data(answer: str) -> bool:
    return bool(_NO_DATA_RE.search(answer))


# ── Numeric-grounding guard cho SỐ (giá + tỷ + lần) — diệt bịa số khi M3 phớt lờ kết quả tool ────
# Bắt case M3 GỌI tool nhưng PHỚT LỜ kết quả rồi tự chế số (tools_ran>0, grounding-retry cũ không bắt).
# Kiểm claim GIÁ + "X tỷ" + "X lần" — KHÔNG kiểm "%" (số phái sinh, không có raw trong tool) / điểm / median.
_NUM_IN_TEXT_RE = re.compile(r"\d[\d.,]*\d|\d")
# Con số đứng NGAY TRƯỚC đơn vị dữ liệu ("145.500 đồng" / "68.000 đ/cp" / "593 USD/tấn" / "17,82 tỷ" / "8,9 lần").
_DATA_VALUE_RE = re.compile(rf"(\d[\d.,]*\d|\d)\s*(?:đồng|đ/\s*cp|đ|{_COMMODITY_UNIT}|tỷ|lần)\b", re.IGNORECASE)


def _parse_number(tok: str) -> float | None:
    """Parse số kiểu VN: dot=thousands, comma=decimal. '145.500'→145500; '13,08'→13.08; '1.804,24'→1804.24."""
    t = tok.strip().rstrip(".,")
    if not t:
        return None
    if "," in t:
        t = t.replace(".", "").replace(",", ".")
    else:
        # chỉ có dot: nhóm 3 số (145.500) là thousands; còn lại (13.08) là decimal.
        if re.fullmatch(r"\d{1,3}(\.\d{3})+", t):
            t = t.replace(".", "")
    try:
        return float(t)
    except ValueError:
        return None


def _register_grounded(text: str, acc: set[int]) -> None:
    """Nạp mọi số THẬT từ 1 tool_result vào registry, có dung sai đơn vị nghìn đồng ↔ đồng (*1000, /1000)."""
    for tok in _NUM_IN_TEXT_RE.findall(text):
        v = _parse_number(tok)
        if v is None:
            continue
        for m in (v, v * 1000, v / 1000):
            if 0 < abs(m) < 1e15:
                acc.add(int(round(m)))


def _ungrounded_data(answer: str, grounded: set[int]) -> bool:
    """True nếu 1 claim SỐ (giá 'X đồng'/hàng hoá | 'X tỷ' | 'X lần') KHÔNG truy được về grounded (đã bịa).

    DUNG SAI TƯƠNG ĐỐI 2% HOẶC ±1 tuyệt đối (cái nào lớn hơn): số lớn model làm tròn ("700 tỷ" vs grounded
    702.55 → |700-703|=3 ≤ max(1, 14) → GROUNDED) KHÔNG bị báo nhầm. Candidate 0 bị loại (vô nghĩa, tránh
    trùng oan với 0 sinh ra do /1000 làm tròn). '%' KHÔNG vào đây (số phái sinh, không có raw trong tool)."""
    for tok in _DATA_VALUE_RE.findall(answer):
        v = _parse_number(tok)
        if v is None:
            continue
        cands = {c for c in (round(v), round(v * 1000), round(v / 1000)) if c != 0}
        if not any(abs(cand - g) <= max(1.0, 0.02 * abs(cand)) for cand in cands for g in grounded):
            return True  # 1 số không khớp tool = đủ để nghi bịa
    return False


# Alias tương thích: guard cũ chỉ cho GIÁ (_ungrounded_price), nay tổng quát hoá sang giá + tỷ + lần.
_ungrounded_price = _ungrounded_data


# ── Guard chống RE-BRIEFING đa lượt (gated LLM rewrite) ─────────────────────────────────────────
# Câu nối tiếp đôi khi (M3 biến thiên) dựng lại gần trọn câu trả lời lượt trước. Prompt hạ mức TB nhưng
# không diệt 100% được (model ngẫu nhiên). CỔNG rẻ = trùng-SỐ cao vs câu assistant liền trước → chạy 1 lượt
# M3 viết lại bỏ phần lặp (có sẵn bản nháp → không bịa/không cụt). Rewriter CONSERVATIVE: nháp vốn mới thì giữ.
DEDUP_MIN_LEN = 1000  # câu ngắn (ý kiến/tóm tắt) bỏ qua
DEDUP_MIN_NUMS = 10  # cần đủ số nổi bật để phép trùng có nghĩa
DEDUP_OVERLAP = 0.75  # ≥75% số nổi bật của nháp đã có ở câu trước → nghi re-brief
_SALIENT_NUM_RE = re.compile(r"\d[\d.]*,\d+|\d{1,3}(?:\.\d{3})+|\d{2,}")


def _salient_numbers(text: str) -> list[float]:
    """Số 'nổi bật' (thập phân / nhóm nghìn / nguyên ≥2 chữ số), bỏ 0/1 (đếm mã) — để đo trùng giữa 2 lượt."""
    text = re.sub(r"```finext-widget[\s\S]*?```", " ", text)
    out: list[float] = []
    for tok in _SALIENT_NUM_RE.findall(text):
        v = _parse_number(tok)
        if v is not None and abs(v) >= 2:
            out.append(round(v, 2))
    return out


def _rebrief_overlap(draft: str, prev: str) -> tuple[float, int]:
    """(tỷ lệ số nổi bật của draft (dedupe) khớp số trong prev với dung sai 1%, số_uniq_của_draft)."""
    cand = sorted(set(_salient_numbers(draft)))
    if not cand:
        return 0.0, 0
    prev_nums = _salient_numbers(prev)
    matched = sum(1 for a in cand if any(abs(a - b) <= max(0.5, 0.01 * abs(a)) for b in prev_nums))
    return matched / len(cand), len(cand)


def _should_dedup(draft: str, prev: str | None) -> bool:
    """CỔNG: chỉ nghi re-brief khi có câu trước + nháp dài + nhiều số + trùng-số cao vs câu trước."""
    if not prev or len(draft) < DEDUP_MIN_LEN:
        return False
    overlap, n = _rebrief_overlap(draft, prev)
    return n >= DEDUP_MIN_NUMS and overlap >= DEDUP_OVERLAP


def _last_assistant_text(messages: list[dict[str, Any]]) -> str | None:
    """Câu trả lời assistant gần nhất trong history (content chuỗi — bỏ qua lượt tool-call content=None)."""
    for msg in reversed(messages):
        if msg.get("role") == "assistant" and isinstance(msg.get("content"), str) and msg["content"].strip():
            return msg["content"]
    return None


_DEDUP_SYS = (
    "Bạn CHÍNH LÀ trợ lý đó, đang trả lời khách ở lượt tiếp theo. Viết lại nội dung cho lượt này sao cho KHÔNG lặp "
    "lại thứ đã nói ở lượt trước. Viết như đang nói trực tiếp với khách — TUYỆT ĐỐI không nhắc tới 'bản nháp', "
    "'phần mới', 'lượt trước', hay việc bạn đang biên tập. Chỉ xuất câu trả lời gửi khách."
)


def _dedup_prompt(prev: str, draft: str) -> str:
    return (
        "[NỘI DUNG ĐÃ GỬI KHÁCH Ở LƯỢT TRƯỚC]\n" + prev + "\n\n[NỘI DUNG DỰ ĐỊNH GỬI LƯỢT NÀY]\n" + draft + "\n\n"
        "Nội dung dự định gửi đang lặp lại nhiều số liệu/bảng/nhận định đã gửi ở lượt trước. Viết lại thành câu trả "
        "lời gửi khách, CẮT TRIỆT ĐỂ mọi thứ đã nói:\n"
        "- MỞ ĐẦU bằng phần MỚI (thay đổi/kết luận/góc chưa nêu); nhắc thứ cũ tối đa 1 câu ngắn (\"như đã nêu\").\n"
        "- Nếu THỰC SỰ không có gì mới so với lượt trước: trả lời NGẮN rằng chưa có thay đổi đáng kể so với phần "
        "phân tích trước, kèm 1-2 số chốt hiện tại, rồi mời khách hỏi sâu khía cạnh cụ thể. KHÔNG nói 'phần mới rỗng'.\n"
        "- TUYỆT ĐỐI không thêm số liệu không có trong nội dung trên; giữ giá/khuyến nghị quan trọng nếu có.\n"
        "- Tiếng Việt tự nhiên như đang trả lời khách, markdown. CHỈ xuất câu trả lời, không lời dẫn/không nhắc 'bản nháp'."
    )


# Chặn rò meta biên tập ra output khách (từ không bao giờ hợp lệ trong câu trả lời).
_DEDUP_META_RE = re.compile(r"bản nháp|\bdraft\b|phần mới ở đây|trùng lặp hoàn toàn", re.IGNORECASE)


def _call_signature(call: ToolCall) -> str:
    """Chữ ký ổn định cho 1 tool call (name + arguments) — để phát hiện lặp lại query đã lỗi."""
    args = call.arguments if isinstance(call.arguments, dict) else {}
    payload = json.dumps(args, sort_keys=True, ensure_ascii=False, default=str)
    return hashlib.sha1(f"{call.name}|{payload}".encode("utf-8")).hexdigest()


def _stream_chunks(text: str) -> list[str]:
    """Cắt text thành đoạn ~STREAM_CHUNK ký tự ở ranh giới khoảng trắng/xuống dòng (không cắt giữa từ)."""
    chunks: list[str] = []
    i, n = 0, len(text)
    while i < n:
        j = min(i + STREAM_CHUNK, n)
        if j < n:
            cut = max(text.rfind(" ", i, j), text.rfind("\n", i, j))
            if cut > i:
                j = cut + 1
        chunks.append(text[i:j])
        i = j
    return chunks


Emit = Callable[[str, dict[str, Any]], Awaitable[None]]

# Carryover #2: 1 AsyncClient dùng chung, lazy-init ở module — tránh rò connection pool khi mỗi
# request tạo-rồi-bỏ client mới. Mọi request FastAPI chạy chung 1 event loop nên singleton an toàn.
_shared_client: httpx.AsyncClient | None = None


def _get_client() -> httpx.AsyncClient:
    global _shared_client
    if _shared_client is None or _shared_client.is_closed:
        _shared_client = httpx.AsyncClient(timeout=REQUEST_TIMEOUT)
    return _shared_client


def build_adapter(thinking: str | None = None) -> ModelAdapter:
    """thinking: override per-request ("adaptive"|"disabled" cho M3). None → dùng cấu hình env LLM_THINKING."""
    if not (LLM_BASE_URL and LLM_API_KEY and LLM_MODEL):
        raise RuntimeError("Thiếu cấu hình LLM_BASE_URL / LLM_API_KEY / LLM_MODEL")
    temp = float(LLM_TEMPERATURE) if LLM_TEMPERATURE else None
    _thinking = thinking if thinking is not None else LLM_THINKING
    if LLM_API_STYLE == "anthropic":
        return AnthropicCompatAdapter(
            base_url=LLM_BASE_URL,
            api_key=LLM_API_KEY,
            model=LLM_MODEL,
            client=_get_client(),
            temperature=temp,
            thinking=_thinking,
            reasoning_effort=LLM_REASONING_EFFORT,
        )
    return OpenAICompatAdapter(
        base_url=LLM_BASE_URL,
        api_key=LLM_API_KEY,
        model=LLM_MODEL,
        client=_get_client(),
        temperature=temp,
        thinking=_thinking,
        reasoning_effort=LLM_REASONING_EFFORT,
    )


def _merge_usage(total: dict[str, int], usage: dict[str, int]) -> None:
    """Cộng dồn usage qua MỌI vòng LLM của một lượt chat — cả vòng gọi tool lẫn vòng trả lời cuối.
    Mỗi vòng gửi lại toàn bộ system prompt + history nên vòng gọi tool tốn token không kém vòng cuối."""
    for key, value in usage.items():
        if isinstance(value, int):
            total[key] = total.get(key, 0) + value


async def _run_tools(
    gateway: GatewayProtocol, ctx: GatewayContext, calls: list[ToolCall], emit: Emit, failed_sig: set[str]
) -> list[dict[str, Any]]:
    for call in calls:
        await emit("tool_start", {"name": call.name, "label": label_for(call)})

    async def _run_one(call: ToolCall) -> tuple[str, dict[str, Any]]:
        # Chữ ký đã lỗi ở lượt trước → KHÔNG chạm gateway, trả feedback mạnh để model đổi cách.
        if _call_signature(call) in failed_sig:
            return _REPEAT_FEEDBACK, {"ok": False, "ms": 0}
        return await execute_tool(gateway, ctx, call)

    results = await asyncio.gather(*(_run_one(call) for call in calls))

    messages: list[dict[str, Any]] = []
    budget = MAX_TOTAL_TOOL_CHARS
    for call, (content, meta) in zip(calls, results, strict=True):
        await emit("tool_end", {"name": call.name, "ok": meta["ok"], "ms": meta["ms"]})
        if not meta["ok"]:
            failed_sig.add(_call_signature(call))
        if len(content) > budget:
            content = content[:budget] + " …[đã cắt do vượt ngân sách]" if budget > 0 else "[đã cắt do vượt ngân sách]"
        budget = max(0, budget - len(content))
        messages.append({"role": "tool", "tool_call_id": call.id, "content": content})
    return messages


def _assistant_tool_message(calls: list[ToolCall], reasoning_content: str | None = None) -> dict[str, Any]:
    message: dict[str, Any] = {
        "role": "assistant",
        "content": None,
        "tool_calls": [
            {
                "id": call.id,
                "type": "function",
                "function": {"name": call.name, "arguments": json.dumps(call.arguments, ensure_ascii=False)},
            }
            for call in calls
        ],
    }
    if reasoning_content is not None:
        message["reasoning_content"] = reasoning_content
    return message


async def _drive_turn(
    adapter: ModelAdapter,
    system: list[SystemBlock],
    working: list[dict[str, Any]],
    tools: list[dict[str, Any]],
    usage_total: dict[str, int],
) -> tuple[list[ToolCall], str | None, str, bool, str]:
    """Chạy 1 lượt stream, KHÔNG emit gì — run_agent quyết định chấp nhận/retry trước khi stream.

    Trả (pending_calls, reasoning, final_text, truncated, status); status ∈ {"tools","final","error","empty"}.
    Token được buffer (interim/final chưa biết ở đây); chỉ sanitize khi status="final".
    """
    pending: list[ToolCall] = []
    pending_reasoning: str | None = None
    buffer: list[str] = []
    async for event in adapter.stream_chat(
        system=system, messages=working, tools=tools, max_tokens=MAX_OUTPUT_TOKENS
    ):
        if isinstance(event, TokenEvent):
            buffer.append(event.text)  # KHÔNG emit — chờ run_agent quyết định
        elif isinstance(event, ToolCallsEvent):
            pending = event.calls
            pending_reasoning = event.reasoning_content
            _merge_usage(usage_total, event.usage)  # vòng gọi tool cũng tốn token — không được bỏ sót
            return pending, pending_reasoning, "", False, "tools"
        elif isinstance(event, DoneEvent):
            _merge_usage(usage_total, event.usage)
            return pending, pending_reasoning, sanitize_answer("".join(buffer)), event.truncated, "final"
        elif isinstance(event, ErrorEvent):
            return pending, pending_reasoning, event.message, False, "error"
    return pending, pending_reasoning, "", False, "empty"  # stream hết mà không có terminal


async def _emit_answer(emit: Emit, text: str, usage_total: dict[str, int], truncated: bool) -> None:
    """Nhả câu trả lời (ĐÃ sanitize) theo chunk rồi phát done. Giữ nguyên SSE contract token/done."""
    for i, chunk in enumerate(_stream_chunks(text)):
        if i:
            await asyncio.sleep(STREAM_CHUNK_DELAY_S)  # tạo nhịp → FE nhả chữ dần, không đổ 1 lần
        await emit("token", {"text": chunk})
    await emit("done", {"usage": usage_total, "truncated": truncated})


async def _complete(
    adapter: ModelAdapter, system: list[SystemBlock], messages: list[dict[str, Any]], usage_total: dict[str, int]
) -> str:
    """Gọi model 1 lượt KHÔNG tool, gom text (dùng cho guard rewrite). Trả '' nếu lỗi/tool-call bất ngờ."""
    buffer: list[str] = []
    async for event in adapter.stream_chat(system=system, messages=messages, tools=[], max_tokens=MAX_OUTPUT_TOKENS):
        if isinstance(event, TokenEvent):
            buffer.append(event.text)
        elif isinstance(event, DoneEvent):
            _merge_usage(usage_total, event.usage)
            return "".join(buffer)
        elif isinstance(event, (ToolCallsEvent, ErrorEvent)):
            return ""
    return "".join(buffer)


async def _dedup_rewrite(
    adapter: ModelAdapter, prev: str, draft: str, usage_total: dict[str, int]
) -> str:
    """1 lượt M3 viết lại 'draft' bỏ phần lặp so với 'prev'. Lỗi/rỗng → '' (giữ nguyên câu gốc)."""
    system = [SystemBlock(text=_DEDUP_SYS, cache_hint=False)]
    messages = [{"role": "user", "content": _dedup_prompt(prev, draft)}]
    try:
        out = await _complete(adapter, system, messages, usage_total)
    except Exception:  # never-raise: guard hỏng không được làm sập câu trả lời
        logger.exception("dedup rewrite lỗi — giữ nguyên câu gốc")
        return ""
    # Backstop: bỏ dòng rò meta biên tập ("bản nháp"/"phần mới ở đây"…) — không bao giờ hợp lệ trong câu gửi khách.
    if _DEDUP_META_RE.search(out):
        out = "\n".join(ln for ln in out.split("\n") if not _DEDUP_META_RE.search(ln)).strip()
    return out


# ── Đặt tiêu đề hội thoại bằng AI (1 call rẻ, chỉ ở lượt đầu) ─────────────────────────────────────
_TITLE_SYS = (
    "Bạn đặt tiêu đề cho cuộc trò chuyện. Chỉ trả về MỘT tiêu đề tiếng Việt ngắn gọn (tối đa 6 từ), "
    "viết hoa đầu câu, KHÔNG dấu ngoặc kép, KHÔNG dấu chấm cuối, KHÔNG giải thích, KHÔNG tiền tố 'Tiêu đề:'."
)
_TITLE_LABEL_RE = re.compile(r"^\s*(tiêu đề|title)\s*[:：\-]\s*", re.IGNORECASE)


def _title_prompt(first_message: str) -> str:
    return (
        "Đặt tiêu đề tiếng Việt ngắn gọn (tối đa 6 từ) tóm tắt chủ đề cuộc trò chuyện bắt đầu bằng câu hỏi sau. "
        "CHỈ trả về tiêu đề:\n\n" + first_message.strip()[:500]
    )


async def generate_title(adapter: ModelAdapter, first_message: str, usage_total: dict[str, int] | None = None) -> str:
    """1 call model đặt tiêu đề tiếng Việt cho hội thoại (lượt đầu). Lỗi/rỗng → '' (giữ tiêu đề mặc định)."""
    system = [SystemBlock(text=_TITLE_SYS, cache_hint=False)]
    messages = [{"role": "user", "content": _title_prompt(first_message)}]
    usage: dict[str, int] = {}
    try:
        out = await _complete(adapter, system, messages, usage)
    except Exception:  # never-raise: đặt tiêu đề hỏng không được ảnh hưởng chat
        logger.exception("generate_title lỗi")
        return ""
    if usage_total is not None:
        _merge_usage(usage_total, usage)
    line = out.strip().splitlines()[0].strip() if out.strip() else ""
    line = line.strip('"').strip("'").strip()  # bỏ ngoặc kép bao ngoài
    line = _TITLE_LABEL_RE.sub("", line).strip()  # bỏ tiền tố "Tiêu đề:"
    line = line.strip('"').strip("'").strip().rstrip(".").strip()  # bỏ ngoặc/dấu chấm còn sót
    return line[:60]


async def run_agent(
    adapter: ModelAdapter,
    gateway: GatewayProtocol,
    ctx: GatewayContext,
    system: list[SystemBlock],
    messages: list[dict[str, Any]],
    emit: Emit,
) -> None:
    working: list[dict[str, Any]] = list(messages)
    prev_answer = _last_assistant_text(messages)  # câu trả lời lượt trước — để guard chống re-briefing
    usage_total: dict[str, int] = {}
    failed_sig: set[str] = set()
    empty_retry = 0
    tools_ran = 0  # tổng tool call đã thực thi — để phát hiện câu 'dữ liệu' chưa gọi tool nào (bịa số)
    grounded_nums: set[int] = set()  # số THẬT trích từ tool_result — để đối chiếu claim GIÁ ở câu cuối

    for i in range(MAX_ITERS):
        force = i == MAX_ITERS - 1  # vòng cuối: cấm tool, ép trả lời
        tools = [] if force else TOOL_SCHEMAS
        if force:
            # LỖI 1: vòng ép PHẢI kèm nudge để M3 trả lời best-effort với dữ liệu đang có (kể cả khi
            # phần lớn tool đã fail). Thiếu nudge → M3 trả RỖNG → rơi xuống emit error.
            working.append({"role": "user", "content": _FORCE_ANSWER_NUDGE})
        pending, reasoning, final_text, truncated, status = await _drive_turn(
            adapter, system, working, tools, usage_total
        )

        if status == "error":
            await emit("error", {"message": final_text or _MAX_ITERS_ERROR})
            return

        if status == "tools" and pending and not force:
            working.append(_assistant_tool_message(pending, reasoning))
            tool_messages = await _run_tools(gateway, ctx, pending, emit, failed_sig)
            for msg in tool_messages:  # nạp số THẬT từ kết quả tool VỪA THÊM (chỉ role=="tool")
                _register_grounded(msg["content"], grounded_nums)
            working.extend(tool_messages)
            tools_ran += len(pending)
            continue

        # status "final"/"empty" (hoặc force): đây là câu trả lời ứng viên.
        answer = final_text if status == "final" else ""
        if not force and _needs_retry(answer) and empty_retry < MAX_EMPTY_RETRY:
            empty_retry += 1  # rỗng/preamble → nudge, chưa stream gì cho khách
            working.append({"role": "user", "content": _CONTINUE_NUDGE})
            continue
        # LỖI 2: câu có DẤU HIỆU DỮ LIỆU (bảng/nhiều số) mà CHƯA gọi tool nào → bịa số. Ép gọi tool
        # lấy số thật rồi trả lại (bounded bởi quota CHUNG MAX_EMPTY_RETRY → không loop vô hạn).
        if (
            not force
            and answer.strip()
            and tools_ran == 0
            and _looks_like_data_answer(answer)
            and empty_retry < MAX_EMPTY_RETRY
        ):
            empty_retry += 1
            working.append({"role": "user", "content": _GROUND_NUDGE})
            continue
        # NUMERIC-GROUNDING GUARD (số: giá/tỷ/lần): đã gọi tool nhưng câu trả lời nêu SỐ KHÔNG truy được về
        # số thật trong tool_result (dung sai tương đối 2%) → M3 phớt lờ kết quả, tự chế số (Q02). Ép đọc lại (quota CHUNG).
        if (
            not force
            and answer.strip()
            and _ungrounded_data(answer, grounded_nums)
            and empty_retry < MAX_EMPTY_RETRY
        ):
            empty_retry += 1
            working.append({"role": "user", "content": _NUM_GUARD_NUDGE})
            continue
        # NO-DATA VERIFY: model kết luận "không có dữ liệu" mà CHƯA query gì (tools_ran==0) hoặc có query ĐÃ FAIL
        # (failed_sig) → có thể bỏ sót/khai sai field. Ép kiểm tra kỹ 1 nhịp trước khi để khách nghe "không có".
        # An toàn: nudge cho phép giữ kết luận nếu thật sự không có + CẤM bịa; numeric-guard chặn nếu model chế số.
        if (
            not force
            and answer.strip()
            and _claims_no_data(answer)
            and (tools_ran == 0 or failed_sig)
            and empty_retry < MAX_EMPTY_RETRY
        ):
            empty_retry += 1
            working.append({"role": "user", "content": _VERIFY_NODATA_NUDGE})
            continue
        # Lượt force mà answer là preamble/rỗng (_needs_retry) → KHÔNG phát narration cụt; rơi xuống error sạch.
        if answer.strip() and not (force and _needs_retry(answer)):
            # GUARD chống re-briefing: câu nối tiếp trùng-số cao vs lượt trước → viết lại bỏ phần lặp (gated).
            if _should_dedup(answer, prev_answer):
                overlap, _n = _rebrief_overlap(answer, prev_answer)
                rewritten = sanitize_answer(await _dedup_rewrite(adapter, prev_answer, answer, usage_total))
                if rewritten.strip():
                    logger.info(
                        "dedup guard fired: overlap=%.2f len %d->%d request_id=%s",
                        overlap, len(answer), len(rewritten), ctx.request_id,
                    )
                    answer = rewritten
            await _emit_answer(emit, answer, usage_total, truncated)
            return
        if not force:
            working.append({"role": "user", "content": _FORCE_ANSWER_NUDGE})  # rỗng nhưng còn vòng → thúc trả lời
            continue
        logger.warning("Agent chạm MAX_ITERS request_id=%s", ctx.request_id)
        await emit("error", {"message": _MAX_ITERS_ERROR})  # force mà rỗng/preamble → error trung thực
        return

    logger.warning("Agent hết vòng không return request_id=%s", ctx.request_id)  # an toàn
    await emit("error", {"message": _MAX_ITERS_ERROR})

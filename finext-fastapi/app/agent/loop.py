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
STREAM_CHUNK = 12  # ký tự/đoạn khi nhả lại câu đã sanitize — cắt ở khoảng trắng.
STREAM_CHUNK_DELAY_S = 0.05  # nhịp giữa các đoạn (giả "nhả chữ" ~240 ký tự/giây, tự nhiên hơn); câu cuối buffer trọn nên tự tạo nhịp.

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
_MARKET_FIGURE_RE = re.compile(r"\d+[.,]\d+\s*(?:tỷ|lần)\b", re.IGNORECASE)


def _looks_like_data_answer(answer: str) -> bool:
    """Câu 'dữ liệu cần grounding': BẢNG markdown số / GIÁ 'X đồng'|hàng hoá / số thị trường thập phân 'X tỷ'|'X lần'.

    BỎ heuristic '>=6 số thập phân' (bắt nhầm câu khái niệm, regression Q04); giữ các tín hiệu CHẮC CHẮN từ-tool."""
    return bool(_TABLE_ROW_RE.search(answer) or _PRICE_CLAIM_RE.search(answer) or _MARKET_FIGURE_RE.search(answer))


# ── Numeric-grounding guard cho GIÁ (diệt bịa giá cổ phiếu Q02) ───────────────
# Bắt case M3 GỌI tool nhưng PHỚT LỜ kết quả rồi tự chế giá (tools_ran>0, grounding-retry cũ không bắt).
# CHỈ kiểm claim GIÁ (đơn vị "đồng") — KHÔNG kiểm số phái sinh (%/median/điểm) để tránh false-positive.
_NUM_IN_TEXT_RE = re.compile(r"\d[\d.,]*\d|\d")
# Con số đứng NGAY TRƯỚC đơn vị giá ("145.500 đồng" / "68.000 đ/cp" / "593 USD/tấn" / "3342 CNY/tấn").
_PRICE_VALUE_RE = re.compile(rf"(\d[\d.,]*\d|\d)\s*(?:đồng|đ/\s*cp|đ|{_COMMODITY_UNIT})\b", re.IGNORECASE)


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


def _ungrounded_price(answer: str, grounded: set[int]) -> bool:
    """True nếu có claim GIÁ 'X đồng' mà X (và X/1000, X*1000) KHÔNG truy được về grounded (đã bịa)."""
    for tok in _PRICE_VALUE_RE.findall(answer):
        v = _parse_number(tok)
        if v is None:
            continue
        cand = {int(round(v)), int(round(v / 1000)), int(round(v * 1000))}
        if not any((c in grounded or (c - 1) in grounded or (c + 1) in grounded) for c in cand):
            return True  # 1 giá không khớp tool = đủ để nghi bịa
    return False


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


def build_adapter() -> ModelAdapter:
    if not (LLM_BASE_URL and LLM_API_KEY and LLM_MODEL):
        raise RuntimeError("Thiếu cấu hình LLM_BASE_URL / LLM_API_KEY / LLM_MODEL")
    temp = float(LLM_TEMPERATURE) if LLM_TEMPERATURE else None
    if LLM_API_STYLE == "anthropic":
        return AnthropicCompatAdapter(
            base_url=LLM_BASE_URL,
            api_key=LLM_API_KEY,
            model=LLM_MODEL,
            client=_get_client(),
            temperature=temp,
            thinking=LLM_THINKING,
            reasoning_effort=LLM_REASONING_EFFORT,
        )
    return OpenAICompatAdapter(
        base_url=LLM_BASE_URL,
        api_key=LLM_API_KEY,
        model=LLM_MODEL,
        client=_get_client(),
        temperature=temp,
        thinking=LLM_THINKING,
        reasoning_effort=LLM_REASONING_EFFORT,
    )


def _merge_usage(total: dict[str, int], usage: dict[str, int]) -> None:
    """Carryover #1: cộng dồn usage qua các vòng LLM. Vòng kết thúc bằng ToolCallsEvent không mang
    usage (known-gap v1 — cần thêm field usage vào ToolCallsEvent ở task sau)."""
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


async def run_agent(
    adapter: ModelAdapter,
    gateway: GatewayProtocol,
    ctx: GatewayContext,
    system: list[SystemBlock],
    messages: list[dict[str, Any]],
    emit: Emit,
) -> None:
    working: list[dict[str, Any]] = list(messages)
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
        # NUMERIC-GROUNDING GUARD (GIÁ): đã gọi tool nhưng câu trả lời nêu GIÁ 'X đồng' KHÔNG truy được về
        # số thật trong tool_result → M3 phớt lờ kết quả, tự chế giá (Q02). Ép đọc lại số đúng (quota CHUNG).
        if (
            not force
            and answer.strip()
            and _ungrounded_price(answer, grounded_nums)
            and empty_retry < MAX_EMPTY_RETRY
        ):
            empty_retry += 1
            working.append({"role": "user", "content": _NUM_GUARD_NUDGE})
            continue
        # Lượt force mà answer là preamble/rỗng (_needs_retry) → KHÔNG phát narration cụt; rơi xuống error sạch.
        if answer.strip() and not (force and _needs_retry(answer)):
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

# Answer Correction Layer (Bậc 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm lớp hậu xử lý deterministic dọn residual K-hygiene (mã nội bộ lộ + câu kể tiến trình) trước khi trả khách, không đổi số/nội dung.

**Architecture:** 2 đường (từ Pha A: `docs/superpowers/specs/2026-07-16-answer-correction-layer-design.md` §5). (1) `sanitize_answer(text)` thuần — map denylist §9. (2) `loop.py` buffer token theo lượt: bỏ text lượt gọi-tool (diệt preamble), lượt cuối sanitize cả câu rồi nhả theo chunk (giữ "nhả chữ", lọc ở server).

**Tech Stack:** Python 3.12, FastAPI, pytest (async, đang 211 PASS). Chỉ `re` chuẩn — KHÔNG thêm dependency.

## Global Constraints
- KHÔNG thêm dependency (chỉ `re`). KHÔNG đụng adapter/gateway/schema/FE.
- `sanitize_answer` KHÔNG đổi số, KHÔNG viết lại câu, KHÔNG xóa nội dung thật. An toàn > triệt để.
- GIỮ NGUYÊN: 4 nhãn pha `UPTREND/DOWNTREND/SIDEWAY/TRANSITION`, URL, ticker hoa, mọi con số.
- Denylist đồng bộ §15 system_prompt (comment rõ nguồn).
- Type hint đủ; hàm ≤40 dòng thì tách; catch exception cụ thể; không `print`.
- Diff tối thiểu, surgical. Verify mỗi task = `uv run pytest <file> -q` (chạy trong `finext-fastapi/`).

---

### Task 1: Module `sanitize_answer` + unit test

**Files:**
- Create: `finext-fastapi/app/agent/sanitize.py`
- Test: `finext-fastapi/tests/agent/test_sanitize.py`

**Interfaces:**
- Produces: `sanitize_answer(text: str) -> str` — thuần, idempotent-friendly, dùng ở Task 2.

- [ ] **Step 1: Viết test thất bại** — `finext-fastapi/tests/agent/test_sanitize.py`

```python
from app.agent.sanitize import sanitize_answer


# --- VSI: giữ số, đổi nhãn thành đơn vị tự nhiên ---
def test_vsi_with_number_keeps_number():
    assert "0,92× TB 5 phiên" in sanitize_answer("thanh khoản (VSI 0,92) thấp")
    assert "VSI" not in sanitize_answer("thanh khoản (VSI 0,92) thấp")


def test_vsi_with_equals_drops_label_keeps_number():
    out = sanitize_answer("dưới trung bình 5 phiên (VSI = 0,92).")
    assert "0,92× TB 5 phiên" in out and "VSI" not in out


def test_vsi_with_operator_keeps_operator():
    out = sanitize_answer("Thanh khoản đột biến (VSI ≥ 2)")
    assert "≥2× TB 5 phiên" in out and "VSI" not in out


def test_bare_vsi_table_header_replaced():
    out = sanitize_answer("| Mã | Giá | VSI | Điểm |")
    assert "VSI" not in out and "thanh khoản" in out.lower()


# --- exposure ---
def test_exposure_replaced():
    out = sanitize_answer("pha TRANSITION với exposure 0.7, hạ exposure về 0")
    assert "exposure" not in out
    assert out.count("tỷ lệ nắm giữ") == 2
    assert "0.7" in out and "TRANSITION" in out  # số + nhãn pha giữ nguyên


# --- token điểm/độ rộng: cả backtick lẫn trần ---
def test_score_tokens_mapped_backtick_and_bare():
    assert "điểm dòng tiền tuần" in sanitize_answer("Dòng tiền: `week_score` -14.7")
    assert "week_score" not in sanitize_answer("Dòng tiền: `week_score` -14.7")
    assert "điểm dòng tiền ngày" in sanitize_answer("nếu 2-3 phiên tới day_score tiếp tục âm")
    assert "độ rộng xu hướng tuần" in sanitize_answer("khi w_trend vượt 0,30")


def test_score_token_keeps_number():
    assert "-14.7" in sanitize_answer("Dòng tiền: `week_score` -14.7")


# --- tên collection/field nội bộ: xóa ---
def test_internal_collection_names_removed():
    out = sanitize_answer("Dữ liệu `stock_finstats` và `industry_finstats` cho thấy")
    assert "stock_finstats" not in out and "industry_finstats" not in out
    assert "`" not in out


def test_internal_name_in_prose_removed():
    out = sanitize_answer("Từ doc core đã có, thị trường yếu")
    assert "core" not in out.split()  # 'core' như một từ bị gỡ


# --- backtick ticker được GIỮ nội dung (gỡ backtick) ---
def test_valid_ticker_backtick_unwrapped():
    out = sanitize_answer("Mã `FPT` đang mạnh")
    assert "FPT" in out and "`" not in out


# --- grade zone (A)/(B)/(C) dính sau từ: xóa parenthetical ---
def test_zone_grade_paren_after_word_removed():
    out = sanitize_answer("vùng kỹ thuật ở mức yếu (C) và năm tích cực (A)")
    assert "(C)" not in out and "(A)" not in out
    assert "yếu" in out and "tích cực" in out


def test_zone_grade_list_marker_not_touched():
    # "(A)" đầu dòng như đánh dấu danh sách KHÔNG bị xóa (không có \w ngay trước)
    out = sanitize_answer("Phương án:\n(A) mua dần\n(B) chờ thêm")
    assert "(A) mua dần" in out


# --- Negative: input sạch giữ nguyên; số/URL/nhãn pha không hỏng ---
def test_clean_input_unchanged():
    clean = "VNINDEX đang ở 1.776,89 điểm, giảm 0,29%. Thị trường ở pha TRANSITION, xem https://finext.vn/guide."
    assert sanitize_answer(clean) == clean


def test_empty_string():
    assert sanitize_answer("") == ""


def test_no_double_spaces_left_after_removal():
    out = sanitize_answer("Dữ liệu `stock_finstats` cho thấy yếu")
    assert "  " not in out
```

- [ ] **Step 2: Chạy test — xác nhận FAIL**

Run: `cd finext-fastapi && uv run pytest tests/agent/test_sanitize.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.agent.sanitize'`

- [ ] **Step 3: Viết `finext-fastapi/app/agent/sanitize.py`**

```python
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
```

- [ ] **Step 4: Chạy test — xác nhận PASS**

Run: `cd finext-fastapi && uv run pytest tests/agent/test_sanitize.py -q`
Expected: PASS (tất cả). Nếu 1 case fail, sửa regex cho ĐÚNG case đó, KHÔNG nới test.

- [ ] **Step 5: Commit**

```bash
git add finext-fastapi/app/agent/sanitize.py finext-fastapi/tests/agent/test_sanitize.py
git commit -m "feat(chat): sanitize_answer deterministic K-hygiene post-filter (Bậc 2)"
```

---

### Task 2: Tích hợp `loop.py` — bỏ text lượt interim + sanitize lượt cuối + nhả chunk

**Files:**
- Modify: `finext-fastapi/app/agent/loop.py` (chỉ `_drive_turn` + thêm helper `_stream_chunks`, import)
- Modify: `finext-fastapi/tests/agent/test_loop.py` (cập nhật kỳ vọng token + thêm 2 test mới)

**Interfaces:**
- Consumes: `sanitize_answer` (Task 1).
- Hành vi mới: text ở lượt kết-bằng-`ToolCallsEvent` (interim) KHÔNG được emit; lượt kết-bằng-`DoneEvent` (final) được `sanitize_answer` rồi nhả theo chunk `token`.

- [ ] **Step 1: Cập nhật test hiện có + thêm test mới** — `finext-fastapi/tests/agent/test_loop.py`

Sửa `test_plain_answer_emits_tokens_and_done` (giờ buffer→sanitize→nhả chunk, câu ngắn = 1 token):
```python
async def test_plain_answer_emits_tokens_and_done():
    adapter = ScriptedAdapter([[TokenEvent(text="Chào "), TokenEvent(text="bạn"), DoneEvent(usage={"in": 10, "out": 2})]])
    emitted = await _collect(adapter)
    assert [e[0] for e in emitted] == ["token", "done"]
    assert "".join(e[1]["text"] for e in emitted if e[0] == "token") == "Chào bạn"
    assert emitted[-1][1]["usage"] == {"in": 10, "out": 2}
```

Thêm 2 test mới (cuối file):
```python
async def test_interim_turn_text_is_discarded():
    """Text model sinh ra Ở LƯỢT GỌI-TOOL (preamble) phải bị bỏ, không stream ra client."""
    tool_call = ToolCall(
        id="c1", name="db_find",
        arguments={"collection": "stock_snapshot", "filter": {"ticker": "FPT"}, "projection": {"price": 1}},
    )
    adapter = ScriptedAdapter(
        [
            [TokenEvent(text="Tôi sẽ tra cứu giá FPT."), ToolCallsEvent(calls=[tool_call])],
            [TokenEvent(text="Giá FPT là 118,5"), DoneEvent(usage={"in": 5, "out": 3})],
        ]
    )
    emitted = await _collect(adapter)
    answer = "".join(e[1]["text"] for e in emitted if e[0] == "token")
    assert "Tôi sẽ tra cứu" not in answer
    assert "Giá FPT là 118,5" in answer


async def test_final_answer_is_sanitized():
    """Câu trả lời cuối phải qua sanitize_answer (mã nội bộ bị dọn)."""
    adapter = ScriptedAdapter(
        [[TokenEvent(text="Thanh khoản (VSI 0,92) thấp, dữ liệu `stock_finstats`."),
          DoneEvent(usage={})]]
    )
    emitted = await _collect(adapter)
    answer = "".join(e[1]["text"] for e in emitted if e[0] == "token")
    assert "VSI" not in answer and "stock_finstats" not in answer and "`" not in answer
    assert "0,92× TB 5 phiên" in answer
```

- [ ] **Step 2: Chạy — xác nhận test mới FAIL**

Run: `cd finext-fastapi && uv run pytest tests/agent/test_loop.py -q`
Expected: FAIL ở `test_interim_turn_text_is_discarded` (hiện text interim vẫn stream) + `test_final_answer_is_sanitized` (chưa sanitize) + `test_plain_answer...` (đang 3 event).

- [ ] **Step 3: Sửa `finext-fastapi/app/agent/loop.py`**

Thêm import (cạnh các import `app.agent.*`):
```python
from app.agent.sanitize import sanitize_answer
```

Thêm hằng + helper (dưới `MAX_TOTAL_TOOL_CHARS`):
```python
STREAM_CHUNK = 48  # ký tự/đoạn khi nhả lại câu đã sanitize — giữ hiệu ứng "nhả chữ", cắt ở khoảng trắng.


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
```

Thay TOÀN BỘ thân `_drive_turn` (buffer token, chỉ nhả ở DoneEvent):
```python
async def _drive_turn(
    adapter: ModelAdapter,
    system: list[SystemBlock],
    working: list[dict[str, Any]],
    emit: Emit,
    usage_total: dict[str, int],
) -> tuple[list[ToolCall], str | None, bool]:
    """Chạy 1 lượt stream. Buffer text: lượt gọi-tool (interim) BỎ text; lượt cuối sanitize rồi nhả chunk."""
    pending: list[ToolCall] = []
    pending_reasoning: str | None = None
    buffer: list[str] = []
    async for event in adapter.stream_chat(
        system=system, messages=working, tools=TOOL_SCHEMAS, max_tokens=MAX_OUTPUT_TOKENS
    ):
        if isinstance(event, TokenEvent):
            buffer.append(event.text)  # KHÔNG emit ngay — chờ biết interim hay final
        elif isinstance(event, ToolCallsEvent):
            pending = event.calls
            pending_reasoning = event.reasoning_content
        elif isinstance(event, DoneEvent):
            _merge_usage(usage_total, event.usage)
            for chunk in _stream_chunks(sanitize_answer("".join(buffer))):
                await emit("token", {"text": chunk})
            await emit("done", {"usage": usage_total, "truncated": event.truncated})
            return pending, pending_reasoning, True
        elif isinstance(event, ErrorEvent):
            await emit("error", {"message": event.message})
            return pending, pending_reasoning, True
    return pending, pending_reasoning, False  # interim: buffer bị bỏ (preamble không lộ)
```

- [ ] **Step 4: Chạy test loop — xác nhận PASS**

Run: `cd finext-fastapi && uv run pytest tests/agent/test_loop.py -q`
Expected: PASS toàn bộ (gồm 2 test mới + `test_plain_answer` đã sửa).

- [ ] **Step 5: Chạy test SSE contract + toàn bộ agent — không vỡ**

Run: `cd finext-fastapi && uv run pytest tests/agent -q`
Expected: PASS. Nếu `test_sse_contract.py` fail vì đổi token, đọc kỹ: contract 6 event GIỮ NGUYÊN (vẫn `token`/`done`), chỉ số lượng token đổi — sửa kỳ vọng số token nếu test đếm cứng, KHÔNG đổi tên/loại event.

- [ ] **Step 6: Commit**

```bash
git add finext-fastapi/app/agent/loop.py finext-fastapi/tests/agent/test_loop.py
git commit -m "feat(chat): loop bỏ text lượt gọi-tool + sanitize câu cuối, nhả theo chunk (Bậc 2)"
```

---

## Self-Review
- **Spec coverage:** §5.1 (loop bỏ interim) → Task 2. §5.2 (buffer+chunk) → Task 2 `_stream_chunks`. §5.3 (7 rule map) → Task 1 `sanitize_answer`. §5.5 (unit + loop test) → Task 1/2 test.
- **Type consistency:** `sanitize_answer(text:str)->str` khớp giữa Task 1 định nghĩa và Task 2 import. `_drive_turn` giữ nguyên chữ ký trả `(list[ToolCall], str|None, bool)`.
- **No placeholder:** mọi step có code/命令 đầy đủ.
- **Ngoài scope:** không đụng adapter/gateway/schema/FE/chat.py.

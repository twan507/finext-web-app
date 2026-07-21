# DeepSeek V4 Thinking Mode + Anti-Truncation — Implementation Plan (Phần 2)

> **HISTORICAL — COMPLETED, FEATURE DEFAULT OFF:** Support thinking/reasoning pass-back đã được triển khai; LLM_THINKING mặc định disabled theo kết quả A/B.

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** Bật thinking mode DeepSeek V4 tường minh + pass-back `reasoning_content` đúng luật (lượt-có-tool, tránh 400) + chống cắt output giữa chừng, rồi đo A/B K-hygiene non-thinking vs thinking.

**Architecture:** Env điều khiển thinking (`LLM_THINKING`/`LLM_REASONING_EFFORT`); adapter gửi param `thinking` tường minh + gom `delta.reasoning_content`; `ToolCallsEvent` mang reasoning về loop để `_assistant_tool_message` gửi lại; `DoneEvent.truncated` bắt `finish_reason=="length"`. Không đụng gateway/policy/router.

**Tech Stack:** Python 3.13 · httpx · pytest · uv. cwd `finext-fastapi`, chạy `PYTHONIOENCODING=utf-8 PYTHONUTF8=1 uv run pytest`.

**Nguồn:** [spec](../specs/2026-07-15-deepseek-v4-thinking-mode-design.md) · [[reference_deepseek_v4_api]].

## Global Constraints

- KHÔNG thêm dependency. Type hints mọi signature. Không `except:` trần. Không `print()`. Hàm ≤40 dòng.
- Secrets chỉ ở `.env*` (owner điền). KHÔNG `NEXT_PUBLIC_` cho key. KHÔNG commit `.env*`.
- Baseline: **192 test PASS** branch `feat/agent-v1-slice`. Mỗi task giữ full suite xanh.
- Diff tối thiểu, không refactor ngoài phạm vi. SSE giữ **6 loại event** (chỉ thêm field payload).
- Reasoning pass-back CHỈ cho lượt-có-tool; lượt trả lời cuối KHÔNG giữ reasoning (docs V4).
- Thinking mode bỏ qua `temperature` (docs) → vẫn gửi temperature, không rẽ nhánh.
- Commit kết bằng trailer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: Config env + adapter gửi param `thinking`

**Files:**
- Modify: `finext-fastapi/app/core/config.py` (thêm `LLM_THINKING`, `LLM_REASONING_EFFORT`)
- Modify: `finext-fastapi/app/agent/adapters/openai_compat.py` (`__init__` + `_payload`)
- Modify: `finext-fastapi/app/agent/loop.py` (`build_adapter` truyền 2 param)
- Test: `finext-fastapi/tests/agent/adapters/test_openai_compat.py`

**Interfaces:**
- Produces: `OpenAICompatAdapter(base_url, api_key, model, client=None, temperature=None, thinking=None, reasoning_effort=None)`.
  `_payload` thêm `"thinking": {"type": thinking}` khi `thinking is not None`; thêm `"reasoning_effort"` khi `thinking == "enabled"` và `reasoning_effort is not None`.

- [ ] **Step 1: Viết failing test.** Thêm vào cuối `tests/agent/adapters/test_openai_compat.py`:
```python
def test_payload_thinking_enabled_includes_effort():
    from app.agent.adapters.base import SystemBlock
    adapter = OpenAICompatAdapter(
        base_url="https://api.test/v1", api_key="k", model="deepseek-v4-flash",
        thinking="enabled", reasoning_effort="high",
    )
    payload = adapter._payload([SystemBlock(text="s")], [{"role": "user", "content": "hi"}], [], 100)
    assert payload["thinking"] == {"type": "enabled"}
    assert payload["reasoning_effort"] == "high"


def test_payload_thinking_disabled_omits_effort():
    from app.agent.adapters.base import SystemBlock
    adapter = OpenAICompatAdapter(
        base_url="https://api.test/v1", api_key="k", model="m",
        thinking="disabled", reasoning_effort="high",
    )
    payload = adapter._payload([SystemBlock(text="s")], [{"role": "user", "content": "hi"}], [], 100)
    assert payload["thinking"] == {"type": "disabled"}
    assert "reasoning_effort" not in payload


def test_payload_omits_thinking_when_none():
    from app.agent.adapters.base import SystemBlock
    adapter = OpenAICompatAdapter(base_url="https://api.test/v1", api_key="k", model="m", thinking=None)
    payload = adapter._payload([SystemBlock(text="s")], [{"role": "user", "content": "hi"}], [], 100)
    assert "thinking" not in payload
```

- [ ] **Step 2: Chạy test — FAIL.** `cd finext-fastapi && PYTHONIOENCODING=utf-8 PYTHONUTF8=1 uv run pytest tests/agent/adapters/test_openai_compat.py::test_payload_thinking_enabled_includes_effort -v` → FAIL (`TypeError: unexpected kwarg thinking`).

- [ ] **Step 3: Sửa `openai_compat.py` `__init__`.** Thêm 2 param sau `temperature` và lưu:
```python
    def __init__(
        self,
        base_url: str,
        api_key: str,
        model: str,
        client: httpx.AsyncClient | None = None,
        temperature: float | None = None,
        thinking: str | None = None,
        reasoning_effort: str | None = None,
    ) -> None:
        self._url = f"{base_url.rstrip('/')}/chat/completions"
        self._api_key = api_key
        self._model = model
        self._client = client or httpx.AsyncClient(timeout=REQUEST_TIMEOUT)
        self._temperature = temperature
        self._thinking = thinking
        self._reasoning_effort = reasoning_effort
```

- [ ] **Step 4: Sửa `_payload`.** Ngay trước `return payload`, sau block temperature, thêm:
```python
        if self._thinking is not None:
            payload["thinking"] = {"type": self._thinking}
            if self._thinking == "enabled" and self._reasoning_effort is not None:
                payload["reasoning_effort"] = self._reasoning_effort
```

- [ ] **Step 5: Thêm env vào `config.py`.** Ngay dưới dòng `LLM_MAX_OUTPUT_TOKENS`:
```python
LLM_THINKING = os.getenv("LLM_THINKING", "enabled")  # enabled | disabled — luôn gửi tường minh
LLM_REASONING_EFFORT = os.getenv("LLM_REASONING_EFFORT", "high")  # high | max — chỉ gửi khi thinking enabled
```
> ⚠ Default `enabled` bật thinking ngay sau task này, nhưng pass-back `reasoning_content` (Task 3) chưa có → **KHÔNG chạy agent live (multi-round tool) giữa Task 1–3**, sẽ 400. Live run chỉ ở Task 4 (sau Task 3). Unit test không đụng API thật nên an toàn.

- [ ] **Step 6: Sửa `loop.py` `build_adapter`.** Cập nhật import + call:
```python
from app.core.config import (
    LLM_API_KEY,
    LLM_BASE_URL,
    LLM_MAX_OUTPUT_TOKENS,
    LLM_MODEL,
    LLM_REASONING_EFFORT,
    LLM_TEMPERATURE,
    LLM_THINKING,
)
```
```python
def build_adapter() -> ModelAdapter:
    if not (LLM_BASE_URL and LLM_API_KEY and LLM_MODEL):
        raise RuntimeError("Thiếu cấu hình LLM_BASE_URL / LLM_API_KEY / LLM_MODEL")
    temp = float(LLM_TEMPERATURE) if LLM_TEMPERATURE else None
    return OpenAICompatAdapter(
        base_url=LLM_BASE_URL,
        api_key=LLM_API_KEY,
        model=LLM_MODEL,
        client=_get_client(),
        temperature=temp,
        thinking=LLM_THINKING,
        reasoning_effort=LLM_REASONING_EFFORT,
    )
```

- [ ] **Step 7: Chạy test — PASS + full suite.** `cd finext-fastapi && PYTHONIOENCODING=utf-8 PYTHONUTF8=1 uv run pytest -q` → 195 passed.

- [ ] **Step 8: Commit.**
```bash
git add finext-fastapi/app/core/config.py finext-fastapi/app/agent/adapters/openai_compat.py finext-fastapi/app/agent/loop.py finext-fastapi/tests/agent/adapters/test_openai_compat.py
git commit -m "$(cat <<'MSG'
feat(agent): adapter gửi param thinking tường minh (env LLM_THINKING/LLM_REASONING_EFFORT)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
MSG
)"
```

---

### Task 2: Adapter gom `reasoning_content` + đánh dấu `truncated`

**Files:**
- Modify: `finext-fastapi/app/agent/events.py` (`ToolCallsEvent.reasoning_content`, `DoneEvent.truncated`)
- Modify: `finext-fastapi/app/agent/adapters/openai_compat.py` (`_TurnState`, `_read_stream`, `stream_chat`)
- Test: `finext-fastapi/tests/agent/adapters/test_openai_compat.py`

**Interfaces:**
- Consumes: `OpenAICompatAdapter` (Task 1).
- Produces: `ToolCallsEvent(calls, reasoning_content: str | None = None)`; `DoneEvent(usage, truncated: bool = False)`.
  `stream_chat` gắn `reasoning_content=state.reasoning or None` lên `ToolCallsEvent`; `DoneEvent(truncated = finish_reason == "length")`.

- [ ] **Step 1: Viết failing test.** Thêm vào `tests/agent/adapters/test_openai_compat.py` (đặt cạnh các fixture stream):
```python
REASONING_TOOL_STREAM = (
    'data: {"choices":[{"delta":{"reasoning_content":"Cần tra "},"index":0}]}\n\n'
    'data: {"choices":[{"delta":{"reasoning_content":"giá FPT."},"index":0}]}\n\n'
    'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","type":"function",'
    '"function":{"name":"db_find","arguments":"{}"}}]},"index":0}]}\n\n'
    'data: {"choices":[{"delta":{},"finish_reason":"tool_calls","index":0}]}\n\n'
    "data: [DONE]\n\n"
)

LENGTH_STREAM = (
    'data: {"choices":[{"delta":{"content":"Phân tích rất dài"},"index":0}]}\n\n'
    'data: {"choices":[{"delta":{},"finish_reason":"length","index":0}]}\n\n'
    "data: [DONE]\n\n"
)


async def test_reasoning_content_accumulated_on_tool_calls_event():
    events = await _collect(_adapter_with(REASONING_TOOL_STREAM))
    tool_events = [e for e in events if isinstance(e, ToolCallsEvent)]
    assert len(tool_events) == 1
    assert tool_events[0].reasoning_content == "Cần tra giá FPT."


async def test_tool_calls_event_reasoning_none_when_absent():
    events = await _collect(_adapter_with(TOOL_STREAM))
    tool_events = [e for e in events if isinstance(e, ToolCallsEvent)]
    assert tool_events[0].reasoning_content is None


async def test_finish_reason_length_marks_done_truncated():
    events = await _collect(_adapter_with(LENGTH_STREAM))
    done = events[-1]
    assert isinstance(done, DoneEvent)
    assert done.truncated is True
```

- [ ] **Step 2: Chạy test — FAIL.** `cd finext-fastapi && PYTHONIOENCODING=utf-8 PYTHONUTF8=1 uv run pytest tests/agent/adapters/test_openai_compat.py::test_reasoning_content_accumulated_on_tool_calls_event -v` → FAIL (`TypeError: unexpected kwarg reasoning_content` hoặc AttributeError).

- [ ] **Step 3: Sửa `events.py`.** Thêm field default:
```python
@dataclass
class ToolCallsEvent:
    calls: list[ToolCall]
    reasoning_content: str | None = None


@dataclass
class DoneEvent:
    usage: dict[str, int] = field(default_factory=dict)  # {"in": N, "out": M}
    truncated: bool = False
```

- [ ] **Step 4: Sửa `_TurnState` trong `openai_compat.py`.** Thêm field:
```python
@dataclass
class _TurnState:
    """State tích luỹ trong 1 lượt stream — reset mỗi attempt để retry không dính mảnh cũ."""

    buffer: _ToolCallBuffer = field(default_factory=_ToolCallBuffer)
    usage: dict[str, int] = field(default_factory=dict)
    finish_reason: str | None = None
    reasoning: str = ""
```

- [ ] **Step 5: Sửa `_read_stream`.** Trong vòng `for choice`, sau block `if delta.get("content"):`, thêm:
```python
                if delta.get("reasoning_content"):
                    state.reasoning += delta["reasoning_content"]
```

- [ ] **Step 6: Sửa block cuối `stream_chat`.** Thay 4 dòng cuối:
```python
        if state.finish_reason == "tool_calls":
            yield ToolCallsEvent(calls=state.buffer.flush(), reasoning_content=state.reasoning or None)
            return
        yield DoneEvent(usage=state.usage, truncated=state.finish_reason == "length")
```

- [ ] **Step 7: Chạy test — PASS + full suite.** `cd finext-fastapi && PYTHONIOENCODING=utf-8 PYTHONUTF8=1 uv run pytest -q` → 198 passed.

- [ ] **Step 8: Commit.**
```bash
git add finext-fastapi/app/agent/events.py finext-fastapi/app/agent/adapters/openai_compat.py finext-fastapi/tests/agent/adapters/test_openai_compat.py
git commit -m "$(cat <<'MSG'
feat(agent): adapter gom reasoning_content lên ToolCallsEvent + DoneEvent.truncated cho finish_reason=length

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
MSG
)"
```

---

### Task 3: Loop pass-back reasoning + truncated payload + chỉ dẫn anti-truncation

**Files:**
- Modify: `finext-fastapi/app/agent/loop.py` (`_assistant_tool_message`, `_drive_turn`, `run_agent`)
- Modify: `finext-fastapi/app/agent/kb/system_prompt.md` (1 bullet §2)
- Test: `finext-fastapi/tests/agent/test_loop.py`

**Interfaces:**
- Consumes: `ToolCallsEvent.reasoning_content`, `DoneEvent.truncated` (Task 2).
- Produces: `_assistant_tool_message(calls, reasoning_content: str | None = None)` — thêm key `"reasoning_content"` CHỈ khi không None. Payload event `done` có key `"truncated": bool`.

- [ ] **Step 1: Viết failing test.** Thêm vào `tests/agent/test_loop.py`:
```python
def test_assistant_tool_message_includes_reasoning_when_present():
    from app.agent.loop import _assistant_tool_message
    call = ToolCall(id="c1", name="db_find", arguments={"collection": "stock_snapshot"})
    msg = _assistant_tool_message([call], reasoning_content="suy nghĩ nội bộ")
    assert msg["reasoning_content"] == "suy nghĩ nội bộ"


def test_assistant_tool_message_omits_reasoning_when_none():
    from app.agent.loop import _assistant_tool_message
    call = ToolCall(id="c1", name="db_find", arguments={"collection": "stock_snapshot"})
    msg = _assistant_tool_message([call])
    assert "reasoning_content" not in msg


async def test_reasoning_content_passed_back_in_tool_round_trip():
    tool_call = ToolCall(
        id="c1", name="db_find",
        arguments={"collection": "stock_snapshot", "filter": {"ticker": "FPT"}, "projection": {"price": 1}},
    )
    adapter = ScriptedAdapter(
        [
            [ToolCallsEvent(calls=[tool_call], reasoning_content="Cần tra giá FPT")],
            [TokenEvent(text="Giá FPT là 118,5"), DoneEvent(usage={"in": 50, "out": 6})],
        ]
    )
    await _collect(adapter)
    assistant_message = adapter.calls[1][-2]
    assert assistant_message["role"] == "assistant"
    assert assistant_message["reasoning_content"] == "Cần tra giá FPT"


async def test_truncated_flag_flows_to_done_payload():
    adapter = ScriptedAdapter([[TokenEvent(text="dài"), DoneEvent(usage={"in": 1, "out": 1}, truncated=True)]])
    emitted = await _collect(adapter)
    assert emitted[-1][0] == "done"
    assert emitted[-1][1]["truncated"] is True
```

- [ ] **Step 2: Chạy test — FAIL.** `cd finext-fastapi && PYTHONIOENCODING=utf-8 PYTHONUTF8=1 uv run pytest tests/agent/test_loop.py::test_reasoning_content_passed_back_in_tool_round_trip -v` → FAIL (`reasoning_content` không có trong assistant message).

- [ ] **Step 3: Sửa `_assistant_tool_message`.** Thay hàm:
```python
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
```

- [ ] **Step 4: Sửa `_drive_turn`.** Đổi signature trả về + bắt reasoning + truncated:
```python
async def _drive_turn(
    adapter: ModelAdapter,
    system: list[SystemBlock],
    working: list[dict[str, Any]],
    emit: Emit,
    usage_total: dict[str, int],
) -> tuple[list[ToolCall], str | None, bool]:
    """Chạy 1 lượt stream. Trả (tool call chờ, reasoning của lượt đó, stop)."""
    pending: list[ToolCall] = []
    pending_reasoning: str | None = None
    async for event in adapter.stream_chat(
        system=system, messages=working, tools=TOOL_SCHEMAS, max_tokens=MAX_OUTPUT_TOKENS
    ):
        if isinstance(event, TokenEvent):
            await emit("token", {"text": event.text})
        elif isinstance(event, ToolCallsEvent):
            pending = event.calls
            pending_reasoning = event.reasoning_content
        elif isinstance(event, DoneEvent):
            _merge_usage(usage_total, event.usage)
            await emit("done", {"usage": usage_total, "truncated": event.truncated})
            return pending, pending_reasoning, True
        elif isinstance(event, ErrorEvent):
            await emit("error", {"message": event.message})
            return pending, pending_reasoning, True
    return pending, pending_reasoning, False
```

- [ ] **Step 5: Sửa `run_agent`.** Cập nhật vòng lặp dùng tuple 3 phần + truyền reasoning + `truncated: False` ở nhánh no-pending:
```python
    for _ in range(MAX_ITERS):
        pending, pending_reasoning, stop = await _drive_turn(adapter, system, working, emit, usage_total)
        if stop:
            return
        if not pending:
            await emit("done", {"usage": usage_total, "truncated": False})
            return
        working.append(_assistant_tool_message(pending, pending_reasoning))
        working.extend(await _run_tools(gateway, ctx, pending, emit))
```

- [ ] **Step 6: Thêm chỉ dẫn anti-truncation vào `system_prompt.md`.** Trong §2 Tone & style, thêm bullet ngay SAU dòng `- Xưng hô trung tính "anh/chị"; quotation marks chỉ cho trích dẫn cụ thể` (cuối §2):
```markdown
- Hoạch định độ dài trước khi viết: trả lời **đủ ý nhưng gọn**, cấu trúc rõ; chủ đề dài thì ưu tiên phần cốt lõi và kết luận trọn vẹn thay vì liệt kê dàn trải rồi đứt giữa chừng — luôn kết câu gọn gàng, không bỏ lửng.
```

- [ ] **Step 7: Chạy test — PASS + full suite.** `cd finext-fastapi && PYTHONIOENCODING=utf-8 PYTHONUTF8=1 uv run pytest -q` → 202 passed. Xác nhận test cũ `test_tool_call_round_trip_feeds_result_back_to_model` VẪN PASS (ScriptedAdapter cũ tạo `ToolCallsEvent` không reasoning → assistant message KHÔNG có key reasoning_content, đúng shape cũ).

- [ ] **Step 8: Commit.**
```bash
git add finext-fastapi/app/agent/loop.py finext-fastapi/app/agent/kb/system_prompt.md finext-fastapi/tests/agent/test_loop.py
git commit -m "$(cat <<'MSG'
feat(agent): loop pass-back reasoning_content (lượt-có-tool) + truncated vào done + chỉ dẫn anti-truncation

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
MSG
)"
```

---

### Task 4: Đo A/B DeepSeek thật (owner-run) + ghi kết quả

**Files:**
- Modify: `C:/Users/tuanb/AppData/Local/Temp/claude/d--twan-projects-finext-web-app/5b018c3b-ae08-4ddd-9e61-8570bee03609/scratchpad/verify_pack.py` (in thêm độ dài reasoning nếu bắt được — không bắt buộc)
- Không unit test tự động (cần DeepSeek thật).

- [ ] **Step 1: Chạy baseline non-thinking.** Owner đặt tạm `LLM_THINKING=disabled` trong `.env.development`, chạy:
  `cd finext-fastapi && PYTHONIOENCODING=utf-8 PYTHONUTF8=1 uv run python <scratchpad>/verify_pack.py`. Ghi lại 3 câu output (giá FPT · pha · HPG).

- [ ] **Step 2: Chạy thinking.** Owner đặt `LLM_THINKING=enabled` (+ effort mặc định high), chạy lại 3 câu.

- [ ] **Step 3: So sánh + GHI ledger.** Trong `.superpowers/sdd/progress.md`, ghi cho MỖI điều kiện: còn lộ `VSI`/`zone C`/`TRANSITION`/`exposure` thô? còn lộ ngưỡng `+0.30`/`−0.30`/`−10%`/`0.90`? Xác nhận tool-calling + thinking chạy nhiều vòng KHÔNG bị 400 (chứng minh pass-back reasoning_content đúng).

- [ ] **Step 4: Quyết thang leo.**
  - Thinking đã sạch hygiene → XONG Phần 2, đánh dấu spec §5 "không cần".
  - Còn lộ → kích Bậc 1 spec §5 (output contract cuối system_prompt) = task/plan follow-up.
  - Đặt lại `.env.development` về `LLM_THINKING=enabled` (production intent).

---

## Nghiệm thu
- [ ] `thinking` gửi tường minh (enabled/disabled) — test payload PASS.
- [ ] `reasoning_content` gom đúng + pass-back CHỈ lượt-có-tool; tool-calling nhiều vòng với thinking KHÔNG 400 (verify thật).
- [ ] `finish_reason=="length"` → `truncated` tới payload `done`; chỉ dẫn anti-truncation trong system_prompt.
- [ ] Full suite 202 PASS.
- [ ] A/B K-hygiene ghi ledger → quyết thang leo rõ ràng.

**Sau plan này:** nếu đo còn lộ → plan follow-up Bậc 1 (output contract). CoT display + model selector (roadmap §3) = brainstorm riêng sau.

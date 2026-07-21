# Anthropic-compat Adapter — Design

> **HISTORICAL — IMPLEMENTED:** AnthropicCompatAdapter đã có trong runtime và được chọn bằng LLM_API_STYLE. Provider/model production vẫn là cấu hình env; tài liệu này không khẳng định adapter đang active.

> **Trạng thái:** PLANNED — owner chốt build (2026-07-16) sau khi A/B thấy M3 mạnh; M3 "happiest on Anthropic SDK".
> **Vì sao:** (1) chạy M3 ở mode tối ưu/khuyến nghị (Anthropic); (2) portability — 1 adapter chạy được M3 + DeepSeek-Claude-mode + Claude thật; (3) nền cho các tool tính toán/phân tích sau. Bậc-2 hygiene fix nhỏ (industry_rank/y_trend + preamble) **hoãn**: làm xong adapter → re-survey → fix tổng thể 1 lượt.

## 1. Nguyên tắc
- **Chỉ thêm 1 adapter mới + 1 công tắc config.** KHÔNG đổi `loop.py`/`run_agent`/gateway/schema/router/FE. Loop giữ nguyên định dạng message "OpenAI-ish" nội bộ; **adapter tự convert sang wire Anthropic**. `OpenAICompatAdapter` giữ nguyên (DeepSeek vẫn chạy).
- **Cùng interface `ModelAdapter`** → cắm vào là chạy, mọi test loop hiện có (ScriptedAdapter) vẫn đúng.
- Contract event nội bộ giữ nguyên: adapter phát `TokenEvent/ToolCallsEvent/DoneEvent/ErrorEvent`.

## 2. Kiến trúc & công tắc
- File mới: `finext-fastapi/app/agent/adapters/anthropic_compat.py` → `AnthropicCompatAdapter` (mirror `OpenAICompatAdapter`).
- Config: thêm `LLM_API_STYLE = os.getenv("LLM_API_STYLE") or "openai"` (`openai` | `anthropic`).
- `loop.py::build_adapter()`: nếu `LLM_API_STYLE == "anthropic"` → dựng `AnthropicCompatAdapter`, else `OpenAICompatAdapter`. (Chỉ thêm nhánh if, KHÔNG đổi phần khác.)
- Endpoint: `url = base_url.rstrip('/') + "/v1/messages"`. MiniMax: `LLM_BASE_URL=https://api.minimax.io/anthropic` → `…/anthropic/v1/messages`. Claude thật: `https://api.anthropic.com` → `…/v1/messages`.

## 3. Chuyển đổi format (CỐT LÕI) — OpenAI-ish (nội bộ) → Anthropic wire

### 3.1 System + prompt caching
`list[SystemBlock]` → tham số top-level `system` = list content block:
```python
system = [{"type": "text", "text": b.text} for b in blocks]
# cache breakpoint: đánh cache_control lên block CÓ cache_hint CUỐI CÙNG (Anthropic cache tới đó)
# thứ tự build_system_blocks: resident(cache=T), briefing(cache=T), session_note(cache=F)
# → cache_control lên briefing (block cache=T cuối) → cache resident+briefing; session_note sau đó = động
```
Cụ thể: tìm index lớn nhất có `cache_hint=True`, gắn `"cache_control": {"type": "ephemeral"}` vào block đó.

### 3.2 Messages (KHÓ NHẤT: gom tool_result vào 1 user turn)
Loop tạo message OpenAI-ish; convert từng cái, và **GOM các message `role:"tool"` liên tiếp thành 1 message Anthropic `role:"user"`**:
| OpenAI-ish (nội bộ) | Anthropic wire |
|---|---|
| `{role:"user", content: str}` | `{role:"user", content:[{type:"text", text}]}` |
| `{role:"assistant", content:None, tool_calls:[{id, function:{name, arguments(str)}}], reasoning_content?}` | `{role:"assistant", content:[ {type:"tool_use", id, name, input: json.loads(arguments)} , …]}` (thinking block: xem 3.4) |
| 1..N message `{role:"tool", tool_call_id, content}` LIÊN TIẾP | **1** message `{role:"user", content:[{type:"tool_result", tool_use_id: tool_call_id, content}, …]}` |
| `{role:"assistant", content: str}` (câu trả lời cuối, hiếm khi cần gửi lại) | `{role:"assistant", content:[{type:"text", text}]}` |

> Thuật toán: duyệt tuần tự, buffer chuỗi `role:"tool"` liên tiếp → khi gặp message khác role thì flush chuỗi đó thành 1 user-tool_result message. `input` của tool_use PHẢI là object (json.loads arguments string).

### 3.3 Tools
OpenAI `{type:"function", function:{name, description, parameters}}` → Anthropic `{name, description, input_schema: parameters}`.

### 3.4 Thinking (tùy chọn, mặc định off)
- `LLM_THINKING=enabled` → body thêm `"thinking": {"type":"enabled", "budget_tokens": <từ reasoning_effort: high→~8k, max→~16k>}`. Mặc định `disabled` → không gửi field.
- Nếu response có thinking block: tích luỹ `thinking_delta` vào `reasoning`, pass-back như assistant thinking block ở lượt sau (nếu thinking enabled). v1 **để đơn giản: chỉ tích luỹ reasoning cho ToolCallsEvent.reasoning_content**, KHÔNG bắt buộc gửi lại thinking block (thinking mặc định off nên không chặn).

## 4. Request & headers
```
POST {url}
headers: {"x-api-key": api_key, "anthropic-version": "2023-06-01", "content-type": "application/json"}
body: {model, system, messages, tools?, max_tokens (BẮT BUỘC), stream: true, temperature?, thinking?}
```
- ⚠ MiniMax `/anthropic` có thể nhận auth kiểu Bearer thay vì `x-api-key`. **Verify khi smoke**: nếu 401 với `x-api-key` → thử `Authorization: Bearer`. Làm header configurable đơn giản (thử x-api-key trước — chuẩn Anthropic).

## 5. Streaming SSE parse (Anthropic → AgentEvent)
Anthropic SSE có cả dòng `event:` và `data:`; **switch theo `data.type`** (bỏ qua dòng event:). Tái dùng `parse_sse_chunk` (đã lọc `data: ` prefix):
| `data.type` | Xử lý |
|---|---|
| `message_start` | usage.input_tokens, cache_read_input_tokens, cache_creation_input_tokens → state.usage |
| `content_block_start` (content_block.type=="tool_use") | mở buffer index: id, name; input rỗng |
| `content_block_delta` delta.type=="text_delta" | `yield TokenEvent(text=delta.text)` |
| `content_block_delta` delta.type=="input_json_delta" | buffer[index].args += delta.partial_json |
| `content_block_delta` delta.type=="thinking_delta" | state.reasoning += delta.thinking |
| `message_delta` | delta.stop_reason → state.stop_reason; usage.output_tokens → state.usage["out"] |
| `message_stop` | kết thúc stream |
- Cuối lượt: `stop_reason=="tool_use"` → `ToolCallsEvent(calls=flush_buffers, reasoning_content=reasoning or None)`; else → `DoneEvent(usage, truncated = stop_reason=="max_tokens")`.
- Tool args: mỗi tool_use tích luỹ `partial_json` → `json.loads` cuối lượt (giữ `_repair_tool_json` fallback + `arg_error` như OpenAI adapter — an toàn nếu M3 nhả JSON hỏng).
- **Cache usage:** đưa `cache_read`/`cache_creation` vào state.usage (key `cache_read`,`cache_write`) để đo caching thật (mục 7).

## 6. Error/retry
Mirror OpenAI adapter: retry status {408,429,5xx} khi chưa emit token (backoff 2^attempt, MAX_RETRIES=2); ≥400 khác → `ErrorEvent`; timeout/transport → retry rồi `ErrorEvent`. Cùng thông điệp tiếng Việt.

## 7. Testing (nghiệm thu)
- **Unit convert (thuần, không network):**
  - system: cache_control gắn đúng block cache_hint cuối; block cache=False không có cache_control.
  - messages: chuỗi tool → gom 1 user message nhiều tool_result; assistant tool_calls → tool_use với input là dict; user text → block text.
  - tools: parameters → input_schema.
- **SSE parse (scripted):** feed chuỗi event Anthropic giả (text_delta + tool_use input_json_delta + message_delta stop_reason) → assert TokenEvent/ToolCallsEvent/DoneEvent đúng; tool args parse đúng dict.
- **Loop tương thích:** vì cùng interface, `tests/agent/test_loop.py` (ScriptedAdapter) KHÔNG đổi, vẫn PASS. Toàn bộ pytest (đang 231) PASS.
- **Live smoke (M3 /anthropic):** owner set `LLM_API_STYLE=anthropic` + `LLM_BASE_URL=https://api.minimax.io/anthropic`; chạy `smoke_m3.py` → tool-call + streaming OK, verify auth header đúng.
- **Đo caching:** chạy 2 request giống nhau liên tiếp → request 2 phải có `cache_read` > 0 (xác nhận pack được cache → chi phí thật giảm). Đây là câu hỏi treo từ A/B.

## 8. Rollout
- `LLM_API_STYLE=anthropic` + base_url `/anthropic` → M3 mode tối ưu. Đổi lại `openai` = về DeepSeek/M3-OpenAI. Không cần đổi code.
- Sau khi adapter ổn: **re-run A/B survey trên M3-Anthropic** → so hygiene/latency/caching với M3-OpenAI + DeepSeek → rồi mới làm fix hygiene tổng thể (industry_rank/y_trend/preamble).

## 9. Ngoài scope
Không đổi loop/gateway/schema/FE. Không làm db_stats ở đây (spec riêng). Không ép thinking pass-back phức tạp (thinking off mặc định).

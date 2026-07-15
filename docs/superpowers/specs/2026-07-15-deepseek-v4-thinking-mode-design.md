# DeepSeek V4 Thinking Mode + Anti-Truncation — Design (Phần 2)

> **Ngày:** 2026-07-15 · **Trạng thái:** design đã duyệt với owner, chờ writing-plans.
> **Bối cảnh:** Phần 2 của roadmap [[reference_deepseek_v4_api]]. Migrate v4-flash (Phần 1) xong, app an toàn sau 24/07.
> Đo K-hygiene non-thinking cho thấy **vẫn lộ ký hiệu thô + tiêu chí/ngưỡng hệ thống** (bí mật SP) → cần thinking.
> Spec bao trùm: `2026-07-15-deepseek-v4-reasoning-roadmap-design.md` (§1.x kết quả đo, §2 khung Phần 2).

## 0. Phát hiện bản lề (web-research, KHÔNG dựa mặc định)

Docs thinking-mode guide: **"thinking toggle defaults to enabled"**. Release notes: `deepseek-chat` route sang
**v4-flash non-thinking** (alias ghim non-thinking). Ghép lại → gọi **tên trần `deepseek-v4-flash` không kèm param
`thinking`** thì thinking **nhiều khả năng đã BẬT sẵn**. Nghĩa là đợt đo K-hygiene trước **có thể đã là output CÓ
thinking** → thinking một mình có thể KHÔNG cứu được hygiene. Ta chưa capture `reasoning_content` nên chưa chắc 100%.

→ **Quyết định thiết kế:** làm thinking **TƯỜNG MINH** (luôn gửi param `thinking`), capture `reasoning_content`, và
**đo A/B có kiểm soát** (`disabled` vs `enabled`) để biết chắc thay vì suy đoán.

## 1. Mục tiêu

1. Bật/tắt thinking **tường minh** qua env; adapter luôn gửi param `thinking` (hết mơ hồ mặc định).
2. Capture `reasoning_content` từ stream và **pass-back đúng luật** (lượt-có-tool bắt buộc gửi lại, nếu không → **400**).
3. **Đo A/B** hygiene non-thinking vs thinking trên DeepSeek thật → dữ liệu quyết bậc leo thang.
4. **Anti-truncation:** chỉ dẫn model tự hoạch định độ dài + lưới an toàn `finish_reason=="length"` (không cắt câm).

## 2. Sự kiện web-research chốt (nguồn cho implementer)

- Bật: `"thinking": {"type": "enabled"|"disabled"}` + (khi enabled) `"reasoning_effort": "high"|"max"`.
  Mặc định effort `high`; `low/medium`→`high`, `xhigh`→`max`.
- `reasoning_content` trả **cùng cấp `content`**; streaming: `delta.reasoning_content` (mảnh, cộng dồn như content).
- **Luật pass-back (400 nếu sai):** lượt **có tool_calls** → `reasoning_content` lượt đó PHẢI có trong messages các
  request sau. Lượt **không** tool_call → không cần giữ.
- Thinking mode **bỏ qua** `temperature`/`top_p`/`presence_penalty`/`frequency_penalty` (không lỗi, chỉ vô hiệu).
- `finish_reason`: `stop` · `length` · `content_filter` · `tool_calls` · `insufficient_system_resource`.
- Trần output v4-flash/pro = **384K**, context 1M.

## 3. Kiến trúc

### 3.1 Luồng reasoning_content (Cách 1 — gắn lên ToolCallsEvent)

Chỉ **lượt-có-tool** cần reasoning pass-back → reasoning đi cùng đúng event đó. KHÔNG emit event reasoning riêng
(đó là Cách 2, chỉ cần khi HIỂN THỊ CoT = Phần 3, YAGNI giờ).

- **`events.py`:** `ToolCallsEvent` thêm field `reasoning_content: str | None = None`. `DoneEvent` thêm
  `truncated: bool = False` (anti-truncation). Cả hai đều default → backward compatible.
- **`openai_compat.py` `_TurnState`:** thêm `reasoning: str = ""`. `_read_stream` khi thấy `delta.reasoning_content`
  → `state.reasoning += delta["reasoning_content"]`. **KHÔNG** yield ra ngoài (không hiển thị CoT giờ).
- **`stream_chat`:** khi `finish_reason=="tool_calls"` → `ToolCallsEvent(calls=..., reasoning_content=state.reasoning or None)`.
  Khi kết thúc thường → `DoneEvent(usage=..., truncated=(state.finish_reason=="length"))`.
- **`loop.py`:** `ToolCall`-driven turn giữ `pending` + `pending_reasoning`. `_assistant_tool_message(calls, reasoning_content)`
  thêm `"reasoning_content": reasoning_content` vào dict assistant **khi không None**. Round-trip: reasoning lượt N
  nằm trong messages lượt N+1.

### 3.2 Anti-truncation

- **Prompt** (`system_prompt.md`): thêm 1 chỉ dẫn ngắn — model hoạch định câu trả lời **đủ ý & kết gọn**, ưu tiên
  cấu trúc súc tích, không trôi lửng giữa chừng. Đây là "quy luật để LLM tính trước output".
- **Code:** `finish_reason=="length"` → `DoneEvent(truncated=True)`; loop đưa `truncated` vào payload `done`
  (`await emit("done", {"usage":..., "truncated": bool})`) + `logger.warning`. **Không** auto-continue.
- SSE: chỉ **thêm field** `truncated` vào payload event `done` — 6 loại event GIỮ NGUYÊN, không phá contract.

### 3.3 Config (env, cùng khuôn `temperature`)

| Env | Giá trị | Default | Ghi chú |
|---|---|---|---|
| `LLM_THINKING` | `enabled`\|`disabled` | `enabled` | Adapter luôn gửi `thinking:{type:...}` khi giá trị này set. |
| `LLM_REASONING_EFFORT` | `high`\|`max` | `high` | Chỉ gửi khi thinking `enabled`. |

- `OpenAICompatAdapter.__init__` thêm `thinking: str | None = None`, `reasoning_effort: str | None = None`.
  `_payload`: nếu `thinking` set → `payload["thinking"]={"type":thinking}`; nếu `thinking=="enabled"` và
  `reasoning_effort` set → `payload["reasoning_effort"]=reasoning_effort`.
- `build_adapter` đọc `LLM_THINKING` (default `"enabled"`), `LLM_REASONING_EFFORT` (default `"high"`).
- `temperature` vẫn truyền/gửi như cũ (thinking bỏ qua — docs; khỏi rẽ nhánh).

## 4. Đo A/B (measure-first — bậc quyết định)

Sau khi plumbing xong + test pass: chạy verify 3 câu (giá FPT · pha thị trường · định giá HPG) **2 lần**:
`LLM_THINKING=disabled` rồi `enabled`. So sánh trực tiếp:
- Còn lộ `VSI`/`zone C`/`TRANSITION`/`exposure` thô? Còn lộ ngưỡng `+0.30`/`−0.30`/`−10%`/`0.90`?
- Script in cả `reasoning_content` length (xác nhận thinking thực sự bật khi `enabled`).
- **GHI kết quả A/B vào `.superpowers/sdd/progress.md`** — căn cứ quyết thang leo.

## 5. Thang leo (định sẵn — CHỈ làm nếu §4 còn lộ)

- **Bậc 1:** siết vị trí luật K-hygiene — thêm khối "output contract" ngắn ở **cuối** `system_prompt` (salience cao,
  là thứ model đọc gần lượt sinh nhất), liệt kê tối giản: không in ký hiệu thô, không lộ ngưỡng/công thức xếp hạng.
- **Bậc 2:** lượt hậu xử lý — 1 call model riêng K-hygiene-hoá câu trả lời trước khi trả (đắt, chỉ khi Bậc 1 chưa đủ).

Hai bậc này là backlog có điều kiện, KHÔNG implement trong plan Phần 2 trừ khi §4 chứng minh cần.

## 6. Test (TDD)

- **Adapter payload:** thinking `enabled` → `payload["thinking"]=={"type":"enabled"}` + có `reasoning_effort`;
  `disabled` → `{"type":"disabled"}`, **không** `reasoning_effort`; `thinking=None` → không có key `thinking`.
- **`_read_stream`:** SSE fixture có `delta.reasoning_content` (nhiều mảnh) + kết `tool_calls` → `ToolCallsEvent.reasoning_content`
  ghép đủ; SSE kết `length` → `DoneEvent.truncated is True`.
- **Loop:** `_assistant_tool_message` có `reasoning_content` khi truyền vào, **không có key** khi None; round-trip —
  reasoning lượt tool nằm trong `adapter.calls[1]` messages; `truncated` chảy vào payload `done`.
- **Verify DeepSeek thật:** A/B §4 (thủ công, owner-run trong SDD được vì key đã có + đã chạy Phần 1).

## 7. Ngoài phạm vi (KHÔNG làm trong Phần 2)

- **Hiển thị CoT cho khách** (Phần 3.1) — cần giải rủi ro lộ ký hiệu/tiêu chí trước; giờ chỉ capture để pass-back.
- **Model selector per-request** (think/pro, Phần 3.2) — giờ toggle global qua env.
- **Hậu xử lý K-hygiene** (Bậc 2 §5) — chỉ nếu đo còn lộ.
- Persistence/quota per-model.

## 8. Global Constraints (bind mọi task)

- KHÔNG thêm dependency. Type hints mọi signature. Không `except:` trần. Không `print()`. Hàm ≤40 dòng.
- Secrets chỉ ở `.env*` (owner điền). KHÔNG `NEXT_PUBLIC_` cho key. KHÔNG commit `.env*`.
- Baseline: 192 test PASS branch `feat/agent-v1-slice`. Mỗi task giữ full suite xanh.
- Diff tối thiểu, không refactor ngoài phạm vi. SSE giữ 6 loại event (chỉ thêm field payload, không thêm loại).
- Reasoning pass-back CHỈ cho lượt-có-tool (docs); lượt trả lời cuối không giữ reasoning.

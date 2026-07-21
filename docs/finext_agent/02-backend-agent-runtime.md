# 02 — Bước 2: Backend Agent Runtime (Loop + Streaming)

> **Vai trò trong lộ trình:** bộ não vận hành trong container FastAPI sẵn có — nhận message, chạy vòng lặp LLM ↔ tools, stream kết quả về FE theo contract chuẩn hoá. Đây là phần kế thừa nhiều nhất từ spec cũ ([`2026-07-12-ai-chat-agent-architecture.md`](../superpowers/specs/2026-07-12-ai-chat-agent-architecture.md)) nhưng **tool surface đổi hẳn** theo mô hình v2: model tự viết query, không còn 17 typed tools.
> **Phụ thuộc:** interface `GatewayProtocol` (bước 1). FixtureGateway dùng cho test; context ưu tiên KB thật trong repo và chỉ fallback pack stub khi không có resident nào.
> **Snapshot as-built 2026-07-21:** bước này đã triển khai. Route là `POST /api/v1/chat/stream`; loop dùng 4 tool (`db_find`, `db_aggregate`, `db_stats`, `read_kb`), 2 wire adapter (`openai`/`anthropic`) và guard deterministic trước khi phát câu trả lời.

---

## 1. Hiện Trạng

| Hạng mục | Trạng thái |
|----------|-----------|
| Pattern SSE production (queue + `asyncio.wait_for` + heartbeat 10s) | ✅ [`sse.py`](../../finext-fastapi/app/routers/sse.py) — copy pattern, queue per-request |
| Auth chạy trước stream (`Depends(get_current_user)` → 401 JSON thường → refresh flow FE nguyên vẹn) | ✅ pattern sẵn |
| uvicorn 2 workers — SDK sync sẽ block trọn 1 worker | ✅ đã biết → **async bắt buộc** |
| `routers/chat.py`, `crud/chat.py`, `schemas/chat.py`, `agent/` | ✅ Đã có và đang được mount tại `/api/v1/chat` |
| Contract stream FE↔BE | ✅ 9 event type, mô tả §3 |
| Knowledge Pack (`system_prompt.md` + `agent_db_01→07`) | ✅ Nằm ngay trong `app/agent/kb`; `system_prompt`+01+02 resident, phần sâu nạp qua `read_kb`; stub chỉ là fallback khi resident trống |

## 2. Cấu Trúc Thư Mục (theo layering convention repo)

```
finext-fastapi/app/
├── routers/chat.py          # HTTP + auth + quota + StreamingResponse (mỏng)
├── crud/chat.py             # persistence (bước 3)
├── schemas/chat.py          # Pydantic DTOs
└── agent/
    ├── loop.py              # vòng lặp LLM ↔ tools ↔ queue
    ├── events.py            # AgentEvent nội bộ (Token|ToolCalls|Done|Error)
    ├── context.py           # lắp system prompt: pack files + briefing (§5)
    ├── labels.py            # sinh label hiển thị cho tool chip (§4.3)
    ├── adapters/            # base.py · openai_compat.py · anthropic_compat.py
    ├── tools/               # registry · db · db_stats · kb · shrink (+ user.py dormant)
    └── gateway/             # bước 1 (nếu chọn Option A đặt tại đây)
```

## 3. Contract Stream FE↔BE (giữ từ spec cũ — FE không bao giờ thấy format provider)

SSE over POST `/api/v1/chat/stream`, wire `data: <json>\n\n` + comment `: hb` heartbeat 10s:

| type | payload | Ghi chú |
|---|---|---|
| `meta` | `{conversation_id, message_id, as_of}` | `message_id` ở đây là request id; `as_of` hiện luôn `null` vì frame đầu không chờ task đọc briefing |
| `token` | `{text}` | |
| `tool_start` | `{name, label}` | label sinh generic — §4.3 |
| `tool_end` | `{name, ok, ms}` | |
| `title` | `{conversation_id,title}` | best-effort sau lượt đầu, sinh bằng model non-thinking |
| `message_saved` | `{message_id}` | ObjectId thật của assistant message, dùng cho feedback |
| `quota_warn` | `{threshold,window,message}` | cảnh báo khi vừa vượt 50%/75%, không chặn lượt vừa xong |
| `done` | `{usage, truncated}` | usage cộng dồn mọi vòng LLM trong `run_agent`; `message_saved` phát sau đó |
| `error` | `{message}` | lỗi giữa stream đi in-band (HTTP 200 đã gửi) |

`error` kết thúc luồng nghiệp vụ; sau `done`, router còn có thể phát `message_saved`, `quota_warn` và (hội thoại mới) `title` trước khi đóng stream. FE phải tiếp tục đọc đến EOF, không dừng ngay ở `done`.

## 4. Tool Surface hiện hành — 4 tools

### 4.1 Danh sách

| Tool | Input schema | Đích | Ghi chú |
|---|---|---|---|
| `db_find` | `{collection, filter, projection, sort?, limit?}` | gateway | luật do policy quyết, KHÔNG do schema tool |
| `db_aggregate` | `{collection, pipeline}` | gateway | như trên |
| `db_stats` | `{collection, field, ops, filter?, range?}` | gateway | tính server-side min/max/mean/median/percentile/latest/drawdown trên field được policy whitelist; không gửi chuỗi dài cho model |
| `read_kb` | `{doc}` | `app/agent/kb/*.md` | tên file phải nằm trong whitelist động; tool nguồn cắt ở 60k ký tự, sau đó loop áp cap hiệu dụng tối đa 24k/call (thấp hơn khi nhiều call, trong budget chung 40k/vòng) |

`get_my_watchlist` vẫn còn schema/handler trong `tools/user.py` và nhánh dispatch để nối lại sau, nhưng **không nằm trong `TOOL_SCHEMAS`**, nên model production không thể gọi nó. Không mô tả watchlist như capability hiện hành.

### 4.2 Luật thực thi trong loop (kế thừa spec cũ, vẫn đúng nguyên)

- `MAX_ITERS = 10`; output default 64.000 token (override `LLM_MAX_OUTPUT_TOKENS`).
- Tool result tối đa 24.000 ký tự/call; tổng mỗi vòng 40.000 ký tự, chia đều **trước** khi chạy song song. `shrink.py` bỏ trọn phần tử, ưu tiên giữ dữ liệu mới và phát note phần đã bỏ.
- Nhiều tool call 1 vòng → `asyncio.gather` (Mongo reads độc lập).
- `execute()` tự bắt exception → trả `{"error": "..."}` cho model thay vì raise.
- Hai cầu dao: 2 vòng liên tiếp mọi tool đều fail hoặc tổng token vào+ra đạt 600.000 → cấm tool và ép câu trả lời best-effort; tối đa 3 nudge dùng chung cho rỗng/grounding/no-data.
- Câu cuối được buffer, `sanitize_answer()` và qua guard grounding/no-data/re-briefing trước khi phát lại thành chunk nhỏ. Vì vậy SSE không chuyển tiếp raw token provider ngay lập tức.
- User bấm dừng/ngắt request → cancel agent task. Runtime hiện **không lưu assistant partial**; user message đã lưu trước stream vẫn còn để retry.

### 4.3 Label cho tool chip (FE) — sinh generic, không hard-code

`labels.py` giữ bảng map **tùy chọn** `collection → cụm danh từ tiếng Việt` ("stock_snapshot" → "dữ liệu cổ phiếu", "news_history_feed" → "dòng tin gần đây"...), gắn thêm ticker nếu filter có mã; fallback là "dữ liệu". FE `ToolChip` mới ghép động từ theo tool: **Đọc / Tổng hợp / Thống kê / Tham khảo**. Bảng map **được phép lỗi thời vô hại** (chỉ mất đẹp, không mất chức năng) — đúng tinh thần DB-agnostic.

## 5. System Prompt Assembly — server chỉ GHÉP, không hiểu nội dung

```
[Block 1 — resident, cache_hint=true] nối `system_prompt` + `agent_db_01` + `agent_db_02`
                                      từ `app/agent/kb`
[Block 2 — briefing, cache_hint=true]  render data_briefing {type:"core"} → JSON gọn
                                    + dòng freshness: "Mốc dữ liệu: {as_of}. Trong giờ giao dịch,
                                    giá/khối lượng cập nhật gần realtime (fnx05 chạy ~2 phút/vòng);
                                    riêng dữ liệu PHASE chốt cuối ngày (as_of riêng, có thể trễ 1 phiên)."
                                    ⚠ KHÔNG gọi đây là "dữ liệu EOD" — agent_db v2 chạy continuous,
                                    nói EOD là tự mô tả sai độ tươi của chính mình (v2 §2)
[KHÔNG BAO GIỜ nhét timestamp-hiện-tại vào system — bust cache vô ích]
[Block 3 — session, cache_hint=false] giờ Việt Nam + trạng thái trước/trong/sau phiên
[Block 4 — optional, cache_hint=false] page_context của chat bubble
```

### 5.1 Pack là DATA, không phải code

- Pack thật nằm trực tiếp trong `app/agent/kb` và được Dockerfile copy cùng `app`. `AGENT_PACK_DIR` tuy còn được khai báo trong `core/config.py` nhưng **chưa được `context.py` sử dụng**; đặt env này hiện không đổi nguồn pack.
- `context.py` đọc resident mỗi lượt; `read_kb` cho phép model đọc các file 03→07 theo nhu cầu. Khi không có bất kỳ resident thật nào mới fallback `app/agent/pack_stub`.
- ⚠ **Pack và DB phải CÙNG THẾ HỆ**. Runtime hiện chỉ log số tài liệu resident, chưa log/enforce pack/schema version; owner phải deploy DB+policy+pack cùng đợt và chạy smoke.
- `pack_stub` là fallback phòng khi không có bất kỳ resident thật nào; test context hiện có thể đọc chính `app/agent/kb`, không mặc định ép dùng stub.

### 5.2 Briefing — điểm chạm schema DUY NHẤT, có fallback

Web đọc `data_briefing {type:"core"}` qua chính gateway (doc thật hiện ~320 tok — v2 §4, rẻ hơn nhiều so ngân sách 1.5k ban đầu). Ba trường hợp:
1. Có doc → nhúng và dùng `as_of` trong freshness/session note nội bộ. Router hiện chưa đưa mốc này ra FE; `meta.as_of` vẫn null. `core.as_of` là commit marker, phase có mốc riêng.
2. Không có (DB mới dựng lại / sự cố pipeline) → **bỏ block 2**, `meta.as_of = null`, system thêm 1 dòng "chưa có bản tin tổng hợp — chủ động query khi cần". Agent vẫn chạy đủ chức năng.
3. Doc to bất thường (>6KB — hỏng từ pipeline) → cắt + log cảnh báo, không chết.

Cache briefing in-process theo TTL 600 giây. `build_system_blocks()` trả `as_of`, nhưng router hiện không chuyển giá trị này về một event meta thứ hai; `meta.as_of` vì vậy vẫn null.

## 6. Model Adapter — seam duy nhất phụ thuộc provider

`ModelAdapter Protocol`: `stream_chat(system[SystemBlock(cache_hint)], messages, tools, max_tokens) -> AsyncIterator[AgentEvent]`. Adapter chỉ dịch giao thức; vòng lặp ở `loop.py`. Adapter được build theo request, nhưng dùng chung một `httpx.AsyncClient` lazy singleton trong mỗi worker.

**As-built:** không dùng SDK nhà cung cấp; có hai adapter tự viết trên `httpx`. `build_adapter()` chọn bằng `LLM_API_STYLE` (`openai` mặc định, `anthropic` tùy chọn). Snapshot `.env.production` trong workspace cấu hình `MiniMax-M3` + base URL MiniMax; đây không phải default code hay xác nhận deploy live.

| Quyết định | Chốt / thiết kế | Fallback | Ghi chú |
|---|---|---|---|
| `OpenAICompatAdapter` | `POST {base}/chat/completions`, stream usage, tool-call JSON fragments, thinking field kiểu provider-compatible | adapter mặc định (`LLM_API_STYLE=openai`) | `cache_hint` không được map thành explicit cache control trên wire này |
| `AnthropicCompatAdapter` | `POST {base}/v1/messages`, convert system/messages/tools và parse `tool_use`; map usage cache về quy ước chung | `LLM_API_STYLE=anthropic` | đánh `cache_control: ephemeral` ở block cache-hint cuối; thinking chỉ gửi khi giá trị đúng `enabled` |
| Model/provider | `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`; không có default an toàn | đổi env + restart + chạy lại eval | repo `.env.production`: MiniMax-M3/OpenAI-compatible |
| Retry provider lỗi | `429`/`529`/timeout: backoff tối đa 2 lần, **CHỈ khi chưa nhả token nào** (retry giữa chừng gây lặp chữ); hết retry → `error` event "Hệ thống AI đang quá tải, thử lại sau ít phút" | — | từ file 09 §4; log riêng mã lỗi provider để phân biệt với 429 quota nội bộ |

History: FE gửi tối đa 20 turn gần nhất, mỗi content cắt 8.000 ký tự; chỉ role user/assistant, không replay tool blocks. Backend schema cũng giới hạn history 20 turn.

## 7. Rủi Ro & Phương Án Xử Lý (đặc thù của mô hình model-viết-query)

| # | Rủi ro | Dấu hiệu | Xử lý |
|---|--------|----------|-------|
| R1 | **Model dò schema bằng query thử-sai** (không nhớ tên field) → tốn 2-3 vòng tool/lượt, chậm + đắt | nhiều `tool_end ok=false` liên tiếp trong log | Phòng chính: pack (agent_db_01/02) là "tài liệu schema" nằm sẵn trong system. Phòng phụ: error của gateway kèm gợi ý. Nếu vẫn tệ ở collection nào → thêm ví dụ query mẫu cho collection đó vào pack (sửa DATA, không sửa code) |
| R2 | **Câu đơn giản cũng đi 2-3 query** ("FPT thế nào" → snapshot + info + recent rời rạc) — so với typed tool gộp sẵn 1 phát | thống kê số tool call/lượt cao | (a) pack Workflow dạy query gộp (`$in` nhiều collection tuần tự có chủ đích); (b) nếu đo thật thấy 20% câu chiếm 80% query → **thêm 1-2 macro tool** (`get_stock_bundle`) — vẫn qua gateway, chỉ là convenience layer, KHÔNG phá nguyên tắc (macro đọc policy như thường). Đây là quyết định để SAU khi có số đo, không làm trước |
| R3 | **Vòng lặp không hội tụ** | chạm trần | `MAX_ITERS=10`, force-answer ở vòng cuối; dừng sớm sau 2 vòng toàn-fail hoặc 600k token; force vẫn rỗng thì emit lỗi thân thiện |
| R4 | **Model bịa số khi tool fail** thay vì nhận thiếu | so đáp án với DB khi eval | luật số liệu trong pack ("mọi con số phải từ tool result/briefing") + eval smoke có case tool-fail (file 07) |
| R5 | Tokenizer của model đã chọn cho ra số token lệch xa ước tính (mỗi nhà mỗi tokenizer, tiếng Việt lệch mạnh) | usage.in cao hơn dự kiến | đo pack+briefing bằng tokenizer/endpoint đếm token của ĐÚNG model trước go-live; ngân sách chi tiết ở file 03 |
| R6 | Nhiều tab gửi đồng thời | cùng chạy và tiêu quota; check trước stream không reserve | hiện chưa có semaphore/lock per-user; quota Mongo chỉ chặn lượt sau khi usage `done` đã được ghi |
| R7 | LLM stream đứt giữa chừng (provider lỗi, mạng) | `error` event tăng | Câu provider được buffer trước khi phát nên thường chưa có text khách; assistant chỉ persist sau `done`. User message còn để retry; adapter chỉ retry khi chưa emit token nội bộ. |

## 8. Điều Kiện Hoàn Thành Bước 2

- [x] Router SSE + heartbeat 10 giây + contract parser/test đã có.
- [x] Test hai adapter, loop/usage/guard/tool cap/cancellation/context/REST có trong `tests/agent/`.
- [x] Fixture gateway + pack stub tồn tại cho test không cần Mongo.
- [x] Briefing thiếu có fallback và test.
- [ ] Smoke `curl -N` qua **production nginx/provider hiện hành** vẫn là bước deploy, không suy ra từ unit test.
- [ ] Chưa có bài test live tự động chuyển hai provider production; đổi model/wire phải chạy lại eval smoke.

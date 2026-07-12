# 02 — Bước 2: Backend Agent Runtime (Loop + Streaming)

> **Vai trò trong lộ trình:** bộ não vận hành trong container FastAPI sẵn có — nhận message, chạy vòng lặp LLM ↔ tools, stream kết quả về FE theo contract chuẩn hoá. Đây là phần kế thừa nhiều nhất từ spec cũ ([`2026-07-12-ai-chat-agent-architecture.md`](../superpowers/specs/2026-07-12-ai-chat-agent-architecture.md)) nhưng **tool surface đổi hẳn** theo mô hình v2: model tự viết query, không còn 17 typed tools.
> **Phụ thuộc:** interface `GatewayProtocol` (bước 1). Dev được ngay với FixtureGateway + pack stub.

---

## 1. Hiện Trạng

| Hạng mục | Trạng thái |
|----------|-----------|
| Pattern SSE production (queue + `asyncio.wait_for` + heartbeat 10s) | ✅ [`sse.py`](../../finext-fastapi/app/routers/sse.py) — copy pattern, queue per-request |
| Auth chạy trước stream (`Depends(get_current_user)` → 401 JSON thường → refresh flow FE nguyên vẹn) | ✅ pattern sẵn |
| uvicorn 2 workers — SDK sync sẽ block trọn 1 worker | ✅ đã biết → **async bắt buộc** |
| `routers/chat.py`, `agent/` package | ❌ chưa có |
| Contract stream FE↔BE | ✅ thiết kế sẵn từ spec cũ, giữ nguyên (§3) — FE làm song song từ đây |
| Knowledge Pack v2 (`system_prompt.md` + `agent_db_01→06`) | ✅ HOÀN CHỈNH (ngoài repo, cùng thế hệ DB v2) — cần cơ chế sync vào `AGENT_PACK_DIR` (bước 5 §4); CI vẫn dùng pack stub |

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
    ├── adapters/            # base.py (Protocol) · openai_compat.py (v1 duy nhất; +native khi cần)
    ├── tools/               # registry.py · db.py (find/aggregate→gateway) · user.py (watchlist)
    └── gateway/             # bước 1 (nếu chọn Option A đặt tại đây)
```

## 3. Contract Stream FE↔BE (giữ từ spec cũ — FE không bao giờ thấy format provider)

SSE over POST `/api/v1/chat/stream`, wire `data: <json>\n\n` + comment `: hb` heartbeat 10s:

| type | payload | Ghi chú |
|---|---|---|
| `meta` | `{conversation_id, message_id, as_of}` | `as_of` từ briefing; null nếu briefing thiếu (§5.2) |
| `token` | `{text}` | |
| `tool_start` | `{name, label}` | label sinh generic — §4.3 |
| `tool_end` | `{name, ok, ms}` | |
| `done` | `{usage:{in,out}, interrupted?}` | |
| `error` | `{message}` | lỗi giữa stream đi in-band (HTTP 200 đã gửi) |

Sau `error`/`done` là hết stream. Quy tắc này là **hợp đồng đóng băng** — FE (bước 4) build trên nó, đổi phải bump version 2 phía.

## 4. Tool Surface — 3 Tools (thay 17 typed tools của spec cũ)

### 4.1 Danh sách

| Tool | Input schema | Đích | Ghi chú |
|---|---|---|---|
| `db_find` | `{collection, filter, projection, sort?, limit?}` | gateway | luật do policy quyết, KHÔNG do schema tool |
| `db_aggregate` | `{collection, pipeline}` | gateway | như trên |
| `get_my_watchlist` | `{}` | `user_db.watchlists` | **user_id từ JWT context, không bao giờ là tham số** — chặn IDOR-qua-AI. Join giá sang `stock_snapshot` qua gateway (indexed point-reads). Tool user-scoped DUY NHẤT của v1 |

Vì sao mô hình này DB-agnostic: thêm/bớt/đổi collection **không đổi tool schema** → không đổi code web, không bust prompt cache phần tools. Cái giá phải trả và cách bù đắp nằm ở rủi ro R1/R2 (§7).

### 4.2 Luật thực thi trong loop (kế thừa spec cũ, vẫn đúng nguyên)

- `MAX_ITERS = 8` vòng LLM↔tool · `max_tokens` output ~1.200/lượt.
- Tool result truncate 12.000 chars (+ ghi `[đã cắt]`); tổng result/lượt cap ~30.000 chars — **tầng cap thứ 2** sau cap 50KB của gateway.
- Nhiều tool call 1 vòng → `asyncio.gather` (Mongo reads độc lập).
- `execute()` tự bắt exception → trả `{"error": "..."}` cho model thay vì raise.
- Cancellation: user dừng/đóng tab → cancel generator → `finally` cancel agent task → đóng LLM stream (ngừng trả tiền token ngay) → lưu partial `interrupted: true`.

### 4.3 Label cho tool chip (FE) — sinh generic, không hard-code

`labels.py` giữ bảng map **tùy chọn** `collection → nhãn tiếng Việt` ("stock_snapshot" → "dữ liệu cổ phiếu", "news_history_feed" → "tin tức"...). Thuật toán: có map → *"Đang đọc {nhãn}{ + mã nếu filter có ticker}…"*; không map → fallback *"Đang tra cứu dữ liệu…"*. Bảng map **được phép lỗi thời vô hại** (chỉ mất đẹp, không mất chức năng) — đúng tinh thần DB-agnostic.

## 5. System Prompt Assembly — server chỉ GHÉP, không hiểu nội dung

```
[Block 1 — pack, cache_hint=true]   đọc từ thư mục AGENT_PACK_DIR lúc startup
                                    (system_prompt v2 đã gộp 00 — file git, versioned)
[Block 2 — briefing, cache_hint=true]  render data_briefing {type:"core"} → JSON gọn
                                    + dòng freshness: "Mốc dữ liệu: {as_of}. Trong giờ giao dịch,
                                    giá/khối lượng cập nhật gần realtime (fnx05 chạy ~2 phút/vòng);
                                    riêng dữ liệu PHASE chốt cuối ngày (as_of riêng, có thể trễ 1 phiên)."
                                    ⚠ KHÔNG gọi đây là "dữ liệu EOD" — agent_db v2 chạy continuous,
                                    nói EOD là tự mô tả sai độ tươi của chính mình (v2 §2)
[KHÔNG BAO GIỜ nhét timestamp-hiện-tại vào system — bust cache vô ích]
```

### 5.1 Pack là DATA, không phải code

- `AGENT_PACK_DIR` trỏ tới bản pack đã build (owner sync từ repo pack — cách sync: git submodule / copy lúc build image / volume mount, owner chọn ở bước 5). Web đọc file text, nối theo thứ tự tên file. Đổi pack = thay file + restart (hoặc reload theo mtime — làm sau nếu cần).
- ⚠ **Pack và DB phải CÙNG THẾ HỆ** (agent_db_v2 §7.1.3/§7.3: lệch = agent đọc sai đơn vị ×100 — triệu chứng nhận biết trong §7.3). Web log version pack lúc startup; khi owner nâng cấp DB+pack → sync pack mới cùng đợt.
- Test/CI: **pack stub** ~1k tok (bảng đơn vị + luật an toàn + bản đồ collection tối giản) trong repo test fixtures — không phụ thuộc bản pack thật.

### 5.2 Briefing — điểm chạm schema DUY NHẤT, có fallback

Web đọc `data_briefing {type:"core"}` qua chính gateway (doc thật hiện ~320 tok — v2 §4, rẻ hơn nhiều so ngân sách 1.5k ban đầu). Ba trường hợp:
1. Có doc → nhúng, lấy `as_of` cho event `meta` + so staleness với tool results. Lưu ý: `core.as_of` là commit marker của vòng ghi (v2 §2) — phase có `as_of` riêng, được phép trễ 1 phiên trong giờ giao dịch.
2. Không có (DB mới dựng lại / sự cố pipeline) → **bỏ block 2**, `meta.as_of = null`, system thêm 1 dòng "chưa có bản tin tổng hợp — chủ động query khi cần". Agent vẫn chạy đủ chức năng.
3. Doc to bất thường (>6KB — hỏng từ pipeline) → cắt + log cảnh báo, không chết.

Cache briefing in-process theo `as_of` (đọc lại khi đổi ngày hoặc TTL ~10 phút) — không đọc Mongo mỗi lượt chat.

## 6. Model Adapter — seam duy nhất phụ thuộc provider

`ModelAdapter Protocol`: `stream_chat(system[SystemBlock(cache_hint)], messages, tools, max_tokens) -> AsyncIterator[AgentEvent]`. Adapter chỉ dịch giao thức; vòng lặp ở `loop.py`. Chọn qua env, init 1 lần lúc startup.

**✅ ĐÃ CHỐT (owner):** không khoá vendor, **tự code adapter — không dùng SDK nhà cung cấp nào**.

| Quyết định | Chốt / thiết kế | Fallback | Ghi chú |
|---|---|---|---|
| Adapter v1 | **MỘT adapter duy nhất: `OpenAICompatAdapter`**, tự viết trên `httpx` async sẵn có (~200-300 dòng + tests). Chuẩn OpenAI-compat là mẫu số chung của ngành: OpenAI, OpenRouter, LiteLLM, DeepSeek, Groq, vLLM/self-host, Gemini (endpoint compat), kể cả Anthropic (endpoint compat) — đổi nhà = đổi `LLM_BASE_URL` + `LLM_MODEL` + `LLM_API_KEY` | dùng SDK open-source (`openai`) nếu tự parse phát sinh bug dai dẳng — interface `ModelAdapter` không đổi | ⚠️ điểm bẩn nhất biết trước: **tool-call arguments stream về theo mảnh JSON string** — tích luỹ theo `index`, parse khi finish. Viết test với fixture bytes THẬT của ≥2 provider (mỗi nhà lệch chuẩn một kiểu nhỏ: field thừa/thiếu, finish_reason khác nhau) |
| Adapter native riêng (`anthropic.py`, `gemini.py`…) | **KHÔNG làm v1** | thêm khi cần tính năng độc quyền của 1 nhà (explicit cache breakpoint, thinking mode…) — interface đã chừa chỗ | tránh nuôi N adapter khi chưa có nhu cầu thật |
| `cache_hint` | adapter dịch nếu provider hỗ trợ điều khiển cache; không thì bỏ qua — suy giảm về CHI PHÍ, không phải tính đúng đắn | — | caching mỗi nhà mỗi kiểu (OpenAI tự động, Anthropic explicit, nhiều nhà không có) — tác động chi phí ở file 03 §3 |
| Retry provider lỗi | `429`/`529`/timeout: backoff tối đa 2 lần, **CHỈ khi chưa nhả token nào** (retry giữa chừng gây lặp chữ); hết retry → `error` event "Hệ thống AI đang quá tải, thử lại sau ít phút" | — | từ file 09 §4; log riêng mã lỗi provider để phân biệt với 429 quota nội bộ |

History: lưu schema trung lập của mình; **không replay tool blocks** các lượt cũ (tiết kiệm 0.5-2k tok/tool + không dính format provider); cửa sổ 10 message (~8k tok cap). — giữ nguyên từ spec cũ, vẫn đúng với v2.

## 7. Rủi Ro & Phương Án Xử Lý (đặc thù của mô hình model-viết-query)

| # | Rủi ro | Dấu hiệu | Xử lý |
|---|--------|----------|-------|
| R1 | **Model dò schema bằng query thử-sai** (không nhớ tên field) → tốn 2-3 vòng tool/lượt, chậm + đắt | nhiều `tool_end ok=false` liên tiếp trong log | Phòng chính: pack (agent_db_01/02) là "tài liệu schema" nằm sẵn trong system. Phòng phụ: error của gateway kèm gợi ý. Nếu vẫn tệ ở collection nào → thêm ví dụ query mẫu cho collection đó vào pack (sửa DATA, không sửa code) |
| R2 | **Câu đơn giản cũng đi 2-3 query** ("FPT thế nào" → snapshot + info + recent rời rạc) — so với typed tool gộp sẵn 1 phát | thống kê số tool call/lượt cao | (a) pack Workflow dạy query gộp (`$in` nhiều collection tuần tự có chủ đích); (b) nếu đo thật thấy 20% câu chiếm 80% query → **thêm 1-2 macro tool** (`get_stock_bundle`) — vẫn qua gateway, chỉ là convenience layer, KHÔNG phá nguyên tắc (macro đọc policy như thường). Đây là quyết định để SAU khi có số đo, không làm trước |
| R3 | **Vòng lặp không hội tụ** (model loay hoay query mãi) | chạm MAX_ITERS | giữ `MAX_ITERS=8` + emit `error` "Vượt giới hạn bước xử lý"; đếm tỷ lệ chạm trần trong metrics — nếu >2% lượt thì vấn đề nằm ở pack/prompt, sửa ở đó |
| R4 | **Model bịa số khi tool fail** thay vì nhận thiếu | so đáp án với DB khi eval | luật số liệu trong pack ("mọi con số phải từ tool result/briefing") + eval smoke có case tool-fail (file 07) |
| R5 | Tokenizer của model đã chọn cho ra số token lệch xa ước tính (mỗi nhà mỗi tokenizer, tiếng Việt lệch mạnh) | usage.in cao hơn dự kiến | đo pack+briefing bằng tokenizer/endpoint đếm token của ĐÚNG model trước go-live; ngân sách chi tiết ở file 03 |
| R6 | 2 uvicorn workers → semaphore "1 stream/user" chỉ per-worker (tối đa 2 stream/user) | — | chấp nhận (như spec cũ); quota theo Mongo counter mới là lớp đúng (bước 3) |
| R7 | LLM stream đứt giữa chừng (provider lỗi, mạng) | `error` event tăng | FE giữ text đã nhả + nút thử lại (contract §3); message partial vẫn được lưu; adapter retry CHỈ khi chưa nhả token nào (retry giữa chừng gây lặp chữ) |

## 8. Điều Kiện Hoàn Thành Bước 2

- [ ] `curl -N` thấy stream: `meta` → `token`... → `done`; heartbeat xuất hiện khi im lặng >10s (test bằng echo adapter giả trước khi có LLM key).
- [ ] pytest: adapter parse stream (mock SSE bytes) · loop max-iters · truncate tool result · cancellation lưu partial.
- [ ] Chạy với FixtureGateway + pack stub: câu "FPT giá bao nhiêu" ra được câu trả lời có số từ fixture.
- [ ] Đổi `LLM_BASE_URL`/`LLM_MODEL` giữa ≥2 provider OpenAI-compat khác nhau không đổi hành vi FE (contract §3 giữ nguyên) — đây là bài test của tính vendor-free.
- [ ] Kịch bản briefing-thiếu (§5.2 case 2) chạy được — chứng minh không phụ thuộc DB.

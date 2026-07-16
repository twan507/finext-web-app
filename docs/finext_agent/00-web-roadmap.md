# 00 — Lộ Trình Tích Hợp Finext Agent Vào Web (Tổng Quan)

> **Bộ tài liệu này là gì:** kiến trúc triển khai AI Chat Agent trên **web Finext** (finext.vn), từ đầu đến cuối.
> Mỗi file = một bước. Mỗi bước ghi rõ: cần gì · đã có gì · chưa có gì · phương án A/B · rủi ro + cách xử lý · điều kiện hoàn thành.
> **KHÔNG cover Claude app** (owner tự làm, chỉ chia sẻ chung tầng gateway + knowledge pack).
> **Nguồn sự thật tầng dữ liệu:** [`agent_db_v2.md`](agent_db_v2.md) (as-built chính thức, 2026-07-12 — thay thế agent_db_plan cũ đã loại bỏ) — bộ doc này tham chiếu, không lặp lại, không đảo quyết định đã chốt.
> **Cập nhật:** 2026-07-12. Giá API + thông tin MCP đã verify bằng web search cùng ngày.

---

## 1. Nguyên Tắc Kiến Trúc Số 1: Web Runtime Phải DB-Agnostic

`agent_db` **đang được owner sửa và sẽ còn đổi** (schema, đơn vị, collection mới). Vì vậy toàn bộ kiến trúc web được thiết kế theo nguyên tắc:

> **Web runtime không biết schema của `agent_db`. Nội dung DB đổi thế nào, web vẫn chạy.**

Cơ chế cụ thể để đạt được điều đó (chi tiết ở các file sau):

| # | Cơ chế | Ở đâu |
|---|--------|-------|
| 1 | Model **tự viết query** qua 2 tool generic (`db_find` / `db_aggregate`) — web không có tool nào pin vào collection cụ thể | [`02-backend-agent-runtime.md`](02-backend-agent-runtime.md) |
| 2 | Mọi luật về collection (whitelist, filter bắt buộc, cap) nằm trong **policy file declarative** của gateway — đổi DB chỉ sửa config, không sửa code web | [`01-gateway-data-access.md`](01-gateway-data-access.md) |
| 3 | Kiến thức schema nằm trong **Knowledge Pack** (file versioned theo git) — server chỉ *ghép* pack vào system prompt, không hiểu nội dung | [`02-backend-agent-runtime.md`](02-backend-agent-runtime.md) §5 |
| 4 | Điểm chạm schema duy nhất của web = đọc `data_briefing {type:"core"}` + field `as_of` — có fallback: thiếu doc này agent vẫn chạy (bỏ briefing, ghi chú staleness) | [`02-backend-agent-runtime.md`](02-backend-agent-runtime.md) §5.2 |
| 5 | FE hiển thị tool chip theo **nhãn generic** ("Đang tra cứu dữ liệu…" + tên collection nếu map được) — không phụ thuộc danh sách tool cố định | [`04-frontend-assistant.md`](04-frontend-assistant.md) §4 |
| 6 | `schema_version` trong DB + version trong pack — lệch version thì agent tự cảnh báo, không sai lặng lẽ | agent_db_v2 §7.2 (P2) |

Hệ quả cho lộ trình: **DB thật ĐÃ SẴN SÀNG** (v2 as-built, verify pass — xem §3), nhưng nguyên tắc DB-agnostic vẫn giữ nguyên giá trị: fixture mode dùng cho test/CI không cần Mongo, và mọi lần owner sửa `agent_db` sau này web không phải deploy lại.

---

## 2. Kiến Trúc Đích (Web)

```
┌─ Browser ─────────────────────────────────────────────────────────────────┐
│  /assistant (Next.js) — useChatStore + chatClient (SSE-over-POST parser)  │
└──────────────┬────────────────────────────────────────────────────────────┘
               │ POST /api/v1/chat/stream  (JWT Bearer)
               ▼
┌─ Nginx ───────────────────────────────────────────────────────────────────┐
│  location /api/v1/chat/ → proxy_buffering off, read_timeout dài           │
└──────────────┬────────────────────────────────────────────────────────────┘
               ▼
┌─ FastAPI (container sẵn có — KHÔNG thêm container) ───────────────────────┐
│  routers/chat.py     auth + quota + StreamingResponse (mỏng)              │
│      ▼                                                                    │
│  agent/loop.py       vòng lặp LLM ↔ tools (max iters, budget)             │
│      ├─ tools: db_find / db_aggregate ──► GATEWAY CORE (library,          │
│      │                                    in-process — policy file)       │
│      ├─ tool:  get_my_watchlist ────────► user_db (user_id từ JWT)        │
│      └─ adapters/ OpenAICompatAdapter tự code trên httpx (seam duy nhất) │
│      ▼                                                                    │
│  system prompt = [pack files (git)] + [briefing_core (đọc từ agent_db)]   │
└──────────────┬───────────────────────────────┬────────────────────────────┘
               ▼                               ▼
        agent_db (read-only,             user_db (chat_conversations,
        qua gateway core)                chat_messages, chat_quota)
```

Gateway core là **thư viện Python dùng chung**: web import in-process; Claude app dùng qua wrapper MCP (stdio/HTTP) bọc cùng core — một nguồn luật, hai cách đóng gói (phương án + fallback ở file 01).

---

## 3. Bản Đồ Bước & Phụ Thuộc

```
[P0 — NGOÀI repo web] ✅ HOÀN THÀNH 2026-07-12 · +2 collection 2026-07-14
  fnx05 v2 + agent_db 33 collections + Knowledge Pack v2 — as-built: agent_db_v2.md
  (verify 45 tiêu chí + probe 61/61 PASS × 5 vòng trên agent_db_test;
   CÒN LẠI: cutover production theo runbook v2 §7.1 — điều kiện của bước 6;
   history_finratios_* (2026-07-14) CHƯA vào pack/policy/probe — v2 §7.2)
        ▼
[Bước 1] Gateway — tầng truy cập dữ liệu            → 01-gateway-data-access.md
        ▼
[Bước 2] Backend agent runtime (loop + stream)      → 02-backend-agent-runtime.md
        ▼
[Bước 3] Persistence + quota + mô hình chi phí      → 03-persistence-quota-cost.md
        │    └─ thiết kế DB chi tiết + bộ nhớ cá nhân hoá → 08-database-design-memory.md
        ▼
[Bước 4] Frontend /assistant                        → 04-frontend-assistant.md
        ▼
[Bước 5] Deploy, nginx, vận hành                    → 05-deployment-nginx-ops.md
        ▼
[Bước 6] Eval + go-live + rollback                  → 07-eval-golive-rollback.md

[Xuyên suốt] Bảo mật & compliance                   → 06-security-compliance.md
[Xuyên suốt] Điểm mù + bài học hệ thống thực tế     → 09-lessons-blindspots.md
```

Thứ tự code thực tế có thể xen kẽ (FE làm song song backend từ khi contract stream chốt), nhưng **go-live bắt buộc tuần tự**: DB cutover production xong (runbook v2 §7.1) → gateway chạy log đầy đủ → eval pass → mở nhóm nhỏ.

> **Trạng thái 2026-07-16:** Bước 1 (Gateway) + Bước 2 (agent runtime) + lát cắt 3.5 + **Bước 4 (FE `/chat`)** đều **XONG**, đã trên `main`. Ngoài kế hoạch gốc đã làm thêm: **Bậc 2 hygiene** (hàm `sanitize_answer` dọn câu trả lời trước khi trả khách), **chốt model = MiniMax-M3** (wire OpenAI-compat; AnthropicCompatAdapter giữ sẵn cho tương lai — xem §5 #2/#7), tool **`db_stats`** (server tính min/đỉnh/đáy/percentile/drawdown trên chuỗi lịch sử dài — chữa lỗi MAX_ITERS; merge `613c8bf`), time-awareness phiên giao dịch. Backend **288 test PASS**, FE `tsc` 0. Route đổi `/assistant`→**`/chat`** (chi tiết lát cắt FE: [`specs/2026-07-15-chat-fe-v1-slice-design.md`](../superpowers/specs/2026-07-15-chat-fe-v1-slice-design.md)).
>
> **CÒN LẠI để go-live:** Bước 3 (persistence hội thoại + quota + kill-switch budget) · Bước 5 (deploy/nginx/env) · Bước 6 (eval + go-live) · item 9 (privacy NĐ13 + feedback 👍👎). **Việc owner (ngoài web repo):** cutover `agent_db` production.
>
> **LOẠI khỏi phạm vi (owner 2026-07-16): web search** — giữ agent đóng miền trong dữ liệu Finext, KHÔNG thêm dịch vụ trả phí bên thứ 3 (MiniMax web_search chỉ chạy MCP subprocess cục bộ, không hợp backend server-side). Mọi chỉ dẫn `web_search` trong pack đã gỡ (`system_prompt` mục 7 + `agent_db_03`/`agent_db_04`).

---

## 4. Bảng Hiện Trạng Toàn Cục — Có Gì / Thiếu Gì

### 4.1 Đã có sẵn (tận dụng, không xây lại)

| Tài sản | Ở đâu | Dùng cho |
|---------|-------|----------|
| Pattern SSE streaming production-proven (queue + heartbeat 10s + `X-Accel-Buffering`) | [`sse.py`](../../finext-fastapi/app/routers/sse.py) | Bước 2 — copy pattern, đổi queue shared → per-request |
| Nginx block SSE mẫu (no-buffer, timeout dài) | [`nginx.conf`](../../nginx/nginx.conf) | Bước 5 — copy đổi path |
| Auth JWT + refresh + `Depends(get_current_user)` + RBAC | `app/auth/` | Bước 2/3 — auth chạy TRƯỚC khi stream mở |
| `apiClient` với refresh-token flow tự động | [`apiClient.ts`](../../finext-nextjs/services/apiClient.ts) | Bước 4 — thêm `responseType: 'stream'` |
| Layering convention `routers/ → crud/ → schemas/` | `finext-fastapi/app/` | Bước 2/3 |
| Pattern lưu dữ liệu per-user (`watchlists`) trong `user_db` | `crud/watchlists` | Bước 3 — `chat_conversations`/`chat_messages` theo cùng pattern |
| Ngôn ngữ thiết kế "Ambient Signal" + `AiCommentBody` (render text AI có highlight) | `app/(main)/market-phase/components/` | Bước 4 — chat cùng ngôn ngữ FINEXT AI (style/token màu; render chat đã chốt markdown+widget — spec 07-14) |
| `OptionalAuthWrapper requireAuth` + store pattern (Zustand-like) | `components/auth/`, `hooks/` | Bước 4 |
| Motor async + `httpx` async đã trong deps backend | `pyproject.toml` | Bước 1/2 — adapter tự parse không cần dep mới |
| Spec kiến trúc runtime cũ (SSE contract 6 event, quota, persistence…) | [`2026-07-12-ai-chat-agent-architecture.md`](../superpowers/specs/2026-07-12-ai-chat-agent-architecture.md) | Nguyên liệu — phần còn dùng được đã hấp thụ vào bộ doc này |
| **`agent_db` v2 as-built HOÀN CHỈNH**: 33 collections (31 + `history_finratios_*` 2026-07-14), index sống qua mọi vòng ghi, %-points, briefing core ~320 tok, phase mirror ×6, verify 45 + probe 61/61 PASS (chưa phủ 2 collection mới) | [`agent_db_v2.md`](agent_db_v2.md) | Nguồn sự thật tầng dữ liệu |
| **Knowledge Pack v2 HOÀN CHỈNH** (`system_prompt.md` + `agent_db_01→06`, đồng bộ cùng thế hệ với DB v2) | **TRONG repo** (`finext-fastapi/app/agent/kb/`) — nguồn sự thật DUY NHẤT, sửa trực tiếp + commit (KHÔNG còn bản canonical ngoài repo) | Bước 2 §5 — server ghép vào system prompt. ⚠ pack và DB phải CÙNG THẾ HỆ (v2 §7.1.3: lệch = agent đọc sai đơn vị ×100) |

### 4.2 Chưa có (phải làm — mỗi mục trỏ tới file có phương án)

| # | Hạng mục | Ai làm | File |
|---|----------|--------|------|
| 0 | ~~`agent_db` chuẩn hoá~~ ✅ XONG (as-built v2) — **còn lại: cutover production** (probe expect → chạy fnx05 → check --prod, kèm up pack cùng lúc) | owner (ngoài repo web) | agent_db_v2 §7.1 |
| 1 | Gateway core (policy file + validate + execute + log) | dev | 01 |
| 2 | `routers/chat.py` + `agent/` package (loop, adapters, tools, prompt assembly) | dev | 02 |
| 3 | `crud/chat.py` + `schemas/chat.py` + indexes `user_db` + quota | dev | 03 |
| 4 | ✅ **XONG (2026-07-16)** — FE: `chatClient.ts` + `useChatStore` + page `/chat` + components + redesign ring + UI polish (V1 slice client-held multi-turn) | dev | 04 |
| 5 | Nginx location `/api/v1/chat/` + env vars `LLM_*`/`AGENT_*` | dev | 05 |
| 6 | Bộ eval smoke + quy trình go-live/rollback | dev + owner | 07 |
| 7 | ✅ **ĐÃ CHỐT (2026-07-16): MiniMax-M3** (wire OpenAI-compat) qua eval A/B vs DeepSeek-v4-pro; đổi bằng env, `AnthropicCompatAdapter` giữ dự phòng | owner + dev eval | 02 §6, 03 §3, 07 §5 |
| 8 | Collection `user_db` mới: chat ×3 + `agent_user_profile` (+`agent_memory_notes` v1.5) | dev | 08 |
| 9 | Consent modal NĐ 13/2023 + cập nhật `/policies/privacy` + feedback 👍👎 | dev + owner | 09 §2-3 |

---

## 5. Các Quyết Định Lớn Còn Mở (mỗi cái có phương án sẵn trong file tương ứng)

| # | Quyết định | Khuyến nghị | Fallback | File |
|---|-----------|-------------|----------|------|
| 1 | Gateway: library in-process hay MCP process riêng? | **Library-first** (0 RAM mới, 0 hop) + MCP wrapper cho Claude app | MCP server riêng qua Streamable HTTP nếu owner muốn 1 service duy nhất cho cả 2 runtime | 01 |
| 2 | Provider/model | ✅ ĐÃ CHỐT (owner): **không khoá vendor** — 1 adapter chuẩn OpenAI-compat phủ hầu hết provider (OpenAI/OpenRouter/DeepSeek/Groq/vLLM/Gemini-compat…); model cụ thể chọn bằng eval + giá, đổi bằng env | thêm adapter native riêng CHỈ khi cần tính năng độc quyền của 1 nhà (explicit cache control…) | 02 §6, 03 §3 |
| 3 | SDK hay tự code | ✅ ĐÃ CHỐT (owner): **tự code adapter bằng `httpx` sẵn có, không dùng SDK nhà cung cấp** — 0 dependency mới, 0 vendor lock | dùng SDK open-source nếu tự parse phát sinh bug dai dẳng (tiêu chí: >2 bug parse/tháng sau go-live) | 02 §6 |
| 4 | Render chat | ✅ ĐÃ CHỐT (owner 2026-07-14): markdown+bảng (`react-markdown`+`remark-gfm` — dep đã duyệt) + widget `finext-widget` JSON → whitelist component (stat_tiles/bar_list/grouped_bars CSS thuần · line = apexcharts sẵn có); KHÔNG BAO GIỜ mount HTML từ model | — | 04 §5 + [spec 07-14](../superpowers/specs/2026-07-14-agent-v1-slice-and-chat-render-design.md) |
| 5 | Tên route + nav label | **`/chat`** · "Finext AI" (owner đổi `/assistant`→`/chat` 2026-07-15) | — | 04 §2 |
| 6 | Số quota cụ thể | 60 msg/user/ngày, budget token global theo giá model | điều chỉnh sau 2 tuần chạy nhóm nhỏ | 03 §4 |
| 7 | Bộ nhớ cá nhân hoá | **Tầng 1** (profile user tự khai) ngay v1; **Tầng 2** (trích xuất sau lượt) v1.5 sau go-live | không bao giờ làm tool `memory_write` trong hội thoại (phá read-only) | 08 §4 |

---

## 6. Rủi Ro Cấp Lộ Trình (rủi ro cấp bước nằm trong từng file)

| Rủi ro | Xác suất | Tác động | Phương án xử lý |
|--------|----------|----------|-----------------|
| `agent_db` đổi schema sau khi web đã chạy | **Chắc chắn xảy ra** | Thấp — NẾU giữ đúng nguyên tắc §1 | Mọi PR web có chạm schema phải bị reject trừ policy file + pack. Điểm chạm duy nhất (`briefing_core.as_of`) có fallback. |
| Pack và DB **lệch thế hệ** khi một trong hai được cập nhật (v2 §7.3: triệu chứng = agent nói số % lệch 100 lần) | Trung bình (mỗi lần owner nâng cấp) | Cao — sai lặng lẽ số liệu | Quy trình 1 commit chung + version log lúc startup (bước 5); web dev/test vẫn dùng "pack stub" trong CI, không phụ thuộc bản pack thật |
| Ước token/chi phí lệch theo model — tokenizer mỗi nhà mỗi khác (VD Sonnet 5 +~30% so đời trước), caching mỗi nhà mỗi kiểu | Cao | Chi phí/lượt lệch tới ~2-4× giữa provider | Đo lại pack bằng tokenizer/count-tokens của ĐÚNG model đã chọn trước khi chốt budget; so provider bằng "giá có cache" chứ không phải giá niêm yết (file 03 §3) |
| Chi phí token vượt dự kiến khi user thật dùng | Trung bình | Tiền | 3 lớp: quota/user + global kill-switch fail-closed + prompt caching (bắt buộc bật). Chi tiết file 03 |
| VPS 8GB không chịu thêm tải | Thấp (thiết kế 0 process mới, LLM là outbound I/O) | Cao nếu xảy ra | Semaphore giới hạn stream đồng thời; nếu vẫn căng → Option nâng RAM hoặc tách gateway ra VPS phụ (file 05) |
| Pháp lý: agent "được khuyến nghị" + sau này thu phí | Thấp ở giai đoạn nội bộ | Rất cao nếu bán | Đứng đầu checklist trước khi bật payment: tham vấn luật sư (agent_db_v2 §7.2 "Pháp lý"). Web v1 giữ disclaimer + subordination |

---

## 6a. Kickoff — Cách Bắt Đầu Session Code (cho AI session sau)

**Nguyên tắc đọc doc (tiết kiệm context, khớp session protocol của CLAUDE.md):** mỗi session CHỈ đọc file 00 này + file của bước đang làm (+ `agent_db_v2.md` nếu bước đó chạm dữ liệu). KHÔNG đọc cả 10 file mỗi session.

**Thứ tự session đề xuất (one task per session):**

| Session | Đọc | Làm | Verify xong session |
|---|---|---|---|
| 1 | 00 + 01 + agent_db_v2 §4-5 | Gateway core: policy file + validator + executor + FixtureGateway | checklist 01 §8 (unit test validator không cần Mongo) |
| 2 | 00 + 02 | Skeleton stream: `routers/chat.py` echo giả + nginx block + `curl -N` | token nhả từng dòng qua nginx dev, heartbeat khi im lặng |
| 3 | 00 + 02 | Adapter openai_compat + loop + 3 tools (chạy với FixtureGateway + pack stub) | checklist 02 §8 |
| **3.5** | 00 + spec 07-14 | **MỐC LÁT CẮT: cắm thật** — Mongo thật + policy rút gọn + DeepSeek thật | "FPT giá bao nhiêu" ra số khớp UI Finext (spec 07-14 §3) |
| 4 | 00 + 03 + 08 | Persistence + quota + profile | checklist 03 §7 + 08 §7 (phần v1) |
| 5-6 | 00 + 04 | FE: chatClient → store → components → page + render markdown/bảng/widget (spec 07-14 §D4) | checklist 04 §7, `tsc --noEmit` = 0 |
| 7 | 00 + 05 + 06 | Env, pack sync, log hygiene, alert budget | checklist 05 §8 + 06 §4 |
| 8 | 00 + 07 | Eval + go-live vòng 1 | file 07 |

**Quyết định treo duy nhất phải chốt trước session 1:** Gateway **Option A (library in-process — khuyến nghị)** hay B (process riêng) — file 01 §3. Nếu owner không nói gì, AI mặc định làm A (B nâng cấp được sau, interface không đổi).

**Mặc định được phép tự quyết không cần hỏi:** route `/assistant` + label "Finext AI" · pack sync = copy vào image (05 §4-A) · quota 60/ngày · mọi con số env ở 05 §3. **Phải hỏi owner:** bất kỳ dependency mới nào (kể cả lib MCP) — quy ước dự án. *Đã duyệt 2026-07-14:* `react-markdown` + `remark-gfm` (spec 07-14 §D5).

**Cần từ owner trước session 3 (không chặn session 1-2):** ✅ ĐÃ CÓ 2026-07-14 — provider v1 = DeepSeek, owner tự điền vào `.env.production`: `LLM_BASE_URL=https://api.deepseek.com/v1` · `LLM_MODEL=deepseek-chat` · `LLM_API_KEY` (spec 07-14 §D2; dev/test vẫn chạy bằng echo adapter + fixture).

## 6b. NGOÀI Phạm Vi V1 (chốt để khỏi trôi scope — mỗi mục đều có lý do/đường nâng cấp trong file tương ứng)

❌ Tool GHI bất kỳ (kể cả `memory_write` trong hội thoại — 08 §4.0) · ❌ **web search** (LOẠI HẲN — owner 2026-07-16: giữ đóng miền Finext, không dịch vụ trả phí bên thứ 3) · ❌ widget `candle` + chart series dài kiểu spec-chứa-query (chart CƠ BẢN đã VÀO v1 — spec 07-14 §D4/§D8) · ✅ tool tính toán `db_stats` (min/đỉnh/đáy/percentile/drawdown trên chuỗi dài — **ĐÃ LÀM 2026-07-16** merge `613c8bf`, kéo lên sớm chữa MAX_ITERS thay vì chờ log usage) · ❌ sandbox chạy code model viết (spec 07-14 §D6) · ❌ multi-agent · ❌ semantic search/embedding (Mongo standalone không vector — 08 §4.3) · ❌ resumable stream (09 §8) · ❌ tier gating theo license (điểm cắm để sẵn — 03 §4) · ❌ answer-cache câu phổ biến (09 §7) · ❌ observability chuyên dụng Langfuse (09 §8) · ❌ auto-summarize history dài (09 §8) · ❌ thêm giá vốn vào watchlists (08 §4.1 known-gap).

## 7. Điều Kiện Go-Live Tổng (chi tiết ở file 07)

1. `agent_db` cutover production hoàn tất theo runbook [`agent_db_v2.md`](agent_db_v2.md) §7.1 (probe expect → fnx05 → check --prod; verify 45 + probe 61/61 đã PASS trên `agent_db_test`) — *việc owner, ngoài repo web*.
2. Gateway chạy với policy thật, log query đầy đủ, test chặn COLLSCAN/cap hoạt động.
3. `tsc --noEmit` = 0 lỗi FE; pytest backend pass (adapter parse, loop max-iters, quota 429).
4. Eval smoke 12+ câu pass bằng mắt owner (bộ câu ở file 07 — kế thừa và mở rộng từ spec cũ).
5. Kill-switch budget đã test thật (set budget thấp → chat trả "AI tạm nghỉ").
6. Consent modal + privacy policy cập nhật (NĐ 13/2023) + feedback 👍👎 có mặt từ ngày đầu (file 09 §2-3).
7. Mở theo 3 vòng: owner → 2-3 NĐT thân → cả nhóm.

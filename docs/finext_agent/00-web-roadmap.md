# 00 — Lộ Trình Tích Hợp Finext Agent Vào Web (Tổng Quan)

> **Bộ tài liệu này là gì:** kiến trúc triển khai AI Chat Agent trên **web Finext** (finext.vn), từ đầu đến cuối.
> Mỗi file = một bước. Mỗi bước ghi rõ: cần gì · đã có gì · chưa có gì · phương án A/B · rủi ro + cách xử lý · điều kiện hoàn thành.
> **KHÔNG cover Claude app** (owner tự làm, chỉ chia sẻ chung tầng gateway + knowledge pack).
> **Nguồn sự thật tầng dữ liệu:** [`agent_db_v2.md`](agent_db_v2.md) (as-built chính thức, 2026-07-12 — thay thế agent_db_plan cũ đã loại bỏ) — bộ doc này tham chiếu, không lặp lại, không đảo quyết định đã chốt.
> **Cập nhật hiện trạng runtime:** 2026-07-21 (đối chiếu `main`/HEAD `445c4bb`). Các đoạn có ngày 2026-07-12→20 bên dưới là nhật ký quyết định/eval tại thời điểm đó, không phải cấu hình hiện hành nếu có một snapshot mới hơn ghi đè.

---

## 1. Nguyên Tắc Kiến Trúc Số 1: Web Runtime Phải DB-Agnostic

`agent_db` **đang được owner sửa và sẽ còn đổi** (schema, đơn vị, collection mới). Vì vậy toàn bộ kiến trúc web được thiết kế theo nguyên tắc:

> **Web runtime không biết schema của `agent_db`. Nội dung DB đổi thế nào, web vẫn chạy.**

Cơ chế cụ thể để đạt được điều đó (chi tiết ở các file sau):

| # | Cơ chế | Ở đâu |
|---|--------|-------|
| 1 | Model tự tra cứu qua 3 tool dữ liệu generic (`db_find` / `db_aggregate` / `db_stats`) và nạp tài liệu sâu bằng `read_kb`; không có tool production nào pin vào một collection cụ thể | [`02-backend-agent-runtime.md`](02-backend-agent-runtime.md) |
| 2 | Luật collection nằm trong policy declarative — đổi DB thường sửa policy + pack, không sửa loop/tool schema; vì hai file nằm trong image nên vẫn phải deploy FastAPI lại | [`01-gateway-data-access.md`](01-gateway-data-access.md) |
| 3 | Kiến thức schema nằm trong **Knowledge Pack** versioned ngay trong repo (`system_prompt`, `agent_db_01→07`); server ghép 3 tài liệu resident và cho model nạp phần còn lại qua `read_kb` | [`02-backend-agent-runtime.md`](02-backend-agent-runtime.md) §5 |
| 4 | Điểm chạm schema duy nhất của web = đọc `data_briefing {type:"core"}` + field `as_of` — có fallback: thiếu doc này agent vẫn chạy (bỏ briefing, ghi chú staleness) | [`02-backend-agent-runtime.md`](02-backend-agent-runtime.md) §5.2 |
| 5 | Backend gửi **cụm danh từ tự nhiên** theo collection (fallback "dữ liệu", không lộ tên nội bộ); FE ghép động từ theo tool (**Đọc/Tổng hợp/Thống kê/Tham khảo**, tool lạ fallback "Đọc") | [`04-frontend-assistant.md`](04-frontend-assistant.md) §4 |
| 6 | `schema_version`/pack-version guard vẫn là P2, **chưa được runtime enforce**; hiện phải đồng bộ DB+policy+pack bằng quy trình deploy/smoke | agent_db_v2 §7.2 |

Hệ quả cho lộ trình: **DB v2 đã có bản as-built** (xem §3), nhưng cutover production vẫn cần owner xác nhận. Runtime loop/tool schema không phải đổi khi schema dữ liệu đổi; nếu policy hoặc Knowledge Pack đổi thì vẫn phải rebuild/redeploy image FastAPI vì hai tài sản này được bundle trong repo.

---

## 2. Kiến Trúc Đích (Web)

```
┌─ Browser ─────────────────────────────────────────────────────────────────┐
│  /chat + /chat/[id] (Next.js) — useChatStore + chatClient (POST SSE)     │
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
│      ├─ db_find / db_aggregate / db_stats ─► GATEWAY CORE in-process      │
│      ├─ read_kb ──────────────────────────► app/agent/kb (whitelist)       │
│      └─ adapters: OpenAICompat / AnthropicCompat (chọn bằng env)          │
│      ▼                                                                    │
│  system prompt = [pack files (git)] + [briefing_core (đọc từ agent_db)]   │
└──────────────┬───────────────────────────────┬────────────────────────────┘
               ▼                               ▼
        agent_db (read-only,             user_db (chat_conversations,
        qua gateway core)                chat_messages, chat_quota)
```

Gateway core hiện là **thư viện Python in-process** cho web. Một wrapper MCP (stdio/HTTP) có thể bọc cùng core cho app khác trong tương lai, nhưng wrapper đó không tồn tại trong repo này (phương án ở file 01).

---

## 3. Bản Đồ Bước & Phụ Thuộc

```
[P0 — NGOÀI repo web] ✅ HOÀN THÀNH 2026-07-12 · +2 collection 2026-07-14
  fnx05 v2 + agent_db 33 collections + Knowledge Pack v2 — as-built: agent_db_v2.md
  (verify 45 tiêu chí + probe 61/61 PASS × 5 vòng trên agent_db_test;
   CÒN LẠI: cutover production theo runbook v2 §7.1 — điều kiện của bước 6;
   history_finratios_* đã vào pack + policy web; probe pipeline cho 2 collection mới
   vẫn là việc owner cần xác nhận — v2 §7.2)
        ▼
[Bước 1] Gateway — tầng truy cập dữ liệu            → 01-gateway-data-access.md
        ▼
[Bước 2] Backend agent runtime (loop + stream)      → 02-backend-agent-runtime.md
        ▼
[Bước 3] Persistence + quota + mô hình chi phí      → 03-persistence-quota-cost.md
        │    └─ thiết kế DB chi tiết + bộ nhớ cá nhân hoá → 08-database-design-memory.md
        ▼
[Bước 4] Frontend /chat                            → 04-frontend-assistant.md
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
> **Cập nhật 2026-07-17 — tối ưu chất lượng agent (ĐÃ MERGE + PUSH `main`, HEAD `a6f3679`, đã backup GitHub):** vòng A/B (agent M3 vs Opus 4.8, single-shot 30 câu + multi-turn 3×10 lượt, ground-truth Mongo) → **diệt lỗi NGUY HIỂM có đo lường**: bịa số mọi loại (giá cổ phiếu/hàng hoá/foreign-flow/P-E — numeric-grounding guard dung sai tương đối; grounding-retry khi tools=0) · apology ảo giác (6→0) · rỗng/punt orchestration · **bỏ whitelist 18 → phân tích đủ 24 ngành** · no-data-verify (loop kĩ trước khi kết luận thiếu dữ liệu). Model **MiniMax-M3 non-thinking** (thinking=`adaptive` đã tích hợp + strip `<think>`, nhưng chậm 1.5× + over-cautious "không có dữ liệu" → **giữ `LLM_THINKING=disabled`**). Chart-decision đúng chuẩn (vẽ thưa + đúng lúc, không spam ở non-thinking). **344 pytest PASS.** Chất lượng **B+ (đủ beta có giám sát, chưa public GA)** — đã chạm trần "M3 + guard deterministic". Chi tiết vòng lặp: [`.superpowers/sdd/progress.md`](../../.superpowers/sdd/progress.md).
>
> **Cập nhật 2026-07-18 — BƯỚC 3 + CHAT FE HOÀN THIỆN (ĐÃ MERGE + PUSH `main`, HEAD `098263f`):** Bước 3 (persistence hội thoại `user_db` + quota + kill-switch) XONG; **quota REDESIGN theo TOKEN per-LICENSE** (bỏ msg/ngày+phút): cửa sổ **5h anchored + weekly**, tier theo license (MANAGER/ADMIN=unlimited · PATRON/PARTNER=advanced ×5 · còn lại=standard 500k/5h·5M tuần), kill-switch token global 24h; endpoint `GET /quota`. FE chat: tải lịch sử từ DB + lazy-load + **tiêu đề AI** (event `title`) + **ghim/đổi tên/xoá** kiểu ChatGPT + **feedback 👍👎** (event `message_saved`) + **URL riêng `/chat/[id]`** (replaceState) + **thanh thông báo limit trên ô chat** (link `/profile/ai-usage`) + tab `/profile/ai-usage` (chỉ %, ∞ cho unlimited) + tối ưu mobile (2 bong bóng góc + placeholder ngắn) + glass chuẩn + FLIP trượt xuống. **Consent pop-up BỎ** (đã đồng ý khi tạo TK) → cập nhật `/policies/privacy` mục AI. **nginx** thêm block `/api/v1/chat/` no-buffer. Backend **394 pytest PASS**, FE `tsc` 0. SSE contract mở rộng: +`title`, +`message_saved`.
>
> **CÒN LẠI để go-live:** Bước 5 (OWNER deploy: điền `LLM_*` + optional `AGENT_*`/`CHAT_*` vào `.env.production`; docker compose build+up; nginx tự render) + dev nhỏ trong repo còn (prune job `chat_quota` 90 ngày qua APScheduler · alert budget WARN 70%) · Bước 6 (eval smoke 12+ câu, owner nghiệm thu) · đo pack `count_tokens` chốt budget thật. **Việc owner (ngoài web repo):** cutover `agent_db` production. **Blocker ship THẬT = infra này, KHÔNG phải chất lượng/feature.**
>
> **Cập nhật 2026-07-20 — CHAT BUBBLE + SỬA QUOTA + EVAL THẬT (ĐÃ PUSH `main`):** (1) **Chat bubble theo ngữ cảnh trang** trên 14 trang sản phẩm — mỗi trang bơm ngữ cảnh riêng đọc từ URL, kho ~120 câu gợi ý theo trang/tab, popup mời bám nội dung trang; hội thoại lưu chung lịch sử `/chat`. Không sửa dòng nào trong 14 trang sản phẩm. (2) **Route `/market-phase` → `/phase`** (đổi dứt điểm, không redirect). (3) **Bước 6 eval smoke ĐÃ CHẠY THẬT 14 lượt** → [`eval-smoke-2026-07-20.md`](eval-smoke-2026-07-20.md). (4) Từ eval phát hiện và sửa **4 lỗi có sẵn**: đếm token bỏ sót mọi vòng gọi tool (quota + cầu dao mù) · quota tính token thô thay vì chi phí thật (nay đọc `cached_tokens`, quy đổi theo giá, đơn vị = chi phí) · so sánh datetime naive/aware làm **sập chat từ lượt thứ hai** · projection chuỗi trả dữ liệu giả âm thầm. (5) **Trần mới: 1tr/5h · 10tr/tuần** (trả phí ×5); **cầu dao global TẮT** (dùng gói token trả trước của nhà cung cấp). (6) **Cảnh báo sớm 50%/75%** hiện cho user. Đo thật: **một lượt chat ≈ 130.000 đơn vị ≈ 0,039 USD**; 10 user × 8 lượt/ngày ≈ **94 USD/tháng**. Backend **449 pytest PASS**, FE `tsc` 0.
>
> ~~**VIỆC LỚN CÒN LẠI (owner chốt làm BẢN ĐẦY ĐỦ, chưa bắt đầu):** 10 — Widget tham chiếu~~ — **ĐÃ GÁC LẠI (2026-07-20 tối), xem cảnh báo đầu [doc 10](10-widget-tham-chieu-chong-bia-so.md).** Đo lại cho thấy doc 10 sai chỗ: nguyên nhân gốc vụ bịa số HPG là **kết quả tool bị cắt `content[:12000]` giữ phần ĐẦU** — 5/9 kỳ mới nhất bị vứt trước khi model nhìn thấy, JSON hỏng giữa chừng. Model không bịa vì thiếu cơ chế cưỡng chế — nó bị bịt mắt.
>
> **Cập nhật 2026-07-20 (tối) — SỬA GỐC CẮT DỮ LIỆU + DIỆT QUIRK M3 + 2 VÒNG EVAL (ĐÃ PUSH `main`, HEAD `4a47211`):** (1) **`shrink.py` mới** — nơi duy nhất được phép bỏ dữ liệu: bỏ trọn phần tử, **giữ kỳ MỚI bỏ kỳ CŨ**, ghi chú nêu tên phần đã bỏ + cấm model tự điền số; trần kết quả tool 12k→**24k**, ngân sách tổng 30k→**40k** chia đều TRƯỚC khi chạy. (2) **Tự sửa quirk truy vấn M3 ở tầng tool**: bóc `{"$text": "<chuỗi JSON>"}`, coerce số-bọc-chuỗi theo vị trí (`$limit:"25"`, `$sort:"-1"`, `$gt:"50000"`, projection `"1"`), unmangle mảng-bẻ-dict (`{"$slice":{"item":X,"-5":""}}`). (3) **Hai cầu dao chặn bão retry**: 2 vòng toàn-fail hoặc 600k token → ép trả lời trung thực. (4) Aggregate cũng có **note field-vắng** như find; `_needs_retry` bắt **độc thoại kế hoạch** + **câu cụt hai chấm**; KB `agent_db_02` hạ `$slice` về `-52`; bỏ nhãn ngữ cảnh trang chèn trùng 2 lần (FE). **Eval:** §7 11/14 → §8 6/14 (phiên M3 xấu, lộ lớp quirk mới) → **§9 12/14, 0 bịa số, token −47,5%**. Câu HPG từng bịa số nay ĐẠT (kỳ 2026_1, số khớp DB). Hai câu còn hỏng chốt chấp nhận: Q11 variance (từ chối trung thực) · Q14 nhớ nhầm schema (hỏng sạch, không bão). **Guard "sổ số liệu" kiểu bỏ-câu đã BÁC BỎ bằng đo** (báo nhầm 20,8% số / 72% câu — đừng làm lại). Backend **507 pytest PASS**.
>
> **Snapshot runtime/config repo 2026-07-21 (hiện hành):** file `.env.production` trong workspace cấu hình `MiniMax-M3` tại `https://api.minimax.io/v1` (không phải default của code hay bằng chứng container đang deploy); wire mặc định code là `LLM_API_STYLE=openai`, `LLM_THINKING=disabled`, nhưng UI có công tắc gửi `thinking=true` cho từng lượt. Runtime có cả `OpenAICompatAdapter` và `AnthropicCompatAdapter`. `TOOL_SCHEMAS` hiện chỉ gồm **`db_find`, `db_aggregate`, `db_stats`, `read_kb`**; `get_my_watchlist` còn code handler nhưng **đã gỡ khỏi surface model**. Quota đã tăng x4 so snapshot 20/07: standard **4.000.000 đơn vị/5h + 40.000.000/tuần**, advanced ×5, MANAGER/ADMIN unlimited; đơn vị quy đổi theo giá input/cache/output. Cầu dao global mặc định **tắt** (`AGENT_DAILY_TOKEN_BUDGET=0`).
>
> ~~**CÒN LẠI để go-live (cũ 2026-07-17):** Bước 3 · Bước 5 · Bước 6 · item 9~~ — Bước 3 + item 9 ĐÃ XONG. Bước 6 (eval) đã chạy 2026-07-20.
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
| Ngôn ngữ thiết kế "Ambient Signal" + `AiCommentBody` (render text AI có highlight) | `app/(main)/phase/components/` | Bước 4 — chat cùng ngôn ngữ FINEXT AI (style/token màu; render chat đã chốt markdown+widget — spec 07-14) |
| `OptionalAuthWrapper requireAuth` + store pattern (Zustand-like) | `components/auth/`, `hooks/` | Bước 4 |
| Motor async + `httpx` async đã trong deps backend | `pyproject.toml` | Bước 1/2 — adapter tự parse không cần dep mới |
| Spec kiến trúc runtime cũ (SSE contract 6 event, quota, persistence…) | [`2026-07-12-ai-chat-agent-architecture.md`](../superpowers/specs/2026-07-12-ai-chat-agent-architecture.md) | Nguyên liệu — phần còn dùng được đã hấp thụ vào bộ doc này |
| **`agent_db` v2 as-built HOÀN CHỈNH**: 33 collections (31 + `history_finratios_*` 2026-07-14), index sống qua mọi vòng ghi, %-points, briefing core ~320 tok, phase mirror ×6, verify 45 + probe 61/61 PASS (chưa phủ 2 collection mới) | [`agent_db_v2.md`](agent_db_v2.md) | Nguồn sự thật tầng dữ liệu |
| **Knowledge Pack v2** (`system_prompt.md` + `agent_db_01→07`) | **TRONG repo** (`finext-fastapi/app/agent/kb/`) — `system_prompt`+01+02 resident; 03→07 đọc theo nhu cầu bằng `read_kb` | Bước 2 §5 — pack và DB phải cùng thế hệ |

### 4.2 Hiện trạng triển khai / phần còn lại

| # | Hạng mục | Ai làm | File |
|---|----------|--------|------|
| 0 | `agent_db` v2 as-built; web policy v2 và KB đã phủ 33 collection. **Cutover/probe production vẫn là việc owner ngoài repo web, chưa thể suy ra từ HEAD.** | owner | agent_db_v2 §7.1-7.2 |
| 1 | ✅ Gateway library in-process: policy/validator/executor/fixture/stats/log đã có | dev | 01 |
| 2 | ✅ `routers/chat.py` + loop + 2 adapter + 4-tool surface + prompt assembly/SSE đã có | dev | 02 |
| 3 | ✅ Persistence, indexes, quota per-license, cảnh báo 50/75%, trang quota đã có. Còn nợ job dọn quota 90 ngày. | dev | 03, 08 |
| 4 | ✅ `/chat`, `/chat/[id]`, lịch sử/ghim/đổi tên/xoá/feedback, widget, thinking toggle và chat bubble theo ngữ cảnh đã có | dev | 04 |
| 5 | ✅ Nginx `/api/v1/chat/` và config code đã có; **còn xác nhận deploy/curl production và alert ops** | owner + dev | 05 |
| 6 | ✅ Eval thật 2026-07-20 đã ghi lại; **owner vẫn quyết định vòng mở người dùng/production acceptance** | owner + dev | 07, eval-smoke |
| 7 | ✅ Repo `.env.production` hiện cấu hình **MiniMax-M3/OpenAI-compatible**; adapter Anthropic-compatible đã có. Deploy live cần xác nhận riêng. | owner + dev | 02 §6 |
| 8 | ✅ 3 collection chat; ❌ `agent_user_profile` và `agent_memory_notes` vẫn chỉ là thiết kế tương lai | dev | 08 |
| 9 | ✅ Privacy policy đã có mục Finext AI và feedback 👍👎 đã có. Consent popup riêng **đã bỏ có chủ đích** vì user đồng ý policy khi tạo tài khoản. | dev + owner | 04, 09 |

---

## 5. Các Quyết Định Lớn — hiện trạng và đường nâng cấp

| # | Quyết định | Khuyến nghị | Fallback | File |
|---|-----------|-------------|----------|------|
| 1 | Gateway: library in-process hay MCP process riêng? | **As-built: library in-process** (0 RAM mới, 0 hop) | MCP wrapper/service là nâng cấp tương lai; chưa có trong repo | 01 |
| 2 | Provider/model | Snapshot repo: MiniMax-M3 qua OpenAI-compatible; code không có default model/base/key và chọn wire bằng `LLM_API_STYLE` | đổi provider/model phải chạy lại eval; cả hai adapter đã hiện hữu | 02 §6, 03 §3 |
| 3 | SDK hay tự code | ✅ ĐÃ CHỐT (owner): **tự code adapter bằng `httpx` sẵn có, không dùng SDK nhà cung cấp** — 0 dependency mới, 0 vendor lock | dùng SDK open-source nếu tự parse phát sinh bug dai dẳng (tiêu chí: >2 bug parse/tháng sau go-live) | 02 §6 |
| 4 | Render chat | Markdown/GFM + fence `finext-widget`; FE whitelist **12 template ECharts/KPI** (`line`, `area`, `bar`, `bar_h`, `grouped_bar`, `pie`, `heatmap`, `scatter`, `treemap`, `radar`, `gauge`, `kpi`). Không mount raw HTML. | JSON/template lỗi → khối fallback xám | 04 §5 |
| 5 | Tên route + nav label | **`/chat`** · "Finext AI" (owner đổi `/assistant`→`/chat` 2026-07-15) | — | 04 §2 |
| 6 | Số quota cụ thể | Đơn vị quy đổi theo chi phí: standard 4M/5h + 40M/tuần; advanced ×5; MANAGER/ADMIN unlimited; global daily mặc định tắt | chỉnh bằng env | 03 §4 |
| 7 | Bộ nhớ cá nhân hoá | Chưa implement profile/memory; chỉ lưu history chat. Không có `memory_write`. | nếu làm sau này, giữ server-controlled path | 08 §4 |

---

## 6. Rủi Ro Cấp Lộ Trình (rủi ro cấp bước nằm trong từng file)

| Rủi ro | Xác suất | Tác động | Phương án xử lý |
|--------|----------|----------|-----------------|
| `agent_db` đổi schema sau khi web đã chạy | **Chắc chắn xảy ra** | Thấp — NẾU giữ đúng nguyên tắc §1 | Mọi PR web có chạm schema phải bị reject trừ policy file + pack. Điểm chạm duy nhất (`briefing_core.as_of`) có fallback. |
| Pack và DB **lệch thế hệ** khi một trong hai được cập nhật (v2 §7.3: triệu chứng = agent nói số % lệch 100 lần) | Trung bình (mỗi lần owner nâng cấp) | Cao — sai lặng lẽ số liệu | Pack thật nằm trong repo/image; context chỉ fallback stub nếu không có resident nào. Deploy DB+pack cùng thế hệ và chạy smoke. |
| Ước token/chi phí lệch theo model — tokenizer mỗi nhà mỗi khác (VD Sonnet 5 +~30% so đời trước), caching mỗi nhà mỗi kiểu | Cao | Chi phí/lượt lệch tới ~2-4× giữa provider | Đo lại pack bằng tokenizer/count-tokens của ĐÚNG model đã chọn trước khi chốt budget; so provider bằng "giá có cache" chứ không phải giá niêm yết (file 03 §3) |
| Chi phí token vượt dự kiến khi user thật dùng | Trung bình | Tiền | Quota per-license 5h/tuần đang bật; global kill-switch chỉ hoạt động khi env >0 (mặc định đang tắt); theo dõi usage/cache thật. Chi tiết file 03 |
| VPS 8GB không chịu thêm tải | Thấp (thiết kế 0 process mới, LLM là outbound I/O) | Cao nếu xảy ra | Hiện chưa có semaphore per-user; theo dõi concurrency/latency và bổ sung limit trước, chỉ cân nhắc nâng RAM hoặc tách service khi có số đo (file 02/05) |
| Pháp lý: agent "được khuyến nghị" + sau này thu phí | Thấp ở giai đoạn nội bộ | Rất cao nếu bán | Đứng đầu checklist trước khi bật payment: tham vấn luật sư (agent_db_v2 §7.2 "Pháp lý"). Web v1 giữ disclaimer + subordination |

---

## 6a. Kickoff lịch sử — các session này đã hoàn thành

> Phần này là kế hoạch triển khai ban đầu, giữ lại để truy vết. **Không dùng như checklist hiện hành.** Khi sửa runtime, đọc code ở `app/agent/`, `routers/chat.py`, `crud/chat.py`, `services/chat*.ts` và `hooks/useChatStore.ts` trước; các checklist as-built nằm trong file 01-05.

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

**Kết quả:** Gateway đã chọn **Option A (library in-process)**; không có MCP process/container riêng trong web runtime.

**Giá trị hiện hành thay cho mặc định cũ:** route `/chat` · label "Finext AI" · pack nằm trong `app/agent/kb` và được copy cùng image · quota theo đơn vị quy đổi 5h/tuần (03 §4), không còn quota 60 message/ngày. Quy ước hỏi owner trước dependency mới vẫn giữ.

**Lịch sử provider:** DeepSeek là lựa chọn lát cắt ngày 2026-07-14; cấu hình production hiện tại đã thay bằng **MiniMax-M3**. Không khôi phục các giá trị DeepSeek cũ nếu chưa chạy lại eval.

## 6b. NGOÀI Phạm Vi V1 (chốt để khỏi trôi scope — mỗi mục đều có lý do/đường nâng cấp trong file tương ứng)

❌ Tool GHI bất kỳ (kể cả `memory_write`) · ❌ **web search** · ❌ widget tham chiếu/resolver của doc 10 (đang gác) · ❌ sandbox chạy code model viết · ❌ semantic search/embedding · ❌ resumable stream · ❌ answer-cache · ❌ Langfuse/LangSmith · ❌ auto-summarize history dài · ❌ profile/memory cá nhân hoá · ❌ tích hợp watchlist vào tool surface. ✅ Đã có `db_stats`, quota tier theo license và 12 template widget ECharts/KPI.

## 7. Điều Kiện Go-Live Tổng (chi tiết ở file 07)

1. `agent_db` cutover production hoàn tất theo runbook [`agent_db_v2.md`](agent_db_v2.md) §7.1 (probe expect → fnx05 → check --prod; verify 45 + probe 61/61 đã PASS trên `agent_db_test`) — *việc owner, ngoài repo web*.
2. Gateway chạy với policy thật, log query đầy đủ, test chặn COLLSCAN/cap hoạt động.
3. `tsc --noEmit` = 0 lỗi FE; pytest backend pass (adapter parse, loop max-iters, quota 429).
4. Eval smoke 12+ câu pass bằng mắt owner (bộ câu ở file 07 — kế thừa và mở rộng từ spec cũ).
5. Nếu owner bật `AGENT_DAILY_TOKEN_BUDGET` (>0), phải test mức thấp → request tiếp theo bị 503; mặc định hiện tại 0 nghĩa là tắt.
6. Privacy policy mục Finext AI + feedback 👍👎 có mặt; consent riêng được xử lý ở bước đăng ký, không có modal `/chat`.
7. Mở theo 3 vòng: owner → 2-3 NĐT thân → cả nhóm.

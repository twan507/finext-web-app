# Agent v1 — Quyết định thực thi: lát cắt dọc, DeepSeek, render giàu trong chat

> **Ngày:** 2026-07-14 · **Trạng thái:** owner đã duyệt trong phiên brainstorm.
> **Vai trò:** bổ sung (không thay thế) bộ [`docs/finext_agent/00→09`](../../finext_agent/00-web-roadmap.md) — ghi các quyết định
> chốt trước khi code. Chỗ nào file này khác doc cũ → file này thắng; `00` §5/§6a/§6b và `04` §5-7 đã sửa theo cùng commit.

## 1. Mục tiêu & phạm vi v1

Trợ lý chat "Finext AI" trên web: đọc `agent_db` qua gateway, trả lời tiếng Việt, render **markdown + bảng +
biểu đồ trực tiếp trong chat**. Không sandbox, không tool ghi, không multi-agent.

## 2. Quyết định đã chốt

### D1 — Thứ tự thực thi: lát cắt dọc trước, làm dày sau

**Mốc phải đạt sớm nhất:** hỏi *"FPT giá bao nhiêu"* → agent tự query Mongo **thật** qua gateway → DeepSeek trả
lời có số **khớp UI Finext**.

Thứ tự: gateway core (policy **rút gọn** vài collection: `stock_snapshot`, `stock_info`, `data_briefing`) →
skeleton SSE echo → adapter + loop + 3 tools (FixtureGateway + pack stub) → **cắm thật** (Mongo + DeepSeek) =
mốc lát cắt → persistence/quota → policy đầy đủ 33 collection → FE.

Lý do: rủi ro lớn nhất đã biết trước là parse tool-call stream của provider (02 §6) — giết nó trước; persistence
là phần dễ đoán nhất và schema message phụ thuộc *ngược* vào những gì loop nhả ra; Mongo không cần "chuẩn bị
trước" (collection tự sinh khi ghi lần đầu). Ánh xạ vào bảng session 00 §6a = chèn **session 3.5**.

### D2 — Provider v1: DeepSeek, qua đúng `OpenAICompatAdapter` đã thiết kế

- Env trong `.env.production` (đã `.gitignore`, docker-compose `env_file` nạp cho service `fastapi`):
  `LLM_BASE_URL=https://api.deepseek.com/v1` · `LLM_MODEL=deepseek-chat` · `LLM_API_KEY=***`
- **Cấm** prefix `NEXT_PUBLIC_` cho key (nhúng vào bundle browser).
- `deepseek-chat` hỗ trợ tool-calling; context caching tự động phía DeepSeek → `cache_hint` = no-op, đúng 02 §6.
- Thiết kế adapter KHÔNG đổi: 1 adapter OpenAI-compat tự viết trên `httpx`. Fixture bytes **thật** của DeepSeek
  (tool-call arguments về theo mảnh, `finish_reason`, `usage`) là bộ test đầu tiên; thêm provider thứ 2 khi tiện.
- Chi phí runaway trước khi có quota đã bị chặn 3 lớp: DeepSeek prepaid (cháy tối đa = số dư) + `MAX_ITERS=8`
  + `max_tokens`/lượt.

### D3 — FE tự code bằng MUI, không ghép framework chat

Không dùng Vercel AI SDK / assistant-ui / LobeChat / open-webui: contract SSE tự thiết kế đã đóng băng (02 §3)
trong khi framework muốn sở hữu wire format; app là MUI còn các bộ kia Tailwind/shadcn (2 hệ styling, vỡ theme);
auth JWT cookie + refresh flow riêng. Cấu trúc FE giữ nguyên 04 §2. Tham khảo các repo đó để học UX pattern,
không bê code.

### D4 — Render giàu trong chat: markdown + bảng + widget spec (thay 04 §5 Option A cũ)

Nguyên tắc: **model tả Ý (JSON spec), FE vẽ HÌNH (component whitelist). Không bao giờ mount HTML do model
viết** — XSS (tin tức là chỗ prompt injection sống), token đắt (~2-3k token/widget HTML so ~200 token/spec),
và đẹp không ổn định.

- **Tầng 1 — markdown:** `react-markdown` + `remark-gfm` (bảng GFM). Mặc định thư viện KHÔNG render raw HTML
  → luật "cấm HTML từ model" được enforce miễn phí.
- **Tầng 2 — widget:** WidgetRenderer bắt fenced block:

  ````
  ```finext-widget
  {"v": 1, "type": "bar_list", "title": "Điểm dòng tiền tuần từng mã", "items": [...]}
  ```
  ````

  | type v1 | Giới hạn | Render bằng |
  |---|---|---|
  | `stat_tiles` | ≤6 ô (số to + nhãn + phụ đề, tô xanh/đỏ theo dấu) | MUI Box thuần — 0 dep |
  | `bar_list` | ≤20 bar ngang, giá trị ± (dương xanh/âm đỏ) | CSS thuần — 0 dep |
  | `grouped_bars` | ≤20 nhóm × ≤3 series | CSS thuần — 0 dep |
  | `line` | ≤60 điểm/series, ≤3 series | `apexcharts` **sẵn có**, dynamic import |

  `candle` → v1.1.

- **Luật render:** JSON hỏng / `type` lạ / `v` ≠ 1 → fallback code block xám, không crash. Vượt cap điểm → cắt
  + ghi chú nhỏ. Màu tăng/giảm + format số VN theo convention app. Fence chưa đóng khi đang stream → skeleton
  "Đang dựng biểu đồ…", widget chỉ mount khi fence đóng. Markdown re-parse khi stream → throttle ~100ms + memo
  các block đã hoàn chỉnh (thay thế R1 cũ 04 §6).
- **Contract SSE 02 §3 KHÔNG đổi** — widget đi in-band trong `token` text. Backend không biết widget tồn tại
  (không parse, không validate). Widget spec là hợp đồng **PACK ↔ FE**.
- Data nằm thẳng trong spec (model chép từ tool results — cap 60 điểm giữ token rẻ). Chart series dài (1-5 năm,
  260+ điểm tuần từ `history_finratios_*`...) **không** bắt model chép: v1.1 làm *spec-chứa-query* để FE tự
  fetch REST — backlog.

### D5 — Dependency mới đã duyệt (owner, 2026-07-14)

`react-markdown` + `remark-gfm`. Ngoài ra **0 dep mới**: chart dùng `apexcharts`/`lightweight-charts` sẵn có,
SSE parser tự viết ~70 dòng (04 §3), adapter tự viết trên `httpx` (02 §6).

### D6 — Không sandbox chạy code

Thống kê 2 tầng: write-time (fnx05 pre-compute: trend, rank_pct, TTM, cap-weighted...) + read-time
(`db_aggregate`: `$group/$avg/$stdDevSamp/$sort`... — policy trói `maxTimeMS` 5s, cấm COLLSCAN, cấm
`$where/$function`). Model bị pack cấm tự làm số học (02 §7 R4). Nếu log sau go-live cho thấy nhu cầu vượt
aggregation → macro tool `compute_stats` server-side **tham số hoá** (mình viết hàm + whitelist phép tính, model
chỉ truyền tham số; 02 §7 R2 — quyết định SAU khi có số đo). Sandbox model-tự-viết-code: không làm trên VPS 8GB
share DB; nhu cầu backtest nặng (nếu có thật) → spec riêng thuê sandbox ngoài.

### D7 — Pack (ngoài repo, việc owner)

- Lát cắt + CI: **pack stub** (02 §5.1), thêm vào stub 1 đoạn widget syntax tối giản để test render.
- Pack **thật** trước go-live phải thêm: (a) mục widget syntax + khi nào dùng loại nào (so sánh nhiều mã →
  `bar_list`; 3-4 con số nhấn mạnh → `stat_tiles`; chuỗi thời gian ngắn → `line`); (b) luật format markdown;
  (c) 2 collection `history_finratios_*` (agent_db_v2 §4.1/§7.2 — đơn vị tỷ đồng, cadence TUẦN). Pack và DB
  cùng thế hệ như cũ.

### D8 — Backlog v1.1

`candle` widget · chart series dài (spec-chứa-query, FE fetch REST) · macro tool `compute_stats` · các mục ❌
cũ của 00 §6b giữ nguyên (riêng dòng "vẽ chart trong chat" đã gỡ — chart cơ bản vào v1).

## 3. Điều kiện nghiệm thu

**Mốc lát cắt (D1):**
- `curl -N` với DeepSeek thật: `meta` → `token`... → (`tool_start`/`tool_end`) → `done`; heartbeat khi im lặng.
- "FPT giá bao nhiêu?" → giá khớp `stock_snapshot` trong Mongo.
- pytest: adapter parse fixture bytes DeepSeek (tool-call args mảnh) · loop max-iters · truncate tool result ·
  cancellation lưu partial · retry chỉ khi chưa nhả token.

**Bước 4 FE (bổ sung vào checklist 04 §7):**
- Bảng GFM render đúng theme dark/light; 4 widget type render từ fixture message; JSON hỏng → fallback xám;
  fence chưa đóng → skeleton; `tsc --noEmit` = 0.

## 4. File đã sửa cùng spec này

- `00-web-roadmap.md`: §5 dòng 4 (chốt render) · §6a (session 3.5, dep đã duyệt, key DeepSeek đã có) · §6b (gỡ
  "vẽ chart trong chat", thêm backlog D8).
- `04-frontend-assistant.md`: §5 viết lại theo D4 · §6 R1 cập nhật + R6 mới · §7 checklist widget.

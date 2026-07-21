# Spec — Tối Ưu `agent_db` Cho AI Chat Agent

> **SUPERSEDED BY AS-BUILT:** Thiết kế DB v2 đã được phản ánh trong policy gateway và runtime KB. Dùng **docs/finext_agent/agent_db_v2.md** làm nguồn hiện tại; trạng thái cutover/probe dữ liệu production vẫn phải xác nhận theo runbook, còn checklist “chờ owner” bên dưới là lịch sử.

> **Mục đích file này:** work-order để owner tối ưu `agent_db` (pipeline phía owner) TRƯỚC khi code agent.
> Doc kiến trúc runtime (viết sau khi DB xong): [`2026-07-12-ai-chat-agent-architecture.md`](2026-07-12-ai-chat-agent-architecture.md)
>
> **Trạng thái:** 📋 Chờ owner thực hiện. Số liệu đo thực tế từ Mongo dev ngày 2026-07-12.
> **✅ 3 quyết định §6 đã chốt (owner, 2026-07-12):** mirror `market_phase` vào v1 · watchlist v1 (runtime, không đổi DB) · `is_processed` = cờ nội bộ, agent bỏ qua. §6 giờ là spec, không còn câu hỏi mở.
> **Bối cảnh:** sản phẩm nội bộ cho nhóm NĐT thân thiết. Agent chỉ đọc `agent_db` — KHÔNG đọc `stock_db`/`ref_db` trực tiếp.

---

## 0. TL;DR — Checklist ưu tiên

| # | Việc | Ưu tiên | Tác động | Mục |
|---|------|---------|----------|-----|
| 1 | Tạo indexes (script sẵn) | **P0** | Point-read thay vì COLLSCAN 331MB; bảo vệ WT cache của Mongo đang share RAM với MSSQL | §3.1 |
| 2 | Làm tròn số tại pipeline | **P0** | Cắt ~25-35% token mọi payload, miễn phí | §3.2 |
| 3 | Đổi `*_pct` từ phân số → điểm phần trăm | **P0** | Diệt rủi ro "sai lặng lẽ" lớn nhất: LLM đọc nhầm đơn vị | §3.3 |
| 4 | Tách `data_briefing` → `briefing_core` gọn (≤ ~1.5k tok) | **P0** | Context thường trực rẻ; bỏ duplication với collection gốc | §3.4 |
| 5 | `stock_finstats`/`industry_finstats` → dạng curated gọn | **P1** | 44.7KB → mục tiêu ≤8KB/mã; tool trả lời được câu tài chính | §4.1 |
| 6 | Indexes + policy cho news | **P1** | Truy tin theo mã nhanh; content bị cap | §4.2 |
| 7 | Pipeline hygiene: staging + `renameCollection`, thứ tự ghi, omit null | **P2** | Chống torn-read khi agent đọc lúc pipeline đang ghi | §5 |
| 8 | Mirror `market_phase` (1 doc) vào `agent_db` | **P1** | Agent trả lời được "đang pha nào" — câu hỏi số 1 của NĐT | §6.1 |

Làm xong P0 là đủ điều kiện bắt đầu code agent (doc 2). P1 cần xong trước khi bật tool tương ứng (tài chính, tin tức, phase). P2 làm lúc nào cũng được nhưng nên trước khi go-live. Watchlist & `is_processed` đã chốt nhưng **không cần việc DB nào** (§6.2, §6.3).

---

## 1. Nguyên Tắc Thiết Kế DB Cho LLM Agent (khác gì DB cho app)

DB cho app tối ưu cho **màn hình** (FE cần gì render nấy). DB cho agent tối ưu cho **cửa sổ context** — mọi byte đọc ra đều đi qua LLM và tính tiền theo token. 5 nguyên tắc:

1. **Token là chi phí số 1.** 1 KB JSON ≈ 250 token (heuristic ~4 chars/token cho JSON-số; văn xuôi tiếng Việt tệ hơn, ~2-3 chars/token). Mọi quyết định schema đều quy về câu hỏi "bao nhiêu token mỗi lần tool đọc?".
2. **Đơn vị phải tự mô tả, không được mơ hồ.** LLM không đoán được `0.0106` là 1.06% hay 0.0106%. Field nào cũng phải có quy ước đơn vị cố định, ghi trong data dictionary (§3.3) và nhúng vào system prompt.
3. **Phân loại > số thô.** `agent_db` đã làm ĐÚNG điều này với `technical_zone`/`trend` (dạng nhãn thay vì OHLC thô) — LLM suy luận trên nhãn tốt hơn nhiều so với tự tính từ số. Giữ triết lý này cho mọi collection mới.
4. **Bề mặt dữ liệu = bề mặt UI (bounded disclosure).** `agent_db` chỉ được chứa field mà UI Finext ĐÃ hiển thị cho user. Đây là guarantee cứng: agent không thể lộ thứ nó không có (bí mật thuật toán phase, cột volatility...), bất kể prompt injection hay user hỏi khéo đến đâu. Guardrail bằng prompt là lớp phụ; bounded data là lớp chính.
5. **Agent chỉ đọc; mọi lần đọc phải là point-read có index.** Không aggregation nặng lúc runtime, không COLLSCAN. Cái gì cần tính toán → pipeline tính sẵn lúc EOD, hoặc tool tính bằng Python trên vài KB đã lọc.

---

## 2. Hiện Trạng (đo 2026-07-12, Mongo dev)

`agent_db` = 72.8 MB, 26 collections. So sánh: `stock_db` 641 MB, `ref_db` 5.5 MB.

### 2.1 Điểm mạnh (giữ nguyên, đừng phá)

- **Bộ ba zoom `snapshot` / `recent` (20 phiên) / `history` (~1.626 phiên)** lặp nhất quán ở 4 tầng: market → group → industry → stock. Agent cần độ sâu nào gọi đúng tầng đó.
- **`technical_zone` + `trend` dạng phân loại** — đã "dịch số thành ngữ nghĩa" sẵn.
- **`industry_info` / `stock_info` có text mô tả** (overview, value_chain, risks, drivers) — nguyên liệu tốt cho câu trả lời định tính.
- **`news_*_feed.tickers` là mảng mã** — khoá truy xuất tin theo mã rẻ, không cần embedding/vector search (Mongo standalone không có Atlas Vector Search — may là không cần).

### 2.2 Bảng đo kích thước (1 doc tiêu biểu)

| Collection | Docs | 1 doc | ~Token | Đánh giá cho agent |
|---|---|---|---|---|
| `market_snapshot` | 1 | 2.3 KB | ~584 | ✅ vừa |
| `market_recent` | 1 | 7.0 KB | ~1.800 | ✅ chấp nhận |
| `market_nntd` | 1 | 0.7 KB | ~167 | ✅ |
| `market_itd` | 1 | nhỏ | — | ⚠️ tool chỉ trả summary |
| `group_snapshot` | 6 | ~0.9 KB | ~230 | ✅ |
| `group_recent` | 6 | ~7 KB | ~1.800 | ✅ |
| `industry_snapshot` | 24 | 0.9 KB | ~224 | ✅ |
| `industry_recent` | 24 | ~7 KB | ~1.800 | ✅ |
| `industry_info` | 24 | 3.8 KB | ~960 | ✅ |
| `industry_finstats` | 24 | 26.3 KB | ~6.700 | ⚠️ cần curated (§4.1) |
| `stock_snapshot` | 679 | 2.2 KB | ~565 | ✅ |
| `stock_recent` | 679 | 8.2 KB | ~2.100 | ✅ trần cho "dữ liệu thô theo ngày" |
| `stock_info` | 679 | 2.6 KB | ~669 | ✅ |
| `stock_finstats` | 664 | 44.7 KB | ~11.400 | ⛔ cần curated (§4.1) |
| `stock_itd` | 679 | 14.2 KB | ~3.641 | ⚠️ tool chỉ trả summary |
| `stock_nntd` | 679 | nhỏ | — | ✅ |
| `history_stock` | 679 | **488 KB** | **~125.000** | ⛔⛔ agent KHÔNG BAO GIỜ nhận thô |
| `history_index` | 1 | **491.8 KB** | **~126.000** | ⛔⛔ như trên |
| `history_industry` | 24 | ~490 KB | ~125.000 | ⛔⛔ như trên |
| `news_today_feed` / `_content` | 3+3 | 0.6-1.8 KB | ~150-450 | ✅ |
| `news_history_feed` / `_content` | 1.100+1.100 | ~1-2 KB | ~250-500 | ✅ (cần index §4.2) |
| `other_data` | 74 | ~0.3 KB | ~80 | ✅ |
| `stock_highlight` | 30 | ~3 KB | ~750 | ✅ |
| `data_briefing` | 6 | 0.7—35.6 KB | tổng ~22.400 | ⛔ tái cấu trúc (§3.4) |

### 2.3 Ba vấn đề chính

1. **Không có index nào ngoài `_id`** — toàn bộ 26 collection. `history_stock.findOne({ticker})` = COLLSCAN 679 × 488 KB ≈ **331 MB** qua WiredTiger cache cho MỘT câu hỏi. Trên VPS mà Mongo (~1.5-2G) share RAM với MSSQL (1.5G), một COLLSCAN như vậy evict sạch hot pages của `user_db`/`stock_db` → chậm lây cả app chính.
2. **Số full-precision float64** (di sản pandas): `1840.3299560546875` (19 ký tự thay vì 7), `-0.00028713025143689563` (23 ký tự thay vì 5). Phí ~25-35% token trên mọi payload.
3. **`data_briefing` bị duplication + quá to:** type `industry_snapshot` trong briefing = copy nguyên 24 doc của collection `industry_snapshot`; tương tự `market_snapshot`, `other_data`. Tổng 6 doc ≈ 22.4k token — nếu dùng làm context thường trực thì vừa đắt vừa thừa (phần lớn lượt chat không cần bảng 24 ngành + 74 hàng hoá + 4 báo cáo).

---

## 3. P0 — Phải Làm Trước Khi Code Agent

### 3.1 Indexes

Chạy 1 lần trên `agent_db` (mongosh). Idempotent — chạy lại không sao:

```javascript
use agent_db

// Tra cứu theo mã — dùng nhiều nhất
db.stock_snapshot.createIndex({ ticker: 1 }, { unique: true })
db.stock_recent.createIndex({ ticker: 1 }, { unique: true })
db.stock_info.createIndex({ ticker: 1 }, { unique: true })
db.stock_finstats.createIndex({ ticker: 1 }, { unique: true })
db.stock_itd.createIndex({ ticker: 1 }, { unique: true })
db.stock_nntd.createIndex({ ticker: 1 }, { unique: true })
db.history_stock.createIndex({ ticker: 1 }, { unique: true })   // quan trọng nhất (doc 488KB)

// Tra cứu theo ngành
db.industry_snapshot.createIndex({ industry_name: 1 }, { unique: true })
db.industry_recent.createIndex({ industry_name: 1 }, { unique: true })
db.industry_info.createIndex({ industry_name: 1 }, { unique: true })
db.industry_finstats.createIndex({ industry_name: 1 }, { unique: true })
db.history_industry.createIndex({ industry_name: 1 }, { unique: true })

// Nhóm
db.group_snapshot.createIndex({ group_name: 1 }, { unique: true })
db.group_recent.createIndex({ group_name: 1 }, { unique: true })

// Tin tức — multikey trên tickers + sort theo thời gian
db.news_history_feed.createIndex({ tickers: 1, created_at: -1 })
db.news_history_feed.createIndex({ created_at: -1 })
db.news_history_feed.createIndex({ article_slug: 1 }, { unique: true })
db.news_history_content.createIndex({ article_slug: 1 }, { unique: true })

// Khác
db.other_data.createIndex({ group: 1, category: 1 })
db.other_data.createIndex({ name: 1 })
db.stock_highlight.createIndex({ type: 1, name: 1 })
db.data_briefing.createIndex({ type: 1 }, { unique: true })
```

Ghi chú:
- `unique: true` trên các key 1-doc-per-entity còn giúp **bắt bug pipeline** (ghi trùng mã → lỗi ngay thay vì data đôi).
- ⚠️ Nếu pipeline hiện tại ghi kiểu **drop rồi insert lại**, index sẽ mất theo collection khi drop. Hai cách xử lý: (a) pipeline dùng staging + `renameCollection` (xem §5) và tạo index trên staging trước khi rename, hoặc (b) pipeline `deleteMany({})` + `insertMany` thay vì drop — index sống sót. Chọn 1 trong 2, nếu không thì index chỉ tồn tại đến lần chạy pipeline kế tiếp.
- Tổng dung lượng index ước < 5 MB — không đáng kể với RAM.

### 3.2 Làm tròn số tại pipeline

Quy tắc (áp cho mọi collection agent đọc — snapshot/recent/info/nntd/briefing/highlight/other_data; `history_*` khuyến khích nhưng không bắt buộc vì agent không đọc thô):

| Nhóm field | Quy tắc | Trước → Sau |
|---|---|---|
| Giá cổ phiếu (nghìn đồng), điểm index, MA/fibo/pivot | 2 số lẻ | `20.77374839782715` → `20.77` |
| `diff` (thay đổi tuyệt đối) | 2 số lẻ | `1840.3299560546875` → `1840.33` |
| Mọi `*_pct`, `pct_change` | 2 số lẻ **sau khi đổi đơn vị §3.3** | `-0.00028713025143689563` → `-0.03` |
| `volume`, share counts, room | integer, giữ nguyên | — |
| `trading_value`, GTGD | đổi về **tỷ đồng**, 1-2 số lẻ | — |
| score/strength (money_flow_score...) | 2 số lẻ | — |
| datetime intraday | cắt về phút, bỏ `.000Z` | `2026-07-10T15:00:00.000Z` → `2026-07-10T15:00` |
| field null | **omit hẳn** khỏi doc (không ghi `null`) | — |

Ước tính tác động: `stock_snapshot` 2.2 KB → ~1.5 KB; `stock_recent` 8.2 KB → ~5.5 KB; `briefing_core` (§3.4) xuống dưới 1.5k token thoải mái. Toàn bộ là việc thêm `round()` ở bước ghi của pipeline — không đổi logic gì khác.

### 3.3 Đơn vị phần trăm: phân số → điểm phần trăm ⚠️ QUAN TRỌNG NHẤT

**Vấn đề:** hiện `w_pct: -0.010560601001404102` nghĩa là −1.056%. LLM nhìn thấy `-0.0106` sẽ có xác suất thật đọc thành "−0.01%". Đây là kiểu lỗi **sai lặng lẽ** — không crash, không exception, chỉ là câu trả lời sai số liệu cho người đang cầm tiền. Không guardrail nào bắt được nó một cách đáng tin.

**Quy ước chốt cho `agent_db`:** mọi field mang nghĩa phần trăm lưu **điểm phần trăm** (percent-points), 2 số lẻ. `w_pct: -1.06` = giảm 1.06%. System prompt của agent sẽ khai báo: *"mọi field `*_pct` là %"*.

Các field cần đổi giá trị (danh sách theo những gì đã quan sát — owner rà thêm khi sửa pipeline):

- `pct_change`, `w_pct`, `m_pct`, `q_pct`, `y_pct` (mọi collection có `change`)
- `stock_info`: `freeFloatRate`, `statePercentage`, `foreignerPercentage`, `maximumForeignPercentage`, `majorHoldings` — đang là phân số (0.85 = 85%)
- `breadth` nếu là tỷ lệ (kiểm tra: nếu là **số lượng mã** thì giữ int)

**Khuyến khích (không bắt buộc):** nhân tiện rename các field snake_case lệch chuẩn cho nhất quán suffix — `freeFloatRate` → `free_float_pct`, `statePercentage` → `state_pct`, `foreignerPercentage` → `foreign_pct`, `majorHoldings` → `major_holdings_pct`. An toàn vì `agent_db` chỉ có 1 consumer là agent (chưa code). Nếu rename thì làm NGAY BÂY GIỜ — sau khi agent code xong thì đắt hơn nhiều.

### 3.4 Tách `data_briefing` → `briefing_core`

**Vấn đề hiện tại:** 6 doc `data_briefing` ≈ 22.4k token, trong đó `industry_snapshot`/`other_data`/`news_report` chiếm ~20k và chỉ thỉnh thoảng liên quan tới câu hỏi. Đồng thời chúng duplicate nguyên các collection gốc.

**Thiết kế mới — 2 tầng:**

**Tầng 1 — `briefing_core` (context thường trực):** 1 doc duy nhất, nhúng vào system prompt MỌI lượt chat. Ngân sách cứng: **≤ 1.500 token** (sau làm tròn §3.2 + đổi đơn vị §3.3 sẽ dư dả). Đề xuất shape (số minh hoạ):

```jsonc
// db.data_briefing — doc type "core", pipeline ghi CUỐI CÙNG (commit marker, §5)
{
  "type": "core",
  "as_of": "2026-07-10",            // ngày EOD của toàn bộ agent_db
  "market": {
    "index": "VNINDEX",
    "close": 1840.33, "diff": 12.45, "pct_change": 0.68,
    "volume_strength": 1.24,
    "breadth": { "in": 215, "out": 148, "neu": 62 },
    "trend": { "w": "up", "m": "up", "q": "sideway", "y": "up" },
    "zone": "vung_khang_cu"          // technical_zone.overall
  },
  "phase": { "label": "TRANSITION", "exposure_pct": 45 },
  // ^ headline từ market_phase (§6.1) — chi tiết agent lấy qua tool.
  //   market_phase là P1: nếu CHƯA mirror thì omit field này, agent vẫn chạy bình thường.
  "money_flow": {                    // từ market_nntd, tỷ đồng
    "nn_latest": -320.5, "nn_week": -1250.3,
    "td_latest": 150.2,  "td_week": 480.9
  },
  "groups": [                        // 6 dòng, mỗi dòng 1 nhóm vốn hoá / loại
    { "name": "LargeCaps", "pct_change": 0.72, "money_flow_day": 1.8 }
    // ...×6
  ],
  "top_moves": {                     // từ stock_highlight, chỉ mã + %
    "gain": [ { "t": "BVH", "pct": 3.41 } /* ×5 */ ],
    "loss": [ { "t": "TCX", "pct": -2.87 } /* ×5 */ ]
  }
}
```

**Tầng 2 — mọi thứ còn lại là tool targets:** agent gọi tool khi cần → tool đọc collection gốc (`industry_snapshot` 24 doc, `other_data` theo `group`, `news_*`...). Các doc `data_briefing` type cũ (`market_snapshot`, `industry_snapshot`, `other_data`...) **xoá bỏ** — thay bằng đọc collection gốc, hết duplication.

Riêng type `news_report` (4 báo cáo tổng hợp, ~9.1k tok): giữ thành collection riêng hoặc doc riêng — tool `get_daily_report` đọc khi user hỏi "báo cáo hôm nay nói gì". Không nằm trong core.

**Vì sao ngân sách 1.5k quan trọng:** context thường trực bị gửi lại MỌI lượt. 1.5k tok/lượt × hội thoại 10 lượt = 15k tok chỉ cho briefing — chấp nhận được, và với prompt caching (nếu provider hỗ trợ) gần như miễn phí sau lượt đầu. Bản 22.4k thì gấp 15 lần thế.

---

## 4. P1 — Nên Làm Trước Khi Bật Tool Tương Ứng

### 4.1 `stock_finstats` / `industry_finstats` → dạng curated

Hiện `stock_finstats` 44.7 KB/mã (~11.4k tok) vì chứa **toàn bộ** báo cáo tài chính quarterly + yearly với `vi_name` + `en_name` mỗi dòng. Agent trả lời "FPT kinh doanh thế nào" chỉ cần ~15 chỉ tiêu chủ chốt × 8 quý.

Đề xuất schema mới (thay thế hoặc thêm collection `stock_finstats_agent` — owner chọn; nếu `stock_finstats` không consumer nào khác thì thay thẳng):

```jsonc
{
  "ticker": "FPT",
  "ticker_name": "CTCP FPT",
  "industry": "Công nghệ Viễn thông",
  "type": "SXKD",                    // giữ — bank/chứng khoán/BH có bộ chỉ tiêu khác
  "as_of": "2026-Q2",
  "valuation": {                     // từ valuation_ratios, bỏ en_name, short key
    "marketcap_ty": 121031.4, "pe": 21.5, "pb": 5.8, "ps": 3.9,
    "ev_ebitda": 14.2, "div_yield_pct": 1.9
    // ... ≤9 chỉ số như hiện tại
  },
  "quarterly": [                     // 8 quý gần nhất, MỖI QUÝ 1 DÒNG PHẲNG
    { "q": "2026Q2", "revenue_ty": 16750.2, "gross_profit_ty": 6890.1,
      "net_profit_ty": 2310.5, "gross_margin_pct": 41.1, "net_margin_pct": 13.8,
      "eps": 1356, "roe_pct": 28.4, "debt_equity": 0.62 }
    // ×8
  ],
  "yearly": [ /* 5 năm, cùng shape */ ]
}
```

- Bỏ `en_name` hoàn toàn (agent nói tiếng Việt). Key ngắn tiếng Anh chuẩn ngành + suffix đơn vị (`_ty` = tỷ đồng, `_pct` = %).
- Bộ chỉ tiêu theo `type`: SXKD như trên; NH thay bằng NIM, CIR, NPL, credit growth...; CK/BH bộ riêng. Owner là người hiểu data — chốt danh sách ≤15 chỉ tiêu/loại.
- Mục tiêu: **≤ 8 KB (~2k tok)/mã**. `industry_finstats` xử lý y hệt.
- Lưu ý coverage: `stock_finstats` 664 doc vs `stock_info` 679 → 15 mã thiếu finstats. Tool phải trả "không có dữ liệu tài chính cho mã này" thay vì lỗi.

### 4.2 News

- Index như §3.1 (`tickers + created_at`, `article_slug`).
- **Policy content:** tool đọc `news_*_content.plain_content` cap tại **~4.000 ký tự** (cắt + ghi chú "[đã cắt]"). Đa số bài dưới ngưỡng này.
- `news_history_feed` 1.100 doc là **rolling window bao lâu?** Nếu pipeline không tự prune, thêm bước xoá bài > 90 ngày (hoặc TTL index trên `created_at` nếu đổi sang kiểu Date — hiện là string ISO, TTL không chạy trên string. Prune bằng pipeline là đơn giản nhất).
- `is_processed` — ✅ chốt 2026-07-12: **cờ nội bộ pipeline, agent bỏ qua** (tool news không đọc, không filter theo field này). Nếu sau này bước xử lý sinh field mới (VD `summary`, `sentiment`) thì bổ sung vào tool news như extension — không đổi thiết kế.

### 4.3 `*_itd` — không đổi DB, chỉ ràng buộc tool

Giữ nguyên collection. Ràng buộc phía agent (ghi vào doc 2): tool intraday **không bao giờ trả mảng bars thô** (56 bars ≈ 3.6k tok/mã) — chỉ trả summary tính bằng Python: `{open, high, low, last, pct_change, volume_vs_avg20}`. Nếu v1 muốn tối giản: bỏ hẳn intraday khỏi scope (sản phẩm đang là EOD), thêm sau.

---

## 5. P2 — Vệ Sinh Pipeline (chống torn-read)

Khi agent go-live, sẽ có lúc user chat ĐÚNG LÚC pipeline EOD đang ghi. Nếu pipeline ghi kiểu drop-rồi-insert từng collection, agent có thể đọc được trạng thái nửa vời (market mới, stock cũ) hoặc collection rỗng.

Khuyến nghị:

1. **Staging + rename:** pipeline ghi vào `<name>__staging`, tạo index trên staging, xong thì `db.<name>__staging.renameCollection("<name>", true /* dropTarget */)`. Rename là atomic per-collection → không bao giờ có collection rỗng/nửa vời.
2. **Thứ tự ghi:** các collection lá trước (stock → industry → group → market → news → mirror `market_phase` §6.1), **`briefing_core` ghi CUỐI CÙNG** — sau cả `market_phase`, vì briefing chứa headline phase. Vì mọi lượt chat đều đọc `briefing_core.as_of` đầu tiên, nó thành **commit marker tự nhiên**: nếu `as_of` đã là ngày mới thì mọi collection khác chắc chắn đã ghi xong.
3. **Cross-check nhẹ phía agent (doc 2 sẽ làm):** tool đọc collection nào có `snapshot_date`/`as_of` lệch với `briefing_core.as_of` thì đính kèm cảnh báo staleness vào kết quả.
4. Omit null + trim datetime như §3.2.

---

## 6. Dữ Liệu Bổ Sung — ✅ ĐÃ CHỐT (owner, 2026-07-12)

### 6.1 `market_phase` — ✅ CHỐT: mirror trong v1 (việc P1)

`agent_db` hiện **không có** dữ liệu phase — trong khi "thị trường đang ở pha nào?" gần như chắc chắn là câu hỏi số 1 của nhóm NĐT (đây là tính năng chủ lực của Finext). Không có nó, agent mù đúng chỗ sáng nhất của sản phẩm.

**Spec đã chốt:** mirror một tập AN TOÀN từ `stock_db` sang `agent_db` theo nguyên tắc §1.4 (chỉ field UI đã hiển thị). Gộp thành **1 doc duy nhất** cho agent đọc 1 phát. Pipeline phase ghi doc này mỗi EOD, **trước** `briefing_core` (thứ tự §5):

```jsonc
// agent_db.market_phase — 1 doc, pipeline phase ghi sau mỗi EOD
{
  "as_of": "2026-07-10",
  "current": { "phase": "TRANSITION", "exposure_pct": 45, "intensity": 0.32 },
  "history": [ { "date": "2026-06-10", "phase": "UPTREND" } /* ×60 phiên */ ],
  "indicators": {                    // 7 chỉ số như AdvancedPanel đang hiển thị
    "breadth_slow": 0.41, "breadth_blend": -0.12, "breadth_aux": 0.08,
    "conf_dir": 0.7, "conf_flat": 0.2, "corr60": 0.35, "px_ret20_pct": 4.2
  },
  "comments": {                      // 4 đoạn phase_comment — text UI đã public
    "market": "...", "condition": "...", "structure": "...", "risk": "..."
  }
}
```

Ước ~3-5 KB (~1k tok) tuỳ độ dài comment. **Để sau (không v1):** `phase_basket`/`phase_rank`/`phase_trading` (danh mục PAID) — nhạy hơn về bí mật thuật toán + kéo theo gating theo license trong chat; làm khi có nhu cầu thật.

### 6.2 Watchlist — ✅ CHỐT: trong v1, KHÔNG copy vào `agent_db`

Watchlist là dữ liệu **per-user, thay đổi realtime** — copy vào `agent_db` (EOD, dùng chung) là sai chỗ về cả nhịp cập nhật lẫn quyền riêng tư. Cách đã chốt: tool `get_my_watchlist` đọc thẳng `user_db.watchlists` lúc runtime, **user_id lấy từ JWT** (không bao giờ là tham số cho model), rồi join điểm sang `stock_snapshot` từng mã (indexed point-reads). **Không việc gì phải làm ở phía DB** — thiết kế tool nằm ở doc 2 §4.5.

### 6.3 `is_processed` — ✅ CHỐT: cờ nội bộ pipeline, agent BỎ QUA

Tool news không đọc, không filter theo field này (chi tiết §4.2). Nếu sau này pipeline xử lý sinh field mới (`summary`, `sentiment`...) → thêm vào tool news như extension, không đổi thiết kế.

---

## 7. Script Kiểm Tra Sau Tối Ưu

Chạy mongosh sau khi pipeline sửa xong — tất cả phải PASS trước khi bắt đầu doc 2:

```javascript
use agent_db

// 1. Index tồn tại trên các collection chính
["stock_snapshot","stock_recent","history_stock","industry_snapshot",
 "news_history_feed","data_briefing"].forEach(c => {
  const ix = db.getCollection(c).getIndexes().map(i => i.name).filter(n => n !== "_id_")
  print(c.padEnd(22) + (ix.length ? "✅ " + ix.join(", ") : "❌ KHÔNG CÓ INDEX"))
})

// 2. Point-read dùng index (IXSCAN, không COLLSCAN)
const plan = db.history_stock.find({ticker:"FPT"}).explain("queryPlanner")
print("history_stock plan: " + JSON.stringify(plan.queryPlanner.winningPlan.stage ||
      plan.queryPlanner.winningPlan.inputStage.stage))   // kỳ vọng có IXSCAN

// 3. briefing_core tồn tại + ngân sách token
const core = db.data_briefing.findOne({type:"core"})
if (!core) print("❌ chưa có briefing_core")
else {
  const kb = JSON.stringify(core).length / 1024
  print("briefing_core: " + kb.toFixed(1) + " KB ≈ " + Math.round(kb*250) + " tok " +
        (kb < 6 ? "✅" : "❌ vượt ngân sách ~1.5k tok"))
}

// 3b. market_phase (P1) — tồn tại + as_of khớp briefing
const mp = db.market_phase.findOne({})
print("market_phase: " + (!mp ? "⚠️ chưa mirror (P1 — cần trước khi bật tool get_market_phase)"
      : (core && mp.as_of === core.as_of ? "✅ as_of khớp briefing" : "⚠️ as_of lệch: " + mp.as_of)))

// 4. Đơn vị %: đã là percent-points chưa (heuristic: |w_pct| của VNINDEX thường > 0.05)
const ms = db.market_snapshot.findOne({})
print("w_pct sample = " + ms.change.w_pct + "  → " +
      (Math.abs(ms.change.w_pct) > 0.05 ? "✅ có vẻ là %-points" : "⚠️ nghi vẫn là phân số"))

// 5. Làm tròn: không còn số 15+ ký tự trong snapshot
const raw = JSON.stringify(db.stock_snapshot.findOne({ticker:"FPT"}))
print("số dài nhất trong stock_snapshot: " +
      ((raw.match(/\d+\.\d{7,}/g) || []).length === 0 ? "✅ sạch" : "❌ còn full-precision: " +
       (raw.match(/\d+\.\d{7,}/g) || []).slice(0,3).join(", ")))
```

---

## 8. Tiêu Chí Hoàn Thành (DB sẵn sàng cho doc 2)

- [ ] Script §7 pass toàn bộ (index, IXSCAN, briefing_core ≤ ngân sách, %-points, hết full-precision).
- [ ] Pipeline giữ index sống sót qua lần chạy EOD kế tiếp (kiểm lại sau 1 ngày).
- [x] ~~Chốt 3 câu §6~~ — đã chốt 2026-07-12: mirror `market_phase` (schema §6.1) · watchlist v1 = có (runtime, không đổi DB) · `is_processed` = cờ nội bộ, agent bỏ qua.
- [ ] `market_phase` được pipeline ghi mỗi EOD, `as_of` khớp `briefing_core` (script §7 mục 3b). *(P1 — cần trước khi bật tool `get_market_phase`, không chặn việc bắt đầu code.)*
- [ ] Chốt danh sách chỉ tiêu finstats curated theo `type` (SXKD/NH/CK/BH) — §4.1.
- [ ] Data dictionary đơn vị chốt: giá & index = nghìn đồng / điểm, 2 lẻ · KL = cổ phiếu (int) · GTGD = tỷ đồng · `*_pct` = điểm phần trăm 2 lẻ · date = ISO `YYYY-MM-DD`. (Bảng này sẽ nhúng nguyên văn vào system prompt của agent.)

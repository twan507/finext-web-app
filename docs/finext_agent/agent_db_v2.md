# `agent_db` v2 — Mô tả as-built + Runbook (phía pipeline/owner)

> **Vai trò file:** tài liệu CHÍNH phía owner về `agent_db` sau đợt nâng cấp v2 (2026-07-12): kiến trúc, cơ chế
> pipeline, quy ước dữ liệu, inventory collection/index, công cụ validate, runbook cutover, và roadmap còn lại.
> **Phía AGENT đọc bộ khác:** `system_prompt.md` + `agent_db_01→07` trong `finext-fastapi/app/agent/kb/` — file này KHÔNG nạp cho agent.
> Thay thế `00_optimization_plan.md` (work-order v2 — đã hoàn thành nhiệm vụ và xoá 2026-07-12; xem git history).
>
> **Changelog 2026-07-14:** +2 collection lịch sử định giá (31 → **33**) — `history_finratios_stock`, `history_finratios_industry`. Chi tiết §4.1 và đơn vị §3.
> **Đối chiếu web runtime 2026-07-21:** pack + gateway policy v2 đã phủ hai collection này; policy ép filter/`$slice`, cấm aggregate, cap 200KB và whitelist field `db_stats`. Probe/verify pipeline bổ sung cho hai collection vẫn là việc owner cần xác nhận ngoài repo web.

## 1. Tổng quan

`agent_db` là database Mongo **chỉ-đọc đối với agent chat**, được `fnx05_agent.ipynb` build liên tục từ
`stock_db`/`ref_db` (và mirror từ các bảng `phase_*` do fnx10/fnx11 serve). **33 collection, ~285MB+ dataSize**
(khối `history_*` chiếm phần lớn dung lượng).

Trước 2026-07-14, DB chỉ có định giá của **phiên hiện tại** (`stock_finstats.valuation_ratios` /
`industry_finstats.valuation_ratios`) — không có chuỗi theo thời gian. Hai collection `history_finratios_*` lấp
khoảng trống đó (§4.1).

Nguyên tắc thiết kế (chốt qua phỏng vấn owner 2026-07-12):
1. **Sự kiện làm ở write-time, phán đoán làm ở read-time** — đơn vị/làm tròn/hình dạng do pipeline chuẩn hoá MỘT lần;
   cách diễn giải nằm ở Knowledge Pack.
2. **Bound bí mật, guard ký hiệu** — công thức/trọng số model, `vol60`/`score`, tiêu chí xếp hạng KHÔNG BAO GIỜ
   vào `agent_db`; ký hiệu hiển thị (zone, vsi, 7 chỉ số phase) nằm trong DB và được K-hygiene của pack dịch khi output.
3. **Đơn vị tự mô tả** — suffix quy định thang đo (bảng §3).
4. **Point-read có index** — mọi khoá tra cứu có index unique; không COLLSCAN trên collection lớn.
5. Agent khách được khuyến nghị (khách quan + disclaimer) nhưng **subordinate theo phase/exposure**; hiệu suất 2 tầng
   (FROZEN vs cửa sổ ngắn gross) — luật nằm trong `system_prompt` + `agent_db_06`.

## 2. Cơ chế pipeline (fnx05 v2)

- **Writer `overwrite_mongo_collection_json(collection, docs, ndigits=2, sanitize=True)`** (cell 1):
  - `_sanitize` đệ quy, trả bản SAO: numpy→python · NaN/NaT/None → **omit field** · key `*_pct`/`pct_change`
    (giá trị nguồn là phân số) → **×100 điểm %** · round `ndigits` · float nguyên (≤2^53) → int · int >int64 → float.
  - `ndigits` theo collection: mặc định 2 · `*_finstats` + `other_data` + `phase_basket` = 4 · `phase_perf` = 6.
  - Pattern ghi: insert vào `temp_<name>` → **tạo index trên temp** (bảng `AGENT_DB_INDEXES`) → rename atomic
    (dropTarget) → drop `old_`. Index vì thế sống qua MỌI vòng ghi (fnx05 chạy `continuous`).
- **Thứ tự ghi:** lá (stock → industry → group → market → history *(gồm `history_finratios_*`)* → news → other) → **phase mirror** → drop
  `stock_highlight` (mồ côi) → **`data_briefing` ghi CUỐI** ⇒ `core.as_of` = commit marker ("mọi collection đã
  xong vòng này"). Agent đọc `core` đầu phiên là biết mốc dữ liệu.
- **Phase mirror:** đọc `stock_db.phase_daily/phase_comment*/phase_basket/phase_rank/phase_trading/phase_industry/phase_perf`
  (đã sanitize sẵn ở serve layer — không có `vol60`/`score`). Phase là EOD đã chốt → **`as_of` riêng**, được phép trễ
  hơn snapshot 1 phiên trong giờ giao dịch. Nguồn thiếu/rỗng → **giữ bản mirror cũ**.
- Chi phí: ~95–112s/vòng (đo 5 lần trên Mongo dev).

## 3. Quy ước đơn vị (bản nhúng cho agent = `system_prompt` mục 4)

| Suffix/field | Thang | Ghi chú |
|---|---|---|
| `*_pct`, `pct_change` | **điểm %**, 2 lẻ | `w_pct: -1.06` = −1.06% |
| `industry/market_rank_pct` | percentile 0–100 | `90` = top 10% |
| `*_trend` | 0..1 | ngoại lệ có chủ đích (ngưỡng 04 §B calibrate thang này) |
| `exposure`/`market_exposure` | 0..2.0 | >1 = margin |
| `held`/`book`/`avg_weight` | tỷ trọng 0..1 | — |
| `ret_1d_1x` | thập phân | để compound; ghi 6 lẻ |
| ratio finstats (bộ cũ) | thập phân, 4 lẻ | đổi khi làm curated (§7.2) |
| ratio `history_finratios_*` (`pe pb ps pcf ev_ebitda peg`) | **số lần** — đọc thẳng, KHÔNG ×100 | `pe: 8.9` = 8,9 lần · `eps`/`bvps` = đồng/cp |
| tiền trong `history_finratios_*` (`marketcap` `revenue_ttm` `profit_ttm`) | **tỷ đồng** | ⚠ KHÔNG chia 10⁹ — khác BCTC trong `stock_finstats` (đơn vị đồng) |
| `other_data.value` | theo `unit` | 4 lẻ (lãi suất 0.045 = 4.5%) |
| tiền | tỷ đồng (GTGD/NNTD/vốn hoá) · BCTC = đồng | — |
| ngày | `YYYY-MM-DD` · intraday string `YYYY-MM-DDTHH:MM` | — |
| thiếu dữ liệu | field **omit** (không null, không 0) | NNTD thiếu → omit block; `latest.date` = ngày dữ liệu THẬT |

## 4. Inventory 33 collection

| Khối | Collection (khoá) | Nguồn | Ghi chú |
|---|---|---|---|
| Stock ×6 | `stock_info` `stock_snapshot` `stock_recent` `stock_finstats` `stock_nntd` `stock_itd` (`ticker`) | today/history_stock, finstats/finratios, nntd_stock, itd_stock | info đã rename 5 field sở hữu `*_pct`; itd datetime string phút |
| Industry ×4 | `industry_info/snapshot/recent/finstats` (`industry_name`) | today/history_index + trend, finstats_industry | info = 24 bài kiến thức ngành viết tay (cell 21) |
| Group ×2 | `group_snapshot/recent` (`group_name`) | today/history_index + trend | 6 nhóm |
| Market ×4 | `market_snapshot/recent/nntd/itd` (`index`) | today_index (VNINDEX) + FNXINDEX (breadth/trend), nntd_index, itd_index | breadth/trend = rổ FNXINDEX; `market_recent` = `{index, series[{date,price,trend}]}` |
| History ×3 | `history_stock/industry/index` (khoá tương ứng) | history_* full | series ASC (cũ→mới), `$slice:-N` = N phiên mới |
| **Finratios history ×2 (mới 2026-07-14)** | `history_finratios_stock` (`ticker`, ~680 doc) · `history_finratios_industry` (`industry_name`, 25 doc) | stock_db | Lịch sử định giá, series ASC. **Điểm theo TUẦN, không phải phiên** (~340 điểm/doc) ⇒ `$slice:-N` = **N tuần**. Bẫy đơn vị + look-ahead: **§4.1** |
| News ×4 | `news_today_feed/content`, `news_history_feed/content` (`article_slug`/`report_slug`) | news_daily (rolling 1000) + news_report (100) | feed có **`link` bài gốc** (v2); report không có bài gốc; unique index PARTIAL |
| Other | `other_data` (`name`, `group+category`) | latest_other_ticker | 74 chỉ số, value+unit giữ gốc |
| Briefing | `data_briefing` (`type`) | tổng hợp trong fnx05 | 2 doc: `core` (~320 tok, phase headline, top_moves tự aggregate) + `news_report` |
| **Phase ×6 (mới)** | `market_phase` · `market_phase_history` (`date`) · `phase_basket` (`product`) · `phase_trading` (`ticker/product/status`) · `phase_industry` · `phase_perf` (`product+date`) | stock_db.phase_* | 1 doc pha+7 chỉ số+comment · 1.620 phiên · 3 doc rổ (nhúng rank+comment) · 1.263 lệnh backtest · 12 ngành+60 phiên · ret ngày 1.0x + FNX |

Đã bỏ so với v1: `stock_highlight` (mồ côi, drop mỗi vòng) · 4 block clone trong `data_briefing` (~22.4k tok duplication).

### 4.1 `history_finratios_*` — lịch sử định giá (mới 2026-07-14)

**`history_finratios_stock`** — 1 doc/mã (~680 doc), khoá `ticker`:

```json
{ "ticker": "HPG", "ticker_name": "CTCP Tập đoàn Hòa Phát",
  "industry": "Kim loại công nghiệp", "type": "SXKD",
  "series": [
    { "date": "2026-07-14", "period": "2026_1",
      "marketcap": 187856, "pe": 8.9, "pb": 1.34, "ps": 1.08, "pcf": 47.3, "ev_ebitda": 8.3,
      "eps": 2499, "bvps": 16556, "peg": 5.27,
      "revenue_ttm": 173695, "profit_ttm": 21103,
      "outstandingShare": 8442964520, "free_float_pct": 55, "state_pct": 0,
      "foreign_pct": 21.6, "foreignerRoom": 2102139896,
      "max_foreign_pct": 49, "major_holdings_pct": 32.7 } ] }
```

`period` = kỳ BCTC làm **mẫu số** cho mọi ratio tại điểm đó.

**`history_finratios_industry`** — 25 doc, khoá `industry_name`: 24 ngành + 1 doc `"Toàn bộ thị trường"` (tổng hợp
toàn bộ 24 ngành — **không phải một ngành**; đừng đưa vào bảng so sánh/xếp hạng ngành).

```json
{ "industry_name": "Tài chính ngân hàng", "type": "NGANHANG",
  "series": [ { "date": "2026-07-14", "n_stocks": 29, "marketcap": 2712055,
                "pe": 9.33, "pb": 1.45, "ps": 2.1, "eps": 3200, "bvps": 21000,
                "peg": 0.9, "revenue_ttm": 180000, "profit_ttm": 95000 } ] }
```

Khác bản mã: **không có `period`**, **có `n_stocks`**. Ratio ngành là **cap-weighted** (∑vốn hoá ÷ ∑lợi nhuận),
KHÔNG phải trung bình cộng P/E các mã.

**Field omit theo `type` — có chủ đích, không phải thiếu dữ liệu:** NGANHANG/BAOHIEM không có `pcf`, `ev_ebitda` ·
CHUNGKHOAN không có `ev_ebitda` (khái niệm nợ vay/dòng tiền của các nhóm này khác).

**Truy vấn:** `series` sort **TĂNG dần** theo ngày (như `history_*` cũ). Doc lớn (~340 điểm/mã) → **luôn** filter
khoá + projection/`$slice`.
> ⚠ **Điểm dữ liệu theo TUẦN, không phải phiên** (phiên đầu mỗi tuần + phiên hôm nay):
> `$slice: -52` = **1 năm** · `-156` = **3 năm** · `-260` = **5 năm**.
> (Nhầm sang thang phiên: `-60` tưởng ~3 tháng, thực ra hơn 1 năm.)

**Đơn vị** (bảng §3): `pe pb ps pcf ev_ebitda peg` = **số lần**, đọc thẳng, KHÔNG nhân 100 · `marketcap`
`revenue_ttm` `profit_ttm` = **tỷ đồng** (⚠ KHÔNG chia 10⁹ — khác BCTC trong `stock_finstats` vốn là đồng) ·
`eps` `bvps` = đồng/cổ phiếu · `*_pct` (sở hữu) = điểm %, đọc thẳng.

**Phủ dữ liệu & đặc tính bắt buộc biết (pack phải dạy agent — §7.2):**
- Phủ **2021 → nay** (~340 điểm tuần). Năm 2020 chỉ có `marketcap`, mọi ratio bị omit (thiếu BCTC 2019 làm mẫu số)
  ⇒ **field vắng mặt = chưa có dữ liệu, không phải 0**.
- Ratio tại mỗi điểm = **giá của tuần đó ÷ BCTC gần nhất đã có** (`period`). Giá đổi mỗi tuần, mẫu số chỉ đổi khi có
  BCTC mới ⇒ P/E chạy theo giá trong khi EPS nhảy bậc thang — **đúng thiết kế**, không phải lỗi dữ liệu.
- **2021–2023 chỉ có BCTC NĂM** → `eps`/`bvps` đứng yên suốt cả năm. Từ **2024** mới có BCTC quý (TTM).
- ⚠ **Look-ahead 1–2 tháng:** BCTC được gán vào **ngày kết thúc kỳ** (31/12, 31/03…) chứ không phải ngày công bố →
  tại tuần đó thị trường chưa biết số ấy. **KHÔNG dùng trực tiếp làm tín hiệu backtest.**
- ⚠ **`n_stocks` có survivorship bias:** đếm theo phân loại ngành *hiện tại*, gần như đứng im suốt lịch sử → không
  phản ánh cỡ mẫu tại thời điểm quá khứ.
- Mỗi điểm có sẵn **cả `marketcap` lẫn `eps`** ⇒ tách được biến động P/E thành phần *giá* và phần *lợi nhuận*
  ("P/E tăng vì giá lên hay vì lãi giảm?").

## 5. Index (tạo trên temp mỗi vòng — danh sách đầy đủ = `AGENT_DB_INDEXES` cell 1)

Unique theo khoá: mọi collection stock/industry/group/history — gồm `history_finratios_stock.ticker` và
`history_finratios_industry.industry_name` (doc lớn ⇒ bắt buộc unique index, nguyên tắc §1.4)
+ `data_briefing.type` + `market_phase_history.date`
+ `phase_basket.product` + `phase_perf.(product,date)`. News: `(tickers, created_at desc)` + `created_at desc` +
partial-unique `article_slug`/`report_slug` (feed trộn 2 loại doc). `phase_trading`: `ticker` · `(product,ticker)` ·
`status`. `other_data`: `(group,category)` + `name`. Collection 1-vài-doc không cần index.

## 6. Validate — công cụ + trạng thái đã đạt

| Công cụ | Chạy | Kiểm gì |
|---|---|---|
| `probes/agent_db/probe_validate.py` | `expect` (TRƯỚC khi chạy fnx05, tính expected độc lập từ stock_db) → chạy fnx05 → `check [--prod]` | 61 assertion: giá/%/score 5 mã, rename ×100, breadth FNXINDEX, top_gain tính lại, other_data, news counts + `link` + content nguyên vẹn, phase label/exposure/held_days/counts, `held=book×exposure` từng mã, itd khớp nguồn |
| `scratchpad/verify_agent_db.py` (session 2026-07-12; nội dung tương đương §9 plan cũ) | sau mỗi lần sửa pipeline | 45 tiêu chí: index sống, IXSCAN, briefing ≤ ngân sách, hết full-precision, thang đơn vị, phase mirror hợp lệ, không temp_/old_ |

Trạng thái: **5 vòng chạy thật vào `agent_db_test` — verify 45 PASS mỗi vòng, probe 61/61 PASS, 20 cross-check
số học nguồn↔mirror khớp tuyệt đối.** `agent_db_test` còn trên Mongo dev để đối chiếu (drop khi không cần).

Con số trên là trạng thái của 31 collection (2026-07-12); 2 collection `history_finratios_*` thêm sau, assertion
tương ứng bổ sung khi cần (§7.2).

## 7. Runbook

**7.1 Cutover production (một lần):**
1. Commit các file đã đổi (fnx05 + 8 docs + probes/).
2. `python probes/agent_db/probe_validate.py expect` → chạy fnx05 (tay hoặc để app theo lịch) → `... check --prod`.
3. Deploy web pack **cùng thế hệ DB**: `app/agent/kb/system_prompt.md` + `agent_db_01→07` đi cùng image FastAPI. Nếu còn vận hành Claude app riêng, đồng bộ bộ tương ứng theo quy trình của app đó.
   ⚠ Pack cũ + DB mới (hoặc ngược lại) = agent có thể đọc sai đơn vị 100 lần.
4. Kiểm phiên chat đầu: hỏi "thị trường đang pha nào" (phải đọc từ `market_phase`), "FPT tuần này ±bao nhiêu %"
   (số phải khớp UI Finext).

**7.2 Việc còn lại (không chặn dùng nội bộ):**
- ✅ **Pack + policy cho `history_finratios_*` đã hoàn tất trong web repo:** schema/đơn vị/cadence/look-ahead có trong KB; policy v2 có hai entry `size:large`, require key+series slice, `max_slice:520`, `max_response_kb:200`, `allow_aggregate:false`, `stats_fields` cho ratio.
- ⏳ **Probe/verify pipeline cho hai collection:** tài liệu 2026-07-12 chỉ xác nhận 45 + 61/61 trên 31 collection; cần owner ghi bằng chứng bổ sung nếu đã chạy.
- ✅ **Gateway web đã có** dưới dạng library in-process (không phải MCP service): whitelist/projection/operator guards/maxTimeMS/cap/log/fixture/stats. `GATEWAY_EXPLAIN_MODE` default off, bật on mới reject COLLSCAN. MCP wrapper dùng chung cho app ngoài web **chưa có trong repo này**.
- **Finstats curated** ≤8KB/mã: bỏ `en_name`, key ngắn + suffix (`_ty`/`_pct` điểm %), ~15 chỉ tiêu/type
  (SXKD/NGANHANG/CHUNGKHOAN/BAOHIEM — owner chốt danh sách), 8 quý + 5 năm; thay thẳng collection cũ + sửa pack
  (`01` cảnh báo thập phân, `02` §4.5/§6, `04` §D0, `system_prompt` mục 4).
- **P2 vệ sinh:** field `basis: "FNXINDEX"` cho breadth/trend · bóc `phase_glossary.py` dùng chung fnx11+KB ·
  check `schema_version`/model version · sửa cảnh báo t5 lỗi thời trong `phase_calculation/01_methodology`
  (code thật causal — đã xác minh fnx01:643/297, fnx02:411/181) · dọn `temp_*/old_*` khi crash · cân nhắc khối tĩnh
  (history/finstats/info/news_history) chỉ ghi 1 lần/ngày để giảm I/O.
- **Pháp lý (trước khi THU PHÍ):** khuyến nghị đầu tư có phí ở VN — tham vấn luật sư (cờ đỏ doc 08 §6.8).

**7.3 Sự cố thường gặp:**
- Agent nói số % lệch 100 lần → pack và DB đang lệch version (xem 7.1.3).
- Agent báo vốn hoá "0,0002 tỷ" hoặc coi `$slice:-60` là 60 phiên (~3 tháng) khi đọc `history_finratios_*`
  → pack chưa dạy §4.1 (tiền = **tỷ đồng**, điểm = **TUẦN**).
- Agent nói mã ngân hàng "thiếu `ev_ebitda`/`pcf`" → field omit **có chủ đích** theo `type`, không phải lỗi pipeline.
- Query phase trả rỗng → fnx10/fnx11 chưa chạy phiên đó; mirror giữ bản cũ, so `market_phase.as_of` với `core.as_of`.
- `temp_*`/`old_*` xuất hiện → fnx05 crash giữa vòng; vòng kế tự đè; agent không đọc (whitelist).
- Index biến mất → chỉ xảy ra nếu ai đó sửa writer bỏ bước create-on-temp; chạy verify để bắt.

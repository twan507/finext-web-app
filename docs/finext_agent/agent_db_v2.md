# `agent_db` v2 — Mô tả as-built + Runbook (phía pipeline/owner)

> **Vai trò file:** tài liệu CHÍNH phía owner về `agent_db` sau đợt nâng cấp v2 (2026-07-12): kiến trúc, cơ chế
> pipeline, quy ước dữ liệu, inventory collection/index, công cụ validate, runbook cutover, và roadmap còn lại.
> **Phía AGENT đọc bộ khác:** `system_prompt.md` (luật resident) + `agent_db_01→06` (KB) — file này KHÔNG up cho agent.
> Thay thế `00_optimization_plan.md` (work-order v2 — đã hoàn thành nhiệm vụ và xoá 2026-07-12; xem git history).

## 1. Tổng quan

`agent_db` là database Mongo **chỉ-đọc đối với agent chat**, được `fnx05_agent.ipynb` build liên tục từ
`stock_db`/`ref_db` (và mirror từ các bảng `phase_*` do fnx10/fnx11 serve). **31 collection, ~285MB dataSize.**

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
- **Thứ tự ghi:** lá (stock → industry → group → market → history → news → other) → **phase mirror** → drop
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
| `other_data.value` | theo `unit` | 4 lẻ (lãi suất 0.045 = 4.5%) |
| tiền | tỷ đồng (GTGD/NNTD/vốn hoá) · BCTC = đồng | — |
| ngày | `YYYY-MM-DD` · intraday string `YYYY-MM-DDTHH:MM` | — |
| thiếu dữ liệu | field **omit** (không null, không 0) | NNTD thiếu → omit block; `latest.date` = ngày dữ liệu THẬT |

## 4. Inventory 31 collection

| Khối | Collection (khoá) | Nguồn | Ghi chú |
|---|---|---|---|
| Stock ×6 | `stock_info` `stock_snapshot` `stock_recent` `stock_finstats` `stock_nntd` `stock_itd` (`ticker`) | today/history_stock, finstats/finratios, nntd_stock, itd_stock | info đã rename 5 field sở hữu `*_pct`; itd datetime string phút |
| Industry ×4 | `industry_info/snapshot/recent/finstats` (`industry_name`) | today/history_index + trend, finstats_industry | info = 24 bài kiến thức ngành viết tay (cell 21) |
| Group ×2 | `group_snapshot/recent` (`group_name`) | today/history_index + trend | 6 nhóm |
| Market ×4 | `market_snapshot/recent/nntd/itd` (`index`) | today_index (VNINDEX) + FNXINDEX (breadth/trend), nntd_index, itd_index | breadth/trend = rổ FNXINDEX; `market_recent` = `{index, series[{date,price,trend}]}` |
| History ×3 | `history_stock/industry/index` (khoá tương ứng) | history_* full | series ASC (cũ→mới), `$slice:-N` = N phiên mới |
| News ×4 | `news_today_feed/content`, `news_history_feed/content` (`article_slug`/`report_slug`) | news_daily (rolling 1000) + news_report (100) | feed có **`link` bài gốc** (v2); report không có bài gốc; unique index PARTIAL |
| Other | `other_data` (`name`, `group+category`) | latest_other_ticker | 74 chỉ số, value+unit giữ gốc |
| Briefing | `data_briefing` (`type`) | tổng hợp trong fnx05 | 2 doc: `core` (~320 tok, phase headline, top_moves tự aggregate) + `news_report` |
| **Phase ×6 (mới)** | `market_phase` · `market_phase_history` (`date`) · `phase_basket` (`product`) · `phase_trading` (`ticker/product/status`) · `phase_industry` · `phase_perf` (`product+date`) | stock_db.phase_* | 1 doc pha+7 chỉ số+comment · 1.620 phiên · 3 doc rổ (nhúng rank+comment) · 1.263 lệnh backtest · 12 ngành+60 phiên · ret ngày 1.0x + FNX |

Đã bỏ so với v1: `stock_highlight` (mồ côi, drop mỗi vòng) · 4 block clone trong `data_briefing` (~22.4k tok duplication).

## 5. Index (tạo trên temp mỗi vòng — danh sách đầy đủ = `AGENT_DB_INDEXES` cell 1)

Unique theo khoá: mọi collection stock/industry/group/history + `data_briefing.type` + `market_phase_history.date`
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

## 7. Runbook

**7.1 Cutover production (một lần):**
1. Commit các file đã đổi (fnx05 + 8 docs + probes/).
2. `python probes/agent_db/probe_validate.py expect` → chạy fnx05 (tay hoặc để app theo lịch) → `... check --prod`.
3. Up pack lên Claude app **CÙNG LÚC**: `system_prompt.md` → custom instructions; `agent_db_01→06` → project files.
   ⚠ Pack cũ + DB mới (hoặc ngược lại) = agent đọc sai đơn vị 100 lần.
4. Kiểm phiên chat đầu: hỏi "thị trường đang pha nào" (phải đọc từ `market_phase`), "FPT tuần này ±bao nhiêu %"
   (số phải khớp UI Finext).

**7.2 Việc còn lại (không chặn dùng nội bộ):**
- **Gateway MCP** (trước khi mở cho nhóm NĐT) — contract: whitelist collection · bắt buộc projection · explain→từ chối
  COLLSCAN trên collection lớn · `history_*`/`*_itd` ép khoá+`$slice` · cap ~50KB/response · cấm `$lookup/$out/$merge/$where/$function` ·
  `maxTimeMS` 5s · log toàn bộ · điểm cắm tier (v1 allow-all). Dùng chung Claude app (MCP) + web Finext (service).
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
- Query phase trả rỗng → fnx10/fnx11 chưa chạy phiên đó; mirror giữ bản cũ, so `market_phase.as_of` với `core.as_of`.
- `temp_*`/`old_*` xuất hiện → fnx05 crash giữa vòng; vòng kế tự đè; agent không đọc (whitelist).
- Index biến mất → chỉ xảy ra nếu ai đó sửa writer bỏ bước create-on-temp; chạy verify để bắt.

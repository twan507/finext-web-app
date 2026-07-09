# 08 — Page "Giai đoạn thị trường" (`/market-phase`)

> Doc context cho page Giai đoạn thị trường. Giữ trạng thái + kiến trúc + các mốc chỉnh sửa đáng chú ý để nối tiếp phiên làm việc sau.
> **Cập nhật:** 2026-07-09 · **Spec gốc:** [`../superpowers/specs/2026-07-09-market-phase-page-design.md`](../superpowers/specs/2026-07-09-market-phase-page-design.md)

---

## 1. Trạng thái hiện tại

- **Đã build đầy đủ 4 tab** (1 FREE + 3 PAID) — functional. `tsc --noEmit` = 0 lỗi.
- **CHƯA commit** (đang ở working tree). UI **user tự test** (quy ước dự án: không dựng browser/Playwright).
- ⚠️ **Cần restart backend** (uvicorn) để nạp: 9 keyword `phase_*` mới + projection `phase_daily` mới nhất (đã bỏ `regime_active`, thêm `breadth_mom`/`conf_breadth`). Trước khi restart, keyword mới trả 400 → FE có chỗ đã cho fail an toàn (xem §6).
- Dữ liệu đã verify bằng query Mongo trực tiếp: `stock_db` có đủ các collection + data thật.
- **Sản phẩm:** app tín hiệu + danh mục freemium. Tab ① FREE = phễu (tín hiệu WHEN); Tab ②③④ PAID = 3 rổ danh mục (tín hiệu WHICH).

---

## 2. Kiến trúc tổng thể

```
stock_db (Mongo, READ-ONLY, khác user_db)
  → 9 crud finext-fastapi/app/crud/sse/phase_*.py  (get_database("stock_db") + get_collection_records)
  → REST keyword ONE-SHOT:  GET /api/v1/sse/rest/{keyword}   (KHÔNG SSE, KHÔNG polling)
  → FE hooks (apiClient + fetch 1 lần) → components
```

- **Nguồn dữ liệu:** batch EOD 1 lần/ngày (không realtime). `max(phase_daily.date)` = phiên mới nhất. Backend đã kết nối `stock_db` sẵn (`database.py:35` `db_names_to_connect=["user_db","stock_db"]`).
- **Route:** `app/(main)/market-phase/` → `page.tsx` (server, metadata) + `PageContent.tsx` (client).
- **Nav:** thêm 1 `NavItem` (`Giai đoạn thị trường`, icon `TrafficOutlined`, href `/market-phase`) vào `navigationStructure` ở `app/(main)/LayoutContent.tsx` — nhóm "Công cụ" (cạnh Chart/Watchlist/Bộ lọc).
- **Tabs:** `SubNavbar` **tràn viền (full-bleed)** đồng bộ `?tab=` (copy pattern markets: `mx: calc(-50vw + 50% + compactDrawerWidth/2)`). Keys: `market` (FREE) / `conservative` / `aggressive` / `core`.
- **Shared header:** hero (chip phase + % nắm giữ + cường độ) + biểu đồ giai đoạn nằm **TRÊN slider**, hiển thị chung cho cả 4 tab.
- **Gating:** 1 lớp `OptionalAuthWrapper requireAuth` bọc toàn bộ (header+slider+content) → chưa login = 1 overlay đăng nhập. Tab PAID lồng thêm `requiredFeatures={ADVANCED_AND_ABOVE_STRICT}`. Hằng mới trong `components/auth/features.ts` = `[ADVANCED, PARTNER, MANAGER, ADMIN]` (advanced-trở-lên, KHÔNG gồm BASIC) — **không đụng** `ADVANCED_AND_ABOVE` global (đang bị compliance-pivot gộp BASIC).

---

## 3. Backend — 9 crud (`finext-fastapi/app/crud/sse/`) + keyword

| Keyword / file | Collection | Trả về | Dùng cho |
|---|---|---|---|
| `phase_daily` | `phase_daily` | full history, sort date asc | hero + chart + advanced panel |
| `phase_comment` | `phase_comment` | latest 1 (`market_cmt`) | chẩn đoán phiên (Tab ①) |
| `phase_perf` | `phase_perf` | full history mọi product (+`FNX`) | chart hiệu suất (client cộng dồn) |
| `phase_basket` | `phase_basket` | latest 3 (1 rổ/dòng) | holdings/book |
| `phase_rank` | `phase_rank` | ~500 dòng gần nhất | bảng chỉ tiêu + status sắp vào/ra |
| `phase_comment_basket` | `phase_comment_basket` | latest 3 | diễn giải danh mục/ngành |
| `phase_trading` | `phase_trading` | full, sort entry desc | sổ lệnh + **lãi/lỗ vị thế mở** |
| `phase_industry` | `phase_industry` | full history (WIDE) | heatmap ngành (CORE) |
| `phase_comment_indicator` | `phase_comment_indicator` | latest 15 → client lọc phiên mới | **diễn giải RIÊNG từng chỉ số** (advanced panel) |

Đăng ký ở `crud/sse/__init__.py` (import + `SSE_QUERY_REGISTRY`). Lưu ý `phase_signal` là feed CŨ đã chết — **không đụng**.

---

## 4. Frontend — cây file (`app/(main)/market-phase/`)

- **Entry/điều phối:** `page.tsx`, `PageContent.tsx` (title + shared header + SubNavbar + gating + chọn tab).
- **Data hooks (one-shot):** `hooks/useMarketPhaseData.ts` (Tab ①: phase_daily/comment/perf/comment_indicator), `hooks/useBasketData.ts` (Tab rổ: basket/rank/comment_basket/trading/perf/industry). Chuyển tab rổ ②↔③↔④ **không refetch** (BasketTab giữ mount, hook chạy 1 lần).
- **Config/types:** `types.ts`, `phaseMeta.ts` (màu+icon+nhãn phase), `basketMeta.ts` (tab→product, status meta).
- **Shared:** `components/SharedPhaseHeader.tsx` → `PhaseHero.tsx` + `PhaseFnxChart.tsx`.
- **Tab ① (FREE):** `components/MarketPhaseTab.tsx` → `SessionDiagnosis.tsx` + `BasketPerformanceChart.tsx` (cả 3 rổ) + `AdvancedPanel.tsx`.
- **Tab ②③④ (PAID):** `components/BasketTab.tsx` → `HoldingsTable.tsx` + `RankTable.tsx` + `PortfolioComment.tsx` + `BasketPerformanceChart.tsx` (1 rổ) + `OrderBook.tsx` + (CORE) `IndustrySection.tsx`.

**Charts:** cả 2 đều **lightweight-charts** (KHÔNG còn ApexCharts).
- `PhaseFnxChart` = **AREA chia đoạn theo phase**: mỗi đoạn phase liên tiếp = 1 `AreaSeries` với line + fill mang màu của pha (nối liền tại ranh giới). Timeframe: **3M/1Y/2Y/5Y/Tất cả**.
- `BasketPerformanceChart` = multi-line rebase 0% cumulative theo cửa sổ; benchmark FNX dashed xám; prop `products?` để lọc (Tab rổ chỉ 1 rổ + FNX).

---

## 5. Nội dung 4 tab + mapping data

- **Shared header:** chip phase (nhãn EN + VN phụ) · KPI % nắm giữ = `min(market_exposure,1)×100` (transition nay chạy 0.70–1.0) · cường độ = **bullet phân kỳ** `market_intensity` · chart FNX+màu phase.
- **① Thị trường chung (FREE):** chẩn đoán phiên (`phase_comment.market_cmt`) + hiệu suất 3 rổ vs FNX (`phase_perf`) + **panel "Chỉ số nâng cao"**.
- **② Bảo Thủ / ③ Tăng Trưởng (layout giống nhau):** `HoldingsTable` (holdings + lãi/lỗ từng mã từ vị thế mở `phase_trading` + lãi/lỗ danh mục) → `RankTable` (chỉ mã **chưa giữ**, `held!==1`) → `PortfolioComment` (`stock_cmt`) → curve rổ → `OrderBook` (sổ lệnh backtest).
- **④ Sóng Ngành (CORE):** thêm `IndustrySection` (rank ngành + heatmap `phase_industry` — chỉ render ngành từng có tín hiệu + `sector_cmt`) rồi tới tầng mã như ②③.
- **Downtrend / 100% tiền mặt** (`phase_basket.held` rỗng): HoldingsTable đổi tiêu đề → **"Danh mục dự kiến"**, hiện `book` (không lãi/lỗ) + banner phòng thủ.

**Advanced panel — 9 khối chỉ số** (mỗi khối = giá trị cột `phase_daily` + comment `phase_comment_indicator` render nguyên văn):

| Khối (indicator_key) | Cột phase_daily |
|---|---|
| `do_rong_da_khung` | breadth_w/m/q/y (**4 cột · 1 comment chung**) |
| `do_rong_nen` | breadth_slow |
| `canh_bao_giam_nhanh` | breadth_blend/fast/mom (**3 cột · 1 comment chung**) |
| `trigger_giam_doc_lap` | breadth_aux |
| `do_on_dinh_do_rong` | conf_breadth |
| `diem_xu_huong_1_nam` | composite_score |
| `thanh_khoan_dan_dat` | vsi_long |
| `dong_pha_rong_khoan` | corr60 |
| `dong_pha_gia_20` | px_ret20 |
| *(Chẩn đoán hướng — KHÔNG comment)* | conf_dir, sub_signal |

`market_intensity` = output (ở hero). `regime_active`/`che_do_loc_nhieu` = **ĐÃ BỎ** (field + comment).

---

## 6. Luật render / ràng buộc (đang tuân)

- **Chỉ đọc** các collection `phase_*`; không recompute; không đọc `phase_signal` (chết).
- **Bí mật thuật toán:** không mô tả tiêu chí xếp hạng, không "biến động thấp", `phase_rank` không có cột volatility (backend chỉ project field an toàn), heatmap ngành chỉ render ngành từng có tín hiệu (không lộ cột always-0/universe). Lý do 1 mã có mặt = "đứng hạng cao".
- **Trạng thái sắp ra/chờ vào** = cơ học: so `rank` với ngưỡng `nguong_vao`/`nguong_giu` (buffer) + lịch cơ cấu `next_rebalance_in` (mỗi 5 phiên). KHÔNG phải dự báo từng mã.
- **Bỏ disclaimer nặng** (theo owner) — giữ pill "Phân tích tự động" + timestamp. Sổ lệnh có nhãn nhẹ "mô phỏng backtest".
- **Giờ `generated_at`:** hiển thị **literal** (đã là giờ VN wall-clock backend ghi, `datetime.now().isoformat()` — KHÔNG convert timezone).
- **Fail an toàn:** fetch `phase_comment_indicator` có `.catch(()=>{data:[]})` để BE chưa restart không làm vỡ cả tab.

---

## 7. Quyết định thiết kế đã CHỐT (đừng đảo lại nếu không có lý do)

- Nhãn phase **EN** (SIDEWAY…) to + VN phụ (theo doc-06 §9.1 + owner).
- Cường độ = **bullet phân kỳ** (đã thử marker/dial rồi bỏ).
- Serve **REST one-shot**, không SSE/polling cho page này.
- Gating tab PAID = `ADVANCED_AND_ABOVE_STRICT` (không đụng global bypass).
- Chart = **lightweight-charts** (bỏ ApexCharts).

---

## 8. Lịch sử chỉnh sửa ĐÁNG CHÚ Ý (chỉ mốc quan trọng)

- **Build:** Increment 1 (shell + Tab ① FREE) → rồi 3 tab PAID (②③④) một lượt.
- **Layout:** hero + biểu đồ giai đoạn **dời LÊN TRÊN slider**, hiển thị chung cả 4 tab; slider làm **full-bleed**. `MarketPhaseTab` bỏ hero/chart (đã sang `SharedPhaseHeader`), nhận data qua props (fetch dồn về `PageContent`).
- **Chart FNX:** ApexCharts (xaxis annotation band) → **thay bằng lightweight-charts AREA chia đoạn theo phase** (band category axis không đáng tin; owner muốn area đổi màu cả line+nền). Marker tròn tại điểm đổi pha: **thêm rồi BỎ** (xấu). Timeframe 6M → **2Y**.
- **Màu phase:** đổi bộ màu — SIDEWAY→xám nhạt, TRANSITION→vàng, UP/DOWN đậm rõ hơn (`phaseMeta.ts`, theme-aware).
- **Advanced panel:** 6 chỉ số → đủ 17 raw field → **tái cấu trúc thành 9 khối + comment riêng từng chỉ số** (`phase_comment_indicator` — lớp comment thứ 3). **Bỏ `regime_active`** (field + block).
- **Holdings:** `HoldingsCard` (chips) → **`HoldingsTable`** (bảng riêng + **lãi/lỗ từng mã + lãi/lỗ danh mục** từ vị thế mở `phase_trading`); `RankTable` lọc bỏ mã đang giữ.
- **Giờ VN:** thêm util `formatVnTime` (giả định UTC) → **REVERT** vì `generated_at` đã là giờ VN literal (owner xác nhận).
- **Đã xoá:** `PaidTabPlaceholder`, `HoldingsCard`, `timeUtils.ts` (đều bị thay thế/revert).

---

## 9. Việc còn lại / lưu ý cho phiên sau

- **Restart backend** để keyword + projection mới có hiệu lực (điều kiện tiên quyết để thấy data mới).
- **Chưa commit** — quyết định commit/branch tùy owner.
- Heatmap `phase_stock` (consensus 0–2 rổ giữ) chưa làm — doc-08 để mở vị trí (tab ① hay tab rổ).
- Toggle đòn bẩy 2.0x + cảnh báo margin: chưa làm (increment 1 chốt 1.0x).
- Data cũ trong Mongo có thể còn `regime_active` (phase_daily) + row `che_do_loc_nhieu` (phase_comment_indicator) tới khi pipeline chạy lại — web đã bỏ qua, không render.

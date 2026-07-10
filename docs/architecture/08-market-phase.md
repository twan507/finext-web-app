# 08 — Page "Giai đoạn thị trường" (`/market-phase`)

> Doc context cho page Giai đoạn thị trường. Giữ trạng thái + kiến trúc + các mốc chỉnh sửa đáng chú ý để nối tiếp phiên làm việc sau.
> **Cập nhật:** 2026-07-10 (redesign PhaseFnxChart "Neon Regime" — xem §8) · **Spec gốc:** [`../superpowers/specs/2026-07-09-market-phase-page-design.md`](../superpowers/specs/2026-07-09-market-phase-page-design.md)

---

## 1. Trạng thái hiện tại

- **Đã build đầy đủ 4 tab** (1 FREE + 3 PAID) — functional. `tsc --noEmit` = 0 lỗi.
- **CHƯA commit** (đang ở working tree). UI **user tự test** (quy ước dự án: không dựng browser/Playwright; **không tự chạy `next build`** — chỉ verify bằng `tsc --noEmit`).
- **UI Tab ① đã redesign "Ambient Signal" (2026-07-09):** hero + panel dùng ngôn ngữ glass + ambient glow theo màu pha. Component tái dùng mới: `AmbientCard` (glass + glow + top accent theo `glowColor`, theme-aware) và `IndicatorViz` (các primitive trực quan hoá số liệu). Xem §5/§7.
- ⚠️ **Schema mới (chờ pipeline chạy lại):** `phase_daily` gọn còn **12 cột** (thêm `conf_flat`, bỏ `breadth_fast`/`mom`, `conf_breadth`, `composite_score`, `breadth_w|m|q|y`, `vsi_long`, `regime_active`); `phase_comment_indicator` còn **7 chỉ số** (indicator_key mới — xem §5). Backend đã cập nhật projection `phase_daily` (thêm `conf_flat`, bỏ cột cắt). Web bỏ qua key/cột cũ an toàn (data cũ → viz `—`, không comment).
- Dữ liệu đã verify bằng query Mongo trực tiếp: `stock_db` có đủ các collection + data thật.
- **Sản phẩm:** app tín hiệu + danh mục freemium. Tab ① FREE = phễu (tín hiệu WHEN); Tab ②③④ PAID = 3 rổ danh mục (tín hiệu WHICH).

---

## 2. Kiến trúc tổng thể

```
stock_db (Mongo, READ-ONLY, khác user_db)  →  REST keyword ONE-SHOT GET /api/v1/sse/rest/{keyword}  →  FE hooks (apiClient) → components
  Ngoại lệ: biểu đồ xu hướng (FnxTrendChart) dùng REST home_history_trend + SSE home_today_trend (reuse pattern markets/groups).
```

- **Nguồn dữ liệu:** batch EOD 1 lần/ngày (không realtime). `max(phase_daily.date)` = phiên mới nhất. Backend đã kết nối `stock_db` sẵn (`database.py:35` `db_names_to_connect=["user_db","stock_db"]`).
- **Route:** `app/(main)/market-phase/` → `page.tsx` (server, metadata) + `PageContent.tsx` (client).
- **Nav:** thêm 1 `NavItem` (`Giai đoạn thị trường`, icon `TrafficOutlined`, href `/market-phase`) vào `navigationStructure` ở `app/(main)/LayoutContent.tsx` — nhóm "Công cụ" (cạnh Chart/Watchlist/Bộ lọc).
- **Tabs:** `SubNavbar` **tràn viền (full-bleed)** đồng bộ `?tab=` (copy pattern markets: `mx: calc(-50vw + 50% + compactDrawerWidth/2)`). Keys → nhãn nav (có prefix "Danh mục"): `market` (FREE, "Phân tích thị trường") / `conservative` ("Danh mục Phòng Thủ") / `aggressive` ("Danh mục Mạo Hiểm") / `core` ("Danh mục Sóng Ngành"). Tên rổ ngắn (legend/tooltip/TopTrades, `SERIES` + `PRODUCT_FALLBACK_NAME`): **Phòng Thủ / Mạo Hiểm / Sóng Ngành**. Màu: CORE=primary (tím), Phòng Thủ=**xanh biển đậm** (`#3b82f6`/`#2563eb`, KHÔNG dùng `trend.floor` = xanh sàn), Mạo Hiểm=warning (cam).
- **Shared header (trên slider, chung 4 tab):** **CHỈ còn hero** (`PhaseHero`). Biểu đồ giai đoạn FNX (`PhaseFnxChart`) **đã dời xuống Tab ①** (vào section "Diễn biến và phân tích phiên") → tab PAID không còn chart FNX ở đầu (nếu cần thì thêm lại riêng cho PAID).
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
- **Data hooks (one-shot):** `hooks/useMarketPhaseData.ts` (Tab ①: phase_daily/comment/perf/comment_indicator/**trading**), `hooks/useBasketData.ts` (Tab rổ: basket/rank/comment_basket/trading/perf/industry). Chuyển tab rổ ②↔③↔④ **không refetch** (BasketTab giữ mount, hook chạy 1 lần). `phase_trading` fetch ở cả 2 (dedupe qua `useCache`).
- **Config/types:** `types.ts`, `phaseMeta.ts` (màu+icon+nhãn phase), `basketMeta.ts` (tab→product, status meta).
- **Design tái dùng (Ambient Signal):**
  - `components/AmbientCard.tsx` — card kính: `getGlassCard` + ambient radial glow + top accent 1px, tất cả theo prop `glowColor` (thường = màu pha), theme-aware (glow dịu ở light). Prop `glowAnchor`, `topAccent`, `sx`.
  - `components/IndicatorViz.tsx` — primitive trực quan hoá: `DivergingBullet` (thanh phân kỳ tâm 0), `Segments10` (10 đoạn 0..1), `StatBar` (số + thước có vạch mốc/circuit-breaker), `IndicatorBlock` (heading+value+viz), `NoteItem` (dòng diễn giải) + helper `divColor`/`fmtDiv`/`gradientColorAt` (nội suy màu trên dải qua `decomposeColor`/`recomposeColor`).
  - `components/phaseChartPrimitive.ts` — custom `ISeriesPrimitive` (`PhaseNeonPrimitive`) cho PhaseFnxChart "Neon Regime": vẽ nền wash theo pha + vạch ranh giới đứt + đường giá **neon glow 3 lớp** (halo 6/glow 2.5/core 1.6) + huy hiệu đổi pha (▲▼↔⇄). Pattern như `charts/[id]/BandFillPrimitive.ts`.
- **Shared:** `components/SharedPhaseHeader.tsx` → **CHỈ** `PhaseHero.tsx` (Ambient Signal).
- **Tab ① (FREE):** `components/MarketPhaseTab.tsx`, thứ tự: **Diễn biến và phân tích phiên** (`PhaseFnxChart` → `SessionDiagnosis`) → **Chi tiết các chỉ số** (`FnxTrendChart` → `AdvancedPanel`) → **Hiệu suất các danh mục đầu tư vs thị trường** (`BasketPerformanceChart`) → **Top lệnh lãi nhất mỗi danh mục** (`TopTradesSection`, cuối trang).
  - `FnxTrendChart.tsx` — reuse `MarketTrendChart` (markets), feed **riêng FNXINDEX** (REST `home_history_trend` + SSE `home_today_trend`).
  - `TopTradesSection.tsx` — 3 cột (3 danh mục) glass card, mỗi cột bảng **top 10 lệnh lãi nhất** (`phase_trading` closed, `exit_date` trong cửa sổ timeframe → sort `return_pct` desc → 10). Cột: Mã · Ra · Số phiên · Lãi%. Tái dùng `SERIES` (product→name→color) của `BasketPerformanceChart`. Timeframe **DÙNG CHUNG** selector với `BasketPerformanceChart` (state `range` lift lên `MarketPhaseTab`; chart thành controlled qua props `range`/`onRangeChange`; `windowStart` tính từ `perf` dates + `RANGE_DAYS`). FREE.
- **Tab ②③④ (PAID):** `components/BasketTab.tsx` → `HoldingsTable.tsx` + `RankTable.tsx` + `PortfolioComment.tsx` + `BasketPerformanceChart.tsx` (1 rổ) + `OrderBook.tsx` + (CORE) `IndustrySection.tsx`.

**Charts:** đều **lightweight-charts** (KHÔNG còn ApexCharts).
- `PhaseFnxChart` = **"Neon Regime"** (redesign 2026-07-10, bỏ AREA fill): 1 LineSeries **trong suốt** (giữ price scale/crosshair/tooltip) + `PhaseNeonPrimitive` vẽ đường giá **neon glow 3 lớp** đổi màu theo pha + nền wash nhẹ + vạch ranh giới đứt + huy hiệu đổi pha; grid **chấm** (Dotted); overlay HTML **pulse dot** neo tại điểm cuối; vạch giá cuối = `createPriceLine` màu pha. Timeframe **3M/6M/1Y/2Y** (đổi khung = đổi visible range trên full data, có nút pan/zoom). Đặt trong Tab ①, **không bọc card**.
- `BasketPerformanceChart` = multi-line rebase 0% cumulative; benchmark FNX dashed; prop `products?`. KPI = **stat tiles nền gradient ambient theo màu line**. **Không bọc card**.
- `FnxTrendChart`/`MarketTrendChart` = 4 line xu hướng Tuần/Tháng/Quý/Năm của FNXINDEX (timeframe 1M/3M/6M/1Y).

---

## 5. Nội dung 4 tab + mapping data

- **Shared header (chỉ hero, Ambient Signal):** chip phase (glyph trong ô glow + nhãn EN to + VN phụ) · dải **lịch sử pha 10 phiên** · KPI % nắm giữ = `min(market_exposure,1)×100` (số gradient + **thanh segmented 10 đoạn**) · cường độ = **bullet phân kỳ** `market_intensity`. Cả card ambient-tint theo màu pha.
- **① Phân tích thị trường (FREE)** — thứ tự section: **Diễn biến và phân tích phiên** (biểu đồ FNX theo pha + card "Phân tích tự động" render `phase_comment.market_cmt` **trên nền, không card**) → **Chi tiết các chỉ số** (biểu đồ xu hướng FNXINDEX + panel chỉ số) → **Hiệu suất các danh mục đầu tư vs thị trường** (`phase_perf`) → **Top lệnh lãi nhất mỗi danh mục** (`phase_trading`, 3 cột, cuối trang; chung timeframe với biểu đồ hiệu suất).
- **② Danh mục Phòng Thủ / ③ Danh mục Mạo Hiểm (layout giống nhau):** `HoldingsTable` (holdings + lãi/lỗ từng mã từ vị thế mở `phase_trading` + lãi/lỗ danh mục) → `RankTable` (chỉ mã **chưa giữ**, `held!==1`) → `PortfolioComment` (`stock_cmt`) → curve rổ → `OrderBook` (sổ lệnh backtest).
- **④ Sóng Ngành (CORE):** thêm `IndustrySection` (rank ngành + heatmap `phase_industry` — chỉ render ngành từng có tín hiệu + `sector_cmt`) rồi tới tầng mã như ②③.
- **Downtrend / 100% tiền mặt** (`phase_basket.held` rỗng): HoldingsTable đổi tiêu đề → **"Danh mục dự kiến"**, hiện `book` (không lãi/lỗ) + banner phòng thủ.

**Advanced panel — 7 chỉ số** (`AdvancedPanel.tsx`; schema `phase_daily` 12 cột; mỗi chỉ số = 1 cột + comment `phase_comment_indicator` nguyên văn). **1 AmbientCard duy nhất** (glow màu pha), **2 cột**: viz (trái, `justify-space-between`) · **Diễn giải** (phải, list 1 cột) — KHÔNG accordion, KHÔNG header nhóm, KHÔNG card lồng. 7 chỉ số liền mạch theo thứ tự Hướng → Tin cậy → Gate. Mảng phẳng `INDICATORS`:

| # | indicator_key | Cột phase_daily | viz |
|---|---|---|---|
| 1 | `cau_truc_xu_huong_tang` | `breadth_slow` | DivergingBullet ±1 |
| 2 | `cau_truc_xu_huong_giam` | `breadth_blend` | DivergingBullet ±1 |
| 3 | `tin_hieu_xu_huong_suy_yeu` | `breadth_aux` | DivergingBullet ±1 |
| 4 | `do_tin_cay_xu_huong` | `conf_dir` | Segments10 (0..1, tím) |
| 5 | `do_tin_cay_sideway` | `conf_flat` (**MỚI**) | Segments10 (0..1, tím) |
| 6 | `muc_do_lan_toa_dong_tien` | `corr60` | StatBar diverging (fill tâm 0→marker) |
| 7 | `quan_tinh_bien_dong_gia` | `px_ret20` | StatBar circuit-breaker (**%**) |

**`px_ret20` (StatBar breaker):** KHÔNG chuẩn hoá — bộ ngắt mạch giá ngưỡng kinh tế thật. Thước −20%…+20%, **vùng đỏ [đầu→−10%] + vùng xanh [+10%→max]**, giữa trống; marker màu **nội suy theo dải đỏ→xanh** tại vị trí; hiển thị **% thô** (`×100`). `corr60` (StatBar diverging): thước −1..+1, fill tâm 0→marker. Cả 2 có **chip trạng thái màu theo marker, căn giữa marker** (clamp ở mép).

Diễn giải mỗi dòng = chấm màu + tên + giá trị + comment nguyên văn → comment dài-ngắn không gây lệch layout.

`market_intensity` = output (ở hero) · `sub_signal`, `fnx_close` = DIAG (không comment; `sub_signal` không hiển thị). **ĐÃ BỎ cột:** `breadth_fast`/`breadth_mom`/`conf_breadth`/`composite_score`/`breadth_w|m|q|y`/`vsi_long`/`regime_active`. Web đã bỏ mọi tham chiếu; với data cũ trong Mongo (chưa chạy pipeline) → viz hiện `—`, comment key lạ bị bỏ qua.

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
- Serve **REST one-shot** cho dữ liệu `phase_*` (không SSE/polling). **Ngoại lệ:** `FnxTrendChart` dùng REST history + SSE `home_today_trend` (owner chốt — cần điểm hôm nay realtime, reuse pattern markets/groups).
- Gating tab PAID = `ADVANCED_AND_ABOVE_STRICT` (không đụng global bypass).
- Chart = **lightweight-charts** (bỏ ApexCharts).
- **Ngôn ngữ thiết kế "Ambient Signal"** (owner chốt qua mockup): nền glass + ambient glow theo màu pha (`AmbientCard`), số liệu **trực quan hoá** (bullet/segments/StatBar) thay vì text. Số dùng tabular-nums. Theme-aware (glow dịu ở light).
- **Layout Tab ①:** bỏ mọi card lồng card; chart để trần (không bọc `AmbientCard`); panel chỉ số gom **1 card 2 cột**. Chẩn đoán phiên = biểu đồ FNX + text trên nền. Hiệu suất 3 danh mục **xuống cuối**.
- **`px_ret20` KHÔNG chuẩn hoá** (circuit-breaker giá, giữ ngưỡng −10% có nghĩa kinh tế) — xem §5.

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

### Phiên redesign "Ambient Signal" + schema mới (2026-07-09)

- **Hero** → Ambient Signal: card ambient-tint theo màu pha, ô glyph glow, dải lịch sử pha 10 phiên, số % gradient + thanh segmented, bullet cường độ glow. Tạo `AmbientCard` (tái dùng) + `IndicatorViz` (primitive).
- **Schema:** `phase_daily` 17→**12 cột** (+`conf_flat`, bỏ 9 cột nguyên liệu); `phase_comment_indicator` 9→**7 chỉ số** (indicator_key mới). Backend cập nhật projection `phase_daily.py`. `types.ts` + `AdvancedPanel` viết lại theo schema mới.
- **Advanced panel:** 9 khối accordion → **1 card 2 cột, 7 chỉ số liền mạch** (viz trái / diễn giải phải). Thử qua nhiều bước: bento 4 cụm → 3 cụm card riêng → gộp 1 card bỏ header. `StatBar` cho `corr60`/`px_ret20` (px_ret20 circuit-breaker, marker màu nội suy theo dải, chip căn giữa marker).
- **Layout Tab ①:** biểu đồ FNX **dời từ shared header xuống** section Chẩn đoán phiên (trên text); `SessionDiagnosis` **bỏ card** (trên nền); thêm `FnxTrendChart` (xu hướng FNXINDEX) trên card chỉ số; **Hiệu suất 3 danh mục xuống cuối, bỏ card**; KPI hiệu suất → stat tiles nền gradient theo màu line.
- **Sự cố:** lỡ chạy `next build` khi dev server đang chạy → hỏng `.next` (ENOENT). Đã `rm -rf .next`. **Rule mới: KHÔNG tự chạy `next build`.**

### Redesign PhaseFnxChart "Neon Regime" (2026-07-10)

- **Lý do:** bản AREA fill cũ (mỗi pha 1 `AreaSeries` chạm đáy) bị chê loang lổ/xấu — chart là tâm điểm page. Chốt hướng qua 3 vòng mockup visual-companion (spec [`../superpowers/specs/2026-07-10-phase-fnx-chart-neon-redesign.md`](../superpowers/specs/2026-07-10-phase-fnx-chart-neon-redesign.md)).
- **Thiết kế:** hướng A "Neon Regime" (bỏ area fill, line neon + wash nền nhẹ) trộn 3 nét hướng B (soft-glow line, huy hiệu đổi pha + vạch đứt, grid chấm); tinh chỉnh v2 (line mảnh **1.6**, glow neon 2 lớp: sát 2.5/α0.55 + halo 6/α0.18).
- **Kỹ thuật:** đổi từ N `AreaSeries` → **1 LineSeries trong suốt + `PhaseNeonPrimitive`** (custom `ISeriesPrimitive`, file mới `phaseChartPrimitive.ts`) vẽ toàn bộ visual bằng canvas (wash/drop-line/neon 3 lớp/glyph chip). **Pulse dot** = overlay HTML neo tại điểm cuối, **định vị bằng `transform` qua vòng `requestAnimationFrame`** (đọc `timeToCoordinate`/`priceToCoordinate` mỗi frame, không setState) → dán khít line khi zoom/pan/scale dọc; tự ẩn khi điểm cuối ra ngoài khung. Vạch giá cuối = `createPriceLine` màu pha. Tooltip nâng nền `backdropFilter blur`. Theme-aware (alpha dịu ở light). `tsc --noEmit` = 0 lỗi.
- **Chỉnh sau khi test (owner):** (1) **bỏ chip "TRANSITION · Chuyển pha"** ở điểm cuối (che chart) — giữ pulse dot; tooltip chỉ hiện nhãn EN. (2) **Thêm `PanZoomToggle`** (reuse component, **bên trái** `TimeframeSelector`) bật/tắt kéo–thu phóng như `MarketTrendChart`; tắt → về góc nhìn timeframe. (3) **Load FULL data**, timeframe chỉ đổi **góc nhìn** (`setVisibleLogicalRange` qua `getVisibleRange`, KHÔNG cắt data) — đồng bộ hành vi `MarketTrendChart`; bỏ `fixLeftEdge/fixRightEdge`. (4) Khung timeframe **PhaseFnxChart + BasketPerformanceChart** thống nhất **3M/6M/1Y/2Y** (bỏ 1M/5Y/Tất cả). `BasketPerformanceChart` không pan/zoom (rebase cumulative theo cửa sổ → chỉ đổi khung, vẫn cắt data). **MarketTrendChart giữ nguyên** 1M/3M/6M/1Y (dùng chung markets/groups/sectors — owner chốt không đụng).
- **Section mới "Top lệnh lãi nhất mỗi danh mục" (cuối Tab ①):** 3 cột (3 danh mục) × bảng top-10 `phase_trading` closed sort `return_pct` desc, lọc `exit_date` trong cửa sổ timeframe. Cột Mã·Ra·Số phiên·Lãi%. `useMarketPhaseData` thêm fetch `phase_trading`. **Timeframe lift lên `MarketPhaseTab`** — 1 selector (trên `BasketPerformanceChart`, đổi thành controlled qua props `range`/`onRangeChange`) điều khiển cả biểu đồ hiệu suất lẫn section này; `BasketPerformanceChart` export `SERIES`/`RANGE_DAYS`, giữ controlled/uncontrolled (BasketTab dùng uncontrolled, không đổi). Spec: `../superpowers/specs/2026-07-10-top-trades-section.md`. FREE.
- **Đổi tên tiêu đề (owner, giữ key nội bộ):** tab `market` "Thị trường chung" → **"Phân tích thị trường"**, `conservative` "Bảo Thủ" → **"Danh mục cẩn trọng"** (nhãn tab; series legend trong `BasketPerformanceChart` vẫn "Bảo Thủ"). Section Tab ①: "Chẩn đoán phiên" → **"Diễn biến và phân tích phiên"**, "Chỉ số nâng cao" → **"Chi tiết các chỉ số"**, "Hiệu suất 3 danh mục…" → **"Hiệu suất các danh mục đầu tư vs thị trường"**. Header subtitle viết lại.

- **Restart backend** (nạp projection `phase_daily` mới có `conf_flat`) + **chạy lại pipeline** (ghi 12 cột mới + 7 indicator_key mới). Trước khi có data mới: `conf_flat` + comment 7 chỉ số hiện `—`/trống (fail-safe).
- **Chưa commit** — quyết định commit/branch tùy owner.
- **Tab PAID mất chart FNX ở đầu** (do dời chart vào Tab ①). Nếu owner muốn PAID vẫn có → thêm lại riêng cho `BasketTab` (chưa làm).
- Heatmap `phase_stock` (consensus 0–2 rổ giữ) chưa làm.
- Toggle đòn bẩy 2.0x + cảnh báo margin: chưa làm (chốt 1.0x).
- Data cũ trong Mongo còn cột/indicator_key cũ tới khi pipeline chạy lại — web đã bỏ qua an toàn.

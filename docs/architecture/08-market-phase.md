# 08 — Page "Giai đoạn thị trường" (`/phase`)

> Doc context cho page Giai đoạn thị trường. Giữ trạng thái + kiến trúc + các mốc chỉnh sửa đáng chú ý để nối tiếp phiên làm việc sau.
> **Cập nhật:** 2026-07-21 — repository HEAD `445c4bb`, contract **Phase v3.4.2** (đổi nghĩa `corr60` + field `suppressed`); mốc UI 2026-07-11/12 giữ tại §9. **Spec gốc:** [`../superpowers/specs/2026-07-09-market-phase-page-design.md`](../superpowers/specs/2026-07-09-market-phase-page-design.md)

---

## 1. Trạng thái hiện tại

- **Đã build đầy đủ 4 tab** (1 FREE + 3 PAID) — functional. `tsc --noEmit` = 0 lỗi.
- **Đã polish xong vòng 2026-07-11/12** (owner duyệt): 3 bảng vận hành chuẩn hoá + responsive · cụm Sóng Ngành mới · 4 đoạn nhận định AI · nav icon gauge · skeleton mọi tab (hết spinner). Chi tiết §9.
- **Current repository state:** HEAD `445c4bb` (2026-07-21), Phase v3.4.2. Commit ghi nhận `pytest` 652 pass và `tsc --noEmit` 0 lỗi; đây là kết quả tại commit, không thay cho kiểm tra deploy/runtime production.
- **UI Tab ① đã redesign "Ambient Signal" (2026-07-09):** hero + panel dùng ngôn ngữ glass + ambient glow theo màu pha. Component tái dùng mới: `AmbientCard` (glass + glow + top accent theo `glowColor`, theme-aware) và `IndicatorViz` (các primitive trực quan hoá số liệu). Xem §5/§7.
- **Contract v3.4.2:** backend `phase_daily` project **14 field dữ liệu** (gồm `suppressed`); advanced panel dùng 7 metric/comment key. Key #6 hiện là `dong_pha_xu_huong_thanh_khoan`, vẫn đọc giá trị `corr60`. Frontend `PhaseDaily` chưa khai báo/đọc `suppressed` nên field dư bị bỏ qua an toàn; policy agent chỉ cho diễn đạt "bối cảnh rủi ro cao", không lộ gate/công thức.
- Dữ liệu đã verify bằng query Mongo trực tiếp: `stock_db` có đủ các collection + data thật.
- **Sản phẩm:** app tín hiệu + danh mục freemium. Tab ① FREE = phễu (tín hiệu WHEN); Tab ②③④ PAID = 3 rổ danh mục (tín hiệu WHICH).

---

## 2. Kiến trúc tổng thể

```
stock_db (Mongo, READ-ONLY, khác user_db)  →  REST keyword ONE-SHOT GET /api/v1/sse/rest/{keyword}  →  FE hooks (apiClient) → components
  Ngoại lệ: biểu đồ xu hướng (FnxTrendChart) dùng REST home_history_trend + SSE home_today_trend (reuse pattern markets/groups).
```

- **Nguồn dữ liệu:** batch EOD 1 lần/ngày (không realtime). `max(phase_daily.date)` = phiên mới nhất. Backend khởi tạo sẵn `user_db`, `stock_db`, `agent_db`; `ref_db` của `index_map` được `get_database()` mở lazy.
- **Route:** `app/(main)/phase/` → `page.tsx` (server, metadata) + `PageContent.tsx` (client).
- **Nav:** `NavItem` `Giai đoạn thị trường` (href `/phase`) đứng **ĐẦU** `navigationStructure` (`app/(main)/LayoutContent.tsx`), có cờ `special: true`. Icon = component riêng **`app/(main)/MarketPhaseNavIcon.tsx`** (đồng hồ định pha + khung Aurora tím Finext xoay) — xem §7.
- **Tabs:** `SubNavbar` **tràn viền (full-bleed)** đồng bộ `?tab=` (copy pattern markets: `mx: calc(-50vw + 50% + compactDrawerWidth/2)`). Keys → nhãn nav (có prefix "Danh mục"): `market` (FREE, "Phân tích thị trường") / `conservative` ("Danh mục Phòng Thủ") / `aggressive` ("Danh mục Mạo Hiểm") / `core` ("Danh mục Sóng Ngành"). Tên rổ ngắn (legend/tooltip/TopTrades, `SERIES` + `PRODUCT_FALLBACK_NAME`): **Phòng Thủ / Mạo Hiểm / Sóng Ngành**. Màu: CORE=primary (tím), Phòng Thủ=**xanh biển đậm** (`#3b82f6`/`#2563eb`, KHÔNG dùng `trend.floor` = xanh sàn), Mạo Hiểm=warning (cam).
- **Shared header (trên slider, chung 4 tab):** **CHỈ còn hero** (`PhaseHero`). Biểu đồ giai đoạn FNX (`PhaseFnxChart`) **đã dời xuống Tab ①** (vào section "Diễn biến và phân tích phiên") → tab PAID không còn chart FNX ở đầu (nếu cần thì thêm lại riêng cho PAID).
- **Gating:** 1 lớp `OptionalAuthWrapper requireAuth` bọc toàn bộ (header+slider+content) → chưa login = 1 overlay đăng nhập. Tab PAID lồng thêm `requiredFeatures={ADVANCED_AND_ABOVE_STRICT}`. Hằng mới trong `components/auth/features.ts` = `[ADVANCED, PARTNER, MANAGER, ADMIN]` (advanced-trở-lên, KHÔNG gồm BASIC) — **không đụng** `ADVANCED_AND_ABOVE` global (đang bị compliance-pivot gộp BASIC).

---

## 3. Backend — 9 crud `phase_*` + `index_map` (`finext-fastapi/app/crud/sse/`)

| Keyword / file | Collection | Trả về | Dùng cho |
|---|---|---|---|
| `phase_daily` | `phase_daily` | full history, sort date asc | hero + chart + advanced panel |
| `phase_comment` | `phase_comment` | latest 1 — **4 đoạn**: `market_cmt` + `condition_cmt` + `structure_cmt` + `risk_cmt` (2026-07-11 mở rộng `_PROJECTION`, trước chỉ `market_cmt`) | nhận định Tab ① (2 khối AI) |
| `phase_perf` | `phase_perf` | full history mọi product (+`FNX`) | chart hiệu suất (client cộng dồn) |
| `phase_basket` | `phase_basket` | **60 dòng = 20 phiên × 3 rổ** (2026-07-10, trước là latest 3) | holdings/book + lookback phiên |
| `phase_rank` | `phase_rank` | **20 phiên gần nhất** (distinct dates → `$gte` min; trước là limit 500 ≈ 4 phiên) | bảng chỉ tiêu + status + lookback |
| `phase_comment_basket` | `phase_comment_basket` | latest 3 | diễn giải danh mục/ngành |
| `phase_trading` | `phase_trading` | full, sort entry desc | sổ lệnh + **lãi/lỗ vị thế mở** |
| `phase_industry` | `phase_industry` | full history (WIDE) | heatmap ngành (CORE) |
| `phase_comment_indicator` | `phase_comment_indicator` | latest 15 → client lọc phiên mới | **diễn giải RIÊNG từng chỉ số** (advanced panel) |
| `index_map` (**MỚI** 2026-07-11) | **`ref_db`**`.index_map` | `{ticker, ticker_name, type}` | map **mã ngành → tên đầy đủ** (cụm Sóng Ngành) |

Đăng ký ở `crud/sse/__init__.py` (import + `SSE_QUERY_REGISTRY`). `phase_signal` là feed cũ nhưng **vẫn đang hoạt động** cho `PhaseSignalSection` của `/markets` qua `/api/v1/sse/rest/phase_signal`; nó không thuộc contract dữ liệu của page `/phase` mới.
⚠️ `index_map` đọc **`ref_db`** (không phải `stock_db`) — crud tự chọn db.

---

## 4. Frontend — cây file (`app/(main)/phase/`)

- **Entry/điều phối:** `page.tsx`, `PageContent.tsx` (title + shared header + SubNavbar + gating + chọn tab).
- **Data hooks (one-shot):** `hooks/useMarketPhaseData.ts` (Tab ①: phase_daily/comment/perf/comment_indicator/**trading**), `hooks/useBasketData.ts` (Tab rổ: basket/rank/comment_basket/trading/perf/industry). Chuyển tab rổ ②↔③↔④ **không refetch** (BasketTab giữ mount, hook chạy 1 lần). `phase_trading` fetch ở cả 2 (dedupe qua `useCache`).
- **Config/types:** `types.ts`, `phaseMeta.ts` (màu+icon+nhãn phase), `basketMeta.ts` (tab→product, status meta).
- **Design tái dùng (Ambient Signal):**
  - `components/AmbientCard.tsx` — card kính: `getGlassCard` + ambient radial glow + top accent 1px, tất cả theo prop `glowColor` (thường = màu pha), theme-aware (glow dịu ở light). Prop `glowAnchor`, `topAccent`, `sx`.
  - `components/IndicatorViz.tsx` — primitive trực quan hoá: `DivergingBullet` (thanh phân kỳ tâm 0), `Segments10` (10 đoạn 0..1), `StatBar` (số + thước có vạch mốc/circuit-breaker), `IndicatorBlock` (heading+value+viz), `NoteItem` (dòng diễn giải) + helper `divColor`/`fmtDiv`/`gradientColorAt` (nội suy màu trên dải qua `decomposeColor`/`recomposeColor`).
  - `components/phaseChartPrimitive.ts` — custom `ISeriesPrimitive` (`PhaseNeonPrimitive`) cho PhaseFnxChart "Neon Regime": vẽ nền wash theo pha + vạch ranh giới đứt + đường giá **neon glow 3 lớp** (halo 6/glow 2.5/core 1.6) + huy hiệu đổi pha (▲▼↔⇄). Pattern như `charts/[id]/BandFillPrimitive.ts`.
  - `components/AiCommentBody.tsx` (**MỚI** 2026-07-11) — **1 nơi duy nhất** render mọi text nhận định AI (`market_cmt`/`stock_cmt`/`sector_cmt`/3 đoạn chỉ số). Gồm: auto-highlight bằng regex (`HL_RE`) → tên pha (UPTREND/DOWNTREND/TRANSITION/SIDEWAY) thành **pill màu pha**, số có dấu/`%` thành **số màu in nghiêng**; `splitLede` in-đậm-nghiêng câu đầu; prop `dropCap` (chữ cái đầu lớn, **KHÔNG nghiêng**, màu accent) + `accentColor`. `textAlign: justify`, **full-width** (không giới hạn `maxWidth`). Dùng bởi `SessionDiagnosis`, `BasketAiHero`, `IndustrySection`.
  - `components/SectorWaveStrip.tsx` + `components/SectorStrengthChart.tsx` (**MỚI** 2026-07-11) — cụm Sóng Ngành, **SVG tự vẽ** (KHÔNG lightweight-charts). Strip = "wave streaks" (gộp các đoạn ON liền nhau thành thanh); Chart = multi-line tương quan sức mạnh (ngành có sóng = **focus**, còn lại = **ghost**). Cả 2 có **crosshair nét đứt mảnh + tooltip cố định**. Bề rộng panel nhãn phải của line chart đo **động** bằng `getBBox` (`useLayoutEffect` + đo lại khi `document.fonts.ready`); mobile chỉ hiện số. Xem §7.
- **Shared:** `components/SharedPhaseHeader.tsx` → **CHỈ** `PhaseHero.tsx` (Ambient Signal). Khi `isLoading` → `PhaseHeroSkeleton` (thay spinner).
- **Skeleton loading:** `components/MarketPhaseSkeleton.tsx` export `PhaseHeroSkeleton` (mirror hero 3 cột) + `MarketPhaseTabSkeleton` (mirror 4 section Tab ①: chart 300, chart 345 + panel, KPI+chart 320, 3 bảng top lệnh) + **`BasketTabSkeleton({ isCore })`** (**MỚI** 2026-07-12 — mirror BasketTab: KPI tiles + timeframe + chart 320 → card AI → *(CORE)* cụm ngành → title Vận hành + dòng cơ cấu + SessionStrip → bảng nắm giữ (stats + 6 dòng) → grid 2 cột 2 bảng; row cao **40px** khớp bảng thật để không nhảy layout). MUI `Skeleton` bám sát layout. **2 giai đoạn loading:** (1) **auth-loading** — `OptionalAuthWrapper` nhận prop `loadingFallback` (thay `DefaultAuthSkeleton` generic); `PageContent` truyền `PhaseHeroSkeleton + TabSlider + MarketPhaseTabSkeleton`. (2) **data-loading** — `SharedPhaseHeader` → `PhaseHeroSkeleton`; `PageContent` (tab market) → `MarketPhaseTabSkeleton`; **`BasketTab` → `BasketTabSkeleton`** (2026-07-12 thay `LoadingState variant="spinner"`). ✅ **KHÔNG còn `LoadingState`/spinner nào trong page** (đã grep sạch).
- **Tab ① (FREE):** `components/MarketPhaseTab.tsx`, thứ tự: **Diễn biến và phân tích phiên** (`PhaseFnxChart` → `SessionDiagnosis`) → **Chi tiết các chỉ số** (`FnxTrendChart` → `AdvancedPanel`) → **Hiệu suất các danh mục đầu tư vs thị trường** (`BasketPerformanceChart`) → **Top lệnh lãi nhất mỗi danh mục** (`TopTradesSection`, cuối trang).
  - `FnxTrendChart.tsx` — reuse `MarketTrendChart` (markets), feed **riêng FNXINDEX** (REST `home_history_trend` + SSE `home_today_trend`).
  - `TopTradesSection.tsx` — 3 cột (3 danh mục) glass card, mỗi cột bảng **top 10 lệnh lãi nhất** (`phase_trading` closed, `exit_date` trong cửa sổ timeframe → sort `return_pct` desc → 10). Cột: Mã · Ra · Số phiên · Lãi%. Tái dùng `SERIES` (product→name→color) của `BasketPerformanceChart`. Timeframe **DÙNG CHUNG** selector với `BasketPerformanceChart` (state `range` lift lên `MarketPhaseTab`; chart thành controlled qua props `range`/`onRangeChange`; `windowStart` tính từ `perf` dates + `RANGE_DAYS`). FREE.
- **Tab ②③④ (PAID) — layout hiện tại (2026-07-12):** `components/BasketTab.tsx` thứ tự: **"Hiệu suất danh mục"** + `BasketPerformanceChart` → `BasketAiHero` (nhận định, DƯỚI chart) → **(CORE) `IndustrySection`** ("Luân chuyển sóng ngành" — **đã dời LÊN GIỮA**, không còn ở cuối) → **"Vận hành danh mục" + dòng lịch cơ cấu + `SessionStrip`** (cùng hàng) → `HoldingsTable` → **[`RankTable` | `OrderBook`]** (2 cột trên `lg`).
  - **Cờ layout `isConservative`** (= `conservative || aggressive`) truyền xuống 3 bảng qua prop **`conservativeLayout`**. CORE hiện đã được chuẩn hoá gần hết (chip Lý do, cột Trạng thái căn phải, dòng cơ cấu, bỏ cột "Tới cơ cấu"), phần còn khác biệt chỉ là: đổi tên cột Vào/Ra, layout bảng (fixed vs auto), padding mobile, ẩn cột mobile.
  - **`SessionStrip.tsx` (lookback):** 20 ô phiên (cũ→mới, màu pha từ `phase_daily`), ô chọn glow, click → 3 bảng hiện snapshot phiên đó: Holdings = `phase_basket` phiên đó; Rank = `phase_rank` phiên đó; OrderBook = trades closed `exit_date <= phiên` (stats theo tập lọc). `selectedDate` derived (`|| latestDate`). Hero/chart/cụm ngành KHÔNG theo phiên chọn.
  - **Dòng lịch cơ cấu (mọi tab):** ngay dưới title "Vận hành danh mục" → *"Kì tái cơ cấu tiếp theo còn **N** phiên"* (`next_rebalance_in` từ dòng rank bất kỳ). **Thay cho cột "Tới cơ cấu" đã BỎ HẲN** khỏi `RankTable`.
  - **`HoldingsTable`** — header stats (chỉ khi holding): **Lãi/lỗ danh mục · Số mã nắm giữ · Số mã cân nhắc (`vung_buffer`) · Số mã tiềm năng (`ung_vien`)** (2026-07-12 đổi tên từ "sắp ra"/"chờ vào" cho khớp nhãn chip). Cột theo 3 cấu hình: (A) phiên mới + đang giữ → **Mã · Ngày mua · Giá mua · Giá hiện tại · Số phiên · Trạng thái · Lãi/lỗ**; (B) phiên quá khứ + đang giữ → bỏ Giá hiện tại/Lãi-lỗ (không có MTM); (C) cash/downtrend → **Mã · % biến động 6T (`mom120`) · Thanh khoản (`vma60`)** + banner compact thay stats. **Sort (2026-07-12):** trạng thái (`STATUS_ORDER`: Nắm giữ→Cân nhắc→Tiềm năng→Quan sát) → **ngày mua mới→cũ** → **lãi→lỗ**. **Mobile (`<sm`, chỉ Phòng Thủ/Mạo Hiểm):** ẩn **Ngày mua + Giá mua + tên doanh nghiệp** (chỉ còn mã 3 chữ) — qua `useMediaQuery`, cột dựng lại theo tập đang hiện (`nOther`) nên `%` width không lệch. Desktop hiện **FULL tên doanh nghiệp** (đã bỏ `maxWidth` cắt "…").
  - **`OrderBook`** — chỉ lệnh **ĐÃ ĐÓNG**, `slice(0, 100)` (100 lệnh gần nhất). Stats **4 ô**: Số lệnh · Tỷ lệ thắng · **Lãi TB/lệnh (chỉ tính lệnh THẮNG)** · **Lỗ TB/lệnh (chỉ lệnh THUA)** — tách riêng để lãi không bị "hoà" vào lỗ. Cột: Mã · Ngày mua/Vào · Ngày bán/Ra · Số phiên · **Lãi/lỗ (in đậm)** · **Lý do = chip, căn phải, MỌI tab**: `downtrend`→"Thị trường rủi ro" (đỏ) · `rebalance`→"Tái cơ cấu" (vàng) · lạ→chip trung tính giữ nguyên chữ. Equal-height với RankTable (grid stretch + absolute-fill trên `lg` qua `rootSx` của AmbientCard; xs cap 420px).
  - **Cột Lãi/lỗ — quy ước "hoà vốn" (2026-07-12, cả 2 bảng):** giá trị **làm tròn về `0.0`** (kể cả `-0.0`) → hiện **`0.0%` KHÔNG dấu `+`/`-`** và **tô vàng** (`getPhaseMeta('transition')`). `isFlat` so **đúng chuỗi `(v*100).toFixed(1)`** mà `pct()` dùng → màu và chữ luôn khớp (không có ca "hiện 0.0% nhưng vẫn xanh").
  - **`RankTable`** (bảng "tiềm năng" / chờ vào) — cột: **Xếp hạng · Mã · [Ngành (CORE)] · % biến động 6T · Thanh khoản · Trạng thái (căn phải, chip)**. Cột **"Tới cơ cấu" đã bỏ hẳn** (mọi tab, 2026-07-12).
  - **Nền bảng:** cả 3 bọc `AmbientCard glowColor={accent} filled={false}` (trong suốt + viền mảnh + 1px accent). Theme global tô paper cho TableHead/Cell.head/TableRow → **đè lại bằng sx trên `<Table>`** (`transparent` + hover alpha nhẹ). Mọi row cao **cố định 40px** (row có/không chip cao bằng nhau → không flick khi đổi phiên).
  - **Responsive 3 bảng (2026-07-12) — xem §7** (`minWidth: 'max-content'` + nowrap header + `minWidth: 0` ở grid item).
  - `BasketAiHero.tsx` = thẻ FINEXT AI full-width (glass + ambient glow theo màu rổ + borderLeft accent), render `stock_cmt` qua `AiCommentBody` (dropCap). Tên rổ ưu tiên FE (`PRODUCT_FALLBACK_NAME`) hơn `display_name_vi` backend.
  - ⚠️ **`PortfolioComment.tsx` = DEAD CODE** (không còn import ở đâu — `IndustrySection` đã chuyển sang `AiCommentBody`). Chưa xoá (theo rule "thấy dead code thì nhắc, đừng xoá").

**Charts:** đều **lightweight-charts** (KHÔNG còn ApexCharts) — **ngoại lệ:** `SectorWaveStrip` + `SectorStrengthChart` là **SVG tự vẽ**.
- `PhaseFnxChart` = **"Neon Regime"** (redesign 2026-07-10, bỏ AREA fill): 1 LineSeries **trong suốt** (giữ price scale/crosshair/tooltip) + `PhaseNeonPrimitive` vẽ đường giá **neon glow 3 lớp** đổi màu theo pha + nền wash nhẹ + vạch ranh giới đứt + huy hiệu đổi pha; grid **chấm** (Dotted); overlay HTML **pulse dot** neo tại điểm cuối; vạch giá cuối = `createPriceLine` màu pha. Timeframe **3M/6M/1Y/2Y** (đổi khung = đổi visible range trên full data, có nút pan/zoom). Đặt trong Tab ①, **không bọc card**.
- `BasketPerformanceChart` = multi-line rebase 0% cumulative; benchmark FNX dashed; prop `products?`. KPI = **stat tiles nền gradient ambient theo màu line** (mobile: grid **2×2**; timeframe selector đẩy phải + **căn sát cạnh dưới** hàng tiles). **Không bọc card**.
  - **Resize (fix 2026-07-12):** dùng **`ResizeObserver` theo container** (thay `window.resize` — bắt được cả khi sidebar/grid đổi bề rộng) + gọi **`timeScale().fitContent()` sau mỗi lần đổi `width`**, gộp tick bằng `requestAnimationFrame`. **Lý do:** lightweight-charts giữ nguyên `barSpacing` khi đổi width → số nến hiển thị đổi → **"nhảy góc nhìn"**. Có `fitContent` thì cả cửa sổ dữ liệu **co kéo** khớp bề rộng mới (giữ start↔end), không flick.
- `FnxTrendChart`/`MarketTrendChart` = 4 line xu hướng Tuần/Tháng/Quý/Năm của FNXINDEX (timeframe 1M/3M/6M/1Y).

---

## 5. Nội dung 4 tab + mapping data

- **Shared header (chỉ hero, Ambient Signal):** chip phase (glyph trong ô glow + nhãn EN to + VN phụ) · dải **lịch sử pha 10 phiên** · KPI % nắm giữ = `min(market_exposure,1)×100` (số gradient + **thanh segmented 10 đoạn**) · cường độ = **bullet phân kỳ** `market_intensity`. Cả card ambient-tint theo màu pha.
  - **10 ô lịch sử pha (2026-07-12):** mỗi ô có **`Tooltip` nền glass** (`getGlassCard`, KHÔNG mũi tên) hiện **ngày + tên pha EN** (tô màu pha), căn trái; hover nhấc ô lên 2px. `history` đổi type `PhaseLabel[]` → **`{ date, phase }[]`** (`SharedPhaseHeader` map thêm `date`).
  - **Dòng "đổi từ …":** tên pha cũ được **tô đúng màu pha** (DOWNTREND=đỏ…) + **in đậm** — map qua `getPhaseMeta(prevPhaseEn.toLowerCase())`.
- **① Phân tích thị trường (FREE)** — thứ tự section: **Diễn biến và phân tích phiên** (biểu đồ FNX theo pha + **khối FINEXT AI "Nhận định thị trường"** = `market_cmt`, có dropCap) → **Chi tiết các chỉ số** (biểu đồ xu hướng FNXINDEX + `AdvancedPanel` + **khối FINEXT AI thứ 2 "Nhận định chỉ số"** = **`condition_cmt` + `structure_cmt` + `risk_cmt`** liền mạch, không dropCap) → **Hiệu suất các danh mục đầu tư vs thị trường** (`phase_perf`) → **Top lệnh lãi nhất mỗi danh mục** (`phase_trading`, 3 cột, cuối trang; chung timeframe với biểu đồ hiệu suất).
  - ⇒ **Cả 4 đoạn `phase_comment` đều đã hiển thị** (2026-07-11; trước chỉ có `market_cmt`).
- **② Danh mục Phòng Thủ / ③ Danh mục Mạo Hiểm:** "Hiệu suất danh mục" + curve rổ → `BasketAiHero` "Nhận định danh mục" (`stock_cmt`, **dưới** chart) → **"Vận hành danh mục" + dòng lịch cơ cấu + `SessionStrip`** (cùng hàng) → `HoldingsTable` (lãi/lỗ từng mã từ vị thế mở `phase_trading`; `held!==1` lọc sang RankTable) → **[`RankTable` tiềm năng | `OrderBook` sổ lệnh]** cạnh nhau (equal-height). 3 bảng đổi theo phiên chọn; hero+chart KHÔNG đổi. **Không** có tiêu đề riêng cho từng bảng.
- **④ Sóng Ngành (CORE):** như ②③, **thêm `IndustrySection` "Luân chuyển sóng ngành" ở GIỮA** (giữa *Hiệu suất* ↔ *Vận hành*, **không còn ở cuối** — 2026-07-11). Nội dung 1 `AmbientCard`: **`SectorWaveStrip`** (heatmap wave-streaks, chỉ ngành **từng có** tín hiệu) → **`SectorStrengthChart`** (line tương quan sức mạnh; ngành đang có sóng = focus, còn lại = ghost) → **nhận định ngành `sector_cmt`** (badge FINEXT AI + `AiCommentBody`). Tên ngành hiện **đầy đủ** qua `index_map` (`nameByCode`; thiếu → fallback về mã). KHÔNG theo phiên chọn (luôn phiên mới nhất). ⚠️ Khối nhận định AI **trùng lặp ở cuối tab đã bị bỏ**.
- **Trạng thái mã (`RANK_STATUS_META`, chốt tên):** `trong_ro`→**Nắm giữ** (xanh biển `#3b82f6`/`#2563eb`), `vung_buffer`→**Cân nhắc** (cam warning), `ung_vien`→**Tiềm năng** (`trend.up`), `ngoai`→**Quan sát** (disabled).
- **Downtrend / 100% tiền mặt** (`phase_basket.held` rỗng): HoldingsTable dùng cấu hình cột (C); thay dải KPI bằng **banner compact** (thanh dọc 4px màu pha = đỏ downtrend + "Thị trường đang ở trạng thái DOWNTREND" / "Đây chỉ là danh mục tham khảo.") — chiều cao khớp header stats để không flick khi đổi phiên (KHÔNG dùng màu vàng, KHÔNG tiêu đề "Danh mục dự kiến").

**Advanced panel — 7 chỉ số** (`AdvancedPanel.tsx`; backend projection `phase_daily` hiện có 14 field dữ liệu, panel dùng 7 metric; mỗi chỉ số ghép comment `phase_comment_indicator` nguyên văn). **1 AmbientCard duy nhất** (glow màu pha), **2 cột**: viz (trái, `justify-space-between`) · **Diễn giải** (phải, list 1 cột) — KHÔNG accordion, KHÔNG header nhóm, KHÔNG card lồng. 7 chỉ số liền mạch theo thứ tự Hướng → Tin cậy → Gate. Mảng phẳng `INDICATORS`:

| # | indicator_key | Cột phase_daily | viz |
|---|---|---|---|
| 1 | `cau_truc_xu_huong_tang` | `breadth_slow` | DivergingBullet ±1 |
| 2 | `cau_truc_xu_huong_giam` | `breadth_blend` | DivergingBullet ±1 |
| 3 | `tin_hieu_xu_huong_suy_yeu` | `breadth_aux` | DivergingBullet ±1 |
| 4 | `do_tin_cay_xu_huong` | `conf_dir` | Segments10 (0..1, tím) |
| 5 | `do_tin_cay_sideway` | `conf_flat` (**MỚI**) | Segments10 (0..1, tím) |
| 6 | `dong_pha_xu_huong_thanh_khoan` | `corr60` | StatBar diverging (fill tâm 0→marker) |
| 7 | `quan_tinh_bien_dong_gia` | `px_ret20` | StatBar circuit-breaker (**%**) |

**`px_ret20` (StatBar breaker):** KHÔNG chuẩn hoá — bộ ngắt mạch giá ngưỡng kinh tế thật. Thước −20%…+20%, **vùng đỏ [đầu→−10%] + vùng xanh [+10%→max]**, giữa trống; marker màu **nội suy theo dải đỏ→xanh** tại vị trí; hiển thị **% thô** (`×100`). `corr60` (StatBar diverging): thước −1..+1, fill tâm 0→marker. Cả 2 có **chip trạng thái màu theo marker, căn giữa marker** (clamp ở mép).

> **v3.4.2 — đổi ý nghĩa chỉ số #6:** `indicator_key` `muc_do_lan_toa_dong_tien` → **`dong_pha_xu_huong_thanh_khoan`**, nhãn "Mức độ lan tỏa dòng tiền" → **"Đồng pha xu hướng – thanh khoản"**. Ý nghĩa mới = đo mức ĐỒNG NHỊP giữa cấu trúc xu hướng và cường độ thanh khoản (~60 phiên), KHÔNG đo dòng tiền vào/ra. Đọc: **≥0.35 cùng nhịp · <0.35 rời nhịp · <0 ngược nhịp**. Cột `phase_daily.corr60` **giữ nguyên** tên + giá trị (chart/viz không đổi). DB đã backfill (chỉ còn key mới) — data cũ đã hết.
> **v3.4.2 — field mới `phase_daily.suppressed`** (bool): phiên tín hiệu giảm hội đủ nhưng chưa xác nhận → `market_exposure` bị hạ sâu (vd 0.30 thay vì 0.70; vẫn thang 0–2.0, nhãn trạng thái KHÔNG đổi). Backend đã project field trong `phase_daily.py`; frontend page hiện chưa khai báo/đọc field này. Knowledge/policy agent chỉ cho diễn đạt **"bối cảnh rủi ro cao"**, KHÔNG lộ cơ chế/gate/công thức.

Diễn giải mỗi dòng = chấm màu + tên + giá trị + comment nguyên văn → comment dài-ngắn không gây lệch layout.

`market_intensity` = output (ở hero) · `sub_signal`, `fnx_close` = DIAG (không comment; `sub_signal` không hiển thị). **ĐÃ BỎ cột:** `breadth_fast`/`breadth_mom`/`conf_breadth`/`composite_score`/`breadth_w|m|q|y`/`vsi_long`/`regime_active`. Web đã bỏ mọi tham chiếu; với data cũ trong Mongo (chưa chạy pipeline) → viz hiện `—`, comment key lạ bị bỏ qua.

---

## 6. Luật render / ràng buộc (đang tuân)

- Page `/phase` **chỉ đọc** các collection `phase_*` (và `ref_db.index_map` để map tên ngành), không recompute. Feed `phase_signal` vẫn do `/markets` dùng riêng, không được page này đọc.
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

### Chốt thêm 2026-07-11/12

- **Trình bày text AI (owner chốt qua mockup):** *Nhận định thị trường* + *các danh mục* = **kiểu C** (dropCap + lede in đậm-nghiêng + highlight); *Nhận định chỉ số* + *nhận định ngành* = **A+B** (lede + highlight, **KHÔNG** dropCap); *diễn giải chỉ số* (AdvancedPanel) giữ nguyên nhưng **cũng justify**. **Mọi chỗ in đậm đều in nghiêng luôn — TRỪ pill tên pha** (pill giữ `fontStyle: normal`). **DropCap KHÔNG nghiêng.** Comment **full-width** (đã bỏ `maxWidth: 74ch`). Meta header: dấu `·` đứng riêng, **không làm mờ**, có `·` ngay sau badge FINEXT AI.
- **Responsive 3 bảng vận hành (2026-07-12) — "snug fit tự động":** dùng **`minWidth: 'max-content'` + `width: '100%'` + header `whiteSpace: nowrap`** thay cho `tableLayout: fixed` + minWidth số cứng. ⇒ Sàn bề rộng **TỰ khít đúng chỗ cần cho tiêu đề 1 dòng** (không wrap tiêu đề, không phải đoán magic number); rộng hơn thì bảng fill card; hẹp hơn thì **cuộn ngang trong card**. Padding ngang co lại ở `xs/sm`. **Đánh đổi đã chấp nhận:** cột không còn "căn đều tuyệt đối" (bản chất của snug fit) — CORE vẫn giữ `fixed` cho `HoldingsTable` để cắt "…" tên công ty theo cột Mã 36%.
  - **Bẫy đã fix:** `RankTable`/`OrderBook` nằm trong **grid/flex item** → mặc định `min-width: auto` khiến bảng **tràn khỏi card thay vì cuộn**. Phải đặt **`minWidth: 0`** trên các Box bọc trong `BasketTab`. (`HoldingsTable` chạy được vì là block box thường.)
  - Hàng **stats** ở đầu bảng: **`flexWrap: nowrap` + `overflowX: auto`** (tràn ra rồi cuộn ngang, **không wrap**), item `flexShrink: 0`.
- **Nav icon `MarketPhaseNavIcon` — KHÔNG dùng hộp vuông XOAY:** icon = **đồng hồ định pha (gauge)** (owner bác đèn giao thông) + khung **Aurora** viền conic **tím gradient Finext** (không rainbow), hình tròn, nền lõi = **radial gradient trong suốt** (đậm tâm → loãng rìa, không nền đen đặc). **Hover KHÔNG đổi kích thước** (chỉ xoay nhanh + hào quang sáng hơn).
  - ⚠️ **Bài học:** `border-radius` chỉ làm *trông* tròn — hộp vẫn **vuông**; khi `rotate()` thì 4 góc quét ra `cạnh×1.41` và **transform tính vào vùng cuộn** → sinh **scrollbar ngang nhấp nháy** ở rail 50px. **Cách trị:** (a) hào quang **KHÔNG xoay** (chỉ breathing) và box đúng bằng khung — `blur` là *ink-overflow*, không sinh scroll; (b) vành conic **vẫn xoay nhưng bị clip trong `overflow: hidden` bo tròn** → góc vuông không bao giờ tràn.
- **Chart hiệu suất: luôn `fitContent()` sau khi đổi width** (xem §4) — nếu chỉ `applyOptions({width})` thì `barSpacing` giữ nguyên → nhảy góc nhìn.
- **Lãi/lỗ "hoà vốn" = VÀNG, không dấu** khi làm tròn về `0.0` (xem §4).
- **Loading = skeleton bám cấu trúc, KHÔNG spinner** (mọi tab).

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
- **Redesign tab rổ PAID → "AI Briefing" (owner chốt qua mockup B):** thứ tự mới `BasketAiHero` (hero AI full-width + 4 KPI pill: lãi/lỗ danh mục · tỷ trọng · số mã · tỷ lệ thắng) → curve hiệu suất → `HoldingsTable` (bỏ dải KPI) → **[RankTable | OrderBook]** 2 cột (`lg`) → (CORE) IndustrySection cuối. File mới `BasketAiHero.tsx`; KPI tính ở `BasketTab`; accent = màu rổ (`SERIES`); `PortfolioComment` giờ chỉ cho `sector_cmt`. Spec: `../superpowers/specs/` (brainstorm mockup `basket-tab-layouts.html`). `tsc` 0 lỗi.
- **Section mới "Top lệnh lãi nhất mỗi danh mục" (cuối Tab ①):** 3 cột (3 danh mục) × bảng top-10 `phase_trading` closed sort `return_pct` desc, lọc `exit_date` trong cửa sổ timeframe. Cột Mã·Ra·Số phiên·Lãi%. `useMarketPhaseData` thêm fetch `phase_trading`. **Timeframe lift lên `MarketPhaseTab`** — 1 selector (trên `BasketPerformanceChart`, đổi thành controlled qua props `range`/`onRangeChange`) điều khiển cả biểu đồ hiệu suất lẫn section này; `BasketPerformanceChart` export `SERIES`/`RANGE_DAYS`, giữ controlled/uncontrolled (BasketTab dùng uncontrolled, không đổi). Spec: `../superpowers/specs/2026-07-10-top-trades-section.md`. FREE.
- **Đổi tên tiêu đề (owner, giữ key nội bộ):** tab `market` "Thị trường chung" → **"Phân tích thị trường"**, `conservative` "Bảo Thủ" → **"Danh mục cẩn trọng"** (nhãn tab; series legend trong `BasketPerformanceChart` vẫn "Bảo Thủ"). Section Tab ①: "Chẩn đoán phiên" → **"Diễn biến và phân tích phiên"**, "Chỉ số nâng cao" → **"Chi tiết các chỉ số"**, "Hiệu suất 3 danh mục…" → **"Hiệu suất các danh mục đầu tư vs thị trường"**. Header subtitle viết lại.

### Tab rổ PAID — reorder + lookback 20 phiên + HoldingsTable 3 cấu hình (2026-07-10, sau "AI Briefing")

- **Reorder (owner):** đưa **title "Hiệu suất danh mục" + curve LÊN ĐẦU**, `BasketAiHero` "Nhận định danh mục" **xuống dưới chart** (bỏ 4 KPI pill — chuyển vào header `HoldingsTable`); thêm **title lớn "Vận hành danh mục" + `SessionStrip`** gộp 3 bảng (bỏ tiêu đề riêng của Holdings/Rank/OrderBook). Spec: [`../superpowers/specs/2026-07-10-basket-session-lookback.md`](../superpowers/specs/2026-07-10-basket-session-lookback.md).
- **Lookback:** `SessionStrip.tsx` mới (20 ô màu pha, giống dải hero) → click xem lại tối đa 20 phiên; **chỉ tác động 3 bảng dưới**, hero/chart giữ nguyên. Backend nâng limit: `phase_basket` 3→**60**, `phase_rank` → **20 phiên** (distinct dates `$gte` min). `useBasketData` fetch thêm `phase_daily` (màu pha strip).
- **HoldingsTable 3 cấu hình cột** theo phiên/trạng thái (A hiện tại-giữ / B quá khứ-giữ / C cash) — xem §4/§5. Bỏ hẳn cột **Tỷ trọng** (thêm **Số phiên**); prop `heldRanks`→`ranks` (để state C lấy `vma60`/`mom120`).
- **Width cột (nhiều vòng):** width-trên-cell → colgroup → **chốt đơn giản**: Mã cố định 36%, còn lại chia đều `(64/nOther)%`, **Trạng thái căn phải**. Banner downtrend: đỏ + compact (khớp chiều cao, tránh flick), bỏ "Danh mục dự kiến"/màu vàng.
- **Tên status (owner):** Nắm giữ / Cân nhắc / Tiềm năng / Quan sát (`RANK_STATUS_META`) — "Nắm giữ" màu xanh biển. **FNX-Index → FNXINDEX** toàn page (kể cả tooltip). Bảng (Holdings/Rank/OrderBook) **nền trong suốt** (`AmbientCard filled={false}` + đè theme paper qua sx `<Table>`); OrderBook chỉ lệnh đã đóng, sticky header, equal-height RankTable. `tsc --noEmit` = 0 lỗi.

---

## 9. Phiên 2026-07-11 → 07-12 (chuẩn hoá bảng · Sóng Ngành · text AI · nav · skeleton)

**A. 3 bảng "Vận hành danh mục"** — làm ở Phòng Thủ trước, owner duyệt rồi nhân sang Mạo Hiểm + Sóng Ngành:
- `RankTable`: **bỏ cột "Tới cơ cấu"** (thay bằng **dòng lịch cơ cấu** dưới title — nay áp **mọi tab**), "Hạng"→**"Xếp hạng"**, cột **Trạng thái căn phải** (chip). Nhãn cột đà giá → **"% biến động 6T"**.
- `OrderBook`: "Vào/Ra" → **"Ngày mua/Ngày bán"** (Phòng Thủ/Mạo Hiểm); **Lý do → chip, căn phải, MỌI tab**; 30 → **100 lệnh** gần nhất; thêm **Lỗ TB/lệnh**; **sửa lỗi tính "Lãi TB/lệnh"** — trước tính trên *tất cả* lệnh (lãi bị hoà vào lỗ), nay **chỉ tính lệnh THẮNG**; cột Lãi/lỗ **in đậm**.
- `HoldingsTable`: thêm cột **Ngày mua**; **row cao cố định 40px** (row có/không chip cao bằng nhau → hết flick khi đổi phiên); **sort mới** = trạng thái → ngày mua (mới→cũ) → lãi→lỗ; **mobile ẩn** Ngày mua/Giá mua/tên DN; desktop hiện **full tên DN**.
- Stats header: **"Số mã sắp ra / chờ vào" → "Số mã cân nhắc / tiềm năng"** (khớp nhãn chip trạng thái).
- **Lãi/lỗ hoà vốn** (làm tròn `0.0`) → `0.0%` không dấu + **vàng** (cả 2 bảng).
- **Responsive**: `max-content` + nowrap header + `minWidth: 0` ở grid item + stats cuộn ngang — xem §7.
- ❗ Owner từng chỉ sai chỗ 1 lần ("downtrend không có ngày mua thì thôi, không cần suy"), và bắt **rollback** khi tôi sửa nhầm `LABEL_W` của heatmap thay vì line chart → **đọc kỹ đang nói về biểu đồ nào**.

**B. Sóng Ngành (CORE)** — cụm ngành **dời lên giữa** (Hiệu suất ↔ Vận hành), **bỏ khối AI trùng lặp ở cuối**. Redesign qua mockup → owner chốt **"H2 wave-streaks + A focus/context line chart"**: 2 component SVG mới (`SectorWaveStrip`, `SectorStrengthChart`) + crosshair nét đứt + tooltip cố định. Tên ngành đầy đủ qua **crud mới `index_map`** (`ref_db`). `sector_cmt` render lại trong card.

**C. Nhận định AI** — component mới **`AiCommentBody`** gom toàn bộ cách render text AI (pill tên pha, số màu, lede, dropCap, justify, full-width) — xem §7 để biết kiểu nào dùng ở đâu. Tab market nay hiện **đủ 4 đoạn** `phase_comment` (backend mở `_PROJECTION`).

**D. Nav · chart · skeleton · hero**
- **`MarketPhaseNavIcon`** (gauge + khung Aurora tím) lên **đầu rail**; trị dứt điểm **scrollbar ngang do hộp vuông xoay** (xem §7 — bài học đáng nhớ).
- **`BasketPerformanceChart`**: `ResizeObserver` + `fitContent()` → hết **nhảy góc nhìn** khi đổi bề rộng cửa sổ.
- **`BasketTabSkeleton`** thay `LoadingState` spinner ở 3 tab rổ → page **không còn spinner nào**.
- **`PhaseHero`**: tooltip glass cho 10 ô lịch sử pha (ngày + pha EN); dòng "đổi từ …" tô **màu pha + đậm**.

**Sự cố / bài học phiên này:**
- Query `mongosh` vào **production bị DENY** → không verify được tên field `condition_cmt/structure_cmt/risk_cmt`; đã đi tiếp bằng **giả định + render fail-safe** (owner xác nhận đúng sau khi restart BE). Với DB production: **đừng cố query, hãy fail-safe.**
- `getBBox` đo **hụt** bề rộng nhãn khi font chưa load xong → phải đo lại ở **`document.fonts.ready`** (+ `rAF`).
- `tsc --noEmit` = **0 lỗi** sau mỗi bước (quy ước: **không tự chạy `next build`**, UI owner tự test).

---

## 10. Việc Còn Tồn / Lưu Ý

- **Repo không còn task "chưa commit/restart pipeline" của mốc 2026-07-12:** code hiện ở HEAD `445c4bb`, contract v3.4.2. Khi deploy một môi trường còn chạy image cũ, cần rebuild/restart backend và xác nhận pipeline/data tương ứng; đây là checklist deploy, không phải code pending trong repo.
- Migration key `dong_pha_xu_huong_thanh_khoan` được ghi nhận đã backfill ở v3.4.2. UI vẫn fail-safe: thiếu `conf_flat`/comment mới thì hiện `—` hoặc bỏ phần comment thay vì crash.
- ⚠️ **`components/PortfolioComment.tsx` = dead code** (không còn import ở đâu sau khi `IndustrySection` chuyển sang `AiCommentBody`). Chưa xoá — chờ owner quyết.
- **Tab PAID mất chart FNX ở đầu** (do dời chart vào Tab ①). Nếu owner muốn PAID vẫn có → thêm lại riêng cho `BasketTab` (chưa làm).
- Heatmap `phase_stock` (consensus 0–2 rổ giữ) chưa làm.
- Toggle đòn bẩy 2.0x + cảnh báo margin: chưa làm (chốt 1.0x).
- `suppressed` đã được backend trả ra nhưng page `/phase` chưa consume/type field; hiện field này chủ yếu phục vụ contract dữ liệu/agent policy.

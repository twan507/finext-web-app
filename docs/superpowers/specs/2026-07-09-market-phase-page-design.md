# Spec — Page "Giai đoạn thị trường" (4 tab)

- **Ngày:** 2026-07-09
- **Trạng thái:** DESIGN đã duyệt (functional + UI). Chờ viết plan triển khai.
- **Nguồn thiết kế sản phẩm:** `notebook-runner/projects/finext/docs/phase_calculation/06_product_plan.md` (§9), `07_customer_numbers.md`, `08_serving_layer.md`.
- **Phạm vi spec này:** Increment 1 = khung page + Tab ① (FREE). Các tab PAID có roadmap ở §3, sẽ có spec/plan riêng.

---

## 1. Bối cảnh & mục tiêu

Sản phẩm "giai đoạn thị trường" là mặt tiền khách hàng của một app **tín hiệu + danh mục** (app chỉ hiển thị khuyến nghị; khách tự đặt lệnh ở CTCK). Mô hình **freemium**:

- **Tab ① Thị trường chung (FREE)** = phễu: tín hiệu **WHEN** — hôm nay thị trường ở pha nào, nên nắm giữ bao nhiêu %.
- **Tab ②③④ (PAID)** = 3 rổ danh mục (`CONSERVATIVE` Bảo Thủ / `AGGRESSIVE` Tăng Trưởng / `CORE` Sóng Ngành) — tín hiệu **WHICH**.

Page đặt trong app Finext hiện có (`finext-nextjs` + `finext-fastapi`), chung khu **"Công cụ"** ở sidebar với Chart / Watchlist / Bộ lọc.

**Mục tiêu increment 1:** dựng khung page 4 tab + hoàn thiện Tab ① đọc dữ liệu thật từ `stock_db`, thiết lập mọi pattern (routing, nav, tabs, serve REST, gating, design) để 3 tab PAID ráp vào sau.

---

## 2. Nguồn dữ liệu

- 9 collection `phase_*` nằm ở Mongo **`stock_db`** (KHÁC `user_db`). Backend đã kết nối sẵn: `app/core/database.py` → `db_names_to_connect = ["user_db", "stock_db"]`. Đọc **read-only**.
- Cập nhật **batch EOD 1 lần/ngày** (không realtime). `phase_daily` ghi cuối → `max(phase_daily.date)` = phiên mới nhất, đảm bảo các bảng fnx10 đã xong. `phase_comment*` (fnx11) tới trễ vài phút.
- **Increment 1 chỉ dùng 3 collection:**

| Collection | Vai trò | Field chính dùng ở Tab ① |
|---|---|---|
| `phase_daily` | Tín hiệu ngày (FREE) + lịch sử chart | `date`, `phase_label` (uptrend/downtrend/sideway/transition), `market_exposure` (0..2), `market_intensity` (−1..+1), `fnx_close`; + BREADTH/REGIME cho panel Nâng cao |
| `phase_comment` | Chẩn đoán phiên (FREE) | `date`, `market_cmt` (render nguyên văn), `source` |
| `phase_perf` | Return ngày để dựng curve | `date`, `product` (gồm `FNX`), `ret_1d_1x` (mặc định 1.0x), `ret_1d` (2.0x — KHÔNG dùng ở increment 1) |

---

## 3. Phạm vi & phân rã increment (roadmap)

| Increment | Nội dung | Collection thêm |
|---|---|---|
| **1 (spec này)** | Khung page (route + nav + SubNavbar 4 tab + serve REST) + **Tab ① FREE**. 3 tab PAID = placeholder gated. | `phase_daily`, `phase_comment`, `phase_perf` |
| 2 | Tab ② Bảo Thủ (PAID): holdings + bảng chỉ tiêu mã + curve + sổ lệnh | `phase_basket`, `phase_rank`, `phase_comment_basket`, `phase_trading` |
| 3 | Tab ③ Tăng Trưởng (clone ②, khác data) | — |
| 4 | Tab ④ Sóng Ngành: thêm tầng ngành (rank + heatmap) | `phase_rank`(sector), `phase_industry`, (heatmap `phase_stock`) |

Quyết định còn mở (không chặn increment 1): vị trí heatmap `phase_stock` (tab ① hay tab rổ) — chốt ở increment 4.

---

## 4. Kiến trúc Backend (REST keyword, one-shot)

Mở rộng đúng pattern SSE crud sẵn có (`app/crud/sse/`), phục vụ qua endpoint REST đã có `GET /api/v1/sse/rest/{keyword}` (trả `StandardApiResponse[T]`, hỗ trợ projection/sort). **Frontend gọi 1 lần, không stream, không polling.**

**Tạo 3 crud** (mỗi file theo mẫu `get_database(STOCK_DB)` + `get_collection_records(stock_db, "<collection>", ...)`):

- `app/crud/sse/phase_daily.py` — trả **toàn bộ lịch sử** `phase_daily` sort `date` asc (client lấy phần tử cuối làm phiên hiện tại + cả mảng cho chart). Projection loại `_id`.
- `app/crud/sse/phase_comment.py` — trả row **mới nhất** theo `date` desc limit 1 (chẩn đoán phiên hiện tại).
- `app/crud/sse/phase_perf.py` — trả **toàn bộ lịch sử** mọi `product` (gồm `FNX`) sort `date` asc; client tự lọc + cộng dồn `Π(1+ret_1d_1x)` theo cửa sổ.

**Sửa** `app/crud/sse/__init__.py`: import + đăng ký 3 keyword vào `SSE_QUERY_REGISTRY`: `phase_daily`, `phase_comment`, `phase_perf`.
Lưu ý: keyword `phase_signal` (feed cũ, chết) giữ nguyên, KHÔNG đụng.

---

## 5. Kiến trúc Frontend

**Route:** `app/(main)/market-phase/` → `page.tsx` (server; metadata) + `PageContent.tsx` (client).

**Nav:** thêm 1 `NavItem` vào `navigationStructure` trong `app/(main)/LayoutContent.tsx` (nhóm "Công cụ"):
`{ text: 'Giai đoạn thị trường', href: '/market-phase', icon: <TrafficOutlined /> }`.

**Tabs:** thanh underline custom theo pattern markets SubNavbar (KHÔNG dùng MUI `<Tabs>`), đồng bộ `?tab=`:
`market` (mặc định) · `conservative` · `aggressive` · `core`. Active `borderBottom '3px solid primary.main'`. Đọc/ghi qua `useSearchParams` + `router.push('?tab=...', { scroll:false })`.

**Component (tạo mới, mỗi file ≤ ~150 dòng):**
- `PageContent.tsx` — title + SubNavbar + điều phối panel theo `?tab=` + gating.
- `components/MarketPhaseTab.tsx` — Tab ① (compose các khối dưới).
- `components/PhaseHero.tsx` — hero: chip phase + KPI % + cường độ (bullet).
- `components/PhaseFnxChart.tsx` — **ApexCharts** (line FNX + `annotations.xaxis` range fill theo phase — native band, opacity thấp).
- `components/SessionDiagnosis.tsx` — card chẩn đoán phiên (`market_cmt`).
- `components/BasketPerformanceChart.tsx` — **lightweight-charts** theo pattern `MarketTrendChart.tsx`: 3 rổ + FNX, rebase 0%, TimeframeSelector.
- `components/AdvancedPanel.tsx` — accordion BREADTH/REGIME (mặc định đóng).
- `components/PaidTabPlaceholder.tsx` — nội dung cho tab PAID (gated).
- `hooks/useMarketPhaseData.ts` — TanStack Query one-shot gọi 3 keyword (`staleTime` dài, KHÔNG `refetchInterval`).
- `types.ts` — kiểu `PhaseDaily`, `PhaseComment`, `PhasePerfRow`.

**Data fetch:** dùng `apiClient` + TanStack Query, gọi 1 lần `GET /api/v1/sse/rest/{phase_daily|phase_comment|phase_perf}`. Không loop.

---

## 6. Mô hình gating

Dùng component có sẵn `components/auth/OptionalAuthWrapper.tsx` (`requireAuth` + `requiredFeatures?: string[]`, check `features.includes`, gate = blur overlay + modal).

- **Tab ① (FREE):** `<OptionalAuthWrapper requireAuth>` — chỉ cần đăng nhập.
- **Tab ②③④ (PAID):** `<OptionalAuthWrapper requireAuth requiredFeatures={ADVANCED_AND_ABOVE_STRICT}>`.
  - Thêm hằng mới trong `components/auth/features.ts`:
    `ADVANCED_AND_ABOVE_STRICT = [ADVANCED, PARTNER, MANAGER, ADMIN]` (advanced-trở-lên, KHÔNG gồm BASIC).
  - **KHÔNG sửa** `ADVANCED_AND_ABOVE` global (đang gộp BASIC do pivot) để không re-gate toàn app. Đây là "kích hoạt lại guard cũ" chỉ cho các tab PAID.

Increment 1: `PaidTabPlaceholder` bọc trong wrapper PAID → user thường thấy overlay "nâng cấp tài khoản", user advanced thấy nội dung placeholder "đang phát triển".

---

## 7. UI/UX Design Plan

### 7.1 Anchor design system (reuse, không hardcode)
Import từ `theme/tokens.ts` (`getResponsiveFontSize`, `fontWeight`, `transitions`, `getGlassCard/Highlight/EdgeLight`, `borderRadius`, `shadows`) và `theme/colorHelpers.ts` (`getTrendColor`). Màu qua `theme.palette.trend.{up #25b770, down #e14040, ref #ffc752, ceil, floor}` và primary violet. Card = glass recipe. Section header = `ChartSectionTitle`. Period switch = `TimeframeSelector`. States = `LoadingState/EmptyState/ErrorState`. Spacing raw MUI (`py:3`, `mb:2`, `mt:4`, `gap:2`). Mọi số: `font-variant-numeric: tabular-nums`. Light/dark qua `theme.palette.mode`.

### 7.2 Bản đồ phase (accessibility: màu + icon + nhãn)
**Nhãn chính = tên EN** (theo doc-06 §9.1 rule 6 + quyết định của owner), nghĩa VN ở dòng phụ/tooltip.

| `phase_label` | Màu token | Icon | EN (chính) | VN (phụ) |
|---|---|---|---|---|
| `UPTREND` | trend.up | ▲ | UPTREND | Tăng giá |
| `DOWNTREND` | trend.down | ▼ | DOWNTREND | Giảm giá |
| `SIDEWAY` | trend.ref | ↔ | SIDEWAY | Đi ngang |
| `TRANSITION` | warning `#ed6c02` | ⇄ | TRANSITION | Chuyển pha |

### 7.3 Bố cục Tab ① (F-pattern, tín hiệu quan trọng ở trên)
1. **Title** `h1` "Giai đoạn thị trường" + dòng phụ "Dữ liệu phiên {date} · cập nhật EOD".
2. **SubNavbar 4 tab.**
3. **Hero** (glass, grid 3 cột, stack dọc ở mobile):
   - **Chip phase**: dot+icon+nhãn EN to + VN nhỏ; nền = màu phase 12% + viền 42%. Dưới: dòng derive-at-read ("giữ pha N phiên / gần nhất đổi từ X").
   - **KPI % nắm giữ**: nhãn nhỏ "Tỷ trọng nắm giữ gợi ý" → số `min(market_exposure,1)×100` cực lớn → bullet bar 0–100% → ngữ cảnh tiền mặt. (1.0x; bỏ 2.0x.)
   - **Cường độ**: `market_intensity` dạng **thanh bullet phân kỳ** (tâm 0, trái đỏ → phải xanh), marker + giá trị + nhãn zone.
4. **Chart FNX + band** (`ChartSectionTitle` + card): **ApexCharts** line FNX rõ nét + `annotations.xaxis` (x→x2) fill màu theo phase opacity ~13% + legend màu→phase.
5. **Card chẩn đoán phiên**: viền trái accent violet, verdict 1 dòng đậm, `market_cmt` nguyên văn, pill "Phân tích tự động" + "Cập nhật lúc HH:MM". (KHÔNG kèm disclaimer nặng — theo yêu cầu owner.)
6. **Chart hiệu suất 3 rổ vs FNX** (lightweight-charts, pattern `MarketTrendChart.tsx`): `TimeframeSelector` [1M/3M/1N/Tất cả] góc phải; rebase **0% cumulative** tính lại theo cửa sổ (không rebase 1 lần rồi zoom); line (không area); màu rổ categorical (KHÔNG dùng đỏ/xanh trend cho định danh series); FNX **dashed xám mờ (`LineStyle.Dashed`) vẽ sau**; `priceLine` tại 0%; strip % cuối kỳ (dấu + màu theo dấu); tooltip crosshair sort tốt→xấu.
7. **Panel "Chỉ số nâng cao"** (accordion, mặc định đóng): BREADTH/REGIME, ghi rõ "quan sát nội bộ · không phải khuyến nghị".

### 7.4 Responsive / light-dark / states
Hero `flex/grid` collapse 1 cột ở `< md`; section stack dọc. ApexCharts `dynamic(ssr:false)` + `key={theme.palette.mode}`; lightweight-charts nền `transparent`. Loading = skeleton hình chart; comment thiếu → ẩn khối (EmptyState nếu cả tab rỗng); lỗi → `ErrorState`.

---

## 8. Ràng buộc & luật render

- **Chỉ đọc** 9 collection `phase_*`; không recompute tín hiệu.
- **Bí mật thuật toán** (chủ yếu ảnh hưởng tab PAID ở increment sau): không mô tả tiêu chí xếp hạng, không nói "biến động thấp", không lộ số ngành, không render cột always-0. Ở increment 1: panel Nâng cao chỉ hiện field OUTPUT của `phase_daily`, gắn nhãn "quan sát", không phrasing khuyến nghị.
- **Disclaimer:** theo yêu cầu owner, **bỏ** khối disclaimer 6 điểm của doc-07 trên page. Giữ pill "Phân tích tự động" + timestamp ở card chẩn đoán.
- **Staleness:** hiển thị "cập nhật {date}"; (banner cảnh báo >30h để increment sau).
- Tuân MUI sx units (`p:1`=8px, quote `'1px'` cho pixel). Component ≤ ~150 dòng. Không thêm dependency. Diff nhỏ, có `diff` block khi sửa code.

---

## 9. Success criteria (verify được)

1. Backend `uv run` import OK; `GET /api/v1/sse/rest/phase_daily` (và `phase_comment`, `phase_perf`) trả `StandardApiResponse` với rows từ `stock_db`.
2. `/market-phase` (đã login): Tab ① hiển thị chip phase (EN) + % + bullet cường độ + chart FNX-band + `market_cmt` + chart hiệu suất 3 rổ đổi cửa sổ (rebase lại) được.
3. Tab PAID: user thường → overlay nâng cấp; user advanced → placeholder "đang phát triển".
4. `npm run build` / typecheck pass. **UI owner tự test** (không dựng browser/Playwright).

---

## 10. Ngoài phạm vi increment 1

Nội dung 3 tab PAID; heatmap `phase_stock`/`phase_industry`; toggle 2.0x + cảnh báo margin; banner staleness nặng; page phụ methodology/onboarding (doc-07 numbers).

---

## 11. Files tạo/sửa (increment 1)

**Backend:** tạo `crud/sse/phase_daily.py`, `crud/sse/phase_comment.py`, `crud/sse/phase_perf.py`; sửa `crud/sse/__init__.py`.
**Frontend:** tạo `app/(main)/market-phase/{page.tsx, PageContent.tsx, types.ts}`, `.../components/{MarketPhaseTab, PhaseHero, PhaseFnxChart, SessionDiagnosis, BasketPerformanceChart, AdvancedPanel, PaidTabPlaceholder}.tsx`, `.../hooks/useMarketPhaseData.ts`; sửa `app/(main)/LayoutContent.tsx` (NavItem), `components/auth/features.ts` (thêm `ADVANCED_AND_ABOVE_STRICT`).

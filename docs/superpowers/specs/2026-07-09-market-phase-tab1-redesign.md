# Spec — Redesign Tab ① "Thị trường chung" (Ambient Signal)

- **Ngày:** 2026-07-09
- **Trạng thái:** DESIGN đã duyệt qua mockup (visual companion). Chờ viết plan triển khai.
- **Phạm vi:** CHỈ đổi phần nhìn (visual). Giữ nguyên toàn bộ dữ liệu, logic tính toán, và 2 biểu đồ lightweight-charts. Áp ngôn ngữ **Ambient Signal** (đã dùng ở `PhaseHero`, owner đã duyệt) cho toàn Tab ①.
- **Không đụng:** backend, data hooks, gating, các tab PAID, nội dung comment (render nguyên văn như cũ).

---

## 1. Mục tiêu

Đồng bộ Tab ① với hero panel đã redesign: nền glass + **ambient glow** + top accent phát sáng, số liệu **trực quan hoá** (bullet / bar / segmented) thay vì text đơn điệu, và **bỏ accordion** ở panel Chỉ số nâng cao (show hết). Tránh cảm giác "AI blob" (lưới card đều tăm tắp) bằng cách **nhóm ngữ nghĩa + phân cấp thị giác**.

Ràng buộc giữ nguyên (từ doc-08 §6): chỉ đọc, không lộ tiêu chí thuật toán, comment render nguyên văn, pill "Phân tích tự động" + timestamp, nhãn "quan sát nội bộ · không phải khuyến nghị" ở panel nâng cao.

---

## 2. Component tái dùng: `AmbientCard`

Tạo mới `components/AmbientCard.tsx` — card kính dùng chung cho mọi section (giảm lặp code, mỗi file nhỏ):

- Base = `getGlassCard(isDark)` + `getGlassEdgeLight` (giữ chất kính app).
- Prop `glowColor: string` → 2 lớp:
  - **Top accent** (`::before` hoặc layer): `linear-gradient(90deg, transparent, alpha(glowColor, isDark?.7:.55), transparent)` + soft box-shadow.
  - **Ambient radial** (layer con, `pointerEvents:none`): radial glow tint theo `glowColor` (opacity dark ~.10–.14, light ~.06–.09), vị trí góc tuỳ prop `glowAnchor?` ('top-left' | 'bottom-right').
- Props: `glowColor`, `glowAnchor?`, `sx?`, `children`, `padding?`.
- Theme-aware: mọi màu qua `alpha()`, glow dịu ở light mode.
- **KHÔNG refactor `PhaseHero`** (đang chạy tốt, đã duyệt) — chấp nhận trùng nhẹ recipe; có thể migrate sau nếu muốn.

---

## 3. Bốn section của Tab ① (thứ tự giữ nguyên)

Lưu ý vị trí thực tế trong cây component:
- Section 1 (chart FNX) nằm trong **`SharedPhaseHeader`** (hiển thị chung trên slider, mọi tab thấy) → bọc AmbientCard sẽ đồng bộ luôn header các tab.
- Section 2–4 nằm trong **`MarketPhaseTab`** (riêng Tab ①).

### 3.1 — Diễn biến & giai đoạn thị trường (chart FNX) · `SharedPhaseHeader`
- Giữ `ChartSectionTitle` (title + description + updateTime) ở ngoài như cũ.
- Bọc `PhaseFnxChart` trong `AmbientCard glowColor={phaseColor}` (màu pha hiện tại). Timeframe selector nằm trong card (như hiện tại, trong chart component — không đổi).
- Chart giữ nguyên logic; nền trong suốt để lộ ambient.

### 3.2 — Chẩn đoán phiên (`SessionDiagnosis`)
- Bọc `AmbientCard glowColor={primary}` (tím) thay cho glass card + borderLeft hiện tại.
- Thêm ô icon **✦** 44px bo góc, nền gradient tím + glow (đồng bộ ô glyph hero).
- Giữ: pill "Phân tích tự động", giờ cập nhật, `market_cmt` nguyên văn (`whiteSpace:pre-line`).

### 3.3 — Hiệu suất 3 danh mục (`BasketPerformanceChart` + wrapper)
- KPI strip hiện tại → **stat tiles**: mỗi rổ = ô bo góc nhỏ (chấm màu + tên + % lớn tabular-nums), FNX tile mờ hơn. Sort tốt→xấu giữ nguyên logic `endReturns`.
- Bọc phần chart trong `AmbientCard glowColor={primary}` (glowAnchor bottom-right).
- Giữ nguyên: rebase 0%, TimeframeSelector, tooltip, màu categorical series, đường FNX dashed.
- Ghi chú: chỉ đổi phần trình bày KPI + wrapper; **không đụng logic chart** trong `BasketPerformanceChart`. Stat tiles có thể tách `PerfStatTiles.tsx` để giữ file gọn.

### 3.4 — Chỉ số nâng cao (`AdvancedPanel`) — VIẾT LẠI
**Bỏ `Accordion`** → luôn hiện. Layout **Bento 4 cụm ngữ nghĩa** (grid 12 cột, stack 1 cột ở `< md`):

| Cụm | Span (md) | glowColor (ambient) | Chỉ số |
|---|---|---|---|
| **Sức khoẻ nền thị trường** | 8 | **màu pha hiện tại** (động) | Độ rộng đa khung (4), Độ rộng nền, Độ ổn định độ rộng |
| **Chẩn đoán hướng** | 4 | `primary` (tím) | Độ nghiêng xu hướng, Tín hiệu phụ |
| **Cảnh báo rủi ro** | 6 | `trend.down` (đỏ) | Cảnh báo giảm nhanh (3), Trigger giảm độc lập |
| **Dòng tiền & xu hướng** | 6 | `trend.up` (xanh) | Xu hướng 1 năm, Thanh khoản dẫn dắt, Đồng pha rộng–khoản, Đồng pha giá 20p |

Mỗi cụm = `AmbientCard` + header (icon nhỏ bo góc + nhãn uppercase màu nhận diện cụm).

**Mini-viz theo bản chất chỉ số** (tách `IndicatorViz.tsx` với 3 primitive):
- **VBars** (nhiều cột mọc từ baseline 0): Độ rộng đa khung (Tuần/Tháng/Quý/Năm), Cảnh báo giảm nhanh (Tổng hợp/Nhanh/Động lượng). Cột âm đỏ xuống, dương xanh lên.
- **DivergingBullet** (thanh phân kỳ tâm 0 + marker glow, đồng ngôn ngữ với cường độ hero): các chỉ số 1 giá trị theo domain:
  - `−1..+1`: breadth_slow, breadth_aux, vsi_long, corr60
  - `±3`: composite_score (điểm xu hướng 1 năm)
  - `±35%`: px_ret20 (đồng pha giá 20p, hiển thị `%`)
- **Segments10** (10 đoạn tím, domain `0..1`, đồng ngôn ngữ với thanh tỷ trọng hero): conf_breadth (Độ ổn định), conf_dir (Độ nghiêng xu hướng).
- **Chip**: sub_signal → "— không có" (dashed) hoặc nhãn tín hiệu (`SUB_SIGNAL_LABEL`).

**Màu giá trị:** diverging → `trend.up`/`trend.down`/`trend.ref` theo dấu; confidence (0..1) → `primary`.
**Comment:** mỗi chỉ số có comment (`phase_comment_indicator`) render nguyên văn dưới viz (như cũ). "Chẩn đoán hướng" không có comment.
**Domain marker:** ghi nhãn 2 đầu (−1/+1, −3/+3, −35%/+35%, nhiễu/ổn định) cỡ nhỏ.

**KHÔNG thêm** sparkline 60 phiên (giữ mật độ thấp, tránh blob). Có thể bổ sung sau nếu owner muốn.

---

## 4. Files tạo/sửa

**Tạo:**
- `components/AmbientCard.tsx` — card kính + ambient glow tái dùng.
- `components/IndicatorViz.tsx` — 3 primitive: `VBars`, `DivergingBullet`, `Segments10` (+ chip helper).
- `components/PerfStatTiles.tsx` — stat tiles cho section hiệu suất (tách khỏi chart).

**Sửa:**
- `AdvancedPanel.tsx` — viết lại: bỏ accordion, 4 cụm bento, dùng IndicatorViz. Giữ `BLOCKS`/`DIAG` mapping (bổ sung `group` + `viz` + `domain` cho mỗi block).
- `SessionDiagnosis.tsx` — bọc AmbientCard + icon ✦.
- `SharedPhaseHeader.tsx` — bọc `PhaseFnxChart` trong AmbientCard (glowColor = phaseColor).
- `MarketPhaseTab.tsx` — chèn PerfStatTiles + AmbientCard quanh BasketPerformanceChart; bố cục section giữ nguyên.

**KHÔNG sửa:** `PhaseHero.tsx`, `PhaseFnxChart.tsx` (chart nội bộ), `BasketPerformanceChart.tsx` (logic chart), types, hooks, phaseMeta, backend.

---

## 5. Ràng buộc kỹ thuật

- TS strict, không `any` vô cớ. Component ≤ ~150 dòng (lý do tách 3 file mới). Không thêm dependency.
- Mọi màu/spacing qua theme + tokens (`alpha`, `getGlassCard`, `borderRadius`, `fontWeight`, `getResponsiveFontSize`). Light/dark qua `theme.palette.mode`.
- Số: `fontVariantNumeric: tabular-nums`.
- Responsive: bento 12-col → 1 cột ở `< md`; VBars/tiles wrap gọn.
- Diff nhỏ, có `diff` block khi sửa; owner tự test UI (không Playwright).

## 6. Success criteria

1. `tsc --noEmit` = 0 lỗi; `npm run build` pass.
2. Tab ①: 4 section đều nền ambient đồng bộ hero; panel nâng cao show hết (không accordion), 4 cụm màu nhận diện, mỗi chỉ số có viz đúng domain + comment nguyên văn.
3. "Sức khoẻ nền" ambient đổi theo pha hiện tại.
4. Light + dark đều đẹp, không vỡ layout mobile.
5. Không thay đổi số liệu/hành vi chart so với hiện tại.

## 7. Ngoài phạm vi

Sparkline chỉ số; đụng tab PAID; đổi logic chart; toggle 2.0x; heatmap. (Giữ như doc-08 §9.)

# Spec — Redesign PhaseFnxChart "Neon Regime" (2026-07-10)

> Redesign thuần visual cho `PhaseFnxChart` (biểu đồ giai đoạn thị trường, tâm điểm page `/market-phase`).
> Chốt qua 3 vòng mockup visual-companion (owner duyệt bản `neon-regime-combined-v2.html` trong `.superpowers/brainstorm/1441-1783646875/content/`).
> Data/props/hành vi giữ nguyên — chỉ đổi cách vẽ.

## 1. Vấn đề

Bản hiện tại: mỗi đoạn phase là 1 `AreaSeries` fill chạm đáy → các khối màu loang lổ, rối, flat (owner chê xấu).

## 2. Thiết kế đã chốt — "Neon Regime" (A) + 3 yếu tố Aurora (B)

Nền tảng **hướng A**, trộn 3 yếu tố **hướng B**, tinh chỉnh v2 (line mảnh hơn, glow neon nhẹ):

1. **Bỏ hẳn area fill.** Đường giá = line liên tục đổi màu theo pha (màu từ `phaseMeta.ts`).
2. **Line mảnh + glow neon nhẹ 3 lớp** (thông số dark mode, chốt từ mockup v2):

   | Lớp | width | blur (SVG stdDeviation tương đương) | opacity |
   |---|---|---|---|
   | Core (trên cùng) | 1.6 | — | 1.0 |
   | Glow sát | 2.5 | 2.5 | 0.55 |
   | Halo rộng | 6 | 6 | 0.18 |

   Canvas dùng `shadowBlur`/vẽ chồng lớp để đạt hiệu ứng tương đương; implementer tune cho khớp mockup.
3. **Nền wash dọc theo pha, RẤT nhẹ:** mỗi đoạn pha 1 dải gradient từ trên xuống, alpha đỉnh ≤ 0.07, tan hết trước ~50% chiều cao plot.
4. **Ranh giới pha:** vạch đứt dọc (dashed drop-line) màu theo **pha mới**, alpha ~0.35, full chiều cao plot + **glyph chip** (▲▼↔⇄ từ `phaseMeta.glyph`) ở mép trên, hình tròn ~9px màu pha mới có quầng halo mờ + viền. Chip **ẩn** nếu cách chip trước < ~28px (range dài nhiều boundary → chỉ giữ drop-line, tránh rối).
5. **Dotted grid:** grid ngang `LineStyle.Dotted`, vertLines off (giữ như hiện tại).
6. **Điểm cuối (phiên mới nhất):** dot màu pha hiện tại + vòng pulse animation (~2s loop, r 3→10 fade out).
7. **Vạch giá cuối + price tag:** dashed price line tại close cuối, màu pha hiện tại, axis label bật (dùng `createPriceLine`, không dùng `lastValueVisible` vì line color transparent).
8. **Chip pha hiện tại:** chip glass nhỏ ("TRANSITION · Chuyển pha" — EN to + VN phụ, màu pha) neo gần điểm cuối line (HTML overlay, clamp trong container).
9. **Tooltip + crosshair giữ nguyên hành vi**; nền tooltip nâng lên kính mờ (blur) cùng ngôn ngữ Ambient; crosshair marker viền đổi theo màu pha điểm đang hover (applyOptions khi crosshair move).

**Theme-aware (light mode):** dùng màu light từ `phaseMeta`, giảm hiệu ứng: glow sát ~0.35, halo ~0.10, wash ~0.05, drop-line ~0.25 (pattern như `AmbientCard`).

## 3. Kiến trúc render

- **1 series nền vô hình** (LineSeries, color transparent) giữ full data → price scale, crosshair, tooltip.
- **1 custom series primitive** (`ISeriesPrimitive`, file mới `phaseChartPrimitive.ts` cùng thư mục) vẽ toàn bộ visual theo `runs` (đoạn pha):
  - zOrder bottom: wash bands.
  - zOrder normal/top: drop-lines → 3 lớp line glow theo từng đoạn → glyph chips → pulse dot (rAF + `requestUpdate()`, dừng khi tab ẩn).
- Giữ nguyên: props (`daily`, `height`), `TimeframeSelector` (3M/1Y/2Y/5Y/Tất cả), memo `runs`/`byTime`, tooltip custom, `fixLeftEdge/fixRightEdge`, không scroll/scale.

## 4. Phạm vi file

- Sửa: `finext-nextjs/app/(main)/market-phase/components/PhaseFnxChart.tsx`
- Mới: `finext-nextjs/app/(main)/market-phase/components/phaseChartPrimitive.ts`
- KHÔNG đụng file khác. Không dependency mới.

## 5. Ràng buộc & verify

- TS strict, không `any` trần (lightweight-charts `LineWidth` union → cast có comment).
- Component ≤ ~150 dòng (logic vẽ nặng nằm ở primitive).
- Verify: `tsc --noEmit` = 0 lỗi. KHÔNG chạy `next build`, KHÔNG dựng browser — owner tự test.
- Không commit — owner quyết định.

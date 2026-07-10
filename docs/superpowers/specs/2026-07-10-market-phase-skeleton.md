# Spec — Skeleton loading cho page market-phase (Header + Tab ①, 2026-07-10)

> Khi mở page chưa có data, hiện **khung skeleton bám sát layout** từng section (thay vì spinner + vùng nội dung trống). Phạm vi: shared header (hero) + Tab ① "Phân tích thị trường" (FREE). PAID basket tabs KHÔNG trong phạm vi.

## 1. Cách tiếp cận
Component skeleton **riêng** (không đụng logic component thật). MUI `Skeleton` (pattern chuẩn app), pulse mặc định, theme-aware qua `getGlassCard`.

File mới `components/MarketPhaseSkeleton.tsx` export:
- `PhaseHeroSkeleton` — mirror `PhaseHero` (glass card, 3 cột + divider).
- `MarketPhaseTabSkeleton` — mirror `MarketPhaseTab` (4 section).

Helper nội bộ:
- `SectionTitleSkeleton` — 1 dòng text (~180–220px) + chấm tròn nhỏ (ⓘ), chiều cao khớp `ChartSectionTitle` (`lg`).
- `ChartSkeleton({ height })` — hàng pill timeframe (góc phải, vài ô nhỏ) + `Skeleton variant="rounded"` full-width cao `height`.

## 2. Skeleton từng phần (bám layout thật)
- **Hero:** `Box` `getGlassCard(isDark)` + `borderRadius.lg`; grid `{ xs:'1fr', md:'1.15fr 1fr 1.2fr' }` + divider giữa cột (giống PhaseHero). Mỗi cột padding `{xs:2.5, md:3}`:
  - Cột 1: eyebrow + (Skeleton tròn 52×52 + 2 dòng) + dải 10 ô nhỏ (14×20) + 1 dòng.
  - Cột 2: eyebrow + số lớn (Skeleton ~w120 h48) + thanh 10 đoạn (h9) + 1 dòng.
  - Cột 3: eyebrow + số lớn + chip + thanh bullet (h12 bo tròn) + 2 nhãn nhỏ.
- **① Diễn biến & phân tích phiên:** `SectionTitleSkeleton` + `ChartSkeleton h=300` + 3–4 dòng text (SessionDiagnosis).
- **② Chi tiết các chỉ số:** `SectionTitleSkeleton` + `ChartSkeleton h=345` + 1 glass card, grid 2 cột × ~4 dòng (mỗi dòng: chấm + text + viz nhỏ).
- **③ Hiệu suất danh mục:** `SectionTitleSkeleton` + hàng 3–4 KPI tiles (Skeleton rounded ~w90 h44) + `ChartSkeleton h=320`.
- **④ Top lệnh:** `SectionTitleSkeleton` + grid `{ xs:'1fr', md:'repeat(3,1fr)' }` gap; mỗi cột glass card: header (chấm 10×10 + tên) + ~8 dòng bảng (mỗi dòng 1 Skeleton text).

Khoảng cách section = `mt: 4` (khớp MarketPhaseTab).

## 3. Wiring (2 file)
- `SharedPhaseHeader.tsx`: `if (isLoading) return <PhaseHeroSkeleton />;` (giữ error/empty như cũ).
- `PageContent.tsx`: nhánh `activeTab === 'market'` → `mp.isLoading ? <MarketPhaseTabSkeleton /> : <MarketPhaseTab ... />`. PAID tab giữ nguyên (BasketTab tự lo loading).

## 4. Ràng buộc & verify
- Không đổi logic/real components. Không dependency mới. Component skeleton gọn, tách helper.
- `tsc --noEmit` = 0 lỗi. KHÔNG `next build`, KHÔNG browser — owner tự test. Không commit.

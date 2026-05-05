# Home — Featured Stocks Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm section "Cổ phiếu nổi bật" trên trang chủ với 2 slide carousel (Top dòng tiền vào / ra mạnh), reuse `GroupStockTable` từ `/groups/[groupId]`.

**Architecture:** Tạo 1 component wrapper `FeaturedStocksSection` ở `home/components/featuredStocks/`, cross-import `GroupStockTable`. Section nhận `todayStockData` đã có sẵn trong `PageContent.tsx`, dedupe + filter (`vsi<5 && vsma5>500_000`) + sort theo `t0_score × min(vsi, 2)` → 2 slide × 10 dòng. Render Carousel trong Card glass.

**Tech Stack:** Next.js 15 (App Router) · TypeScript · MUI · TanStack Query (đã có) · `components/common/Carousel`.

**Spec:** [docs/superpowers/specs/2026-05-05-home-featured-stocks-design.md](../specs/2026-05-05-home-featured-stocks-design.md)

**Note:** Codebase không có Jest/Vitest setup cho FE. Verification = `npm run build` (TS check) + manual trên dev server. Không viết unit test mới.

---

## File Structure

**Create:**
- `finext-nextjs/app/(main)/home/components/featuredStocks/FeaturedStocksSection.tsx` — section wrapper. Trách nhiệm duy nhất: xử lý data (dedupe/filter/sort) + render Carousel với 2 slide. Cross-import `GroupStockTable`.

**Modify:**
- `finext-nextjs/app/(main)/home/PageContent.tsx` — thêm dynamic import `FeaturedStocksSection`, render giữa Section 1.5 (`MarketVolatility`) và Section 3 (`IndustrySection`).

**Do NOT modify:**
- `finext-nextjs/app/(main)/groups/[groupId]/components/GroupStockTable.tsx` — chỉ cross-import, tránh regression `/groups/[groupId]`.

---

## Task 1: Tạo `FeaturedStocksSection.tsx` với data processing + UI + skeleton

**Files:**
- Create: `finext-nextjs/app/(main)/home/components/featuredStocks/FeaturedStocksSection.tsx`

- [ ] **Step 1: Tạo file với full implementation**

Toàn bộ nội dung file:

```tsx
'use client';

import { useMemo } from 'react';
import { Box, Typography, useTheme, Card, useMediaQuery } from '@mui/material';
import Carousel, { Slide } from 'components/common/Carousel';
import {
    getResponsiveFontSize,
    fontWeight,
    getGlassCard,
    getGlassHighlight,
    getGlassEdgeLight,
} from 'theme/tokens';
import ChartSectionTitle from 'components/common/ChartSectionTitle';
import { useMarketUpdateTime } from 'hooks/useMarketUpdateTime';

import GroupStockTable, { GroupStockRowData }
    from '../../../groups/[groupId]/components/GroupStockTable';
import type { StockData } from '../marketSection/MarketVolatility';

const SCORE_VSI_CAP = 2;
const TOP_N = 10;
const CAROUSEL_INTERVAL = 10000; // = STOCKS_INTERVAL của MarketVolatility

interface FeaturedStocksSectionProps {
    stockData?: StockData[];
    isLoading?: boolean;
}

function toRowData(s: StockData): GroupStockRowData {
    return {
        ticker: s.ticker,
        exchange: s.exchange,
        close: s.close,
        diff: s.diff,
        pct_change: s.pct_change,
        industry_name: s.industry_name,
        category_name: s.category_name,
        marketcap_name: s.marketcap_name,
        t0_score: s.t0_score,
        t5_score: s.t5_score,
        vsi: s.vsi,
    };
}

export default function FeaturedStocksSection({
    stockData = [],
    isLoading = false,
}: FeaturedStocksSectionProps) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const isXsWidth = useMediaQuery(theme.breakpoints.only('xs'));
    const updateTime = useMarketUpdateTime();

    const cardStyle = {
        borderRadius: 3,
        backgroundImage: 'none',
        overflow: 'hidden',
        position: 'relative' as const,
        ...getGlassCard(isDark),
        '&::before': getGlassHighlight(isDark),
        '&::after': getGlassEdgeLight(isDark),
    };

    const { topInflow, topOutflow } = useMemo(() => {
        if (stockData.length === 0) {
            return { topInflow: [], topOutflow: [] };
        }

        // Dedupe by ticker (SSE may send duplicates) — pattern from MarketVolatility:313-316
        const deduped = stockData.reduce<Record<string, StockData>>((acc, s) => {
            acc[s.ticker] = s;
            return acc;
        }, {});

        // Filter — đồng nhất MarketVolatility:317
        const filtered = Object.values(deduped).filter(
            (s) => (s.vsi || 0) < 5 && (s.vsma5 || 0) > 500_000
        );

        const getScore = (s: StockData) =>
            (s.t0_score || 0) * Math.min(s.vsi || 0, SCORE_VSI_CAP);

        const inflow = [...filtered]
            .sort((a, b) => getScore(b) - getScore(a))
            .slice(0, TOP_N)
            .map(toRowData);

        const outflow = [...filtered]
            .sort((a, b) => getScore(a) - getScore(b))
            .slice(0, TOP_N)
            .map(toRowData);

        return { topInflow: inflow, topOutflow: outflow };
    }, [stockData]);

    const renderSlide = (
        title: string,
        color: string,
        data: GroupStockRowData[],
        loading: boolean
    ) => (
        <Box>
            <Typography
                sx={{
                    fontSize: getResponsiveFontSize(isXsWidth ? 'md' : 'lg'),
                    fontWeight: fontWeight.semibold,
                    color,
                    mb: 1.5,
                }}
            >
                {title}
            </Typography>
            <GroupStockTable
                data={data}
                isLoading={loading}
                skeletonRows={TOP_N}
            />
        </Box>
    );

    const slides: Slide[] = [
        {
            id: 'top-inflow',
            component: renderSlide(
                'Top dòng tiền vào mạnh',
                theme.palette.trend.up,
                topInflow,
                isLoading
            ),
        },
        {
            id: 'top-outflow',
            component: renderSlide(
                'Top dòng tiền ra mạnh',
                theme.palette.trend.down,
                topOutflow,
                isLoading
            ),
        },
    ];

    return (
        <Box>
            <ChartSectionTitle
                title="Cổ phiếu nổi bật"
                description="Top 10 cổ phiếu có dòng tiền vào và ra mạnh nhất phiên hôm nay."
                updateTime={updateTime}
                sx={{ mb: 2 }}
            />

            <Card sx={cardStyle}>
                <Box sx={{ px: 2, pt: 2, pb: 1 }}>
                    <Carousel
                        slides={slides}
                        autoPlayInterval={isLoading ? 0 : CAROUSEL_INTERVAL}
                        minHeight="auto"
                        height="100%"
                    />
                </Box>
            </Card>
        </Box>
    );
}
```

**Lưu ý cho engineer:**
- `StockData` type được export từ `MarketVolatility.tsx` — kiểm tra nó có đủ `marketcap_name`, `category_name`, `t5_score`, `diff` (đã verify trong spec).
- Path cross-import `'../../../groups/[groupId]/components/GroupStockTable'` đếm thư mục: từ `home/components/featuredStocks/` → `..` (components) → `..` (home) → `..` ((main)) → `groups/[groupId]/components/`. Verify với TS build.
- KHÔNG tạo `index.ts` hoặc re-export — không cần thiết (YAGNI).

- [ ] **Step 2: Type check (file đứng độc lập)**

Run từ `d:/twan_projects/finext-web-app/finext-nextjs/`:

```bash
npx tsc --noEmit
```

Expected: pass (cross-import resolve đúng, type `StockData` có đủ field cho `toRowData`).

Nếu fail vì missing field trong `StockData`:
- Đọc `app/(main)/home/components/marketSection/MarketVolatility.tsx` xem interface `StockData`. Nó đã có `category_name?`, `marketcap_name?`, `diff?`, `t5_score?` (optional). Nếu thiếu field nào → fail = bug spec, dừng và báo lại.

Nếu fail vì path cross-import sai → fix relative path.

- [ ] **Step 3: Commit**

```bash
git add finext-nextjs/app/(main)/home/components/featuredStocks/FeaturedStocksSection.tsx
git commit -m "$(cat <<'EOF'
feat(home): add FeaturedStocksSection component

Section wrapper: dedupe + filter + sort top 10 inflow/outflow stocks,
reuse GroupStockTable from /groups/[groupId] via cross-import.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Wire `FeaturedStocksSection` vào `PageContent.tsx`

**Files:**
- Modify: `finext-nextjs/app/(main)/home/PageContent.tsx`

- [ ] **Step 1: Thêm dynamic import**

Sau dòng `const IndustryStocksSection = dynamic(...)` (gần dòng 39-42), thêm:

```tsx
const FeaturedStocksSection = dynamic(
    () => import('./components/featuredStocks/FeaturedStocksSection'),
    { loading: () => <Skeleton variant="rectangular" height={500} sx={{ borderRadius: 2, my: 2 }} /> }
);
```

- [ ] **Step 2: Render section giữa MarketVolatility và IndustrySection**

Tìm block (gần dòng 501-508):

```tsx
            {/* Section 1.5: Diễn biến thị trường */}
            <Box sx={{ mt: 5 }}>
                <MarketVolatility
                    stockData={todayStockData}
                    foreignData={nnStockData}
                    isLoading={isStockDataLoading || isNnLoading}
                />
            </Box>



            {/* Section 3: Ngành */}
```

Thay bằng:

```tsx
            {/* Section 1.5: Diễn biến thị trường */}
            <Box sx={{ mt: 5 }}>
                <MarketVolatility
                    stockData={todayStockData}
                    foreignData={nnStockData}
                    isLoading={isStockDataLoading || isNnLoading}
                />
            </Box>

            {/* Section 2: Cổ phiếu nổi bật */}
            <Box sx={{ mt: 5 }}>
                <FeaturedStocksSection
                    stockData={todayStockData}
                    isLoading={isStockDataLoading}
                />
            </Box>

            {/* Section 3: Ngành */}
```

- [ ] **Step 3: Type check**

Run từ `d:/twan_projects/finext-web-app/finext-nextjs/`:

```bash
npx tsc --noEmit
```

Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add finext-nextjs/app/(main)/home/PageContent.tsx
git commit -m "$(cat <<'EOF'
feat(home): wire FeaturedStocksSection into home page

Render between MarketVolatility (Section 1.5) and IndustrySection
(Section 3). Reuses existing todayStockData SSE stream.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Verification — production build + manual smoke test

**Files:** none (chỉ run commands, không thay đổi code)

- [ ] **Step 1: Production build**

Run từ `d:/twan_projects/finext-web-app/finext-nextjs/`:

```bash
npm run build
```

Expected: build success, không lỗi TS, không warning về missing module.

Nếu fail:
- TS error trong `FeaturedStocksSection` → fix file (Task 1).
- Module not found cross-import → check relative path `../../../groups/[groupId]/components/GroupStockTable`.
- Dynamic import fail → check path `./components/featuredStocks/FeaturedStocksSection`.

- [ ] **Step 2: Manual smoke test trên dev server**

Run:

```bash
npm run dev
```

Mở `http://localhost:3000/` và verify từng item dưới đây trong checklist (theo Spec section 8):

**Vị trí & layout:**
- [ ] Section "Cổ phiếu nổi bật" xuất hiện ngay dưới "Diễn biến thị trường" và ngay trên "Ngành".
- [ ] Có ChartSectionTitle "Cổ phiếu nổi bật" với updateTime.
- [ ] Card có hiệu ứng glass đồng nhất với MarketVolatility.

**Carousel:**
- [ ] Hiển thị 2 slide. Autoplay tự switch sau 10s.
- [ ] Click dot nav hoặc swipe chuyển slide thủ công, autoplay tạm dừng theo behavior `Carousel`.

**Slide 1 (Top dòng tiền vào mạnh):**
- [ ] Title màu xanh (`theme.palette.trend.up`).
- [ ] 10 dòng cổ phiếu, sort theo `t0_score × min(vsi, 2)` desc.
- [ ] Bảng có đầy đủ 10 cột giống `/groups/[groupId]`: Mã CP, Ngành nghề, Nhóm, Vốn hoá, Giá hiện tại, Thay đổi (+/-), Thay đổi (%), Dòng tiền phiên, Dòng tiền tuần, Thanh khoản.

**Slide 2 (Top dòng tiền ra mạnh):**
- [ ] Title màu đỏ (`theme.palette.trend.down`).
- [ ] 10 dòng cổ phiếu, sort theo score asc (most negative đầu tiên).

**Format/màu (do `GroupStockTable` handle):**
- [ ] Cột Giá: 2 chữ số thập phân.
- [ ] Cột +/- và %: prefix `+`/`-`, màu theo `getPriceColor`.
- [ ] Cột Dòng tiền phiên/tuần: prefix `+`/`-`, 1 chữ số thập phân, màu theo `getFlowColor`.
- [ ] Cột Thanh khoản: % với 2 chữ số thập phân, màu theo `getVsiColor`.

**Skeleton:**
- [ ] Refresh trang. Trong khi `isStockDataLoading=true`, skeleton 10 dòng × 2 slide hiển thị đúng.

**Responsive:**
- [ ] Resize cửa sổ về xs (mobile, <md): chỉ hiện `Mã CP / Giá / +/- / % / Thanh khoản`.
- [ ] Resize về md (tablet): thêm `Dòng tiền phiên / Dòng tiền tuần`.
- [ ] Desktop (lg+): full 10 cột.

**Click behavior:**
- [ ] Click ticker → điều hướng `/stocks/{ticker}`.
- [ ] Click icon TrendingUp bên cạnh ticker → điều hướng `/charts/{ticker}`.

**Regression:**
- [ ] Mở `/groups/fnxindex` (hoặc bất kỳ `/groups/[groupId]`): bảng "Cổ phiếu nổi bật nhóm ..." vẫn render & sort & format đúng như trước.
- [ ] Section khác trên home (`MarketVolatility`, `IndustrySection`, `IndustryStocksSection`, `NewsSection`) không vỡ layout.

- [ ] **Step 3: Báo cáo kết quả**

Báo lại tóm tắt:
- Build status (pass/fail).
- Số item checklist pass / total (24 items).
- Item nào fail (nếu có) + diagnosis.

Nếu tất cả pass → kết thúc, không commit thêm.

Nếu có fail → fix ở Task 1 hoặc Task 2 (KHÔNG sửa `GroupStockTable`), rồi rerun Task 3 từ Step 1.

---

## Self-Review checklist (đã chạy)

**Spec coverage:**
- Spec §2 (decisions) → Task 1 Step 1 (constants + getScore + filter + sort).
- Spec §4 (file changes) → Task 1 (create) + Task 2 (modify PageContent).
- Spec §5 (data flow) → Task 1 Step 1 (dedupe + filter + score + slice + toRowData).
- Spec §6 (UI layout) → Task 1 Step 1 (ChartSectionTitle + Card glass + Carousel + 2 slides).
- Spec §7 (edge cases) → đã handle trong Task 1 Step 1: empty stockData (early return), `(s.vsi || 0)`, `GroupStockTable` empty state.
- Spec §8 (verification) → Task 3 Step 2 checklist.

**Placeholder scan:** không có "TBD"/"TODO"/"add appropriate"/v.v. ✓

**Type consistency:**
- `StockData` từ `MarketVolatility` → `toRowData` → `GroupStockRowData` → `<GroupStockTable data={...} />`. Đồng nhất xuyên suốt. ✓
- Tên const: `SCORE_VSI_CAP`, `TOP_N`, `CAROUSEL_INTERVAL` — chỉ dùng trong file, không leak. ✓

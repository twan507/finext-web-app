# Watchlist Index Sections — Implementation Plan

> **HISTORICAL — COMPLETED:** Các section chỉ số watchlist đã được triển khai; code hiện tại ghi đè checklist và số liệu trong plan.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm 2 section thẻ chỉ số (12 thị trường + 24 ngành) phía trên section watchlist trên trang `/watchlist`, cả 3 section collapse được.

**Architecture:** 4 component mới trong `watchlist/components/` (constants, CollapsibleSection, IndexCard, IndexGrid) + nối dây trong `PageContent.tsx` (thêm 1 SSE stream `home_today_index`, build map, render 2 section chỉ số + bọc watchlist trong section 3). Không sửa `WatchlistColumn.tsx`, không đổi backend.

**Tech Stack:** Next.js (App Router) + React + MUI 7 + `useSseCache` (services/sseClient) + theme tokens.

**Spec:** `docs/superpowers/specs/2026-06-17-watchlist-index-sections-design.md`

---

## Lưu ý verify (đọc trước)

- Dự án **không có test runner frontend** → mỗi task verify bằng `npx tsc --noEmit` (chạy trong `finext-nextjs/`) + checklist test tay ở Task 6. Đây là sai lệch có chủ đích so với TDD, theo ràng buộc dự án.
- **Không commit** trong quá trình (theo yêu cầu user). Bỏ qua mọi bước git.
- Lệnh typecheck (chú ý working dir hay bị reset về repo root):
  ```bash
  cd finext-nextjs && npx tsc --noEmit
  ```
  Kỳ vọng: exit 0, không lỗi.

## File structure

| File | Trách nhiệm |
|---|---|
| `watchlist/components/indexSections.ts` (tạo) | Hằng số mã (12+24+8), type `IndexData`, helper tính route |
| `watchlist/components/CollapsibleSection.tsx` (tạo) | Wrapper section collapse, lưu localStorage |
| `watchlist/components/IndexCard.tsx` (tạo) | 1 thẻ chỉ số (visual thẻ CP, bỏ xoá/kéo-thả) |
| `watchlist/components/IndexGrid.tsx` (tạo) | Lưới responsive map mã → IndexCard |
| `watchlist/PageContent.tsx` (sửa) | SSE `home_today_index` + render 3 section |

> Tất cả path tương đối tính từ `finext-nextjs/app/(main)/`.

---

### Task 1: Constants & helpers (`indexSections.ts`)

**Files:**
- Create: `finext-nextjs/app/(main)/watchlist/components/indexSections.ts`

- [ ] **Step 1: Tạo file với toàn bộ nội dung**

```ts
// indexSections.ts — Hằng số & helper cho 2 section chỉ số trên trang watchlist

export interface IndexData {
    ticker: string;
    ticker_name?: string;
    close: number;
    diff: number;
    pct_change: number;
    vsi?: number;
    trading_value?: number;
    type?: string;
}

// 12 chỉ số thị trường (cố định, đúng thứ tự hiển thị)
export const MARKET_INDEX_CODES = [
    'VNINDEX', 'VN30', 'HNXINDEX', 'UPINDEX',
    'LARGECAP', 'MIDCAP', 'SMALLCAP',
    'ONDINH', 'SUKIEN', 'VUOTTROI',
    'FNXINDEX', 'FNX100',
] as const;

// 24 ngành (cố định)
export const INDUSTRY_CODES = [
    'BANLE', 'BAOHIEM', 'BDS', 'CAOSU', 'CHUNGKHOAN', 'CONGNGHE',
    'CONGNGHIEP', 'DAUKHI', 'DETMAY', 'DULICH', 'HOACHAT', 'KCN',
    'KHOANGSAN', 'KIMLOAI', 'NGANHANG', 'NHUA', 'NONGNGHIEP', 'THUCPHAM',
    'THUYSAN', 'TIENICH', 'VANTAI', 'VLXD', 'XAYDUNG', 'YTE',
] as const;

// Chỉ số Finext có trang chi tiết /groups (theo IndexTable.tsx)
const INDEXES_WITH_DETAIL = new Set<string>([
    'FNXINDEX', 'LARGECAP', 'MIDCAP', 'SMALLCAP', 'VUOTTROI', 'ONDINH', 'SUKIEN', 'FNX100',
]);

export type IndexKind = 'market' | 'industry';

/** Route khi bấm TÊN thẻ. undefined = không điều hướng (big-4 thị trường). */
export function indexDetailHref(code: string, kind: IndexKind): string | undefined {
    const lower = code.toLowerCase();
    if (kind === 'industry') return `/sectors/${lower}`;
    if (INDEXES_WITH_DETAIL.has(code)) return `/groups/${lower}`;
    return undefined;
}

/** Route khi bấm ICON chart (mọi mã). */
export function indexChartHref(code: string): string {
    return `/charts/${code.toLowerCase()}`;
}
```

- [ ] **Step 2: Typecheck**

Run: `cd finext-nextjs && npx tsc --noEmit`
Expected: exit 0 (file độc lập, không lỗi).

---

### Task 2: CollapsibleSection (`CollapsibleSection.tsx`)

**Files:**
- Create: `finext-nextjs/app/(main)/watchlist/components/CollapsibleSection.tsx`

- [ ] **Step 1: Tạo file với toàn bộ nội dung**

```tsx
'use client';

import React, { useEffect, useState } from 'react';
import { Box, IconButton, Typography, useTheme } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { fontWeight, getResponsiveFontSize } from 'theme/tokens';

interface Props {
    title: string;
    storageKey: string;       // key localStorage để nhớ trạng thái collapse
    defaultOpen?: boolean;
    headerRight?: React.ReactNode;
    children: React.ReactNode;
}

export default function CollapsibleSection({ title, storageKey, defaultOpen = true, headerRight, children }: Props) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const [open, setOpen] = useState(defaultOpen);

    // Đọc trạng thái đã lưu SAU khi mount (tránh hydration mismatch giữa server/client)
    useEffect(() => {
        const v = localStorage.getItem(storageKey);
        if (v !== null) setOpen(v === '1');
    }, [storageKey]);

    const toggle = () => {
        setOpen(prev => {
            const next = !prev;
            localStorage.setItem(storageKey, next ? '1' : '0');
            return next;
        });
    };

    const divider = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

    return (
        <Box sx={{ mb: 2 }}>
            {/* Header — click cả thanh để toggle */}
            <Box
                onClick={toggle}
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    py: 0.5,
                    cursor: 'pointer',
                    borderBottom: `1px solid ${divider}`,
                    userSelect: 'none',
                }}
            >
                <IconButton size="small" sx={{ color: 'text.disabled', p: 0.25, flexShrink: 0, '&:hover': { color: 'text.secondary' } }}>
                    {open ? <ExpandLessIcon sx={{ fontSize: 18 }} /> : <ExpandMoreIcon sx={{ fontSize: 18 }} />}
                </IconButton>
                <Typography
                    sx={{
                        fontSize: getResponsiveFontSize('sm'),
                        fontWeight: fontWeight.bold,
                        color: 'text.primary',
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                        flex: 1,
                        minWidth: 0,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                    }}
                >
                    {title}
                </Typography>
                {headerRight}
            </Box>

            {/* Body */}
            <Box sx={{ display: open ? 'block' : 'none', pt: 1.5 }}>
                {children}
            </Box>
        </Box>
    );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd finext-nextjs && npx tsc --noEmit`
Expected: exit 0.

---

### Task 3: IndexCard (`IndexCard.tsx`)

**Files:**
- Create: `finext-nextjs/app/(main)/watchlist/components/IndexCard.tsx`

Dựng lại visual thẻ CP (`WatchlistColumn.renderStockRow`): nền gradient + viền theo màu tăng/giảm, grid 3×2. Bỏ nút xoá & kéo-thả. Màu dùng `getTrendColor`.

> **Cảnh báo data:** thẻ CP coi `trading_value` là "đã chia 10^9" (`gtgd` nhân lại `*1e9`). Chưa chắc `home_today_index` có cùng quy ước. Giữ formatter giống thẻ CP; nếu test tay thấy GTGD lệch ×1e9 thì bỏ `* 1_000_000_000` trong `fmt.gtgd` (ghi rõ ở Task 6).

- [ ] **Step 1: Tạo file với toàn bộ nội dung**

```tsx
'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Box, Typography, Tooltip, useTheme, alpha } from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import { fontWeight, getResponsiveFontSize, borderRadius, durations } from 'theme/tokens';
import { getTrendColor } from 'theme/colorHelpers';
import type { IndexData } from './indexSections';

interface Props {
    code: string;
    name?: string;          // ticker_name → dùng làm tooltip trên mã
    data?: IndexData;
    detailHref?: string;    // bấm tên; undefined = không điều hướng
    chartHref: string;      // bấm icon chart
}

const fmt = {
    price: (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    diff: (n: number) => { const v = parseFloat(n.toFixed(2)); return `${v > 0 ? '+' : ''}${v.toFixed(2)}`; },
    pct: (n: number) => { const v = parseFloat((n * 100).toFixed(2)); return `${v > 0 ? '+' : ''}${v.toFixed(2)}%`; },
    vsi: (n: number) => `${(n * 100).toFixed(0)}%`,
    gtgd: (n: number) => {
        const v = n * 1_000_000_000; // trading_value pre-divided by 1e9 (xem cảnh báo data ở plan)
        if (v >= 1_000_000_000_000) return `${(v / 1_000_000_000_000).toFixed(1)}T`;
        if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`;
        if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
        if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
        return `${v}`;
    },
};

export default function IndexCard({ code, name, data, detailHref, chartHref }: Props) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const router = useRouter();

    // Chưa có data → thẻ placeholder
    if (!data) {
        return (
            <Box sx={{
                px: 1, py: 0.5,
                borderRadius: `${borderRadius.sm}px`,
                bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
            }}>
                <Typography sx={{ fontSize: getResponsiveFontSize('xs'), fontWeight: fontWeight.semibold, color: 'text.secondary' }}>
                    {code}
                </Typography>
                <Typography sx={{ fontSize: getResponsiveFontSize('xs'), color: 'text.disabled', mt: 0.25 }}>—</Typography>
            </Box>
        );
    }

    const changeColor = getTrendColor(data.pct_change * 100, theme);
    const cardBg = `linear-gradient(90deg, ${alpha(changeColor, 0.1)} 0%, ${alpha(changeColor, 0.05)} 50%, ${alpha(changeColor, 0.01)} 100%)`;
    const cardBgHover = `linear-gradient(90deg, ${alpha(changeColor, 0.2)} 0%, ${alpha(changeColor, 0.1)} 50%, ${alpha(changeColor, 0.02)} 100%)`;

    const tooltipSlotProps = {
        tooltip: {
            sx: {
                bgcolor: isDark ? alpha('#1e1e1e', 0.92) : alpha('#fff', 0.92),
                color: 'text.primary',
                border: 'none',
                borderRadius: `${borderRadius.sm}px`,
                fontSize: getResponsiveFontSize('xs'),
                fontWeight: fontWeight.medium,
                backdropFilter: 'blur(8px)',
                boxShadow: isDark ? '0 4px 16px rgba(0,0,0,0.5)' : '0 4px 12px rgba(0,0,0,0.15)',
                px: 1, py: 0.5,
            },
        },
    };

    const codeNode = (
        <Typography
            component={detailHref ? 'a' : 'span'}
            href={detailHref}
            onClick={detailHref ? (e: React.MouseEvent) => { e.preventDefault(); router.push(detailHref); } : undefined}
            sx={{
                fontSize: getResponsiveFontSize('xs'),
                fontWeight: fontWeight.bold,
                color: changeColor,
                textDecoration: 'none',
                cursor: detailHref ? 'pointer' : 'default',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                '&:hover': detailHref ? { textDecoration: 'underline' } : {},
            }}
        >
            {code}
        </Typography>
    );

    return (
        <Box sx={{
            px: 1, py: 0.5,
            borderRadius: `${borderRadius.sm}px`,
            background: cardBg,
            border: `1px solid ${alpha(changeColor, 0.5)}`,
            transition: `background ${durations.fast}, border-color ${durations.fast}`,
            '&:hover': { background: cardBgHover, borderColor: alpha(changeColor, 0.4) },
        }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', alignItems: 'center' }}>
                {/* [0,0] mã + icon chart */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
                    {name ? (
                        <Tooltip title={name} placement="top" arrow={false} slotProps={tooltipSlotProps}>
                            {codeNode}
                        </Tooltip>
                    ) : codeNode}
                    <Tooltip title="Mở chart" placement="right" arrow={false} slotProps={tooltipSlotProps}>
                        <Box
                            component="span"
                            onClick={() => router.push(chartHref)}
                            sx={{
                                display: 'inline-flex', alignItems: 'center', cursor: 'pointer',
                                color: alpha(theme.palette.text.secondary, 0.4), flexShrink: 0,
                                transition: `color ${durations.fast}`,
                                '&:hover': { color: theme.palette.primary.main },
                            }}
                        >
                            <TrendingUpIcon sx={{ fontSize: 14 }} />
                        </Box>
                    </Tooltip>
                </Box>
                {/* [0,1] % thay đổi */}
                <Typography sx={{ fontSize: getResponsiveFontSize('xs'), fontWeight: fontWeight.semibold, color: changeColor, fontVariantNumeric: 'tabular-nums', textAlign: 'center' }}>
                    {fmt.pct(data.pct_change)}
                </Typography>
                {/* [0,2] VSI */}
                <Typography sx={{ fontSize: getResponsiveFontSize('xs'), fontWeight: fontWeight.semibold, color: 'text.secondary', fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
                    {data.vsi != null ? fmt.vsi(data.vsi) : '—'}
                </Typography>
                {/* [1,0] giá */}
                <Typography sx={{ fontSize: getResponsiveFontSize('xs'), fontWeight: fontWeight.medium, color: changeColor, fontVariantNumeric: 'tabular-nums', mt: 0.25 }}>
                    {fmt.price(data.close)}
                </Typography>
                {/* [1,1] +/- điểm */}
                <Typography sx={{ fontSize: getResponsiveFontSize('xs'), fontWeight: fontWeight.medium, color: changeColor, fontVariantNumeric: 'tabular-nums', textAlign: 'center', mt: 0.25 }}>
                    {fmt.diff(data.diff)}
                </Typography>
                {/* [1,2] GTGD */}
                <Typography sx={{ fontSize: getResponsiveFontSize('xs'), fontWeight: fontWeight.medium, color: 'text.secondary', fontVariantNumeric: 'tabular-nums', textAlign: 'right', mt: 0.25 }}>
                    {data.trading_value != null ? fmt.gtgd(data.trading_value) : '—'}
                </Typography>
            </Box>
        </Box>
    );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd finext-nextjs && npx tsc --noEmit`
Expected: exit 0.

---

### Task 4: IndexGrid (`IndexGrid.tsx`)

**Files:**
- Create: `finext-nextjs/app/(main)/watchlist/components/IndexGrid.tsx`

- [ ] **Step 1: Tạo file với toàn bộ nội dung**

```tsx
'use client';

import { Box } from '@mui/material';
import IndexCard from './IndexCard';
import { indexChartHref, indexDetailHref, type IndexData, type IndexKind } from './indexSections';

interface Props {
    codes: readonly string[];
    kind: IndexKind;
    dataMap: Map<string, IndexData>;
}

export default function IndexGrid({ codes, kind, dataMap }: Props) {
    return (
        <Box sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(185px, 1fr))',
            gap: 1,
        }}>
            {codes.map(code => {
                const data = dataMap.get(code);
                return (
                    <IndexCard
                        key={code}
                        code={code}
                        name={data?.ticker_name}
                        data={data}
                        detailHref={indexDetailHref(code, kind)}
                        chartHref={indexChartHref(code)}
                    />
                );
            })}
        </Box>
    );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd finext-nextjs && npx tsc --noEmit`
Expected: exit 0.

---

### Task 5: Nối dây trong `PageContent.tsx`

**Files:**
- Modify: `finext-nextjs/app/(main)/watchlist/PageContent.tsx`

- [ ] **Step 1: Thêm import** (sau dòng `import ConfirmDialog from './components/ConfirmDialog';`, ~dòng 32)

```tsx
import CollapsibleSection from './components/CollapsibleSection';
import IndexGrid from './components/IndexGrid';
import { MARKET_INDEX_CODES, INDUSTRY_CODES, type IndexData } from './components/indexSections';
```

- [ ] **Step 2: Thêm SSE + map** (ngay sau khối `stockDataMap` useMemo kết thúc, ~dòng 324, trước `// All tickers for autocomplete`)

```tsx
    // SSE: chỉ số (thị trường + ngành) — 1 stream trả cả 12 index + 24 ngành
    const { data: indexDataRaw } = useSseCache<IndexData[]>({
        keyword: 'home_today_index',
        enabled: !!session,
    });

    const indexDataMap = useMemo(() => {
        const map = new Map<string, IndexData>();
        if (indexDataRaw && Array.isArray(indexDataRaw)) {
            indexDataRaw.forEach(item => map.set(item.ticker, item));
        }
        return map;
    }, [indexDataRaw]);
```

- [ ] **Step 3: Thêm helper render 2 section chỉ số** (ngay sau `renderTitle` định nghĩa xong, ~dòng 684)

```tsx
    // 2 section thẻ chỉ số — dùng ở cả empty-state lẫn nhánh chính
    const renderIndexSections = () => (
        <>
            <CollapsibleSection title="Chỉ số thị trường" storageKey="watchlist.section.market">
                <IndexGrid codes={MARKET_INDEX_CODES} kind="market" dataMap={indexDataMap} />
            </CollapsibleSection>
            <CollapsibleSection title="Chỉ số ngành" storageKey="watchlist.section.industry">
                <IndexGrid codes={INDUSTRY_CODES} kind="industry" dataMap={indexDataMap} />
            </CollapsibleSection>
        </>
    );
```

- [ ] **Step 4: Nhánh chính — chèn index sections + bọc watchlist trong section 3**

Trong `return (...)` chính (~dòng 768): ngay sau dòng mở `<OptionalAuthWrapper requireAuth={true} requiredFeatures={BASIC_AND_ABOVE}>` (~dòng 772), chèn:

```tsx
                {renderIndexSections()}

                <CollapsibleSection title="Danh sách theo dõi" storageKey="watchlist.section.list">
```

Rồi đóng `</CollapsibleSection>` NGAY TRƯỚC `<AddWatchlistDialog` (~dòng 970). Tức là khối "page selector" + `{isMobile ? (...) : (...)}` (cũ ~dòng 774–968) nằm GỌN trong `<CollapsibleSection title="Danh sách theo dõi" ...>...</CollapsibleSection>`; còn `AddWatchlistDialog`, `ConfirmDialog`, `Snackbar` ở NGOÀI (sau `</CollapsibleSection>`, vẫn trong `OptionalAuthWrapper`).

Kết quả cấu trúc nhánh chính:
```tsx
<OptionalAuthWrapper ...>
    {renderIndexSections()}
    <CollapsibleSection title="Danh sách theo dõi" storageKey="watchlist.section.list">
        {/* Box page selector ... */}
        {isMobile ? ( /* mobile block */ ) : ( /* desktop DndContext block */ )}
    </CollapsibleSection>
    <AddWatchlistDialog ... />
    <ConfirmDialog ... />
    <Snackbar ... />
</OptionalAuthWrapper>
```

- [ ] **Step 5: Nhánh empty-state — chèn index sections**

Trong nhánh `if (watchlists.length === 0)` (~dòng 717), ngay sau dòng mở `<OptionalAuthWrapper requireAuth={true} requiredFeatures={BASIC_AND_ABOVE}>` (~dòng 721), chèn `{renderIndexSections()}` rồi bọc khối "Bạn chưa có Watchlist" hiện có trong section 3:

```tsx
                {renderIndexSections()}

                <CollapsibleSection title="Danh sách theo dõi" storageKey="watchlist.section.list">
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 8, gap: 2 }}>
                        {/* ... nội dung "Bạn chưa có Watchlist" + ô + AddIcon GIỮ NGUYÊN ... */}
                    </Box>
                </CollapsibleSection>
```

(`AddWatchlistDialog` trong nhánh này để NGOÀI `</CollapsibleSection>`, vẫn trong `OptionalAuthWrapper`.)

- [ ] **Step 6: Typecheck**

Run: `cd finext-nextjs && npx tsc --noEmit`
Expected: exit 0, không lỗi.

---

### Task 6: Verify tổng thể

- [ ] **Step 1: Typecheck sạch**

Run: `cd finext-nextjs && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 2: Lint phần đã đụng** (nếu nhanh)

Run: `cd finext-nextjs && npx eslint app/(main)/watchlist/components/IndexCard.tsx app/(main)/watchlist/components/IndexGrid.tsx app/(main)/watchlist/components/CollapsibleSection.tsx app/(main)/watchlist/components/indexSections.ts app/(main)/watchlist/PageContent.tsx`
Expected: không error (warning chấp nhận được).

- [ ] **Step 3: Bàn giao cho user test tay** — checklist:
  1. Trang `/watchlist` hiện 3 section theo thứ tự: Chỉ số thị trường → Chỉ số ngành → Danh sách theo dõi.
  2. Cả 3 section bấm header collapse/expand được; reload trang giữ nguyên trạng thái (localStorage).
  3. Section 1 đủ **12** thẻ, Section 2 đủ **24** thẻ; lưới responsive (phone ~2 cột, desktop ~6 cột); thẻ trông giống thẻ CP (nền gradient + viền theo màu tăng/giảm).
  4. Thẻ hiện đúng: mã, %thay đổi, VSI, giá, +/- điểm, GTGD. **Kiểm tra magnitude GTGD** — nếu lệch ×1e9, sửa `fmt.gtgd` trong `IndexCard.tsx` (bỏ `* 1_000_000_000`).
  5. Bấm tên: 8 mã Finext → `/groups/...`, 24 ngành → `/sectors/...`, big-4 (VNINDEX/VN30/HNXINDEX/UPINDEX) tên không bấm được; icon chart → `/charts/...`.
  6. Section "Danh sách theo dõi" (3) hoạt động y như trước (DnD, sort, thêm/xoá mã, trang).
  7. Tài khoản chưa có watchlist: vẫn thấy 2 section chỉ số.

---

## Self-review (đã chạy)

- **Spec coverage:** 3 section collapse (Task 2,5) · 12+24 mã (Task 1) · thẻ giống CP 6 ô (Task 3) · điều hướng /groups//sectors//charts (Task 1,3) · 1 SSE `home_today_index` (Task 5) · lưới responsive (Task 4) · empty-state có index sections (Task 5 step 5) · không đụng WatchlistColumn/backend (đã loại khỏi scope). ✔
- **Placeholder scan:** không có TBD; mọi step có code đầy đủ. ✔
- **Type consistency:** `IndexData` định nghĩa ở Task 1, import & dùng nhất quán ở Task 3/4/5; `IndexKind`, `indexDetailHref`, `indexChartHref`, `MARKET_INDEX_CODES`, `INDUSTRY_CODES` khớp tên xuyên suốt. ✔
- **Sai lệch có chủ đích:** không TDD (không có test runner FE) → verify bằng tsc + test tay; không commit (theo yêu cầu user).

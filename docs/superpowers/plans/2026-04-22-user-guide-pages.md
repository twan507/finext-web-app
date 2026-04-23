# User Guide Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **⚠ Refactor note (2026-04-22, mid-execution):** Sau checkpoint A, user feedback dẫn đến đổi kiến trúc:
> - **Bỏ `GuideTabBar`** (MUI Tabs không phù hợp cho cross-page nav theo convention dự án).
> - **Thêm `GuideBreadcrumb`** (pattern giống `NewsBreadcrumb`).
> - **`GuideAccordion` đổi từ border cứng sang glass card** (`getGlassCard(isDark)`).
> - **Font size nhỏ hơn**: page title `h4` → `getResponsiveFontSize('xxl')`, accordion title `lg` → `md`.
> - **Bỏ tiếng Anh trong accordion title**: "Trang chủ (Home)" → "Trang chủ", v.v.
>
> Các task 1, 3, 6-8 đã được cập nhật sau khi execute. Nếu execute lại từ đầu, dùng code trong các PageContent/component hiện tại làm reference (không follow literal code trong tasks 1, 3, 6-8 của plan này).

**Goal:** Thay 3 trang Coming Soon `/learning/*` bằng 3 trang hướng dẫn sử dụng thực tế (`/guides/overview`, `/guides/stock-screener`, `/guides/charts-watchlist`), mỗi trang dạng accordion doc chuyên nghiệp với text + screenshot, nav bằng breadcrumb ở top mỗi trang.

**Architecture:** Inline content pattern — 3 shared primitives (`GuideLayout`, `GuideBreadcrumb`, `GuideAccordion`) wrap MUI components, mỗi `PageContent.tsx` viết accordion sections inline JSX với free-form children (text + ảnh + list). Layout `/guides` chỉ cung cấp container + max-width; breadcrumb đặt trong mỗi PageContent.

**Tech Stack:** Next.js App Router, TypeScript, MUI (`Accordion`, `Breadcrumbs`), Next `Image`, iconify-react, glass card tokens (`getGlassCard`).

**User constraints (từ CLAUDE.md + session):**
- Không commit git — user tự commit khi cần.
- Không unit test — user tự test thủ công bằng dev server sau mỗi phase.
- Surgical changes: chỉ chạm file có trong plan.

---

## File Structure

**Create:**
- ~~`finext-nextjs/app/(main)/guides/components/GuideTabBar.tsx`~~ (đã xóa sau refactor)
- `finext-nextjs/app/(main)/guides/components/GuideBreadcrumb.tsx` (thay thế GuideTabBar)
- `finext-nextjs/app/(main)/guides/components/GuideAccordion.tsx`
- `finext-nextjs/app/(main)/guides/components/GuideLayout.tsx`
- `finext-nextjs/app/(main)/guides/layout.tsx`
- `finext-nextjs/app/(main)/guides/page.tsx`
- `finext-nextjs/app/(main)/guides/overview/page.tsx`
- `finext-nextjs/app/(main)/guides/overview/PageContent.tsx`
- `finext-nextjs/app/(main)/guides/stock-screener/page.tsx`
- `finext-nextjs/app/(main)/guides/stock-screener/PageContent.tsx`
- `finext-nextjs/app/(main)/guides/charts-watchlist/page.tsx`
- `finext-nextjs/app/(main)/guides/charts-watchlist/PageContent.tsx`
- `finext-nextjs/public/guides/overview/` (screenshots — user chụp khi đến content phase)
- `finext-nextjs/public/guides/stock-screener/`
- `finext-nextjs/public/guides/charts-watchlist/`

**Modify:**
- `finext-nextjs/components/layout/Footer.tsx` (replace `hoTro` block)
- `finext-nextjs/app/sitemap.ts` (thay 3 entry `/learning/*` → 3 entry `/guides/*`)
- `finext-nextjs/app/robots.ts` (thay `'/learning/'` → `'/guides/'` trong Googlebot allow)

**Delete:**
- `finext-nextjs/app/(main)/learning/technical-analysis/page.tsx`
- `finext-nextjs/app/(main)/learning/technical-analysis/PageContent.tsx`
- `finext-nextjs/app/(main)/learning/fundamental-analysis/page.tsx`
- `finext-nextjs/app/(main)/learning/fundamental-analysis/PageContent.tsx`
- `finext-nextjs/app/(main)/learning/cash-flow-analysis/page.tsx`
- `finext-nextjs/app/(main)/learning/cash-flow-analysis/PageContent.tsx`
- `finext-nextjs/app/(main)/learning/` (empty directory sau khi xóa 3 subdirs)

---

# Phase 1 — Foundation (shared components + routing)

## Task 1: Create `GuideTabBar` component

**Files:**
- Create: `finext-nextjs/app/(main)/guides/components/GuideTabBar.tsx`

- [ ] **Step 1: Create file with full code**

```tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Box, Tabs, Tab, useTheme } from '@mui/material';
import { layoutTokens } from 'theme/tokens';

const TABS = [
  { label: 'Tổng quan tính năng', href: '/guides/overview' },
  { label: 'Biểu đồ và Watchlist', href: '/guides/charts-watchlist' },
  { label: 'Bộ lọc cổ phiếu', href: '/guides/stock-screener' },
];

export default function GuideTabBar() {
  const theme = useTheme();
  const pathname = usePathname();

  const activeIndex = TABS.findIndex((tab) => pathname?.startsWith(tab.href));
  const value = activeIndex === -1 ? 0 : activeIndex;

  return (
    <Box
      sx={{
        position: 'sticky',
        top: layoutTokens.appBarHeight,
        zIndex: theme.zIndex.appBar - 1,
        bgcolor: theme.palette.background.default,
        borderBottom: `1px solid ${theme.palette.divider}`,
      }}
    >
      <Tabs
        value={value}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        sx={{
          minHeight: 48,
          '& .MuiTabs-indicator': {
            height: 2,
          },
        }}
      >
        {TABS.map((tab) => (
          <Tab
            key={tab.href}
            component={Link}
            href={tab.href}
            label={tab.label}
            sx={{
              textTransform: 'none',
              minHeight: 48,
              fontWeight: 500,
            }}
          />
        ))}
      </Tabs>
    </Box>
  );
}
```

- [ ] **Step 2: Verify file compiles**

Run: `cd finext-nextjs && npx tsc --noEmit` (or run dev server — errors show in terminal)
Expected: No TypeScript errors. File not imported anywhere yet → no runtime impact.

---

## Task 2: Create `GuideAccordion` component

**Files:**
- Create: `finext-nextjs/app/(main)/guides/components/GuideAccordion.tsx`

- [ ] **Step 1: Create file with full code**

```tsx
'use client';

import React from 'react';
import { Accordion, AccordionSummary, AccordionDetails, Box, Typography, useTheme } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Icon } from '@iconify/react';
import { fontWeight, getResponsiveFontSize } from 'theme/tokens';

interface GuideAccordionProps {
  title: string;
  icon?: string;
  defaultExpanded?: boolean;
  children: React.ReactNode;
}

export default function GuideAccordion({ title, icon, defaultExpanded = false, children }: GuideAccordionProps) {
  const theme = useTheme();

  return (
    <Accordion
      defaultExpanded={defaultExpanded}
      disableGutters
      square={false}
      sx={{
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: 1,
        '&:before': { display: 'none' },
        boxShadow: 'none',
        mb: 1.5,
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        sx={{
          px: 2,
          py: 0.5,
          '& .MuiAccordionSummary-content': {
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            my: 1,
          },
        }}
      >
        {icon && (
          <Box sx={{ display: 'flex', alignItems: 'center', color: theme.palette.primary.main }}>
            <Icon icon={icon} width={22} height={22} />
          </Box>
        )}
        <Typography
          sx={{
            fontSize: getResponsiveFontSize('lg'),
            fontWeight: fontWeight.semibold,
            color: theme.palette.text.primary,
          }}
        >
          {title}
        </Typography>
      </AccordionSummary>
      <AccordionDetails
        sx={{
          px: 2,
          py: 2,
          borderTop: `1px solid ${theme.palette.divider}`,
        }}
      >
        {children}
      </AccordionDetails>
    </Accordion>
  );
}
```

- [ ] **Step 2: Verify compile**

Run: `cd finext-nextjs && npx tsc --noEmit`
Expected: No errors.

---

## Task 3: Create `GuideLayout` component

**Files:**
- Create: `finext-nextjs/app/(main)/guides/components/GuideLayout.tsx`

- [ ] **Step 1: Create file with full code**

```tsx
'use client';

import React from 'react';
import { Box } from '@mui/material';
import GuideTabBar from './GuideTabBar';

interface GuideLayoutProps {
  children: React.ReactNode;
}

export default function GuideLayout({ children }: GuideLayoutProps) {
  return (
    <>
      <GuideTabBar />
      <Box
        sx={{
          width: '100%',
          maxWidth: 1200,
          mx: 'auto',
          px: { xs: 1.5, md: 2, lg: 3 },
          py: { xs: 3, md: 4 },
        }}
      >
        {children}
      </Box>
    </>
  );
}
```

- [ ] **Step 2: Verify compile**

Run: `cd finext-nextjs && npx tsc --noEmit`
Expected: No errors.

---

## Task 4: Create `guides/layout.tsx`

**Files:**
- Create: `finext-nextjs/app/(main)/guides/layout.tsx`

- [ ] **Step 1: Create file with full code**

```tsx
import GuideLayout from './components/GuideLayout';

export default function GuidesSegmentLayout({ children }: { children: React.ReactNode }) {
  return <GuideLayout>{children}</GuideLayout>;
}
```

- [ ] **Step 2: Verify compile**

Run: `cd finext-nextjs && npx tsc --noEmit`
Expected: No errors.

---

## Task 5: Create `guides/page.tsx` (redirect)

**Files:**
- Create: `finext-nextjs/app/(main)/guides/page.tsx`

- [ ] **Step 1: Create file with full code**

```tsx
import { redirect } from 'next/navigation';

export default function GuidesRootPage() {
  redirect('/guides/overview');
}
```

- [ ] **Step 2: Verify compile**

Run: `cd finext-nextjs && npx tsc --noEmit`
Expected: No errors. (Trang chưa test được vì child routes chưa tồn tại — sẽ thử ở Phase 2.)

---

# Phase 2 — Page shells (3 guide pages với accordion trống)

## Task 6: Create `/guides/overview` shell

**Files:**
- Create: `finext-nextjs/app/(main)/guides/overview/page.tsx`
- Create: `finext-nextjs/app/(main)/guides/overview/PageContent.tsx`

- [ ] **Step 1: Create `page.tsx`**

```tsx
import { Metadata } from 'next';
import PageContent from './PageContent';

export const metadata: Metadata = {
  title: 'Tổng quan tính năng',
  description: 'Hướng dẫn xem và giải thích các tính năng trong các trang của Finext.',
  openGraph: {
    title: 'Tổng quan tính năng | Finext',
    description: 'Hướng dẫn xem và giải thích các tính năng trong các trang của Finext.',
  },
};

export default function GuidesOverviewPage() {
  return <PageContent />;
}
```

- [ ] **Step 2: Create `PageContent.tsx` với 7 accordion rỗng**

```tsx
'use client';

import { Box, Typography } from '@mui/material';
import GuideAccordion from '../components/GuideAccordion';

export default function OverviewContent() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <Typography variant="h4" sx={{ mb: 3, fontWeight: 600 }}>
        Tổng quan các tính năng
      </Typography>

      <GuideAccordion title="Trang chủ (Home)" icon="mdi:home-variant">
        <Typography color="text.secondary">Nội dung đang cập nhật...</Typography>
      </GuideAccordion>

      <GuideAccordion title="Thị trường (Markets)" icon="mdi:chart-box-outline">
        <Typography color="text.secondary">Nội dung đang cập nhật...</Typography>
      </GuideAccordion>

      <GuideAccordion title="Phân tích cổ phiếu" icon="mdi:chart-line">
        <Typography color="text.secondary">Nội dung đang cập nhật...</Typography>
      </GuideAccordion>

      <GuideAccordion title="Nhóm ngành (Sectors)" icon="mdi:view-grid-outline">
        <Typography color="text.secondary">Nội dung đang cập nhật...</Typography>
      </GuideAccordion>

      <GuideAccordion title="Nhóm cổ phiếu (Groups)" icon="mdi:account-group-outline">
        <Typography color="text.secondary">Nội dung đang cập nhật...</Typography>
      </GuideAccordion>

      <GuideAccordion title="Tin tức (News)" icon="mdi:newspaper-variant-outline">
        <Typography color="text.secondary">Nội dung đang cập nhật...</Typography>
      </GuideAccordion>

      <GuideAccordion title="Báo cáo (Reports)" icon="mdi:file-document-outline">
        <Typography color="text.secondary">Nội dung đang cập nhật...</Typography>
      </GuideAccordion>
    </Box>
  );
}
```

- [ ] **Step 3: Verify compile**

Run: `cd finext-nextjs && npx tsc --noEmit`
Expected: No errors.

---

## Task 7: Create `/guides/stock-screener` shell

**Files:**
- Create: `finext-nextjs/app/(main)/guides/stock-screener/page.tsx`
- Create: `finext-nextjs/app/(main)/guides/stock-screener/PageContent.tsx`

- [ ] **Step 1: Create `page.tsx`**

```tsx
import { Metadata } from 'next';
import PageContent from './PageContent';

export const metadata: Metadata = {
  title: 'Hướng dẫn bộ lọc cổ phiếu',
  description: 'Hướng dẫn sử dụng bộ lọc cổ phiếu (screener) để tìm cơ hội đầu tư phù hợp.',
  openGraph: {
    title: 'Hướng dẫn bộ lọc cổ phiếu | Finext',
    description: 'Hướng dẫn sử dụng bộ lọc cổ phiếu (screener) để tìm cơ hội đầu tư phù hợp.',
  },
};

export default function GuidesStockScreenerPage() {
  return <PageContent />;
}
```

- [ ] **Step 2: Create `PageContent.tsx` với accordion rỗng**

```tsx
'use client';

import { Box, Typography } from '@mui/material';
import GuideAccordion from '../components/GuideAccordion';

export default function StockScreenerContent() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <Typography variant="h4" sx={{ mb: 3, fontWeight: 600 }}>
        Hướng dẫn bộ lọc cổ phiếu
      </Typography>

      <GuideAccordion title="Giới thiệu bộ lọc" icon="mdi:information-outline">
        <Typography color="text.secondary">Nội dung đang cập nhật...</Typography>
      </GuideAccordion>

      <GuideAccordion title="Bộ lọc nhanh (FilterBar)" icon="mdi:filter-outline">
        <Typography color="text.secondary">Nội dung đang cập nhật...</Typography>
      </GuideAccordion>

      <GuideAccordion title="Bộ lọc nâng cao (AdvancedFilterPanel)" icon="mdi:filter-cog-outline">
        <Typography color="text.secondary">Nội dung đang cập nhật...</Typography>
      </GuideAccordion>

      <GuideAccordion title="Tùy chỉnh cột hiển thị" icon="mdi:table-column">
        <Typography color="text.secondary">Nội dung đang cập nhật...</Typography>
      </GuideAccordion>

      <GuideAccordion title="Đổi view bảng kết quả" icon="mdi:view-dashboard-outline">
        <Typography color="text.secondary">Nội dung đang cập nhật...</Typography>
      </GuideAccordion>

      <GuideAccordion title="Đọc bảng kết quả" icon="mdi:table">
        <Typography color="text.secondary">Nội dung đang cập nhật...</Typography>
      </GuideAccordion>

      <GuideAccordion title="Mở trang phân tích cổ phiếu" icon="mdi:arrow-right-circle-outline">
        <Typography color="text.secondary">Nội dung đang cập nhật...</Typography>
      </GuideAccordion>
    </Box>
  );
}
```

- [ ] **Step 3: Verify compile**

Run: `cd finext-nextjs && npx tsc --noEmit`
Expected: No errors.

---

## Task 8: Create `/guides/charts-watchlist` shell

**Files:**
- Create: `finext-nextjs/app/(main)/guides/charts-watchlist/page.tsx`
- Create: `finext-nextjs/app/(main)/guides/charts-watchlist/PageContent.tsx`

- [ ] **Step 1: Create `page.tsx`**

```tsx
import { Metadata } from 'next';
import PageContent from './PageContent';

export const metadata: Metadata = {
  title: 'Hướng dẫn biểu đồ & Watchlist',
  description: 'Hướng dẫn sử dụng biểu đồ phân tích và quản lý Watchlist trên Finext.',
  openGraph: {
    title: 'Hướng dẫn biểu đồ & Watchlist | Finext',
    description: 'Hướng dẫn sử dụng biểu đồ phân tích và quản lý Watchlist trên Finext.',
  },
};

export default function GuidesChartsWatchlistPage() {
  return <PageContent />;
}
```

- [ ] **Step 2: Create `PageContent.tsx` với accordion rỗng**

```tsx
'use client';

import { Box, Typography } from '@mui/material';
import GuideAccordion from '../components/GuideAccordion';

export default function ChartsWatchlistContent() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <Typography variant="h4" sx={{ mb: 3, fontWeight: 600 }}>
        Hướng dẫn biểu đồ & Watchlist
      </Typography>

      <Typography variant="h6" sx={{ mt: 2, mb: 2, fontWeight: 600 }}>
        Biểu đồ (/charts)
      </Typography>

      <GuideAccordion title="Giới thiệu biểu đồ" icon="mdi:chart-timeline-variant">
        <Typography color="text.secondary">Nội dung đang cập nhật...</Typography>
      </GuideAccordion>

      <GuideAccordion title="Thanh công cụ (Toolbar)" icon="mdi:tools">
        <Typography color="text.secondary">Nội dung đang cập nhật...</Typography>
      </GuideAccordion>

      <GuideAccordion title="Bảng chỉ báo (Indicators)" icon="mdi:chart-bell-curve">
        <Typography color="text.secondary">Nội dung đang cập nhật...</Typography>
      </GuideAccordion>

      <GuideAccordion title="Bảng tin tức (News Panel)" icon="mdi:newspaper">
        <Typography color="text.secondary">Nội dung đang cập nhật...</Typography>
      </GuideAccordion>

      <Typography variant="h6" sx={{ mt: 4, mb: 2, fontWeight: 600 }}>
        Watchlist (/watchlist)
      </Typography>

      <GuideAccordion title="Thêm danh sách mới" icon="mdi:playlist-plus">
        <Typography color="text.secondary">Nội dung đang cập nhật...</Typography>
      </GuideAccordion>

      <GuideAccordion title="Xóa và chỉnh sửa danh sách" icon="mdi:playlist-edit">
        <Typography color="text.secondary">Nội dung đang cập nhật...</Typography>
      </GuideAccordion>

      <GuideAccordion title="Kéo thả sắp xếp" icon="mdi:drag-variant">
        <Typography color="text.secondary">Nội dung đang cập nhật...</Typography>
      </GuideAccordion>

      <GuideAccordion title="Dialog xác nhận" icon="mdi:alert-circle-outline">
        <Typography color="text.secondary">Nội dung đang cập nhật...</Typography>
      </GuideAccordion>
    </Box>
  );
}
```

- [ ] **Step 3: Verify compile**

Run: `cd finext-nextjs && npx tsc --noEmit`
Expected: No errors.

---

## ✋ Checkpoint A — User test kiến trúc (PASSED với refactor)

User feedback: tab bar không phù hợp với convention dự án (Tabs chỉ để switch tab trong page). Border accordion xấu, font to quá, có lẫn tiếng Anh trong accordion title. → Refactor sang breadcrumb + glass card + font nhỏ hơn + bỏ tiếng Anh (xem note đầu file).

Sau refactor, verify:
- Truy cập `/guides` → redirect `/guides/overview`. ✓
- Mỗi trang có breadcrumb top: `Trang chủ / Hướng dẫn sử dụng [/ current]`. ✓
- Accordion dùng glass card, không viền cứng. ✓
- Font page title `xxl`, accordion title `md`, body `sm`. ✓
- Accordion titles tiếng Việt thuần. ✓

---

# Phase 3 — Update footer + cleanup `/learning/*`

## Task 9: Update `Footer.tsx`

**Files:**
- Modify: `finext-nextjs/components/layout/Footer.tsx` (lines 19-26, mục `hoTro`)

- [ ] **Step 1: Replace `hoTro` block**

Find in `finext-nextjs/components/layout/Footer.tsx`:

```tsx
  hoTro: {
    title: 'Finext Learning',
    links: [
      { label: 'Phân tích kỹ thuật', href: '/learning/technical-analysis' },
      { label: 'Phân tích cơ bản', href: '/learning/fundamental-analysis' },
      { label: 'Phân tích dòng tiền', href: '/learning/cash-flow-analysis' },
    ],
  },
```

Replace with:

```tsx
  hoTro: {
    title: 'Hướng dẫn sử dụng',
    links: [
      { label: 'Tổng quan tính năng', href: '/guides/overview' },
      { label: 'Biểu đồ và Watchlist', href: '/guides/charts-watchlist' },
      { label: 'Bộ lọc cổ phiếu', href: '/guides/stock-screener' },
    ],
  },
```

- [ ] **Step 2: Verify compile + footer hiển thị đúng**

Run: `cd finext-nextjs && npx tsc --noEmit`
Expected: No errors. Dev server: footer cột thứ 2 giờ là "Hướng dẫn sử dụng" với 3 link mới, click đi đúng trang.

---

## Task 10: Update `sitemap.ts`

**Files:**
- Modify: `finext-nextjs/app/sitemap.ts` (lines 85-103, block Finext Learning)

- [ ] **Step 1: Replace 3 `/learning/*` entries với 3 `/guides/*` entries**

Find in `finext-nextjs/app/sitemap.ts`:

```tsx
        // ── Finext Learning ──
        {
            url: `${baseUrl}/learning/technical-analysis`,
            lastModified: currentDate,
            changeFrequency: 'weekly',
            priority: 0.6,
        },
        {
            url: `${baseUrl}/learning/fundamental-analysis`,
            lastModified: currentDate,
            changeFrequency: 'weekly',
            priority: 0.6,
        },
        {
            url: `${baseUrl}/learning/cash-flow-analysis`,
            lastModified: currentDate,
            changeFrequency: 'weekly',
            priority: 0.6,
        },
```

Replace with:

```tsx
        // ── Hướng dẫn sử dụng ──
        {
            url: `${baseUrl}/guides/overview`,
            lastModified: currentDate,
            changeFrequency: 'weekly',
            priority: 0.6,
        },
        {
            url: `${baseUrl}/guides/stock-screener`,
            lastModified: currentDate,
            changeFrequency: 'weekly',
            priority: 0.6,
        },
        {
            url: `${baseUrl}/guides/charts-watchlist`,
            lastModified: currentDate,
            changeFrequency: 'weekly',
            priority: 0.6,
        },
```

- [ ] **Step 2: Verify compile**

Run: `cd finext-nextjs && npx tsc --noEmit`
Expected: No errors.

---

## Task 11: Update `robots.ts`

**Files:**
- Modify: `finext-nextjs/app/robots.ts` (line 34)

- [ ] **Step 1: Replace `'/learning/'` → `'/guides/'` trong Googlebot allow list**

Find in `finext-nextjs/app/robots.ts`:

```tsx
                    '/learning/',
```

Replace with:

```tsx
                    '/guides/',
```

(Chỉ 1 occurrence; nằm trong block `userAgent: 'Googlebot'` → `allow`.)

- [ ] **Step 2: Verify compile**

Run: `cd finext-nextjs && npx tsc --noEmit`
Expected: No errors.

---

## Task 12: Xóa `/learning/*`

**Files:**
- Delete: toàn bộ `finext-nextjs/app/(main)/learning/`

- [ ] **Step 1: Xóa 3 thư mục con**

Run:

```bash
rm -rf finext-nextjs/app/\(main\)/learning/technical-analysis
rm -rf finext-nextjs/app/\(main\)/learning/fundamental-analysis
rm -rf finext-nextjs/app/\(main\)/learning/cash-flow-analysis
```

- [ ] **Step 2: Xóa thư mục `learning` rỗng**

Run:

```bash
rmdir finext-nextjs/app/\(main\)/learning
```

Expected: Thư mục `learning/` biến mất khỏi repo.

- [ ] **Step 3: Grep verify không còn reference `/learning/`**

Use Grep tool:
- Pattern: `/learning/`
- Path: `finext-nextjs/`
- Glob: `**/*.{ts,tsx,json}`

Expected: 0 kết quả (trừ `node_modules/`, `.next/`).

- [ ] **Step 4: Test 404**

Dev server: truy cập `/learning/technical-analysis` → 404 Next.js.

---

## ✋ Checkpoint B — User test toàn bộ khung

Sau Phase 3, user verify:
- Footer: cột "Hướng dẫn sử dụng" với 3 link mới, click đi đúng trang guide.
- Gõ `/learning/technical-analysis` trực tiếp → 404.
- `sitemap.xml` (dev: `http://localhost:3000/sitemap.xml`) chứa 3 URL `/guides/*`, không còn `/learning/*`.
- Build prod thử: `cd finext-nextjs && npm run build` → không có lỗi broken link từ static pages.

**Nếu vấn đề, fix trước khi sang Phase 4.**

---

# Phase 4 — Fill content từng accordion (iterative, per-request)

Phase này chạy theo request của user, từng accordion một. Pattern chung cho mỗi accordion:

### Pattern template

**Khi user nói "fill accordion [Page] / [Section]":**

- [ ] **Step 1: Đọc source của page/component liên quan**

  Ví dụ fill "Thị trường (Markets)" → đọc `finext-nextjs/app/(main)/markets/page.tsx` + các component con trong `markets/components/` để hiểu tab/section thực tế. Liệt kê các tab/section sẽ giải thích.

- [ ] **Step 2: Request user chụp screenshot**

  Nói rõ với user: *"Cần screenshot của trang `/markets` toàn màn hình, lưu vào `finext-nextjs/public/guides/overview/markets-overview.png`. Nếu có nhiều tab con thì thêm ảnh `markets-tab-<tab-slug>.png` cho từng tab."*

  Đợi user confirm đã chụp xong.

- [ ] **Step 3: Replace accordion placeholder bằng nội dung thật**

  Edit file `PageContent.tsx` tương ứng. Ví dụ replace:

  ```tsx
  <GuideAccordion title="Thị trường (Markets)" icon="mdi:chart-box-outline">
    <Typography color="text.secondary">Nội dung đang cập nhật...</Typography>
  </GuideAccordion>
  ```

  Thành (ví dụ):

  ```tsx
  <GuideAccordion title="Thị trường (Markets)" icon="mdi:chart-box-outline">
    <Typography paragraph>
      Trang Thị trường (<code>/markets</code>) tổng hợp biến động các chỉ số chính,
      dòng tiền, tín hiệu kỹ thuật và định giá theo ngành.
    </Typography>
    <Box sx={{ my: 2 }}>
      <Image
        src="/guides/overview/markets-overview.png"
        alt="Giao diện trang Thị trường"
        width={1200}
        height={700}
        style={{ width: '100%', height: 'auto', borderRadius: 8 }}
      />
    </Box>
    <Typography variant="subtitle1" sx={{ fontWeight: 600, mt: 2, mb: 1 }}>
      Các tab chính
    </Typography>
    <Typography component="div">
      <ul>
        <li><strong>Biến động:</strong> ...</li>
        <li><strong>Dòng tiền:</strong> ...</li>
        <li><strong>Tín hiệu:</strong> ...</li>
        <li><strong>Định giá:</strong> ...</li>
      </ul>
    </Typography>
  </GuideAccordion>
  ```

  **Ràng buộc khi viết content:**
  - Dùng `<Image>` của Next (`import Image from 'next/image';` — thêm vào top nếu chưa có).
  - Width/height ảnh: dùng ratio thật của screenshot (thường 16:9 hoặc theo thực tế). Nếu chưa chắc, để `width={1600} height={900}` và style `width: '100%'` để tự responsive.
  - Mỗi accordion 1-3 screenshot max; không overload.
  - Text ngắn gọn, dùng `<Typography paragraph>` cho đoạn, `<ul>` cho list, `<strong>` cho highlight.

- [ ] **Step 4: Verify compile + hiển thị**

  Run: `cd finext-nextjs && npx tsc --noEmit`
  Expected: No errors.
  Dev server: mở accordion tương ứng → text + ảnh hiển thị đúng.

### Danh sách accordion cần fill (checklist)

**`/guides/overview` (Trang 1):**
- [ ] Trang chủ (Home) — đọc `app/(main)/home/`
- [ ] Thị trường (Markets) — đọc `app/(main)/markets/` + liệt kê tab con (BiếnĐộng, DòngTiền, TínHiệu, ĐịnhGiá, PTKT, NNTD)
- [ ] Phân tích cổ phiếu — đọc `app/(main)/stocks/[symbol]/` + các section (StocksSection, DongTienSection, PriceMapSection, StockFinancialsSection, StockFinRatiosSection, NewsSection...)
- [ ] Nhóm ngành (Sectors) — đọc `app/(main)/sectors/` + `sectors/[sectorId]/` + tab con
- [ ] Nhóm cổ phiếu (Groups) — đọc `app/(main)/groups/` + `groups/[groupId]/` + tab con
- [ ] Tin tức (News) — đọc `app/(main)/news/` + category/type tabs
- [ ] Báo cáo (Reports) — đọc `app/(main)/reports/` + type tabs

**`/guides/stock-screener` (Trang 2):**
- [ ] Giới thiệu bộ lọc — đọc `app/(main)/stocks/page.tsx` + `PageContent.tsx`
- [ ] Bộ lọc nhanh — đọc `app/(main)/stocks/components/FilterBar.tsx`
- [ ] Bộ lọc nâng cao — đọc `app/(main)/stocks/components/AdvancedFilterPanel.tsx`
- [ ] Tùy chỉnh cột — đọc `app/(main)/stocks/components/ColumnCustomizer.tsx`
- [ ] Đổi view bảng — đọc `app/(main)/stocks/components/TableViewSelector.tsx`
- [ ] Đọc bảng kết quả — đọc `app/(main)/stocks/components/ResultTable.tsx`
- [ ] Mở trang phân tích — mô tả flow click → `/stocks/[symbol]`

**`/guides/charts-watchlist` (Trang 3):**
- [ ] Giới thiệu biểu đồ — đọc `app/(main)/charts/layout.tsx` + `charts/[id]/`
- [ ] Toolbar — đọc `app/(main)/charts/[id]/ChartToolbar.tsx`
- [ ] Indicators panel — đọc `app/(main)/charts/[id]/IndicatorsPanel.tsx`
- [ ] News panel — đọc `app/(main)/charts/[id]/PanelNewsList.tsx`
- [ ] Thêm danh sách watchlist — đọc `app/(main)/watchlist/components/AddWatchlistDialog.tsx`
- [ ] Xóa/chỉnh watchlist — đọc `app/(main)/watchlist/components/SortableWatchlistCard.tsx`
- [ ] Kéo thả sắp xếp — đọc `app/(main)/watchlist/page.tsx` + drag-drop logic
- [ ] Dialog xác nhận — đọc `app/(main)/watchlist/components/ConfirmDialog.tsx`

### Notes cho phase 4

- **Thứ tự fill tùy user** — mỗi lần user nói "fill [accordion]" thì theo pattern trên.
- **Image nên ở dưới 500KB** mỗi file; nếu lớn quá có thể optimize qua `tinypng` trước khi commit.
- **Alt text tiếng Việt rõ nghĩa** cho accessibility & SEO.
- **Không đổi accordion title/icon** trừ khi user yêu cầu (giữ nhất quán với shell đã approve).

---

## ✋ Checkpoint C — Final review

Sau khi fill đủ tất cả accordion, user verify:
- 3 trang guide hiển thị đầy đủ content, không còn "Nội dung đang cập nhật...".
- Tất cả ảnh load OK (không broken image).
- Tab bar navigate 3 trang mượt.
- Mobile responsive OK.
- Build prod: `cd finext-nextjs && npm run build` → no errors.

User tự commit git khi hài lòng.

---

# Self-Review

**1. Spec coverage:**
- Routing (`/guides/*`, redirect, no index) → Tasks 4, 5.
- 3 shared components → Tasks 1, 2, 3.
- 3 guide pages với accordion → Tasks 6, 7, 8.
- Content structure (7 / 7 / 8 accordion) → matches spec section 6.
- Footer update → Task 9.
- Sitemap/robots → Tasks 10, 11.
- Xóa `/learning/*` → Task 12.
- Check policies references → covered trong Task 12 Step 3 (grep verify).
- Content pattern (text + ảnh + h4) → Task 6 skeleton + Phase 4 template.

**2. Placeholder scan:** Không có TODO/TBD. Phase 4 có content template cụ thể với code example thật. "Nội dung đang cập nhật" trong Phase 2 shell là **intentional placeholder** (shell state, sẽ replace trong Phase 4) — đã document rõ.

**3. Type consistency:**
- `GuideAccordionProps.icon?: string` — matches iconify-react Icon `icon` prop type.
- `GuideTabBar` không có props — nhất quán giữa Task 1, 3, 4.
- `TABS` array shape `{ label, href }` — khớp cả định nghĩa và use.
- `layoutTokens.appBarHeight` — verified tồn tại ở `theme/tokens.ts:455`.

# User Guide Pages — Design Spec

**Date:** 2026-04-22
**Status:** Draft (awaiting user review)
**Scope:** Frontend only (`finext-nextjs/`)

## 1. Mục tiêu

Thay thế cột "Finext Learning" trên footer (hiện trỏ tới 3 trang Coming Soon `/learning/*`) bằng cụm 3 trang hướng dẫn sử dụng app Finext. Mỗi trang cover một khía cạnh khác nhau:

1. **Tổng quan tính năng** — giải thích các page chính (Home, Markets, Stocks detail, Sectors, Groups, News, Reports) và tab con bên trong từng page.
2. **Bộ lọc cổ phiếu** — hướng dẫn sử dụng bộ lọc ở page `/stocks` (screener).
3. **Biểu đồ & Watchlist** — hướng dẫn sử dụng page `/charts` và tính năng Watchlist.

3 trang là public (không cần đăng nhập), nội dung text + screenshot, hiển thị dạng accordion doc chuyên nghiệp.

## 2. Quyết định chốt

| Mục | Quyết định |
|---|---|
| Route | `/guides/overview`, `/guides/stock-screener`, `/guides/charts-watchlist` |
| Index `/guides` | Không có — redirect về `/guides/overview` |
| Access | Public (nằm trong `(main)` group, cùng tính chất với `/policies/*`, `/support/*`) |
| Tên cột footer | "Hướng dẫn sử dụng" |
| Format nội dung | Text + screenshot (user chụp trong quá trình build) |
| Layout 1 trang | Accordion các chủ đề, MUI `<Accordion>` bọc glass card style |
| Nav giữa 3 trang | Breadcrumb ở top mỗi trang (pattern giống `NewsBreadcrumb`) — không dùng tab bar vì convention dự án: Tabs chỉ switch tab trong page, không đổi page |
| Fate `/learning/*` | Xóa toàn bộ (3 page Coming Soon) |
| Phương án triển khai | Inline content + shared primitives (không MDX, không config) |

## 3. Cấu trúc file

### 3.1. Thư mục mới

```
finext-nextjs/app/(main)/guides/
├── page.tsx                     # redirect về /guides/overview
├── layout.tsx                   # wrap 3 child với <GuideLayout>
├── components/
│   ├── GuideLayout.tsx          # container + max-width (không có nav)
│   ├── GuideBreadcrumb.tsx      # breadcrumb pattern (NewsBreadcrumb-like)
│   └── GuideAccordion.tsx       # MUI Accordion bọc glass card style
├── overview/
│   ├── page.tsx                 # metadata SEO
│   └── PageContent.tsx          # breadcrumb + 7 accordion
├── stock-screener/
│   ├── page.tsx
│   └── PageContent.tsx
└── charts-watchlist/
    ├── page.tsx
    └── PageContent.tsx
```

### 3.2. Assets ảnh

```
finext-nextjs/public/guides/
├── overview/                    # screenshot các page chính
├── stock-screener/              # screenshot flow bộ lọc
└── charts-watchlist/            # screenshot charts + watchlist
```

Tên file ảnh theo pattern `<section-slug>.png` (ví dụ `home-overview.png`, `advanced-filter.png`). Khi build từng accordion, request user chụp ảnh cụ thể theo tên.

### 3.3. Thư mục xóa

```
finext-nextjs/app/(main)/learning/   ❌ xóa toàn bộ (3 page Coming Soon)
```

## 4. Shared components

### 4.1. `GuideLayout.tsx`

Wrapper dùng trong `guides/layout.tsx`. Cung cấp:
- Container `<Box>` max-width 1200.
- Spacing trên/dưới chuẩn.
- Render `{children}` trực tiếp (breadcrumb đặt trong mỗi PageContent, không ở layout).

```tsx
interface GuideLayoutProps {
  children: React.ReactNode;
}
```

### 4.2. `GuideBreadcrumb.tsx`

Pattern: `Trang chủ / Hướng dẫn sử dụng [/ current page]`. Dùng MUI `<Breadcrumbs>` + `<MuiLink>` với `component={Link}` của Next để client-side nav.

- Khi ở `/guides/overview`: `items=[]` → "Hướng dẫn sử dụng" là current (text, không link).
- Khi ở `/guides/stock-screener`: `items=[{ label: 'Bộ lọc cổ phiếu' }]` → "Hướng dẫn sử dụng" là link về `/guides/overview`, "Bộ lọc cổ phiếu" là current.
- Khi ở `/guides/charts-watchlist`: `items=[{ label: 'Biểu đồ & Watchlist' }]`.

```tsx
interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface GuideBreadcrumbProps {
  items: BreadcrumbItem[];
}
```

Font size: `getResponsiveFontSize('sm')`. Style khớp `NewsBreadcrumb` cho nhất quán.

### 4.3. `GuideAccordion.tsx`

Wrapper quanh MUI `<Accordion>` / `<AccordionSummary>` / `<AccordionDetails>`, style **glass card** (dùng `getGlassCard(isDark)` từ `theme/tokens`) thay cho border cứng.

```tsx
interface GuideAccordionProps {
  title: string;
  icon?: string;                    // iconify icon ID (ví dụ "mdi:home-variant")
  defaultExpanded?: boolean;        // mặc định false
  children: React.ReactNode;        // JSX tự do (text, ảnh, list...)
}
```

- Expand icon: `<ExpandMoreIcon fontSize="small">`.
- `disableGutters` cho spacing chuẩn.
- Background: `getGlassCard(isDark)` spread vào sx.
- Title font: `getResponsiveFontSize('md')` + `fontWeight.semibold`.
- Icon size: 18px.
- minHeight: 44px (compact, doc-style).

## 5. Content pattern — skeleton của `PageContent.tsx`

```tsx
'use client';

import Image from 'next/image';
import { Box, Typography } from '@mui/material';
import GuideAccordion from '../components/GuideAccordion';
import GuideBreadcrumb from '../components/GuideBreadcrumb';
import { getResponsiveFontSize, fontWeight, spacing } from 'theme/tokens';

export default function OverviewContent() {
  return (
    <Box sx={{ py: spacing.xs }}>
      <GuideBreadcrumb items={[]} />

      <Typography
        sx={{
          fontSize: getResponsiveFontSize('xxl'),
          fontWeight: fontWeight.semibold,
          mb: 3,
        }}
      >
        Tổng quan các tính năng
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        <GuideAccordion title="Trang chủ" icon="mdi:home-variant">
          <Typography sx={{ fontSize: getResponsiveFontSize('sm') }} paragraph>
            Trang chủ là nơi bạn thấy tổng hợp thông tin thị trường...
          </Typography>
          <Box sx={{ my: 2 }}>
            {/* Tỉ lệ ảnh: 16:9, full screenshot trang chủ */}
            <Image
              src="/guides/overview/home-overview.png"
              alt="Giao diện trang chủ"
              width={1600}
              height={900}
              style={{ width: '100%', height: 'auto', borderRadius: 8 }}
            />
          </Box>
        </GuideAccordion>

        {/* ... accordion khác */}
      </Box>
    </Box>
  );
}
```

**Ràng buộc:**
- Mỗi page bắt đầu bằng `<GuideBreadcrumb>` rồi Typography title (`xxl` size + semibold, không `variant="h1/h4"` để kiểm soát size chính xác).
- Accordion title bỏ tên tiếng Anh `()` — chỉ dùng tiếng Việt.
- Không `defaultExpanded={true}` cho accordion nào — tránh page dài khi load.
- Body text trong accordion dùng `getResponsiveFontSize('sm')` cho dễ đọc doc-style.
- Ảnh qua Next `<Image>`, full-width responsive, `borderRadius: 8`. Kèm comment ghi tỉ lệ khung hình (ví dụ `{/* Tỉ lệ 16:9, full screenshot */}`) để user chụp đúng sau.

## 6. Scope nội dung từng trang

### 6.1. Trang 1 `/guides/overview` — 7 accordion

Mỗi accordion giới thiệu 1 page chính + các tab/section con bên trong (review kĩ từng tab khi switch navbar):

1. Trang chủ — `/`
2. Thị trường — `/markets` *(review từng tab con)*
3. Phân tích cổ phiếu — `/stocks/[symbol]` *(không phải `/stocks` — bộ lọc đã có ở Trang 2)* *(review từng tab con)*
4. Nhóm ngành — `/sectors` *(review từng tab con)*
5. Nhóm cổ phiếu — `/groups` *(review từng tab con)*
6. Tin tức — `/news` *(review từng tab con)*
7. Báo cáo — `/reports` *(review từng tab con)*

Accordion titles chỉ dùng tiếng Việt, không để `(Home)`, `(Markets)`, v.v.

Mỗi accordion: 1-2 đoạn text giải thích + screenshot + bullet list các feature chính.

**Quan trọng:** ở bước implementation, cần đọc source của từng page để liệt kê đủ các tab/section con, đảm bảo guide cover hết — không bỏ sót tab nào.

### 6.2. Trang 2 `/guides/stock-screener` — accordion theo thao tác

- Giới thiệu bộ lọc
- Bộ lọc nhanh
- Bộ lọc nâng cao
- Tùy chỉnh cột hiển thị
- Đổi view bảng kết quả
- Đọc bảng kết quả
- Mở trang phân tích cổ phiếu

Trong content body có thể nhắc tên component gốc (FilterBar, AdvancedFilterPanel, v.v.) nhưng không để trong accordion title.

### 6.3. Trang 3 `/guides/charts-watchlist` — 2 nhóm lớn (section subtitle)

**Biểu đồ:**
- Giới thiệu biểu đồ
- Thanh công cụ
- Bảng chỉ báo
- Bảng tin tức

**Watchlist:**
- Thêm danh sách mới
- Xóa và chỉnh sửa danh sách
- Kéo thả sắp xếp
- Dialog xác nhận

Section subtitle ("Biểu đồ", "Watchlist") dùng `getResponsiveFontSize('lg')` + semibold, không để `/charts`, `/watchlist` trong title.

## 7. Supporting changes

### 7.1. Update `components/layout/Footer.tsx`

```diff
  hoTro: {
-   title: 'Finext Learning',
+   title: 'Hướng dẫn sử dụng',
    links: [
-     { label: 'Phân tích kỹ thuật', href: '/learning/technical-analysis' },
-     { label: 'Phân tích cơ bản', href: '/learning/fundamental-analysis' },
-     { label: 'Phân tích dòng tiền', href: '/learning/cash-flow-analysis' },
+     { label: 'Tổng quan tính năng', href: '/guides/overview' },
+     { label: 'Bộ lọc cổ phiếu', href: '/guides/stock-screener' },
+     { label: 'Biểu đồ và Watchlist', href: '/guides/charts-watchlist' },
    ],
  },
```

### 7.2. `/guides/page.tsx` (server redirect)

```tsx
import { redirect } from 'next/navigation';

export default function GuidesRootPage() {
  redirect('/guides/overview');
}
```

### 7.3. Metadata mẫu

```tsx
// guides/overview/page.tsx
export const metadata: Metadata = {
  title: 'Tổng quan tính năng',
  description: 'Hướng dẫn xem và giải thích các tính năng trong các trang của Finext.',
  openGraph: {
    title: 'Tổng quan tính năng | Finext',
    description: 'Hướng dẫn xem và giải thích các tính năng trong các trang của Finext.',
  },
};
```

### 7.4. Xóa `/learning/*` và cập nhật reference

- Xóa toàn bộ `finext-nextjs/app/(main)/learning/`.
- Update `finext-nextjs/app/sitemap.ts`: thay 3 entry `/learning/*` → 3 entry `/guides/*`.
- Update `finext-nextjs/app/robots.ts` nếu có reference cụ thể tới `/learning/*`.
- Đọc 2 policies PageContent (`disclaimer`, `content`) để check reference `/learning/*` — nhiều khả năng chỉ là text, không link cứng. Xử lý nếu có.
- Grep cuối: `learning` trong codebase → 0 kết quả (trừ `node_modules/`, `.next/`).

## 8. Non-goals (out of scope)

- Không build MDX pipeline (không thêm dep).
- Không data-driven content config (không over-engineer).
- Không hệ thống search/filter trong guide.
- Không versioning cho guide (chỉ có 1 phiên bản).
- Không i18n — chỉ tiếng Việt.
- Không analytics riêng cho guide page (dùng chung tracking của app nếu có).
- Không tạo trang `/guides` index với card list (redirect về overview).
- Không unit test riêng — đây là pure UI content, test thủ công bằng dev server.

## 9. Decisions & tradeoffs

**Tại sao route `/guides/*` tiếng Anh thay vì `/huong-dan/*`:**
Nhất quán với convention hiện có (`/stocks`, `/reports`, `/sectors`, `/policies/*`, `/support/*`).

**Tại sao xóa `/learning/*` thay vì giữ làm slot tương lai:**
Cả 3 trang hiện là placeholder Coming Soon, không có traffic/content thật. Xóa không mất gì; nếu sau này muốn làm trang "học phân tích" có thể tạo mới với tên rõ nghĩa hơn.

**Tại sao inline JSX thay vì data-driven:**
Content đa dạng (text + ảnh + list + nested heading), schema cứng sẽ phải mở rộng liên tục hoặc nhét HTML string. Với 3 trang, inline JSX flexible và dễ review diff hơn.

**Tại sao MUI Accordion thay vì custom:**
Codebase đã có MUI, accessible out-of-the-box (keyboard, ARIA), không thêm dep. Rule "Simplicity First" trong CLAUDE.md.

**Tại sao breadcrumb thay vì tab bar:**
Convention dự án: MUI Tabs chỉ dùng để switch tab/section trong cùng 1 page (như `/markets`, `/sectors`). Cross-page navigation dùng breadcrumb — user không hiểu nhầm tab là chuyển content trong page. Reference: `NewsBreadcrumb` tại `app/(main)/news/components/`.

**Tại sao glass card thay vì border cứng:**
Project đã có token `getGlassCard(isDark)` trong `theme/tokens.ts` dùng cho nhiều UI element. Dùng glass card cho accordion đồng bộ với visual language của app, mềm mại hơn viền cứng, tốt cả light/dark mode.

**Tại sao font size `xxl` (page title) và `md` (accordion title):**
Doc-style reading — user feedback "nhỏ đi tương đồng page news, không to quá". Size tổng thể thấp hơn h1/h4 standard để không choáng màn hình, dễ scan nội dung dạng tham khảo.

## 10. Open questions

Không có — tất cả quyết định đã chốt trong brainstorm session.

## 11. Next step

Chuyển sang writing-plans skill để viết implementation plan chi tiết (task breakdown, thứ tự thực hiện, dependency giữa các task).

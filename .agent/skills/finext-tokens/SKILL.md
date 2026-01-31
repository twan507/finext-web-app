---
name: finext-tokens
description: Definitive guide to using Finext's design system tokens (colors, typography, spacing, border radius, shadows, z-index) to ensure UI consistency.
---

# Finext Design System Tokens

The `theme/tokens.ts` file is the SINGLE SOURCE OF TRUTH for all design values in the application. 
**NEVER** hardcode hex colors, pixel values for font sizes, margins, padding, or border radius. Always import and use the tokens.

## 1. Colors (Palette)

Access colors via the `useTheme()` hook strictly.

### Usages

-   **Primary**: `theme.palette.primary.main` (Brand purple)
-   **Text**:
    -   `theme.palette.text.primary` (Main content)
    -   `theme.palette.text.secondary` (Subtitles, labels)
    -   `theme.palette.text.disabled`
-   **Background**:
    -   `theme.palette.background.default` (Page background)
    -   `theme.palette.background.paper` (Cards, drawers)
-   **Components** (`theme.palette.component.*`):
    -   **Chart**: `theme.palette.component.chart.line`, `upColor`, `downColor`, etc.
    -   **Chip**: `theme.palette.component.chip.successBackground`, `defaultColor`
    -   **Table**: `theme.palette.component.tableHead.background`

### Example
```tsx
import { useTheme, Box, Typography } from '@mui/material';

export const MyComponent = () => {
  const theme = useTheme();
  return (
    <Box sx={{ bgcolor: theme.palette.background.paper, color: theme.palette.text.primary }}>
        <Typography sx={{ color: theme.palette.primary.main }}>Hello</Typography>
    </Box>
  );
};
```

## 2. Typography (Font Sizes & Weights)

Import `getResponsiveFontSize` and `fontWeight` from `theme/tokens`.

### Font Sizes (`fontSize`)
Use `getResponsiveFontSize(size)` for fully responsive text.

| Token | Desktop Size | Usage |
| :--- | :--- | :--- |
| `h1` | 2.5rem | Page Titles |
| `h2` | 2.25rem | Section Headings |
| `h3` | 2.0rem | Sub-section Headings |
| `h4` | 1.75rem | Card Titles |
| `xxl` | 1.5rem | Large Highlighted Text |
| `xl` | 1.375rem | Important Text |
| `lg` | 1.25rem | Subtitles |
| `md` | 1rem | **Standard Body Text** |
| `sm` | 0.875rem | Secondary Text / Labels |
| `xs` | 0.8125rem | Small Helpers |
| `xxs` | 0.75rem | Tiny Metadata |

### Font Weights (`fontWeight`)
- `fontWeight.medium` (500)
- `fontWeight.semibold` (600)
- `fontWeight.bold` (700)
- `fontWeight.extrabold` (800)

### Example
```tsx
import { getResponsiveFontSize, fontWeight } from 'theme/tokens';

<Typography sx={{ 
    fontSize: getResponsiveFontSize('h2'), 
    fontWeight: fontWeight.bold 
}}>
    Title
</Typography>
```

## 3. Spacing

Import `spacing` or `getResponsiveSpacing` from `theme/tokens`.
Base unit is effectively **4px** (technically MUI uses 8px, but our tokens allow finer grain).

| Token | Value | 
| :--- | :--- |
| `none` | 0px |
| `xxs` | 2px |
| `xs` | 4px |
| `sm` | 8px |
| `md` | 16px |
| `lg` | 24px |
| `xl` | 32px |
| `xxl` | 48px |
| `gap.column.md` | 24px |
| `gap.row.md` | 16px |

### Example
```tsx
import { spacing, getResponsiveSpacing } from 'theme/tokens';

// Static spacing
<Box sx={{ p: spacing.md, gap: spacing.sm }}>...</Box>

// Responsive spacing (adjusts on mobile)
<Box sx={{ p: getResponsiveSpacing('lg') }}>...</Box>
```

## 4. Border Radius

Import `borderRadius` or helpers like `borderRadiusTop` from `theme/tokens`.

| Token | Value | Usage |
| :--- | :--- | :--- |
| `sm` | 4px | Small elements, chips |
| `md` | 8px | **Default** (Cards, Inputs, Buttons) |
| `lg` | 12px | Large wrappers |
| `xl` | 16px | Feature cards |
| `full` | 9999px | Avatars, Rounded pills |

### Example
```tsx
import { borderRadius, borderRadiusTop } from 'theme/tokens';

<Box sx={{ borderRadius: borderRadius.md }}>Card</Box>
<Box sx={{ borderRadius: borderRadiusTop('md') }}>Tab Header</Box>
```

## 5. Shadows

Import `shadows` from `theme/tokens`.

| Token | Usage |
| :--- | :--- |
| `shadows.sm` | Small elements |
| `shadows.md` | **Default** (Cards, Popovers) |
| `shadows.cardHover` | Hover state for cards |
| `shadows.input` | Focus ring |

## 6. Z-Index

Import `zIndex` from `theme/tokens` to manage stacking contexts cleanly.

| Token | Usage |
| :--- | :--- |
| `hide` | -1 |
| `base` | 0 |
| `dropdown` | 1000 |
| `sticky` | 1100 |
| `drawer` | 1200 |
| `modal` | 1300 |

## Rules of Engagement

1.  **Check `tokens.ts` first**: If you need a value, check if it exists in tokens.
2.  **No Magic Numbers**: Avoid `px` values in code. Use `spacing.*` or `fontSize.*`.
3.  **Use Helpers**: Prefer `getResponsiveFontSize` over manually writing media queries for font sizes.
4.  **Dark Mode Compliance**: By using `theme.palette.*` and `shadows.*` (which map correctly in `tokens.ts`), you strictly support Dark Mode automatically.

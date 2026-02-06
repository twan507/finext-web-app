// finext-nextjs/theme/tokens.ts
import { PaletteMode, PaletteOptions } from '@mui/material';

// Extend MUI Typography to include custom variants
declare module '@mui/material/styles' {
  interface TypographyVariants {
    logo: React.CSSProperties;
  }

  // Allow configuration using 'logo' variant
  interface TypographyVariantsOptions {
    logo?: React.CSSProperties;
  }
}

// Update the Typography's variant prop options
declare module '@mui/material/Typography' {
  interface TypographyPropsVariantOverrides {
    logo: true;
  }
}

// Extend MUI Palette to include component colors
declare module '@mui/material/styles' {
  interface Palette {
    component: {
      appBar: {
        background: string;
        text: string;
      };
      drawer: {
        border: string;
      };
      tableHead: {
        background: string;
        sortIcon: string;
      };
      tableRow: {
        background: string;
        hover: string;
        selected: string;
      };
      chip: {
        successBackground: string;
        successColor: string;
        defaultBackground: string;
        defaultColor: string;
      };
      modal: {
        background: string;
        noteBackground: string;
        noteBorder: string;
        noteText: string;
      };
      chart: {
        line: string;
        areaTop: string;
        areaBottom: string;
        upColor: string;
        downColor: string;
        gridLine: string;
        crosshair: string;
        buttonBackground: string;
        buttonBackgroundHover: string;
        buttonBackgroundActive: string;
        buttonText: string;
        buttonTextActive: string;
      };
    };
    trend: {
      up: string;
      down: string;
      ref: string;
      ceil: string;
      floor: string;
    };
  }

  interface PaletteOptions {
    component?: {
      appBar?: {
        background?: string;
        text?: string;
      };
      drawer?: {
        border?: string;
      };
      tableHead?: {
        background?: string;
        sortIcon?: string;
      };
      tableRow?: {
        background?: string;
        hover?: string;
        selected?: string;
      };
      chip?: {
        successBackground?: string;
        successColor?: string;
        defaultBackground?: string;
        defaultColor?: string;
      };
      modal?: {
        background?: string;
        noteBackground?: string;
        noteBorder?: string;
        noteText?: string;
      };
      chart?: {
        line?: string;
        areaTop?: string;
        areaBottom?: string;
        upColor?: string;
        downColor?: string;
        gridLine?: string;
        crosshair?: string;
        buttonBackground?: string;
        buttonBackgroundHover?: string;
        buttonBackgroundActive?: string;
        buttonText?: string;
        buttonTextActive?: string;
      };
    };
    trend?: {
      up?: string;
      down?: string;
      ref?: string;
      ceil?: string;
      floor?: string;
    };
  }
}

// --------------------
// TREND COLOR TOKENS
// --------------------
export const trendColors = {
  up: {
    light: '#20b927', // Green-600
    dark: '#22c55e',  // Green-500
  },
  down: {
    light: '#e11d1d', // Rose-600
    dark: '#d45d5d',  // Rose-400
  },
  ref: {
    light: '#eadb08', // Yellow-600
    dark: '#c5c900',  // Yellow-400
  },
  ceil: {
    light: '#7e22ce', // Purple-700
    dark: '#a855f7',  // Purple-500
  },
  floor: {
    light: '#0593bb', // Cyan-700
    dark: '#38bdf8',  // Sky-400
  },
} as const;

// --------------------
// PALETTE TOKENS
// --------------------

// Light Theme Palette (Strictly PaletteOptions)
export const lightThemePalette: PaletteOptions = {
  mode: 'light',
  primary: {
    main: '#8b5cf6',
    light: '#a855f7',
    dark: '#7c3aed',
    contrastText: '#fafbfc',
  },
  secondary: {
    main: '#dc004e',
    light: '#ff5983',
    dark: '#a00026',
    contrastText: '#fafbfc',
  },
  error: {
    main: '#d32f2f',
    light: '#ef5350',
    dark: '#c62828',
    contrastText: '#fafbfc',
  },
  warning: {
    main: '#ed6c02',
    light: '#ff9800',
    dark: '#e65100',
    contrastText: '#fafbfc',
  },
  info: {
    main: '#0277bd',
    light: '#58a5f0',
    dark: '#004c8c',
    contrastText: '#fafbfc',
  },
  success: {
    main: '#2e7d32',
    light: '#4caf50',
    dark: '#1b5e20',
    contrastText: '#fafbfc',
  },
  background: {
    default: '#f8f9fa',
    paper: '#f5f5f5',
  },
  text: {
    primary: 'rgba(0, 0, 0, 0.95)',
    secondary: 'rgba(0, 0, 0, 0.67)',
    disabled: 'rgba(0, 0, 0, 0.38)',
  },
  divider: 'rgba(0, 0, 0, 0.12)',
  component: {
    appBar: {
      background: '#fafbfc',
      text: 'rgba(0, 0, 0, 0.95)',
    },
    drawer: {
      border: '#f0f0f0',
    },
    tableHead: {
      background: '#fafafa',
      sortIcon: 'rgba(0, 0, 0, 0.65)',
    },
    tableRow: {
      background: '#fafbfc',
      hover: '#f2f3f4',
      selected: '#f5f3ff',
    },
    chip: {
      successBackground: '#f3e8ff',
      successColor: '#8b5cf6',
      defaultBackground: '#f5f5f5',
      defaultColor: '#333333',
    },
    modal: {
      background: '#fafbfc',
      noteBackground: '#f8f9fa',
      noteBorder: '#e9ecef',
      noteText: '#495057',
    },
    chart: {
      line: '#8b5cf6',
      areaTop: 'rgba(139, 92, 246, 0.4)',
      areaBottom: 'rgba(139, 92, 246, 0.05)',
      upColor: trendColors.up.light,
      downColor: trendColors.down.light,
      gridLine: 'rgba(0, 0, 0, 0.06)',
      crosshair: 'rgba(0, 0, 0, 0.3)',
      buttonBackground: '#f0f0f0',
      buttonBackgroundHover: '#e5e5e5',
      buttonBackgroundActive: '#8b5cf6',
      buttonText: 'rgba(0, 0, 0, 0.6)',
      buttonTextActive: '#ffffff',
    },
  },
  trend: {
    up: trendColors.up.light,
    down: trendColors.down.light,
    ref: trendColors.ref.light,
    ceil: trendColors.ceil.light,
    floor: trendColors.floor.light,
  },
};

// Dark Theme Palette (Strictly PaletteOptions)
export const darkThemePalette: PaletteOptions = {
  mode: 'dark',
  primary: {
    main: '#b47eff',
    light: '#d4b5ff',
    dark: '#9d5cf6',
    contrastText: '#6b21a8',
  },
  secondary: {
    main: '#f48fb1',
    light: '#f8bbd0',
    dark: '#f06292',
    contrastText: 'rgba(0, 0, 0, 0.87)',
  },
  error: {
    main: '#d32f2f',
    light: '#ef5350',
    dark: '#c62828',
    contrastText: '#fafbfc',
  },
  warning: {
    main: '#ed6c02',
    light: '#ff9800',
    dark: '#e65100',
    contrastText: '#fafbfc',
  },
  info: {
    main: '#0277bd',
    light: '#58a5f0',
    dark: '#004c8c',
    contrastText: '#fafbfc',
  },
  success: {
    main: '#2e7d32',
    light: '#4caf50',
    dark: '#1b5e20',
    contrastText: '#fafbfc',
  },
  background: {
    default: '#050505',
    paper: '#1e1e1e',
  },
  text: {
    primary: '#f0f0f0',
    secondary: 'rgba(240, 240, 240, 0.7)',
    disabled: 'rgba(240, 240, 240, 0.5)',
  },
  divider: 'rgba(255, 255, 255, 0.12)',
  component: {
    appBar: {
      background: '#0a0a0a',
      text: '#f0f0f0',
    },
    drawer: {
      border: '#303030',
    },
    tableHead: {
      background: '#1e1e1e',
      sortIcon: 'rgba(255, 255, 255, 0.7)',
    },
    tableRow: {
      background: '#1e1e1e',
      hover: '#313131',
      selected: '#6b21a8',
    },
    chip: {
      successBackground: '#6b21a8',
      successColor: '#d4b5ff',
      defaultBackground: '#303030',
      defaultColor: '#bdbdbd',
    },
    modal: {
      background: '#1e1e1e',
      noteBackground: '#2d2d2d',
      noteBorder: '#404040',
      noteText: '#b0b0b0',
    },
    chart: {
      line: '#b47eff',
      areaTop: 'rgba(180, 126, 255, 0.5)',
      areaBottom: 'rgba(180, 126, 255, 0.05)',
      upColor: trendColors.up.dark,
      downColor: trendColors.down.dark,
      gridLine: 'rgba(255, 255, 255, 0.08)',
      crosshair: '#444444',
      buttonBackground: '#1e1e1e',
      buttonBackgroundHover: '#2a2a2a',
      buttonBackgroundActive: '#b47eff',
      buttonText: 'rgba(255, 255, 255, 0.7)',
      buttonTextActive: '#121212',
    },
  },
  trend: {
    up: trendColors.up.dark,
    down: trendColors.down.dark,
    ref: trendColors.ref.dark,
    ceil: trendColors.ceil.dark,
    floor: trendColors.floor.dark,
  },
};

// Helper function to get palette options based on mode
export const getMuiPaletteOptions = (mode: PaletteMode): PaletteOptions => {
  return mode === 'light' ? lightThemePalette : darkThemePalette;
};

// --------------------
// RESPONSIVE FONT SIZE TOKENS
// --------------------
// Breakpoints: Mobile (<768px) | Tablet (768-1199px) | Desktop (>=1200px)
// Matching layout.tsx: isMobile = down('md'), isTablet = between('md','lg'), isDesktop = up('lg')

// Single source of truth for all font sizes
const fontSize = {
  // === HEADINGS ===
  h1: { mobile: '2.1rem', tablet: '2.375rem', desktop: '2.5rem' },      // ~34-40px (Smaller than before)
  h2: { mobile: '1.9rem', tablet: '2.0rem', desktop: '2.25rem' },     // ~30-36px
  h3: { mobile: '1.7rem', tablet: '1.875rem', desktop: '2.0rem' },      // ~27-32px
  h4: { mobile: '1.5rem', tablet: '1.625rem', desktop: '1.75rem' },  // ~24-28px (Unchanged)

  // === BODY / TEXT ===
  xxl: { mobile: '1.25rem', tablet: '1.375rem', desktop: '1.5rem' }, // ~20-24px (Old h4/h5)
  xl: { mobile: '1.125rem', tablet: '1.25rem', desktop: '1.375rem' },// ~18-22px (Old h5/h6)
  lg: { mobile: '1rem', tablet: '1.125rem', desktop: '1.25rem' },    // ~16-20px (Old h6/lg)
  md: { mobile: '0.875rem', tablet: '1rem', desktop: '1rem' },       // ~14-16px (Old base/md) - STANDARD BODY
  sm: { mobile: '0.8125rem', tablet: '0.875rem', desktop: '0.875rem' }, // ~13-14px (Old sm)
  xs: { mobile: '0.75rem', tablet: '0.8125rem', desktop: '0.8125rem' }, // ~12-13px (Old xs)
  xxs: { mobile: '0.6875rem', tablet: '0.75rem', desktop: '0.75rem' },  // ~11-12px (Old xxs)
  badge: { mobile: '0.4rem', tablet: '0.45rem', desktop: '0.45rem' }, // Custom badge size
} as const;

// Helper to get responsive font size for sx prop
// Usage: sx={{ fontSize: getResponsiveFontSize('base') }}
// Output: { xs: '0.8125rem', md: '0.875rem', lg: '0.875rem' }
export const getResponsiveFontSize = (size: keyof typeof fontSize) => ({
  xs: fontSize[size].mobile,
  md: fontSize[size].tablet,
  lg: fontSize[size].desktop,
});

// --------------------
// FONT WEIGHT TOKENS
// --------------------
export const fontWeight = {
  medium: 500,
  semibold: 600,
  bold: 700,
  extrabold: 800,
} as const;

// --------------------
// ICON SIZE TOKENS
// --------------------
export const iconSize = {
  // Standard sizes (non-responsive)
  xs: 16,
  sm: 18,
  md: 20,
  lg: 24,
  xl: 32,
  xxl: 48,

  // Responsive icon sizes
  nav: { mobile: 18, tablet: 20, desktop: 24 },      // Navigation icons
  menu: { mobile: 18, tablet: 18, desktop: 20 },     // Menu/sidebar icons  
  breadcrumb: { mobile: 14, tablet: 16, desktop: 16 }, // Breadcrumb icons
  button: { mobile: 18, tablet: 20, desktop: 20 },   // Button icons
  empty: { mobile: 40, tablet: 48, desktop: 48 },    // Empty state icons

  // Special cases
  googleIcon: 18,
  progressSmall: 20,
  progressMedium: 22,
  brandImage: 26,
} as const;

// --------------------
// LAYOUT TOKENS
// --------------------
export const layoutTokens = {
  drawerWidth: 240, // Chiều rộng drawer mặc định (khi có text)
  compactDrawerWidth: 50, // Chiều rộng drawer mới (chỉ icon)
  appBarHeight: 50, // Chiều cao AppBar tiêu chuẩn
  toolbarMinHeight: 50, // Chiều cao tối thiểu của Toolbar
  // Form and auth layout
  authFormMaxWidth: 380, // Max width cho form đăng nhập/đăng ký
  authGalleryMaxWidth: 720, // Max width cho gallery section
  authGalleryHeight: 320, // Height cho gallery image
  buttonHeight: 44, // Standard button height
  // Indicator dots
  dotSize: {
    small: 8,
    large: 20,
  },
};

// --------------------
// SPACING TOKENS
// --------------------
// Based on 4px grid system (MUI default spacing unit = 8px, we use 4px for finer control)
// Usage: sx={{ p: spacing.md }} or sx={{ gap: spacing.sm }}
export const spacing = {
  none: 0,      // 0px
  xxs: 1,       // 2px - Minimal spacing (icons, tight elements)
  xs: 2,        // 4px - Extra small (chip padding, icon gaps)
  sm: 4,        // 8px - Small (button padding, list item gaps)
  md: 8,       // 16px - Medium (card padding, section gaps)
  lg: 12,       // 24px - Large (section padding, modal padding)
  xl: 24,       // 32px - Extra large (page margins, major sections)
  xxl: 32,      // 48px - Maximum (hero sections, major separations)
} as const;

// Responsive spacing helper
// Usage: sx={{ p: getResponsiveSpacing('md') }}
// Output: { xs: 8, md: 12, lg: 16 } (scaled down on mobile)
export const getResponsiveSpacing = (size: keyof typeof spacing) => {
  const baseValue = spacing[size];
  return {
    xs: Math.max(baseValue * 0.5, spacing.xxs),  // 50% on mobile, minimum 2px
    md: Math.max(baseValue * 0.75, spacing.xs),  // 75% on tablet
    lg: baseValue,                                // 100% on desktop
  };
};

// --------------------
// BORDER RADIUS TOKENS
// --------------------
// Consistent border radius across the app
// Usage: sx={{ borderRadius: borderRadius.md }} or borderRadius: `${borderRadius.md}px`
// Base border radius values (numeric for flexibility)
export const borderRadius = {
  none: 0,      // 0px - Sharp corners (dividers, full-width elements)
  xs: 2,        // 2px - Subtle rounding (tags, badges)
  sm: 4,        // 4px - Small rounding (chips, small buttons)
  md: 8,        // 8px - Medium rounding (cards, inputs, buttons) ⭐ Default
  lg: 12,       // 12px - Large rounding (modals, larger cards)
  xl: 16,       // 16px - Extra large (feature cards, hero elements)
  xxl: 24,      // 24px - Very large (special containers)
  pill: 50,     // 50px - Pill/capsule shape for search inputs, tags
  full: 9999,   // Full circle (avatar containers)
} as const;

// Type for base border radius keys (excluding compound patterns)
type BorderRadiusSize = keyof typeof borderRadius;

// Helper for consistent border radius in sx
export const getBorderRadius = (size: BorderRadiusSize) => `${borderRadius[size]}px`;

// --------------------
// COMPOUND BORDER RADIUS HELPERS
// --------------------
// Generate compound border radius from base tokens
// Usage: sx={{ borderRadius: borderRadiusTop('sm') }} => "4px 4px 0 0"

/** Top corners only - e.g., tabs, sheet headers */
export const borderRadiusTop = (size: BorderRadiusSize = 'sm') =>
  `${borderRadius[size]}px ${borderRadius[size]}px 0 0`;

/** Bottom corners only - e.g., bottom tabs, footers */
export const borderRadiusBottom = (size: BorderRadiusSize = 'sm') =>
  `0 0 ${borderRadius[size]}px ${borderRadius[size]}px`;

/** Left corners only - e.g., left-side panels */
export const borderRadiusLeft = (size: BorderRadiusSize = 'sm') =>
  `${borderRadius[size]}px 0 0 ${borderRadius[size]}px`;

/** Right corners only - e.g., right-side panels */
export const borderRadiusRight = (size: BorderRadiusSize = 'sm') =>
  `0 ${borderRadius[size]}px ${borderRadius[size]}px 0`;

/** Top-left corner only */
export const borderRadiusTopLeft = (size: BorderRadiusSize = 'sm') =>
  `${borderRadius[size]}px 0 0 0`;

/** Top-right corner only */
export const borderRadiusTopRight = (size: BorderRadiusSize = 'sm') =>
  `0 ${borderRadius[size]}px 0 0`;

/** Bottom-left corner only */
export const borderRadiusBottomLeft = (size: BorderRadiusSize = 'sm') =>
  `0 0 0 ${borderRadius[size]}px`;

/** Bottom-right corner only */
export const borderRadiusBottomRight = (size: BorderRadiusSize = 'sm') =>
  `0 0 ${borderRadius[size]}px 0`;

/** Custom corners - specify each corner individually */
export const borderRadiusCustom = (
  topLeft: BorderRadiusSize = 'none',
  topRight: BorderRadiusSize = 'none',
  bottomRight: BorderRadiusSize = 'none',
  bottomLeft: BorderRadiusSize = 'none'
) => `${borderRadius[topLeft]}px ${borderRadius[topRight]}px ${borderRadius[bottomRight]}px ${borderRadius[bottomLeft]}px`;

// --------------------
// SHADOW TOKENS
// --------------------
// Elevation system for depth and hierarchy
// Usage: sx={{ boxShadow: shadows.md }}
export const shadows = {
  none: 'none',

  // Subtle shadows (hover states, subtle elevation)
  xs: '0 1px 2px rgba(0, 0, 0, 0.05)',

  // Small shadows (cards, dropdowns)
  sm: '0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)',

  // Medium shadows (modals, popovers) ⭐ Default for floating elements
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',

  // Large shadows (dialogs, prominent floating elements)
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',

  // Extra large shadows (full-screen overlays)
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',

  // 2XL shadows (maximum elevation)
  xxl: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',

  // Special purpose shadows
  drawer: '4px 0 16px rgba(0, 0, 0, 0.15)',      // Side drawers
  drawerLeft: '-4px 0 16px rgba(0, 0, 0, 0.15)', // Left-side drawers
  appBar: '0 2px 8px rgba(0, 0, 0, 0.08)',       // App bar/header
  card: '0 2px 8px rgba(0, 0, 0, 0.08)',         // Cards
  cardHover: '0 8px 16px rgba(0, 0, 0, 0.12)',   // Card hover state
  button: '0 2px 4px rgba(0, 0, 0, 0.1)',        // Buttons
  buttonHover: '0 4px 8px rgba(0, 0, 0, 0.15)',  // Button hover
  input: '0 0 0 3px rgba(139, 92, 246, 0.1)',    // Input focus ring (primary color)

  // Inner shadows
  inner: 'inset 0 2px 4px rgba(0, 0, 0, 0.06)',
  innerLg: 'inset 0 4px 8px rgba(0, 0, 0, 0.1)',
} as const;

// Dark mode shadows (less visible, more subtle)
export const shadowsDark = {
  ...shadows,
  xs: '0 1px 2px rgba(0, 0, 0, 0.2)',
  sm: '0 1px 3px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(0, 0, 0, 0.2)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.2)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 10px 10px -5px rgba(0, 0, 0, 0.2)',
  xxl: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
  drawer: '4px 0 24px rgba(0, 0, 0, 0.4)',
  card: '0 2px 8px rgba(0, 0, 0, 0.3)',
  cardHover: '0 8px 24px rgba(0, 0, 0, 0.4)',
  input: '0 0 0 3px rgba(180, 126, 255, 0.2)', // Dark mode primary
} as const;

// --------------------
// TRANSITION TOKENS
// --------------------
// Consistent animation timing across the app
// Usage: sx={{ transition: transitions.fast }} or transition: `all ${durations.fast} ${easings.easeOut}`
export const durations = {
  instant: '0ms',       // No animation
  fastest: '100ms',     // Micro-interactions (hover states)
  fast: '150ms',        // Quick transitions (button press)
  normal: '250ms',      // Standard transitions ⭐ Default
  slow: '350ms',        // Deliberate animations (modal open)
  slower: '500ms',      // Complex animations (page transitions)
  slowest: '700ms',     // Long animations (loading sequences)
} as const;

export const easings = {
  // Standard easings
  linear: 'linear',
  ease: 'ease',
  easeIn: 'ease-in',
  easeOut: 'ease-out',
  easeInOut: 'ease-in-out',

  // Custom easings for specific use cases
  easeOutQuart: 'cubic-bezier(0.25, 1, 0.5, 1)',      // Smooth deceleration
  easeInQuart: 'cubic-bezier(0.5, 0, 0.75, 0)',      // Smooth acceleration
  easeInOutQuart: 'cubic-bezier(0.76, 0, 0.24, 1)',  // Smooth both ways

  // Spring-like easings
  spring: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)', // Bouncy entrance
  springOut: 'cubic-bezier(0.34, 1.56, 0.64, 1)',    // Overshoot then settle

  // Emphasis easings
  sharp: 'cubic-bezier(0.4, 0, 0.6, 1)',             // Quick and snappy
  smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',            // Material Design standard
} as const;

// Pre-composed transitions for common use cases
// Usage: sx={{ transition: transitions.colors }}
export const transitions = {
  // Property-specific transitions
  all: `all ${durations.normal} ${easings.smooth}`,
  colors: `background-color ${durations.fast} ${easings.easeOut}, color ${durations.fast} ${easings.easeOut}, border-color ${durations.fast} ${easings.easeOut}`,
  opacity: `opacity ${durations.fast} ${easings.easeOut}`,
  shadow: `box-shadow ${durations.fast} ${easings.easeOut}`,
  transform: `transform ${durations.normal} ${easings.easeOut}`,

  // Component-specific transitions
  button: `all ${durations.fast} ${easings.smooth}`,
  card: `box-shadow ${durations.normal} ${easings.easeOut}, transform ${durations.normal} ${easings.easeOut}`,
  modal: `opacity ${durations.slow} ${easings.easeOut}, transform ${durations.slow} ${easings.spring}`,
  drawer: `transform ${durations.slow} ${easings.easeOutQuart}`,
  tooltip: `opacity ${durations.fast} ${easings.easeOut}`,
  menu: `opacity ${durations.fast} ${easings.easeOut}, transform ${durations.fast} ${easings.easeOut}`,

  // Micro-interactions
  hover: `all ${durations.fastest} ${easings.easeOut}`,
  focus: `box-shadow ${durations.fast} ${easings.easeOut}, border-color ${durations.fast} ${easings.easeOut}`,
  active: `transform ${durations.instant} ${easings.linear}`,
} as const;

// --------------------
// BUTTON SIZE TOKENS
// --------------------
// Consistent button sizing
export const buttonSize = {
  xs: {
    height: 24,
    paddingX: spacing.sm,
    fontSize: fontSize.xs,
  },
  sm: {
    height: 30,
    paddingX: spacing.md,
    fontSize: fontSize.sm,
  },
  md: {
    height: 36,
    paddingX: spacing.lg,
    fontSize: fontSize.md,
  },
  lg: {
    height: 44,
    paddingX: spacing.xl,
    fontSize: fontSize.lg,
  },
  xl: {
    height: 52,
    paddingX: spacing.xxl,
    fontSize: fontSize.xl,
  },
} as const;

// --------------------
// Z-INDEX TOKENS
// --------------------
// Layering system for proper stacking
export const zIndex = {
  hide: -1,
  base: 0,
  dropdown: 1000,
  sticky: 1100,
  drawer: 1200,
  modal: 1300,
  popover: 1400,
  tooltip: 1500,
  toast: 1600,
  overlay: 1700,
  max: 9999,
} as const;
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
  }
}

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
    default: '#fafbfc',
    paper: '#f5f5f5',
  },
  text: {
    primary: 'rgba(0, 0, 0, 0.95)',
    secondary: 'rgba(0, 0, 0, 0.75)',
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
      upColor: '#22c55e',
      downColor: '#ef4444',
      gridLine: 'rgba(0, 0, 0, 0.06)',
      crosshair: 'rgba(0, 0, 0, 0.3)',
      buttonBackground: '#f0f0f0',
      buttonBackgroundHover: '#e5e5e5',
      buttonBackgroundActive: '#8b5cf6',
      buttonText: 'rgba(0, 0, 0, 0.6)',
      buttonTextActive: '#ffffff',
    },
  },
};

// Dark Theme Palette (Strictly PaletteOptions)
export const darkThemePalette: PaletteOptions = {
  mode: 'dark',
  primary: {
    main: '#b47eff',
    light: '#d4b5ff',
    dark: '#9d5cf6',
    contrastText: '#121212',
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
    default: '#121212',
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
      background: '#121212',
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
      upColor: '#22c55e',
      downColor: '#ef4444',
      gridLine: 'rgba(255, 255, 255, 0.08)',
      crosshair: 'rgba(255, 255, 255, 0.4)',
      buttonBackground: '#1e1e1e',
      buttonBackgroundHover: '#2a2a2a',
      buttonBackgroundActive: '#b47eff',
      buttonText: 'rgba(255, 255, 255, 0.7)',
      buttonTextActive: '#121212',
    },
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
export const fontSize = {
  // === DISPLAY / HEADLINES ===
  display: { mobile: '2.25rem', tablet: '2.75rem', desktop: '3rem' },      // 36/44/48px - Hero sections
  h1: { mobile: '2rem', tablet: '2.25rem', desktop: '2.5rem' },            // 32/36/40px
  h2: { mobile: '1.75rem', tablet: '1.875rem', desktop: '2rem' },          // 28/30/32px
  h3: { mobile: '1.5rem', tablet: '1.625rem', desktop: '1.75rem' },        // 24/26/28px
  h4: { mobile: '1.25rem', tablet: '1.375rem', desktop: '1.5rem' },        // 20/22/24px
  h5: { mobile: '1.125rem', tablet: '1.25rem', desktop: '1.375rem' },      // 18/20/22px
  h6: { mobile: '1rem', tablet: '1.125rem', desktop: '1.25rem' },          // 16/18/20px

  // === BODY TEXT ===
  lg: { mobile: '0.9375rem', tablet: '1rem', desktop: '1rem' },            // 15/16/16px - Large body
  md: { mobile: '0.875rem', tablet: '0.9375rem', desktop: '0.9375rem' },   // 14/15/15px - Medium body
  base: { mobile: '0.8125rem', tablet: '0.875rem', desktop: '0.875rem' },  // 13/14/14px - Default body ⭐
  sm: { mobile: '0.75rem', tablet: '0.8125rem', desktop: '0.8125rem' },    // 12/13/13px - Small body
  xs: { mobile: '0.6875rem', tablet: '0.75rem', desktop: '0.75rem' },      // 11/12/12px - Caption
  xxs: { mobile: '0.625rem', tablet: '0.6875rem', desktop: '0.6875rem' },  // 10/11/11px - Tiny caption

  // === SPECIAL USE CASES ===
  badge: { mobile: '0.4rem', tablet: '0.45rem', desktop: '0.45rem' },       // ~6.4/7.2/7.2px - Tiny badges
  sectionLabel: { mobile: '0.6rem', tablet: '0.65rem', desktop: '0.65rem' },// ~9.6/10.4/10.4px - Section labels
  menuItem: { mobile: '0.85rem', tablet: '0.9rem', desktop: '0.9rem' },     // ~13.6/14.4/14.4px - Menu items
  tableCell: { mobile: '0.8rem', tablet: '0.85rem', desktop: '0.875rem' },  // ~12.8/13.6/14px - Table cells
  iconText: { mobile: '0.9375rem', tablet: '1rem', desktop: '1rem' },       // 15/16/16px - Text next to icons

  // === ENHANCED HEADERS (for page titles) ===
  h4Enhanced: { mobile: '1.5rem', tablet: '2rem', desktop: '2.125rem' },    // 24/32/34px
  h5Enhanced: { mobile: '1.125rem', tablet: '1.375rem', desktop: '1.5rem' },// 18/22/24px
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
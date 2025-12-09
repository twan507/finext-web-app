// finext-nextjs/theme/tokens.ts
import { PaletteMode, PaletteOptions, ThemeOptions } from '@mui/material';

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

// --------------------
// COLOR TOKENS
// --------------------

export const colorTokens = {
  common: {
    black: '#000000',
    white: '#fafbfc', // Xám rất nhẹ thay vì trắng tinh
  },
  primary: {
    main: '#7c3aed',
    light: '#a78bfa',
    dark: '#5b21b6',
    contrastText: '#fafbfc', // Xám rất nhẹ
  },
  secondary: {
    main: '#dc004e',
    light: '#ff5983',
    dark: '#a00026',
    contrastText: '#fafbfc', // Xám rất nhẹ
  },
  error: {
    main: '#d32f2f',
    light: '#ef5350',
    dark: '#c62828',
    contrastText: '#fafbfc', // Xám rất nhẹ
  },
  warning: {
    main: '#ed6c02',
    light: '#ff9800',
    dark: '#e65100',
    contrastText: '#fafbfc', // Xám rất nhẹ
  },
  info: {
    main: '#0277bd',
    light: '#58a5f0',
    dark: '#004c8c',
    contrastText: '#fafbfc', // Xám rất nhẹ
  },
  success: {
    main: '#2e7d32',
    light: '#4caf50',
    dark: '#1b5e20',
    contrastText: '#fafbfc', // Xám rất nhẹ
  },

  // Specific App Colors (examples)
  finext: {
    deepPurple: {
      50: '#f5f3ff',
      100: '#ede9fe',
      200: '#ddd6fe',
      300: '#c4b5fd',
      400: '#a78bfa',
      500: '#8b5cf6',
      600: '#7c3aed',
      700: '#6d28d9',
      800: '#5b21b6',
      900: '#4c1d95',
    },
    royalPurple: {
      50: '#f6f0ff',
      100: '#eddbfe',
      200: '#d6bef9',
      300: '#bd93f5',
      400: '#a368f1',
      500: '#8a3ee8',
      600: '#7928d4',
      700: '#6721b7',
      800: '#551c96',
      900: '#46157a',
    },
    violetBerry: '#7E22CE',
  },
  
  // Component colors will be assigned after palette definitions
  lightComponentColors: {} as any,
  darkComponentColors: {} as any,
};

// Light Theme Palette (Strictly PaletteOptions)
export const lightThemePalette: PaletteOptions = {
  mode: 'light',
  primary: {
    main: '#7c3aed',
    light: '#a78bfa',
    dark: '#5b21b6',
    contrastText: '#fafbfc',
  },
  secondary: colorTokens.secondary,
  error: colorTokens.error,
  warning: colorTokens.warning,
  info: colorTokens.info,
  success: colorTokens.success,
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
};

// Dark Theme Palette (Strictly PaletteOptions)
export const darkThemePalette: PaletteOptions = {
  mode: 'dark',
  primary: {
    main: '#c4b5fd',
    light: '#ddd6fe',
    dark: '#a78bfa',
    contrastText: 'rgba(0, 0, 0, 0.87)',
  },
  secondary: {
    main: '#f48fb1',
    light: '#f8bbd0',
    dark: '#f06292',
    contrastText: 'rgba(0, 0, 0, 0.87)',
  },
  error: colorTokens.error,
  warning: colorTokens.warning,
  info: colorTokens.info,
  success: colorTokens.success,
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
};

// Component-specific colors - Tham chiếu từ palette
colorTokens.lightComponentColors = {
  appBar: {
    background: lightThemePalette.background!.default as string,
    text: lightThemePalette.text!.primary as string,
  },
  drawer: {
    background: lightThemePalette.background!.default as string,
    border: '#f0f0f0',
  },
  tableHead: {
    background: '#fafafa',
    text: lightThemePalette.text!.primary as string,
    sortActive: (lightThemePalette.primary as any).main,
    sortHover: (lightThemePalette.primary as any).main,
    sortIcon: 'rgba(0, 0, 0, 0.65)',
  },
  tableRow: {
    background: lightThemePalette.background!.default as string,
    hover: '#f2f3f4',
    selected: '#f3e8ff',
  },
  chip: {
    successBackground: '#f3e8ff',
    successColor: (lightThemePalette.primary as any).main,
    defaultBackground: lightThemePalette.background!.paper as string,
    defaultColor: '#333333',
  },
  modal: {
    background: lightThemePalette.background!.default as string,
    noteBackground: '#f8f9fa',
    noteBorder: '#e9ecef',
    noteText: '#495057',
  }
};

colorTokens.darkComponentColors = {
  appBar: {
    background: darkThemePalette.background!.default as string,
    text: darkThemePalette.text!.primary as string,
  },
  drawer: {
    background: darkThemePalette.background!.default as string,
    border: '#303030',
  },
  tableHead: {
    background: darkThemePalette.background!.paper as string,
    text: darkThemePalette.text!.primary as string,
    sortActive: (darkThemePalette.primary as any).main,
    sortHover: (darkThemePalette.primary as any).main,
    sortIcon: 'rgba(255, 255, 255, 0.7)',
  },
  tableRow: {
    background: darkThemePalette.background!.paper as string,
    hover: '#313131',
    selected: '#4c1d95',
  },
  chip: {
    successBackground: '#4c1d95',
    successColor: (darkThemePalette.primary as any).main,
    defaultBackground: '#303030',
    defaultColor: '#bdbdbd',
  },
  modal: {
    background: darkThemePalette.background!.paper as string,
    noteBackground: '#2d2d2d',
    noteBorder: '#404040',
    noteText: '#b0b0b0',
  }
};

// Helper function to get palette options based on mode
export const getMuiPaletteOptions = (mode: PaletteMode): PaletteOptions => {
  return mode === 'light' ? lightThemePalette : darkThemePalette;
};

// --------------------
// BASE TYPOGRAPHY SIZES
// --------------------
const baseFontSizes = {
  // Headers
  logo: { xs: '1.25rem', sm: '1.375rem', md: '1.5rem' },
  h1: { xs: '2rem', sm: '2.25rem', md: '2.5rem' },
  h2: { xs: '1.75rem', sm: '1.875rem', md: '2rem' },
  h3: { xs: '1.5rem', sm: '1.625rem', md: '1.75rem' },
  h4: { xs: '1.25rem', sm: '1.375rem', md: '1.5rem' },
  h5: { xs: '1.125rem', sm: '1.25rem', md: '1.375rem' },
  h6: { xs: '1rem', sm: '1.1rem', md: '1.25rem' },

  // Content text
  subtitle1: { xs: '0.8125rem', sm: '0.875rem', md: '0.9375rem' },
  subtitle2: { xs: '0.75rem', sm: '0.8125rem', md: '0.875rem' },
  body1: { xs: '0.75rem', sm: '0.8125rem', md: '0.875rem' }, // Cỡ chữ chính
  body2: { xs: '0.6875rem', sm: '0.75rem', md: '0.8125rem' }, // Cỡ chữ phụ
  button: { xs: '0.6875rem', sm: '0.8125rem', md: '0.875rem' },
  caption: { xs: '0.625rem', sm: '0.6875rem', md: '0.75rem' }, // Cỡ chữ nhỏ nhất
  overline: { xs: '0.625rem', sm: '0.6875rem', md: '0.75rem' },

  // Custom variants
  tableCell: { xs: '0.6875rem', sm: '0.8125rem', md: '0.875rem' },
  tableCellSmall: { xs: '0.625rem', sm: '0.6875rem', md: '0.75rem' },

  // Enhanced responsive variants
  h4Enhanced: { xs: '1.5rem', sm: '2rem', md: '2.125rem' }, // Cho page headers
  h5Enhanced: { xs: '1.125rem', sm: '1.25rem', md: '1.5rem' },
};

// --------------------
// TYPOGRAPHY TOKENS (MUI Theme)
// --------------------
export const typographyTokens: ThemeOptions['typography'] = {
  fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  logo: {
    fontSize: baseFontSizes.logo.md,
    fontWeight: 550,
    fontFamily: '"Poppins", "Roboto", "Helvetica", "Arial", sans-serif'
  },
  h1: { fontSize: baseFontSizes.h1.md, fontWeight: 700 },
  h2: { fontSize: baseFontSizes.h2.md, fontWeight: 700 },
  h3: { fontSize: baseFontSizes.h3.md, fontWeight: 700 },
  h4: { fontSize: baseFontSizes.h4.md, fontWeight: 600 },
  h5: { fontSize: baseFontSizes.h5.md, fontWeight: 600 },
  h6: { fontSize: baseFontSizes.h6.md, fontWeight: 600 },
  subtitle1: { fontSize: baseFontSizes.subtitle1.sm, fontWeight: 500 },
  subtitle2: { fontSize: baseFontSizes.subtitle2.sm, fontWeight: 500 },
  body1: { fontSize: baseFontSizes.body1.sm, fontWeight: 400 },
  body2: { fontSize: baseFontSizes.body2.sm, fontWeight: 400 },
  button: { fontSize: baseFontSizes.button.sm, textTransform: 'none', fontWeight: 500 },
  caption: { fontSize: baseFontSizes.caption.sm, fontWeight: 400 },
  overline: { fontSize: baseFontSizes.overline.sm, fontWeight: 400, textTransform: 'uppercase' },
};

// --------------------
// RESPONSIVE TYPOGRAPHY TOKENS
// --------------------
export const responsiveTypographyTokens = {
  // Logo variant with Poppins - larger than H1
  logo: { fontSize: baseFontSizes.logo },

  // Headers - using base sizes
  h1: { fontSize: baseFontSizes.h1 },
  h2: { fontSize: baseFontSizes.h2 },
  h3: { fontSize: baseFontSizes.h3 },
  h4: { fontSize: baseFontSizes.h4 },
  h5: { fontSize: baseFontSizes.h5 },
  h6: { fontSize: baseFontSizes.h6 },

  // Enhanced headers for special use cases
  h4Enhanced: { fontSize: baseFontSizes.h4Enhanced },
  h5Enhanced: { fontSize: baseFontSizes.h5Enhanced },

  // Content text
  subtitle1: { fontSize: baseFontSizes.subtitle1 },
  subtitle2: { fontSize: baseFontSizes.subtitle2 },
  body1: { fontSize: baseFontSizes.body1 },
  body2: { fontSize: baseFontSizes.body2 },
  button: { fontSize: baseFontSizes.button },
  caption: { fontSize: baseFontSizes.caption },
  overline: { fontSize: baseFontSizes.overline },

  // Table specific
  tableCell: { fontSize: baseFontSizes.tableCell },
  tableCellSmall: { fontSize: baseFontSizes.tableCellSmall },
};

// --------------------
// ICON SIZE TOKENS
// --------------------
export const iconSizeTokens = {
  small: 16,
  medium: 20,
  large: 24,
  // Special cases
  googleIcon: 18,
  progressSmall: 20,
  progressMedium: 22,
  brandImage: 26,
};

// --------------------
// SPACING TOKEN
// --------------------
export const spacingTokens = {
  unit: 8,
};

// --------------------
// BORDER RADIUS (SHAPE) TOKENS
// --------------------
export const shapeTokens: ThemeOptions['shape'] = {
  borderRadius: 4,
};

// --------------------
// BREAKPOINT TOKENS
// --------------------
export const breakpointTokens: ThemeOptions['breakpoints'] = {
  values: {
    xs: 0,
    sm: 600,
    md: 900,
    lg: 1200,
    xl: 1536,
  },
};

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
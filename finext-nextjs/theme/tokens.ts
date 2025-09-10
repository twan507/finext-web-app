// finext-nextjs/theme/tokens.ts
import { PaletteMode, PaletteOptions, ThemeOptions } from '@mui/material';

// --------------------
// COLOR TOKENS
// --------------------

export const colorTokens = {
  common: {
    black: '#000000',
    white: '#ffffff',
  },
  primary: {
    main: '#1976d2',
    light: '#63a4ff',
    dark: '#004ba0',
    contrastText: '#ffffff',
  },
  secondary: {
    main: '#dc004e',
    light: '#ff5983',
    dark: '#a00026',
    contrastText: '#ffffff',
  },
  error: {
    main: '#d32f2f',
    light: '#ef5350',
    dark: '#c62828',
    contrastText: '#ffffff',
  },
  warning: {
    main: '#ed6c02',
    light: '#ff9800',
    dark: '#e65100',
    contrastText: '#ffffff',
  },
  info: {
    main: '#0288d1',
    light: '#03a9f4',
    dark: '#01579b',
    contrastText: '#ffffff',
  },
  success: {
    main: '#2e7d32',
    light: '#4caf50',
    dark: '#1b5e20',
    contrastText: '#ffffff',
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
  },  // Component-specific color definitions
  lightComponentColors: {
    appBar: {
      background: '#ffffff',
      text: 'rgba(0, 0, 0, 0.87)',
    },
    drawer: {
      background: '#ffffff',
      border: '#f0f0f0',
    }, tableHead: {
      background: '#fafafa',
      text: 'rgba(0, 0, 0, 0.87)',
      sortActive: '#1976d2', // Primary color for active sort
      sortHover: '#1976d2',  // Primary color for hover
      sortIcon: 'rgba(0, 0, 0, 0.54)',
    },
    tableRow: {
      background: '#ffffff',
      hover: '#f5f5f5',
      selected: '#e3f2fd',
    },
    chip: {
      successBackground: '#e6f7ff', // Example for light mode success chip
      successColor: '#1890ff',      // Example for light mode success chip text
      defaultBackground: '#f5f5f5',
      defaultColor: '#595959',
    },
    modal: {
      background: '#ffffff',
      noteBackground: '#f8f9fa', // Nền xám nhạt cho phần lưu ý
      noteBorder: '#e9ecef',
      noteText: '#6c757d',
    }
  }, darkComponentColors: {
    appBar: {
      background: '#1a1a1a',
      text: '#ffffff',
    },
    drawer: {
      background: '#1a1a1a',
      border: '#303030',
    }, tableHead: {
      background: '#1a1a1a',
      text: '#ffffff',
      sortActive: '#90caf9', // Light blue for active sort in dark mode
      sortHover: '#90caf9',  // Light blue for hover in dark mode
      sortIcon: 'rgba(255, 255, 255, 0.7)',
    },
    tableRow: {
      background: '#1e1e1e',
      hover: '#2a2a2a',
      selected: '#1976d2',
    },
    chip: {
      successBackground: '#003768', // Example for dark mode success chip
      successColor: '#90caf9',      // Example for dark mode success chip text
      defaultBackground: '#303030',
      defaultColor: '#bdbdbd',
    },
    modal: {
      background: '#1a1a1a', // Nền modal tối hơn
      noteBackground: '#2d2d2d', // Nền xám nhạt hơn modal cho phần lưu ý
      noteBorder: '#404040',
      noteText: '#b0b0b0',
    }
  },
};

// Light Theme Palette (Strictly PaletteOptions)
export const lightThemePalette: PaletteOptions = {
  mode: 'light',
  primary: colorTokens.primary,
  secondary: colorTokens.secondary,
  error: colorTokens.error,
  warning: colorTokens.warning,
  info: colorTokens.info,
  success: colorTokens.success,
  background: {
    default: '#f5f5f5',
    paper: '#ffffff',
  },
  text: {
    primary: 'rgba(0, 0, 0, 0.87)',
    secondary: 'rgba(0, 0, 0, 0.6)',
    disabled: 'rgba(0, 0, 0, 0.38)',
  },
  divider: 'rgba(0, 0, 0, 0.12)',
};

// Dark Theme Palette (Strictly PaletteOptions)
export const darkThemePalette: PaletteOptions = {
  mode: 'dark',
  primary: {
    main: '#90caf9',
    light: '#e3f2fd',
    dark: '#42a5f5',
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
  success: colorTokens.success, background: {
    default: '#121212',
    paper: '#1a1a1a', // Sử dụng màu tối hơn cho modal
  },
  text: {
    primary: '#ffffff',
    secondary: 'rgba(255, 255, 255, 0.7)',
    disabled: 'rgba(255, 255, 255, 0.5)',
  },
  divider: 'rgba(255, 255, 255, 0.12)',
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
  h1: { xs: '2rem', sm: '2.25rem', md: '2.5rem' },
  h2: { xs: '1.75rem', sm: '1.875rem', md: '2rem' },
  h3: { xs: '1.5rem', sm: '1.625rem', md: '1.75rem' },
  h4: { xs: '1.25rem', sm: '1.375rem', md: '1.5rem' },
  h5: { xs: '1.125rem', sm: '1.25rem', md: '1.375rem' },
  h6: { xs: '1rem', sm: '1.1rem', md: '1.25rem' },

  // Content text
  subtitle1: { xs: '0.875rem', sm: '0.9375rem' },
  subtitle2: { xs: '0.8125rem', sm: '0.875rem' },
  body1: { xs: '0.8125rem', sm: '0.875rem' }, // Cỡ chữ chính
  body2: { xs: '0.75rem', sm: '0.8125rem' }, // Cỡ chữ phụ
  button: { xs: '0.75rem', sm: '0.875rem' },
  caption: { xs: '0.6875rem', sm: '0.75rem' }, // Cỡ chữ nhỏ nhất
  overline: { xs: '0.6875rem', sm: '0.75rem' },

  // Custom variants
  tableCell: { xs: '0.75rem', sm: '0.875rem' },
  tableCellSmall: { xs: '0.6875rem', sm: '0.75rem' },

  // Enhanced responsive variants
  h4Enhanced: { xs: '1.5rem', sm: '2rem', md: '2.125rem' }, // Cho page headers
  h5Enhanced: { xs: '1.125rem', sm: '1.25rem', md: '1.5rem' },
};

// --------------------
// TYPOGRAPHY TOKENS (MUI Theme)
// --------------------
export const typographyTokens: ThemeOptions['typography'] = {
  fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
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
  compactDrawerWidth: 64, // Chiều rộng drawer mới (chỉ icon, tương đương w-16)
  appBarHeight: 64, // Chiều cao AppBar tiêu chuẩn
  toolbarMinHeight: 56, // Chiều cao tối thiểu của Toolbar
};
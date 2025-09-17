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
    main: '#1565c0',
    light: '#5e92f3',
    dark: '#003c8f',
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
  },  // Component-specific color definitions
  lightComponentColors: {
    appBar: {
      background: '#fafbfc', // Xám rất nhẹ thay vì trắng
      text: 'rgba(0, 0, 0, 0.95)',
    },
    drawer: {
      background: '#fafbfc', // Xám rất nhẹ thay vì trắng
      border: '#f0f0f0',
    }, tableHead: {
      background: '#fafafa',
      text: 'rgba(0, 0, 0, 0.95)',
      sortActive: '#1565c0', // Primary color for active sort
      sortHover: '#1565c0',  // Primary color for hover
      sortIcon: 'rgba(0, 0, 0, 0.65)',
    },
    tableRow: {
      background: '#fafbfc', // Xám rất nhẹ thay vì trắng
      hover: '#f5f5f5',
      selected: '#e3f2fd',
    },
    chip: {
      successBackground: '#e3f2fd', // Light blue background for success chip
      successColor: '#1565c0',      // Darker blue for success chip text
      defaultBackground: '#f5f5f5',
      defaultColor: '#333333',
    },
    modal: {
      background: '#fafbfc', // Xám rất nhẹ thay vì trắng
      noteBackground: '#f8f9fa', // Nền xám nhạt cho phần lưu ý
      noteBorder: '#e9ecef',
      noteText: '#495057',
    }
  }, darkComponentColors: {
    appBar: {
      background: '#1a1a1a',
      text: '#f0f0f0', // Xám nhẹ thay vì trắng tinh
    },
    drawer: {
      background: '#1a1a1a',
      border: '#303030',
    }, tableHead: {
      background: '#1a1a1a',
      text: '#f0f0f0', // Xám nhẹ thay vì trắng tinh
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
  primary: {
    main: '#1565c0',
    light: '#5e92f3',
    dark: '#003c8f',
    contrastText: '#fafbfc', // Xám rất nhẹ thay vì trắng
  },
  secondary: colorTokens.secondary,
  error: colorTokens.error,
  warning: colorTokens.warning,
  info: colorTokens.info,
  success: colorTokens.success,
  background: {
    default: '#f5f5f5',
    paper: '#fafbfc', // Xám rất nhẹ thay vì trắng
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
    primary: '#f0f0f0', // Xám nhẹ thay vì trắng tinh
    secondary: 'rgba(240, 240, 240, 0.7)', // Xám nhẹ với opacity
    disabled: 'rgba(240, 240, 240, 0.5)', // Xám nhẹ với opacity
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
  logo: { xs: '1.5rem', sm: '1.625rem', md: '1.75rem' },
  h1: { xs: '2rem', sm: '2.25rem', md: '2.5rem' },
  h2: { xs: '1.75rem', sm: '1.875rem', md: '2rem' },
  h3: { xs: '1.5rem', sm: '1.625rem', md: '1.75rem' },
  h4: { xs: '1.25rem', sm: '1.375rem', md: '1.5rem' },
  h5: { xs: '1.125rem', sm: '1.25rem', md: '1.375rem' },
  h6: { xs: '1rem', sm: '1.1rem', md: '1.25rem' },

  // Content text
  subtitle1: { xs: '0.75rem', sm: '0.8125rem' },
  subtitle2: { xs: '0.6875rem', sm: '0.75rem' },
  body1: { xs: '0.6875rem', sm: '0.75rem' }, // Cỡ chữ chính
  body2: { xs: '0.625rem', sm: '0.6875rem' }, // Cỡ chữ phụ
  button: { xs: '0.625rem', sm: '0.75rem' },
  caption: { xs: '0.5625rem', sm: '0.625rem' }, // Cỡ chữ nhỏ nhất
  overline: { xs: '0.5625rem', sm: '0.625rem' },

  // Custom variants
  tableCell: { xs: '0.625rem', sm: '0.75rem' },
  tableCellSmall: { xs: '0.5625rem', sm: '0.625rem' },

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
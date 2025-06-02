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
    violetBerry: '#7E22CE',
  },
  // Component-specific color definitions
  lightComponentColors: {
    appBar: {
      background: '#ffffff',
      text: 'rgba(0, 0, 0, 0.87)',
    },
    drawer: {
      background: '#ffffff',
      border: '#f0f0f0',
    },
    tableHead: {
      background: '#fafafa',
    },
    chip: {
        successBackground: '#e6f7ff', // Example for light mode success chip
        successColor: '#1890ff',      // Example for light mode success chip text
        defaultBackground: '#f5f5f5',
        defaultColor: '#595959',
    }
  },
  darkComponentColors: {
    appBar: {
      background: '#1a1a1a',
      text: '#ffffff',
    },
    drawer: {
      background: '#1a1a1a',
      border: '#303030',
    },
    tableHead: {
      background: '#2a2a2a',
    },
    chip: {
        successBackground: '#003768', // Example for dark mode success chip
        successColor: '#90caf9',      // Example for dark mode success chip text
        defaultBackground: '#303030',
        defaultColor: '#bdbdbd',
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
  success: colorTokens.success,
  background: {
    default: '#121212',
    paper: '#1e1e1e',
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
// TYPOGRAPHY TOKENS
// --------------------
export const typographyTokens: ThemeOptions['typography'] = {
  fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  h1: { fontSize: '2.5rem', fontWeight: 700 },
  h2: { fontSize: '2rem', fontWeight: 700 },
  h3: { fontSize: '1.75rem', fontWeight: 700 },
  h4: { fontSize: '1.5rem', fontWeight: 600 },
  h5: { fontSize: '1.25rem', fontWeight: 600 },
  h6: { fontSize: '1.1rem', fontWeight: 600 },
  subtitle1: { fontSize: '1rem', fontWeight: 500 },
  subtitle2: { fontSize: '0.875rem', fontWeight: 500 },
  body1: { fontSize: '1rem', fontWeight: 400 },
  body2: { fontSize: '0.875rem', fontWeight: 400 },
  button: { textTransform: 'none', fontWeight: 500 },
  caption: { fontSize: '0.75rem', fontWeight: 400 },
  overline: { fontSize: '0.75rem', fontWeight: 400, textTransform: 'uppercase' },
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
};
// finext-nextjs/components/MuiProvider.tsx
'use client';

import * as React from 'react';
import { useTheme as useNextTheme } from 'next-themes';
import { ThemeProvider as MuiThemeProvider, createTheme, PaletteMode, ThemeOptions } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

import {
  colorTokens, // For component specific colors if needed directly
  getMuiPaletteOptions,
  typographyTokens,
  shapeTokens,
  spacingTokens,
  breakpointTokens,
} from 'theme/tokens'; // Adjust path if necessary

export function MuiProvider({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useNextTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const muiTheme = React.useMemo(() => {
    const mode = (mounted && resolvedTheme ? resolvedTheme : 'light') as PaletteMode;
    const currentPalette = getMuiPaletteOptions(mode);
    const currentComponentColors = mode === 'light' ? colorTokens.lightComponentColors : colorTokens.darkComponentColors;

    const themeOptions: ThemeOptions = {
      palette: currentPalette,
      typography: typographyTokens,
      shape: shapeTokens,
      spacing: spacingTokens.unit,
      breakpoints: breakpointTokens,
      components: {
        MuiAppBar: {
          styleOverrides: {
            root: ({ theme }) => ({ // theme here is the partially built theme
              backgroundColor: currentComponentColors.appBar.background,
              color: currentComponentColors.appBar.text,
              borderBottom: `1px solid ${theme.palette.divider}`,
            }),
          },
        },
        MuiDrawer: {
          styleOverrides: {
            paper: ({ theme }) => ({
              backgroundColor: currentComponentColors.drawer.background,
              borderRight: `1px solid ${theme.palette.divider}`, // Use theme.palette.divider for consistency
            }),
          },
        },
        MuiTableHead: {
          styleOverrides: {
            root: { // No need for ({ theme }) if directly using imported tokens
              backgroundColor: currentComponentColors.tableHead.background,
            },
          },
        },
        MuiChip: {
          styleOverrides: {
            root: ({ theme, ownerState }) => ({
              ...(ownerState.color === 'success' && {
                backgroundColor: currentComponentColors.chip.successBackground,
                color: currentComponentColors.chip.successColor,
              }),
              ...(ownerState.color === 'default' && {
                backgroundColor: currentComponentColors.chip.defaultBackground,
                color: currentComponentColors.chip.defaultColor,
              })
            })
          }
        },
        MuiPaper: {
          styleOverrides: {
            root: {
              // boxShadow: 'none',
            }
          }
        }
      },
    };
    return createTheme(themeOptions);
  }, [resolvedTheme, mounted]);

  if (!mounted || !resolvedTheme) {
    return null;
  }

  return (
    <MuiThemeProvider theme={muiTheme}>
      <CssBaseline />
      {children}
    </MuiThemeProvider>
  );
}
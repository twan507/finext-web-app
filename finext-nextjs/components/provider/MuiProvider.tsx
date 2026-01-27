// finext-nextjs/components/MuiProvider.tsx
'use client';

import * as React from 'react';
import { useTheme as useNextTheme } from 'next-themes';
import { ThemeProvider as MuiThemeProvider, createTheme, PaletteMode, ThemeOptions } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

import {
  getMuiPaletteOptions,
  fontSize,
  getResponsiveFontSize,
  shadows,
  shadowsDark,
} from 'theme/tokens';

export function MuiProvider({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useNextTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const muiTheme = React.useMemo(() => {
    const mode = (mounted && resolvedTheme ? resolvedTheme : 'light') as PaletteMode;
    const currentPalette = getMuiPaletteOptions(mode);

    const themeOptions: ThemeOptions = {
      palette: currentPalette,
      typography: {
        fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
        // All font sizes are handled via getResponsiveFontSize() in sx props
        // These are just fallback defaults
        logo: {
          fontSize: fontSize.h4.desktop,
          fontWeight: 550,
          fontFamily: '"Poppins", "Roboto", "Helvetica", "Arial", sans-serif'
        },
        h1: { fontSize: fontSize.h1.tablet, fontWeight: 700 },
        h2: { fontSize: fontSize.h2.tablet, fontWeight: 700 },
        h3: { fontSize: fontSize.h3.tablet, fontWeight: 700 },
        h4: { fontSize: fontSize.h4.tablet, fontWeight: 600 },
        h5: { fontSize: fontSize.h5.tablet, fontWeight: 600 },
        h6: { fontSize: fontSize.h6.tablet, fontWeight: 600 },
        subtitle1: { fontSize: fontSize.md.tablet, fontWeight: 500 },
        subtitle2: { fontSize: fontSize.sm.tablet, fontWeight: 500 },
        body1: { fontSize: fontSize.base.tablet, fontWeight: 400 },
        body2: { fontSize: fontSize.sm.tablet, fontWeight: 400 },
        button: { fontSize: fontSize.base.tablet, textTransform: 'none', fontWeight: 500 },
        caption: { fontSize: fontSize.xs.tablet, fontWeight: 400 },
        overline: { fontSize: fontSize.xs.tablet, fontWeight: 400, textTransform: 'uppercase' },
      },
      // shape, spacing, breakpoints use MUI defaults
      components: {
        MuiAppBar: {
          styleOverrides: {
            root: ({ theme }) => ({
              backgroundColor: theme.palette.component.appBar.background,
              color: theme.palette.component.appBar.text,
              borderBottom: `1px solid ${theme.palette.divider}`,
            }),
          },
        },
        MuiDrawer: {
          styleOverrides: {
            paper: ({ theme }) => ({
              backgroundColor: theme.palette.background.default,
              borderRight: `1px solid ${theme.palette.divider}`,
            }),
          },
        },
        MuiTableHead: {
          styleOverrides: {
            root: ({ theme }) => ({
              backgroundColor: theme.palette.component.tableHead.background,
            }),
          },
        },
        MuiTableCell: {
          styleOverrides: {
            head: ({ theme }) => ({
              backgroundColor: theme.palette.component.tableHead.background,
              fontWeight: 600,
              padding: '8px 12px',
              fontSize: fontSize.base.tablet,
            }),
            body: {
              padding: '6px 12px',
              fontSize: fontSize.base.tablet,
              lineHeight: 1.3,
            },
          },
        },
        MuiTableRow: {
          styleOverrides: {
            root: ({ theme }) => ({
              backgroundColor: theme.palette.component.tableRow.background,
              '&:hover': {
                backgroundColor: theme.palette.component.tableRow.hover,
              },
              '&.Mui-selected': {
                backgroundColor: theme.palette.component.tableRow.selected,
                '&:hover': {
                  backgroundColor: theme.palette.component.tableRow.selected,
                },
              },
            }),
          },
        },
        MuiChip: {
          styleOverrides: {
            root: ({ theme, ownerState }) => ({
              height: '22px',
              fontSize: fontSize.sm.tablet,
              ...(ownerState.color === 'success' && {
                backgroundColor: theme.palette.component.chip.successBackground,
                color: theme.palette.component.chip.successColor,
              }),
              ...(ownerState.color === 'default' && {
                backgroundColor: theme.palette.component.chip.defaultBackground,
                color: theme.palette.component.chip.defaultColor,
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
        },
        MuiDialog: {
          styleOverrides: {
            paper: ({ theme }) => ({
              backgroundColor: theme.palette.component.modal.background,
              backgroundImage: 'none',
              boxShadow: theme.palette.mode === 'dark' ? shadowsDark.lg : shadows.lg,
            })
          }
        },
        MuiAvatar: {
          styleOverrides: {
            root: {
              width: 28,
              height: 28,
              fontSize: fontSize.base.tablet,
            }
          }
        },
        MuiTypography: {
          styleOverrides: {
            body1: {
              fontSize: fontSize.base.tablet,
              lineHeight: 1.4,
            },
            body2: {
              fontSize: fontSize.sm.tablet,
              lineHeight: 1.3,
            }
          }
        },
        MuiButton: {
          styleOverrides: {
            root: {
              fontSize: fontSize.base.tablet,
              lineHeight: 1.4,
              textTransform: 'none',
            },
            sizeSmall: {
              fontSize: fontSize.sm.tablet,
              padding: '4px 8px',
            },
            sizeMedium: {
              fontSize: fontSize.base.tablet,
              padding: '6px 12px',
            },
            sizeLarge: {
              fontSize: fontSize.md.tablet,
              padding: '8px 16px',
            }
          }
        },
        MuiBreadcrumbs: {
          styleOverrides: {
            root: {
              fontSize: fontSize.base.tablet,
            },
            li: {
              fontSize: fontSize.base.tablet,
            }
          }
        },
        MuiListItemText: {
          styleOverrides: {
            primary: {
              fontSize: fontSize.base.tablet,
              lineHeight: 1.4,
            },
            secondary: {
              fontSize: fontSize.sm.tablet,
              lineHeight: 1.3,
            }
          }
        },
        MuiMenuItem: {
          styleOverrides: {
            root: {
              fontSize: fontSize.base.tablet,
              lineHeight: 1.4,
              minHeight: '36px',
            }
          }
        },
        MuiFormLabel: {
          styleOverrides: {
            root: {
              fontSize: fontSize.base.tablet,
            }
          }
        },
        MuiInputLabel: {
          styleOverrides: {
            root: {
              fontSize: fontSize.base.tablet,
            }
          }
        },
        MuiOutlinedInput: {
          styleOverrides: {
            input: {
              fontSize: fontSize.base.tablet,
              lineHeight: 1.4,
            }
          }
        },
        MuiSelect: {
          styleOverrides: {
            select: {
              fontSize: fontSize.base.tablet,
              lineHeight: 1.4,
            }
          }
        },
        MuiTab: {
          styleOverrides: {
            root: {
              fontSize: fontSize.base.tablet,
              textTransform: 'none',
            }
          }
        },
        MuiAlert: {
          styleOverrides: {
            message: {
              fontSize: fontSize.base.tablet,
              lineHeight: 1.4,
            }
          }
        },
        MuiTooltip: {
          styleOverrides: {
            tooltip: {
              fontSize: fontSize.sm.tablet,
              lineHeight: 1.3,
            }
          }
        },
        MuiTablePagination: {
          styleOverrides: {
            root: ({ theme }) => ({
              backgroundColor: theme.palette.component.tableRow.background,
              color: theme.palette.mode === 'dark' ? '#ffffff' : 'rgba(0, 0, 0, 0.87)',
              fontSize: fontSize.base.tablet,
            }),
            toolbar: ({ theme }) => ({
              backgroundColor: theme.palette.component.tableRow.background,
              minHeight: '52px',
              paddingLeft: '16px',
              paddingRight: '8px',
            }),
            selectLabel: ({ theme }) => ({
              fontSize: fontSize.sm.tablet,
              color: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.6)',
            }),
            displayedRows: ({ theme }) => ({
              fontSize: fontSize.sm.tablet,
              color: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.6)',
            }),
            select: {
              fontSize: fontSize.sm.tablet,
            },
            actions: ({ theme }) => ({
              '& .MuiIconButton-root': {
                color: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.54)',
                padding: '8px',
              }
            })
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
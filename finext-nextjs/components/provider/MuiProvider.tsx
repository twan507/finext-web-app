// finext-nextjs/components/MuiProvider.tsx
'use client';

import * as React from 'react';
import { useTheme as useNextTheme } from 'next-themes';
import { ThemeProvider as MuiThemeProvider, createTheme, PaletteMode, ThemeOptions } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

import {
  getMuiPaletteOptions,

  getResponsiveFontSize,
  shadows,
  shadowsDark,
  fontWeight,
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
        // Sử dụng CSS variables từ next/font để tối ưu font loading
        fontFamily: 'var(--font-roboto), "Roboto", "Helvetica", "Arial", sans-serif',
        // All font sizes are handled via getResponsiveFontSize() in sx props
        // These are just fallback defaults
        logo: {
          fontSize: (getResponsiveFontSize('h4').lg) || '1.75rem',
          fontWeight: fontWeight.semibold, // Reduced from bold
          fontFamily: 'var(--font-poppins), "Poppins", "Roboto", "Helvetica", "Arial", sans-serif'
        },
        h1: { fontSize: getResponsiveFontSize('h1').md, fontWeight: fontWeight.bold }, // Desktop: 3rem
        h2: { fontSize: getResponsiveFontSize('h2').md, fontWeight: fontWeight.bold }, // Desktop: 2.5rem
        h3: { fontSize: getResponsiveFontSize('h3').md, fontWeight: fontWeight.bold }, // Desktop: 2rem
        h4: { fontSize: getResponsiveFontSize('h4').md, fontWeight: fontWeight.semibold }, // Desktop: 1.75rem
        h5: { fontSize: getResponsiveFontSize('xl').md, fontWeight: fontWeight.semibold }, // Was h5 (1.375rem). New xl is 1.375rem.
        h6: { fontSize: getResponsiveFontSize('lg').md, fontWeight: fontWeight.semibold }, // Was h6 (1.25rem). New lg is 1.25rem.
        subtitle1: { fontSize: getResponsiveFontSize('lg').md, fontWeight: fontWeight.medium }, // Was md (1rem). New lg is 1.25rem (Wait. Subtitle1 > Body1). Old md=1rem. New md=1rem. Let's use lg(1.25) or xl(1.375)? Old md was 1rem/1.0625rem?. Actually subtitle1 default is 1rem. Let's map to lg (1.25rem) to be clear.
        subtitle2: { fontSize: getResponsiveFontSize('md').md, fontWeight: fontWeight.medium }, // Was sm (0.875rem). New md is 1rem.
        body1: { fontSize: getResponsiveFontSize('md').md }, // Was base (0.9375rem). New md is 1rem.
        body2: { fontSize: getResponsiveFontSize('sm').md }, // Was sm (0.875rem). New sm is 0.875rem.
        button: { fontSize: getResponsiveFontSize('md').md, textTransform: 'none', fontWeight: fontWeight.medium }, // Was base.
        caption: { fontSize: getResponsiveFontSize('xs').md }, // Was xs.
        overline: { fontSize: getResponsiveFontSize('xs').md, textTransform: 'uppercase' },
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
              fontWeight: fontWeight.semibold,
              padding: '8px 12px',
              fontSize: getResponsiveFontSize('md').md,
            }),
            body: {
              padding: '6px 12px',
              fontSize: getResponsiveFontSize('md').md,
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
              fontSize: getResponsiveFontSize('sm').md,
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
              fontSize: getResponsiveFontSize('md').md,
            }
          }
        },
        MuiTypography: {
          styleOverrides: {
            body1: {
              fontSize: getResponsiveFontSize('md').md,
              lineHeight: 1.4,
            },
            body2: {
              fontSize: getResponsiveFontSize('sm').md,
              lineHeight: 1.3,
            }
          }
        },
        MuiButton: {
          styleOverrides: {
            root: {
              fontSize: getResponsiveFontSize('md').md,
              lineHeight: 1.4,
              textTransform: 'none',
            },
            sizeSmall: {
              fontSize: getResponsiveFontSize('sm').md,
              padding: '4px 8px',
            },
            sizeMedium: {
              fontSize: getResponsiveFontSize('md').md,
              padding: '6px 12px',
            },
            sizeLarge: {
              fontSize: getResponsiveFontSize('lg').md,
              padding: '8px 16px',
            }
          }
        },
        MuiBreadcrumbs: {
          styleOverrides: {
            root: {
              fontSize: getResponsiveFontSize('md').md,
            },
            li: {
              fontSize: getResponsiveFontSize('md').md,
            }
          }
        },
        MuiListItemText: {
          styleOverrides: {
            primary: {
              fontSize: getResponsiveFontSize('md').md,
              lineHeight: 1.4,
            },
            secondary: {
              fontSize: getResponsiveFontSize('sm').md,
              lineHeight: 1.3,
            }
          }
        },
        MuiMenuItem: {
          styleOverrides: {
            root: {
              fontSize: getResponsiveFontSize('md').md,
              lineHeight: 1.4,
              minHeight: '36px',
            }
          }
        },
        MuiFormLabel: {
          styleOverrides: {
            root: {
              fontSize: getResponsiveFontSize('md').md,
            }
          }
        },
        MuiInputLabel: {
          styleOverrides: {
            root: {
              fontSize: getResponsiveFontSize('md').md,
            }
          }
        },
        MuiOutlinedInput: {
          styleOverrides: {
            input: {
              fontSize: getResponsiveFontSize('md').md,
              lineHeight: 1.4,
            }
          }
        },
        MuiSelect: {
          styleOverrides: {
            select: {
              fontSize: getResponsiveFontSize('md').md,
              lineHeight: 1.4,
            }
          }
        },
        MuiTab: {
          styleOverrides: {
            root: {
              fontSize: getResponsiveFontSize('md').md,
              textTransform: 'none',
            }
          }
        },
        MuiAlert: {
          styleOverrides: {
            message: {
              fontSize: getResponsiveFontSize('md').md,
              lineHeight: 1.4,
            }
          }
        },
        MuiTooltip: {
          styleOverrides: {
            tooltip: {
              fontSize: getResponsiveFontSize('sm').md,
              lineHeight: 1.3,
            }
          }
        },
        MuiTablePagination: {
          styleOverrides: {
            root: ({ theme }) => ({
              backgroundColor: theme.palette.component.tableRow.background,
              color: theme.palette.mode === 'dark' ? '#ffffff' : 'rgba(0, 0, 0, 0.87)',
              fontSize: getResponsiveFontSize('md').md,
            }),
            toolbar: ({ theme }) => ({
              backgroundColor: theme.palette.component.tableRow.background,
              minHeight: '52px',
              paddingLeft: '16px',
              paddingRight: '8px',
            }),
            selectLabel: ({ theme }) => ({
              fontSize: getResponsiveFontSize('sm').md,
              color: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.6)',
            }),
            displayedRows: ({ theme }) => ({
              fontSize: getResponsiveFontSize('sm').md,
              color: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.6)',
            }),
            select: {
              fontSize: getResponsiveFontSize('sm').md,
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
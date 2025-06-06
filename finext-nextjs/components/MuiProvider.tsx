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
        }, MuiTableHead: {
          styleOverrides: {
            root: { // No need for ({ theme }) if directly using imported tokens
              backgroundColor: currentComponentColors.tableHead.background,
            },
          },
        }, MuiTableCell: {
          styleOverrides: {
            head: {
              backgroundColor: currentComponentColors.tableHead.background,
              fontWeight: 600,
              padding: '8px 12px', // Giảm padding từ mặc định 16px
              fontSize: '0.875rem', // Tăng từ 0.8125rem lên 0.875rem (+1px)
            },
            body: {
              padding: '6px 12px', // Giảm padding cho body cells
              fontSize: '0.875rem', // Tăng từ 0.8125rem lên 0.875rem (+1px)
              lineHeight: 1.3, // Giảm line height để hàng gọn hơn
            },
          },
        },
        MuiTableRow: {
          styleOverrides: {
            root: ({ theme }) => ({
              backgroundColor: currentComponentColors.tableRow.background,
              '&:hover': {
                backgroundColor: currentComponentColors.tableRow.hover,
              },
              '&.Mui-selected': {
                backgroundColor: currentComponentColors.tableRow.selected,
                '&:hover': {
                  backgroundColor: currentComponentColors.tableRow.selected,
                },
              },
            }),
          },
        }, MuiChip: {
          styleOverrides: {
            root: ({ theme, ownerState }) => ({
              height: '22px', // Giảm chiều cao từ mặc định 32px
              fontSize: '0.8125rem', // Tăng từ 0.75rem lên 0.8125rem (+1px)
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
        }, MuiPaper: {
          styleOverrides: {
            root: {
              // boxShadow: 'none',
            }
          }
        }, MuiDialog: {
          styleOverrides: {
            paper: {
              backgroundColor: currentComponentColors.modal.background,
              backgroundImage: 'none', // Tắt gradient mặc định của Material-UI
              boxShadow: mode === 'dark' ? '0px 4px 20px rgba(0, 0, 0, 0.5)' : '0px 4px 20px rgba(0, 0, 0, 0.15)',
            }
          }
        }, MuiAvatar: {
          styleOverrides: {
            root: {
              width: 28, // Giảm từ 30px xuống 28px
              height: 28, // Giảm từ 30px xuống 28px
              fontSize: '0.875rem', // Tăng từ 0.8125rem lên 0.875rem (+1px)
            }
          }
        }, MuiTypography: {
          styleOverrides: {
            body1: {
              fontSize: '0.875rem', // Tăng từ 0.8125rem lên 0.875rem (+1px)
              lineHeight: 1.4,
            },
            body2: {
              fontSize: '0.8125rem', // Tăng từ 0.75rem lên 0.8125rem (+1px)
              lineHeight: 1.3,
            }
          }
        },
        MuiButton: {
          styleOverrides: {
            root: {
              fontSize: '0.875rem', // Tăng từ 0.8125rem lên 0.875rem (+1px)
              lineHeight: 1.4,
              textTransform: 'none',
            },
            sizeSmall: {
              fontSize: '0.8125rem', // Tăng từ 0.75rem lên 0.8125rem (+1px)
              padding: '4px 8px',
            },
            sizeMedium: {
              fontSize: '0.875rem', // Tăng từ 0.8125rem lên 0.875rem (+1px)
              padding: '6px 12px',
            },
            sizeLarge: {
              fontSize: '0.9375rem', // Tăng từ 0.875rem lên 0.9375rem (+1px)
              padding: '8px 16px',
            }
          }
        },
        MuiBreadcrumbs: {
          styleOverrides: {
            root: {
              fontSize: '0.875rem', // Tăng từ 0.8125rem lên 0.875rem (+1px)
            },
            li: {
              fontSize: '0.875rem', // Tăng từ 0.8125rem lên 0.875rem (+1px)
            }
          }
        },
        MuiListItemText: {
          styleOverrides: {
            primary: {
              fontSize: '0.875rem', // Tăng từ 0.8125rem lên 0.875rem (+1px)
              lineHeight: 1.4,
            },
            secondary: {
              fontSize: '0.8125rem', // Tăng từ 0.75rem lên 0.8125rem (+1px)
              lineHeight: 1.3,
            }
          }
        },
        MuiMenuItem: {
          styleOverrides: {
            root: {
              fontSize: '0.875rem', // Tăng từ 0.8125rem lên 0.875rem (+1px)
              lineHeight: 1.4,
              minHeight: '36px', // Giảm chiều cao menu item
            }
          }
        },
        MuiFormLabel: {
          styleOverrides: {
            root: {
              fontSize: '0.875rem', // Tăng từ 0.8125rem lên 0.875rem (+1px)
            }
          }
        },
        MuiInputLabel: {
          styleOverrides: {
            root: {
              fontSize: '0.875rem', // Tăng từ 0.8125rem lên 0.875rem (+1px)
            }
          }
        },
        MuiOutlinedInput: {
          styleOverrides: {
            input: {
              fontSize: '0.875rem', // Tăng từ 0.8125rem lên 0.875rem (+1px)
              lineHeight: 1.4,
            }
          }
        },
        MuiSelect: {
          styleOverrides: {
            select: {
              fontSize: '0.875rem', // Tăng từ 0.8125rem lên 0.875rem (+1px)
              lineHeight: 1.4,
            }
          }
        },
        MuiTab: {
          styleOverrides: {
            root: {
              fontSize: '0.875rem', // Tăng từ 0.8125rem lên 0.875rem (+1px)
              textTransform: 'none',
            }
          }
        },
        MuiAlert: {
          styleOverrides: {
            message: {
              fontSize: '0.875rem', // Tăng từ 0.8125rem lên 0.875rem (+1px)
              lineHeight: 1.4,
            }
          }
        }, MuiTooltip: {
          styleOverrides: {
            tooltip: {
              fontSize: '0.8125rem', // Tăng từ 0.75rem lên 0.8125rem (+1px)
              lineHeight: 1.3,
            }
          }
        },
        MuiTablePagination: {
          styleOverrides: {
            root: {
              backgroundColor: currentComponentColors.tableRow.background,
              color: mode === 'dark' ? '#ffffff' : 'rgba(0, 0, 0, 0.87)',
              fontSize: '0.875rem',
            },
            toolbar: {
              backgroundColor: currentComponentColors.tableRow.background,
              minHeight: '52px',
              paddingLeft: '16px',
              paddingRight: '8px',
            },
            selectLabel: {
              fontSize: '0.8125rem',
              color: mode === 'dark' ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.6)',
            },
            displayedRows: {
              fontSize: '0.8125rem',
              color: mode === 'dark' ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.6)',
            },
            select: {
              fontSize: '0.8125rem',
            },
            actions: {
              '& .MuiIconButton-root': {
                color: mode === 'dark' ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.54)',
                padding: '8px',
              }
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
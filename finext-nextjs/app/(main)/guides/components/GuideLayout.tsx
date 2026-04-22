'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { alpha, Box, Breadcrumbs, Button, Typography, useTheme } from '@mui/material';
import MuiLink from '@mui/material/Link';
import { getResponsiveFontSize, fontWeight } from 'theme/tokens';

const SECTION_LABEL = 'Hướng dẫn sử dụng';
const SECTION_HREF = '/guides/overview';

const GUIDE_TABS: { label: string; href: string }[] = [
  { label: 'Tổng quan', href: '/guides/overview' },
  { label: 'Bộ lọc cổ phiếu', href: '/guides/stock-screener' },
  { label: 'Biểu đồ và Watchlist', href: '/guides/charts-watchlist' },
];

interface GuideLayoutProps {
  children: React.ReactNode;
}

export default function GuideLayout({ children }: GuideLayoutProps) {
  const theme = useTheme();
  const pathname = usePathname();

  const activeIndex = GUIDE_TABS.findIndex((t) => pathname?.startsWith(t.href));
  const tabValue = activeIndex >= 0 ? activeIndex : 0;
  const activeTab = GUIDE_TABS[tabValue];

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: 1200,
        mx: 'auto',
        px: { xs: 1.5, md: 2, lg: 3 },
        py: { xs: 2, md: 3 },
      }}
    >
      <Breadcrumbs separator="/" sx={{ mb: 1.5 }}>
        <MuiLink
          component={Link}
          href="/"
          underline="hover"
          color="text.secondary"
          sx={{
            fontSize: getResponsiveFontSize('sm'),
            '&:hover': { color: 'primary.main' },
          }}
        >
          Trang chủ
        </MuiLink>
        <MuiLink
          component={Link}
          href={SECTION_HREF}
          underline="hover"
          color="text.secondary"
          sx={{
            fontSize: getResponsiveFontSize('sm'),
            '&:hover': { color: 'primary.main' },
          }}
        >
          {SECTION_LABEL}
        </MuiLink>
        <Typography
          color="text.primary"
          sx={{
            fontSize: getResponsiveFontSize('sm'),
            fontWeight: fontWeight.medium,
            maxWidth: 240,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {activeTab.label}
        </Typography>
      </Breadcrumbs>

      <Box
        sx={{
          display: 'flex',
          gap: 1,
          mt: 2.5,
          mb: 2,
        }}
      >
        {GUIDE_TABS.map((tab, index) => {
          const isActive = index === tabValue;
          return (
            <Button
              key={tab.href}
              component={Link}
              href={tab.href}
              disableRipple
              disableElevation
              sx={{
                flex: 1,
                minHeight: 40,
                py: 0.75,
                px: 1.5,
                textTransform: 'none',
                fontSize: getResponsiveFontSize('sm'),
                fontWeight: isActive ? fontWeight.semibold : fontWeight.medium,
                borderRadius: 1.5,
                border: '1px solid',
                borderColor: isActive ? theme.palette.primary.main : theme.palette.divider,
                bgcolor: isActive
                  ? alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.18 : 0.1)
                  : 'transparent',
                color: isActive ? theme.palette.primary.main : theme.palette.text.secondary,
                '&:hover': {
                  bgcolor: isActive
                    ? alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.24 : 0.14)
                    : alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.08 : 0.05),
                  borderColor: theme.palette.primary.main,
                  color: theme.palette.primary.main,
                },
              }}
            >
              {tab.label}
            </Button>
          );
        })}
      </Box>

      {children}
    </Box>
  );
}

'use client';

import { useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Box, Typography, alpha, useTheme } from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { getResponsiveFontSize, fontWeight, transitions, layoutTokens } from 'theme/tokens';
import OptionalAuthWrapper from 'components/auth/OptionalAuthWrapper';
import { ADVANCED_AND_ABOVE_STRICT } from 'components/auth/features';
import type { MarketPhaseTabKey } from './types';
import { useMarketPhaseData } from './hooks/useMarketPhaseData';
import SharedPhaseHeader from './components/SharedPhaseHeader';
import MarketPhaseTab from './components/MarketPhaseTab';
import BasketTab from './components/BasketTab';

const TABS: { key: MarketPhaseTabKey; label: string; free?: boolean }[] = [
  { key: 'market', label: 'Thị trường chung', free: true },
  { key: 'conservative', label: 'Bảo Thủ' },
  { key: 'aggressive', label: 'Tăng Trưởng' },
  { key: 'core', label: 'Sóng Ngành' },
];

// Slider chọn tab — full-bleed (tràn viền), tham khảo markets SubNavbar.
function TabSlider({ activeTab, onTabChange }: { activeTab: MarketPhaseTabKey; onTabChange: (t: MarketPhaseTabKey) => void }) {
  const theme = useTheme();
  return (
    <Box
      sx={{
        mx: { xs: 'calc(-50vw + 50%)', lg: `calc(-50vw + 50% + ${layoutTokens.compactDrawerWidth / 2}px)` },
        borderTop: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
        borderBottom: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
        bgcolor: theme.palette.background.default,
      }}
    >
      <Box
        sx={{
          maxWidth: 1400,
          mx: 'auto',
          px: { xs: 1.5, md: 2, lg: 3 },
          display: 'flex',
          overflowX: 'auto',
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': { display: 'none' },
          msOverflowStyle: 'none',
        }}
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <Box
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              sx={{
                px: { xs: 2, md: 2.5 },
                py: 1.5,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.75,
                borderBottom: isActive ? `3px solid ${theme.palette.primary.main}` : '3px solid transparent',
                transition: transitions.colors,
                color: isActive ? theme.palette.primary.main : theme.palette.text.secondary,
                '&:hover': { color: theme.palette.primary.main },
              }}
            >
              <Typography
                component="span"
                sx={{ fontSize: getResponsiveFontSize('md'), fontWeight: isActive ? fontWeight.semibold : fontWeight.medium, color: 'inherit', transition: transitions.colors }}
              >
                {tab.label}
              </Typography>
              {!tab.free && <LockOutlinedIcon sx={{ fontSize: '0.85rem', opacity: 0.55, color: 'inherit' }} />}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

export default function PageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mp = useMarketPhaseData();

  const tabParam = searchParams.get('tab');
  const activeTab: MarketPhaseTabKey = TABS.some((t) => t.key === tabParam) ? (tabParam as MarketPhaseTabKey) : 'market';

  const handleTab = useCallback(
    (key: MarketPhaseTabKey) => {
      router.push(key === 'market' ? '?tab=market' : `?tab=${key}`, { scroll: false });
    },
    [router],
  );

  return (
    <Box sx={{ py: 3 }}>
      <Typography variant="h1" sx={{ fontSize: getResponsiveFontSize('h1'), mb: 0.5 }}>
        Giai đoạn thị trường
      </Typography>
      <Typography sx={{ fontSize: getResponsiveFontSize('sm'), color: 'text.secondary', mb: 3 }}>
        Đèn tín hiệu pha thị trường, tỷ trọng nắm giữ gợi ý và hiệu suất danh mục — cập nhật cuối phiên.
      </Typography>

      {/* FREE: cần đăng nhập. Gate 1 lớp cho header + slider + nội dung. */}
      <OptionalAuthWrapper requireAuth>
        {/* Dùng chung cho cả 4 tab, đặt trên slider */}
        <SharedPhaseHeader daily={mp.daily} isLoading={mp.isLoading} error={mp.error} />

        <Box sx={{ mt: 4 }}>
          <TabSlider activeTab={activeTab} onTabChange={handleTab} />
        </Box>

        <Box sx={{ mt: 3 }}>
          {activeTab === 'market' ? (
            <MarketPhaseTab daily={mp.daily} comment={mp.comment} perf={mp.perf} indicators={mp.indicators} error={mp.error} />
          ) : (
            <OptionalAuthWrapper requireAuth requiredFeatures={ADVANCED_AND_ABOVE_STRICT}>
              <BasketTab tabKey={activeTab} />
            </OptionalAuthWrapper>
          )}
        </Box>
      </OptionalAuthWrapper>
    </Box>
  );
}

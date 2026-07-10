'use client';

import { Box, Skeleton, Stack, useTheme } from '@mui/material';
import { getGlassCard, borderRadius } from 'theme/tokens';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Tiêu đề section: dòng chữ + chấm ⓘ (khớp ChartSectionTitle). */
function SectionTitleSkeleton() {
  return (
    <Stack direction="row" spacing={0.75} alignItems="center">
      <Skeleton variant="text" width={210} sx={{ fontSize: '1.25rem' }} />
      <Skeleton variant="circular" width={15} height={15} />
    </Stack>
  );
}

/** Khối chart: hàng pill timeframe (góc phải) + vùng biểu đồ. */
function ChartSkeleton({ height }: { height: number }) {
  return (
    <Box sx={{ mt: 1.5 }}>
      <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ mb: 1 }}>
        <Skeleton variant="rounded" width={34} height={34} />
        <Skeleton variant="rounded" width={150} height={34} />
      </Stack>
      <Skeleton variant="rounded" width="100%" height={height} />
    </Box>
  );
}

function TextLines({ n }: { n: number }) {
  return (
    <Box>
      {Array.from({ length: n }).map((_, i) => (
        <Skeleton key={i} variant="text" width={i === n - 1 ? '60%' : '100%'} />
      ))}
    </Box>
  );
}

// ── Hero (trên slider) ───────────────────────────────────────────────────────

/** Skeleton cho PhaseHero: glass card, 3 cột + divider giống thật. */
export function PhaseHeroSkeleton() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const divider = `1px solid ${theme.palette.divider}`;
  const cellSx = { p: { xs: 2.5, md: 3 }, display: 'flex', flexDirection: 'column', gap: 1.25, minWidth: 0 } as const;

  return (
    <Box sx={{ overflow: 'hidden', borderRadius: `${borderRadius.lg}px`, ...getGlassCard(isDark) }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.15fr 1fr 1.2fr' } }}>
        {/* Cột 1 — trạng thái */}
        <Box sx={{ ...cellSx, borderBottom: { xs: divider, md: 'none' }, borderRight: { md: divider } }}>
          <Skeleton variant="text" width={130} />
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Skeleton variant="rounded" width={52} height={52} />
            <Box sx={{ flex: 1 }}>
              <Skeleton variant="text" width="70%" sx={{ fontSize: '1.6rem' }} />
              <Skeleton variant="text" width="40%" />
            </Box>
          </Stack>
          <Stack direction="row" spacing={0.5}>
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} variant="rounded" width={14} height={20} />
            ))}
          </Stack>
          <Skeleton variant="text" width="80%" />
        </Box>

        {/* Cột 2 — tỷ trọng */}
        <Box sx={{ ...cellSx, borderBottom: { xs: divider, md: 'none' }, borderRight: { md: divider } }}>
          <Skeleton variant="text" width={150} />
          <Skeleton variant="rounded" width={120} height={48} />
          <Stack direction="row" spacing={0.5}>
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} variant="rounded" height={9} sx={{ flex: 1 }} />
            ))}
          </Stack>
          <Skeleton variant="text" width="60%" />
        </Box>

        {/* Cột 3 — cường độ */}
        <Box sx={cellSx}>
          <Skeleton variant="text" width={140} />
          <Stack direction="row" spacing={1.25} alignItems="center">
            <Skeleton variant="rounded" width={90} height={36} />
            <Skeleton variant="rounded" width={90} height={22} sx={{ borderRadius: 999 }} />
          </Stack>
          <Skeleton variant="rounded" height={12} sx={{ borderRadius: 999, mt: 0.75 }} />
          <Stack direction="row" justifyContent="space-between">
            <Skeleton variant="text" width={70} />
            <Skeleton variant="text" width={70} />
          </Stack>
        </Box>
      </Box>
    </Box>
  );
}

// ── Tab ① (nội dung dưới slider) ─────────────────────────────────────────────

function AdvancedPanelSkeleton() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  return (
    <Box sx={{ mt: 2.5, borderRadius: `${borderRadius.lg}px`, ...getGlassCard(isDark), p: { xs: 2, md: 2.5 } }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, columnGap: 4, rowGap: 2 }}>
        {Array.from({ length: 2 }).map((_, col) => (
          <Stack key={col} spacing={2}>
            {Array.from({ length: 4 }).map((_, i) => (
              <Box key={i}>
                <Skeleton variant="text" width="55%" />
                <Skeleton variant="rounded" width="100%" height={14} sx={{ mt: 0.5 }} />
              </Box>
            ))}
          </Stack>
        ))}
      </Box>
    </Box>
  );
}

function TopTradesSkeleton() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  return (
    <Box sx={{ mt: 1.5, display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: { xs: 2, md: 2.5 } }}>
      {Array.from({ length: 3 }).map((_, c) => (
        <Box key={c} sx={{ borderRadius: `${borderRadius.lg}px`, ...getGlassCard(isDark), overflow: 'hidden' }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ p: 1.5, borderBottom: `1px solid ${theme.palette.divider}` }}>
            <Skeleton variant="rounded" width={10} height={10} />
            <Skeleton variant="text" width={110} />
          </Stack>
          <Box sx={{ p: 1.5 }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} variant="text" width="100%" sx={{ my: 0.5 }} />
            ))}
          </Box>
        </Box>
      ))}
    </Box>
  );
}

/** Skeleton cho Tab ① — 4 section bám sát MarketPhaseTab. */
export function MarketPhaseTabSkeleton() {
  return (
    <Box>
      {/* ① Diễn biến & phân tích phiên */}
      <Box>
        <SectionTitleSkeleton />
        <ChartSkeleton height={300} />
        <Box sx={{ mt: 3 }}>
          <TextLines n={4} />
        </Box>
      </Box>

      {/* ② Chi tiết các chỉ số */}
      <Box sx={{ mt: 4 }}>
        <SectionTitleSkeleton />
        <ChartSkeleton height={345} />
        <AdvancedPanelSkeleton />
      </Box>

      {/* ③ Hiệu suất danh mục */}
      <Box sx={{ mt: 4 }}>
        <SectionTitleSkeleton />
        <Stack direction="row" spacing={3} sx={{ mt: 1.5, mb: 1, flexWrap: 'wrap', gap: 1.5 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Box key={i}>
              <Skeleton variant="text" width={70} />
              <Skeleton variant="rounded" width={90} height={28} sx={{ mt: 0.5 }} />
            </Box>
          ))}
        </Stack>
        <Skeleton variant="rounded" width="100%" height={320} />
      </Box>

      {/* ④ Top lệnh lãi nhất */}
      <Box sx={{ mt: 4 }}>
        <SectionTitleSkeleton />
        <TopTradesSkeleton />
      </Box>
    </Box>
  );
}

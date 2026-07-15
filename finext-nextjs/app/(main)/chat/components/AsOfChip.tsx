'use client';

import { Box, Tooltip, Typography, alpha, useTheme } from '@mui/material';
import { getGlassCard, getResponsiveFontSize, fontWeight, borderRadius } from 'theme/tokens';

const TOOLTIP = 'Trong phiên: giá cập nhật ~2 phút/lần · Phase chốt cuối ngày';

export default function AsOfChip({ asOf }: { asOf: string | null }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  if (!asOf) return null;

  return (
    <Tooltip
      title={TOOLTIP}
      placement="bottom"
      slotProps={{ tooltip: { sx: { ...getGlassCard(isDark), color: theme.palette.text.primary, px: 1.25, py: 1, borderRadius: `${borderRadius.md}px`, maxWidth: 260, fontSize: getResponsiveFontSize('xs') } } }}
    >
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.625,
          width: 'fit-content',
          px: 1.25,
          py: 0.375,
          borderRadius: `${borderRadius.pill}px`,
          bgcolor: alpha(theme.palette.text.primary, 0.05),
          border: `1px solid ${theme.palette.divider}`,
          cursor: 'default'
        }}
      >
        <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'success.main', flexShrink: 0 }} />
        <Typography component="span" sx={{ fontSize: getResponsiveFontSize('xs'), color: 'text.secondary', fontWeight: fontWeight.medium }}>
          Dữ liệu {asOf}
        </Typography>
      </Box>
    </Tooltip>
  );
}

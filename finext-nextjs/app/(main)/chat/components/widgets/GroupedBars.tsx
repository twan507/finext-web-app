'use client';

import { Box, Typography, alpha, useTheme } from '@mui/material';
import { getResponsiveFontSize, fontWeight, borderRadius } from 'theme/tokens';
import type { BarGroup } from '../WidgetRenderer';

// Mỗi group 1 khối: nhãn + ≤3 thanh (màu theo index series), legend series ở đầu.
export default function GroupedBars({ series, groups }: { series: string[]; groups: BarGroup[] }) {
  const theme = useTheme();
  const palette = [theme.palette.primary.main, theme.palette.info.main, theme.palette.warning.main];
  const max = Math.max(...groups.flatMap((g) => g.values.map((v) => Math.abs(Number(v) || 0))), 1);

  return (
    <Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mb: 1 }}>
        {series.map((name, i) => (
          <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 10, height: 10, borderRadius: '2px', bgcolor: palette[i % palette.length] }} />
            <Typography sx={{ fontSize: getResponsiveFontSize('xs'), color: 'text.secondary' }}>{name}</Typography>
          </Box>
        ))}
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {groups.map((g, gi) => (
          <Box key={gi}>
            <Typography sx={{ fontSize: getResponsiveFontSize('xs'), color: 'text.secondary', mb: 0.25 }}>{g.label}</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {g.values.map((v, vi) => {
                const value = Number(v) || 0;
                const color = palette[vi % palette.length];
                return (
                  <Box key={vi} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ flex: 1, height: 14, position: 'relative', borderRadius: `${borderRadius.sm}px`, bgcolor: alpha(theme.palette.text.primary, 0.04) }}>
                      <Box
                        sx={{
                          position: 'absolute',
                          left: 0,
                          top: 0,
                          bottom: 0,
                          width: `${(Math.abs(value) / max) * 100}%`,
                          borderRadius: `${borderRadius.sm}px`,
                          bgcolor: alpha(color, 0.85)
                        }}
                      />
                    </Box>
                    <Typography sx={{ fontSize: getResponsiveFontSize('xs'), fontWeight: fontWeight.medium, minWidth: 56, textAlign: 'right', flexShrink: 0 }}>
                      {value.toLocaleString('vi-VN')}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

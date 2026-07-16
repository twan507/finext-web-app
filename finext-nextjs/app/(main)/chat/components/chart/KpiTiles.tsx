'use client';

import { Box, Typography, alpha, useTheme } from '@mui/material';
import { getResponsiveFontSize, fontWeight, borderRadius } from 'theme/tokens';
import EChart from './EChart';
import { buildSpark, type ChartPalette, type KpiTile, type KpiTone } from './templates';

// Ô số CSS (không ECharts) + tone màu up/down + delta + mini sparkline.
// Layout flex-wrap, KHÔNG height cứng → tránh tràn khi có sparkline.
export default function KpiTiles({ tiles, palette }: { tiles: KpiTile[]; palette: ChartPalette }) {
  const theme = useTheme();
  const toneColor = (tone: KpiTone): string =>
    tone === 'up' ? theme.palette.trend.up : tone === 'down' ? theme.palette.trend.down : theme.palette.text.secondary;

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
      {tiles.map((t, i) => (
        <Box
          key={i}
          sx={{
            flex: '1 1 150px',
            minWidth: 130,
            display: 'flex',
            flexDirection: 'column',
            gap: 0.25,
            p: 1.25,
            border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
            borderLeft: `3px solid ${t.tone === 'flat' ? alpha(theme.palette.divider, 0.5) : toneColor(t.tone)}`,
            borderRadius: `${borderRadius.md}px`,
            bgcolor: alpha(theme.palette.text.primary, 0.02),
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
            <Typography
              sx={{
                fontSize: getResponsiveFontSize('xs'),
                color: 'text.secondary',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {t.label}
            </Typography>
            {t.delta && (
              <Typography sx={{ fontSize: getResponsiveFontSize('xs'), fontWeight: fontWeight.semibold, color: toneColor(t.tone), whiteSpace: 'nowrap' }}>
                {t.delta}
              </Typography>
            )}
          </Box>
          <Typography sx={{ fontSize: getResponsiveFontSize('xxl'), fontWeight: fontWeight.bold, lineHeight: 1.2, letterSpacing: '-0.02em', color: 'text.primary' }}>
            {t.value}
          </Typography>
          {t.spark && t.spark.length > 1 && (
            <Box sx={{ mt: 0.25 }}>
              <EChart option={buildSpark(palette, t.spark, t.tone)} height={34} />
            </Box>
          )}
        </Box>
      ))}
    </Box>
  );
}

'use client';

import { Box, Typography, alpha, useTheme } from '@mui/material';
import { getResponsiveFontSize, fontWeight, borderRadius } from 'theme/tokens';
import type { StatTile } from '../WidgetRenderer';

// Grid ≤6 ô: value to, label nhỏ text.secondary; màu theo tone (up=xanh / down=đỏ / flat=mặc định).
export default function StatTiles({ tiles }: { tiles: StatTile[] }) {
  const theme = useTheme();
  const toneColor = (tone?: StatTile['tone']) =>
    tone === 'up' ? theme.palette.success.main : tone === 'down' ? theme.palette.error.main : theme.palette.text.primary;

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 1 }}>
      {tiles.map((t, i) => (
        <Box
          key={i}
          sx={{
            p: 1.5,
            borderRadius: `${borderRadius.md}px`,
            border: `1px solid ${alpha(theme.palette.divider, 0.4)}`,
            bgcolor: alpha(theme.palette.text.primary, 0.02)
          }}
        >
          <Typography sx={{ fontSize: getResponsiveFontSize('xs'), color: 'text.secondary', mb: 0.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {t.label}
          </Typography>
          <Typography sx={{ fontSize: getResponsiveFontSize('h3'), fontWeight: fontWeight.bold, lineHeight: 1.15, color: toneColor(t.tone) }}>
            {String(t.value)}
          </Typography>
          {t.sub && (
            <Typography sx={{ fontSize: getResponsiveFontSize('xs'), color: 'text.secondary', mt: 0.25 }}>{t.sub}</Typography>
          )}
        </Box>
      ))}
    </Box>
  );
}

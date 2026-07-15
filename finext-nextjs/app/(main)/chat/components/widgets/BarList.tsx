'use client';

import { Box, Typography, alpha, useTheme } from '@mui/material';
import { getResponsiveFontSize, fontWeight, borderRadius } from 'theme/tokens';
import type { BarItem } from '../WidgetRenderer';

// Mỗi item 1 hàng: nhãn trái, thanh ngang |value|/max, màu value≥0 xanh / <0 đỏ, số phải.
export default function BarList({ items }: { items: BarItem[] }) {
  const theme = useTheme();
  const max = Math.max(...items.map((i) => Math.abs(Number(i.value) || 0)), 1);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
      {items.map((item, i) => {
        const value = Number(item.value) || 0;
        const color = value >= 0 ? theme.palette.success.main : theme.palette.error.main;
        return (
          <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography
              sx={{ fontSize: getResponsiveFontSize('sm'), minWidth: 96, flexShrink: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
            >
              {item.label}
            </Typography>
            <Box sx={{ flex: 1, height: 20, position: 'relative', borderRadius: `${borderRadius.sm}px`, bgcolor: alpha(theme.palette.text.primary, 0.04) }}>
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
            <Typography sx={{ fontSize: getResponsiveFontSize('sm'), fontWeight: fontWeight.semibold, color, minWidth: 56, textAlign: 'right', flexShrink: 0 }}>
              {item.note ?? value.toLocaleString('vi-VN')}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}

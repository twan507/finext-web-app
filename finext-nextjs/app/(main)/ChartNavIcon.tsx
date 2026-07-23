'use client';

import { useId } from 'react';
import { Box, useTheme, type SxProps, type Theme } from '@mui/material';

/**
 * Icon "Biểu đồ kĩ thuật" — duotone: đường giá + vùng nền phủ mềm (area chart), nét gradient thương
 * hiệu. Gradient id duy nhất theo instance (useId) để nhiều chỗ render không trùng id. Co theo
 * fontSize (1em); nhận `sx` để cloneElement ở LayoutContent ghi đè fontSize từng chỗ.
 */
export default function ChartNavIcon({ sx }: { sx?: SxProps<Theme> }) {
  const theme = useTheme();
  const gid = 'chart-' + useId().replace(/[^a-zA-Z0-9-]/g, '');
  const g = `url(#${gid})`;
  const c1 = theme.palette.primary.main;
  const c2 = theme.palette.mode === 'dark' ? '#a78bfa' : '#8b5cf6';
  return (
    <Box component="svg" viewBox="0 0 24 24" fill="none" sx={[{ width: '1em', height: '1em', fontSize: '1.5rem', display: 'block' }, ...(Array.isArray(sx) ? sx : [sx])]}>
      <defs>
        <linearGradient id={gid} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor={c1} />
          <stop offset="1" stopColor={c2} />
        </linearGradient>
      </defs>
      <path d="M4 15.5 L8.5 11 L12 13.5 L16 7 L20 9.8 L20 19 L4 19 Z" fill={g} fillOpacity={0.2} />
      <path d="M4 15.5 L8.5 11 L12 13.5 L16 7 L20 9.8" fill="none" stroke={g} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
      <line x1="3.6" y1="19" x2="20.4" y2="19" stroke={g} strokeWidth={1.3} strokeLinecap="round" opacity={0.45} />
    </Box>
  );
}

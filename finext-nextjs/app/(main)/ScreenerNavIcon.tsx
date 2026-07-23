'use client';

import { useId } from 'react';
import { Box, useTheme, type SxProps, type Theme } from '@mui/material';

/** Icon "Bộ lọc thông minh" — phễu duotone + tia sáng nhỏ ("thông minh"). */
export default function ScreenerNavIcon({ sx }: { sx?: SxProps<Theme> }) {
  const theme = useTheme();
  const gid = 'flt-' + useId().replace(/[^a-zA-Z0-9-]/g, '');
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
      <path d="M4 5.6 H20 L13.5 12.5 V18 L10.5 19.6 V12.5 Z" fill={g} fillOpacity={0.2} stroke={g} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
      <path d="M18.6 2.6 l.5 1.45 1.45 .5 -1.45 .5 -.5 1.45 -.5 -1.45 -1.45 -.5 1.45 -.5 z" fill={g} />
    </Box>
  );
}

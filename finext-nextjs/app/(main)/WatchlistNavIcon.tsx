'use client';

import { useId } from 'react';
import { Box, useTheme, type SxProps, type Theme } from '@mui/material';

/** Icon "Danh sách theo dõi" — sao duotone (mảng phủ mềm + nét gradient thương hiệu). */
export default function WatchlistNavIcon({ sx }: { sx?: SxProps<Theme> }) {
  const theme = useTheme();
  const gid = 'wl-' + useId().replace(/[^a-zA-Z0-9-]/g, '');
  const g = `url(#${gid})`;
  const c1 = theme.palette.primary.main;
  const c2 = theme.palette.mode === 'dark' ? '#a78bfa' : '#8b5cf6';
  return (
    <Box component="svg" viewBox="0 0 24 24" fill="none" sx={[{ width: '1em', height: '1em', fontSize: '1.5rem', display: 'block' }, ...(Array.isArray(sx) ? sx : [sx])]}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={c1} />
          <stop offset="1" stopColor={c2} />
        </linearGradient>
      </defs>
      <path
        d="M12 3.6 L14.06 9.17 L19.99 9.4 L15.33 13.08 L16.94 18.8 L12 15.5 L7.06 18.8 L8.67 13.08 L4.01 9.4 L9.94 9.17 Z"
        fill={g} fillOpacity={0.2} stroke={g} strokeWidth={1.5} strokeLinejoin="round"
      />
    </Box>
  );
}

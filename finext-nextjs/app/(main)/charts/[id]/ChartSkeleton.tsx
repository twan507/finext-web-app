'use client';

import React from 'react';
import { Box, Skeleton, useTheme, keyframes } from '@mui/material';
import DotLoading from 'components/common/DotLoading';

// Shimmer animation
const shimmer = keyframes`
  0% { opacity: 0.45; }
  50% { opacity: 0.75; }
  100% { opacity: 0.45; }
`;

// Sinh 120 bar volume ngẫu nhiên trong dải cố định 20–70%
const VOLUME_BARS = Array.from({ length: 120 }, () => 20 + Math.random() * 50);

export default function ChartSkeleton() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  // Màu sắc skeleton
  const volumeColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)';
  const skeletonText = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const skeletonTextStrong = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.09)';



  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        position: 'relative',
        bgcolor: theme.palette.background.default,
        overflow: 'hidden',
      }}
    >
      {/* Centered loading dots */}
      <Box
        sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <DotLoading />
      </Box>

      {/* Legend skeleton */}
      <Box
        sx={{
          position: 'absolute',
          top: 8,
          left: 8,
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: 0.4,
        }}
      >
        <Skeleton
          variant="text"
          width={90}
          height={17}
          animation="wave"
          sx={{ bgcolor: skeletonTextStrong, borderRadius: 0.5 }}
        />
        <Box sx={{ display: 'flex', gap: 0.8, alignItems: 'center' }}>
          <Skeleton variant="text" width={20} height={13} animation="wave" sx={{ bgcolor: skeletonText, borderRadius: 0.5 }} />
          {[60, 60, 60, 60, 80].map((w, i) => (
            <Skeleton key={i} variant="text" width={w} height={13} animation="wave" sx={{ bgcolor: skeletonText, borderRadius: 0.5 }} />
          ))}
        </Box>
        <Skeleton variant="text" width={100} height={13} animation="wave" sx={{ bgcolor: skeletonText, borderRadius: 0.5 }} />
        <Skeleton variant="text" width={120} height={13} animation="wave" sx={{ bgcolor: skeletonText, borderRadius: 0.5 }} />
      </Box>

      {/* Chart area */}
      <Box sx={{ position: 'absolute', inset: 0 }}>
        {/* Volume bars */}
        <Box
          sx={{
            position: 'absolute',
            left: 4,
            right: 52,
            bottom: '4%',
            height: '16%',
            display: 'flex',
            alignItems: 'flex-end',
            gap: '0.8px',
            animation: `${shimmer} 2.2s ease-in-out infinite`,
            animationDelay: '0.4s',
          }}
        >
          {VOLUME_BARS.map((h, i) => (
            <Box
              key={i}
              sx={{
                flex: 1,
                height: `${h}%`,
                bgcolor: volumeColor,
                borderRadius: '0.5px 0.5px 0 0',
                minWidth: '2px',
              }}
            />
          ))}
        </Box>

        {/* Right price scale */}
        <Box
          sx={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 24,
            width: 48,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            py: 3,
            px: 0.5,
          }}
        >
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton
              key={i}
              variant="text"
              width={38}
              height={11}
              animation="wave"
              sx={{ bgcolor: skeletonText, borderRadius: 0.5 }}
            />
          ))}
        </Box>

        {/* Bottom time scale */}
        <Box
          sx={{
            position: 'absolute',
            left: 0,
            right: 48,
            bottom: 0,
            height: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-around',
            px: 2,
          }}
        >
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Skeleton
              key={i}
              variant="text"
              width={32}
              height={10}
              animation="wave"
              sx={{ bgcolor: skeletonText, borderRadius: 0.5 }}
            />
          ))}
        </Box>
      </Box>
    </Box>
  );
}
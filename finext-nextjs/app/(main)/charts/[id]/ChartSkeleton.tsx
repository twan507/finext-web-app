'use client';

import React, { useMemo } from 'react';
import { Box, Skeleton, useTheme, keyframes, CircularProgress } from '@mui/material';

// Shimmer animation
const shimmer = keyframes`
  0% { opacity: 0.45; }
  50% { opacity: 0.75; }
  100% { opacity: 0.45; }
`;

// Hàm sinh dữ liệu ngẫu nhiên theo 1 trong 5 pattern
function generateChartData(count = 120) {
  const candles = [];
  const volumes = [];

  // --- ĐỊNH NGHĨA 5 PATTERNS ---
  const patterns = [
    // Pattern 1: VN-INDEX Style (Sideways -> Dip -> Rally -> Correction)
    [
      { pct: 0, val: 30 }, { pct: 0.15, val: 35 }, { pct: 0.25, val: 20 },
      { pct: 0.65, val: 90 }, { pct: 0.75, val: 85 }, { pct: 0.90, val: 60 }, { pct: 1.0, val: 58 }
    ],
    // Pattern 2: Strong Uptrend (Tăng trưởng mạnh mẽ)
    [
      { pct: 0, val: 10 }, { pct: 0.2, val: 25 }, { pct: 0.4, val: 45 },
      { pct: 0.5, val: 40 }, { pct: 0.7, val: 75 }, { pct: 0.9, val: 95 }, { pct: 1.0, val: 90 }
    ],
    // Pattern 3: Downtrend / Bear Market (Giảm dần đều)
    [
      { pct: 0, val: 85 }, { pct: 0.2, val: 70 }, { pct: 0.3, val: 75 },
      { pct: 0.6, val: 40 }, { pct: 0.8, val: 20 }, { pct: 0.9, val: 25 }, { pct: 1.0, val: 15 }
    ],
    // Pattern 4: V-Shape Recovery (Rơi mạnh rồi hồi phục chữ V)
    [
      { pct: 0, val: 70 }, { pct: 0.3, val: 40 }, { pct: 0.45, val: 10 },
      { pct: 0.55, val: 15 }, { pct: 0.7, val: 50 }, { pct: 0.9, val: 75 }, { pct: 1.0, val: 80 }
    ],
    // Pattern 5: Volatile Sideways (Biến động mạnh nhưng đi ngang)
    [
      { pct: 0, val: 45 }, { pct: 0.2, val: 65 }, { pct: 0.4, val: 35 },
      { pct: 0.6, val: 60 }, { pct: 0.8, val: 40 }, { pct: 0.9, val: 55 }, { pct: 1.0, val: 50 }
    ]
  ];

  // Chọn ngẫu nhiên 1 pattern
  const selectedKeyframes = patterns[Math.floor(Math.random() * patterns.length)];

  // Hàm nội suy
  const getBasePrice = (index: any) => {
    const progress = index / count;
    for (let i = 0; i < selectedKeyframes.length - 1; i++) {
      if (progress >= selectedKeyframes[i].pct && progress <= selectedKeyframes[i + 1].pct) {
        const start = selectedKeyframes[i];
        const end = selectedKeyframes[i + 1];
        const segProgress = (progress - start.pct) / (end.pct - start.pct);
        return start.val + (end.val - start.val) * segProgress;
      }
    }
    return selectedKeyframes[selectedKeyframes.length - 1].val;
  };

  let prevPrice = selectedKeyframes[0].val;

  for (let i = 0; i < count; i++) {
    // 1. Tính toán giá
    const baseTrend = getBasePrice(i);
    // Noise: Sine wave + Random
    const noise = (Math.sin(i * 0.5) * 2) + (Math.random() * 5 - 2.5);
    const bottom = Math.max(5, Math.min(95, baseTrend + noise));

    const isBullish = i > 0 ? bottom >= prevPrice : true;

    // Tính độ biến động (Change) để quyết định body và volume
    const change = Math.abs(bottom - prevPrice);

    prevPrice = bottom;

    // Body height: Biến động càng lớn, thân nến càng dài
    const bodyH = Math.max(1.5, Math.min(12, change * 1.5 + Math.random() * 2));

    const wickTop = Math.random() * 3;
    const wickBot = Math.random() * 3;

    candles.push({
      bottom,
      bodyH,
      wickTop,
      wickBot,
      bullish: isBullish,
    });

    // 2. Tính toán Volume (Dynamic theo biến động giá)
    // Nếu giá thay đổi mạnh (change lớn) -> Volume lớn
    let volBase = 20 + (change * 10);

    // Thêm yếu tố ngẫu nhiên đột biến volume
    if (Math.random() > 0.9) volBase += 30;

    const volNoise = Math.random() * 15 - 7.5;
    const volHeight = Math.max(10, Math.min(90, volBase + volNoise));

    volumes.push(volHeight);
  }

  return { candles, volumes };
}

export default function ChartSkeleton() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  // Màu sắc skeleton
  const candleColor = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)';
  const candleColorAlt = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.05)';
  const volumeColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)';
  const skeletonText = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const skeletonTextStrong = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.09)';

  // useMemo với dependency rỗng [] để chỉ chạy 1 lần khi mount component
  // Mỗi lần F5 hoặc mount lại component sẽ random pattern mới
  const { candles: CANDLES, volumes: VOLUME_BARS } = useMemo(() => generateChartData(120), []);

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
      {/* Centered loading spinner */}
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
        <CircularProgress
          variant="determinate"
          value={100}
          sx={{
            position: 'absolute',
            color: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
          }}
        />
        <CircularProgress />
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
        {/* Candlestick area - Fixed Wick Overlapping */}
        <Box
          sx={{
            position: 'absolute',
            left: 4,
            right: 52,
            top: '6%',
            bottom: '24%',
            display: 'flex',
            alignItems: 'flex-end',
            gap: '0.8px',
            animation: `${shimmer} 2.2s ease-in-out infinite`,
          }}
        >
          {CANDLES.map((c, i) => {
            const color = c.bullish ? candleColor : candleColorAlt;

            return (
              <Box
                key={i}
                sx={{
                  flex: 1,
                  position: 'relative',
                  height: '100%',
                  minWidth: '2px',
                }}
              >
                {/* 1. Râu dưới */}
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: `${c.bottom - c.wickBot}%`,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '1px',
                    height: `${c.wickBot}%`,
                    bgcolor: color,
                  }}
                />
                {/* 2. Thân nến */}
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: `${c.bottom}%`,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '80%',
                    height: `${c.bodyH}%`,
                    bgcolor: color,
                    borderRadius: '1px',
                  }}
                />
                {/* 3. Râu trên */}
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: `${c.bottom + c.bodyH}%`,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '1px',
                    height: `${c.wickTop}%`,
                    bgcolor: color,
                  }}
                />
              </Box>
            );
          })}
        </Box>

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
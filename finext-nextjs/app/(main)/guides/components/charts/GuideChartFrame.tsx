'use client';

import React from 'react';
import { alpha, Box, Skeleton, Typography, useTheme } from '@mui/material';
import { Icon } from '@iconify/react';
import { getResponsiveFontSize, fontWeight, getGlassCard } from 'theme/tokens';

// ============================================================================
// GuideChartFrame — khung bọc biểu đồ nhúng trong trang hướng dẫn:
// tiêu đề + nhãn "Dữ liệu minh hoạ" + phần biểu đồ + chú thích.
// Biểu đồ thật được truyền qua children (đã lazy-load ở component con).
// ============================================================================

interface GuideChartFrameProps {
  title: string;
  icon?: string;
  caption?: string;
  children: React.ReactNode;
}

export function GuideChartFrame({ title, icon, caption, children }: GuideChartFrameProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const primary = theme.palette.primary.main;
  return (
    <Box
      sx={{
        ...getGlassCard(isDark),
        borderRadius: 2,
        p: { xs: 1.5, md: 2 },
        my: 2,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          mb: 1.5,
          flexWrap: 'wrap',
        }}
      >
        {icon && <Icon icon={icon} width={20} height={20} style={{ color: primary }} />}
        <Typography sx={{ fontSize: getResponsiveFontSize('md'), fontWeight: fontWeight.semibold, flex: 1 }}>
          {title}
        </Typography>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            px: 1,
            py: 0.25,
            borderRadius: 5,
            bgcolor: alpha(primary, isDark ? 0.18 : 0.1),
            color: primary,
          }}
        >
          <Icon icon="mdi:flask-outline" width={13} height={13} />
          <Typography sx={{ fontSize: getResponsiveFontSize('xs'), fontWeight: fontWeight.medium }}>
            Dữ liệu minh hoạ
          </Typography>
        </Box>
      </Box>
      {children}
      {caption && (
        <Typography
          sx={{
            fontSize: getResponsiveFontSize('sm'),
            color: 'text.secondary',
            fontStyle: 'italic',
            textAlign: 'center',
            mt: 1,
          }}
        >
          {caption}
        </Typography>
      )}
    </Box>
  );
}

// Fallback trong lúc chunk biểu đồ đang tải
export function ChartLoading({ height = 300 }: { height?: number }) {
  return (
    <Box sx={{ width: '100%', height, display: 'flex', alignItems: 'flex-end', gap: 1 }}>
      {[60, 85, 45, 70, 90, 55, 75, 40, 65, 80].map((h, i) => (
        <Skeleton
          key={i}
          variant="rectangular"
          animation="wave"
          sx={{ flex: 1, height: `${h}%`, borderRadius: 1 }}
        />
      ))}
    </Box>
  );
}

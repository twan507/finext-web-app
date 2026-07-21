'use client';

import React from 'react';
import { alpha, Box, Typography, useTheme } from '@mui/material';
import { Icon } from '@iconify/react';
import { getResponsiveFontSize, fontWeight, getGlassCard } from 'theme/tokens';
import { pageTitleSx, bodyTextSx, smallTextSx } from './GuideBlocks';

// ============================================================================
// GuideHero — dải mở đầu mỗi trang: icon lớn + tiêu đề + mô tả + điểm nhấn
// Dùng pageTitleSx cho tiêu đề, nền glass có sắc tím nhẹ để bớt "tường xám"
// ============================================================================

interface HeroHighlight {
  icon: string;
  label: string;
}

interface GuideHeroProps {
  icon: string;
  title: string;
  subtitle: string;
  highlights?: HeroHighlight[];
}

export function GuideHero({ icon, title, subtitle, highlights }: GuideHeroProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const primary = theme.palette.primary.main;
  return (
    <Box
      sx={{
        ...getGlassCard(isDark),
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 2,
        p: { xs: 2.5, md: 3.5 },
        mb: 3,
        background: `linear-gradient(135deg, ${alpha(primary, isDark ? 0.16 : 0.1)} 0%, ${alpha(
          primary,
          0
        )} 60%)`,
      }}
    >
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: subtitle ? 1.25 : 0 }}>
        <Box
          sx={{
            flexShrink: 0,
            width: 52,
            height: 52,
            borderRadius: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: alpha(primary, isDark ? 0.22 : 0.12),
            color: primary,
          }}
        >
          <Icon icon={icon} width={30} height={30} />
        </Box>
        <Typography component="h1" sx={{ ...pageTitleSx, mb: 0 }}>
          {title}
        </Typography>
      </Box>
      <Typography sx={{ ...bodyTextSx, color: 'text.secondary', maxWidth: 760 }}>
        {subtitle}
      </Typography>
      {highlights && highlights.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2 }}>
          {highlights.map((h) => (
            <Box
              key={h.label}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
                px: 1.25,
                py: 0.5,
                borderRadius: 5,
                bgcolor: alpha(primary, isDark ? 0.16 : 0.09),
                color: 'text.primary',
              }}
            >
              <Icon icon={h.icon} width={16} height={16} style={{ color: primary }} />
              <Typography sx={{ ...smallTextSx, fontWeight: fontWeight.medium }}>
                {h.label}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

// ============================================================================
// SectionHeader — tiêu đề nhóm lớn (thay Typography subHeading trơn)
// ============================================================================

interface SectionHeaderProps {
  icon: string;
  title: string;
  subtitle?: string;
}

export function SectionHeader({ icon, title, subtitle }: SectionHeaderProps) {
  const theme = useTheme();
  const primary = theme.palette.primary.main;
  return (
    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', mt: 4, mb: 2 }}>
      <Box
        sx={{
          flexShrink: 0,
          mt: 0.25,
          width: 4,
          alignSelf: 'stretch',
          minHeight: 32,
          borderRadius: 2,
          bgcolor: primary,
        }}
      />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Icon icon={icon} width={22} height={22} style={{ color: primary }} />
          <Typography
            sx={{ fontSize: getResponsiveFontSize('xl'), fontWeight: fontWeight.semibold }}
          >
            {title}
          </Typography>
        </Box>
        {subtitle && (
          <Typography sx={{ ...smallTextSx, color: 'text.secondary', mt: 0.5 }}>
            {subtitle}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

// ============================================================================
// SplitRow — bố cục 2 cột (nội dung | phần minh hoạ), đảo chiều xen kẽ
// md+: hàng ngang; xs: xếp dọc (nội dung trước, minh hoạ sau)
// ============================================================================

interface SplitRowProps {
  media: React.ReactNode;
  children: React.ReactNode;
  title?: string;
  icon?: string;
  reverse?: boolean;
}

export function SplitRow({ media, children, title, icon, reverse = false }: SplitRowProps) {
  const theme = useTheme();
  const primary = theme.palette.primary.main;
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', md: reverse ? 'row-reverse' : 'row' },
        gap: { xs: 1.5, md: 3 },
        alignItems: { xs: 'stretch', md: 'center' },
        my: 2.5,
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {title && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            {icon && <Icon icon={icon} width={20} height={20} style={{ color: primary }} />}
            <Typography sx={{ ...bodyTextSx, fontWeight: fontWeight.semibold }}>{title}</Typography>
          </Box>
        )}
        <Box sx={bodyTextSx}>{children}</Box>
      </Box>
      <Box sx={{ flex: 1, minWidth: 0, width: { xs: '100%', md: 'auto' } }}>{media}</Box>
    </Box>
  );
}

// ============================================================================
// FeatureGrid — lưới thẻ tính năng nhỏ (icon màu + tiêu đề + mô tả)
// ============================================================================

interface FeatureGridProps {
  children: React.ReactNode;
  columns?: number;
}

export function FeatureGrid({ children, columns = 2 }: FeatureGridProps) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: `repeat(${columns}, 1fr)` },
        gap: 1.5,
        my: 2,
      }}
    >
      {children}
    </Box>
  );
}

interface FeatureGridItemProps {
  icon: string;
  title: string;
  children: React.ReactNode;
  color?: string;
}

export function FeatureGridItem({ icon, title, children, color }: FeatureGridItemProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const accent = color ?? theme.palette.primary.main;
  return (
    <Box
      sx={{
        ...getGlassCard(isDark),
        borderRadius: 1.5,
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        height: '100%',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box
          sx={{
            flexShrink: 0,
            width: 34,
            height: 34,
            borderRadius: 1.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: alpha(accent, isDark ? 0.2 : 0.12),
            color: accent,
          }}
        >
          <Icon icon={icon} width={20} height={20} />
        </Box>
        <Typography sx={{ ...bodyTextSx, fontWeight: fontWeight.semibold }}>{title}</Typography>
      </Box>
      <Typography component="div" sx={smallTextSx}>
        {children}
      </Typography>
    </Box>
  );
}

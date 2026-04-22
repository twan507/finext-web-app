'use client';

import React from 'react';
import Image from 'next/image';
import { Box, Typography, useTheme } from '@mui/material';
import { Icon } from '@iconify/react';
import { getResponsiveFontSize, fontWeight, getGlassCard } from 'theme/tokens';

// ============================================================================
// SHARED STYLES — Dùng chung cho PageContent của 3 trang guide
// ============================================================================

export const bodyTextSx = { fontSize: getResponsiveFontSize('md') } as const;
export const smallTextSx = { fontSize: getResponsiveFontSize('sm') } as const;
export const subHeadingSx = {
  fontSize: getResponsiveFontSize('md'),
  fontWeight: fontWeight.semibold,
  mt: 3,
  mb: 1.5,
} as const;
export const pageTitleSx = {
  fontSize: getResponsiveFontSize('xxl'),
  fontWeight: fontWeight.semibold,
  mb: 3,
} as const;
const captionSx = {
  fontSize: getResponsiveFontSize('sm'),
  color: 'text.secondary',
  fontStyle: 'italic',
  textAlign: 'center' as const,
  mt: 0.75,
};

// ============================================================================
// Figure — ảnh có thẻ collapse (mặc định đóng), bấm vào trigger để mở
// Trigger dùng alt text để user biết ảnh gì, chevron quay khi toggle
// ============================================================================

interface FigureProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  caption?: string;
  sx?: object;
}

export function Figure({ src, alt, width = 1600, height = 100, caption, sx }: FigureProps) {
  return (
    <Box sx={{ my: 1, ...sx }}>
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        style={{ width: '100%', height: 'auto', borderRadius: 8, display: 'block' }}
      />
      {caption && <Typography sx={captionSx}>{caption}</Typography>}
    </Box>
  );
}

// ============================================================================
// InfoBox — card kiểu "info" dùng để bọc đoạn mô tả trong sub-accordion
// (hiện trước Figure để user đọc nội dung trước khi xem ảnh)
// ============================================================================

interface InfoBoxProps {
  children: React.ReactNode;
}

export function InfoBox({ children }: InfoBoxProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  return (
    <Box
      sx={{
        ...getGlassCard(isDark),
        borderRadius: 1.5,
        p: 2,
        mt: 1,
        mb: 2,
        display: 'flex',
        gap: 1.25,
        alignItems: 'flex-start',
      }}
    >
      <Icon
        icon="mdi:information-outline"
        width={20}
        height={20}
        style={{ color: theme.palette.primary.main, flexShrink: 0, marginTop: 2 }}
      />
      <Typography component="div" sx={{ ...bodyTextSx, flex: 1 }}>
        {children}
      </Typography>
    </Box>
  );
}

// ============================================================================
// Step — bước có số + ảnh + text, dùng trong walkthrough
// ============================================================================

interface StepProps {
  num: number;
  title: string;
  children: React.ReactNode;
}

export function Step({ num, title, children }: StepProps) {
  const theme = useTheme();
  return (
    <Box sx={{ display: 'flex', gap: 2, my: 2.5 }}>
      <Box
        sx={{
          flexShrink: 0,
          width: 32,
          height: 32,
          borderRadius: '50%',
          bgcolor: theme.palette.primary.main,
          color: theme.palette.primary.contrastText,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: fontWeight.semibold,
          fontSize: getResponsiveFontSize('md').lg,
          mt: 0.5,
        }}
      >
        {num}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ ...bodyTextSx, fontWeight: fontWeight.semibold, mb: 1 }}>
          {title}
        </Typography>
        <Box sx={bodyTextSx}>{children}</Box>
      </Box>
    </Box>
  );
}

// ============================================================================
// FeatureCard — card stacked vertically với ảnh + title + text
// Dùng trong Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
// ============================================================================

interface FeatureCardProps {
  title: string;
  icon?: string;
  image?: React.ReactNode;
  children: React.ReactNode;
}

export function FeatureCard({ title, icon, image, children }: FeatureCardProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  return (
    <Box
      sx={{
        ...getGlassCard(isDark),
        borderRadius: 1.5,
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {icon && (
          <Icon icon={icon} width={20} height={20} style={{ color: theme.palette.primary.main }} />
        )}
        <Typography sx={{ ...bodyTextSx, fontWeight: fontWeight.semibold }}>
          {title}
        </Typography>
      </Box>
      <Typography component="div" sx={smallTextSx}>
        {children}
      </Typography>
      {image && <Box sx={{ mt: 0.5 }}>{image}</Box>}
    </Box>
  );
}

// ============================================================================
// Callout — highlight box với icon + title + text + optional image
// ============================================================================

interface CalloutProps {
  icon: string;
  title: string;
  children: React.ReactNode;
  image?: React.ReactNode;
}

export function Callout({ icon, title, children, image }: CalloutProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  return (
    <Box
      sx={{
        ...getGlassCard(isDark),
        borderRadius: 1.5,
        p: 2,
        my: 2,
        borderLeft: `3px solid ${theme.palette.primary.main}`,
      }}
    >
      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
        <Icon
          icon={icon}
          width={22}
          height={22}
          style={{ color: theme.palette.primary.main, flexShrink: 0, marginTop: 2 }}
        />
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ ...bodyTextSx, fontWeight: fontWeight.semibold, mb: 0.75 }}>
            {title}
          </Typography>
          <Typography component="div" sx={bodyTextSx}>
            {children}
          </Typography>
        </Box>
      </Box>
      {image && <Box sx={{ mt: 1.5 }}>{image}</Box>}
    </Box>
  );
}

// ============================================================================
// TimelineItem — dùng trong timeline vertical (số + line nối + nội dung)
// ============================================================================

interface TimelineItemProps {
  label: string;
  title: string;
  children: React.ReactNode;
  image?: React.ReactNode;
}

export function TimelineItem({ label, title, children, image }: TimelineItemProps) {
  const theme = useTheme();
  return (
    <Box sx={{ display: 'flex', gap: 2, position: 'relative' }}>
      {/* Left column: badge + vertical line */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <Box
          sx={{
            px: 1.5,
            py: 0.5,
            borderRadius: 1,
            bgcolor: theme.palette.primary.main,
            color: theme.palette.primary.contrastText,
            fontSize: getResponsiveFontSize('xs').lg,
            fontWeight: fontWeight.semibold,
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </Box>
        <Box
          sx={{
            flex: 1,
            width: 2,
            bgcolor: theme.palette.divider,
            my: 1,
            minHeight: 40,
          }}
        />
      </Box>
      {/* Right column: content */}
      <Box sx={{ flex: 1, minWidth: 0, pb: 3 }}>
        <Typography sx={{ ...bodyTextSx, fontWeight: fontWeight.semibold, mb: 1 }}>
          {title}
        </Typography>
        <Typography component="div" sx={bodyTextSx}>
          {children}
        </Typography>
        {image && <Box sx={{ mt: 1.5 }}>{image}</Box>}
      </Box>
    </Box>
  );
}

// ============================================================================
// SectionBlock — section với background tuỳ chọn (plain / glass)
// ============================================================================

interface SectionBlockProps {
  variant?: 'plain' | 'glass';
  title?: string;
  children: React.ReactNode;
}

export function SectionBlock({ variant = 'plain', title, children }: SectionBlockProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  return (
    <Box
      sx={{
        ...(variant === 'glass' ? getGlassCard(isDark) : {}),
        borderRadius: variant === 'glass' ? 1.5 : 0,
        p: variant === 'glass' ? { xs: 2, md: 3 } : 0,
        my: 2,
      }}
    >
      {title && (
        <Typography
          sx={{
            ...subHeadingSx,
            mt: 0,
          }}
        >
          {title}
        </Typography>
      )}
      {children}
    </Box>
  );
}

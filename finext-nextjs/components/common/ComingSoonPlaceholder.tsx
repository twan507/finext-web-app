'use client';

import { Box, Typography, useTheme } from '@mui/material';
import { Icon } from '@iconify/react';
import { getResponsiveFontSize, fontWeight, spacing } from 'theme/tokens';

interface ComingSoonPlaceholderProps {
  title: string;
  description: string;
  icon?: string;
}

export default function ComingSoonPlaceholder({
  title,
  description,
  icon = 'mdi:rocket-launch-outline',
}: ComingSoonPlaceholderProps) {
  const theme = useTheme();

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        textAlign: 'center',
        px: 3,
      }}
    >
      <Icon
        icon={icon}
        width={64}
        height={64}
        color={theme.palette.primary.main}
        style={{ marginBottom: spacing.md }}
      />
      <Typography
        sx={{
          fontSize: getResponsiveFontSize('h2'),
          fontWeight: fontWeight.bold,
          color: theme.palette.text.primary,
          mb: 1.5,
        }}
      >
        {title}
      </Typography>
      <Typography
        sx={{
          fontSize: getResponsiveFontSize('lg'),
          color: theme.palette.text.secondary,
          mb: 2,
        }}
      >
        {description}
      </Typography>
      <Typography
        sx={{
          fontSize: getResponsiveFontSize('md'),
          color: theme.palette.text.disabled,
        }}
      >
        Tính năng đang được phát triển. Vui lòng quay lại sau.
      </Typography>
    </Box>
  );
}

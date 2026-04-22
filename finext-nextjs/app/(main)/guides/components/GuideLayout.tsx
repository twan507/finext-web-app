'use client';

import React from 'react';
import { Box } from '@mui/material';

interface GuideLayoutProps {
  children: React.ReactNode;
}

export default function GuideLayout({ children }: GuideLayoutProps) {
  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: 1200,
        mx: 'auto',
        px: { xs: 1.5, md: 2, lg: 3 },
        py: { xs: 2, md: 3 },
      }}
    >
      {children}
    </Box>
  );
}

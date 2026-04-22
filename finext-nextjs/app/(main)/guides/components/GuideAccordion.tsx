'use client';

import React from 'react';
import { Accordion, AccordionSummary, AccordionDetails, Box, Typography, useTheme } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Icon } from '@iconify/react';
import { fontWeight, getResponsiveFontSize, getGlassCard } from 'theme/tokens';

interface GuideAccordionProps {
  title: string;
  icon?: string;
  defaultExpanded?: boolean;
  children: React.ReactNode;
}

export default function GuideAccordion({ title, icon, defaultExpanded = false, children }: GuideAccordionProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const glass = getGlassCard(isDark);

  return (
    <Accordion
      defaultExpanded={defaultExpanded}
      disableGutters
      square={false}
      sx={{
        ...glass,
        borderRadius: 1.5,
        '&:before': { display: 'none' },
        mb: 1,
        '&.Mui-expanded': {
          mb: 1,
        },
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon fontSize="small" />}
        sx={{
          px: 2,
          minHeight: 44,
          '&.Mui-expanded': { minHeight: 44 },
          '& .MuiAccordionSummary-content': {
            display: 'flex',
            alignItems: 'center',
            gap: 1.25,
            my: 0.5,
            '&.Mui-expanded': { my: 0.5 },
          },
        }}
      >
        {icon && (
          <Box sx={{ display: 'flex', alignItems: 'center', color: theme.palette.primary.main }}>
            <Icon icon={icon} width={18} height={18} />
          </Box>
        )}
        <Typography
          sx={{
            fontSize: getResponsiveFontSize('md'),
            fontWeight: fontWeight.semibold,
            color: theme.palette.text.primary,
          }}
        >
          {title}
        </Typography>
      </AccordionSummary>
      <AccordionDetails
        sx={{
          px: 2,
          py: 1.5,
          borderTop: `1px solid ${theme.palette.divider}`,
        }}
      >
        {children}
      </AccordionDetails>
    </Accordion>
  );
}

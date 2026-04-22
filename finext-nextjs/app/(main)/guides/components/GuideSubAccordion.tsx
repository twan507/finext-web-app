'use client';

import React from 'react';
import { Accordion, AccordionSummary, AccordionDetails, Box, Typography, useTheme } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Icon } from '@iconify/react';
import { fontWeight, getResponsiveFontSize } from 'theme/tokens';

interface GuideSubAccordionProps {
  title: string;
  icon?: string;
  defaultExpanded?: boolean;
  children: React.ReactNode;
}

/**
 * Nested toggle bar: cùng style với GuideAccordion nhưng nhỏ hơn 1 cấp,
 * dùng cho các sub-section bên trong 1 GuideAccordion.
 */
export default function GuideSubAccordion({ title, icon, defaultExpanded = false, children }: GuideSubAccordionProps) {
  const theme = useTheme();

  return (
    <Accordion
      defaultExpanded={defaultExpanded}
      disableGutters
      square
      sx={{
        background: 'transparent',
        boxShadow: 'none',
        borderBottom: `1px dashed ${theme.palette.divider}`,
        '&:before': { display: 'none' },
        '&:first-of-type': {
          borderTop: `1px dashed ${theme.palette.divider}`,
        },
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon sx={{ fontSize: 20 }} />}
        sx={{
          px: 0,
          minHeight: 44,
          '&.Mui-expanded': { minHeight: 44 },
          '& .MuiAccordionSummary-content': {
            display: 'flex',
            alignItems: 'center',
            gap: 1.25,
            my: 1,
            '&.Mui-expanded': { my: 1 },
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
            fontWeight: fontWeight.medium,
            color: theme.palette.text.primary,
          }}
        >
          {title}
        </Typography>
      </AccordionSummary>
      <AccordionDetails
        sx={{
          px: 0,
          pt: 0.5,
          pb: 0.75,
          pl: { xs: 0, md: 2.5 },
          borderLeft: { xs: 'none', md: `2px dashed ${theme.palette.divider}` },
          ml: { xs: 0, md: 0.5 },
        }}
      >
        {children}
      </AccordionDetails>
    </Accordion>
  );
}

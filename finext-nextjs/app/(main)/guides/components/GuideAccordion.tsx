'use client';

import React from 'react';
import { Accordion, AccordionSummary, AccordionDetails, Box, Typography, useTheme } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Icon } from '@iconify/react';
import { fontWeight, getResponsiveFontSize } from 'theme/tokens';

interface GuideAccordionProps {
  title: string;
  icon?: string;
  defaultExpanded?: boolean;
  children: React.ReactNode;
}

/**
 * Collapsible section với style tối giản (không card wrap):
 * - Header chỉ là 1 hàng: icon + title + chevron, không background
 * - Hover: subtle bg change
 * - Border top/bottom tạo divider giữa các accordion
 * - Expanded: content indent nhẹ, có thanh màu primary bên trái tạo visual grouping
 */
export default function GuideAccordion({ title, icon, defaultExpanded = false, children }: GuideAccordionProps) {
  const theme = useTheme();

  return (
    <Accordion
      defaultExpanded={defaultExpanded}
      disableGutters
      square
      sx={{
        background: 'transparent',
        boxShadow: 'none',
        borderBottom: `1px solid ${theme.palette.divider}`,
        '&:before': { display: 'none' },
        '&:first-of-type': {
          borderTop: `1px solid ${theme.palette.divider}`,
        },
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        sx={{
          px: 0,
          minHeight: 56,
          '&.Mui-expanded': { minHeight: 56 },
          '& .MuiAccordionSummary-content': {
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            my: 1.5,
            '&.Mui-expanded': { my: 1.5 },
          },
        }}
      >
        {icon && (
          <Box sx={{ display: 'flex', alignItems: 'center', color: theme.palette.primary.main }}>
            <Icon icon={icon} width={20} height={20} />
          </Box>
        )}
        <Typography
          sx={{
            fontSize: getResponsiveFontSize('lg'),
            fontWeight: fontWeight.semibold,
            color: theme.palette.text.primary,
          }}
        >
          {title}
        </Typography>
      </AccordionSummary>
      <AccordionDetails
        sx={{
          px: 0,
          pt: 0,
          pb: 3,
          mb: 1.5,
          pl: { xs: 0, md: 3.5 },
          borderLeft: { xs: 'none', md: `2px solid ${theme.palette.primary.main}` },
          ml: { xs: 0, md: 1 },
        }}
      >
        {children}
      </AccordionDetails>
    </Accordion>
  );
}

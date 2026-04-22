'use client';

import Link from 'next/link';
import { Breadcrumbs, Typography } from '@mui/material';
import MuiLink from '@mui/material/Link';

import { getResponsiveFontSize, fontWeight } from 'theme/tokens';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface GuideBreadcrumbProps {
  items: BreadcrumbItem[];
}

const SECTION_LABEL = 'Hướng dẫn sử dụng';
const SECTION_HREF = '/guides/overview';

export default function GuideBreadcrumb({ items }: GuideBreadcrumbProps) {
  return (
    <Breadcrumbs separator="/" sx={{ mb: 3 }}>
      <MuiLink
        component={Link}
        href="/"
        underline="hover"
        color="text.secondary"
        sx={{
          fontSize: getResponsiveFontSize('sm'),
          '&:hover': { color: 'primary.main' },
        }}
      >
        Trang chủ
      </MuiLink>

      {items.length > 0 ? (
        <MuiLink
          component={Link}
          href={SECTION_HREF}
          underline="hover"
          color="text.secondary"
          sx={{
            fontSize: getResponsiveFontSize('sm'),
            '&:hover': { color: 'primary.main' },
          }}
        >
          {SECTION_LABEL}
        </MuiLink>
      ) : (
        <Typography
          color="text.primary"
          sx={{
            fontSize: getResponsiveFontSize('sm'),
            fontWeight: fontWeight.medium,
          }}
        >
          {SECTION_LABEL}
        </Typography>
      )}

      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        if (isLast || !item.href) {
          return (
            <Typography
              key={index}
              color="text.primary"
              sx={{
                fontSize: getResponsiveFontSize('sm'),
                fontWeight: fontWeight.medium,
                maxWidth: 240,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {item.label}
            </Typography>
          );
        }
        return (
          <MuiLink
            key={index}
            component={Link}
            href={item.href}
            underline="hover"
            color="text.secondary"
            sx={{
              fontSize: getResponsiveFontSize('sm'),
              '&:hover': { color: 'primary.main' },
            }}
          >
            {item.label}
          </MuiLink>
        );
      })}
    </Breadcrumbs>
  );
}

'use client';

import React from 'react';
import Link from 'next/link';
import { Box, Typography, Grid, useTheme, alpha } from '@mui/material';
import BrandLogo from './BrandLogo';
import { getResponsiveFontSize, spacing, borderRadius, transitions, fontWeight } from 'theme/tokens';

// Footer navigation structure - only 4 sections
const footerLinks = {
  sanPham: {
    title: 'Sản phẩm',
    links: [
      { label: 'Báo cáo tin tức thị trường', href: '#' },
      { label: 'Phân tích nhóm ngành', href: '#' },
      { label: 'Bộ lọc cổ phiếu', href: '#' },
    ],
  },
  hoTro: {
    title: 'Finext Learning',
    links: [
      { label: 'Khóa học phân tích kỹ thuật', href: '#' },
      { label: 'Khóa học phân tích cơ bản', href: '#' },
      { label: 'Chiến lược định vị dòng tiền', href: '#' },
    ],
  },
  huongDan: {
    title: 'Hướng dẫn',
    links: [
      { label: 'Hướng dẫn sử dụng nền tảng', href: '#' },
      { label: 'Kiến thức đầu tư chứng khoán', href: '#' },
      { label: 'Video hướng dẫn chi tiết', href: '#' },
    ],
  },
  mangXaHoi: {
    title: 'Liên hệ & Hỗ trợ',
    links: [
      { label: 'Gửi yêu cầu qua Email', href: '#' },
      { label: 'Trò chuyện trực tiếp', href: '#' },
      { label: 'Đặt lịch tư vấn cá nhân', href: '#' },
    ],
  },
};

interface FooterLinkColumnProps {
  title: string;
  links: { label: string; href: string; external?: boolean }[];
}

const FooterLinkColumn: React.FC<FooterLinkColumnProps> = ({ title, links }) => {
  const theme = useTheme();

  return (
    <Box>
      <Typography
        sx={{
          fontSize: getResponsiveFontSize('lg'),
          fontWeight: fontWeight.semibold,
          color: theme.palette.text.primary,
          mb: spacing.sm / 8, // Convert to theme spacing units
        }}
      >
        {title}
      </Typography>
      <Box
        component="ul"
        sx={{
          listStyle: 'none',
          p: 0,
          m: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 0.5,
        }}
      >
        {links.map((link, index) => (
          <Box component="li" key={`${title}-${index}`}>
            <Link
              href={link.href}
              target={link.external ? '_blank' : undefined}
              rel={link.external ? 'noopener noreferrer' : undefined}
              style={{ textDecoration: 'none' }}
            >
              <Typography
                sx={{
                  fontSize: getResponsiveFontSize('md'),
                  color: theme.palette.text.secondary,
                  transition: transitions.colors,
                  py: 0.5,
                  '&:hover': {
                    color: theme.palette.primary.main,
                  },
                }}
              >
                {link.label}
              </Typography>
            </Link>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

const Footer: React.FC = () => {
  const theme = useTheme();
  const currentYear = new Date().getFullYear();

  return (
    <Box
      component="footer"
      sx={{
        bgcolor: theme.palette.mode === 'dark'
          ? '#050505' // Slightly distinct from default #0a0a0a
          : '#f8f9fa', // Slightly distinct from default #fafbfc
        mt: 'auto',
      }}
    >
      {/* Main Footer Content - aligned with main content */}
      <Box
        sx={{
          width: '100%',
          maxWidth: 1400,
          mx: 'auto',
          px: { xs: 1.5, md: 2, lg: 3 }, // Same padding as main content
          py: { xs: spacing.lg / 8, md: spacing.xl / 8, lg: spacing.xxl / 8 },
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: { xs: 'center', md: 'stretch' },
            gap: { xs: 4, md: 6 },
          }}
        >
          {/* Desktop/Tablet: Row layout */}
          <Box
            sx={{
              display: { xs: 'none', md: 'flex' },
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              width: '100%',
            }}
          >
            {/* Brand Section - 50% width */}
            <Box sx={{ flex: { md: '0 0 40%', lg: '0 0 50%' } }}>
              <Box sx={{ mb: spacing.md / 8 }}>
                <BrandLogo
                  href="/"
                  showText={true}
                  imageSize={45}
                  textSize={getResponsiveFontSize('h1')}
                  gap={12}
                  useColorOverlay={false}
                />
              </Box>
              <Typography
                sx={{
                  fontSize: getResponsiveFontSize('xl'),
                  color: theme.palette.primary.main,
                  fontWeight: fontWeight.semibold,
                }}
              >
                Your{' '}
                <span
                  style={{
                    color: theme.palette.primary.main,
                    textDecoration: 'underline',
                    textDecorationThickness: '2px',
                    textUnderlineOffset: '4px',
                  }}
                >
                  Next
                </span>
                {' '}Financial Step
              </Typography>
            </Box>

            {/* Links Sections - 50% width */}
            <Box
              sx={{
                flex: { md: '0 0 60%', lg: '0 0 50%' },
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                columnGap: { md: 4, lg: 6 },
                rowGap: 4,
              }}
            >
              <FooterLinkColumn {...footerLinks.sanPham} />
              <FooterLinkColumn {...footerLinks.hoTro} />
              <FooterLinkColumn {...footerLinks.huongDan} />
              <FooterLinkColumn {...footerLinks.mangXaHoi} />
            </Box>
          </Box>

          {/* Mobile: Centered layout */}
          <Box
            sx={{
              display: { xs: 'flex', md: 'none' },
              flexDirection: 'column',
              alignItems: 'center',
              width: '100%',
              gap: 4,
            }}
          >
            {/* Brand Section - Centered */}
            <Box sx={{ textAlign: 'center' }}>
              <Box sx={{
                mb: spacing.md / 8,
                display: 'flex',
                justifyContent: 'center',
              }}>
                <BrandLogo
                  href="/"
                  showText={true}
                  imageSize={45}
                  textSize={getResponsiveFontSize('h1')}
                  gap={12}
                  useColorOverlay={false}
                />
              </Box>
              <Typography
                sx={{
                  fontSize: getResponsiveFontSize('xl'),
                  color: theme.palette.primary.main,
                  fontWeight: fontWeight.semibold,
                }}
              >
                Your{' '}
                <span
                  style={{
                    color: theme.palette.primary.main,
                    textDecoration: 'underline',
                    textDecorationThickness: '2px',
                    textUnderlineOffset: '4px',
                  }}
                >
                  Next
                </span>
                {' '}Financial Step
              </Typography>
            </Box>

            {/* Links Sections - 2 columns centered */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                columnGap: 3,
                rowGap: 4,
                width: '100%',
                maxWidth: 400,
                textAlign: 'center',
              }}
            >
              <FooterLinkColumn {...footerLinks.sanPham} />
              <FooterLinkColumn {...footerLinks.huongDan} />
              <FooterLinkColumn {...footerLinks.hoTro} />
              <FooterLinkColumn {...footerLinks.mangXaHoi} />
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Bottom Bar - Copyright */}
      <Box
        sx={{
          borderTop: `1px solid ${theme.palette.divider}`,
          bgcolor: theme.palette.mode === 'dark'
            ? alpha(theme.palette.background.paper, 0.3)
            : alpha(theme.palette.background.paper, 0.5),
        }}
      >
        <Box
          sx={{
            width: '100%',
            maxWidth: 1400,
            mx: 'auto',
            px: { xs: 1.5, md: 2, lg: 3 }, // Same padding as main content
            py: spacing.md / 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Typography
            sx={{
              fontSize: getResponsiveFontSize('md'),
              color: theme.palette.text.secondary,
            }}
          >
            © {currentYear} Finext. All rights reserved.
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default Footer;

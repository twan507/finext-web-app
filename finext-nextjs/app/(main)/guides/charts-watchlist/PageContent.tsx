'use client';

import { Box, Typography } from '@mui/material';
import GuideAccordion from '../components/GuideAccordion';
import GuideBreadcrumb from '../components/GuideBreadcrumb';
import { getResponsiveFontSize, fontWeight, spacing } from 'theme/tokens';

export default function ChartsWatchlistContent() {
  return (
    <Box sx={{ py: spacing.xs }}>
      <GuideBreadcrumb items={[{ label: 'Biểu đồ & Watchlist' }]} />

      <Typography
        sx={{
          fontSize: getResponsiveFontSize('xxl'),
          fontWeight: fontWeight.semibold,
          mb: 3,
        }}
      >
        Hướng dẫn biểu đồ & Watchlist
      </Typography>

      <Typography
        sx={{
          fontSize: getResponsiveFontSize('lg'),
          fontWeight: fontWeight.semibold,
          mt: 1,
          mb: 1.5,
        }}
      >
        Biểu đồ
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        <GuideAccordion title="Giới thiệu biểu đồ" icon="mdi:chart-timeline-variant">
          <Typography color="text.secondary" sx={{ fontSize: getResponsiveFontSize('sm') }}>
            Nội dung đang cập nhật...
          </Typography>
        </GuideAccordion>

        <GuideAccordion title="Thanh công cụ" icon="mdi:tools">
          <Typography color="text.secondary" sx={{ fontSize: getResponsiveFontSize('sm') }}>
            Nội dung đang cập nhật...
          </Typography>
        </GuideAccordion>

        <GuideAccordion title="Bảng chỉ báo" icon="mdi:chart-bell-curve">
          <Typography color="text.secondary" sx={{ fontSize: getResponsiveFontSize('sm') }}>
            Nội dung đang cập nhật...
          </Typography>
        </GuideAccordion>

        <GuideAccordion title="Bảng tin tức" icon="mdi:newspaper">
          <Typography color="text.secondary" sx={{ fontSize: getResponsiveFontSize('sm') }}>
            Nội dung đang cập nhật...
          </Typography>
        </GuideAccordion>
      </Box>

      <Typography
        sx={{
          fontSize: getResponsiveFontSize('lg'),
          fontWeight: fontWeight.semibold,
          mt: 3,
          mb: 1.5,
        }}
      >
        Watchlist
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        <GuideAccordion title="Thêm danh sách mới" icon="mdi:playlist-plus">
          <Typography color="text.secondary" sx={{ fontSize: getResponsiveFontSize('sm') }}>
            Nội dung đang cập nhật...
          </Typography>
        </GuideAccordion>

        <GuideAccordion title="Xóa và chỉnh sửa danh sách" icon="mdi:playlist-edit">
          <Typography color="text.secondary" sx={{ fontSize: getResponsiveFontSize('sm') }}>
            Nội dung đang cập nhật...
          </Typography>
        </GuideAccordion>

        <GuideAccordion title="Kéo thả sắp xếp" icon="mdi:drag-variant">
          <Typography color="text.secondary" sx={{ fontSize: getResponsiveFontSize('sm') }}>
            Nội dung đang cập nhật...
          </Typography>
        </GuideAccordion>

        <GuideAccordion title="Dialog xác nhận" icon="mdi:alert-circle-outline">
          <Typography color="text.secondary" sx={{ fontSize: getResponsiveFontSize('sm') }}>
            Nội dung đang cập nhật...
          </Typography>
        </GuideAccordion>
      </Box>
    </Box>
  );
}

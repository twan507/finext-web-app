'use client';

import { Box, Typography } from '@mui/material';
import GuideAccordion from '../components/GuideAccordion';
import GuideBreadcrumb from '../components/GuideBreadcrumb';
import { getResponsiveFontSize, fontWeight, spacing } from 'theme/tokens';

export default function StockScreenerContent() {
  return (
    <Box sx={{ py: spacing.xs }}>
      <GuideBreadcrumb items={[{ label: 'Bộ lọc cổ phiếu' }]} />

      <Typography
        sx={{
          fontSize: getResponsiveFontSize('xxl'),
          fontWeight: fontWeight.semibold,
          mb: 3,
        }}
      >
        Hướng dẫn bộ lọc cổ phiếu
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        <GuideAccordion title="Giới thiệu bộ lọc" icon="mdi:information-outline">
          <Typography color="text.secondary" sx={{ fontSize: getResponsiveFontSize('sm') }}>
            Nội dung đang cập nhật...
          </Typography>
        </GuideAccordion>

        <GuideAccordion title="Bộ lọc nhanh" icon="mdi:filter-outline">
          <Typography color="text.secondary" sx={{ fontSize: getResponsiveFontSize('sm') }}>
            Nội dung đang cập nhật...
          </Typography>
        </GuideAccordion>

        <GuideAccordion title="Bộ lọc nâng cao" icon="mdi:filter-cog-outline">
          <Typography color="text.secondary" sx={{ fontSize: getResponsiveFontSize('sm') }}>
            Nội dung đang cập nhật...
          </Typography>
        </GuideAccordion>

        <GuideAccordion title="Tùy chỉnh cột hiển thị" icon="mdi:table-column">
          <Typography color="text.secondary" sx={{ fontSize: getResponsiveFontSize('sm') }}>
            Nội dung đang cập nhật...
          </Typography>
        </GuideAccordion>

        <GuideAccordion title="Đổi view bảng kết quả" icon="mdi:view-dashboard-outline">
          <Typography color="text.secondary" sx={{ fontSize: getResponsiveFontSize('sm') }}>
            Nội dung đang cập nhật...
          </Typography>
        </GuideAccordion>

        <GuideAccordion title="Đọc bảng kết quả" icon="mdi:table">
          <Typography color="text.secondary" sx={{ fontSize: getResponsiveFontSize('sm') }}>
            Nội dung đang cập nhật...
          </Typography>
        </GuideAccordion>

        <GuideAccordion title="Mở trang phân tích cổ phiếu" icon="mdi:arrow-right-circle-outline">
          <Typography color="text.secondary" sx={{ fontSize: getResponsiveFontSize('sm') }}>
            Nội dung đang cập nhật...
          </Typography>
        </GuideAccordion>
      </Box>
    </Box>
  );
}

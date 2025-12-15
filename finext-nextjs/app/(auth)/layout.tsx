"use client";

import React from "react";
import { Box } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import Gallery, { Slide } from "./components/Gallery";
import ThemeToggleButton from "components/ThemeToggleButton";
import { layoutTokens } from "theme/tokens";

interface AuthLayoutProps {
  children: React.ReactNode;
}

const gallerySlides: Slide[] = [
  {
    overline: 'THẤU HIỂU DỮ LIỆU · CHINH PHỤC THỊ TRƯỜNG',
    headline: 'Insight đầu tư theo ngành',
    description:
      'Thông qua hệ thống các chỉ báo chuyên sâu, Findicator mang đến góc nhìn của những chuyên gia đầu ngành, giúp nhà đầu tư có thể tìm kiếm các cơ hội và ý tưởng đầu tư chất lượng.',
  },
  {
    overline: 'PHÂN TÍCH CHUYÊN SÂU · QUYẾT ĐỊNH ĐỘT PHÁ',
    headline: 'Báo cáo thị trường độc quyền',
    description:
      'Nhận các báo cáo phân tích chuyên sâu về từng ngành, xu hướng thị trường, và các yếu tố vĩ mô ảnh hưởng đến danh mục đầu tư của bạn. Luôn đi trước một bước với thông tin chi tiết.',
  },
  {
    overline: 'CÔNG CỤ HỖ TRỢ · TỐI ƯU HÓA LỢI NHUẬN',
    headline: 'Danh mục đầu tư thông minh',
    description:
      'Sử dụng các công cụ mạnh mẽ để xây dựng và quản lý danh mục đầu tư cá nhân hóa. Tối ưu hóa lợi nhuận và giảm thiểu rủi ro với các khuyến nghị được hỗ trợ bởi AI.',
  },
];

export default function AuthLayout({ children }: AuthLayoutProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  const centerX = "42%";
  const centerY = "52%";

  const layers = isDark
    ? {
      base: "linear-gradient(180deg, #0B0718 0%, #120A28 40%, #160D33 100%)",
      before: `radial-gradient(circle at ${centerX} ${centerY}, rgba(178,130,255,0.70) 0%, rgba(158,110,255,0.46) 12%, rgba(118,80,230,0.28) 22%, rgba(82,50,190,0.16) 30%, rgba(52,30,130,0.10) 38%, rgba(32,20,90,0.06) 44%, rgba(22,14,60,0.03) 50%, rgba(14,9,36,0.00) 58%)`,
      after: `radial-gradient(circle at ${centerX} ${centerY}, rgba(0,0,0,0) 45%, rgba(8,5,16,0.30) 70%, rgba(6,4,12,0.55) 100%), radial-gradient(circle at ${centerX} ${centerY}, rgba(110,70,220,0.10) 0%, rgba(110,70,220,0.00) 60%)`,
      blurPx: 36,
    }
    : {
      base: "linear-gradient(180deg, #ECE9FF 0%, #E5E0FF 40%, #DCD6FF 100%)",
      before: `radial-gradient(circle at ${centerX} ${centerY}, rgba(150, 90, 245, 0.55) 0%, rgba(130, 75, 230, 0.34) 14%, rgba(110, 65, 210, 0.22) 24%, rgba(90, 55, 185, 0.14) 34%, rgba(70, 45, 160, 0.10) 42%, rgba(60, 40, 140, 0.06) 50%, rgba(50, 35, 120, 0.04) 58%, rgba(50, 35, 120, 0.00) 66%)`,
      after: `radial-gradient(circle at ${centerX} ${centerY}, rgba(0,0,0,0) 55%, rgba(0,0,0,0.10) 85%, rgba(0,0,0,0.16) 100%), radial-gradient(circle at ${centerX} ${centerY}, rgba(100,60,200,0.10) 0%, rgba(100,60,200,0.00) 60%)`,
      blurPx: 28,
    };

  const defaultChartComponent = (
    <Box
      sx={{
        position: 'relative',
        width: { md: '100%' },
        height: { md: layoutTokens.authGalleryHeight },
        borderRadius: 2,
        background: 'linear-gradient(180deg, rgba(10,8,20,0.86) 0%, rgba(12,10,28,0.92) 100%)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.45)',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle at 20% 60%, rgba(140,90,255,0.18), transparent 40%), radial-gradient(circle at 70% 30%, rgba(80,140,255,0.16), transparent 45%)',
        }}
      />
    </Box>
  );

  return (
    <Box
      sx={{
        minHeight: "100vh",
        width: "100%",
        position: "relative",
        overflow: "hidden",
        background: layers.base,
        "&::before": {
          content: '""',
          position: "absolute",
          inset: "-15%",
          pointerEvents: "none",
          background: layers.before,
          filter: `blur(${layers.blurPx}px)`,
          zIndex: 1,
        },
        "&::after": {
          content: '""',
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background: layers.after,
          zIndex: 1,
        },
      }}
    >
      {/* Theme Toggle Button */}
      <Box sx={{ position: 'fixed', top: 16, right: 16, zIndex: 1000 }}>
        <ThemeToggleButton />
      </Box>

      <Box
        sx={{
          position: "relative",
          zIndex: 2,
          minHeight: "100vh",
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0,1fr) 420px' },
          alignItems: 'center',
          width: 'min(1400px, 100%)',
          mx: 'auto',
          px: { xs: 2.5, lg: 6 },
          columnGap: { lg: 6 },
        }}
      >
        <Box sx={{ display: { xs: 'none', lg: 'block' } }}>
          <Gallery
            slides={gallerySlides}
            chartComponent={defaultChartComponent}
          />
        </Box>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            py: { xs: 6, lg: 0 },
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
}
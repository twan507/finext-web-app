"use client";

import React from "react";
import { Box, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { Icon } from '@iconify/react';
import Gallery, { Slide } from "./components/Gallery";
import ThemeToggleButton from "@/components/themeToggle/ThemeToggleButton";
import { layoutTokens, zIndex, borderRadius, fontWeight, getResponsiveFontSize } from "theme/tokens";

interface AuthLayoutProps {
  children: React.ReactNode;
}

const gallerySlides: Slide[] = [
  {
    overline: 'DỮ LIỆU REALTIME · NẮM BẮT CƠ HỘI',
    headline: 'Phân tích thị trường toàn diện',
    description:
      'Theo dõi biến động chỉ số, dòng tiền, nước ngoài, tự doanh và phân tích kỹ thuật — tất cả trong một giao diện trực quan, cập nhật theo thời gian thực.',
  },
  {
    overline: 'BỘ LỌC MẠNH MẼ · ĐẦU TƯ HIỆU QUẢ',
    headline: 'Sàng lọc cổ phiếu thông minh',
    description:
      'Khám phá cơ hội đầu tư với bộ lọc đa tiêu chí — kết hợp phân tích kỹ thuật, cơ bản và dòng tiền trên hơn 1,600 mã cổ phiếu. Tìm ra những cơ hội tiềm năng nhất trước khi thị trường nhận ra.',
  },
  {
    overline: 'PHÂN TÍCH NGÀNH · ĐÓN ĐẦU DÒNG TIỀN',
    headline: 'Nhóm ngành & xu hướng',
    description:
      'Đánh giá sức mạnh tương đối của từng nhóm ngành, phát hiện sự luân chuyển dòng tiền giữa các lĩnh vực và đón đầu xu hướng đầu tư trước thị trường — lợi thế quyết định của nhà đầu tư chuyên nghiệp.',
  },
];

// ── Shared slide frame: fixed height, transparent bg, items rendered directly ──
const SLIDE_HEIGHT = layoutTokens.authGalleryHeight; // 320px — same for all slides

function SlideFrame({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{
      height: SLIDE_HEIGHT,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      overflow: 'hidden',
    }}>
      {children}
    </Box>
  );
}

// ── Slide 1 Visual: Market Analysis Feature Cards ──
const featureCards = [
  { icon: 'fluent-color:poll-16', label: 'Biến động' },
  { icon: 'fluent-color:data-area-20', label: 'Dòng tiền' },
  { icon: 'fluent-color:book-star-24', label: 'Định giá' },
  { icon: 'fluent-color:arrow-trending-lines-24', label: 'Phân tích KT' },
];

function MarketVisual() {
  return (
    <SlideFrame>
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 1.5,
      }}>
        {featureCards.map((card) => (
          <Box
            key={card.label}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1,
              py: 2.5,
              px: 1.5,
              height: '150px',
              borderRadius: `${borderRadius.md}px`,
              background: 'linear-gradient(135deg, rgba(139,92,246,0.25), rgba(59,130,246,0.2))',
              border: '1px solid rgba(255,255,255,0.08)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
            }}
          >
            <Icon icon={card.icon} width={50} height={50} />
            <Typography sx={(theme) => ({
              fontSize: getResponsiveFontSize('sm'),
              fontWeight: fontWeight.semibold,
              color: theme.palette.text.primary,
              textAlign: 'center',
            })}>
              {card.label}
            </Typography>
          </Box>
        ))}
      </Box>
    </SlideFrame>
  );
}

// ── Slide 2 Visual: Stock Screening Stats ──
const statCards = [
  { value: '1,600+', label: 'Mã cổ phiếu', icon: 'mdi:chart-box-outline' },
  { value: '50+', label: 'Chỉ báo phân tích', icon: 'mdi:filter-variant' },
  { value: 'Realtime', label: 'Cập nhật liên tục', icon: 'mdi:lightning-bolt-outline' },
];

function StockScreeningVisual() {
  return (
    <SlideFrame>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {statCards.map((stat) => (
          <Box
            key={stat.label}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              py: 1.75,
              px: 2,
              height: '95px',
              borderRadius: `${borderRadius.md}px`,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
            }}
          >
            <Box sx={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #7c3aed, #3b82f6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Icon icon={stat.icon} width={20} height={20} color="#fff" />
            </Box>
            <Box>
              <Typography sx={(theme) => ({
                fontSize: getResponsiveFontSize('lg'),
                fontWeight: fontWeight.bold,
                color: theme.palette.text.primary,
                lineHeight: 1.2,
              })}>
                {stat.value}
              </Typography>
              <Typography sx={(theme) => ({
                fontSize: getResponsiveFontSize('xs'),
                color: theme.palette.text.secondary,
              })}>
                {stat.label}
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>
    </SlideFrame>
  );
}

// ── Slide 3 Visual: Industry Sectors ──
const sectorItems = [
  { name: 'Ngân hàng', ticker: 'NGANHANG', change: '+1.8%', up: true },
  { name: 'Bất động sản', ticker: 'BDS', change: '-0.6%', up: false },
  { name: 'Công nghệ', ticker: 'CONGNGHE', change: '+2.4%', up: true },
  { name: 'Chứng khoán', ticker: 'CHUNGKHOAN', change: '+1.2%', up: true },
];

function SectorVisual() {
  return (
    <SlideFrame>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {sectorItems.map((sector) => (
          <Box
            key={sector.ticker}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              py: 1.5,
              px: 2,
              height: '70px',
              borderRadius: `${borderRadius.md}px`,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                flexShrink: 0,
                background: sector.up ? '#25b770' : '#e14040',
                boxShadow: sector.up
                  ? '0 0 8px rgba(37,183,112,0.5)'
                  : '0 0 8px rgba(225,64,64,0.5)',
              }} />
              <Box>
                <Typography sx={(theme) => ({
                  fontSize: getResponsiveFontSize('sm'),
                  fontWeight: fontWeight.semibold,
                  color: theme.palette.text.primary,
                  lineHeight: 1.3,
                })}>
                  {sector.name}
                </Typography>
                <Typography sx={(theme) => ({
                  fontSize: getResponsiveFontSize('xxs'),
                  color: theme.palette.text.disabled,
                })}>
                  {sector.ticker}
                </Typography>
              </Box>
            </Box>
            <Typography sx={{
              fontSize: getResponsiveFontSize('sm'),
              fontWeight: fontWeight.bold,
              color: sector.up ? '#25b770' : '#e14040',
            }}>
              {sector.change}
            </Typography>
          </Box>
        ))}
      </Box>
    </SlideFrame>
  );
}

export default function LayoutContent({ children }: AuthLayoutProps) {
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

  const galleryVisuals = [
    <MarketVisual key="market" />,
    <StockScreeningVisual key="stock" />,
    <SectorVisual key="sector" />,
  ];

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
      <Box sx={{ position: 'fixed', top: 16, right: 16, zIndex: zIndex.dropdown }}>
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
            chartComponents={galleryVisuals}
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
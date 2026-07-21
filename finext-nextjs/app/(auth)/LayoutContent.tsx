"use client";

import React from "react";
import { Box } from "@mui/material";
import { useTheme, alpha } from "@mui/material/styles";
import Gallery, { Slide } from "./components/Gallery";
import ThemeToggleButton from "@/components/themeToggle/ThemeToggleButton";
import PwaTitleBar from "@/components/layout/PwaTitleBar";
import { layoutTokens, zIndex, borderRadius, easings } from "theme/tokens";

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
const CHART_H = SLIDE_HEIGHT; // chiều cao render — đồ hoạ chiếm trọn khung
const VB_H = 220;             // chiều cao hệ toạ độ viewBox, kéo giãn để lấp CHART_H

const accentOf = (isDark: boolean) => (isDark ? '#8C5AFF' : '#6B46C1');

// Cả ba slide là ẩn dụ thị giác thuần tuý: không tên mã, không giá trị, không %.
// Chữ nghĩa mô tả tính năng đã do overline/headline/description trong Gallery đảm nhiệm.
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

// ── Slide 1 Visual: đường biểu đồ minh hoạ, tự vẽ khi slide xuất hiện ──
// KHÔNG gắn với chỉ số hay mã nào có thật — thuần hình khối, không nhãn, không giá trị.
// Toạ độ tĩnh, không sinh ngẫu nhiên → SSR và client luôn khớp.
// Có nhịp lên xuống để đường cong trông tự nhiên, không phải zigzag đều tăm tắp.
const INDEX_POINTS: ReadonlyArray<readonly [number, number]> = [
  [0, 172], [25, 168], [50, 175], [74, 163], [99, 157], [124, 166],
  [149, 152], [174, 145], [198, 151], [223, 138], [248, 131], [273, 142],
  [298, 127], [322, 117], [347, 125], [372, 109], [397, 102], [422, 113],
  [446, 98], [471, 87], [496, 96], [521, 77], [546, 65], [570, 73],
  [595, 51], [620, 38],
];

/**
 * Nội suy Catmull-Rom thành chuỗi cubic bezier — cho đường cong mượt đi qua
 * đúng mọi điểm dữ liệu, thay vì gấp khúc như polyline.
 */
function toSmoothPath(points: ReadonlyArray<readonly [number, number]>): string {
  if (points.length < 2) return '';
  const TENSION = 0.18;
  let d = `M${points[0][0]},${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const prev = points[i - 1] ?? points[i];
    const curr = points[i];
    const next = points[i + 1];
    const after = points[i + 2] ?? next;
    const c1x = curr[0] + (next[0] - prev[0]) * TENSION;
    const c1y = curr[1] + (next[1] - prev[1]) * TENSION;
    const c2x = next[0] - (after[0] - curr[0]) * TENSION;
    const c2y = next[1] - (after[1] - curr[1]) * TENSION;
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${next[0]},${next[1]}`;
  }
  return d;
}

const INDEX_LINE_PATH = toSmoothPath(INDEX_POINTS);
const INDEX_LAST = INDEX_POINTS[INDEX_POINTS.length - 1];
// Kéo phần tô phẳng tới mép phải viewBox để không hở một rẻo ở góc trên phải.
const INDEX_AREA_PATH = `${INDEX_LINE_PATH} L628,${INDEX_LAST[1]} L628,${VB_H} L0,${VB_H} Z`;

// Dải biên độ bao quanh đường — gợi ý "có lớp phân tích" mà không cần nhãn hay số.
const BAND_OFFSET = (i: number) => 11 + (i % 5) * 2.5;
const BAND_PATH = (() => {
  const upper = INDEX_POINTS.map(([x, y], i) => [x, y - BAND_OFFSET(i)] as const);
  const lower = INDEX_POINTS.map(([x, y], i) => [x, y + BAND_OFFSET(i)] as const);
  // slice(1) bỏ chữ 'M' của path dưới để nối tiếp thành một vùng khép kín
  return `${toSmoothPath(upper)} L${toSmoothPath([...lower].reverse()).slice(1)} Z`;
})();

function MarketVisual() {
  const theme = useTheme();
  const accent = accentOf(theme.palette.mode === 'dark');
  const gridColor = theme.palette.mode === 'dark'
    ? 'rgba(180,169,206,0.14)'
    : 'rgba(60,45,100,0.14)';

  return (
    <SlideFrame>
      <Box
        sx={{
          height: CHART_H,
          '@keyframes drawLine': { to: { strokeDashoffset: 0 } },
          '@keyframes bandIn': { from: { opacity: 0 }, to: { opacity: 1 } },
          '& .fx-band': {
            animation: `bandIn 900ms ${easings.easeOutQuart} 500ms both`,
          },
          '@keyframes pulseDot': {
            '0%, 100%': { opacity: 1, r: 4 },
            '50%': { opacity: 0.5, r: 6.5 },
          },
          '& .fx-line': {
            strokeDasharray: 1400,
            strokeDashoffset: 1400,
            animation: `drawLine 1500ms ${easings.easeOutQuart} forwards`,
          },
          '& .fx-dot': { animation: 'pulseDot 2400ms ease-in-out infinite' },
          '@media (prefers-reduced-motion: reduce)': {
            '& .fx-line': { animation: 'none', strokeDashoffset: 0 },
            '& .fx-dot': { animation: 'none' },
            '& .fx-band': { animation: 'none' },
          },
        }}
      >
        <svg
          width="100%"
          height="100%"
          viewBox={`0 -8 628 ${VB_H + 8}`}
          preserveAspectRatio="none"
          role="img"
          aria-label="Đồ hoạ minh hoạ biểu đồ phân tích kỹ thuật"
        >
          <defs>
            <linearGradient id="finextIndexFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accent} stopOpacity="0.28" />
              <stop offset="100%" stopColor={accent} stopOpacity="0" />
            </linearGradient>
          </defs>
          {[55, 110, 165].map((y) => (
            <line
              key={y}
              x1="0"
              y1={y}
              x2="628"
              y2={y}
              stroke={gridColor}
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <path d={INDEX_AREA_PATH} fill="url(#finextIndexFill)" />
          <path className="fx-band" d={BAND_PATH} fill={accent} fillOpacity="0.13" />
          <path
            className="fx-line"
            d={INDEX_LINE_PATH}
            fill="none"
            stroke={accent}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <circle className="fx-dot" cx={INDEX_LAST[0]} cy={INDEX_LAST[1]} r="4" fill={accent} />
        </svg>
      </Box>
    </SlideFrame>
  );
}

// ── Slide 2 Visual: toàn sàn thu hẹp còn nhóm đạt điều kiện ──
const DOT_COLS = 44;
const DOT_ROWS = 13;
// Vị trí cố định, rải đều trong lưới — không random để SSR khớp client.
const SURVIVORS = new Set([84, 137, 203, 259, 318, 372, 431, 486, 540]);

function StockScreeningVisual() {
  const theme = useTheme();
  const accent = accentOf(theme.palette.mode === 'dark');
  const gapX = 620 / DOT_COLS;
  const gapY = CHART_H / DOT_ROWS;

  const dots = [];
  for (let i = 0; i < DOT_COLS * DOT_ROWS; i++) {
    const col = i % DOT_COLS;
    const row = Math.floor(i / DOT_COLS);
    const survives = SURVIVORS.has(i);
    dots.push(
      <circle
        key={i}
        cx={(col * gapX + gapX / 2).toFixed(1)}
        cy={(row * gapY + gapY / 2).toFixed(1)}
        r={survives ? 4 : 1.6}
        fill={survives ? accent : theme.palette.text.disabled}
        opacity={survives ? 1 : 0.22}
        className={survives ? 'fx-keep' : undefined}
        style={survives ? { animationDelay: `${(i % 9) * 180}ms` } : undefined}
      />
    );
  }

  return (
    <SlideFrame>
      <Box
        sx={{
          height: CHART_H,
          '@keyframes keepPulse': {
            '0%, 100%': { opacity: 1, r: 4 },
            '50%': { opacity: 0.55, r: 6 },
          },
          '& .fx-keep': { animation: 'keepPulse 2600ms ease-in-out infinite' },
          '@media (prefers-reduced-motion: reduce)': {
            '& .fx-keep': { animation: 'none' },
          },
        }}
      >
        <svg
          width="100%"
          height={CHART_H}
          viewBox={`0 0 620 ${CHART_H}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Đồ hoạ minh hoạ việc lọc từ số lượng lớn xuống nhóm nhỏ"
        >
          {dots}
        </svg>
      </Box>
    </SlideFrame>
  );
}

// ── Slide 3 Visual: khảm ô kiểu bản đồ thị trường ──
// Không tên ngành, không %, chỉ khác kích thước và sắc độ — thuần hình khối,
// không ngụ ý bất kỳ ngành nào đang tăng hay giảm.
// span: bề ngang ô (tổng mỗi hàng = 13) · tone: 1 tăng, -1 giảm · level: sắc độ 0..1
const mosaicTiles = [
  { id: 'a', span: 5, tone: 1, level: 0.75 },
  { id: 'b', span: 4, tone: -1, level: 0.30 },
  { id: 'c', span: 4, tone: 1, level: 1.00 },
  { id: 'd', span: 3, tone: 1, level: 0.52 },
  { id: 'e', span: 3, tone: 1, level: 0.34 },
  { id: 'f', span: 3, tone: -1, level: 0.18 },
  { id: 'g', span: 4, tone: 1, level: 0.44 },
];

function SectorVisual() {
  return (
    <SlideFrame>
      <Box
        role="img"
        aria-label="Đồ hoạ minh hoạ bản đồ nhóm ngành"
        sx={{
          height: CHART_H,
          display: 'grid',
          gridTemplateColumns: 'repeat(13, 1fr)',
          gridAutoRows: '1fr',
          gap: 1,
          '@keyframes tileRise': {
            from: { opacity: 0, transform: 'translateY(12px)' },
            to: { opacity: 1, transform: 'none' },
          },
          '@media (prefers-reduced-motion: reduce)': {
            '& > *': { animation: 'none !important', opacity: 1 },
          },
        }}
      >
        {mosaicTiles.map((tile, i) => (
          <Box
            key={tile.id}
            sx={(theme) => ({
              gridColumn: `span ${tile.span}`,
              borderRadius: `${borderRadius.md}px`,
              backgroundColor: alpha(
                tile.tone > 0 ? theme.palette.trend.up : theme.palette.trend.down,
                0.12 + tile.level * 0.30,
              ),
              opacity: 0,
              animation: `tileRise 600ms ${easings.easeOutQuart} ${i * 70}ms forwards`,
            })}
          />
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
    <>
    <PwaTitleBar />
    <Box
      sx={{
        minHeight: "100vh",
        width: "100%",
        position: "relative",
        overflow: "hidden",
        background: layers.base,
        paddingTop: 'env(titlebar-area-height, 0px)',
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
    </>
  );
}
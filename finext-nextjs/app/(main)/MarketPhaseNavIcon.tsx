'use client';

import { Box, alpha, useTheme } from '@mui/material';

/** Đồng hồ định pha: cung XANH(trái)→vàng→ĐỎ(phải) + kim đưa qua lại quét cả hai màu.
 *  Kim/dot dùng MÀU ĐẶC (không gradient bbox → tránh lỗi kim tàng hình khi thẳng đứng); kim xoay
 *  quanh trục (12,17.5) bằng transform-box:view-box (không phụ thuộc bbox). */
function Gauge({ size = 24, accent, mb = 0 }: { size?: number; accent: string; mb?: number }) {
  return (
    <Box
      component="svg"
      width={size}
      height={size}
      viewBox="2 4 20 20"
      fill="none"
      sx={{
        display: 'block',
        marginBottom: `${mb}px`,
        strokeLinecap: 'round',
        '@keyframes mpSway': { '0%, 100%': { transform: 'rotate(-52deg)' }, '50%': { transform: 'rotate(52deg)' } },
        '& .mp-needle': { transformBox: 'view-box', transformOrigin: '12px 17.5px', animation: 'mpSway 4.2s ease-in-out infinite' },
        '@media (prefers-reduced-motion: reduce)': { '& .mp-needle': { animation: 'none' } },
      }}
    >
      <path d="M4 17.5 A8 8 0 0 1 8.1 10.4" stroke="#2ee06f" strokeWidth={2.4} />
      <path d="M9 9.7 A8 8 0 0 1 15 9.7" stroke="#f5c518" strokeWidth={2.4} />
      <path d="M15.9 10.4 A8 8 0 0 1 20 17.5" stroke="#ff5a5a" strokeWidth={2.4} />
      <line className="mp-needle" x1={12} y1={17.5} x2={12} y2={9.7} stroke={accent} strokeWidth={1.8} />
      <circle cx={12} cy={17.5} r={1.8} fill={accent} />
    </Box>
  );
}

interface MarketPhaseNavIconProps {
  /** true = kèm quầng "thở" cho rail/FAB (nổi bật nhất bộ nav); false = chỉ gauge trơn (drawer). */
  aura?: boolean;
  /** Cỡ tổng thể — quyết định cỡ gauge + bán kính quầng. Mặc định 34 (rail); FAB mobile dùng 60. */
  size?: number;
}

export default function MarketPhaseNavIcon({ aura = false, size = 34 }: MarketPhaseNavIconProps) {
  const theme = useTheme();
  const accent = theme.palette.primary.main;

  if (!aura) return <Gauge size={24} accent={accent} />;

  // aura=true: gauge + quầng sáng "thở" (drop-shadow). KHÔNG khung/nền/vòng conic — icon mới đủ nổi.
  const gaugeSize = Math.round(size * 0.72);
  const g1 = alpha(accent, 0.5);
  const g2 = alpha(accent, 0.9);
  return (
    <Box
      sx={{
        display: 'inline-flex',
        '@keyframes mpGlow': {
          '0%, 100%': { filter: `drop-shadow(0 0 ${(size * 0.06).toFixed(1)}px ${g1})` },
          '50%': { filter: `drop-shadow(0 0 ${(size * 0.16).toFixed(1)}px ${g2})` },
        },
        animation: 'mpGlow 3.4s ease-in-out infinite',
        '@media (prefers-reduced-motion: reduce)': { animation: 'none', filter: `drop-shadow(0 0 ${(size * 0.08).toFixed(1)}px ${g1})` },
      }}
    >
      <Gauge size={gaugeSize} accent={accent} />
    </Box>
  );
}

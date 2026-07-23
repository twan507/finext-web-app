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
  /** true = khung "Aurora" (viền tím Finext xoay + hào quang breathing) cho rail; false = chỉ icon gauge (drawer). */
  aura?: boolean;
  /** Đường kính khung aura. Mặc định 28 (rail desktop — sát gauge, gần cỡ icon anh em); FAB mobile dùng 54. */
  size?: number;
}

// Dải conic cho vành xoay + hào quang, chọn theo theme. Light mode dùng tím ĐẬM hơn (bỏ stop gần
// trắng #ede9fe vốn bị bợt trên nền trắng) để vòng xoay rõ nét và bám tím thương hiệu #8b5cf6;
// dark giữ NGUYÊN dải sáng cũ cho glow nổi trên nền tối.
const CONIC_DARK = 'conic-gradient(from 0deg, #6d28d9, #a78bfa, #ede9fe, #a78bfa, #6d28d9)';
const CONIC_LIGHT = 'conic-gradient(from 0deg, #4c1d95, #7c3aed, #a78bfa, #7c3aed, #4c1d95)';

export default function MarketPhaseNavIcon({ aura = false, size = 28 }: MarketPhaseNavIconProps) {
  const theme = useTheme();
  const accent = theme.palette.primary.main;
  const bg = theme.palette.background.default;
  const conic = theme.palette.mode === 'dark' ? CONIC_DARK : CONIC_LIGHT;
  // Nền nút: opacity giảm đều từ tâm (50%) ra rìa (10%) → tan mượt vào vành conic (bỏ vòng đen cứng).
  const coreBg = `radial-gradient(circle, ${alpha(bg, 1)}, ${alpha(bg, 0.5)})`;
  // Mọi kích thước con TỈ LỆ theo size → khung 60 vẫn cùng dáng khung 34 (ở size=34 ra đúng số cũ: 7 / 2 / 24 / 2).
  const blur = Math.round(size * 0.2);
  const ringW = Math.max(2, Math.round(size / 17));
  const gaugeSize = Math.round(size * 0.7);
  const gaugeMb = Math.round(size * 0.06);

  if (!aura) return <Gauge size={24} accent={accent} />;

  return (
    <Box
      className="mp-nav-frame"
      sx={{
        position: 'relative',
        width: size,
        height: size,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        '@keyframes mpSpin': { to: { transform: 'rotate(360deg)' } },
        '@keyframes mpBreathe': { '0%, 100%': { opacity: 0.4 }, '50%': { opacity: 0.85 } },
        // Hào quang: KHÔNG xoay (chỉ breathing) + box đúng bằng khung → chỉ có blur toả ra (ink-overflow, không sinh cuộn ngang).
        '&::before': {
          content: '""',
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: conic,
          filter: `blur(${blur}px)`,
          zIndex: 0,
          transition: 'filter .25s ease',
          animation: 'mpBreathe 3.4s ease-in-out infinite',
        },
      }}
    >
      {/* Viền conic XOAY — clip trong hình tròn nên góc vuông khi xoay không tràn ra (không tạo scrollbar). */}
      <Box
        className="mp-nav-ring"
        sx={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          overflow: 'hidden',
          zIndex: 1,
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: 0,
            background: conic,
            animation: 'mpSpin 4.5s linear infinite',
          },
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          inset: `${ringW}px`,
          borderRadius: '50%',
          background: coreBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2,
        }}
      >
        <Gauge size={gaugeSize} accent={accent} mb={gaugeMb} />
      </Box>
    </Box>
  );
}

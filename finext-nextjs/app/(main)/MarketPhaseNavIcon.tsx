'use client';

import { Box, alpha, useTheme } from '@mui/material';

/** Đồng hồ định pha: dải đỏ→vàng→xanh (giảm→trung gian→tăng) + kim. */
function Gauge({ size = 22, needle, mb = 0, ml = 0 }: { size?: number; needle: string; mb?: number; ml?: number }) {
  return (
    <svg width={size} height={size} viewBox="2 4 20 20" fill="none" strokeLinecap="round" style={{ display: 'block', marginBottom: mb, marginLeft: ml }}>
      <path d="M4 17.5 A8 8 0 0 1 8.1 10.4" stroke="#ff5a5a" strokeWidth={2.4} />
      <path d="M9 9.7 A8 8 0 0 1 15 9.7" stroke="#f5c518" strokeWidth={2.4} />
      <path d="M15.9 10.4 A8 8 0 0 1 20 17.5" stroke="#2ee06f" strokeWidth={2.4} />
      <path d="M12 17.5 L14.4 11" stroke={needle} strokeWidth={1.7} />
      <circle cx={12} cy={17.5} r={1.7} fill={needle} />
    </svg>
  );
}

interface MarketPhaseNavIconProps {
  /** true = khung "Aurora" (viền tím Finext xoay + hào quang breathing) cho rail; false = chỉ icon gauge (drawer). */
  aura?: boolean;
  /** Đường kính khung aura. Mặc định 34 (rail desktop); FAB bottom bar mobile dùng 60. */
  size?: number;
}

const CONIC = 'conic-gradient(from 0deg, #6d28d9, #a78bfa, #ede9fe, #a78bfa, #6d28d9)';

export default function MarketPhaseNavIcon({ aura = false, size = 34 }: MarketPhaseNavIconProps) {
  const theme = useTheme();
  const needle = theme.palette.text.primary;
  const bg = theme.palette.background.default;
  // Nền nút: opacity giảm đều từ tâm (50%) ra rìa (10%) → tan mượt vào vành conic (bỏ vòng đen cứng).
  const coreBg = `radial-gradient(circle, ${alpha(bg, 1)}, ${alpha(bg, 0.5)})`;
  // Mọi kích thước con TỈ LỆ theo size → khung 60 vẫn cùng dáng khung 34 (ở size=34 ra đúng số cũ: 7 / 2 / 24 / 2).
  const blur = Math.round(size * 0.2);
  const ringW = Math.max(2, Math.round(size / 17));
  const gaugeSize = Math.round(size * 0.7);
  const gaugeMb = Math.round(size * 0.06);

  if (!aura) return <Gauge size={24} needle={needle} />;

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
          background: CONIC,
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
            background: CONIC,
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
        <Gauge size={gaugeSize} needle={needle} mb={gaugeMb} />
      </Box>
    </Box>
  );
}

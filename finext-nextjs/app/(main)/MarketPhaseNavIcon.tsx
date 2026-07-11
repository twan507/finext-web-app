'use client';

import { Box, useTheme } from '@mui/material';

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
}

const CONIC = 'conic-gradient(from 0deg, #6d28d9, #a78bfa, #ede9fe, #a78bfa, #6d28d9)';

export default function MarketPhaseNavIcon({ aura = false }: MarketPhaseNavIconProps) {
  const theme = useTheme();
  const needle = theme.palette.text.primary;

  if (!aura) return <Gauge size={24} needle={needle} />;

  return (
    <Box
      className="mp-nav-frame"
      sx={{
        position: 'relative',
        width: 42,
        height: 42,
        borderRadius: '50%',
        '@keyframes mpSpin': { to: { transform: 'rotate(360deg)' } },
        '@keyframes mpBreathe': { '0%, 100%': { opacity: 0.35 }, '50%': { opacity: 0.8 } },
        // hào quang mờ breathing (phía sau) — hover nới rộng (transition inset)
        '&::before': {
          content: '""',
          position: 'absolute',
          inset: '-3px',
          borderRadius: '50%',
          background: CONIC,
          filter: 'blur(8px)',
          zIndex: 0,
          transition: 'inset .25s ease',
          animation: 'mpSpin 4.5s linear infinite, mpBreathe 3.4s ease-in-out infinite',
        },
        // viền conic tròn sắc nét — hover nới rộng
        '&::after': {
          content: '""',
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: CONIC,
          zIndex: 1,
          transition: 'inset .25s ease',
          animation: 'mpSpin 4.5s linear infinite',
        },
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          inset: '3px',
          borderRadius: '50%',
          bgcolor: 'background.default',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2,
        }}
      >
        <Gauge size={24} needle={needle} mb={2}/>
      </Box>
    </Box>
  );
}

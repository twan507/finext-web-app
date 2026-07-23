'use client';

import { Box, alpha, useTheme, type SxProps, type Theme } from '@mui/material';

/**
 * Icon "Tư vấn danh mục" trên nav: lõi tài sản gradient ở giữa + HAI hạt bay theo quỹ đạo ngoài với
 * TỐC ĐỘ KHÁC NHAU (3.2s vs 5s) nên khoảng cách giữa hai hạt đổi liên tục — tạo cảm giác "sống".
 * Chuyển động QUỸ ĐẠO, cố ý khác kiểu sparkle "thở" của FinextAiNavIcon dù cùng ngôn ngữ màu thương hiệu.
 * Kích thước neo theo fontSize (1em) → KHÔNG gây layout shift; nhận `sx` để cloneElement ở LayoutContent
 * ghi đè fontSize ở từng chỗ render. prefers-reduced-motion → dừng chuyển động, hai hạt lệch góc sẵn.
 */
export default function PortfolioNavIcon({ sx }: { sx?: SxProps<Theme> }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const c1 = theme.palette.primary.main;
  const c2 = isDark ? '#a78bfa' : '#8b5cf6';
  const ring = alpha(c1, isDark ? 0.32 : 0.22);
  return (
    <Box
      component="span"
      aria-hidden
      sx={[
        {
          display: 'inline-block',
          flexShrink: 0,
          position: 'relative',
          width: '1em',
          height: '1em',
          fontSize: '1.5rem', // mặc định = cỡ icon MUI medium; cloneElement ghi đè qua sx
          '@keyframes pfSpin': { to: { transform: 'rotate(360deg)' } },
          '@keyframes pfCore': {
            '0%, 100%': { transform: 'translate(-50%, -50%) scale(1)', filter: `drop-shadow(0 0 0.1em ${alpha(c1, 0.45)})` },
            '50%': { transform: 'translate(-50%, -50%) scale(1.08)', filter: `drop-shadow(0 0 0.2em ${alpha(c1, 0.7)})` },
          },
          '@media (prefers-reduced-motion: reduce)': { '& *': { animation: 'none !important' } },
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {/* Quỹ đạo (vành nét đứt mờ) */}
      <Box component="span" sx={{ position: 'absolute', inset: '6%', borderRadius: '50%', border: `0.055em dashed ${ring}` }} />

      {/* Lõi tài sản — gradient thương hiệu, thở nhẹ */}
      <Box
        component="span"
        sx={{
          position: 'absolute', top: '50%', left: '50%', width: '0.42em', height: '0.42em',
          borderRadius: '50%', background: `linear-gradient(135deg, ${c1}, ${c2})`,
          transform: 'translate(-50%, -50%)', animation: 'pfCore 3s ease-in-out infinite',
        }}
      />

      {/* Hạt 1 — nhanh (3.2s) */}
      <Box component="span" sx={{ position: 'absolute', inset: '6%', animation: 'pfSpin 3.2s linear infinite' }}>
        <Box component="span" sx={{ position: 'absolute', top: 0, left: '50%', width: '0.2em', height: '0.2em', transform: 'translate(-50%, -50%)', borderRadius: '50%', background: c1, boxShadow: `0 0 0.14em ${alpha(c1, 0.8)}` }} />
      </Box>

      {/* Hạt 2 — chậm hơn (5s) + lệch góc → khoảng cách hai hạt đổi liên tục */}
      <Box component="span" sx={{ position: 'absolute', inset: '6%', transform: 'rotate(140deg)', animation: 'pfSpin 5s linear infinite', animationDelay: '-1.6s' }}>
        <Box component="span" sx={{ position: 'absolute', top: 0, left: '50%', width: '0.16em', height: '0.16em', transform: 'translate(-50%, -50%)', borderRadius: '50%', background: c2, boxShadow: `0 0 0.12em ${alpha(c2, 0.7)}` }} />
      </Box>
    </Box>
  );
}

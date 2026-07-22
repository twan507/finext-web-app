'use client';

import { Box, alpha, useTheme, type SxProps, type Theme } from '@mui/material';

// Path ngôi sao AutoAwesome (bản fill) — dùng làm MASK để dải gradient chỉ hiện trong hình sparkle.
const SPARKLE_PATH =
  'M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12zM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25z';
// Encode nguyên khối để url() bền (không lo escape khoảng trắng/dấu ngoặc); fill đặc → mask alpha đủ hiện.
const SPARKLE_MASK = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='${SPARKLE_PATH}' fill='black'/></svg>`,
)}")`;
// Dải nhiều màu NEO tím thương hiệu #8b5cf6 (tím → chàm → xanh ngọc → tím → hồng tím → tím), cùng
// khẩu vị aura conic; các mốc 500/600 đủ tươi để rõ trên CẢ nền sáng lẫn tối, không loè loẹt LED.
// Vùng TÍM primary chiếm giữa dải (30-70%), cyan/chàm/hồng dạt ra hai mép làm điểm xuyết.
// Vì flow (6.4s) = ĐÚNG 2× breathe (3.2s) và flow chạy đối xứng 0→100→0, mọi đỉnh sáng của
// breathe đều rơi vào background-position 50% — cửa sổ nhìn thấy khi đó là đoạn ~27-73% của dải
// (size 220%) → lúc icon SÁNG NHẤT màu chủ đạo luôn là tím thương hiệu (owner chốt 22/07/2026);
// các mảng xanh/hồng chỉ lộ ra ở pha dịu. Đổi duration phải giữ tỉ lệ 2:1 kẻo lệch pha.
const GRADIENT =
  'linear-gradient(115deg, #06b6d4, #4f46e5 12%, #8b5cf6 30%, #a78bfa 50%, #8b5cf6 70%, #d946ef 88%, #06b6d4)';

/**
 * Icon "Finext AI" trên nav: sparkle AutoAwesome mang gradient nhiều màu breathing (flow + thở)
 * kèm quầng glow màu primary thở CÙNG NHỊP.
 * Kích thước neo theo fontSize (1em) nên KHÔNG gây layout shift; nhận `sx` để cloneElement ở
 * LayoutContent ghi đè fontSize/mr ở từng chỗ render (rail desktop / drawer mobile / breadcrumb).
 * Cấu trúc 2 lớp là BẮT BUỘC: thứ tự render CSS là filter TRƯỚC mask SAU, nên drop-shadow đặt
 * cùng phần tử với mask sẽ bị mask cắt mất — glow phải nằm ở lớp CHA, mask ở lớp CON. Nhờ glow
 * và opacity cùng nằm trong một keyframe fnxAiBreathe nên đồng bộ nhịp là tuyệt đối.
 * prefers-reduced-motion → tắt animation, giữ gradient tĩnh + glow tĩnh nhẹ.
 */
export default function FinextAiNavIcon({ sx }: { sx?: SxProps<Theme> }) {
  const theme = useTheme();
  const glow = theme.palette.primary.main;
  return (
    <Box
      component="span"
      aria-hidden
      sx={[
        {
          display: 'inline-block',
          flexShrink: 0,
          width: '1em',
          height: '1em',
          fontSize: '1.5rem', // mặc định = cỡ icon MUI medium; cloneElement có thể ghi đè qua sx
          // Glow theo em để tự tỉ lệ với cỡ icon (24px rail / 16px breadcrumb cùng một tương quan).
          // Glow chồng 2 lớp: quầng gần (0.22em) cho lõi sáng đậm + quầng xa (0.5em) lan toả rộng —
          // dày hơn hẳn một lớp đơn dù cùng bán kính. Sàn pha dịu nâng cao để lúc "nghỉ" vẫn rực.
          '@keyframes fnxAiBreathe': {
            '0%, 100%': {
              opacity: 0.82,
              filter: `saturate(1.05) brightness(1.06) drop-shadow(0 0 0.16em ${alpha(glow, 0.5)}) drop-shadow(0 0 0.34em ${alpha(glow, 0.28)})`,
            },
            '50%': {
              opacity: 1,
              filter: `saturate(1.5) brightness(1.22) drop-shadow(0 0 0.22em ${alpha(glow, 0.95)}) drop-shadow(0 0 0.5em ${alpha(glow, 0.6)})`,
            },
          },
          animation: 'fnxAiBreathe 3.2s ease-in-out infinite',
          '@media (prefers-reduced-motion: reduce)': {
            animation: 'none',
            opacity: 1,
            filter: `brightness(1.12) drop-shadow(0 0 0.2em ${alpha(glow, 0.65)}) drop-shadow(0 0 0.42em ${alpha(glow, 0.4)})`,
          },
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      <Box
        component="span"
        sx={{
          display: 'block',
          width: '100%',
          height: '100%',
          background: GRADIENT,
          backgroundSize: '220% 220%',
          WebkitMaskImage: SPARKLE_MASK,
          maskImage: SPARKLE_MASK,
          WebkitMaskRepeat: 'no-repeat',
          maskRepeat: 'no-repeat',
          WebkitMaskPosition: 'center',
          maskPosition: 'center',
          WebkitMaskSize: 'contain',
          maskSize: 'contain',
          '@keyframes fnxAiFlow': {
            '0%, 100%': { backgroundPosition: '0% 50%' },
            '50%': { backgroundPosition: '100% 50%' },
          },
          animation: 'fnxAiFlow 6.4s ease-in-out infinite',
          // Tôn trọng giảm chuyển động: dừng animation, gradient tĩnh neo giữa dải (vùng tím).
          '@media (prefers-reduced-motion: reduce)': {
            animation: 'none',
            backgroundPosition: '50% 50%',
          },
        }}
      />
    </Box>
  );
}

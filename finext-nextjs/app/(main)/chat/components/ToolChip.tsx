'use client';

import { Box, Typography, alpha, useTheme } from '@mui/material';
import { getResponsiveFontSize, fontWeight } from 'theme/tokens';
import type { ToolChip as ToolChipState } from '../../../../hooks/useChatStore';

// Động từ in đậm theo tool (kiểu Claude: **Đọc** dữ liệu cổ phiếu FPT). label backend = chi tiết.
const ACTION: Record<string, string> = {
  db_find: 'Đọc',
  db_aggregate: 'Tổng hợp',
  db_stats: 'Thống kê',
  read_kb: 'Tham khảo',
  get_my_watchlist: 'Đọc',
};

// Icon vẽ NÉT (stroke) thay cho bộ MUI đặc: ở cỡ 20px nét mảnh trông nhẹ và hợp với khối
// tra cứu hơn icon đặc, vốn nặng mảng và át phần chữ bên cạnh.
const PATHS: Record<string, React.ReactNode> = {
  db_find: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </>
  ),
  db_aggregate: <path d="M4 6h16M4 12h11M4 18h7" />,
  db_stats: (
    <>
      <path d="M4 15l5-5 3.5 3.5L20 6" />
      <path d="M20 11V6h-5" />
    </>
  ),
  read_kb: (
    <>
      <path d="M4 5.5A1.5 1.5 0 015.5 4H11v16H5.5A1.5 1.5 0 014 18.5z" />
      <path d="M20 5.5A1.5 1.5 0 0018.5 4H13v16h5.5a1.5 1.5 0 001.5-1.5z" />
    </>
  ),
  get_my_watchlist: <path d="M6 4h12v16l-6-4.5L6 20z" />,
};

function ToolIcon({ name, color }: { name: string; color: string }) {
  return (
    <Box
      component="svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      sx={{ width: 20, height: 20, color, mt: '1px', zIndex: 1, flexShrink: 0 }}
    >
      {PATHS[name] ?? PATHS.db_find}
    </Box>
  );
}

// Dòng tra cứu kiểu timeline (Claude): icon + động từ đậm + chi tiết nhỏ; các dòng liên tiếp nối bằng đường dọc.
// `connected` = vẽ đường nối xuống dòng kế.
// `active`    = dòng tiêu điểm (đang chạy, hoặc mới nhất trong khối) → sáng rõ + tím; các dòng còn
//               lại lùi về 44%. LUÔN có đúng một dòng tiêu điểm: để cả khối cùng sáng thì các vạch
//               nối trắng đầy nhìn như loạt dấu chấm than, mất hẳn cảm giác êm.
// `fading`    = dòng trên cùng của cửa sổ 5 dòng khi còn dòng cũ hơn bị đẩy ra → mờ dần ở mép trên.
export default function ToolChip({
  tool,
  connected = false,
  active = false,
  fading = false,
}: {
  tool: ToolChipState;
  connected?: boolean;
  active?: boolean;
  fading?: boolean;
}) {
  const theme = useTheme();
  const action = ACTION[tool.name] ?? 'Đọc';
  const failed = tool.ok === false && !tool.running;
  const iconColor = failed
    ? theme.palette.error.main
    : active
      ? theme.palette.primary.main
      : theme.palette.text.secondary;

  return (
    <Box
      sx={{
        display: 'flex',
        gap: 1.5,
        alignItems: 'stretch',
        // Giãn hàng để đoạn kẻ nối không chạm vào icon trên/dưới — kẻ dính icon trông thô.
        mt: 1,
        opacity: active ? 1 : 0.44,
        transition: 'opacity .4s ease',
        ...(fading && {
          maskImage: 'linear-gradient(to bottom, transparent 0, #000 22px)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0, #000 22px)',
        }),
      }}
    >
      {/* Cột icon + đường nối timeline */}
      <Box sx={{ position: 'relative', width: 24, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
        <ToolIcon name={tool.name} color={iconColor} />
        {connected && (
          <Box
            sx={{
              position: 'absolute',
              // Chừa hở ~5px hai đầu nhưng vẫn để đoạn kẻ DÀI HƠN tổng hai khoảng hở — ngắn hơn
              // thì nó đọc ra như dấu gạch lạc lõng chứ không ra đường nối timeline.
              top: 26,
              bottom: -5,
              left: '50%',
              width: '1.5px',
              transform: 'translateX(-50%)',
              // Vệt sáng trôi TỪ TRÊN XUỐNG dọc đường nối. Lưu ý background-position tính theo %
              // khi ảnh cao hơn khung thì tăng % kéo ảnh LÊN — nên chiều xuôi phải đi từ % lớn về nhỏ.
              // Dùng text.primary (trắng ở nền tối, đen ở nền sáng) chứ không dùng tím: vệt tím
              // trên đường kẻ mảnh trông rực và rẻ tiền. Tím chỉ để dành cho icon + động từ dòng đang chạy.
              // Hạ xuống 55% vì vạch trắng ĐẦY trên đoạn kẻ ngắn nhìn như dấu chấm than.
              backgroundImage: `linear-gradient(to bottom, ${alpha(theme.palette.text.primary, 0.55)} 0%, ${alpha(theme.palette.text.primary, 0.55)} 40%, ${theme.palette.divider} 40%, ${theme.palette.divider} 100%)`,
              backgroundSize: '100% 260%',
              animation: 'finextConduit 1.9s linear infinite',
              '@keyframes finextConduit': {
                from: { backgroundPosition: '0 160%' },
                to: { backgroundPosition: '0 -160%' },
              },
              // Người bật giảm chuyển động vẫn thấy đường nối tĩnh, không mất cấu trúc timeline.
              '@media (prefers-reduced-motion: reduce)': {
                animation: 'none',
                backgroundImage: 'none',
                bgcolor: 'divider',
              },
            }}
          />
        )}
      </Box>
      {/* Nội dung: động từ đậm + chi tiết */}
      <Box sx={{ pb: connected ? 2 : 0.25, minWidth: 0 }}>
        <Typography component="span" sx={{ fontSize: getResponsiveFontSize('sm'), lineHeight: 1.55 }}>
          <Box
            component="span"
            sx={{ fontWeight: fontWeight.semibold, color: active ? 'primary.main' : 'text.primary' }}
          >
            {action}
          </Box>
          <Box
            component="span"
            sx={{
              ml: 0.75,
              fontSize: getResponsiveFontSize('xs'),
              // Dòng tiêu điểm: chữ mô tả có dải sáng quét ngang (background-clip: text). Đây là tín
              // hiệu "đang chạy" duy nhất khi khối chỉ có MỘT dòng — lúc đó không có đường nối nào.
              // Quét trái→phải nên background-position phải đi từ % LỚN về NHỎ (ảnh rộng hơn khung
              // thì tăng % lại kéo ảnh sang trái).
              ...(active
                ? {
                    backgroundImage: `linear-gradient(90deg, ${alpha(theme.palette.text.primary, 0.34)} 0%, ${alpha(theme.palette.text.primary, 0.34)} 35%, ${theme.palette.text.primary} 50%, ${alpha(theme.palette.text.primary, 0.34)} 65%, ${alpha(theme.palette.text.primary, 0.34)} 100%)`,
                    backgroundSize: '260% 100%',
                    WebkitBackgroundClip: 'text',
                    backgroundClip: 'text',
                    color: 'transparent',
                    animation: 'finextLabelShimmer 2.2s linear infinite',
                    '@keyframes finextLabelShimmer': {
                      from: { backgroundPosition: '160% 0' },
                      to: { backgroundPosition: '-160% 0' },
                    },
                    '@media (prefers-reduced-motion: reduce)': {
                      animation: 'none',
                      backgroundImage: 'none',
                      color: 'text.secondary',
                    },
                  }
                : { color: 'text.secondary' }),
            }}
          >
            {tool.label}
          </Box>
        </Typography>
      </Box>
    </Box>
  );
}

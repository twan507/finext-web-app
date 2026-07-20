'use client';

import { Box, ButtonBase, IconButton, Typography, useTheme } from '@mui/material';
import { AutoAwesomeRounded, CloseRounded } from '@mui/icons-material';
import { easings, fontWeight, getGlassCard, getGlassEdgeLight, getGlassHighlight, getResponsiveFontSize } from 'theme/tokens';
import { teaserPosition } from './layout';

interface BubbleTeaserProps {
  /** Câu mời bám theo trang đang xem; cha bốc lại mỗi lượt hiện để không lặp câu. */
  message: string;
  /** Đang hiện hay không — cha gộp cả hai nguồn: chu kỳ tự động và hover. */
  visible: boolean;
  /** Rê chuột vào/ra chính bong bóng — để user với tay lên bấm mà nó không tắt giữa chừng. */
  onHoverChange: (hovered: boolean) => void;
  /** User bấm nút đóng — cha tắt hẳn chu kỳ tự động cả phiên và xoá luôn trạng thái hover. */
  onDismiss: () => void;
  onOpen: () => void;
}

/**
 * Bong bóng mời chat mọc ra từ nút tròn. Thuần trình bày: cửa sổ chat đang đóng, user đã
 * đăng nhập, nhịp hiện/tắt và câu hiển thị đều do cha quyết (xem `useTeaserCycle`).
 * Tắt hẳn khi ẩn (return null) nên mỗi lần hiện lại là một lần chạy lại animation mọc ra.
 */
export default function BubbleTeaser({ message, visible, onHoverChange, onDismiss, onOpen }: BubbleTeaserProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  if (!visible || !message) return null;

  return (
    <Box
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
      sx={{
        ...getGlassCard(isDark),
        ...teaserPosition,
        // position:'fixed' đã tự tạo containing block cho hai lớp giả bên dưới.
        position: 'fixed',
        zIndex: theme.zIndex.modal,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 0.25,
        maxWidth: 280,
        pl: 0.75,
        pr: 0.25,
        py: 0.75,
        borderRadius: '18px',
        overflow: 'hidden',
        transformOrigin: 'bottom right', // mọc ra từ phía nút tròn
        animation: `teaserIn 340ms ${easings.springOut} both`,
        '@keyframes teaserIn': {
          from: { opacity: 0, transform: 'scale(0.82) translate(10px, 12px)' },
          to: { opacity: 1, transform: 'none' },
        },
        '&::before': getGlassHighlight(isDark),
        '&::after': getGlassEdgeLight(isDark),
        '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
      }}
    >
      <ButtonBase
        onClick={onOpen}
        sx={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'flex-start', gap: 0.75, justifyContent: 'flex-start', textAlign: 'left', borderRadius: '14px', px: 0.75, py: 0.5 }}
      >
        <AutoAwesomeRounded sx={{ fontSize: 16, mt: '2px', color: 'primary.main', flexShrink: 0 }} />
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: getResponsiveFontSize('xs'), fontWeight: fontWeight.semibold, color: 'primary.main', lineHeight: 1.4 }}>Hỏi Finext AI</Typography>
          <Typography sx={{ fontSize: getResponsiveFontSize('xs'), color: 'text.primary', lineHeight: 1.5 }}>{message}</Typography>
        </Box>
      </ButtonBase>
      <IconButton size="small" onClick={onDismiss} aria-label="Không tự hiện gợi ý nữa" sx={{ flexShrink: 0, p: 0.25, color: 'text.disabled' }}>
        <CloseRounded sx={{ fontSize: 15 }} />
      </IconButton>
    </Box>
  );
}

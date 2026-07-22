'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box, IconButton, alpha, useTheme } from '@mui/material';
import { CloseRounded } from '@mui/icons-material';
import { easings, getGlassCard, getGlassEdgeLight, getGlassHighlight } from 'theme/tokens';
import { FAB_SIZE } from 'components/chatBubble/layout';
import { useMobileBarOffset } from '@/components/layout/mobileBarStore';
import { writeChatHandoff } from 'services/chatHandoff';
import { usePromoGate } from './usePromoGate';
import FinextAiPromoContent from './FinextAiPromoContent';

const FLY_MS = 480; // exit lớn: card to nên lấy ngưỡng trên của Material (300-400ms mobile)

/**
 * Popup quảng bá Finext AI (trang chủ), hiện đúng MỘT lần mỗi tab. Client-only: null lúc SSR.
 * Đóng = "arc motion": hai wrapper lồng nhau tách easing X/Y → quỹ đạo parabol cong xuống góc bubble;
 * card co tròn thành giọt sớm rồi mới bay, chỉ tan ở CUỐI đường.
 */
export default function FinextAiPromoPopup() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const router = useRouter();
  const barOffset = useMobileBarOffset();
  // Cổng hiện: chỉ mở khi delay hết VÀ câu hỏi gợi ý đã fetch xong → khu gợi ý không nhảy vào sau (glitch).
  const { open, questions, hide } = usePromoGate();
  const [closing, setClosing] = useState(false);
  const outerRef = useRef<HTMLDivElement | null>(null); // lớp bay ngang (đặt --fly-dx/dy + nghe animationend)
  const cardRef = useRef<HTMLDivElement | null>(null); // đo vị trí thật của card để tính quãng bay
  if (!open) return null;

  // Đóng: quãng bay = tâm bong bóng góc phải-dưới − tâm card; ghi vào CSS var cho hai wrapper. reduced-motion → đóng ngay.
  const handleClose = () => {
    if (closing) return; // đang đóng thì thôi, khỏi restart animation
    const card = cardRef.current;
    const outer = outerRef.current;
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!card || !outer || reduce) {
      hide();
      return;
    }
    const rect = card.getBoundingClientRect();
    const isMobile = window.innerWidth < theme.breakpoints.values.sm;
    const right = isMobile ? 12 : 24;
    const bottom = isMobile ? barOffset + 12 : 24;
    const bubbleCx = window.innerWidth - right - FAB_SIZE / 2;
    const bubbleCy = window.innerHeight - bottom - FAB_SIZE / 2;
    outer.style.setProperty('--fly-dx', `${bubbleCx - (rect.left + rect.width / 2)}px`);
    outer.style.setProperty('--fly-dy', `${bubbleCy - (rect.top + rect.height / 2)}px`);
    setClosing(true);
  };

  const handleSubmit = (text: string) => {
    // Ghi câu hỏi để /chat gửi giúp rồi điều hướng — không cần animation vì trang sẽ đổi ngay.
    writeChatHandoff(text);
    router.push('/chat');
  };
  const reduceMotion = { '@media (prefers-reduced-motion: reduce)': { animation: 'none' } } as const;

  return (
    <Box sx={{ position: 'fixed', inset: 0, zIndex: theme.zIndex.modal + 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
      <Box
        onClick={handleClose}
        sx={{
          position: 'absolute',
          inset: 0,
          bgcolor: alpha(theme.palette.common.black, isDark ? 0.6 : 0.4),
          backdropFilter: 'blur(3px)',
          opacity: closing ? 0 : 1,
          transition: `opacity ${FLY_MS}ms ${easings.smooth}`, // mờ song song với card bay
        }}
      />
      {/* Lớp NGOÀI — bay NGANG: ease-out có đà ném (nhanh lúc đầu, chậm dần). */}
      <Box
        ref={outerRef}
        onAnimationEnd={(e) => {
          if (closing && e.target === e.currentTarget) hide(); // chỉ nghe lớp ngoài, khi đang đóng
        }}
        sx={{
          width: '100%',
          maxWidth: { xs: '100%', sm: 640, md: 680 },
          animation: closing ? `finextFlyX ${FLY_MS}ms cubic-bezier(0.2, 0, 0.4, 1) forwards` : 'none',
          '@keyframes finextFlyX': { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(var(--fly-dx))' } },
          ...reduceMotion,
        }}
      >
        {/* Lớp TRONG — rơi DỌC: ease-in kiểu trọng lực (chậm đầu, tăng tốc cuối) → quỹ đạo cong xuống. */}
        <Box
          sx={{
            width: '100%',
            animation: closing ? `finextFlyY ${FLY_MS}ms cubic-bezier(0.55, 0, 0.85, 0.55) forwards` : 'none',
            '@keyframes finextFlyY': { from: { transform: 'translateY(0)' }, to: { transform: 'translateY(var(--fly-dy))' } },
            ...reduceMotion,
          }}
        >
          <Box
            ref={cardRef}
            sx={{
              ...getGlassCard(isDark),
              position: 'relative',
              width: '100%',
              // Trừ đúng padding 2 đầu của khung ngoài (p: 2 = 16px × 2) — căn giữa mà card cao hơn
              // khoảng trống thì tràn ĐỀU hai phía, cắt mất cả đầu lẫn chân nội dung.
              maxHeight: 'calc(100dvh - 32px)',
              p: { xs: 2.5, sm: 4 },
              borderRadius: '20px',
              overflow: 'hidden',
              transformOrigin: 'center', // wrapper lo phần dời chỗ, card chỉ co lại tại chỗ
              // Vào: nảy nhẹ. Ra: co tròn thành giọt sớm (~25%), giữ đặc khi bay, chỉ tan ở cuối (72%→100%).
              animation: closing ? `finextDropShrink ${FLY_MS}ms cubic-bezier(0.4, 0, 0.2, 1) forwards` : `promoIn 420ms ${easings.springOut}`,
              '@keyframes promoIn': {
                from: { opacity: 0, transform: 'scale(0.92) translateY(14px)' },
                to: { opacity: 1, transform: 'none' },
              },
              '@keyframes finextDropShrink': {
                '0%': { transform: 'scale(1)', borderRadius: '20px', opacity: 1 },
                '9%': { transform: 'scale(1.02)', borderRadius: '20px', opacity: 1 }, // anticipation nhẹ, KHÔNG skew
                '25%': { transform: 'scale(0.72)', borderRadius: '50%', opacity: 1 }, // đã là giọt tròn trước khi bay xa
                '72%': { transform: 'scale(0.16)', borderRadius: '50%', opacity: 1 }, // vẫn đặc trên đường bay
                '100%': { transform: 'scale(0.06)', borderRadius: '50%', opacity: 0 }, // tan khi đã tới góc
              },
              '&::before': getGlassHighlight(isDark),
              '&::after': getGlassEdgeLight(isDark),
              ...reduceMotion,
            }}
          >
            <IconButton size="small" onClick={handleClose} aria-label="Đóng" sx={{ position: 'absolute', top: 8, right: 8, zIndex: 2, color: 'text.secondary' }}>
              <CloseRounded sx={{ fontSize: 20 }} />
            </IconButton>
            <FinextAiPromoContent onSubmit={handleSubmit} questions={questions} />
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

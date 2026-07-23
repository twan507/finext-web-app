'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Box, Button, CircularProgress, Fab, IconButton, Tooltip, Typography, alpha, useTheme } from '@mui/material';
import { AddCommentOutlined, AutoAwesomeRounded, CloseRounded, InfoOutlined, Launch, WarningAmberOutlined } from '@mui/icons-material';
import { easings, getGlassCard, getGlassEdgeLight, getGlassHighlight, getGlowButton, getResponsiveFontSize, fontWeight } from 'theme/tokens';
import { useAuth } from 'components/auth/AuthProvider';
import AuthGateOverlay from 'components/auth/AuthGateOverlay';
import useChatStore from 'hooks/useChatStore';
import { BUBBLE_GREETINGS, SUGGESTIONS_SHOWN, buildPageContext, getSuggestionPool, hasBubble } from 'services/chatPageContext';
import Composer from 'app/(main)/chat/components/Composer';
import BubbleMessages from './BubbleMessages';
import BubbleTeaser from './BubbleTeaser';
import useTeaserCycle, { NUDGE_MS } from './useTeaserCycle';
import { pickOne, pickSome } from './pick';
import { BAR_SYNC_TRANSITION, FAB_SIZE, fabPosition, panelPosition } from './layout';
import { useMobileBarOffset } from '@/components/layout/mobileBarStore';

const TITLE = 'Finext AI';

/**
 * Khung cửa sổ: fixed góc phải dưới, LUÔN là flex column có chiều cao bị chặn
 * (desktop: height cố định · mobile: top + bottom cùng đặt) — điều kiện bắt buộc để
 * vùng tin nhắn bên trong cuộn được thay vì đùn dài ra.
 */
function usePanelSx(visible: boolean) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const barOffset = useMobileBarOffset();
  return {
    ...getGlassCard(isDark),
    ...panelPosition(barOffset),
    display: visible ? 'flex' : 'none',
    flexDirection: 'column',
    // position:'fixed' đã tự tạo containing block cho hai lớp giả → KHÔNG đặt lại 'relative'
    // (sẽ phá vị trí cố định). overflow:'hidden' chỉ bo góc chứ không cắt mất chúng.
    position: 'fixed',
    zIndex: theme.zIndex.modal, // 1300 > Drawer điều hướng (1200)
    overflow: 'hidden',
    borderRadius: 3,
    width: { xs: 'auto', sm: '380px' },
    height: { xs: 'auto', sm: '560px' },
    maxHeight: { sm: 'calc(100dvh - 48px)' },
    '&::before': getGlassHighlight(isDark),
    '&::after': getGlassEdgeLight(isDark),
  } as const;
}

function PanelHeader({ onNew, onExpand, onClose }: { onNew?: () => void; onExpand?: () => void; onClose: () => void }) {
  return (
    <Box
      sx={(t) => ({
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        px: 1.5,
        py: 1,
        flexShrink: 0,
        borderBottom: `1px solid ${t.palette.divider}`,
      })}
    >
      {/* Icon AI (không phải logo Finext) — cùng biểu tượng với nút tròn để đọc thành một khối liền mạch. */}
      <AutoAwesomeRounded sx={{ fontSize: 18, mr: 0.75, color: 'primary.main', flexShrink: 0 }} />
      <Typography sx={{ flex: 1, minWidth: 0, fontSize: getResponsiveFontSize('sm'), fontWeight: fontWeight.semibold, color: 'text.primary' }}>{TITLE}</Typography>
      {onNew && (
        <Tooltip title="Cuộc trò chuyện mới" placement="top">
          <IconButton size="small" onClick={onNew} aria-label="Cuộc trò chuyện mới" sx={{ color: 'text.secondary' }}>
            <AddCommentOutlined sx={{ fontSize: 17 }} />
          </IconButton>
        </Tooltip>
      )}
      {onExpand && (
        <Tooltip title="Mở trong Finext AI" placement="top">
          <IconButton size="small" onClick={onExpand} aria-label="Mở trong Finext AI" sx={{ color: 'text.secondary' }}>
            <Launch sx={{ fontSize: 17 }} />
          </IconButton>
        </Tooltip>
      )}
      <Tooltip title="Đóng" placement="top">
        <IconButton size="small" onClick={onClose} aria-label="Đóng" sx={{ color: 'text.secondary' }}>
          <CloseRounded sx={{ fontSize: 19 }} />
        </IconButton>
      </Tooltip>
    </Box>
  );
}

// Thanh thông báo hạn mức, cùng kiểu trang /chat nhưng gọn cho khung nhỏ.
// severity='info' cho nhắc sớm 50%/75% (chỉ nhắc, không chặn) — nhẹ hơn thanh chặn 429/503.
function BubbleLimitNotice({ notice, severity = 'warning' }: { notice: { message: string; detail: boolean }; severity?: 'warning' | 'info' }) {
  const Icon = severity === 'info' ? InfoOutlined : WarningAmberOutlined;
  return (
    <Box
      sx={(t) => ({
        display: 'flex',
        alignItems: 'center',
        gap: 0.75,
        mx: 1.5,
        mb: 0.5,
        px: 1.25,
        py: 0.75,
        borderRadius: 2,
        flexShrink: 0,
        bgcolor: alpha(t.palette[severity].main, t.palette.mode === 'dark' ? 0.18 : 0.12),
        border: `1px solid ${alpha(t.palette[severity].main, 0.3)}`,
      })}
    >
      <Icon sx={{ fontSize: 16, color: `${severity}.main`, flexShrink: 0 }} />
      <Typography sx={{ flex: 1, minWidth: 0, fontSize: getResponsiveFontSize('xs'), color: 'text.primary' }}>{notice.message}</Typography>
      {notice.detail && (
        <Box
          component={Link}
          href="/profile/ai-usage"
          sx={{ flexShrink: 0, fontSize: getResponsiveFontSize('xs'), fontWeight: fontWeight.medium, color: 'primary.main', textDecoration: 'none', whiteSpace: 'nowrap' }}
        >
          Xem chi tiết
        </Box>
      )}
    </Box>
  );
}

/**
 * Nơi duy nhất gọi useChatStore. Chỉ được render SAU lần mở đầu tiên và từ đó giữ nguyên
 * trong cây (chỉ ẩn/hiện bằng CSS) — nhờ vậy trang chỉ để xem không phát sinh request nào,
 * còn đóng rồi mở lại thì hội thoại vẫn nguyên vẹn.
 */
function BubbleChat({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const panelSx = usePanelSx(visible);

  // Ref cập nhật mỗi render: user đổi trang giữa hội thoại thì lượt gửi kế tiếp vẫn khớp trang hiện tại.
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const searchRef = useRef(searchParams);
  searchRef.current = searchParams;

  const store = useChatStore(undefined, () => buildPageContext(pathnameRef.current, searchRef.current));
  const streaming = store.phase !== 'idle';
  const activeServerId = store.conversations.find((c) => c.id === store.activeId)?.serverId ?? null;

  // Câu chào + chip gợi ý được CHỐT trong useMemo, không bốc lại giữa các lần re-render
  // (mỗi lượt gửi tin là một lần re-render — bốc trong thân render sẽ làm chữ nhảy loạn).
  // Bốc lại đúng ba dịp: mở lại cửa sổ, đổi trang, đổi tab. Panel đang ẩn thì khỏi bốc.
  const tab = searchParams.get('tab');
  const intro = useMemo(() => {
    if (!visible) return { greeting: '', suggestions: [] as string[] };
    return {
      greeting: pickOne(BUBBLE_GREETINGS),
      suggestions: pickSome(getSuggestionPool(pathname, { get: () => tab }), SUGGESTIONS_SHOWN),
    };
    // activeId: mở hội thoại mới thì bốc lại câu chào + gợi ý cho ra cảm giác "mới".
  }, [visible, pathname, tab, store.activeId]);

  return (
    <Box sx={panelSx}>
      <PanelHeader
        onNew={store.newConversation}
        onExpand={() => router.push(activeServerId ? `/chat/${activeServerId}` : '/chat')}
        onClose={onClose}
      />
      <BubbleMessages
        messages={store.messages}
        greeting={intro.greeting}
        suggestions={intro.suggestions}
        onPickSuggestion={store.send}
        onRetry={store.retry}
        onFeedback={store.sendFeedback}
        error={store.error}
      />
      {/* Chặn (429/503) ưu tiên hơn nhắc sớm — không hiện hai thanh cùng lúc. */}
      {store.limitNotice ? <BubbleLimitNotice notice={store.limitNotice} /> : store.quotaWarn ? <BubbleLimitNotice notice={store.quotaWarn} severity="info" /> : null}
      <Box sx={{ flexShrink: 0 }}>
        <Composer
          compact
          disabled={streaming}
          streaming={streaming}
          onSend={store.send}
          onStop={store.stop}
          thinking={store.thinking}
          onToggleThinking={store.toggleThinking}
        />
      </Box>
    </Box>
  );
}

// Chưa đăng nhập (hoặc đang xác định phiên): KHÔNG chạm tới useChatStore → không gọi API nào.
function GuestPanel({ visible, loading, onClose }: { visible: boolean; loading: boolean; onClose: () => void }) {
  const panelSx = usePanelSx(visible);

  return (
    <Box sx={panelSx}>
      <PanelHeader onClose={onClose} />
      {/* position:relative để AuthGateOverlay (absolute inset:0) lấp đúng vùng dưới header. */}
      <Box sx={{ flex: 1, minHeight: 0, position: 'relative' }}>
        {loading ? (
          <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CircularProgress size={26} />
          </Box>
        ) : (
          // Dùng CHUNG gate đăng nhập chuẩn (compact) — đồng bộ với các nơi khác, không lệch về sau.
          <AuthGateOverlay compact />
        )}
      </Box>
    </Box>
  );
}

export default function ChatBubble() {
  const theme = useTheme();
  const pathname = usePathname();
  const { session, loading } = useAuth();
  const [opened, setOpened] = useState(false); // đã từng mở lần nào chưa → quyết định có mount BubbleChat
  const [visible, setVisible] = useState(false); // đang mở hay không → chỉ ẩn/hiện bằng CSS
  const [hovered, setHovered] = useState(false); // rê chuột/focus vào nút → hiện bong bóng mời (thay tooltip)
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoveredRef = useRef(false); // bản đọc-ngay của `hovered`, để biết ĐANG vào hay chỉ lướt qua
  const [hoverTurn, setHoverTurn] = useState(0); // mỗi lần hover mới là một lượt hiện mới
  // Khoảng chừa cho thanh điều hướng đáy mobile — 0 khi thanh đã thụt xuống hoặc route không có thanh.
  const barOffset = useMobileBarOffset();

  // Nguồn sự thật duy nhất cho việc ẩn/hiện: /chat, /profile/*, tin tức, báo cáo… tự động không có bubble.
  const bubbleOn = hasBubble(pathname);
  // Nút nhún và bong bóng tự hiện là MỘT chu kỳ. Chỉ chạy khi đã đăng nhập và cửa sổ đang đóng.
  const cycle = useTeaserCycle(bubbleOn && Boolean(session) && !visible);

  // Câu mời được chốt trong state (đổi ở effect, không bốc trong thân render) và tránh lặp
  // đúng câu vừa hiện. Đổi khi: sang trang khác, tới lượt mời mới, hoặc user hover một lượt mới.
  const [teaserMessage, setTeaserMessage] = useState('');
  useEffect(() => {
    setTeaserMessage((prev) => pickOne(getSuggestionPool(pathname), prev));
  }, [pathname, cycle.turn, hoverTurn]);

  useEffect(() => () => { if (hoverTimer.current) clearTimeout(hoverTimer.current); }, []);

  if (!bubbleOn) return null;

  /** Rời chuột thì trễ một nhịp mới tắt, đủ để user với tay từ nút lên chính bong bóng. */
  const setHover = (on: boolean) => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    if (on) {
      // Chỉ tính lượt mới khi bong bóng đang tắt hẳn — hover lúc nó đang hiện thì giữ nguyên chữ.
      if (!hoveredRef.current && !cycle.autoVisible) setHoverTurn((n) => n + 1);
      hoveredRef.current = true;
      setHovered(true);
    } else {
      hoverTimer.current = setTimeout(() => {
        hoveredRef.current = false;
        setHovered(false);
      }, 260);
    }
  };

  /** Tắt ngay, không chờ: dùng khi user chủ động đóng bong bóng hoặc mở cửa sổ chat. */
  const hideHoverNow = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoveredRef.current = false;
    setHovered(false);
  };

  const isDark = theme.palette.mode === 'dark';
  const glow = getGlowButton(isDark);
  // Hào quang RGB "thở" quanh nút: neo bằng tím thương hiệu, điểm xuyết xanh dương / xanh ngọc /
  // hồng tím để đa sắc mà tím vẫn áp đảo (sang, không chói kiểu đèn gaming). Cùng ngôn ngữ với
  // khung Aurora của "Giai đoạn thị trường" (conic gradient + breathing).
  const auraGradient = `conic-gradient(from 0deg, ${theme.palette.primary.main}, #5b8def, #35d0c8, ${theme.palette.primary.main}, #d96bf5, ${theme.palette.primary.main})`;
  const iconSx = {
    position: 'absolute' as const,
    inset: 0,
    fontSize: 25,
    transition: `opacity 220ms ${easings.smooth}, transform 260ms ${easings.smooth}`,
    '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
  };

  const open = () => {
    cycle.stop(); // đã tự mở thì thôi mời nữa trong phiên này
    hideHoverNow();
    setOpened(true);
    setVisible(true);
  };

  return (
    <>
      {/* Vòng hào quang RGB nằm DƯỚI nút (z thấp hơn) → chỉ phần blur toả ra rìa mới thấy, mặt nút
          giữ nguyên gradient tím. Ẩn khi cửa sổ chat mở (đồng bộ với lúc nút thu nhỏ, tan đi). */}
      {!visible && (
        <Box
          aria-hidden
          sx={{
            ...fabPosition(barOffset),
            position: 'fixed',
            zIndex: theme.zIndex.modal - 1,
            width: FAB_SIZE,
            height: FAB_SIZE,
            borderRadius: '50%',
            pointerEvents: 'none',
            background: auraGradient,
            filter: 'blur(11px)',
            // Trồi/thụt cùng thanh điều hướng đáy mobile như chính nút tròn.
            transition: BAR_SYNC_TRANSITION,
            // Thở nhẹ (opacity) + xoay chậm để màu luân chuyển — quãng dài, biên độ thấp nên không loè loẹt.
            animation: 'finextAuraBreathe 3.6s ease-in-out infinite, finextAuraSpin 9s linear infinite',
            '@keyframes finextAuraBreathe': { '0%, 100%': { opacity: 0.35 }, '50%': { opacity: 0.7 } },
            '@keyframes finextAuraSpin': { to: { transform: 'rotate(360deg)' } },
            // Reduced-motion: tắt animation, chỉ giữ một quầng sáng tĩnh rất nhẹ.
            '@media (prefers-reduced-motion: reduce)': { animation: 'none', opacity: 0.4 },
          }}
        />
      )}

      {/* Không bọc Tooltip: chính BubbleTeaser đóng vai lời mời khi hover — nên nút phải tự mô tả bằng aria-label. */}
      <Fab
        color="primary"
        aria-label="Mở Finext AI để hỏi về trang này"
        aria-hidden={visible}
        tabIndex={visible ? -1 : 0}
        onClick={open}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
        sx={{
          ...glow,
          ...fabPosition(barOffset),
          position: 'fixed',
          zIndex: theme.zIndex.modal,
          width: FAB_SIZE,
          height: FAB_SIZE,
          color: '#fff',
          background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.light} 100%)`,
          // BAR_SYNC_TRANSITION: trồi/thụt cùng nhịp với thanh điều hướng đáy mobile.
          transition: `transform 260ms ${easings.springOut}, opacity 200ms ${easings.smooth}, box-shadow 260ms ${easings.smooth}, ${BAR_SYNC_TRANSITION}`,
          // Nhún ĐÚNG MỘT NHỊP mỗi lần tới chu kỳ (JS bật/tắt), đồng thời với lúc bong bóng tự hiện.
          animation: cycle.nudging ? `finextFabNudge ${NUDGE_MS}ms ease-in-out` : 'none',
          // Mở cửa sổ: nút thu nhỏ rồi tan đi (thay vì biến mất đột ngột), icon morph sang dấu X.
          ...(visible ? { opacity: 0, transform: 'scale(0.6)', pointerEvents: 'none', animation: 'none' } : null),
          '&:hover': {
            ...glow['&:hover'],
            // Nhường transform cho hiệu ứng nâng nhẹ khi hover (animation luôn thắng transition).
            animation: 'none',
            background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`,
          },
          // Một nhịp = nảy cao rồi nảy nhẹ lần nữa, gọn trong NUDGE_MS.
          '@keyframes finextFabNudge': {
            '0%': { transform: 'translateY(0)' },
            '22%': { transform: 'translateY(-9px)' },
            '44%': { transform: 'translateY(0)' },
            '62%': { transform: 'translateY(-4px)' },
            '80%, 100%': { transform: 'translateY(0)' },
          },
          // Vòng sáng "thở" rất nhẹ, có quãng nghỉ dài để không lòe loẹt.
          '&::after': {
            content: '""',
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: `1px solid ${alpha(theme.palette.primary.light, 0.7)}`,
            animation: 'finextFabPulse 3s ease-out infinite',
            pointerEvents: 'none',
          },
          '@keyframes finextFabPulse': {
            '0%': { transform: 'scale(1)', opacity: 0.5 },
            '60%': { transform: 'scale(1.5)', opacity: 0 },
            '100%': { transform: 'scale(1.5)', opacity: 0 },
          },
          '@media (prefers-reduced-motion: reduce)': {
            transition: 'none',
            animation: 'none',
            '&::after': { animation: 'none', opacity: 0 },
            '&:hover': { transform: 'none' },
          },
        }}
      >
        <Box sx={{ position: 'relative', width: 25, height: 25 }}>
          <AutoAwesomeRounded sx={{ ...iconSx, opacity: visible ? 0 : 1, transform: visible ? 'rotate(-90deg) scale(0.6)' : 'none' }} />
          <CloseRounded sx={{ ...iconSx, opacity: visible ? 1 : 0, transform: visible ? 'none' : 'rotate(90deg) scale(0.6)' }} />
        </Box>
      </Fab>

      {!visible && session && (
        <BubbleTeaser
          message={teaserMessage}
          visible={cycle.autoVisible || hovered}
          onHoverChange={setHover}
          onDismiss={() => { cycle.stop(); hideHoverNow(); }}
          onOpen={open}
        />
      )}

      {opened && session && <BubbleChat visible={visible} onClose={() => setVisible(false)} />}
      {visible && !session && <GuestPanel visible loading={loading} onClose={() => setVisible(false)} />}
    </>
  );
}

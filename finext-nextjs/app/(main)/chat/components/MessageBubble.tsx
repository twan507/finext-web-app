'use client';

import { Fragment, memo, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Box, Skeleton, Typography, alpha, useTheme } from '@mui/material';
import { getResponsiveFontSize } from 'theme/tokens';
import type { ChatMessage } from '../../../../hooks/useChatStore';
import WidgetRenderer from './WidgetRenderer';
import ToolChip from './ToolChip';

// Tách fence ```finext-widget → xen kẽ markdown + widget; fence chưa đóng (đang stream) → pending.
function splitWidgets(text: string): { kind: 'md' | 'widget' | 'pending'; body: string }[] {
  const out: { kind: 'md' | 'widget' | 'pending'; body: string }[] = [];
  const re = /```finext-widget\s*\n([\s\S]*?)```/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push({ kind: 'md', body: text.slice(last, m.index) });
    out.push({ kind: 'widget', body: m[1] });
    last = re.lastIndex;
  }
  const rest = text.slice(last);
  const openIdx = rest.indexOf('```finext-widget');
  if (openIdx !== -1) {
    if (openIdx > 0) out.push({ kind: 'md', body: rest.slice(0, openIdx) });
    out.push({ kind: 'pending', body: '' }); // fence chưa đóng → skeleton
  } else if (rest) {
    out.push({ kind: 'md', body: rest });
  }
  return out;
}

function MarkdownBody({ text }: { text: string }) {
  const theme = useTheme();
  return (
    <Box sx={{ fontSize: getResponsiveFontSize('md'), lineHeight: 1.72, '& p': { my: 1 }, '& ul, & ol': { my: 1, pl: 3 }, '& li': { mb: 0.5 }, '& h1': { fontSize: '1.2rem', fontWeight: 700, mt: 2, mb: 1, letterSpacing: '-0.01em' }, '& h3': { fontSize: '1.05rem', fontWeight: 700, mt: 2.5, mb: 1, letterSpacing: '-0.01em' }, '& h2': { fontSize: '1.15rem', fontWeight: 700, mt: 2.5, mb: 1 }, '& strong': { fontWeight: 650 } }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Bảng kiểu Claude: KHÔNG khung/grid — chỉ 1 vạch dưới header, hàng thân viền rất mờ.
          // Cột đầu = nhãn canh trái (flush-left), các cột sau = số canh phải + tabular-nums (nhất quán).
          table: ({ children }) => (
            // overflowX:auto = lưới an toàn cho bảng thật rộng (>4 cột); mục tiêu là fixed layout fit không cuộn.
            <Box sx={{ my: 2, overflowX: 'auto' }}>
              <Box
                component="table"
                sx={{
                  width: '100%',
                  tableLayout: 'fixed', // chia diện tích ỔN ĐỊNH — không cột nào nuốt hết, không tràn ngang
                  borderCollapse: 'collapse',
                  fontSize: '0.9rem',
                  lineHeight: 1.5,
                  // Bỏ nowrap → cho XUỐNG DÒNG + ngắt từ dài để cột co giãn thay vì kéo bảng rộng ra.
                  '& th, & td': { px: 2, py: 1.15, textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'anywhere', verticalAlign: 'top' },
                  '& th:first-of-type, & td:first-of-type': { pl: 0, textAlign: 'left' },
                  '& th:last-of-type, & td:last-of-type': { pr: 0 },
                  '& thead th': { fontWeight: 600, color: 'text.secondary', pb: 1, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.5)}` },
                  '& tbody td': { borderTop: `1px solid ${alpha(theme.palette.divider, 0.14)}` },
                }}
              >
                {children}
              </Box>
            </Box>
          ),
          thead: ({ children }) => <Box component="thead">{children}</Box>,
          tbody: ({ children }) => <Box component="tbody">{children}</Box>,
          tr: ({ children }) => <Box component="tr">{children}</Box>,
          th: ({ children }) => <Box component="th">{children}</Box>,
          // Cắt ô dài ở tối đa 4 dòng (ưu tiên xuống dòng tới 4 dòng rồi mới ẩn phần thừa).
          td: ({ children }) => (
            <Box component="td">
              <Box sx={{ display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{children}</Box>
            </Box>
          ),
          a: ({ children, href }) => (
            <Box component="a" href={href} target="_blank" rel="noopener noreferrer" sx={{ color: 'primary.main', textDecoration: 'underline' }}>
              {children}
            </Box>
          ),
          code: ({ children }) => (
            <Box component="code" sx={{ px: 0.5, py: 0.1, borderRadius: 0.5, bgcolor: alpha(theme.palette.text.primary, 0.08), fontSize: '0.9em' }}>
              {children}
            </Box>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </Box>
  );
}

// Render 1 text-part = markdown + widget; fence chưa đóng lúc stream → skeleton "đang dựng biểu đồ".
function AssistantText({ text, streaming }: { text: string; streaming: boolean }) {
  return (
    <>
      {splitWidgets(text).map((seg, i) => {
        if (seg.kind === 'md') return <MarkdownBody key={i} text={seg.body} />;
        if (seg.kind === 'widget') return <WidgetRenderer key={i} json={seg.body} />;
        return streaming ? (
          <Box key={i} sx={{ my: 1.5 }}>
            <Skeleton variant="rounded" height={200} />
            <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: 'text.secondary' }}>
              Đang dựng biểu đồ…
            </Typography>
          </Box>
        ) : null;
      })}
    </>
  );
}

// Số dòng tra cứu tối đa hiện cùng lúc. Quá 5 dòng thì khối cao lấn cả câu trả lời, mà dòng cũ
// cũng hết giá trị — người dùng đang chờ nên chỉ quan tâm việc mới nhất.
const MAX_TOOL_ROWS = 5;

// Giãn cách giữa hai dòng tra cứu liên tiếp khi nhả ra màn hình. 1s vẫn đọc ra như hiện cùng lúc.
const TOOL_REVEAL_MS = 3000;

// 3 chấm nhảy kiểu "đang gõ" (typing). Dùng cho lúc suy nghĩ ban đầu ("Đang suy nghĩ").
function TypingDots() {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      {[0, 1, 2].map((i) => (
        <Box
          key={i}
          sx={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            bgcolor: 'text.disabled',
            animation: 'finextTyping 1.1s ease-in-out infinite',
            animationDelay: `${i * 0.16}s`,
            '@keyframes finextTyping': { '0%, 70%, 100%': { opacity: 0.25, transform: 'translateY(0)' }, '35%': { opacity: 1, transform: 'translateY(-3px)' } }
          }}
        />
      ))}
    </Box>
  );
}

// Chờ token/tool đầu tiên (bong bóng rỗng): "Đang suy nghĩ" + chấm typing.
function TypingIndicator() {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, py: 0.5 }}>
      <Typography sx={{ fontSize: getResponsiveFontSize('sm'), color: 'text.secondary' }}>Đang suy nghĩ</Typography>
      {/* Nudge chấm xuống ~3px cho cân optical-center của chữ (dấu tiếng Việt đẩy trọng tâm chữ xuống). */}
      <Box sx={{ mt: '3px' }}><TypingDots /></Box>
    </Box>
  );
}

function MessageBubbleBase({ message }: { message: ChatMessage }) {
  const theme = useTheme();
  const isUser = message.role === 'user';
  const streaming = message.status === 'streaming';

  // Vị trí các dòng tra cứu ĐANG hiện: dòng nào đã có chữ trả lời phía sau thì coi như xong, ẩn đi.
  const visibleTools = streaming
    ? message.parts.reduce<number[]>((acc, p, i) => {
        if (p.kind !== 'tool') return acc;
        const answered = message.parts.some((q, j) => j > i && q.kind === 'text' && q.text.trim() !== '');
        if (!answered) acc.push(i);
        return acc;
      }, [])
    : [];
  // Backend chạy các tool của một vòng SONG SONG nên tool_start về gần như cùng lúc, đổ ập 4-5
  // dòng một lúc. Nhả dần từng dòng cho mắt kịp đọc. Chỉ ảnh hưởng khối tra cứu — câu trả lời
  // vẫn hiện ngay khi có, không chờ hàng đợi này.
  const [revealed, setRevealed] = useState(0);
  const pendingTools = visibleTools.length;
  useEffect(() => {
    if (revealed >= pendingTools) return;
    // Dòng đầu hiện ngay để không có quãng trống sau "Đang suy nghĩ"; các dòng sau giãn đều.
    const timer = window.setTimeout(() => setRevealed((r) => r + 1), revealed === 0 ? 0 : TOOL_REVEAL_MS);
    return () => window.clearTimeout(timer);
  }, [revealed, pendingTools]);

  // Giữ 5 dòng MỚI NHẤT chứ không phải 5 dòng đầu: khối này là màn hình theo dõi trực tiếp và
  // biến mất ngay khi câu trả lời bắt đầu, nên việc ĐANG chạy đáng giữ hơn việc đã xong.
  const revealedTools = visibleTools.slice(0, revealed);
  const shownTools = revealedTools.slice(-MAX_TOOL_ROWS);
  const overflowed = revealedTools.length > shownTools.length;
  return (
    <Box sx={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', mb: 2 }}>
      <Box
        sx={{
          maxWidth: isUser ? '80%' : '100%',
          px: isUser ? 2 : 0,
          py: isUser ? 1.25 : 0,
          borderRadius: 2,
          bgcolor: isUser ? alpha(theme.palette.primary.main, 0.1) : 'transparent',
        }}
      >
        {isUser ? (
          <Typography sx={{ fontSize: getResponsiveFontSize('md'), whiteSpace: 'pre-wrap' }}>{message.content}</Typography>
        ) : (
          <>
            {message.parts.length === 0 && streaming ? (
              <TypingIndicator />
            ) : (
              // Render theo THỨ TỰ thời gian: text → dòng tra cứu → text.
              message.parts.map((part, i) => {
                if (part.kind === 'text') return <AssistantText key={i} text={part.text} streaming={streaming} />;
                // Dòng tra cứu nằm ngoài cửa sổ 5 dòng (hoặc đã có câu trả lời) thì không vẽ.
                const pos = shownTools.indexOf(i);
                if (pos === -1) return <Fragment key={i} />;
                return (
                  <ToolChip
                    key={i}
                    tool={part}
                    // Dòng cuối KHÔNG có đường nối — đoạn kẻ thò xuống chỗ trống trông thừa.
                    // Tín hiệu "vẫn đang làm" do chữ mô tả của dòng tiêu điểm đảm nhiệm (xem ToolChip).
                    connected={pos < shownTools.length - 1}
                    // Tiêu điểm là dòng đang chạy, hoặc dòng mới nhất nếu vòng tool đã xong hết —
                    // luôn có đúng một dòng sáng, các dòng còn lại lùi lại.
                    active={part.running || pos === shownTools.length - 1}
                    fading={overflowed && pos === 0}
                  />
                );
              })
            )}
          </>
        )}
      </Box>
    </Box>
  );
}

// memo: message dài + stream token → chỉ re-render bubble có parts đổi.
export default memo(MessageBubbleBase);

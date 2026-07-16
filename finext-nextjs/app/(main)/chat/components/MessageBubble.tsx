'use client';

import { Fragment, memo } from 'react';
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
    <Box sx={{ fontSize: getResponsiveFontSize('md'), lineHeight: 1.72, '& p': { my: 1 }, '& ul, & ol': { my: 1, pl: 3 }, '& li': { mb: 0.5 }, '& h3': { fontSize: '1.05rem', fontWeight: 700, mt: 2.5, mb: 1, letterSpacing: '-0.01em' }, '& h2': { fontSize: '1.15rem', fontWeight: 700, mt: 2.5, mb: 1 }, '& strong': { fontWeight: 650 } }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Bảng kiểu Claude: KHÔNG khung/grid — chỉ 1 vạch dưới header, hàng thân viền rất mờ.
          // Cột đầu = nhãn canh trái (flush-left), các cột sau = số canh phải + tabular-nums (nhất quán).
          table: ({ children }) => (
            <Box sx={{ my: 2, overflowX: 'auto' }}>
              <Box
                component="table"
                sx={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '0.9rem',
                  lineHeight: 1.5,
                  '& th, & td': { px: 2, py: 1.15, textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' },
                  '& th:first-of-type, & td:first-of-type': { pl: 0, textAlign: 'left', whiteSpace: 'normal' },
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
          td: ({ children }) => <Box component="td">{children}</Box>,
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

// Chờ token/tool đầu tiên: bong bóng rỗng trông như treo → hiện "đang suy nghĩ" + chấm nhảy.
function TypingIndicator() {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, py: 0.5 }}>
      <Typography sx={{ fontSize: getResponsiveFontSize('sm'), color: 'text.secondary' }}>Finext AI đang suy nghĩ</Typography>
      <Box sx={{ display: 'flex', gap: 0.4 }}>
        {[0, 1, 2].map((i) => (
          <Box
            key={i}
            sx={{
              width: 5,
              height: 5,
              borderRadius: '50%',
              bgcolor: 'text.disabled',
              animation: 'finextTyping 1.2s ease-in-out infinite',
              animationDelay: `${i * 0.2}s`,
              '@keyframes finextTyping': { '0%, 60%, 100%': { opacity: 0.25 }, '30%': { opacity: 1 } }
            }}
          />
        ))}
      </Box>
    </Box>
  );
}

function MessageBubbleBase({ message }: { message: ChatMessage }) {
  const theme = useTheme();
  const isUser = message.role === 'user';
  const streaming = message.status === 'streaming';
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
        ) : message.parts.length === 0 && streaming ? (
          <TypingIndicator />
        ) : (
          // Render theo THỨ TỰ thời gian: text → dòng tra cứu → text.
          message.parts.map((part, i) => {
            if (part.kind === 'text') return <AssistantText key={i} text={part.text} streaming={streaming} />;
            // Dòng tra cứu: ẩn NGAY khi đã có đoạn văn bản SAU nó (model bắt đầu nhả câu trả lời) — hoặc khi xong.
            const answered = message.parts.some((p, j) => j > i && p.kind === 'text' && p.text.trim() !== '');
            return streaming && !answered ? <ToolChip key={i} tool={part} /> : <Fragment key={i} />;
          })
        )}
      </Box>
    </Box>
  );
}

// memo: message dài + stream token → chỉ re-render bubble có parts đổi.
export default memo(MessageBubbleBase);

'use client';

import { Fragment, memo } from 'react';
import type { ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Box, Skeleton, Table, TableBody, TableCell, TableHead, TableRow, Typography, alpha, useTheme } from '@mui/material';
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

// Rút text thô từ children của 1 ô để đoán cột số.
function cellText(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(cellText).join('');
  if (typeof node === 'object' && 'props' in node) return cellText((node as { props?: { children?: ReactNode } }).props?.children);
  return '';
}
// Ô số: chỉ chứa số + dấu +/−/%/,/. /khoảng trắng và có ít nhất 1 chữ số.
function isNumericCell(node: ReactNode): boolean {
  const t = cellText(node).trim();
  return t !== '' && /\d/.test(t) && /^[+\-−(]?[\d.,%\s)]+$/.test(t);
}

function MarkdownBody({ text }: { text: string }) {
  const theme = useTheme();
  return (
    <Box sx={{ fontSize: getResponsiveFontSize('md'), lineHeight: 1.72, '& p': { my: 1 }, '& ul, & ol': { my: 1, pl: 3 }, '& li': { mb: 0.5 }, '& h3': { fontSize: '1.05rem', fontWeight: 700, mt: 2.5, mb: 1, letterSpacing: '-0.01em' }, '& h2': { fontSize: '1.15rem', fontWeight: 700, mt: 2.5, mb: 1 }, '& strong': { fontWeight: 650 } }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          table: ({ children }) => (
            <Box sx={{ my: 1.75, border: `1px solid ${alpha(theme.palette.divider, 0.6)}`, borderRadius: 2, overflowX: 'auto', boxShadow: theme.palette.mode === 'dark' ? '0 1px 3px rgba(0,0,0,0.4)' : '0 1px 3px rgba(0,0,0,0.06)' }}>
              <Table size="small" sx={{ '& td, & th': { borderColor: alpha(theme.palette.divider, 0.6) } }}>{children}</Table>
            </Box>
          ),
          thead: ({ children }) => <TableHead sx={{ '& th': { bgcolor: alpha(theme.palette.text.primary, 0.04) } }}>{children}</TableHead>,
          tbody: ({ children }) => <TableBody>{children}</TableBody>,
          tr: ({ children }) => <TableRow sx={{ '&:hover': { bgcolor: alpha(theme.palette.text.primary, 0.025) } }}>{children}</TableRow>,
          th: ({ children, style }) => (
            <TableCell sx={{ fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.03em', color: 'text.secondary', whiteSpace: 'nowrap', textAlign: (style?.textAlign as 'left' | 'right' | 'center') ?? (isNumericCell(children) ? 'right' : 'left'), py: 1.25 }}>
              {children}
            </TableCell>
          ),
          td: ({ children, style }) => {
            const numeric = isNumericCell(children);
            const align = (style?.textAlign as 'left' | 'right' | 'center') ?? (numeric ? 'right' : 'left');
            return (
              <TableCell sx={{ textAlign: align, fontVariantNumeric: 'tabular-nums', whiteSpace: numeric ? 'nowrap' : 'normal', py: 1.25 }}>{children}</TableCell>
            );
          },
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

// Chờ token/tool đầu tiên: bong bóng rỗng trông như treo → hiện "đang soạn" + chấm nhảy.
function TypingIndicator() {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, py: 0.5 }}>
      <Typography sx={{ fontSize: getResponsiveFontSize('sm'), color: 'text.secondary' }}>Finext AI đang soạn</Typography>
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
          // Render theo THỨ TỰ thời gian: text → dòng tra cứu → text. Dòng tra cứu CHỈ hiện lúc đang
          // stream (xong thì ẩn, chỉ giữ kết quả — owner 2026-07-15).
          message.parts.map((part, i) =>
            part.kind === 'text' ? (
              <AssistantText key={i} text={part.text} streaming={streaming} />
            ) : streaming ? (
              <ToolChip key={i} tool={part} />
            ) : (
              <Fragment key={i} />
            ),
          )
        )}
      </Box>
    </Box>
  );
}

// memo: message dài + stream token → chỉ re-render bubble có parts đổi.
export default memo(MessageBubbleBase);

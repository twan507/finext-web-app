'use client';

import React from 'react';
import { Box, Typography, useTheme, alpha, type Theme } from '@mui/material';
import { getResponsiveFontSize, fontWeight } from 'theme/tokens';
import { getPhaseMeta } from '../phaseMeta';

// Auto-highlight: tên pha → pill màu (đậm, KHÔNG nghiêng); số có dấu +/- và % → tô màu theo dấu (đậm + NGHIÊNG).
const HL_RE = /\b(UPTREND|DOWNTREND|TRANSITION|SIDEWAY)\b|([+\-]\d+(?:[.,]\d+)?%?)/g;

function highlightNodes(text: string, theme: Theme, kb: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  HL_RE.lastIndex = 0;
  while ((m = HL_RE.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) {
      const c = getPhaseMeta(m[1].toLowerCase()).color(theme);
      out.push(
        <Box
          key={`${kb}-${i}`}
          component="span"
          sx={{ fontWeight: fontWeight.bold, fontStyle: 'normal', fontSize: '0.86em', color: c, bgcolor: alpha(c, 0.15), borderRadius: 999, px: 0.6, py: 0.1, whiteSpace: 'nowrap' }}
        >
          {m[1]}
        </Box>,
      );
    } else if (m[2]) {
      const pos = m[2][0] === '+';
      out.push(
        <Box
          key={`${kb}-${i}`}
          component="span"
          sx={{ color: pos ? theme.palette.trend.up : theme.palette.trend.down, fontWeight: fontWeight.semibold, fontStyle: 'italic', fontVariantNumeric: 'tabular-nums' }}
        >
          {m[2]}
        </Box>,
      );
    }
    last = HL_RE.lastIndex;
    i++;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Tách câu mở đầu (lede) khỏi phần còn lại. */
function splitLede(t: string): [string, string] {
  const m = t.match(/^([\s\S]*?[.!?])\s([\s\S]*)$/);
  return m ? [m[1], m[2]] : [t, ''];
}

interface AiCommentBodyProps {
  paragraphs: string[]; // các đoạn (đã lọc non-empty)
  dropCap?: boolean; // C: drop cap chữ đầu (market + danh mục); A+B (chỉ số) = false
  accentColor?: string; // màu drop cap (mặc định primary)
}

/**
 * Thân text "Nhận định AI": câu mở đầu in đậm+nghiêng (lede) · auto-highlight pha/số · (tùy chọn) drop cap · đo dòng.
 * KHÔNG đổi nội dung — chỉ typography. Bold đều nghiêng (trừ pill pha).
 */
export default function AiCommentBody({ paragraphs, dropCap = false, accentColor }: AiCommentBodyProps) {
  const theme = useTheme();
  const accent = accentColor ?? theme.palette.primary.main;
  const base = {
    fontSize: getResponsiveFontSize('md'),
    lineHeight: 1.7,
    color: 'text.secondary',
    textAlign: 'justify' as const,
    whiteSpace: 'pre-line' as const,
  };

  return (
    <>
      {paragraphs.map((p, pi) => {
        if (pi === 0) {
          const [lede, rest] = splitLede(p);
          return (
            <Typography
              key={pi}
              sx={{
                ...base,
                mt: 0,
                ...(dropCap && {
                  '&::first-letter': {
                    float: 'left',
                    fontSize: '3.1rem',
                    lineHeight: 0.82,
                    fontWeight: fontWeight.extrabold,
                    fontStyle: 'normal',
                    color: accent,
                    pr: '0.12em',
                    mt: '0.04em',
                  },
                }),
              }}
            >
              <Box component="span" sx={{ color: 'text.primary', fontWeight: fontWeight.semibold, fontStyle: 'italic' }}>
                {highlightNodes(lede, theme, `l${pi}`)}
              </Box>
              {rest ? ' ' : ''}
              {highlightNodes(rest, theme, `r${pi}`)}
            </Typography>
          );
        }
        return (
          <Typography key={pi} sx={{ ...base, mt: 1.5 }}>
            {highlightNodes(p, theme, `p${pi}`)}
          </Typography>
        );
      })}
    </>
  );
}

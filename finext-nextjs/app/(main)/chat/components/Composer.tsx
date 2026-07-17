'use client';

import { forwardRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Box, Chip, IconButton, TextField, Typography, alpha, useMediaQuery, useTheme } from '@mui/material';
import { ArrowUpwardRounded, PsychologyRounded, StopRounded } from '@mui/icons-material';
import { getResponsiveFontSize, transitions } from 'theme/tokens';

interface ComposerProps {
  disabled: boolean;
  streaming: boolean;
  onSend: (t: string) => void;
  onStop: () => void;
  thinking: boolean;
  onToggleThinking: () => void;
  centered?: boolean; // true = khối nổi ở GIỮA (empty state), không dính đáy; false = dính đáy viewport khi đã chat.
}

const DISCLAIMER = 'Thông tin tham khảo, không phải khuyến nghị đầu tư. AI có thể nhầm lẫn — kiểm tra số liệu quan trọng.';

const Composer = forwardRef<HTMLDivElement, ComposerProps>(function Composer(
  { disabled, streaming, onSend, onStop, thinking, onToggleThinking, centered = false },
  ref,
) {
  const theme = useTheme();
  const [text, setText] = useState('');
  const isDark = theme.palette.mode === 'dark';
  // Mobile: placeholder NGẮN để không wrap 2 dòng; desktop: đầy đủ.
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'), { noSsr: true });
  const placeholder = isMobile ? 'Hỏi Finext AI…' : 'Hỏi Finext AI về thị trường, cổ phiếu, nhóm ngành…';
  // Quầng gradient màu chủ đề kiểu Gemini: centered rõ hơn, bottom subtle; dark đậm hơn light. (Owner: tăng cường độ.)
  const glowAlpha = centered ? (isDark ? 0.34 : 0.2) : isDark ? 0.24 : 0.14;
  const glow = (
    <Box
      aria-hidden
      sx={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        width: centered ? '150%' : '128%',
        height: centered ? '320%' : '190%',
        borderRadius: '50%',
        background: `radial-gradient(ellipse at center, ${alpha(theme.palette.primary.main, glowAlpha)} 0%, transparent 70%)`,
        filter: `blur(${centered ? 34 : 22}px)`,
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  );

  const submit = () => {
    const t = text.trim();
    if (!t || disabled) return;
    onSend(t);
    setText('');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    // Enter gửi, Shift+Enter xuống dòng. Khi đang stream không gửi (nút là Dừng).
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!streaming) submit();
    }
  };

  return (
    <Box
      ref={ref}
      sx={
        centered
          ? { width: '100%', px: { xs: 2, md: 3 } } // GIỮA màn hình: glow do PageContent lo (trùm cả lời chào)
          : { position: 'sticky', bottom: 0, zIndex: 2, px: { xs: 2, md: 3 }, pt: 3, pb: 2, overflow: 'hidden', background: `linear-gradient(to top, ${theme.palette.background.default} 55%, transparent)` }
      }
    >
      <Box sx={{ maxWidth: 760, mx: 'auto', width: '100%' }}>
        <Box sx={{ position: 'relative' }}>
          {!centered && glow /* bottom state: glow nội bộ; centered: glow chung ở PageContent trùm cả lời chào */}
          {/* Khung chat kiểu DeepSeek: input TRÊN (full-width), hàng nút DƯỚI trong khung (trái = Suy nghĩ sâu, phải = gửi/dừng). */}
          <Box
            sx={{
              position: 'relative',
              zIndex: 1, // khung NỔI trên lớp glow
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
              px: 2,
              pt: 1.5,
              pb: 0.75,
              borderRadius: '24px',
              border: `1px solid ${theme.palette.divider}`,
              bgcolor: theme.palette.background.default,
              boxShadow: isDark ? '0 1px 8px rgba(0,0,0,0.4)' : '0 1px 8px rgba(0,0,0,0.06)',
              transition: transitions.colors,
              '&:focus-within': { borderColor: alpha(theme.palette.primary.main, 0.5) },
            }}
          >
            <TextField
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={disabled}
              placeholder={placeholder}
              multiline
              minRows={1}
              maxRows={8}
              variant="standard"
              fullWidth
              InputProps={{ disableUnderline: true, sx: { fontSize: getResponsiveFontSize('md'), py: 0.25 } }}
            />
            {/* Hàng nút DƯỚI trong khung. */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
              <Chip
                icon={<PsychologyRounded />}
                label="Suy nghĩ sâu"
                size="small"
                clickable
                onClick={onToggleThinking}
                aria-pressed={thinking}
                sx={{
                  height: 30,
                  borderRadius: '999px',
                  border: '1px solid',
                  fontSize: getResponsiveFontSize('xs'),
                  fontWeight: 600,
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  '& .MuiChip-icon': { color: 'inherit', fontSize: 17, ml: 0.75 },
                  '& .MuiChip-label': { px: 0.9 },
                  ...(thinking
                    ? {
                        color: '#fff',
                        borderColor: 'transparent',
                        background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.light} 100%)`,
                        boxShadow: `0 2px 12px ${alpha(theme.palette.primary.main, 0.45)}`,
                        '&:hover': { background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)` },
                      }
                    : {
                        color: 'text.secondary',
                        borderColor: theme.palette.divider,
                        bgcolor: 'transparent',
                        '&:hover': {
                          color: 'primary.main',
                          borderColor: alpha(theme.palette.primary.main, 0.5),
                          bgcolor: alpha(theme.palette.primary.main, 0.06),
                        },
                      }),
                }}
              />
              {streaming ? (
                <IconButton
                  aria-label="Dừng"
                  onClick={onStop}
                  sx={{ flexShrink: 0, bgcolor: alpha(theme.palette.error.main, 0.12), color: 'error.main', '&:hover': { bgcolor: alpha(theme.palette.error.main, 0.2) } }}
                >
                  <StopRounded />
                </IconButton>
              ) : (
                <IconButton
                  aria-label="Gửi"
                  onClick={submit}
                  disabled={disabled || text.trim() === ''}
                  sx={{
                    flexShrink: 0,
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    '&:hover': { bgcolor: 'primary.dark' },
                    '&.Mui-disabled': { bgcolor: alpha(theme.palette.text.primary, 0.08), color: 'text.disabled' },
                  }}
                >
                  <ArrowUpwardRounded />
                </IconButton>
              )}
            </Box>
          </Box>
        </Box>
        {/* Disclaimer chỉ hiện khi ĐÃ chat (composer về đáy), không hiện ở màn hình chào giữa. */}
        {!centered && (
          <Typography sx={{ fontSize: getResponsiveFontSize('xxs'), color: 'text.disabled', textAlign: 'center', mt: 0.75 }}>{DISCLAIMER}</Typography>
        )}
      </Box>
    </Box>
  );
});

export default Composer;

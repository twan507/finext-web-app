'use client';

import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Box, Chip, IconButton, TextField, Tooltip, Typography, alpha, useTheme } from '@mui/material';
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

export default function Composer({ disabled, streaming, onSend, onStop, thinking, onToggleThinking, centered = false }: ComposerProps) {
  const theme = useTheme();
  const [text, setText] = useState('');
  const isDark = theme.palette.mode === 'dark';
  // Quầng gradient màu chủ đề kiểu Gemini: centered rõ hơn, bottom subtle; dark đậm hơn light.
  const glowAlpha = centered ? (isDark ? 0.2 : 0.13) : isDark ? 0.14 : 0.09;
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
      sx={
        centered
          ? { width: '100%', px: { xs: 2, md: 3 }, py: { xs: 4, md: 6 }, overflow: 'hidden' } // GIỮA màn hình: khối nổi thường; overflow:hidden ôm quầng glow, không tràn ngang
          : { position: 'sticky', bottom: 0, zIndex: 2, px: { xs: 2, md: 3 }, pt: 3, pb: 2, overflow: 'hidden', background: `linear-gradient(to top, ${theme.palette.background.default} 55%, transparent)` }
      }
    >
      <Box sx={{ maxWidth: 760, mx: 'auto', width: '100%' }}>
        <Box sx={{ position: 'relative' }}>
          {glow}
          <Box
          sx={{
            position: 'relative',
            zIndex: 1, // hộp input NỔI trên lớp glow
            display: 'flex',
            alignItems: 'center', // chữ nằm GIỮA theo chiều dọc (bỏ khoảng dư trên)
            gap: 0.75,
            pl: 2,
            pr: 0.75,
            py: 0.75,
            borderRadius: '26px', // bo tròn kiểu ChatGPT — thanh thoát hơn
            border: `1px solid ${theme.palette.divider}`,
            bgcolor: theme.palette.background.default,
            boxShadow: theme.palette.mode === 'dark' ? '0 1px 8px rgba(0,0,0,0.4)' : '0 1px 8px rgba(0,0,0,0.06)',
            transition: transitions.colors,
            '&:focus-within': { borderColor: alpha(theme.palette.primary.main, 0.5) }
          }}
        >
          <TextField
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={disabled}
            placeholder="Hỏi Finext AI về thị trường, cổ phiếu, nhóm ngành…"
            multiline
            minRows={1}
            maxRows={6}
            variant="standard"
            fullWidth
            InputProps={{ disableUnderline: true, sx: { fontSize: getResponsiveFontSize('md'), py: 0.25 } }}
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
                '&.Mui-disabled': { bgcolor: alpha(theme.palette.text.primary, 0.08), color: 'text.disabled' }
              }}
            >
              <ArrowUpwardRounded />
            </IconButton>
          )}
          </Box>
        </Box>
        {/* Toggle "Suy nghĩ sâu" — chip nhỏ dưới thanh input, canh trái. */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-start', mt: 1, px: 0.5, position: 'relative', zIndex: 1 }}>
          <Tooltip title="Trả lời kỹ hơn nhưng chậm hơn" arrow>
            <Chip
              icon={<PsychologyRounded />}
              label="Suy nghĩ sâu"
              size="small"
              clickable
              onClick={onToggleThinking}
              aria-pressed={thinking}
              variant={thinking ? 'filled' : 'outlined'}
              color={thinking ? 'primary' : 'default'}
              sx={{
                fontSize: getResponsiveFontSize('xs'),
                fontWeight: 500,
                transition: transitions.colors,
                '& .MuiChip-icon': { color: 'inherit' },
                ...(thinking ? {} : { color: 'text.secondary', borderColor: theme.palette.divider }),
              }}
            />
          </Tooltip>
        </Box>
        {/* Disclaimer chỉ hiện khi ĐÃ chat (composer về đáy), không hiện ở màn hình chào giữa. */}
        {!centered && (
          <Typography sx={{ fontSize: getResponsiveFontSize('xxs'), color: 'text.disabled', textAlign: 'center', mt: 0.75 }}>{DISCLAIMER}</Typography>
        )}
      </Box>
    </Box>
  );
}

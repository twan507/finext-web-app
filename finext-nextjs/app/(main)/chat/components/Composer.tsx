'use client';

import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Box, IconButton, TextField, Typography, alpha, useTheme } from '@mui/material';
import { SendRounded, StopRounded } from '@mui/icons-material';
import { getResponsiveFontSize, borderRadius, transitions } from 'theme/tokens';

interface ComposerProps {
  disabled: boolean;
  streaming: boolean;
  onSend: (t: string) => void;
  onStop: () => void;
}

const DISCLAIMER = 'Thông tin tham khảo, không phải khuyến nghị đầu tư. AI có thể nhầm lẫn — kiểm tra số liệu quan trọng.';

export default function Composer({ disabled, streaming, onSend, onStop }: ComposerProps) {
  const theme = useTheme();
  const [text, setText] = useState('');

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
    <Box sx={{ position: 'sticky', bottom: 0, zIndex: 2, bgcolor: 'background.default', borderTop: `1px solid ${theme.palette.divider}`, px: { xs: 2, md: 3 }, py: 1.5 }}>
      <Box sx={{ maxWidth: 760, mx: 'auto', width: '100%' }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 1,
            p: 1,
            borderRadius: `${borderRadius.lg}px`,
            border: `1px solid ${theme.palette.divider}`,
            bgcolor: alpha(theme.palette.text.primary, 0.02),
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
            InputProps={{ disableUnderline: true, sx: { fontSize: getResponsiveFontSize('md'), px: 1, py: 0.5 } }}
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
              <SendRounded />
            </IconButton>
          )}
        </Box>
        <Typography sx={{ fontSize: getResponsiveFontSize('xxs'), color: 'text.disabled', textAlign: 'center', mt: 0.75 }}>{DISCLAIMER}</Typography>
      </Box>
    </Box>
  );
}

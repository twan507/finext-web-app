'use client';

import { Box, Stack, Typography, alpha, useTheme } from '@mui/material';
import { AutoAwesomeRounded } from '@mui/icons-material';
import { getResponsiveFontSize, fontWeight, borderRadius, transitions } from 'theme/tokens';

const PROMPTS = ['VN-Index hôm nay thế nào?', 'FPT giá bao nhiêu?', 'So sánh HPG và HSG', 'Nhóm ngành nào đang mạnh?'];

export default function EmptyState({ onPick }: { onPick: (t: string) => void }) {
  const theme = useTheme();
  return (
    <Box sx={{ height: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', px: 2, gap: 3 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
        <AutoAwesomeRounded sx={{ fontSize: 40, color: 'primary.main' }} />
        <Typography sx={{ fontSize: getResponsiveFontSize('xxl'), fontWeight: fontWeight.bold }}>Finext AI</Typography>
        <Typography sx={{ fontSize: getResponsiveFontSize('sm'), color: 'text.secondary', maxWidth: 440 }}>
          Hỏi đáp về thị trường, cổ phiếu và nhóm ngành bằng ngôn ngữ tự nhiên.
        </Typography>
      </Box>
      <Stack direction="row" sx={{ flexWrap: 'wrap', justifyContent: 'center', gap: 1, maxWidth: 560 }}>
        {PROMPTS.map((p) => (
          <Box
            key={p}
            component="button"
            onClick={() => onPick(p)}
            sx={{
              cursor: 'pointer',
              font: 'inherit',
              px: 2,
              py: 1,
              borderRadius: `${borderRadius.pill}px`,
              border: `1px solid ${theme.palette.divider}`,
              bgcolor: alpha(theme.palette.text.primary, 0.02),
              color: 'text.primary',
              fontSize: getResponsiveFontSize('sm'),
              transition: transitions.colors,
              '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.08), borderColor: alpha(theme.palette.primary.main, 0.4) }
            }}
          >
            {p}
          </Box>
        ))}
      </Stack>
    </Box>
  );
}

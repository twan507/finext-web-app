'use client';

import { Box, Typography, alpha, useTheme } from '@mui/material';
import { getResponsiveFontSize, fontWeight, borderRadius } from 'theme/tokens';

interface SessionDiagnosisProps {
  /** Các đoạn diễn giải cần render (đoạn rỗng/thiếu bị bỏ qua). */
  paragraphs: (string | null | undefined)[];
  generatedAt?: string;
  /** false = bỏ ô glyph ✦ bên trái (style giống khối 3 danh mục — đỡ mất lề trái). */
  showGlyph?: boolean;
  /** Nhãn nhận định cạnh badge (vd "Nhận định thị trường" / "Nhận định chỉ số"). */
  label?: string;
}

function formatTime(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Khối "FINEXT AI" (trên nền, không card): các đoạn diễn giải căn đều 2 bên + giờ. showGlyph=false bỏ ô ✦ trái. */
export default function SessionDiagnosis({ paragraphs, generatedAt, showGlyph = true, label }: SessionDiagnosisProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const primary = theme.palette.primary.main;
  const time = formatTime(generatedAt);
  const texts = paragraphs.filter((t): t is string => !!t && t.trim().length > 0);
  if (texts.length === 0) return null;

  // Dấu · phân tách — đứng riêng (căn giữa 2 mục), màu như nhãn (không mờ).
  const metaDot = <Box component="span" sx={{ color: 'text.secondary', fontWeight: fontWeight.medium, fontSize: getResponsiveFontSize('sm'), lineHeight: 1 }}>·</Box>;

  const body = (
    <Box sx={{ minWidth: 0, flex: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1, flexWrap: 'wrap' }}>
        <Box
          component="span"
          sx={{
            fontSize: getResponsiveFontSize('xs'),
            fontWeight: fontWeight.bold,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: 'primary.main',
            bgcolor: alpha(primary, 0.12),
            border: `1px solid ${alpha(primary, 0.3)}`,
            borderRadius: 999,
            px: 1,
            py: 0.25,
          }}
        >
          {showGlyph ? 'FINEXT AI' : '✦ FINEXT AI'}
        </Box>
        {label && (
          <>
            {metaDot}
            <Typography sx={{ fontSize: getResponsiveFontSize('sm'), color: 'text.secondary', fontWeight: fontWeight.medium }}>{label}</Typography>
          </>
        )}
        {time && (
          <>
            {metaDot}
            <Typography sx={{ fontSize: getResponsiveFontSize('xs'), color: 'text.disabled' }}>Cập nhật lúc {time}</Typography>
          </>
        )}
      </Box>
      {texts.map((t, i) => (
        <Typography key={i} sx={{ fontSize: getResponsiveFontSize('md'), lineHeight: 1.6, color: 'text.secondary', whiteSpace: 'pre-line', textAlign: 'justify', mt: i === 0 ? 0 : 1.5 }}>
          {t}
        </Typography>
      ))}
    </Box>
  );

  if (!showGlyph) return body;

  return (
    <Box sx={{ display: 'flex', gap: 2 }}>
      <Box
        sx={{
          width: 44,
          height: 44,
          flexShrink: 0,
          borderRadius: `${borderRadius.md}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.2rem',
          color: primary,
          background: `linear-gradient(145deg, ${alpha(primary, 0.25)}, ${alpha(primary, 0.06)})`,
          border: `1px solid ${alpha(primary, 0.4)}`,
          boxShadow: isDark ? `0 0 20px ${alpha(primary, 0.25)}` : `0 2px 12px ${alpha(primary, 0.18)}`,
        }}
      >
        ✦
      </Box>
      {body}
    </Box>
  );
}

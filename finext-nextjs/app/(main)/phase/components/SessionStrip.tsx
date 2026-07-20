'use client';

import { Box, Tooltip, Typography, alpha, useTheme } from '@mui/material';
import { getGlassCard, getResponsiveFontSize, fontWeight, borderRadius } from 'theme/tokens';
import { getPhaseMeta } from '../phaseMeta';

interface SessionStripProps {
  dates: string[]; // cũ → mới (trái → phải)
  phaseByDate: Map<string, string>; // date → phase_label (để tô màu pha từng ô)
  selected: string;
  onSelect: (d: string) => void;
}

function fmtDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
}

/**
 * Thanh chọn phiên (tối đa 20 ô, cũ → mới) — xem lại snapshot 3 bảng "Vận hành danh mục" ở phiên quá khứ.
 * Mỗi ô tô màu theo pha thị trường phiên đó (phase_daily); ô đang chọn sáng + có ring/glow.
 * Style ô copy từ dải "10 phiên gần nhất" của PhaseHero (14×20, bo 4px).
 */
export default function SessionStrip({ dates, phaseByDate, selected, onSelect }: SessionStripProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const latest = dates.length ? dates[dates.length - 1] : '';
  const isLatest = selected === latest;
  // Tooltip nền glass — dùng chung style với dải "10 phiên gần nhất" ở PhaseHero.
  const glassTooltipSx = { ...getGlassCard(isDark), color: theme.palette.text.primary, px: 1.25, py: 0.75, borderRadius: `${borderRadius.md}px` };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, alignItems: { xs: 'flex-start', md: 'flex-end' } }}>
      <Box sx={{ display: 'flex', gap: 0.5 }}>
        {dates.map((d) => {
          const label = phaseByDate.get(d);
          const meta = label ? getPhaseMeta(label) : null;
          const c = meta ? meta.color(theme) : theme.palette.text.disabled;
          const isSel = d === selected;
          return (
            <Tooltip
              key={d}
              placement="top"
              slotProps={{ tooltip: { sx: glassTooltipSx } }}
              title={
                <Box sx={{ textAlign: 'left' }}>
                  <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary', fontWeight: fontWeight.medium }}>{fmtDate(d)}</Typography>
                  {meta && <Typography sx={{ fontSize: '0.8rem', color: c, fontWeight: fontWeight.bold }}>{meta.en}</Typography>}
                </Box>
              }
            >
              <Box
                role="button"
                tabIndex={0}
                aria-label={`Xem phiên ${fmtDate(d)}`}
                onClick={() => onSelect(d)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(d);
                  }
                }}
                sx={{
                  width: 14,
                  height: 20,
                  borderRadius: '4px',
                  cursor: 'pointer',
                  bgcolor: alpha(c, isSel ? 0.95 : 0.4),
                  border: `1px solid ${isSel ? alpha(c, 0.9) : 'transparent'}`,
                  boxShadow: isSel ? `0 0 10px ${alpha(c, isDark ? 0.85 : 0.5)}` : 'none',
                  transition: 'background-color 120ms, box-shadow 120ms, transform .12s ease',
                  '&:hover': { bgcolor: alpha(c, isSel ? 0.95 : 0.7), transform: 'translateY(-2px)' },
                }}
              />
            </Tooltip>
          );
        })}
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Typography sx={{ fontSize: getResponsiveFontSize('sm'), color: 'text.primary', fontWeight: fontWeight.semibold, fontVariantNumeric: 'tabular-nums' }}>
          {fmtDate(selected)}
        </Typography>
        <Typography sx={{ fontSize: '0.66rem', color: 'text.disabled' }}>Xem lại tối đa 20 phiên</Typography>
        {!isLatest && latest && (
          <Box
            component="button"
            onClick={() => onSelect(latest)}
            sx={{
              cursor: 'pointer',
              border: `1px solid ${alpha(theme.palette.primary.main, 0.4)}`,
              bgcolor: alpha(theme.palette.primary.main, 0.12),
              color: theme.palette.primary.main,
              borderRadius: 999,
              px: 1,
              py: 0.25,
              fontSize: '0.66rem',
              fontWeight: fontWeight.semibold,
              lineHeight: 1.4,
            }}
          >
            → Về phiên mới nhất
          </Box>
        )}
      </Box>
    </Box>
  );
}

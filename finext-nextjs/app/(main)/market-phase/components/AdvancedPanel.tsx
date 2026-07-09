'use client';

import { Accordion, AccordionSummary, AccordionDetails, Box, Typography, useTheme } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { getGlassCard, getResponsiveFontSize, fontWeight, borderRadius } from 'theme/tokens';
import type { PhaseDaily } from '../types';

interface AdvancedPanelProps {
  daily: PhaseDaily;
}

type Kind = 'num' | 'pct' | 'onoff' | 'signal';
interface Item {
  label: string;
  key: keyof PhaseDaily;
  kind?: Kind;
}
interface Group {
  title: string;
  items: Item[];
}

// Toàn bộ raw input chẩn đoán của phase_daily (BREADTH / REGIME / DIAG), gom nhóm.
const GROUPS: Group[] = [
  {
    title: 'Độ rộng thị trường',
    items: [
      { label: 'Độ rộng chậm (nền)', key: 'breadth_slow' },
      { label: 'Độ rộng nhanh', key: 'breadth_fast' },
      { label: 'Độ rộng động lượng', key: 'breadth_mom' },
      { label: 'Độ rộng tổng hợp', key: 'breadth_blend' },
      { label: 'Độ rộng phụ trợ', key: 'breadth_aux' },
      { label: 'Độ rộng tuần', key: 'breadth_w' },
      { label: 'Độ rộng tháng', key: 'breadth_m' },
      { label: 'Độ rộng quý', key: 'breadth_q' },
      { label: 'Độ rộng năm', key: 'breadth_y' },
      { label: 'Độ ổn định độ rộng', key: 'conf_breadth' },
    ],
  },
  {
    title: 'Chế độ & thanh khoản',
    items: [
      { label: 'Điểm tổng hợp', key: 'composite_score' },
      { label: 'Thanh khoản dẫn dắt', key: 'vsi_long' },
      { label: 'Tương quan rộng–khoản (60)', key: 'corr60' },
      { label: 'Đồng pha giá 20 phiên', key: 'px_ret20', kind: 'pct' },
      { label: 'Chế độ lọc nhiễu', key: 'regime_active', kind: 'onoff' },
    ],
  },
  {
    title: 'Chẩn đoán',
    items: [
      { label: 'Độ nghiêng xu hướng', key: 'conf_dir' },
      { label: 'Tín hiệu phụ', key: 'sub_signal', kind: 'signal' },
    ],
  },
];

const SUB_SIGNAL_LABEL: Record<string, string> = {
  capitulation_buy_60d: 'Quá bán 60 phiên',
  sideway_bottom_buy: 'Đáy vùng đi ngang',
};

function fmt(v: number | string | null | undefined, kind?: Kind): string {
  if (kind === 'onoff') return v === 1 ? 'Bật' : 'Tắt';
  if (kind === 'signal') {
    if (!v) return '—';
    return SUB_SIGNAL_LABEL[String(v)] ?? String(v);
  }
  if (v == null || (typeof v === 'number' && isNaN(v))) return '—';
  if (typeof v !== 'number') return String(v);
  if (kind === 'pct') return `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`;
  return v.toFixed(2);
}

/** Panel "Chỉ số nâng cao" — toàn bộ chỉ số chẩn đoán phase_daily, mặc định thu gọn, chỉ quan sát. */
export default function AdvancedPanel({ daily }: AdvancedPanelProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Accordion
      disableGutters
      elevation={0}
      sx={{
        mt: 2,
        borderRadius: `${borderRadius.lg}px !important`,
        ...getGlassCard(isDark),
        overflow: 'hidden',
        '&:before': { display: 'none' },
      }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: 'text.disabled' }} />}>
        <Typography sx={{ fontSize: getResponsiveFontSize('sm'), fontWeight: fontWeight.semibold, color: 'text.secondary' }}>
          Chỉ số nâng cao{' '}
          <Box component="span" sx={{ color: 'text.disabled', fontWeight: 400 }}>
            · quan sát nội bộ, không phải khuyến nghị
          </Box>
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        {GROUPS.map((g, gi) => (
          <Box key={g.title} sx={{ mt: gi === 0 ? 0 : 2.5 }}>
            <Typography sx={{ fontSize: getResponsiveFontSize('xs'), textTransform: 'uppercase', letterSpacing: '0.05em', color: 'text.disabled', fontWeight: fontWeight.semibold, mb: 1 }}>
              {g.title}
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(3, 1fr)', lg: 'repeat(5, 1fr)' }, gap: 1.5 }}>
              {g.items.map((it) => (
                <Box key={String(it.key)} sx={{ p: 1.25, borderRadius: `${borderRadius.md}px`, border: `1px solid ${theme.palette.divider}` }}>
                  <Typography sx={{ fontSize: getResponsiveFontSize('xs'), color: 'text.secondary' }}>{it.label}</Typography>
                  <Typography sx={{ fontSize: getResponsiveFontSize('md'), fontWeight: fontWeight.bold, fontVariantNumeric: 'tabular-nums' }}>
                    {fmt(daily[it.key], it.kind)}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        ))}
      </AccordionDetails>
    </Accordion>
  );
}

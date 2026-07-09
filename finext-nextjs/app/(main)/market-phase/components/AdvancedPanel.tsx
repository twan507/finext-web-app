'use client';

import { Accordion, AccordionSummary, AccordionDetails, Box, Stack, Typography, useTheme } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { getGlassCard, getResponsiveFontSize, fontWeight, borderRadius } from 'theme/tokens';
import type { PhaseDaily, PhaseCommentIndicator } from '../types';

interface AdvancedPanelProps {
  daily: PhaseDaily;
  indicators?: PhaseCommentIndicator[]; // diễn giải từng chỉ số (phiên mới nhất)
}

type Kind = 'num' | 'pct' | 'onoff' | 'signal';
interface ValCol {
  label?: string; // sub-label khi 1 khối có nhiều cột
  key: keyof PhaseDaily;
  kind?: Kind;
}
interface Block {
  commentKey: string; // indicator_key để tra comment
  label: string; // nhãn dự phòng (ưu tiên indicator_label_vi từ data)
  cols: ValCol[];
}

// Ánh xạ cột phase_daily → khối chỉ số (mỗi khối = 1 comment).
// 2 khối dùng CHUNG comment cho nhiều cột: đa khung (4) và cảnh báo giảm nhanh (3).
const BLOCKS: Block[] = [
  {
    commentKey: 'do_rong_da_khung',
    label: 'Độ rộng đa khung',
    cols: [
      { label: 'Tuần', key: 'breadth_w' },
      { label: 'Tháng', key: 'breadth_m' },
      { label: 'Quý', key: 'breadth_q' },
      { label: 'Năm', key: 'breadth_y' },
    ],
  },
  { commentKey: 'do_rong_nen', label: 'Độ rộng nền', cols: [{ key: 'breadth_slow' }] },
  {
    commentKey: 'canh_bao_giam_nhanh',
    label: 'Cảnh báo giảm nhanh',
    cols: [
      { label: 'Tổng hợp', key: 'breadth_blend' },
      { label: 'Nhanh', key: 'breadth_fast' },
      { label: 'Động lượng', key: 'breadth_mom' },
    ],
  },
  { commentKey: 'trigger_giam_doc_lap', label: 'Trigger giảm độc lập', cols: [{ key: 'breadth_aux' }] },
  { commentKey: 'do_on_dinh_do_rong', label: 'Độ ổn định độ rộng', cols: [{ key: 'conf_breadth' }] },
  { commentKey: 'diem_xu_huong_1_nam', label: 'Điểm xu hướng 1 năm', cols: [{ key: 'composite_score' }] },
  { commentKey: 'thanh_khoan_dan_dat', label: 'Thanh khoản dẫn dắt', cols: [{ key: 'vsi_long' }] },
  { commentKey: 'dong_pha_rong_khoan', label: 'Đồng pha rộng–khoản', cols: [{ key: 'corr60' }] },
  { commentKey: 'dong_pha_gia_20', label: 'Đồng pha giá 20 phiên', cols: [{ key: 'px_ret20', kind: 'pct' }] },
];

// Không có comment riêng trong bảng này.
const DIAG: ValCol[] = [
  { label: 'Độ nghiêng xu hướng', key: 'conf_dir' },
  { label: 'Tín hiệu phụ', key: 'sub_signal', kind: 'signal' },
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

/** Panel "Chỉ số nâng cao" — mỗi chỉ số kèm diễn giải riêng (phase_comment_indicator), render nguyên văn. */
export default function AdvancedPanel({ daily, indicators }: AdvancedPanelProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const byKey = new Map<string, PhaseCommentIndicator>();
  for (const r of indicators ?? []) byKey.set(r.indicator_key, r);

  const cardSx = { p: { xs: 1.5, md: 2 }, borderRadius: `${borderRadius.md}px`, border: `1px solid ${theme.palette.divider}` };

  return (
    <Accordion
      disableGutters
      elevation={0}
      sx={{ mt: 2, borderRadius: `${borderRadius.lg}px !important`, ...getGlassCard(isDark), overflow: 'hidden', '&:before': { display: 'none' } }}
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
        <Stack spacing={1.5}>
          {BLOCKS.map((b) => {
            const ind = byKey.get(b.commentKey);
            const heading = ind?.indicator_label_vi || b.label;
            return (
              <Box key={b.commentKey} sx={cardSx}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2} sx={{ flexWrap: 'wrap', gap: 1 }}>
                  <Typography sx={{ fontSize: getResponsiveFontSize('sm'), fontWeight: fontWeight.semibold }}>{heading}</Typography>
                  <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap', gap: 1 }}>
                    {b.cols.map((c) => (
                      <Box key={String(c.key)} sx={{ textAlign: 'right', minWidth: 44 }}>
                        {c.label && <Typography sx={{ fontSize: '0.66rem', color: 'text.disabled' }}>{c.label}</Typography>}
                        <Typography sx={{ fontSize: getResponsiveFontSize('md'), fontWeight: fontWeight.bold, fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>
                          {fmt(daily[c.key], c.kind)}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                </Stack>
                {ind?.comment && (
                  <Typography sx={{ mt: 1, fontSize: getResponsiveFontSize('sm'), color: 'text.secondary', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                    {ind.comment}
                  </Typography>
                )}
              </Box>
            );
          })}

          {/* DIAG — không có đoạn diễn giải riêng */}
          <Box sx={cardSx}>
            <Typography sx={{ fontSize: getResponsiveFontSize('xs'), textTransform: 'uppercase', letterSpacing: '0.05em', color: 'text.disabled', fontWeight: fontWeight.semibold, mb: 1 }}>
              Chẩn đoán hướng
            </Typography>
            <Stack direction="row" spacing={4} sx={{ flexWrap: 'wrap', gap: 2 }}>
              {DIAG.map((c) => (
                <Box key={String(c.key)}>
                  <Typography sx={{ fontSize: getResponsiveFontSize('xs'), color: 'text.secondary' }}>{c.label}</Typography>
                  <Typography sx={{ fontSize: getResponsiveFontSize('md'), fontWeight: fontWeight.bold, fontVariantNumeric: 'tabular-nums' }}>{fmt(daily[c.key], c.kind)}</Typography>
                </Box>
              ))}
            </Stack>
          </Box>
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}

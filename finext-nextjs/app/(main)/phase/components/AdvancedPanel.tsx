'use client';

import { Box, useTheme } from '@mui/material';
import type { PhaseDaily, PhaseCommentIndicator } from '../types';
import { getPhaseMeta } from '../phaseMeta';
import AmbientCard from './AmbientCard';
import { DivergingBullet, Segments10, StatBar, IndicatorBlock, NoteItem, divColor, fmtDiv } from './IndicatorViz';

interface AdvancedPanelProps {
  daily: PhaseDaily;
  indicators?: PhaseCommentIndicator[];
}

type VizKind = 'bullet' | 'segments' | 'stat';

interface Ind {
  commentKey: string;
  label: string;
  viz: VizKind;
  key: keyof PhaseDaily;
  domain?: number; // bullet
  pct?: boolean;
  left?: string;
  right?: string;
  // stat (có ngưỡng/biên kinh tế)
  statMin?: number;
  statMax?: number;
  refValue?: number;
  refLabel?: string;
  refValue2?: number; // ngưỡng trên (vd +0.10) → vùng xanh
  refLabel2?: string;
  breaker?: boolean; // true = circuit-breaker (vùng nguy hiểm dưới ngưỡng)
  safeText?: string;
  dangerText?: string;
  posText?: string;
  negText?: string;
  midText?: string; // tầng giữa (chỉ khi có midValue): pos ≥ midValue | mid [0, midValue) | neg < 0
  midValue?: number;
}

// 7 chỉ số (schema phase_daily 12 cột), liệt kê liền mạch: Hướng → Tin cậy → Gate.
const INDICATORS: Ind[] = [
  { commentKey: 'cau_truc_xu_huong_tang', label: 'Cấu trúc xu hướng tăng', viz: 'bullet', key: 'breadth_slow', domain: 1, left: '−1', right: '+1' },
  { commentKey: 'cau_truc_xu_huong_giam', label: 'Cấu trúc xu hướng giảm', viz: 'bullet', key: 'breadth_blend', domain: 1, left: '−1', right: '+1' },
  { commentKey: 'tin_hieu_xu_huong_suy_yeu', label: 'Tín hiệu xu hướng suy yếu', viz: 'bullet', key: 'breadth_aux', domain: 1, left: '−1', right: '+1' },
  { commentKey: 'do_tin_cay_xu_huong', label: 'Độ tin cậy xu hướng', viz: 'segments', key: 'conf_dir', left: 'thấp', right: 'cao' },
  { commentKey: 'do_tin_cay_sideway', label: 'Độ tin cậy Sideway', viz: 'segments', key: 'conf_flat', left: 'thấp', right: 'cao' },
  {
    commentKey: 'dong_pha_xu_huong_thanh_khoan',
    label: 'Đồng pha xu hướng – thanh khoản',
    viz: 'stat',
    key: 'corr60',
    statMin: -1,
    statMax: 1,
    refValue: 0,
    left: '−1',
    refLabel: '0',
    right: '+1',
    posText: 'Cùng nhịp',
    midText: 'Rời nhịp',
    negText: 'Ngược nhịp',
    midValue: 0.35,
  },
  {
    commentKey: 'quan_tinh_bien_dong_gia',
    label: 'Quán tính biến động giá',
    viz: 'stat',
    key: 'px_ret20',
    pct: true,
    statMin: -0.2,
    statMax: 0.2,
    refValue: -0.1,
    refLabel: '−10%',
    refValue2: 0.1,
    refLabel2: '+10%',
    left: '−20%',
    right: '+20%',
    breaker: true,
    safeText: 'Chưa sập nhanh',
    dangerText: 'Đã sập nhanh',
  },
];

/** Panel "Chỉ số nâng cao" — 1 card, 2 cột: viz (trái) · diễn giải (phải), 7 chỉ số liền mạch. */
export default function AdvancedPanel({ daily, indicators }: AdvancedPanelProps) {
  const theme = useTheme();
  const phaseColor = getPhaseMeta(daily.phase_label).color(theme);
  const primary = theme.palette.primary.main;
  const byKey = new Map<string, PhaseCommentIndicator>();
  for (const r of indicators ?? []) byKey.set(r.indicator_key, r);

  const headingOf = (ind: Ind) => byKey.get(ind.commentKey)?.indicator_label_vi || ind.label;

  const statProps = (ind: Ind, v: number | null | undefined) => {
    const has = typeof v === 'number' && !isNaN(v);
    const statMin = ind.statMin ?? -1;
    const statMax = ind.statMax ?? 1;
    const refValue = ind.refValue ?? 0;
    const toPct = (x: number) => Math.max(0, Math.min(100, ((x - statMin) / (statMax - statMin)) * 100));
    const markerPct = has ? toPct(v as number) : 50;
    const refPct = toPct(refValue);
    const refPct2 = ind.refValue2 != null ? toPct(ind.refValue2) : undefined;
    const valueText = fmtDiv(v, ind.pct);
    const numberColor = divColor(theme, v);
    let markerColor: string;
    let statusText: string | undefined;
    let statusColor: string;
    if (ind.breaker) {
      const tripped = has && (v as number) <= refValue;
      markerColor = !has ? theme.palette.text.disabled : tripped ? theme.palette.trend.down : theme.palette.trend.up;
      statusText = has ? (tripped ? ind.dangerText : ind.safeText) : undefined;
      statusColor = markerColor;
    } else {
      markerColor = numberColor;
      if (has) {
        const val = v as number;
        statusText =
          ind.midText != null && ind.midValue != null
            ? val >= ind.midValue
              ? ind.posText
              : val >= 0
                ? ind.midText
                : ind.negText
            : val >= 0
              ? ind.posText
              : ind.negText;
      } else {
        statusText = undefined;
      }
      statusColor = theme.palette.text.secondary;
    }
    const status = statusText ? { text: statusText, color: statusColor } : undefined;
    return { valueText, numberColor, markerColor, status, markerPct, refPct, refPct2 };
  };

  const renderMetric = (ind: Ind) => {
    const heading = headingOf(ind);
    const v = daily[ind.key] as number | null | undefined;
    if (ind.viz === 'segments') {
      const show = typeof v === 'number' && !isNaN(v);
      return (
        <IndicatorBlock key={ind.label} heading={heading} value={show ? (v as number).toFixed(2) : '—'} valueColor={primary}>
          <Segments10 value={v} leftLabel={ind.left ?? ''} rightLabel={ind.right ?? ''} />
        </IndicatorBlock>
      );
    }
    if (ind.viz === 'stat') {
      const p = statProps(ind, v);
      return (
        <IndicatorBlock key={ind.label} heading={heading} value={p.valueText} valueColor={p.numberColor}>
          <StatBar
            markerPct={p.markerPct}
            refPct={p.refPct}
            refPct2={p.refPct2}
            color={p.markerColor}
            leftLabel={ind.left ?? ''}
            refLabel={ind.refLabel ?? ''}
            refLabel2={ind.refLabel2}
            rightLabel={ind.right ?? ''}
            status={p.status}
            breaker={!!ind.breaker}
          />
        </IndicatorBlock>
      );
    }
    return (
      <IndicatorBlock key={ind.label} heading={heading} value={fmtDiv(v, ind.pct)} valueColor={divColor(theme, v)}>
        <DivergingBullet value={v} domain={ind.domain ?? 1} leftLabel={ind.left ?? ''} rightLabel={ind.right ?? ''} />
      </IndicatorBlock>
    );
  };

  const renderNote = (ind: Ind) => {
    const comment = byKey.get(ind.commentKey)?.comment;
    if (!comment) return null;
    const v = daily[ind.key] as number | null | undefined;
    if (ind.viz === 'stat') {
      const p = statProps(ind, v);
      return <NoteItem key={ind.label} color={p.markerColor} label={headingOf(ind)} value={p.valueText} valueColor={p.numberColor} comment={comment} />;
    }
    const show = typeof v === 'number' && !isNaN(v);
    const color = ind.viz === 'segments' ? primary : divColor(theme, v);
    const value = ind.viz === 'segments' ? (show ? (v as number).toFixed(2) : undefined) : fmtDiv(v, ind.pct);
    return <NoteItem key={ind.label} color={color} label={headingOf(ind)} value={value} valueColor={color} comment={comment} />;
  };

  const notes = INDICATORS.map(renderNote).filter(Boolean);

  return (
    <AmbientCard glowColor={phaseColor} sx={{ p: { xs: 2, md: 2.5 } }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: notes.length ? '2fr 3fr' : '1fr' }, gap: { xs: 2, md: 4 }, alignItems: 'stretch' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 2 }}>{INDICATORS.map(renderMetric)}</Box>
        {notes.length > 0 && <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>{notes}</Box>}
      </Box>
    </AmbientCard>
  );
}

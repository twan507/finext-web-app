'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createChart, IChartApi, ISeriesApi, AreaSeries, ColorType, CrosshairMode, LineStyle, UTCTimestamp } from 'lightweight-charts';
import { Box, Stack, Typography, alpha, useTheme } from '@mui/material';
import TimeframeSelector from 'components/common/TimeframeSelector';
import { getResponsiveFontSize, fontWeight } from 'theme/tokens';
import type { PhaseDaily, PhaseLabel } from '../types';
import { getPhaseMeta } from '../phaseMeta';

type FnxRange = '3M' | '1Y' | '2Y' | '5Y' | 'ALL';
// Số phiên giao dịch xấp xỉ mỗi khung.
const RANGE_DAYS: Record<FnxRange, number> = { '3M': 66, '1Y': 252, '2Y': 504, '5Y': 1260, ALL: Number.MAX_SAFE_INTEGER };

function toTs(dateStr: string): UTCTimestamp {
  const d = new Date(dateStr);
  return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 1000) as UTCTimestamp;
}
function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
}

interface PhaseFnxChartProps {
  daily: PhaseDaily[];
  height?: number;
}

interface TooltipState {
  x: number;
  date: string;
  price: number;
  phase: PhaseLabel;
}

/**
 * Biểu đồ FNX-Index dạng AREA, tô màu theo từng giai đoạn:
 * mỗi đoạn phase liên tiếp là 1 AreaSeries (line + fill) mang màu của pha đó, nối liền tại ranh giới.
 */
export default function PhaseFnxChart({ daily, height = 300 }: PhaseFnxChartProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Area'>[]>([]);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [range, setRange] = useState<FnxRange>('1Y');

  const data = useMemo(() => {
    const n = RANGE_DAYS[range];
    return n >= daily.length ? daily : daily.slice(-n);
  }, [daily, range]);

  const handleRangeChange = (_e: React.MouseEvent<HTMLElement>, val: FnxRange | null) => {
    if (val) setRange(val);
  };

  // time(sec) → row, cho tooltip (dùng ref để handler crosshair luôn đọc data mới)
  const byTime = useMemo(() => {
    const m = new Map<number, PhaseDaily>();
    for (const d of data) m.set(toTs(d.date) as number, d);
    return m;
  }, [data]);
  const byTimeRef = useRef(byTime);
  useEffect(() => {
    byTimeRef.current = byTime;
  }, [byTime]);

  // Chia thành các đoạn liên tiếp cùng phase
  const runs = useMemo(() => {
    const out: { start: number; end: number; phase: PhaseLabel }[] = [];
    const n = data.length;
    let s = 0;
    for (let i = 1; i <= n; i++) {
      if (i === n || data[i].phase_label !== data[s].phase_label) {
        out.push({ start: s, end: i - 1, phase: data[s].phase_label });
        s = i;
      }
    }
    return out;
  }, [data]);

  // Khởi tạo chart 1 lần + crosshair tooltip
  useEffect(() => {
    if (!containerRef.current || chartRef.current) return;
    const chart = createChart(containerRef.current, {
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: theme.palette.text.secondary },
      grid: { vertLines: { visible: false }, horzLines: { color: theme.palette.component.chart.gridLine, style: LineStyle.Solid } },
      width: containerRef.current.clientWidth,
      height,
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: theme.palette.component.chart.crosshair, width: 1, style: LineStyle.Dashed },
        horzLine: { visible: false, labelVisible: false },
      },
      rightPriceScale: { borderColor: theme.palette.divider, scaleMargins: { top: 0.1, bottom: 0 } },
      localization: { locale: 'vi-VN' },
      timeScale: { borderColor: theme.palette.divider, timeVisible: false, secondsVisible: false, fixLeftEdge: true, fixRightEdge: true },
      handleScroll: false,
      handleScale: false,
    });
    chartRef.current = chart;

    const onResize = () => {
      if (containerRef.current && chartRef.current) chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
    };
    window.addEventListener('resize', onResize);

    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.point) {
        setTooltip(null);
        return;
      }
      const row = byTimeRef.current.get(param.time as number);
      if (!row) {
        setTooltip(null);
        return;
      }
      setTooltip({ x: param.point.x, date: fmtDate(row.date), price: row.fnx_close, phase: row.phase_label });
    });

    return () => {
      window.removeEventListener('resize', onResize);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height]);

  // (Re)build các AreaSeries khi data/runs/theme đổi
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    chart.applyOptions({
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: theme.palette.text.secondary },
      grid: { vertLines: { visible: false }, horzLines: { color: theme.palette.component.chart.gridLine } },
      crosshair: { vertLine: { color: theme.palette.component.chart.crosshair } },
      rightPriceScale: { borderColor: theme.palette.divider },
      timeScale: { borderColor: theme.palette.divider },
    });

    seriesRef.current.forEach((s) => chart.removeSeries(s));
    seriesRef.current = [];

    for (let j = 0; j < runs.length; j++) {
      const r = runs[j];
      // Gồm luôn điểm đầu đoạn kế để 2 đoạn nối liền, không hở.
      const endIdx = j < runs.length - 1 ? runs[j + 1].start : r.end;
      const color = getPhaseMeta(r.phase).color(theme);
      const series = chart.addSeries(AreaSeries, {
        lineColor: color,
        lineWidth: 2,
        topColor: alpha(color, 0.32),
        bottomColor: alpha(color, 0.03),
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 3,
        crosshairMarkerBorderColor: color,
        crosshairMarkerBackgroundColor: isDark ? '#1e1e1e' : '#ffffff',
        priceFormat: { type: 'price', precision: 0, minMove: 1 },
      });
      series.setData(data.slice(r.start, endIdx + 1).map((d) => ({ time: toTs(d.date), value: d.fnx_close })));
      seriesRef.current.push(series);
    }

    chart.timeScale().fitContent();
  }, [runs, data, theme, isDark]);

  const tipColor = tooltip ? getPhaseMeta(tooltip.phase).color(theme) : theme.palette.text.primary;
  const tipMeta = tooltip ? getPhaseMeta(tooltip.phase) : null;

  return (
    <Box sx={{ width: '100%' }}>
      <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1 }}>
        <TimeframeSelector
          value={range}
          onChange={handleRangeChange}
          options={['3M', '1Y', '2Y', '5Y', 'ALL'] as FnxRange[]}
          getLabel={(o) => (o === 'ALL' ? 'Tất cả' : o)}
        />
      </Stack>
      <Box sx={{ position: 'relative', width: '100%', height }} onMouseLeave={() => setTooltip(null)}>
        <Box ref={containerRef} sx={{ width: '100%', height: '100%' }} />
      {tooltip && tipMeta && (
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            left: tooltip.x + 15,
            transform: tooltip.x > (containerRef.current?.clientWidth || 0) - 170 ? 'translateX(-100%) translateX(-30px)' : 'none',
            bgcolor: isDark ? 'rgba(30,30,30,0.92)' : 'rgba(255,255,255,0.92)',
            borderRadius: 1.5,
            p: '8px 10px',
            pointerEvents: 'none',
            zIndex: 5,
            minWidth: 150,
          }}
        >
          <Typography sx={{ fontSize: getResponsiveFontSize('xs'), color: 'text.secondary', mb: 0.5, fontWeight: fontWeight.medium }}>{tooltip.date}</Typography>
          <Typography sx={{ fontSize: getResponsiveFontSize('sm'), fontVariantNumeric: 'tabular-nums', fontWeight: fontWeight.semibold }}>
            FNX-Index: {tooltip.price.toFixed(2)}
          </Typography>
          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.25 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '2px', bgcolor: tipColor }} />
            <Typography sx={{ fontSize: getResponsiveFontSize('xs'), color: tipColor, fontWeight: fontWeight.semibold }}>
              {tipMeta.en} · {tipMeta.vn}
            </Typography>
          </Stack>
        </Box>
      )}
      </Box>
    </Box>
  );
}

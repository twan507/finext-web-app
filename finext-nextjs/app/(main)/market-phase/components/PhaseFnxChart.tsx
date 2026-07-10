'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createChart, IChartApi, ISeriesApi, IPriceLine, LineSeries, ColorType, CrosshairMode, LineStyle, UTCTimestamp } from 'lightweight-charts';
import { Box, Stack, Typography, useTheme } from '@mui/material';
import TimeframeSelector from 'components/common/TimeframeSelector';
import { getResponsiveFontSize, fontWeight } from 'theme/tokens';
import type { PhaseDaily, PhaseLabel } from '../types';
import { getPhaseMeta } from '../phaseMeta';
import { PhaseNeonPrimitive, type PhaseNeonStyle } from './phaseChartPrimitive';

type FnxRange = '3M' | '1Y' | '2Y' | '5Y' | 'ALL';
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

/** Biểu đồ FNX-Index "Neon Regime": đường giá neon đổi màu theo pha + huy hiệu đổi pha (vẽ qua primitive). */
export default function PhaseFnxChart({ daily, height = 300 }: PhaseFnxChartProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const primRef = useRef<PhaseNeonPrimitive | null>(null);
  const priceLineRef = useRef<IPriceLine | null>(null);
  const markerColorRef = useRef<string>(''); // guard: applyOptions chỉ khi màu marker đổi (tránh đệ quy crosshair)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [lastPos, setLastPos] = useState<{ x: number; y: number } | null>(null);
  const [range, setRange] = useState<FnxRange>('1Y');

  const data = useMemo(() => {
    const n = RANGE_DAYS[range];
    return n >= daily.length ? daily : daily.slice(-n);
  }, [daily, range]);
  const latest = data.length ? data[data.length - 1] : null;

  const byTime = useMemo(() => {
    const m = new Map<number, PhaseDaily>();
    for (const d of data) m.set(toTs(d.date) as number, d);
    return m;
  }, [data]);
  const byTimeRef = useRef(byTime);
  useEffect(() => void (byTimeRef.current = byTime), [byTime]);

  // Vị trí điểm cuối (px) cho overlay chip + pulse dot; tính lại sau khi fit/resize.
  const lastRef = useRef<PhaseDaily | null>(latest);
  useEffect(() => void (lastRef.current = latest));
  const computeLastPos = () => {
    const s = seriesRef.current,
      c = chartRef.current,
      row = lastRef.current;
    if (!s || !c || !row) return setLastPos(null);
    const x = c.timeScale().timeToCoordinate(toTs(row.date));
    const y = s.priceToCoordinate(row.fnx_close);
    setLastPos(x != null && y != null ? { x: x as number, y: y as number } : null);
  };

  // Khởi tạo chart 1 lần: series trong suốt (giữ scale/crosshair) + primitive vẽ.
  useEffect(() => {
    if (!containerRef.current || chartRef.current) return;
    const chart = createChart(containerRef.current, {
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: theme.palette.text.secondary },
      grid: { vertLines: { visible: false }, horzLines: { color: theme.palette.component.chart.gridLine, style: LineStyle.Dotted } },
      width: containerRef.current.clientWidth,
      height,
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: theme.palette.component.chart.crosshair, width: 1, style: LineStyle.Dashed },
        horzLine: { visible: false, labelVisible: false },
      },
      rightPriceScale: { borderColor: theme.palette.divider, scaleMargins: { top: 0.12, bottom: 0.04 } },
      localization: { locale: 'vi-VN' },
      timeScale: { borderColor: theme.palette.divider, timeVisible: false, secondsVisible: false, fixLeftEdge: true, fixRightEdge: true },
      handleScroll: false,
      handleScale: false,
    });
    chartRef.current = chart;
    const series = chart.addSeries(LineSeries, {
      color: 'transparent',
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 3,
      crosshairMarkerBackgroundColor: isDark ? '#1e1e1e' : '#ffffff',
      priceFormat: { type: 'price', precision: 0, minMove: 1 },
    });
    seriesRef.current = series;
    const prim = new PhaseNeonPrimitive({ isDark, colorOf: (p) => getPhaseMeta(p).color(theme), glyphOf: (p) => getPhaseMeta(p).glyph });
    series.attachPrimitive(prim);
    primRef.current = prim;

    const onResize = () => {
      if (containerRef.current && chartRef.current) chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
      computeLastPos();
    };
    window.addEventListener('resize', onResize);
    chart.subscribeCrosshairMove((param) => {
      const row = param.time ? byTimeRef.current.get(param.time as number) : undefined;
      if (!param.point || !row) return setTooltip(null);
      // applyOptions bên trong handler này sẽ re-fire crosshair đồng bộ → chỉ gọi khi màu thực sự đổi để không đệ quy vô hạn.
      const mcol = getPhaseMeta(row.phase_label).color(theme);
      if (markerColorRef.current !== mcol) {
        markerColorRef.current = mcol;
        seriesRef.current?.applyOptions({ crosshairMarkerBorderColor: mcol });
      }
      setTooltip({ x: param.point.x, date: fmtDate(row.date), price: row.fnx_close, phase: row.phase_label });
    });
    return () => {
      window.removeEventListener('resize', onResize);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      primRef.current = null;
      priceLineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height]);

  // (Re)nạp data + theme → series data, primitive, vạch giá cuối, fit.
  useEffect(() => {
    const chart = chartRef.current,
      series = seriesRef.current,
      prim = primRef.current;
    if (!chart || !series || !prim || !latest) return;
    const style: PhaseNeonStyle = { isDark, colorOf: (p) => getPhaseMeta(p).color(theme), glyphOf: (p) => getPhaseMeta(p).glyph };
    chart.applyOptions({
      layout: { textColor: theme.palette.text.secondary },
      grid: { horzLines: { color: theme.palette.component.chart.gridLine, style: LineStyle.Dotted } },
      crosshair: { vertLine: { color: theme.palette.component.chart.crosshair } },
      rightPriceScale: { borderColor: theme.palette.divider },
      timeScale: { borderColor: theme.palette.divider },
    });
    series.setData(data.map((d) => ({ time: toTs(d.date), value: d.fnx_close })));
    prim.setData(data.map((d) => ({ time: toTs(d.date), value: d.fnx_close, phase: d.phase_label })));
    prim.setStyle(style);
    const col = getPhaseMeta(latest.phase_label).color(theme);
    if (priceLineRef.current) series.removePriceLine(priceLineRef.current);
    priceLineRef.current = series.createPriceLine({
      price: latest.fnx_close,
      color: col,
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      axisLabelColor: col,
      axisLabelTextColor: isDark ? '#0e0e12' : '#ffffff',
      title: '',
    });
    chart.timeScale().fitContent();
    const raf = requestAnimationFrame(computeLastPos);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, theme, isDark, latest]);

  const tipMeta = tooltip ? getPhaseMeta(tooltip.phase) : null;
  const tipColor = tipMeta ? tipMeta.color(theme) : theme.palette.text.primary;
  const phaseCol = latest ? getPhaseMeta(latest.phase_label).color(theme) : theme.palette.text.primary;
  const cw = containerRef.current?.clientWidth ?? 0;

  return (
    <Box sx={{ width: '100%' }}>
      <Stack direction="row" justifyContent="flex-end" sx={{ mb: 2, mt: 0 }}>
        <TimeframeSelector value={range} onChange={(_e, v) => v && setRange(v)} options={['3M', '1Y', '2Y', '5Y', 'ALL'] as FnxRange[]} getLabel={(o) => (o === 'ALL' ? 'Tất cả' : o)} />
      </Stack>
      <Box sx={{ position: 'relative', width: '100%', height }} onMouseLeave={() => setTooltip(null)}>
        <Box ref={containerRef} sx={{ width: '100%', height: '100%' }} />

        {/* Pulse dot — overlay neo tại điểm cuối (phiên mới nhất) */}
        {lastPos && (
          <Box
            aria-hidden
            sx={{
              position: 'absolute',
              left: lastPos.x,
              top: lastPos.y,
              width: 8,
              height: 8,
              borderRadius: '50%',
              bgcolor: phaseCol,
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'none',
              zIndex: 4,
              '&::after': {
                content: '""',
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                border: `2px solid ${phaseCol}`,
                animation: 'phasePulse 1.9s ease-out infinite',
              },
              '@keyframes phasePulse': { '0%': { transform: 'scale(1)', opacity: 0.85 }, '100%': { transform: 'scale(3.2)', opacity: 0 } },
            }}
          />
        )}

        {/* Tooltip crosshair — nền kính mờ */}
        {tooltip && tipMeta && (
          <Box
            sx={{
              position: 'absolute',
              top: 8,
              left: tooltip.x + 15,
              transform: tooltip.x > cw - 170 ? 'translateX(-100%) translateX(-30px)' : 'none',
              bgcolor: isDark ? 'rgba(20,20,26,0.72)' : 'rgba(255,255,255,0.72)',
              backdropFilter: 'blur(10px)',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
              borderRadius: 1.5,
              p: '8px 10px',
              pointerEvents: 'none',
              zIndex: 5,
              minWidth: 150,
            }}
          >
            <Typography sx={{ fontSize: getResponsiveFontSize('xs'), color: 'text.secondary', mb: 0.5, fontWeight: fontWeight.medium }}>{tooltip.date}</Typography>
            <Typography sx={{ fontSize: getResponsiveFontSize('sm'), fontVariantNumeric: 'tabular-nums', fontWeight: fontWeight.semibold }}>FNX-Index: {tooltip.price.toFixed(2)}</Typography>
            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.25 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '2px', bgcolor: tipColor }} />
              <Typography sx={{ fontSize: getResponsiveFontSize('xs'), color: tipColor, fontWeight: fontWeight.semibold }}>
                {tipMeta.en}
              </Typography>
            </Stack>
          </Box>
        )}
      </Box>
    </Box>
  );
}

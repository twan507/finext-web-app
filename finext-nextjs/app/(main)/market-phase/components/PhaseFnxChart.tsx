'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createChart, IChartApi, ISeriesApi, IPriceLine, LineSeries, ColorType, CrosshairMode, LineStyle, UTCTimestamp } from 'lightweight-charts';
import { Box, Stack, Typography, useTheme } from '@mui/material';
import TimeframeSelector from 'components/common/TimeframeSelector';
import PanZoomToggle from 'components/common/PanZoomToggle';
import { getResponsiveFontSize, fontWeight } from 'theme/tokens';
import type { PhaseDaily, PhaseLabel } from '../types';
import { getPhaseMeta } from '../phaseMeta';
import { PhaseNeonPrimitive, type PhaseNeonStyle } from './phaseChartPrimitive';

type FnxRange = '3M' | '6M' | '1Y' | '2Y';
// Số phiên hiển thị theo khung — chỉ đổi GÓC NHÌN (visible range), KHÔNG cắt dữ liệu (load full).
const RANGE_BARS: Record<FnxRange, number> = { '3M': 66, '6M': 132, '1Y': 252, '2Y': 504 };
function getVisibleRange(r: FnxRange, len: number): { from: number; to: number } {
  const bars = Math.min(RANGE_BARS[r], len);
  return { from: len - bars - 0.5, to: len - 0.5 };
}

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
  y: number;
  date: string;
  price: number;
  phase: PhaseLabel;
}

/** Biểu đồ FNXINDEX "Neon Regime": đường giá neon đổi màu theo pha + huy hiệu đổi pha (vẽ qua primitive). */
export default function PhaseFnxChart({ daily, height = 300 }: PhaseFnxChartProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const primRef = useRef<PhaseNeonPrimitive | null>(null);
  const priceLineRef = useRef<IPriceLine | null>(null);
  const markerColorRef = useRef<string>(''); // guard: applyOptions chỉ khi màu marker đổi (tránh đệ quy crosshair)
  const dotRef = useRef<HTMLDivElement>(null); // pulse dot — định vị bằng DOM/rAF để dán khít chart khi zoom
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [range, setRange] = useState<FnxRange>('1Y');
  const [panZoom, setPanZoom] = useState(false);

  // Load FULL dữ liệu; timeframe chỉ đổi visible range (xem applyView bên dưới).
  const data = daily;
  const latest = data.length ? data[data.length - 1] : null;
  const rangeRef = useRef(range);
  useEffect(() => void (rangeRef.current = range));

  // Đặt góc nhìn theo timeframe hiện tại (ref → luôn đọc range mới, ổn định qua các closure).
  const applyView = () => {
    const chart = chartRef.current;
    if (!chart || data.length === 0) return;
    chart.timeScale().setVisibleLogicalRange(getVisibleRange(rangeRef.current, data.length));
  };
  const applyViewRef = useRef(applyView);
  applyViewRef.current = applyView;

  const byTime = useMemo(() => {
    const m = new Map<number, PhaseDaily>();
    for (const d of data) m.set(toTs(d.date) as number, d);
    return m;
  }, [data]);
  const byTimeRef = useRef(byTime);
  useEffect(() => void (byTimeRef.current = byTime), [byTime]);

  // Đặt vị trí pulse dot bằng transform trên chính DOM node (không setState) → dán khít line
  // qua mọi tương tác (zoom ngang, pan, scale dọc, resize). Gọi mỗi frame trong vòng rAF.
  const lastRef = useRef<PhaseDaily | null>(latest);
  useEffect(() => void (lastRef.current = latest));
  const positionDot = () => {
    const el = dotRef.current,
      s = seriesRef.current,
      c = chartRef.current,
      row = lastRef.current,
      cont = containerRef.current;
    if (!el || !s || !c || !row || !cont) return;
    const x = c.timeScale().timeToCoordinate(toTs(row.date));
    const y = s.priceToCoordinate(row.fnx_close);
    // Ẩn khi điểm cuối bị kéo ra ngoài khung nhìn.
    if (x == null || y == null || (x as number) < 0 || (x as number) > cont.clientWidth) {
      if (el.style.display !== 'none') el.style.display = 'none';
      return;
    }
    if (el.style.display === 'none') el.style.display = 'block';
    el.style.transform = `translate(${(x as number) - 4}px, ${(y as number) - 4}px)`; // dot 8px → lệch -4px để tâm khớp
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
      timeScale: { borderColor: theme.palette.divider, timeVisible: false, secondsVisible: false },
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
      setTooltip({ x: param.point.x, y: param.point.y, date: fmtDate(row.date), price: row.fnx_close, phase: row.phase_label });
    });
    // rAF nhẹ: mỗi frame chỉ đọc toạ độ + set transform cho dot (rAF tự dừng khi tab ẩn).
    let raf = 0;
    const tick = () => {
      positionDot();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
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
    applyView(); // đặt góc nhìn theo timeframe (không fitContent — data đã full)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, theme, isDark, latest]);

  // Đổi timeframe → chỉ đổi góc nhìn, tắt pan/zoom (timeframe là khung chuẩn).
  useEffect(() => {
    setPanZoom(false);
    chartRef.current?.applyOptions({ handleScroll: false, handleScale: false });
    applyViewRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const togglePanZoom = useCallback(() => {
    setPanZoom((prev) => {
      const next = !prev;
      const chart = chartRef.current;
      if (chart) {
        chart.applyOptions({
          handleScroll: { mouseWheel: next, pressedMouseMove: next, horzTouchDrag: next, vertTouchDrag: false },
          handleScale: { axisPressedMouseMove: next, mouseWheel: next, pinch: next },
        });
        if (!next) applyViewRef.current(); // tắt → về đúng góc nhìn của timeframe
      }
      return next;
    });
  }, []);

  const tipMeta = tooltip ? getPhaseMeta(tooltip.phase) : null;
  const tipColor = tipMeta ? tipMeta.color(theme) : theme.palette.text.primary;
  const phaseCol = latest ? getPhaseMeta(latest.phase_label).color(theme) : theme.palette.text.primary;
  const cw = containerRef.current?.clientWidth ?? 0;

  return (
    <Box sx={{ width: '100%' }}>
      <Stack direction="row" spacing={1} justifyContent="flex-end" alignItems="center" sx={{ mb: 2, mt: 0 }}>
        <PanZoomToggle enabled={panZoom} onClick={togglePanZoom} />
        <TimeframeSelector value={range} onChange={(_e, v) => v && setRange(v)} options={['3M', '6M', '1Y', '2Y'] as FnxRange[]} />
      </Stack>
      <Box sx={{ position: 'relative', width: '100%', height }} onMouseLeave={() => setTooltip(null)}>
        <Box ref={containerRef} sx={{ width: '100%', height: '100%' }} />

        {/* Pulse dot — neo tại điểm cuối; định vị bằng transform qua rAF (dán khít khi zoom) */}
        {latest && (
          <Box
            ref={dotRef}
            aria-hidden
            style={{ display: 'none' }}
            sx={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: 8,
              height: 8,
              borderRadius: '50%',
              bgcolor: phaseCol,
              willChange: 'transform',
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
              // Bám theo con trỏ nhưng kẹp trong vùng chart để không tụt xuống dưới che nội dung.
              top: Math.max(4, Math.min(tooltip.y - 30, height - 80)),
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
            <Typography sx={{ fontSize: getResponsiveFontSize('sm'), fontVariantNumeric: 'tabular-nums', fontWeight: fontWeight.semibold }}>FNXINDEX: {tooltip.price.toFixed(2)}</Typography>
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

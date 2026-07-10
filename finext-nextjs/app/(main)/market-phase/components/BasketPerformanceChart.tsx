'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  LineSeries,
  ColorType,
  CrosshairMode,
  LineStyle,
  UTCTimestamp,
  SingleValueData,
  Time,
} from 'lightweight-charts';
import { Box, Stack, Typography, alpha, useTheme, type Theme } from '@mui/material';
import TimeframeSelector from 'components/common/TimeframeSelector';
import { getResponsiveFontSize, fontWeight, borderRadius } from 'theme/tokens';
import type { PhasePerfRow } from '../types';

export type PerfRange = '3M' | '6M' | '1Y' | '2Y';
const RANGE_DAYS: Record<PerfRange, number> = { '3M': 66, '6M': 132, '1Y': 252, '2Y': 504 };

interface SeriesConfig {
  product: string;
  name: string;
  color: (t: Theme) => string;
  dashed: boolean;
}

// Màu định danh (categorical), KHÔNG dùng đỏ/xanh trend cho series.
const SERIES: SeriesConfig[] = [
  { product: 'CORE', name: 'Sóng Ngành', color: (t) => t.palette.primary.main, dashed: false },
  { product: 'CONSERVATIVE', name: 'Bảo Thủ', color: (t) => t.palette.trend.floor, dashed: false },
  { product: 'AGGRESSIVE', name: 'Tăng Trưởng', color: (t) => t.palette.warning.main, dashed: false },
  { product: 'FNX', name: 'FNX-Index', color: (t) => t.palette.text.disabled, dashed: true },
];

function toTimestamp(dateStr: string): UTCTimestamp {
  const d = new Date(dateStr);
  return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 1000) as UTCTimestamp;
}

/** Rebase về 0% cumulative theo cửa sổ (điểm đầu = 0). Trả về SingleValueData (fraction). */
function rebase(rows: { date: string; ret: number }[]): SingleValueData<Time>[] {
  let cum = 1;
  const seen = new Set<number>();
  const out: SingleValueData<Time>[] = [];
  rows.forEach((r, i) => {
    if (i > 0) cum *= 1 + (r.ret ?? 0);
    const t = toTimestamp(r.date);
    if (seen.has(t)) return;
    seen.add(t);
    out.push({ time: t, value: cum - 1 });
  });
  return out;
}

interface BasketPerformanceChartProps {
  perf: PhasePerfRow[];
  /** Lọc chỉ hiện các product này (luôn kèm benchmark FNX). Mặc định: cả 3 rổ. */
  products?: string[];
  height?: number;
}

export default function BasketPerformanceChart({ perf, products, height = 320 }: BasketPerformanceChartProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const activeSeries = useMemo(
    () => (products && products.length ? SERIES.filter((s) => s.dashed || products.includes(s.product)) : SERIES),
    [products],
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesMapRef = useRef<Map<string, ISeriesApi<'Line'>>>(new Map());
  const [range, setRange] = useState<PerfRange>('1Y');
  const [tooltip, setTooltip] = useState<{ x: number; y: number; date: string; rows: { name: string; value: number; color: string }[] } | null>(null);

  // Gom theo product, sort tăng dần theo ngày
  const grouped = useMemo(() => {
    const m = new Map<string, { date: string; ret: number }[]>();
    for (const r of perf) {
      if (!m.has(r.product)) m.set(r.product, []);
      m.get(r.product)!.push({ date: r.date, ret: r.ret_1d_1x ?? 0 });
    }
    for (const arr of m.values()) arr.sort((a, b) => (a.date < b.date ? -1 : 1));
    return m;
  }, [perf]);

  // Dữ liệu đã rebase theo range hiện tại
  const lineData = useMemo(() => {
    const n = RANGE_DAYS[range];
    const map = new Map<string, SingleValueData<Time>[]>();
    for (const s of activeSeries) {
      const rows = grouped.get(s.product);
      if (!rows || rows.length === 0) continue;
      map.set(s.product, rebase(rows.slice(Math.max(0, rows.length - n))));
    }
    return map;
  }, [grouped, range, activeSeries]);

  // KPI strip: % cuối kỳ, sort tốt → xấu (benchmark cuối)
  const endReturns = useMemo(() => {
    return activeSeries
      .map((s) => {
        const d = lineData.get(s.product);
        const end = d && d.length > 0 ? d[d.length - 1].value : null;
        return { ...s, end };
      })
      .filter((s) => s.end !== null)
      .sort((a, b) => (b.end as number) - (a.end as number));
  }, [lineData, activeSeries]);

  // Khởi tạo chart 1 lần + crosshair tooltip
  useEffect(() => {
    if (!containerRef.current || chartRef.current) return;
    const chart = createChart(containerRef.current, {
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: theme.palette.text.secondary },
      grid: {
        vertLines: { color: theme.palette.component.chart.gridLine, style: LineStyle.Solid },
        horzLines: { color: theme.palette.component.chart.gridLine, style: LineStyle.Solid },
      },
      width: containerRef.current.clientWidth,
      height,
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: theme.palette.component.chart.crosshair, width: 1, style: LineStyle.Dashed },
        horzLine: { visible: false, labelVisible: false },
      },
      rightPriceScale: { borderColor: theme.palette.divider, scaleMargins: { top: 0.1, bottom: 0.1 } },
      localization: { locale: 'vi-VN', priceFormatter: (p: number) => (p * 100).toFixed(1) + '%' },
      timeScale: { borderColor: theme.palette.divider, timeVisible: false, secondsVisible: false },
      handleScroll: false,
      handleScale: false,
    });
    chartRef.current = chart;

    const handleResize = () => {
      if (containerRef.current && chartRef.current) chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
    };
    window.addEventListener('resize', handleResize);

    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.point || !containerRef.current) {
        setTooltip(null);
        return;
      }
      const rows: { name: string; value: number; color: string }[] = [];
      seriesMapRef.current.forEach((series, product) => {
        const cfg = SERIES.find((s) => s.product === product);
        const data = param.seriesData.get(series);
        if (cfg && data && 'value' in data) {
          rows.push({ name: cfg.name, value: (data as SingleValueData<Time>).value, color: cfg.color(theme) });
        }
      });
      if (rows.length === 0) {
        setTooltip(null);
        return;
      }
      rows.sort((a, b) => b.value - a.value);
      const ts = param.time as number;
      const dt = new Date(ts * 1000);
      const dateStr = `${String(dt.getUTCDate()).padStart(2, '0')}/${String(dt.getUTCMonth() + 1).padStart(2, '0')}/${dt.getUTCFullYear()}`;
      setTooltip({ x: param.point.x, y: param.point.y, date: dateStr, rows });
    });

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
      seriesMapRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height]);

  // (Re)build series khi data/range/theme đổi
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    seriesMapRef.current.forEach((s) => chart.removeSeries(s));
    seriesMapRef.current.clear();

    let zeroLineAdded = false;
    for (const cfg of activeSeries) {
      const data = lineData.get(cfg.product);
      if (!data || data.length === 0) continue;
      const series = chart.addSeries(LineSeries, {
        color: cfg.color(theme),
        lineWidth: cfg.dashed ? 1 : 2,
        lineStyle: cfg.dashed ? LineStyle.Dashed : LineStyle.Solid,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 3,
        priceFormat: { type: 'custom', formatter: (p: number) => (p * 100).toFixed(1) + '%' },
      });
      series.setData(data);
      if (!zeroLineAdded && !cfg.dashed) {
        series.createPriceLine({ price: 0, color: theme.palette.text.disabled, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: false, title: '' });
        zeroLineAdded = true;
      }
      seriesMapRef.current.set(cfg.product, series);
    }
    chart.timeScale().fitContent();
  }, [lineData, theme, activeSeries]);

  // Cập nhật màu theme cho layout/grid khi đổi mode
  useEffect(() => {
    if (!chartRef.current) return;
    chartRef.current.applyOptions({
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: theme.palette.text.secondary },
      grid: {
        vertLines: { color: theme.palette.component.chart.gridLine },
        horzLines: { color: theme.palette.component.chart.gridLine },
      },
      rightPriceScale: { borderColor: theme.palette.divider },
      timeScale: { borderColor: theme.palette.divider },
    });
  }, [theme]);

  const handleRangeChange = (_e: React.MouseEvent<HTMLElement>, val: PerfRange | null) => {
    if (val) setRange(val);
  };

  const fmtPct = (v: number) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`;

  return (
    <Box sx={{ width: '100%' }}>
      {/* KPI stat tiles + timeframe */}
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2} sx={{ mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
          {endReturns.map((s) => {
            const c = s.color(theme);
            return (
            <Box
              key={s.product}
              sx={{
                minWidth: 108,
                px: 1.5,
                py: 1,
                borderRadius: `${borderRadius.md}px`,
                background: `linear-gradient(135deg, ${alpha(c, isDark ? 0.24 : 0.16)}, ${alpha(c, isDark ? 0.05 : 0.03)})`,
                border: `1px solid ${alpha(c, 0.3)}`,
                opacity: s.dashed ? 0.8 : 1,
              }}
            >
              <Stack direction="row" spacing={0.75} alignItems="center">
                <Box sx={{ width: 9, height: 9, borderRadius: '2px', bgcolor: c }} />
                <Typography sx={{ fontSize: getResponsiveFontSize('xs'), color: 'text.secondary' }}>{s.name}</Typography>
              </Stack>
              <Typography
                sx={{
                  mt: 0.25,
                  fontSize: getResponsiveFontSize('lg'),
                  fontWeight: fontWeight.extrabold,
                  fontVariantNumeric: 'tabular-nums',
                  color: s.dashed ? 'text.disabled' : (s.end as number) >= 0 ? theme.palette.trend.up : theme.palette.trend.down,
                }}
              >
                {fmtPct(s.end as number)}
              </Typography>
            </Box>
            );
          })}
        </Stack>
        <TimeframeSelector value={range} onChange={handleRangeChange} options={['3M', '6M', '1Y', '2Y'] as PerfRange[]} />
      </Stack>

      {/* Chart */}
      <Box sx={{ position: 'relative', width: '100%', height }} onMouseLeave={() => setTooltip(null)}>
        <Box ref={containerRef} sx={{ width: '100%', height: '100%' }} />
        {tooltip && (
          <Box
            sx={{
              position: 'absolute',
              left: tooltip.x + 15,
              top: 8,
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
            {tooltip.rows.map((r) => (
              <Stack key={r.name} direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                <Stack direction="row" spacing={0.75} alignItems="center">
                  <Box sx={{ width: 8, height: 8, borderRadius: '2px', bgcolor: r.color }} />
                  <Typography sx={{ fontSize: getResponsiveFontSize('xs'), color: 'text.secondary' }}>{r.name}</Typography>
                </Stack>
                <Typography sx={{ fontSize: getResponsiveFontSize('xs'), fontWeight: fontWeight.semibold, fontVariantNumeric: 'tabular-nums', color: r.value >= 0 ? theme.palette.trend.up : theme.palette.trend.down }}>
                  {fmtPct(r.value)}
                </Typography>
              </Stack>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}

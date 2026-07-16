// finext-nextjs/app/(main)/chat/components/chart/templates.ts
// Registry ECharts template: LLM chỉ nhả JSON mỏng {template, ...data} → FE map sang EChartsOption.
// Chỉ import TYPE từ 'echarts' (erase khi build → giữ lazy-load runtime ở EChart.tsx).
// Gradient dùng object dạng {type:'linear',...} (tương đương echarts.graphic.LinearGradient) để không phải import runtime.
import type { EChartsOption } from 'echarts';
import type { Theme } from '@mui/material/styles';
import { alpha } from '@mui/material/styles';

// Rút type single-slot từ EChartsOption (không phụ thuộc tên export cụ thể của echarts).
type ArrElem<T> = T extends readonly (infer U)[] ? U : T;
type XAxisOpt = ArrElem<NonNullable<EChartsOption['xAxis']>>;
type YAxisOpt = ArrElem<NonNullable<EChartsOption['yAxis']>>;
type SeriesOpt = ArrElem<NonNullable<EChartsOption['series']>>;
type GridOpt = ArrElem<NonNullable<EChartsOption['grid']>>;

const FONT = 'Roboto, Helvetica, Arial, sans-serif';

// ---- coerce phòng thủ (giống WidgetRenderer cũ) ----
const toArr = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);
const toNum = (x: unknown): number => {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
};
// number | '-' → '-' cho điểm khuyết (MA đầu chuỗi) để ECharts vẽ khoảng trống thay vì rơi về 0.
const toGap = (x: unknown): number | '-' => {
  if (x === null || x === undefined || x === '') return '-';
  const n = Number(x);
  return Number.isFinite(n) ? n : '-';
};
const toStr = (x: unknown): string => (typeof x === 'string' ? x : x == null ? '' : String(x));
const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null;
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

// =====================================================================
// PALETTE — map MUI theme → bảng màu cho ECharts (text/muted/grid/bg + categorical + up/down)
// =====================================================================
export interface ChartPalette {
  mode: 'light' | 'dark';
  text: string;
  muted: string;
  border: string;
  grid: string;
  surface: string;
  bg: string;
  accent: string;
  up: string;
  down: string;
  ref: string;
  neutral: string;
  heatMid: string;
  cat: string[];
}

export function chartPalette(theme: Theme): ChartPalette {
  const isDark = theme.palette.mode === 'dark';
  const text = theme.palette.text.primary;
  const accent = theme.palette.primary.main;
  const up = theme.palette.trend.up;
  const down = theme.palette.trend.down;
  const ref = theme.palette.trend.ref;
  return {
    mode: isDark ? 'dark' : 'light',
    text,
    muted: theme.palette.text.secondary,
    border: alpha(text, isDark ? 0.16 : 0.12),
    grid: alpha(text, isDark ? 0.08 : 0.06),
    surface: theme.palette.background.paper,
    bg: theme.palette.background.default,
    accent,
    up,
    down,
    ref,
    neutral: isDark ? '#7d8896' : '#64748b',
    heatMid: isDark ? '#232b34' : '#eef1f5',
    cat: [accent, up, '#f59e0b', '#06b6d4', '#ec4899', '#8b93a7', '#ef4444', '#3b82f6'],
  };
}

const col = (p: ChartPalette, i: number): string => p.cat[i % p.cat.length];

// Màu theo Ý NGHĨA (cho pie breadth Tăng/Giảm/Đứng…): color hex override > tone (up/down/flat) > tự nhận từ tên.
function autoTone(name: string): 'up' | 'down' | 'flat' | undefined {
  const s = name.toLowerCase().trim();
  if (s.startsWith('tăng') || s.startsWith('up')) return 'up';
  if (s.startsWith('giảm') || s.startsWith('down')) return 'down';
  if (s.startsWith('đứng') || s.startsWith('đi ngang') || s.startsWith('tham chiếu') || s.startsWith('flat') || s.startsWith('unchanged'))
    return 'flat';
  return undefined;
}
function toneColor(p: ChartPalette, tone: unknown, color: unknown, name?: string): string | undefined {
  if (typeof color === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(color)) return color;
  const t = tone === 'up' || tone === 'down' || tone === 'flat' ? tone : name ? autoTone(name) : undefined;
  if (t === 'up') return p.up;
  if (t === 'down') return p.down;
  if (t === 'flat') return p.ref;
  return undefined;
}

// Gradient dọc (top→bottom) — tương đương new echarts.graphic.LinearGradient(0,0,0,1,[...]).
function vGrad(top: string, bottom: string) {
  return {
    type: 'linear' as const,
    x: 0,
    y: 0,
    x2: 0,
    y2: 1,
    colorStops: [
      { offset: 0, color: top },
      { offset: 1, color: bottom },
    ],
  };
}

// =====================================================================
// BASE + AXIS helpers
// =====================================================================
interface BaseOpts {
  trigger?: 'axis' | 'item' | 'none';
  legend?: boolean;
  gridTop?: number;
  cross?: boolean;
}
function base(p: ChartPalette, o: BaseOpts = {}): EChartsOption {
  const { trigger = 'item', legend = false, gridTop = 14, cross = false } = o;
  const opt: EChartsOption = {
    color: p.cat,
    animation: true,
    animationDuration: 480,
    backgroundColor: 'transparent',
    textStyle: { color: p.text, fontFamily: FONT },
    grid: { left: 6, right: 14, top: gridTop, bottom: 6, containLabel: true },
  };
  if (trigger !== 'none') {
    opt.tooltip = {
      trigger,
      confine: true,
      backgroundColor: p.surface,
      borderColor: p.border,
      borderWidth: 1,
      padding: [7, 11],
      textStyle: { color: p.text, fontSize: 12 },
      axisPointer: {
        type: cross ? 'cross' : 'shadow',
        lineStyle: { color: p.border },
        crossStyle: { color: p.border },
      },
      extraCssText: 'box-shadow:0 8px 28px rgba(0,0,0,.16); border-radius:9px;',
    };
  }
  if (legend) {
    opt.legend = {
      show: true,
      top: 2,
      right: 2,
      icon: 'roundRect',
      itemWidth: 10,
      itemHeight: 10,
      itemGap: 12,
      textStyle: { color: p.muted, fontSize: 11 },
    };
  }
  return opt;
}

function xCat(p: ChartPalette, data: (string | number)[], extra?: Partial<XAxisOpt>): XAxisOpt {
  return {
    type: 'category',
    data,
    boundaryGap: true,
    axisLine: { lineStyle: { color: p.border } },
    axisTick: { show: false },
    axisLabel: { color: p.muted, fontSize: 11 },
    ...extra,
  };
}
function xVal(p: ChartPalette, extra?: Partial<XAxisOpt>): XAxisOpt {
  return {
    type: 'value',
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: p.muted, fontSize: 11 },
    splitLine: { lineStyle: { color: p.grid } },
    ...extra,
  };
}
function yCat(p: ChartPalette, data: (string | number)[], extra?: Partial<YAxisOpt>): YAxisOpt {
  return {
    type: 'category',
    data,
    axisLine: { lineStyle: { color: p.border } },
    axisTick: { show: false },
    axisLabel: { color: p.muted, fontSize: 11 },
    ...extra,
  };
}
function yVal(p: ChartPalette, extra?: Partial<YAxisOpt>): YAxisOpt {
  return {
    type: 'value',
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: p.muted, fontSize: 11 },
    splitLine: { lineStyle: { color: p.grid } },
    ...extra,
  };
}

// Đọc series chuẩn {name, data:[num], dashed?, area?} — dùng cho line/area.
interface SeriesIn {
  name: string;
  data: number[];
  dashed: boolean;
  area: boolean;
}
function readSeries(x: unknown, cap: number): SeriesIn[] {
  return toArr(x)
    .filter(isObj)
    .slice(0, cap)
    .map((s) => ({
      name: toStr(s.name),
      data: toArr(s.data).slice(0, 200).map(toNum),
      dashed: s.dashed === true,
      area: s.area === true,
    }))
    .filter((s) => s.data.length > 0);
}
function readXLabels(x: unknown, cap: number): string[] {
  return toArr(x).slice(0, cap).map(toStr);
}

// =====================================================================
// 1 LINE
// =====================================================================
function buildLine(o: Record<string, unknown>, p: ChartPalette): EChartsOption | null {
  const series = readSeries(o.series, 4);
  if (!series.length) return null;
  const x = readXLabels(o.x, 200);
  const opt = base(p, { trigger: 'axis', legend: series.length > 1, gridTop: series.length > 1 ? 30 : 14 });
  if (x.length) opt.xAxis = xCat(p, x);
  else opt.xAxis = xCat(p, series[0].data.map((_, i) => i + 1));
  opt.yAxis = yVal(p, { scale: true });
  opt.series = series.map((s, i): SeriesOpt => {
    const c = col(p, i);
    return {
      type: 'line',
      name: s.name,
      data: s.data,
      smooth: true,
      symbol: s.data.length > 40 ? 'none' : 'circle',
      symbolSize: 5,
      lineStyle: { width: 2, color: c, type: s.dashed ? 'dashed' : 'solid' },
      itemStyle: { color: c },
      ...(s.area ? { areaStyle: { color: vGrad(alpha(c, 0.28), alpha(c, 0.02)) } } : {}),
    };
  });
  return opt;
}

// =====================================================================
// 2 AREA
// =====================================================================
function buildArea(o: Record<string, unknown>, p: ChartPalette): EChartsOption | null {
  const series = readSeries(o.series, 4);
  if (!series.length) return null;
  const x = readXLabels(o.x, 200);
  const stacked = o.stacked === true;
  const opt = base(p, { trigger: 'axis', legend: series.length > 1, gridTop: series.length > 1 ? 30 : 14 });
  opt.xAxis = x.length ? xCat(p, x) : xCat(p, series[0].data.map((_, i) => i + 1));
  opt.yAxis = yVal(p, { scale: !stacked });
  opt.series = series.map((s, i): SeriesOpt => {
    const c = col(p, i);
    return {
      type: 'line',
      name: s.name,
      data: s.data,
      smooth: true,
      symbol: 'none',
      ...(stacked ? { stack: 'total' } : {}),
      lineStyle: { width: stacked ? 1 : 2, color: c },
      itemStyle: { color: c },
      areaStyle: stacked ? { opacity: 0.7, color: c } : { color: vGrad(alpha(c, 0.3), alpha(c, 0.02)) },
    };
  });
  return opt;
}

// =====================================================================
// 3 BAR (cột dọc)
// =====================================================================
function buildBar(o: Record<string, unknown>, p: ChartPalette): EChartsOption | null {
  const categories = readXLabels(o.categories, 40);
  const series = toArr(o.series)
    .filter(isObj)
    .slice(0, 4)
    .map((s) => ({ name: toStr(s.name), data: toArr(s.data).slice(0, 40).map(toNum) }))
    .filter((s) => s.data.length > 0);
  if (!categories.length || !series.length) return null;
  const stacked = o.stacked === true;
  const diverging = o.diverging === true;
  const opt = base(p, { trigger: 'axis', legend: series.length > 1, gridTop: series.length > 1 ? 30 : 14 });
  opt.xAxis = xCat(p, categories, categories.some((c) => c.length > 5) ? { axisLabel: { color: p.muted, fontSize: 10, interval: 0, rotate: 28 } } : undefined);
  opt.yAxis = yVal(p, { scale: true });
  opt.series = series.map((s, i): SeriesOpt => {
    const last = i === series.length - 1;
    const radius: [number, number, number, number] = stacked ? (last ? [3, 3, 0, 0] : [0, 0, 0, 0]) : [4, 4, 0, 0];
    // diverging chỉ có nghĩa với 1 series → tô xanh/đỏ theo dấu.
    if (diverging && series.length === 1) {
      return {
        type: 'bar',
        name: s.name,
        barWidth: '56%',
        data: s.data.map((v) => ({ value: v, itemStyle: { color: v >= 0 ? p.up : p.down, borderRadius: [3, 3, 0, 0] } })),
      };
    }
    return {
      type: 'bar',
      name: s.name,
      barWidth: stacked ? '46%' : undefined,
      ...(stacked ? { stack: 'total' } : {}),
      data: s.data,
      itemStyle: { color: col(p, i), borderRadius: radius },
    };
  });
  return opt;
}

// =====================================================================
// 4 BAR_H (thanh ngang xếp hạng)
// =====================================================================
function buildBarH(o: Record<string, unknown>, p: ChartPalette): EChartsOption | null {
  const items = toArr(o.items)
    .filter(isObj)
    .map((it) => ({ label: toStr(it.label), value: toNum(it.value) }))
    .filter((it) => it.label !== '')
    .slice(0, 20)
    .sort((a, b) => a.value - b.value); // tăng dần → lớn nhất nằm trên cùng
  if (!items.length) return null;
  const opt = base(p, { trigger: 'axis', gridTop: 12 });
  opt.grid = { left: 6, right: 40, top: 12, bottom: 6, containLabel: true };
  opt.xAxis = xVal(p, { scale: true, axisLabel: { show: false }, splitLine: { show: false } });
  opt.yAxis = yCat(p, items.map((it) => it.label), { axisLine: { show: false } });
  opt.series = [
    {
      type: 'bar',
      barWidth: '62%',
      data: items.map((it) => ({
        value: it.value,
        itemStyle: { color: it.value >= 0 ? p.up : p.down, borderRadius: it.value >= 0 ? [0, 4, 4, 0] : [4, 0, 0, 4] },
      })),
      label: { show: true, position: 'right', color: p.muted, fontSize: 11, formatter: '{c}' },
    },
  ];
  return opt;
}

// =====================================================================
// 5 GROUPED_BAR (nhóm cột)
// =====================================================================
function buildGroupedBar(o: Record<string, unknown>, p: ChartPalette): EChartsOption | null {
  const categories = readXLabels(o.categories, 20);
  const series = toArr(o.series)
    .filter(isObj)
    .slice(0, 4)
    .map((s) => ({ name: toStr(s.name), data: toArr(s.data).slice(0, 20).map(toNum) }))
    .filter((s) => s.data.length > 0);
  if (!categories.length || !series.length) return null;
  const opt = base(p, { trigger: 'axis', legend: true, gridTop: 30 });
  opt.xAxis = xCat(p, categories);
  opt.yAxis = yVal(p, { scale: true });
  opt.series = series.map((s, i): SeriesOpt => ({
    type: 'bar',
    name: s.name,
    data: s.data,
    itemStyle: { color: col(p, i), borderRadius: [3, 3, 0, 0] },
  }));
  return opt;
}

// =====================================================================
// 6 PIE (tròn / vành / rose)
// =====================================================================
function buildPie(o: Record<string, unknown>, p: ChartPalette): EChartsOption | null {
  const items = toArr(o.items)
    .filter(isObj)
    .map((it) => ({ name: toStr(it.name), value: toNum(it.value), tone: it.tone, color: it.color }))
    .filter((it) => it.name !== '')
    .slice(0, 10);
  if (!items.length) return null;
  const donut = o.donut === true;
  const rose = o.rose === true;
  const opt = base(p, { trigger: 'item' });
  opt.legend = { show: true, bottom: 2, left: 'center', icon: 'circle', itemWidth: 9, itemHeight: 9, textStyle: { color: p.muted, fontSize: 10 } };
  opt.series = [
    {
      type: 'pie',
      radius: rose ? ['24%', '66%'] : donut ? ['46%', '66%'] : ['0%', '62%'],
      center: ['50%', '44%'],
      ...(rose ? { roseType: 'radius' } : {}),
      avoidLabelOverlap: true,
      itemStyle: { borderColor: p.surface, borderWidth: 2, borderRadius: donut || rose ? 4 : 0 },
      label: donut && !rose ? { show: false } : { color: p.muted, fontSize: 10, formatter: rose ? '{b}' : '{b}\n{d}%' },
      labelLine: { length: 6, length2: 6 },
      data: items.map((it) => {
        const c = toneColor(p, it.tone, it.color, it.name);
        return c ? { name: it.name, value: it.value, itemStyle: { color: c } } : { name: it.name, value: it.value };
      }),
    },
  ];
  return opt;
}

// =====================================================================
// 8 HEATMAP
// =====================================================================
function buildHeatmap(o: Record<string, unknown>, p: ChartPalette): EChartsOption | null {
  const xLabels = readXLabels(o.xLabels, 30);
  const yLabels = readXLabels(o.yLabels, 30);
  const data = toArr(o.data)
    .map((d) => toArr(d))
    .filter((d) => d.length >= 3)
    .slice(0, 900)
    .map((d) => [toNum(d[0]), toNum(d[1]), toNum(d[2])]);
  if (!xLabels.length || !yLabels.length || !data.length) return null;
  const vals = data.map((d) => d[2]);
  const dmin = isNum(o.min) ? o.min : Math.min(...vals);
  const dmax = isNum(o.max) ? o.max : Math.max(...vals);
  const diverging = o.diverging === true;
  const opt = base(p, { trigger: 'item', gridTop: 14 });
  opt.grid = { left: 8, right: 14, top: 14, bottom: 34, containLabel: true };
  opt.xAxis = xCat(p, xLabels, { boundaryGap: true, splitArea: { show: true }, axisLabel: { color: p.muted, fontSize: 10 } });
  opt.yAxis = yCat(p, yLabels, { boundaryGap: true, splitArea: { show: true }, axisLabel: { color: p.muted, fontSize: 10 } });
  opt.visualMap = {
    min: dmin,
    max: dmax,
    calculable: true,
    orient: 'horizontal',
    left: 'center',
    bottom: 0,
    itemWidth: 10,
    itemHeight: 70,
    textStyle: { color: p.muted, fontSize: 9 },
    inRange: { color: diverging ? [p.down, p.heatMid, p.up] : [p.heatMid, alpha(p.accent, 0.5), p.accent] },
  };
  opt.series = [
    {
      type: 'heatmap',
      data,
      itemStyle: { borderColor: p.surface, borderWidth: 2 },
      label: { show: true, color: p.text, fontSize: 9, formatter: '{@[2]}' },
    },
  ];
  return opt;
}

// =====================================================================
// 9 SCATTER (phân tán / bubble / nhóm màu)
// =====================================================================
function buildScatter(o: Record<string, unknown>, p: ChartPalette): EChartsOption | null {
  const pts = toArr(o.points)
    .filter(isObj)
    .slice(0, 200)
    .map((pt) => ({
      x: toNum(pt.x),
      y: toNum(pt.y),
      name: typeof pt.name === 'string' ? pt.name : undefined,
      size: isNum(pt.size) ? pt.size : undefined,
      group: typeof pt.group === 'string' ? pt.group : undefined,
    }));
  if (!pts.length) return null;
  const xName = typeof o.xName === 'string' ? o.xName : undefined;
  const yName = typeof o.yName === 'string' ? o.yName : undefined;
  const sizeOf = (s?: number): number => (s != null ? Math.max(8, Math.sqrt(Math.abs(s)) * 1.7) : 11);
  const toItem = (pt: (typeof pts)[number]) => ({ value: [pt.x, pt.y], symbolSize: sizeOf(pt.size), name: pt.name });
  const hasGroup = pts.some((pt) => pt.group);

  const opt = base(p, { trigger: 'item', legend: hasGroup, gridTop: hasGroup ? 30 : 14 });
  opt.xAxis = xVal(p, { name: xName, nameLocation: 'middle', nameGap: 24, nameTextStyle: { color: p.muted, fontSize: 10 }, scale: true });
  opt.yAxis = yVal(p, { name: yName, nameLocation: 'middle', nameGap: 30, nameTextStyle: { color: p.muted, fontSize: 10 }, scale: true });
  if (hasGroup) {
    const groups = Array.from(new Set(pts.map((pt) => pt.group ?? 'Khác')));
    opt.series = groups.map((g, i): SeriesOpt => ({
      type: 'scatter',
      name: g,
      data: pts.filter((pt) => (pt.group ?? 'Khác') === g).map(toItem),
      itemStyle: { color: col(p, i), opacity: 0.85 },
    }));
  } else {
    opt.series = [
      {
        type: 'scatter',
        data: pts.map(toItem),
        itemStyle: { color: alpha(p.accent, 0.7), borderColor: p.accent, borderWidth: 1 },
        label: pts.length <= 16 ? { show: true, position: 'top', color: p.muted, fontSize: 9, formatter: '{b}' } : { show: false },
      },
    ];
  }
  return opt;
}

// =====================================================================
// 10 TREEMAP (phân cấp; color override per node)
// =====================================================================
interface TreeNode {
  name: string;
  value?: number;
  children?: TreeNode[];
  itemStyle?: { color: string };
}
function coerceNodes(x: unknown, depth: number): TreeNode[] {
  if (depth > 3) return [];
  return toArr(x)
    .filter(isObj)
    .slice(0, 60)
    .map((n): TreeNode => {
      const node: TreeNode = { name: toStr(n.name) };
      const kids = coerceNodes(n.children, depth + 1);
      if (kids.length) node.children = kids;
      else node.value = toNum(n.value);
      if (typeof n.color === 'string') node.itemStyle = { color: n.color };
      return node;
    })
    .filter((n) => (n.children && n.children.length > 0) || Number.isFinite(n.value));
}
function buildTreemap(o: Record<string, unknown>, p: ChartPalette): EChartsOption | null {
  const nodes = coerceNodes(o.nodes, 0);
  if (!nodes.length) return null;
  const opt = base(p, { trigger: 'item', gridTop: 8 });
  delete opt.grid;
  opt.series = [
    {
      type: 'treemap',
      roam: false,
      nodeClick: false,
      breadcrumb: { show: false },
      width: '100%',
      height: '100%',
      top: 6,
      left: 2,
      right: 2,
      bottom: 2,
      itemStyle: { borderColor: p.surface, borderWidth: 2, gapWidth: 2 },
      levels: [
        { itemStyle: { borderColor: p.surface, borderWidth: 3, gapWidth: 3 } },
        { itemStyle: { borderColor: p.surface, borderWidth: 1, gapWidth: 1 }, colorSaturation: [0.35, 0.6] },
      ],
      label: { color: '#fff', fontSize: 11, formatter: '{b}' },
      upperLabel: { show: true, height: 16, color: '#fff', fontSize: 10 },
      data: nodes,
    },
  ];
  return opt;
}

// =====================================================================
// 11 RADAR (đa chỉ tiêu ≤3 series)
// =====================================================================
function buildRadar(o: Record<string, unknown>, p: ChartPalette): EChartsOption | null {
  const indicators = toArr(o.indicators)
    .filter(isObj)
    .slice(0, 12)
    .map((ind) => ({ name: toStr(ind.name), max: isNum(ind.max) ? ind.max : toNum(ind.max) || 100 }))
    .filter((ind) => ind.name !== '');
  const series = toArr(o.series)
    .filter(isObj)
    .slice(0, 3)
    .map((s) => ({ name: toStr(s.name), values: toArr(s.values).map(toNum) }))
    .filter((s) => s.values.length > 0);
  if (indicators.length < 3 || !series.length) return null;
  const showLegend = series.length > 1;
  const opt = base(p, { trigger: 'item' });
  delete opt.grid;
  if (showLegend) {
    opt.legend = { show: true, bottom: 2, left: 'center', icon: 'roundRect', itemWidth: 11, itemHeight: 4, textStyle: { color: p.muted, fontSize: 10 } };
  }
  opt.radar = {
    center: ['50%', showLegend ? '46%' : '52%'],
    radius: '62%',
    indicator: indicators,
    axisName: { color: p.muted, fontSize: 10 },
    splitLine: { lineStyle: { color: p.border } },
    splitArea: { show: true, areaStyle: { color: [alpha(p.muted, 0.03), 'transparent'] } },
    axisLine: { lineStyle: { color: p.border } },
  };
  opt.series = [
    {
      type: 'radar',
      symbolSize: 4,
      data: series.map((s, i) => ({
        value: s.values,
        name: s.name,
        lineStyle: { width: 2, color: col(p, i) },
        itemStyle: { color: col(p, i) },
        areaStyle: { color: alpha(col(p, i), 0.14) },
      })),
    },
  ];
  return opt;
}

// =====================================================================
// 12 GAUGE (1 chỉ số; zones→dải màu)
// =====================================================================
function buildGauge(o: Record<string, unknown>, p: ChartPalette): EChartsOption | null {
  if (!isNum(o.value) && !Number.isFinite(Number(o.value))) return null;
  const value = toNum(o.value);
  const min = isNum(o.min) ? o.min : 0;
  const max = isNum(o.max) ? o.max : 100;
  const range = max - min || 1;
  const unit = typeof o.unit === 'string' ? o.unit : '';
  const detailFmt = '{value}' + (unit ? (unit.length > 1 ? ' ' : '') + unit : '');

  const zones = toArr(o.zones)
    .filter(isObj)
    .map((z) => ({ to: toNum(z.to), color: toStr(z.color) }))
    .filter((z) => z.color !== '')
    .sort((a, b) => a.to - b.to);
  const segs: [number, string][] = zones.map((z) => [clamp((z.to - min) / range, 0, 1), z.color]);
  if (segs.length) segs[segs.length - 1][0] = 1; // đảm bảo dải cuối phủ hết thang

  const opt = base(p, { trigger: 'none' });
  delete opt.grid;
  opt.series = [
    {
      type: 'gauge',
      min,
      max,
      startAngle: 210,
      endAngle: -30,
      radius: '92%',
      center: ['50%', '56%'],
      progress: { show: segs.length === 0, width: 12, itemStyle: { color: p.accent } },
      axisLine: { lineStyle: { width: segs.length ? 14 : 12, color: segs.length ? segs : [[1, alpha(p.muted, 0.18)]] } },
      axisTick: { show: false },
      splitLine: segs.length ? { distance: -14, length: 14, lineStyle: { color: p.surface, width: 2 } } : { show: false },
      axisLabel: { color: p.muted, fontSize: 9, distance: 14 },
      pointer: segs.length ? { show: true, width: 5, length: '60%', itemStyle: { color: p.text } } : { show: false },
      anchor: segs.length ? { show: true, size: 8, itemStyle: { color: p.text } } : { show: false },
      title: { show: false },
      detail: { valueAnimation: true, formatter: detailFmt, color: p.text, fontSize: 26, fontWeight: 600, offsetCenter: [0, '18%'] },
      data: [{ value }],
    },
  ];
  return opt;
}

// =====================================================================
// DISPATCH
// =====================================================================
export function buildOption(payload: unknown, p: ChartPalette): EChartsOption | null {
  if (!isObj(payload)) return null;
  const t = payload.template;
  if (typeof t !== 'string') return null;
  switch (t) {
    case 'line':
      return buildLine(payload, p);
    case 'area':
      return buildArea(payload, p);
    case 'bar':
      return buildBar(payload, p);
    case 'bar_h':
      return buildBarH(payload, p);
    case 'grouped_bar':
      return buildGroupedBar(payload, p);
    case 'pie':
      return buildPie(payload, p);
    case 'heatmap':
      return buildHeatmap(payload, p);
    case 'scatter':
      return buildScatter(payload, p);
    case 'treemap':
      return buildTreemap(payload, p);
    case 'radar':
      return buildRadar(payload, p);
    case 'gauge':
      return buildGauge(payload, p);
    default:
      // 'kpi' xử lý riêng ở WidgetRenderer; template lạ → null (→ fallback xám).
      return null;
  }
}

// =====================================================================
// KPI (ô CSS + mini sparkline)
// =====================================================================
export type KpiTone = 'up' | 'down' | 'flat';
export interface KpiTile {
  label: string;
  value: string;
  delta?: string;
  tone: KpiTone;
  spark?: number[];
}
export function normalizeKpi(payload: Record<string, unknown>): KpiTile[] | null {
  const tiles = toArr(payload.tiles)
    .filter(isObj)
    .slice(0, 6)
    .map((t): KpiTile => {
      const tone: KpiTone = t.tone === 'up' || t.tone === 'down' ? t.tone : 'flat';
      const spark = Array.isArray(t.spark) ? t.spark.map(toNum) : undefined;
      return {
        label: toStr(t.label),
        value: toStr(t.value),
        delta: typeof t.delta === 'string' ? t.delta : undefined,
        tone,
        spark: spark && spark.length ? spark : undefined,
      };
    })
    .filter((t) => t.label !== '' || t.value !== '');
  return tiles.length ? tiles : null;
}
export function buildSpark(p: ChartPalette, data: number[], tone: KpiTone): EChartsOption {
  const c = tone === 'down' ? p.down : tone === 'up' ? p.up : p.accent;
  return {
    animation: true,
    backgroundColor: 'transparent',
    grid: { left: 0, right: 0, top: 2, bottom: 2 },
    xAxis: { type: 'category', show: false, boundaryGap: false, data: data.map((_, i) => i) },
    yAxis: { type: 'value', show: false, scale: true },
    tooltip: { show: false },
    series: [
      {
        type: 'line',
        data,
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 1.6, color: c },
        areaStyle: { color: vGrad(alpha(c, 0.28), alpha(c, 0.02)) },
      },
    ],
  };
}

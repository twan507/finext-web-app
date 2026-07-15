'use client';

import { Component, type ReactNode } from 'react';
import { Box, Typography, alpha, useTheme } from '@mui/material';
import { getResponsiveFontSize, fontWeight } from 'theme/tokens';
import StatTiles from './widgets/StatTiles';
import BarList from './widgets/BarList';
import GroupedBars from './widgets/GroupedBars';
import LineChart from './widgets/LineChart';

export interface StatTile {
  label: string;
  value: string;
  sub?: string;
  tone?: 'up' | 'down' | 'flat';
}
export interface BarItem {
  label: string;
  value: number;
  note?: string;
}
export interface BarGroup {
  label: string;
  values: number[];
}
export interface LineSeries {
  name: string;
  points: number[];
}

// Contract PACK ↔ FE (spec 07-14 §D4) — finext-widget fenced JSON, luôn có {v:1, type}.
export type Widget =
  | { v: 1; type: 'stat_tiles'; title?: string; tiles: StatTile[] }
  | { v: 1; type: 'bar_list'; title?: string; items: BarItem[] }
  | { v: 1; type: 'grouped_bars'; title?: string; series: string[]; groups: BarGroup[] }
  | { v: 1; type: 'line'; title?: string; categories?: string[]; series: LineSeries[] };

const WHITELIST = new Set(['stat_tiles', 'bar_list', 'grouped_bars', 'line']);

// Coerce phòng thủ: model có thể nhả JSON đúng type nhưng field lồng thiếu/sai kiểu.
const toArr = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);
const toNum = (x: unknown): number => {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
};
const toStr = (x: unknown): string => (typeof x === 'string' ? x : x == null ? '' : String(x));
const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null;

// Chỉ validate JSON + {v:1, type ∈ whitelist}. Field lồng để normalize xử lý.
function parseRaw(json: string): Record<string, unknown> | null {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return null;
  }
  if (!isObj(data)) return null;
  if (data.v !== 1 || typeof data.type !== 'string' || !WHITELIST.has(data.type)) return null;
  return data;
}

// Chuẩn hoá về shape an toàn: drop entry null/non-object, coerce số/chuỗi/mảng.
// Trả null (→ gray fallback) khi sau normalize không còn dữ liệu vẽ được.
function normalize(obj: Record<string, unknown>): Widget | null {
  const title = typeof obj.title === 'string' ? obj.title : undefined;
  switch (obj.type) {
    case 'stat_tiles': {
      const tiles: StatTile[] = toArr(obj.tiles)
        .filter(isObj)
        .map((t) => {
          const tone = t.tone === 'up' || t.tone === 'down' || t.tone === 'flat' ? t.tone : undefined;
          return { label: toStr(t.label), value: toStr(t.value), sub: typeof t.sub === 'string' ? t.sub : undefined, tone };
        });
      return tiles.length ? { v: 1, type: 'stat_tiles', title, tiles } : null;
    }
    case 'bar_list': {
      const items: BarItem[] = toArr(obj.items)
        .filter(isObj)
        .map((it) => ({ label: toStr(it.label), value: toNum(it.value), note: typeof it.note === 'string' ? it.note : undefined }));
      return items.length ? { v: 1, type: 'bar_list', title, items } : null;
    }
    case 'grouped_bars': {
      const series: string[] = toArr(obj.series)
        .map(toStr)
        .filter((s) => s !== '');
      const groups: BarGroup[] = toArr(obj.groups)
        .filter(isObj)
        .map((g) => ({ label: toStr(g.label), values: toArr(g.values).map(toNum) }));
      const usable = series.length > 0 && groups.some((g) => g.values.length > 0);
      return usable ? { v: 1, type: 'grouped_bars', title, series, groups } : null;
    }
    case 'line': {
      const series: LineSeries[] = toArr(obj.series)
        .filter(isObj)
        .map((s) => ({ name: toStr(s.name), points: toArr(s.points).map(toNum) }));
      const categories = Array.isArray(obj.categories) ? obj.categories.map(toStr) : undefined;
      return series.some((s) => s.points.length > 0) ? { v: 1, type: 'line', title, categories, series } : null;
    }
    default:
      return null;
  }
}

function Fallback({ json }: { json: string }) {
  const theme = useTheme();
  return (
    <Box
      component="pre"
      sx={{
        my: 1.5,
        p: 1.5,
        borderRadius: 1,
        overflowX: 'auto',
        bgcolor: alpha(theme.palette.text.primary, 0.05),
        border: `1px solid ${alpha(theme.palette.divider, 0.3)}`,
        color: 'text.secondary',
        fontSize: getResponsiveFontSize('xs'),
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word'
      }}
    >
      {json.trim()}
    </Box>
  );
}

// Lưới an toàn cuối cùng: mọi throw khi render widget → cùng gray fallback, không sập /chat.
interface BoundaryProps {
  fallback: ReactNode;
  children: ReactNode;
}
interface BoundaryState {
  hasError: boolean;
}
class WidgetErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { hasError: false };
  static getDerivedStateFromError(): BoundaryState {
    return { hasError: true };
  }
  render(): ReactNode {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

function WidgetBody({ widget }: { widget: Widget }) {
  let truncated = false;
  const cap = <T,>(arr: T[], n: number): T[] => {
    if (arr.length > n) truncated = true;
    return arr.slice(0, n);
  };

  let body: ReactNode = null;
  switch (widget.type) {
    case 'stat_tiles':
      body = <StatTiles tiles={cap(widget.tiles, 6)} />;
      break;
    case 'bar_list':
      body = <BarList items={cap(widget.items, 20)} />;
      break;
    case 'grouped_bars': {
      const series = cap(widget.series, 3);
      const groups = cap(widget.groups, 20).map((g) => ({ ...g, values: g.values.slice(0, series.length) }));
      body = <GroupedBars series={series} groups={groups} />;
      break;
    }
    case 'line': {
      const series = cap(widget.series, 3).map((s) => ({ ...s, points: cap(s.points, 60) }));
      const categories = widget.categories ? cap(widget.categories, 60) : undefined;
      body = <LineChart categories={categories} series={series} />;
      break;
    }
  }

  return (
    <Box sx={{ my: 1.5 }}>
      {widget.title && (
        <Typography sx={{ fontSize: getResponsiveFontSize('sm'), fontWeight: fontWeight.semibold, mb: 1, color: 'text.primary' }}>
          {widget.title}
        </Typography>
      )}
      {body}
      {truncated && (
        <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: 'text.secondary' }}>
          …đã rút gọn
        </Typography>
      )}
    </Box>
  );
}

export default function WidgetRenderer({ json }: { json: string }) {
  const raw = parseRaw(json);
  const widget = raw ? normalize(raw) : null;
  if (!widget) return <Fallback json={json} />;
  return (
    <WidgetErrorBoundary fallback={<Fallback json={json} />}>
      <WidgetBody widget={widget} />
    </WidgetErrorBoundary>
  );
}

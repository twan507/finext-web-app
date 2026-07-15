'use client';

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

function parseWidget(json: string): Widget | null {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null) return null;
  const obj = data as Record<string, unknown>; // narrow đã validate ngay dưới, không dùng any
  if (obj.v !== 1 || typeof obj.type !== 'string' || !WHITELIST.has(obj.type)) return null;
  switch (obj.type) {
    case 'stat_tiles':
      return Array.isArray(obj.tiles) ? (obj as Widget) : null;
    case 'bar_list':
      return Array.isArray(obj.items) ? (obj as Widget) : null;
    case 'grouped_bars':
      return Array.isArray(obj.series) && Array.isArray(obj.groups) ? (obj as Widget) : null;
    case 'line':
      return Array.isArray(obj.series) ? (obj as Widget) : null;
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

export default function WidgetRenderer({ json }: { json: string }) {
  const widget = parseWidget(json);
  if (!widget) return <Fallback json={json} />;

  let truncated = false;
  const cap = <T,>(arr: T[], n: number): T[] => {
    if (arr.length > n) truncated = true;
    return arr.slice(0, n);
  };

  let body: React.ReactNode = null;
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

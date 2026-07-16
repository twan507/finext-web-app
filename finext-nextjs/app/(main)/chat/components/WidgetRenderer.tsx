'use client';

import { Component, useMemo, type ReactNode } from 'react';
import { Box, Typography, alpha, useTheme } from '@mui/material';
import { getResponsiveFontSize, fontWeight } from 'theme/tokens';
import EChart from './chart/EChart';
import KpiTiles from './chart/KpiTiles';
import { buildOption, chartPalette, normalizeKpi, type ChartPalette, type KpiTile } from './chart/templates';

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null;

// Parse fence JSON → {template, ...}. JSON hỏng / không có template → null (→ gray fallback).
function parseRaw(json: string): Record<string, unknown> | null {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return null;
  }
  if (!isObj(data) || typeof data.template !== 'string') return null;
  return data;
}

type Built =
  | { kind: 'chart'; option: NonNullable<ReturnType<typeof buildOption>>; title?: string }
  | { kind: 'kpi'; tiles: KpiTile[]; palette: ChartPalette };

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
        wordBreak: 'break-word',
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

export default function WidgetRenderer({ json }: { json: string }) {
  const theme = useTheme();

  // Build 1 lần / (json, theme) đổi → EChart nhận option ổn định, chỉ re-setOption khi cần.
  const built = useMemo<Built | null>(() => {
    const raw = parseRaw(json);
    if (!raw) return null;
    const p = chartPalette(theme);
    if (raw.template === 'kpi') {
      const tiles = normalizeKpi(raw);
      return tiles ? { kind: 'kpi', tiles, palette: p } : null;
    }
    const option = buildOption(raw, p);
    if (!option) return null;
    const title = typeof raw.title === 'string' ? raw.title : undefined;
    return { kind: 'chart', option, title };
  }, [json, theme]);

  if (!built) return <Fallback json={json} />;

  const fallback = <Fallback json={json} />;
  return (
    <WidgetErrorBoundary fallback={fallback}>
      <Box sx={{ my: 1.5 }}>
        {built.kind === 'chart' && built.title && (
          <Typography sx={{ fontSize: getResponsiveFontSize('sm'), fontWeight: fontWeight.semibold, mb: 1, color: 'text.primary' }}>
            {built.title}
          </Typography>
        )}
        {built.kind === 'kpi' ? <KpiTiles tiles={built.tiles} palette={built.palette} /> : <EChart option={built.option} />}
      </Box>
    </WidgetErrorBoundary>
  );
}

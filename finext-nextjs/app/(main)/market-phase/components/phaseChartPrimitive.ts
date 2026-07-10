// finext-nextjs/app/(main)/market-phase/components/phaseChartPrimitive.ts
// Custom lightweight-charts series primitive cho PhaseFnxChart ("Neon Regime"):
// vẽ nền wash theo pha + vạch ranh giới + đường giá neon (glow 3 lớp) + huy hiệu đổi pha.
// Đường giá thật do primitive vẽ; series gắn kèm để trong suốt (chỉ giữ price scale/crosshair/tooltip).

import { CanvasRenderingTarget2D } from 'fancy-canvas';
import {
  IChartApi,
  ISeriesApi,
  ISeriesPrimitive,
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  SeriesAttachedParameter,
  SeriesOptionsMap,
  Time,
  UTCTimestamp,
} from 'lightweight-charts';

export interface PhaseSeriesPoint {
  time: UTCTimestamp;
  value: number;
  phase: string;
}

export interface PhaseNeonStyle {
  colorOf: (phase: string) => string;
  glyphOf: (phase: string) => string;
  isDark: boolean;
}

interface Coord {
  x: number;
  y: number;
  ok: boolean;
  phase: string;
}
interface Segment {
  start: number;
  endIncl: number; // gồm điểm đầu đoạn kế → đường nối liền tại ranh giới
  phase: string;
}
interface ViewData {
  coords: Coord[];
  segments: Segment[];
  boundaries: number[]; // index bắt đầu mỗi pha mới (i>0)
  style: PhaseNeonStyle;
}

const GLYPH_CY = 14; // tâm huy hiệu ở mép trên (trong headroom scaleMargin.top)
const DROP_TOP = 28; // vạch ranh giới bắt đầu dưới hàng huy hiệu
const CHIP_MIN_GAP = 28; // ẩn huy hiệu nếu quá sát huy hiệu trước

/** hex (#rgb | #rrggbb) → rgba(). Trả nguyên chuỗi nếu không phải hex. */
function hexA(hex: string, alpha: number): string {
  if (hex[0] !== '#') return hex;
  let h = hex.slice(1);
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

// ─── Renderer ────────────────────────────────────────────────────────────────

class PhaseNeonRenderer implements IPrimitivePaneRenderer {
  constructor(private _d: ViewData) {}

  // Nền wash dọc theo pha (rất nhẹ, tan trước nửa biểu đồ).
  drawBackground(target: CanvasRenderingTarget2D) {
    const d = this._d;
    if (d.coords.length < 2) return;
    target.useBitmapCoordinateSpace((scope) => {
      const ctx = scope.context;
      ctx.save();
      ctx.scale(scope.horizontalPixelRatio, scope.verticalPixelRatio);
      const W = scope.mediaSize.width;
      const H = scope.mediaSize.height;
      const aTop = d.style.isDark ? 0.07 : 0.05;
      for (let s = 0; s < d.segments.length; s++) {
        const seg = d.segments[s];
        const left = s === 0 ? 0 : d.coords[seg.start].x;
        const right = s === d.segments.length - 1 ? W : d.coords[d.segments[s + 1].start].x;
        const col = d.style.colorOf(seg.phase);
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, hexA(col, aTop));
        grad.addColorStop(0.5, hexA(col, 0));
        ctx.fillStyle = grad;
        ctx.fillRect(left, 0, right - left, H);
      }
      ctx.restore();
    });
  }

  // Vạch ranh giới + đường giá neon + huy hiệu đổi pha (trên series trong suốt).
  draw(target: CanvasRenderingTarget2D) {
    const d = this._d;
    if (d.coords.length < 2) return;
    target.useBitmapCoordinateSpace((scope) => {
      const ctx = scope.context;
      ctx.save();
      ctx.scale(scope.horizontalPixelRatio, scope.verticalPixelRatio);
      const H = scope.mediaSize.height;
      const isDark = d.style.isDark;

      // 1) Vạch ranh giới dạng đứt, màu theo pha mới.
      ctx.save();
      ctx.setLineDash([2, 5]);
      ctx.lineWidth = 1;
      for (const b of d.boundaries) {
        const c = d.coords[b];
        if (!c.ok) continue;
        ctx.strokeStyle = hexA(d.style.colorOf(c.phase), isDark ? 0.22 : 0.18);
        ctx.beginPath();
        ctx.moveTo(c.x, DROP_TOP);
        ctx.lineTo(c.x, H);
        ctx.stroke();
      }
      ctx.restore();

      // 2) Đường giá neon: halo rộng → glow sát → core mảnh (3 lượt để core luôn trên cùng).
      const strokeSeg = (seg: Segment, width: number, alpha: number, blur: number) => {
        const col = d.style.colorOf(seg.phase);
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = col;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = width;
        if (blur > 0) {
          ctx.shadowColor = col;
          ctx.shadowBlur = blur;
        }
        ctx.beginPath();
        let started = false;
        for (let i = seg.start; i <= seg.endIncl; i++) {
          const c = d.coords[i];
          if (!c.ok) continue;
          if (!started) {
            ctx.moveTo(c.x, c.y);
            started = true;
          } else ctx.lineTo(c.x, c.y);
        }
        ctx.stroke();
        ctx.restore();
      };
      for (const seg of d.segments) strokeSeg(seg, 6, isDark ? 0.18 : 0.1, 12);
      for (const seg of d.segments) strokeSeg(seg, 2.5, isDark ? 0.55 : 0.35, 6);
      for (const seg of d.segments) strokeSeg(seg, 1.6, 1, 0);

      // 3) Huy hiệu đổi pha (▲▼↔⇄) ở mép trên; ẩn khi quá sát huy hiệu trước.
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '600 11px system-ui, -apple-system, sans-serif';
      const chipBg = isDark ? 'rgba(18,18,26,0.92)' : 'rgba(255,255,255,0.92)';
      let lastX = -Infinity;
      for (const b of d.boundaries) {
        const c = d.coords[b];
        if (!c.ok || c.x - lastX < CHIP_MIN_GAP) continue;
        lastX = c.x;
        const col = d.style.colorOf(c.phase);
        ctx.beginPath();
        ctx.arc(c.x, GLYPH_CY, 12.5, 0, Math.PI * 2);
        ctx.fillStyle = hexA(col, 0.12);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(c.x, GLYPH_CY, 9.5, 0, Math.PI * 2);
        ctx.fillStyle = chipBg;
        ctx.fill();
        ctx.lineWidth = 1.3;
        ctx.strokeStyle = hexA(col, 0.9);
        ctx.stroke();
        ctx.fillStyle = col;
        ctx.fillText(d.style.glyphOf(c.phase), c.x, GLYPH_CY + 0.5);
      }
      ctx.restore();
      ctx.restore();
    });
  }
}

// ─── Pane View ─────────────────────────────────────────────────────────────

class PhaseNeonPaneView implements IPrimitivePaneView {
  private _data: ViewData;
  constructor(private _source: PhaseNeonPrimitive) {
    this._data = { coords: [], segments: [], boundaries: [], style: _source._style };
  }

  update() {
    const src = this._source;
    if (!src._chart || !src._series) {
      this._data = { coords: [], segments: [], boundaries: [], style: src._style };
      return;
    }
    const ts = src._chart.timeScale();
    const series = src._series;
    const coords: Coord[] = src._points.map((p) => {
      const x = ts.timeToCoordinate(p.time);
      const y = series.priceToCoordinate(p.value);
      return { x: (x as number) ?? 0, y: (y as number) ?? 0, ok: x !== null && y !== null, phase: p.phase };
    });
    this._data = { coords, segments: src._segments, boundaries: src._boundaries, style: src._style };
  }

  renderer() {
    return new PhaseNeonRenderer(this._data);
  }
}

// ─── Primitive (public API) ──────────────────────────────────────────────────

export class PhaseNeonPrimitive implements ISeriesPrimitive<Time> {
  /** @internal */ _chart: IChartApi | null = null;
  /** @internal */ _series: ISeriesApi<keyof SeriesOptionsMap> | null = null;
  /** @internal */ _points: PhaseSeriesPoint[] = [];
  /** @internal */ _segments: Segment[] = [];
  /** @internal */ _boundaries: number[] = [];
  /** @internal */ _style: PhaseNeonStyle;

  private _paneViews: PhaseNeonPaneView[];
  private _requestUpdate?: () => void;

  constructor(style: PhaseNeonStyle) {
    this._style = style;
    this._paneViews = [new PhaseNeonPaneView(this)];
  }

  attached({ chart, series, requestUpdate }: SeriesAttachedParameter<Time>) {
    this._chart = chart;
    this._series = series;
    this._requestUpdate = requestUpdate;
  }
  detached() {
    this._chart = null;
    this._series = null;
    this._requestUpdate = undefined;
  }

  updateAllViews() {
    this._paneViews.forEach((pv) => pv.update());
  }
  paneViews() {
    return this._paneViews;
  }

  /** Nạp dữ liệu + tính đoạn pha (segment nối liền) và ranh giới. */
  setData(points: PhaseSeriesPoint[]) {
    this._points = points;
    const segs: Segment[] = [];
    const bounds: number[] = [];
    const n = points.length;
    let s = 0;
    for (let i = 1; i <= n; i++) {
      if (i === n || points[i].phase !== points[s].phase) {
        segs.push({ start: s, endIncl: i < n ? i : i - 1, phase: points[s].phase });
        if (i < n) bounds.push(i);
        s = i;
      }
    }
    this._segments = segs;
    this._boundaries = bounds;
    this._requestUpdate?.();
  }

  setStyle(style: PhaseNeonStyle) {
    this._style = style;
    this._requestUpdate?.();
  }
}

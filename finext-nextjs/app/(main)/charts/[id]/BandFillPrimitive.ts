/**
 * BandFillPrimitive – A lightweight-charts series primitive plugin
 * that draws a filled area between two price boundaries (upper & lower).
 *
 * Based on the official Bands Indicator plugin from TradingView:
 * https://github.com/tradingview/lightweight-charts/tree/master/plugin-examples/src/plugins/bands-indicator
 */

import { CanvasRenderingTarget2D } from 'fancy-canvas';
import {
    IChartApi,
    ISeriesApi,
    ISeriesPrimitive,
    IPrimitivePaneRenderer,
    IPrimitivePaneView,
    Coordinate,
    SeriesAttachedParameter,
    SeriesOptionsMap,
    Time,
    UTCTimestamp,
} from 'lightweight-charts';

// ─── Internal types ─────────────────────────────────────────────────────────

interface BandPoint {
    time: Time;
    upper: number;
    lower: number;
}

interface BandRendererPoint {
    x: number;
    upper: number;
    lower: number;
}

interface BandViewData {
    points: BandRendererPoint[];
    fillColor: string;
    visible: boolean;
}

// ─── Renderer ───────────────────────────────────────────────────────────────

class BandFillPaneRenderer implements IPrimitivePaneRenderer {
    private _data: BandViewData;

    constructor(data: BandViewData) {
        this._data = data;
    }

    draw() {
        /* nothing — we only draw in the background layer */
    }

    drawBackground(target: CanvasRenderingTarget2D) {
        if (!this._data.visible) return;
        const pts = this._data.points;
        if (pts.length < 2) return;

        target.useBitmapCoordinateSpace((scope) => {
            const ctx = scope.context;
            ctx.scale(scope.horizontalPixelRatio, scope.verticalPixelRatio);

            // Build a closed region: upper boundary → (reverse) lower boundary
            const region = new Path2D();
            region.moveTo(pts[0].x, pts[0].upper);
            for (const p of pts) {
                region.lineTo(p.x, p.upper);
            }
            // traverse lower boundary in reverse
            const last = pts.length - 1;
            region.lineTo(pts[last].x, pts[last].lower);
            for (let i = last - 1; i >= 0; i--) {
                region.lineTo(pts[i].x, pts[i].lower);
            }
            region.closePath();

            ctx.fillStyle = this._data.fillColor;
            ctx.fill(region);
        });
    }
}

// ─── Pane View ──────────────────────────────────────────────────────────────

class BandFillPaneView implements IPrimitivePaneView {
    private _source: BandFillPrimitive;
    private _data: BandViewData;

    constructor(source: BandFillPrimitive) {
        this._source = source;
        this._data = { points: [], fillColor: source.fillColor, visible: source.visible };
    }

    update() {
        this._data.fillColor = this._source.fillColor;
        this._data.visible = this._source.visible;

        if (!this._source._chart || !this._source._series) {
            this._data.points = [];
            return;
        }

        const ts = this._source._chart.timeScale();
        const series = this._source._series;

        this._data.points = this._source._bandData
            .map((d) => ({
                x: (ts.timeToCoordinate(d.time) as number) ?? -100,
                upper: (series.priceToCoordinate(d.upper) as number) ?? -100,
                lower: (series.priceToCoordinate(d.lower) as number) ?? -100,
            }))
            .filter((d) => d.x > -100);
    }

    renderer() {
        return new BandFillPaneRenderer(this._data);
    }
}

// ─── Primitive (public API) ────────────────────────────────────────────────

export class BandFillPrimitive implements ISeriesPrimitive<Time> {
    /** @internal */ _chart: IChartApi | null = null;
    /** @internal */ _series: ISeriesApi<keyof SeriesOptionsMap> | null = null;
    /** @internal */ _bandData: BandPoint[] = [];

    fillColor: string;
    visible = false;

    private _paneViews: BandFillPaneView[];
    private _requestUpdate?: () => void;

    constructor(fillColor: string) {
        this.fillColor = fillColor;
        this._paneViews = [new BandFillPaneView(this)];
    }

    // ── Lifecycle ───────────────────────────────────────────────────────────

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

    // ── View hooks (called by the library) ──────────────────────────────────

    updateAllViews() {
        this._paneViews.forEach((pv) => pv.update());
    }

    paneViews() {
        return this._paneViews;
    }

    // ── Public methods ──────────────────────────────────────────────────────

    /**
     * Set band data from two separate { time, value } arrays (upper & lower).
     * The arrays must share the same timestamps.
     */
    setData(
        upperData: { time: UTCTimestamp; value: number }[],
        lowerData: { time: UTCTimestamp; value: number }[],
    ) {
        const lowerMap = new Map<number, number>();
        for (const d of lowerData) {
            lowerMap.set(d.time as number, d.value);
        }

        const merged: BandPoint[] = [];
        for (const u of upperData) {
            const lv = lowerMap.get(u.time as number);
            if (lv !== undefined) {
                merged.push({ time: u.time as Time, upper: u.value, lower: lv });
            }
        }

        this._bandData = merged;
        this._requestUpdate?.();
    }

    setVisible(v: boolean) {
        this.visible = v;
        this._requestUpdate?.();
    }
}

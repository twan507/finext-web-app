// Indicator configuration for chart rendering and panel toggles

export type IndicatorType = 'line' | 'area' | 'band' | 'volume-line';

/**
 * Lightweight Charts LineStyle enum values
 * https://tradingview.github.io/lightweight-charts/docs/api/enums/LineStyle
 */
export const LINE_STYLE = {
    /** Solid line (────────) */
    Solid: 0,
    /** Dotted line (········) */
    Dotted: 1,
    /** Dashed line (- - - -) */
    Dashed: 2,
    /** Large dashed line (—  —  —) */
    LargeDashed: 3,
    /** Sparse dotted line (·    ·    ·) */
    SparseDotted: 4,
} as const;

/**
 * Lightweight Charts LineType enum values
 * https://tradingview.github.io/lightweight-charts/docs/api/enums/LineType
 */
export const LINE_TYPE = {
    /** Simple line - straight diagonal connections between points */
    Simple: 0,
    /** Step line - horizontal then vertical (90° angles, ⌐└) */
    WithSteps: 1,
    /** Curved line - smooth curves between points */
    Curved: 2,
} as const;

/**
 * Lightweight Charts line series configuration options
 * https://tradingview.github.io/lightweight-charts/docs/api/interfaces/LineSeriesPartialOptions
 * 
 * @example
 * // Simple diagonal solid line (default for MA)
 * lwOptions: {
 *   lineWidth: 2,
 *   lineStyle: LINE_STYLE.Solid,
 *   lineType: LINE_TYPE.Simple,
 * }
 * 
 * @example
 * // Step dashed line (for OPEN/HIGH/LOW levels)
 * lwOptions: {
 *   lineWidth: 1,
 *   lineStyle: LINE_STYLE.Dashed,
 *   lineType: LINE_TYPE.WithSteps,
 * }
 * 
 * @example
 * // Curved line (for smooth volume indicators)
 * lwOptions: {
 *   lineWidth: 1,
 *   lineStyle: LINE_STYLE.Solid,
 *   lineType: LINE_TYPE.Curved,
 * }
 */
export interface LightweightLineOptions {
    /** Line color */
    color?: string;
    /** Line width in pixels: 1, 2, 3, or 4 */
    lineWidth?: 1 | 2 | 3 | 4;
    /** Line style: 0=Solid, 1=Dotted, 2=Dashed, 3=LargeDashed, 4=SparseDotted (use LINE_STYLE constants) */
    lineStyle?: number;
    /** Line type: 0=Simple, 1=WithSteps, 2=Curved (use LINE_TYPE constants) */
    lineType?: number;
    /** Show price line (default: true) */
    priceLineVisible?: boolean;
    /** Price line color (if different from line color) */
    priceLineColor?: string;
    /** Price line width: 1, 2, 3, or 4 */
    priceLineWidth?: 1 | 2 | 3 | 4;
    /** Price line style */
    priceLineStyle?: number;
    /** Show last value label (default: true) */
    lastValueVisible?: boolean;
    /** Show crosshair marker (default: true) */
    crosshairMarkerVisible?: boolean;
    /** Crosshair marker radius (default: 4) */
    crosshairMarkerRadius?: number;
    /** Crosshair marker border color */
    crosshairMarkerBorderColor?: string;
    /** Crosshair marker background color */
    crosshairMarkerBackgroundColor?: string;
    /** Base line value for baseline series */
    baseLineVisible?: boolean;
    /** Series title for legend */
    title?: string;
}

// ─── Line Option Presets ────────────────────────────────────────────────────────
// Chỉnh sửa preset ở đây sẽ áp dụng cho toàn bộ các đường cùng nhóm

/** MA: đường cong Simple, nét liền, width 2 */
const LW_MA: LightweightLineOptions = {
    lineWidth: 2,
    lineType: LINE_TYPE.Simple,
    lineStyle: LINE_STYLE.Solid,
    priceLineVisible: false,
    lastValueVisible: true,
    crosshairMarkerVisible: true,
    crosshairMarkerRadius: 3,
};

/** OPEN/HIGH/LOW: đường bậc thang, nét đứt, width 1 */
const LW_LEVEL: LightweightLineOptions = {
    lineWidth: 1,
    lineType: LINE_TYPE.WithSteps,
    lineStyle: LINE_STYLE.LargeDashed,
    priceLineVisible: false,
};

/** PIVOT: đường bậc thang, nét liền, width 2 */
const LW_PIVOT: LightweightLineOptions = {
    lineWidth: 2,
    lineType: LINE_TYPE.WithSteps,
    lineStyle: LINE_STYLE.Solid,
    priceLineVisible: false,
};

/** FIBO F500: đường Simple, nét chấm, width 2 */
const LW_FIBO: LightweightLineOptions = {
    lineWidth: 2,
    lineType: LINE_TYPE.Simple,
    lineStyle: LINE_STYLE.SparseDotted,
    priceLineVisible: false,
    lastValueVisible: true,
};

/** POC: đường bậc thang, nét chấm, width 2 */
const LW_POC: LightweightLineOptions = {
    lineWidth: 1,
    lineType: LINE_TYPE.WithSteps,
    lineStyle: LINE_STYLE.Dotted,
    priceLineVisible: false,
    lastValueVisible: true,
};

/** Volume MA: đường cong Curved, nét liền, width 1 */
const LW_VOL_MA: LightweightLineOptions = {
    lineWidth: 1,
    lineType: LINE_TYPE.Curved,
    lineStyle: LINE_STYLE.Solid,
    priceLineVisible: false,
};

/** Dual-color for dark / light theme */
export interface ThemeColor {
    dark: string;
    light: string;
}

/** Resolve indicator color based on current theme */
export function getIndicatorColor(ind: { color: ThemeColor }, isDark: boolean): string {
    return isDark ? ind.color.dark : ind.color.light;
}

export interface LineIndicator {
    key: string;
    label: string;
    type: 'line';
    field: string;
    color: ThemeColor;
    /** Full Lightweight Charts options for this line (lineType, lineStyle, lineWidth, etc.) */
    lwOptions?: LightweightLineOptions;
}

export interface AreaIndicator {
    key: string;
    label: string;
    type: 'area';
    /** [boundary1, middle_dashed, boundary2] */
    fields: [string, string, string];
    color: ThemeColor;
}

export interface BandIndicator {
    key: string;
    label: string;
    type: 'band';
    /** [upper_boundary, lower_boundary] */
    fields: [string, string];
    color: ThemeColor;
}

export interface VolumeLineIndicator {
    key: string;
    label: string;
    type: 'volume-line';
    field: string;
    color: ThemeColor;
    /** Full Lightweight Charts options for this line */
    lwOptions?: LightweightLineOptions;
}

export type IndicatorDef = LineIndicator | AreaIndicator | BandIndicator | VolumeLineIndicator;

export interface IndicatorGroup {
    key: string;
    name: string;
    indicators: IndicatorDef[];
}

// ─── Standardized Dual-Color Palette ────────────────────────────────────────────
// Dark theme  → bright/vivid (Material 400) — tương phản tốt trên nền tối
// Light theme → deep/saturated (Material 800+) — tương phản tốt trên nền sáng
//
// Mỗi khung thời gian có 1 họ màu riêng (dễ phân biệt giữa W/M/Q/Y):
//   W (tuần)  = Green      M (tháng) = Blue/Indigo
//   Q (quý)   = Orange     Y (năm)   = Red/Pink
//
// Trong cùng 1 khung, OPEN/HIGH/LOW dùng 3 sắc độ khác nhau của họ màu.
// ─── Modern Financial Color Palette ─────────────────────────────────────────────

export const INDICATOR_GROUPS: IndicatorGroup[] = [
    {
        key: 'ma',
        name: 'Moving Average',
        // Logic: Spectrum (Vàng -> Lục -> Lam -> Tím -> Đỏ) dễ phân biệt chồng chéo
        indicators: [
            // MA 5: Màu Vàng chanh (Highlight) - Nhanh nhất
            { key: 'ma5', label: 'MA 5', type: 'line', field: 'ma5', color: { dark: '#FFFF00', light: '#FFD600' }, lwOptions: LW_MA },
            // MA 20: Màu Xanh lá (Trend ngắn hạn)
            { key: 'ma20', label: 'MA 20', type: 'line', field: 'ma20', color: { dark: '#00E676', light: '#00C853' }, lwOptions: LW_MA },
            // MA 60: Màu Xanh dương (Trend trung hạn)
            { key: 'ma60', label: 'MA 60', type: 'line', field: 'ma60', color: { dark: '#2979FF', light: '#2962FF' }, lwOptions: LW_MA },
            // MA 120: Màu Tím (Hỗ trợ mạnh)
            { key: 'ma120', label: 'MA 120', type: 'line', field: 'ma120', color: { dark: '#E040FB', light: '#AA00FF' }, lwOptions: LW_MA },
            // MA 240: Màu Đỏ/Xám (Trend dài hạn - Đường 200/240 huyền thoại)
            { key: 'ma240', label: 'MA 240', type: 'line', field: 'ma240', color: { dark: '#FF3D00', light: '#D50000' }, lwOptions: LW_MA },
        ],
    },
    {
        key: 'open_high_low',
        name: 'Open - High - Low',
        // Logic: Ưu tiên xếp theo loại (OPEN, HIGH, LOW) rồi mới tới khung thời gian (W, M, Q, Y)
        indicators: [
            // OPEN — W / M / Q / Y
            { key: 'w_open', label: 'W - OPEN', type: 'line', field: 'w_open', color: { dark: '#69F0AE', light: '#2E7D32' }, lwOptions: LW_LEVEL },
            { key: 'm_open', label: 'M - OPEN', type: 'line', field: 'm_open', color: { dark: '#40C4FF', light: '#0277BD' }, lwOptions: LW_LEVEL },
            { key: 'q_open', label: 'Q - OPEN', type: 'line', field: 'q_open', color: { dark: '#FFAB40', light: '#EF6C00' }, lwOptions: LW_LEVEL },
            { key: 'y_open', label: 'Y - OPEN', type: 'line', field: 'y_open', color: { dark: '#FF5252', light: '#C62828' }, lwOptions: LW_LEVEL },

            // PREV HIGH — W / M / Q / Y
            { key: 'w_ph', label: 'W - PREV HIGH', type: 'line', field: 'w_ph', color: { dark: '#B9F6CA', light: '#4CAF50' }, lwOptions: LW_LEVEL },
            { key: 'm_ph', label: 'M - PREV HIGH', type: 'line', field: 'm_ph', color: { dark: '#80D8FF', light: '#039BE5' }, lwOptions: LW_LEVEL },
            { key: 'q_ph', label: 'Q - PREV HIGH', type: 'line', field: 'q_ph', color: { dark: '#FFD180', light: '#FF9800' }, lwOptions: LW_LEVEL },
            { key: 'y_ph', label: 'Y - PREV HIGH', type: 'line', field: 'y_ph', color: { dark: '#FF8A80', light: '#E53935' }, lwOptions: LW_LEVEL },

            // PREV LOW — W / M / Q / Y
            { key: 'w_pl', label: 'W - PREV LOW', type: 'line', field: 'w_pl', color: { dark: '#00C853', light: '#1B5E20' }, lwOptions: LW_LEVEL },
            { key: 'm_pl', label: 'M - PREV LOW', type: 'line', field: 'm_pl', color: { dark: '#00B0FF', light: '#01579B' }, lwOptions: LW_LEVEL },
            { key: 'q_pl', label: 'Q - PREV LOW', type: 'line', field: 'q_pl', color: { dark: '#FF6D00', light: '#E65100' }, lwOptions: LW_LEVEL },
            { key: 'y_pl', label: 'Y - PREV LOW', type: 'line', field: 'y_pl', color: { dark: '#D50000', light: '#B71C1C' }, lwOptions: LW_LEVEL },
        ],
    },
    {
        key: 'pivot',
        name: 'Pivot',
        // Pivot dùng màu Solid (Liền mạch) tương ứng với Family ở trên để đồng bộ
        indicators: [
            { key: 'w_pivot', label: 'W - PIVOT', type: 'line', field: 'w_pivot', color: { dark: '#00E676', light: '#2E7D32' }, lwOptions: LW_PIVOT },
            { key: 'm_pivot', label: 'M - PIVOT', type: 'line', field: 'm_pivot', color: { dark: '#2979FF', light: '#1565C0' }, lwOptions: LW_PIVOT },
            { key: 'q_pivot', label: 'Q - PIVOT', type: 'line', field: 'q_pivot', color: { dark: '#FF9100', light: '#EF6C00' }, lwOptions: LW_PIVOT },
            { key: 'y_pivot', label: 'Y - PIVOT', type: 'line', field: 'y_pivot', color: { dark: '#FF1744', light: '#C62828' }, lwOptions: LW_PIVOT },
        ],
    },
    {
        key: 'fibonacci',
        name: 'Fibonacci',
        // Ưu tiên xếp theo loại (F500, F382/F618) rồi mới tới khung thời gian (W, M, Q, Y)
        indicators: [
            // F500 — W / M / Q / Y
            { key: 'w_f500', label: 'W - F500', type: 'line', field: 'w_f500', color: { dark: '#69F0AE', light: '#2E7D32' }, lwOptions: LW_FIBO },
            { key: 'm_f500', label: 'M - F500', type: 'line', field: 'm_f500', color: { dark: '#40C4FF', light: '#0277BD' }, lwOptions: LW_FIBO },
            { key: 'q_f500', label: 'Q - F500', type: 'line', field: 'q_f500', color: { dark: '#FFAB40', light: '#EF6C00' }, lwOptions: LW_FIBO },
            { key: 'y_f500', label: 'Y - F500', type: 'line', field: 'y_f500', color: { dark: '#FF5252', light: '#C62828' }, lwOptions: LW_FIBO },

            // F382/F618 — W / M / Q / Y
            { key: 'w_fibo', label: 'W - F382/F618', type: 'band', fields: ['w_f618', 'w_f382'], color: { dark: '#69F0AE', light: '#2E7D32' } },
            { key: 'm_fibo', label: 'M - F382/F618', type: 'band', fields: ['m_f618', 'm_f382'], color: { dark: '#40C4FF', light: '#0277BD' } },
            { key: 'q_fibo', label: 'Q - F382/F618', type: 'band', fields: ['q_f618', 'q_f382'], color: { dark: '#FFAB40', light: '#EF6C00' } },
            { key: 'y_fibo', label: 'Y - F382/F618', type: 'band', fields: ['y_f618', 'y_f382'], color: { dark: '#FF5252', light: '#C62828' } },
        ],
    },
    {
        key: 'volume_profile',
        name: 'Volume Profile',
        // Ưu tiên xếp theo loại (POC, VAH/VAL) rồi mới tới khung thời gian (W, M, Q, Y)
        indicators: [
            // POC — W / M / Q / Y
            { key: 'w_poc', label: 'W - POC', type: 'line', field: 'w_poc', color: { dark: '#1DE9B6', light: '#00695C' }, lwOptions: LW_POC },
            { key: 'm_poc', label: 'M - POC', type: 'line', field: 'm_poc', color: { dark: '#00B0FF', light: '#01579B' }, lwOptions: LW_POC },
            { key: 'q_poc', label: 'Q - POC', type: 'line', field: 'q_poc', color: { dark: '#FF9100', light: '#EF6C00' }, lwOptions: LW_POC },
            { key: 'y_poc', label: 'Y - POC', type: 'line', field: 'y_poc', color: { dark: '#FF1744', light: '#B71C1C' }, lwOptions: LW_POC },

            // VAH/VAL — W / M / Q / Y
            { key: 'w_va', label: 'W - VAH/VAL', type: 'band', fields: ['w_vah', 'w_val'], color: { dark: '#1DE9B6', light: '#00695C' } },
            { key: 'm_va', label: 'M - VAH/VAL', type: 'band', fields: ['m_vah', 'm_val'], color: { dark: '#00B0FF', light: '#01579B' } },
            { key: 'q_va', label: 'Q - VAH/VAL', type: 'band', fields: ['q_vah', 'q_val'], color: { dark: '#FF9100', light: '#EF6C00' } },
            { key: 'y_va', label: 'Y - VAH/VAL', type: 'band', fields: ['y_vah', 'y_val'], color: { dark: '#FF1744', light: '#B71C1C' } },
        ],
    },
    {
        key: 'volume_ma',
        name: 'Volume MA',
        indicators: [
            // VOLUME MA 5: Màu Cam sáng (Sunset Orange)
            { key: 'vsma5', label: 'VOLUME MA 5', type: 'volume-line', field: 'vsma5', color: { dark: '#FF6D00', light: '#EF6C00' }, lwOptions: LW_VOL_MA },
            // VOLUME MA 60: Màu Xanh Cyan/Blue (Cyan Process) - Tương phản mạnh với màu Cam
            { key: 'vsma60', label: 'VOLUME MA 60', type: 'volume-line', field: 'vsma60', color: { dark: '#00E5FF', light: '#0091EA' }, lwOptions: LW_VOL_MA },
        ],
    },
];

// ─── Default Preset ─────────────────────────────────────────────────────────────
// Indicators enabled by default when a user first opens the chart.
// Keys must match the `key` field in INDICATOR_GROUPS above.
const DEFAULT_ENABLED_KEYS: ReadonlySet<string> = new Set([
    'ma20',
    'ma60',
    'm_f500',
    'm_fibo',
    'q_f500',
    'q_fibo',
    'm_poc',
    'q_poc',
    'vsma5',
    'vsma60',
]);

/** Build the default preset state (some indicators ON) */
export function getDefaultEnabledIndicators(): Record<string, boolean> {
    const result: Record<string, boolean> = {};
    for (const group of INDICATOR_GROUPS) {
        for (const ind of group.indicators) {
            result[ind.key] = DEFAULT_ENABLED_KEYS.has(ind.key);
        }
    }
    return result;
}

/** Build a blank state: all indicators OFF */
export function getAllIndicatorsOff(): Record<string, boolean> {
    const result: Record<string, boolean> = {};
    for (const group of INDICATOR_GROUPS) {
        for (const ind of group.indicators) {
            result[ind.key] = false;
        }
    }
    return result;
}

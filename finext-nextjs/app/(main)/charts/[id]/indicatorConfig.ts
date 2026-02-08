// Indicator configuration for chart rendering and panel toggles

export type IndicatorType = 'line' | 'area' | 'volume-line';

export interface LineIndicator {
    key: string;
    label: string;
    type: 'line';
    field: string;
    color: string;
    /** Use step (90°) line instead of diagonal */
    step?: boolean;
}

export interface AreaIndicator {
    key: string;
    label: string;
    type: 'area';
    /** [boundary1, middle_dashed, boundary2] */
    fields: [string, string, string];
    color: string;
}

export interface VolumeLineIndicator {
    key: string;
    label: string;
    type: 'volume-line';
    field: string;
    color: string;
}

export type IndicatorDef = LineIndicator | AreaIndicator | VolumeLineIndicator;

export interface IndicatorGroup {
    key: string;
    name: string;
    indicators: IndicatorDef[];
}

export const INDICATOR_GROUPS: IndicatorGroup[] = [
    {
        key: 'ma',
        name: 'Moving Average',
        indicators: [
            { key: 'ma5', label: 'MA 5', type: 'line', field: 'ma5', color: '#FF6D00' },
            { key: 'ma20', label: 'MA 20', type: 'line', field: 'ma20', color: '#2962FF' },
            { key: 'ma60', label: 'MA 60', type: 'line', field: 'ma60', color: '#E040FB' },
            { key: 'ma120', label: 'MA 120', type: 'line', field: 'ma120', color: '#00BCD4' },
            { key: 'ma240', label: 'MA 240', type: 'line', field: 'ma240', color: '#FF1744' },
        ],
    },
    {
        key: 'open',
        name: 'Open',
        indicators: [
            { key: 'w_open', label: 'W', type: 'line', field: 'w_open', color: '#43A047', step: true },
            { key: 'm_open', label: 'M', type: 'line', field: 'm_open', color: '#1E88E5', step: true },
            { key: 'q_open', label: 'Q', type: 'line', field: 'q_open', color: '#FB8C00', step: true },
            { key: 'y_open', label: 'Y', type: 'line', field: 'y_open', color: '#E53935', step: true },
        ],
    },
    {
        key: 'pivot_high',
        name: 'Previous High',
        indicators: [
            { key: 'w_ph', label: 'W', type: 'line', field: 'w_ph', color: '#66BB6A', step: true },
            { key: 'm_ph', label: 'M', type: 'line', field: 'm_ph', color: '#42A5F5', step: true },
            { key: 'q_ph', label: 'Q', type: 'line', field: 'q_ph', color: '#FFA726', step: true },
            { key: 'y_ph', label: 'Y', type: 'line', field: 'y_ph', color: '#EF5350', step: true },
        ],
    },
    {
        key: 'pivot_low',
        name: 'Previous Low',
        indicators: [
            { key: 'w_pl', label: 'W', type: 'line', field: 'w_pl', color: '#81C784', step: true },
            { key: 'm_pl', label: 'M', type: 'line', field: 'm_pl', color: '#64B5F6', step: true },
            { key: 'q_pl', label: 'Q', type: 'line', field: 'q_pl', color: '#FFB74D', step: true },
            { key: 'y_pl', label: 'Y', type: 'line', field: 'y_pl', color: '#E57373', step: true },
        ],
    },
    {
        key: 'pivot',
        name: 'Pivot',
        indicators: [
            { key: 'w_pivot', label: 'W', type: 'line', field: 'w_pivot', color: '#388E3C', step: true },
            { key: 'm_pivot', label: 'M', type: 'line', field: 'm_pivot', color: '#1565C0', step: true },
            { key: 'q_pivot', label: 'Q', type: 'line', field: 'q_pivot', color: '#EF6C00', step: true },
            { key: 'y_pivot', label: 'Y', type: 'line', field: 'y_pivot', color: '#C62828', step: true },
        ],
    },
    {
        key: 'fibonacci',
        name: 'Fibonacci',
        indicators: [
            { key: 'w_fibo', label: 'W', type: 'area', fields: ['w_f618', 'w_f500', 'w_f382'], color: '#4CAF50' },
            { key: 'm_fibo', label: 'M', type: 'area', fields: ['m_f618', 'm_f500', 'm_f382'], color: '#2196F3' },
            { key: 'q_fibo', label: 'Q', type: 'area', fields: ['q_f618', 'q_f500', 'q_f382'], color: '#FF9800' },
            { key: 'y_fibo', label: 'Y', type: 'area', fields: ['y_f618', 'y_f500', 'y_f382'], color: '#F44336' },
        ],
    },
    {
        key: 'volume_profile',
        name: 'Volume Profile',
        indicators: [
            { key: 'w_vp', label: 'W', type: 'area', fields: ['w_vah', 'w_poc', 'w_val'], color: '#2E7D32' },
            { key: 'm_vp', label: 'M', type: 'area', fields: ['m_vah', 'm_poc', 'm_val'], color: '#0D47A1' },
            { key: 'q_vp', label: 'Q', type: 'area', fields: ['q_vah', 'q_poc', 'q_val'], color: '#E65100' },
            { key: 'y_vp', label: 'Y', type: 'area', fields: ['y_vah', 'y_poc', 'y_val'], color: '#B71C1C' },
        ],
    },
    {
        key: 'volume_ma',
        name: 'Volume MA',
        indicators: [
            { key: 'vsma5', label: 'VSMA 5', type: 'volume-line', field: 'vsma5', color: '#26A69A' },
            { key: 'vsma60', label: 'VSMA 60', type: 'volume-line', field: 'vsma60', color: '#80CBC4' },
        ],
    },
];

/** Build default state: all indicators off */
export function getDefaultEnabledIndicators(): Record<string, boolean> {
    const result: Record<string, boolean> = {};
    for (const group of INDICATOR_GROUPS) {
        for (const ind of group.indicators) {
            result[ind.key] = false;
        }
    }
    return result;
}

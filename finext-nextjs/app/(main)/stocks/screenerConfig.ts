// finext-nextjs/app/(main)/stocks/screenerConfig.ts
/**
 * Central configuration for Stock Screener.
 * Column definitions, table view presets, filter presets, and constants.
 */

// ─── Types ───────────────────────────────────────────────────────────────────
export type TableViewKey = 'overview' | 'technical' | 'cashflow' | 'zones' | 'custom';

export interface ColumnDef {
    field: string;
    label: string;
    shortLabel?: string;
    group: string;
    width?: number;
    align?: 'left' | 'right' | 'center';
    format?: 'price' | 'pct' | 'volume' | 'value' | 'score' | 'text' | 'rank';
    sortable?: boolean;
}

export interface FilterPreset {
    id: string;
    label: string;
    iconifyIcon: string;
    description: string;
    filters: Record<string, any>;
}

// ─── All Available Columns ───────────────────────────────────────────────────

export const ALL_COLUMNS: ColumnDef[] = [
    // Định danh
    { field: 'ticker', label: 'Mã CK', group: 'info', width: 100, align: 'left', format: 'text', sortable: true },
    { field: 'ticker_name', label: 'Tên công ty', group: 'info', width: 220, align: 'left', format: 'text', sortable: true },
    { field: 'exchange', label: 'Sàn', group: 'info', width: 70, align: 'center', format: 'text', sortable: true },
    { field: 'industry_name', label: 'Ngành', group: 'info', width: 130, align: 'left', format: 'text', sortable: true },
    { field: 'marketcap_name', label: 'Vốn hóa', shortLabel: 'VH', group: 'info', width: 100, align: 'center', format: 'text', sortable: true },
    { field: 'category_name', label: 'Nhóm', group: 'info', width: 100, align: 'center', format: 'text', sortable: true },
    { field: 'top100', label: 'Top 100', group: 'info', width: 70, align: 'center', format: 'text', sortable: true },

    // Giá & OHLCV
    { field: 'open', label: 'Mở cửa', group: 'price', width: 85, align: 'right', format: 'price', sortable: true },
    { field: 'high', label: 'Cao nhất', group: 'price', width: 85, align: 'right', format: 'price', sortable: true },
    { field: 'low', label: 'Thấp nhất', group: 'price', width: 85, align: 'right', format: 'price', sortable: true },
    { field: 'close', label: 'Giá', group: 'price', width: 85, align: 'right', format: 'price', sortable: true },
    { field: 'prev_close', label: 'Giá TC', group: 'price', width: 85, align: 'right', format: 'price', sortable: true },
    { field: 'diff', label: '±', group: 'price', width: 70, align: 'right', format: 'price', sortable: true },
    { field: 'pct_change', label: '±%', group: 'price', width: 75, align: 'right', format: 'pct', sortable: true },
    { field: 'volume', label: 'KL', group: 'price', width: 95, align: 'right', format: 'volume', sortable: true },
    { field: 'trading_value', label: 'GTGD', group: 'price', width: 100, align: 'right', format: 'value', sortable: true },
    { field: 'cap_value', label: 'Vốn hóa TT', shortLabel: 'VHTT', group: 'price', width: 110, align: 'right', format: 'value', sortable: true },

    // % thay đổi theo khung
    { field: 'w_pct', label: 'Tuần%', group: 'change', width: 80, align: 'right', format: 'pct', sortable: true },
    { field: 'm_pct', label: 'Tháng%', group: 'change', width: 80, align: 'right', format: 'pct', sortable: true },
    { field: 'q_pct', label: 'Quý%', group: 'change', width: 80, align: 'right', format: 'pct', sortable: true },
    { field: 'y_pct', label: 'Năm%', group: 'change', width: 80, align: 'right', format: 'pct', sortable: true },

    // Moving Averages
    { field: 'ma5', label: 'MA5', group: 'ma', width: 85, align: 'right', format: 'price', sortable: true },
    { field: 'ma20', label: 'MA20', group: 'ma', width: 85, align: 'right', format: 'price', sortable: true },
    { field: 'ma60', label: 'MA60', group: 'ma', width: 85, align: 'right', format: 'price', sortable: true },
    { field: 'ma120', label: 'MA120', group: 'ma', width: 85, align: 'right', format: 'price', sortable: true },
    { field: 'ma240', label: 'MA240', group: 'ma', width: 85, align: 'right', format: 'price', sortable: true },

    // Volume indicators
    { field: 'vema5', label: 'VEMA5', group: 'volume_ind', width: 90, align: 'right', format: 'volume', sortable: true },
    { field: 'vsma5', label: 'VSMA5', group: 'volume_ind', width: 90, align: 'right', format: 'volume', sortable: true },
    { field: 'vsma60', label: 'VSMA60', group: 'volume_ind', width: 90, align: 'right', format: 'volume', sortable: true },
    { field: 'vsi', label: 'VSI', group: 'volume_ind', width: 70, align: 'right', format: 'score', sortable: true },

    // Dòng tiền & Xếp hạng
    { field: 't0_score', label: 'T0', group: 'cashflow', width: 65, align: 'right', format: 'score', sortable: true },
    { field: 't5_score', label: 'T5', group: 'cashflow', width: 65, align: 'right', format: 'score', sortable: true },
    { field: 'market_rank_pct', label: 'Rank TT', group: 'cashflow', width: 80, align: 'right', format: 'rank', sortable: true },
    { field: 'industry_rank_pct', label: 'Rank Ngành', group: 'cashflow', width: 90, align: 'right', format: 'rank', sortable: true },
    { field: 'market_count', label: 'Tổng TT', group: 'cashflow', width: 70, align: 'right', format: 'text', sortable: true },
    { field: 'industry_count', label: 'Tổng Ngành', group: 'cashflow', width: 80, align: 'right', format: 'text', sortable: true },

    // Contribution Scores
    { field: 'FNXINDEX_ctb', label: 'CTB FNX', group: 'contribution', width: 85, align: 'right', format: 'score', sortable: true },
    { field: 'FNX100_ctb', label: 'CTB F100', group: 'contribution', width: 85, align: 'right', format: 'score', sortable: true },
    { field: 'industry_ctb', label: 'CTB Ngành', group: 'contribution', width: 90, align: 'right', format: 'score', sortable: true },

    // Zone classifications
    { field: 'w_zone', label: 'Zone W', group: 'zones', width: 90, align: 'center', format: 'text', sortable: true },
    { field: 'm_zone', label: 'Zone M', group: 'zones', width: 90, align: 'center', format: 'text', sortable: true },
    { field: 'q_zone', label: 'Zone Q', group: 'zones', width: 90, align: 'center', format: 'text', sortable: true },
    { field: 'y_zone', label: 'Zone Y', group: 'zones', width: 90, align: 'center', format: 'text', sortable: true },
    { field: 'w_ma_zone', label: 'MA Zone W', group: 'zones', width: 100, align: 'center', format: 'text', sortable: true },
    { field: 'm_ma_zone', label: 'MA Zone M', group: 'zones', width: 100, align: 'center', format: 'text', sortable: true },
    { field: 'q_ma_zone', label: 'MA Zone Q', group: 'zones', width: 100, align: 'center', format: 'text', sortable: true },
    { field: 'y_ma_zone', label: 'MA Zone Y', group: 'zones', width: 100, align: 'center', format: 'text', sortable: true },
    { field: 'w_fibo_zone', label: 'Fibo Zone W', group: 'zones', width: 100, align: 'center', format: 'text', sortable: true },
    { field: 'm_fibo_zone', label: 'Fibo Zone M', group: 'zones', width: 100, align: 'center', format: 'text', sortable: true },
    { field: 'q_fibo_zone', label: 'Fibo Zone Q', group: 'zones', width: 100, align: 'center', format: 'text', sortable: true },
    { field: 'y_fibo_zone', label: 'Fibo Zone Y', group: 'zones', width: 100, align: 'center', format: 'text', sortable: true },
    { field: 'w_vp_zone', label: 'VP Zone W', group: 'zones', width: 100, align: 'center', format: 'text', sortable: true },
    { field: 'm_vp_zone', label: 'VP Zone M', group: 'zones', width: 100, align: 'center', format: 'text', sortable: true },
    { field: 'q_vp_zone', label: 'VP Zone Q', group: 'zones', width: 100, align: 'center', format: 'text', sortable: true },
    { field: 'y_vp_zone', label: 'VP Zone Y', group: 'zones', width: 100, align: 'center', format: 'text', sortable: true },
];

// Field lookup map
export const COLUMN_MAP = new Map(ALL_COLUMNS.map(c => [c.field, c]));

// ─── Table View Presets ──────────────────────────────────────────────────────

export const TABLE_VIEWS: Record<TableViewKey, { label: string; iconifyIcon: string; fields: string[] }> = {
    overview: {
        label: 'Tổng quan',
        iconifyIcon: 'solar:chart-square-bold-duotone',
        fields: [
            'ticker', 'exchange', 'close', 'pct_change', 'volume', 'trading_value',
            'w_pct', 'm_pct', 't0_score', 'market_rank_pct',
        ],
    },
    technical: {
        label: 'Kỹ thuật',
        iconifyIcon: 'solar:graph-up-bold-duotone',
        fields: [
            'ticker', 'close', 'pct_change',
            'ma5', 'ma20', 'ma60', 'ma120', 'ma240',
            'vsi', 'vsma5',
        ],
    },
    cashflow: {
        label: 'Dòng tiền',
        iconifyIcon: 'solar:dollar-bold-duotone',
        fields: [
            'ticker', 'close', 'pct_change',
            't0_score', 't5_score', 'market_rank_pct', 'industry_rank_pct',
            'vsi', 'volume', 'trading_value',
        ],
    },
    zones: {
        label: 'Vùng KT',
        iconifyIcon: 'solar:target-bold-duotone',
        fields: [
            'ticker', 'close', 'pct_change',
            'w_zone', 'm_zone', 'q_zone', 'y_zone',
            'w_ma_zone', 'm_ma_zone',
        ],
    },
    custom: {
        label: 'Tuỳ chỉnh',
        iconifyIcon: 'solar:settings-bold-duotone',
        fields: [],
    },
};

// ─── Column Groups for ColumnCustomizer ──────────────────────────────────────

export const COLUMN_GROUPS = [
    { key: 'info', label: 'Thông tin' },
    { key: 'price', label: 'Giá & OHLCV' },
    { key: 'change', label: '% Thay đổi' },
    { key: 'ma', label: 'Moving Average' },
    { key: 'volume_ind', label: 'KL & VSI' },
    { key: 'cashflow', label: 'Dòng tiền' },
    { key: 'contribution', label: 'Đóng góp' },
    { key: 'zones', label: 'Vùng kỹ thuật' },
];

// ─── Filter Presets ──────────────────────────────────────────────────────────

export const FILTER_PRESETS: FilterPreset[] = [
    {
        id: 'week_gainers',
        label: 'Tăng mạnh tuần',
        iconifyIcon: 'solar:rocket-bold-duotone',
        description: 'Cổ phiếu tăng > 5% trong tuần',
        filters: {
            rangeFilters: { w_pct: { min: 5, max: null } },
        },
    },
    {
        id: 'strong_cashflow',
        label: 'Dòng tiền tốt',
        iconifyIcon: 'solar:star-bold-duotone',
        description: 'Điểm dòng tiền T0 > 70 & T5 > 60',
        filters: {
            rangeFilters: {
                t0_score: { min: 70, max: null },
                t5_score: { min: 60, max: null },
            },
        },
    },
    {
        id: 'largecap_liquid',
        label: 'Bluechip',
        iconifyIcon: 'solar:buildings-3-bold-duotone',
        description: 'Vốn hóa lớn, GTGD > 50 tỷ',
        filters: {
            selectFilters: { marketcap_name: ['Vốn hóa lớn'] },
            rangeFilters: { trading_value: { min: 50000000000, max: null } },
        },
    },
    {
        id: 'accumulation_zone',
        label: 'Vùng tích lũy',
        iconifyIcon: 'solar:target-bold-duotone',
        description: 'Cổ phiếu đang ở vùng tích lũy (Zone tổng hợp)',
        filters: {
            selectFilters: { m_zone: ['Tích lũy'] },
        },
    },
    {
        id: 'top_ranked',
        label: 'Xếp hạng đầu',
        iconifyIcon: 'solar:cup-star-bold-duotone',
        description: 'Top 20% xếp hạng thị trường',
        filters: {
            rangeFilters: { market_rank_pct: { min: 80, max: null } },
        },
    },
];

// ─── Advanced Filter Definitions ─────────────────────────────────────────────

export type AdvancedCompare = 'above' | 'below' | 'range';

export interface AdvancedFilterDef {
    field: string;       // field to compare (e.g., 'ma5', 'w_pivot')
    label: string;
    group: string;
    groupLabel: string;
    timeframe?: string;  // 'w' | 'm' | 'q' | 'y' | null
}

const TIMEFRAME_LABELS: Record<string, string> = { w: 'Tuần', m: 'Tháng', q: 'Quý', y: 'Năm' };

function buildAdvancedFilters(): AdvancedFilterDef[] {
    const defs: AdvancedFilterDef[] = [];

    // MA
    for (const ma of ['ma5', 'ma20', 'ma60', 'ma120', 'ma240']) {
        defs.push({ field: ma, label: ma.toUpperCase(), group: 'ma', groupLabel: 'Moving Average' });
    }

    // OHL, Pivot, Fibonacci, VP — per timeframe
    const timeframes = ['w', 'm', 'q', 'y'];
    for (const tf of timeframes) {
        const tfLabel = TIMEFRAME_LABELS[tf];
        // OHL
        defs.push({ field: `${tf}_open`, label: `OPEN ${tfLabel}`, group: 'ohl', groupLabel: 'Open / High / Low', timeframe: tf });
        defs.push({ field: `${tf}_ph`, label: `PREV HIGH ${tfLabel}`, group: 'ohl', groupLabel: 'Open / High / Low', timeframe: tf });
        defs.push({ field: `${tf}_pl`, label: `PREV LOW ${tfLabel}`, group: 'ohl', groupLabel: 'Open / High / Low', timeframe: tf });
        // Pivot
        defs.push({ field: `${tf}_pivot`, label: `PIVOT ${tfLabel}`, group: 'pivot', groupLabel: 'Pivot Points', timeframe: tf });
        defs.push({ field: `${tf}_r1`, label: `R1 ${tfLabel}`, group: 'pivot', groupLabel: 'Pivot Points', timeframe: tf });
        defs.push({ field: `${tf}_s1`, label: `S1 ${tfLabel}`, group: 'pivot', groupLabel: 'Pivot Points', timeframe: tf });
        // Fibonacci
        defs.push({ field: `${tf}_f382`, label: `F38.2 ${tfLabel}`, group: 'fibo', groupLabel: 'Fibonacci', timeframe: tf });
        defs.push({ field: `${tf}_f500`, label: `F50.0 ${tfLabel}`, group: 'fibo', groupLabel: 'Fibonacci', timeframe: tf });
        defs.push({ field: `${tf}_f618`, label: `F61.8 ${tfLabel}`, group: 'fibo', groupLabel: 'Fibonacci', timeframe: tf });
        // Volume Profile
        defs.push({ field: `${tf}_vah`, label: `VAH ${tfLabel}`, group: 'vp', groupLabel: 'Volume Profile', timeframe: tf });
        defs.push({ field: `${tf}_poc`, label: `POC ${tfLabel}`, group: 'vp', groupLabel: 'Volume Profile', timeframe: tf });
        defs.push({ field: `${tf}_val`, label: `VAL ${tfLabel}`, group: 'vp', groupLabel: 'Volume Profile', timeframe: tf });
    }

    return defs;
}

export const ADVANCED_FILTER_DEFS = buildAdvancedFilters();
export const ADVANCED_FILTER_GROUPS = [
    { key: 'ma', label: 'Moving Average' },
    { key: 'ohl', label: 'Open / High / Low' },
    { key: 'pivot', label: 'Pivot Points' },
    { key: 'fibo', label: 'Fibonacci' },
    { key: 'vp', label: 'Volume Profile' },
];

// ─── Format Helpers ──────────────────────────────────────────────────────────

export function formatCellValue(value: any, format?: string): string {
    if (value == null || value === '') return '—';

    switch (format) {
        case 'price':
            return typeof value === 'number'
                ? value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                : String(value);
        case 'pct':
            if (typeof value !== 'number') return String(value);
            return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(2)}%`;
        case 'volume':
            if (typeof value !== 'number') return String(value);
            if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
            if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
            if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
            return value.toLocaleString();
        case 'value':
            if (typeof value !== 'number') return String(value);
            if (value >= 1_000_000_000_000) return `${(value / 1_000_000_000_000).toFixed(1)}T`;
            if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
            if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
            return value.toLocaleString();
        case 'score':
            return typeof value === 'number' ? value.toFixed(1) : String(value);
        case 'rank':
            return typeof value === 'number' ? `${(value * 100).toFixed(0)}%` : String(value);
        default:
            return String(value);
    }
}

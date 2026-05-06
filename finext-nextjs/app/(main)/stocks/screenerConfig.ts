// finext-nextjs/app/(main)/stocks/screenerConfig.ts
/**
 * Central configuration for Stock Screener.
 * Column definitions, table view presets, filter presets, and constants.
 */

// ─── Types ───────────────────────────────────────────────────────────────────
export type TableViewKey = 'overview' | 'technical' | 'cashflow' | 'custom';

export interface ColumnDef {
    field: string;
    label: string;
    shortLabel?: string;
    group: string;
    width?: number;
    align?: 'left' | 'right' | 'center';
    format?: 'price' | 'diff' | 'pct' | 'volume' | 'value' | 'tỷ' | 'tỷ0' | 'score' | 'flow' | 'text' | 'rank' | 'vsi';
    sortable?: boolean;
    tooltip?: string;
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
    { field: 'ticker', label: 'Mã CK', group: 'info', width: 80, align: 'left', format: 'text', sortable: true },
    { field: 'ticker_name', label: 'Tên công ty', group: 'info', width: 220, align: 'left', format: 'text', sortable: true },
    { field: 'exchange', label: 'Sàn', group: 'info', width: 85, align: 'left', format: 'text', sortable: true },
    { field: 'industry_name', label: 'Ngành Nghề', group: 'info', width: 130, align: 'left', format: 'text', sortable: true },
    { field: 'marketcap_name', label: 'Nhóm Vốn hoá', group: 'info', width: 120, align: 'left', format: 'text', sortable: true },
    { field: 'category_name', label: 'Nhóm Dòng tiền', group: 'info', width: 120, align: 'left', format: 'text', sortable: true },

    // Giá & OHLCV
    { field: 'open', label: 'Mở cửa', group: 'price', width: 85, align: 'right', format: 'price', sortable: true, tooltip: 'Giá khớp lệnh đầu phiên' },
    { field: 'high', label: 'Cao nhất', group: 'price', width: 85, align: 'right', format: 'price', sortable: true, tooltip: 'Giá cao nhất trong phiên' },
    { field: 'low', label: 'Thấp nhất', group: 'price', width: 85, align: 'right', format: 'price', sortable: true, tooltip: 'Giá thấp nhất trong phiên' },
    { field: 'close', label: 'Giá', group: 'price', width: 85, align: 'right', format: 'price', sortable: true },
    { field: 'diff', label: '±', group: 'price', width: 70, align: 'right', format: 'diff', sortable: true, tooltip: 'Mức thay đổi giá tuyệt đối so với giá tham chiếu' },
    { field: 'pct_change', label: '±%', group: 'price', width: 75, align: 'right', format: 'pct', sortable: true, tooltip: 'Mức thay đổi giá theo % so với giá tham chiếu' },
    { field: 'volume', label: 'KLGD', group: 'price', width: 95, align: 'right', format: 'volume', sortable: true, tooltip: 'Khối lượng giao dịch khớp lệnh trong phiên' },
    { field: 'trading_value', label: 'GTGD', group: 'price', width: 100, align: 'right', format: 'tỷ', sortable: true, tooltip: 'Giá trị giao dịch trong phiên' },
    { field: 'cap_value', label: 'Vốn hóa TT', shortLabel: 'VHTT', group: 'info', width: 110, align: 'right', format: 'tỷ0', sortable: true, tooltip: 'Vốn hoá thị trường: tổng giá trị vốn hoá của cổ phiếu' },

    // % thay đổi theo khung
    { field: 'w_pct', label: '% Tuần', group: 'change', width: 80, align: 'right', format: 'pct', sortable: true, tooltip: 'Tỷ lệ % thay đổi giá so với cuối tuần trước' },
    { field: 'm_pct', label: '% Tháng', group: 'change', width: 80, align: 'right', format: 'pct', sortable: true, tooltip: 'Tỷ lệ % thay đổi giá so với cuối tháng trước' },
    { field: 'q_pct', label: '% Quý', group: 'change', width: 80, align: 'right', format: 'pct', sortable: true, tooltip: 'Tỷ lệ % thay đổi giá so với cuối quý trước' },
    { field: 'y_pct', label: '% Năm', group: 'change', width: 80, align: 'right', format: 'pct', sortable: true, tooltip: 'Tỷ lệ % thay đổi giá so với cuối năm trước' },

    // Volume indicators
    { field: 'vsi', label: 'CSTK', group: 'price', width: 75, align: 'right', format: 'vsi', sortable: true, tooltip: 'Chỉ số thanh khoản: so sánh thanh khoản phiên hiện tại với thanh khoản trung bình của tuần' },

    // Dòng tiền & Xếp hạng
    { field: 't0_score', label: 'DT Phiên', group: 'cashflow', width: 75, align: 'right', format: 'flow', sortable: true, tooltip: 'Sức mạnh dòng tiền: thể hiện cường độ tiền vào / ra cổ phiếu trong phiên hiện tại' },
    { field: 't5_score', label: 'DT Tuần', group: 'cashflow', width: 75, align: 'right', format: 'flow', sortable: true, tooltip: 'Sức mạnh dòng tiền: thể hiện cường độ tiền vào / ra cổ phiếu tích luỹ trong tuần' },
    { field: 'market_rank_pct', label: 'XHTT', group: 'cashflow', width: 70, align: 'right', format: 'rank', sortable: true, tooltip: 'Xếp hạng thị trường: vị trí phân vị của cổ phiếu so với toàn bộ thị trường — giá trị càng cao, cổ phiếu càng đứng trên nhiều mã khác' },
    { field: 'industry_rank_pct', label: 'XH Ngành', group: 'cashflow', width: 80, align: 'right', format: 'rank', sortable: true, tooltip: 'Xếp hạng ngành: vị trí phân vị của cổ phiếu trong nội bộ ngành — giá trị càng cao, cổ phiếu càng dẫn đầu ngành' },


    // Zone classifications
    { field: 'w_zone', label: 'Zone W', group: 'zones', width: 90, align: 'center', format: 'text', sortable: true, tooltip: 'Vị thế giá tổng hợp theo phân tích kỹ thuật — khung tuần' },
    { field: 'm_zone', label: 'Zone M', group: 'zones', width: 90, align: 'center', format: 'text', sortable: true, tooltip: 'Vị thế giá tổng hợp theo phân tích kỹ thuật — khung tháng' },
    { field: 'q_zone', label: 'Zone Q', group: 'zones', width: 90, align: 'center', format: 'text', sortable: true, tooltip: 'Vị thế giá tổng hợp theo phân tích kỹ thuật — khung quý' },
    { field: 'y_zone', label: 'Zone Y', group: 'zones', width: 90, align: 'center', format: 'text', sortable: true, tooltip: 'Vị thế giá tổng hợp theo phân tích kỹ thuật — khung năm' },
    { field: 'w_ma_zone', label: 'MA Zone W', group: 'zones', width: 100, align: 'center', format: 'text', sortable: true, tooltip: 'Vị thế giá tương đối so với hệ thống đường trung bình động (MA) — khung tuần' },
    { field: 'm_ma_zone', label: 'MA Zone M', group: 'zones', width: 100, align: 'center', format: 'text', sortable: true, tooltip: 'Vị thế giá tương đối so với hệ thống đường trung bình động (MA) — khung tháng' },
    { field: 'q_ma_zone', label: 'MA Zone Q', group: 'zones', width: 100, align: 'center', format: 'text', sortable: true, tooltip: 'Vị thế giá tương đối so với hệ thống đường trung bình động (MA) — khung quý' },
    { field: 'y_ma_zone', label: 'MA Zone Y', group: 'zones', width: 100, align: 'center', format: 'text', sortable: true, tooltip: 'Vị thế giá tương đối so với hệ thống đường trung bình động (MA) — khung năm' },
    { field: 'w_fibo_zone', label: 'Fibo Zone W', group: 'zones', width: 100, align: 'center', format: 'text', sortable: true, tooltip: 'Vị thế giá tương đối so với các mức Fibonacci retracement — khung tuần' },
    { field: 'm_fibo_zone', label: 'Fibo Zone M', group: 'zones', width: 100, align: 'center', format: 'text', sortable: true, tooltip: 'Vị thế giá tương đối so với các mức Fibonacci retracement — khung tháng' },
    { field: 'q_fibo_zone', label: 'Fibo Zone Q', group: 'zones', width: 100, align: 'center', format: 'text', sortable: true, tooltip: 'Vị thế giá tương đối so với các mức Fibonacci retracement — khung quý' },
    { field: 'y_fibo_zone', label: 'Fibo Zone Y', group: 'zones', width: 100, align: 'center', format: 'text', sortable: true, tooltip: 'Vị thế giá tương đối so với các mức Fibonacci retracement — khung năm' },
    { field: 'w_vp_zone', label: 'VP Zone W', group: 'zones', width: 100, align: 'center', format: 'text', sortable: true, tooltip: 'Vị thế giá trong cấu trúc Volume Profile — khung tuần' },
    { field: 'm_vp_zone', label: 'VP Zone M', group: 'zones', width: 100, align: 'center', format: 'text', sortable: true, tooltip: 'Vị thế giá trong cấu trúc Volume Profile — khung tháng' },
    { field: 'q_vp_zone', label: 'VP Zone Q', group: 'zones', width: 100, align: 'center', format: 'text', sortable: true, tooltip: 'Vị thế giá trong cấu trúc Volume Profile — khung quý' },
    { field: 'y_vp_zone', label: 'VP Zone Y', group: 'zones', width: 100, align: 'center', format: 'text', sortable: true, tooltip: 'Vị thế giá trong cấu trúc Volume Profile — khung năm' },
];

// Field lookup map
export const COLUMN_MAP = new Map(ALL_COLUMNS.map(c => [c.field, c]));

// ─── Table View Presets ──────────────────────────────────────────────────────

export const TABLE_VIEWS: Record<TableViewKey, { label: string; iconifyIcon: string; fields: string[] }> = {
    overview: {
        label: 'Tổng quan',
        iconifyIcon: 'solar:chart-square-bold-duotone',
        fields: [
            'ticker', 'exchange', 'industry_name', 'marketcap_name', 'category_name',
            'close', 'diff', 'pct_change', 'volume', 'vsi', 'trading_value', 'cap_value',
        ],
    },
    technical: {
        label: 'Vùng giá',
        iconifyIcon: 'solar:graph-up-bold-duotone',
        fields: [
            'ticker',
            'w_zone', 'm_zone', 'q_zone', 'y_zone',
            'w_ma_zone', 'm_ma_zone', 'q_ma_zone', 'y_ma_zone',
            'w_fibo_zone', 'm_fibo_zone', 'q_fibo_zone', 'y_fibo_zone',
            'w_vp_zone', 'm_vp_zone', 'q_vp_zone', 'y_vp_zone',
        ],
    },
    cashflow: {
        label: 'Dòng tiền',
        iconifyIcon: 'solar:dollar-bold-duotone',
        fields: [
            'ticker', 'diff', 'pct_change',
            't0_score', 't5_score', 'volume', 'vsi',
            'w_pct', 'm_pct', 'q_pct', 'y_pct',
            'industry_rank_pct', 'market_rank_pct',
        ],
    },

    custom: {
        label: 'Tuỳ chỉnh',
        iconifyIcon: 'solar:settings-bold-duotone',
        fields: [
            'ticker', 'exchange', 'industry_name', 'marketcap_name', 'category_name',
            'close', 'diff', 'pct_change', 'volume', 'vsi', 'trading_value', 'cap_value',
        ],
    },
};

// ─── Column Groups for ColumnCustomizer ──────────────────────────────────────

export const COLUMN_GROUPS = [
    { key: 'info', label: 'Thông tin' },
    { key: 'price', label: 'Trong phiên' },
    { key: 'change', label: '% Thay đổi' },
    { key: 'cashflow', label: 'Dòng tiền' },
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
            rangeFilters: { w_pct: { min: 0.05, max: null } },
        },
    },
    {
        id: 'strong_cashflow',
        label: 'Dòng tiền tốt',
        iconifyIcon: 'solar:star-bold-duotone',
        description: 'Có dòng tiền vào trong phiên và trong tuần',
        filters: {
            rangeFilters: {
                t0_score: { min: 0, max: null },
                t5_score: { min: 0, max: null },
            },
        },
    },
    {
        id: 'largecap_liquid',
        label: 'GTGD lớn',
        iconifyIcon: 'solar:buildings-3-bold-duotone',
        description: 'Giá trị giao dịch > 20 tỷ',
        filters: {
            rangeFilters: { trading_value: { min: 20, max: null } },
        },
    },
    {
        id: 'accumulation_zone',
        label: 'Vùng tích lũy',
        iconifyIcon: 'solar:target-bold-duotone',
        description: 'Cổ phiếu đang ở vùng giá tích luỹ',
        filters: {
            selectFilters: { w_zone: ['AAA'], m_zone: ['A'], q_zone: ['A'] },
        },
    },
    {
        id: 'top_ranked',
        label: 'Xếp hạng đầu',
        iconifyIcon: 'solar:cup-star-bold-duotone',
        description: 'Xếp hạng tốt trong ngành và thị trường',
        filters: {
            rangeFilters: {
                market_rank_pct: { min: 0.70, max: null },
                industry_rank_pct: { min: 0.50, max: null },
            },
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
        case 'diff':
            if (typeof value !== 'number') return String(value);
            return `${value > 0 ? '+' : ''}${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        case 'pct':
            if (typeof value !== 'number') return String(value);
            return `${value > 0 ? '+' : ''}${(value * 100).toFixed(2)}%`;
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
        case 'tỷ0': {
            if (typeof value !== 'number') return String(value);
            const raw0 = value * 1_000_000_000;
            const fmt0 = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });
            if (raw0 >= 1_000_000_000) return `${fmt0(raw0 / 1_000_000_000)}B`;
            if (raw0 >= 1_000_000) return `${fmt0(raw0 / 1_000_000)}M`;
            if (raw0 >= 1_000) return `${fmt0(raw0 / 1_000)}K`;
            return fmt0(raw0);
        }
        case 'tỷ': {
            if (typeof value !== 'number') return String(value);
            const raw = value * 1_000_000_000;
            const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
            if (raw >= 1_000_000_000) return `${fmt(raw / 1_000_000_000)}B`;
            if (raw >= 1_000_000) return `${fmt(raw / 1_000_000)}M`;
            if (raw >= 1_000) return `${fmt(raw / 1_000)}K`;
            return raw.toLocaleString('en-US', { maximumFractionDigits: 0 });
        }
        case 'vsi':
            return typeof value === 'number' ? `${(value * 100).toFixed(1)}%` : String(value);
        case 'flow':
            if (typeof value !== 'number') return String(value);
            return `${value > 0 ? '+' : ''}${value.toFixed(1)}`;
        case 'score':
            return typeof value === 'number' ? value.toFixed(1) : String(value);
        case 'rank':
            if (typeof value !== 'number') return String(value);
            if (value === 0) return '—';
            return `${(value * 100).toFixed(0)}%`;
        default:
            return String(value);
    }
}

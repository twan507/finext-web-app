// financials-config.ts — Types, format utils, metric config, section layout cho tab Tài chính ngành

// ============================================================
// TYPES
// ============================================================

export type IndustryType = 'SXKD' | 'NGANHANG' | 'CHUNGKHOAN' | 'BAOHIEM';
export type MetricFormat = 'pct' | 'multiple' | 'days' | 'growth_pct';

export interface FinstatsRecord {
    industry: string;
    industry_name: string;
    type: IndustryType;
    period: string;
    n_stocks: number;
    [key: string]: number | string | null | undefined;
}

export interface FinstatsMapEntry {
    code: string;
    type: string;
    vi: string;
    en: string;
}

export interface MetricFormatConfig {
    format: MetricFormat;
    unit: string;
    deltaUnit: string;
    higherIsBetter: boolean;
    multiplier: number; // nhân raw value trước khi hiển thị (100 cho pct)
}

export interface SectionConfig {
    id: string;
    title: string;
    metrics: string[];
}

export interface ProcessedMetric {
    key: string;
    name: string;
    value: number | null;
    displayValue: string;
    delta: number | null;
    displayDelta: string;
    deltaColor: 'success' | 'error' | 'neutral';
    sparklineValues: (number | null)[]; // raw values (chưa nhân multiplier) — SVG tự scale
    displayMin: string;
    displayMax: string;
}

// ============================================================
// METRIC FORMAT CONFIG
// ============================================================

export const METRIC_FORMAT_CONFIG: Record<string, MetricFormatConfig> = {
    // Valuation
    ryd21: { format: 'multiple', unit: 'x', deltaUnit: '', higherIsBetter: false, multiplier: 1 },
    ryd25: { format: 'multiple', unit: 'x', deltaUnit: '', higherIsBetter: false, multiplier: 1 },
    ryd26: { format: 'multiple', unit: 'x', deltaUnit: '', higherIsBetter: false, multiplier: 1 },
    ryq76: { format: 'multiple', unit: 'x', deltaUnit: '', higherIsBetter: false, multiplier: 1 },

    // Profitability
    ryq12: { format: 'pct', unit: '%', deltaUnit: 'pp', higherIsBetter: true, multiplier: 100 },
    ryq14: { format: 'pct', unit: '%', deltaUnit: 'pp', higherIsBetter: true, multiplier: 100 },
    ryq25: { format: 'pct', unit: '%', deltaUnit: 'pp', higherIsBetter: true, multiplier: 100 },
    ryq27: { format: 'pct', unit: '%', deltaUnit: 'pp', higherIsBetter: true, multiplier: 100 },
    ryq29: { format: 'pct', unit: '%', deltaUnit: 'pp', higherIsBetter: true, multiplier: 100 },
    ryq31: { format: 'multiple', unit: 'x', deltaUnit: '', higherIsBetter: true, multiplier: 1 },
    ryq91: { format: 'multiple', unit: 'x', deltaUnit: '', higherIsBetter: true, multiplier: 1 },

    // Financial health
    ryq1: { format: 'multiple', unit: 'x', deltaUnit: '', higherIsBetter: true, multiplier: 1 },
    ryq2: { format: 'multiple', unit: 'x', deltaUnit: '', higherIsBetter: true, multiplier: 1 },
    ryq3: { format: 'multiple', unit: 'x', deltaUnit: '', higherIsBetter: true, multiplier: 1 },
    ryq6: { format: 'multiple', unit: 'x', deltaUnit: '', higherIsBetter: false, multiplier: 1 },
    ryq71: { format: 'multiple', unit: 'x', deltaUnit: '', higherIsBetter: false, multiplier: 1 },
    ryq77: { format: 'multiple', unit: 'x', deltaUnit: '', higherIsBetter: true, multiplier: 1 },
    cashCycle: { format: 'days', unit: 'ngày', deltaUnit: 'ngày', higherIsBetter: false, multiplier: 1 },

    // Working-capital efficiency
    ryq16: { format: 'days', unit: 'ngày', deltaUnit: 'ngày', higherIsBetter: false, multiplier: 1 },
    ryq18: { format: 'days', unit: 'ngày', deltaUnit: 'ngày', higherIsBetter: false, multiplier: 1 },
    ryq20: { format: 'days', unit: 'ngày', deltaUnit: 'ngày', higherIsBetter: true, multiplier: 1 },

    // Growth
    ryq34: { format: 'growth_pct', unit: '%', deltaUnit: 'pp', higherIsBetter: true, multiplier: 100 },
    ryq39: { format: 'growth_pct', unit: '%', deltaUnit: 'pp', higherIsBetter: true, multiplier: 100 },

    // Banking — income / efficiency
    ryq44: { format: 'pct', unit: '%', deltaUnit: 'pp', higherIsBetter: true, multiplier: 100 }, // NIM
    ryq45: { format: 'pct', unit: '%', deltaUnit: 'pp', higherIsBetter: true, multiplier: 100 }, // YOEA
    ryq46: { format: 'pct', unit: '%', deltaUnit: 'pp', higherIsBetter: false, multiplier: 100 }, // COF
    ryq47: { format: 'multiple', unit: 'x', deltaUnit: '', higherIsBetter: true, multiplier: 1 }, // TN ngoài lãi/TN lãi
    ryq48: { format: 'pct', unit: '%', deltaUnit: 'pp', higherIsBetter: false, multiplier: 100 }, // CIR

    // Banking — asset quality
    ryq58: { format: 'pct', unit: '%', deltaUnit: 'pp', higherIsBetter: false, multiplier: 100 }, // NPL
    ryq59: { format: 'pct', unit: '%', deltaUnit: 'pp', higherIsBetter: true, multiplier: 100 }, // Bao phủ nợ xấu
    ryq60: { format: 'pct', unit: '%', deltaUnit: 'pp', higherIsBetter: true, multiplier: 100 }, // Dự phòng/Cho vay
    ryq61: { format: 'pct', unit: '%', deltaUnit: 'pp', higherIsBetter: false, multiplier: 100 }, // Chi phí tín dụng
    ryq57: { format: 'pct', unit: '%', deltaUnit: 'pp', higherIsBetter: false, multiplier: 100 }, // LDR

    // Banking — capital
    ryq54: { format: 'pct', unit: '%', deltaUnit: 'pp', higherIsBetter: true, multiplier: 100 }, // VCSH/Tổng TS
    ryq55: { format: 'pct', unit: '%', deltaUnit: 'pp', higherIsBetter: true, multiplier: 100 }, // VCSH/Cho vay

    // Banking — growth
    rtq50: { format: 'growth_pct', unit: '%', deltaUnit: 'pp', higherIsBetter: true, multiplier: 100 }, // Tín dụng
    rtq51: { format: 'growth_pct', unit: '%', deltaUnit: 'pp', higherIsBetter: true, multiplier: 100 }, // Huy động
    ryq67: { format: 'growth_pct', unit: '%', deltaUnit: 'pp', higherIsBetter: true, multiplier: 100 }, // TN lãi thuần
};

// ============================================================
// SECTION CONFIG — mỗi loại ngành 1 danh sách section
// ============================================================

export const INDUSTRY_SECTIONS: Record<IndustryType, SectionConfig[]> = {
    SXKD: [
        { id: 'profitability', title: 'HIỆU QUẢ HOẠT ĐỘNG', metrics: ['ryq12', 'ryq14', 'ryq25', 'ryq27', 'ryq29', 'ryq31', 'ryq91'] },
        { id: 'health', title: 'SỨC KHỎE TÀI CHÍNH', metrics: ['ryq1', 'ryq2', 'ryq3', 'ryq6', 'ryq71', 'ryq77', 'cashCycle'] },
        { id: 'efficiency', title: 'HIỆU SUẤT SỬ DỤNG', metrics: ['ryq16', 'ryq18', 'ryq20'] },
        { id: 'growth', title: 'TĂNG TRƯỞNG', metrics: ['ryq34', 'ryq39'] },
    ],
    NGANHANG: [
        { id: 'profitability', title: 'HIỆU QUẢ & SINH LỜI', metrics: ['ryq12', 'ryq14', 'ryq44', 'ryq45', 'ryq46', 'ryq47', 'ryq48'] },
        { id: 'asset_quality', title: 'CHẤT LƯỢNG TÀI SẢN', metrics: ['ryq58', 'ryq59', 'ryq60', 'ryq61', 'ryq57'] },
        { id: 'capital', title: 'AN TOÀN VỐN', metrics: ['ryq54', 'ryq55'] },
        { id: 'growth', title: 'TĂNG TRƯỞNG', metrics: ['rtq50', 'rtq51', 'ryq39', 'ryq67'] },
    ],
    CHUNGKHOAN: [
        { id: 'profitability', title: 'HIỆU QUẢ', metrics: ['ryq12', 'ryq14', 'ryq25', 'ryq29', 'ryq31', 'ryq71'] },
        { id: 'risk_leverage', title: 'RỦI RO & ĐÒN BẨY', metrics: ['ryq6', 'ryq1', 'ryq77'] },
        { id: 'growth', title: 'TĂNG TRƯỞNG', metrics: ['ryq34', 'ryq39'] },
    ],
    BAOHIEM: [
        { id: 'profitability', title: 'HIỆU QUẢ', metrics: ['ryq12', 'ryq14', 'ryq25', 'ryq71'] },
        { id: 'growth', title: 'TĂNG TRƯỞNG', metrics: ['ryq34', 'ryq39'] },
    ],
};

export const FOCUS_METRIC_DEFAULT = 'ryq12'; // ROE — focus mặc định cho tất cả ngành

// ============================================================
// FORMAT UTILS
// ============================================================

export function isInvalidNumber(v: unknown): boolean {
    return v == null || v === 0 || (typeof v === 'number' && (isNaN(v) || !isFinite(v)));
}

export function formatMetricValue(key: string, rawValue: number | null | undefined, noUnit = false): string {
    if (isInvalidNumber(rawValue)) return '—';
    const cfg = METRIC_FORMAT_CONFIG[key];
    if (!cfg) return String(rawValue);
    const v = (rawValue as number) * cfg.multiplier;
    switch (cfg.format) {
        case 'pct':
        case 'growth_pct':
            return noUnit ? v.toFixed(2) : `${v.toFixed(2)}%`;
        case 'multiple':
            return noUnit ? v.toFixed(2) : `${v.toFixed(2)}x`;
        case 'days':
            return noUnit ? v.toFixed(1) : `${v.toFixed(1)} ngày`;
        default:
            return v.toFixed(2);
    }
}

export function formatMetricDelta(
    key: string,
    rawDelta: number | null | undefined,
): { text: string; color: 'success' | 'error' | 'neutral' } {
    if (isInvalidNumber(rawDelta)) return { text: '—', color: 'neutral' };
    const cfg = METRIC_FORMAT_CONFIG[key];
    if (!cfg) return { text: '—', color: 'neutral' };

    const d = (rawDelta as number) * cfg.multiplier;
    if (Math.abs(d) < 0.0001) return { text: '=', color: 'neutral' };

    const sign = d > 0 ? '+' : '';
    let text: string;
    switch (cfg.format) {
        case 'pct':
        case 'growth_pct':
            text = `${sign}${d.toFixed(2)}pp`;
            break;
        case 'multiple':
            text = `${sign}${d.toFixed(2)}`;
            break;
        case 'days':
            text = `${sign}${d.toFixed(1)} ngày`;
            break;
        default:
            text = `${sign}${d.toFixed(2)}`;
    }

    const isPositiveGood = d > 0 ? cfg.higherIsBetter : !cfg.higherIsBetter;
    return { text, color: isPositiveGood ? 'success' : 'error' };
}

/** "2025_3" → "Q3/25"  |  "2025_5" → "2025" */
export function formatPeriodLabel(period: string): string {
    if (!period) return period;
    const [year, qStr] = period.split('_');
    if (qStr === '5') return year;
    return `Q${qStr}/${year.slice(2)}`;
}

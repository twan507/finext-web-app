// stock-financials-config.ts — Types, format utils, metric config, section layout cho tab Tài Chính cổ phiếu

// ============================================================
// TYPES
// ============================================================

export type IndustryType = 'SXKD' | 'NGANHANG' | 'CHUNGKHOAN' | 'BAOHIEM';
export type MetricFormat = 'pct' | 'multiple' | 'days' | 'growth_pct' | 'currency_bn';

export interface FinstatsStockRecord {
    ticker: string;
    period: string;
    industry: string;
    industry_name: string;
    type: IndustryType;
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
    higherIsBetter: boolean | null; // null = neutral (balance sheet items)
    multiplier: number;
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
    sparklineValues: (number | null)[];
    displayMin: string;
    displayMax: string;
}

// ============================================================
// METRIC FORMAT CONFIG
// ============================================================

export const METRIC_FORMAT_CONFIG: Record<string, MetricFormatConfig> = {
    // ── Profitability (pct) ──
    ryq12: { format: 'pct', unit: '%', deltaUnit: 'pp', higherIsBetter: true, multiplier: 100 },
    ryq14: { format: 'pct', unit: '%', deltaUnit: 'pp', higherIsBetter: true, multiplier: 100 },
    ryq25: { format: 'pct', unit: '%', deltaUnit: 'pp', higherIsBetter: true, multiplier: 100 },
    ryq27: { format: 'pct', unit: '%', deltaUnit: 'pp', higherIsBetter: true, multiplier: 100 },
    ryq29: { format: 'pct', unit: '%', deltaUnit: 'pp', higherIsBetter: true, multiplier: 100 },
    ryq31: { format: 'multiple', unit: 'x', deltaUnit: '', higherIsBetter: true, multiplier: 1 },
    ryq91: { format: 'multiple', unit: 'x', deltaUnit: '', higherIsBetter: true, multiplier: 1 },

    // ── Health / leverage ──
    ryq71: { format: 'multiple', unit: 'x', deltaUnit: '', higherIsBetter: false, multiplier: 1 },
    ryq6:  { format: 'multiple', unit: 'x', deltaUnit: '', higherIsBetter: false, multiplier: 1 },
    ryq77: { format: 'multiple', unit: 'x', deltaUnit: '', higherIsBetter: true, multiplier: 1 },
    ryq3:  { format: 'multiple', unit: 'x', deltaUnit: '', higherIsBetter: true, multiplier: 1 },
    ryq2:  { format: 'multiple', unit: 'x', deltaUnit: '', higherIsBetter: true, multiplier: 1 },
    ryq1:  { format: 'multiple', unit: 'x', deltaUnit: '', higherIsBetter: true, multiplier: 1 },

    // ── Working-capital efficiency ──
    ryq16:    { format: 'days', unit: 'ngày', deltaUnit: 'ngày', higherIsBetter: false, multiplier: 1 },
    ryq18:    { format: 'days', unit: 'ngày', deltaUnit: 'ngày', higherIsBetter: false, multiplier: 1 },
    ryq20:    { format: 'days', unit: 'ngày', deltaUnit: 'ngày', higherIsBetter: true, multiplier: 1 },
    cashCycle: { format: 'days', unit: 'ngày', deltaUnit: 'ngày', higherIsBetter: false, multiplier: 1 },

    // ── Growth ──
    ryq34: { format: 'growth_pct', unit: '%', deltaUnit: 'pp', higherIsBetter: true, multiplier: 100 },
    ryq39: { format: 'growth_pct', unit: '%', deltaUnit: 'pp', higherIsBetter: true, multiplier: 100 },

    // ── Revenue & currency_bn items ──
    rev:    { format: 'currency_bn', unit: 'tỷ', deltaUnit: '%', higherIsBetter: true, multiplier: 1 },

    // ── Balance sheet (currency_bn, neutral) ──
    bsa53: { format: 'currency_bn', unit: 'tỷ', deltaUnit: '%', higherIsBetter: null, multiplier: 1 },
    bsa1:  { format: 'currency_bn', unit: 'tỷ', deltaUnit: '%', higherIsBetter: null, multiplier: 1 },
    bsa23: { format: 'currency_bn', unit: 'tỷ', deltaUnit: '%', higherIsBetter: null, multiplier: 1 },
    bsa54: { format: 'currency_bn', unit: 'tỷ', deltaUnit: '%', higherIsBetter: null, multiplier: 1 },
    bsa78: { format: 'currency_bn', unit: 'tỷ', deltaUnit: '%', higherIsBetter: null, multiplier: 1 },
    bsa2:  { format: 'currency_bn', unit: 'tỷ', deltaUnit: '%', higherIsBetter: null, multiplier: 1 },
    bsa80: { format: 'currency_bn', unit: 'tỷ', deltaUnit: '%', higherIsBetter: null, multiplier: 1 },
    bsa67: { format: 'currency_bn', unit: 'tỷ', deltaUnit: '%', higherIsBetter: null, multiplier: 1 },

    // ── Chứng khoán investment assets (currency_bn, neutral) ──
    bsa8:  { format: 'currency_bn', unit: 'tỷ', deltaUnit: '%', higherIsBetter: null, multiplier: 1 },
    bsa5:  { format: 'currency_bn', unit: 'tỷ', deltaUnit: '%', higherIsBetter: null, multiplier: 1 },
    bsa10: { format: 'currency_bn', unit: 'tỷ', deltaUnit: '%', higherIsBetter: null, multiplier: 1 },
    bsa43: { format: 'currency_bn', unit: 'tỷ', deltaUnit: '%', higherIsBetter: null, multiplier: 1 },

    // ── Cashflow (currency_bn) ──
    cfa18: { format: 'currency_bn', unit: 'tỷ', deltaUnit: '%', higherIsBetter: true, multiplier: 1 },
    cfa26: { format: 'currency_bn', unit: 'tỷ', deltaUnit: '%', higherIsBetter: null, multiplier: 1 },
    cfa34: { format: 'currency_bn', unit: 'tỷ', deltaUnit: '%', higherIsBetter: null, multiplier: 1 },

    // ── Ngân hàng — profitability ──
    ryq44: { format: 'pct', unit: '%', deltaUnit: 'pp', higherIsBetter: true, multiplier: 100 },
    ryq45: { format: 'pct', unit: '%', deltaUnit: 'pp', higherIsBetter: true, multiplier: 100 },
    ryq46: { format: 'pct', unit: '%', deltaUnit: 'pp', higherIsBetter: false, multiplier: 100 },
    ryq47: { format: 'pct', unit: '%', deltaUnit: 'pp', higherIsBetter: true, multiplier: 100 },
    ryq48: { format: 'pct', unit: '%', deltaUnit: 'pp', higherIsBetter: false, multiplier: 100 },

    // ── Ngân hàng — asset quality ──
    ryq58: { format: 'pct', unit: '%', deltaUnit: 'pp', higherIsBetter: false, multiplier: 100 },
    ryq59: { format: 'pct', unit: '%', deltaUnit: 'pp', higherIsBetter: true, multiplier: 100 },
    ryq60: { format: 'pct', unit: '%', deltaUnit: 'pp', higherIsBetter: false, multiplier: 100 },
    ryq61: { format: 'pct', unit: '%', deltaUnit: 'pp', higherIsBetter: false, multiplier: 100 },
    ryq57: { format: 'pct', unit: '%', deltaUnit: 'pp', higherIsBetter: true, multiplier: 100 },

    // ── Ngân hàng — capital ──
    nob151: { format: 'pct', unit: '%', deltaUnit: 'pp', higherIsBetter: true, multiplier: 100 },
    ryq54:  { format: 'pct', unit: '%', deltaUnit: 'pp', higherIsBetter: true, multiplier: 100 },
    ryq55:  { format: 'pct', unit: '%', deltaUnit: 'pp', higherIsBetter: true, multiplier: 100 },

    // ── Ngân hàng — liquidity & CASA ──
    casa:   { format: 'pct', unit: '%', deltaUnit: 'pp', higherIsBetter: true, multiplier: 100 },
    nob66:  { format: 'currency_bn', unit: 'tỷ', deltaUnit: '%', higherIsBetter: true, multiplier: 1 },
    bsb113: { format: 'currency_bn', unit: 'tỷ', deltaUnit: '%', higherIsBetter: true, multiplier: 1 },

    // ── Ngân hàng — growth ──
    ryq67: { format: 'growth_pct', unit: '%', deltaUnit: 'pp', higherIsBetter: true, multiplier: 100 },
    rtq50: { format: 'growth_pct', unit: '%', deltaUnit: 'pp', higherIsBetter: true, multiplier: 100 },
    rtq51: { format: 'growth_pct', unit: '%', deltaUnit: 'pp', higherIsBetter: true, multiplier: 100 },

    // ── Ngân hàng — scale (currency_bn, neutral) ──
    nob65:  { format: 'currency_bn', unit: 'tỷ', deltaUnit: '%', higherIsBetter: null, multiplier: 1 },
    bsb104: { format: 'currency_bn', unit: 'tỷ', deltaUnit: '%', higherIsBetter: null, multiplier: 1 },
    nob44:  { format: 'currency_bn', unit: 'tỷ', deltaUnit: '%', higherIsBetter: null, multiplier: 1 },

};

// ============================================================
// SECTION CONFIG — mỗi type ngành 1 danh sách section
// ============================================================

export const STOCK_SECTIONS: Record<IndustryType, SectionConfig[]> = {
    SXKD: [
        { id: 'profitability', title: 'HIỆU QUẢ HOẠT ĐỘNG',   metrics: ['ryq12', 'ryq14', 'ryq25', 'ryq27', 'ryq29', 'ryq31', 'ryq91'] },
        { id: 'health',        title: 'SỨC KHỎE TÀI CHÍNH',   metrics: ['ryq71', 'ryq6', 'ryq77', 'ryq3', 'ryq2', 'ryq1'] },
        { id: 'efficiency',    title: 'HIỆU SUẤT SỬ DỤNG',    metrics: ['ryq16', 'ryq18', 'ryq20', 'cashCycle'] },
        { id: 'growth',        title: 'TĂNG TRƯỞNG',           metrics: ['rev', 'ryq34', 'ryq39'] },
        { id: 'scale',         title: 'QUY MÔ TÀI SẢN',       metrics: ['bsa53', 'bsa1', 'bsa23', 'bsa54', 'bsa78', 'bsa2'] },
        { id: 'cashflow',      title: 'DÒNG TIỀN',             metrics: ['cfa18', 'cfa26', 'cfa34'] },
    ],
    CHUNGKHOAN: [
        { id: 'profitability', title: 'HIỆU QUẢ HOẠT ĐỘNG',   metrics: ['ryq12', 'ryq14', 'ryq25', 'ryq29', 'ryq31'] },
        { id: 'risk_leverage', title: 'RỦI RO & ĐÒN BẨY',     metrics: ['ryq71', 'ryq6', 'ryq77', 'ryq1'] },
        { id: 'growth',        title: 'TĂNG TRƯỞNG',           metrics: ['rev', 'ryq34', 'ryq39'] },
        { id: 'investment_assets', title: 'CƠ CẤU TÀI SẢN ĐẦU TƯ', metrics: ['bsa8', 'bsa5', 'bsa10', 'bsa43'] },
        { id: 'scale',         title: 'QUY MÔ',                metrics: ['bsa53', 'bsa54', 'bsa78', 'bsa2'] },
        { id: 'cashflow',      title: 'DÒNG TIỀN',             metrics: ['cfa18', 'cfa26', 'cfa34'] },
    ],
    BAOHIEM: [
        { id: 'profitability', title: 'HIỆU QUẢ HOẠT ĐỘNG',   metrics: ['ryq12', 'ryq14', 'ryq25', 'ryq29', 'ryq71'] },
        { id: 'growth',        title: 'TĂNG TRƯỞNG',           metrics: ['rev', 'ryq34', 'ryq39'] },
        { id: 'scale',         title: 'QUY MÔ',                metrics: ['bsa53', 'bsa54', 'bsa78', 'bsa2', 'bsa67'] },
        { id: 'cashflow',      title: 'DÒNG TIỀN',             metrics: ['cfa18', 'cfa26', 'cfa34'] },
    ],
    NGANHANG: [
        { id: 'profitability', title: 'HIỆU QUẢ & SINH LỜI',  metrics: ['ryq12', 'ryq14', 'ryq44', 'ryq45', 'ryq46', 'ryq47', 'ryq48'] },
        { id: 'asset_quality', title: 'CHẤT LƯỢNG TÀI SẢN',   metrics: ['ryq58', 'ryq59', 'ryq60', 'ryq61', 'ryq57'] },
        { id: 'capital',       title: 'AN TOÀN VỐN',           metrics: ['nob151', 'ryq54', 'ryq55'] },
        { id: 'liquidity_casa', title: 'THANH KHOẢN & CASA',   metrics: ['casa', 'nob66', 'bsb113'] },
        { id: 'growth',        title: 'TĂNG TRƯỞNG',           metrics: ['rev', 'ryq67', 'rtq50', 'rtq51', 'ryq39'] },
        { id: 'scale',         title: 'QUY MÔ',                metrics: ['bsa53', 'bsa78', 'bsa80', 'nob65', 'bsb104', 'nob44'] },
        { id: 'cashflow',      title: 'DÒNG TIỀN',             metrics: ['cfa18', 'cfa26', 'cfa34'] },
    ],
};

export const FOCUS_METRIC_DEFAULT = 'ryq12'; // ROE

// ============================================================
// FORMAT UTILS
// ============================================================

function isInvalidNumber(v: unknown): boolean {
    return v == null || (typeof v === 'number' && (isNaN(v) || !isFinite(v)));
}

/** Format currency_bn: raw value is VND → convert to tỷ */
function formatCurrencyBn(raw: number): string {
    const bn = raw / 1_000_000_000;
    if (Math.abs(bn) >= 1000) return `${Math.round(bn).toLocaleString('en-US')} tỷ`;
    if (Math.abs(bn) >= 1) return `${bn.toFixed(1)} tỷ`;
    return `${bn.toFixed(2)} tỷ`;
}

export function formatMetricValue(key: string, rawValue: number | null | undefined): string {
    if (isInvalidNumber(rawValue)) return '—';
    const cfg = METRIC_FORMAT_CONFIG[key];
    if (!cfg) return String(rawValue);
    const v = (rawValue as number) * cfg.multiplier;
    switch (cfg.format) {
        case 'pct':
        case 'growth_pct':
            return `${v.toFixed(2)}%`;
        case 'multiple':
            return `${v.toFixed(2)}x`;
        case 'days':
            return `${v.toFixed(1)} ngày`;
        case 'currency_bn':
            return formatCurrencyBn(rawValue as number);
        default:
            return v.toFixed(2);
    }
}

export function formatMetricDelta(
    key: string,
    rawDelta: number | null | undefined,
    currentValue?: number | null,
    prevValue?: number | null,
): { text: string; color: 'success' | 'error' | 'neutral' } {
    if (isInvalidNumber(rawDelta)) return { text: '—', color: 'neutral' };
    const cfg = METRIC_FORMAT_CONFIG[key];
    if (!cfg) return { text: '—', color: 'neutral' };

    // Neutral for higher_is_better === null (balance sheet items)
    if (cfg.higherIsBetter === null) {
        // currency_bn delta as % change
        if (cfg.format === 'currency_bn' && currentValue != null && prevValue != null && prevValue !== 0) {
            const pctChange = ((currentValue - prevValue) / Math.abs(prevValue)) * 100;
            if (Math.abs(pctChange) < 0.01) return { text: '=', color: 'neutral' };
            const sign = pctChange > 0 ? '+' : '';
            return { text: `${sign}${pctChange.toFixed(1)}%`, color: 'neutral' };
        }
        return { text: '—', color: 'neutral' };
    }

    const d = (rawDelta as number) * cfg.multiplier;

    // For currency_bn with higherIsBetter != null: show % change
    if (cfg.format === 'currency_bn' && currentValue != null && prevValue != null && prevValue !== 0) {
        const pctChange = ((currentValue - prevValue) / Math.abs(prevValue)) * 100;
        if (Math.abs(pctChange) < 0.01) return { text: '=', color: 'neutral' };
        const sign = pctChange > 0 ? '+' : '';
        const text = `${sign}${pctChange.toFixed(1)}%`;
        const isPositiveGood = pctChange > 0 ? cfg.higherIsBetter : !cfg.higherIsBetter;
        return { text, color: isPositiveGood ? 'success' : 'error' };
    }

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

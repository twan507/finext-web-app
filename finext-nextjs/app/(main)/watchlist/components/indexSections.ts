// indexSections.ts — Hằng số & helper cho 2 section chỉ số trên trang watchlist

export interface IndexData {
    ticker: string;
    ticker_name?: string;
    close: number;
    diff: number;
    pct_change: number;
    vsi?: number;
    trading_value?: number;
    type?: string;
}

// 12 chỉ số thị trường (cố định, đúng thứ tự hiển thị)
export const MARKET_INDEX_CODES = [
    'VNINDEX', 'VN30', 'HNXINDEX', 'UPINDEX',   // 4 chỉ số chính
    'FNXINDEX', 'FNX100',                        // 2 chỉ số FNX
    'ONDINH', 'SUKIEN', 'VUOTTROI',              // 3 chỉ số dòng tiền
    'LARGECAP', 'MIDCAP', 'SMALLCAP',            // 3 chỉ số vốn hóa
] as const;

// 24 ngành (cố định)
export const INDUSTRY_CODES = [
    'BANLE', 'BAOHIEM', 'BDS', 'CAOSU', 'CHUNGKHOAN', 'CONGNGHE',
    'CONGNGHIEP', 'DAUKHI', 'DETMAY', 'DULICH', 'HOACHAT', 'KCN',
    'KHOANGSAN', 'KIMLOAI', 'NGANHANG', 'NHUA', 'NONGNGHIEP', 'THUCPHAM',
    'THUYSAN', 'TIENICH', 'VANTAI', 'VLXD', 'XAYDUNG', 'YTEGD',
] as const;

// Chỉ số Finext có trang chi tiết /groups (theo IndexTable.tsx)
const INDEXES_WITH_DETAIL = new Set<string>([
    'FNXINDEX', 'LARGECAP', 'MIDCAP', 'SMALLCAP', 'VUOTTROI', 'ONDINH', 'SUKIEN', 'FNX100',
]);

export type IndexKind = 'market' | 'industry';

/** Route khi bấm TÊN thẻ. undefined = không điều hướng (big-4 thị trường). */
export function indexDetailHref(code: string, kind: IndexKind): string | undefined {
    const lower = code.toLowerCase();
    if (kind === 'industry') return `/sectors/${lower}`;
    if (INDEXES_WITH_DETAIL.has(code)) return `/groups/${lower}`;
    return undefined;
}

/** Route khi bấm ICON chart (mọi mã). */
export function indexChartHref(code: string): string {
    return `/charts/${code.toLowerCase()}`;
}

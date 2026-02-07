// finext-nextjs/app/(main)/reports/types.ts
/**
 * Types và interfaces cho News Report module
 * - type: loại bản tin (daily, weekly, monthly) - filter chính
 * - category: danh mục (trong_nuoc, thong_cao, quoc_te) - filter phụ (chip level 2)
 */

// ============================================================================
// NEWS REPORT DATA TYPES
// ============================================================================

/** Loại bản tin */
export type ReportType = 'daily' | 'weekly' | 'monthly';

/** Link trong bản tin */
export interface ReportLink {
    url: string;
    title: string;
}

/** News Report từ API */
export interface NewsReport {
    report_slug: string;
    report_type: ReportType;
    category: string;
    category_name: string;
    title: string;
    sapo?: string;
    created_at: string;
    links: (string | ReportLink)[];
    report_html?: string;
    report_markdown?: string;
    tickers: string[];
}

/** Pagination info từ API */
export interface PaginationInfo {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
}

/** Response từ news_report API */
export interface ReportApiResponse {
    items: NewsReport[];
    pagination: PaginationInfo;
}

/** Category info từ API (từ news_report_categories) */
export interface ReportCategoryInfo {
    category: string;
    category_name: string;
}

// ============================================================================
// TYPE CONFIG FOR NAVIGATION
// ============================================================================

export interface ReportTypeInfo {
    type: ReportType;
    type_name: string;
}

/** Danh sách các loại bản tin */
export const REPORT_TYPES_INFO: ReportTypeInfo[] = [
    { type: 'daily', type_name: 'Báo cáo hàng ngày' },
    { type: 'weekly', type_name: 'Báo cáo hàng tuần' },
    { type: 'monthly', type_name: 'Báo cáo hàng tháng' },
];

/** Lấy type info theo type */
export const getReportTypeInfo = (type: ReportType): ReportTypeInfo | undefined => {
    return REPORT_TYPES_INFO.find((t) => t.type === type);
};

// ============================================================================
// CONSTANTS
// ============================================================================

export const REPORT_PAGE_SIZE = 12;
export const REPORT_SORT_FIELD = 'created_at';
export const REPORT_SORT_ORDER = 'desc';

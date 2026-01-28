// finext-nextjs/app/(main)/reports/types.ts
/**
 * Types và interfaces cho News Report module
 * Cấu trúc tương tự News module, sử dụng category thay vì type
 */

// ============================================================================
// NEWS REPORT DATA TYPES
// ============================================================================

/** Link trong bản tin */
export interface ReportLink {
    url: string;
    title: string;
}

/** News Report từ API */
export interface NewsReport {
    report_id: string;
    title: string;
    category: string;
    category_name: string;
    created_at: string;
    links: (string | ReportLink)[];
    report_html: string;
    report_markdown: string;
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

/** Category info từ API (từ news_report_types) */
export interface ReportCategoryInfo {
    category: string;
    category_name: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const REPORT_PAGE_SIZE = 12;
export const REPORT_SORT_FIELD = 'created_at';
export const REPORT_SORT_ORDER = 'desc';

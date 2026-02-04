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
    report_id: string;
    report_type: ReportType;
    category: string;
    category_name: string;
    title: string;
    sapo?: string;
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

// ============================================================================
// SLUG UTILITIES
// ============================================================================

/** Chuyển title thành slug URL-friendly */
export const generateSlug = (title: string): string => {
    // Bảng chuyển đổi dấu tiếng Việt
    const vietnameseMap: Record<string, string> = {
        'à': 'a', 'á': 'a', 'ả': 'a', 'ã': 'a', 'ạ': 'a',
        'ă': 'a', 'ằ': 'a', 'ắ': 'a', 'ẳ': 'a', 'ẵ': 'a', 'ặ': 'a',
        'â': 'a', 'ầ': 'a', 'ấ': 'a', 'ẩ': 'a', 'ẫ': 'a', 'ậ': 'a',
        'đ': 'd',
        'è': 'e', 'é': 'e', 'ẻ': 'e', 'ẽ': 'e', 'ẹ': 'e',
        'ê': 'e', 'ề': 'e', 'ế': 'e', 'ể': 'e', 'ễ': 'e', 'ệ': 'e',
        'ì': 'i', 'í': 'i', 'ỉ': 'i', 'ĩ': 'i', 'ị': 'i',
        'ò': 'o', 'ó': 'o', 'ỏ': 'o', 'õ': 'o', 'ọ': 'o',
        'ô': 'o', 'ồ': 'o', 'ố': 'o', 'ổ': 'o', 'ỗ': 'o', 'ộ': 'o',
        'ơ': 'o', 'ờ': 'o', 'ớ': 'o', 'ở': 'o', 'ỡ': 'o', 'ợ': 'o',
        'ù': 'u', 'ú': 'u', 'ủ': 'u', 'ũ': 'u', 'ụ': 'u',
        'ư': 'u', 'ừ': 'u', 'ứ': 'u', 'ử': 'u', 'ữ': 'u', 'ự': 'u',
        'ỳ': 'y', 'ý': 'y', 'ỷ': 'y', 'ỹ': 'y', 'ỵ': 'y',
    };

    return title
        .toLowerCase()
        .split('')
        .map(char => vietnameseMap[char] || char)
        .join('')
        .replace(/[^a-z0-9\s-]/g, '') // Loại bỏ ký tự đặc biệt
        .replace(/\s+/g, '-') // Thay space bằng -
        .replace(/-+/g, '-') // Loại bỏ nhiều - liên tiếp
        .replace(/^-|-$/g, ''); // Loại bỏ - ở đầu và cuối
};

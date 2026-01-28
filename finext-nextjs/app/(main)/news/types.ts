// finext-nextjs/app/(main)/news/types.ts
/**
 * Types và interfaces cho News module
 */

// ============================================================================
// NEWS DATA TYPES
// ============================================================================

/** Source của tin tức (internal) */
export type NewsSource = 'chinhphu.vn' | 'baochinhphu.vn' | 'findata.vn';

/** Category slug */
export type NewsCategory = string;

/** News article từ API */
export interface NewsArticle {
    article_id: string;
    source: NewsSource;
    category: string;
    category_name: string;
    title: string;
    sapo: string;
    html_content: string;
    plain_content: string;
    link: string;
    tickers: string[];
    created_at: string;
    is_processed: boolean;
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

/** Response từ news_daily API */
export interface NewsApiResponse {
    items: NewsArticle[];
    pagination: PaginationInfo;
}

// ============================================================================
// SOURCE CONFIG
// ============================================================================

export interface SourceConfig {
    slug: string;
    label: string;
    source: NewsSource;
    description: string;
}

/** Cấu hình các nguồn tin - source là internal, label là tên hiển thị */
export const NEWS_SOURCES: SourceConfig[] = [
    {
        slug: 'thong-cao',
        label: 'Thông cáo',
        source: 'chinhphu.vn',
        description: 'Thông cáo từ Cổng thông tin điện tử Chính phủ',
    },
    {
        slug: 'vi-mo',
        label: 'Tin vĩ mô',
        source: 'baochinhphu.vn',
        description: 'Tin tức vĩ mô, chính sách kinh tế từ Báo Chính phủ',
    },
    {
        slug: 'doanh-nghiep',
        label: 'Tin doanh nghiệp',
        source: 'findata.vn',
        description: 'Tin tức doanh nghiệp, phân tích thị trường',
    },
];

/** Lấy config theo slug */
export const getSourceConfigBySlug = (slug: string): SourceConfig | undefined => {
    return NEWS_SOURCES.find((s) => s.slug === slug);
};

/** Lấy config theo source name */
export const getSourceConfigBySource = (source: NewsSource): SourceConfig | undefined => {
    return NEWS_SOURCES.find((s) => s.source === source);
};

// ============================================================================
// CONSTANTS
// ============================================================================

export const NEWS_PAGE_SIZE = 12;
export const NEWS_SORT_FIELD = 'created_at';
export const NEWS_SORT_ORDER = 'desc';

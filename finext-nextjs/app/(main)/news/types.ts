// finext-nextjs/app/(main)/news/types.ts
/**
 * Types và interfaces cho News module
 */

// ============================================================================
// NEWS DATA TYPES
// ============================================================================

/** Source của tin tức (internal) */
export type NewsSource = 'thong_cao' | 'trong_nuoc' | 'doanh_nghiep' | 'quoc_te';

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
        source: 'thong_cao',
        description: 'Thông cáo từ Cổng thông tin điện tử Chính phủ',
    },
    {
        slug: 'trong-nuoc',
        label: 'Tin trong nước',
        source: 'trong_nuoc',
        description: 'Tin tức trong nước, chính sách kinh tế',
    },
    {
        slug: 'doanh-nghiep',
        label: 'Tin doanh nghiệp',
        source: 'doanh_nghiep',
        description: 'Tin tức doanh nghiệp, phân tích thị trường',
    },
    {
        slug: 'quoc-te',
        label: 'Tin quốc tế',
        source: 'quoc_te',
        description: 'Tin tức quốc tế, thị trường toàn cầu',
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
// SOURCE INFO FOR NAVIGATION
// ============================================================================

/** Source info for navigation tabs */
export interface SourceInfo {
    source: NewsSource;
    source_name: string;
}

/** Danh sách 4 nguồn tin chính */
export const NEWS_SOURCES_INFO: SourceInfo[] = [
    { source: 'quoc_te', source_name: 'Tài chính quốc tế' },
    { source: 'trong_nuoc', source_name: 'Vĩ mô trong nước' },
    { source: 'doanh_nghiep', source_name: 'Doanh nghiệp niêm yết' },
    { source: 'thong_cao', source_name: 'Thông cáo chính phủ' },
];

/** Lấy source info theo source */
export const getSourceInfo = (source: NewsSource): SourceInfo | undefined => {
    return NEWS_SOURCES_INFO.find((s) => s.source === source);
};

// ============================================================================
// CONSTANTS
// ============================================================================

export const NEWS_PAGE_SIZE = 12;
export const NEWS_SORT_FIELD = 'created_at';
export const NEWS_SORT_ORDER = 'desc';


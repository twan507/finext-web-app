// finext-nextjs/app/(main)/news/types.ts
/**
 * Types và interfaces cho News module
 */

// ============================================================================
// NEWS DATA TYPES
// ============================================================================

/** Type của tin tức (internal) */
export type NewsType = 'thong_cao' | 'trong_nuoc' | 'doanh_nghiep' | 'quoc_te';

/** Category slug */
export type NewsCategory = string;

/** News article từ API */
export interface NewsArticle {
    article_id: string;
    news_type: NewsType;
    source?: string; // Nguồn tin đơn giản (baochinhphu.vn, tinnhanhchungkhoan.vn, ...)
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
// TYPE CONFIG
// ============================================================================

export interface TypeConfig {
    slug: string;
    label: string;
    type: NewsType;
    description: string;
}

/** Cấu hình các loại tin - type là internal, label là tên hiển thị */
export const NEWS_TYPES: TypeConfig[] = [
    {
        slug: 'thong-cao',
        label: 'Thông cáo chính phủ',
        type: 'thong_cao',
        description: 'Thông cáo từ Cổng thông tin điện tử Chính phủ',
    },
    {
        slug: 'trong-nuoc',
        label: 'Vĩ mô trong nước',
        type: 'trong_nuoc',
        description: 'Tin tức trong nước, chính sách kinh tế',
    },
    {
        slug: 'doanh-nghiep',
        label: 'Doanh nghiệp niêm yết',
        type: 'doanh_nghiep',
        description: 'Tin tức doanh nghiệp, phân tích thị trường',
    },
    {
        slug: 'quoc-te',
        label: 'Tài chính quốc tế',
        type: 'quoc_te',
        description: 'Tin tức quốc tế, thị trường toàn cầu',
    },
];

/** Lấy config theo slug */
export const getTypeConfigBySlug = (slug: string): TypeConfig | undefined => {
    return NEWS_TYPES.find((t) => t.slug === slug);
};

/** Lấy config theo type name */
export const getTypeConfigByType = (type: NewsType): TypeConfig | undefined => {
    return NEWS_TYPES.find((t) => t.type === type);
};

// ============================================================================
// TYPE INFO FOR NAVIGATION
// ============================================================================

/** Type info for navigation tabs */
export interface TypeInfo {
    type: NewsType;
    type_name: string;
}

/** Danh sách 4 loại tin chính */
export const NEWS_TYPES_INFO: TypeInfo[] = [
    { type: 'quoc_te', type_name: 'Tài chính quốc tế' },
    { type: 'trong_nuoc', type_name: 'Vĩ mô trong nước' },
    { type: 'doanh_nghiep', type_name: 'Doanh nghiệp niêm yết' },
    { type: 'thong_cao', type_name: 'Thông cáo chính phủ' },
];

/** Lấy type info theo type */
export const getTypeInfo = (type: NewsType): TypeInfo | undefined => {
    return NEWS_TYPES_INFO.find((t) => t.type === type);
};

// ============================================================================
// CONSTANTS
// ============================================================================

export const NEWS_PAGE_SIZE = 12;
export const NEWS_SORT_FIELD = 'created_at';
export const NEWS_SORT_ORDER = 'desc';

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


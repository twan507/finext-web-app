import { MetadataRoute } from 'next';
import { fetchNewsListForSitemap } from './(main)/news/serverFetch';
import { fetchReportListForSitemap } from './(main)/reports/serverFetch';
import { NEWS_TYPES_INFO } from './(main)/news/types';
import { REPORT_TYPES_INFO } from './(main)/reports/types';

// Danh sách id cố định của trang chi tiết ngành / nhóm (dạng chữ thường, khớp internal links).
// Mirror của SECTOR_LIST trong sectors/[sectorId]/page.tsx và INDEX_LIST trong groups/[groupId]/page.tsx.
const SECTOR_IDS = [
    'banle', 'baohiem', 'bds', 'caosu', 'chungkhoan', 'congnghe', 'congnghiep',
    'daukhi', 'detmay', 'dulich', 'hoachat', 'kcn', 'khoangsan', 'kimloai',
    'nganhang', 'nhua', 'nongnghiep', 'thucpham', 'thuysan', 'tienich',
    'vantai', 'vlxd', 'xaydung', 'ytegd',
];
const GROUP_IDS = [
    'fnxindex', 'fnx100', 'vuottroi', 'ondinh', 'sukien', 'largecap', 'midcap', 'smallcap',
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://finext.vn';
    const currentDate = new Date();

    // Static pages - các trang public chính
    const staticPages: MetadataRoute.Sitemap = [
        // ── Trang chủ ──
        {
            url: baseUrl,
            lastModified: currentDate,
            changeFrequency: 'daily',
            priority: 1,
        },
        // ── Sản phẩm chính (priority cao → Google ưu tiên sitelinks) ──
        {
            url: `${baseUrl}/markets`,
            lastModified: currentDate,
            changeFrequency: 'hourly',
            priority: 0.9,
        },
        {
            url: `${baseUrl}/stocks`,
            lastModified: currentDate,
            changeFrequency: 'hourly',
            priority: 0.9,
        },
        {
            url: `${baseUrl}/news`,
            lastModified: currentDate,
            changeFrequency: 'hourly',
            priority: 0.9,
        },
        {
            url: `${baseUrl}/sectors`,
            lastModified: currentDate,
            changeFrequency: 'hourly',
            priority: 0.8,
        },
        {
            url: `${baseUrl}/groups`,
            lastModified: currentDate,
            changeFrequency: 'hourly',
            priority: 0.8,
        },
        {
            url: `${baseUrl}/international`,
            lastModified: currentDate,
            changeFrequency: 'hourly',
            priority: 0.85,
        },
        {
            url: `${baseUrl}/macro`,
            lastModified: currentDate,
            changeFrequency: 'daily',
            priority: 0.85,
        },
        {
            url: `${baseUrl}/commodities`,
            lastModified: currentDate,
            changeFrequency: 'hourly',
            priority: 0.85,
        },
        {
            url: `${baseUrl}/reports`,
            lastModified: currentDate,
            changeFrequency: 'daily',
            priority: 0.8,
        },
        {
            url: `${baseUrl}/charts`,
            lastModified: currentDate,
            changeFrequency: 'weekly',
            priority: 0.7,
        },
        {
            url: `${baseUrl}/phase`,
            lastModified: currentDate,
            changeFrequency: 'daily',
            priority: 0.8,
        },
        {
            url: `${baseUrl}/plans`,
            lastModified: currentDate,
            changeFrequency: 'monthly',
            priority: 0.6,
        },
        // ── Mở tài khoản: removed by compliance pivot 2026-05-07 (route blocked) ──
        // ── Hướng dẫn sử dụng ──
        {
            url: `${baseUrl}/guides/overview`,
            lastModified: currentDate,
            changeFrequency: 'weekly',
            priority: 0.6,
        },
        {
            url: `${baseUrl}/guides/stock-screener`,
            lastModified: currentDate,
            changeFrequency: 'weekly',
            priority: 0.6,
        },
        {
            url: `${baseUrl}/guides/charts-watchlist`,
            lastModified: currentDate,
            changeFrequency: 'weekly',
            priority: 0.6,
        },
        {
            url: `${baseUrl}/guides/tools-data`,
            lastModified: currentDate,
            changeFrequency: 'weekly',
            priority: 0.6,
        },
        // ── Chính sách ──
        {
            url: `${baseUrl}/policies/privacy`,
            lastModified: currentDate,
            changeFrequency: 'monthly',
            priority: 0.4,
        },
        {
            url: `${baseUrl}/policies/content`,
            lastModified: currentDate,
            changeFrequency: 'monthly',
            priority: 0.4,
        },
        {
            url: `${baseUrl}/policies/disclaimer`,
            lastModified: currentDate,
            changeFrequency: 'monthly',
            priority: 0.4,
        },
        // ── Hỗ trợ ──
        {
            url: `${baseUrl}/support/email`,
            lastModified: currentDate,
            changeFrequency: 'monthly',
            priority: 0.5,
        },
        {
            url: `${baseUrl}/support/consultation`,
            lastModified: currentDate,
            changeFrequency: 'monthly',
            priority: 0.7,
        },
        {
            url: `${baseUrl}/support/live-chat`,
            lastModified: currentDate,
            changeFrequency: 'monthly',
            priority: 0.5,
        },
        // ── Auth ──
        {
            url: `${baseUrl}/login`,
            lastModified: currentDate,
            changeFrequency: 'monthly',
            priority: 0.3,
        },
        {
            url: `${baseUrl}/register`,
            lastModified: currentDate,
            changeFrequency: 'monthly',
            priority: 0.3,
        },
    ];

    // ── Trang danh mục / ngành / nhóm cố định (số lượng hữu hạn, biết trước) ──
    const categoryPages: MetadataRoute.Sitemap = [
        ...SECTOR_IDS.map((id) => ({
            url: `${baseUrl}/sectors/${id}`,
            lastModified: currentDate,
            changeFrequency: 'daily' as const,
            priority: 0.7,
        })),
        ...GROUP_IDS.map((id) => ({
            url: `${baseUrl}/groups/${id}`,
            lastModified: currentDate,
            changeFrequency: 'daily' as const,
            priority: 0.7,
        })),
        ...NEWS_TYPES_INFO.map((t) => ({
            url: `${baseUrl}/news/type/${t.type}`,
            lastModified: currentDate,
            changeFrequency: 'hourly' as const,
            priority: 0.6,
        })),
        ...REPORT_TYPES_INFO.map((t) => ({
            url: `${baseUrl}/reports/type/${t.type}`,
            lastModified: currentDate,
            changeFrequency: 'daily' as const,
            priority: 0.6,
        })),
    ];

    // Dynamic pages - bài viết tin tức (cached 1 giờ bởi fetchNewsListForSitemap)
    let articlePages: MetadataRoute.Sitemap = [];
    try {
        const articles = await fetchNewsListForSitemap();
        articlePages = articles.map((article) => ({
            url: `${baseUrl}/news/${article.slug}`,
            lastModified: new Date(article.lastModified),
            changeFrequency: 'daily' as const,
            priority: 0.6,
        }));
    } catch (error) {
        // Nếu API lỗi, chỉ trả về static pages — không block sitemap generation
        console.error('[sitemap] Failed to fetch news articles:', error);
    }

    // Dynamic pages - báo cáo chi tiết (cached 1 giờ bởi fetchReportListForSitemap)
    let reportPages: MetadataRoute.Sitemap = [];
    try {
        const reports = await fetchReportListForSitemap();
        reportPages = reports.map((report) => ({
            url: `${baseUrl}/reports/${report.slug}`,
            lastModified: new Date(report.lastModified),
            changeFrequency: 'daily' as const,
            priority: 0.6,
        }));
    } catch (error) {
        // Nếu API lỗi, chỉ trả về phần còn lại — không block sitemap generation
        console.error('[sitemap] Failed to fetch reports:', error);
    }

    return [...staticPages, ...categoryPages, ...articlePages, ...reportPages];
}

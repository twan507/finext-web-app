import { MetadataRoute } from 'next';
import { fetchNewsListForSitemap } from './(main)/news/serverFetch';

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
        // ── Mở tài khoản ──
        {
            url: `${baseUrl}/open-account`,
            lastModified: currentDate,
            changeFrequency: 'monthly',
            priority: 0.8,
        },
        // ── Finext Learning ──
        {
            url: `${baseUrl}/learning/technical-analysis`,
            lastModified: currentDate,
            changeFrequency: 'weekly',
            priority: 0.6,
        },
        {
            url: `${baseUrl}/learning/fundamental-analysis`,
            lastModified: currentDate,
            changeFrequency: 'weekly',
            priority: 0.6,
        },
        {
            url: `${baseUrl}/learning/cash-flow-analysis`,
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

    return [...staticPages, ...articlePages];
}

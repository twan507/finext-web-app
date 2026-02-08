import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://finext.vn';
    const currentDate = new Date();

    // Static pages - các trang public
    const staticPages: MetadataRoute.Sitemap = [
        {
            url: baseUrl,
            lastModified: currentDate,
            changeFrequency: 'daily',
            priority: 1,
        },
        {
            url: `${baseUrl}/home`,
            lastModified: currentDate,
            changeFrequency: 'daily',
            priority: 0.9,
        },
        {
            url: `${baseUrl}/markets`,
            lastModified: currentDate,
            changeFrequency: 'hourly',
            priority: 0.9,
        },
        {
            url: `${baseUrl}/groups`,
            lastModified: currentDate,
            changeFrequency: 'hourly',
            priority: 0.8,
        },
        {
            url: `${baseUrl}/news`,
            lastModified: currentDate,
            changeFrequency: 'hourly',
            priority: 0.8,
        },
        {
            url: `${baseUrl}/reports`,
            lastModified: currentDate,
            changeFrequency: 'daily',
            priority: 0.7,
        },
        {
            url: `${baseUrl}/stocks`,
            lastModified: currentDate,
            changeFrequency: 'hourly',
            priority: 0.8,
        },
        {
            url: `${baseUrl}/charts`,
            lastModified: currentDate,
            changeFrequency: 'weekly',
            priority: 0.7,
        },
        {
            url: `${baseUrl}/login`,
            lastModified: currentDate,
            changeFrequency: 'monthly',
            priority: 0.5,
        },
        {
            url: `${baseUrl}/register`,
            lastModified: currentDate,
            changeFrequency: 'monthly',
            priority: 0.5,
        },
    ];

    return staticPages;
}

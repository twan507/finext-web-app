import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://finext.vn';

    return {
        rules: [
            {
                userAgent: '*',
                allow: '/',
                disallow: [
                    '/api/',
                    // Chặn cả URL gốc lẫn URL con: Disallow '/admin/' KHÔNG chặn chính '/admin'
                    '/admin',
                    '/admin/',
                    '/profile',
                    '/profile/',
                    '/auth/',
                    '/_next/',
                    '/watchlist/',
                    // Compliance pivot 2026-05-07: blocked routes (see lib/blocked-routes.ts)
                    '/open-account',
                ],
            },
            {
                userAgent: 'Googlebot',
                allow: [
                    '/',
                    '/markets',
                    '/stocks',
                    '/news',
                    '/international',
                    '/macro',
                    '/commodities',
                    '/sectors',
                    '/groups',
                    '/reports',
                    '/charts',
                    '/phase',
                    '/plans',
                    '/guides/',
                    '/policies/',
                    '/support/',
                ],
                disallow: [
                    '/api/',
                    // Chặn cả URL gốc lẫn URL con
                    '/admin',
                    '/admin/',
                    '/profile',
                    '/profile/',
                    '/auth/',
                    '/watchlist/',
                    '/_next/',
                    // Compliance pivot 2026-05-07: blocked routes
                    '/open-account',
                ],
            },
        ],
        sitemap: `${baseUrl}/sitemap.xml`,
        host: baseUrl,
    };
}

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
                    '/admin/',
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
                    '/guides/',
                    '/policies/',
                    '/support/',
                ],
                disallow: [
                    '/api/',
                    '/admin/',
                    '/auth/',
                    '/profile/',
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

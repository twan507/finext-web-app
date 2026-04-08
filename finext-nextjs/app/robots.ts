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
                    '/learning/',
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
                ],
            },
        ],
        sitemap: `${baseUrl}/sitemap.xml`,
        host: baseUrl,
    };
}

// finext-nextjs/app/manifest.ts
import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'Finext - Phân tích chứng khoán',
        short_name: 'Finext',
        description:
            'Nền tảng phân tích chứng khoán thông minh cho nhà đầu tư Việt Nam',
        start_url: '/',
        display: 'standalone',
        background_color: '#fafbfc',
        theme_color: '#8b5cf6',
        orientation: 'any',
        categories: ['finance', 'business'],
        icons: [
            {
                src: '/icons/icon-192x192.png',
                sizes: '192x192',
                type: 'image/png',
                purpose: 'any'
            },
            {
                src: '/icons/icon-512x512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'any'
            },
            {
                src: '/icons/icon-192x192.png',
                sizes: '192x192',
                type: 'image/png',
                purpose: 'maskable'
            },
            {
                src: '/icons/icon-512x512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'maskable'
            }
        ]
    };
}

// finext-nextjs/app/manifest.ts
import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'Finext',
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
            // Desktop/Windows: pre-rounded icon (displayed as-is)
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
            // Android/iOS: square icon (OS auto-crops to shape)
            {
                src: '/icons/icon-maskable-192x192.png',
                sizes: '192x192',
                type: 'image/png',
                purpose: 'maskable'
            },
            {
                src: '/icons/icon-maskable-512x512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'maskable'
            },
            // Apple touch icon
            {
                src: '/icons/apple-touch-icon.png',
                sizes: '180x180',
                type: 'image/png',
                purpose: 'any'
            }
        ]
    };
}

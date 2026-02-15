// Smart API URL:
// - Production (Nginx proxy): page = finext.vn, API = finext.vn → same origin → dùng relative URL
// - Dev mode: page = localhost:3000, API = finext.vn → khác origin → giữ full URL
// - SSR: luôn dùng full URL vì server cần biết hostname đích
const configuredUrl = process.env.NEXT_PUBLIC_API_URL || '';

export const API_BASE_URL = typeof window !== 'undefined'
    ? (() => {
        if (!configuredUrl) return '';
        try {
            if (new URL(configuredUrl).origin === window.location.origin) return '';
        } catch { /* invalid URL → giữ nguyên */ }
        return configuredUrl;
    })()
    : (configuredUrl || 'https://localhost');
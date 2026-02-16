// Tự động detect dev/prod, không cần toggle thủ công:
// - Dev (next dev):  NODE_ENV='development' → dùng absolute URL (VD: https://finext.vn)
// - Prod client:     NODE_ENV='production' + browser → dùng relative URL (fix Safari)
// - Prod SSR:        NODE_ENV='production' + server → dùng absolute URL
const isDev = process.env.NODE_ENV === 'development';
const isClient = typeof window !== 'undefined';

export const API_BASE_URL = (isDev || !isClient)
    ? (process.env.NEXT_PUBLIC_API_URL || 'https://localhost')
    : '';
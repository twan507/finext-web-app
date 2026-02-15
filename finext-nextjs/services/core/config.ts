// Client-side: Dùng relative URL (VD: /api/v1/...) để Safari iOS không
// nhầm lẫn same-origin requests thành cross-origin.
// Server-side (SSR): Dùng absolute URL vì server cần biết hostname đích.
export const API_BASE_URL = typeof window !== 'undefined'
    ? '' // Client-side: relative URL cho Safari compatibility
    : (process.env.NEXT_PUBLIC_API_URL || 'https://localhost');
// Client-side: relative URL (fix Safari)
// Server-side (SSR): absolute URL
export const API_BASE_URL = typeof window !== 'undefined'
    ? ''
    : (process.env.NEXT_PUBLIC_API_URL || 'https://localhost');

// Dev mode
// export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://localhost";
// Có NEXT_PUBLIC_API_URL → absolute URL (dev mode)
// Không có / rỗng → relative URL (prod, fix Safari)
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";
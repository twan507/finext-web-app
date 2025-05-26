// finext-nextjs/app/services/authService.ts
import { LoginResponse, StandardApiResponse } from "services/core/types";
import { clearSession, updateAccessToken } from "./core/session"; // Dùng updateAccessToken
import { API_BASE_URL } from "./core/config";

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

const refreshTokenApi = async (): Promise<string | null> => {
    // Không cần lấy refresh token từ session nữa

    try {
        const res = await fetch(`${API_BASE_URL}/api/v1/auth/refresh-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // Không gửi body, dựa vào HttpOnly cookie
            credentials: 'include', // QUAN TRỌNG: Gửi cookie kèm request
        });

        if (res.ok) {
            const response = (await res.json()) as StandardApiResponse<LoginResponse>;
            if (response.data?.access_token) {
                // Cập nhật chỉ access token trong localStorage
                updateAccessToken(response.data.access_token);
                console.log("Token refreshed successfully via cookie.");
                return response.data.access_token;
            } else {
                // Nếu API trả về OK nhưng không có token (ví dụ: refresh token bị xóa)
                throw new Error(response.message || "Refresh token response invalid.");
            }
        }
        // Nếu không OK (ví dụ 401 do cookie hết hạn/không hợp lệ)
        throw new Error(`Failed to refresh token, status: ${res.status}`);

    } catch (error) {
        console.error("Refresh token API call failed:", error);
        clearSession(); // Xóa session (localStorage)
        // Backend đã xóa cookie (nếu 401) hoặc cookie đã hết hạn
        if (typeof window !== 'undefined') {
            window.location.href = '/login'; // Chuyển hướng khi refresh thất bại
        }
        return null;
    }
};

export const handleRefreshToken = async (): Promise<string | null> => {
    if (!isRefreshing) {
        isRefreshing = true;
        refreshPromise = refreshTokenApi().finally(() => {
            isRefreshing = false;
            // Không reset refreshPromise ở đây
        });
    }
    return refreshPromise;
};

// Hàm gọi API Logout để xóa cookie
export const logoutApi = async (): Promise<void> => {
    try {
        await fetch(`${API_BASE_URL}/api/v1/auth/logout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include', // QUAN TRỌNG: Gửi cookie kèm request
        });
        console.log("Logout API called to clear cookie.");
    } catch (error) {
        console.error("Logout API call failed:", error);
        // Vẫn tiếp tục xóa session client-side
    } finally {
        clearSession();
        if (typeof window !== 'undefined') {
            window.location.href = '/login';
        }
    }
}
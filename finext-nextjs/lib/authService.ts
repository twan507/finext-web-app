// finext-nextjs/lib/authService.ts
import { StandardApiResponse } from './sendRequest';
import { getSession, saveSession, clearSession, SessionData } from './session';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL;

interface RefreshTokenResponse {
    token_type: string;
    access_token: string;
    refresh_token: string;
}

// Định nghĩa LoginResponse (nếu chưa có) để dùng cho type casting
interface LoginResponse {
    access_token: string;
    refresh_token: string;
    token_type: string;
}

let isRefreshing = false; // Cờ để tránh nhiều lần refresh cùng lúc
let refreshPromise: Promise<string | null> | null = null; // Promise để các request khác chờ

const refreshTokenApi = async (): Promise<string | null> => {
    const session = getSession();
    if (!session?.refreshToken) {
        console.log("No refresh token available, clearing session.");
        clearSession();
        window.location.href = '/login'; // Chuyển hướng nếu không có refresh token
        return null;
    }

    try {
        const res = await fetch(`${BASE_URL}/auth/refresh-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: session.refreshToken }),
        });

        if (res.ok) {
            const response = (await res.json()) as StandardApiResponse<LoginResponse>; // Dùng LoginResponse
            if (response.data) {
                const newSessionData: SessionData = {
                    ...session,
                    accessToken: response.data.access_token,
                    refreshToken: response.data.refresh_token,
                };
                saveSession(newSessionData);
                console.log("Token refreshed successfully.");
                return newSessionData.accessToken;
            }
        }
        throw new Error(`Failed to refresh token, status: ${res.status}`);

    } catch (error) {
        console.error("Refresh token API call failed:", error);
        clearSession();
        window.location.href = '/login'; // Chuyển hướng khi refresh thất bại
        return null;
    }
};

export const handleRefreshToken = async (): Promise<string | null> => {
    if (!isRefreshing) {
        isRefreshing = true;
        refreshPromise = refreshTokenApi().finally(() => {
            isRefreshing = false;
            // Không reset refreshPromise ở đây để các request đến sau khi fail vẫn biết
        });
    }
    return refreshPromise;
};
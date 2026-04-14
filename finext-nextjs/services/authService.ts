// finext-nextjs/app/services/authService.ts
import { clearSession } from "./core/session";
import { API_BASE_URL } from "./core/config";

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
        // Navigation sẽ được xử lý bởi AuthProvider.logout()
    }
}
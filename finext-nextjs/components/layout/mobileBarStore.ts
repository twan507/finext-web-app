'use client';

import { usePathname } from 'next/navigation';
import { useSyncExternalStore } from 'react';

// Trạng thái ẩn/hiện của thanh điều hướng đáy (mobile), dùng chung cho MobileBottomBar
// và bong bóng Finext AI để hai thứ trồi/thụt CÙNG NHỊP.
//
// Vì sao là store dùng chung chứ không phải mỗi component tự nghe scroll: mỗi bên sẽ có
// mốc `lastScrollY` riêng khởi tạo bằng 0, nên component nào mount lúc trang đã cuộn sẵn
// sẽ tính sai ngay nhịp đầu và lệch với bên kia. Một listener → một sự thật.

export const MOBILE_BAR_HEIGHT = 56;
const SCROLL_THRESHOLD = 10;

let visible = true;
let lastScrollY = 0;
let ticking = false;
const listeners = new Set<() => void>();

function onScroll(): void {
    if (ticking) return;
    ticking = true;

    requestAnimationFrame(() => {
        const y = window.scrollY;
        const delta = y - lastScrollY;

        if (Math.abs(delta) > SCROLL_THRESHOLD) {
            // Cuộn lên hoặc đang ở gần đỉnh → hiện; cuộn xuống → ẩn.
            const next = delta < 0 || y < 10;
            lastScrollY = y;
            if (next !== visible) {
                visible = next;
                listeners.forEach((notify) => notify());
            }
        }

        ticking = false;
    });
}

function subscribe(notify: () => void): () => void {
    if (listeners.size === 0 && typeof window !== 'undefined') {
        // Đồng bộ mốc theo vị trí cuộn THẬT lúc gắn listener đầu tiên, không mặc định 0.
        lastScrollY = window.scrollY;
        window.addEventListener('scroll', onScroll, { passive: true });
    }
    listeners.add(notify);

    return () => {
        listeners.delete(notify);
        if (listeners.size === 0 && typeof window !== 'undefined') {
            window.removeEventListener('scroll', onScroll);
        }
    };
}

/** Thanh điều hướng đáy đang hiện hay không. Server render trả true (khớp lần paint đầu). */
export function useMobileBarVisible(): boolean {
    return useSyncExternalStore(subscribe, () => visible, () => true);
}

/**
 * Route này có render thanh điều hướng đáy không.
 * Trang /chat ẩn hẳn thanh (tránh trồi/thụt gây khó chịu khi đang chat).
 */
export function isMobileBarRoute(pathname: string | null | undefined): boolean {
    return !pathname?.startsWith('/chat');
}

/**
 * Số px thanh điều hướng đáy đang chiếm: MOBILE_BAR_HEIGHT khi đang hiện, 0 khi đã thụt
 * xuống hoặc route không render nó. Dùng cho các phần tử nổi cần né thanh.
 */
export function useMobileBarOffset(): number {
    const pathname = usePathname();
    const visible = useMobileBarVisible();
    if (!isMobileBarRoute(pathname)) return 0;
    return visible ? MOBILE_BAR_HEIGHT : 0;
}

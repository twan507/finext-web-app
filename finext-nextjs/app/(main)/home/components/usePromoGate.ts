'use client';

import { useCallback, useEffect, useState } from 'react';
import { API_BASE_URL } from 'services/core/config';

const SHOWN_KEY = 'finext_ai_promo_shown';
const SHOW_DELAY_MS = 900; // trang kịp hiện trước rồi popup mới trồi lên, đỡ giật lúc mới vào
const FETCH_TIMEOUT_MS = 2500; // chặn treo mạng: worst case popup hiện sau ~2.5s (serverFetch.ts dùng 3000)

// try/catch giống useTeaserCycle: chế độ riêng tư chặn storage → coi như chưa hiện.
function readShown(): boolean {
  try { return sessionStorage.getItem(SHOWN_KEY) === '1'; } catch { return false; }
}
function markShown(): void {
  try { sessionStorage.setItem(SHOWN_KEY, '1'); } catch { /* bỏ qua */ }
}

/**
 * Cổng hiện popup quảng bá Finext AI: mỗi tab một lần, và CHỈ mở khi CẢ delay đã hết VÀ câu hỏi gợi ý
 * đã fetch xong (settle) — nhờ vậy khu gợi ý có sẵn ngay lúc hiện, KHÔNG nhảy layout. Lỗi/timeout →
 * questions=[] (khu gợi ý ẩn sẵn). Client-only; StrictMode-safe: markShown chỉ chạy khi thật sự mở.
 * Dùng API_BASE_URL (như apiClient): dev → NEXT_PUBLIC_API_URL, prod client → '' (relative, fix Safari).
 */
export function usePromoGate(): { open: boolean; questions: string[]; hide: () => void } {
  const [open, setOpen] = useState(false);
  const [questions, setQuestions] = useState<string[]>([]);
  useEffect(() => {
    if (readShown()) return;
    let cancelled = false;
    let delayDone = false;
    let fetchDone = false;
    const maybeOpen = () => {
      if (!cancelled && delayDone && fetchDone) {
        markShown();
        setOpen(true);
      }
    };
    const timer = setTimeout(() => { delayDone = true; maybeOpen(); }, SHOW_DELAY_MS);
    fetch(`${API_BASE_URL}/api/v1/sse/rest/chat_suggestions`, { cache: 'no-store', signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        const qs = json?.data?.questions;
        if (!cancelled && Array.isArray(qs)) setQuestions(qs);
      })
      .catch(() => {
        // lỗi/timeout không được làm hỏng popup
      })
      .finally(() => { fetchDone = true; maybeOpen(); });
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);
  const hide = useCallback(() => setOpen(false), []);
  return { open, questions, hide };
}

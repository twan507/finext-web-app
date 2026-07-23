import type { Dispatch, SetStateAction } from 'react';
import { apiClient } from 'services/apiClient';

export interface PageMapping {
  old_page: number;
  new_page: number;
}

// Áp reorder trang (kéo-thả tab): remap số trang của các WL + đổi trang đang xem + gọi API. Lỗi → refetch.
// Dùng chung cho /watchlist, /chart, /portfolio (trước đây mỗi trang một bản handlePageDragEnd trùng nhau).
export function applyPageReorder<T extends { page?: number }>(
  mapping: PageMapping[],
  opts: {
    setWatchlists: Dispatch<SetStateAction<T[]>>;
    currentPage: number;
    setCurrentPage: (p: number) => void;
    refetch: () => void;
  },
): void {
  if (mapping.length === 0) return;
  const { setWatchlists, currentPage, setCurrentPage, refetch } = opts;
  setWatchlists((prev) => prev.map((w) => {
    const m = mapping.find((x) => x.old_page === (w.page ?? 1));
    return m ? { ...w, page: m.new_page } : w;
  }));
  const cur = mapping.find((m) => m.old_page === currentPage);
  if (cur) setCurrentPage(cur.new_page);
  apiClient({ url: '/api/v1/watchlists/reorder-pages', method: 'POST', body: { page_mapping: mapping }, requireAuth: true }).catch(() => refetch());
}

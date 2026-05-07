// Module-level cache cho view mode (Thông tin / Biểu đồ).
// Persist khi user navigate giữa các symbol; reset khi full page reload.
type ViewMode = 'chart' | 'info';

let cached: ViewMode = 'info';

export const getCachedStockViewMode = (): ViewMode => cached;
export const setCachedStockViewMode = (v: ViewMode): void => { cached = v; };

// finext-nextjs/app/(main)/market-phase/timeUtils.ts
// generated_at của phase_comment/phase_comment_basket là wall-clock GIỜ VIỆT NAM backend ghi
// (có thể kèm 'Z' khi serialize từ Mongo Date). Đọc literal giờ:phút bằng getUTC* để KHÔNG bị
// browser tự lệch theo múi giờ máy (tương tự cách useMarketUpdateTime dùng getUTC* — độc lập TZ).
export function formatVnTime(iso?: string): string | null {
  if (!iso) return null;
  const hasTz = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(iso);
  const d = new Date(hasTz ? iso : `${iso}Z`);
  if (isNaN(d.getTime())) return null;
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

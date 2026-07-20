// finext-nextjs/app/(main)/phase/phaseMeta.ts
// Bản đồ phase → nhãn (EN chính + VN phụ) + icon + màu (accessibility: màu + icon + chữ).
import type { Theme } from '@mui/material';
import type { PhaseLabel } from './types';

interface PhaseMeta {
  en: string;
  vn: string;
  glyph: string;
  color: (theme: Theme) => string;
}

// Bộ màu phase: đậm/rõ ở light, sáng hơn ở dark cho tương phản.
// UPTREND=xanh đậm · DOWNTREND=đỏ đậm · SIDEWAY=xám nhạt (trung tính) · TRANSITION=vàng.
function phaseColor(light: string, dark: string) {
  return (t: Theme) => (t.palette.mode === 'dark' ? dark : light);
}

export const PHASE_META: Record<PhaseLabel, PhaseMeta> = {
  uptrend: { en: 'UPTREND', vn: 'Tăng giá', glyph: '▲', color: phaseColor('#0f9d58', '#2ee06f') },
  downtrend: { en: 'DOWNTREND', vn: 'Giảm giá', glyph: '▼', color: phaseColor('#dc2626', '#ff5a5a') },
  sideway: { en: 'SIDEWAY', vn: 'Đi ngang', glyph: '↔', color: phaseColor('#6b7280', '#9aa1ab') },
  transition: { en: 'TRANSITION', vn: 'Chuyển pha', glyph: '⇄', color: phaseColor('#c99700', '#f5c518') },
};

export function getPhaseMeta(label?: string): PhaseMeta {
  return PHASE_META[label as PhaseLabel] ?? PHASE_META.sideway;
}

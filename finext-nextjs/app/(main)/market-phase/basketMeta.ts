// finext-nextjs/app/(main)/market-phase/basketMeta.ts
import type { Theme } from '@mui/material';
import type { RankStatus } from './types';
import { getPhaseMeta } from './phaseMeta';

/** tab key (PAID) → product key (FROZEN). */
export const TAB_TO_PRODUCT: Record<string, string> = {
  conservative: 'CONSERVATIVE',
  aggressive: 'AGGRESSIVE',
  core: 'CORE',
};

/** Tên hiển thị dự phòng khi data chưa có display_name_vi. */
export const PRODUCT_FALLBACK_NAME: Record<string, string> = {
  CONSERVATIVE: 'Phòng Thủ',
  AGGRESSIVE: 'Mạo Hiểm',
  CORE: 'Sóng Ngành',
};

export interface StatusMeta {
  label: string;
  color: (t: Theme) => string;
}

// status: khoảng cách tới ngưỡng + lịch cơ cấu (KHÔNG phải dự báo từng mã).
export const RANK_STATUS_META: Record<RankStatus, StatusMeta> = {
  trong_ro: { label: 'Nắm giữ', color: (t) => (t.palette.mode === 'dark' ? '#3b82f6' : '#2563eb') }, // xanh biển (KHÔNG dùng trend.floor = xanh sàn)
  vung_buffer: { label: 'Cân nhắc', color: (t) => t.palette.warning.main },
  // Vàng dùng chung của page (= màu pha TRANSITION, đồng bộ chip "Tái cơ cấu" + lãi/lỗ hoà vốn) — khác cam warning của "Cân nhắc".
  cho_tin_hieu: { label: 'Chờ tín hiệu', color: (t) => getPhaseMeta('transition').color(t) },
  ung_vien: { label: 'Tiềm năng', color: (t) => t.palette.trend.up },
  ngoai: { label: 'Quan sát', color: (t) => t.palette.text.disabled },
};

export function getStatusMeta(s?: string): StatusMeta {
  return RANK_STATUS_META[s as RankStatus] ?? RANK_STATUS_META.ngoai;
}

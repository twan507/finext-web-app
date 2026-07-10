// finext-nextjs/app/(main)/market-phase/basketMeta.ts
import type { Theme } from '@mui/material';
import type { RankStatus } from './types';

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
  trong_ro: { label: 'Đang giữ', color: (t) => t.palette.text.secondary },
  vung_buffer: { label: 'Sắp ra', color: (t) => t.palette.warning.main },
  ung_vien: { label: 'Chờ vào', color: (t) => t.palette.trend.up },
  ngoai: { label: 'Ngoài rổ', color: (t) => t.palette.text.disabled },
};

export function getStatusMeta(s?: string): StatusMeta {
  return RANK_STATUS_META[s as RankStatus] ?? RANK_STATUS_META.ngoai;
}

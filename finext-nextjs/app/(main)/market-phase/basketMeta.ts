// finext-nextjs/app/(main)/market-phase/basketMeta.ts
import { decomposeColor, recomposeColor, type Theme } from '@mui/material';
import type { RankStatus } from './types';
import { getPhaseMeta } from './phaseMeta';

/** Giữ lại bao nhiêu % màu gốc khi trộn xám (0.7 = 70% màu gốc + 30% xám). */
const SOFT_MIX = 0.7;

/**
 * Giảm SẮC ĐỘ bằng cách trộn màu gốc với xám — KHÔNG dùng alpha.
 * (alpha làm chip/ô nhìn "mờ mờ" xấu; trộn xám thì màu vẫn đục, chỉ trầm/xỉn đi.)
 */
function mixGrey(color: string, t: Theme, ratio = SOFT_MIX): string {
  const c = decomposeColor(color).values;
  const g = decomposeColor(t.palette.grey[500]).values;
  const at = (i: number) => Math.round(c[i] * ratio + g[i] * (1 - ratio));
  return recomposeColor({ type: 'rgb', values: [at(0), at(1), at(2)] });
}

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
  /** accent = màu chủ đề của rổ (Phòng Thủ xanh biển · Mạo Hiểm cam · Sóng Ngành tím). Bỏ trống → fallback primary. */
  color: (t: Theme, accent?: string) => string;
  /** Độ mờ của trạng thái, áp cho phần CHỮ: chip ở bảng + nhãn ngành trên heatmap. Mặc định 1.
   *  (Ô lưới heatmap mờ sâu hơn — sắc độ riêng trong SectorWaveStrip, vì ô không phải chữ nên mờ được.) */
  op?: number;
}

// status: khoảng cách tới ngưỡng + lịch cơ cấu (KHÔNG phải dự báo từng mã).
// ĐANG NẮM (Nắm giữ + Cân nhắc) = MÀU CHỦ ĐỀ CỦA RỔ, cùng tông — Cân nhắc trộn xám (trầm hơn, KHÔNG mờ)
// vì vẫn đang nắm, chỉ yếu đi/sắp ra. → liếc bảng/heatmap là thấy ngay "trong rổ" vs "ngoài rổ".
// Các trạng thái NGOÀI rổ giữ màu riêng, không theo rổ.
export const RANK_STATUS_META: Record<RankStatus, StatusMeta> = {
  trong_ro: { label: 'Nắm giữ', color: (t, accent) => accent ?? t.palette.primary.main },
  vung_buffer: { label: 'Cân nhắc', color: (t, accent) => mixGrey(accent ?? t.palette.primary.main, t), op: 0.7 },
  // Vàng dùng chung của page (= màu pha TRANSITION, đồng bộ chip "Tái cơ cấu ngành" + lãi/lỗ hoà vốn).
  cho_tin_hieu: { label: 'Chờ tín hiệu', color: (t) => getPhaseMeta('transition').color(t) },
  ung_vien: { label: 'Tiềm năng', color: (t) => t.palette.trend.up }, // xanh lá
  ngoai: { label: 'Quan sát', color: (t) => t.palette.text.disabled }, // xám
};

export function getStatusMeta(s?: string): StatusMeta {
  return RANK_STATUS_META[s as RankStatus] ?? RANK_STATUS_META.ngoai;
}

/**
 * Thứ tự ưu tiên nhóm trạng thái khi xếp bảng — DÙNG CHUNG HoldingsTable + RankTable
 * (Nắm giữ → Cân nhắc → Tiềm năng → Chờ tín hiệu → Quan sát). Ưu tiên TRƯỚC hạng.
 */
export const STATUS_ORDER: Record<string, number> = { trong_ro: 0, vung_buffer: 1, ung_vien: 2, cho_tin_hieu: 3, ngoai: 4 };

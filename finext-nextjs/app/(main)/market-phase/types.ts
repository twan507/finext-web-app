// finext-nextjs/app/(main)/market-phase/types.ts
// Kiểu dữ liệu cho page "Giai đoạn thị trường" (đọc từ stock_db qua keyword REST).

export type PhaseLabel = 'uptrend' | 'downtrend' | 'sideway' | 'transition';

/** 1 dòng phase_daily (schema gọn 12 cột). */
export interface PhaseDaily {
  // OUTPUT
  date: string;
  phase_label: PhaseLabel;
  market_exposure: number; // 0..2 (>1 = margin)
  // HƯỚNG
  breadth_slow?: number;
  breadth_blend?: number;
  breadth_aux?: number;
  // TIN CẬY
  conf_dir?: number;
  conf_flat?: number; // MỚI
  // GATE
  corr60?: number;
  px_ret20?: number;
  // DIAG
  market_intensity: number; // -1..+1
  sub_signal?: string | null;
  fnx_close: number;
}

export interface PhaseComment {
  date: string;
  market_cmt: string;
  condition_cmt?: string;
  structure_cmt?: string;
  risk_cmt?: string;
  source?: string;
  generated_at?: string;
}

/** Diễn giải RIÊNG từng chỉ số thị trường (10 dòng/phiên). Render nguyên văn. */
export interface PhaseCommentIndicator {
  date: string;
  indicator_key: string;
  indicator_label_vi?: string;
  order?: number;
  comment?: string;
  source?: string;
}

export interface PhasePerfRow {
  date: string;
  product: string; // CONSERVATIVE | CORE | AGGRESSIVE | FNX
  ret_1d_1x: number;
  ret_1d?: number;
}

export type MarketPhaseTabKey = 'market' | 'conservative' | 'aggressive' | 'core';

// ── PAID tabs (rổ danh mục) ──────────────────────────────────────────────
export type WeightMap = Record<string, number>;

export interface PhaseBasket {
  date: string;
  product: string;
  display_name_vi?: string;
  market_phase?: string;
  market_exposure?: number;
  n_held?: number;
  held: WeightMap; // đã × exposure; {} = 100% tiền mặt
  book: WeightMap; // trước exposure = "danh mục nếu vào lại"
  adds: string[];
  removes: string[];
  sectors?: string[] | null; // CORE only
}

export type RankStatus = 'trong_ro' | 'vung_buffer' | 'ung_vien' | 'ngoai';

export interface PhaseRank {
  date: string;
  product: string;
  level: 'stock' | 'sector';
  ticker: string;
  ten?: string;
  sector?: string | null;
  rank: number;
  rank_scope?: string;
  mom120?: number; // đà giá ~6 tháng (quan sát)
  vma60?: number; // thanh khoản (tỷ, quan sát)
  composite?: number | null; // chỉ sector level
  held?: number; // 0/1 theo book (độc lập exposure)
  status: RankStatus;
  nguong_vao?: number;
  nguong_giu?: number;
  next_rebalance_in?: number;
}

export interface PhaseCommentBasket {
  date: string;
  product: string;
  display_name_vi?: string;
  sector_cmt?: string | null; // CORE only
  stock_cmt?: string;
  source?: string;
  generated_at?: string;
}

export interface PhaseTrading {
  product: string;
  ticker: string;
  entry_date: string;
  exit_date?: string | null;
  n_days?: number;
  entry_price?: number;
  exit_price?: number;
  return_pct?: number;
  avg_weight?: number;
  status: 'open' | 'closed';
  exit_reason?: string;
}

export interface PhaseIndustryRow {
  date: string;
  [sector: string]: number | string;
}

/** ref_db.index_map — map mã ngành/chỉ số → tên đầy đủ. */
export interface IndexMapRow {
  ticker: string;
  ticker_name?: string;
  type?: string;
}

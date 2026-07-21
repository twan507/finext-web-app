// ============================================================================
// Dữ liệu MINH HOẠ cố định cho các biểu đồ nhúng trong trang Hướng dẫn.
// KHÔNG phải dữ liệu thật — chỉ dùng để biểu đồ luôn hiển thị đẹp, không cần
// đăng nhập và không gọi mạng. Số liệu được chọn tay cho trực quan.
// ============================================================================

import type { UTCTimestamp } from 'lightweight-charts';
import type { StockData } from '../../../home/components/marketSection/MarketVolatility';
import type { ChartData } from '../../../home/components/marketSection/MarketIndexChart';

// ---------------------------------------------------------------------------
// 1) Bản đồ cổ phiếu (treemap) — danh sách mã minh hoạ với biến động đa dạng
// ---------------------------------------------------------------------------

const mk = (
  ticker: string,
  pct_change: number,
  trading_value: number,
  close: number,
  vsi: number,
  t0_score: number,
  exchange = 'HSX'
): StockData => ({
  ticker,
  exchange,
  industry_name: '',
  pct_change,
  volume: Math.round(trading_value * 1000),
  trading_value,
  close,
  vsi,
  t0_score,
  vsma5: 0
});

export const DEMO_HEATMAP: StockData[] = [
  mk('VCB', 0.021, 980, 92.5, 1.3, 1.6),
  mk('FPT', 0.038, 760, 131.2, 1.6, 2.1),
  mk('HPG', -0.014, 720, 27.8, 0.8, -0.9),
  mk('VIC', 0.065, 540, 45.3, 1.9, 2.6),
  mk('VHM', -0.009, 510, 41.6, 1.0, -0.3),
  mk('TCB', 0.017, 470, 24.1, 1.2, 1.1),
  mk('MBB', 0.026, 430, 23.4, 1.4, 1.5),
  mk('MWG', -0.022, 410, 61.0, 0.7, -1.3),
  mk('SSI', 0.031, 390, 30.2, 1.5, 1.8),
  mk('VND', 0.009, 350, 16.8, 1.0, 0.5),
  mk('STB', 0.012, 330, 33.5, 1.1, 0.8),
  mk('GAS', -0.006, 300, 68.9, 0.9, -0.2),
  mk('VPB', 0.019, 290, 19.7, 1.2, 1.2),
  mk('CTG', 0.024, 280, 35.1, 1.3, 1.4),
  mk('ACB', 0.008, 250, 25.6, 1.0, 0.4),
  mk('DGC', -0.031, 230, 98.4, 0.6, -1.6),
  mk('HDB', 0.014, 210, 26.3, 1.1, 0.9),
  mk('POW', -0.045, 190, 13.2, 0.5, -2.0),
  mk('GVR', 0.052, 180, 34.7, 1.7, 2.3),
  mk('BID', 0.005, 170, 47.2, 1.0, 0.2),
  mk('PNJ', -0.017, 150, 96.8, 0.8, -1.0),
  mk('REE', 0.028, 130, 65.4, 1.4, 1.6),
  mk('DXG', 0.041, 120, 15.9, 1.6, 2.0),
  mk('SHB', -0.011, 110, 11.4, 0.9, -0.6),
  mk('VIX', 0.062, 100, 14.1, 1.8, 2.5),
  mk('SHS', -0.028, 90, 15.7, 0.7, -1.4, 'HNX')
];

// ---------------------------------------------------------------------------
// 2) Độ rộng thị trường (polar) — số mã tăng / giảm / đứng giá
// ---------------------------------------------------------------------------

export const DEMO_BREADTH = {
  series: [212, 118, 64],
  labels: ['Tăng giá', 'Giảm giá', 'Đứng giá']
} as const;

// Bộ lọc thu hẹp thị trường: số mã khớp vs chưa khớp
export const DEMO_SCREENER_MATCH = {
  series: [47, 953],
  labels: ['Khớp bộ lọc', 'Chưa khớp']
} as const;

// ---------------------------------------------------------------------------
// 3) Dòng tiền (bar) — giá trị tiền vào / ra / không đổi (tỷ đồng)
// ---------------------------------------------------------------------------

export const DEMO_FLOW = {
  flowIn: 1240,
  flowOut: 860,
  flowNeutral: 320
} as const;

// ---------------------------------------------------------------------------
// 4) Biểu đồ giá (nến + khối lượng) — sinh chuỗi EOD minh hoạ ổn định
// ---------------------------------------------------------------------------

// RNG có hạt giống cố định để dữ liệu không đổi giữa các lần render
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildDemoPriceData(points = 180): ChartData {
  const rand = mulberry32(20260720);
  const candleData: ChartData['candleData'] = [];
  const areaData: ChartData['areaData'] = [];
  const volumeData: ChartData['volumeData'] = [];

  // Điểm mốc: 180 phiên tính lùi từ 2026-07-20
  const base = Date.UTC(2026, 6, 20);
  const dayMs = 24 * 60 * 60 * 1000;
  let prevClose = 1180;

  for (let i = points - 1; i >= 0; i--) {
    const ts = Math.floor((base - i * dayMs) / 1000) as UTCTimestamp;
    const drift = (rand() - 0.46) * 18; // xu hướng tăng nhẹ
    const open = prevClose;
    const close = Math.max(900, open + drift);
    const high = Math.max(open, close) + rand() * 8;
    const low = Math.min(open, close) - rand() * 8;
    const volume = Math.round(90_000_000 + rand() * 140_000_000);

    candleData.push({ time: ts, open, high, low, close });
    areaData.push({ time: ts, value: close });
    volumeData.push({ time: ts, value: volume });
    prevClose = close;
  }

  const last = candleData[candleData.length - 1];
  const prev = candleData[candleData.length - 2];
  const lastDiff = parseFloat((last.close - prev.close).toFixed(2));
  const lastPctChange = (last.close - prev.close) / prev.close;

  return { areaData, candleData, volumeData, lastDiff, lastPctChange };
}

export const DEMO_PRICE_DATA: ChartData = buildDemoPriceData();

// Dữ liệu trong ngày (1D) — đường giá theo phút để khung 1D không bị trống
function buildDemoIntraday(): ChartData {
  const rand = mulberry32(777);
  const areaData: ChartData['areaData'] = [];
  const volumeData: ChartData['volumeData'] = [];
  // 09:00 giờ VN ~ 02:00 UTC ngày 2026-07-20
  const base = Date.UTC(2026, 6, 20, 2, 0, 0);
  let price = DEMO_PRICE_DATA.candleData[DEMO_PRICE_DATA.candleData.length - 1].close;

  for (let i = 0; i < 240; i++) {
    const ts = Math.floor((base + i * 60 * 1000) / 1000) as UTCTimestamp;
    price = price + (rand() - 0.48) * 2.4;
    areaData.push({ time: ts, value: price });
    volumeData.push({ time: ts, value: Math.round(1_000_000 + rand() * 3_000_000) });
  }

  const first = areaData[0];
  const last = areaData[areaData.length - 1];
  return {
    areaData,
    candleData: [],
    volumeData,
    lastDiff: parseFloat((last.value - first.value).toFixed(2)),
    lastPctChange: (last.value - first.value) / first.value
  };
}

export const DEMO_INTRADAY_DATA: ChartData = buildDemoIntraday();

export const EMPTY_CHART_DATA: ChartData = {
  areaData: [],
  candleData: [],
  volumeData: [],
  lastDiff: undefined,
  lastPctChange: undefined
};

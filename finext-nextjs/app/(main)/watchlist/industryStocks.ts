// Gom cổ phiếu theo ngành, chỉ giữ TOP N mã thanh khoản cao nhất. Thanh khoản ≈ giá trị giao dịch
// bình quân 60 phiên = khối lượng bình quân 60 phiên (vsma60) × giá (close). Dùng CHUNG cho /watchlist
// và /portfolio để 2 nơi không lệch logic (đã từng lệch → ngành hiện quá nhiều mã).

interface StockLite {
  ticker: string;
  industry_name?: string;
  vsma60?: number;
  close?: number;
}

export interface IndustryInfo {
  name: string;
  tickers: string[];
}

export function buildIndustriesTop(stocks: StockLite[], limit = 20): IndustryInfo[] {
  const map = new Map<string, { ticker: string; liq: number }[]>();
  for (const s of stocks) {
    if (!s.industry_name) continue;
    if (!map.has(s.industry_name)) map.set(s.industry_name, []);
    map.get(s.industry_name)!.push({ ticker: s.ticker, liq: (s.vsma60 ?? 0) * (s.close ?? 0) });
  }
  return Array.from(map.entries())
    .map(([name, rows]) => ({ name, tickers: rows.sort((a, b) => b.liq - a.liq).slice(0, limit).map((r) => r.ticker) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

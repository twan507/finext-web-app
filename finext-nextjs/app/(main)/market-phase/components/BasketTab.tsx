'use client';

import { Box } from '@mui/material';
import { useTheme } from '@mui/material';
import ChartSectionTitle from 'components/common/ChartSectionTitle';
import { LoadingState, EmptyState, ErrorState } from 'components/states';
import { useBasketData } from '../hooks/useBasketData';
import { TAB_TO_PRODUCT, PRODUCT_FALLBACK_NAME } from '../basketMeta';
import type { MarketPhaseTabKey } from '../types';
import HoldingsTable, { type HoldingStat } from './HoldingsTable';
import RankTable from './RankTable';
import BasketAiHero from './BasketAiHero';
import BasketPerformanceChart, { SERIES } from './BasketPerformanceChart';
import OrderBook from './OrderBook';
import IndustrySection from './IndustrySection';

function fmtDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}
function pct(v?: number | null): string {
  return v == null ? '—' : `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`;
}

/** Tab rổ trả phí (Phòng Thủ / Mạo Hiểm / Sóng Ngành) — layout "AI Briefing". */
export default function BasketTab({ tabKey }: { tabKey: MarketPhaseTabKey }) {
  const theme = useTheme();
  const product = TAB_TO_PRODUCT[tabKey] ?? 'CONSERVATIVE';
  const accent = SERIES.find((s) => s.product === product)?.color(theme) ?? theme.palette.primary.main;
  const { basket, rank, commentBasket, trading, perf, industry, isLoading, error } = useBasketData();

  if (isLoading) return <LoadingState variant="spinner" message="Đang tải dữ liệu danh mục..." />;
  if (error) return <ErrorState message={error} />;

  const basketRow = basket.find((b) => b.product === product) ?? null;
  // Ưu tiên tên FE (PRODUCT_FALLBACK_NAME = Phòng Thủ/Mạo Hiểm/Sóng Ngành) hơn display_name_vi backend (còn tên cũ).
  const name = PRODUCT_FALLBACK_NAME[product] || basketRow?.display_name_vi || product;

  const latestRankDate = rank.reduce((m, r) => (r.date > m ? r.date : m), '');
  const rankLatest = rank.filter((r) => r.date === latestRankDate && r.product === product);
  const stockRanks = rankLatest.filter((r) => r.level === 'stock');
  const sectorRanks = rankLatest.filter((r) => r.level === 'sector');
  const heldRanks = stockRanks.filter((r) => r.held === 1);
  const otherRanks = stockRanks.filter((r) => r.held !== 1);

  const comment = commentBasket.find((c) => c.product === product) ?? null;
  const trades = trading.filter((t) => t.product === product);
  const isCore = product === 'CORE';
  const held = basketRow?.held ?? {};
  const isHolding = Object.keys(held).length > 0;
  const updateStr = fmtDate(basketRow?.date);

  if (!basketRow && stockRanks.length === 0 && trades.length === 0) {
    return <EmptyState title="Chưa có dữ liệu" description={`Dữ liệu danh mục ${name} sẽ cập nhật cuối phiên.`} />;
  }

  // ── Header stats cho bảng Danh mục nắm giữ ────────────────────────────────
  // Lãi/lỗ danh mục = trung bình theo tỷ trọng của các vị thế đang mở (tạm tính).
  const openByTicker = new Map(trades.filter((t) => t.status === 'open').map((t) => [t.ticker, t]));
  let wsum = 0;
  let psum = 0;
  for (const tk of Object.keys(held)) {
    const tr = openByTicker.get(tk);
    if (tr && tr.return_pct != null) {
      wsum += held[tk];
      psum += held[tk] * tr.return_pct;
    }
  }
  const portfolioPnl = wsum > 0 ? psum / wsum : null;
  const numSapRa = heldRanks.filter((r) => r.status === 'vung_buffer').length; // đang giữ, sắp bị loại
  const numChoVao = otherRanks.filter((r) => r.status === 'ung_vien').length; // ứng viên chờ vào rổ

  const holdStats: HoldingStat[] = [
    { label: 'Lãi/lỗ danh mục', value: pct(portfolioPnl), tone: portfolioPnl == null ? 'neutral' : portfolioPnl >= 0 ? 'up' : 'down' },
    { label: 'Số mã nắm giữ', value: `${Object.keys(held).length}` },
    { label: 'Số mã sắp ra', value: `${numSapRa}` },
    { label: 'Số mã chờ vào', value: `${numChoVao}` },
  ];

  return (
    <Box>
      {/* Hero AI Briefing — nhận định + 4 KPI chính */}
      {basketRow && <BasketAiHero text={comment?.stock_cmt} generatedAt={comment?.generated_at} accent={accent} />}

      {/* Biểu đồ hiệu suất */}
      {perf.length > 0 && (
        <Box sx={{ mt: 4 }}>
          <ChartSectionTitle title="Lịch sử Hiệu suất danh mục" description="Hiệu suất tích luỹ của rổ so với FNXINDEX." updateTime={updateStr} />
          <Box sx={{ mt: 1.5 }}>
            <BasketPerformanceChart perf={perf} products={[product]} />
          </Box>
        </Box>
      )}

      {/* Danh mục nắm giữ / dự kiến */}
      {basketRow && (
        <Box sx={{ mt: 4 }}>
          <ChartSectionTitle
            title={isHolding ? `Danh mục đang nắm giữ` : `Danh mục dự kiến`}
            description={isHolding ? 'Cổ phiếu đang nắm giữ, tỷ trọng và lãi/lỗ từng mã.' : 'Danh mục dự kiến sẽ mua khi thị trường bật lại (đang phòng thủ tiền mặt).'}
            updateTime={updateStr}
          />
          <Box sx={{ mt: 1.5 }}>
            <HoldingsTable basket={basketRow} heldRanks={heldRanks} trades={trades} accent={accent} stats={holdStats} />
          </Box>
        </Box>
      )}

      {/* Chờ vào & Sổ lệnh — 2 cột trên màn rộng */}
      {(otherRanks.length > 0 || trades.length > 0) && (
        <Box sx={{ mt: 4, display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: { xs: 4, lg: 3 } }}>
          {otherRanks.length > 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
              <ChartSectionTitle title="Cổ phiếu chờ vào & theo dõi" description="Xếp hạng và trạng thái sắp vào rổ của các mã chưa nắm giữ." updateTime={updateStr} />
              <Box sx={{ mt: 1.5 }}>
                <RankTable rows={otherRanks} showSector={isCore} accent={accent} />
              </Box>
            </Box>
          )}
          {trades.length > 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <ChartSectionTitle title="Sổ lệnh" description="Lịch sử vào/ra từng mã và kết quả (mô phỏng backtest)." updateTime={updateStr} />
              {/* lg: absolute-fill để cột này KHÔNG đóng góp chiều cao vào hàng grid → hàng cao theo bảng Chờ vào,
                  Sổ lệnh bị ép đúng bằng và cuộn bên trong. xs: static, natural height (TableContainer tự cap). */}
              <Box sx={{ mt: 1.5, flex: 1, minHeight: { xs: 'auto', lg: 0 }, position: 'relative' }}>
                <Box sx={{ position: { xs: 'static', lg: 'absolute' }, inset: { lg: 0 }, display: 'flex', flexDirection: 'column' }}>
                  <OrderBook trades={trades} accent={accent} />
                </Box>
              </Box>
            </Box>
          )}
        </Box>
      )}

      {/* Sóng Ngành (CORE): tầng ngành ở cuối */}
      {isCore && (industry.length > 0 || sectorRanks.length > 0) && (
        <Box sx={{ mt: 4 }}>
          <IndustrySection sectorRanks={sectorRanks} industry={industry} sectorCmt={comment?.sector_cmt} generatedAt={comment?.generated_at} updateTime={updateStr} />
        </Box>
      )}
    </Box>
  );
}

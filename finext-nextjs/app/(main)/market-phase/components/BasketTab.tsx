'use client';

import { Box } from '@mui/material';
import ChartSectionTitle from 'components/common/ChartSectionTitle';
import { LoadingState, EmptyState, ErrorState } from 'components/states';
import { useBasketData } from '../hooks/useBasketData';
import { TAB_TO_PRODUCT, PRODUCT_FALLBACK_NAME } from '../basketMeta';
import type { MarketPhaseTabKey } from '../types';
import HoldingsTable from './HoldingsTable';
import RankTable from './RankTable';
import PortfolioComment from './PortfolioComment';
import BasketPerformanceChart from './BasketPerformanceChart';
import OrderBook from './OrderBook';
import IndustrySection from './IndustrySection';

function fmtDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

/** Tab rổ trả phí (Bảo Thủ / Tăng Trưởng / Sóng Ngành). */
export default function BasketTab({ tabKey }: { tabKey: MarketPhaseTabKey }) {
  const product = TAB_TO_PRODUCT[tabKey] ?? 'CONSERVATIVE';
  const { basket, rank, commentBasket, trading, perf, industry, isLoading, error } = useBasketData();

  if (isLoading) return <LoadingState variant="spinner" message="Đang tải dữ liệu danh mục..." />;
  if (error) return <ErrorState message={error} />;

  const basketRow = basket.find((b) => b.product === product) ?? null;
  const name = basketRow?.display_name_vi || PRODUCT_FALLBACK_NAME[product] || product;

  const latestRankDate = rank.reduce((m, r) => (r.date > m ? r.date : m), '');
  const rankLatest = rank.filter((r) => r.date === latestRankDate && r.product === product);
  const stockRanks = rankLatest.filter((r) => r.level === 'stock');
  const sectorRanks = rankLatest.filter((r) => r.level === 'sector');
  const heldRanks = stockRanks.filter((r) => r.held === 1); // đang giữ (book)
  const otherRanks = stockRanks.filter((r) => r.held !== 1); // chờ vào & theo dõi

  const comment = commentBasket.find((c) => c.product === product) ?? null;
  const trades = trading.filter((t) => t.product === product);
  const isCore = product === 'CORE';
  const isHolding = !!(basketRow?.held && Object.keys(basketRow.held).length > 0);
  const updateStr = fmtDate(basketRow?.date);

  if (!basketRow && stockRanks.length === 0 && trades.length === 0) {
    return <EmptyState title="Chưa có dữ liệu" description={`Dữ liệu danh mục ${name} sẽ cập nhật cuối phiên.`} />;
  }

  return (
    <Box>
      {isCore && (industry.length > 0 || sectorRanks.length > 0) && (
        <IndustrySection sectorRanks={sectorRanks} industry={industry} sectorCmt={comment?.sector_cmt} generatedAt={comment?.generated_at} updateTime={updateStr} />
      )}

      {basketRow && (
        <Box sx={{ mt: isCore ? 4 : 0 }}>
          <ChartSectionTitle
            title={isHolding ? `Danh mục ${name} — đang nắm giữ` : `Danh mục ${name} — dự kiến`}
            description={
              isHolding
                ? 'Cổ phiếu đang nắm giữ, tỷ trọng và lãi/lỗ từng mã.'
                : 'Danh mục dự kiến sẽ mua khi thị trường bật lại (đang phòng thủ tiền mặt).'
            }
            updateTime={updateStr}
          />
          <Box sx={{ mt: 1.5 }}>
            <HoldingsTable basket={basketRow} heldRanks={heldRanks} trades={trades} />
          </Box>
        </Box>
      )}

      {otherRanks.length > 0 && (
        <Box sx={{ mt: 4 }}>
          <ChartSectionTitle title="Cổ phiếu chờ vào & theo dõi" description="Xếp hạng và trạng thái sắp vào rổ của các mã chưa nắm giữ." updateTime={updateStr} />
          <Box sx={{ mt: 1.5 }}>
            <RankTable rows={otherRanks} showSector={isCore} />
          </Box>
        </Box>
      )}

      {comment?.stock_cmt && (
        <Box sx={{ mt: 4 }}>
          <ChartSectionTitle title="Diễn giải danh mục" description="Diễn giải trạng thái danh mục và các thay đổi sắp tới." updateTime={fmtDate(comment.date)} />
          <Box sx={{ mt: 1.5 }}>
            <PortfolioComment text={comment.stock_cmt} generatedAt={comment.generated_at} />
          </Box>
        </Box>
      )}

      {perf.length > 0 && (
        <Box sx={{ mt: 4 }}>
          <ChartSectionTitle title={`Hiệu suất ${name}`} description="Hiệu suất tích luỹ của rổ so với FNX-Index." updateTime={updateStr} />
          <Box sx={{ mt: 1.5 }}>
            <BasketPerformanceChart perf={perf} products={[product]} />
          </Box>
        </Box>
      )}

      {trades.length > 0 && (
        <Box sx={{ mt: 4 }}>
          <ChartSectionTitle title="Sổ lệnh" description="Lịch sử vào/ra từng mã và kết quả (mô phỏng backtest)." updateTime={updateStr} />
          <Box sx={{ mt: 1.5 }}>
            <OrderBook trades={trades} />
          </Box>
        </Box>
      )}
    </Box>
  );
}

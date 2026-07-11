'use client';

import { useState } from 'react';
import { Box, Typography } from '@mui/material';
import { useTheme } from '@mui/material';
import { getResponsiveFontSize } from 'theme/tokens';
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
import SessionStrip from './SessionStrip';

function fmtDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}
function pct(v?: number | null): string {
  return v == null ? '—' : `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`;
}
// So sánh phiên theo ngày (slice 10) để không phụ thuộc định dạng date/datetime.
const dkey = (s?: string | null): string => (s ?? '').slice(0, 10);

/** Tab rổ trả phí (Phòng Thủ / Mạo Hiểm / Sóng Ngành) — layout "AI Briefing" + xem lại 20 phiên. */
export default function BasketTab({ tabKey }: { tabKey: MarketPhaseTabKey }) {
  const theme = useTheme();
  const [selectedDate, setSelectedDate] = useState<string>(''); // '' = mặc định phiên mới nhất
  const product = TAB_TO_PRODUCT[tabKey] ?? 'CONSERVATIVE';
  // Layout "gọn" (bỏ cột Tới cơ cấu · Xếp hạng · chip Lý do · Ngày mua · dòng lịch cơ cấu) cho rổ cổ phiếu đơn lẻ:
  // Phòng Thủ + Mạo Hiểm (chưa gồm Sóng Ngành). accent/ambient tự theo tab: Phòng Thủ=xanh, Mạo Hiểm=cam.
  const isConservative = tabKey === 'conservative' || tabKey === 'aggressive';
  const accent = SERIES.find((s) => s.product === product)?.color(theme) ?? theme.palette.primary.main;
  const { basket, rank, commentBasket, trading, perf, industry, daily, indexMap, isLoading, error } = useBasketData();

  if (isLoading) return <LoadingState variant="spinner" message="Đang tải dữ liệu danh mục..." />;
  if (error) return <ErrorState message={error} />;

  // ── Danh sách phiên (distinct date của rổ này, mới → cũ), mặc định = phiên mới nhất ──
  const datesDesc = Array.from(new Set(basket.filter((b) => b.product === product).map((b) => b.date))).sort((a, b) => (a > b ? -1 : 1));
  const latestDate = datesDesc[0] ?? '';
  const selected = selectedDate || latestDate;
  const isLatest = selected === latestDate;
  const stripDates = datesDesc.slice(0, 20).reverse(); // cũ → mới cho SessionStrip
  const phaseByDate = new Map(daily.map((d) => [d.date, d.phase_label] as const));

  const basketRow = basket.find((b) => b.product === product && b.date === selected) ?? null;
  // Ưu tiên tên FE (PRODUCT_FALLBACK_NAME = Phòng Thủ/Mạo Hiểm/Sóng Ngành) hơn display_name_vi backend (còn tên cũ).
  const name = PRODUCT_FALLBACK_NAME[product] || basketRow?.display_name_vi || product;

  // Rank cổ phiếu theo phiên đang chọn.
  const rankSel = rank.filter((r) => r.date === selected && r.product === product);
  const stockRanks = rankSel.filter((r) => r.level === 'stock');
  const heldRanks = stockRanks.filter((r) => r.held === 1);
  const otherRanks = stockRanks.filter((r) => r.held !== 1);
  // Lịch cơ cấu (portfolio-level) — lấy từ dòng rank bất kỳ có next_rebalance_in (cho dòng dưới tiêu đề, Phòng Thủ).
  const nextRebalance = stockRanks.find((r) => r.next_rebalance_in != null)?.next_rebalance_in ?? null;
  // Ngành (CORE) KHÔNG theo phiên chọn. Line chart sức mạnh cần FULL lịch sử → lấy toàn bộ sector rows.
  const latestRankDate = rank.reduce((m, r) => (r.date > m ? r.date : m), '');
  const sectorRanks = rank.filter((r) => r.product === product && r.level === 'sector');

  const comment = commentBasket.find((c) => c.product === product) ?? null;
  const tradesAll = trading.filter((t) => t.product === product);
  // Sổ lệnh: lệnh đã đóng, thoát <= phiên đang chọn (stats OrderBook tính trên tập này).
  const tradesForBook = tradesAll.filter((t) => t.status === 'closed' && dkey(t.exit_date) <= dkey(selected));
  const isCore = product === 'CORE';
  const held = basketRow?.held ?? {};
  const selUpdateStr = fmtDate(selected);

  if (!basketRow && stockRanks.length === 0 && tradesForBook.length === 0) {
    return <EmptyState title="Chưa có dữ liệu" description={`Dữ liệu danh mục ${name} sẽ cập nhật cuối phiên.`} />;
  }

  // ── Header stats cho bảng Danh mục nắm giữ ────────────────────────────────
  const numSapRa = heldRanks.filter((r) => r.status === 'vung_buffer').length; // đang giữ, sắp bị loại
  const numChoVao = otherRanks.filter((r) => r.status === 'ung_vien').length; // ứng viên chờ vào rổ
  const baseStats: HoldingStat[] = [
    { label: 'Số mã nắm giữ', value: `${Object.keys(held).length}` },
    { label: 'Số mã sắp ra', value: `${numSapRa}` },
    { label: 'Số mã chờ vào', value: `${numChoVao}` },
  ];
  // Lãi/lỗ danh mục = TB theo tỷ trọng của vị thế đang mở — chỉ có ở phiên mới nhất (quá khứ không có MTM).
  let portfolioPnl: number | null = null;
  if (isLatest) {
    const openByTicker = new Map(tradesAll.filter((t) => t.status === 'open').map((t) => [t.ticker, t]));
    let wsum = 0;
    let psum = 0;
    for (const tk of Object.keys(held)) {
      const tr = openByTicker.get(tk);
      if (tr && tr.return_pct != null) {
        wsum += held[tk];
        psum += held[tk] * tr.return_pct;
      }
    }
    portfolioPnl = wsum > 0 ? psum / wsum : null;
  }
  const holdStats: HoldingStat[] = isLatest
    ? [{ label: 'Lãi/lỗ danh mục', value: pct(portfolioPnl), tone: portfolioPnl == null ? 'neutral' : portfolioPnl >= 0 ? 'up' : 'down' }, ...baseStats]
    : baseStats;

  return (
    <Box>
      {/* 1–2. Lịch sử hiệu suất (KHÔNG phụ thuộc phiên chọn) */}
      {perf.length > 0 && (
        <Box>
          <ChartSectionTitle title="Hiệu suất danh mục" description="Hiệu suất tích luỹ của rổ so với FNXINDEX." updateTime={fmtDate(latestDate)} />
          <Box sx={{ mt: 1.5 }}>
            <BasketPerformanceChart perf={perf} products={[product]} />
          </Box>
        </Box>
      )}

      {/* 3. Nhận định FINEXT AI — dưới biểu đồ */}
      {basketRow && (
        <Box sx={{ mt: 4 }}>
          <BasketAiHero text={comment?.stock_cmt} generatedAt={comment?.generated_at} accent={accent} />
        </Box>
      )}

      {/* 3b. Sóng Ngành (CORE): cụm ngành dời LÊN GIỮA (Hiệu suất ↔ Vận hành), kèm nhận định ngành sector_cmt trong card. */}
      {isCore && (industry.length > 0 || sectorRanks.length > 0) && (
        <Box sx={{ mt: 4 }}>
          <IndustrySection sectorRanks={sectorRanks} industry={industry} indexMap={indexMap} accent={accent} sectorCmt={comment?.sector_cmt} generatedAt={comment?.generated_at} updateTime={fmtDate(latestRankDate)} />
        </Box>
      )}

      {/* 4. Tiêu đề "Vận hành danh mục" + thanh chọn phiên (cùng hàng; wrap trên mobile) */}
      {basketRow && (
        <Box sx={{ mt: 4, display: 'flex', alignItems: { xs: 'flex-start', md: 'center' }, justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
          <Box>
            <ChartSectionTitle title="Vận hành danh mục" description="Chi tiết nắm giữ, cổ phiếu chờ vào và sổ lệnh theo từng phiên." updateTime={selUpdateStr} />
            {/* Phòng Thủ: dòng lịch cơ cấu (thay cột "Tới cơ cấu" đã bỏ) — cân chiều cao 2 dòng với SessionStrip bên phải. */}
            {isConservative && nextRebalance != null && (
              <Typography sx={{ mt: 0.75, fontSize: getResponsiveFontSize('xs'), color: 'text.secondary' }}>
                Kì tái cơ cấu tiếp theo còn {nextRebalance} phiên
              </Typography>
            )}
          </Box>
          {stripDates.length > 0 && <SessionStrip dates={stripDates} phaseByDate={phaseByDate} selected={selected} onSelect={setSelectedDate} />}
        </Box>
      )}

      {/* 5. Danh mục nắm giữ / dự kiến — theo phiên chọn (tiêu đề gộp vào "Vận hành danh mục" ở trên) */}
      {basketRow && (
        <Box sx={{ mt: 2.5 }}>
          <HoldingsTable basket={basketRow} ranks={stockRanks} trades={tradesAll} accent={accent} stats={holdStats} isLatest={isLatest} selectedDate={selected} conservativeLayout={isConservative} />
        </Box>
      )}

      {/* Chờ vào & Sổ lệnh — 2 cột trên màn rộng */}
      {(otherRanks.length > 0 || tradesForBook.length > 0) && (
        <Box sx={{ mt: 4, display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: { xs: 4, lg: 3 } }}>
          {otherRanks.length > 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
              <RankTable rows={otherRanks} showSector={isCore} accent={accent} conservativeLayout={isConservative} />
            </Box>
          )}
          {tradesForBook.length > 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              {/* lg: absolute-fill để cột này KHÔNG đóng góp chiều cao vào hàng grid → hàng cao theo bảng Chờ vào,
                  Sổ lệnh bị ép đúng bằng và cuộn bên trong. xs: static, natural height (TableContainer tự cap). */}
              <Box sx={{ flex: 1, minHeight: { xs: 'auto', lg: 0 }, position: 'relative' }}>
                <Box sx={{ position: { xs: 'static', lg: 'absolute' }, inset: { lg: 0 }, display: 'flex', flexDirection: 'column' }}>
                  <OrderBook trades={tradesForBook} accent={accent} conservativeLayout={isConservative} />
                </Box>
              </Box>
            </Box>
          )}
        </Box>
      )}

    </Box>
  );
}

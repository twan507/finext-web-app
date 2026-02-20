'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { Box, Typography, useTheme, Divider, alpha } from '@mui/material';

import type { RawMarketData } from '../components/MarketIndexChart';
import IndexTable from '../components/IndexTable';

import InfoTooltip from 'components/common/InfoTooltip';
import { getTrendColor, getVsiColor } from 'theme/colorHelpers';

import TongQuanSection from './components/TongQuanSection';
import DongTienSection from './components/DongTienSection';
import NuocNgoaiSection from './components/NuocNgoaiSection';
import TuDoanhSection from './components/TuDoanhSection';

import { ISseRequest } from 'services/core/types';
import { sseClient, getFromCache } from 'services/sseClient';
import {
  getResponsiveFontSize,
  fontWeight,
  borderRadius,
  getGlassCard,
  transitions,
  layoutTokens,
} from 'theme/tokens';

// ========== INDEX LISTS ==========
const MAIN_INDEXES = ['VNINDEX', 'VN30', 'VNXALL', 'HNXINDEX', 'HNX30', 'UPINDEX'];
const DERIVATIVE_INDEXES = ['VN30F1M', 'VN30F2M', 'VN30F1Q', 'VN30F2Q', 'VN100F1M', 'VN100F2M', 'VN100F1Q', 'VN100F2Q'];
const FINEXT_INDEXES = ['FNXINDEX', 'FNX100', 'LARGECAP', 'MIDCAP', 'SMALLCAP', 'VUOTTROI', 'ONDINH', 'SUKIEN'];

// Type cho SSE data
type IndexDataByTicker = Record<string, RawMarketData[]>;

// Extended type cho index data với các trường bổ sung từ home_today_index
interface IndexRawData extends RawMarketData {
  trading_value?: number;
  w_pct?: number;
  m_pct?: number;
  q_pct?: number;
  y_pct?: number;
  vsi?: number;
}

// ========== STAT ROW (label trái, value phải) ==========
function StatRow({ label, value, color, tooltip }: { label: string; value: string; color?: string; tooltip?: string }) {
  const theme = useTheme();
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.55, px: 0.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Typography sx={{
          fontSize: getResponsiveFontSize('xs'),
          color: theme.palette.text.secondary,
          fontWeight: fontWeight.medium,
        }}>
          {label}
        </Typography>
        {tooltip && <InfoTooltip title={tooltip} />}
      </Box>
      <Typography sx={{
        fontSize: getResponsiveFontSize('sm'),
        fontWeight: fontWeight.semibold,
        color: color || theme.palette.text.primary,
      }}>
        {value}
      </Typography>
    </Box>
  );
}

// ========== INDEX DETAIL PANEL ==========
function IndexDetailPanel({ indexName, todayData }: { indexName: string; todayData: IndexRawData[] }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  // Lấy record mới nhất (cuối mảng)
  const latest = todayData.length > 0 ? todayData[todayData.length - 1] : null;

  const glassStyles = (() => {
    const g = getGlassCard(isDark);
    return { background: g.background, backdropFilter: g.backdropFilter, WebkitBackdropFilter: g.WebkitBackdropFilter, border: g.border };
  })();

  const formatPct = (v: number | undefined | null) => {
    if (v == null) return '—';
    return `${v > 0 ? '+' : ''}${v.toFixed(2)}%`;
  };
  const formatPrice = (v: number | undefined | null) => {
    if (v == null) return '—';
    return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  const formatVolume = (v: number | undefined | null) => {
    if (v == null) return '—';
    return v.toLocaleString('en-US');
  };
  const formatValue = (v: number | undefined | null) => {
    if (v == null) return '—';
    return `${Math.round(v).toLocaleString('en-US')} Tỷ`;
  };
  const formatVsi = (v: number | undefined | null) => {
    if (v == null) return '—';
    return `${(v * 100).toFixed(2)}%`;
  };

  return (
    <Box sx={{
      ...glassStyles,
      borderRadius: `${borderRadius.lg}px`,
      p: 1.5,
    }}>
      {/* Title */}
      <Typography sx={{
        fontSize: getResponsiveFontSize('md'),
        fontWeight: fontWeight.bold,
        color: theme.palette.text.primary,
        mb: 1,
      }}>
        Thông tin chi tiết {indexName}
      </Typography>

      {/* Section 1: OHLC — ẩn trên mobile */}
      <Box sx={{ display: { xs: 'none', md: 'block' } }}>
        <StatRow label="Open" value={formatPrice(latest?.open)} />
        <StatRow label="High" value={formatPrice(latest?.high)} color={theme.palette.trend.up} />
        <StatRow label="Low" value={formatPrice(latest?.low)} color={theme.palette.trend.down} />
        <StatRow
          label="Close"
          value={formatPrice(latest?.close)}
          tooltip="Giá đóng cửa phiên gần nhất, hoặc giá khớp lệnh mới nhất nếu phiên đang diễn ra."
        />
        <Divider sx={{ my: 1 }} />
      </Box>

      {/* Section 2: Biến động */}
      <StatRow label="% Tuần" value={formatPct(latest?.w_pct)} color={latest?.w_pct != null ? getTrendColor(latest.w_pct, theme) : undefined} />
      <StatRow label="% Tháng" value={formatPct(latest?.m_pct)} color={latest?.m_pct != null ? getTrendColor(latest.m_pct, theme) : undefined} />
      <StatRow label="% Quý" value={formatPct(latest?.q_pct)} color={latest?.q_pct != null ? getTrendColor(latest.q_pct, theme) : undefined} />
      <StatRow label="% Năm" value={formatPct(latest?.y_pct)} color={latest?.y_pct != null ? getTrendColor(latest.y_pct, theme) : undefined} />

      {/* Section 3: Thanh khoản */}
      <Divider sx={{ my: 1 }} />
      <StatRow
        label="Chỉ số thanh khoản"
        value={formatVsi(latest?.vsi)}
        color={latest?.vsi != null ? getVsiColor(latest.vsi, theme) : undefined}
        tooltip="Tỉ lệ thanh khoản phiên hiện tại so với trung bình 5 phiên gần nhất. Giá trị > 120% cho thấy đột biến về mặt thanh khoản."
      />
      <StatRow label="Khối lượng giao dịch" value={formatVolume(latest?.volume)} />
      <StatRow label="Giá trị giao dịch" value={formatValue(latest?.trading_value)} />
    </Box>
  );
}

// ========== INDEX TABLES SECTION (always 3 tables side-by-side, with horizontal scroll) ==========
function IndexTablesSection({ ticker, onTickerChange, todayAllData }: {
  ticker: string;
  onTickerChange: (t: string) => void;
  todayAllData: IndexDataByTicker;
}) {
  const theme = useTheme();

  const titleSx = {
    fontSize: getResponsiveFontSize('md'),
    fontWeight: fontWeight.semibold,
    color: theme.palette.text.primary,
    mb: 1.5,
    ml: 1,
    pb: 1,
    borderBottom: `2px solid ${theme.palette.primary.main}`,
    display: 'inline-block',
  };

  const tables = [
    { id: 'coso', title: 'Cơ sở', list: MAIN_INDEXES },
    { id: 'phaisinh', title: 'Phái sinh', list: DERIVATIVE_INDEXES },
    { id: 'finext', title: 'Finext', list: FINEXT_INDEXES },
  ];

  return (
    <Box sx={{
      overflowX: 'auto',
      // Hidden scrollbar but still scrollable
      scrollbarWidth: 'none',          // Firefox
      '&::-webkit-scrollbar': { display: 'none' }, // Chrome/Safari
      msOverflowStyle: 'none',         // IE/Edge
    }}>
      <Box sx={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 4,
        width: 'fit-content',
        minWidth: '100%',
      }}>
        {tables.map((t) => (
          <Box key={t.id} sx={{ minWidth: 320, flex: 1 }}>
            <Typography sx={titleSx}>{t.title}</Typography>
            <IndexTable
              selectedTicker={ticker}
              onTickerChange={onTickerChange}
              indexList={t.list}
              todayAllData={todayAllData}
            />
          </Box>
        ))}
      </Box>
    </Box>
  );
}

// ========== SUB-NAVBAR TABS CONFIG ==========
const MARKET_TABS = [
  { id: 'overview', label: 'Tổng quan' },
  { id: 'cashflow', label: 'Dòng tiền' },
  { id: 'foreign', label: 'Nước ngoài' },
  { id: 'proprietary', label: 'Tự doanh' },
] as const;

type MarketTabId = typeof MARKET_TABS[number]['id'];

// ========== SUB-NAVBAR (full-width bleed) ==========
function SubNavbar({ activeTab, onTabChange }: {
  activeTab: MarketTabId;
  onTabChange: (tab: MarketTabId) => void;
}) {
  const theme = useTheme();

  return (
    <Box sx={{
      // Full-width bleed: stretch to <main> edges using viewport calc
      // calc(-50vw + 50%) centers element relative to viewport
      // On desktop (lg+), offset by half sidebar width (25px) since <main> is shifted by sidebar
      // overflow-x: clip on <main> in LayoutContent handles scrollbar width differences
      mx: { xs: 'calc(-50vw + 50%)', lg: `calc(-50vw + 50% + ${layoutTokens.compactDrawerWidth / 2}px)` },
      borderBottom: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
      borderTop: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
      bgcolor: theme.palette.background.default,
    }}>
      <Box sx={{
        maxWidth: 1400,
        mx: 'auto',
        px: { xs: 1.5, md: 2, lg: 3 },
        display: 'flex',
        overflowX: 'auto',
        scrollbarWidth: 'none',
        '&::-webkit-scrollbar': { display: 'none' },
        msOverflowStyle: 'none',
      }}>
        {MARKET_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <Box
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              sx={{
                px: { xs: 2, md: 2.5 },
                py: 1.5,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                position: 'relative',
                borderBottom: isActive ? `3px solid ${theme.palette.primary.main}` : '3px solid transparent',
                transition: transitions.colors,
                '&:hover': {
                  color: theme.palette.primary.main,
                },
              }}
            >
              <Typography sx={{
                fontSize: getResponsiveFontSize('md'),
                fontWeight: isActive ? fontWeight.semibold : fontWeight.medium,
                color: isActive ? theme.palette.primary.main : theme.palette.text.secondary,
                transition: transitions.colors,
              }}>
                {tab.label}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}



// ========== MAIN COMPONENT ==========
export default function MarketsContent() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [ticker, setTicker] = useState<string>('VNINDEX');
  const [activeTab, setActiveTab] = useState<MarketTabId>('overview');

  const isMountedRef = useRef<boolean>(true);
  const todaySseRef = useRef<{ unsubscribe: () => void } | null>(null);

  // ========== STATE ==========
  const [todayAllData, setTodayAllData] = useState<IndexDataByTicker>(() => {
    const cached = getFromCache<RawMarketData[]>('home_today_index');
    if (cached && Array.isArray(cached)) {
      const grouped: IndexDataByTicker = {};
      cached.forEach((item: RawMarketData) => {
        const t = item.ticker;
        if (t) { if (!grouped[t]) grouped[t] = []; grouped[t].push(item); }
      });
      return grouped;
    }
    return {};
  });



  // ========== SSE - Today All Indexes ==========
  useEffect(() => {
    isMountedRef.current = true;
    if (todaySseRef.current) { todaySseRef.current.unsubscribe(); todaySseRef.current = null; }

    const requestProps: ISseRequest = { url: '/api/v1/sse/stream', queryParams: { keyword: 'home_today_index' } };
    todaySseRef.current = sseClient<RawMarketData[]>(requestProps, {
      onOpen: () => { },
      onData: (receivedData) => {
        if (isMountedRef.current && receivedData && Array.isArray(receivedData)) {
          const grouped: IndexDataByTicker = {};
          receivedData.forEach((item: RawMarketData) => {
            const t = item.ticker;
            if (t) { if (!grouped[t]) grouped[t] = []; grouped[t].push(item); }
          });
          setTodayAllData(grouped);
        }
      },
      onError: (sseError) => { if (isMountedRef.current) console.warn('[SSE Today] Error:', sseError.message); },
      onClose: () => { }
    }, { cacheTtl: 5 * 60 * 1000, useCache: true });

    return () => { isMountedRef.current = false; if (todaySseRef.current) todaySseRef.current.unsubscribe(); };
  }, []);

  // Handle ticker change
  const handleTableTickerChange = (newTicker: string) => {
    setTicker(newTicker);
  };

  // Get display name for ticker
  const indexName = useMemo(() => {
    const firstRecord = todayAllData[ticker]?.[0];
    return firstRecord?.ticker_name || ticker;
  }, [todayAllData, ticker]);

  // Render active section based on tab
  const renderActiveSection = () => {
    switch (activeTab) {
      case 'overview':
        return <TongQuanSection />;
      case 'cashflow':
        return <DongTienSection />;
      case 'foreign':
        return <NuocNgoaiSection />;
      case 'proprietary':
        return <TuDoanhSection />;
      default:
        return null;
    }
  };

  return (
    <Box sx={{ py: 3 }}>
      {/* Title */}
      <Typography variant="h1" sx={{ fontSize: getResponsiveFontSize('h1'), mb: 4 }}>
        Thị trường
      </Typography>

      {/* ========== MAIN SECTION: Detail Panel (left) + 3 Index Tables (right) ========== */}
      <Box sx={{
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        gap: { xs: 2, md: 3 },
      }}>
        {/* Left: Index Detail Panel — hidden on mobile */}
        <Box sx={{
          width: 340,
          flexShrink: 0,
          display: { xs: 'none', md: 'block' },
        }}>
          <IndexDetailPanel indexName={indexName} todayData={todayAllData[ticker] || []} />
        </Box>

        {/* Right: 3 Index Tables */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <IndexTablesSection
            ticker={ticker}
            onTickerChange={handleTableTickerChange}
            todayAllData={todayAllData}
          />
        </Box>
      </Box>

      {/* ========== SUB-NAVBAR (full-width bleed) ========== */}
      <Box sx={{ mt: 4 }}>
        <SubNavbar activeTab={activeTab} onTabChange={setActiveTab} />
      </Box>

      {/* ========== TAB CONTENT ========== */}
      {renderActiveSection()}
    </Box>
  );
}

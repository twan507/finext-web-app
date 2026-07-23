'use client';

// Chip giai đoạn thị trường cho trang Tư vấn Danh mục. Fetch thẳng phase_daily (nhẹ hơn dùng cả
// useMarketPhaseData), lấy phiên mới nhất, báo ngược label + exposure lên cha để nhồi page_context.
import { useEffect, useRef, useState } from 'react';
import { Box, useTheme } from '@mui/material';
import { apiClient } from 'services/apiClient';
import { fontWeight, getResponsiveFontSize, borderRadius } from 'theme/tokens';
import { getPhaseMeta } from '../../phase/phaseMeta';
import type { PhaseDaily } from '../../phase/types';

export interface PortfolioPhase {
  label: string; // nhãn EN (UPTREND/…): đưa vào page_context cho AI
  exposureHint: string; // "%": tỷ lệ nắm giữ hệ gợi ý
}

interface Props {
  onPhase?: (p: PortfolioPhase) => void;
}

export default function PortfolioPhaseChip({ onPhase }: Props) {
  const theme = useTheme();
  const [row, setRow] = useState<PhaseDaily | null>(null);
  const onPhaseRef = useRef(onPhase); // ref → effect fetch 1 lần, không phụ thuộc callback cha
  onPhaseRef.current = onPhase;

  useEffect(() => {
    let mounted = true;
    apiClient<PhaseDaily[]>({ url: '/api/v1/sse/rest/phase_daily', method: 'GET', requireAuth: false, useCache: true })
      .then((res) => {
        const arr = res.data ?? [];
        const latest = arr.length ? arr[arr.length - 1] : null; // daily sort tăng → cuối là mới nhất
        if (!mounted || !latest) return;
        setRow(latest);
        onPhaseRef.current?.({
          label: getPhaseMeta(latest.phase_label).en,
          exposureHint: `${Math.round((latest.market_exposure ?? 0) * 100)}%`,
        });
      })
      .catch(() => undefined); // lỗi phase → chip ẩn, không phá trang
    return () => {
      mounted = false;
    };
  }, []);

  if (!row) return null;
  const meta = getPhaseMeta(row.phase_label);
  const color = meta.color(theme);
  const exposure = Math.round((row.market_exposure ?? 0) * 100);

  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        px: 1,
        py: 0.5,
        borderRadius: `${borderRadius.sm}px`,
        border: `1px solid ${color}`,
        color,
        fontSize: getResponsiveFontSize('xs'),
        fontWeight: fontWeight.semibold,
      }}
    >
      <Box component="span">{meta.glyph}</Box>
      <Box component="span">Giai đoạn: {meta.vn}</Box>
      <Box component="span" sx={{ opacity: 0.8, fontWeight: fontWeight.medium }}>· gợi ý nắm ~{exposure}%</Box>
    </Box>
  );
}

'use client';

// Lấy giai đoạn thị trường hiện tại (phiên mới nhất) để nhồi vào page_context của chế độ tư vấn
// danh mục. KHÔNG render UI — chỉ cấp dữ liệu (owner đã bỏ tag phase khỏi cột trái).
import { useEffect, useState } from 'react';
import { apiClient } from 'services/apiClient';
import { getPhaseMeta } from '../phase/phaseMeta';
import type { PhaseDaily } from '../phase/types';

export interface PortfolioPhase {
  label: string; // nhãn EN (UPTREND/…) đưa cho AI
  exposureHint: string; // "%": tỷ lệ nắm giữ hệ gợi ý
}

export function usePortfolioPhase(): PortfolioPhase | null {
  const [phase, setPhase] = useState<PortfolioPhase | null>(null);
  useEffect(() => {
    let mounted = true;
    apiClient<PhaseDaily[]>({ url: '/api/v1/sse/rest/phase_daily', method: 'GET', requireAuth: false, useCache: true })
      .then((res) => {
        const arr = res.data ?? [];
        const latest = arr.length ? arr[arr.length - 1] : null; // daily sort tăng → cuối là mới nhất
        if (!mounted || !latest) return;
        setPhase({
          label: getPhaseMeta(latest.phase_label).en,
          exposureHint: `${Math.round((latest.market_exposure ?? 0) * 100)}%`,
        });
      })
      .catch(() => undefined); // lỗi phase → bỏ qua, không phá trang
    return () => {
      mounted = false;
    };
  }, []);
  return phase;
}

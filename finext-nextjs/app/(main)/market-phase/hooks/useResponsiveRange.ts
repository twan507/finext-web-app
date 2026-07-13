'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useMediaQuery, useTheme } from '@mui/material';

/**
 * State khung thời gian có MẶC ĐỊNH khác nhau theo bề rộng màn: mobile hẹp → khung ngắn hơn
 * (nhiều phiên trên màn nhỏ → điểm/chữ bị nén, không đọc được).
 * Người dùng tự chọn khung → khoá lại, không ghi đè nữa (kể cả khi xoay ngang/đổi kích thước).
 * SSR + lần render client đầu = desktop (useMediaQuery trả false) → effect chỉnh lại ngay sau mount.
 */
export function useResponsiveRange<T>(desktop: T, mobile: T): [T, (v: T) => void] {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [range, setRange] = useState<T>(desktop);
  const picked = useRef(false);

  useEffect(() => {
    if (!picked.current) setRange(isMobile ? mobile : desktop);
  }, [isMobile, mobile, desktop]);

  const choose = useCallback((v: T) => {
    picked.current = true;
    setRange(v);
  }, []);

  return [range, choose];
}

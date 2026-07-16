'use client';

import { useEffect, useRef } from 'react';
import type { EChartsOption, EChartsType } from 'echarts';

// Client wrapper: lazy import echarts (chỉ tải khi có chart), init vào ref div, setOption(option, true),
// resize (window + ResizeObserver), dispose on unmount, re-apply khi option/mode đổi.
interface EChartProps {
  option: EChartsOption;
  height?: number;
}

export default function EChart({ option, height = 300 }: EChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<EChartsType | null>(null);
  // Giữ option mới nhất để init (async) không dùng bản cũ nếu option đổi trước khi echarts tải xong.
  const optionRef = useRef(option);
  optionRef.current = option;

  // Init + dispose lifecycle (1 lần / mount).
  useEffect(() => {
    let disposed = false;
    let ro: ResizeObserver | null = null;
    const onResize = () => instanceRef.current?.resize();

    import('echarts')
      .then((echarts) => {
        if (disposed || !containerRef.current) return;
        const inst = echarts.init(containerRef.current, undefined, { renderer: 'canvas' });
        instanceRef.current = inst;
        inst.setOption(optionRef.current, true);
        window.addEventListener('resize', onResize);
        if (typeof ResizeObserver !== 'undefined') {
          ro = new ResizeObserver(() => inst.resize());
          ro.observe(containerRef.current);
        }
      })
      .catch(() => {
        /* lazy-load echarts lỗi → giữ box rỗng, không crash /chat */
      });

    return () => {
      disposed = true;
      window.removeEventListener('resize', onResize);
      if (ro) ro.disconnect();
      instanceRef.current?.dispose();
      instanceRef.current = null;
    };
  }, []);

  // Re-apply khi option đổi (theme/mode/dữ liệu). notMerge=true → thay sạch, đúng cả khi đổi cấu trúc (grid nến).
  useEffect(() => {
    instanceRef.current?.setOption(option, true);
  }, [option]);

  return <div ref={containerRef} style={{ width: '100%', height: `${height}px` }} />;
}

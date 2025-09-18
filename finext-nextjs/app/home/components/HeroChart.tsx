'use client';
import React, { useEffect, useRef, useCallback } from 'react';
import {
  createChart,
  IChartApi,
  ColorType,
  ISeriesApi,
  UTCTimestamp,
  AreaSeries,
} from 'lightweight-charts';

type ChartDataPoint = {
  time: UTCTimestamp;
  value: number;
};

const HeroChart = () => {
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const roRef = useRef<ResizeObserver | null>(null);

  const cleanup = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (roRef.current) {
      roRef.current.disconnect();
      roRef.current = null;
    }
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }
    seriesRef.current = null;
  }, []);

  useEffect(() => {
    if (!chartContainerRef.current || chartRef.current) return;

    let isDestroyed = false;

    try {
      const chart = createChart(chartContainerRef.current, {
        width: chartContainerRef.current.clientWidth,
        height: 280,
        layout: {
          background: { type: ColorType.Solid, color: 'transparent' },
          textColor: 'rgba(255, 255, 255, 0.9)',
        },
        grid: {
          vertLines: { visible: false },
          horzLines: { visible: false },
        },
        rightPriceScale: { visible: false },
        timeScale: {
          visible: false,            // vẫn có thể fit/scroll khi ẩn
          rightOffset: 2,            // chừa khoảng trống bên phải
          fixLeftEdge: false,
          fixRightEdge: false,
        },
        handleScroll: false,
        handleScale: false,
      });

      if (isDestroyed) {
        chart.remove();
        return;
      }
      chartRef.current = chart;

      // Tạo Area series (v5)
      const areaSeries = chart.addSeries(AreaSeries, {
        topColor: 'rgba(139, 92, 246, 0.40)',
        bottomColor: 'rgba(139, 92, 246, 0.05)',
        lineColor: 'rgba(139, 92, 246, 1)',
        lineWidth: 2,
      });
      seriesRef.current = areaSeries;

      // Dữ liệu ban đầu
      const initialData: ChartDataPoint[] = [];
      const now = Math.floor(Date.now() / 1000);
      for (let i = 0; i < 30; i++) {
        initialData.push({
          time: (now - (29 - i) * 60) as UTCTimestamp, // mỗi điểm cách 60s
          value: Math.random() * 5 + 165,
        });
      }

      if (isDestroyed) return;

      areaSeries.setData(initialData);

      // 🔑 Hiển thị FULL ngay khi mở
      chart.timeScale().fitContent();

      // Cập nhật realtime
      intervalRef.current = setInterval(() => {
        if (isDestroyed || !seriesRef.current || !initialData.length) return;

        const last = initialData[initialData.length - 1];
        const nextTime = (last.time + 60) as UTCTimestamp;
        const change = (Math.random() - 0.5) * 1.5;
        const nextValue = Math.max(160, Math.min(175, last.value + change));
        const nextPoint = { time: nextTime, value: nextValue };

        seriesRef.current.update(nextPoint);
        initialData.push(nextPoint);

        // 🔑 Luôn bám mép phải khi có dữ liệu mới
        chart.timeScale().scrollToRealTime();
      }, 1500);

      // Resize mượt với ResizeObserver
      roRef.current = new ResizeObserver(entries => {
        if (isDestroyed || !chartRef.current) return;
        for (const entry of entries) {
          const w = Math.floor(entry.contentRect.width);
          const h = 280;
          if (w > 0) {
            chartRef.current.resize(w, h);
            // Sau resize, đảm bảo viewport không lệch
            chart.timeScale().scrollToRealTime();
          }
        }
      });
      roRef.current.observe(chartContainerRef.current);

      return () => {
        isDestroyed = true;
        cleanup();
      };
    } catch (error) {
      console.error('Error initializing chart:', error);
      cleanup();
    }
  }, [cleanup]);

  return <div ref={chartContainerRef} style={{ width: '100%', height: '280px' }} />;
};

export default HeroChart;

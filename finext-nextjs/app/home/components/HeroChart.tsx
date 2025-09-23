'use client';
import React, { useEffect, useRef, useCallback } from 'react';
import {
  createChart,
  IChartApi,
  ColorType,
  ISeriesApi,
  UTCTimestamp,
  Time,
  AreaSeries, // << [SỬA LỖI]: Import lại 'AreaSeries'
} from 'lightweight-charts';

// --- Advanced Stock Price Generator ---
interface StockState {
  price: number;
  trend: number; // -1 to 1, where -1 is strong downtrend, 1 is strong uptrend
  volatility: number; // Current volatility level
  momentum: number; // Price momentum
  volume: number; // Trading volume multiplier
}

const generateInitialData = (points = 40) => {
  const data: { time: Time; value: number }[] = [];
  const now = Math.floor(Date.now() / 1000);
  let currentTime = (now - points) as UTCTimestamp;

  // Initial state
  const state: StockState = {
    price: 160 + (Math.random() - 0.5) * 20, // Starting price with some randomness
    trend: 0.3, // Slight upward bias
    volatility: 0.02, // Base volatility (2%)
    momentum: 0,
    volume: 1.0
  };

  // Support and resistance levels
  const supportLevel = state.price * 0.95;
  const resistanceLevel = state.price * 1.15;

  for (let i = 0; i < points; i++) {
    // Update trend with some persistence and mean reversion
    const trendChange = (Math.random() - 0.5) * 0.1;
    state.trend = Math.max(-0.8, Math.min(0.8, state.trend * 0.95 + trendChange));

    // Volatility clustering - high vol periods followed by high vol
    const volChange = (Math.random() - 0.5) * 0.005;
    state.volatility = Math.max(0.01, Math.min(0.08, state.volatility * 0.9 + Math.abs(volChange) + 0.005));

    // Volume affects volatility
    state.volume = Math.max(0.5, Math.min(3.0, state.volume * 0.8 + Math.random() * 0.5 + 0.5));
    const volumeVolatility = state.volatility * (0.5 + state.volume * 0.5);

    // Generate price change with multiple components
    const trendComponent = state.trend * 0.001; // Trend influence
    const randomComponent = (Math.random() - 0.5) * volumeVolatility * 2; // Random walk
    const momentumComponent = state.momentum * 0.3; // Momentum persistence

    // Mean reversion near support/resistance
    let meanReversionComponent = 0;
    if (state.price < supportLevel) {
      meanReversionComponent = (supportLevel - state.price) / state.price * 0.02; // Bounce off support
    } else if (state.price > resistanceLevel) {
      meanReversionComponent = (resistanceLevel - state.price) / state.price * 0.02; // Reject at resistance
    }

    // Combine all components
    const priceChange = trendComponent + randomComponent + momentumComponent + meanReversionComponent;

    // Update momentum (creates autocorrelation in returns)
    state.momentum = state.momentum * 0.7 + priceChange * 0.3;

    // Apply price change
    state.price *= (1 + priceChange);

    // Ensure price doesn't go negative or too extreme
    state.price = Math.max(state.price, 50);
    state.price = Math.min(state.price, 300);

    data.push({
      time: currentTime as Time,
      value: parseFloat(state.price.toFixed(2)),
    });

    currentTime = (currentTime + 1) as UTCTimestamp;
  }

  return data;
};

// --- Component chính ---
const HeroChart = () => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<{
    chart: IChartApi | null;
    series: ISeriesApi<'Area'> | null;
  }>({ chart: null, series: null });
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const cleanup = useCallback(() => {
    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect();
    }
    if (chartRef.current.chart) {
      chartRef.current.chart.remove();
    }
    chartRef.current = { chart: null, series: null };
  }, []);

  useEffect(() => {
    if (!chartContainerRef.current) {
      return;
    }

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 280,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: 'rgba(255, 255, 255, 0.92)',
      },
      grid: {
        vertLines: { visible: true, color: 'rgba(255, 255, 255, 0.10)' },
        horzLines: { visible: true, color: 'rgba(255, 255, 255, 0.10)' },
      },
      rightPriceScale: { visible: false },
      timeScale: { visible: false },
      handleScroll: false,
      handleScale: false,
    });

    // << [SỬA LỖI]: Sử dụng lại cú pháp `addSeries` chuẩn của bạn
    const areaSeries = chart.addSeries(AreaSeries, {
      topColor: 'rgba(168, 85, 247, 0.55)',
      bottomColor: 'rgba(169, 85, 247, 0)',
      lineColor: 'rgba(233, 213, 255, 1)',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    chartRef.current = { chart, series: areaSeries };

    const initialData = generateInitialData(40);
    areaSeries.setData(initialData);
    chart.timeScale().fitContent();

    let lastDataPoint = initialData[initialData.length - 1];

    // State for real-time updates
    let realtimeState: StockState = {
      price: lastDataPoint.value,
      trend: 0.2, // Slight upward bias for demo
      volatility: 0.025,
      momentum: 0,
      volume: 1.0
    };

    // Support and resistance levels for real-time
    const currentSupportLevel = lastDataPoint.value * 0.98;
    const currentResistanceLevel = lastDataPoint.value * 1.05;

    const intervalId = setInterval(() => {
      const { series } = chartRef.current;
      if (!series || !lastDataPoint) return;

      const nextTime = (lastDataPoint.time as number) + 1;

      // Update real-time state similar to initial data generation
      const trendChange = (Math.random() - 0.5) * 0.15;
      realtimeState.trend = Math.max(-0.6, Math.min(0.6, realtimeState.trend * 0.9 + trendChange));

      // Volatility clustering
      const volChange = (Math.random() - 0.5) * 0.008;
      realtimeState.volatility = Math.max(0.015, Math.min(0.06, realtimeState.volatility * 0.85 + Math.abs(volChange) + 0.008));

      // Volume simulation
      realtimeState.volume = Math.max(0.7, Math.min(2.5, realtimeState.volume * 0.8 + Math.random() * 0.6 + 0.4));
      const volumeVolatility = realtimeState.volatility * (0.6 + realtimeState.volume * 0.4);

      // Generate price change
      const trendComponent = realtimeState.trend * 0.0015;
      const randomComponent = (Math.random() - 0.5) * volumeVolatility * 2.5;
      const momentumComponent = realtimeState.momentum * 0.4;

      // Mean reversion
      let meanReversionComponent = 0;
      if (realtimeState.price < currentSupportLevel) {
        meanReversionComponent = (currentSupportLevel - realtimeState.price) / realtimeState.price * 0.025;
      } else if (realtimeState.price > currentResistanceLevel) {
        meanReversionComponent = (currentResistanceLevel - realtimeState.price) / realtimeState.price * 0.025;
      }

      const priceChange = trendComponent + randomComponent + momentumComponent + meanReversionComponent;

      // Update momentum
      realtimeState.momentum = realtimeState.momentum * 0.6 + priceChange * 0.4;

      // Apply price change
      realtimeState.price *= (1 + priceChange);
      realtimeState.price = Math.max(realtimeState.price, 50);
      realtimeState.price = Math.min(realtimeState.price, 300);

      const nextPoint = {
        time: nextTime as UTCTimestamp,
        value: parseFloat(realtimeState.price.toFixed(2)),
      };

      series.update(nextPoint);
      lastDataPoint = nextPoint;
      chart.timeScale().scrollToRealTime();
    }, 1000);

    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        chart.resize(width, 300);
      }
    });
    resizeObserver.observe(chartContainerRef.current);
    resizeObserverRef.current = resizeObserver;

    return () => {
      clearInterval(intervalId);
      cleanup();
    };
  }, [cleanup]);

  return (
    <div
      ref={chartContainerRef}
      style={{
        width: '100%',
        height: '300px',
        filter: 'drop-shadow(0 0 10px rgba(233, 213, 255, 0.35))',
        position: 'relative',
      }}
    />
  );
};

export default HeroChart;
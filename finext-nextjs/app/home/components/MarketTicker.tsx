"use client";
import React, { useEffect, useRef } from 'react';

const MarketTicker = () => {
  const tickerTapeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const tickerTape = tickerTapeRef.current;
    if (tickerTape) {
      const tickerWidth = tickerTape.offsetWidth;
      const container = tickerTape.parentElement;
      if (container) {
        const containerWidth = container.offsetWidth;
        if (tickerWidth > containerWidth) {
          const duration = tickerWidth / 50; // Adjust speed: higher divisor = slower
          tickerTape.style.animationDuration = `${duration}s`;
        } else {
            // If content is smaller than container, duplicate it to ensure scrolling effect
            // This part might need refinement based on actual behavior desired
            let content = tickerTape.innerHTML;
            let repeatCount = Math.ceil(containerWidth / tickerWidth) + 1;
            if (repeatCount > 1) {
                tickerTape.innerHTML = Array(repeatCount).fill(content).join('');
                const newTickerWidth = tickerTape.offsetWidth;
                const duration = newTickerWidth / 50;
                tickerTape.style.animationDuration = `${duration}s`;
            }

        }
      }
    }
  }, []);

  return (
    <div className="market-ticker-bar">
      <div className="ticker-tape" ref={tickerTapeRef}>
        <span className="market-update-label">MARKET UPDATE:</span>
        <span>SPY <span className="stock-up">+1.24%</span></span>
        <span>AAPL <span className="stock-up">+2.15%</span></span>
        <span>MSFT <span className="stock-up">+0.87%</span></span>
        <span>TSLA <span className="stock-down">-0.63%</span></span>
        <span>BTC <span className="stock-up">+3.56%</span></span>
        <span>ETH <span className="stock-up">+2.44%</span></span>
        <span>OIL <span className="stock-down">-1.21%</span></span>
        <span>GOLD <span className="stock-down">-0.33%</span></span>
        <span>VIX <span className="stock-down">-5.13%</span></span>
        {/* Duplicate for smooth infinite scroll if content is short, handled by JS logic more robustly */}
        <span className="market-update-label">MARKET UPDATE:</span>
        <span>SPY <span className="stock-up">+1.24%</span></span>
        <span>AAPL <span className="stock-up">+2.15%</span></span>
        <span>MSFT <span className="stock-up">+0.87%</span></span>
        <span>TSLA <span className="stock-down">-0.63%</span></span>
        <span>BTC <span className="stock-up">+3.56%</span></span>
        <span>ETH <span className="stock-up">+2.44%</span></span>
        <span>OIL <span className="stock-down">-1.21%</span></span>
        <span>GOLD <span className="stock-down">-0.33%</span></span>
        <span>VIX <span className="stock-down">-5.13%</span></span>
      </div>
    </div>
  );
};

export default MarketTicker;
'use client';
import React from 'react';
import HeroChart from './HeroChart';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';

const HeroSection = () => {
  return (
    <section className="gradient-bg">
      <div className="hero-section-container">
        <div className="hero-content-wrapper">
          <div className="hero-text-column">
            <h1 className="hero-main-title">
              <span className="title-block">Finext:</span>
              <span className="title-block title-highlight">Market Intelligence Redefined</span>
            </h1>
            <p className="hero-sub-text">
              AI-driven insights and predictive analytics to transform your trading strategy and maximize returns.
            </p>
            <p className="hero-detailed-text">
              Finext combines cutting-edge artificial intelligence with comprehensive market data to give you an edge in today&apos;s volatile markets. Our proprietary algorithms analyze patterns across global markets, enabling smarter investment decisions.
            </p>
            <div className="hero-buttons-group">
              <button className="hero-button hero-button-primary btn-glow">
                <ShowChartIcon sx={{ mr: 1 }} /> Explore Platform
              </button>
              <button className="hero-button hero-button-secondary">
                <PlayCircleOutlineIcon sx={{ mr: 1 }} /> Watch Demo
              </button>
            </div>
          </div>
          <div className="hero-chart-column">
            <div className="hero-chart-visual floating purple-glow">
              <HeroChart />
              <div className="hero-chart-info-text">
                <span>Prev Close: $168.24</span>
                <span>Last Price: $170.42 <span className="stock-up">+1.29%</span></span>
              </div>
            </div>
            <div className="hero-blur-deco-1"></div>
            <div className="hero-blur-deco-2"></div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
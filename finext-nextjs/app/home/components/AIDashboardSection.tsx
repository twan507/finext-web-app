"use client"; // Mark as client component if it handles scroll animations for its children
import React, { useEffect, useRef } from 'react';
import PortfolioSummaryCard from './PortfolioSummaryCard';
import AssetAllocationChart from './AssetAllocationChart';
import PerformanceChart from './PerformanceChart';
import AIRecommendedAssetsTable from './AIRecommendedAssetsTable';

const FadeInWrapper = ({ children }: { children: React.ReactNode }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          element.classList.add('visible');
          observer.unobserve(element); // Optional: stop observing after visible
        }
      },
      {
        root: null,
        rootMargin: '0px',
        threshold: 0.1 // Trigger when 10% of the element is visible
      }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return <div ref={ref} className="fade-in">{children}</div>;
}


const AIDashboardSection = () => {
  return (
    <section id="dashboard" className="ai-dashboard-section">
      <div className="section-container">
        <FadeInWrapper>
          <div className="section-header">
            <h2 className="section-main-title">AI Predictive Dashboard</h2>
            <div className="title-decorator-line"></div>
            <p className="section-subtitle">
              Real-time market intelligence with predictive analytics to maximize your returns. Our comprehensive dashboard provides an overview of your entire portfolio while predicting future market movements with industry-leading accuracy.
            </p>
          </div>
        </FadeInWrapper>

        <div className="dashboard-layout-grid">
          <FadeInWrapper><PortfolioSummaryCard /></FadeInWrapper>
          
          <FadeInWrapper>
            <div className="dashboard-card card-hover asset-allocation-card">
              <div className="dashboard-card-header">
                <h3 className="dashboard-card-title">Asset Allocation</h3>
                <div className="card-header-icon">
                  <i className="fas fa-sync-alt cursor-pointer"></i>
                </div>
              </div>
              <AssetAllocationChart />
              <div className="allocation-legend">
                <div className="allocation-legend-item legend-tech">
                  <div className="legend-color-indicator legend-tech-color"></div>
                  <div className="legend-item-label">Tech</div>
                </div>
                <div className="allocation-legend-item legend-finance">
                  <div className="legend-color-indicator legend-finance-color"></div>
                  <div className="legend-item-label">Finance</div>
                </div>
                <div className="allocation-legend-item legend-crypto">
                  <div className="legend-color-indicator legend-crypto-color"></div>
                  <div className="legend-item-label">Crypto</div>
                </div>
                <div className="allocation-legend-item legend-other">
                  <div className="legend-color-indicator legend-other-color"></div>
                  <div className="legend-item-label">Other</div>
                </div>
              </div>
              <div className="card-footer-note">
                <i className="fas fa-lightbulb"></i>
                AI recommendation: Increase tech allocation by 5% for higher growth potential
              </div>
            </div>
          </FadeInWrapper>

          <FadeInWrapper>
            <div className="dashboard-card card-hover performance-card">
              <div className="dashboard-card-header">
                <h3 className="dashboard-card-title">Performance</h3>
                <div>
                  <select className="controls-dropdown" defaultValue="YTD">
                    <option value="1M">1M</option>
                    <option value="3M">3M</option>
                    <option value="6M">6M</option>
                    <option value="YTD">YTD</option>
                    <option value="1Y">1Y</option>
                  </select>
                </div>
              </div>
              <PerformanceChart />
              <div className="performance-legend-container">
                <div className="performance-legend-item">
                  <div className="item-label">
                    <i className="fas fa-circle"></i>
                    <span>Your Portfolio</span>
                  </div>
                  <div className="item-value-portfolio">+24.6%</div>
                </div>
                <div className="performance-legend-item">
                  <div className="item-label sp500">
                    <i className="fas fa-circle"></i>
                    <span>S&amp;P 500</span>
                  </div>
                  <div className="item-value-sp500">+18.2%</div>
                </div>
              </div>
              <div className="card-footer-note">
                <i className="fas fa-trophy"></i>
                Your portfolio has outperformed the benchmark by 6.4% YTD
              </div>
            </div>
          </FadeInWrapper>
        </div>
        
        <FadeInWrapper>
          <AIRecommendedAssetsTable />
        </FadeInWrapper>
      </div>
    </section>
  );
};

export default AIDashboardSection;
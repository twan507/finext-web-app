'use client';
import React from 'react';

const FadeInWrapper = ({ children }: { children: React.ReactNode }) => {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        element.classList.add('visible');
        observer.unobserve(element);
      }
    }, { threshold: 0.1 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} className="fade-in">{children}</div>;
};

const FeatureCard = ({ icon, title, description, children, customClass }: { icon: string; title: string; description: string; children?: React.ReactNode, customClass?: string }) => (
  <FadeInWrapper>
    <div className={`feature-item-card card-hover ${customClass || ''}`}>
      <div className="card-icon-area">
        <i className={icon}></i>
      </div>
      <h3 className="card-main-title">{title}</h3>
      <p className="card-description-text">{description}</p>
      {children}
    </div>
  </FadeInWrapper>
);


const FeaturesSection = () => {
  return (
    <section id="features" className="features-section">
      <div className="section-container">
        <FadeInWrapper>
            <div className="section-header">
                <h2 className="section-main-title">Advanced Features</h2>
                <div className="title-decorator-line"></div>
                <p className="section-subtitle">
                    Empower your trading strategy with cutting-edge financial technology
                </p>
            </div>
        </FadeInWrapper>
        <div className="features-grid-layout">
          <FeatureCard
            icon="fas fa-brain"
            title="AI Forecasting"
            description="Proprietary machine learning models predict price movements with 87.4% accuracy. Our multi-modal AI approach combines technical indicators, fundamental analysis, sentiment scoring, and macroeconomic data to generate highly reliable forecasts."
          >
            <div className="stat-visual-container">
              <div className="stat-labels">
                <span>Accuracy</span>
                <span>87.4%</span>
              </div>
              <div className="stat-progress-bar">
                <div className="stat-progress-fill" style={{ width: "87.4%" }}></div>
              </div>
            </div>
          </FeatureCard>

          <FeatureCard
            icon="fas fa-bolt"
            title="Real-Time Analytics"
            description="Our ultra-low latency platform delivers market updates with sub-millisecond precision across 64 global exchanges. Real-time portfolio stress testing alerts you to potential risks before they impact your investments."
          >
            <div className="latency-uptime-stats">
              <div className="stat-block">
                <div className="stat-block-value">320ms</div>
                <div className="stat-block-label">Avg. Latency</div>
              </div>
              <div className="stat-block">
                <div className="stat-block-value">99.99%</div>
                <div className="stat-block-label">Uptime</div>
              </div>
            </div>
          </FeatureCard>

          <FeatureCard
            icon="fas fa-project-diagram" // Original was chart-network, project-diagram is more common for connections
            title="Market Correlation"
            description="Our platform uncovers hidden relationships between assets to optimize your portfolio strategy. Finext's correlation matrix tracks over 50,000 asset pairs across multiple asset classes, detecting emerging relationships before they become mainstream knowledge."
          >
            <div className="correlation-stats-display">
              <div className="correlation-item-block">
                <div className="correlation-value positive">0.87</div>
                <div className="correlation-asset-pair">AAPL/MSFT</div>
              </div>
              <div className="correlation-item-block">
                <div className="correlation-value negative">-0.63</div>
                <div className="correlation-asset-pair">GOLD/BTC</div>
              </div>
              <div className="correlation-item-block">
                <div className="correlation-value neutral">0.42</div> {/* Assuming neutral is yellow from vars */}
                <div className="correlation-asset-pair">TSLA/NVDA</div>
              </div>
            </div>
          </FeatureCard>

          <FeatureCard
            icon="fas fa-shield-alt"
            title="Risk Management"
            description="Advanced scenario modeling simulates market shocks to quantify potential portfolio impacts. Our conditional stop-loss algorithm dynamically adjusts to market volatility to better protect your assets during turbulent periods."
          >
             <div className="stat-visual-container risk-display">
                <div className="stat-labels">
                    <span className="portfolio-risk-text">Portfolio Risk</span>
                    <span className="portfolio-risk-value">Medium</span>
                </div>
                <div className="stat-progress-bar">
                    <div className="stat-progress-fill yellow" style={{width: "45%"}}></div>
                </div>
            </div>
          </FeatureCard>

          <FeatureCard
            icon="fas fa-robot"
            title="Automated Trading"
            description="Finext's strategy builder requires no coding skills while offering the flexibility for sophisticated algorithmic implementations. Our cloud-based backtesting engine can simulate 10 years of market history in under 30 seconds for accurate strategy validation."
          >
            <div className="automated-trading-metrics">
                <div className="trading-metric-item">
                    <div className="metric-value">+23.7%</div>
                    <div className="metric-label">Avg. Return</div>
                </div>
                <div className="trading-metric-item">
                    <div className="metric-value">76%</div>
                    <div className="metric-label">Win Rate</div>
                </div>
            </div>
          </FeatureCard>

          <FeatureCard
            icon="fas fa-graduation-cap"
            title="Educational Resources"
            description="Our comprehensive learning center features daily live webinars, interactive tutorials, and real-time market analysis. Case studies deconstruct successful trades while strategy guides translate complex market concepts into actionable insights."
          >
            <div className="education-tags-list">
                <span className="education-tag-item">Webinars</span>
                <span className="education-tag-item">Tutorials</span>
                <span className="education-tag-item">Case Studies</span>
                <span className="education-tag-item">Strategy Guides</span>
            </div>
          </FeatureCard>
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
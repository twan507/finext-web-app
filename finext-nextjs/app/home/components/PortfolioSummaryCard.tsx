'use client';
import React from 'react';

const PortfolioSummaryCard = () => {
  return (
    <div className="dashboard-card card-hover">
      <div className="dashboard-card-header">
        <h3 className="dashboard-card-title">Portfolio Summary</h3>
        <div className="dashboard-card-badge">Live</div>
      </div>
      <div className="summary-data-grid">
        <div className="data-cell">
          <div className="data-cell-label">Total Value</div>
          <div className="data-cell-value">$124,563.82</div>
          <div className="data-cell-change">
            <span>+3.2%</span>
            <i className="fas fa-arrow-up"></i>
          </div>
        </div>
        <div className="data-cell">
          <div className="data-cell-label">Today&apos;s Gain</div>
          <div className="data-cell-value">$1,824.16</div>
          <div className="data-cell-change">
            <span>+1.45%</span>
            <i className="fas fa-arrow-up"></i>
          </div>
        </div>
        <div className="data-cell">
          <div className="data-cell-label">Risk Level</div>
          <div className="data-cell-value">Medium</div>
          <div className="risk-status-indicator">
            <div className="pulse"></div>
            <span className="risk-status-text">Optimal</span>
          </div>
        </div>
        <div className="data-cell">
          <div className="data-cell-label">AI Confidence</div>
          <div className="data-cell-value">87%</div>
          <div className="confidence-progress-bar">
            <div className="confidence-progress-fill" style={{ width: '87%' }}></div>
          </div>
        </div>
      </div>
      <div className="card-footer-note">
        <i className="fas fa-info-circle"></i>
        Portfolio optimized based on current market conditions and AI predictions
      </div>
    </div>
  );
};

export default PortfolioSummaryCard;
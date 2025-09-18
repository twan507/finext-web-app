'use client';
import React from 'react';
import FinextLogo from './FinextLogo';

const Footer = () => {
  return (
    <footer className="site-footer">
      <div className="footer-content-area">
        <div className="footer-main-grid">
          <div className="company-info-column">
            <div className="footer-logo-group">
              <FinextLogo className="footer-logo-svg" />
              <span className="footer-brand-name">Finext</span>
            </div>
            <p className="company-tagline">
              Advanced market intelligence and predictive analytics for the modern investor.
              Finext is transforming how investors of all levels approach financial markets
              with AI-powered insights.
            </p>
            <div className="social-media-links">
              <a href="#"><i className="fab fa-twitter"></i></a>
              <a href="#"><i className="fab fa-linkedin"></i></a>
              <a href="#"><i className="fab fa-github"></i></a>
              <a href="#"><i className="fab fa-discord"></i></a>
            </div>
          </div>
          <div className="footer-nav-column">
            <h3 className="column-heading">Solutions</h3>
            <div className="footer-links-listing">
              <a href="#" className="footer-link">Forex Trading</a>
              <a href="#" className="footer-link">Stock Analysis</a>
              <a href="#" className="footer-link">Crypto Insights</a>
              <a href="#" className="footer-link">Portfolio Management</a>
              <a href="#" className="footer-link">Algorithmic Trading</a>
            </div>
          </div>
          <div className="footer-nav-column">
            <h3 className="column-heading">Company</h3>
            <div className="footer-links-listing">
              <a href="#" className="footer-link">About Us</a>
              <a href="#" className="footer-link">Careers</a>
              <a href="#" className="footer-link">Blog</a>
              <a href="#" className="footer-link">Partners</a>
              <a href="#" className="footer-link">Research</a>
            </div>
          </div>
          <div className="footer-nav-column">
             {/* This column can be used for other links if needed, or left empty for spacing on larger screens */}
          </div>
        </div>
        <div className="footer-bottom-bar">
          <p className="copyright-notice">
            &copy; 2024 Finext, Inc. All rights reserved.
          </p>
          <div className="legal-links-group">
            <a href="#" className="legal-link">Privacy</a>
            <a href="#" className="legal-link">Terms</a>
            <a href="#" className="legal-link">Security</a>
            <a href="#" className="legal-link">Disclosures</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
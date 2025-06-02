'use client';
import React from 'react';
import Head from 'next/head'; // Sử dụng cho các thẻ <link> và <script> trong <head>
import Link from 'next/link'; // Cho các link nội bộ
import Script from 'next/script'; // Cho các script ở cuối body
import FinextLogo from './components/FinextLogo';
import './finext-home.css'; // Import CSS tùy chỉnh cho route này

export default function FinextHomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Head>
        {/* Font Awesome CDN - Font Awesome 6.4.0 */}
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
          integrity="sha512-iecdLmaskl7CVkqkXNQ/ZH/XLlvWZOJyj7Yy7tcenmpD1ypASozpmT/E0iPtmFIB46ZmdtAc9eNBvH0H/ZpiBw=="
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
        />
         {/* Inter Font (example if you want to host it or use Google Fonts provider) */}
         {/* <link rel="preconnect" href="https://fonts.googleapis.com" /> */}
         {/* <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" /> */}
         {/* <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" /> */}
      </Head>

      <nav className="main-nav">
        <div className="nav-container">
            <div className="nav-inner-flex">
                <div className="logo-group">
                    <div className="logo-icon-wrapper">
                        <FinextLogo className="logo-svg" />
                        <span className="logo-text">Finext</span>
                    </div>
                </div>
                <div className="nav-links-wrapper">
                    <Link href="#features" className="nav-link">Features</Link>
                    <Link href="#dashboard" className="nav-link">Dashboard</Link>
                    <Link href="#mission" className="nav-link">Mission</Link>
                    <Link href="#reviews" className="nav-link">Reviews</Link>
                    <Link href="#contact" className="nav-link">Contact</Link>
                </div>
                <div className="nav-actions-group">
                    <button className="get-started-btn btn-glow">
                        Get Started
                    </button>
                </div>
            </div>
        </div>
      </nav>

      {children} {/* Nội dung từ page.tsx sẽ được render ở đây */}

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
                <div className="footer-nav-column"> {/* One column was missing in original HTML grid for md, this makes it 4 */}
                    <h3 className="column-heading">Company</h3>
                    <div className="footer-links-listing">
                        <a href="#" className="footer-link">About Us</a>
                        <a href="#" className="footer-link">Careers</a>
                        <a href="#" className="footer-link">Blog</a>
                        <a href="#" className="footer-link">Partners</a>
                        <a href="#" className="footer-link">Research</a>
                    </div>
                </div>
                {/* Added one more column to fill the md:grid-cols-4, if needed, or adjust md:grid-cols-3 and col-span */}
                 <div className="footer-nav-column">
                    <h3 className="column-heading">Legal</h3>
                     <div className="footer-links-listing">
                        <Link href="#" className="footer-link">Privacy Policy</Link>
                        <Link href="#" className="footer-link">Terms of Service</Link>
                        <Link href="#" className="footer-link">Cookie Policy</Link>
                        <Link href="#" className="footer-link">Disclosures</Link>
                    </div>
                </div>
            </div>
            <div className="footer-bottom-bar">
                <p className="copyright-notice">
                    &copy; {new Date().getFullYear()} Finext, Inc. All rights reserved.
                </p>
                <div className="legal-links-group">
                    <Link href="#" className="legal-link">Privacy</Link>
                    <Link href="#" className="legal-link">Terms</Link>
                    <Link href="#" className="legal-link">Security</Link>
                    <Link href="#" className="legal-link">Disclosures</Link>
                </div>
            </div>
        </div>
      </footer>
    </>
  );
}
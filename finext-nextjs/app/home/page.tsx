import React from 'react';
import Head from 'next/head';
import Script from 'next/script';

// Import CSS for home page components
import './finext-home.css'; 

// Import các component section
import HeroSection from './components/HeroSection';
import AIDashboardSection from './components/AIDashboardSection';
import MissionSection from './components/MissionSection';
import FeaturesSection from './components/FeaturesSection';
import CommunityReviewsSection from './components/CommunityReviewsSection';
import ContactSection from './components/ContactSection';
import Footer from './components/Footer';

export default function FinextHomePage() {
  return (
    <>
      <Head>
        <title>Finext - Market Insights & Predictive Analytics</title>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
      </Head>
      
      {/* Chart.js script is crucial for charts to work */}
      <Script src="https://cdn.jsdelivr.net/npm/chart.js" strategy="afterInteractive" />

      <div style={{
        overflow: 'hidden' 
      }}>
        <main>
          <HeroSection />
          <AIDashboardSection />
          <MissionSection />
          <FeaturesSection />
          <CommunityReviewsSection />
          <ContactSection />
        </main>
        <Footer />
      </div>
    </>
  );
}
import React from 'react';

// Import các component section
import MarketTicker from './components/MarketTicker';
import HeroSection from './components/HeroSection';
import AIDashboardSection from './components/AIDashboardSection';
import MissionSection from './components/MissionSection';
import FeaturesSection from './components/FeaturesSection';
import CommunityReviewsSection from './components/CommunityReviewsSection';
import ContactSection from './components/ContactSection';

// Các script ở cuối body HTML sẽ được xử lý trong các component Client tương ứng
// hoặc được load thông qua <Script> trong layout.tsx.

export default function FinextHomePage() {
  return (
    <>
      <MarketTicker />
      <HeroSection />
      <AIDashboardSection />
      <MissionSection />
      <FeaturesSection />
      <CommunityReviewsSection />
      <ContactSection />
    </>
  );
}
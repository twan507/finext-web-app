'use client';
import React from 'react';
import Image from 'next/image'; // Using Next/Image for optimization

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

const ReviewCard = ({ imgSrc, altText, name, role, quote, joinDate }: { imgSrc: string; altText: string; name: string; role: string; quote: string; joinDate: string; }) => (
 <FadeInWrapper>
    <div className="review-item-card card-hover">
        <div className="reviewer-profile-area">
            <div className="reviewer-avatar-wrapper">
                <Image className="reviewer-avatar-img" src={imgSrc} alt={altText} width={64} height={64} style={{objectFit: 'cover'}} />
            </div>
            <div className="reviewer-info">
                <h3 className="reviewer-name">{name}</h3>
                <div className="reviewer-role">{role}</div>
                <div className="star-rating">
                    <i className="fas fa-star"></i><i className="fas fa-star"></i><i className="fas fa-star"></i><i className="fas fa-star"></i><i className="fas fa-star"></i> {/* Adjust stars dynamically if needed */}
                </div>
            </div>
        </div>
        <p className="review-quote-text">&quot;{quote}&quot;</p>
        <div className="review-join-date">
            <i className="fas fa-clock"></i> {joinDate}
        </div>
    </div>
 </FadeInWrapper>
);

const CommunityReviewsSection = () => {
  const reviews = [
    { imgSrc: "https://images.unsplash.com/photo-1560250097-0b93528c311a?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=80&q=80", altText: "Sarah Johnson", name: "Sarah Johnson", role: "Professional Trader • 8 years experience", quote: "As a professional trader, I've tested every analytics platform on the market. Finext's predictive accuracy is unmatched. Their AI predicted the April market dip with 96% accuracy, allowing me to reposition my portfolio and actually profit during the downturn.", joinDate: "Joined 14 months ago" },
    { imgSrc: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=80&q=80", altText: "Michael Chen", name: "Michael Chen", role: "Hedge Fund Manager", quote: "We've integrated Finext across our entire fund management team. The correlation analysis and risk management tools have reduced our portfolio volatility by 22% while increasing returns. The institutional-grade API was simple to integrate with our existing systems.", joinDate: "Institutional user since 2022" },
    { imgSrc: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=80&q=80", altText: "Alex Rivera", name: "Alex Rivera", role: "Part-time Investor", quote: "I work full-time as an engineer and invest on the side. Before Finext, I was overwhelmed trying to analyze markets. Now the AI highlights the best opportunities for me. My portfolio is up 35% in 6 months with just 2-3 hours a week. The educational resources are phenomenal for continuous learning.", joinDate: "Member for 9 months" },
  ];

  return (
    <section id="reviews" className="community-reviews-section">
      <div className="section-container">
        <FadeInWrapper>
            <div className="section-header">
                <h2 className="section-main-title">Trusted by the Trading Community</h2>
                <div className="title-decorator-line"></div>
                <p className="section-subtitle">
                    Join thousands of traders who have transformed their strategies with Finext
                </p>
            </div>
        </FadeInWrapper>
        <div className="community-reviews-grid">
          {reviews.map(review => <ReviewCard key={review.name} {...review} />)}
        </div>
        <FadeInWrapper>
            <div className="community-stats-overview">
                <div className="community-stats-card">
                    <div className="stats-card-header-flex">
                        <div>
                            <h3 className="stats-card-main-title">Community Statistics</h3>
                            <div className="stats-card-title-underline"></div>
                        </div>
                        <div className="live-data-chip">Live Data</div>
                    </div>
                    <div className="community-stats-grid">
                        <div className="stat-data-point">
                            <div className="stat-data-value">18,742</div>
                            <div className="stat-data-label">Active Users</div>
                        </div>
                        <div className="stat-data-point">
                            <div className="stat-data-value highlight">+24.7%</div>
                            <div className="stat-data-label">Avg. Annual Returns</div>
                        </div>
                        <div className="stat-data-point">
                            <div className="stat-data-value">94%</div>
                            <div className="stat-data-label">Recommend Rate</div>
                        </div>
                        <div className="stat-data-point">
                            <div className="stat-data-value">4.8/5</div>
                            <div className="stat-data-label">Avg. Rating</div>
                        </div>
                    </div>
                </div>
            </div>
        </FadeInWrapper>
      </div>
    </section>
  );
};

export default CommunityReviewsSection;
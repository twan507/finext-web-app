'use client';
import React from 'react';

const FadeInWrapper = ({ children }: { children: React.ReactNode }) => {
  // Giả sử FadeInWrapper được định nghĩa ở đâu đó hoặc bạn copy từ AIDashboardSection.tsx
  // Hoặc, nếu toàn bộ section fade-in một lần, bọc ngoài cùng.
  // "use client"; // Chỉ cần nếu FadeInWrapper là client component và được định nghĩa ở đây.
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


const MissionSection = () => {
  const missions = [
    { icon: "fas fa-unlock-alt", title: "Accessible Intelligence", text: "We transform complex financial data into actionable insights accessible to investors at all levels, without requiring financial expertise." },
    { icon: "fas fa-brain", title: "AI Innovation", text: "Our continuous research and development push the boundaries of what's possible in predictive market analysis and portfolio optimization." },
    { icon: "fas fa-hand-holding-heart", title: "Ethical Approach", text: "We maintain transparency in our algorithms and uphold the highest ethical standards in financial technology development." }
  ];

  return (
    <section id="mission" className="mission-section">
      <div className="section-container">
        <FadeInWrapper>
            <div className="section-header">
                <h2 className="section-main-title">Our Mission</h2>
                <div className="title-decorator-line"></div>
                <p className="section-subtitle">
                    We&apos;re on a mission to democratize access to institutional-grade financial tools and intelligence.
                    In a world where information advantage translates to financial advantage, Finext levels the playing
                    field for all investors.
                </p>
            </div>
        </FadeInWrapper>
        <div className="mission-cards-group">
          {missions.map((mission, index) => (
            <FadeInWrapper key={index}>
                <div className="mission-card-item card-hover">
                    <div className="card-icon">
                        <i className={mission.icon}></i>
                    </div>
                    <h3 className="card-title">{mission.title}</h3>
                    <p className="card-text">{mission.text}</p>
                </div>
            </FadeInWrapper>
          ))}
        </div>
      </div>
    </section>
  );
};

export default MissionSection;
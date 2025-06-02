"use client";
import React, { useState, FormEvent } from 'react';

const ContactSection = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'processing' | 'success'>('idle');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus('processing');

    const submitButton = event.currentTarget.querySelector('button[type="submit"]') as HTMLButtonElement | null;
    const originalButtonText = submitButton ? submitButton.innerHTML : "Unlock Premium Access";
    const originalButtonStyle = submitButton ? submitButton.style.backgroundImage : "";


    if (submitButton) {
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-right: 0.5rem;"></i> Processing...';
        submitButton.disabled = true;
    }
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));

    // const formData = new FormData(event.currentTarget);
    // const data = Object.fromEntries(formData.entries());
    // console.log("Form data:", data);
    // Add your actual form submission logic here (e.g., fetch to an API endpoint)

    setSubmitStatus('success');
    if (submitButton) {
        submitButton.innerHTML = '<i class="fas fa-check-circle" style="margin-right: 0.5rem;"></i> Success!';
        submitButton.style.backgroundImage = 'linear-gradient(to right, var(--green-500), var(--teal-500))'; // Green gradient
    }

    setTimeout(() => {
      setSubmitStatus('idle');
      setIsSubmitting(false);
      if (submitButton) {
        submitButton.innerHTML = originalButtonText;
        submitButton.disabled = false;
        submitButton.style.backgroundImage = originalButtonStyle; // Restore original gradient
      }
      // event.currentTarget.reset(); // Optionally reset the form
    }, 3500);
  };

  return (
    <section id="contact" className="contact-section">
      <div className="section-container-wrapper">
        <div className="contact-form-container">
          <div className="contact-layout-flex">
            <div className="contact-info-panel">
              <div className="deco-blur-1"></div>
              <div className="deco-blur-2"></div>
              <h2 className="panel-title">Ready to Transform Your Trading?</h2>
              <p className="panel-description">
                Join thousands of traders who have enhanced their strategies with Finext.
                Start with our free 7-day trial and experience the future of financial
                analysis.
              </p>
              <div className="key-metrics-list">
                <div className="metric-item">
                  <div className="metric-icon-wrapper">
                    <div className="metric-icon-bg"><i className="fas fa-users"></i></div>
                  </div>
                  <div className="metric-details">
                    <h4 className="metric-title">35K+ Active Traders</h4>
                    <p className="metric-subtitle">Join a growing community of successful investors</p>
                  </div>
                </div>
                <div className="metric-item">
                  <div className="metric-icon-wrapper">
                    <div className="metric-icon-bg"><i className="fas fa-chart-line"></i></div>
                  </div>
                  <div className="metric-details">
                    <h4 className="metric-title">24.7% Avg. ROI</h4>
                    <p className="metric-subtitle">Based on verified user results in the past year</p>
                  </div>
                </div>
                <div className="metric-item">
                  <div className="metric-icon-wrapper">
                    <div className="metric-icon-bg"><i className="fas fa-shield-alt"></i></div>
                  </div>
                  <div className="metric-details">
                    <h4 className="metric-title">Secure &amp; Private</h4>
                    <p className="metric-subtitle">Bank-level encryption and data privacy standards</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="contact-form-panel">
              <form id="contactFormEl" onSubmit={handleSubmit}> {/* Changed ID slightly */}
                <div className="form-field">
                  <label htmlFor="name" className="form-label">Full Name</label>
                  <input type="text" id="name" name="name" className="form-text-input" placeholder="Enter your full name" required />
                </div>
                <div className="form-field">
                  <label htmlFor="email" className="form-label">Email Address</label>
                  <input type="email" id="email" name="email" className="form-text-input" placeholder="your.email@example.com" required />
                </div>
                <div className="form-field">
                  <label htmlFor="experience" className="form-label">Trading Experience</label>
                  <select id="experience" name="experience" className="form-dropdown-select" defaultValue="" required>
                    <option value="" disabled>Select your experience level</option>
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                    <option value="Professional">Professional</option>
                  </select>
                </div>
                <div className="form-field checkbox-group-label">
                  <label className="form-label">Markets You&apos;re Interested In</label>
                  <div className="interests-checkbox-grid">
                    <label className="checkbox-option-label">
                      <input type="checkbox" className="styled-checkbox" name="interest" value="stocks" />
                      <span className="checkbox-label-text">Stocks</span>
                    </label>
                    <label className="checkbox-option-label">
                      <input type="checkbox" className="styled-checkbox" name="interest" value="crypto" />
                      <span className="checkbox-label-text">Crypto</span>
                    </label>
                    <label className="checkbox-option-label">
                      <input type="checkbox" className="styled-checkbox" name="interest" value="forex" />
                      <span className="checkbox-label-text">Forex</span>
                    </label>
                    <label className="checkbox-option-label">
                      <input type="checkbox" className="styled-checkbox" name="interest" value="commodities" />
                      <span className="checkbox-label-text">Commodities</span>
                    </label>
                  </div>
                </div>
                <button type="submit" className="form-submit-button btn-glow" disabled={isSubmitting}>
                  {submitStatus === 'processing' && <><i className="fas fa-spinner fa-spin" style={{ marginRight: '0.5rem' }}></i> Processing...</>}
                  {submitStatus === 'success' && <><i className="fas fa-check-circle" style={{ marginRight: '0.5rem' }}></i> Success!</>}
                  {submitStatus === 'idle' && "Unlock Premium Access"}
                </button>
                <p className="trial-info-text">
                  Start your 7-day free trial. No credit card required.
                </p>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ContactSection;
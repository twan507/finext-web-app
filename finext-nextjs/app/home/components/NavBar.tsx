'use client';
import React from 'react';
import FinextLogo from './FinextLogo';

const Navbar = () => {
  return (
    <nav className="main-nav">
      <div className="nav-container">
        <div className="nav-inner-flex">
          <div className="logo-group">
            <a href="#" className="logo-icon-wrapper">
              <FinextLogo />
              <span className="logo-text">Finext</span>
            </a>
          </div>
          <div className="nav-links-wrapper">
            <a href="#features" className="nav-link">Features</a>
            <a href="#dashboard" className="nav-link">Dashboard</a>
            <a href="#mission" className="nav-link">Mission</a>
            <a href="#reviews" className="nav-link">Reviews</a>
            <a href="#contact" className="nav-link">Contact</a>
          </div>
          <div className="nav-actions-group">
            <button className="get-started-btn btn-glow">
              Get Started
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
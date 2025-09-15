import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Homepage.css';

const Homepage = () => {
  const navigate = useNavigate();

  const handleFreeTrial = () => {
  console.log('Free trial button clicked');
  
  // Clear any existing trial data to start fresh
  localStorage.removeItem('brainwave_trial');
  localStorage.removeItem('brainwave_fp');
  sessionStorage.removeItem('trial_active');
  
  console.log('Trial data cleared, navigating to dashboard');
  
  // Navigate to dashboard where trial will auto-start
  navigate('/dashboard');
};

  return (
    <div className="homepage">
      <div className="homepage-container">
        <div className="login-trigger" onClick={() => navigate('/login')}>
          LOGIN
        </div>
        
        <div className="main-content">
          <h1 className="title">brainwave</h1>
          <p className="subtitle-text">YOUR PERSONALIZED AI TUTOR</p>
          <div className="horizontal-line"></div>
          
          {/* Trial button section */}
          <div className="trial-section">
            <p className="trial-description">
            </p>
            <button 
              className="free-trial-btn"
              onClick={handleFreeTrial}
            >
              Start Free Trial (5 minutes)
            </button>
            <p className="trial-note">
              No registration required • Full access to all features
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Homepage;
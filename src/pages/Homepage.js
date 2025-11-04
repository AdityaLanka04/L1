import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Homepage.css';

const Homepage = () => {
  const navigate = useNavigate();

  return (
    <div className="homepage">
      <div className="homepage-container">
        <div className="login-trigger" onClick={() => navigate('/login')}>
          LOGIN
        </div>
        
        <div className="main-content">
          <h1 className="title">cerbyl</h1>
          <p className="subtitle-text">YOUR PERSONALIZED AI TUTOR</p>
          <div className="horizontal-line"></div>
        </div>
      </div>
    </div>
  );
};

export default Homepage;
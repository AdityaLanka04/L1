import React from 'react';
import './LoadingSpinner.css';

const LoadingSpinner = () => {
  return (
    <div className="loading-spinner-overlay">
      <div className="loading-spinner-container">
        <div className="loading-spinner-cube loading-spinner-cube--1"></div>
        <div className="loading-spinner-cube loading-spinner-cube--2"></div>
        <div className="loading-spinner-cube loading-spinner-cube--3"></div>
      </div>
    </div>
  );
};

export default LoadingSpinner;

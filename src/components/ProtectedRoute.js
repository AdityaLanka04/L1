import React from 'react';
import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ children }) => {
  // Use localStorage for token (persists)
  const token = localStorage.getItem('token');
  const username = localStorage.getItem('username');
  
    
  // Check authentication first
  if (!token || !username) {
        return <Navigate to="/login" replace />;
  }
  
  // If user has valid token, they must have passed safety verification
  // Always ensure the safety flag is set for authenticated users
  const currentSafetyFlag = sessionStorage.getItem('safetyAccepted');
    
  if (!currentSafetyFlag) {
    sessionStorage.setItem('safetyAccepted', 'true');
  }
  
  // User is authenticated, show the page
    return children;
};

export default ProtectedRoute;

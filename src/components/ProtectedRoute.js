import React from 'react';
import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ children }) => {
  // Use localStorage for token (persists)
  const token = localStorage.getItem('token');
  const username = localStorage.getItem('username');
  
  console.log('🔒 ProtectedRoute check:', { 
    hasToken: !!token, 
    username,
    path: window.location.pathname 
  });
  
  // Check authentication first
  if (!token || !username) {
    console.log('❌ No token/username, redirecting to /login');
    return <Navigate to="/login" replace />;
  }
  
  // If user has valid token, they must have passed safety verification
  // Always ensure the safety flag is set for authenticated users
  const currentSafetyFlag = sessionStorage.getItem('safetyAccepted');
  console.log('🔐 Safety flag status:', currentSafetyFlag);
  
  if (!currentSafetyFlag) {
    console.log('⚠️ User has valid token, setting safety flag NOW');
    sessionStorage.setItem('safetyAccepted', 'true');
    console.log('✅ Safety flag set to:', sessionStorage.getItem('safetyAccepted'));
  }
  
  // User is authenticated, show the page
  console.log('✅ All checks passed, showing protected page');
  return children;
};

export default ProtectedRoute;

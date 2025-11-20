import React from 'react';
import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ children }) => {
  // Use sessionStorage for safety (clears when browser closes)
  const hasAcceptedSafety = sessionStorage.getItem('safetyAccepted');
  
  // Use localStorage for token (persists)
  const token = localStorage.getItem('token');
  const username = localStorage.getItem('username');
  
  console.log('ProtectedRoute check:', { hasAcceptedSafety, token, username });
  
  // FIRST: Check safety acceptance
  if (!hasAcceptedSafety) {
    console.log('No safety acceptance, redirecting to /');
    return <Navigate to="/" replace />;
  }
  
  // SECOND: Check authentication
  if (!token || !username) {
    console.log('No token/username, redirecting to /login');
    return <Navigate to="/login" replace />;
  }
  
  // Both checks passed, show the page
  console.log('All checks passed, showing protected page');
  return children;
};

export default ProtectedRoute;

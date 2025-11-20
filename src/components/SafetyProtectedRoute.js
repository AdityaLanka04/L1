import React from 'react';
import { Navigate } from 'react-router-dom';

const SafetyProtectedRoute = ({ children }) => {
  // Use sessionStorage (clears when browser closes)
  const hasAcceptedSafety = sessionStorage.getItem('safetyAccepted');
  
  console.log('SafetyProtectedRoute check:', { hasAcceptedSafety });
  
  // If no safety acceptance, redirect to safety page
  if (!hasAcceptedSafety) {
    console.log('No safety acceptance, redirecting to /');
    return <Navigate to="/" replace />;
  }
  
  // If safety accepted, show the page (login/register)
  console.log('Safety accepted, showing page');
  return children;
};

export default SafetyProtectedRoute;

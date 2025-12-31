import React from 'react';
import { Navigate } from 'react-router-dom';

const SafetyProtectedRoute = ({ children }) => {
  // Use sessionStorage (clears when browser closes)
  const hasAcceptedSafety = sessionStorage.getItem('safetyAccepted');
  
    
  // If no safety acceptance, redirect to safety page
  if (!hasAcceptedSafety) {
        return <Navigate to="/" replace />;
  }
  
  // If safety accepted, show the page (login/register)
    return children;
};

export default SafetyProtectedRoute;

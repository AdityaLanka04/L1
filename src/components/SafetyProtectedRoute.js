import React from 'react';
import { Navigate } from 'react-router-dom';

const SafetyProtectedRoute = ({ children }) => {
  
  const hasAcceptedSafety = sessionStorage.getItem('safetyAccepted');
  
    
  
  if (!hasAcceptedSafety) {
        return <Navigate to="/" replace />;
  }
  
  
    return children;
};

export default SafetyProtectedRoute;

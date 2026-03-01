import React from 'react';
import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ children }) => {
  
  const token = localStorage.getItem('token');
  const username = localStorage.getItem('username');
  
    
  
  if (!token || !username) {
        return <Navigate to="/login" replace />;
  }
  
  
  
  const currentSafetyFlag = sessionStorage.getItem('safetyAccepted');
    
  if (!currentSafetyFlag) {
    sessionStorage.setItem('safetyAccepted', 'true');
  }
  
  
    return children;
};

export default ProtectedRoute;

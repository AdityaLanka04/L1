
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const ConceptWeb = () => {
  const navigate = useNavigate();
  
  useEffect(() => {
    
    navigate('/learning-paths');
  }, [navigate]);

  
  return null;
};

export default ConceptWeb;


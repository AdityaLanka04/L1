// ConceptWeb.js - Redirects to Learning Paths
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const ConceptWeb = () => {
  const navigate = useNavigate();
  
  useEffect(() => {
    // Redirect directly to learning paths page
    navigate('/learning-paths');
  }, [navigate]);

  // Return null since we're redirecting
  return null;
};

export default ConceptWeb;

/* ==================== ORIGINAL CONCEPT WEB CODE (COMMENTED OUT) ====================

// All the original concept web visualization, network graph, and concept management
// functionality has been commented out. This page now redirects to /learning-paths.
// 
// The concept web features included:
// - Interactive network visualization of concepts
// - Concept nodes with connections
// - Drag and drop positioning
// - Zoom and pan controls
// - Grid view of concepts
// - Analytics and statistics
// - Resource recommendations
// - Concept generation from learning content
// - Integration with notes, flashcards, and quizzes
//
// All this functionality is preserved in git history if needed in the future.

==================== END OF COMMENTED CODE ==================== */

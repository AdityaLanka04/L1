import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Map, HelpCircle, BookOpen, TrendingUp } from 'lucide-react';
import './LearningReviewHub.css';
import { API_URL } from '../config';

const LearningReviewHub = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const [userName, setUserName] = useState('User');

  useEffect(() => {
    fetchUserProfile();
  }, [token]);

  const fetchUserProfile = async () => {
    try {
      const response = await fetch(`${API_URL}/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setUserName(data.first_name || 'User');
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  };

  const tools = [
    {
      icon: Map,
      title: 'Knowledge Roadmap',
      description: 'Build an interactive map of a topic with expandable nodes. Navigate through concepts and learn progressively.',
      path: '/knowledge-roadmap',
      id: 'roadmap'
    },
    {
      icon: HelpCircle,
      title: 'Question Bank',
      description: 'Create custom practice questions based on your notes, slides, or any topic to test your knowledge.',
      path: '/question-bank',
      id: 'questions'
    },
    {
      icon: BookOpen,
      title: 'Slide Explorer',
      description: 'Upload and explore your presentation slides. Generate AI-powered insights and summaries.',
      path: '/slide-explorer',
      id: 'slides'
    },
    {
      icon: TrendingUp,
      title: 'Statistics',
      description: 'Track your learning progress, view performance metrics, and identify your strength and improvement areas.',
      path: '/statistics',
      id: 'stats'
    }
  ];

  return (
    <div className="learning-review-hub-container">
      <header className="learning-review-hub-header">
        <div className="learning-review-hub-header-left">
          <h1 className="learning-review-hub-logo">cerbyl</h1>
          <span className="learning-review-hub-subtitle">LEARNING REVIEW HUB</span>
        </div>
        <div className="learning-review-hub-header-right">
          <button className="learning-review-hub-nav-btn" onClick={() => navigate('/dashboard')}>Dashboard</button>
          <button className="learning-review-hub-nav-btn logout" onClick={() => { localStorage.removeItem('token'); navigate('/login'); }}>Logout</button>
        </div>
      </header>

      <div className="learning-review-hub-main">
        <div className="learning-review-hub-welcome">
          <h2 className="learning-review-hub-welcome-title">Welcome back, {userName}</h2>
          <p className="learning-review-hub-welcome-subtitle">Choose a learning tool to get started</p>
        </div>

        <div className="learning-review-hub-grid">
          {tools.map(tool => {
            const IconComponent = tool.icon;
            return (
              <div 
                key={tool.id}
                className="learning-review-hub-card"
                onClick={() => navigate(tool.path)}
              >
                <div className="learning-review-hub-card-header">
                  <div className="learning-review-hub-card-icon">
                    <IconComponent size={40} strokeWidth={1.5} />
                  </div>
                </div>

                <div className="learning-review-hub-card-content">
                  <h3 className="learning-review-hub-card-title">{tool.title}</h3>
                  <p className="learning-review-hub-card-description">{tool.description}</p>
                </div>

                <div className="learning-review-hub-card-footer">
                  <button className="learning-review-hub-card-action">EXPLORE NOW</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default LearningReviewHub;
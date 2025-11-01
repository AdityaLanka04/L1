import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Map, HelpCircle, BookOpen, TrendingUp } from 'lucide-react';
import './LearningReviewHub.css';

const LearningReviewHub = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const [userName, setUserName] = useState('User');

  useEffect(() => {
    fetchUserProfile();
  }, [token]);

  const fetchUserProfile = async () => {
    try {
      const response = await fetch('${API_URL}/me', {
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
    <div className="hub-page">
      <header className="hub-header">
        <div className="hub-header-left">
          <h1 className="hub-logo">brainwave</h1>
          <span className="hub-subtitle">LEARNING REVIEW HUB</span>
        </div>
        <div className="hub-header-right">
          <button className="hub-nav-btn" onClick={() => navigate('/dashboard')}>Dashboard</button>
          <button className="hub-nav-btn logout" onClick={() => { localStorage.removeItem('token'); navigate('/login'); }}>Logout</button>
        </div>
      </header>

      <div className="hub-main-content">
        <div className="hub-welcome">
          <h2 className="hub-welcome-title">Welcome back, {userName}</h2>
          <p className="hub-welcome-subtitle">Choose a learning tool to get started</p>
        </div>

        <div className="hub-grid">
          {tools.map(tool => {
            const IconComponent = tool.icon;
            return (
              <div 
                key={tool.id}
                className="hub-card"
                onClick={() => navigate(tool.path)}
              >
                <div className="hub-card-header">
                  <div className="hub-card-icon">
                    <IconComponent size={48} strokeWidth={1.5} />
                  </div>
                </div>

                <div className="hub-card-content">
                  <h3 className="hub-card-title">{tool.title}</h3>
                  <p className="hub-card-description">{tool.description}</p>
                </div>

                <div className="hub-card-footer">
                  <button className="hub-card-action">EXPLORE NOW</button>
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
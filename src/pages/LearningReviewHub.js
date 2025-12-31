import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Map, HelpCircle, BookOpen, TrendingUp, Target, ChevronRight, Play } from 'lucide-react';
import './LearningReviewHub.css';
import { API_URL } from '../config';

const LearningReviewHub = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const [userName, setUserName] = useState('User');
  const [hoveredCard, setHoveredCard] = useState(null);

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
          }
  };

  const tools = [
    {
      icon: Map,
      title: 'Knowledge Roadmap',
      description: 'Build interactive concept maps with expandable nodes. Navigate through topics progressively and master complex subjects.',
      path: '/knowledge-roadmap',
      id: 'roadmap',
      cta: 'Build Roadmap',
      stat: 'Visual Learning',
      featured: true
    },
    {
      icon: HelpCircle,
      title: 'Question Bank',
      description: 'Generate custom practice questions from your notes, slides, or any topic. Test and reinforce your knowledge.',
      path: '/question-bank',
      id: 'questions',
      cta: 'Create Questions',
      stat: 'Active Recall'
    },
    {
      icon: BookOpen,
      title: 'Slide Explorer',
      description: 'Upload presentations and get AI-powered insights, summaries, and key takeaways from your slides.',
      path: '/slide-explorer',
      id: 'slides',
      cta: 'Upload Slides',
      stat: 'AI Analysis'
    },
    {
      icon: TrendingUp,
      title: 'Statistics',
      description: 'Track learning progress, view performance metrics, and identify strengths and areas for improvement.',
      path: '/statistics',
      id: 'stats',
      cta: 'View Stats',
      stat: 'Progress Tracking'
    }
  ];

  return (
    <div className="lrh">
      {/* Ambient Background */}
      <div className="lrh-ambient">
        <div className="lrh-ambient-orb lrh-ambient-orb-1"></div>
        <div className="lrh-ambient-orb lrh-ambient-orb-2"></div>
        <div className="lrh-ambient-grid"></div>
      </div>

      {/* Header */}
      <header className="lrh-header">
        <div className="lrh-header-left">
          <h1 className="lrh-logo" onClick={() => navigate('/dashboard')}>
            cerbyl
          </h1>
          <div className="lrh-header-divider"></div>
          <span className="lrh-subtitle">Learning Hub</span>
        </div>
        <nav className="lrh-header-right">
          <button className="lrh-nav-btn lrh-nav-btn-ghost" onClick={() => navigate('/dashboard')}>
            <span>Dashboard</span>
            <ChevronRight size={14} />
          </button>
          <button className="lrh-nav-btn lrh-nav-btn-outline" onClick={() => { localStorage.removeItem('token'); navigate('/login'); }}>
            Logout
          </button>
        </nav>
      </header>

      {/* Main Content */}
      <main className="lrh-main">
        {/* Hero Section - Compact */}
        <section className="lrh-hero">
          <h2 className="lrh-hero-title">
            Welcome back, <span className="lrh-hero-name">{userName}</span>
          </h2>
          <p className="lrh-hero-subtitle">
            Select a tool to accelerate your learning journey
          </p>
        </section>

        {/* Tools Grid */}
        <section className="lrh-grid">
          {tools.map((tool, index) => {
            const IconComponent = tool.icon;
            const isHovered = hoveredCard === tool.id;
            return (
              <article 
                key={tool.id}
                className={`lrh-card ${tool.featured ? 'lrh-card-featured' : ''} ${isHovered ? 'lrh-card-hovered' : ''}`}
                onClick={() => navigate(tool.path)}
                onMouseEnter={() => setHoveredCard(tool.id)}
                onMouseLeave={() => setHoveredCard(null)}
                style={{ '--card-index': index }}
              >
                {/* Card Glow Effect */}
                <div className="lrh-card-glow"></div>
                
                {/* Card Border Gradient */}
                <div className="lrh-card-border"></div>

                {/* Card Content */}
                <div className="lrh-card-inner">
                  {/* Top Section */}
                  <div className="lrh-card-top">
                    <div className="lrh-card-icon-wrapper">
                      <div className="lrh-card-icon">
                        <IconComponent size={24} strokeWidth={1.5} />
                      </div>
                      <div className="lrh-card-icon-bg"></div>
                    </div>
                    <div className="lrh-card-badge">
                      <Target size={10} />
                      <span>{tool.stat}</span>
                    </div>
                  </div>

                  {/* Middle Section */}
                  <div className="lrh-card-body">
                    <h3 className="lrh-card-title">{tool.title}</h3>
                    <p className="lrh-card-desc">{tool.description}</p>
                  </div>

                  {/* Bottom Section */}
                  <div className="lrh-card-footer">
                    <button className="lrh-card-cta">
                      <span>{tool.cta}</span>
                      <Play size={12} fill="currentColor" className="lrh-card-cta-icon" />
                    </button>
                  </div>
                </div>

                {/* Hover Line */}
                <div className="lrh-card-line"></div>
              </article>
            );
          })}
        </section>
      </main>
    </div>
  );
};

export default LearningReviewHub;

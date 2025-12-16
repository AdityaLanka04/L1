import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Users, BookOpen, Swords, ChevronLeft } from 'lucide-react';
import './QuizHub.css';

const QuizHub = () => {
  const navigate = useNavigate();

  // Disable scrolling on this page
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, []);

  return (
    <div className="quiz-hub-page">
      <header className="quiz-hub-header">
        <div className="header-left">
          <h1 className="page-title">cerbyl</h1>
          <span className="page-subtitle">quiz hub</span>
        </div>
        <div className="header-actions">
          <button onClick={() => navigate('/dashboard')} className="back-to-dashboard">
            <ChevronLeft size={18} />
            <span>back to dashboard</span>
          </button>
        </div>
      </header>

      <div className="quiz-hub-container">
        {/* Solo Quiz - Left Half */}
        <div className="quiz-option solo" onClick={() => navigate('/solo-quiz')}>
          <div className="quiz-option-content">
            <div className="quiz-icon-wrapper solo-icon">
              <User size={64} />
            </div>
            <h2 className="quiz-option-title">Solo Practice</h2>
            <p className="quiz-option-subtitle">Practice at your own pace</p>
            <div className="quiz-features">
              <div className="feature-item">
                <BookOpen size={18} />
                <span>AI-Generated Questions</span>
              </div>
              <div className="feature-item">
                <User size={18} />
                <span>Personal Progress</span>
              </div>
              <div className="feature-item">
                <BookOpen size={18} />
                <span>Learn from Mistakes</span>
              </div>
            </div>
            <button className="quiz-start-btn solo-btn">
              Start Solo Quiz
            </button>
          </div>
        </div>

        {/* Divider */}
        <div className="quiz-divider">
          <span>OR</span>
        </div>

        {/* 1v1 Battles - Right Half */}
        <div className="quiz-option battle" onClick={() => navigate('/quiz-battles')}>
          <div className="quiz-option-content">
            <div className="quiz-icon-wrapper battle-icon">
              <Swords size={64} />
            </div>
            <h2 className="quiz-option-title">1v1 Battles</h2>
            <p className="quiz-option-subtitle">Challenge your friends</p>
            <div className="quiz-features">
              <div className="feature-item">
                <Users size={18} />
                <span>Compete with Friends</span>
              </div>
              <div className="feature-item">
                <Swords size={18} />
                <span>Real-time Battles</span>
              </div>
              <div className="feature-item">
                <Users size={18} />
                <span>Live Notifications</span>
              </div>
            </div>
            <button className="quiz-start-btn battle-btn">
              Start Battle
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuizHub;
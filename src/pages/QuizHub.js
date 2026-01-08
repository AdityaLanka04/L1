import React from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Users, BookOpen, Swords, ChevronRight } from 'lucide-react';
import './QuizHub.css';

const QuizHub = () => {
  const navigate = useNavigate();

  return (
    <div className="quiz-hub-page">
      <header className="qh-profile-header">
        <div className="qh-profile-header-left">
          <h1 className="qh-profile-title">cerbyl</h1>
          <div className="qh-profile-header-divider"></div>
          <span className="qh-profile-subtitle">quiz hub</span>
        </div>
        <nav className="qh-profile-header-right">
          <button className="qh-profile-nav-btn profile-nav-btn-ghost" onClick={() => navigate('/dashboard')}>
            <span>Dashboard</span>
            <ChevronRight size={14} />
          </button>
        </nav>
      </header>

      <div className="qh-split-container">
        {/* Left Side - Solo Practice */}
        <div className="qh-split-side qh-left-side" onClick={() => navigate('/solo-quiz')}>
          <div className="qh-split-content">
            <div className="qh-card-icon-wrapper">
              <User size={48} />
            </div>
            <h2 className="qh-split-title">Solo Practice</h2>
            <p className="qh-split-subtitle">Practice at your own pace</p>
            <div className="qh-features">
              <div className="qh-feature-item">
                <BookOpen size={16} />
                <span>AI-Generated Questions</span>
              </div>
              <div className="qh-feature-item">
                <User size={16} />
                <span>Personal Progress</span>
              </div>
              <div className="qh-feature-item">
                <BookOpen size={16} />
                <span>Learn from Mistakes</span>
              </div>
            </div>
            <button className="qh-start-btn">
              Start Solo Quiz
            </button>
          </div>
        </div>

        {/* Right Side - 1v1 Battles */}
        <div className="qh-split-side qh-right-side" onClick={() => navigate('/quiz-battles')}>
          <div className="qh-split-content">
            <div className="qh-card-icon-wrapper">
              <Swords size={48} />
            </div>
            <h2 className="qh-split-title">1v1 Battles</h2>
            <p className="qh-split-subtitle">Challenge your friends</p>
            <div className="qh-features">
              <div className="qh-feature-item">
                <Users size={16} />
                <span>Compete with Friends</span>
              </div>
              <div className="qh-feature-item">
                <Swords size={16} />
                <span>Real-time Battles</span>
              </div>
              <div className="qh-feature-item">
                <Users size={16} />
                <span>Live Notifications</span>
              </div>
            </div>
            <button className="qh-start-btn">
              Start Battle
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuizHub;
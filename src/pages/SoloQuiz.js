import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Target, Clock, BookOpen, Zap, TrendingUp, Play } from 'lucide-react';
import './SoloQuiz.css';
import { API_URL } from '../config';

const SoloQuiz = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  
  const [subject, setSubject] = useState('');
  const [difficulty, setDifficulty] = useState('intermediate');
  const [questionCount, setQuestionCount] = useState(10);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const handleStartQuiz = async (e) => {
    e.preventDefault();
    
    if (!subject) {
      alert('Please enter a subject');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/create_solo_quiz`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          subject,
          difficulty,
          question_count: questionCount
        })
      });

      if (response.ok) {
        const data = await response.json();
        navigate(`/solo-quiz/${data.quiz_id}`);
      } else {
        alert('Failed to create quiz');
      }
    } catch (error) {
      console.error('Error creating solo quiz:', error);
      alert('Failed to create quiz');
    }
  };

  return (
    <div className="solo-quiz-page">
      <header className="solo-header">
        <div className="solo-header-left">
          <h1 className="solo-logo">cerbyl</h1>
          <span className="solo-subtitle">SOLO PRACTICE</span>
        </div>
        <div className="solo-header-right">
          <button className="solo-nav-btn" onClick={() => navigate('/dashboard')}>Dashboard</button>
        </div>
      </header>

      <div className="solo-container">
        <div className="solo-welcome">
          <div className="solo-welcome-content">
            <BookOpen size={48} className="solo-icon" />
            <h2 className="solo-title">Practice Solo</h2>
            <p className="solo-description">
              Test your knowledge with AI-generated quizzes. Choose your subject, difficulty, and start learning!
            </p>
          </div>
          <button className="start-quiz-btn" onClick={() => setShowCreateModal(true)}>
            <Play size={20} />
            <span>Start New Quiz</span>
          </button>
        </div>

        <div className="solo-features">
          <div className="feature-card">
            <Target size={32} />
            <h3>Personalized</h3>
            <p>Choose your subject and difficulty level</p>
          </div>
          <div className="feature-card">
            <Zap size={32} />
            <h3>Instant Feedback</h3>
            <p>See correct answers and explanations</p>
          </div>
          <div className="feature-card">
            <TrendingUp size={32} />
            <h3>Track Progress</h3>
            <p>Monitor your learning journey</p>
          </div>
        </div>
      </div>

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create Solo Quiz</h3>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}>×</button>
            </div>

            <form onSubmit={handleStartQuiz} className="quiz-form">
              <div className="form-group">
                <label>Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g., Mathematics, Physics, History..."
                  required
                />
              </div>

              <div className="form-group">
                <label>Difficulty</label>
                <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>

              <div className="form-group">
                <label>Number of Questions</label>
                <input
                  type="number"
                  value={questionCount}
                  onChange={(e) => setQuestionCount(parseInt(e.target.value))}
                  min="5"
                  max="20"
                  required
                />
              </div>

              <button type="submit" className="submit-quiz-btn">
                <Play size={16} />
                <span>Start Quiz</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SoloQuiz;

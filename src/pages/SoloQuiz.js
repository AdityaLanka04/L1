import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Target, BookOpen, Zap, TrendingUp, Play } from 'lucide-react';
import './SoloQuiz.css';
import { API_URL } from '../config';

const SoloQuiz = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const token = localStorage.getItem('token');
  
  const [subject, setSubject] = useState('');
  const [difficulty, setDifficulty] = useState('intermediate');
  const [questionCount, setQuestionCount] = useState(10);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Handle autoStart from SearchHub
  useEffect(() => {
    const autoStartData = location.state;
    
    if (autoStartData?.autoStart && autoStartData.topics?.length > 0) {
      console.log('🚀 Auto-starting quiz with:', autoStartData);
      
      // Set the form values
      const topic = autoStartData.topics[0];
      setSubject(topic);
      setDifficulty(autoStartData.difficulty || 'medium');
      setQuestionCount(autoStartData.questionCount || 10);
      
      // Auto-create the quiz
      setTimeout(async () => {
        try {
          const response = await fetch(`${API_URL}/create_solo_quiz`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              subject: topic,
              difficulty: autoStartData.difficulty || 'medium',
              question_count: autoStartData.questionCount || 10
            })
          });

          if (response.ok) {
            const data = await response.json();
            navigate(`/solo-quiz/${data.quiz_id}`, { replace: true });
          } else {
            console.error('Failed to create quiz');
            // Show the modal so user can try manually
            setShowCreateModal(true);
          }
        } catch (error) {
          console.error('Error creating solo quiz:', error);
          // Show the modal so user can try manually
          setShowCreateModal(true);
        }
        
        // Clear location state
        window.history.replaceState({}, document.title);
      }, 500);
    }
  }, [location.state]);

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
    <div className="sq-page">
      <header className="sq-header">
        <div className="sq-header-left">
          <h1 className="sq-logo">cerbyl</h1>
          <span className="sq-subtitle">SOLO PRACTICE</span>
        </div>
        <div className="sq-header-right">
          <button className="sq-nav-btn" onClick={() => navigate('/social')}>Back to Social</button>
          <button className="sq-nav-btn" onClick={() => navigate('/dashboard')}>Dashboard</button>
        </div>
      </header>

      <div className="sq-content">
        <div className="sq-welcome">
          <div className="sq-welcome-inner">
            <BookOpen size={48} className="sq-icon" />
            <h2 className="sq-title">Practice Solo</h2>
            <p className="sq-desc">
              Test your knowledge with AI-generated quizzes. Choose your subject, difficulty, and start learning!
            </p>
          </div>
          <button className="sq-start-btn" onClick={() => setShowCreateModal(true)}>
            <Play size={20} />
            <span>Start New Quiz</span>
          </button>
        </div>

        <div className="sq-features">
          <div className="sq-feature-card">
            <Target size={32} />
            <h3>Personalized</h3>
            <p>Choose your subject and difficulty level</p>
          </div>
          <div className="sq-feature-card">
            <Zap size={32} />
            <h3>Instant Feedback</h3>
            <p>See correct answers and explanations</p>
          </div>
          <div className="sq-feature-card">
            <TrendingUp size={32} />
            <h3>Track Progress</h3>
            <p>Monitor your learning journey</p>
          </div>
        </div>
      </div>

      {showCreateModal && (
        <div className="sq-modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="sq-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sq-modal-header">
              <h3>Create Solo Quiz</h3>
              <button className="sq-modal-close" onClick={() => setShowCreateModal(false)}>×</button>
            </div>

            <form onSubmit={handleStartQuiz} className="sq-form">
              <div className="sq-form-group">
                <label>Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g., Mathematics, Physics, History..."
                  required
                />
              </div>

              <div className="sq-form-group">
                <label>Difficulty</label>
                <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>

              <div className="sq-form-group">
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

              <button type="submit" className="sq-submit-btn">
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

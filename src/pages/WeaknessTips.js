import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronRight, Lightbulb, BookOpen, Activity, ArrowRight, Brain, Target,
  CheckCircle, XCircle, Clock, Trophy, Zap, AlertCircle
, Menu} from 'lucide-react';
import './WeaknessTips.css';
import { API_URL } from '../config';

const WeaknessTips = () => {
  const { topic } = useParams();
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const userName = localStorage.getItem('username');
  
  const [loading, setLoading] = useState(true);
  const [suggestions, setSuggestions] = useState(null);
  const [similarQuestions, setSimilarQuestions] = useState(null);
  
  // Practice generation state
  const [generatingPractice, setGeneratingPractice] = useState(false);
  const [questionCount, setQuestionCount] = useState(10);
  const [difficulty, setDifficulty] = useState('medium');
  const [questionTypes, setQuestionTypes] = useState(['multiple_choice']);

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    loadTipsData();
  }, [topic]);

  const loadTipsData = async () => {
    setLoading(true);
    try {
      // Load suggestions
      const suggestionsRes = await fetch(
        `${API_URL}/study_insights/topic_suggestions?user_id=${userName}&topic=${encodeURIComponent(topic)}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      if (suggestionsRes.ok) {
        const data = await suggestionsRes.json();
        setSuggestions(data);
      }

      // Load similar questions
      const questionsRes = await fetch(
        `${API_URL}/study_insights/similar_questions?user_id=${userName}&topic=${encodeURIComponent(topic)}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      if (questionsRes.ok) {
        const data = await questionsRes.json();
        setSimilarQuestions(data);
      }
    } catch (error) {
      console.error('Error loading tips:', error);
    } finally {
      setLoading(false);
    }
  };

  const generatePracticeQuestions = async () => {
    setGeneratingPractice(true);
    try {
      const difficultyMix = {
        easy: difficulty === 'easy' ? 7 : difficulty === 'medium' ? 3 : 1,
        medium: difficulty === 'easy' ? 2 : difficulty === 'medium' ? 5 : 3,
        hard: difficulty === 'easy' ? 1 : difficulty === 'medium' ? 2 : 6
      };

      const response = await fetch(`${API_URL}/generate_practice_questions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: userName,
          topic: decodeURIComponent(topic),
          question_count: questionCount,
          difficulty_mix: difficultyMix,
          question_types: questionTypes,
          title: `Practice: ${decodeURIComponent(topic)}`
        })
      });

      const data = await response.json();

      if (response.ok && data.questions && data.questions.length > 0) {
        // Navigate directly to practice with the generated questions
        navigate('/weakness-practice', {
          state: {
            questions: data.questions,
            topic: decodeURIComponent(topic),
            difficulty: difficulty,
            questionSetId: data.question_set_id,
            fromGenerator: true
          }
        });
      } else {
        alert(data.detail || 'Failed to generate questions. Please try again.');
      }
    } catch (error) {
      console.error('Error generating practice:', error);
      alert('Failed to generate practice questions. Please try again.');
    } finally {
      setGeneratingPractice(false);
    }
  };

  const toggleQuestionType = (type) => {
    if (questionTypes.includes(type)) {
      if (questionTypes.length > 1) {
        setQuestionTypes(questionTypes.filter(t => t !== type));
      }
    } else {
      setQuestionTypes([...questionTypes, type]);
    }
  };

  if (loading) {
    return (
      <div className="weakness-tips-container">
        <div className="tips-loading">
          <div className="loading-spinner-tips"></div>
          <p>LOADING TIPS...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="weakness-tips-container">
      {/* Header */}
      <header className="tips-header">
        <div className="tips-header-left">
          <button className="nav-menu-btn" onClick={() => window.openGlobalNav && window.openGlobalNav()} aria-label="Open navigation">
            <Menu size={20} />
          </button>
          <h1 className="tips-logo" onClick={() => navigate('/search-hub')}>
            <div className="tips-logo-img" />
            cerbyl
          </h1>
          <div className="tips-header-divider"></div>
          <span className="tips-subtitle">STUDY TIPS</span>
        </div>
        <nav className="tips-header-right">
          <button className="tips-nav-btn tips-nav-btn-ghost" onClick={() => navigate('/weaknesses')}>
            <span>Back to Weaknesses</span>
            <ChevronRight size={14} />
          </button>
        </nav>
      </header>

      <div className="tips-body">
        <div className="tips-content">
          <div className="tips-topic-header">
            <Brain size={48} />
            <h2>{decodeURIComponent(topic)}</h2>
            <p>Personalized study recommendations and practice resources</p>
          </div>

          {/* Suggestions Section */}
          {suggestions?.suggestions?.length > 0 && (
            <div className="tips-section">
              <h3><Lightbulb size={20} /> Personalized Suggestions</h3>
              <div className="suggestions-grid">
                {suggestions.suggestions.map((suggestion, idx) => (
                  <div key={idx} className={`suggestion-card ${suggestion.priority}`}>
                    <div className="suggestion-header">
                      <span className="suggestion-title">{suggestion.title}</span>
                      <span className={`suggestion-priority ${suggestion.priority}`}>
                        {suggestion.priority}
                      </span>
                    </div>
                    <p className="suggestion-description">{suggestion.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Generate Practice Questions Section */}
          <div className="tips-section practice-generator-section">
            <h3><Zap size={20} /> Generate Practice Questions</h3>
            <div className="practice-generator-card">
              <div className="practice-gen-header">
                <Brain size={40} />
                <div>
                  <h4>AI-Powered Practice</h4>
                  <p>Generate custom practice questions tailored to this topic</p>
                </div>
              </div>

              <div className="practice-settings">
                <div className="setting-group">
                  <label>Question Count</label>
                  <div className="count-selector">
                    <button 
                      onClick={() => setQuestionCount(Math.max(5, questionCount - 5))}
                      disabled={questionCount <= 5}
                    >
                      -
                    </button>
                    <span>{questionCount}</span>
                    <button 
                      onClick={() => setQuestionCount(Math.min(20, questionCount + 5))}
                      disabled={questionCount >= 20}
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="setting-group">
                  <label>Difficulty</label>
                  <div className="difficulty-selector">
                    <button
                      className={difficulty === 'easy' ? 'active' : ''}
                      onClick={() => setDifficulty('easy')}
                    >
                      Easy
                    </button>
                    <button
                      className={difficulty === 'medium' ? 'active' : ''}
                      onClick={() => setDifficulty('medium')}
                    >
                      Medium
                    </button>
                    <button
                      className={difficulty === 'hard' ? 'active' : ''}
                      onClick={() => setDifficulty('hard')}
                    >
                      Hard
                    </button>
                  </div>
                </div>

                <div className="setting-group">
                  <label>Question Types</label>
                  <div className="type-selector">
                    <button
                      className={questionTypes.includes('multiple_choice') ? 'active' : ''}
                      onClick={() => toggleQuestionType('multiple_choice')}
                    >
                      <CheckCircle size={16} />
                      Multiple Choice
                    </button>
                    <button
                      className={questionTypes.includes('true_false') ? 'active' : ''}
                      onClick={() => toggleQuestionType('true_false')}
                    >
                      <CheckCircle size={16} />
                      True/False
                    </button>
                    <button
                      className={questionTypes.includes('short_answer') ? 'active' : ''}
                      onClick={() => toggleQuestionType('short_answer')}
                    >
                      <CheckCircle size={16} />
                      Short Answer
                    </button>
                  </div>
                </div>
              </div>

              <button 
                className="generate-practice-btn"
                onClick={generatePracticeQuestions}
                disabled={generatingPractice}
              >
                {generatingPractice ? (
                  <>
                    <Clock size={20} className="spinner" />
                    <span>GENERATING QUESTIONS...</span>
                  </>
                ) : (
                  <>
                    <Target size={20} />
                    <span>GENERATE & START PRACTICE</span>
                    <ArrowRight size={20} />
                  </>
                )}
              </button>

              <div className="practice-features">
                <div className="feature-item">
                  <Trophy size={18} />
                  <span>Instant feedback</span>
                </div>
                <div className="feature-item">
                  <Activity size={18} />
                  <span>Track progress</span>
                </div>
                <div className="feature-item">
                  <AlertCircle size={18} />
                  <span>Detailed explanations</span>
                </div>
              </div>
            </div>
          </div>

          {/* Study Tips */}
          {suggestions?.study_tips?.length > 0 && (
            <div className="tips-section">
              <h3><BookOpen size={20} /> Study Tips</h3>
              <ul className="tips-list">
                {suggestions.study_tips.map((tip, idx) => (
                  <li key={idx}>{tip}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Similar Questions */}
          {similarQuestions?.similar_questions?.length > 0 && (
            <div className="tips-section">
              <h3><Activity size={20} /> Practice Questions ({similarQuestions.total_found})</h3>
              <div className="questions-grid">
                {similarQuestions.similar_questions.slice(0, 10).map((question, idx) => (
                  <div key={idx} className="question-card">
                    <div className="question-header">
                      <span className="question-number">Q{idx + 1}</span>
                      <span className={`question-difficulty ${question.difficulty}`}>
                        {question.difficulty}
                      </span>
                      {question.is_new && <span className="question-new-badge">NEW</span>}
                    </div>
                    <p className="question-text">{question.question_text}</p>
                    {!question.is_new && question.user_answer && (
                      <div className="question-history">
                        <span className="question-your-answer">Your answer: {question.user_answer}</span>
                        <span className="question-correct-answer">Correct: {question.correct_answer}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <button 
                className="practice-all-btn" 
                onClick={() => navigate('/question-bank', { state: { topic: decodeURIComponent(topic) }})}
              >
                <Target size={18} />
                <span>Practice All Questions</span>
                <ArrowRight size={18} />
              </button>
            </div>
          )}

          {/* Empty state */}
          {!suggestions?.suggestions?.length && !similarQuestions?.similar_questions?.length && (
            <div className="tips-empty">
              <Brain size={64} />
              <h3>No tips available yet</h3>
              <p>Keep practicing and we'll generate personalized recommendations for you</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WeaknessTips;

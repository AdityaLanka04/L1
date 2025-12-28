import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './StudyInsights.css';
import { API_URL } from '../config';

const StudyInsights = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [aiSummary, setAiSummary] = useState('');
  const [generatedQuestions, setGeneratedQuestions] = useState([]);
  const [generatedFlashcards, setGeneratedFlashcards] = useState([]);
  const [mainTopic, setMainTopic] = useState('');
  const [hasSessionData, setHasSessionData] = useState(false);
  const [userQuestions, setUserQuestions] = useState([]);

  const userName = localStorage.getItem('username');
  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    
    // Check if study insights is enabled - check localStorage first
    const profile = localStorage.getItem('userProfile');
    console.log('📊 StudyInsights - checking profile from localStorage');
    if (profile) {
      try {
        const parsed = JSON.parse(profile);
        console.log('📊 StudyInsights - showStudyInsights value:', parsed.showStudyInsights);
        // Check if explicitly set to false (not just undefined)
        if (parsed.showStudyInsights === false) {
          console.log('📊 StudyInsights disabled, redirecting to dashboard');
          // Study insights is disabled, redirect to dashboard
          navigate('/dashboard', { replace: true });
          return;
        }
      } catch (e) {
        console.error('Error parsing profile:', e);
      }
    }
    
    loadInsights();
  }, []);

  const loadInsights = async () => {
    setLoading(true);

    try {
      // Get session summary
      const summaryRes = await fetch(`${API_URL}/study_insights/session_summary?user_id=${userName}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (summaryRes.ok) {
        const data = await summaryRes.json();
        const summary = data.summary;
        
        // Check if there's actual session data
        const topics = summary?.specific_topics || [];
        const messageCount = summary?.summary?.chat_messages || 0;
        const questions = summary?.user_questions || [];
        
        console.log('Session data:', { topics, messageCount, questions });
        
        setUserQuestions(questions);
        
        if (messageCount > 0 && topics.length > 0) {
          setHasSessionData(true);
          setMainTopic(topics[0].name);
          
          // Get AI summary and generate content in parallel, wait for all
          const [aiRes, questionsData, flashcardsData] = await Promise.all([
            fetch(`${API_URL}/study_insights/ai_summary?user_id=${userName}`, {
              headers: { Authorization: `Bearer ${token}` },
            }),
            fetch(`${API_URL}/study_insights/generate_content`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                user_id: userName,
                content_type: 'quiz',
                topic: topics[0].name,
                count: 2,
                context: questions.slice(0, 5).join('\n'),
              }),
            }),
            fetch(`${API_URL}/study_insights/generate_content`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                user_id: userName,
                content_type: 'flashcards',
                topic: topics[0].name,
                count: 3,
                context: questions.slice(0, 5).join('\n'),
              }),
            }),
          ]);

          if (aiRes.ok) {
            const aiData = await aiRes.json();
            setAiSummary(aiData.summary);
          }
          
          if (questionsData.ok) {
            const qData = await questionsData.json();
            setGeneratedQuestions(qData.content || []);
          }
          
          if (flashcardsData.ok) {
            const fData = await flashcardsData.json();
            setGeneratedFlashcards(fData.content || []);
          }
        } else {
          setHasSessionData(false);
          setUserQuestions([]); // Clear user questions when no session data
          setAiSummary('No study activity detected in this session. Start chatting with the AI tutor to see your insights here.');
        }
      }
    } catch (err) {
      console.error('Error loading insights:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleQuestionClick = (question) => {
    navigate('/ai-chat', {
      state: { initialMessage: `Help me solve this: ${question.question}` },
    });
  };

  const handleFlashcardClick = async () => {
    if (generatedFlashcards.length === 0) return;
    
    try {
      const response = await fetch(`${API_URL}/flashcard_sets`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userName,
          title: `${mainTopic} - Practice`,
          description: `Generated from study insights`,
          flashcards: generatedFlashcards.map((card) => ({
            question: card.question,
            answer: card.answer,
            difficulty: card.difficulty || 'medium',
          })),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        navigate(`/flashcards?set_id=${data.set_id}`);
      }
    } catch (err) {
      console.error('Error saving flashcards:', err);
      navigate('/flashcards');
    }
  };

  const handleTopicPractice = (topicName) => {
    navigate('/ai-chat', {
      state: { initialMessage: `Give me practice problems for ${topicName}` },
    });
  };

  const getDisplayName = () => {
    const profile = localStorage.getItem('userProfile');
    if (profile) {
      try {
        const parsed = JSON.parse(profile);
        if (parsed.firstName) return parsed.firstName;
        if (parsed.first_name) return parsed.first_name;
      } catch (e) {}
    }
    if (userName && userName.includes('@')) {
      return userName.split('@')[0];
    }
    return userName || 'there';
  };

  if (loading) {
    return (
      <div className="study-insights-page">
        <div className="insights-loading">
          <span className="loading-text">ANALYZING YOUR STUDY SESSION</span>
          <div className="insights-spinner">
            <div className="spinner-cube"></div>
            <div className="spinner-cube"></div>
            <div className="spinner-cube"></div>
          </div>
        </div>
      </div>
    );
  }

  // Truncate long questions for display
  const truncateQuestion = (q, maxLen = 60) => {
    if (q.length <= maxLen) return q;
    return q.substring(0, maxLen) + '...';
  };

  return (
    <div className="study-insights-page">
      <header className="insights-header">
        <div className="header-content">
          <span className="header-username">{getDisplayName()}</span>
          <h1 className="header-title">study insights</h1>
          <div className="header-right">
            <button className="header-btn secondary" onClick={() => navigate('/search-hub')}>
              SEARCH HUB
            </button>
            <button className="header-btn primary" onClick={() => navigate('/dashboard')}>
              DASHBOARD
            </button>
          </div>
        </div>
      </header>

      <main className="insights-main">
        <div className="bento-grid">
          {/* Session Summary */}
          <div className="bento-item bento-summary">
            <h2 className="bento-title">SESSION SUMMARY</h2>
            <p className="summary-text">{aiSummary}</p>
          </div>

          {/* Practice Questions - always show */}
          <div className="bento-item bento-questions">
            <h2 className="bento-title">PRACTICE QUESTIONS</h2>
            {generatedQuestions.length > 0 ? (
              <div className="questions-list">
                {generatedQuestions.map((q, idx) => (
                  <div key={idx} className="question-card" onClick={() => handleQuestionClick(q)}>
                    <span className="question-num">{idx + 1}</span>
                    <p className="question-text">{q.question}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <p className="empty-text">No practice questions available</p>
                <p className="empty-hint">Start a study session to generate questions</p>
              </div>
            )}
          </div>

          {/* Flashcards - always show */}
          <div
            className="bento-item bento-flashcards-container"
            onClick={generatedFlashcards.length > 0 ? handleFlashcardClick : undefined}
            style={{ cursor: generatedFlashcards.length > 0 ? 'pointer' : 'default' }}
          >
            <h2 className="bento-title">{mainTopic ? `${mainTopic.toUpperCase()} FLASHCARDS` : 'FLASHCARDS'}</h2>
            {generatedFlashcards.length > 0 ? (
              <>
                <div className="flashcard-deck">
                  <div className="flashcard-stack">
                    {generatedFlashcards.slice(0, 3).map((card, idx) => (
                      <div key={idx} className="flashcard-card">
                        <p className="flashcard-front">{card.question}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flashcard-count">{generatedFlashcards.length} cards</div>
                </div>
                <span className="flashcard-cta">CLICK TO STUDY SET</span>
              </>
            ) : (
              <div className="empty-state">
                <p className="empty-text">No flashcards available</p>
                <p className="empty-hint">Start a study session to generate flashcards</p>
              </div>
            )}
          </div>

          {/* Questions Asked - only show if we have session data */}
          {hasSessionData && userQuestions.length > 0 && (
            <div className="bento-item bento-problems">
              <h2 className="bento-title">YOU ASKED</h2>
              <div className="problems-list">
                {userQuestions.slice(0, 6).map((question, idx) => (
                  <div key={idx} className="problem-row" onClick={() => handleTopicPractice(question)}>
                    <span className="problem-text">{truncateQuestion(question)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state CTA when no session data */}
          {!hasSessionData && (
            <div className="bento-item bento-empty">
              <h2 className="bento-title">GET STARTED</h2>
              <p className="empty-text">
                Start a conversation with the AI tutor to see your study insights here.
              </p>
              <button className="start-btn" onClick={() => navigate('/ai-chat')}>
                START STUDYING
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default StudyInsights;

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpinner';
import './StudyInsights.css';
import { API_URL } from '../config';

const StudyInsights = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [sessionSummary, setSessionSummary] = useState(null);
  const [aiSummary, setAiSummary] = useState('');
  const [generatedQuestions, setGeneratedQuestions] = useState([]);
  const [generatedFlashcards, setGeneratedFlashcards] = useState([]);
  const [loadingContent, setLoadingContent] = useState(false);
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
        setSessionSummary(summary);
        
        // Check if there's actual session data
        const topics = summary?.specific_topics || [];
        const messageCount = summary?.summary?.chat_messages || 0;
        const questions = summary?.user_questions || [];
        
        console.log('Session data:', { topics, messageCount, questions });
        
        setUserQuestions(questions);
        
        if (messageCount > 0 && topics.length > 0) {
          setHasSessionData(true);
          setMainTopic(topics[0].name);
          
          // Get AI summary
          const aiRes = await fetch(`${API_URL}/study_insights/ai_summary?user_id=${userName}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (aiRes.ok) {
            const aiData = await aiRes.json();
            setAiSummary(aiData.summary);
          }
          
          // Generate content for the main topic with context from actual questions
          generateContent(topics[0].name, questions.slice(0, 5).join('\n'));
        } else {
          setHasSessionData(false);
          setAiSummary('No study activity detected in this session. Start chatting with the AI tutor to see your insights here.');
        }
      }
    } catch (err) {
      console.error('Error loading insights:', err);
    } finally {
      setLoading(false);
    }
  };

  const generateContent = async (topic, context = '') => {
    if (!topic) return;
    
    setLoadingContent(true);
    try {
      // Generate questions based on the topic AND the actual questions asked
      const qRes = await fetch(`${API_URL}/study_insights/generate_content`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userName,
          content_type: 'quiz',
          topic: topic,
          count: 2,
          context: context,  // Pass actual questions as context
        }),
      });
      if (qRes.ok) {
        const data = await qRes.json();
        setGeneratedQuestions(data.content || []);
      }

      // Generate flashcards based on the topic
      const fRes = await fetch(`${API_URL}/study_insights/generate_content`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userName,
          content_type: 'flashcards',
          topic: topic,
          count: 3,
          context: context,  // Pass actual questions as context
        }),
      });
      if (fRes.ok) {
        const data = await fRes.json();
        setGeneratedFlashcards(data.content || []);
      }
    } catch (err) {
      console.error('Error generating content:', err);
    } finally {
      setLoadingContent(false);
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
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  const specificTopics = sessionSummary?.specific_topics || [];
  const mathProblems = sessionSummary?.math_problems || [];

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

          {/* Practice Questions - only show if we have session data */}
          {hasSessionData && (
            <div className="bento-item bento-questions">
              <h2 className="bento-title">PRACTICE QUESTIONS</h2>
              {loadingContent ? (
                <div className="bento-loading">
                  <LoadingSpinner />
                </div>
              ) : generatedQuestions.length > 0 ? (
                <div className="questions-list">
                  {generatedQuestions.map((q, idx) => (
                    <div key={idx} className="question-card" onClick={() => handleQuestionClick(q)}>
                      <span className="question-num">{idx + 1}</span>
                      <p className="question-text">{q.question}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="empty-text">No questions available</p>
              )}
            </div>
          )}

          {/* Flashcards - only show if we have session data */}
          {hasSessionData && (
            <div
              className="bento-item bento-flashcards-container"
              onClick={generatedFlashcards.length > 0 ? handleFlashcardClick : undefined}
              style={{ cursor: generatedFlashcards.length > 0 ? 'pointer' : 'default' }}
            >
              <h2 className="bento-title">{mainTopic.toUpperCase()} FLASHCARDS</h2>
              {loadingContent ? (
                <div className="bento-loading">
                  <LoadingSpinner />
                </div>
              ) : generatedFlashcards.length > 0 ? (
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
                <p className="empty-text">No flashcards available</p>
              )}
            </div>
          )}

          {/* Topics from this session - only show if we have topics */}
          {specificTopics.length > 0 && (
            <div className="bento-item bento-topics">
              <h2 className="bento-title">THIS SESSION</h2>
              <div className="topics-list">
                {specificTopics.map((topic, idx) => (
                  <div key={idx} className="topic-row" onClick={() => handleTopicPractice(topic.name)}>
                    <span className="topic-name">{topic.name}</span>
                    <span className="topic-count">{topic.count}x</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Questions Asked - Show actual user questions */}
          {userQuestions.length > 0 && (
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

          {/* Math Problems / Expressions - if any were extracted */}
          {mathProblems.length > 0 && (
            <div className="bento-item bento-expressions">
              <h2 className="bento-title">EXPRESSIONS</h2>
              <div className="problems-list">
                {mathProblems.map((problem, idx) => (
                  <div key={idx} className="problem-row" onClick={() => handleTopicPractice(problem.expression)}>
                    <code>{problem.expression}</code>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state when no session data */}
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

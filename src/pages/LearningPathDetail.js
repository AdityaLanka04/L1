import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader, Lock, CheckCircle, Circle, Play, Award,
  Clock, Target, BookOpen, MessageCircle, FileText, Brain,
  ChevronRight, ChevronLeft, Sparkles, Zap, Download, Calendar,
  Star, ExternalLink, Lightbulb, Map, TrendingUp, Code, Video,
  Headphones, Image as ImageIcon, Activity, GitBranch, Menu } from 'lucide-react';
import learningPathService from '../services/learningPathService';
import './LearningPathDetail.css';

const LearningPathDetail = () => {
  const navigate = useNavigate();
  const { pathId } = useParams();
  
  const [path, setPath] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  
  // User notes state
  const [userNote, setUserNote] = useState('');
  const [noteLoading, setNoteLoading] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);
  
  // Completion Quiz State
  const [showCompletionQuiz, setShowCompletionQuiz] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [currentQuizQuestion, setCurrentQuizQuestion] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizScore, setQuizScore] = useState(0);
  
  // Enhanced features state
  const [difficultyView, setDifficultyView] = useState('intermediate');
  const [resourceRatings, setResourceRatings] = useState({});
  const [completedResources, setCompletedResources] = useState([]);
  const [showExportMenu, setShowExportMenu] = useState(false);

  useEffect(() => {
    loadPathDetails();
  }, [pathId]);

  useEffect(() => {
    if (selectedNode) {
      loadNodeNote();
      // Load user's difficulty preference and resource progress
      if (selectedNode.progress) {
        setDifficultyView(selectedNode.progress.difficulty_view || 'intermediate');
        setResourceRatings(selectedNode.progress.resource_ratings || {});
        setCompletedResources(selectedNode.progress.resources_completed || []);
      }
    }
  }, [selectedNode]);

  const loadNodeNote = async () => {
    if (!selectedNode) return;
    
    try {
      const response = await learningPathService.getNodeNote(pathId, selectedNode.id);
      setUserNote(response.content || '');
    } catch (error) {
      console.error('Error loading note:', error);
    }
  };

  const handleSaveNote = async () => {
    if (!selectedNode) return;
    
    try {
      setNoteLoading(true);
      await learningPathService.saveNodeNote(pathId, selectedNode.id, userNote);
      setNoteSaved(true);
      setTimeout(() => setNoteSaved(false), 2000);
    } catch (error) {
      console.error('Error saving note:', error);
      alert('Failed to save note');
    } finally {
      setNoteLoading(false);
    }
  };

  const loadPathDetails = async () => {
    try {
      setLoading(true);
      const response = await learningPathService.getPath(pathId);
      setPath(response.path);
      setNodes(response.path.nodes || []);
      
      // Auto-select first unlocked/in-progress node
      const activeNode = response.path.nodes?.find(
        n => n.progress.status === 'unlocked' || n.progress.status === 'in_progress'
      );
      if (activeNode) {
        setSelectedNode(activeNode);
      }
    } catch (error) {
      console.error('Error loading path:', error);
      alert('Failed to load learning path');
      navigate('/learning-paths');
    } finally {
      setLoading(false);
    }
  };

  const handleStartNode = async (node) => {
    if (node.progress.status === 'locked') {
      alert('This node is locked. Complete previous nodes first.');
      return;
    }

    try {
      setActionLoading(true);
      await learningPathService.startNode(pathId, node.id);
      await loadPathDetails();
    } catch (error) {
      console.error('Error starting node:', error);
      alert('Failed to start node');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleteNode = async (node) => {
    if (node.progress.status === 'completed') {
      return;
    }

    try {
      setActionLoading(true);
      
      // Get completion quiz
      const quizResponse = await learningPathService.getCompletionQuiz(pathId, node.id);
      
      if (quizResponse.error) {
        alert('Failed to load completion quiz: ' + quizResponse.error);
        return;
      }
      
      // Show quiz modal
      setQuizQuestions(quizResponse.questions || []);
      setCurrentQuizQuestion(0);
      setQuizAnswers({});
      setQuizSubmitted(false);
      setQuizScore(0);
      setShowCompletionQuiz(true);
      
    } catch (error) {
      console.error('Error loading completion quiz:', error);
      alert('Failed to load completion quiz: ' + error.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleQuizAnswer = (questionIndex, answerIndex) => {
    setQuizAnswers({
      ...quizAnswers,
      [questionIndex]: answerIndex
    });
  };

  const handleQuizSubmit = async () => {
    // Calculate score
    let correct = 0;
    quizQuestions.forEach((q, idx) => {
      if (quizAnswers[idx] === q.correct_answer) {
        correct++;
      }
    });
    
    const score = Math.round((correct / quizQuestions.length) * 100);
    setQuizScore(score);
    setQuizSubmitted(true);
    
    // If passed, complete the node
    if (score >= 75) {
      try {
        setActionLoading(true);
        const response = await learningPathService.completeNode(
          pathId, 
          selectedNode.id,
          { 
            quiz_score: score,
            quiz_correct: correct,
            quiz_total: quizQuestions.length
          }
        );
        
        if (response.success) {
          setTimeout(() => {
            setShowCompletionQuiz(false);
            alert(`Node completed! +${response.xp_earned} XP`);
            loadPathDetails();
          }, 2000);
        }
      } catch (error) {
        console.error('Error completing node:', error);
        alert('Failed to complete node: ' + error.message);
      } finally {
        setActionLoading(false);
      }
    }
  };

  const handleQuizRetry = () => {
    setCurrentQuizQuestion(0);
    setQuizAnswers({});
    setQuizSubmitted(false);
    setQuizScore(0);
  };

  const handleQuizClose = () => {
    setShowCompletionQuiz(false);
    setQuizQuestions([]);
    setCurrentQuizQuestion(0);
    setQuizAnswers({});
    setQuizSubmitted(false);
    setQuizScore(0);
  };

  const handleDifficultyChange = async (newDifficulty) => {
    if (!selectedNode) return;
    
    try {
      await learningPathService.updateDifficultyView(pathId, selectedNode.id, newDifficulty);
      setDifficultyView(newDifficulty);
    } catch (error) {
      console.error('Error updating difficulty view:', error);
    }
  };

  const handleResourceRate = async (resourceId, rating) => {
    if (!selectedNode) return;
    
    try {
      await learningPathService.rateResource(pathId, selectedNode.id, resourceId, rating);
      setResourceRatings({ ...resourceRatings, [resourceId]: rating });
    } catch (error) {
      console.error('Error rating resource:', error);
    }
  };

  const handleResourceComplete = async (resourceId, timeSpent) => {
    if (!selectedNode) return;
    
    try {
      await learningPathService.markResourceCompleted(pathId, selectedNode.id, resourceId, timeSpent);
      setCompletedResources([...completedResources, resourceId]);
    } catch (error) {
      console.error('Error marking resource completed:', error);
    }
  };

  const handleExportToNotes = async () => {
    if (!selectedNode) return;
    
    try {
      setActionLoading(true);
      
      // Get the export data from backend
      const response = await learningPathService.exportToNotes(pathId, selectedNode.id, {
        include_resources: true,
        include_summary: true
      });
      
      // Create note directly via API (like Knowledge Roadmap does)
      const token = localStorage.getItem('token');
      const userName = localStorage.getItem('username');
      
      const createNoteResponse = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/api/create_note`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          user_id: userName,
          title: response.note_title,
          content: response.note_content
        })
      });

      if (createNoteResponse.ok) {
        const newNote = await createNoteResponse.json();
        const noteId = newNote.id || newNote.note_id;
        
        // Navigate to the newly created note
        navigate(`/notes/editor/${noteId}`);
      } else {
        throw new Error('Failed to create note');
      }
      
    } catch (error) {
      console.error('Error exporting to notes:', error);
      alert('Failed to export to notes');
    } finally {
      setActionLoading(false);
    }
  };

  const handleExportToFlashcards = async () => {
    if (!selectedNode) return;
    
    try {
      const response = await learningPathService.exportToFlashcards(pathId, selectedNode.id);
      
      // Navigate to flashcards with the exported deck
      navigate('/flashcards', {
        state: {
          generatedFlashcards: {
            title: response.deck_title,
            cards: response.flashcards,
            tags: response.tags
          }
        }
      });
    } catch (error) {
      console.error('Error exporting to flashcards:', error);
      alert('Failed to export to flashcards');
    }
  };

  const handleExportToCalendar = async () => {
    if (!selectedNode) return;
    
    const scheduledDate = prompt('Enter date and time (YYYY-MM-DDTHH:MM:SS):');
    if (!scheduledDate) return;
    
    try {
      const response = await learningPathService.exportToCalendar(pathId, selectedNode.id, {
        scheduled_date: scheduledDate,
        duration_minutes: selectedNode.estimated_minutes || 30
      });
      
      alert('Study session added to calendar!');
      // You can integrate with your calendar component here
    } catch (error) {
      console.error('Error exporting to calendar:', error);
      alert('Failed to add to calendar');
    }
  };

  const handleActivityClick = async (activity) => {
    if (!selectedNode || actionLoading) return;

    try {
      setActionLoading(true);

      const count = activity.count || activity.question_count || null;
      const response = await learningPathService.generateNodeContent(
        pathId,
        selectedNode.id,
        activity.type,
        count
      );

      if (response.error) {
        alert('Failed to generate content: ' + response.error);
        return;
      }

      // Mark activity as started in progress
      await learningPathService.updateNodeProgress(
        pathId,
        selectedNode.id,
        activity.type,
        false, // Not completed yet, just started
        { started_at: new Date().toISOString() }
      );

      // Reload to update checkmarks
      await loadPathDetails();

      // Route to appropriate page based on activity type
      switch (activity.type) {
        case 'notes':
          // Create note directly via API (like Knowledge Roadmap does)
          const token = localStorage.getItem('token');
          const userName = localStorage.getItem('username');
          
          const createNoteResponse = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/api/create_note`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              user_id: userName,
              title: `${path.title} - ${selectedNode.title}`,
              content: response.content
            })
          });

          if (createNoteResponse.ok) {
            const newNote = await createNoteResponse.json();
            const noteId = newNote.id || newNote.note_id;
            navigate(`/notes/editor/${noteId}`);
          } else {
            throw new Error('Failed to create note');
          }
          break;

        case 'flashcards':
          navigate('/flashcards', {
            state: {
              generatedFlashcards: {
                title: `${path.title} - ${selectedNode.title}`,
                cards: response.flashcards,
                fromLearningPath: true
              }
            }
          });
          break;

        case 'quiz':
          navigate('/question-bank', {
            state: {
              generatedQuestions: {
                title: `${path.title} - ${selectedNode.title}`,
                questions: response.questions,
                fromLearningPath: true
              }
            }
          });
          break;

        case 'chat':
          navigate('/ai-chat', {
            state: {
              initialMessage: `${response.prompt}\n\n[Context: Learning Path "${path.title}" - Node "${selectedNode.title}"]`
            }
          });
          break;

        default:
          alert('Unknown activity type');
      }

    } catch (error) {
      console.error('Error generating content:', error);
      alert('Failed to generate content: ' + error.message);
    } finally {
      setActionLoading(false);
    }
  };

  const getNodeStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle size={24} className="lp-node-icon-completed" />;
      case 'in_progress':
        return <Play size={24} className="lp-node-icon-progress" />;
      case 'unlocked':
        return <Circle size={24} className="lp-node-icon-unlocked" />;
      case 'locked':
      default:
        return <Lock size={24} className="lp-node-icon-locked" />;
    }
  };

  const getActivityIcon = (type) => {
    switch (type) {
      case 'notes': return <FileText size={18} />;
      case 'flashcards': return <Brain size={18} />;
      case 'quiz': return <Target size={18} />;
      case 'chat': return <MessageCircle size={18} />;
      default: return <BookOpen size={18} />;
    }
  };

  if (loading) {
    return (
      <div className="lpd-container">
        <div className="lpd-loading">
          <Loader className="lpd-spinner" size={40} />
          <p>Loading learning path...</p>
        </div>
      </div>
    );
  }

  if (!path) {
    return null;
  }

  return (
    <div className="lpd-container">
      {/* Loading Overlay */}
      {actionLoading && (
        <div className="lpd-loading-overlay">
          <div className="lpd-loading-content">
            <Loader className="lpd-spinner" size={48} />
            <h3>GENERATING CONTENT</h3>
            <p>Creating personalized learning materials</p>
          </div>
        </div>
      )}

      {/* Main Header with Path Info */}
      <div className="lpd-header">
        <div className="lpd-header-main">
          <div className="lpd-title-row">
            <button className="nav-menu-btn" onClick={() => window.openGlobalNav && window.openGlobalNav()} aria-label="Open navigation">
              <Menu size={20} />
            </button>
            <h1 className="lpd-title">{path.title.toUpperCase()}</h1>
            <button className="lpd-back-btn" onClick={() => navigate('/learning-paths')}>
              <ChevronLeft size={16} />
              <span>BACK</span>
            </button>
          </div>
          <p className="lpd-description">{path.description}</p>
        </div>
        
        <div className="lpd-header-stats">
          <div className="lpd-stat-badge lpd-difficulty" style={{
            backgroundColor: path.difficulty === 'beginner' ? '#4ade80' :
                           path.difficulty === 'advanced' ? '#f87171' : '#fbbf24'
          }}>
            {path.difficulty.toUpperCase()}
          </div>
          <div className="lpd-stat-badge">
            <Clock size={14} />
            <span>{Math.round(path.estimated_hours)}H</span>
          </div>
          <div className="lpd-stat-badge">
            <BookOpen size={14} />
            <span>{path.total_nodes} NODES</span>
          </div>
          <div className="lpd-stat-badge lpd-xp-badge">
            <Award size={14} />
            <span>{path.progress.total_xp_earned} XP</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="lpd-progress-section">
          <div className="lpd-progress-info">
            <span className="lpd-progress-label">OVERALL PROGRESS</span>
            <span className="lpd-progress-pct">{Math.round(path.progress.completion_percentage)}%</span>
          </div>
          <div className="lpd-progress-track">
            <div
              className="lpd-progress-bar"
              style={{ width: `${path.progress.completion_percentage}%` }}
            />
          </div>
          <div className="lpd-progress-details">
            <span><CheckCircle size={14} /> {path.completed_nodes} / {path.total_nodes} completed</span>
            <span><Award size={14} /> {path.progress.total_xp_earned} XP earned</span>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="lpd-main">
        {/* Left Sidebar - Path Map */}
        <div className="lpd-sidebar">
          <h3 className="lpd-sidebar-title">LEARNING PATH</h3>
          <div className="lpd-nodes">
            {nodes.map((node, index) => (
              <div key={node.id} className="lpd-node-item">
                {/* Connector */}
                {index < nodes.length - 1 && <div className="lpd-connector" />}
                
                {/* Node */}
                <div
                  className={`lpd-node ${
                    node.progress.status === 'locked' ? 'lpd-locked' : ''
                  } ${
                    selectedNode?.id === node.id ? 'lpd-active' : ''
                  }`}
                  onClick={() => node.progress.status !== 'locked' && setSelectedNode(node)}
                >
                  <div className="lpd-node-icon">
                    {getNodeStatusIcon(node.progress.status)}
                  </div>
                  
                  <div className="lpd-node-content">
                    <div className="lpd-node-header">
                      <span className="lpd-node-num">{index + 1}</span>
                      <h4>{node.title.toUpperCase()}</h4>
                    </div>
                    
                    {node.progress.status !== 'locked' && (
                      <div className="lpd-node-info">
                        <span><Clock size={12} /> {node.estimated_minutes}min</span>
                        {node.progress.xp_earned > 0 && (
                          <span className="lpd-xp"><Award size={12} /> +{node.progress.xp_earned}</span>
                        )}
                      </div>
                    )}
                    
                    {node.progress.status === 'in_progress' && (
                      <div className="lpd-node-progress">
                        <div className="lpd-progress-mini">
                          <div
                            className="lpd-progress-mini-fill"
                            style={{ width: `${node.progress.progress_pct}%` }}
                          />
                        </div>
                        <span className="lpd-progress-mini-text">{node.progress.progress_pct}%</span>
                      </div>
                    )}
                  </div>
                  
                  {selectedNode?.id === node.id && (
                    <ChevronRight size={16} className="lpd-node-chevron" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Panel - Node Details */}
        <div className="lpd-details">
          {selectedNode ? (
            <>
              <div className="lpd-details-head">
                <div className="lpd-details-info">
                  <h2>{selectedNode.title.toUpperCase()}</h2>
                  <p>{selectedNode.description}</p>
                </div>
                <div className="lpd-status-badge">
                  {getNodeStatusIcon(selectedNode.progress.status)}
                  <span>{selectedNode.progress.status.replace('_', ' ').toUpperCase()}</span>
                </div>
              </div>

              {/* Introduction Section */}
              {selectedNode.introduction && (
                <div className="lpd-block lpd-introduction-block">
                  <h3 className="lpd-block-title">
                    <Lightbulb size={16} />
                    WHY THIS MATTERS
                  </h3>
                  <div className="lpd-introduction-content">
                    <p>{selectedNode.introduction}</p>
                  </div>
                </div>
              )}

              {/* Difficulty View Toggle */}
              <div className="lpd-block lpd-difficulty-toggle">
                <h3 className="lpd-block-title">
                  <TrendingUp size={16} />
                  DIFFICULTY LEVEL
                </h3>
                <div className="lpd-difficulty-buttons">
                  <button
                    className={`lpd-difficulty-btn ${difficultyView === 'beginner' ? 'active' : ''}`}
                    onClick={() => handleDifficultyChange('beginner')}
                  >
                    Beginner
                  </button>
                  <button
                    className={`lpd-difficulty-btn ${difficultyView === 'intermediate' ? 'active' : ''}`}
                    onClick={() => handleDifficultyChange('intermediate')}
                  >
                    Intermediate
                  </button>
                  <button
                    className={`lpd-difficulty-btn ${difficultyView === 'advanced' ? 'active' : ''}`}
                    onClick={() => handleDifficultyChange('advanced')}
                  >
                    Advanced
                  </button>
                </div>
              </div>

              {/* Core Content Sections */}
              {selectedNode.core_sections && selectedNode.core_sections.length > 0 && (
                <div className="lpd-block">
                  <h3 className="lpd-block-title">
                    <BookOpen size={16} />
                    CORE CONTENT
                  </h3>
                  <div className="lpd-core-sections">
                    {selectedNode.core_sections.map((section, idx) => (
                      <details key={idx} className="lpd-section-accordion" open={idx === 0}>
                        <summary className="lpd-section-header">
                          <span className="lpd-section-number">{idx + 1}</span>
                          <span className="lpd-section-title">{section.title}</span>
                          <ChevronRight size={14} className="lpd-section-chevron" />
                        </summary>
                        <div className="lpd-section-content">
                          <p className="lpd-section-text">{section.content}</p>
                          {section.example && (
                            <div className="lpd-section-example">
                              <strong>Example:</strong> {section.example}
                            </div>
                          )}
                          {section.visual_description && (
                            <div className="lpd-section-visual">
                              <ImageIcon size={14} />
                              <span>{section.visual_description}</span>
                            </div>
                          )}
                          {section.practice_question && (
                            <div className="lpd-section-practice">
                              <Target size={14} />
                              <span><strong>Quick Check:</strong> {section.practice_question}</span>
                            </div>
                          )}
                        </div>
                      </details>
                    ))}
                  </div>
                </div>
              )}

              {/* Connection Map */}
              {selectedNode.connection_map && Object.keys(selectedNode.connection_map).length > 0 && (
                <div className="lpd-block">
                  <h3 className="lpd-block-title">
                    <GitBranch size={16} />
                    HOW THIS CONNECTS
                  </h3>
                  <div className="lpd-connection-map">
                    {selectedNode.connection_map.builds_on && selectedNode.connection_map.builds_on.length > 0 && (
                      <div className="lpd-connection-section">
                        <h4>Builds On:</h4>
                        <ul>
                          {selectedNode.connection_map.builds_on.map((item, idx) => (
                            <li key={idx}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {selectedNode.connection_map.leads_to && selectedNode.connection_map.leads_to.length > 0 && (
                      <div className="lpd-connection-section">
                        <h4>Leads To:</h4>
                        <ul>
                          {selectedNode.connection_map.leads_to.map((item, idx) => (
                            <li key={idx}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {selectedNode.connection_map.related_topics && selectedNode.connection_map.related_topics.length > 0 && (
                      <div className="lpd-connection-section">
                        <h4>Related Topics:</h4>
                        <ul>
                          {selectedNode.connection_map.related_topics.map((item, idx) => (
                            <li key={idx}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Real-World Applications */}
              {selectedNode.real_world_applications && selectedNode.real_world_applications.length > 0 && (
                <div className="lpd-block">
                  <h3 className="lpd-block-title">
                    <Sparkles size={16} />
                    REAL-WORLD APPLICATIONS
                  </h3>
                  <div className="lpd-applications">
                    {selectedNode.real_world_applications.map((app, idx) => (
                      <div key={idx} className="lpd-application-item">
                        <div className="lpd-application-icon">
                          <Lightbulb size={16} />
                        </div>
                        <p>{app}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Summary Section */}
              {selectedNode.summary && selectedNode.summary.length > 0 && (
                <div className="lpd-block lpd-summary-block">
                  <h3 className="lpd-block-title">
                    <CheckCircle size={16} />
                    KEY TAKEAWAYS
                  </h3>
                  <ul className="lpd-summary-list">
                    {selectedNode.summary.map((item, idx) => (
                      <li key={idx}>
                        <CheckCircle size={12} />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Objectives Section */}
              <div className="lpd-block">
                <h3 className="lpd-block-title">
                  <Target size={16} />
                  LEARNING OBJECTIVES
                </h3>
                <ul className="lpd-objectives">
                  {selectedNode.objectives?.map((obj, i) => (
                    <li key={i}>
                      <CheckCircle size={14} />
                      <span>{obj}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Prerequisites Section */}
              {selectedNode.prerequisites && selectedNode.prerequisites.length > 0 && (
                <div className="lpd-block">
                  <h3 className="lpd-block-title">
                    <BookOpen size={16} />
                    PREREQUISITES
                  </h3>
                  <ul className="lpd-prerequisites">
                    {selectedNode.prerequisites.map((prereq, i) => (
                      <li key={i}>
                        <Circle size={12} />
                        <span>{prereq}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Resources Section - TEMPORARILY DISABLED (waiting for search API key) */}
              {/* 
              {((selectedNode.primary_resources && selectedNode.primary_resources.length > 0) ||
                (selectedNode.supplementary_resources && selectedNode.supplementary_resources.length > 0) ||
                (selectedNode.practice_resources && selectedNode.practice_resources.length > 0) ||
                (selectedNode.resources && selectedNode.resources.length > 0)) && (
                <div className="lpd-block">
                  <h3 className="lpd-block-title">
                    <Sparkles size={16} />
                    LEARNING RESOURCES
                  </h3>
                  
                  {selectedNode.primary_resources && selectedNode.primary_resources.length > 0 && (
                    <div className="lpd-resource-category">
                      <h4 className="lpd-resource-category-title">Required Resources</h4>
                      <div className="lpd-resources">
                        {selectedNode.primary_resources.map((resource, i) => (
                          <div key={i} className="lpd-resource-wrapper">
                            <a
                              href={resource.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="lpd-resource-item"
                            >
                              <div className="lpd-resource-icon">
                                {resource.type === 'video' && <Video size={16} />}
                                {resource.type === 'article' && <FileText size={16} />}
                                {resource.type === 'documentation' && <BookOpen size={16} />}
                                {resource.type === 'interactive' && <Activity size={16} />}
                                {!resource.type && <FileText size={16} />}
                              </div>
                              <div className="lpd-resource-info">
                                <h4>{resource.title}</h4>
                                {resource.description && <p>{resource.description}</p>}
                                <div className="lpd-resource-meta">
                                  {resource.estimated_minutes && (
                                    <span className="lpd-resource-time">
                                      <Clock size={10} /> {resource.estimated_minutes} min
                                    </span>
                                  )}
                                  {resource.difficulty && (
                                    <span className={`lpd-resource-difficulty lpd-diff-${resource.difficulty}`}>
                                      {resource.difficulty}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <ExternalLink size={14} />
                            </a>
                            <div className="lpd-resource-actions">
                              <div className="lpd-resource-rating">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <Star
                                    key={star}
                                    size={14}
                                    className={`lpd-star ${resourceRatings[resource.url] >= star ? 'filled' : ''}`}
                                    onClick={() => handleResourceRate(resource.url, star)}
                                  />
                                ))}
                              </div>
                              {!completedResources.includes(resource.url) && (
                                <button
                                  className="lpd-resource-complete-btn"
                                  onClick={() => handleResourceComplete(resource.url, resource.estimated_minutes || 15)}
                                >
                                  <CheckCircle size={12} /> Mark Complete
                                </button>
                              )}
                              {completedResources.includes(resource.url) && (
                                <span className="lpd-resource-completed">
                                  <CheckCircle size={12} /> Completed
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedNode.supplementary_resources && selectedNode.supplementary_resources.length > 0 && (
                    <div className="lpd-resource-category">
                      <h4 className="lpd-resource-category-title">Optional Resources</h4>
                      <div className="lpd-resources">
                        {selectedNode.supplementary_resources.map((resource, i) => (
                          <div key={i} className="lpd-resource-wrapper">
                            <a
                              href={resource.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="lpd-resource-item lpd-resource-optional"
                            >
                              <div className="lpd-resource-icon">
                                {resource.type === 'video' && <Video size={16} />}
                                {resource.type === 'article' && <FileText size={16} />}
                                {resource.type === 'audio' && <Headphones size={16} />}
                                {!resource.type && <FileText size={16} />}
                              </div>
                              <div className="lpd-resource-info">
                                <h4>{resource.title}</h4>
                                {resource.description && <p>{resource.description}</p>}
                                {resource.estimated_minutes && (
                                  <span className="lpd-resource-time">
                                    <Clock size={10} /> {resource.estimated_minutes} min
                                  </span>
                                )}
                              </div>
                              <ExternalLink size={14} />
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedNode.practice_resources && selectedNode.practice_resources.length > 0 && (
                    <div className="lpd-resource-category">
                      <h4 className="lpd-resource-category-title">Practice & Exercises</h4>
                      <div className="lpd-resources">
                        {selectedNode.practice_resources.map((resource, i) => (
                          <div key={i} className="lpd-practice-item">
                            <div className="lpd-practice-icon">
                              <Target size={16} />
                            </div>
                            <div className="lpd-practice-info">
                              <h4>{resource.title}</h4>
                              <p>{resource.description}</p>
                              {resource.difficulty && (
                                <span className={`lpd-resource-difficulty lpd-diff-${resource.difficulty}`}>
                                  {resource.difficulty}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {!selectedNode.primary_resources && selectedNode.resources && selectedNode.resources.length > 0 && (
                    <div className="lpd-resources">
                      {selectedNode.resources.map((resource, i) => (
                        <a
                          key={i}
                          href={resource.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="lpd-resource-item"
                        >
                          <div className="lpd-resource-icon">
                            {resource.type === 'video' && <Play size={16} />}
                            {resource.type === 'article' && <FileText size={16} />}
                            {resource.type === 'documentation' && <BookOpen size={16} />}
                            {!resource.type && <FileText size={16} />}
                          </div>
                          <div className="lpd-resource-info">
                            <h4>{resource.title}</h4>
                            {resource.description && <p>{resource.description}</p>}
                          </div>
                          <ChevronRight size={14} />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}
              */}

              {/* Activities Section */}
              <div className="lpd-block">
                <h3 className="lpd-block-title">
                  <Sparkles size={16} />
                  ACTIVITIES
                </h3>
                <div className="lpd-activities">
                  {selectedNode.content_plan?.map((activity, i) => {
                    const isCompleted = selectedNode.progress?.evidence?.[activity.type]?.completed;
                    return (
                      <div 
                        key={i} 
                        className={`lpd-activity ${isCompleted ? 'lpd-activity-completed' : ''}`}
                        onClick={() => handleActivityClick(activity)}
                      >
                        <div className="lpd-activity-icon">
                          {getActivityIcon(activity.type)}
                        </div>
                        <div className="lpd-activity-info">
                          <h4>{activity.type.toUpperCase()}</h4>
                          <p>{activity.description}</p>
                          {(activity.count || activity.question_count) && (
                            <span className="lpd-activity-count">
                              {activity.count || activity.question_count} {activity.count ? 'items' : 'questions'}
                            </span>
                          )}
                        </div>
                        {isCompleted ? (
                          <CheckCircle size={16} className="lpd-activity-check" />
                        ) : (
                          <ChevronRight size={16} className="lpd-activity-chevron" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* User Notes Section */}
              <div className="lpd-block">
                <h3 className="lpd-block-title">
                  <FileText size={16} />
                  MY NOTES
                </h3>
                <div className="lpd-notes-section">
                  <textarea
                    className="lpd-notes-textarea"
                    placeholder="Write your notes, reflections, or key takeaways here..."
                    value={userNote}
                    onChange={(e) => setUserNote(e.target.value)}
                    rows={6}
                  />
                  <button
                    className="lpd-btn lpd-btn-save-note"
                    onClick={handleSaveNote}
                    disabled={noteLoading}
                  >
                    {noteLoading ? (
                      <>
                        <Loader className="lpd-spinner" size={14} />
                        Saving...
                      </>
                    ) : noteSaved ? (
                      <>
                        <CheckCircle size={14} />
                        Saved!
                      </>
                    ) : (
                      <>
                        <FileText size={14} />
                        Save Note
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Reward Section */}
              <div className="lpd-block">
                <h3 className="lpd-block-title">
                  <Award size={16} />
                  COMPLETION REWARD
                </h3>
                <div className="lpd-reward">
                  <Zap size={24} />
                  <span>+{selectedNode.reward?.xp || 50} XP</span>
                </div>
              </div>

              {/* Export Options */}
              <div className="lpd-block">
                <h3 className="lpd-block-title">
                  <Download size={16} />
                  EXPORT & INTEGRATE
                </h3>
                <div className="lpd-export-buttons">
                  <button className="lpd-export-btn" onClick={handleExportToNotes}>
                    <FileText size={14} />
                    <span>Export to Notes</span>
                  </button>
                  <button className="lpd-export-btn" onClick={handleExportToFlashcards}>
                    <Brain size={14} />
                    <span>Export to Flashcards</span>
                  </button>
                  <button className="lpd-export-btn" onClick={handleExportToCalendar}>
                    <Calendar size={14} />
                    <span>Add to Calendar</span>
                  </button>
                </div>
              </div>

              {/* Scenarios Section */}
              {selectedNode.scenarios && selectedNode.scenarios.length > 0 && (
                <div className="lpd-block">
                  <h3 className="lpd-block-title">
                    <Map size={16} />
                    PRACTICE SCENARIOS
                  </h3>
                  <div className="lpd-scenarios">
                    {selectedNode.scenarios.map((scenario, idx) => (
                      <details key={idx} className="lpd-scenario-item">
                        <summary className="lpd-scenario-header">
                          <span className="lpd-scenario-title">{scenario.title}</span>
                          <ChevronRight size={14} />
                        </summary>
                        <div className="lpd-scenario-content">
                          <p className="lpd-scenario-description">{scenario.description}</p>
                          <p className="lpd-scenario-question"><strong>Question:</strong> {scenario.question}</p>
                          {scenario.options && (
                            <div className="lpd-scenario-options">
                              {scenario.options.map((option, optIdx) => (
                                <div
                                  key={optIdx}
                                  className={`lpd-scenario-option ${optIdx === scenario.correct ? 'correct' : ''}`}
                                >
                                  <span className="lpd-option-letter">{String.fromCharCode(65 + optIdx)}</span>
                                  <span>{option}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {scenario.explanation && (
                            <div className="lpd-scenario-explanation">
                              <strong>Explanation:</strong> {scenario.explanation}
                            </div>
                          )}
                        </div>
                      </details>
                    ))}
                  </div>
                </div>
              )}

              {/* Concept Mapping */}
              {selectedNode.concept_mapping && selectedNode.concept_mapping.concepts && selectedNode.concept_mapping.concepts.length > 0 && (
                <div className="lpd-block">
                  <h3 className="lpd-block-title">
                    <GitBranch size={16} />
                    CONCEPT MAP
                  </h3>
                  <div className="lpd-concept-map">
                    <div className="lpd-concepts">
                      {selectedNode.concept_mapping.concepts.map((concept, idx) => (
                        <div key={idx} className="lpd-concept-bubble">
                          {concept}
                        </div>
                      ))}
                    </div>
                    {selectedNode.concept_mapping.relationships && selectedNode.concept_mapping.relationships.length > 0 && (
                      <div className="lpd-relationships">
                        <h5>Relationships:</h5>
                        <ul>
                          {selectedNode.concept_mapping.relationships.map((rel, idx) => (
                            <li key={idx}>{rel}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="lpd-actions">
                {selectedNode.progress.status === 'unlocked' && (
                  <button
                    className="lpd-btn lpd-btn-start"
                    onClick={() => handleStartNode(selectedNode)}
                    disabled={actionLoading}
                  >
                    {actionLoading ? (
                      <Loader className="lpd-spinner" size={14} />
                    ) : (
                      <>
                        <Play size={14} />
                        <span>START NODE</span>
                      </>
                    )}
                  </button>
                )}
                
                {selectedNode.progress.status === 'in_progress' && (
                  <button
                    className="lpd-btn lpd-btn-complete"
                    onClick={() => handleCompleteNode(selectedNode)}
                    disabled={actionLoading}
                  >
                    {actionLoading ? (
                      <Loader className="lpd-spinner" size={14} />
                    ) : (
                      <>
                        <CheckCircle size={14} />
                        <span>COMPLETE NODE</span>
                      </>
                    )}
                  </button>
                )}
                
                {selectedNode.progress.status === 'completed' && (
                  <div className="lpd-completed">
                    <CheckCircle size={18} />
                    <span>COMPLETED</span>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="lpd-empty">
              <BookOpen size={48} />
              <p>SELECT A NODE TO VIEW DETAILS</p>
            </div>
          )}
        </div>
      </div>

      {/* Completion Quiz Modal */}
      {showCompletionQuiz && (
        <div className="lpd-quiz-overlay">
          <div className="lpd-quiz-modal">
            <div className="lpd-quiz-header">
              <h2>COMPLETION QUIZ</h2>
              <p>Score 75% or higher to complete this node</p>
            </div>

            {!quizSubmitted ? (
              <>
                <div className="lpd-quiz-progress">
                  <span>Question {currentQuizQuestion + 1} of {quizQuestions.length}</span>
                  <div className="lpd-quiz-progress-bar">
                    <div 
                      className="lpd-quiz-progress-fill"
                      style={{ width: `${((currentQuizQuestion + 1) / quizQuestions.length) * 100}%` }}
                    />
                  </div>
                </div>

                {quizQuestions[currentQuizQuestion] && (
                  <div className="lpd-quiz-question">
                    <h3>{quizQuestions[currentQuizQuestion].question}</h3>
                    <div className="lpd-quiz-options">
                      {quizQuestions[currentQuizQuestion].options?.map((option, idx) => (
                        <button
                          key={idx}
                          className={`lpd-quiz-option ${quizAnswers[currentQuizQuestion] === idx ? 'selected' : ''}`}
                          onClick={() => handleQuizAnswer(currentQuizQuestion, idx)}
                        >
                          <span className="lpd-option-letter">{String.fromCharCode(65 + idx)}</span>
                          <span className="lpd-option-text">{option}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="lpd-quiz-actions">
                  <button 
                    className="lpd-btn lpd-btn-secondary"
                    onClick={handleQuizClose}
                  >
                    Cancel
                  </button>
                  
                  {currentQuizQuestion > 0 && (
                    <button
                      className="lpd-btn lpd-btn-secondary"
                      onClick={() => setCurrentQuizQuestion(currentQuizQuestion - 1)}
                    >
                      <ChevronLeft size={16} />
                      Previous
                    </button>
                  )}
                  
                  {currentQuizQuestion < quizQuestions.length - 1 ? (
                    <button
                      className="lpd-btn lpd-btn-primary"
                      onClick={() => setCurrentQuizQuestion(currentQuizQuestion + 1)}
                      disabled={quizAnswers[currentQuizQuestion] === undefined}
                    >
                      Next
                      <ChevronRight size={16} />
                    </button>
                  ) : (
                    <button
                      className="lpd-btn lpd-btn-complete"
                      onClick={handleQuizSubmit}
                      disabled={Object.keys(quizAnswers).length !== quizQuestions.length || actionLoading}
                    >
                      {actionLoading ? (
                        <>
                          <Loader className="lpd-spinner" size={14} />
                          Submitting...
                        </>
                      ) : (
                        <>
                          <CheckCircle size={16} />
                          Submit Quiz
                        </>
                      )}
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="lpd-quiz-results">
                <div className={`lpd-quiz-score ${quizScore >= 75 ? 'passed' : 'failed'}`}>
                  <div className="lpd-score-circle">
                    <span className="lpd-score-number">{quizScore}%</span>
                  </div>
                  <h3>{quizScore >= 75 ? 'PASSED!' : 'NOT PASSED'}</h3>
                  <p>
                    {quizScore >= 75 
                      ? 'Congratulations! You can now complete this node.'
                      : 'You need 75% or higher. Review the material and try again.'}
                  </p>
                </div>

                <div className="lpd-quiz-breakdown">
                  <h4>QUIZ BREAKDOWN</h4>
                  {quizQuestions.map((q, idx) => {
                    const userAnswer = quizAnswers[idx];
                    const isCorrect = userAnswer === q.correct_answer;
                    return (
                      <div key={idx} className={`lpd-quiz-item ${isCorrect ? 'correct' : 'incorrect'}`}>
                        <div className="lpd-quiz-item-header">
                          {isCorrect ? <CheckCircle size={16} /> : <Circle size={16} />}
                          <span>Question {idx + 1}</span>
                        </div>
                        <p className="lpd-quiz-item-question">{q.question}</p>
                        {!isCorrect && (
                          <div className="lpd-quiz-item-answer">
                            <p><strong>Your answer:</strong> {q.options[userAnswer]}</p>
                            <p><strong>Correct answer:</strong> {q.options[q.correct_answer]}</p>
                            {q.explanation && <p className="lpd-explanation">{q.explanation}</p>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="lpd-quiz-actions">
                  {quizScore >= 75 ? (
                    <button
                      className="lpd-btn lpd-btn-complete"
                      onClick={handleQuizClose}
                      disabled={actionLoading}
                    >
                      {actionLoading ? (
                        <>
                          <Loader className="lpd-spinner" size={14} />
                          Completing...
                        </>
                      ) : (
                        'Continue'
                      )}
                    </button>
                  ) : (
                    <>
                      <button
                        className="lpd-btn lpd-btn-secondary"
                        onClick={handleQuizClose}
                      >
                        Review Material
                      </button>
                      <button
                        className="lpd-btn lpd-btn-primary"
                        onClick={handleQuizRetry}
                      >
                        Retry Quiz
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LearningPathDetail;

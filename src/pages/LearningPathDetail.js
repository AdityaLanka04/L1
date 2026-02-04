import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Loader, Lock, CheckCircle, Circle, Play, Award,
  Clock, Target, BookOpen, MessageCircle, FileText, Brain,
  ChevronRight, ChevronLeft, Sparkles, Zap
} from 'lucide-react';
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

  useEffect(() => {
    loadPathDetails();
  }, [pathId]);

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

    if (!window.confirm('Mark this node as completed?')) {
      return;
    }

    try {
      setActionLoading(true);
      const response = await learningPathService.completeNode(pathId, node.id);
      
      if (response.success) {
        alert(`🎉 Node completed! +${response.xp_earned} XP`);
        await loadPathDetails();
      }
    } catch (error) {
      console.error('Error completing node:', error);
      alert('Failed to complete node');
    } finally {
      setActionLoading(false);
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

      // Route to appropriate page based on activity type
      switch (activity.type) {
        case 'notes':
          // Navigate to notes page with generated content
          // The notes page should handle this in a useEffect checking location.state
          navigate('/notes/my-notes', {
            state: {
              generatedNote: {
                title: `${path.title} - ${selectedNode.title}`,
                content: response.content,
                fromLearningPath: true
              }
            }
          });
          break;

        case 'flashcards':
          // Navigate to flashcards page with generated cards
          // The flashcards page should handle this in a useEffect checking location.state
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
          // Navigate to question bank with generated questions
          // The question bank page should handle this in a useEffect checking location.state
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
          // Navigate to AI chat with discussion prompt
          // AI Chat already handles location.state.initialMessage
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

              {/* Activities Section */}
              <div className="lpd-block">
                <h3 className="lpd-block-title">
                  <Sparkles size={16} />
                  ACTIVITIES
                </h3>
                <div className="lpd-activities">
                  {selectedNode.content_plan?.map((activity, i) => (
                    <div 
                      key={i} 
                      className="lpd-activity"
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
                      <ChevronRight size={16} className="lpd-activity-chevron" />
                    </div>
                  ))}
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
    </div>
  );
};

export default LearningPathDetail;

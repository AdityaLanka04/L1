import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Loader, Lock, CheckCircle, Circle, Play, Award,
  Clock, Target, BookOpen, MessageCircle, FileText, Brain,
  ChevronRight, Sparkles, Zap
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
            <h3>Generating Content...</h3>
            <p>Creating personalized learning materials for you</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="lpd-header">
        <button className="lpd-back-btn" onClick={() => navigate('/learning-paths')}>
          <ArrowLeft size={20} />
        </button>
        <div className="lpd-header-content">
          <h1>{path.title}</h1>
          <p>{path.description}</p>
          <div className="lpd-header-meta">
            <span className="lpd-difficulty" style={{
              backgroundColor: path.difficulty === 'beginner' ? '#4ade80' :
                             path.difficulty === 'advanced' ? '#f87171' : '#fbbf24'
            }}>
              {path.difficulty}
            </span>
            <span><Clock size={16} /> {Math.round(path.estimated_hours)}h</span>
            <span><BookOpen size={16} /> {path.total_nodes} nodes</span>
            <span><Award size={16} /> {path.progress.total_xp_earned} XP</span>
          </div>
        </div>
      </div>

      {/* Progress Overview */}
      <div className="lpd-progress-card">
        <div className="lpd-progress-header">
          <h3>Overall Progress</h3>
          <span className="lpd-progress-percentage">
            {Math.round(path.progress.completion_percentage)}%
          </span>
        </div>
        <div className="lpd-progress-bar">
          <div
            className="lpd-progress-fill"
            style={{ width: `${path.progress.completion_percentage}%` }}
          />
        </div>
        <div className="lpd-progress-stats">
          <div className="lpd-stat">
            <CheckCircle size={16} />
            <span>{path.completed_nodes} / {path.total_nodes} completed</span>
          </div>
          <div className="lpd-stat">
            <Award size={16} />
            <span>{path.progress.total_xp_earned} XP earned</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="lpd-content">
        {/* Path Map (Left Side) */}
        <div className="lpd-path-map">
          <h3>Learning Path</h3>
          <div className="lpd-nodes-list">
            {nodes.map((node, index) => (
              <div key={node.id} className="lpd-node-wrapper">
                {/* Connector Line */}
                {index < nodes.length - 1 && (
                  <div className="lpd-node-connector" />
                )}
                
                {/* Node Card */}
                <div
                  className={`lpd-node-card ${
                    node.progress.status === 'locked' ? 'lpd-node-locked' : ''
                  } ${
                    selectedNode?.id === node.id ? 'lpd-node-selected' : ''
                  }`}
                  onClick={() => node.progress.status !== 'locked' && setSelectedNode(node)}
                >
                  <div className="lpd-node-icon-wrapper">
                    {getNodeStatusIcon(node.progress.status)}
                  </div>
                  
                  <div className="lpd-node-info">
                    <div className="lpd-node-title">
                      <span className="lpd-node-number">{index + 1}</span>
                      <h4>{node.title}</h4>
                    </div>
                    
                    {node.progress.status !== 'locked' && (
                      <div className="lpd-node-meta">
                        <span><Clock size={14} /> {node.estimated_minutes}min</span>
                        {node.progress.xp_earned > 0 && (
                          <span className="lpd-node-xp">
                            <Award size={14} /> +{node.progress.xp_earned}
                          </span>
                        )}
                      </div>
                    )}
                    
                    {node.progress.status === 'in_progress' && (
                      <div className="lpd-node-progress-mini">
                        <div className="lpd-progress-bar-mini">
                          <div
                            className="lpd-progress-fill-mini"
                            style={{ width: `${node.progress.progress_pct}%` }}
                          />
                        </div>
                        <span>{node.progress.progress_pct}%</span>
                      </div>
                    )}
                  </div>
                  
                  {selectedNode?.id === node.id && (
                    <ChevronRight size={20} className="lpd-node-arrow" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Node Details (Right Side) */}
        <div className="lpd-node-details">
          {selectedNode ? (
            <>
              <div className="lpd-details-header">
                <div>
                  <h2>{selectedNode.title}</h2>
                  <p>{selectedNode.description}</p>
                </div>
                <div className="lpd-details-status">
                  {getNodeStatusIcon(selectedNode.progress.status)}
                  <span>{selectedNode.progress.status.replace('_', ' ')}</span>
                </div>
              </div>

              {/* Objectives */}
              <div className="lpd-section">
                <h3>
                  <Target size={20} />
                  Learning Objectives
                </h3>
                <ul className="lpd-objectives-list">
                  {selectedNode.objectives?.map((obj, i) => (
                    <li key={i}>
                      <CheckCircle size={16} />
                      {obj}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Activities */}
              <div className="lpd-section">
                <h3>
                  <Sparkles size={20} />
                  Activities
                </h3>
                <div className="lpd-activities-list">
                  {selectedNode.content_plan?.map((activity, i) => (
                    <div 
                      key={i} 
                      className="lpd-activity-card lpd-activity-clickable"
                      onClick={() => handleActivityClick(activity)}
                    >
                      <div className="lpd-activity-icon">
                        {getActivityIcon(activity.type)}
                      </div>
                      <div className="lpd-activity-content">
                        <h4>{activity.type.charAt(0).toUpperCase() + activity.type.slice(1)}</h4>
                        <p>{activity.description}</p>
                        {activity.count && (
                          <span className="lpd-activity-meta">{activity.count} items</span>
                        )}
                        {activity.question_count && (
                          <span className="lpd-activity-meta">{activity.question_count} questions</span>
                        )}
                      </div>
                      <ChevronRight size={18} className="lpd-activity-arrow" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Reward */}
              <div className="lpd-section">
                <h3>
                  <Award size={20} />
                  Completion Reward
                </h3>
                <div className="lpd-reward-card">
                  <Zap size={24} />
                  <span>+{selectedNode.reward?.xp || 50} XP</span>
                </div>
              </div>

              {/* Actions */}
              <div className="lpd-actions">
                {selectedNode.progress.status === 'unlocked' && (
                  <button
                    className="lpd-btn-primary"
                    onClick={() => handleStartNode(selectedNode)}
                    disabled={actionLoading}
                  >
                    {actionLoading ? (
                      <Loader className="lpd-spinner" size={16} />
                    ) : (
                      <>
                        <Play size={16} />
                        Start Node
                      </>
                    )}
                  </button>
                )}
                
                {selectedNode.progress.status === 'in_progress' && (
                  <button
                    className="lpd-btn-success"
                    onClick={() => handleCompleteNode(selectedNode)}
                    disabled={actionLoading}
                  >
                    {actionLoading ? (
                      <Loader className="lpd-spinner" size={16} />
                    ) : (
                      <>
                        <CheckCircle size={16} />
                        Complete Node
                      </>
                    )}
                  </button>
                )}
                
                {selectedNode.progress.status === 'completed' && (
                  <div className="lpd-completed-badge">
                    <CheckCircle size={20} />
                    <span>Completed</span>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="lpd-no-selection">
              <BookOpen size={48} />
              <p>Select a node to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LearningPathDetail;

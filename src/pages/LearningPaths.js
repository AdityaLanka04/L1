import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Plus, Loader, BookOpen, Target, Clock, Award,
  TrendingUp, CheckCircle, Lock, Play, Trash2, MoreVertical,
  Sparkles, Route, Map, GraduationCap, Star, Circle
} from 'lucide-react';
import learningPathService from '../services/learningPathService';
import './LearningPaths.css';

const LearningPaths = () => {
  const navigate = useNavigate();
  const [paths, setPaths] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [generating, setGenerating] = useState(false);
  
  // Create form state
  const [topicPrompt, setTopicPrompt] = useState('');
  const [difficulty, setDifficulty] = useState('intermediate');
  const [length, setLength] = useState('medium');
  const [goals, setGoals] = useState('');

  useEffect(() => {
    loadPaths();
  }, []);

  const loadPaths = async () => {
    try {
      setLoading(true);
      const response = await learningPathService.getPaths();
      setPaths(response.paths || []);
    } catch (error) {
      console.error('Error loading paths:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePath = async () => {
    if (!topicPrompt.trim()) {
      alert('Please enter a topic');
      return;
    }

    try {
      setGenerating(true);
      const goalsArray = goals.split('\n').filter(g => g.trim()).map(g => g.trim());
      
      const response = await learningPathService.generatePath(topicPrompt, {
        difficulty,
        length,
        goals: goalsArray
      });

      if (response.success) {
        setShowCreateModal(false);
        setTopicPrompt('');
        setGoals('');
        await loadPaths();
        
        // Navigate to the new path
        navigate(`/learning-paths/${response.path_id}`);
      }
    } catch (error) {
      console.error('Error creating path:', error);
      alert('Failed to create learning path. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleDeletePath = async (pathId, e) => {
    e.stopPropagation();
    
    if (!window.confirm('Archive this learning path?')) {
      return;
    }

    try {
      await learningPathService.deletePath(pathId);
      await loadPaths();
    } catch (error) {
      console.error('Error deleting path:', error);
      alert('Failed to delete path');
    }
  };

  const getDifficultyColor = (diff) => {
    switch (diff) {
      case 'beginner': return '#4ade80';
      case 'intermediate': return '#fbbf24';
      case 'advanced': return '#f87171';
      default: return '#94a3b8';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return <CheckCircle size={20} color="#4ade80" />;
      case 'active': return <Play size={20} color="#3b82f6" />;
      default: return <Circle size={20} color="#94a3b8" />;
    }
  };

  if (loading) {
    return (
      <div className="lp-container">
        <div className="lp-loading">
          <Loader className="lp-spinner" size={40} />
          <p>Loading learning paths...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="lp-container">
      {/* Header */}
      <div className="lp-header">
        <button className="lp-back-btn" onClick={() => navigate('/concept-web')}>
          <ArrowLeft size={20} />
        </button>
        <div className="lp-header-content">
          <div className="lp-header-title">
            <Route size={32} />
            <h1>Learning Paths</h1>
          </div>
          <p className="lp-header-subtitle">
            Structured learning journeys to master any topic, step by step
          </p>
        </div>
        <button className="lp-create-btn" onClick={() => setShowCreateModal(true)}>
          <Plus size={20} />
          Create Path
        </button>
      </div>

      {/* Paths Grid */}
      {paths.length === 0 ? (
        <div className="lp-empty-state">
          <div className="lp-empty-icon">
            <Map size={64} />
          </div>
          <h2>No Learning Paths Yet</h2>
          <p>Create your first learning path to start your structured learning journey</p>
          <button className="lp-empty-create-btn" onClick={() => setShowCreateModal(true)}>
            <Sparkles size={20} />
            Generate Learning Path
          </button>
        </div>
      ) : (
        <div className="lp-paths-grid">
          {paths.map(path => (
            <div
              key={path.id}
              className="lp-path-card"
              onClick={() => navigate(`/learning-paths/${path.id}`)}
            >
              <div className="lp-path-header">
                <div className="lp-path-status">
                  {getStatusIcon(path.status)}
                </div>
                <button
                  className="lp-path-menu"
                  onClick={(e) => handleDeletePath(path.id, e)}
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="lp-path-content">
                <h3>{path.title}</h3>
                <p className="lp-path-description">{path.description}</p>

                <div className="lp-path-meta">
                  <div className="lp-path-meta-item">
                    <Target size={16} />
                    <span
                      className="lp-difficulty-badge"
                      style={{ backgroundColor: getDifficultyColor(path.difficulty) }}
                    >
                      {path.difficulty}
                    </span>
                  </div>
                  <div className="lp-path-meta-item">
                    <Clock size={16} />
                    <span>{Math.round(path.estimated_hours)}h</span>
                  </div>
                  <div className="lp-path-meta-item">
                    <BookOpen size={16} />
                    <span>{path.total_nodes} nodes</span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="lp-path-progress">
                  <div className="lp-progress-bar">
                    <div
                      className="lp-progress-fill"
                      style={{ width: `${path.progress.completion_percentage}%` }}
                    />
                  </div>
                  <div className="lp-progress-text">
                    <span>{path.completed_nodes} / {path.total_nodes} completed</span>
                    <span className="lp-progress-xp">
                      <Award size={14} />
                      {path.progress.total_xp_earned} XP
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="lp-modal-overlay" onClick={() => !generating && setShowCreateModal(false)}>
          <div className="lp-modal" onClick={(e) => e.stopPropagation()}>
            <div className="lp-modal-header">
              <h2>
                <Sparkles size={24} />
                Generate Learning Path
              </h2>
              <button
                className="lp-modal-close"
                onClick={() => setShowCreateModal(false)}
                disabled={generating}
              >
                ×
              </button>
            </div>

            <div className="lp-modal-content">
              <div className="lp-form-group">
                <label>What do you want to learn?</label>
                <input
                  type="text"
                  placeholder="e.g., Data Structures in Python, Machine Learning Basics, Spanish Grammar..."
                  value={topicPrompt}
                  onChange={(e) => setTopicPrompt(e.target.value)}
                  disabled={generating}
                  autoFocus
                />
              </div>

              <div className="lp-form-row">
                <div className="lp-form-group">
                  <label>Difficulty Level</label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value)}
                    disabled={generating}
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>

                <div className="lp-form-group">
                  <label>Path Length</label>
                  <select
                    value={length}
                    onChange={(e) => setLength(e.target.value)}
                    disabled={generating}
                  >
                    <option value="short">Short</option>
                    <option value="medium">Medium</option>
                    <option value="long">Long</option>
                  </select>
                </div>
              </div>

              <div className="lp-form-group">
                <label>Learning Goals (optional)</label>
                <textarea
                  placeholder="Enter your learning goals, one per line..."
                  value={goals}
                  onChange={(e) => setGoals(e.target.value)}
                  disabled={generating}
                  rows={4}
                />
              </div>
            </div>

            <div className="lp-modal-footer">
              <button
                className="lp-btn-secondary"
                onClick={() => setShowCreateModal(false)}
                disabled={generating}
              >
                Cancel
              </button>
              <button
                className="lp-btn-primary"
                onClick={handleCreatePath}
                disabled={generating || !topicPrompt.trim()}
              >
                {generating ? (
                  <>
                    <Loader className="lp-spinner" size={16} />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    Generate Path
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LearningPaths;

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Loader, MapPin, Book, Sparkles, ChevronRight } from 'lucide-react';
import './KnowledgeRoadmap.css';

const KnowledgeRoadmap = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const userId = localStorage.getItem('user_id') || localStorage.getItem('username');

  // State
  const [roadmaps, setRoadmaps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [rootTopic, setRootTopic] = useState('');
  const [currentRoadmap, setCurrentRoadmap] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [nodeExplanation, setNodeExplanation] = useState(null);

  useEffect(() => {
    fetchRoadmaps();
  }, []);

  const fetchRoadmaps = async () => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:8001/get_knowledge_roadmaps?user_id=${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setRoadmaps(data.roadmaps || []);
      }
    } catch (error) {
      console.error('Error fetching roadmaps:', error);
    } finally {
      setLoading(false);
    }
  };

  const createRoadmap = async () => {
    if (!rootTopic.trim()) {
      alert('Please enter a topic');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('http://localhost:8001/create_knowledge_roadmap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          user_id: userId,
          root_topic: rootTopic
        })
      });

      if (response.ok) {
        const data = await response.json();
        setShowCreateModal(false);
        setRootTopic('');
        await fetchRoadmaps();
        // Open the newly created roadmap
        viewRoadmap(data.roadmap_id);
      } else {
        alert('Failed to create roadmap');
      }
    } catch (error) {
      console.error('Error creating roadmap:', error);
      alert('Error creating roadmap');
    } finally {
      setLoading(false);
    }
  };

  const viewRoadmap = async (roadmapId) => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:8001/get_knowledge_roadmap/${roadmapId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setCurrentRoadmap(data);
        setNodes(data.nodes || []);
      }
    } catch (error) {
      console.error('Error viewing roadmap:', error);
    } finally {
      setLoading(false);
    }
  };

  const expandNode = async (nodeId) => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:8001/expand_knowledge_node/${nodeId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        // Refresh the roadmap to get updated nodes
        if (currentRoadmap) {
          await viewRoadmap(currentRoadmap.roadmap_id);
        }
      }
    } catch (error) {
      console.error('Error expanding node:', error);
    } finally {
      setLoading(false);
    }
  };

  const exploreNode = async (nodeId) => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:8001/explore_node/${nodeId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setNodeExplanation(data.node);
        setSelectedNode(nodeId);
      }
    } catch (error) {
      console.error('Error exploring node:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderNodeTree = (parentId = null, depth = 0) => {
    const childNodes = nodes.filter(node => node.parent_id === parentId);
    
    if (childNodes.length === 0) return null;

    return (
      <div className="kr-node-level" style={{ marginLeft: `${depth * 40}px` }}>
        {childNodes.map(node => (
          <div key={node.id} className="kr-node-wrapper">
            <div 
              className={`kr-node ${node.is_explored ? 'explored' : ''} ${node.expansion_status === 'expanded' ? 'expanded' : ''}`}
              onClick={() => setSelectedNode(node.id)}
            >
              <div className="kr-node-header">
                <div className="kr-node-icon">
                  <MapPin size={20} />
                </div>
                <div className="kr-node-content">
                  <h4 className="kr-node-title">{node.topic_name}</h4>
                  <p className="kr-node-description">{node.description}</p>
                  {node.is_explored && (
                    <span className="kr-explored-badge">
                      <Sparkles size={14} />
                      Explored
                    </span>
                  )}
                </div>
              </div>

              <div className="kr-node-actions">
                <button 
                  className="kr-node-btn explore"
                  onClick={(e) => { e.stopPropagation(); exploreNode(node.id); }}
                  title="Learn about this topic"
                >
                  <Book size={16} />
                  <span>Explore</span>
                </button>
                {node.expansion_status !== 'expanded' && (
                  <button 
                    className="kr-node-btn expand"
                    onClick={(e) => { e.stopPropagation(); expandNode(node.id); }}
                    title="See subtopics"
                  >
                    <ChevronRight size={16} />
                    <span>Expand</span>
                  </button>
                )}
              </div>
            </div>

            {/* Recursively render child nodes */}
            {renderNodeTree(node.id, depth + 1)}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="kr-page">
      {/* Header */}
      <header className="kr-header">
        <div className="kr-header-left">
          <button className="kr-back-btn" onClick={() => navigate('/learning-review')}>
            <ArrowLeft size={20} />
            <span>BACK</span>
          </button>
          <div className="kr-header-title-group">
            <h1 className="kr-logo">brainwave</h1>
            <span className="kr-subtitle">KNOWLEDGE ROADMAP</span>
          </div>
        </div>
        <div className="kr-header-right">
          <button className="kr-nav-btn" onClick={() => navigate('/dashboard')}>Dashboard</button>
          <button className="kr-nav-btn logout" onClick={() => { localStorage.removeItem('token'); navigate('/login'); }}>Logout</button>
        </div>
      </header>

      {/* Main Content */}
      <div className="kr-content">
        {!currentRoadmap ? (
          <>
            {/* Section Header */}
            <div className="kr-section-header">
              <div className="kr-header-content">
                <div>
                  <h2 className="kr-section-title">Knowledge Roadmaps</h2>
                  <p className="kr-section-subtitle">Build interactive learning maps with expandable topics</p>
                </div>
                <button className="kr-create-btn" onClick={() => setShowCreateModal(true)}>
                  <Plus size={20} />
                  <span>Create Roadmap</span>
                </button>
              </div>
            </div>

            {/* Roadmaps Grid */}
            <div className="kr-main">
              {loading && roadmaps.length === 0 ? (
                <div className="kr-loading">
                  <Loader size={40} className="kr-spinner" />
                  <p>Loading roadmaps...</p>
                </div>
              ) : roadmaps.length === 0 ? (
                <div className="kr-empty">
                  <MapPin size={64} className="kr-empty-icon" />
                  <p>No roadmaps yet. Create your first roadmap to start exploring!</p>
                </div>
              ) : (
                <div className="kr-grid">
                  {roadmaps.map(roadmap => (
                    <div 
                      key={roadmap.id} 
                      className="kr-card"
                      onClick={() => viewRoadmap(roadmap.id)}
                    >
                      <div className="kr-card-icon">
                        <MapPin size={28} />
                      </div>
                      <div className="kr-card-content">
                        <h3 className="kr-card-title">{roadmap.title}</h3>
                        <p className="kr-card-topic">{roadmap.root_topic}</p>
                        <div className="kr-card-stats">
                          <div className="kr-stat">
                            <span className="kr-stat-value">{roadmap.total_nodes}</span>
                            <span className="kr-stat-label">Nodes</span>
                          </div>
                          <div className="kr-stat">
                            <span className="kr-stat-value">{roadmap.max_depth_reached}</span>
                            <span className="kr-stat-label">Depth</span>
                          </div>
                        </div>
                      </div>
                      <div className="kr-card-footer">
                        <span className="kr-card-date">
                          Last accessed: {new Date(roadmap.last_accessed).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          /* Roadmap Viewer */
          <div className="kr-viewer">
            <div className="kr-viewer-header">
              <button className="kr-back-to-list" onClick={() => { setCurrentRoadmap(null); setNodes([]); }}>
                <ArrowLeft size={18} />
                <span>Back to Roadmaps</span>
              </button>
              <h2 className="kr-viewer-title">{currentRoadmap.title}</h2>
              <div className="kr-viewer-stats">
                <span>{currentRoadmap.total_nodes} nodes</span>
                <span>•</span>
                <span>Depth: {currentRoadmap.max_depth_reached}</span>
              </div>
            </div>

            <div className="kr-viewer-content">
              <div className="kr-tree-panel">
                <div className="kr-tree-container">
                  {loading && nodes.length === 0 ? (
                    <div className="kr-loading">
                      <Loader size={32} className="kr-spinner" />
                    </div>
                  ) : (
                    renderNodeTree()
                  )}
                </div>
              </div>

              {/* Explanation Panel */}
              {nodeExplanation && (
                <div className="kr-explanation-panel">
                  <div className="kr-explanation-header">
                    <h3>{nodeExplanation.topic_name}</h3>
                    <button 
                      className="kr-close-explanation"
                      onClick={() => { setNodeExplanation(null); setSelectedNode(null); }}
                    >
                      ×
                    </button>
                  </div>

                  <div className="kr-explanation-content">
                    {nodeExplanation.ai_explanation && (
                      <div className="kr-explanation-section">
                        <h4>Overview</h4>
                        <p>{nodeExplanation.ai_explanation}</p>
                      </div>
                    )}

                    {nodeExplanation.key_concepts && nodeExplanation.key_concepts.length > 0 && (
                      <div className="kr-explanation-section">
                        <h4>Key Concepts</h4>
                        <ul className="kr-concepts-list">
                          {nodeExplanation.key_concepts.map((concept, idx) => (
                            <li key={idx}>{concept}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {nodeExplanation.why_important && (
                      <div className="kr-explanation-section">
                        <h4>Why This Matters</h4>
                        <p>{nodeExplanation.why_important}</p>
                      </div>
                    )}

                    {nodeExplanation.real_world_examples && nodeExplanation.real_world_examples.length > 0 && (
                      <div className="kr-explanation-section">
                        <h4>Real-World Examples</h4>
                        <ul className="kr-examples-list">
                          {nodeExplanation.real_world_examples.map((example, idx) => (
                            <li key={idx}>{example}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {nodeExplanation.learning_tips && (
                      <div className="kr-explanation-section">
                        <h4>Learning Tips</h4>
                        <p>{nodeExplanation.learning_tips}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create Roadmap Modal */}
      {showCreateModal && (
        <div className="kr-modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="kr-modal" onClick={e => e.stopPropagation()}>
            <div className="kr-modal-header">
              <h3>Create Knowledge Roadmap</h3>
              <button className="kr-modal-close" onClick={() => setShowCreateModal(false)}>×</button>
            </div>

            <div className="kr-modal-content">
              <div className="kr-form-group">
                <label>What topic do you want to explore?</label>
                <input
                  type="text"
                  className="kr-input"
                  value={rootTopic}
                  onChange={e => setRootTopic(e.target.value)}
                  placeholder="e.g., Machine Learning, European History, Organic Chemistry"
                  onKeyPress={e => e.key === 'Enter' && createRoadmap()}
                  autoFocus
                />
                <p className="kr-input-hint">
                  Enter a broad topic to start. You'll be able to expand it into subtopics as you explore.
                </p>
              </div>
            </div>

            <div className="kr-modal-footer">
              <button className="kr-btn-cancel" onClick={() => setShowCreateModal(false)}>Cancel</button>
              <button 
                className="kr-btn-create" 
                onClick={createRoadmap}
                disabled={loading || !rootTopic.trim()}
              >
                {loading ? 'Creating...' : 'Create Roadmap'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KnowledgeRoadmap;
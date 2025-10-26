import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader, ChevronDown, ChevronRight } from 'lucide-react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import './roadmap-styles.css';
import './KnowledgeRoadmap.css';

const CustomNode = ({ data }) => {
  const isExpanded = data.expansionStatus === 'expanded';
  const isExpanding = data.isExpanding;
  
  return (
    <div className="knowledge-node">
      <Handle type="target" position={Position.Top} />
      <div className="node-content">
        <div className="node-label">{data.label}</div>
        {data.description && (
          <div className="node-description">{data.description}</div>
        )}
        <div className="node-controls">
          {data.onExpand && (
            <button 
              className="node-btn expand-btn"
              onClick={(e) => {
                e.stopPropagation();
                data.onExpand(data.nodeId);
              }}
              disabled={isExpanding}
              title={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanding ? <Loader size={14} className="spinner" /> : (isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />)}
            </button>
          )}
          {data.onExplore && (
            <button 
              className="node-btn explore-btn"
              onClick={(e) => {
                e.stopPropagation();
                data.onExplore(data.nodeId);
              }}
              title="Explore"
            >
              Explore
            </button>
          )}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

const nodeTypes = {
  custom: CustomNode
};

const KnowledgeRoadmap = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const [userName, setUserName] = useState('');
  
  const [activePanel, setActivePanel] = useState('generator');
  const [topic, setTopic] = useState('');
  const [roadmapName, setRoadmapName] = useState('');
  const [loading, setLoading] = useState(false);
  const [roadmaps, setRoadmaps] = useState([]);
  const [loadingRoadmaps, setLoadingRoadmaps] = useState(false);
  const [currentRoadmap, setCurrentRoadmap] = useState(null);
  
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [showNodePanel, setShowNodePanel] = useState(false);
  const [nodeExplanation, setNodeExplanation] = useState(null);
  const [expandedNodes, setExpandedNodes] = useState(new Set());
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    fetchUserProfile();
  }, [token]);

  useEffect(() => {
    if (userName) {
      if (activePanel === 'roadmaps') {
        fetchSavedRoadmaps();
      }
    }
  }, [activePanel, userName]);

  const fetchUserProfile = async () => {
    try {
      const response = await fetch('http://localhost:8001/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setUserName(data.username || data.first_name || 'User');
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  };

  const fetchSavedRoadmaps = async () => {
    try {
      setLoadingRoadmaps(true);
      const response = await fetch('http://localhost:8001/get_user_roadmaps', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setRoadmaps(data.roadmaps || []);
      }
    } catch (error) {
      console.error('Error fetching roadmaps:', error);
    } finally {
      setLoadingRoadmaps(false);
    }
  };

  const createRoadmap = async () => {
    setErrorMessage('');
    
    if (!topic.trim()) {
      setErrorMessage('Please enter a topic');
      return;
    }

    if (!roadmapName.trim()) {
      setErrorMessage('Please enter a roadmap name');
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
          user_id: userName,
          root_topic: topic.trim(),
          roadmap_name: roadmapName.trim()
        })
      });

      if (response.ok) {
        const createData = await response.json();
        const roadmapId = createData.roadmap_id;
        
        const fullRoadmapResponse = await fetch(`http://localhost:8001/get_knowledge_roadmap/${roadmapId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (fullRoadmapResponse.ok) {
          const fullRoadmapData = await fullRoadmapResponse.json();
          setCurrentRoadmap(fullRoadmapData);
          buildRoadmapVisualization(fullRoadmapData);
          setTopic('');
          setRoadmapName('');
          setErrorMessage('');
        } else {
          setErrorMessage('Roadmap created but failed to load');
        }
      } else {
        const errorData = await response.json();
        setErrorMessage(`Failed to create roadmap: ${errorData.detail || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error creating roadmap:', error);
      setErrorMessage('Failed to create roadmap. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const buildRoadmapVisualization = (roadmapData) => {
    const allNodes = roadmapData.nodes_flat || roadmapData.roadmap?.nodes_flat || [];
    
    if (allNodes.length === 0) {
      console.warn('No nodes found in roadmap data');
      return;
    }
    
    const rootNode = allNodes.find(n => !n.parent_id || n.depth_level === 0);
    if (!rootNode) {
      console.warn('No root node found');
      return;
    }

    const buildTree = (parentId, depth = 0, xOffset = 0) => {
      const children = allNodes.filter(n => n.parent_id === parentId);
      
      if (children.length === 0) return { nodes: [], edges: [] };

      const horizontalSpacing = 300;
      const verticalSpacing = 180;
      const totalWidth = (children.length - 1) * horizontalSpacing;
      const startX = xOffset - (totalWidth / 2);

      const childNodes = [];
      const childEdges = [];

      children.forEach((child, index) => {
        const childX = startX + (index * horizontalSpacing);
        const childY = (depth + 1) * verticalSpacing;

        childNodes.push({
          id: String(child.id),
          type: 'custom',
          position: { x: childX, y: childY },
          data: {
            label: child.topic_name,
            description: child.description,
            nodeId: child.id,
            depth: depth + 1,
            expansionStatus: child.expansion_status || 'unexpanded',
            onExpand: expandNode,
            onExplore: exploreNode,
            isExpanding: false
          }
        });

        childEdges.push({
          id: `edge-${parentId}-${child.id}`,
          source: String(parentId),
          target: String(child.id),
          type: 'smoothstep',
          animated: false,
          style: { stroke: '#2a2f37', strokeWidth: 2 }
        });

        const grandChildren = buildTree(child.id, depth + 1, childX);
        childNodes.push(...grandChildren.nodes);
        childEdges.push(...grandChildren.edges);
      });

      return { nodes: childNodes, edges: childEdges };
    };

    const visualNodes = [{
      id: String(rootNode.id),
      type: 'custom',
      position: { x: 0, y: 0 },
      data: {
        label: rootNode.topic_name,
        description: rootNode.description,
        nodeId: rootNode.id,
        depth: 0,
        expansionStatus: rootNode.expansion_status || 'expanded',
        onExpand: expandNode,
        onExplore: exploreNode,
        isExpanding: false
      }
    }];

    const result = buildTree(rootNode.id, 0, 0);
    visualNodes.push(...result.nodes);

    setNodes(visualNodes);
    setEdges(result.edges);
  };

  const expandNode = useCallback(async (nodeId) => {
    setNodes((nds) => nds.map(n =>
      n.data.nodeId === nodeId ? { ...n, data: { ...n.data, isExpanding: true } } : n
    ));
    
    try {
      const response = await fetch(`http://localhost:8001/expand_knowledge_node/${nodeId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        
        if (data.status === 'expanded' && data.roadmap) {
          buildRoadmapVisualization(data.roadmap);
          setExpandedNodes(prev => new Set([...prev, nodeId]));
        } else if (data.status === 'already_expanded' && currentRoadmap) {
          const roadmapResponse = await fetch(
            `http://localhost:8001/get_knowledge_roadmap/${currentRoadmap.id}`,
            { headers: { 'Authorization': `Bearer ${token}` } }
          );
          
          if (roadmapResponse.ok) {
            const roadmapData = await roadmapResponse.json();
            buildRoadmapVisualization(roadmapData);
          }
        }
      }
    } catch (error) {
      console.error('Error expanding node:', error);
    } finally {
      setNodes((nds) => nds.map(n =>
        n.data.nodeId === nodeId ? { ...n, data: { ...n.data, isExpanding: false } } : n
      ));
    }
  }, [currentRoadmap, token]);

  const exploreNode = useCallback(async (nodeId) => {
    try {
      const response = await fetch(`http://localhost:8001/explore_node/${nodeId}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setNodeExplanation(data.explanation || data.content || 'No explanation available');
        setShowNodePanel(true);
      }
    } catch (error) {
      console.error('Error exploring node:', error);
    }
  }, [token]);

  const loadRoadmap = async (roadmapId) => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:8001/get_knowledge_roadmap/${roadmapId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setCurrentRoadmap(data);
        buildRoadmapVisualization(data);
      }
    } catch (error) {
      console.error('Error loading roadmap:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="roadmap-page">
      <header className="roadmap-header">
        <div className="header-content">
          <div className="header-left">
            <button className="back-btn" onClick={() => navigate('/learning-review')}>
              <ArrowLeft size={18} />
              Back
            </button>
            <h1 className="roadmap-title clickable-logo" onClick={() => navigate('/dashboard')}>brainwave</h1>
          </div>
          <div className="header-right">
            <button className="header-btn" onClick={() => navigate('/dashboard')}>Dashboard</button>
            <button className="header-btn logout-btn" onClick={() => { localStorage.removeItem('token'); navigate('/login'); }}>Logout</button>
          </div>
        </div>
      </header>

      <nav className="tab-nav">
        <button 
          className={`tab-btn ${activePanel === 'generator' ? 'active' : ''}`}
          onClick={() => setActivePanel('generator')}
        >
          Generator
        </button>
        <button 
          className={`tab-btn ${activePanel === 'roadmaps' ? 'active' : ''}`}
          onClick={() => setActivePanel('roadmaps')}
        >
          My Roadmaps
        </button>
      </nav>

      <main className="main-content">
        {activePanel === 'generator' && (
          <div className="generator-section">
            <div className="section-header">
              <h2 className="section-title">Create Knowledge Roadmap</h2>
              <p className="section-subtitle">Generate a comprehensive learning path for any topic</p>
            </div>

            <div className="form-container">
              {errorMessage && (
                <div className="error-banner">{errorMessage}</div>
              )}
              
              <div className="form-group">
                <label className="form-label">Roadmap Name</label>
                <input
                  className="form-input"
                  type="text"
                  value={roadmapName}
                  onChange={(e) => setRoadmapName(e.target.value)}
                  placeholder="e.g., My ML Journey, Physics Fundamentals"
                  onKeyPress={(e) => e.key === 'Enter' && createRoadmap()}
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Topic</label>
                <input
                  className="form-input"
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g., Machine Learning, Photosynthesis, Ancient Rome"
                  onKeyPress={(e) => e.key === 'Enter' && createRoadmap()}
                />
              </div>
              
              <button 
                className="submit-btn"
                onClick={createRoadmap}
                disabled={loading}
              >
                {loading ? 'Creating Roadmap...' : 'Generate Roadmap'}
              </button>
            </div>

            {currentRoadmap && (
              <div className="roadmap-display-section">
                <div className="roadmap-display-header">
                  <div className="roadmap-info">
                    <h3>{currentRoadmap.roadmap_name || currentRoadmap.topic}</h3>
                    <p>{currentRoadmap.topic}</p>
                  </div>
                  <button 
                    className="close-display-btn"
                    onClick={() => setCurrentRoadmap(null)}
                  >
                    Close
                  </button>
                </div>
                
                <div className="roadmap-viewer">
                  <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    nodeTypes={nodeTypes}
                    fitView
                    minZoom={0.1}
                    maxZoom={2}
                    defaultEdgeOptions={{
                      type: 'smoothstep',
                      animated: false,
                      style: { stroke: '#2a2f37', strokeWidth: 2 }
                    }}
                  >
                    <Background color="#2a2f37" gap={16} size={1} />
                    <Controls />
                    <MiniMap 
                      nodeColor="#D7B38C"
                      maskColor="rgba(11, 11, 12, 0.8)"
                      style={{
                        background: '#16181d',
                        border: '2px solid #2a2f37'
                      }}
                    />
                  </ReactFlow>
                </div>
              </div>
            )}
          </div>
        )}

        {activePanel === 'roadmaps' && (
          <div className="roadmaps-section">
            <div className="section-header">
              <h2 className="section-title">My Knowledge Roadmaps</h2>
              <button 
                onClick={fetchSavedRoadmaps}
                className="refresh-btn"
                disabled={loadingRoadmaps}
              >
                {loadingRoadmaps ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>

            <div className="roadmaps-content">
              {loadingRoadmaps ? (
                <div className="loading-state">
                  <Loader size={40} className="spinner" />
                  <p>Loading roadmaps...</p>
                </div>
              ) : roadmaps.length === 0 ? (
                <div className="empty-state">
                  <h3>No Roadmaps Yet</h3>
                  <p>Create your first roadmap to start your learning journey!</p>
                  <button 
                    className="get-started-btn"
                    onClick={() => setActivePanel('generator')}
                  >
                    Get Started
                  </button>
                </div>
              ) : (
                <div className="roadmaps-grid">
                  {roadmaps.map((roadmap) => (
                    <div key={roadmap.id} className="roadmap-card">
                      <div className="roadmap-card-header">
                        <div className="roadmap-title">{roadmap.roadmap_name || roadmap.topic || 'Untitled Roadmap'}</div>
                        <div className="roadmap-date">{new Date(roadmap.created_at).toLocaleDateString()}</div>
                      </div>
                      <div className="roadmap-stats">
                        <span>Topic: {roadmap.topic || 'N/A'}</span>
                        <span>{(roadmap.nodes || []).length || 0} nodes</span>
                      </div>
                      <div className="roadmap-actions">
                        <button 
                          className="load-btn"
                          onClick={() => {
                            loadRoadmap(roadmap.id);
                            setActivePanel('generator');
                          }}
                        >
                          View Roadmap
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {showNodePanel && (
        <div className="node-panel">
          <div className="node-panel-header">
            <h3>Node Explanation</h3>
            <button 
              className="close-panel-btn"
              onClick={() => setShowNodePanel(false)}
            >
              ×
            </button>
          </div>
          <div className="node-panel-content">
            {nodeExplanation && <p>{nodeExplanation}</p>}
          </div>
        </div>
      )}
    </div>
  );
};

export default KnowledgeRoadmap;
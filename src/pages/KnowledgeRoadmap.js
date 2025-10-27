import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { Plus, Loader, MapPin, Book, Sparkles } from 'lucide-react';
import './KnowledgeRoadmap.css';

const CustomNode = ({ data }) => {
  return (
    <div className={`custom-kr-node ${data.isExplored ? 'kr-explored' : ''} ${data.expansionStatus === 'expanded' ? 'kr-expanded' : ''}`}>
      <Handle 
        type="target" 
        position={Position.Top}
        style={{ background: '#D7B38C', width: '10px', height: '10px', border: '2px solid #1a1a1a' }}
      />
      <div className="kr-node-content-flow">
        <div className="kr-node-icon-flow">
          <MapPin size={18} />
        </div>
        <div className="kr-node-text-flow">
          <h4>{data.label}</h4>
          <p>{data.description}</p>
          {data.isExplored && (
            <span className="kr-explored-badge-flow">
              <Sparkles size={12} />
              Explored
            </span>
          )}
        </div>
      </div>
      <div className="kr-node-actions-flow">
        <button 
          className="kr-node-btn-flow kr-explore-btn nodrag nopan"
          onClick={(e) => { e.stopPropagation(); data.onExplore && data.onExplore(data.nodeId); }}
          disabled={data.isExploring}
        >
          <Book size={14} />
          {data.isExploring ? 'Exploring...' : 'Explore'}
        </button>
        {data.expansionStatus === 'unexpanded' && (
          <button 
            className="kr-node-btn-flow kr-expand-btn nodrag nopan"
            onClick={(e) => { e.stopPropagation(); data.onExpand && data.onExpand(data.nodeId); }}
            disabled={data.isExpanding}
          >
            {data.isExpanding ? 'Expanding...' : 'Expand'}
          </button>
        )}
      </div>
      <Handle 
        type="source" 
        position={Position.Bottom}
        style={{ background: '#D7B38C', width: '10px', height: '10px', border: '2px solid #1a1a1a' }}
      />
    </div>
  );
};

const KnowledgeRoadmap = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const userId = localStorage.getItem('user_id') || localStorage.getItem('username');

  const [roadmaps, setRoadmaps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [rootTopic, setRootTopic] = useState('');
  const [currentRoadmap, setCurrentRoadmap] = useState(null);
  const [nodeExplanation, setNodeExplanation] = useState(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [expandedNodes, setExpandedNodes] = useState(new Set());

  const expandNodeRef = useRef(null);
  const exploreNodeRef = useRef(null);

  const nodeTypes = useMemo(() => ({
    custom: CustomNode,
  }), []);

  useEffect(() => {
    fetchRoadmaps();
  }, []);

  const fetchRoadmaps = async () => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:8001/get_user_roadmaps?user_id=${userId}`, {
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
        setCurrentRoadmap(data.roadmap);
        
        const allNodes = data.nodes_flat || [];
        const backendExpandedNodes = new Set(data.expanded_nodes || []);
        
        const nodeMap = new Map();
        const childMap = new Map();
        
        allNodes.forEach(node => {
          nodeMap.set(node.id, node);
          if (node.parent_id) {
            if (!childMap.has(node.parent_id)) {
              childMap.set(node.parent_id, []);
            }
            childMap.get(node.parent_id).push(node);
          }
        });
        
        const rootNodes = allNodes.filter(node => !node.parent_id);
        const newExpandedNodes = new Set(backendExpandedNodes);
        
        const ensureAncestorsExpanded = (nodeId) => {
          const node = nodeMap.get(nodeId);
          if (!node || !node.parent_id) return;
          const parent = nodeMap.get(node.parent_id);
          if (parent) {
            newExpandedNodes.add(parent.id);
            ensureAncestorsExpanded(parent.id);
          }
        };
        
        newExpandedNodes.forEach(nodeId => {
          ensureAncestorsExpanded(nodeId);
        });
        
        const visibleNodes = new Set();
        const nodesToProcess = [...rootNodes];
        
        while (nodesToProcess.length > 0) {
          const currentNode = nodesToProcess.shift();
          visibleNodes.add(currentNode.id);
          
          if (newExpandedNodes.has(currentNode.id)) {
            const children = childMap.get(currentNode.id) || [];
            nodesToProcess.push(...children);
          }
        }
        
        setExpandedNodes(newExpandedNodes);
        
        const filteredNodes = allNodes.filter(node => visibleNodes.has(node.id));
        
        const nodesByDepth = new Map();
        filteredNodes.forEach(node => {
          if (!nodesByDepth.has(node.depth_level)) {
            nodesByDepth.set(node.depth_level, []);
          }
          nodesByDepth.get(node.depth_level).push(node);
        });

        const flowNodes = filteredNodes.map(node => {
          const nodesAtThisDepth = nodesByDepth.get(node.depth_level) || [];
          const indexAtDepth = nodesAtThisDepth.indexOf(node);
          const horizontalSpacing = 280;
          const baseVerticalSpacing = 250;
          const depthMultiplier = 1.2;
          const verticalSpacing = baseVerticalSpacing * Math.pow(depthMultiplier, node.depth_level);
          
          const totalWidth = (nodesAtThisDepth.length - 1) * horizontalSpacing;
          const startX = 400 - (totalWidth / 2);

          return {
            id: String(node.id),
            type: 'custom',
            position: {
              x: startX + (indexAtDepth * horizontalSpacing),
              y: 50 + (node.depth_level * verticalSpacing)
            },
            data: {
              label: node.topic_name,
              description: node.description,
              depth: node.depth_level,
              isExplored: node.is_explored,
              expansionStatus: node.expansion_status,
              nodeId: node.id,
              onExpand: expandNode,
              onExplore: exploreNode,
            },
          };
        });

        const flowEdges = [];
        filteredNodes.forEach(node => {
          if (node.parent_id && visibleNodes.has(node.parent_id)) {
            flowEdges.push({
              id: `e${node.parent_id}-${node.id}`,
              source: String(node.parent_id),
              target: String(node.id),
              type: 'smoothstep',
              animated: false,
              style: { stroke: '#D7B38C', strokeWidth: 3 },
              markerEnd: {
                type: 'arrow',
                color: '#D7B38C',
                width: 20,
                height: 20,
              },
            });
          }
        });

        setNodes(flowNodes);
        setEdges(flowEdges);
      }
    } catch (error) {
      console.error('Error viewing roadmap:', error);
    } finally {
      setLoading(false);
    }
  };

  const expandNode = useCallback(async (nodeId) => {
    console.log('Expanding node:', nodeId);
    
    setNodes((nds) => {
      return nds.map(n =>
        n.data.nodeId === nodeId
          ? { ...n, data: { ...n.data, isExpanding: true } }
          : n
      );
    });
    
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
        console.log('Expand response:', data);
        
        if (currentRoadmap) {
          await viewRoadmap(currentRoadmap.id);
        }
      }
    } catch (error) {
      console.error('Error expanding node:', error);
      setNodes((nds) => {
        return nds.map(n =>
          n.data.nodeId === nodeId
            ? { ...n, data: { ...n.data, isExpanding: false } }
            : n
        );
      });
    }
  }, [currentRoadmap, token]);

  const exploreNode = useCallback(async (nodeId) => {
    console.log('Exploring node:', nodeId);
    
    setNodes((nds) => {
      return nds.map(n =>
        n.data.nodeId === nodeId
          ? { ...n, data: { ...n.data, isExploring: true } }
          : n
      );
    });
    
    try {
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
        
        setNodes((nds) => {
          return nds.map(n =>
            n.data.nodeId === nodeId
              ? { ...n, data: { ...n.data, isExplored: true, isExploring: false } }
              : n
          );
        });
      }
    } catch (error) {
      console.error('Error exploring node:', error);
      setNodes((nds) => {
        return nds.map(n =>
          n.data.nodeId === nodeId
            ? { ...n, data: { ...n.data, isExploring: false } }
            : n
        );
      });
    }
  }, [token]);

  expandNodeRef.current = expandNode;
  exploreNodeRef.current = exploreNode;

  return (
    <div className="kr-page">
      <header className="kr-header">
        <div className="kr-header-container">
          <div className="kr-header-left">
            <div className="kr-header-title-group">
              <h1 className="kr-logo">brainwave</h1>
              <span className="kr-subtitle">KNOWLEDGE ROADMAP</span>
            </div>
          </div>
          <div className="kr-header-right">
            <button className="kr-nav-btn" onClick={() => navigate('/learning-review')}>LEARNING REVIEW</button>
            <button className="kr-nav-btn" onClick={() => navigate('/dashboard')}>DASHBOARD</button>
            <button className="kr-nav-btn kr-logout" onClick={() => { localStorage.removeItem('token'); navigate('/login'); }}>LOGOUT</button>
          </div>
        </div>
      </header>

      <div className="kr-content">
        {!currentRoadmap ? (
          <>
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
          <div className="kr-viewer-fullscreen">
            <div className="kr-viewer-header-compact">
              <button className="kr-back-to-list-compact" onClick={() => { setCurrentRoadmap(null); setNodes([]); setEdges([]); setNodeExplanation(null); }}>
                Back to Roadmaps
              </button>
              <div className="kr-viewer-title-section">
                <h2 className="kr-viewer-title-compact">{currentRoadmap.title || `Exploring ${currentRoadmap.root_topic}`}</h2>
                <div className="kr-viewer-stats-compact">
                  <span>{currentRoadmap.total_nodes || nodes.length} nodes</span>
                  <span>•</span>
                  <span>Depth: {currentRoadmap.max_depth_reached || 0}</span>
                </div>
              </div>
            </div>

            <div className="kr-flow-wrapper">
              <div className="kr-flow-container-fullscreen">
                {loading && nodes.length === 0 ? (
                  <div className="kr-loading">
                    <Loader size={32} className="kr-spinner" />
                  </div>
                ) : (
                  <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    nodeTypes={nodeTypes}
                    fitView
                    minZoom={0.1}
                    maxZoom={2}
                    defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
                    attributionPosition="bottom-left"
                  >
                    <Background color="var(--border)" gap={16} />
                    <Controls />
                    <MiniMap 
                      nodeColor={(node) => {
                        if (node.data.isExplored) return '#10B981';
                        if (node.data.expansionStatus === 'expanded') return '#D7B38C';
                        return '#B8C0CC';
                      }}
                      maskColor="rgba(0, 0, 0, 0.7)"
                    />
                  </ReactFlow>
                )}
              </div>

              {nodeExplanation && (
                <div className="kr-explanation-sidebar">
                  <div className="kr-explanation-header-sticky">
                    <h3>{nodeExplanation.topic_name}</h3>
                    <button 
                      className="kr-close-explanation"
                      onClick={() => setNodeExplanation(null)}
                    >
                      ×
                    </button>
                  </div>

                  <div className="kr-explanation-scrollable">
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
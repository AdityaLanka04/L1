import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
import { Plus, Loader, MapPin, Book, Sparkles, Trash2, FileDown, Info, ChevronRight, X, Edit3, Save, StickyNote, Menu, MessageCircle } from 'lucide-react';
import './KnowledgeRoadmap.css';
import { API_URL } from '../config';
import MathRenderer from '../components/MathRenderer';
const CustomNode = ({ data, selected }) => {
  const [activeAction, setActiveAction] = useState(null);
  const setAction = (action) => () => setActiveAction(action);
  const clearAction = () => setActiveAction(null);
  const handleActionBlur = (event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setActiveAction(null);
    }
  };
  const actionClass = (baseClass, actionName) => [
    'kr-node-btn-flow',
    baseClass,
    activeAction === actionName ? 'kr-action-active' : ''
  ].filter(Boolean).join(' ');

  return (
    <div className={`custom-kr-node ${data.isExplored ? 'kr-explored' : ''} ${data.expansionStatus === 'expanded' ? 'kr-expanded' : ''} ${selected ? 'kr-selected' : ''}`}>
      <Handle 
        type="target" 
        position={Position.Top}
        style={{ background: 'var(--accent)', width: '8px', height: '8px', border: '2px solid var(--panel)' }}
      />
      <div className="kr-node-content-flow">
        <div className="kr-node-icon-flow">
          <MapPin size={16} />
        </div>
        <div className="kr-node-text-flow">
          <h4 className="kr-node-title-text">{data.label}</h4>
          <p>{data.description}</p>
          {data.isExplored && (
            <span className="kr-explored-badge-flow">
              <Sparkles size={10} />
              Explored
            </span>
          )}
          {data.hasManualNotes && (
            <span className="kr-notes-badge-flow">
              <StickyNote size={10} />
              Notes
            </span>
          )}
        </div>
      </div>
      <div
        className="kr-node-actions-flow"
        data-active-action={activeAction || undefined}
        onMouseLeave={clearAction}
        onBlur={handleActionBlur}
      >
        <button 
          className={`${actionClass('kr-explore-btn', 'learn')} nodrag nopan`}
          onClick={(e) => { 
            e.stopPropagation(); 
            data.onExplore && data.onExplore(data.nodeId); 
          }}
          onMouseEnter={setAction('learn')}
          onFocus={setAction('learn')}
          disabled={data.isExploring || data.isExpanding}
          title={data.isExploring ? 'Exploring...' : 'Explore this topic'}
        >
          <Book size={8} />
          <span>Learn</span>
        </button>
        {(data.expansionStatus === 'unexpanded' || !data.expansionStatus) && (
          <button 
            className={`${actionClass('kr-expand-btn', 'more')} nodrag nopan`}
            onClick={(e) => { 
              e.stopPropagation(); 
              data.onExpand && data.onExpand(data.nodeId); 
            }}
            onMouseEnter={setAction('more')}
            onFocus={setAction('more')}
            disabled={data.isExpanding || data.isExploring}
            title={data.isExpanding ? 'Expanding...' : 'Expand to show subtopics'}
          >
            <Plus size={8} />
            <span>More</span>
          </button>
        )}
        <button 
          className={`${actionClass('kr-add-child-btn', 'add')} nodrag nopan`}
          onClick={(e) => { 
            e.stopPropagation(); 
            data.onAddChild && data.onAddChild(data.nodeId); 
          }}
          onMouseEnter={setAction('add')}
          onFocus={setAction('add')}
          title="Add custom child node"
        >
          <Plus size={8} />
          <span>Add</span>
        </button>
      </div>
      <Handle 
        type="source" 
        position={Position.Bottom}
        style={{ background: 'var(--accent)', width: '8px', height: '8px', border: '2px solid var(--panel)' }}
      />
    </div>
  );
};

const KnowledgeRoadmap = () => {
  const navigate = useNavigate();
  const { roadmapId } = useParams();
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
  const [exploredNodesCache, setExploredNodesCache] = useState(new Map()); 
  const [exporting, setExporting] = useState(false);

  
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [copiedCode, setCopiedCode] = useState(null);
  const chatMessagesRef = useRef(null);

  
  const [showAddNodeModal, setShowAddNodeModal] = useState(false);
  const [addNodeParentId, setAddNodeParentId] = useState(null);
  const [newNodeTopic, setNewNodeTopic] = useState('');
  const [newNodeDescription, setNewNodeDescription] = useState('');

  
  const [selectedNodeId, setSelectedNodeId] = useState(null);

  
  const [manualNotes, setManualNotes] = useState(new Map()); 
  const [editingNotes, setEditingNotes] = useState(false);
  const [tempNotes, setTempNotes] = useState('');
  const [sidebarView, setSidebarView] = useState('learn');

  
  const [showExportSuccessModal, setShowExportSuccessModal] = useState(false);
  const [exportedNodeCount, setExportedNodeCount] = useState(0);
  const [exportedNoteId, setExportedNoteId] = useState(null);

  
  useEffect(() => {
    if (currentRoadmap && currentRoadmap.id && nodes.length > 0) {
      const roadmapState = {
        expandedNodes: Array.from(expandedNodes),
        exploredNodesCache: Array.from(exploredNodesCache.entries()),
        manualNotes: Array.from(manualNotes.entries()),
        timestamp: Date.now()
      };
      localStorage.setItem(`roadmap_state_${currentRoadmap.id}`, JSON.stringify(roadmapState));
          }
  }, [expandedNodes, exploredNodesCache, manualNotes, currentRoadmap, nodes]);
  const [showChatSelectModal, setShowChatSelectModal] = useState(false);
const [chatSessions, setChatSessions] = useState([]);
const [selectedChatId, setSelectedChatId] = useState(null);

const fetchChatSessions = async () => {
  try {
    const response = await fetch(`${API_URL}/get_chat_sessions?user_id=${userId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (response.ok) {
      const data = await response.json();
      setChatSessions(data.sessions || []);
    }
  } catch (error) {
    // silenced
  }
};

const createRoadmapFromChat = async () => {
  if (!selectedChatId) {
    alert('Please select a chat session');
    return;
  }

  try {
    setLoading(true);
    
    
    const topicResponse = await fetch(`${API_URL}/create_roadmap_from_chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        user_id: userId,
        chat_session_id: selectedChatId
      })
    });

    if (!topicResponse.ok) {
      throw new Error('Failed to extract topic from chat');
    }

    const topicData = await topicResponse.json();
    const extractedTopic = topicData.root_topic;

    
    const response = await fetch(`${API_URL}/create_knowledge_roadmap`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        user_id: userId,
        root_topic: extractedTopic
      })
    });

    if (response.ok) {
      const data = await response.json();
      setShowChatSelectModal(false);
      setSelectedChatId(null);
      
      clearRoadmapState(data.roadmap_id);
      
      await fetchRoadmaps();
      viewRoadmap(data.roadmap_id);
    } else {
      alert('Failed to create roadmap');
    }
  } catch (error) {
        alert('Error creating roadmap from chat');
  } finally {
    setLoading(false);
  }
};
  
  const loadRoadmapState = useCallback((roadmapId) => {
    const savedState = localStorage.getItem(`roadmap_state_${roadmapId}`);
    if (savedState) {
      try {
        const state = JSON.parse(savedState);
                return state;
      } catch (error) {
    // silenced
  }
    }
    return null;
  }, []);

  
  const clearRoadmapState = useCallback((roadmapId) => {
    if (roadmapId) {
      localStorage.removeItem(`roadmap_state_${roadmapId}`);
    }
    setExpandedNodes(new Set());
    setExploredNodesCache(new Map());
    setManualNotes(new Map());
    setSelectedNodeId(null);
  }, []);

  
  const expandNodeRef = useRef(null);
  const exploreNodeRef = useRef(null);
  const addChildNodeRef = useRef(null);

  
  const HORIZONTAL_SPACING = 180;
  const VERTICAL_SPACING = 150;

  const nodeTypes = useMemo(() => ({
    custom: CustomNode,
  }), []);

  useEffect(() => {
    fetchRoadmaps();
  }, []);

  
  useEffect(() => {
    if (roadmapId && !currentRoadmap) {
      viewRoadmap(parseInt(roadmapId));
    }
  }, [roadmapId]);

  const fetchRoadmaps = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/get_user_roadmaps?user_id=${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setRoadmaps(data.roadmaps || []);
      } else {
              }
    } catch (error) {
    // silenced
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
      const response = await fetch(`${API_URL}/create_knowledge_roadmap`, {
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
        
        
        clearRoadmapState(data.roadmap_id);
        
        await fetchRoadmaps();
        viewRoadmap(data.roadmap_id);
      } else {
        alert('Failed to create roadmap');
      }
    } catch (error) {
            alert('Error creating roadmap');
    } finally {
      setLoading(false);
    }
  };

  const deleteRoadmap = async (roadmapId) => {
    if (!window.confirm('Are you sure you want to delete this roadmap? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/delete_roadmap/${roadmapId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        
        setRoadmaps(prev => prev.filter(roadmap => roadmap.id !== roadmapId));
        
        
        clearRoadmapState(roadmapId);
        
        
        if (currentRoadmap && currentRoadmap.id === roadmapId) {
          setCurrentRoadmap(null);
          setNodes([]);
          setEdges([]);
          setNodeExplanation(null);
        }
        
        alert('Roadmap deleted successfully');
      } else {
        alert('Failed to delete roadmap');
      }
    } catch (error) {
            alert('Error deleting roadmap');
    }
  };

  
  const expandNode = useCallback(async (nodeId) => {
        
    setNodes((nds) => {
      return nds.map(n =>
        n.data.nodeId === nodeId
          ? { ...n, data: { ...n.data, isExpanding: true } }
          : n
      );
    });
    
    try {
      const response = await fetch(`${API_URL}/expand_knowledge_node/${nodeId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        
        
        if (data.status === 'already_expanded') {
          const childrenExist = edges.some(e => String(e.source) === String(nodeId));
          
          if (!childrenExist && currentRoadmap) {
            const roadmapResponse = await fetch(`${API_URL}/get_knowledge_roadmap/${currentRoadmap.id}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (roadmapResponse.ok) {
              const roadmapData = await roadmapResponse.json();
              const allNodes = roadmapData.nodes_flat || [];
              const children = allNodes.filter(n => n.parent_id === nodeId);
              
              if (children.length > 0) {
                
                let removedNodeIds = new Set();
                
                
                setNodes((nds) => {
                  const parentNode = nds.find(n => n.data.nodeId === nodeId);
                  if (!parentNode) return nds;
                  
                  const parentDepth = parentNode.data.depth;
                  
                  
                  const siblingsAtSameDepth = nds.filter(n => 
                    n.data.depth === parentDepth && 
                    n.data.nodeId !== nodeId &&
                    n.data.expansionStatus === 'expanded'
                  );
                  
                  let finalNodes = nds;
                  
                  
                  if (siblingsAtSameDepth.length > 0) {
                    const siblingIds = siblingsAtSameDepth.map(s => String(s.id));
                    
                    
                    const adjacencyMap = new Map();
                    edges.forEach(edge => {
                      const source = String(edge.source);
                      if (!adjacencyMap.has(source)) {
                        adjacencyMap.set(source, []);
                      }
                      adjacencyMap.get(source).push(String(edge.target));
                    });
                    
                    
                    const queue = [...siblingIds];
                    const visited = new Set();
                    
                    while (queue.length > 0) {
                      const currentNodeId = queue.shift();
                      if (visited.has(currentNodeId)) continue;
                      visited.add(currentNodeId);
                      
                      const nodeChildren = adjacencyMap.get(currentNodeId) || [];
                      nodeChildren.forEach(childId => {
                        removedNodeIds.add(childId);
                        queue.push(childId);
                      });
                    }
                    
                    
                    finalNodes = nds.filter(n => !removedNodeIds.has(String(n.id))).map(n => {
                      if (siblingIds.includes(String(n.id))) {
                        
                        setExpandedNodes(prev => {
                          const newSet = new Set(prev);
                          newSet.delete(n.data.nodeId);
                          return newSet;
                        });
                        return { ...n, data: { ...n.data, expansionStatus: 'unexpanded' } };
                      }
                      return n;
                    });
                  }
                  
                  
                  const horizontalSpacing = 180;
                  const baseVerticalSpacing = 150;
                  const depthMultiplier = 1.2;
                  const verticalSpacing = parentDepth === 0 
                    ? 350 
                    : baseVerticalSpacing * Math.pow(depthMultiplier, parentDepth);
                  
                  const totalWidth = (children.length - 1) * horizontalSpacing;
                  const startX = parentNode.position.x - (totalWidth / 2);

                  const newNodes = children.map((child, index) => ({
                    id: String(child.id),
                    type: 'custom',
                    position: { 
                      x: startX + (index * horizontalSpacing),
                      y: parentNode.position.y + verticalSpacing
                    },
                    data: {
                      label: child.topic_name,
                      description: child.description,
                      depth: child.depth_level,
                      isExplored: child.is_explored,
                      expansionStatus: child.expansion_status,
                      nodeId: child.id,
                      hasManualNotes: false,
                      onExpand: (id) => expandNodeRef.current && expandNodeRef.current(id),
                      onExplore: (id) => exploreNodeRef.current && exploreNodeRef.current(id),
                      onAddChild: (id) => addChildNodeRef.current && addChildNodeRef.current(id),
                    },
                  }));

                  return [
                    ...finalNodes.map(n =>
                      n.data.nodeId === nodeId
                        ? { ...n, data: { ...n.data, expansionStatus: 'expanded', isExpanding: false } }
                        : n
                    ),
                    ...newNodes
                  ];
                });
                
                
                setExpandedNodes(prev => new Set(prev).add(nodeId));
                
                
                setEdges((eds) => {
                  const cleanedEdges = eds.filter(edge => 
                    !removedNodeIds.has(String(edge.source)) && !removedNodeIds.has(String(edge.target))
                  );
                  
                  const newEdges = children.map(child => ({
                    id: `e${child.parent_id}-${child.id}`,
                    source: String(child.parent_id),
                    target: String(child.id),
                    type: 'smoothstep',
                    animated: true,
                    style: { stroke: '#D7B38C', strokeWidth: 3 },
                    markerEnd: {
                      type: 'arrow',
                      color: '#D7B38C',
                      width: 20,
                      height: 20,
                    },
                  }));
                  
                  return [...cleanedEdges, ...newEdges];
                });
                
                setTimeout(() => {
                  setEdges((eds) => eds.map(e => ({ ...e, animated: false })));
                }, 2000);
                
                return;
              }
            }
          }
          
          setNodes((nds) =>
            nds.map(n =>
              n.data.nodeId === nodeId
                ? { ...n, data: { ...n.data, expansionStatus: 'expanded', isExpanding: false } }
                : n
            )
          );
          
          setExpandedNodes(prev => new Set(prev).add(nodeId));
          return;
        }
        
        
        if (data.child_nodes && data.child_nodes.length > 0) {
          
          let removedNodeIds = new Set();
          
          setNodes((nds) => {
            const parentNode = nds.find(n => n.data.nodeId === nodeId);
            
            if (!parentNode) {
                            return nds.map(n =>
                n.data.nodeId === nodeId
                  ? { ...n, data: { ...n.data, isExpanding: false } }
                  : n
              );
            }
            
            const parentDepth = parentNode.data.depth;
            const siblingsAtSameDepth = nds.filter(n => 
              n.data.depth === parentDepth && 
              n.data.nodeId !== nodeId &&
              n.data.expansionStatus === 'expanded'
            );
            
            let finalNodes;
            
            if (siblingsAtSameDepth.length > 0) {
              const siblingIds = siblingsAtSameDepth.map(s => String(s.id));
              
              
              const adjacencyMap = new Map();
              edges.forEach(edge => {
                const source = String(edge.source);
                if (!adjacencyMap.has(source)) {
                  adjacencyMap.set(source, []);
                }
                adjacencyMap.get(source).push(String(edge.target));
              });
              
              const queue = [...siblingIds];
              const visited = new Set();
              
              while (queue.length > 0) {
                const currentNodeId = queue.shift();
                if (visited.has(currentNodeId)) continue;
                visited.add(currentNodeId);
                
                const nodeChildren = adjacencyMap.get(currentNodeId) || [];
                nodeChildren.forEach(childId => {
                  removedNodeIds.add(childId);
                  queue.push(childId);
                });
              }
              
              const filteredNodes = nds.filter(n => !removedNodeIds.has(String(n.id)));
              finalNodes = filteredNodes.map(n => {
                if (siblingIds.includes(String(n.id))) {
                  
                  setExpandedNodes(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(n.data.nodeId);
                    return newSet;
                  });
                  return { ...n, data: { ...n.data, expansionStatus: 'unexpanded' } };
                }
                return n;
              });
            } else {
              finalNodes = nds;
            }
            
            const childrenCount = data.child_nodes.length;
            const horizontalSpacing = 180;
            const baseVerticalSpacing = 150;
            const depthMultiplier = 1.2;
            const verticalSpacing = parentDepth === 0 
              ? 350 
              : baseVerticalSpacing * Math.pow(depthMultiplier, parentDepth);
            
            const totalWidth = (childrenCount - 1) * horizontalSpacing;
            const startX = parentNode.position.x - (totalWidth / 2);

            const newNodes = data.child_nodes.map((child, index) => ({
              id: String(child.id),
              type: 'custom',
              position: { 
                x: startX + (index * horizontalSpacing),
                y: parentNode.position.y + verticalSpacing
              },
              data: {
                label: child.topic_name,
                description: child.description,
                depth: child.depth_level,
                isExplored: child.is_explored,
                expansionStatus: child.expansion_status,
                nodeId: child.id,
                hasManualNotes: false,
                onExpand: (id) => expandNodeRef.current && expandNodeRef.current(id),
                onExplore: (id) => exploreNodeRef.current && exploreNodeRef.current(id),
                onAddChild: (id) => addChildNodeRef.current && addChildNodeRef.current(id),
              },
            }));

            return [
              ...finalNodes.map(n =>
                n.data.nodeId === nodeId
                  ? { ...n, data: { ...n.data, expansionStatus: 'expanded', isExpanding: false } }
                  : n
              ),
              ...newNodes
            ];
          });
          
          
          setExpandedNodes(prev => new Set(prev).add(nodeId));
          
          
          setEdges((eds) => {
            
            const cleanedEdges = eds.filter(edge => 
              !removedNodeIds.has(String(edge.source)) && !removedNodeIds.has(String(edge.target))
            );
            
            
            const newEdges = data.child_nodes.map(child => ({
              id: `e${child.parent_id}-${child.id}`,
              source: String(child.parent_id),
              target: String(child.id),
              type: 'smoothstep',
              animated: true,
              style: { stroke: '#D7B38C', strokeWidth: 3 },
              markerEnd: {
                type: 'arrow',
                color: '#D7B38C',
                width: 20,
                height: 20,
              },
            }));
            
            return [...cleanedEdges, ...newEdges];
          });

          setTimeout(() => {
            setEdges((eds) => {
              const newEdgeIds = data.child_nodes.map(child => `e${child.parent_id}-${child.id}`);
              return eds.map(e =>
                newEdgeIds.includes(e.id) ? { ...e, animated: false } : e
              );
            });
          }, 2000);
        }
      } else {
                setNodes((nds) =>
          nds.map(n =>
            n.data.nodeId === nodeId
              ? { ...n, data: { ...n.data, isExpanding: false } }
              : n
          )
        );
      }
    } catch (error) {
            setNodes((nds) =>
        nds.map(n =>
          n.data.nodeId === nodeId
            ? { ...n, data: { ...n.data, isExpanding: false } }
            : n
        )
      );
    }
  }, [setNodes, setEdges, edges, currentRoadmap, token]);

  
  expandNodeRef.current = expandNode;

  
  const exploreNode = useCallback(async (nodeId) => {
        
    
    if (exploredNodesCache.has(nodeId)) {
            const cachedData = exploredNodesCache.get(nodeId);
      setNodeExplanation(cachedData);
      return;
    }
    
    setNodes((nds) =>
      nds.map(n =>
        n.data.nodeId === nodeId
          ? { ...n, data: { ...n.data, isExploring: true } }
          : n
      )
    );
    
    try {
      const response = await fetch(`${API_URL}/explore_node/${nodeId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        
        
        const nodeData = data.node || data;
                
        
        const completeNodeData = {
          ...nodeData,
          topic_name: nodeData.topic_name,
          ai_explanation: nodeData.ai_explanation,
          key_concepts: nodeData.key_concepts || [],
          why_important: nodeData.why_important,
          real_world_examples: nodeData.real_world_examples || [],
          learning_tips: nodeData.learning_tips
        };
        
        
        setExploredNodesCache(prev => new Map(prev).set(nodeId, completeNodeData));
        
        setNodeExplanation(completeNodeData);
        
        setNodes((nds) =>
          nds.map(n =>
            n.data.nodeId === nodeId
              ? { ...n, data: { ...n.data, isExplored: true, isExploring: false } }
              : n
          )
        );
      } else {
        const errorData = await response.json().catch(() => ({}));
                alert(`Failed to explore node: ${errorData.detail || 'Unknown error'}`);
        
        setNodes((nds) =>
          nds.map(n =>
            n.data.nodeId === nodeId
              ? { ...n, data: { ...n.data, isExploring: false } }
              : n
          )
        );
      }
    } catch (error) {
            alert('Failed to explore node');
      
      setNodes((nds) =>
        nds.map(n =>
          n.data.nodeId === nodeId
            ? { ...n, data: { ...n.data, isExploring: false } }
            : n
        )
      );
    }
  }, [setNodes, token, exploredNodesCache]);

  
  exploreNodeRef.current = exploreNode;

  
  const handleAddChildNode = useCallback((parentNodeId) => {
    setAddNodeParentId(parentNodeId);
    setNewNodeTopic('');
    setNewNodeDescription('');
    setShowAddNodeModal(true);
  }, []);

  
  addChildNodeRef.current = handleAddChildNode;

  
  const createManualNode = async () => {
    if (!newNodeTopic.trim() || !addNodeParentId || !currentRoadmap) return;

    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/add_manual_node`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          roadmap_id: currentRoadmap.id,
          parent_id: addNodeParentId,
          topic_name: newNodeTopic.trim(),
          description: newNodeDescription.trim() || `Custom node: ${newNodeTopic.trim()}`
        })
      });

      if (response.ok) {
        const data = await response.json();
        const newNode = data.node;

        
        setNodes((nds) => {
          const parentNode = nds.find(n => n.data.nodeId === addNodeParentId);
          if (!parentNode) return nds;

          
          const siblingNodes = nds.filter(n => {
            const edge = edges.find(e => String(e.target) === String(n.id) && String(e.source) === String(addNodeParentId));
            return edge !== undefined;
          });

          const horizontalSpacing = 180;
          const baseVerticalSpacing = 150;
          const parentDepth = parentNode.data.depth;
          const verticalSpacing = parentDepth === 0 ? 350 : baseVerticalSpacing * Math.pow(1.2, parentDepth);

          
          const newX = siblingNodes.length > 0 
            ? Math.max(...siblingNodes.map(n => n.position.x)) + horizontalSpacing
            : parentNode.position.x;

          const flowNode = {
            id: String(newNode.id),
            type: 'custom',
            position: {
              x: newX,
              y: parentNode.position.y + verticalSpacing
            },
            data: {
              label: newNode.topic_name,
              description: newNode.description,
              depth: newNode.depth_level,
              isExplored: false,
              expansionStatus: 'unexpanded',
              nodeId: newNode.id,
              isManual: true,
              hasManualNotes: false,
              onExpand: (id) => expandNodeRef.current && expandNodeRef.current(id),
              onExplore: (id) => exploreNodeRef.current && exploreNodeRef.current(id),
              onAddChild: (id) => addChildNodeRef.current && addChildNodeRef.current(id),
            },
          };

          return [...nds, flowNode];
        });

        
        setEdges((eds) => [
          ...eds,
          {
            id: `e${addNodeParentId}-${newNode.id}`,
            source: String(addNodeParentId),
            target: String(newNode.id),
            type: 'smoothstep',
            animated: true,
            style: { stroke: '#D7B38C', strokeWidth: 3 },
            markerEnd: {
              type: 'arrow',
              color: '#D7B38C',
              width: 20,
              height: 20,
            },
          }
        ]);

        
        setExpandedNodes(prev => new Set(prev).add(addNodeParentId));
        setNodes((nds) => nds.map(n => 
          n.data.nodeId === addNodeParentId 
            ? { ...n, data: { ...n.data, expansionStatus: 'expanded' } }
            : n
        ));

        
        setTimeout(() => {
          setEdges((eds) => eds.map(e => 
            e.id === `e${addNodeParentId}-${newNode.id}` ? { ...e, animated: false } : e
          ));
        }, 2000);

        setShowAddNodeModal(false);
        setAddNodeParentId(null);
        setNewNodeTopic('');
        setNewNodeDescription('');
      } else {
        alert('Failed to add node');
      }
    } catch (error) {
      console.error('Error adding manual node:', error);
      alert('Error adding node');
    } finally {
      setLoading(false);
    }
  };

  
  const deleteSelectedNode = async () => {
    if (!selectedNodeId || !currentRoadmap) return;

    
    const selectedNode = nodes.find(n => n.data.nodeId === selectedNodeId);
    if (selectedNode && selectedNode.data.depth === 0) {
      alert('Cannot delete the root node');
      return;
    }

    if (!window.confirm('Delete this node and all its children?')) return;

    try {
      const response = await fetch(`${API_URL}/delete_roadmap_node/${selectedNodeId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        
        const nodesToRemove = new Set([String(selectedNodeId)]);
        const queue = [String(selectedNodeId)];

        while (queue.length > 0) {
          const currentId = queue.shift();
          edges.forEach(edge => {
            if (String(edge.source) === currentId) {
              nodesToRemove.add(String(edge.target));
              queue.push(String(edge.target));
            }
          });
        }

        
        setNodes((nds) => nds.filter(n => !nodesToRemove.has(String(n.id))));

        
        setEdges((eds) => eds.filter(e => 
          !nodesToRemove.has(String(e.source)) && !nodesToRemove.has(String(e.target))
        ));

        
        setSelectedNodeId(null);
        if (nodeExplanation && nodesToRemove.has(String(nodeExplanation.id))) {
          setNodeExplanation(null);
        }

        
        setExpandedNodes(prev => {
          const newSet = new Set(prev);
          nodesToRemove.forEach(id => newSet.delete(parseInt(id)));
          return newSet;
        });

        
        setManualNotes(prev => {
          const newMap = new Map(prev);
          nodesToRemove.forEach(id => newMap.delete(parseInt(id)));
          return newMap;
        });
      } else {
        alert('Failed to delete node');
      }
    } catch (error) {
      console.error('Error deleting node:', error);
      alert('Error deleting node');
    }
  };

  
  const onNodeClick = useCallback((event, node) => {
    setSelectedNodeId(node.data.nodeId);
  }, []);

  
  const saveManualNotes = () => {
    if (nodeExplanation) {
      setManualNotes(prev => {
        const newMap = new Map(prev);
        if (tempNotes.trim()) {
          newMap.set(nodeExplanation.id || nodeExplanation.nodeId, tempNotes);
        } else {
          newMap.delete(nodeExplanation.id || nodeExplanation.nodeId);
        }
        return newMap;
      });

      
      const nodeId = nodeExplanation.id || nodeExplanation.nodeId;
      setNodes((nds) => nds.map(n => 
        n.data.nodeId === nodeId 
          ? { ...n, data: { ...n.data, hasManualNotes: tempNotes.trim().length > 0 } }
          : n
      ));
    }
    setEditingNotes(false);
  };

  
  const startEditingNotes = () => {
    const nodeId = nodeExplanation?.id || nodeExplanation?.nodeId;
    setTempNotes(manualNotes.get(nodeId) || '');
    setEditingNotes(true);
  };

  const getNodePathForContext = useCallback((nodeId) => {
    if (!nodeId) return '';

    const normalizedNodeId = String(nodeId);
    const nodeById = new Map(nodes.map(n => [String(n.id), n]));
    const parentByChild = new Map(edges.map(e => [String(e.target), String(e.source)]));
    const pathLabels = [];
    const visited = new Set();

    let currentId = normalizedNodeId;
    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const flowNode = nodeById.get(currentId);
      if (!flowNode) break;
      pathLabels.unshift(flowNode.data?.label || flowNode.data?.topic_name || `Node ${currentId}`);
      currentId = parentByChild.get(currentId);
    }

    return pathLabels.join(' -> ');
  }, [nodes, edges]);

  const buildNodeAwareChatPrompt = useCallback((node, questionText) => {
    const nodeId = node?.id || node?.nodeId;
    const nodeTopic = node?.topic_name || node?.label || 'Unknown topic';
    const nodePath = getNodePathForContext(nodeId);
    const keyConcepts = Array.isArray(node?.key_concepts) ? node.key_concepts : [];
    const examples = Array.isArray(node?.real_world_examples) ? node.real_world_examples : [];
    const personalNotes = nodeId ? (manualNotes.get(nodeId) || 'No personal notes yet.') : 'No personal notes yet.';

    const recentTurns = chatMessages
      .slice(-6)
      .map((msg) => `${msg.type === 'user' ? 'Student' : 'Tutor'}: ${msg.content}`)
      .join('\n');

    return `You are helping the student with one specific Knowledge Roadmap node.
Stay tightly focused on this node and its scope unless the student explicitly asks to broaden.

Roadmap: ${currentRoadmap?.title || currentRoadmap?.root_topic || 'Knowledge Roadmap'}
Node: ${nodeTopic}
Node Path: ${nodePath || nodeTopic}
Node Summary: ${node?.ai_explanation || 'No generated summary yet.'}
Why It Matters: ${node?.why_important || 'Not available yet.'}
Key Concepts: ${keyConcepts.length ? keyConcepts.join('; ') : 'Not available yet.'}
Examples: ${examples.length ? examples.join('; ') : 'Not available yet.'}
Learning Tips: ${node?.learning_tips || 'Not available yet.'}
Student Notes: ${personalNotes}

Recent Conversation (same node):
${recentTurns || 'No prior turns.'}

Student Question:
${questionText}

Instructions:
- Answer in the context of this exact node.
- Reference the node path when helpful.
- If the question is ambiguous, ask one clarifying question tied to this node.`;
  }, [chatMessages, currentRoadmap, getNodePathForContext, manualNotes]);

  const copyToClipboard = (text, codeIndex) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedCode(codeIndex);
      setTimeout(() => setCopiedCode(null), 2000);
    }).catch(() => {});
  };

  const renderTable = (tableRows) => {
    if (tableRows.length < 2) return tableRows.join('\n');

    const headers = tableRows[0].split('|').map(h => h.trim()).filter(Boolean);
    const columnCount = headers.length;
    let tableBlockHtml = '<div class="table-block-container">';

    tableBlockHtml += '<div class="table-block-header">';
    tableBlockHtml += '<span class="table-info">TABLE</span>';
    tableBlockHtml += `<span class="table-meta">${tableRows.length - 1} rows × ${columnCount} columns</span>`;
    tableBlockHtml += '</div>';

    tableBlockHtml += '<div class="table-block-content">';
    tableBlockHtml += '<table class="structured-table">';

    if (headers.length > 0) {
      tableBlockHtml += '<thead><tr>';
      headers.forEach(header => {
        tableBlockHtml += `<th>${header}</th>`;
      });
      tableBlockHtml += '</tr></thead>';
    }

    tableBlockHtml += '<tbody>';
    let rowCount = 0;
    for (let i = 1; i < tableRows.length; i++) {
      const row = tableRows[i];
      if (row.includes('---')) continue;

      const cells = row.split('|').map(c => c.trim()).filter(Boolean);
      if (cells.length > 0) {
        rowCount++;
        tableBlockHtml += `<tr class="table-row-${rowCount % 2 === 0 ? 'even' : 'odd'}">`;
        cells.forEach((cell, index) => {
          const cellContent = cell || '—';
          tableBlockHtml += `<td data-column="${index + 1}">${cellContent}</td>`;
        });
        tableBlockHtml += '</tr>';
      }
    }
    tableBlockHtml += '</tbody></table>';
    tableBlockHtml += '</div></div>';

    return tableBlockHtml;
  };

  const renderMarkdown = (text) => {
    if (!text) return '';

    const mathSymbols = ['∑', 'Σ', '∫', '∏', 'Π', '∮', '∯', '∰', '⨌'];
    mathSymbols.forEach(symbol => {
      try {
        const escaped = symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escaped, 'g');
        text = text.replace(regex, `<span class="math-symbol">${symbol}</span>`);
      } catch {
        text = text.split(symbol).join(`<span class="math-symbol">${symbol}</span>`);
      }
    });

    const lines = text.split('\n');
    const processedLines = [];
    let inBulletList = false;
    let inNumberedList = false;
    let inTable = false;
    let tableRows = [];

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();

      if (line.includes('|') && !inTable) {
        inTable = true;
        tableRows = [line];
        continue;
      } else if (inTable && line.includes('|')) {
        tableRows.push(line);
        continue;
      } else if (inTable && !line.includes('|')) {
        inTable = false;
        processedLines.push(renderTable(tableRows));
        tableRows = [];
      }
      if (inTable) continue;

      if (/^#### (.+)$/.test(line)) {
        if (inBulletList) { processedLines.push('</ul>'); inBulletList = false; }
        if (inNumberedList) { processedLines.push('</ol>'); inNumberedList = false; }
        processedLines.push(`<h4 class="md-h4">${line.replace(/^#### (.+)$/, '$1')}</h4>`);
        continue;
      }
      if (/^### (.+)$/.test(line)) {
        if (inBulletList) { processedLines.push('</ul>'); inBulletList = false; }
        if (inNumberedList) { processedLines.push('</ol>'); inNumberedList = false; }
        processedLines.push(`<h3 class="md-h3">${line.replace(/^### (.+)$/, '$1')}</h3>`);
        continue;
      }
      if (/^## (.+)$/.test(line)) {
        if (inBulletList) { processedLines.push('</ul>'); inBulletList = false; }
        if (inNumberedList) { processedLines.push('</ol>'); inNumberedList = false; }
        processedLines.push(`<h2 class="md-h2">${line.replace(/^## (.+)$/, '$1')}</h2>`);
        continue;
      }
      if (/^# (.+)$/.test(line)) {
        if (inBulletList) { processedLines.push('</ul>'); inBulletList = false; }
        if (inNumberedList) { processedLines.push('</ol>'); inNumberedList = false; }
        processedLines.push(`<h1 class="md-h1">${line.replace(/^# (.+)$/, '$1')}</h1>`);
        continue;
      }

      if (/^\*\*(.+?)\*\*/.test(line)) {
        line = line.replace(/\*\*(.+?)\*\*/g, '<strong class="md-bold-heading">$1</strong>');
      } else {
        line = line.replace(/\*\*(.+?)\*\*/g, '<strong class="md-bold-inline">$1</strong>');
      }
      line = line.replace(/__(.+?)__/g, '<strong class="md-bold-inline">$1</strong>');
      line = line.replace(/(?<!\w)\*([^*]+?)\*(?!\w)/g, '<em>$1</em>');
      line = line.replace(/(?<!\w)_([^_]+?)_(?!\w)/g, '<em>$1</em>');
      line = line.replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>');
      line = line.replace(/\b([A-Z]{2,})\b/g, '<span class="keyword">$1</span>');

      const isBullet = /^[\*\-•] (.+)$/.test(line);
      const isNumbered = /^\d+\. (.+)$/.test(line);

      if (isBullet) {
        if (!inBulletList) {
          processedLines.push('<ul class="md-ul">');
          inBulletList = true;
        }
        processedLines.push(`<li class="md-li">${line.replace(/^[\*\-•] (.+)$/, '$1')}</li>`);
      } else if (isNumbered) {
        if (!inNumberedList) {
          processedLines.push('<ol class="md-ol">');
          inNumberedList = true;
        }
        processedLines.push(`<li class="md-li-num">${line.replace(/^\d+\. (.+)$/, '$1')}</li>`);
      } else {
        if (inBulletList) {
          processedLines.push('</ul>');
          inBulletList = false;
        }
        if (inNumberedList) {
          processedLines.push('</ol>');
          inNumberedList = false;
        }
        processedLines.push(line);
      }
    }

    if (inTable && tableRows.length > 0) {
      processedLines.push(renderTable(tableRows));
    }
    if (inBulletList) processedLines.push('</ul>');
    if (inNumberedList) processedLines.push('</ol>');

    const finalContent = [];
    let currentParagraph = [];

    for (let i = 0; i < processedLines.length; i++) {
      const line = processedLines[i];
      const trimmedLine = line.trim();
      const isBlockElement = line.startsWith('<h') || line.startsWith('<ul') || line.startsWith('<ol') ||
        line.startsWith('</ul>') || line.startsWith('</ol>') ||
        line.startsWith('<div class="table-block-container">');
      const isEmptyLine = trimmedLine === '';

      if (isBlockElement) {
        if (currentParagraph.length > 0) {
          finalContent.push(`<p>${currentParagraph.join(' ')}</p>`);
          currentParagraph = [];
        }
        finalContent.push(line);
      } else if (isEmptyLine) {
        if (currentParagraph.length > 0) {
          finalContent.push(`<p>${currentParagraph.join(' ')}</p>`);
          currentParagraph = [];
        }
      } else if (trimmedLine) {
        currentParagraph.push(trimmedLine);
      }
    }

    if (currentParagraph.length > 0) {
      finalContent.push(`<p>${currentParagraph.join(' ')}</p>`);
    }

    text = finalContent.join('\n');
    if (text && !text.startsWith('<')) {
      text = `<p>${text}</p>`;
    }
    return text;
  };

  const stripThinking = (text) => {
    if (!text) return text;
    text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    text = text.replace(/\[thinking\][\s\S]*?\[\/thinking\]/gi, '').trim();
    return text;
  };

  const renderChatMessageContent = (content) => {
    if (!content) return null;
    content = stripThinking(content);

    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          content: content.substring(lastIndex, match.index)
        });
      }
      parts.push({
        type: 'code',
        language: match[1] || 'plaintext',
        content: match[2].trim()
      });
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < content.length) {
      parts.push({
        type: 'text',
        content: content.substring(lastIndex)
      });
    }

    if (parts.length === 0) {
      parts.push({ type: 'text', content });
    }

    return parts.map((part, index) => {
      if (part.type === 'text') {
        const htmlContent = renderMarkdown(part.content);
        const finalContent = htmlContent && htmlContent.trim() ? htmlContent : `<p>${part.content}</p>`;
        return <MathRenderer key={`${part.type}-${index}`} content={finalContent} />;
      }

      return (
        <div key={`${part.type}-${index}`} className="code-block-container" data-language={part.language}>
          <div className="code-block-header">
            <span className="code-language">{part.language.toUpperCase()}</span>
            <button
              className={`code-copy-btn ${copiedCode === index ? 'copied' : ''}`}
              onClick={() => copyToClipboard(part.content, index)}
              title="Copy code"
            >
              {copiedCode === index ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  COPIED
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                  COPY
                </>
              )}
            </button>
          </div>
          <pre className="code-block">
            <code className={`language-${part.language}`}>{part.content}</code>
          </pre>
        </div>
      );
    });
  };

  
  const sendChatMessage = async () => {
    if (!chatInput.trim() || chatLoading || !nodeExplanation) return;

    const userMessage = {
      id: `user_${Date.now()}`,
      type: 'user',
      content: chatInput,
      timestamp: new Date().toISOString()
    };

    setChatMessages(prev => [...prev, userMessage]);
    const messageText = chatInput;
    setChatInput('');
    setChatLoading(true);

    try {
      const formData = new FormData();
      formData.append('user_id', userId);
      formData.append('question', buildNodeAwareChatPrompt(nodeExplanation, messageText));
      formData.append('chat_id', ''); 
      const hsModeEnabled = localStorage.getItem('hs_mode_enabled') === 'true';
      formData.append('use_hs_context', String(hsModeEnabled));

      const response = await fetch(`${API_URL}/ask/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        const aiMessage = {
          id: `ai_${Date.now()}`,
          type: 'assistant',
          content: data.answer || data.response || 'No response received',
          timestamp: new Date().toISOString()
        };
        setChatMessages(prev => [...prev, aiMessage]);
      } else {
        throw new Error('Failed to get AI response');
      }
    } catch (error) {
            const errorMessage = {
        id: `error_${Date.now()}`,
        type: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date().toISOString()
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleChatKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  };

  
  useEffect(() => {
    if (nodeExplanation) {
      setChatMessages([]);
      setChatInput('');
      setSidebarView('learn');
      setEditingNotes(false);
    }
  }, [nodeExplanation]);

  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [chatMessages, chatLoading]);

  
  const viewRoadmap = async (roadmapId) => {
    
    navigate(`/knowledge-roadmap/${roadmapId}`);
    
    try {
      setLoading(true);
      
      
      const savedState = loadRoadmapState(roadmapId);
      
      const response = await fetch(`${API_URL}/get_knowledge_roadmap/${roadmapId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setCurrentRoadmap(data.roadmap);
        
        
        const allNodes = data.nodes_flat || [];
        
        
        const savedExpandedNodes = savedState ? new Set(savedState.expandedNodes) : new Set();
        
        
        if (savedState && savedState.exploredNodesCache) {
          setExploredNodesCache(new Map(savedState.exploredNodesCache));
        }

        
        if (savedState && savedState.manualNotes) {
          setManualNotes(new Map(savedState.manualNotes));
        }
        
        
        const childrenMap = new Map();
        allNodes.forEach(node => {
          if (node.parent_id) {
            if (!childrenMap.has(node.parent_id)) {
              childrenMap.set(node.parent_id, []);
            }
            childrenMap.get(node.parent_id).push(node);
          }
        });
        
        
        const rootNodes = allNodes.filter(node => !node.parent_id);
        
        
        
        
        
        const visibleNodeIds = new Set();
        const queue = [...rootNodes.map(n => n.id)];
        
        while (queue.length > 0) {
          const currentNodeId = queue.shift();
          visibleNodeIds.add(currentNodeId);
          
          
          if (savedExpandedNodes.has(currentNodeId)) {
            const children = childrenMap.get(currentNodeId) || [];
            children.forEach(child => queue.push(child.id));
          }
        }
        
        
        
        setExpandedNodes(savedExpandedNodes);
        
        
        const visibleNodes = allNodes.filter(node => visibleNodeIds.has(node.id));
                
        
        const nodesByDepth = new Map();
        visibleNodes.forEach(node => {
          if (!nodesByDepth.has(node.depth_level)) {
            nodesByDepth.set(node.depth_level, []);
          }
          nodesByDepth.get(node.depth_level).push(node);
        });

        
        const flowNodes = visibleNodes.map(node => {
          const nodesAtThisDepth = nodesByDepth.get(node.depth_level) || [];
          const indexAtDepth = nodesAtThisDepth.indexOf(node);
          const horizontalSpacing = 180;
          const baseVerticalSpacing = 150;
          const depthMultiplier = 1.2;
          const verticalSpacing = baseVerticalSpacing * Math.pow(depthMultiplier, node.depth_level);
          
          const totalWidth = (nodesAtThisDepth.length - 1) * horizontalSpacing;
          const startX = 400 - (totalWidth / 2);

          
          const savedManualNotes = savedState?.manualNotes ? new Map(savedState.manualNotes) : new Map();
          const hasNotes = savedManualNotes.has(node.id);

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
              
              expansionStatus: savedExpandedNodes.has(node.id) ? 'expanded' : 'unexpanded',
              nodeId: node.id,
              isManual: node.is_manual || false,
              hasManualNotes: hasNotes,
              onExpand: (id) => expandNodeRef.current && expandNodeRef.current(id),
              onExplore: (id) => exploreNodeRef.current && exploreNodeRef.current(id),
              onAddChild: (id) => addChildNodeRef.current && addChildNodeRef.current(id),
            },
          };
        });

        
        const flowEdges = [];
        visibleNodes.forEach(node => {
          if (node.parent_id && visibleNodeIds.has(node.parent_id)) {
            flowEdges.push({
              id: `e${node.parent_id}-${node.id}`,
              source: String(node.parent_id),
              target: String(node.id),
              type: 'smoothstep',
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
      console.error('❌ Error loading roadmap:', error);
          } finally {
      setLoading(false);
    }
  };

  
  const exportRoadmapToNotes = async () => {
    if (!currentRoadmap || exporting) return;

    setExporting(true);
    try {
      
      const response = await fetch(`${API_URL}/get_knowledge_roadmap/${currentRoadmap.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch roadmap data');
      }

      const data = await response.json();
      const allNodes = data.nodes_flat || [];

      
      const exploredNodes = allNodes.filter(node => node.is_explored);

      if (exploredNodes.length === 0) {
        alert('No explored nodes to export.\n\nPlease click the "Explore" button on nodes to generate content before exporting.');
        setExporting(false);
        return;
      }

      
      const nodeMap = new Map();
      exploredNodes.forEach(node => {
        nodeMap.set(node.id, { ...node, children: [] });
      });

      
      const rootNodes = [];
      exploredNodes.forEach(node => {
        const nodeData = nodeMap.get(node.id);
        if (node.parent_id && nodeMap.has(node.parent_id)) {
          nodeMap.get(node.parent_id).children.push(nodeData);
        } else {
          rootNodes.push(nodeData);
        }
      });

      
      const sortChildren = (node) => {
        node.children.sort((a, b) => a.id - b.id);
        node.children.forEach(sortChildren);
      };
      rootNodes.forEach(sortChildren);

      
      let htmlContent = `<h1 style="font-weight: 800; font-size: 28px; margin-bottom: 24px; color: var(--accent);">${currentRoadmap.title || `Exploring ${currentRoadmap.root_topic}`}</h1>`;
      htmlContent += `<p style="color: var(--text-secondary); margin-bottom: 32px; font-style: italic;">Exported from Knowledge Roadmap on ${new Date().toLocaleDateString()}</p>`;
      htmlContent += `<hr style="border: none; border-top: 2px solid var(--border); margin: 24px 0;">`;

      const generateNodeContent = (node, depth = 0) => {
        let content = '';
        const indent = depth * 24;
        
        
        const headingLevel = Math.min(depth + 2, 6);
        const headingSize = [24, 20, 18, 16, 15, 14][depth] || 14;
        
        
        content += `<h${headingLevel} style="font-weight: 700; font-size: ${headingSize}px; margin-top: ${depth === 0 ? 32 : 24}px; margin-bottom: 12px; margin-left: ${indent}px; color: var(--accent);">`;
        content += `<strong>${node.topic_name}</strong>`;
        content += `</h${headingLevel}>`;

        
        if (node.description) {
          content += `<p style="margin-left: ${indent}px; margin-bottom: 12px; color: var(--text-secondary); font-size: 14px;">${node.description}</p>`;
        }

        
        if (node.ai_explanation) {
          content += `<div style="margin-left: ${indent}px; margin-bottom: 16px; padding: 16px; background: var(--panel); border-left: 4px solid var(--accent); border-radius: 4px;">`;
          content += `<h4 style="font-weight: 600; font-size: 14px; margin-bottom: 8px; color: var(--accent); text-transform: uppercase; letter-spacing: 0.5px;">Overview</h4>`;
          content += `<p style="color: var(--text-primary); line-height: 1.7; font-size: 14px;">${node.ai_explanation}</p>`;
          content += `</div>`;
        }

        
        if (node.key_concepts && node.key_concepts.length > 0) {
          content += `<div style="margin-left: ${indent}px; margin-bottom: 16px;">`;
          content += `<h4 style="font-weight: 600; font-size: 14px; margin-bottom: 8px; color: var(--accent); text-transform: uppercase; letter-spacing: 0.5px;">Key Concepts</h4>`;
          content += `<ul style="margin-left: 20px; color: var(--text-primary); line-height: 1.8;">`;
          node.key_concepts.forEach(concept => {
            content += `<li style="margin-bottom: 6px; font-size: 14px;">${concept}</li>`;
          });
          content += `</ul></div>`;
        }

        
        if (node.why_important) {
          content += `<div style="margin-left: ${indent}px; margin-bottom: 16px;">`;
          content += `<h4 style="font-weight: 600; font-size: 14px; margin-bottom: 8px; color: var(--accent); text-transform: uppercase; letter-spacing: 0.5px;">Why This Matters</h4>`;
          content += `<p style="color: var(--text-primary); line-height: 1.7; font-size: 14px;">${node.why_important}</p>`;
          content += `</div>`;
        }

        
        if (node.real_world_examples && node.real_world_examples.length > 0) {
          content += `<div style="margin-left: ${indent}px; margin-bottom: 16px;">`;
          content += `<h4 style="font-weight: 600; font-size: 14px; margin-bottom: 8px; color: var(--accent); text-transform: uppercase; letter-spacing: 0.5px;">Real-World Examples</h4>`;
          content += `<ul style="margin-left: 20px; color: var(--text-primary); line-height: 1.8;">`;
          node.real_world_examples.forEach(example => {
            content += `<li style="margin-bottom: 6px; font-size: 14px;">${example}</li>`;
          });
          content += `</ul></div>`;
        }

        
        if (node.learning_tips) {
          content += `<div style="margin-left: ${indent}px; margin-bottom: 16px; padding: 12px; background: color-mix(in srgb, var(--success) 10%, transparent); border-radius: 4px; border: 1px solid var(--success);">`;
          content += `<h4 style="font-weight: 600; font-size: 14px; margin-bottom: 8px; color: var(--success); text-transform: uppercase; letter-spacing: 0.5px;">Learning Tips</h4>`;
          content += `<p style="color: var(--text-primary); line-height: 1.7; font-size: 14px;">${node.learning_tips}</p>`;
          content += `</div>`;
        }

        
        const userNotes = manualNotes.get(node.id);
        if (userNotes) {
          content += `<div style="margin-left: ${indent}px; margin-bottom: 16px; padding: 12px; background: color-mix(in srgb, var(--warning) 10%, transparent); border-radius: 4px; border: 1px solid var(--warning);">`;
          content += `<h4 style="font-weight: 600; font-size: 14px; margin-bottom: 8px; color: var(--warning); text-transform: uppercase; letter-spacing: 0.5px;">My Notes</h4>`;
          content += `<p style="color: var(--text-primary); line-height: 1.7; font-size: 14px; white-space: pre-wrap;">${userNotes}</p>`;
          content += `</div>`;
        }

        
        if (depth > 0) {
          content += `<hr style="border: none; border-top: 1px solid var(--border); margin: 20px ${indent}px; opacity: 0.3;">`;
        }

        
        if (node.children && node.children.length > 0) {
          node.children.forEach(child => {
            content += generateNodeContent(child, depth + 1);
          });
        }

        return content;
      };

      
      rootNodes.forEach(rootNode => {
        htmlContent += generateNodeContent(rootNode, 0);
      });

      
      htmlContent += `<hr style="border: none; border-top: 2px solid var(--border); margin: 32px 0;">`;
      htmlContent += `<p style="color: var(--text-secondary); font-size: 12px; text-align: center; margin-top: 24px;">`;
      htmlContent += `Exported ${exploredNodes.length} explored node${exploredNodes.length !== 1 ? 's' : ''} from Knowledge Roadmap`;
      htmlContent += `</p>`;

      
      const createNoteResponse = await fetch(`${API_URL}/create_note`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          user_id: userId,
          title: `${currentRoadmap.title || currentRoadmap.root_topic} - Roadmap Export`,
          content: htmlContent
        })
      });

      if (createNoteResponse.ok) {
        const newNote = await createNoteResponse.json();
        setExportedNodeCount(exploredNodes.length);
        setExportedNoteId(newNote.id || newNote.note_id);
        setShowExportSuccessModal(true);
      } else {
        throw new Error('Failed to create note');
      }

    } catch (error) {
            alert('Failed to export roadmap to notes. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const activeNodePath = nodeExplanation
    ? getNodePathForContext(nodeExplanation.id || nodeExplanation.nodeId)
    : '';
  const activeNodeId = nodeExplanation ? (nodeExplanation.id || nodeExplanation.nodeId) : null;
  const activeNodeNotes = activeNodeId ? (manualNotes.get(activeNodeId) || '') : '';

  return (
    <div className="kr-page">
      <svg className="geo-bg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice">
        <circle cx="600" cy="400" r="360" fill="none" stroke="currentColor" strokeWidth="1"/>
        <circle cx="600" cy="400" r="260" fill="none" stroke="currentColor" strokeWidth="0.8"/>
        <circle cx="600" cy="400" r="168" fill="none" stroke="currentColor" strokeWidth="0.7"/>
        <circle cx="600" cy="400" r="90" fill="none" stroke="currentColor" strokeWidth="0.6"/>
        <line x1="600" y1="0" x2="600" y2="800" stroke="currentColor" strokeWidth="0.5"/>
        <line x1="0" y1="400" x2="1200" y2="400" stroke="currentColor" strokeWidth="0.5"/>
        <line x1="0" y1="800" x2="500" y2="0" stroke="currentColor" strokeWidth="0.4"/>
        <line x1="1200" y1="0" x2="700" y2="800" stroke="currentColor" strokeWidth="0.4"/>
        <circle cx="600" cy="40" r="5" fill="currentColor"/>
        <circle cx="600" cy="760" r="5" fill="currentColor"/>
        <circle cx="240" cy="400" r="5" fill="currentColor"/>
        <circle cx="960" cy="400" r="5" fill="currentColor"/>
        <circle cx="345" cy="146" r="3.5" fill="currentColor"/>
        <circle cx="855" cy="654" r="3.5" fill="currentColor"/>
        <circle cx="855" cy="146" r="3.5" fill="currentColor"/>
        <circle cx="345" cy="654" r="3.5" fill="currentColor"/>
        <rect x="24" y="24" width="72" height="72" fill="none" stroke="currentColor" strokeWidth="0.8"/>
        <rect x="44" y="44" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="0.5"/>
        <circle cx="60" cy="60" r="3" fill="currentColor"/>
        <rect x="1104" y="704" width="72" height="72" fill="none" stroke="currentColor" strokeWidth="0.8"/>
        <rect x="1124" y="724" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="0.5"/>
        <circle cx="1140" cy="740" r="3" fill="currentColor"/>
        <circle cx="120" cy="200" r="2" fill="currentColor"/>
        <circle cx="160" cy="160" r="1.5" fill="currentColor"/>
        <circle cx="200" cy="200" r="2" fill="currentColor"/>
        <circle cx="160" cy="240" r="1.5" fill="currentColor"/>
        <circle cx="1080" cy="600" r="2" fill="currentColor"/>
        <circle cx="1040" cy="640" r="1.5" fill="currentColor"/>
        <circle cx="1000" cy="600" r="2" fill="currentColor"/>
        <circle cx="1040" cy="560" r="1.5" fill="currentColor"/>
      </svg>
      <header className="kr-header">
        <div className="kr-header-left">
          <button className="nav-menu-btn" onClick={() => window.openGlobalNav && window.openGlobalNav()} aria-label="Open navigation">
            <Menu size={20} />
          </button>
          <div className="kr-brand" onClick={() => navigate('/search-hub')}>
            <div className="kr-logo-img"></div>
            cerbyl
          </div>
          <div className="kr-header-divider"></div>
          <span className="kr-page-title">Knowledge Roadmap</span>
          {currentRoadmap && (
            <>
              <div className="kr-header-divider"></div>
              <span className="kr-roadmap-title">{currentRoadmap.title || currentRoadmap.root_topic}</span>
            </>
          )}
        </div>
        <div className="kr-header-right">
          {currentRoadmap ? (
            <>
              <button className="kr-nav-btn" onClick={() => { 
                navigate('/knowledge-roadmap');
                setCurrentRoadmap(null); 
                setNodes([]); 
                setEdges([]); 
                setNodeExplanation(null);
              }}>
                Back to Roadmaps
              </button>
              {selectedNodeId && (
                <button 
                  className="kr-delete-node-btn" 
                  onClick={deleteSelectedNode}
                  title="Delete selected node"
                >
                  <Trash2 size={16} />
                  <span>Delete Node</span>
                </button>
              )}
              <button 
                className="kr-export-btn" 
                onClick={exportRoadmapToNotes}
                disabled={exporting}
                title="Export explored nodes to Notes"
              >
                {exporting ? (
                  <>
                    <Loader size={16} className="kr-spinner" />
                    <span>Exporting...</span>
                  </>
                ) : (
                  <>
                    <FileDown size={16} />
                    <span>Export</span>
                  </>
                )}
              </button>
            </>
          ) : (
            <button className="kr-nav-btn" onClick={() => navigate('/dashboard')}>
                  Dashboard
              <ChevronRight size={14} />
            </button>
          )}
        </div>
      </header>

      <div className="kr-content">
        {!currentRoadmap ? (
          <>
            <div className="kr-section-header">
              <div className="kr-header-content">
                <div>
                  <span className="view-kicker">Knowledge Maps</span>
                  <h2 className="view-title" style={{ marginTop: '6px' }}>My Roadmaps</h2>
                  <p className="view-sub">Build interactive learning maps with expandable topics</p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button className="kr-create-btn" onClick={() => setShowCreateModal(true)}>
                    <Plus size={18} />
                    <span>Create Roadmap</span>
                  </button>
                  <button 
                    className="kr-create-btn" 
                    onClick={() => {
                      setShowChatSelectModal(true);
                      fetchChatSessions();
                    }}
                  >
                    <Book size={18} />
                    <span>From Chat</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="kr-main">
              {loading && roadmaps.length === 0 ? (
                <div className="kr-loading">
                  <Loader size={32} className="kr-spinner" />
                  <p>Loading roadmaps...</p>
                </div>
              ) : roadmaps.length === 0 ? (
                <div className="kr-empty">
                  <MapPin size={48} className="kr-empty-icon" />
                  <p>No roadmaps yet. Create your first roadmap to start exploring!</p>
                </div>
              ) : (
                <div className="kr-grid">
                  {roadmaps.map(roadmap => (
                    <div key={roadmap.id} className="kr-card">
                      <div className="kr-card-header">
                        <div className="kr-card-icon">
                          <MapPin size={24} />
                        </div>
                        <button 
                          className="kr-delete-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteRoadmap(roadmap.id);
                          }}
                          title="Delete Roadmap"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <div className="kr-card-content" onClick={() => viewRoadmap(roadmap.id)}>
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
            <div className="kr-flow-wrapper">
              <div className="kr-flow-container-fullscreen">
                {loading && nodes.length === 0 ? (
                  <div className="kr-loading">
                    <Loader size={32} className="kr-spinner" />
                    <p>Loading roadmap...</p>
                  </div>
                ) : (
                  <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onNodeClick={onNodeClick}
                    nodeTypes={nodeTypes}
                    fitView
                    minZoom={0.1}
                    maxZoom={2}
                    defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
                    attributionPosition="bottom-left"
                  >
                    <Background color="var(--accent)" gap={20} />
                    <Controls />
                    <MiniMap 
                      nodeColor={(node) => {
                        if (node.data.isExplored) return 'var(--success)';
                        if (node.data.expansionStatus === 'expanded') return 'var(--accent)';
                        return 'var(--text-secondary)';
                      }}
                      maskColor="rgba(0, 0, 0, 0.6)"
                    />
                  </ReactFlow>
                )}
              </div>

              {nodeExplanation && (
                <div className="kr-explanation-sidebar">
                  <div className="kr-explanation-header-sticky">
                    <div className="kr-explanation-header-meta">
                      <span className="kr-explanation-kicker">Topic Deep Dive</span>
                      <h3 className="kr-explanation-title">{nodeExplanation.topic_name}</h3>
                      <p className="kr-explanation-path">{activeNodePath || nodeExplanation.topic_name}</p>
                    </div>
                    <button 
                      className="kr-close-explanation"
                      onClick={() => setNodeExplanation(null)}
                      aria-label="Close topic panel"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <div className="kr-sidebar-body">
                    <div className="kr-sidebar-content">
                      {sidebarView === 'learn' && (
                        <div className="kr-sidebar-pane">
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

                          {!nodeExplanation.ai_explanation && (!nodeExplanation.key_concepts || nodeExplanation.key_concepts.length === 0) && (
                            <div className="kr-chat-placeholder">
                              <p>No generated learning content yet for this node.</p>
                            </div>
                          )}
                        </div>
                      )}

                      {sidebarView === 'notes' && (
                        <div className="kr-manual-notes-section kr-sidebar-pane">
                          <div className="kr-manual-notes-header">
                            <h4>
                              <StickyNote size={14} />
                              My Notes
                            </h4>
                            {!editingNotes ? (
                              <button 
                                className="kr-edit-notes-btn"
                                onClick={startEditingNotes}
                              >
                                <Edit3 size={14} />
                                {activeNodeNotes ? 'Edit' : 'Add Notes'}
                              </button>
                            ) : (
                              <button 
                                className="kr-save-notes-btn"
                                onClick={saveManualNotes}
                              >
                                <Save size={14} />
                                Save
                              </button>
                            )}
                          </div>
                          <p className="kr-notes-context">{activeNodePath || nodeExplanation.topic_name}</p>
                          {editingNotes ? (
                            <textarea
                              className="kr-manual-notes-input"
                              value={tempNotes}
                              onChange={(e) => setTempNotes(e.target.value)}
                              placeholder="Add your own notes about this topic..."
                              rows={8}
                              autoFocus
                            />
                          ) : (
                            <div className="kr-manual-notes-content">
                              {activeNodeNotes ? (
                                <p>{activeNodeNotes}</p>
                              ) : (
                                <p className="kr-no-notes">No personal notes yet. Click "Add Notes" to add your own thoughts.</p>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {sidebarView === 'chat' && (
                        <div className="kr-chat-section kr-sidebar-pane">
                          <div className="kr-chat-section-header">
                            <span className="kr-chat-kicker">Topic Chat</span>
                            <h4 className="kr-chat-title">Ask Questions About This Topic</h4>
                            <p className="kr-chat-subtitle">
                              This chat stays scoped to <strong>{nodeExplanation.topic_name}</strong>.
                            </p>
                          </div>
                          <div className="kr-chat-messages" ref={chatMessagesRef}>
                            {chatMessages.length === 0 ? (
                              <div className="kr-chat-placeholder">
                                <p>Ask me anything about "{nodeExplanation.topic_name}"</p>
                              </div>
                            ) : (
                              chatMessages.map((message) => (
                                <div key={message.id} className={`ac-message kr-topic-chat-message ${message.type === 'user' ? 'user' : 'ai'}`}>
                                  <div className="ac-message-bubble">
                                    <div className="ac-message-content kr-chat-message-content">
                                      {renderChatMessageContent(message.content)}
                                    </div>
                                  </div>
                                  <div className="ac-message-meta kr-chat-message-meta">
                                    <span className="ac-message-time">
                                      {new Date(message.timestamp).toLocaleTimeString('en-US', {
                                        hour: 'numeric',
                                        minute: '2-digit',
                                        hour12: true
                                      })}
                                    </span>
                                  </div>
                                </div>
                              ))
                            )}
                            {chatLoading && (
                              <div className="ac-message kr-topic-chat-message ai">
                                <div className="ac-message-bubble">
                                  <div className="ac-pulse-loader">
                                    <div className="ac-pulse-square ac-pulse-1"></div>
                                    <div className="ac-pulse-square ac-pulse-2"></div>
                                    <div className="ac-pulse-square ac-pulse-3"></div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="ac-input-wrapper kr-chat-input-wrapper">
                            <div className="ac-input-row">
                              <textarea
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                onKeyDown={handleChatKeyDown}
                                placeholder={`Ask about ${nodeExplanation.topic_name}...`}
                                className="ac-textarea kr-chat-input"
                                disabled={chatLoading}
                                rows="1"
                              />
                              <button
                                onClick={sendChatMessage}
                                disabled={chatLoading || !chatInput.trim()}
                                className="ac-send-btn kr-chat-send-btn"
                                aria-label="Send topic question"
                              >
                                {chatLoading ? (
                                  <span className="kr-send-spinner" aria-hidden="true" />
                                ) : (
                                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                    <path d="M1 8l14-6-6 14-2-8z"/>
                                  </svg>
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <aside className="kr-sidebar-rail" aria-label="Sidebar sections">
                      <button
                        className={`kr-sidebar-rail-btn ${sidebarView === 'learn' ? 'active' : ''}`}
                        onClick={() => setSidebarView('learn')}
                        title="Learn panel"
                      >
                        <Info size={16} />
                        <span className="kr-sidebar-rail-label">Learn</span>
                      </button>
                      <button
                        className={`kr-sidebar-rail-btn ${sidebarView === 'notes' ? 'active' : ''}`}
                        onClick={() => setSidebarView('notes')}
                        title="Notes panel"
                      >
                        <StickyNote size={16} />
                        <span className="kr-sidebar-rail-label">Notes</span>
                      </button>
                      <button
                        className={`kr-sidebar-rail-btn ${sidebarView === 'chat' ? 'active' : ''}`}
                        onClick={() => setSidebarView('chat')}
                        title="Topic chat panel"
                      >
                        <MessageCircle size={16} />
                        <span className="kr-sidebar-rail-label">Chat</span>
                      </button>
                    </aside>
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

{/* CHAT SELECT MODAL - SEPARATE */}
{showChatSelectModal && (
  <div className="kr-modal-overlay" onClick={() => setShowChatSelectModal(false)}>
    <div className="kr-modal" onClick={e => e.stopPropagation()}>
      <div className="kr-modal-header">
        <h3>Create Roadmap from Chat</h3>
        <button className="kr-modal-close" onClick={() => setShowChatSelectModal(false)}>×</button>
      </div>

      <div className="kr-modal-content">
        <div className="kr-form-group">
          <label>Select a chat session</label>
          <p className="kr-input-hint" style={{ marginBottom: '16px' }}>
            AI will analyze the conversation and create a roadmap based on the main topic discussed.
          </p>
          <div style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid var(--border)', padding: '12px' }}>
            {chatSessions.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '20px' }}>
                No chat sessions found
              </p>
            ) : (
              chatSessions.map(session => (
                <div
                  key={session.id}
                  onClick={() => setSelectedChatId(session.id)}
                  style={{
                    padding: '12px',
                    marginBottom: '8px',
                    background: selectedChatId === session.id ? 'var(--accent)' : 'var(--bg-bottom)',
                    border: `2px solid ${selectedChatId === session.id ? 'var(--accent)' : 'var(--border)'}`,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    color: selectedChatId === session.id ? 'var(--bg-bottom)' : 'var(--text-primary)'
                  }}
                  onMouseEnter={e => {
                    if (selectedChatId !== session.id) {
                      e.currentTarget.style.borderColor = 'var(--accent)';
                    }
                  }}
                  onMouseLeave={e => {
                    if (selectedChatId !== session.id) {
                      e.currentTarget.style.borderColor = 'var(--border)';
                    }
                  }}
                >
                  <div style={{ fontWeight: '600', marginBottom: '4px' }}>{session.title}</div>
                  <div style={{ fontSize: '12px', opacity: 0.7 }}>
                    {new Date(session.updated_at).toLocaleDateString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="kr-modal-footer">
        <button className="kr-btn-cancel" onClick={() => setShowChatSelectModal(false)}>Cancel</button>
        <button 
          className="kr-btn-create" 
          onClick={createRoadmapFromChat}
          disabled={loading || !selectedChatId}
        >
          {loading ? 'Creating...' : 'Create Roadmap'}
        </button>
      </div>
    </div>
  </div>
)}

{/* ADD MANUAL NODE MODAL */}
{showAddNodeModal && (
  <div className="kr-modal-overlay" onClick={() => setShowAddNodeModal(false)}>
    <div className="kr-modal" onClick={e => e.stopPropagation()}>
      <div className="kr-modal-header">
        <h3>Add Custom Node</h3>
        <button className="kr-modal-close" onClick={() => setShowAddNodeModal(false)}>×</button>
      </div>

      <div className="kr-modal-content">
        <div className="kr-form-group">
          <label>Topic Name</label>
          <input
            type="text"
            className="kr-input"
            value={newNodeTopic}
            onChange={e => setNewNodeTopic(e.target.value)}
            placeholder="e.g., Key Algorithms, Important Dates"
            onKeyPress={e => e.key === 'Enter' && createManualNode()}
            autoFocus
          />
        </div>
        <div className="kr-form-group">
          <label>Description (optional)</label>
          <textarea
            className="kr-input kr-textarea"
            value={newNodeDescription}
            onChange={e => setNewNodeDescription(e.target.value)}
            placeholder="Brief description of this topic..."
            rows={3}
          />
        </div>
        <p className="kr-input-hint">
          Add your own custom subtopic. You can still use AI to explore or expand it later.
        </p>
      </div>

      <div className="kr-modal-footer">
        <button className="kr-btn-cancel" onClick={() => setShowAddNodeModal(false)}>Cancel</button>
        <button 
          className="kr-btn-create" 
          onClick={createManualNode}
          disabled={loading || !newNodeTopic.trim()}
        >
          {loading ? 'Adding...' : 'Add Node'}
        </button>
      </div>
    </div>
  </div>
)}

{/* EXPORT SUCCESS MODAL */}
{showExportSuccessModal && (
  <div className="kr-modal-overlay">
    <div className="kr-modal kr-export-modal">
      <div className="kr-export-modal-icon">
        <FileDown size={32} />
      </div>
      <h3>Export Successful!</h3>
      <p>
        Successfully exported {exportedNodeCount} explored node{exportedNodeCount !== 1 ? 's' : ''} to Notes.
        {manualNotes.size > 0 && ' Your personal notes were included.'}
      </p>
      <div className="kr-modal-actions">
        <button
          className="kr-modal-btn secondary"
          onClick={() => setShowExportSuccessModal(false)}
        >
          Stay Here
        </button>
        <button
          className="kr-modal-btn primary"
          onClick={() => {
            setShowExportSuccessModal(false);
            navigate(`/notes/editor/${exportedNoteId}`);
          }}
        >
          View Note
        </button>
      </div>
    </div>
  </div>
)}
    </div>
  );
};

export default KnowledgeRoadmap;

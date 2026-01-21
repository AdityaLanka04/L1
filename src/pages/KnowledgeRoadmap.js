import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
import { Plus, Loader, MapPin, Book, Sparkles, Trash2, FileDown, Info, ChevronRight, X, Edit3, Save, StickyNote } from 'lucide-react';
import './KnowledgeRoadmap.css';
import { API_URL } from '../config';
const CustomNode = ({ data, selected }) => {
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
          <h4>{data.label}</h4>
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
      <div className="kr-node-actions-flow">
        <button 
          className="kr-node-btn-flow kr-explore-btn nodrag nopan"
          onClick={(e) => { 
            e.stopPropagation(); 
            data.onExplore && data.onExplore(data.nodeId); 
          }}
          disabled={data.isExploring || data.isExpanding}
        >
          <Book size={12} />
          {data.isExploring ? '...' : 'Explore'}
        </button>
        {(data.expansionStatus === 'unexpanded' || !data.expansionStatus) && (
          <button 
            className="kr-node-btn-flow kr-expand-btn nodrag nopan"
            onClick={(e) => { 
              e.stopPropagation(); 
              data.onExpand && data.onExpand(data.nodeId); 
            }}
            disabled={data.isExpanding || data.isExploring}
          >
            <Plus size={12} />
            {data.isExpanding ? '...' : 'Expand'}
          </button>
        )}
        <button 
          className="kr-node-btn-flow kr-add-child-btn nodrag nopan"
          onClick={(e) => { 
            e.stopPropagation(); 
            data.onAddChild && data.onAddChild(data.nodeId); 
          }}
          title="Add custom child node"
        >
          <Plus size={12} />
          Add
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
  const [exploredNodesCache, setExploredNodesCache] = useState(new Map()); // Cache for explored nodes
  const [exporting, setExporting] = useState(false);

  // Chat states
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  // Manual node states
  const [showAddNodeModal, setShowAddNodeModal] = useState(false);
  const [addNodeParentId, setAddNodeParentId] = useState(null);
  const [newNodeTopic, setNewNodeTopic] = useState('');
  const [newNodeDescription, setNewNodeDescription] = useState('');

  // Node selection and deletion states
  const [selectedNodeId, setSelectedNodeId] = useState(null);

  // Manual notes states
  const [manualNotes, setManualNotes] = useState(new Map()); // nodeId -> notes string
  const [editingNotes, setEditingNotes] = useState(false);
  const [tempNotes, setTempNotes] = useState('');

  // Export success modal state
  const [showExportSuccessModal, setShowExportSuccessModal] = useState(false);
  const [exportedNodeCount, setExportedNodeCount] = useState(0);
  const [exportedNoteId, setExportedNoteId] = useState(null);

  // Save the current UI state (which nodes are actually expanded in the current view)
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

// Fetch chat sessions for modal
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
      }
};

// Create roadmap from chat
const createRoadmapFromChat = async () => {
  if (!selectedChatId) {
    alert('Please select a chat session');
    return;
  }

  try {
    setLoading(true);
    
    // Get topic from chat
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

    // Create roadmap with extracted topic
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
  // Load the saved UI state
  const loadRoadmapState = useCallback((roadmapId) => {
    const savedState = localStorage.getItem(`roadmap_state_${roadmapId}`);
    if (savedState) {
      try {
        const state = JSON.parse(savedState);
                return state;
      } catch (error) {
              }
    }
    return null;
  }, []);

  // Clear roadmap state
  const clearRoadmapState = useCallback((roadmapId) => {
    if (roadmapId) {
      localStorage.removeItem(`roadmap_state_${roadmapId}`);
    }
    setExpandedNodes(new Set());
    setExploredNodesCache(new Map());
    setManualNotes(new Map());
    setSelectedNodeId(null);
  }, []);

  // Create refs for callbacks to prevent stale closures
  const expandNodeRef = useRef(null);
  const exploreNodeRef = useRef(null);
  const addChildNodeRef = useRef(null);

  // Layout constants
  const HORIZONTAL_SPACING = 280;
  const VERTICAL_SPACING = 250;

  const nodeTypes = useMemo(() => ({
    custom: CustomNode,
  }), []);

  useEffect(() => {
    fetchRoadmaps();
  }, []);

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
        
        // Clear any existing state for new roadmap
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
        // Remove the deleted roadmap from state
        setRoadmaps(prev => prev.filter(roadmap => roadmap.id !== roadmapId));
        
        // Clear saved state for this roadmap
        clearRoadmapState(roadmapId);
        
        // If the current roadmap is being viewed, clear it
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

  // FIXED: expandNode with useCallback to prevent stale closures and handle sibling collapse
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
        
        // Handle "already_expanded" case by fetching from roadmap
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
                // Store removed node IDs for edge cleanup
                let removedNodeIds = new Set();
                
                // COLLAPSE SIBLINGS FIRST, THEN ADD CHILDREN
                setNodes((nds) => {
                  const parentNode = nds.find(n => n.data.nodeId === nodeId);
                  if (!parentNode) return nds;
                  
                  const parentDepth = parentNode.data.depth;
                  
                  // Find siblings at same depth that are expanded
                  const siblingsAtSameDepth = nds.filter(n => 
                    n.data.depth === parentDepth && 
                    n.data.nodeId !== nodeId &&
                    n.data.expansionStatus === 'expanded'
                  );
                  
                  let finalNodes = nds;
                  
                  // Collapse siblings if any exist
                  if (siblingsAtSameDepth.length > 0) {
                    const siblingIds = siblingsAtSameDepth.map(s => String(s.id));
                    
                    // Build adjacency map
                    const adjacencyMap = new Map();
                    edges.forEach(edge => {
                      const source = String(edge.source);
                      if (!adjacencyMap.has(source)) {
                        adjacencyMap.set(source, []);
                      }
                      adjacencyMap.get(source).push(String(edge.target));
                    });
                    
                    // Find all descendants of siblings
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
                    
                    // Remove descendant nodes and reset sibling status
                    finalNodes = nds.filter(n => !removedNodeIds.has(String(n.id))).map(n => {
                      if (siblingIds.includes(String(n.id))) {
                        // Remove from expanded nodes when collapsing
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
                  
                  // Now add the children
                  const horizontalSpacing = 280;
                  const baseVerticalSpacing = 250;
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
                
                // Add to expanded nodes
                setExpandedNodes(prev => new Set(prev).add(nodeId));
                
                // FIXED: Only remove edges for removed nodes
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
          // Add to expanded nodes even if already expanded
          setExpandedNodes(prev => new Set(prev).add(nodeId));
          return;
        }
        
        // Normal expansion flow with new child_nodes
        if (data.child_nodes && data.child_nodes.length > 0) {
          // Store removed node IDs
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
              
              // Build adjacency map from edges
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
                  // Remove from expanded nodes when collapsing
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
            const horizontalSpacing = 280;
            const baseVerticalSpacing = 250;
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
          
          // Add to expanded nodes
          setExpandedNodes(prev => new Set(prev).add(nodeId));
          
          // FIXED: Only remove edges for removed nodes
          setEdges((eds) => {
            // Remove only edges connected to removed nodes
            const cleanedEdges = eds.filter(edge => 
              !removedNodeIds.has(String(edge.source)) && !removedNodeIds.has(String(edge.target))
            );
            
            // Add new edges for the newly expanded children
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

  // Store expandNode in ref immediately
  expandNodeRef.current = expandNode;

  // FIXED: exploreNode with useCallback to prevent stale closures and caching
  const exploreNode = useCallback(async (nodeId) => {
        
    // Check if we have cached data for this node
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
        
        // Extract the node data - could be directly in data or in data.node
        const nodeData = data.node || data;
                
        // Ensure we're setting the complete node data
        const completeNodeData = {
          ...nodeData,
          topic_name: nodeData.topic_name,
          ai_explanation: nodeData.ai_explanation,
          key_concepts: nodeData.key_concepts || [],
          why_important: nodeData.why_important,
          real_world_examples: nodeData.real_world_examples || [],
          learning_tips: nodeData.learning_tips
        };
        
        // Cache the exploration data
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

  // Store exploreNode in ref immediately
  exploreNodeRef.current = exploreNode;

  // Add child node handler - opens modal to add custom node
  const handleAddChildNode = useCallback((parentNodeId) => {
    setAddNodeParentId(parentNodeId);
    setNewNodeTopic('');
    setNewNodeDescription('');
    setShowAddNodeModal(true);
  }, []);

  // Store addChildNode in ref
  addChildNodeRef.current = handleAddChildNode;

  // Create manual node
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

        // Add the new node to the flow
        setNodes((nds) => {
          const parentNode = nds.find(n => n.data.nodeId === addNodeParentId);
          if (!parentNode) return nds;

          // Find existing children of this parent to position new node
          const siblingNodes = nds.filter(n => {
            const edge = edges.find(e => String(e.target) === String(n.id) && String(e.source) === String(addNodeParentId));
            return edge !== undefined;
          });

          const horizontalSpacing = 280;
          const baseVerticalSpacing = 250;
          const parentDepth = parentNode.data.depth;
          const verticalSpacing = parentDepth === 0 ? 350 : baseVerticalSpacing * Math.pow(1.2, parentDepth);

          // Position to the right of existing siblings
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

        // Add edge from parent to new node
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

        // Mark parent as expanded
        setExpandedNodes(prev => new Set(prev).add(addNodeParentId));
        setNodes((nds) => nds.map(n => 
          n.data.nodeId === addNodeParentId 
            ? { ...n, data: { ...n.data, expansionStatus: 'expanded' } }
            : n
        ));

        // Stop animation after 2 seconds
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

  // Delete selected node
  const deleteSelectedNode = async () => {
    if (!selectedNodeId || !currentRoadmap) return;

    // Don't allow deleting root node
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
        // Find all descendant nodes to remove
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

        // Remove nodes
        setNodes((nds) => nds.filter(n => !nodesToRemove.has(String(n.id))));

        // Remove edges
        setEdges((eds) => eds.filter(e => 
          !nodesToRemove.has(String(e.source)) && !nodesToRemove.has(String(e.target))
        ));

        // Clear selection and explanation if viewing deleted node
        setSelectedNodeId(null);
        if (nodeExplanation && nodesToRemove.has(String(nodeExplanation.id))) {
          setNodeExplanation(null);
        }

        // Remove from expanded nodes
        setExpandedNodes(prev => {
          const newSet = new Set(prev);
          nodesToRemove.forEach(id => newSet.delete(parseInt(id)));
          return newSet;
        });

        // Remove manual notes for deleted nodes
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

  // Handle node selection
  const onNodeClick = useCallback((event, node) => {
    setSelectedNodeId(node.data.nodeId);
  }, []);

  // Save manual notes for a node
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

      // Update node to show notes badge
      const nodeId = nodeExplanation.id || nodeExplanation.nodeId;
      setNodes((nds) => nds.map(n => 
        n.data.nodeId === nodeId 
          ? { ...n, data: { ...n.data, hasManualNotes: tempNotes.trim().length > 0 } }
          : n
      ));
    }
    setEditingNotes(false);
  };

  // Start editing notes
  const startEditingNotes = () => {
    const nodeId = nodeExplanation?.id || nodeExplanation?.nodeId;
    setTempNotes(manualNotes.get(nodeId) || '');
    setEditingNotes(true);
  };

  // Chat functionality
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
      formData.append('question', `Context: I'm exploring the topic "${nodeExplanation.topic_name}" in a knowledge roadmap. Here's what I know about it: ${nodeExplanation.ai_explanation || 'No explanation available yet.'}

User question: ${messageText}`);
      formData.append('chat_id', ''); // Empty for new session

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

  // Clear chat when node explanation changes
  useEffect(() => {
    if (nodeExplanation) {
      setChatMessages([]);
      setChatInput('');
    }
  }, [nodeExplanation]);

  // FIXED: viewRoadmap using saved UI state as source of truth for what user was viewing
  const viewRoadmap = async (roadmapId) => {
    try {
      setLoading(true);
      
      // Load saved UI state
      const savedState = loadRoadmapState(roadmapId);
      
      const response = await fetch(`${API_URL}/get_knowledge_roadmap/${roadmapId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
                setCurrentRoadmap(data.roadmap);
        
        // Use nodes_flat from backend response
        const allNodes = data.nodes_flat || [];
                
        // Use saved expanded nodes if available, otherwise start with empty (only root visible)
        const savedExpandedNodes = savedState ? new Set(savedState.expandedNodes) : new Set();
        
        // Restore explored nodes cache
        if (savedState && savedState.exploredNodesCache) {
          setExploredNodesCache(new Map(savedState.exploredNodesCache));
        }

        // Restore manual notes
        if (savedState && savedState.manualNotes) {
          setManualNotes(new Map(savedState.manualNotes));
        }
        
        // Build parent-child map
        const childrenMap = new Map();
        allNodes.forEach(node => {
          if (node.parent_id) {
            if (!childrenMap.has(node.parent_id)) {
              childrenMap.set(node.parent_id, []);
            }
            childrenMap.get(node.parent_id).push(node);
          }
        });
        
        // Find root nodes (no parent)
        const rootNodes = allNodes.filter(node => !node.parent_id);
                
        // BFS to find visible nodes based on SAVED UI state (not backend expansion_status)
        // A node is visible if:
        // 1. It's a root node, OR
        // 2. Its parent is visible AND parent is in savedExpandedNodes
        const visibleNodeIds = new Set();
        const queue = [...rootNodes.map(n => n.id)];
        
        while (queue.length > 0) {
          const currentNodeId = queue.shift();
          visibleNodeIds.add(currentNodeId);
          
          // Check if THIS node was expanded in the saved UI state
          if (savedExpandedNodes.has(currentNodeId)) {
            const children = childrenMap.get(currentNodeId) || [];
            children.forEach(child => queue.push(child.id));
          }
        }
        
        // Update expandedNodes state to match saved state
        setExpandedNodes(savedExpandedNodes);
        
        // Filter to only visible nodes
        const visibleNodes = allNodes.filter(node => visibleNodeIds.has(node.id));
                
        // Group nodes by depth for positioning
        const nodesByDepth = new Map();
        visibleNodes.forEach(node => {
          if (!nodesByDepth.has(node.depth_level)) {
            nodesByDepth.set(node.depth_level, []);
          }
          nodesByDepth.get(node.depth_level).push(node);
        });

        // Create flow nodes with proper positioning
        const flowNodes = visibleNodes.map(node => {
          const nodesAtThisDepth = nodesByDepth.get(node.depth_level) || [];
          const indexAtDepth = nodesAtThisDepth.indexOf(node);
          const horizontalSpacing = 280;
          const baseVerticalSpacing = 250;
          const depthMultiplier = 1.2;
          const verticalSpacing = baseVerticalSpacing * Math.pow(depthMultiplier, node.depth_level);
          
          const totalWidth = (nodesAtThisDepth.length - 1) * horizontalSpacing;
          const startX = 400 - (totalWidth / 2);

          // Check if node has manual notes from saved state
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
              // Use saved state to determine expansion status
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

        // Build edges only between visible nodes
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
          } finally {
      setLoading(false);
    }
  };

  // Export roadmap to notes
  const exportRoadmapToNotes = async () => {
    if (!currentRoadmap || exporting) return;

    setExporting(true);
    try {
      // Fetch complete roadmap data with all nodes
      const response = await fetch(`${API_URL}/get_knowledge_roadmap/${currentRoadmap.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch roadmap data');
      }

      const data = await response.json();
      const allNodes = data.nodes_flat || [];

      // Filter only explored nodes
      const exploredNodes = allNodes.filter(node => node.is_explored);

      if (exploredNodes.length === 0) {
        alert('No explored nodes to export.\n\nPlease click the "Explore" button on nodes to generate content before exporting.');
        setExporting(false);
        return;
      }

      // Build a hierarchical structure
      const nodeMap = new Map();
      exploredNodes.forEach(node => {
        nodeMap.set(node.id, { ...node, children: [] });
      });

      // Link children to parents
      const rootNodes = [];
      exploredNodes.forEach(node => {
        const nodeData = nodeMap.get(node.id);
        if (node.parent_id && nodeMap.has(node.parent_id)) {
          nodeMap.get(node.parent_id).children.push(nodeData);
        } else {
          rootNodes.push(nodeData);
        }
      });

      // Sort children by id to maintain consistent order
      const sortChildren = (node) => {
        node.children.sort((a, b) => a.id - b.id);
        node.children.forEach(sortChildren);
      };
      rootNodes.forEach(sortChildren);

      // Generate formatted HTML content
      let htmlContent = `<h1 style="font-weight: 800; font-size: 28px; margin-bottom: 24px; color: var(--accent);">${currentRoadmap.title || `Exploring ${currentRoadmap.root_topic}`}</h1>`;
      htmlContent += `<p style="color: var(--text-secondary); margin-bottom: 32px; font-style: italic;">Exported from Knowledge Roadmap on ${new Date().toLocaleDateString()}</p>`;
      htmlContent += `<hr style="border: none; border-top: 2px solid var(--border); margin: 24px 0;">`;

      const generateNodeContent = (node, depth = 0) => {
        let content = '';
        const indent = depth * 24;
        
        // Heading size based on depth (h2 for depth 0, h3 for depth 1, etc.)
        const headingLevel = Math.min(depth + 2, 6);
        const headingSize = [24, 20, 18, 16, 15, 14][depth] || 14;
        
        // Node title - BOLD for explored nodes
        content += `<h${headingLevel} style="font-weight: 700; font-size: ${headingSize}px; margin-top: ${depth === 0 ? 32 : 24}px; margin-bottom: 12px; margin-left: ${indent}px; color: var(--accent);">`;
        content += `<strong>${node.topic_name}</strong>`;
        content += `</h${headingLevel}>`;

        // Node description
        if (node.description) {
          content += `<p style="margin-left: ${indent}px; margin-bottom: 12px; color: var(--text-secondary); font-size: 14px;">${node.description}</p>`;
        }

        // AI Explanation
        if (node.ai_explanation) {
          content += `<div style="margin-left: ${indent}px; margin-bottom: 16px; padding: 16px; background: var(--panel); border-left: 4px solid var(--accent); border-radius: 4px;">`;
          content += `<h4 style="font-weight: 600; font-size: 14px; margin-bottom: 8px; color: var(--accent); text-transform: uppercase; letter-spacing: 0.5px;">Overview</h4>`;
          content += `<p style="color: var(--text-primary); line-height: 1.7; font-size: 14px;">${node.ai_explanation}</p>`;
          content += `</div>`;
        }

        // Key Concepts
        if (node.key_concepts && node.key_concepts.length > 0) {
          content += `<div style="margin-left: ${indent}px; margin-bottom: 16px;">`;
          content += `<h4 style="font-weight: 600; font-size: 14px; margin-bottom: 8px; color: var(--accent); text-transform: uppercase; letter-spacing: 0.5px;">Key Concepts</h4>`;
          content += `<ul style="margin-left: 20px; color: var(--text-primary); line-height: 1.8;">`;
          node.key_concepts.forEach(concept => {
            content += `<li style="margin-bottom: 6px; font-size: 14px;">${concept}</li>`;
          });
          content += `</ul></div>`;
        }

        // Why Important
        if (node.why_important) {
          content += `<div style="margin-left: ${indent}px; margin-bottom: 16px;">`;
          content += `<h4 style="font-weight: 600; font-size: 14px; margin-bottom: 8px; color: var(--accent); text-transform: uppercase; letter-spacing: 0.5px;">Why This Matters</h4>`;
          content += `<p style="color: var(--text-primary); line-height: 1.7; font-size: 14px;">${node.why_important}</p>`;
          content += `</div>`;
        }

        // Real World Examples
        if (node.real_world_examples && node.real_world_examples.length > 0) {
          content += `<div style="margin-left: ${indent}px; margin-bottom: 16px;">`;
          content += `<h4 style="font-weight: 600; font-size: 14px; margin-bottom: 8px; color: var(--accent); text-transform: uppercase; letter-spacing: 0.5px;">Real-World Examples</h4>`;
          content += `<ul style="margin-left: 20px; color: var(--text-primary); line-height: 1.8;">`;
          node.real_world_examples.forEach(example => {
            content += `<li style="margin-bottom: 6px; font-size: 14px;">${example}</li>`;
          });
          content += `</ul></div>`;
        }

        // Learning Tips
        if (node.learning_tips) {
          content += `<div style="margin-left: ${indent}px; margin-bottom: 16px; padding: 12px; background: color-mix(in srgb, var(--success) 10%, transparent); border-radius: 4px; border: 1px solid var(--success);">`;
          content += `<h4 style="font-weight: 600; font-size: 14px; margin-bottom: 8px; color: var(--success); text-transform: uppercase; letter-spacing: 0.5px;">Learning Tips</h4>`;
          content += `<p style="color: var(--text-primary); line-height: 1.7; font-size: 14px;">${node.learning_tips}</p>`;
          content += `</div>`;
        }

        // Manual Notes (user's personal notes)
        const userNotes = manualNotes.get(node.id);
        if (userNotes) {
          content += `<div style="margin-left: ${indent}px; margin-bottom: 16px; padding: 12px; background: color-mix(in srgb, var(--warning) 10%, transparent); border-radius: 4px; border: 1px solid var(--warning);">`;
          content += `<h4 style="font-weight: 600; font-size: 14px; margin-bottom: 8px; color: var(--warning); text-transform: uppercase; letter-spacing: 0.5px;">My Notes</h4>`;
          content += `<p style="color: var(--text-primary); line-height: 1.7; font-size: 14px; white-space: pre-wrap;">${userNotes}</p>`;
          content += `</div>`;
        }

        // Add separator between nodes at same level
        if (depth > 0) {
          content += `<hr style="border: none; border-top: 1px solid var(--border); margin: 20px ${indent}px; opacity: 0.3;">`;
        }

        // Recursively add children
        if (node.children && node.children.length > 0) {
          node.children.forEach(child => {
            content += generateNodeContent(child, depth + 1);
          });
        }

        return content;
      };

      // Generate content for all root nodes
      rootNodes.forEach(rootNode => {
        htmlContent += generateNodeContent(rootNode, 0);
      });

      // Add footer
      htmlContent += `<hr style="border: none; border-top: 2px solid var(--border); margin: 32px 0;">`;
      htmlContent += `<p style="color: var(--text-secondary); font-size: 12px; text-align: center; margin-top: 24px;">`;
      htmlContent += `Exported ${exploredNodes.length} explored node${exploredNodes.length !== 1 ? 's' : ''} from Knowledge Roadmap`;
      htmlContent += `</p>`;

      // Create note via API
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

  return (
    <div className="kr-page">
      <header className="kr-header">
        <div className="kr-header-left">
          <div className="kr-brand">
            <div className="kr-logo-img"></div>
            cerbyl
          </div>
          <div className="kr-header-divider"></div>
          <span className="kr-page-title">KNOWLEDGE ROADMAP</span>
        </div>
        <div className="kr-header-right">
          <button className="kr-nav-btn" onClick={() => navigate('/dashboard')}>
            DASHBOARD
            <ChevronRight size={14} />
          </button>
        </div>
      </header>

      <div className="kr-content">
        {!currentRoadmap ? (
          <>
            <div className="kr-section-header">
              <div className="kr-header-content">
                <div>
                  <h2 className="kr-section-title">My Roadmaps</h2>
                  <p className="kr-section-subtitle">Build interactive learning maps with expandable topics</p>
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
            <div className="kr-viewer-header-compact">
              <button className="kr-back-to-list-compact" onClick={() => { 
                setCurrentRoadmap(null); 
                setNodes([]); 
                setEdges([]); 
                setNodeExplanation(null);
              }}>
                ← Back to Roadmaps
              </button>
              <div className="kr-viewer-title-section">
                <h2 className="kr-viewer-title-compact">{currentRoadmap.title || `Exploring ${currentRoadmap.root_topic}`}</h2>
                <div className="kr-viewer-stats-compact">
                  <span>{currentRoadmap.total_nodes || nodes.length} nodes</span>
                  <span>•</span>
                  <span>Depth: {currentRoadmap.max_depth_reached || 0}</span>
                </div>
              </div>
              <div className="kr-viewer-actions">
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
                      <span>Export to Notes</span>
                    </>
                  )}
                </button>
              </div>
            </div>

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
                    <Background color="var(--kr-border-subtle)" gap={20} />
                    <Controls />
                    <MiniMap 
                      nodeColor={(node) => {
                        if (node.data.isExplored) return 'var(--kr-success)';
                        if (node.data.expansionStatus === 'expanded') return 'var(--kr-accent)';
                        return 'var(--kr-text-secondary)';
                      }}
                      maskColor="rgba(0, 0, 0, 0.6)"
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

                    {/* Manual Notes Section */}
                    <div className="kr-manual-notes-section">
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
                            {manualNotes.get(nodeExplanation.id || nodeExplanation.nodeId) ? 'Edit' : 'Add Notes'}
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
                      {editingNotes ? (
                        <textarea
                          className="kr-manual-notes-input"
                          value={tempNotes}
                          onChange={(e) => setTempNotes(e.target.value)}
                          placeholder="Add your own notes about this topic..."
                          rows={5}
                          autoFocus
                        />
                      ) : (
                        <div className="kr-manual-notes-content">
                          {manualNotes.get(nodeExplanation.id || nodeExplanation.nodeId) ? (
                            <p>{manualNotes.get(nodeExplanation.id || nodeExplanation.nodeId)}</p>
                          ) : (
                            <p className="kr-no-notes">No personal notes yet. Click "Add Notes" to add your own thoughts.</p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Chat Section */}
                    <div className="kr-chat-section">
                      <h4>Ask Questions About This Topic</h4>
                      <div className="kr-chat-messages">
                        {chatMessages.length === 0 ? (
                          <div className="kr-chat-placeholder">
                            <p>Ask me anything about "{nodeExplanation.topic_name}"</p>
                          </div>
                        ) : (
                          chatMessages.map(message => (
                            <div key={message.id} className={`kr-chat-message ${message.type}`}>
                              <div className="kr-chat-message-content">
                                {message.content}
                              </div>
                              <div className="kr-chat-message-time">
                                {new Date(message.timestamp).toLocaleTimeString()}
                              </div>
                            </div>
                          ))
                        )}
                        {chatLoading && (
                          <div className="kr-chat-message assistant">
                            <div className="kr-chat-message-content">
                              <div className="kr-chat-typing">
                                <span></span>
                                <span></span>
                                <span></span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="kr-chat-input-container">
                        <textarea
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          onKeyDown={handleChatKeyDown}
                          placeholder={`Ask about ${nodeExplanation.topic_name}...`}
                          className="kr-chat-input"
                          disabled={chatLoading}
                          rows="2"
                        />
                        <button
                          onClick={sendChatMessage}
                          disabled={chatLoading || !chatInput.trim()}
                          className="kr-chat-send-btn"
                        >
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M1 8l14-6-6 14-2-8z"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* CREATE ROADMAP MODAL */}
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
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
import { Plus, Loader, MapPin, Book, Sparkles, Trash2 } from 'lucide-react';
import './KnowledgeRoadmap.css';
import { API_URL } from '../config';
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
          onClick={(e) => { 
            e.stopPropagation(); 
            data.onExplore && data.onExplore(data.nodeId); 
          }}
          disabled={data.isExploring || data.isExpanding}
        >
          <Book size={14} />
          {data.isExploring ? 'Exploring...' : 'Explore'}
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
            <Plus size={14} />
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
  const [exploredNodesCache, setExploredNodesCache] = useState(new Map()); // Cache for explored nodes

  // Save the current UI state (which nodes are actually expanded in the current view)
  useEffect(() => {
    if (currentRoadmap && currentRoadmap.id && nodes.length > 0) {
      const roadmapState = {
        expandedNodes: Array.from(expandedNodes),
        exploredNodesCache: Array.from(exploredNodesCache.entries()),
        timestamp: Date.now()
      };
      localStorage.setItem(`roadmap_state_${currentRoadmap.id}`, JSON.stringify(roadmapState));
      console.log('Saved roadmap UI state:', roadmapState);
    }
  }, [expandedNodes, exploredNodesCache, currentRoadmap, nodes]);

  // Load the saved UI state
  const loadRoadmapState = useCallback((roadmapId) => {
    const savedState = localStorage.getItem(`roadmap_state_${roadmapId}`);
    if (savedState) {
      try {
        const state = JSON.parse(savedState);
        console.log('Loading saved roadmap UI state:', state);
        return state;
      } catch (error) {
        console.error('Error loading roadmap state:', error);
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
  }, []);

  // Create refs for callbacks to prevent stale closures
  const expandNodeRef = useRef(null);
  const exploreNodeRef = useRef(null);

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
        console.error('Failed to fetch roadmaps:', response.status);
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
      const response = await fetch('${API_URL}/create_knowledge_roadmap', {
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
      console.error('Error creating roadmap:', error);
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
      console.error('Error deleting roadmap:', error);
      alert('Error deleting roadmap');
    }
  };

  // FIXED: expandNode with useCallback to prevent stale closures and handle sibling collapse
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
                      onExpand: (id) => expandNodeRef.current && expandNodeRef.current(id),
                      onExplore: (id) => exploreNodeRef.current && exploreNodeRef.current(id),
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
              console.error('Parent node not found');
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
                onExpand: (id) => expandNodeRef.current && expandNodeRef.current(id),
                onExplore: (id) => exploreNodeRef.current && exploreNodeRef.current(id),
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
        console.error('Failed to expand node:', response.status);
        setNodes((nds) =>
          nds.map(n =>
            n.data.nodeId === nodeId
              ? { ...n, data: { ...n.data, isExpanding: false } }
              : n
          )
        );
      }
    } catch (error) {
      console.error('Error expanding node:', error);
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
    console.log('Exploring node:', nodeId);
    
    // Check if we have cached data for this node
    if (exploredNodesCache.has(nodeId)) {
      console.log('Loading cached exploration data for node:', nodeId);
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
        console.log('Explore node response - Full data:', JSON.stringify(data, null, 2));
        
        // Extract the node data - could be directly in data or in data.node
        const nodeData = data.node || data;
        console.log('Setting node explanation with:', nodeData);
        
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
        console.error('Explore node error:', errorData);
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
      console.error('Error exploring node:', error);
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
        console.log('Roadmap data:', data);
        setCurrentRoadmap(data.roadmap);
        
        // Use nodes_flat from backend response
        const allNodes = data.nodes_flat || [];
        console.log('All nodes from backend:', allNodes.length);
        
        // Use saved expanded nodes if available, otherwise start with empty (only root visible)
        const savedExpandedNodes = savedState ? new Set(savedState.expandedNodes) : new Set();
        console.log('Saved UI expanded nodes:', Array.from(savedExpandedNodes));
        
        // Restore explored nodes cache
        if (savedState && savedState.exploredNodesCache) {
          setExploredNodesCache(new Map(savedState.exploredNodesCache));
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
        console.log('Root nodes:', rootNodes.length);
        
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
        
        console.log('Visible node IDs based on saved state:', Array.from(visibleNodeIds));
        
        // Update expandedNodes state to match saved state
        setExpandedNodes(savedExpandedNodes);
        
        // Filter to only visible nodes
        const visibleNodes = allNodes.filter(node => visibleNodeIds.has(node.id));
        console.log('Visible nodes count:', visibleNodes.length);
        
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
              onExpand: (id) => expandNodeRef.current && expandNodeRef.current(id),
              onExplore: (id) => exploreNodeRef.current && exploreNodeRef.current(id),
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

        console.log('Setting nodes:', flowNodes.length, 'edges:', flowEdges.length);
        setNodes(flowNodes);
        setEdges(flowEdges);
      }
    } catch (error) {
      console.error('Error viewing roadmap:', error);
    } finally {
      setLoading(false);
    }
  };

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
    >
      {/* Delete Button - Similar to QuestionBank */}
      <div className="kr-card-header">
        <div className="kr-card-icon">
          <MapPin size={28} />
        </div>
        <button 
          className="kr-delete-btn"
          onClick={(e) => {
            e.stopPropagation(); // Prevent card click event
            deleteRoadmap(roadmap.id);
          }}
          title="Delete Roadmap"
        >
          <Trash2 size={16} />
        </button>
      </div>

      <div 
        className="kr-card-content" 
        onClick={() => viewRoadmap(roadmap.id)}
      >
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
                // Don't clear cache or expanded nodes - keep them for when user returns
              }}>
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
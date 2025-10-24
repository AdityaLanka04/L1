import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import './LearningReview.css';

const LearningReview = () => {
  const [userName, setUserName] = useState('');
  const [userProfile, setUserProfile] = useState(null);
  const [chatSessions, setChatSessions] = useState([]);
  const [uploadedSlides, setUploadedSlides] = useState([]);
  const [learningReviews, setLearningReviews] = useState([]);
  const [generatedQuestions, setGeneratedQuestions] = useState([]);
  const [selectedSessions, setSelectedSessions] = useState([]);
  const [selectedSlides, setSelectedSlides] = useState([]);
  const [activeReview, setActiveReview] = useState(null);
  const [activeQuestionSet, setActiveQuestionSet] = useState(null);
  const [reviewResponse, setReviewResponse] = useState('');
  const [questionAnswers, setQuestionAnswers] = useState({});
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('create');
  const [reviewDetails, setReviewDetails] = useState(null);
  const [questionResults, setQuestionResults] = useState(null);
  const [questionHints, setQuestionHints] = useState({});
  const [hintLoading, setHintLoading] = useState({});
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  
  const [roadmaps, setRoadmaps] = useState([]);
  const [currentRoadmap, setCurrentRoadmap] = useState(null);
  const [showCreateRoadmapModal, setShowCreateRoadmapModal] = useState(false);
  const [newRoadmapTopic, setNewRoadmapTopic] = useState('');
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [showNodePanel, setShowNodePanel] = useState(false);
  const [nodeExplanation, setNodeExplanation] = useState(null);
  const [slideSummaries, setSlideSummaries] = useState({});
  const [selectedSlideForView, setSelectedSlideForView] = useState(null);
  const [questionGenerationMode, setQuestionGenerationMode] = useState(null);
  const [selectedSourceType, setSelectedSourceType] = useState('topic'); // 'topic', 'chat', 'slide'
  const [selectedChatId, setSelectedChatId] = useState(null);
  const [selectedSlideId, setSelectedSlideId] = useState(null);
  const [questionTopic, setQuestionTopic] = useState('');
  const [numberOfQuestions, setNumberOfQuestions] = useState(10);
  const [questionType, setQuestionType] = useState('Mixed');
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const fileInputRef = useRef(null);
  const expandNodeRef = useRef(null);
  const exploreNodeRef = useRef(null);
  const [expandedNodes, setExpandedNodes] = useState(new Set());
const [roadmapState, setRoadmapState] = useState(null);
const [roadmapCache, setRoadmapCache] = useState({});

  const navigate = (path) => {
  // Save current roadmap state before navigating
  if (currentRoadmap) {
    saveRoadmapToCache(currentRoadmap.id, nodes, edges, expandedNodes);
  }
  window.location.href = path;
};


  
  // FIXED: expandNode with useCallback to prevent stale closures
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
    const token = localStorage.getItem('token');
    const response = await fetch(`http://localhost:8001/expand_knowledge_node/${nodeId}`, {
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
          const roadmapResponse = await fetch(`http://localhost:8001/get_knowledge_roadmap/${currentRoadmap.id}`, {
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
              
              // FIXED: Clean up edges based on removed nodes only
              setEdges((eds) => {
                // Remove edges connected to removed nodes
                const cleanedEdges = eds.filter(edge => 
                  !removedNodeIds.has(String(edge.source)) && !removedNodeIds.has(String(edge.target))
                );
                
                // Add new edges for children
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
        return;
      }
      
      // Normal expansion flow with new child_nodes
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

    } else {
      const errorData = await response.json().catch(() => ({}));
      alert(`Failed to expand node: ${errorData.detail || 'Unknown error'}`);
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
    alert('Failed to expand node');
    setNodes((nds) =>
      nds.map(n =>
        n.data.nodeId === nodeId
          ? { ...n, data: { ...n.data, isExpanding: false } }
          : n
      )
    );
  }
}, [setNodes, setEdges, edges, currentRoadmap]);

const saveRoadmapToCache = (roadmapId, nodes, edges, expandedNodes) => {
  if (!roadmapId) return;
  
  const cacheData = {
    nodes,
    edges,
    expandedNodes: Array.from(expandedNodes),
    timestamp: new Date().toISOString()
  };
  
  // Update state cache
  setRoadmapCache(prev => ({
    ...prev,
    [roadmapId]: cacheData
  }));
  
  // Also save to localStorage for persistence across page refreshes
  try {
    const existingCache = JSON.parse(localStorage.getItem('roadmapCache') || '{}');
    existingCache[roadmapId] = cacheData;
    localStorage.setItem('roadmapCache', JSON.stringify(existingCache));
  } catch (error) {
    console.error('Error saving roadmap to cache:', error);
  }
};

// Add this useEffect to load cache from localStorage on component mount
useEffect(() => {
  try {
    const savedCache = JSON.parse(localStorage.getItem('roadmapCache') || '{}');
    setRoadmapCache(savedCache);
  } catch (error) {
    console.error('Error loading roadmap cache:', error);
  }
}, []);

// Modify the goBackToDashboard function to save the current state
const goBackToDashboard = () => {
  // Save current roadmap state before leaving
  if (currentRoadmap) {
    saveRoadmapToCache(currentRoadmap.id, nodes, edges, expandedNodes);
  }
  
  setActiveTab('create');
  setCurrentRoadmap(null);
  setSelectedSlideForView(null);
  setQuestionGenerationMode(null);
};

// Modify the tab navigation to save state when switching tabs
const handleTabChange = (tab) => {
  // Save current roadmap state before switching tabs
  if (currentRoadmap && activeTab === 'roadmap') {
    saveRoadmapToCache(currentRoadmap.id, nodes, edges, expandedNodes);
  }
  
  setActiveTab(tab);
  setShowNodePanel(false);
};
  // Store expandNode in ref immediately
  expandNodeRef.current = expandNode;

  // FIXED: exploreNode with useCallback
  const exploreNode = useCallback(async (nodeId) => {
    setNodes((nds) =>
      nds.map(n =>
        n.data.nodeId === nodeId
          ? { ...n, data: { ...n.data, isExploring: true } }
          : n
      )
    );
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:8001/explore_node/${nodeId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Explore node response:', data);
        
        const nodeData = data.node || data;
        setNodeExplanation(nodeData);
        setShowNodePanel(true);
        
        setNodes((nds) =>
          nds.map(n =>
            n.data.nodeId === nodeId
              ? { ...n, data: { ...n.data, isExplored: true, isExploring: false } }
              : n
          )
        );
      } else {
        const errorData = await response.json();
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
  }, [setNodes]);

  // Store exploreNode in ref immediately
  exploreNodeRef.current = exploreNode;

  // CustomNode component that uses the callbacks
  const CustomNode = ({ data }) => {
    const getStatusColor = () => {
      if (data.isExplored) return '#4CAF50';
      if (data.expansionStatus === 'expanded') return '#FF9800';
      return '#9E9E9E';
    };

    const getStatusLabel = () => {
      if (data.isExplored) return 'Explored';
      if (data.expansionStatus === 'expanded') return 'Expanded';
      return 'Unexplored';
    };

    return (
      <div className="roadmap-node" style={{ borderColor: getStatusColor() }}>
        {/* Handle for incoming connections (top) */}
        <Handle
          type="target"
          position={Position.Top}
          style={{
            background: '#D7B38C',
            width: '10px',
            height: '10px',
            border: '2px solid #1a1a1a',
          }}
        />
        
        <div className="node-status-badge" style={{ backgroundColor: getStatusColor() }}>
          {getStatusLabel()}
        </div>
        <div className="node-title" style={{ color: getStatusColor() }}>
          {data.label}
        </div>
        {data.description && (
          <div className="node-description">{data.description}</div>
        )}
        <div className="node-actions">
          <button
            onClick={() => data.onExplore && data.onExplore(data.nodeId)}
            disabled={data.isExploring}
            className="node-btn explore-btn nodrag nopan"
          >
            {data.isExploring ? 'Exploring...' : 'Explore'}
          </button>
          {data.expansionStatus === 'unexpanded' && (
            <button
              onClick={() => data.onExpand && data.onExpand(data.nodeId)}
              disabled={data.isExpanding}
              className="node-btn expand-btn nodrag nopan"
            >
              {data.isExpanding ? 'Expanding...' : 'Expand'}
            </button>
          )}
        </div>
        
        {/* Handle for outgoing connections (bottom) */}
        <Handle
          type="source"
          position={Position.Bottom}
          style={{
            background: '#D7B38C',
            width: '10px',
            height: '10px',
            border: '2px solid #1a1a1a',
          }}
        />
      </div>
    );
  };

  const nodeTypes = React.useMemo(() => ({
    custom: CustomNode,
  }), []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const username = localStorage.getItem('username');
    const profile = localStorage.getItem('userProfile');

    if (!token) {
      navigate('/login');
      return;
    }

    if (username) {
      setUserName(username);
    }

    if (profile) {
      try {
        setUserProfile(JSON.parse(profile));
      } catch (error) {
        console.error('Error parsing user profile:', error);
      }
    }
  }, []);

  const loadChatSessions = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:8001/get_chat_sessions?user_id=${userName}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setChatSessions(data.sessions || []);
      }
    } catch (error) {
      console.error('Error loading chat sessions:', error);
    }
  }, [userName]);

  const deleteRoadmap = async (roadmapId, event) => {
    event.stopPropagation(); // Prevent triggering loadRoadmap when clicking delete
    
    if (!window.confirm('Are you sure you want to delete this roadmap? This action cannot be undone.')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:8001/delete_roadmap/${roadmapId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        // Remove the deleted roadmap from the state
        setRoadmaps(prev => prev.filter(roadmap => roadmap.id !== roadmapId));
        alert('Roadmap deleted successfully!');
      } else {
        const errorData = await response.json().catch(() => ({}));
        alert(`Failed to delete roadmap: ${errorData.detail || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error deleting roadmap:', error);
      alert('Error deleting roadmap. Please try again.');
    }
  };

  const loadUploadedSlides = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:8001/get_uploaded_slides?user_id=${userName}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setUploadedSlides(data.slides || []);
      }
    } catch (error) {
      console.error('Error loading slides:', error);
    }
  }, [userName]);

  const loadLearningReviews = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:8001/get_learning_reviews?user_id=${userName}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setLearningReviews(data.reviews || []);
      }
    } catch (error) {
      console.error('Error loading learning reviews:', error);
    }
  }, [userName]);

  const loadUserRoadmaps = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:8001/get_user_roadmaps?user_id=${userName}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setRoadmaps(data.roadmaps || []);
      }
    } catch (error) {
      console.error('Error loading roadmaps:', error);
    }
  }, [userName]);

  const loadGeneratedQuestions = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:8001/get_generated_questions?user_id=${userName}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setGeneratedQuestions(data.question_sets || []);
      }
    } catch (error) {
      console.error('Error loading questions:', error);
    }
  }, [userName]);

  useEffect(() => {
    if (userName) {
      loadChatSessions();
      loadUploadedSlides();
      loadLearningReviews();
      loadUserRoadmaps();
      loadGeneratedQuestions();
    }
  }, [userName, loadChatSessions, loadUploadedSlides, loadLearningReviews, loadUserRoadmaps, loadGeneratedQuestions]);

  const createRoadmap = async () => {
    if (!newRoadmapTopic.trim()) {
      alert('Please enter a topic');
      return;
    }

    
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:8001/create_knowledge_roadmap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          user_id: userName,
          root_topic: newRoadmapTopic
        })
      });

      if (response.ok) {
    // Save current roadmap state before creating a new one
    if (currentRoadmap) {
      saveRoadmapToCache(currentRoadmap.id, nodes, edges, expandedNodes);
    }
        const data = await response.json();
        
        setCurrentRoadmap({
          id: data.roadmap_id,
          title: `Exploring ${newRoadmapTopic}`,
          root_topic: newRoadmapTopic,
          total_nodes: 1,
          max_depth_reached: 0
        });
        
        const rootNode = {
          id: String(data.root_node.id),
          type: 'custom',
          position: { x: 400, y: 50 },
          data: {
            label: data.root_node.topic_name,
            description: data.root_node.description,
            depth: 0,
            isExplored: false,
            expansionStatus: 'unexpanded',
            nodeId: data.root_node.id,
            onExpand: (id) => expandNodeRef.current && expandNodeRef.current(id),
            onExplore: (id) => exploreNodeRef.current && exploreNodeRef.current(id),
          },
        };
        
        setNodes([rootNode]);
        setEdges([]);
        
        setShowCreateRoadmapModal(false);
        setNewRoadmapTopic('');
        await loadUserRoadmaps();
        setActiveTab('roadmap');
      } else {
        const errorData = await response.json();
        alert(`Failed to create roadmap: ${errorData.detail || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error creating roadmap:', error);
      alert('Failed to create roadmap');
    } finally {
      setLoading(false);
    }
  };

  const openRoadmap = async (roadmap) => {
  setLoading(true);
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`http://localhost:8001/get_knowledge_roadmap/${roadmap.id}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (currentRoadmap && currentRoadmap.id !== roadmap.id) {
    saveRoadmapToCache(currentRoadmap.id, nodes, edges, expandedNodes);
  }
    if (response.ok) {
      const data = await response.json();
      
      setCurrentRoadmap(roadmap);
      setRoadmapState(data); // Store the full roadmap state
      
      // Check if we have a cached state for this roadmap
      const cachedState = roadmapCache[roadmap.id];
      let useCachedState = false;
      
      // If we have cached state and it's newer than the backend data, use it
      if (cachedState && cachedState.timestamp) {
        const backendTimestamp = new Date(data.roadmap.last_accessed || data.roadmap.created_at);
        const cacheTimestamp = new Date(cachedState.timestamp);
        
        if (cacheTimestamp >= backendTimestamp) {
          useCachedState = true;
          console.log('Using cached roadmap state');
          
          // Restore the cached state
          setNodes(cachedState.nodes);
          setEdges(cachedState.edges);
          setExpandedNodes(new Set(cachedState.expandedNodes));
          setActiveTab('roadmap');
          setLoading(false);
          return;
        }
      }
      
      // If we're not using cached state, proceed with normal logic
      // Use nodes_flat from backend response
      const allNodes = data.nodes_flat || [];
      
      // Get the expanded nodes from the backend
      const backendExpandedNodes = new Set(data.expanded_nodes || []);
      
      // Build a map of nodes and their relationships
      const nodeMap = new Map();
      const childMap = new Map(); // Maps parent_id to array of children
      
      allNodes.forEach(node => {
        nodeMap.set(node.id, node);
        if (node.parent_id) {
          if (!childMap.has(node.parent_id)) {
            childMap.set(node.parent_id, []);
          }
          childMap.get(node.parent_id).push(node);
        }
      });
      
      // Find root nodes (nodes without parents)
      const rootNodes = allNodes.filter(node => !node.parent_id);
      
      // Initialize expanded nodes with the ones from the backend
      const newExpandedNodes = new Set(backendExpandedNodes);
      
      // Ensure that if a node is expanded, all its ancestors are also expanded
      const ensureAncestorsExpanded = (nodeId) => {
        const node = nodeMap.get(nodeId);
        if (!node || !node.parent_id) return;
        
        const parent = nodeMap.get(node.parent_id);
        if (parent) {
          newExpandedNodes.add(parent.id);
          ensureAncestorsExpanded(parent.id);
        }
      };
      
      // Ensure all ancestors of expanded nodes are also expanded
      newExpandedNodes.forEach(nodeId => {
        ensureAncestorsExpanded(nodeId);
      });
      
      // Track visible nodes starting from roots
      const visibleNodes = new Set();
      const nodesToProcess = [...rootNodes];
      
      while (nodesToProcess.length > 0) {
        const currentNode = nodesToProcess.shift();
        visibleNodes.add(currentNode.id);
        
        // If this node is in our expanded set, add its children to the processing queue
        if (newExpandedNodes.has(currentNode.id)) {
          const children = childMap.get(currentNode.id) || [];
          nodesToProcess.push(...children);
        }
      }
      
      // Update the expanded nodes state
      setExpandedNodes(newExpandedNodes);
      
      // Filter nodes that are visible
      const filteredNodes = allNodes.filter(node => visibleNodes.has(node.id));
      
      // Group visible nodes by depth for positioning
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
            expansionStatus: newExpandedNodes.has(node.id) ? 'expanded' : 'unexpanded',
            nodeId: node.id,
            onExpand: (id) => expandNodeRef.current && expandNodeRef.current(id),
            onExplore: (id) => exploreNodeRef.current && exploreNodeRef.current(id),
          },
        };
      });

      // Build edges only for visible nodes
      const flowEdges = [];
      filteredNodes.forEach(node => {
        if (node.parent_id && visibleNodes.has(node.parent_id)) {
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
      setActiveTab('roadmap');
    }
  } catch (error) {
    console.error('Error opening roadmap:', error);
    alert('Failed to open roadmap');
  } finally {
    setLoading(false);
  }
};


  const submitReviewResponse = async () => {
    if (!reviewResponse.trim()) {
      alert('Please write a response');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:8001/submit_review_response', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          user_id: userName,
          review_id: activeReview.id,
          response_text: reviewResponse
        })
      });

      if (response.ok) {
        const data = await response.json();
        setReviewDetails(data);
        setReviewResponse('');
      } else {
        alert('Failed to submit response');
      }
    } catch (error) {
      console.error('Error submitting review response:', error);
      alert('Failed to submit response');
    } finally {
      setLoading(false);
    }
  };

  const loadQuestionSetWithQuestions = async (questionSetId) => {
    setLoading(true);
    setQuestionHints({});
    setHintLoading({});
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:8001/get_question_set/${questionSetId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setActiveQuestionSet(data);
        setQuestionAnswers({});
        setQuestionResults(null);
        setActiveTab('active');
      }
    } catch (error) {
      console.error('Error loading question set:', error);
      alert('Failed to load question set');
    } finally {
      setLoading(false);
    }
  };

  const submitAnswers = async () => {
    const answeredCount = Object.values(questionAnswers).filter(Boolean).length;
    if (answeredCount === 0) {
      alert('Please answer at least one question');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:8001/submit_answers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          user_id: userName,
          question_set_id: activeQuestionSet.id,
          answers: questionAnswers
        })
      });

      if (response.ok) {
        const data = await response.json();
        setQuestionResults(data);
      }
    } catch (error) {
      console.error('Error submitting answers:', error);
      alert('Failed to submit answers');
    } finally {
      setLoading(false);
    }
  };

  const getHints = async (questionId) => {
    setHintLoading((prev) => ({ ...prev, [questionId]: true }));
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:8001/get_hints/${questionId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setQuestionHints((prev) => ({
          ...prev,
          [questionId]: data.hints || [],
        }));
      }
    } catch (error) {
      console.error('Error getting hints:', error);
    } finally {
      setHintLoading((prev) => {
        const next = { ...prev };
        next[questionId] = false;
        return next;
      });
    }
  };

  const handleFileUpload = async (files) => {
    if (!files || files.length === 0) return;

    const allowedFormats = ['application/pdf', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'];
    const maxSize = 50 * 1024 * 1024; // 50MB

    const validFiles = Array.from(files).filter(file => {
      if (!allowedFormats.includes(file.type) && !file.name.toLowerCase().match(/\.(pdf|ppt|pptx)$/)) {
        alert(`File ${file.name} is not supported. Please upload PDF or PowerPoint files.`);
        return false;
      }
      if (file.size > maxSize) {
        alert(`File ${file.name} is too large. Maximum size is 50MB.`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('user_id', userName);
      
      validFiles.forEach(file => {
        formData.append('files', file);
      });

      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100;
          setUploadProgress(percentComplete);
        }
      });

      xhr.addEventListener('load', async () => {
        if (xhr.status === 200) {
          const result = JSON.parse(xhr.responseText);
          alert(`Successfully uploaded ${result.uploaded_count} file(s)!`);
          await loadUploadedSlides();
          setUploadProgress(0);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        } else {
          alert('Failed to upload files. Please try again.');
        }
        setIsUploading(false);
      });

      xhr.addEventListener('error', () => {
        alert('Upload failed. Please try again.');
        setIsUploading(false);
      });

      xhr.open('POST', 'http://localhost:8001/upload_slides');
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.send(formData);
    } catch (error) {
      console.error('Error uploading files:', error);
      alert('Failed to upload files');
      setIsUploading(false);
    }
  };

  const generateQuestions = async () => {
    // Validation
    if (selectedSourceType === 'topic' && !questionTopic.trim()) {
      alert('Please enter a topic or paste content');
      return;
    }
    if (selectedSourceType === 'chat' && !selectedChatId) {
      alert('Please select a chat session');
      return;
    }
    if (selectedSourceType === 'slide' && !selectedSlideId) {
      alert('Please select a slide');
      return;
    }

    setIsGeneratingQuestions(true);
    try {
      const token = localStorage.getItem('token');
      
      let payload = {
        user_id: userName,
        source_type: selectedSourceType,
        num_questions: numberOfQuestions,
        question_type: questionType
      };

      if (selectedSourceType === 'topic') {
        payload.topic = questionTopic;
      } else if (selectedSourceType === 'chat') {
        payload.chat_session_id = selectedChatId;
      } else if (selectedSourceType === 'slide') {
        payload.slide_id = selectedSlideId;
      }

      const response = await fetch('http://localhost:8001/generate_questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const data = await response.json();
        setGeneratedQuestions([...generatedQuestions, data]);
        
        // Reset form
        setSelectedSourceType('topic');
        setSelectedChatId(null);
        setSelectedSlideId(null);
        setQuestionTopic('');
        setNumberOfQuestions(10);
        setQuestionType('Mixed');
        
        alert('Questions generated successfully!');
      } else {
        const errorData = await response.json();
        alert(`Failed to generate questions: ${errorData.detail || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error generating questions:', error);
      alert('Failed to generate questions');
    } finally {
      setIsGeneratingQuestions(false);
    }
  };

  const handleLogout = () => {
  // Save current roadmap state before logging out
  if (currentRoadmap) {
    saveRoadmapToCache(currentRoadmap.id, nodes, edges, expandedNodes);
  }
  
  localStorage.removeItem('token');
  localStorage.removeItem('userName');
  localStorage.removeItem('username');
  localStorage.removeItem('userProfile');
  window.location.href = '/';
};


  return (
    <div className="learning-review-page">
      {/* Header */}
      <header className="lr-header">
        <div className="lr-header-left">
          <h1 className="lr-logo">Brainwave</h1>
          <span className="lr-subtitle">Learning Management</span>
        </div>
        <div className="lr-header-right">
          <div className="lr-user-section">
            {userProfile?.profile_pic && (
              <img src={userProfile.profile_pic} alt="Profile" className="lr-profile-pic" />
            )}
            <span>{userName}</span>
          </div>
          <button className="lr-nav-btn" onClick={() => {
  // Save current roadmap state before navigating
  if (currentRoadmap) {
    saveRoadmapToCache(currentRoadmap.id, nodes, edges, expandedNodes);
  }
  window.location.href = '/dashboard';
}}>
            Back to Dashboard
          </button>
          <button className="lr-nav-btn" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      {/* Tab Navigation */}
      {/* Tab Navigation */}
<nav className="lr-tabs">
  <button
    className={`lr-tab ${activeTab === 'create' ? 'active' : ''}`}
    onClick={() => handleTabChange('create')}
  >
    Create
  </button>
  <button
    className={`lr-tab ${activeTab === 'questions' ? 'active' : ''}`}
    onClick={() => handleTabChange('questions')}
  >
    Questions
  </button>
  <button
    className={`lr-tab ${activeTab === 'slides' ? 'active' : ''}`}
    onClick={() => handleTabChange('slides')}
  >
    Slides
  </button>
  <button
    className={`lr-tab ${activeTab === 'roadmap' ? 'active' : ''}`}
    onClick={() => handleTabChange('roadmap')}
  >
    Roadmap Explorer
  </button>
  <button
    className={`lr-tab ${activeTab === 'active' ? 'active' : ''}`}
    onClick={() => handleTabChange('active')}
  >
    Active Review/Questions
  </button>
  <button
    className={`lr-tab ${activeTab === 'history' ? 'active' : ''}`}
    onClick={() => handleTabChange('history')}
  >
    History
  </button>
</nav>
      {/* Main Content Area */}
      <div className="lr-content">
        <div>
          {activeTab === 'create' && (
            <div className="tab-content">
              <div className="section-header">
                <h2>Create & Explore</h2>
                <p>Generate learning materials and create your personalized learning pathways</p>
              </div>

              <div className="create-grid">
                {/* Create Roadmap Card */}
                <div className="create-card">
                  <h3>Create Knowledge Roadmap</h3>
                  <p>Build an interactive map of a topic with expandable nodes. Navigate through concepts and learn progressively.</p>
                  <button
                    onClick={() => setShowCreateRoadmapModal(true)}
                    className="create-card-btn"
                  >
                    Create New Roadmap
                  </button>
                </div>

                {/* Generate Questions Card */}
                <div className="create-card">
                  <h3>Generate Questions</h3>
                  <p>Create custom practice questions based on your notes, slides, or any topic to test your knowledge.</p>
                  <button 
                    onClick={() => {
                      setQuestionGenerationMode('main');
                      setActiveTab('questions');
                    }}
                    className="create-card-btn"
                  >
                    Generate Questions
                  </button>
                </div>

                {/* Create Review Card */}
                <div className="create-card">
                  <h3>Create Learning Review</h3>
                  <p>Submit a learning review prompt and receive AI feedback on your understanding and progress.</p>
                  <button className="create-card-btn">
                    Create Review
                  </button>
                </div>

                {/* Upload Slides Card */}
                <div className="create-card">
                  <h3>Upload Slides</h3>
                  <p>Upload presentation slides and access them with AI-powered insights and question generation.</p>
                  <button 
                    onClick={() => {
                      setActiveTab('slides');
                    }}
                    className="create-card-btn"
                  >
                    Upload Slides
                  </button>
                </div>
              </div>

              {/* Your Learning Reviews Section */}
              {learningReviews.length > 0 && (
                <div className="section">
                  <h3>Your Learning Reviews</h3>
                  <div className="items-grid">
                    {learningReviews.map((review) => (
                      <div key={review.id} className="item-card">
                        <h4>{review.title}</h4>
                        <p>Status: {review.status}</p>
                        <button
                          onClick={() => {
                            setActiveReview(review);
                            setReviewResponse('');
                            setReviewDetails(null);
                            setActiveTab('active');
                          }}
                          className="continue-btn"
                        >
                          Continue
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'roadmap' && !currentRoadmap && (
            <div className="tab-content">
              <div className="section-header">
                <h2>Knowledge Roadmaps</h2>
                <p>Explore and manage your interactive learning pathways</p>
              </div>

              <div className="create-grid">
                <div className="create-card">
                  <h3>Create New Roadmap</h3>
                  <p>Build an interactive map of a topic with expandable nodes. Navigate through concepts and learn progressively.</p>
                  <button
                    onClick={() => setShowCreateRoadmapModal(true)}
                    className="create-card-btn"
                  >
                    Create New Roadmap
                  </button>
                </div>
              </div>

              {roadmaps.length > 0 && (
                <div className="section">
                  <h3>Your Knowledge Roadmaps</h3>
                  <div className="items-grid">
                    {roadmaps.map((roadmap) => (
                      <div key={roadmap.id} className="item-card">
                        <div className="roadmap-card-header">
                          <h4>{roadmap.root_topic}</h4>
                          <button
                            onClick={(e) => deleteRoadmap(roadmap.id, e)}
                            className="delete-btn"
                            title="Delete Roadmap"
                          >
                            ×
                          </button>
                        </div>
                        <p>Nodes: {roadmap.total_nodes}</p>
                        <button
                          onClick={() => openRoadmap(roadmap)}
                          className="continue-btn"
                        >
                          Explore
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'roadmap' && currentRoadmap && (
            <div className="tab-content">
              <div className="roadmap-section">
                <div className="roadmap-header">
                  <div>
                    <h2>{currentRoadmap.title}</h2>
                    <button
  onClick={() => {
    // Save current roadmap state before leaving
    if (currentRoadmap) {
      saveRoadmapToCache(currentRoadmap.id, nodes, edges, expandedNodes);
    }
    setCurrentRoadmap(null);
    setNodes([]);
    setEdges([]);
    setShowNodePanel(false);
  }}
  className="back-btn"
>
                      Back to Roadmaps
                    </button>
                  </div>
                  {showNodePanel && (
                    <button
                      onClick={() => setShowNodePanel(false)}
                      className="close-panel-btn"
                    >
                      Close Panel
                    </button>
                  )}
                </div>
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  nodeTypes={nodeTypes}
                  fitView
                >
                  <Background />
                  <Controls />
                  <MiniMap />
                </ReactFlow>

                {showNodePanel && nodeExplanation && (
                  <div className="node-panel">
                    <div className="node-panel-header">
                      <h3>{nodeExplanation.topic_name}</h3>
                      <button
                        onClick={() => setShowNodePanel(false)}
                        className="close-panel-btn"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="panel-content">
                      {nodeExplanation.ai_explanation && (
                        <div style={{ marginBottom: '24px' }}>
                          <h4 style={{ color: '#D7B38C', fontSize: '16px', marginBottom: '12px', fontWeight: 600 }}>
                            Explanation
                          </h4>
                          <p style={{ lineHeight: '1.7', color: 'rgba(215, 179, 140, 0.9)' }}>
                            {nodeExplanation.ai_explanation}
                          </p>
                        </div>
                      )}
                      
                      {nodeExplanation.why_important && (
                        <div style={{ marginBottom: '24px' }}>
                          <h4 style={{ color: '#D7B38C', fontSize: '16px', marginBottom: '12px', fontWeight: 600 }}>
                            Why It's Important
                          </h4>
                          <p style={{ lineHeight: '1.7', color: 'rgba(215, 179, 140, 0.9)' }}>
                            {nodeExplanation.why_important}
                          </p>
                        </div>
                      )}
                      
                      {nodeExplanation.key_concepts && Array.isArray(nodeExplanation.key_concepts) && nodeExplanation.key_concepts.length > 0 && (
                        <div style={{ marginBottom: '24px' }}>
                          <h4 style={{ color: '#D7B38C', fontSize: '16px', marginBottom: '12px', fontWeight: 600 }}>
                            Key Concepts
                          </h4>
                          <ul style={{ paddingLeft: '20px', lineHeight: '1.7', color: 'rgba(215, 179, 140, 0.9)' }}>
                            {nodeExplanation.key_concepts.map((concept, idx) => (
                              <li key={idx} style={{ marginBottom: '8px' }}>{concept}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {nodeExplanation.real_world_examples && Array.isArray(nodeExplanation.real_world_examples) && nodeExplanation.real_world_examples.length > 0 && (
                        <div style={{ marginBottom: '24px' }}>
                          <h4 style={{ color: '#D7B38C', fontSize: '16px', marginBottom: '12px', fontWeight: 600 }}>
                            Real-World Examples
                          </h4>
                          <ul style={{ paddingLeft: '20px', lineHeight: '1.7', color: 'rgba(215, 179, 140, 0.9)' }}>
                            {nodeExplanation.real_world_examples.map((example, idx) => (
                              <li key={idx} style={{ marginBottom: '8px' }}>{example}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {nodeExplanation.learning_tips && (
                        <div style={{ marginBottom: '24px' }}>
                          <h4 style={{ color: '#D7B38C', fontSize: '16px', marginBottom: '12px', fontWeight: 600 }}>
                            Learning Tips
                          </h4>
                          <p style={{ lineHeight: '1.7', color: 'rgba(215, 179, 140, 0.9)', fontStyle: 'italic' }}>
                            {nodeExplanation.learning_tips}
                          </p>
                        </div>
                      )}
                      
                      {!nodeExplanation.ai_explanation && nodeExplanation.description && (
                        <div style={{ marginBottom: '24px' }}>
                          <p style={{ lineHeight: '1.8', fontSize: '15px' }}>
                            {nodeExplanation.description}
                          </p>
                          <p style={{ marginTop: '16px', fontStyle: 'italic', color: 'rgba(215, 179, 140, 0.6)', fontSize: '14px' }}>
                            Click "Explore" again to generate a detailed AI explanation.
                          </p>
                        </div>
                      )}
                      
                      {nodeExplanation.exploration_count > 0 && (
                        <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid rgba(215, 179, 140, 0.2)', fontSize: '13px', color: 'rgba(215, 179, 140, 0.6)' }}>
                          Explored {nodeExplanation.exploration_count} time{nodeExplanation.exploration_count > 1 ? 's' : ''}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'active' && activeReview && (
            <div className="tab-content">
              <div className="section-header">
                <h2>{activeReview.title}</h2>
                <p>Review your learning and identify areas for improvement</p>
              </div>

              <div className="review-content">
                <div className="review-prompt">
                  <h3>Review Prompt</h3>
                  <p>{activeReview.review_content}</p>
                </div>

                {!reviewDetails ? (
                  <div className="response-section">
                    <h3>Your Response</h3>
                    <textarea
                      value={reviewResponse}
                      onChange={(e) => setReviewResponse(e.target.value)}
                      placeholder="Write your response here..."
                      rows={10}
                      className="response-textarea"
                    />
                    <button
                      onClick={submitReviewResponse}
                      disabled={loading || !reviewResponse.trim()}
                      className="submit-response-btn"
                    >
                      {loading ? 'Submitting...' : 'Submit Response'}
                    </button>
                  </div>
                ) : (
                  <div className="feedback-section">
                    <h3>Feedback</h3>
                    <div className="feedback-content">
                      <p><strong>Score:</strong> {reviewDetails.score}/10</p>
                      <p><strong>Feedback:</strong> {reviewDetails.feedback}</p>
                      {reviewDetails.strengths && (
                        <div>
                          <h4>Strengths:</h4>
                          <ul>
                            {reviewDetails.strengths.map((s, idx) => (
                              <li key={idx}>{s}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {reviewDetails.improvements && (
                        <div>
                          <h4>Areas for Improvement:</h4>
                          <ul>
                            {reviewDetails.improvements.map((i, idx) => (
                              <li key={idx}>{i}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        setReviewResponse('');
                        setReviewDetails(null);
                      }}
                      className="submit-response-btn"
                    >
                      Start Over
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'active' && activeQuestionSet && !activeReview && (
            <div className="tab-content">
              <div className="section-header">
                <h2>{activeQuestionSet.title}</h2>
                <p>Answer the questions to test your knowledge</p>
              </div>

              {!questionResults ? (
                <div className="questions-section">
                  {activeQuestionSet.questions && activeQuestionSet.questions.map((q, idx) => {
                    const hintsForQuestion = questionHints[q.id] || [];
                    const isHintLoading = hintLoading[q.id];

                    return (
                      <div key={q.id} className="question-item">
                        <h4>Question {idx + 1}</h4>
                        <p>{q.question_text}</p>
                        {q.question_type === 'multiple_choice' && q.options && (
                          <div className="options">
                            {q.options.map((opt, optIdx) => (
                              <label key={optIdx} className="option">
                                <input
                                  type="radio"
                                  name={`q${q.id}`}
                                  value={opt}
                                  onChange={(e) => setQuestionAnswers({
                                    ...questionAnswers,
                                    [q.id]: e.target.value
                                  })}
                                  checked={questionAnswers[q.id] === opt}
                                />
                                {opt}
                              </label>
                            ))}
                          </div>
                        )}
                        {q.question_type === 'short_answer' && (
                          <input
                            type="text"
                            placeholder="Enter your answer..."
                            value={questionAnswers[q.id] || ''}
                            onChange={(e) => setQuestionAnswers({
                              ...questionAnswers,
                              [q.id]: e.target.value
                            })}
                            className="answer-input"
                          />
                        )}
                        <button
                          onClick={() => getHints(q.id)}
                          className="hint-btn"
                          disabled={!!isHintLoading}
                        >
                          {isHintLoading ? 'Loading...' : 'Get Hint'}
                        </button>
                        {hintsForQuestion.length > 0 && (
                          <div className="hints-display">
                            {hintsForQuestion.map((hint, hintIdx) => (
                              <p key={hintIdx}>{hint}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <button
                    onClick={submitAnswers}
                    disabled={loading}
                    className="submit-response-btn"
                  >
                    {loading ? 'Submitting...' : 'Submit Answers'}
                  </button>
                </div>
              ) : (
                <div className="results-section">
                  <h3>Your Results</h3>
                  <p><strong>Score:</strong> {questionResults.score}/{activeQuestionSet.questions.length}</p>
                  <div className="results-details">
                    {questionResults.details && questionResults.details.map((detail, idx) => (
                      <div key={idx} className={`result-item ${detail.correct ? 'correct' : 'incorrect'}`}>
                        <h4>Question {idx + 1}</h4>
                        <p><strong>Your Answer:</strong> {detail.user_answer}</p>
                        <p><strong>Correct Answer:</strong> {detail.correct_answer}</p>
                        {detail.explanation && (
                          <p><strong>Explanation:</strong> {detail.explanation}</p>
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => {
                      setActiveQuestionSet(null);
                      setQuestionAnswers({});
                      setQuestionResults(null);
                      setQuestionHints({});
                      setHintLoading({});
                      setActiveTab('create');
                    }}
                    className="submit-response-btn"
                  >
                    Back to Create
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="tab-content">
              <div className="section-header">
                <h2>Learning History</h2>
                <p>View your past learning sessions and progress</p>
              </div>

              {roadmaps.length > 0 && (
                <div className="section">
                  <h3>Knowledge Roadmaps</h3>
                  <div className="items-grid">
                    {roadmaps.map((roadmap) => (
                      <div key={roadmap.id} className="item-card">
                        <h4>{roadmap.root_topic}</h4>
                        <p>Nodes: {roadmap.total_nodes}</p>
                        <button
                          onClick={() => openRoadmap(roadmap)}
                          className="continue-btn"
                        >
                          Explore
                        </button>
                        <button
      onClick={(e) => deleteRoadmap(roadmap.id, e)}
      className="delete-btn"
      title="Delete Roadmap"
    >
      ×
    </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {learningReviews.length > 0 && (
                <div className="section">
                  <h3>Learning Reviews</h3>
                  <div className="items-grid">
                    {learningReviews.map((review) => (
                      <div key={review.id} className="item-card">
                        <h4>{review.title}</h4>
                        <p>Status: {review.status}</p>
                        <button
                          onClick={() => {
                            setActiveReview(review);
                            setReviewResponse('');
                            setReviewDetails(null);
                            setActiveTab('active');
                          }}
                          className="continue-btn"
                        >
                          View
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {generatedQuestions.length > 0 && (
                <div className="section">
                  <h3>Question Sets</h3>
                  <div className="items-grid">
                    {generatedQuestions.map((qSet) => (
                      <div key={qSet.id} className="item-card">
                        <h4>{qSet.title}</h4>
                        <p>Questions: {qSet.question_count}</p>
                        <button
                          onClick={() => loadQuestionSetWithQuestions(qSet.id)}
                          className="continue-btn"
                        >
                          Practice
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'questions' && (
            <div className="tab-content">
              <div className="page-header">
                <div className="header-content">
                  <h2>Generate Questions</h2>
                  <p>Create custom practice questions based on your materials</p>
                </div>
              </div>

              <div className="page-section">
                {/* Main Form Card */}
                <div className="form-card questions-form">
                  <h3>Create Question Set</h3>
                  
                  {/* Source Type Selection */}
                  <div className="form-group">
                    <label className="form-label">Select Source Type</label>
                    <div className="source-type-grid">
                      <div className="source-type-option">
                        <input 
                          type="radio" 
                          id="source-topic" 
                          name="sourceType" 
                          value="topic"
                          checked={selectedSourceType === 'topic'}
                          onChange={() => setSelectedSourceType('topic')}
                        />
                        <label htmlFor="source-topic" className="option-label">
                          <div>
                            <span className="option-title">From Topic</span>
                            <span className="option-desc">Enter any topic or paste content</span>
                          </div>
                        </label>
                      </div>
                      
                      {chatSessions.length > 0 && (
                        <div className="source-type-option">
                          <input 
                            type="radio" 
                            id="source-chat" 
                            name="sourceType" 
                            value="chat"
                            checked={selectedSourceType === 'chat'}
                            onChange={() => setSelectedSourceType('chat')}
                          />
                          <label htmlFor="source-chat" className="option-label">
                            <div>
                              <span className="option-title">From Chat Notes</span>
                              <span className="option-desc">{chatSessions.length} session(s) available</span>
                            </div>
                          </label>
                        </div>
                      )}
                      
                      {uploadedSlides.length > 0 && (
                        <div className="source-type-option">
                          <input 
                            type="radio" 
                            id="source-slide" 
                            name="sourceType" 
                            value="slide"
                            checked={selectedSourceType === 'slide'}
                            onChange={() => setSelectedSourceType('slide')}
                          />
                          <label htmlFor="source-slide" className="option-label">
                            <div>
                              <span className="option-title">From Uploaded Slides</span>
                              <span className="option-desc">{uploadedSlides.length} slide(s) available</span>
                            </div>
                          </label>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Content based on source type */}
                  {selectedSourceType === 'topic' && (
                    <div className="form-group">
                      <label className="form-label">Topic or Content</label>
                      <textarea 
                        value={questionTopic}
                        onChange={(e) => setQuestionTopic(e.target.value)}
                        placeholder="Enter a topic or paste the content you want to generate questions from..."
                        className="form-textarea"
                        rows="8"
                      />
                    </div>
                  )}

                  {selectedSourceType === 'chat' && (
                    <div className="form-group">
                      <label className="form-label">Select Chat Session</label>
                      <div className="sources-list">
                        {chatSessions.map((session) => (
                          <div 
                            key={session.id} 
                            className={`source-list-item ${selectedChatId === session.id ? 'selected' : ''}`}
                            onClick={() => setSelectedChatId(session.id)}
                          >
                            <div className="source-list-content">
                              <h4>{session.title}</h4>
                              <p>{session.message_count} messages</p>
                            </div>
                            <div className="source-list-radio">
                              <input 
                                type="radio" 
                                name="chat" 
                                checked={selectedChatId === session.id}
                                onChange={() => setSelectedChatId(session.id)}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedSourceType === 'slide' && (
                    <div className="form-group">
                      <label className="form-label">Select Slide</label>
                      <div className="sources-list">
                        {uploadedSlides.map((slide) => (
                          <div 
                            key={slide.id} 
                            className={`source-list-item ${selectedSlideId === slide.id ? 'selected' : ''}`}
                            onClick={() => setSelectedSlideId(slide.id)}
                          >
                            <div className="source-list-content">
                              <h4>{slide.name}</h4>
                              <p>{slide.page_count} pages</p>
                            </div>
                            <div className="source-list-radio">
                              <input 
                                type="radio" 
                                name="slide" 
                                checked={selectedSlideId === slide.id}
                                onChange={() => setSelectedSlideId(slide.id)}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Question Settings */}
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Number of Questions</label>
                      <input 
                        type="number" 
                        min="1" 
                        max="50" 
                        value={numberOfQuestions}
                        onChange={(e) => setNumberOfQuestions(parseInt(e.target.value) || 10)}
                        className="form-input" 
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Question Type</label>
                      <select 
                        value={questionType}
                        onChange={(e) => setQuestionType(e.target.value)}
                        className="form-select"
                      >
                        <option>Multiple Choice</option>
                        <option>Short Answer</option>
                        <option>Essay</option>
                        <option>Mixed</option>
                      </select>
                    </div>
                  </div>

                  <button 
                    onClick={generateQuestions}
                    disabled={isGeneratingQuestions}
                    className="submit-btn"
                  >
                    {isGeneratingQuestions ? 'Generating...' : 'Generate Questions'}
                  </button>
                </div>

                {/* Generated Question Sets */}
                {generatedQuestions.length > 0 && (
                  <div className="section">
                    <h3>Your Question Sets</h3>
                    <div className="items-grid">
                      {generatedQuestions.map((qSet) => (
                        <div key={qSet.id} className="item-card">
                          <h4>{qSet.title}</h4>
                          <p>Questions: {qSet.question_count}</p>
                          <p className="date">Created: {new Date(qSet.created_at).toLocaleDateString()}</p>
                          <button
                            onClick={() => loadQuestionSetWithQuestions(qSet.id)}
                            className="continue-btn"
                          >
                            Practice
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'slides' && (
            <div className="tab-content">
              <div className="page-header">
                <div className="header-content">
                  <h2>Upload & Manage Slides</h2>
                  <p>Upload presentation slides and get AI-powered insights</p>
                </div>
                <button onClick={goBackToDashboard} className="back-btn">
                  Back to Dashboard
                </button>
              </div>

              <div className="page-section">
                <div className="upload-card">
                  <h3>Upload New Slides</h3>
                  <div 
                    className="upload-area"
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.currentTarget.style.borderColor = '#ff6b6b';
                      e.currentTarget.style.backgroundColor = 'rgba(255, 107, 107, 0.05)';
                    }}
                    onDragLeave={(e) => {
                      e.currentTarget.style.borderColor = '#e5e5e5';
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.currentTarget.style.borderColor = '#e5e5e5';
                      e.currentTarget.style.backgroundColor = 'transparent';
                      handleFileUpload(e.dataTransfer.files);
                    }}
                  >
                    
                    <p>Drag and drop your PDF or PowerPoint files here</p>
                    <p className="upload-hint">or</p>
                    <button 
                      className="upload-btn"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                    >
                      {isUploading ? `Uploading... ${Math.round(uploadProgress)}%` : 'Select Files'}
                    </button>
                    <p className="upload-note">Supported formats: PDF, PPTX, PPT (Max 50MB)</p>
                    {uploadProgress > 0 && uploadProgress < 100 && (
                      <div className="upload-progress-bar" style={{ width: `${uploadProgress}%` }}></div>
                    )}
                  </div>
                  <input 
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.ppt,.pptx,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                    style={{ display: 'none' }}
                    onChange={(e) => handleFileUpload(e.target.files)}
                  />
                </div>

                {uploadedSlides.length > 0 && (
                  <div className="section">
                    <h3>Your Uploaded Slides</h3>
                    <div className="slides-list">
                      {uploadedSlides.map((slide) => (
                        <div key={slide.id} className="slide-card">
                          <div className="slide-info">
                            <h4>{slide.name}</h4>
                            <div className="slide-meta">
                              <span className="meta-item">{slide.page_count} pages</span>
                              <span className="meta-item">{new Date(slide.uploaded_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                          <div className="slide-actions">
                            <button 
                              onClick={() => setSelectedSlideForView(slide.id)}
                              className="continue-btn"
                            >
                              View Summary
                            </button>
                            <button className="continue-btn secondary">
                              Generate Questions
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {selectedSlideForView && (
                      <div className="summary-section">
                        <button 
                          onClick={() => setSelectedSlideForView(null)}
                          className="close-summary-btn"
                        >
                          Close
                        </button>
                        <h3>Slide Summary & Key Points</h3>
                        <div className="summary-content">
                          <div className="summary-block">
                            <h4>Overview</h4>
                            <p>Comprehensive AI-generated summary of all slides with key concepts and learning objectives.</p>
                          </div>
                          <div className="summary-block">
                            <h4>Key Takeaways</h4>
                            <ul>
                              <li>Main concept 1 - detailed explanation</li>
                              <li>Main concept 2 - detailed explanation</li>
                              <li>Main concept 3 - detailed explanation</li>
                            </ul>
                          </div>
                          <div className="summary-block">
                            <h4>Learning Objectives</h4>
                            <ul>
                              <li>Understand fundamental principles</li>
                              <li>Apply concepts to real-world scenarios</li>
                              <li>Master advanced techniques</li>
                            </ul>
                          </div>
                          <div className="summary-block">
                            <h4>Common Misconceptions</h4>
                            <p>Students often confuse X with Y. However, the correct understanding is...</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {showCreateRoadmapModal && (
        <div 
          onClick={() => setShowCreateRoadmapModal(false)}
          className="modal-overlay"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="modal-content"
          >
            <div className="modal-header">
              <h3>Create Knowledge Roadmap</h3>
              <button
                onClick={() => setShowCreateRoadmapModal(false)}
                className="modal-close-btn"
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              <label>Enter a topic to explore:</label>
              <input
                type="text"
                value={newRoadmapTopic}
                onChange={(e) => setNewRoadmapTopic(e.target.value)}
                placeholder="e.g., Quantum Physics, Machine Learning, Ancient Rome"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') createRoadmap();
                }}
                className="modal-input"
              />
            </div>

            <div className="modal-footer">
              <button
                onClick={() => setShowCreateRoadmapModal(false)}
                className="modal-btn cancel-btn"
              >
                Cancel
              </button>
              <button
                onClick={createRoadmap}
                disabled={loading || !newRoadmapTopic.trim()}
                className="modal-btn submit-btn"
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

export default LearningReview;

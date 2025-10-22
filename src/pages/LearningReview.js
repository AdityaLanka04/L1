import React, { useState, useEffect, useCallback } from 'react';
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
  const [hints, setHints] = useState([]);
  const [showHints, setShowHints] = useState(false);
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

  const navigate = (path) => {
    window.location.href = path;
  };

  // FIXED: expandNode with useCallback to prevent stale closures
  const expandNode = useCallback(async (nodeId) => {
    console.log('Expanding node:', nodeId);
    
    setNodes((nds) => {
      console.log('Current nodes count:', nds.length);
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
        
        if (data.status === 'already_expanded') {
          setNodes((nds) =>
            nds.map(n =>
              n.data.nodeId === nodeId
                ? { ...n, data: { ...n.data, expansionStatus: 'expanded', isExpanding: false } }
                : n
            )
          );
          return;
        }
        
        setNodes((nds) => {
          const parentNode = nds.find(n => n.data.nodeId === nodeId);
          
          if (!parentNode) {
            console.error('Parent node not found');
            alert('Error: Parent node not found. Please refresh the page.');
            return nds.map(n =>
              n.data.nodeId === nodeId
                ? { ...n, data: { ...n.data, isExpanding: false } }
                : n
            );
          }
          
          const childrenCount = data.child_nodes.length;
          const horizontalSpacing = 280;
          const parentDepth = parentNode.data.depth;
          const baseVerticalSpacing = 250;
          const depthMultiplier = 1.2;
          const verticalSpacing = baseVerticalSpacing * Math.pow(depthMultiplier, parentDepth);
          
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
              onExpand: expandNode,
              onExplore: exploreNode,
            },
          }));

          return [
            ...nds.map(n =>
              n.data.nodeId === nodeId
                ? { ...n, data: { ...n.data, expansionStatus: 'expanded', isExpanding: false } }
                : n
            ),
            ...newNodes
          ];
        });
        
        console.log('All nodes after expansion:');
        setNodes((nds) => {
          console.log('Node IDs:', nds.map(n => ({ id: n.id, nodeId: n.data.nodeId })));
          return nds;
        });
        
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
        
        console.log('Creating edges:', newEdges);
        console.log('Edge example:', newEdges[0]);
        
        setEdges((eds) => {
          console.log('Current edges before adding:', eds);
          const combined = [...eds, ...newEdges];
          console.log('Combined edges after adding:', combined);
          return combined;
        });

        setTimeout(() => {
          setEdges((eds) =>
            eds.map(e =>
              newEdges.some(ne => ne.id === e.id) ? { ...e, animated: false } : e
            )
          );
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
  }, [setNodes, setEdges]);

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

  const loadGeneratedQuestions = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:8001/get_question_sets?user_id=${userName}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setGeneratedQuestions(data.question_sets || []);
      }
    } catch (error) {
      console.error('Error loading question sets:', error);
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

  useEffect(() => {
    if (userName) {
      loadChatSessions();
      loadUploadedSlides();
      loadLearningReviews();
      loadGeneratedQuestions();
      loadUserRoadmaps();
    }
  }, [userName, loadChatSessions, loadUploadedSlides, loadLearningReviews, loadGeneratedQuestions, loadUserRoadmaps]);

  // Debug: Log edges whenever they change
  useEffect(() => {
    console.log('=== EDGES STATE UPDATED ===');
    console.log('Total edges:', edges.length);
    console.log('Edges:', edges);
  }, [edges]);

  const handleSlideUpload = async (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('user_id', userName);
    
    Array.from(files).forEach((file) => {
      formData.append('files', file);
    });

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:8001/upload_slides', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        setUploadProgress(100);
        setTimeout(() => {
          setIsUploading(false);
          setUploadProgress(0);
          loadUploadedSlides();
          alert(`Successfully uploaded ${data.uploaded_count} slide(s)`);
        }, 500);
      } else {
        const errorData = await response.json();
        alert(`Error uploading slides: ${errorData.detail}`);
        setIsUploading(false);
      }
    } catch (error) {
      console.error('Error uploading slides:', error);
      alert('Failed to upload slides');
      setIsUploading(false);
    }
  };

  const createLearningReview = async () => {
    if (selectedSessions.length === 0 && selectedSlides.length === 0) {
      alert('Please select at least one chat session or slide');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:8001/create_learning_review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          user_id: userName,
          chat_session_ids: selectedSessions.map(s => s.id),
          slide_ids: selectedSlides.map(s => s.id),
          review_title: `Learning Review - ${new Date().toLocaleDateString()}`,
          review_type: 'comprehensive'
        })
      });

      if (response.ok) {
        const data = await response.json();
        setActiveReview(data);
        setActiveTab('active');
        loadLearningReviews();
        setSelectedSessions([]);
        setSelectedSlides([]);
      } else {
        const errorData = await response.json();
        alert(`Error creating review: ${errorData.detail}`);
      }
    } catch (error) {
      console.error('Error creating learning review:', error);
      alert('Failed to create learning review');
    } finally {
      setLoading(false);
    }
  };

  const generateQuestions = async () => {
    if (selectedSessions.length === 0 && selectedSlides.length === 0) {
      alert('Please select at least one chat session or slide');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:8001/generate_questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          user_id: userName,
          chat_session_ids: selectedSessions.map(s => s.id),
          slide_ids: selectedSlides.map(s => s.id)
        })
      });

      if (response.ok) {
        const data = await response.json();
        setActiveQuestionSet(data);
        setActiveTab('questions');
        loadGeneratedQuestions();
        setSelectedSessions([]);
        setSelectedSlides([]);
        setQuestionAnswers({});
      } else {
        const errorData = await response.json();
        alert(`Error generating questions: ${errorData.detail}`);
      }
    } catch (error) {
      console.error('Error generating questions:', error);
      alert('Failed to generate questions');
    } finally {
      setLoading(false);
    }
  };

  const submitReviewResponse = async () => {
    if (!reviewResponse.trim()) {
      alert('Please provide a response');
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
          review_id: activeReview.id,
          user_response: reviewResponse
        })
      });

      if (response.ok) {
        const data = await response.json();
        setReviewDetails(data);
        setReviewResponse('');
      } else {
        const errorData = await response.json();
        alert(`Error submitting response: ${errorData.detail}`);
      }
    } catch (error) {
      console.error('Error submitting response:', error);
      alert('Failed to submit response');
    } finally {
      setLoading(false);
    }
  };

  const submitQuestionAnswers = async () => {
    const unanswered = activeQuestionSet.questions.filter(
      q => !questionAnswers[q.id] || questionAnswers[q.id].trim() === ''
    );

    if (unanswered.length > 0) {
      alert(`Please answer all questions (${unanswered.length} remaining)`);
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:8001/submit_question_answers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          question_set_id: activeQuestionSet.id,
          answers: questionAnswers
        })
      });

      if (response.ok) {
        const data = await response.json();
        setQuestionResults(data);
      } else {
        const errorData = await response.json();
        alert(`Error submitting answers: ${errorData.detail}`);
      }
    } catch (error) {
      console.error('Error submitting answers:', error);
      alert('Failed to submit answers');
    } finally {
      setLoading(false);
    }
  };

  const requestHint = async (questionId) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:8001/get_hint/${questionId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setHints(prev => [...prev, { questionId, hint: data.hint }]);
        setShowHints(true);
      } else {
        alert('Error getting hint');
      }
    } catch (error) {
      console.error('Error getting hint:', error);
      alert('Failed to get hint');
    } finally {
      setLoading(false);
    }
  };

  const deleteSlide = async (slideId) => {
    if (!window.confirm('Are you sure you want to delete this slide?')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:8001/delete_slide/${slideId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        loadUploadedSlides();
      } else {
        const errorData = await response.json();
        alert(`Error deleting slide: ${errorData.detail}`);
      }
    } catch (error) {
      console.error('Error deleting slide:', error);
      alert('Failed to delete slide');
    }
  };

  const deleteQuestionSet = async (questionSetId) => {
    if (!window.confirm('Are you sure you want to delete this question set?')) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:8001/delete_question_set/${questionSetId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        loadGeneratedQuestions();
        alert('Question set deleted successfully');
      } else {
        const errorData = await response.json();
        alert(`Error deleting question set: ${errorData.detail}`);
      }
    } catch (error) {
      console.error('Error deleting question set:', error);
      alert('Failed to delete question set');
    } finally {
      setLoading(false);
    }
  };

  const loadQuestionSetWithQuestions = async (questionSetId) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:8001/get_question_set_details/${questionSetId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setActiveQuestionSet(data);
        setActiveTab('questions');
        setQuestionAnswers({});
        setQuestionResults(null);
      } else {
        alert('Error loading questions');
      }
    } catch (error) {
      console.error('Error loading question set:', error);
      alert('Failed to load questions');
    } finally {
      setLoading(false);
    }
  };

  const toggleSessionSelection = (session) => {
    setSelectedSessions(prev => {
      const isSelected = prev.find(s => s.id === session.id);
      if (isSelected) {
        return prev.filter(s => s.id !== session.id);
      } else {
        return [...prev, session];
      }
    });
  };

  const toggleSlideSelection = (slide) => {
    setSelectedSlides(prev => {
      const isSelected = prev.find(s => s.id === slide.id);
      if (isSelected) {
        return prev.filter(s => s.id !== slide.id);
      } else {
        return [...prev, slide];
      }
    });
  };

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
            onExpand: expandNode,
            onExplore: exploreNode,
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
      const response = await fetch(`http://localhost:8001/get_roadmap_graph/${roadmap.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        
        setCurrentRoadmap(roadmap);
        
        const nodesByDepth = new Map();
        data.nodes.forEach(node => {
          if (!nodesByDepth.has(node.depth_level)) {
            nodesByDepth.set(node.depth_level, []);
          }
          nodesByDepth.get(node.depth_level).push(node);
        });

        const flowNodes = data.nodes.map(node => {
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

        const flowEdges = data.edges.map(edge => ({
          id: `e${edge.parent_id}-${edge.child_id}`,
          source: String(edge.parent_id),
          target: String(edge.child_id),
          type: 'smoothstep',
          animated: false,
          style: { stroke: '#D7B38C', strokeWidth: 3 },
          markerEnd: {
            type: 'arrow',
            color: '#D7B38C',
            width: 20,
            height: 20,
          },
        }));

        console.log('Loading roadmap edges:', flowEdges);

        setNodes(flowNodes);
        setEdges(flowEdges);
        setActiveTab('roadmap');
      } else {
        alert('Failed to load roadmap');
      }
    } catch (error) {
      console.error('Error loading roadmap:', error);
      alert('Failed to load roadmap');
    } finally {
      setLoading(false);
    }
  };

  const deleteRoadmap = async (roadmapId, e) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this roadmap?')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:8001/delete_roadmap/${roadmapId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        loadUserRoadmaps();
        if (currentRoadmap && currentRoadmap.id === roadmapId) {
          setCurrentRoadmap(null);
          setActiveTab('library');
        }
      } else {
        alert('Failed to delete roadmap');
      }
    } catch (error) {
      console.error('Error deleting roadmap:', error);
      alert('Failed to delete roadmap');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="roadmap-container">
      <div className="roadmap-header">
        <div className="header-content">
          <div className="header-left">
            <h1 className="app-title" onClick={() => navigate('/dashboard')}>
              StudyFlow
            </h1>
            <span className="app-subtitle">Learning Management</span>
          </div>
          <div className="header-right">
            {userProfile?.profile_pic && (
              <img 
                src={userProfile.profile_pic} 
                alt="Profile" 
                className="profile-pic"
              />
            )}
            <button onClick={() => navigate('/chat')} className="header-btn">
              Chat
            </button>
            <button onClick={() => navigate('/dashboard')} className="header-btn">
              Dashboard
            </button>
            <button
              onClick={() => {
                localStorage.removeItem('token');
                localStorage.removeItem('username');
                localStorage.removeItem('userProfile');
                navigate('/login');
              }}
              className="header-btn logout"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="roadmap-content">
        <div className="tab-navigation">
          {currentRoadmap ? (
            <button
              onClick={() => setActiveTab('roadmap')}
              className={`tab-btn ${activeTab === 'roadmap' ? 'active' : ''}`}
            >
              Active Roadmap
            </button>
          ) : (
            <button
              onClick={() => setActiveTab('library')}
              className={`tab-btn ${activeTab === 'library' ? 'active' : ''}`}
            >
              Roadmap Library
            </button>
          )}
          <button
            onClick={() => setActiveTab('create')}
            className={`tab-btn ${activeTab === 'create' ? 'active' : ''}`}
          >
            Create
          </button>
          <button
            onClick={() => setActiveTab('slides')}
            className={`tab-btn ${activeTab === 'slides' ? 'active' : ''}`}
          >
            Slides
          </button>
          {activeReview && (
            <button
              onClick={() => setActiveTab('active')}
              className={`tab-btn ${activeTab === 'active' ? 'active' : ''}`}
            >
              Active Review
            </button>
          )}
          {activeQuestionSet && (
            <button
              onClick={() => setActiveTab('questions')}
              className={`tab-btn ${activeTab === 'questions' ? 'active' : ''}`}
            >
              Questions
            </button>
          )}
          <button
            onClick={() => setActiveTab('reviews')}
            className={`tab-btn ${activeTab === 'reviews' ? 'active' : ''}`}
          >
            Reviews
          </button>
          <button
            onClick={() => setActiveTab('question-library')}
            className={`tab-btn ${activeTab === 'question-library' ? 'active' : ''}`}
          >
            Question Library
          </button>
        </div>

        {activeTab === 'library' && (
          <div className="tab-content">
            <div className="library-header">
              <div>
                <h2>Knowledge Roadmaps</h2>
                <p>Explore and expand your knowledge through interactive topic maps</p>
              </div>
              <button
                onClick={() => setShowCreateRoadmapModal(true)}
                className="create-roadmap-btn"
              >
                Create New Roadmap
              </button>
            </div>

            {roadmaps.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">No Roadmaps</div>
                <h3>Start Your Learning Journey</h3>
                <p>Create your first knowledge roadmap to begin exploring topics in depth</p>
              </div>
            ) : (
              <div className="roadmaps-grid">
                {roadmaps.map((roadmap) => (
                  <div key={roadmap.id} className="roadmap-card">
                    <div className="roadmap-card-header">
                      <h3>{roadmap.title}</h3>
                      <button
                        onClick={(e) => deleteRoadmap(roadmap.id, e)}
                        className="delete-btn"
                      >
                        ×
                      </button>
                    </div>
                    <div className="roadmap-stats">
                      <div className="stat-item">
                        <span className="stat-label">Nodes</span>
                        <span className="stat-value">{roadmap.total_nodes}</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-label">Max Depth</span>
                        <span className="stat-value">{roadmap.max_depth_reached}</span>
                      </div>
                    </div>
                    <div className="roadmap-meta">
                      Created {formatDate(roadmap.created_at)}
                    </div>
                    <button
                      onClick={() => openRoadmap(roadmap)}
                      className="explore-roadmap-btn"
                    >
                      Explore Roadmap
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'roadmap' && currentRoadmap && (
          <div className="tab-content">
            <div className="active-roadmap-header">
              <button onClick={() => {
                setCurrentRoadmap(null);
                setActiveTab('library');
              }} className="back-btn">
                ← Back to Library
              </button>
              <div className="roadmap-info">
                <h2>{currentRoadmap.title}</h2>
                <div className="roadmap-meta-inline">
                  <span>{nodes.length} Nodes</span>
                  <span>Max Depth: {currentRoadmap.max_depth_reached}</span>
                </div>
              </div>
            </div>

            <div className="flow-container">
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                nodeTypes={nodeTypes}
                fitView
                minZoom={0.1}
                maxZoom={1.5}
                defaultEdgeOptions={{
                  type: 'smoothstep',
                  animated: false,
                  style: { stroke: '#D7B38C', strokeWidth: 3 },
                  markerEnd: {
                    type: 'arrow',
                    color: '#D7B38C',
                  },
                }}
              >
                <Background color="#D7B38C" gap={16} />
                <Controls />
                <MiniMap
                  nodeColor={(node) => {
                    if (node.data.isExplored) return '#4CAF50';
                    if (node.data.expansionStatus === 'expanded') return '#FF9800';
                    return '#9E9E9E';
                  }}
                />
              </ReactFlow>
            </div>

            {showNodePanel && nodeExplanation && (
              <div className="node-details-panel">
                <div className="panel-header">
                  <h3>{nodeExplanation.topic_name || 'Node Details'}</h3>
                  <button
                    onClick={() => setShowNodePanel(false)}
                    className="panel-close-btn"
                  >
                    ×
                  </button>
                </div>
                <div className="panel-content">
                  {nodeExplanation.ai_explanation && (
                    <div style={{ marginBottom: '24px' }}>
                      <p style={{ lineHeight: '1.8', fontSize: '15px' }}>
                        {nodeExplanation.ai_explanation}
                      </p>
                    </div>
                  )}
                  
                  {nodeExplanation.why_important && (
                    <div style={{ marginBottom: '24px' }}>
                      <h4 style={{ color: '#D7B38C', fontSize: '16px', marginBottom: '12px', fontWeight: 600 }}>
                        Why This Matters
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
                    <p>{reviewDetails.feedback}</p>
                  </div>
                  <div className="areas-section">
                    <h4>Areas for Improvement</h4>
                    <ul className="areas-list">
                      {reviewDetails.areas_for_improvement.map((area, index) => (
                        <li key={index}>{area}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'questions' && activeQuestionSet && (
          <div className="tab-content">
            <div className="section-header">
              <h2>Practice Questions</h2>
              <p>Test your understanding with these generated questions</p>
            </div>

            {!questionResults ? (
              <div className="questions-content">
                {activeQuestionSet.questions.map((question, index) => (
                  <div key={question.id} className="question-block">
                    <div className="question-header">
                      <span className="question-number">Question {index + 1}</span>
                      <span className="question-difficulty">{question.difficulty}</span>
                    </div>
                    <div className="question-text">{question.question}</div>
                    <textarea
                      value={questionAnswers[question.id] || ''}
                      onChange={(e) => setQuestionAnswers(prev => ({
                        ...prev,
                        [question.id]: e.target.value
                      }))}
                      placeholder="Type your answer here..."
                      rows={4}
                      className="answer-textarea"
                    />
                    <button
                      onClick={() => requestHint(question.id)}
                      className="hint-btn"
                      disabled={loading}
                    >
                      Need a Hint?
                    </button>
                    {showHints && hints.find(h => h.questionId === question.id) && (
                      <div className="hint-box">
                        <strong>Hint:</strong> {hints.find(h => h.questionId === question.id).hint}
                      </div>
                    )}
                  </div>
                ))}
                <button
                  onClick={submitQuestionAnswers}
                  disabled={loading}
                  className="submit-answers-btn"
                >
                  {loading ? 'Submitting...' : 'Submit All Answers'}
                </button>
              </div>
            ) : (
              <div className="results-content">
                <div className="results-summary">
                  <h3>Your Results</h3>
                  <div className="score-display">
                    Score: {questionResults.score}%
                  </div>
                </div>
                {questionResults.question_feedback.map((feedback, index) => (
                  <div key={index} className="feedback-block">
                    <div className="feedback-question">
                      <strong>Question {index + 1}:</strong> {feedback.question}
                    </div>
                    <div className="feedback-answer">
                      <strong>Your Answer:</strong> {feedback.user_answer}
                    </div>
                    <div className="feedback-response">
                      <strong>Feedback:</strong> {feedback.feedback}
                    </div>
                    <div className="feedback-correct">
                      <strong>Correct Answer:</strong> {feedback.correct_answer}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'create' && (
          <div className="tab-content">
            <div className="section-header">
              <h2>Create Learning Materials</h2>
              <p>Select chat sessions or slides to create reviews or generate questions</p>
            </div>

            <div className="selection-sections">
              <div className="selection-section">
                <h3>Chat Sessions</h3>
                {chatSessions.length === 0 ? (
                  <p className="empty-text">No chat sessions available</p>
                ) : (
                  <div className="sessions-list">
                    {chatSessions.map((session) => (
                      <div
                        key={session.id}
                        onClick={() => toggleSessionSelection(session)}
                        className={`session-card ${selectedSessions.find(s => s.id === session.id) ? 'selected' : ''}`}
                      >
                        <div className="session-info">
                          <div className="session-title">{session.title}</div>
                          <div className="session-date">{formatDate(session.created_at)}</div>
                        </div>
                        <div className="selection-indicator">
                          {selectedSessions.find(s => s.id === session.id) ? '✓' : '○'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="selection-section">
                <h3>Uploaded Slides</h3>
                {uploadedSlides.length === 0 ? (
                  <p className="empty-text">No slides uploaded</p>
                ) : (
                  <div className="sessions-list">
                    {uploadedSlides.map((slide) => (
                      <div
                        key={slide.id}
                        onClick={() => toggleSlideSelection(slide)}
                        className={`session-card ${selectedSlides.find(s => s.id === slide.id) ? 'selected' : ''}`}
                      >
                        <div className="session-info">
                          <div className="session-title">{slide.filename}</div>
                          <div className="session-date">{formatDate(slide.uploaded_at)}</div>
                        </div>
                        <div className="selection-indicator">
                          {selectedSlides.find(s => s.id === slide.id) ? '✓' : '○'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="action-buttons">
              <button
                onClick={createLearningReview}
                disabled={loading || (selectedSessions.length === 0 && selectedSlides.length === 0)}
                className="create-btn primary"
              >
                {loading ? 'Creating...' : 'Create Learning Review'}
              </button>
              
              <button
                onClick={generateQuestions}
                disabled={loading || (selectedSessions.length === 0 && selectedSlides.length === 0)}
                className="create-btn secondary"
              >
                {loading ? 'Generating...' : 'Generate Questions'}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'slides' && (
          <div className="tab-content">
            <div className="section-header">
              <h2>Manage Slides</h2>
            </div>
            
            <div className="upload-section">
              <input
                type="file"
                multiple
                accept=".pdf,.ppt,.pptx"
                onChange={handleSlideUpload}
                style={{ display: 'none' }}
                id="slide-upload"
              />
              <label 
                htmlFor="slide-upload"
                className="create-roadmap-btn"
              >
                Upload Slides
              </label>
            </div>

            {isUploading && (
              <div className="upload-progress">
                <p>Uploading... {uploadProgress}%</p>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${uploadProgress}%` }} />
                </div>
              </div>
            )}

            {uploadedSlides.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">No Slides</div>
                <h3>No Slides Uploaded</h3>
                <p>Upload your first slide to get started</p>
              </div>
            ) : (
              <div className="slides-grid">
                {uploadedSlides.map((slide) => (
                  <div key={slide.id} className="slide-card">
                    <div className="slide-header">
                      <div className="slide-title">{slide.filename}</div>
                      <button
                        onClick={() => deleteSlide(slide.id)}
                        className="delete-slide-btn"
                      >
                        ×
                      </button>
                    </div>
                    <div className="slide-date">{formatDate(slide.uploaded_at)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'reviews' && (
          <div className="tab-content">
            <div className="section-header">
              <h2>My Reviews</h2>
            </div>
            
            {learningReviews.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">No Reviews</div>
                <h3>No Reviews Created</h3>
                <p>Create your first learning review to get started</p>
              </div>
            ) : (
              <div className="reviews-grid">
                {learningReviews.map((review) => (
                  <div key={review.id} className="review-card">
                    <div className="review-header">
                      <div className="review-title">{review.title}</div>
                    </div>
                    <div className="review-date">{formatDate(review.created_at)}</div>
                    <button
                      onClick={() => {
                        setActiveReview(review);
                        setActiveTab('active');
                      }}
                      className="continue-btn"
                    >
                      Continue Review
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'question-library' && (
          <div className="tab-content">
            <div className="section-header">
              <h2>Question Library</h2>
            </div>
            
            {generatedQuestions.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">No Questions</div>
                <h3>No Question Sets Created</h3>
                <p>Generate your first question set to get started</p>
              </div>
            ) : (
              <div className="questions-grid">
                {generatedQuestions.map((qSet) => (
                  <div key={qSet.id} className="question-set-card">
                    <div className="question-set-header">
                      <div className="question-set-title">Question Set</div>
                      <button
                        onClick={() => deleteQuestionSet(qSet.id)}
                        className="delete-question-set-btn"
                      >
                        ×
                      </button>
                    </div>
                    <div className="question-set-stats">
                      <div className="stat">
                        <span className="stat-label">Questions</span>
                        <span className="stat-value">{qSet.question_count}</span>
                      </div>
                    </div>
                    <div className="question-set-footer">
                      <div className="question-set-date">{formatDate(qSet.created_at)}</div>
                      <button
                        onClick={() => loadQuestionSetWithQuestions(qSet.id)}
                        className="continue-btn"
                      >
                        Practice
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
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
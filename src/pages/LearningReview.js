import React, { useState, useEffect } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
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

  useEffect(() => {
    if (userName) {
      loadChatSessions();
      loadUploadedSlides();
      loadLearningReviews();
      loadGeneratedQuestions();
      loadUserRoadmaps();
    }
  }, [userName]);

  const loadChatSessions = async () => {
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
  };

  const loadUploadedSlides = async () => {
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
  };

  const loadLearningReviews = async () => {
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
  };

  const loadGeneratedQuestions = async () => {
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
  };

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
          slide_ids: selectedSlides.map(s => s.id),
          question_count: 10,
          difficulty_mix: {
            easy: 3,
            medium: 5,
            hard: 2
          }
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

  const loadUserRoadmaps = async () => {
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
          id: data.root_node.id.toString(),
          type: 'custom',
          position: { x: 400, y: 50 },
          data: {
            label: data.root_node.topic_name,
            description: data.root_node.description,
            depth: 0,
            isExplored: false,
            expansionStatus: 'unexpanded',
            nodeId: data.root_node.id,
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

  const loadRoadmapData = async (roadmapId) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:8001/get_knowledge_roadmap/${roadmapId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setCurrentRoadmap(data.roadmap);
        
        const allNodes = data.nodes_flat;
        const rootNode = allNodes.find(n => n.parent_id === null);
        
        if (rootNode) {
          const flowNodes = allNodes.map(node => ({
            id: node.id.toString(),
            type: 'custom',
            position: { x: node.position.x, y: node.position.y },
            data: {
              label: node.topic_name,
              description: node.description,
              depth: node.depth_level,
              isExplored: node.is_explored,
              expansionStatus: node.expansion_status,
              nodeId: node.id,
            },
          }));

          const flowEdges = allNodes
            .filter(node => node.parent_id !== null)
            .map(node => ({
              id: `e${node.parent_id}-${node.id}`,
              source: node.parent_id.toString(),
              target: node.id.toString(),
              type: 'smoothstep',
              animated: false,
              style: { stroke: '#D7B38C', strokeWidth: 2 },
              markerEnd: {
                type: MarkerType.ArrowClosed,
                color: '#D7B38C',
              },
            }));

          setNodes(flowNodes);
          setEdges(flowEdges);
        }
      }
    } catch (error) {
      console.error('Error loading roadmap:', error);
      alert('Failed to load roadmap');
    } finally {
      setLoading(false);
    }
  };

  const expandNode = async (nodeId) => {
    setNodes((nds) =>
      nds.map(n =>
        n.data.nodeId === nodeId
          ? { ...n, data: { ...n.data, isExpanding: true } }
          : n
      )
    );
    
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
        
        const parentNode = nodes.find(n => n.data.nodeId === nodeId);
        const childrenCount = data.child_nodes.length;
        const horizontalSpacing = 280;
        const verticalSpacing = 200;
        
        const totalWidth = (childrenCount - 1) * horizontalSpacing;
        const startX = parentNode.position.x - (totalWidth / 2);

        const newNodes = data.child_nodes.map((child, index) => ({
          id: child.id.toString(),
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
          },
        }));

        const newEdges = data.child_nodes.map(child => ({
          id: `e${child.parent_id}-${child.id}`,
          source: child.parent_id.toString(),
          target: child.id.toString(),
          type: 'smoothstep',
          animated: true,
          style: { stroke: '#D7B38C', strokeWidth: 2 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#D7B38C',
          },
        }));

        setNodes((nds) => [
          ...nds.map(n =>
            n.data.nodeId === nodeId
              ? { ...n, data: { ...n.data, expansionStatus: 'expanded', isExpanding: false } }
              : n
          ),
          ...newNodes
        ]);
        
        setEdges((eds) => [...eds, ...newEdges]);

        setTimeout(() => {
          setEdges((eds) =>
            eds.map(e =>
              newEdges.some(ne => ne.id === e.id)
                ? { ...e, animated: false }
                : e
            )
          );
        }, 2000);

      } else {
        const errorData = await response.json();
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
  };

  const exploreNode = async (nodeId) => {
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
        
        setNodeExplanation(data.node);
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
        await loadUserRoadmaps();
        if (currentRoadmap?.id === roadmapId) {
          setCurrentRoadmap(null);
          setNodes([]);
          setEdges([]);
        }
      }
    } catch (error) {
      console.error('Error deleting roadmap:', error);
    }
  };

  const CustomNode = ({ data }) => {
  const getNodeColor = () => {
    if (data.isExplored) return '#4CAF50';
    if (data.expansionStatus === 'expanded') return '#FF9800';
    return '#D7B38C';
  };

  const getStatusIndicator = () => {
    if (data.isExplored && data.expansionStatus === 'expanded') return 'Explored & Expanded';
    if (data.isExplored) return 'Explored';
    if (data.expansionStatus === 'expanded') return 'Expanded';
    return 'Unexplored';
  };

  return (
    <div
      className="roadmap-node"
      style={{
        borderColor: getNodeColor(),
        borderStyle: (data.isExpanding || data.isExploring) ? 'dashed' : 'solid',
        opacity: (data.isExpanding || data.isExploring) ? 0.7 : 1,
        pointerEvents: 'all' // 👈 allow clicks inside this node
      }}
    >
      <div
        className="node-status-badge"
        style={{ background: getNodeColor() }}
      >
        {getStatusIndicator()}
      </div>

      <div className="node-title" style={{ color: getNodeColor() }}>
        {data.label}
      </div>

      {data.description && (
        <div className="node-description">{data.description}</div>
      )}

      <div
  className="node-actions nodrag nopan"
  style={{
    display: 'flex',
    justifyContent: 'center',
    gap: '8px',
    marginTop: '8px',
  }}
>
  <button
    onClick={(e) => {
      e.stopPropagation();
      e.preventDefault();
      if (!data.isExploring && !data.isExpanding) {
        exploreNode(data.nodeId);
      }
    }}
    disabled={data.isExploring || data.isExpanding}
    className="node-btn explore-btn nodrag nopan"
  >
    {data.isExploring ? 'Loading...' : data.isExplored ? 'View Details' : 'Explore Topic'}
  </button>

  {data.expansionStatus !== 'expanded' && (
    <button
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        if (!data.isExpanding && !data.isExploring) {
          expandNode(data.nodeId);
        }
      }}
      disabled={data.isExpanding || data.isExploring}
      className="node-btn expand-btn nodrag nopan"
    >
      {data.isExpanding ? 'Expanding...' : 'Expand Topics'}
    </button>
  )}

  {data.expansionStatus === 'expanded' && (
    <div className="node-expanded-indicator">Subtopics Visible</div>
  )}
</div>


      <div className="node-depth-indicator">Depth Level {data.depth}</div>
    </div>
  );
};


  const nodeTypes = {
    custom: CustomNode,
  };

  const handleLogout = () => {
    if (userProfile?.googleUser && window.google) {
      window.google.accounts.id.disableAutoSelect();
    }
    
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('userProfile');
    navigate('/');
  };

  const goToDashboard = () => {
    navigate('/dashboard');
  };

  const goToChat = () => {
    navigate('/ai-chat');
  };

  const handleLogoClick = () => {
    navigate('/dashboard');
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="roadmap-container">
      <header className="roadmap-header">
        <div className="header-content">
          <div className="header-left">
            <h1 className="app-title" onClick={handleLogoClick}>brainwave</h1>
            <span className="app-subtitle">Learning Review System</span>
          </div>
          <div className="header-right">
            {userProfile?.picture && (
              <img
                src={userProfile.picture}
                alt="Profile"
                className="profile-pic"
                referrerPolicy="no-referrer"
                crossOrigin="anonymous"
              />
            )}
            <button onClick={goToChat} className="header-btn">AI Chat</button>
            <button onClick={goToDashboard} className="header-btn">Dashboard</button>
            <button onClick={handleLogout} className="header-btn logout">LOGOUT</button>
          </div>
        </div>
      </header>

      <div className="roadmap-content">
        <div className="tab-navigation">
          <button 
            onClick={() => setActiveTab('create')}
            className={`tab-btn ${activeTab === 'create' ? 'active' : ''}`}
          >
            Create Review
          </button>
          <button 
            onClick={() => setActiveTab('slides')}
            className={`tab-btn ${activeTab === 'slides' ? 'active' : ''}`}
          >
            Manage Slides
          </button>
          <button 
            onClick={() => setActiveTab('reviews')}
            className={`tab-btn ${activeTab === 'reviews' ? 'active' : ''}`}
          >
            My Reviews
          </button>
          <button 
            onClick={() => setActiveTab('question-library')}
            className={`tab-btn ${activeTab === 'question-library' ? 'active' : ''}`}
          >
            Question Library
          </button>
          <button 
            onClick={() => setActiveTab('roadmap')}
            className={`tab-btn ${activeTab === 'roadmap' ? 'active' : ''}`}
          >
            Knowledge Roadmap
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
              Active Questions
            </button>
          )}
        </div>

        {activeTab === 'roadmap' && (
          <div className="tab-content">
            {!currentRoadmap ? (
              <div className="roadmap-library">
                <div className="library-header">
                  <div>
                    <h2>Knowledge Roadmap</h2>
                    <p>Explore topics infinitely deep with AI-powered knowledge trees</p>
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
                            <span className="stat-label">Total Nodes</span>
                            <span className="stat-value">{roadmap.total_nodes}</span>
                          </div>
                          <div className="stat-item">
                            <span className="stat-label">Max Depth</span>
                            <span className="stat-value">{roadmap.max_depth_reached}</span>
                          </div>
                        </div>

                        <div className="roadmap-meta">
                          Created: {formatDate(roadmap.created_at)}
                        </div>
                        
                        <button
                          onClick={() => loadRoadmapData(roadmap.id)}
                          className="explore-roadmap-btn"
                        >
                          Open Roadmap
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="active-roadmap">
                <div className="active-roadmap-header">
                  <button
                    onClick={() => {
                      setCurrentRoadmap(null);
                      setNodes([]);
                      setEdges([]);
                      setShowNodePanel(false);
                    }}
                    className="back-btn"
                  >
                    ← Back to Library
                  </button>
                  
                  <div className="roadmap-info">
                    <h2>{currentRoadmap.title}</h2>
                    <div className="roadmap-meta-inline">
                      <span>Nodes: {currentRoadmap.total_nodes}</span>
                      <span>Depth: {currentRoadmap.max_depth_reached}</span>
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
                    nodesDraggable={true}
                    nodesConnectable={false}
                    elementsSelectable={true}
                    fitView
                    minZoom={0.3}
                    maxZoom={1.5}
                    defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
                    panOnDrag={[1, 2]} // 👈 allow panning with right or middle mouse only
                    selectionOnDrag={false} 
                  >
                    <Background color="#D7B38C" gap={20} size={1} />
                    <Controls />
                    <MiniMap
                      nodeColor={(node) => {
                        if (node.data.isExplored) return '#4CAF50';
                        if (node.data.expansionStatus === 'expanded') return '#FF9800';
                        return '#D7B38C';
                      }}
                      maskColor="rgba(0, 0, 0, 0.8)"
                    />
                  </ReactFlow>
                </div>

                {showNodePanel && nodeExplanation && (
                  <div className="node-details-panel">
                    <div className="panel-header">
                      <div>
                        <h3>{nodeExplanation.topic_name}</h3>
                        {nodeExplanation.description && (
                          <p className="panel-description">{nodeExplanation.description}</p>
                        )}
                      </div>
                      <button
                        onClick={() => setShowNodePanel(false)}
                        className="close-panel-btn"
                      >
                        ×
                      </button>
                    </div>

                    <div className="panel-content">
                      {nodeExplanation.ai_explanation && (
                        <div className="panel-section">
                          <h4>Overview</h4>
                          <p>{nodeExplanation.ai_explanation}</p>
                        </div>
                      )}

                      {nodeExplanation.key_concepts && nodeExplanation.key_concepts.length > 0 && (
                        <div className="panel-section">
                          <h4>Key Concepts</h4>
                          <ul>
                            {nodeExplanation.key_concepts.map((concept, idx) => (
                              <li key={idx}>{concept}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {nodeExplanation.why_important && (
                        <div className="panel-section">
                          <h4>Why This Matters</h4>
                          <p>{nodeExplanation.why_important}</p>
                        </div>
                      )}

                      {nodeExplanation.real_world_examples && nodeExplanation.real_world_examples.length > 0 && (
                        <div className="panel-section">
                          <h4>Real-World Applications</h4>
                          <ul>
                            {nodeExplanation.real_world_examples.map((example, idx) => (
                              <li key={idx}>{example}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {nodeExplanation.learning_tips && (
                        <div className="panel-section">
                          <h4>Learning Tips</h4>
                          <p>{nodeExplanation.learning_tips}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'create' && (
          <div className="tab-content">
            <div className="section-header">
              <h2>Create Learning Review</h2>
            </div>
            
            <div className="session-selection">
              <div className="selection-header">
                <h3>Select Chat Sessions</h3>
              </div>
              {chatSessions.length === 0 ? (
                <p className="empty-text">No chat sessions available</p>
              ) : (
                <div className="sessions-grid">
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

            <div className="session-selection">
              <div className="selection-header">
                <h3>Select Slides</h3>
              </div>
              {uploadedSlides.length === 0 ? (
                <p className="empty-text">No slides available</p>
              ) : (
                <div className="sessions-grid">
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
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader } from 'lucide-react';
import './KnowledgeRoadmap.css';

const KnowledgeRoadmap = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const [userName, setUserName] = useState('');
  
  // State
  const [activePanel, setActivePanel] = useState('create');
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [roadmaps, setRoadmaps] = useState([]);
  const [loadingRoadmaps, setLoadingRoadmaps] = useState(false);
  const [currentRoadmap, setCurrentRoadmap] = useState(null);
  const [roadmapNodes, setRoadmapNodes] = useState([]);

  useEffect(() => {
    fetchUserProfile();
    fetchSavedRoadmaps();
  }, [token]);

  const fetchUserProfile = async () => {
    try {
      const response = await fetch('http://localhost:8001/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setUserName(data.first_name || 'User');
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  };

  const fetchSavedRoadmaps = async () => {
    try {
      setLoadingRoadmaps(true);
      // Get current user's ID from the /me endpoint
      const userResponse = await fetch('http://localhost:8001/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!userResponse.ok) {
        console.error('Failed to get user info');
        return;
      }
      const userData = await userResponse.json();
      
      // Fetch roadmaps using the user_id
      const roadsResponse = await fetch(`http://localhost:8001/get_user_roadmaps?user_id=${userData.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (roadsResponse.ok) {
        const roadsData = await roadsResponse.json();
        setRoadmaps(roadsData.roadmaps || []);
      } else {
        console.error('Failed to fetch roadmaps');
        setRoadmaps([]);
      }
    } catch (error) {
      console.error('Error fetching roadmaps:', error);
      setRoadmaps([]);
    } finally {
      setLoadingRoadmaps(false);
    }
  };

  const generateRoadmap = async () => {
    if (!topic.trim()) return;
    
    try {
      setLoading(true);
      const response = await fetch('http://localhost:8001/create_knowledge_roadmap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          user_id: userName || 'user',
          root_topic: topic 
        })
      });

      if (response.ok) {
        const data = await response.json();
        setCurrentRoadmap(data);
        setTopic('');
        await fetchSavedRoadmaps();
        setActivePanel('saved');
      }
    } catch (error) {
      console.error('Error generating roadmap:', error);
      alert('Failed to generate roadmap');
    } finally {
      setLoading(false);
    }
  };

  const viewRoadmap = async (roadmapId) => {
    try {
      setLoadingRoadmaps(true);
      const response = await fetch(`http://localhost:8001/get_knowledge_roadmap/${roadmapId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setCurrentRoadmap(data);
        setRoadmapNodes(data.nodes_flat || []);
      }
    } catch (error) {
      console.error('Error fetching roadmap:', error);
    } finally {
      setLoadingRoadmaps(false);
    }
  };

  const deleteRoadmap = async (roadmapId) => {
    if (!window.confirm('Delete this roadmap?')) return;
    
    try {
      const response = await fetch(`http://localhost:8001/delete_roadmap/${roadmapId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        await fetchSavedRoadmaps();
      }
    } catch (error) {
      console.error('Error deleting roadmap:', error);
    }
  };

  return (
    <div className="kr-page">
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

      <div className="kr-panel-switcher">
        <button 
          className={`kr-switcher-btn ${activePanel === 'create' ? 'active' : ''}`}
          onClick={() => setActivePanel('create')}
        >
          Create & View
        </button>
        <button 
          className={`kr-switcher-btn ${activePanel === 'saved' ? 'active' : ''}`}
          onClick={() => setActivePanel('saved')}
        >
          Saved Roadmaps
        </button>
      </div>

      <div className="kr-content">
        {/* CREATE PANEL */}
        {activePanel === 'create' && (
          <div className="kr-panel">
            <div className="kr-section-header">
              <h2 className="kr-section-title">Create Knowledge Roadmap</h2>
              <p className="kr-section-subtitle">Enter a topic to generate an interactive learning path</p>
            </div>

            <div className="kr-form-group">
              <label className="kr-label">Enter Topic</label>
              <input
                type="text"
                className="kr-input"
                placeholder="e.g., Machine Learning, Quantum Physics, etc."
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                disabled={loading}
              />
              <button 
                className="kr-button kr-button-primary"
                onClick={generateRoadmap}
                disabled={loading || !topic.trim()}
              >
                {loading ? (
                  <>
                    <Loader size={16} className="kr-spinner" />
                    Generating...
                  </>
                ) : (
                  'Generate Roadmap'
                )}
              </button>
            </div>

            {currentRoadmap && (
              <div className="kr-current-display">
                <h3 className="kr-display-title">{currentRoadmap.root_node?.topic_name}</h3>
                <p className="kr-display-text">{currentRoadmap.root_node?.description}</p>
                <p className="kr-display-stat">Total Nodes: {currentRoadmap.total_nodes}</p>
              </div>
            )}
          </div>
        )}

        {/* SAVED PANEL */}
        {activePanel === 'saved' && (
          <div className="kr-panel">
            <div className="kr-section-header">
              <h2 className="kr-section-title">Saved Roadmaps</h2>
              <p className="kr-section-subtitle">View and manage your roadmaps</p>
            </div>

            {loadingRoadmaps ? (
              <div className="kr-loading">
                <Loader size={40} className="kr-spinner" />
                <p>Loading roadmaps...</p>
              </div>
            ) : roadmaps.length === 0 ? (
              <div className="kr-empty">
                <p>No roadmaps yet. Create one to get started!</p>
              </div>
            ) : (
              <div className="kr-grid">
                {roadmaps.map(roadmap => (
                  <div key={roadmap.id} className="kr-card">
                    <div className="kr-card-content">
                      <h3 className="kr-card-title">{roadmap.title}</h3>
                      <p className="kr-card-topic">{roadmap.root_topic}</p>
                      <div className="kr-card-stats">
                        <span>Nodes: {roadmap.total_nodes}</span>
                        <span>Depth: {roadmap.max_depth_reached}</span>
                      </div>
                    </div>
                    <div className="kr-card-actions">
                      <button 
                        className="kr-card-btn kr-card-btn-primary"
                        onClick={() => viewRoadmap(roadmap.id)}
                      >
                        View
                      </button>
                      <button 
                        className="kr-card-btn kr-card-btn-danger"
                        onClick={() => deleteRoadmap(roadmap.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default KnowledgeRoadmap;
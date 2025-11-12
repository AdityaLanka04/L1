import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Plus, Trash2, ArrowLeft, Loader, Link as LinkIcon, BookOpen, FileText, Brain, Filter, Search, TrendingUp } from 'lucide-react';
import './ConceptWeb.css';
import { API_URL } from '../config';

const ConceptWeb = () => {
  const navigate = useNavigate();
  const [userName, setUserName] = useState('');
  const [concepts, setConcepts] = useState([]);
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newConcept, setNewConcept] = useState({ name: '', description: '', category: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [sortBy, setSortBy] = useState('name');

  useEffect(() => {
    const token = localStorage.getItem('token');
    const username = localStorage.getItem('username');
    
    if (!token) {
      navigate('/login');
      return;
    }
    
    if (username) {
      setUserName(username);
      loadConceptWeb(username);
    }
  }, [navigate]);

  const loadConceptWeb = async (username) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/get_concept_web?user_id=${username}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Loaded concept web data:', data);
        setConcepts(data.nodes || []);
        setConnections(data.connections || []);
      }
    } catch (error) {
      console.error('Error loading concept web:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateConceptWeb = async () => {
    if (!window.confirm('Generate concept web from your learning content?')) {
      return;
    }
    
    try {
      setGenerating(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/generate_concept_web`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ user_id: userName })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'no_content') {
          alert('No learning content found!');
        } else {
          alert(`Generated ${data.concepts_created} concepts!`);
          await loadConceptWeb(userName);
        }
      }
    } catch (error) {
      console.error('Error generating:', error);
    } finally {
      setGenerating(false);
    }
  };

  const addConcept = async () => {
    if (!newConcept.name.trim()) {
      alert('Please enter a concept name');
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/add_concept_node`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          user_id: userName,
          concept_name: newConcept.name,
          description: newConcept.description,
          category: newConcept.category || 'General'
        })
      });
      
      if (response.ok) {
        setShowAddModal(false);
        setNewConcept({ name: '', description: '', category: '' });
        loadConceptWeb(userName);
      }
    } catch (error) {
      console.error('Error adding concept:', error);
    }
  };

  const deleteConcept = async (nodeId) => {
    if (!window.confirm('Delete this concept?')) return;
    
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_URL}/delete_concept_node/${nodeId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      loadConceptWeb(userName);
      setSelectedNode(null);
    } catch (error) {
      console.error('Error deleting:', error);
    }
  };

  const deleteAllConcepts = async () => {
    if (!window.confirm('Delete ALL concepts? This cannot be undone!')) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/delete_all_concepts?user_id=${userName}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        setConcepts([]);
        setConnections([]);
        setSelectedNode(null);
        alert('All concepts deleted successfully');
      }
    } catch (error) {
      console.error('Error deleting all:', error);
      alert('Failed to delete all concepts');
    }
  };

  const getMasteryColor = (level) => {
    if (level < 0.3) return '#EF4444';
    if (level < 0.7) return '#F59E0B';
    return '#10B981';
  };

  const getConnectionColor = (type) => {
    const colors = {
      prerequisite: '#F59E0B',
      related: '#D7B38C',
      opposite: '#EF4444',
      example_of: '#10B981',
      part_of: '#3B82F6'
    };
    return colors[type] || '#D7B38C';
  };

  const getConnectedConcepts = (conceptId) => {
    return connections.filter(conn => 
      conn.source_id === conceptId || conn.target_id === conceptId
    );
  };

  const getCategories = () => {
    const categories = new Set(concepts.map(c => c.category));
    return ['all', ...Array.from(categories)];
  };

  const getFilteredAndSortedConcepts = () => {
    let filtered = concepts;

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(c => 
        c.concept_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.category.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Category filter
    if (filterCategory !== 'all') {
      filtered = filtered.filter(c => c.category === filterCategory);
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.concept_name.localeCompare(b.concept_name);
        case 'mastery':
          return b.mastery_level - a.mastery_level;
        case 'connections':
          return getConnectedConcepts(b.id).length - getConnectedConcepts(a.id).length;
        case 'content':
          const aTotal = a.notes_count + a.quizzes_count + a.flashcards_count;
          const bTotal = b.notes_count + b.quizzes_count + b.flashcards_count;
          return bTotal - aTotal;
        default:
          return 0;
      }
    });

    return filtered;
  };

  const getStats = () => {
    const totalConcepts = concepts.length;
    const totalConnections = connections.length;
    const avgMastery = concepts.length > 0 
      ? Math.round((concepts.reduce((sum, c) => sum + c.mastery_level, 0) / concepts.length) * 100)
      : 0;
    const categories = new Set(concepts.map(c => c.category)).size;
    
    return { totalConcepts, totalConnections, avgMastery, categories };
  };

  return (
    <div className="concept-web-page">
      <header className="concept-web-header">
        <div className="header-left">
          <button className="back-btn" onClick={() => navigate('/dashboard')}>
            <ArrowLeft size={18} />
            BACK
          </button>
          <div>
            <h1 className="page-title">Concept Web Builder</h1>
            <p className="page-subtitle">Visualize your learning concepts</p>
          </div>
        </div>
        <div className="header-right">
          <button className="generate-btn" onClick={generateConceptWeb} disabled={generating}>
            {generating ? <><Loader size={18} className="spinner" />Generating...</> : <><Sparkles size={18} />AI Generate</>}
          </button>
          <button className="add-btn" onClick={() => setShowAddModal(true)}>
            <Plus size={18} />Add Concept
          </button>
          {concepts.length > 0 && (
            <button className="delete-all-btn" onClick={deleteAllConcepts}>
              <Trash2 size={18} />Delete All
            </button>
          )}
        </div>
      </header>

      <div className="concept-web-container">
        {loading ? (
          <div className="loading-state">
            <Loader size={40} className="spinner" />
            <p>Loading...</p>
          </div>
        ) : concepts.length === 0 ? (
          <div className="empty-state">
            <Brain size={64} style={{ opacity: 0.3 }} />
            <h3>No Concept Web Yet</h3>
            <p>Click "AI Generate" to create from your content</p>
          </div>
        ) : (
          <>
            {/* Stats Bar */}
            <div className="stats-bar">
              <div className="stat-item">
                <Brain size={20} />
                <div>
                  <span className="stat-value">{getStats().totalConcepts}</span>
                  <span className="stat-label">Concepts</span>
                </div>
              </div>
              <div className="stat-item">
                <LinkIcon size={20} />
                <div>
                  <span className="stat-value">{getStats().totalConnections}</span>
                  <span className="stat-label">Connections</span>
                </div>
              </div>
              <div className="stat-item">
                <TrendingUp size={20} />
                <div>
                  <span className="stat-value">{getStats().avgMastery}%</span>
                  <span className="stat-label">Avg Mastery</span>
                </div>
              </div>
              <div className="stat-item">
                <Filter size={20} />
                <div>
                  <span className="stat-value">{getStats().categories}</span>
                  <span className="stat-label">Categories</span>
                </div>
              </div>
            </div>

            {/* Filters and Search */}
            <div className="controls-bar">
              <div className="search-box">
                <Search size={18} />
                <input
                  type="text"
                  placeholder="Search concepts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              
              <div className="filter-group">
                <label>Category:</label>
                <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
                  {getCategories().map(cat => (
                    <option key={cat} value={cat}>{cat === 'all' ? 'All Categories' : cat}</option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label>Sort by:</label>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                  <option value="name">Name</option>
                  <option value="mastery">Mastery Level</option>
                  <option value="connections">Connections</option>
                  <option value="content">Content Count</option>
                </select>
              </div>
            </div>

            {/* Concepts Grid */}
            <div className="concepts-grid">
              {getFilteredAndSortedConcepts().map(concept => {
                const connectedConcepts = getConnectedConcepts(concept.id);
                const totalContent = concept.notes_count + concept.quizzes_count + concept.flashcards_count;
                
                return (
                  <div 
                    key={concept.id}
                    className="concept-card"
                    onClick={() => setSelectedNode(concept)}
                    style={{ borderLeftColor: getMasteryColor(concept.mastery_level) }}
                  >
                    <div className="concept-card-header">
                      <h3>{concept.concept_name}</h3>
                      <span className="concept-category">{concept.category}</span>
                    </div>
                    
                    {concept.description && <p className="concept-description">{concept.description}</p>}
                    
                    <div className="concept-stats-grid">
                      <div className="stat-box">
                        <FileText size={16} />
                        <div>
                          <span className="stat-number">{concept.notes_count}</span>
                          <span className="stat-text">Notes</span>
                        </div>
                      </div>
                      <div className="stat-box">
                        <Brain size={16} />
                        <div>
                          <span className="stat-number">{concept.quizzes_count}</span>
                          <span className="stat-text">Quizzes</span>
                        </div>
                      </div>
                      <div className="stat-box">
                        <BookOpen size={16} />
                        <div>
                          <span className="stat-number">{concept.flashcards_count}</span>
                          <span className="stat-text">Cards</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mastery-section">
                      <div className="mastery-header">
                        <label>Mastery Level</label>
                        <span className="mastery-percent">{Math.round(concept.mastery_level * 100)}%</span>
                      </div>
                      <div className="mastery-bar">
                        <div 
                          className="mastery-fill" 
                          style={{ 
                            width: `${concept.mastery_level * 100}%`,
                            background: getMasteryColor(concept.mastery_level)
                          }}
                        ></div>
                      </div>
                    </div>
                    
                    {connectedConcepts.length > 0 && (
                      <div className="connections-badge">
                        <LinkIcon size={14} />
                        <span>{connectedConcepts.length} connection{connectedConcepts.length !== 1 ? 's' : ''}</span>
                      </div>
                    )}

                    <div className="card-hover-overlay">
                      <span>Click to view details</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {getFilteredAndSortedConcepts().length === 0 && (
              <div className="no-results">
                <Search size={48} style={{ opacity: 0.3 }} />
                <p>No concepts match your search</p>
              </div>
            )}
          </>
        )}
      </div>

      {selectedNode && (
        <div className="node-details-panel">
          <div className="panel-header">
            <h3>{selectedNode.concept_name}</h3>
            <button className="close-btn" onClick={() => setSelectedNode(null)}>×</button>
          </div>
          <div className="panel-content">
            <div className="detail-section">
              <label>Category</label>
              <p>{selectedNode.category}</p>
            </div>
            {selectedNode.description && (
              <div className="detail-section">
                <label>Description</label>
                <p>{selectedNode.description}</p>
              </div>
            )}
            <div className="detail-section">
              <label>Mastery Level</label>
              <div className="mastery-display">
                <div className="mastery-bar-large">
                  <div 
                    className="mastery-fill" 
                    style={{ 
                      width: `${selectedNode.mastery_level * 100}%`,
                      background: getMasteryColor(selectedNode.mastery_level)
                    }}
                  ></div>
                </div>
                <span>{Math.round(selectedNode.mastery_level * 100)}%</span>
              </div>
            </div>
            <div className="detail-section">
              <label>Related Content</label>
              <div className="content-counts">
                <div className="count-item">
                  <FileText size={18} />
                  <div>
                    <strong>{selectedNode.notes_count}</strong>
                    <span>Notes</span>
                  </div>
                </div>
                <div className="count-item">
                  <Brain size={18} />
                  <div>
                    <strong>{selectedNode.quizzes_count}</strong>
                    <span>Quizzes</span>
                  </div>
                </div>
                <div className="count-item">
                  <BookOpen size={18} />
                  <div>
                    <strong>{selectedNode.flashcards_count}</strong>
                    <span>Flashcards</span>
                  </div>
                </div>
              </div>
            </div>
            
            {getConnectedConcepts(selectedNode.id).length > 0 && (
              <div className="detail-section">
                <label>Connections</label>
                <div className="connections-list">
                  {getConnectedConcepts(selectedNode.id).map(conn => {
                    const targetId = conn.source_id === selectedNode.id ? conn.target_id : conn.source_id;
                    const targetConcept = concepts.find(c => c.id === targetId);
                    return (
                      <div key={conn.id} className="connection-item">
                        <span 
                          className="connection-type"
                          style={{ background: getConnectionColor(conn.connection_type) }}
                        >
                          {conn.connection_type}
                        </span>
                        <span>{targetConcept?.concept_name}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
            <button className="delete-concept-btn" onClick={() => deleteConcept(selectedNode.id)}>
              <Trash2 size={16} />
              Delete Concept
            </button>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add New Concept</h3>
              <button className="close-btn" onClick={() => setShowAddModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Concept Name *</label>
                <input
                  type="text"
                  value={newConcept.name}
                  onChange={e => setNewConcept({...newConcept, name: e.target.value})}
                  placeholder="e.g., Machine Learning"
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>Category</label>
                <input
                  type="text"
                  value={newConcept.category}
                  onChange={e => setNewConcept({...newConcept, category: e.target.value})}
                  placeholder="e.g., Computer Science"
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={newConcept.description}
                  onChange={e => setNewConcept({...newConcept, description: e.target.value})}
                  placeholder="Brief description..."
                  rows="3"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowAddModal(false)}>Cancel</button>
              <button className="btn-create" onClick={addConcept}>Add Concept</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConceptWeb;

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Plus, Trash2, ArrowLeft, Loader, Link as LinkIcon, BookOpen, FileText, Brain, Filter, Search, TrendingUp, Download, Eye, EyeOff, Grid, Network, BarChart3, CheckSquare, Square } from 'lucide-react';
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
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'network'
  const [selectedConcepts, setSelectedConcepts] = useState(new Set());
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [highlightConnections, setHighlightConnections] = useState(null);
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  const [generatingContent, setGeneratingContent] = useState(null);

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
    
    const masteryDistribution = {
      beginner: concepts.filter(c => c.mastery_level < 0.3).length,
      intermediate: concepts.filter(c => c.mastery_level >= 0.3 && c.mastery_level < 0.7).length,
      advanced: concepts.filter(c => c.mastery_level >= 0.7).length
    };

    const mostConnected = concepts.length > 0 
      ? concepts.reduce((max, c) => {
          const connCount = getConnectedConcepts(c.id).length;
          return connCount > (max.count || 0) ? { concept: c, count: connCount } : max;
        }, {})
      : null;

    const totalContent = concepts.reduce((sum, c) => 
      sum + c.notes_count + c.quizzes_count + c.flashcards_count, 0
    );
    
    return { 
      totalConcepts, 
      totalConnections, 
      avgMastery, 
      categories,
      masteryDistribution,
      mostConnected,
      totalContent
    };
  };

  const toggleConceptSelection = (conceptId) => {
    const newSelected = new Set(selectedConcepts);
    if (newSelected.has(conceptId)) {
      newSelected.delete(conceptId);
    } else {
      newSelected.add(conceptId);
    }
    setSelectedConcepts(newSelected);
  };

  const selectAll = () => {
    setSelectedConcepts(new Set(getFilteredAndSortedConcepts().map(c => c.id)));
  };

  const deselectAll = () => {
    setSelectedConcepts(new Set());
  };

  const deleteSelected = async () => {
    if (selectedConcepts.size === 0) return;
    if (!window.confirm(`Delete ${selectedConcepts.size} selected concepts?`)) return;

    try {
      const token = localStorage.getItem('token');
      await Promise.all(
        Array.from(selectedConcepts).map(id =>
          fetch(`${API_URL}/delete_concept_node/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          })
        )
      );
      loadConceptWeb(userName);
      setSelectedConcepts(new Set());
      setSelectedNode(null);
    } catch (error) {
      console.error('Error deleting selected:', error);
    }
  };

  const generateConceptContent = async (contentType) => {
    if (!selectedNode) return;
    
    const contentNames = {
      notes: 'study notes',
      flashcards: 'flashcards',
      quiz: 'practice quiz'
    };
    
    const endpoints = {
      notes: 'generate_concept_notes',
      flashcards: 'generate_concept_flashcards',
      quiz: 'generate_concept_quiz'
    };
    
    if (!window.confirm(`Generate AI-powered ${contentNames[contentType]} for "${selectedNode.concept_name}"?`)) {
      return;
    }
    
    try {
      setGeneratingContent(contentType);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/${endpoints[contentType]}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          user_id: userName,
          concept_id: selectedNode.id
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        alert(`✅ Generated ${contentNames[contentType]}! Mastery increased to ${Math.round(data.new_mastery * 100)}%`);
        
        // Reload concept web to show updated counts and mastery
        await loadConceptWeb(userName);
        
        // Navigate to the appropriate page with the generated content
        if (contentType === 'notes' && data.note_id) {
          navigate(`/notes`);
        } else if (contentType === 'flashcards' && data.set_id) {
          navigate(`/flashcards`);
        } else if (contentType === 'quiz' && data.quiz_id) {
          navigate(`/quiz-hub`);
        }
      } else {
        const error = await response.json();
        alert(`Failed to generate content: ${error.detail}`);
      }
    } catch (error) {
      console.error('Error generating content:', error);
      alert('Failed to generate content');
    } finally {
      setGeneratingContent(null);
    }
  };

  const exportData = () => {
    const data = {
      concepts: concepts.map(c => ({
        name: c.concept_name,
        category: c.category,
        description: c.description,
        mastery: c.mastery_level,
        content: {
          notes: c.notes_count,
          quizzes: c.quizzes_count,
          flashcards: c.flashcards_count
        }
      })),
      connections: connections.map(c => {
        const source = concepts.find(con => con.id === c.source_id);
        const target = concepts.find(con => con.id === c.target_id);
        return {
          from: source?.concept_name,
          to: target?.concept_name,
          type: c.connection_type,
          strength: c.strength
        };
      }),
      stats: getStats(),
      exportDate: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `concept-web-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
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
          {concepts.length > 0 && (
            <>
              <button className="icon-btn" onClick={() => setShowAnalytics(!showAnalytics)} title="Analytics">
                <BarChart3 size={18} />
              </button>
              <button className="icon-btn" onClick={exportData} title="Export Data">
                <Download size={18} />
              </button>
              <button 
                className="icon-btn" 
                onClick={() => setViewMode(viewMode === 'grid' ? 'network' : 'grid')}
                title={viewMode === 'grid' ? 'Network View' : 'Grid View'}
              >
                {viewMode === 'grid' ? <Network size={18} /> : <Grid size={18} />}
              </button>
            </>
          )}
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

            {/* Analytics Panel */}
            {showAnalytics && (
              <div className="analytics-panel">
                <div className="analytics-header">
                  <h3>Analytics Dashboard</h3>
                  <button className="close-btn" onClick={() => setShowAnalytics(false)}>×</button>
                </div>
                <div className="analytics-grid">
                  <div className="analytics-card">
                    <h4>Mastery Distribution</h4>
                    <div className="mastery-bars">
                      <div className="mastery-bar-item">
                        <span className="mastery-label">Beginner (&lt;30%)</span>
                        <div className="mastery-bar-bg">
                          <div 
                            className="mastery-bar-fill beginner"
                            style={{ width: `${(getStats().masteryDistribution.beginner / concepts.length) * 100}%` }}
                          ></div>
                        </div>
                        <span className="mastery-count">{getStats().masteryDistribution.beginner}</span>
                      </div>
                      <div className="mastery-bar-item">
                        <span className="mastery-label">Intermediate (30-70%)</span>
                        <div className="mastery-bar-bg">
                          <div 
                            className="mastery-bar-fill intermediate"
                            style={{ width: `${(getStats().masteryDistribution.intermediate / concepts.length) * 100}%` }}
                          ></div>
                        </div>
                        <span className="mastery-count">{getStats().masteryDistribution.intermediate}</span>
                      </div>
                      <div className="mastery-bar-item">
                        <span className="mastery-label">Advanced (&gt;70%)</span>
                        <div className="mastery-bar-bg">
                          <div 
                            className="mastery-bar-fill advanced"
                            style={{ width: `${(getStats().masteryDistribution.advanced / concepts.length) * 100}%` }}
                          ></div>
                        </div>
                        <span className="mastery-count">{getStats().masteryDistribution.advanced}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="analytics-card">
                    <h4>Most Connected Concept</h4>
                    {getStats().mostConnected?.concept ? (
                      <div className="highlight-concept">
                        <h5>{getStats().mostConnected.concept.concept_name}</h5>
                        <p>{getStats().mostConnected.count} connections</p>
                        <button 
                          className="view-btn"
                          onClick={() => setSelectedNode(getStats().mostConnected.concept)}
                        >
                          View Details
                        </button>
                      </div>
                    ) : (
                      <p>No connections yet</p>
                    )}
                  </div>

                  <div className="analytics-card">
                    <h4>Content Overview</h4>
                    <div className="content-stats">
                      <div className="content-stat-item">
                        <FileText size={24} />
                        <div>
                          <span className="content-number">{concepts.reduce((sum, c) => sum + c.notes_count, 0)}</span>
                          <span className="content-label">Total Notes</span>
                        </div>
                      </div>
                      <div className="content-stat-item">
                        <Brain size={24} />
                        <div>
                          <span className="content-number">{concepts.reduce((sum, c) => sum + c.quizzes_count, 0)}</span>
                          <span className="content-label">Total Quizzes</span>
                        </div>
                      </div>
                      <div className="content-stat-item">
                        <BookOpen size={24} />
                        <div>
                          <span className="content-number">{concepts.reduce((sum, c) => sum + c.flashcards_count, 0)}</span>
                          <span className="content-label">Total Flashcards</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

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

            {/* Bulk Actions Bar */}
            {selectedConcepts.size > 0 && (
              <div className="bulk-actions-bar">
                <div className="bulk-info">
                  <CheckSquare size={18} />
                  <span>{selectedConcepts.size} concept{selectedConcepts.size !== 1 ? 's' : ''} selected</span>
                </div>
                <div className="bulk-actions">
                  <button className="bulk-btn" onClick={deselectAll}>
                    Deselect All
                  </button>
                  <button className="bulk-btn danger" onClick={deleteSelected}>
                    <Trash2 size={16} />
                    Delete Selected
                  </button>
                </div>
              </div>
            )}

            {/* Selection Controls */}
            {getFilteredAndSortedConcepts().length > 0 && (
              <div className="selection-controls">
                <button className="select-btn" onClick={selectAll}>
                  <CheckSquare size={14} />
                  Select All
                </button>
                {selectedConcepts.size > 0 && (
                  <button className="select-btn" onClick={deselectAll}>
                    <Square size={14} />
                    Deselect All
                  </button>
                )}
              </div>
            )}

            {/* Concepts Display - Grid or Network */}
            {viewMode === 'grid' ? (
            <div className="concepts-grid">
              {getFilteredAndSortedConcepts().map(concept => {
                const connectedConcepts = getConnectedConcepts(concept.id);
                const totalContent = concept.notes_count + concept.quizzes_count + concept.flashcards_count;
                
                const isSelected = selectedConcepts.has(concept.id);
                const isHighlighted = highlightConnections && 
                  (highlightConnections === concept.id || 
                   getConnectedConcepts(highlightConnections).some(c => 
                     c.source_id === concept.id || c.target_id === concept.id
                   ));

                return (
                  <div 
                    key={concept.id}
                    className={`concept-card ${isSelected ? 'selected' : ''} ${isHighlighted ? 'highlighted' : ''}`}
                    onClick={(e) => {
                      if (e.shiftKey) {
                        toggleConceptSelection(concept.id);
                      } else {
                        setSelectedNode(concept);
                      }
                    }}
                    onMouseEnter={() => setHighlightConnections(concept.id)}
                    onMouseLeave={() => setHighlightConnections(null)}
                    style={{ borderLeftColor: getMasteryColor(concept.mastery_level) }}
                  >
                    <div className="selection-checkbox" onClick={(e) => {
                      e.stopPropagation();
                      toggleConceptSelection(concept.id);
                    }}>
                      {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                    </div>
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
            ) : (
              <div className="network-view">
                <svg className="network-svg" width="100%" height="600" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
                  {/* Draw connections */}
                  {connections.map((conn, idx) => {
                    const source = concepts.find(c => c.id === conn.source_id);
                    const target = concepts.find(c => c.id === conn.target_id);
                    if (!source || !target) return null;

                    const sourceIndex = concepts.indexOf(source);
                    const targetIndex = concepts.indexOf(target);
                    
                    const centerX = 50;
                    const centerY = 50;
                    const radius = 35;
                    const angleStep = (2 * Math.PI) / concepts.length;
                    
                    const sourceAngle = sourceIndex * angleStep - Math.PI / 2;
                    const targetAngle = targetIndex * angleStep - Math.PI / 2;
                    
                    const x1 = centerX + radius * Math.cos(sourceAngle);
                    const y1 = centerY + radius * Math.sin(sourceAngle);
                    const x2 = centerX + radius * Math.cos(targetAngle);
                    const y2 = centerY + radius * Math.sin(targetAngle);

                    const isHighlighted = highlightConnections && 
                      (highlightConnections === source.id || highlightConnections === target.id);

                    return (
                      <line
                        key={`conn-${idx}`}
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke={isHighlighted ? getConnectionColor(conn.connection_type) : 'var(--border)'}
                        strokeWidth={isHighlighted ? 0.3 : 0.15}
                        strokeOpacity={isHighlighted ? 0.8 : 0.3}
                        className="connection-line"
                      />
                    );
                  })}

                  {/* Draw nodes */}
                  {getFilteredAndSortedConcepts().map((concept, index) => {
                    const centerX = 50;
                    const centerY = 50;
                    const radius = 35;
                    const angleStep = (2 * Math.PI) / concepts.length;
                    const angle = index * angleStep - Math.PI / 2;
                    
                    const x = centerX + radius * Math.cos(angle);
                    const y = centerY + radius * Math.sin(angle);

                    const isSelected = selectedConcepts.has(concept.id);
                    const isHighlighted = highlightConnections === concept.id;
                    const connectedConcepts = getConnectedConcepts(concept.id);

                    return (
                      <g 
                        key={concept.id}
                        className={`network-node ${isSelected ? 'selected' : ''} ${isHighlighted ? 'highlighted' : ''}`}
                        onMouseEnter={() => setHighlightConnections(concept.id)}
                        onMouseLeave={() => setHighlightConnections(null)}
                        onClick={(e) => {
                          if (e.shiftKey) {
                            toggleConceptSelection(concept.id);
                          } else {
                            setSelectedNode(concept);
                          }
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        <circle
                          cx={x}
                          cy={y}
                          r={isHighlighted ? 2.5 : 2}
                          fill={getMasteryColor(concept.mastery_level)}
                          stroke={isSelected ? 'var(--accent)' : 'var(--border)'}
                          strokeWidth={isSelected ? 0.3 : 0.15}
                          className="node-circle"
                        />
                        <text
                          x={x}
                          y={y - 3}
                          textAnchor="middle"
                          fill="var(--text-primary)"
                          fontSize="1.8"
                          fontWeight="700"
                          className="node-label"
                        >
                          {concept.concept_name.length > 12 
                            ? concept.concept_name.substring(0, 12) + '...' 
                            : concept.concept_name}
                        </text>
                        <text
                          x={x}
                          y={y + 4}
                          textAnchor="middle"
                          fill="var(--text-secondary)"
                          fontSize="1.2"
                          fontWeight="600"
                          className="node-sublabel"
                        >
                          {Math.round(concept.mastery_level * 100)}% • {connectedConcepts.length}
                        </text>
                      </g>
                    );
                  })}
                </svg>

                <div className="network-legend">
                  <h4>Mastery Levels</h4>
                  <div className="legend-items">
                    <div className="legend-item">
                      <div className="legend-color" style={{ background: '#EF4444' }}></div>
                      <span>Beginner (&lt;30%)</span>
                    </div>
                    <div className="legend-item">
                      <div className="legend-color" style={{ background: '#F59E0B' }}></div>
                      <span>Intermediate (30-70%)</span>
                    </div>
                    <div className="legend-item">
                      <div className="legend-color" style={{ background: '#10B981' }}></div>
                      <span>Advanced (&gt;70%)</span>
                    </div>
                  </div>
                  <p className="network-hint">Hover over nodes to highlight connections • Shift+Click to select</p>
                </div>
              </div>
            )}

            {getFilteredAndSortedConcepts().length === 0 && (
              <div className="no-results">
                <Search size={48} style={{ opacity: 0.3 }} />
                <p>No concepts match your search</p>
              </div>
            )}
          </>
        )}
      </div>

      {!selectedNode && concepts.length > 0 && (
        <div className="floating-hint">
          <Eye size={16} />
          <span>Click any concept to view details</span>
        </div>
      )}

      {selectedNode && (
        <div className={`node-details-panel ${isPanelCollapsed ? 'collapsed' : ''}`}>
          <div className="panel-header">
            {!isPanelCollapsed && <h3>{selectedNode.concept_name}</h3>}
            <div className="panel-header-actions">
              <button 
                className="toggle-btn" 
                onClick={() => setIsPanelCollapsed(!isPanelCollapsed)}
                title={isPanelCollapsed ? "Show Details" : "Hide Details"}
              >
                {isPanelCollapsed ? <Eye size={18} /> : <EyeOff size={18} />}
              </button>
              <button 
                className="close-btn" 
                onClick={() => {
                  setSelectedNode(null);
                  setIsPanelCollapsed(false);
                }}
                title="Close Panel"
              >
                ×
              </button>
            </div>
          </div>
          {!isPanelCollapsed && (
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
                <div 
                  className={`count-item clickable ${generatingContent === 'notes' ? 'generating' : ''}`}
                  onClick={() => generateConceptContent('notes')}
                  title="AI Generate study notes for this concept"
                >
                  <FileText size={18} />
                  <div>
                    <strong>{selectedNode.notes_count}</strong>
                    <span>Notes</span>
                  </div>
                  {generatingContent === 'notes' ? (
                    <Loader size={14} className="spinner" />
                  ) : (
                    <Sparkles size={14} className="add-icon" />
                  )}
                </div>
                <div 
                  className={`count-item clickable ${generatingContent === 'quiz' ? 'generating' : ''}`}
                  onClick={() => generateConceptContent('quiz')}
                  title="AI Generate practice quiz for this concept"
                >
                  <Brain size={18} />
                  <div>
                    <strong>{selectedNode.quizzes_count}</strong>
                    <span>Quizzes</span>
                  </div>
                  {generatingContent === 'quiz' ? (
                    <Loader size={14} className="spinner" />
                  ) : (
                    <Sparkles size={14} className="add-icon" />
                  )}
                </div>
                <div 
                  className={`count-item clickable ${generatingContent === 'flashcards' ? 'generating' : ''}`}
                  onClick={() => generateConceptContent('flashcards')}
                  title="AI Generate flashcards for this concept"
                >
                  <BookOpen size={18} />
                  <div>
                    <strong>{selectedNode.flashcards_count}</strong>
                    <span>Flashcards</span>
                  </div>
                  {generatingContent === 'flashcards' ? (
                    <Loader size={14} className="spinner" />
                  ) : (
                    <Sparkles size={14} className="add-icon" />
                  )}
                </div>
              </div>
              <div className="mastery-tip">
                <Sparkles size={14} />
                <span>Click above to AI-generate content and boost mastery by 10%</span>
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
          )}
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

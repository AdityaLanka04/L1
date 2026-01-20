// ConceptWeb.js - Comprehensive Knowledge Management System
// Part 1: Imports and Initial Setup
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Sparkles, Plus, Trash2, Loader, BookOpen, FileText, Brain, Search, 
  TrendingUp, Download, Grid, Network, BarChart3, RefreshCw, Zap, 
  Target, Move, Info, ChevronRight, Lightbulb, Award, Clock, Calendar, 
  Share2, ExternalLink, Youtube, Code, Book, Newspaper, GraduationCap, 
  Compass, Map, Route, GitBranch, Star, Bookmark, Play, CheckCircle, 
  AlertCircle, Activity, Users, MessageCircle, Send, Copy, Check, X, 
  Settings, MoreVertical, Edit, Save, RotateCw, Layers, Shuffle, 
  AlignLeft, List, Maximize, ZoomIn, ZoomOut, Minimize, ChevronDown, 
  ChevronUp, ChevronLeft, ArrowRight, ArrowUp, ArrowDown, Flag, Tag, 
  Hash, Percent, BarChart2, Filter, Eye, EyeOff, Square, CheckSquare,
  Maximize2, Minimize2, Link as LinkIcon, TrendingDown, ArrowLeft, Circle
} from 'lucide-react';
import './ConceptWeb.css';
import { API_URL } from '../config';

const ConceptWeb = () => {
  const navigate = useNavigate();
  const svgRef = useRef(null);
  const containerRef = useRef(null);

  // ==================== STATE MANAGEMENT ====================
  
  // User & Authentication
  const [userName, setUserName] = useState('');
  
  // Core Data
  const [concepts, setConcepts] = useState([]);
  const [connections, setConnections] = useState([]);
  const [learningPaths, setLearningPaths] = useState([]);
  const [resources, setResources] = useState({});
  const [studyRecommendations, setStudyRecommendations] = useState([]);
  
  // UI State
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [viewMode, setViewMode] = useState('network');
  const [selectedNode, setSelectedNode] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  
  // Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [showResourceModal, setShowResourceModal] = useState(false);
  const [showPathModal, setShowPathModal] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showRecommendations, setShowRecommendations] = useState(false);
  
  // Form States
  const [newConcept, setNewConcept] = useState({ name: '', description: '', category: '' });
  const [selectedConcepts, setSelectedConcepts] = useState(new Set());
  
  // Network Visualization States
  const [nodePositions, setNodePositions] = useState({});
  const [draggingNode, setDraggingNode] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  
  // Advanced Features States
  const [generatingContent, setGeneratingContent] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fadeIn, setFadeIn] = useState(false);
  const [highlightConnections, setHighlightConnections] = useState(null);
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  
  // Learning Path States
  const [selectedPath, setSelectedPath] = useState(null);
  const [pathProgress, setPathProgress] = useState({});
  const [suggestedNextTopics, setSuggestedNextTopics] = useState([]);
  
  // Resource States
  const [loadingResources, setLoadingResources] = useState(false);
  const [resourceFilter, setResourceFilter] = useState('all');
  
  // Analytics States
  const [analyticsData, setAnalyticsData] = useState(null);
  const [timeRange, setTimeRange] = useState('week');
  const [showInsights, setShowInsights] = useState(false);

  // ==================== INITIALIZATION ====================
  
  useEffect(() => {
    const token = localStorage.getItem('token');
    const username = localStorage.getItem('username');
    
    if (!token) {
      navigate('/login');
      return;
    }
    
    if (username) {
      setUserName(username);
      initializeConceptWeb(username);
    }
  }, [navigate]);


  // ==================== CORE FUNCTIONS ====================
  
  const initializeConceptWeb = async (username) => {
    try {
      setLoading(true);
      await Promise.all([
        loadConceptWeb(username),
        loadLearningPaths(username),
        loadStudyRecommendations(username),
        loadAnalytics(username)
      ]);
    } catch (error) {
      console.error('Failed to initialize concept web:', error);
    } finally {
      setLoading(false);
      setInitialLoad(false);
      setTimeout(() => setFadeIn(true), 100);
    }
  };

  const loadConceptWeb = async (username) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/get_concept_web?user_id=${username}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.nodes && data.nodes.length > 0) {
          setConcepts(data.nodes);
          setConnections(data.connections || []);
          setNodePositions(initializeNodePositions(data.nodes));
        } else {
          await autoGenerateConceptWeb(username);
        }
      }
    } catch (error) {
      console.error('Failed to load concept web:', error);
    }
  };

  const loadLearningPaths = async (username) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/get_learning_paths?user_id=${username}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setLearningPaths(data.paths || []);
        setPathProgress(data.progress || {});
        setSuggestedNextTopics(data.suggested_next || []);
      }
    } catch (error) {
      console.error('Failed to load learning paths:', error);
    }
  };


  const loadStudyRecommendations = async (username) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/get_study_recommendations?user_id=${username}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setStudyRecommendations(data.recommendations || []);
      }
    } catch (error) {
      console.error('Failed to load study recommendations:', error);
    }
  };

  const loadAnalytics = async (username) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/get_concept_analytics?user_id=${username}&range=${timeRange}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setAnalyticsData(data);
      }
    } catch (error) {
      console.error('Failed to load analytics:', error);
    }
  };

  const loadResourcesForConcept = async (conceptId) => {
    if (resources[conceptId]) return;
    
    try {
      setLoadingResources(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/get_concept_resources?concept_id=${conceptId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setResources(prev => ({
          ...prev,
          [conceptId]: data.resources || []
        }));
      }
    } catch (error) {
      console.error('Failed to load resources:', error);
    } finally {
      setLoadingResources(false);
    }
  };

  const autoGenerateConceptWeb = async (username) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/generate_concept_web`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ user_id: username })
      });
      
      if (response.ok) {
        await loadConceptWeb(username);
      }
    } catch (error) {
      console.error('Failed to auto-generate concept web:', error);
    }
  };


  // ==================== NODE POSITIONING & VISUALIZATION ====================
  
  const initializeNodePositions = useCallback((conceptsList) => {
    const positions = {};
    const centerX = 50;
    const centerY = 50;
    const radius = 35;
    const angleStep = (2 * Math.PI) / conceptsList.length;
    
    conceptsList.forEach((concept, index) => {
      const angle = index * angleStep - Math.PI / 2;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      
      positions[concept.id] = {
        x,
        y,
        vx: (Math.random() - 0.5) * 0.1,
        vy: (Math.random() - 0.5) * 0.1
      };
    });
    
    return positions;
  }, []);

  const getCategoryColor = (category) => {
    const categoryLower = category.toLowerCase();
    
    const colorGroups = {
      'algorithms': '#3B82F6',
      'sorting algorithms': '#3B82F6',
      'searching algorithms': '#2563EB',
      'graph algorithms': '#1D4ED8',
      'data structures': '#60A5FA',
      'machine learning': '#93C5FD',
      'web development': '#DBEAFE',
      'computer science': '#3B82F6',
      'programming': '#3B82F6',
      'mathematics': '#8B5CF6',
      'calculus': '#7C3AED',
      'linear algebra': '#6D28D9',
      'discrete math': '#A78BFA',
      'statistics': '#C4B5FD',
      'probability': '#DDD6FE',
      'physics': '#06B6D4',
      'classical mechanics': '#0891B2',
      'quantum mechanics': '#0E7490',
      'thermodynamics': '#22D3EE',
      'electromagnetism': '#67E8F9',
      'chemistry': '#10B981',
      'organic chemistry': '#059669',
      'inorganic chemistry': '#047857',
      'biochemistry': '#34D399',
      'biology': '#22C55E',
      'molecular biology': '#16A34A',
      'genetics': '#15803D',
      'history': '#F59E0B',
      'literature': '#EC4899',
      'philosophy': '#6366F1',
      'general': '#D7B38C'
    };
    
    for (const [key, color] of Object.entries(colorGroups)) {
      if (categoryLower === key || categoryLower.includes(key) || key.includes(categoryLower)) {
        return color;
      }
    }
    
    const vibrantPalette = [
      '#3B82F6', '#8B5CF6', '#06B6D4', '#10B981', '#22C55E',
      '#F59E0B', '#EC4899', '#6366F1', '#EF4444', '#14B8A6'
    ];
    
    let hash = 0;
    for (let i = 0; i < category.length; i++) {
      hash = category.charCodeAt(i) + ((hash << 5) - hash);
    }
    return vibrantPalette[Math.abs(hash) % vibrantPalette.length];
  };


  const getConnectionColor = (type, strength = 0.5) => {
    const baseColors = {
      prerequisite: { r: 251, g: 146, b: 60 },
      related: { r: 234, g: 179, b: 8 },
      opposite: { r: 239, g: 68, b: 68 },
      example_of: { r: 34, g: 197, b: 94 },
      part_of: { r: 59, g: 130, b: 246 },
      similar: { r: 168, g: 85, b: 247 }
    };
    
    const color = baseColors[type] || baseColors.related;
    const alpha = 0.4 + (strength * 0.5);
    
    return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
  };
  
  const getConnectionWidth = (strength = 0.5) => {
    return 1 + (strength * 2);
  };

  const getMasteryColor = (level) => {
    if (level < 0.3) return '#EF4444';
    if (level < 0.7) return '#F59E0B';
    return '#10B981';
  };

  const getConnectedConcepts = (conceptId) => {
    return connections.filter(conn => 
      conn.source_id === conceptId || conn.target_id === conceptId
    );
  };

  // ==================== DRAG & PAN HANDLERS ====================
  
  const handleMouseDown = (e, conceptId) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    
    const svg = svgRef.current;
    if (!svg) return;
    
    const rect = svg.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * 100;
    const svgY = ((e.clientY - rect.top) / rect.height) * 100;
    
    const pos = nodePositions[conceptId];
    if (pos) {
      setDraggingNode(conceptId);
      setDragOffset({
        x: svgX - pos.x,
        y: svgY - pos.y
      });
    }
  };

  const handleMouseMove = useCallback((e) => {
    if (!draggingNode || !svgRef.current) return;
    
    const svg = svgRef.current;
    const rect = svg.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * 100;
    const svgY = ((e.clientY - rect.top) / rect.height) * 100;
    
    setNodePositions(prev => ({
      ...prev,
      [draggingNode]: {
        ...prev[draggingNode],
        x: Math.max(5, Math.min(95, svgX - dragOffset.x)),
        y: Math.max(5, Math.min(95, svgY - dragOffset.y))
      }
    }));
  }, [draggingNode, dragOffset]);

  const handleMouseUp = useCallback(() => {
    setDraggingNode(null);
  }, []);

  useEffect(() => {
    if (draggingNode) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [draggingNode, handleMouseMove, handleMouseUp]);


  const handlePanStart = useCallback((e) => {
    if (e.button !== 0) return;
    setIsPanning(true);
    setPanStart({ x: e.clientX, y: e.clientY });
  }, []);

  const handlePanMove = useCallback((e) => {
    if (!isPanning) return;
    
    const dx = (e.clientX - panStart.x) * 0.1 / zoomLevel;
    const dy = (e.clientY - panStart.y) * 0.1 / zoomLevel;
    
    setPanOffset(prev => ({
      x: prev.x - dx,
      y: prev.y - dy
    }));
    
    setPanStart({ x: e.clientX, y: e.clientY });
  }, [isPanning, panStart, zoomLevel]);

  const handlePanEnd = useCallback(() => {
    setIsPanning(false);
  }, []);

  useEffect(() => {
    if (isPanning) {
      window.addEventListener('mousemove', handlePanMove);
      window.addEventListener('mouseup', handlePanEnd);
      return () => {
        window.removeEventListener('mousemove', handlePanMove);
        window.removeEventListener('mouseup', handlePanEnd);
      };
    }
  }, [isPanning, handlePanMove, handlePanEnd]);

  useEffect(() => {
    const handleWheel = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        
        const svg = svgRef.current;
        if (!svg) return;
        
        const rect = svg.getBoundingClientRect();
        const mouseX = ((e.clientX - rect.left) / rect.width) * 100;
        const mouseY = ((e.clientY - rect.top) / rect.height) * 100;
        
        const delta = e.deltaY * -0.001;
        const newZoom = Math.max(0.3, Math.min(5, zoomLevel * (1 + delta)));
        
        const zoomRatio = newZoom / zoomLevel;
        setPanOffset(prev => ({
          x: mouseX - (mouseX - prev.x) * zoomRatio,
          y: mouseY - (mouseY - prev.y) * zoomRatio
        }));
        
        setZoomLevel(newZoom);
      } else if (!e.shiftKey) {
        e.preventDefault();
        const sensitivity = 0.5;
        setPanOffset(prev => ({
          x: prev.x + e.deltaX * sensitivity / zoomLevel,
          y: prev.y + e.deltaY * sensitivity / zoomLevel
        }));
      }
    };

    const svg = svgRef.current;
    if (svg) {
      svg.addEventListener('wheel', handleWheel, { passive: false });
      return () => svg.removeEventListener('wheel', handleWheel);
    }
  }, [zoomLevel]);

  // ==================== CRUD OPERATIONS ====================
  
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
      console.error('Failed to add concept:', error);
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
      console.error('Failed to delete concept:', error);
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
      console.error('Failed to generate concept web:', error);
    } finally {
      setGenerating(false);
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
        alert(`Generated ${contentNames[contentType]}! Mastery increased to ${Math.round(data.new_mastery * 100)}%`);
        
        await loadConceptWeb(userName);
        
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
      console.error('Failed to generate content:', error);
      alert('Failed to generate content');
    } finally {
      setGeneratingContent(null);
    }
  };


  // ==================== FILTERING & SORTING ====================
  
  const getCategories = () => {
    const categories = new Set(concepts.map(c => c.category));
    return ['all', ...Array.from(categories)];
  };

  const getFilteredAndSortedConcepts = () => {
    let filtered = concepts;

    if (searchQuery) {
      filtered = filtered.filter(c => 
        c.concept_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.category.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (filterCategory !== 'all') {
      filtered = filtered.filter(c => c.category === filterCategory);
    }

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

  // ==================== STATISTICS & ANALYTICS ====================
  
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


  // ==================== LEARNING PATH FUNCTIONS ====================
  
  const generateLearningPath = async (conceptId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/generate_learning_path`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          user_id: userName,
          concept_id: conceptId
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setLearningPaths(prev => [...prev, data.path]);
        alert('Learning path generated successfully!');
      }
    } catch (error) {
      console.error('Failed to generate learning path:', error);
    }
  };

  const markPathStepComplete = async (pathId, stepIndex) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/mark_path_step_complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          user_id: userName,
          path_id: pathId,
          step_index: stepIndex
        })
      });
      
      if (response.ok) {
        await loadLearningPaths(userName);
      }
    } catch (error) {
      console.error('Failed to mark step complete:', error);
    }
  };

  // ==================== RESOURCE FUNCTIONS ====================
  
  const generateResourceRecommendations = async (conceptId) => {
    try {
      setLoadingResources(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/generate_resource_recommendations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          user_id: userName,
          concept_id: conceptId
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setResources(prev => ({
          ...prev,
          [conceptId]: data.resources
        }));
      }
    } catch (error) {
      console.error('Failed to generate resources:', error);
    } finally {
      setLoadingResources(false);
    }
  };

  const openResource = (url) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // ==================== UTILITY FUNCTIONS ====================
  
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

  const resetPositions = () => {
    setNodePositions(initializeNodePositions(concepts));
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };


  // ==================== RENDER FUNCTIONS ====================
  
  const Icons = {
    network: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="5" r="3"/><circle cx="5" cy="19" r="3"/><circle cx="19" cy="19" r="3"/><line x1="12" y1="8" x2="5" y2="16"/><line x1="12" y1="8" x2="19" y2="16"/></svg>,
    grid: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
    chart: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>,
    paths: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
    resources: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>,
    chat: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  };

  // ==================== MAIN RENDER ====================
  
  return (
    <div className={`concept-web-page ${isFullscreen ? 'fullscreen' : ''}`}>
      {/* Header */}
      <header className="cw-header">
        <div className="cw-header-left">
          <h1 className="cw-logo" onClick={() => navigate('/dashboard')}>
            <div className="cw-logo-img" />
            cerbyl
          </h1>
          <div className="cw-header-divider"></div>
          <span className="cw-subtitle">CONCEPT WEB</span>
        </div>
        <nav className="cw-header-right">
          {concepts.length > 0 && (
            <div className="cw-stats-bar">
              <div className="cw-stat-mini">
                <span className="cw-stat-value">{getStats().totalConcepts}</span>
                <span className="cw-stat-label">Concepts</span>
              </div>
              <div className="cw-stat-mini">
                <span className="cw-stat-value">{getStats().totalConnections}</span>
                <span className="cw-stat-label">Links</span>
              </div>
              <div className="cw-stat-mini">
                <span className="cw-stat-value">{getStats().avgMastery}%</span>
                <span className="cw-stat-label">Mastery</span>
              </div>
            </div>
          )}
          <button className="cw-nav-btn cw-nav-btn-ghost" onClick={() => navigate('/dashboard')}>
            <span>Dashboard</span>
            <ChevronRight size={14} />
          </button>
        </nav>
      </header>

      <div className="cw-layout">
        {/* Sidebar */}
        <aside className={`cw-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
          <nav className="cw-sidebar-nav">
            <button className={`cw-nav-item ${viewMode === 'network' ? 'active' : ''}`} onClick={() => setViewMode('network')}>
              <span className="cw-nav-icon">{Icons.network}</span>
              <span className="cw-nav-text">Network View</span>
            </button>
            <button className={`cw-nav-item ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => setViewMode('grid')}>
              <span className="cw-nav-icon">{Icons.grid}</span>
              <span className="cw-nav-text">Grid View</span>
            </button>
            <button className={`cw-nav-item ${viewMode === 'paths' ? 'active' : ''}`} onClick={() => setViewMode('paths')}>
              <span className="cw-nav-icon">{Icons.paths}</span>
              <span className="cw-nav-text">Learning Paths</span>
            </button>
            <button className={`cw-nav-item ${viewMode === 'resources' ? 'active' : ''}`} onClick={() => setViewMode('resources')}>
              <span className="cw-nav-icon">{Icons.resources}</span>
              <span className="cw-nav-text">Resources</span>
            </button>
            <button className={`cw-nav-item ${showAnalytics ? 'active' : ''}`} onClick={() => setShowAnalytics(!showAnalytics)}>
              <span className="cw-nav-icon">{Icons.chart}</span>
              <span className="cw-nav-text">Analytics</span>
            </button>
          </nav>

          <div className="cw-sidebar-footer">
            <button className="cw-nav-item cw-nav-item-accent" onClick={() => navigate('/ai-chat')}>
              <span className="cw-nav-icon">{Icons.chat}</span>
              <span className="cw-nav-text">AI Chat</span>
            </button>
            <button className="cw-nav-item" onClick={() => setShowAddModal(true)}>
              <span className="cw-nav-icon"><Plus size={20} /></span>
              <span className="cw-nav-text">Add Concept</span>
            </button>
            <button className="cw-nav-item" onClick={generateConceptWeb} disabled={generating}>
              <span className="cw-nav-icon">{generating ? <Loader size={20} className="cw-spinner" /> : <Sparkles size={20} />}</span>
              <span className="cw-nav-text">Generate Web</span>
            </button>
          </div>
        </aside>

        {/* Show Sidebar Button */}
        {sidebarCollapsed && (
          <button className="cw-show-sidebar-btn" onClick={() => setSidebarCollapsed(false)} title="Show Sidebar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
              <line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
        )}

        {/* Main Content */}
        <main className="cw-main">
          <div className="cw-content" ref={containerRef}>
            {loading && initialLoad ? (
              <div className="cw-loading">
                <Loader size={32} className="cw-spinner" />
                <p className="cw-loading-text">Loading your knowledge universe...</p>
              </div>
            ) : concepts.length === 0 ? (
              <div className="cw-empty">
                <div className="cw-empty-icon">
                  <Brain size={48} />
                </div>
                <h3 className="cw-empty-title">No Concepts Yet</h3>
                <p className="cw-empty-text">Start building your knowledge web by adding concepts or generating from your content</p>
                <div className="cw-empty-actions">
                  <button className="cw-btn cw-btn-primary" onClick={() => setShowAddModal(true)}>
                    <Plus size={18} />
                    Add Concept
                  </button>
                  <button className="cw-btn cw-btn-secondary" onClick={generateConceptWeb} disabled={generating}>
                    <Sparkles size={18} />
                    Generate from Content
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Analytics Panel */}
                {showAnalytics && (
                  <div className="cw-analytics-panel">
                    <div className="cw-analytics-header">
                      <h3 className="cw-analytics-title">Analytics</h3>
                      <button className="cw-detail-close" onClick={() => setShowAnalytics(false)}>×</button>
                    </div>
                    <div className="cw-analytics-content">
                      <div className="cw-analytics-grid">
                        <div className="cw-analytics-card">
                          <span className="cw-analytics-value">{getStats().totalConcepts}</span>
                          <span className="cw-analytics-label">Concepts</span>
                        </div>
                        <div className="cw-analytics-card">
                          <span className="cw-analytics-value">{getStats().totalConnections}</span>
                          <span className="cw-analytics-label">Links</span>
                        </div>
                        <div className="cw-analytics-card">
                          <span className="cw-analytics-value">{getStats().avgMastery}%</span>
                          <span className="cw-analytics-label">Avg Mastery</span>
                        </div>
                        <div className="cw-analytics-card">
                          <span className="cw-analytics-value">{getStats().categories}</span>
                          <span className="cw-analytics-label">Categories</span>
                        </div>
                      </div>
                      <div className="cw-mastery-distribution">
                        <div className="cw-mastery-item">
                          <span className="cw-mastery-label">Beginner</span>
                          <div className="cw-mastery-bar-container">
                            <div className="cw-mastery-bar-fill beginner" style={{ width: `${(getStats().masteryDistribution.beginner / concepts.length) * 100}%` }}></div>
                          </div>
                          <span className="cw-mastery-count">{getStats().masteryDistribution.beginner}</span>
                        </div>
                        <div className="cw-mastery-item">
                          <span className="cw-mastery-label">Intermediate</span>
                          <div className="cw-mastery-bar-container">
                            <div className="cw-mastery-bar-fill intermediate" style={{ width: `${(getStats().masteryDistribution.intermediate / concepts.length) * 100}%` }}></div>
                          </div>
                          <span className="cw-mastery-count">{getStats().masteryDistribution.intermediate}</span>
                        </div>
                        <div className="cw-mastery-item">
                          <span className="cw-mastery-label">Advanced</span>
                          <div className="cw-mastery-bar-container">
                            <div className="cw-mastery-bar-fill advanced" style={{ width: `${(getStats().masteryDistribution.advanced / concepts.length) * 100}%` }}></div>
                          </div>
                          <span className="cw-mastery-count">{getStats().masteryDistribution.advanced}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}


                {/* View Mode: Network */}
                {viewMode === 'network' && (
                  <div className="cw-network-container">
                    <svg 
                      ref={svgRef}
                      className="cw-network-svg" 
                      viewBox={`${50 - (50 / zoomLevel) + panOffset.x} ${50 - (50 / zoomLevel) + panOffset.y} ${100 / zoomLevel} ${100 / zoomLevel}`}
                      preserveAspectRatio="xMidYMid meet"
                      onMouseDown={handlePanStart}
                      style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
                    >
                      <defs>
                        {Array.from(new Set(concepts.map(c => c.category))).map(category => (
                          <radialGradient key={category} id={`nodeGlow-${category.replace(/\s+/g, '-')}`} cx="50%" cy="50%" r="50%">
                            <stop offset="0%" stopColor={getCategoryColor(category)} stopOpacity="0.4" />
                            <stop offset="100%" stopColor={getCategoryColor(category)} stopOpacity="0" />
                          </radialGradient>
                        ))}
                        <filter id="glow">
                          <feGaussianBlur stdDeviation="0.5" result="coloredBlur"/>
                          <feMerge>
                            <feMergeNode in="coloredBlur"/>
                            <feMergeNode in="SourceGraphic"/>
                          </feMerge>
                        </filter>
                      </defs>

                      {/* Draw connections */}
                      <g className="connections-layer">
                        {connections.map((conn, idx) => {
                          const source = concepts.find(c => c.id === conn.source_id);
                          const target = concepts.find(c => c.id === conn.target_id);
                          if (!source || !target || !nodePositions[source.id] || !nodePositions[target.id]) return null;

                          const sourcePos = nodePositions[source.id];
                          const targetPos = nodePositions[target.id];

                          const isHighlighted = hoveredNode && 
                            (hoveredNode === source.id || hoveredNode === target.id);
                          
                          const isSelected = selectedNode && 
                            (selectedNode.id === source.id || selectedNode.id === target.id);
                          
                          const strength = conn.strength || 0.5;
                          const connectionColor = getConnectionColor(conn.connection_type, strength);
                          const strokeWidth = getConnectionWidth(strength);

                          return (
                            <g key={`conn-${idx}`}>
                              {(isHighlighted || isSelected) && (
                                <line
                                  x1={sourcePos.x}
                                  y1={sourcePos.y}
                                  x2={targetPos.x}
                                  y2={targetPos.y}
                                  stroke={connectionColor}
                                  strokeWidth={strokeWidth * 0.3}
                                  strokeOpacity={0.3}
                                  className="connection-glow"
                                  style={{ filter: 'blur(3px)' }}
                                />
                              )}
                              
                              <line
                                x1={sourcePos.x}
                                y1={sourcePos.y}
                                x2={targetPos.x}
                                y2={targetPos.y}
                                stroke={isHighlighted || isSelected ? connectionColor : connectionColor}
                                strokeWidth={isHighlighted || isSelected ? strokeWidth * 0.15 : strokeWidth * 0.1}
                                strokeOpacity={isHighlighted || isSelected ? 0.95 : 0.6}
                                className="connection-line-ethereal"
                                strokeDasharray={conn.connection_type === 'prerequisite' ? '0.4,0.4' : 'none'}
                                style={{ transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}
                              />
                              
                              {strength > 0.7 && (isHighlighted || isSelected) && (
                                <line
                                  x1={sourcePos.x}
                                  y1={sourcePos.y}
                                  x2={targetPos.x}
                                  y2={targetPos.y}
                                  stroke={connectionColor}
                                  strokeWidth={0.05}
                                  strokeOpacity={0.4}
                                  strokeDasharray="0.2,0.2"
                                />
                              )}
                            </g>
                          );
                        })}
                      </g>

                      {/* Draw nodes */}
                      <g className="nodes-layer">
                        {concepts.map((concept) => {
                          if (!nodePositions[concept.id]) return null;
                          
                          const pos = nodePositions[concept.id];
                          const isSelected = selectedNode?.id === concept.id;
                          const isHovered = hoveredNode === concept.id;
                          const connectedConcepts = getConnectedConcepts(concept.id);
                          const nodeSize = isHovered ? 1.8 : isSelected ? 1.65 : 1.5;

                          return (
                            <g 
                              key={concept.id}
                              className={`network-node-ethereal ${isSelected ? 'selected' : ''} ${isHovered ? 'hovered' : ''}`}
                              onMouseEnter={() => setHoveredNode(concept.id)}
                              onMouseLeave={() => setHoveredNode(null)}
                              onClick={() => setSelectedNode(concept)}
                              onMouseDown={(e) => handleMouseDown(e, concept.id)}
                              style={{ cursor: draggingNode === concept.id ? 'grabbing' : 'grab' }}
                            >
                              {(isHovered || isSelected) && (
                                <circle
                                  cx={pos.x}
                                  cy={pos.y}
                                  r={nodeSize * 2.5}
                                  fill={`url(#nodeGlow-${concept.category.replace(/\s+/g, '-')})`}
                                  className="node-glow"
                                />
                              )}
                              
                              <circle
                                cx={pos.x}
                                cy={pos.y}
                                r={nodeSize}
                                fill={getCategoryColor(concept.category)}
                                stroke={isSelected ? getCategoryColor(concept.category) : '#4A4A4A'}
                                strokeWidth={isSelected ? 0.3 : 0.15}
                                className="node-circle-ethereal"
                                filter={isHovered || isSelected ? 'url(#glow)' : ''}
                                style={{ opacity: concept.mastery_level < 0.3 ? 0.6 : concept.mastery_level < 0.7 ? 0.8 : 1 }}
                              />
                              
                              <text
                                x={pos.x}
                                y={pos.y - nodeSize - 0.8}
                                textAnchor="middle"
                                fill="var(--text-primary)"
                                fontSize="1.1"
                                fontWeight="700"
                                className="node-label-ethereal"
                                style={{ pointerEvents: 'none' }}
                              >
                                {concept.concept_name.length > 12 
                                  ? concept.concept_name.substring(0, 12) + '...' 
                                  : concept.concept_name}
                              </text>
                              
                              {connectedConcepts.length > 0 && (
                                <g>
                                  <circle
                                    cx={pos.x + nodeSize * 0.7}
                                    cy={pos.y - nodeSize * 0.7}
                                    r="0.65"
                                    fill="var(--accent)"
                                    stroke="var(--bg-bottom)"
                                    strokeWidth="0.12"
                                  />
                                  <text
                                    x={pos.x + nodeSize * 0.7}
                                    y={pos.y - nodeSize * 0.7 + 0.35}
                                    textAnchor="middle"
                                    fill="var(--bg-bottom)"
                                    fontSize="0.75"
                                    fontWeight="800"
                                    style={{ pointerEvents: 'none' }}
                                  >
                                    {connectedConcepts.length}
                                  </text>
                                </g>
                              )}
                            </g>
                          );
                        })}
                      </g>
                    </svg>

                    {/* Hover Tooltip */}
                    {hoveredNode && (
                      <div 
                        className="hover-tooltip-ethereal"
                        style={(() => {
                          const concept = concepts.find(c => c.id === hoveredNode);
                          if (!concept || !nodePositions[concept.id]) return {};
                          
                          const pos = nodePositions[concept.id];
                          const isLeftSide = pos.x < 50;
                          
                          if (isLeftSide) {
                            return {
                              left: '40px',
                              bottom: '80px'
                            };
                          } else {
                            return {
                              right: '40px',
                              top: '180px'
                            };
                          }
                        })()}
                      >
                        {(() => {
                          const concept = concepts.find(c => c.id === hoveredNode);
                          if (!concept) return null;
                          
                          return (
                            <>
                              <div className="tooltip-header">
                                <h4>{concept.concept_name}</h4>
                                <span className="tooltip-category">{concept.category}</span>
                              </div>
                              {concept.description && (
                                <p className="tooltip-description">{concept.description}</p>
                              )}
                              <div className="tooltip-stats">
                                <div className="tooltip-stat">
                                  <span className="tooltip-stat-label">MASTERY</span>
                                  <span className="tooltip-stat-value" style={{ color: getMasteryColor(concept.mastery_level) }}>
                                    {Math.round(concept.mastery_level * 100)}%
                                  </span>
                                </div>
                                <div className="tooltip-stat">
                                  <span className="tooltip-stat-label">CONNECTIONS</span>
                                  <span className="tooltip-stat-value">
                                    {getConnectedConcepts(concept.id).length}
                                  </span>
                                </div>
                              </div>
                              <div className="tooltip-content-grid">
                                <div className="tooltip-content-item">
                                  <FileText size={14} />
                                  <span>{concept.notes_count}</span>
                                </div>
                                <div className="tooltip-content-item">
                                  <Brain size={14} />
                                  <span>{concept.quizzes_count}</span>
                                </div>
                                <div className="tooltip-content-item">
                                  <BookOpen size={14} />
                                  <span>{concept.flashcards_count}</span>
                                </div>
                              </div>
                              <div className="tooltip-hint">
                                <Info size={12} />
                                <span>Click to view details • Drag to move</span>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    )}

                    {/* Network Controls */}
                    <div className="network-controls-ethereal">
                      <div className="control-hint">
                        <Move size={14} />
                        <span>Drag nodes to reposition</span>
                      </div>
                      
                      <div className="zoom-controls-ethereal">
                        <div className="zoom-buttons">
                          <button 
                            className="zoom-btn" 
                            onClick={() => setZoomLevel(Math.min(zoomLevel + 0.2, 5))}
                            title="Zoom In"
                          >
                            +
                          </button>
                          <span className="zoom-level">{Math.round(zoomLevel * 100)}%</span>
                          <button 
                            className="zoom-btn" 
                            onClick={() => setZoomLevel(Math.max(zoomLevel - 0.2, 0.3))}
                            title="Zoom Out"
                          >
                            −
                          </button>
                          <button 
                            className="zoom-btn" 
                            onClick={() => {
                              setZoomLevel(1);
                              setPanOffset({ x: 0, y: 0 });
                            }}
                            title="Reset View"
                          >
                            ⟲
                          </button>
                        </div>
                        <div className="zoom-hint">
                          Pinch or Ctrl+Scroll to zoom
                        </div>
                      </div>
                      
                      {concepts.length > 0 && (
                        <>
                          <div className="color-legend-ethereal">
                            <div className="legend-title">CATEGORIES</div>
                            {Array.from(new Set(concepts.map(c => c.category))).slice(0, 6).map(category => (
                              <div key={category} className="legend-item">
                                <div 
                                  className="legend-color" 
                                  style={{ backgroundColor: getCategoryColor(category) }}
                                ></div>
                                <span>{category}</span>
                              </div>
                            ))}
                          </div>
                          
                          {connections.length > 0 && (
                            <div className="color-legend-ethereal" style={{ marginTop: '12px' }}>
                              <div className="legend-title">CONNECTIONS</div>
                              <div className="legend-item">
                                <div className="legend-line" style={{ 
                                  background: getConnectionColor('prerequisite', 0.7),
                                  borderStyle: 'dashed'
                                }}></div>
                                <span>Prerequisite</span>
                              </div>
                              <div className="legend-item">
                                <div className="legend-line" style={{ 
                                  background: getConnectionColor('related', 0.7)
                                }}></div>
                                <span>Related</span>
                              </div>
                              <div className="legend-item">
                                <div className="legend-line" style={{ 
                                  background: getConnectionColor('similar', 0.7)
                                }}></div>
                                <span>Similar</span>
                              </div>
                              <div className="legend-item">
                                <div className="legend-line" style={{ 
                                  background: getConnectionColor('part_of', 0.7)
                                }}></div>
                                <span>Part Of</span>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}


                {/* View Mode: Grid */}
                {viewMode === 'grid' && (
                  <div className="cw-grid-container">
                    <div className="cw-toolbar">
                      <div className="cw-search">
                        <span className="cw-search-icon"><Search size={16} /></span>
                        <input
                          type="text"
                          placeholder="Search concepts..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />
                      </div>
                      
                      <select className="cw-select" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
                        {getCategories().map(cat => (
                          <option key={cat} value={cat}>{cat === 'all' ? 'All Categories' : cat}</option>
                        ))}
                      </select>

                      <select className="cw-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                        <option value="name">Sort by Name</option>
                        <option value="mastery">Sort by Mastery</option>
                        <option value="connections">Sort by Connections</option>
                        <option value="content">Sort by Content</option>
                      </select>
                    </div>

                    <div className="cw-grid">
                      {getFilteredAndSortedConcepts().map((concept) => {
                        const connectedConcepts = getConnectedConcepts(concept.id);
                        const isSelected = selectedNode?.id === concept.id;

                        return (
                          <div 
                            key={concept.id}
                            className={`cw-card ${isSelected ? 'selected' : ''}`}
                            onClick={() => setSelectedNode(concept)}
                          >
                            <div className="cw-card-header">
                              <div 
                                className="cw-card-icon"
                                style={{ backgroundColor: getCategoryColor(concept.category) }}
                              >
                                <Brain size={24} />
                              </div>
                              <div className="cw-card-actions">
                                <button 
                                  className="cw-card-action-btn"
                                  onClick={(e) => { 
                                    e.stopPropagation(); 
                                    loadResourcesForConcept(concept.id);
                                    setShowResourceModal(true);
                                  }}
                                  title="View Resources"
                                >
                                  <BookOpen size={14} />
                                </button>
                                <button 
                                  className="cw-card-action-btn delete"
                                  onClick={(e) => { e.stopPropagation(); deleteConcept(concept.id); }}
                                  title="Delete"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                            <div className="cw-card-content">
                              <h3 className="cw-card-title">{concept.concept_name}</h3>
                              <span className="cw-card-category">{concept.category}</span>
                              {concept.description && (
                                <p className="cw-card-description">{concept.description}</p>
                              )}
                              <div className="cw-card-stats">
                                <div className="cw-card-stat">
                                  <span className="cw-card-stat-value">{Math.round(concept.mastery_level * 100)}%</span>
                                  <span className="cw-card-stat-label">Mastery</span>
                                </div>
                                <div className="cw-card-stat">
                                  <span className="cw-card-stat-value">{connectedConcepts.length}</span>
                                  <span className="cw-card-stat-label">Links</span>
                                </div>
                                <div className="cw-card-stat">
                                  <span className="cw-card-stat-value">{concept.notes_count + concept.quizzes_count + concept.flashcards_count}</span>
                                  <span className="cw-card-stat-label">Content</span>
                                </div>
                              </div>
                            </div>
                            <div className="cw-card-footer">
                              <div className="cw-mastery-bar">
                                <div 
                                  className="cw-mastery-fill" 
                                  style={{ 
                                    width: `${concept.mastery_level * 100}%`,
                                    backgroundColor: getMasteryColor(concept.mastery_level)
                                  }}
                                ></div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {getFilteredAndSortedConcepts().length === 0 && (
                      <div className="cw-empty">
                        <Search size={48} />
                        <p className="cw-empty-text">No concepts match your search</p>
                      </div>
                    )}
                  </div>
                )}


                {/* View Mode: Learning Paths */}
                {viewMode === 'paths' && (
                  <div className="cw-paths-container">
                    <div className="cw-paths-header">
                      <h2 className="cw-paths-title">Learning Paths</h2>
                      <p className="cw-paths-subtitle">Structured learning journeys to master your concepts</p>
                    </div>

                    {learningPaths.length === 0 ? (
                      <div className="cw-empty">
                        <Route size={48} />
                        <h3 className="cw-empty-title">No Learning Paths Yet</h3>
                        <p className="cw-empty-text">Generate personalized learning paths based on your concepts</p>
                        <button className="cw-btn cw-btn-primary" onClick={() => selectedNode && generateLearningPath(selectedNode.id)}>
                          <Sparkles size={18} />
                          Generate Learning Path
                        </button>
                      </div>
                    ) : (
                      <div className="cw-paths-grid">
                        {learningPaths.map((path, pathIndex) => (
                          <div key={pathIndex} className="cw-path-card">
                            <div className="cw-path-header">
                              <div className="cw-path-icon">
                                <Route size={24} />
                              </div>
                              <div className="cw-path-info">
                                <h3 className="cw-path-name">{path.name}</h3>
                                <p className="cw-path-description">{path.description}</p>
                              </div>
                              <div className="cw-path-progress-circle">
                                <svg viewBox="0 0 36 36" className="circular-chart">
                                  <path
                                    className="circle-bg"
                                    d="M18 2.0845
                                      a 15.9155 15.9155 0 0 1 0 31.831
                                      a 15.9155 15.9155 0 0 1 0 -31.831"
                                  />
                                  <path
                                    className="circle"
                                    strokeDasharray={`${(pathProgress[path.id] || 0) * 100}, 100`}
                                    d="M18 2.0845
                                      a 15.9155 15.9155 0 0 1 0 31.831
                                      a 15.9155 15.9155 0 0 1 0 -31.831"
                                  />
                                  <text x="18" y="20.35" className="percentage">{Math.round((pathProgress[path.id] || 0) * 100)}%</text>
                                </svg>
                              </div>
                            </div>

                            <div className="cw-path-steps">
                              {path.steps && path.steps.map((step, stepIndex) => {
                                const isCompleted = pathProgress[path.id] && pathProgress[path.id][stepIndex];
                                const isCurrent = !isCompleted && (stepIndex === 0 || (pathProgress[path.id] && pathProgress[path.id][stepIndex - 1]));

                                return (
                                  <div 
                                    key={stepIndex} 
                                    className={`cw-path-step ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''}`}
                                  >
                                    <div className="cw-step-indicator">
                                      {isCompleted ? (
                                        <CheckCircle size={20} />
                                      ) : isCurrent ? (
                                        <Play size={20} />
                                      ) : (
                                        <Circle size={20} />
                                      )}
                                    </div>
                                    <div className="cw-step-content">
                                      <h4 className="cw-step-title">{step.title}</h4>
                                      <p className="cw-step-description">{step.description}</p>
                                      {step.estimated_time && (
                                        <div className="cw-step-meta">
                                          <Clock size={14} />
                                          <span>{step.estimated_time}</span>
                                        </div>
                                      )}
                                    </div>
                                    {isCurrent && !isCompleted && (
                                      <button 
                                        className="cw-step-action"
                                        onClick={() => markPathStepComplete(path.id, stepIndex)}
                                      >
                                        <Check size={16} />
                                        Mark Complete
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>

                            <div className="cw-path-footer">
                              <div className="cw-path-stats">
                                <div className="cw-path-stat">
                                  <Layers size={14} />
                                  <span>{path.steps?.length || 0} Steps</span>
                                </div>
                                <div className="cw-path-stat">
                                  <Clock size={14} />
                                  <span>{path.estimated_duration || 'N/A'}</span>
                                </div>
                                <div className="cw-path-stat">
                                  <Target size={14} />
                                  <span>{path.difficulty || 'Intermediate'}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Suggested Next Topics */}
                    {suggestedNextTopics.length > 0 && (
                      <div className="cw-suggestions-section">
                        <h3 className="cw-suggestions-title">
                          <Lightbulb size={20} />
                          Suggested Next Topics
                        </h3>
                        <div className="cw-suggestions-grid">
                          {suggestedNextTopics.map((topic, index) => (
                            <div key={index} className="cw-suggestion-card">
                              <div className="cw-suggestion-icon">
                                <Target size={20} />
                              </div>
                              <div className="cw-suggestion-content">
                                <h4 className="cw-suggestion-title">{topic.name}</h4>
                                <p className="cw-suggestion-reason">{topic.reason}</p>
                              </div>
                              <button 
                                className="cw-suggestion-action"
                                onClick={() => generateLearningPath(topic.concept_id)}
                              >
                                <ArrowRight size={16} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}


                {/* View Mode: Resources */}
                {viewMode === 'resources' && (
                  <div className="cw-resources-container">
                    <div className="cw-resources-header">
                      <h2 className="cw-resources-title">Learning Resources</h2>
                      <p className="cw-resources-subtitle">Curated resources for each concept</p>
                      <div className="cw-resources-filters">
                        <button 
                          className={`cw-filter-btn ${resourceFilter === 'all' ? 'active' : ''}`}
                          onClick={() => setResourceFilter('all')}
                        >
                          All Resources
                        </button>
                        <button 
                          className={`cw-filter-btn ${resourceFilter === 'videos' ? 'active' : ''}`}
                          onClick={() => setResourceFilter('videos')}
                        >
                          <Youtube size={16} />
                          Videos
                        </button>
                        <button 
                          className={`cw-filter-btn ${resourceFilter === 'articles' ? 'active' : ''}`}
                          onClick={() => setResourceFilter('articles')}
                        >
                          <Newspaper size={16} />
                          Articles
                        </button>
                        <button 
                          className={`cw-filter-btn ${resourceFilter === 'exercises' ? 'active' : ''}`}
                          onClick={() => setResourceFilter('exercises')}
                        >
                          <Code size={16} />
                          Exercises
                        </button>
                        <button 
                          className={`cw-filter-btn ${resourceFilter === 'books' ? 'active' : ''}`}
                          onClick={() => setResourceFilter('books')}
                        >
                          <Book size={16} />
                          Books
                        </button>
                      </div>
                    </div>

                    {concepts.length === 0 ? (
                      <div className="cw-empty">
                        <BookOpen size={48} />
                        <h3 className="cw-empty-title">No Concepts Available</h3>
                        <p className="cw-empty-text">Add concepts to get personalized resource recommendations</p>
                      </div>
                    ) : (
                      <div className="cw-resources-list">
                        {concepts.map((concept) => {
                          const conceptResources = resources[concept.id] || [];
                          const filteredResources = resourceFilter === 'all' 
                            ? conceptResources 
                            : conceptResources.filter(r => r.type === resourceFilter);

                          if (filteredResources.length === 0 && resourceFilter !== 'all') return null;

                          return (
                            <div key={concept.id} className="cw-resource-section">
                              <div className="cw-resource-section-header">
                                <div className="cw-resource-concept-info">
                                  <div 
                                    className="cw-resource-concept-icon"
                                    style={{ backgroundColor: getCategoryColor(concept.category) }}
                                  >
                                    <Brain size={20} />
                                  </div>
                                  <div>
                                    <h3 className="cw-resource-concept-name">{concept.concept_name}</h3>
                                    <span className="cw-resource-concept-category">{concept.category}</span>
                                  </div>
                                </div>
                                {!resources[concept.id] && (
                                  <button 
                                    className="cw-btn cw-btn-secondary"
                                    onClick={() => generateResourceRecommendations(concept.id)}
                                    disabled={loadingResources}
                                  >
                                    {loadingResources ? (
                                      <Loader size={16} className="cw-spinner" />
                                    ) : (
                                      <Sparkles size={16} />
                                    )}
                                    Generate Resources
                                  </button>
                                )}
                              </div>

                              {filteredResources.length > 0 && (
                                <div className="cw-resource-grid">
                                  {filteredResources.map((resource, index) => (
                                    <div key={index} className="cw-resource-card">
                                      <div className="cw-resource-type-badge">
                                        {resource.type === 'videos' && <Youtube size={14} />}
                                        {resource.type === 'articles' && <Newspaper size={14} />}
                                        {resource.type === 'exercises' && <Code size={14} />}
                                        {resource.type === 'books' && <Book size={14} />}
                                        <span>{resource.type}</span>
                                      </div>
                                      <h4 className="cw-resource-title">{resource.title}</h4>
                                      <p className="cw-resource-description">{resource.description}</p>
                                      <div className="cw-resource-meta">
                                        {resource.author && (
                                          <span className="cw-resource-author">
                                            <Users size={12} />
                                            {resource.author}
                                          </span>
                                        )}
                                        {resource.duration && (
                                          <span className="cw-resource-duration">
                                            <Clock size={12} />
                                            {resource.duration}
                                          </span>
                                        )}
                                        {resource.difficulty && (
                                          <span className={`cw-resource-difficulty ${resource.difficulty.toLowerCase()}`}>
                                            {resource.difficulty}
                                          </span>
                                        )}
                                      </div>
                                      <div className="cw-resource-actions">
                                        <button 
                                          className="cw-resource-action-btn primary"
                                          onClick={() => openResource(resource.url)}
                                        >
                                          <ExternalLink size={14} />
                                          Open Resource
                                        </button>
                                        <button className="cw-resource-action-btn">
                                          <Bookmark size={14} />
                                        </button>
                                        <button className="cw-resource-action-btn">
                                          <Share2 size={14} />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {filteredResources.length === 0 && resources[concept.id] && (
                                <div className="cw-resource-empty">
                                  <p>No {resourceFilter} resources available for this concept</p>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Detail Panel */}
          {selectedNode && (
            <div className="cw-detail-panel">
              <div className="cw-detail-header">
                <div>
                  <h3 className="cw-detail-title">{selectedNode.concept_name}</h3>
                  <span className="cw-detail-category">{selectedNode.category}</span>
                </div>
                <button className="cw-detail-close" onClick={() => setSelectedNode(null)}>×</button>
              </div>
              
              <div className="cw-detail-content">
                {selectedNode.description && (
                  <div className="cw-detail-section">
                    <h4 className="cw-detail-section-title">Description</h4>
                    <p className="cw-detail-description">{selectedNode.description}</p>
                  </div>
                )}

                <div className="cw-detail-section">
                  <h4 className="cw-detail-section-title">Mastery Level</h4>
                  <div className="cw-mastery-bar">
                    <div 
                      className="cw-mastery-fill" 
                      style={{ 
                        width: `${selectedNode.mastery_level * 100}%`,
                        backgroundColor: getMasteryColor(selectedNode.mastery_level)
                      }}
                    ></div>
                  </div>
                  <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--cw-accent)' }}>
                    {Math.round(selectedNode.mastery_level * 100)}%
                  </span>
                </div>

                <div className="cw-detail-section">
                  <h4 className="cw-detail-section-title">Statistics</h4>
                  <div className="cw-detail-stats-grid">
                    <div className="cw-detail-stat">
                      <span className="cw-detail-stat-value">{selectedNode.notes_count}</span>
                      <span className="cw-detail-stat-label">Notes</span>
                    </div>
                    <div className="cw-detail-stat">
                      <span className="cw-detail-stat-value">{selectedNode.quizzes_count}</span>
                      <span className="cw-detail-stat-label">Quizzes</span>
                    </div>
                    <div className="cw-detail-stat">
                      <span className="cw-detail-stat-value">{selectedNode.flashcards_count}</span>
                      <span className="cw-detail-stat-label">Flashcards</span>
                    </div>
                    <div className="cw-detail-stat">
                      <span className="cw-detail-stat-value">{getConnectedConcepts(selectedNode.id).length}</span>
                      <span className="cw-detail-stat-label">Connections</span>
                    </div>
                  </div>
                </div>

                <div className="cw-detail-section">
                  <h4 className="cw-detail-section-title">Quick Actions</h4>
                  <div className="cw-detail-actions">
                    <button 
                      className="cw-detail-action-btn"
                      onClick={() => generateConceptContent('notes')}
                      disabled={generatingContent === 'notes'}
                    >
                      {generatingContent === 'notes' ? (
                        <Loader size={16} className="cw-spinner" />
                      ) : (
                        <FileText size={16} />
                      )}
                      Generate Notes
                    </button>
                    <button 
                      className="cw-detail-action-btn"
                      onClick={() => generateConceptContent('flashcards')}
                      disabled={generatingContent === 'flashcards'}
                    >
                      {generatingContent === 'flashcards' ? (
                        <Loader size={16} className="cw-spinner" />
                      ) : (
                        <BookOpen size={16} />
                      )}
                      Generate Flashcards
                    </button>
                    <button 
                      className="cw-detail-action-btn"
                      onClick={() => generateConceptContent('quiz')}
                      disabled={generatingContent === 'quiz'}
                    >
                      {generatingContent === 'quiz' ? (
                        <Loader size={16} className="cw-spinner" />
                      ) : (
                        <Brain size={16} />
                      )}
                      Generate Quiz
                    </button>
                    <button 
                      className="cw-detail-action-btn"
                      onClick={() => generateLearningPath(selectedNode.id)}
                    >
                      <Route size={16} />
                      Create Learning Path
                    </button>
                    <button 
                      className="cw-detail-action-btn"
                      onClick={() => {
                        loadResourcesForConcept(selectedNode.id);
                        setViewMode('resources');
                      }}
                    >
                      <BookOpen size={16} />
                      View Resources
                    </button>
                  </div>
                </div>

                {getConnectedConcepts(selectedNode.id).length > 0 && (
                  <div className="cw-detail-section">
                    <h4 className="cw-detail-section-title">Connected Concepts</h4>
                    <div className="cw-connections-list">
                      {getConnectedConcepts(selectedNode.id).map((conn, index) => {
                        const otherConceptId = conn.source_id === selectedNode.id ? conn.target_id : conn.source_id;
                        const otherConcept = concepts.find(c => c.id === otherConceptId);
                        if (!otherConcept) return null;

                        return (
                          <div 
                            key={index} 
                            className="cw-connection-item"
                            onClick={() => setSelectedNode(otherConcept)}
                          >
                            <div 
                              className="cw-connection-indicator"
                              style={{ backgroundColor: getCategoryColor(otherConcept.category) }}
                            ></div>
                            <span className="cw-connection-name">{otherConcept.concept_name}</span>
                            <span className="cw-connection-type">{conn.connection_type}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Add Concept Modal */}
      {showAddModal && (
        <div className="cw-modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="cw-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cw-modal-header">
              <h2 className="cw-modal-title">Add New Concept</h2>
              <button className="cw-modal-close" onClick={() => setShowAddModal(false)}>×</button>
            </div>
            <div className="cw-modal-content">
              <div className="cw-form-group">
                <label className="cw-form-label">Concept Name</label>
                <input
                  type="text"
                  className="cw-form-input"
                  value={newConcept.name}
                  onChange={(e) => setNewConcept(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter concept name"
                />
              </div>
              <div className="cw-form-group">
                <label className="cw-form-label">Description</label>
                <textarea
                  className="cw-form-textarea"
                  value={newConcept.description}
                  onChange={(e) => setNewConcept(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe this concept"
                  rows={3}
                />
              </div>
              <div className="cw-form-group">
                <label className="cw-form-label">Category</label>
                <select
                  className="cw-form-select"
                  value={newConcept.category}
                  onChange={(e) => setNewConcept(prev => ({ ...prev, category: e.target.value }))}
                >
                  <option value="">Select category</option>
                  {getCategories().filter(c => c !== 'all').map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                  <option value="General">General</option>
                </select>
              </div>
            </div>
            <div className="cw-modal-footer">
              <button className="cw-btn cw-btn-secondary" onClick={() => setShowAddModal(false)}>
                Cancel
              </button>
              <button className="cw-btn cw-btn-primary" onClick={addConcept}>
                <Plus size={16} />
                Add Concept
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConceptWeb;

// ==================== END OF FILE ====================

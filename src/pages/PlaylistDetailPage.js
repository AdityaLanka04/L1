import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Plus, Trash2, Check, Users, Clock, BookOpen, X,
  FileText, MessageSquare, ExternalLink, Youtube, FileUp, Link as LinkIcon,
  ChevronDown, ChevronUp, ChevronRight, Share2, Heart, Lock, Globe, GraduationCap,
  CheckCircle, Sparkles, Zap, GitFork
} from 'lucide-react';
import { marked } from 'marked';
import './PlaylistDetailPage.css';
import '../components/SocialHubChrome.css';
import { API_URL } from '../config';
import { sanitizeHtml } from '../utils/sanitize';
import MathRenderer from '../components/MathRenderer';
import PlaylistShareModal from '../components/PlaylistShareModal';

const renderPlaylistMarkdown = (value = '') => {
  if (!value) return '';

  const mathStore = [];
  const placeholder = (index) => `PMATH${index}P`;
  let text = String(value);

  text = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, math) => {
    mathStore.push({ tex: math.trim(), display: true });
    return placeholder(mathStore.length - 1);
  });
  text = text.replace(/\\\[([\s\S]+?)\\\]/g, (_, math) => {
    mathStore.push({ tex: math.trim(), display: true });
    return placeholder(mathStore.length - 1);
  });
  text = text.replace(/\$([^\n$]{1,300}?)\$/g, (_, math) => {
    mathStore.push({ tex: math.trim(), display: false });
    return placeholder(mathStore.length - 1);
  });
  text = text.replace(/\\\(([^\n]{1,300}?)\\\)/g, (_, math) => {
    mathStore.push({ tex: math.trim(), display: false });
    return placeholder(mathStore.length - 1);
  });

  const renderer = new marked.Renderer();
  renderer.heading = ({ text: heading, depth }) => `<h${depth} class="md-h${depth}">${heading}</h${depth}>`;
  renderer.strong = ({ text: strongText }) => `<strong class="md-bold-inline">${strongText}</strong>`;
  renderer.codespan = ({ text: codeText }) => `<code class="md-inline-code">${codeText}</code>`;
  renderer.list = function list(token) {
    const body = (token.items || []).map((item) => this.listitem(item)).join('');
    const tag = token.ordered ? 'ol' : 'ul';
    const className = token.ordered ? 'md-ol' : 'md-ul';
    return `<${tag} class="${className}">${body}</${tag}>`;
  };
  renderer.listitem = function listitem(token) {
    return `<li class="md-li">${this.parser.parseInline(token.tokens || [])}</li>`;
  };

  marked.use({ renderer, breaks: true, gfm: true });

  try {
    text = marked.parse(text);
  } catch {
    text = `<p>${text}</p>`;
  }

  return text.replace(/PMATH(\d+)P/g, (_, index) => {
    const record = mathStore[Number(index)];
    if (!record) return '';
    return record.display
      ? `<div class="math-display-wrap">$$${record.tex}$$</div>`
      : `$${record.tex}$`;
  });
};

const PlaylistDetailPage = () => {
  const { playlistId } = useParams();
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  
  const [playlist, setPlaylist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingItem, setViewingItem] = useState(null);
  const [itemContent, setItemContent] = useState(null);
  const [expandedItems, setExpandedItems] = useState({});
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [aiLoading, setAiLoading] = useState({ notes: false, flashcards: false });
  const [aiResult, setAiResult] = useState(null);
  const [itemFilter, setItemFilter] = useState('all');
  const [showOnlyRequired, setShowOnlyRequired] = useState(false);
  const [updatingItem, setUpdatingItem] = useState(null);
  const [forkLoading, setForkLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    fetchPlaylistDetails();
  }, [playlistId]);

  useEffect(() => {
    setItemFilter('all');
    setShowOnlyRequired(false);
    setAiResult(null);
    setShowShareModal(false);
  }, [playlistId]);

  const fetchPlaylistDetails = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/playlists/${playlistId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setPlaylist(data);
        setIsFollowing(data.is_following || false);
      }
    } catch (error) { /* silenced */ } finally {
      setLoading(false);
    }
  };

  const handleFollowToggle = async () => {
    setFollowLoading(true);
    try {
      const method = isFollowing ? 'DELETE' : 'POST';
      const response = await fetch(`${API_URL}/playlists/${playlistId}/follow`, {
        method: method,
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        setIsFollowing(!isFollowing);
        setPlaylist(prev => ({
          ...prev,
          follower_count: isFollowing 
            ? Math.max(0, (prev.follower_count || 0) - 1)
            : (prev.follower_count || 0) + 1
        }));
      }
    } catch (error) { /* silenced */ } finally {
      setFollowLoading(false);
    }
  };

  const handleForkPlaylist = async () => {
    if (forkLoading) return;
    setForkLoading(true);
    try {
      const response = await fetch(`${API_URL}/playlists/${playlistId}/fork`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.id) {
        navigate(`/playlists/${data.id}`);
      }
    } catch (error) { /* silenced */ } finally {
      setForkLoading(false);
    }
  };

  const handleGenerateNotes = async () => {
    if (aiLoading.notes) return;
    setAiResult(null);
    setAiLoading(prev => ({ ...prev, notes: true }));
    try {
      const response = await fetch(`${API_URL}/import_export/playlist_to_notes`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ playlist_id: playlistId })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.success === false) {
        throw new Error(data.error || data.detail || 'Failed to generate notes');
      }
      setAiResult({
        status: 'success',
        type: 'notes',
        noteId: data.note_id
      });
    } catch (error) {
      setAiResult({
        status: 'error',
        message: error.message || 'Failed to generate notes'
      });
    } finally {
      setAiLoading(prev => ({ ...prev, notes: false }));
    }
  };

  const handleGenerateFlashcards = async () => {
    if (aiLoading.flashcards) return;
    setAiResult(null);
    setAiLoading(prev => ({ ...prev, flashcards: true }));
    try {
      const response = await fetch(`${API_URL}/import_export/playlist_to_flashcards`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ playlist_id: playlistId, card_count: 15 })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.success === false) {
        throw new Error(data.error || data.detail || 'Failed to generate flashcards');
      }
      setAiResult({
        status: 'success',
        type: 'flashcards'
      });
    } catch (error) {
      setAiResult({
        status: 'error',
        message: error.message || 'Failed to generate flashcards'
      });
    } finally {
      setAiLoading(prev => ({ ...prev, flashcards: false }));
    }
  };

  const handleAskAI = () => {
    if (!playlist) return;
    const itemList = (playlist.items || [])
      .slice(0, 6)
      .map((item, idx) => `${idx + 1}. ${item.title || 'Untitled'} (${item.item_type || 'item'})`)
      .join('\n');

    const message = `I want to study this playlist:

${playlist.title}
${playlist.description || ''}

Category: ${playlist.category || 'Uncategorized'}
Difficulty: ${playlist.difficulty_level || 'All levels'}
Estimated time: ${playlist.estimated_hours || totalHours || 0} hours

Items:
${itemList}

Help me summarize the key concepts, recommend an order, and suggest a study plan.`; 

    navigate('/ai-chat', { state: { initialMessage: message } });
  };

  const handleToggleCompletion = async (itemId, completed) => {
    if (updatingItem) return;
    setUpdatingItem(itemId);
    try {
      const response = await fetch(
        `${API_URL}/playlists/${playlistId}/progress?item_id=${itemId}&completed=${completed}`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        setPlaylist(prev => ({
          ...prev,
          user_progress: {
            ...(prev.user_progress || {}),
            completed_items: data.completed_items || [],
            progress_percentage: data.progress_percentage || 0
          }
        }));
      }
    } catch (error) { /* silenced */ } finally {
      setUpdatingItem(null);
    }
  };

  const handleAddItem = async (itemData) => {
    try {
      const response = await fetch(`${API_URL}/playlists/${playlistId}/items`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(itemData)
      });

      if (response.ok) {
        setShowAddItemModal(false);
        fetchPlaylistDetails();
      }
    } catch (error) { /* silenced */ }
  };

  const handleDeleteItem = async (itemId) => {
    if (!window.confirm('Delete this item?')) return;
    
    try {
      const response = await fetch(`${API_URL}/playlists/${playlistId}/items/${itemId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        fetchPlaylistDetails();
      }
    } catch (error) { /* silenced */ }
  };

  const handleDeletePlaylist = async () => {
    if (!playlist?.is_owner || deleteLoading) return;
    const confirmed = window.confirm(`Delete "${playlist.title}"? This cannot be undone.`);
    if (!confirmed) return;

    setDeleteLoading(true);
    try {
      const response = await fetch(`${API_URL}/playlists/${playlistId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        navigate('/playlists');
      }
    } catch (error) { /* silenced */ } finally {
      setDeleteLoading(false);
    }
  };

  const toggleItem = (itemId) => {
    setExpandedItems(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  const handleOpenItem = async (item) => {
    if (item.item_type === 'flashcard') {
      if (item.item_id) {
        navigate(`/flashcards?set_id=${item.item_id}&mode=preview`);
      }
      return;
    }

    if (item.item_type === 'note' || item.item_type === 'chat') {
      if (item.item_id) {
        try {
          const response = await fetch(
            `${API_URL}/playlists/${playlistId}/items/${item.id}/view`,
            { headers: { 'Authorization': `Bearer ${token}` } }
          );
          
          if (response.ok) {
            const data = await response.json();
            setItemContent(data);
            setViewingItem(item);
            setShowViewModal(true);
          }
        } catch (error) { /* silenced */ }
      }
    } else if (item.url) {
      window.open(item.url, '_blank', 'noopener,noreferrer');
    }
  };

  const getItemIcon = (type) => {
    const icons = {
      note: FileText,
      chat: MessageSquare,
      external_link: ExternalLink,
      youtube: Youtube,
      pdf: FileUp,
      course: GraduationCap,
      video: BookOpen,
      article: BookOpen,
      quiz: BookOpen,
      flashcard: BookOpen
    };
    return icons[type] || BookOpen;
  };

  useEffect(() => {
    if (!aiResult) return;
    const timer = setTimeout(() => setAiResult(null), 6000);
    return () => clearTimeout(timer);
  }, [aiResult]);

  if (loading) {
    return (
      <div className="detail-loading playlist-detail-page">
        <div className="shc-topbar">
          <div className="shc-tagline"><span>LEARNING,</span> UNIFIED</div>
          <div className="shc-topbar-right">
            <button className="shc-top-btn" type="button" onClick={() => navigate('/dashboard-cerbyl')}>Dashboard</button>
          </div>
        </div>
        <div className="loading-spinner"></div>
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="detail-error playlist-detail-page">
        <div className="shc-topbar">
          <div className="shc-tagline"><span>LEARNING,</span> UNIFIED</div>
          <div className="shc-topbar-right">
            <button className="shc-top-btn" type="button" onClick={() => navigate('/dashboard-cerbyl')}>Dashboard</button>
          </div>
        </div>
        <h2>Playlist not found</h2>
        <button onClick={() => navigate('/playlists')} className="error-back-btn">
          <span>Back to Playlists</span>
          <ChevronRight size={18} />
        </button>
      </div>
    );
  }

  const completedItems = playlist.user_progress?.completed_items || [];
  const allItems = playlist.items || [];
  const progressPercentage = allItems.length > 0 
    ? (completedItems.length / allItems.length) * 100 
    : 0;
  const itemTypes = Array.from(new Set(allItems.map(item => item.item_type))).filter(Boolean);
  const filteredItems = allItems.filter(item => {
    const typeMatch = itemFilter === 'all' || item.item_type === itemFilter;
    const requiredMatch = !showOnlyRequired || item.is_required;
    return typeMatch && requiredMatch;
  });
  const requiredCount = allItems.filter(item => item.is_required).length;
  const optionalCount = allItems.length - requiredCount;
  const totalMinutes = allItems.reduce((sum, item) => sum + (item.duration_minutes || 0), 0);
  const totalHours = totalMinutes ? Math.round((totalMinutes / 60) * 10) / 10 : playlist.estimated_hours || 0;

  return (
    <div className="playlist-detail-container playlist-detail-page">
      <div className="shc-topbar">
        <div className="shc-tagline"><span>LEARNING,</span> UNIFIED</div>
        <div className="shc-topbar-right">
          <button className="shc-top-btn" type="button" onClick={() => navigate('/dashboard-cerbyl')}>Dashboard</button>
        </div>
      </div>
      <div className="detail-shell">
        <aside className="detail-sidebar">
          <div className="detail-sidebar-brand">
            <div className="detail-sidebar-logo">cerbyl</div>
            <div className="detail-sidebar-kicker">PLAYLIST</div>
          </div>

          <button className="detail-sidebar-back" onClick={() => navigate('/playlists')}>
            <ChevronRight size={14} />
            <span>All Playlists</span>
          </button>

          <div className="detail-sidebar-divider"></div>

          <div className="detail-sidebar-section">
            <h3 className="detail-sidebar-heading">Actions</h3>
            {playlist.is_owner ? (
              <>
                <button className="detail-sidebar-action primary" onClick={() => setShowAddItemModal(true)}>
                  <Plus size={16} />
                  <span>Add Item</span>
                </button>
                <button className="detail-sidebar-action" onClick={() => setShowShareModal(true)}>
                  <Share2 size={16} />
                  <span>Share</span>
                </button>
                <button
                  className="detail-sidebar-action danger"
                  onClick={handleDeletePlaylist}
                  disabled={deleteLoading}
                >
                  <Trash2 size={16} />
                  <span>{deleteLoading ? 'Deleting' : 'Delete'}</span>
                </button>
              </>
            ) : (
              <>
                <button
                  className={`detail-sidebar-action ${isFollowing ? 'success' : 'primary'}`}
                  onClick={handleFollowToggle}
                  disabled={followLoading}
                >
                  {isFollowing ? <Check size={16} /> : <Heart size={16} />}
                  <span>{followLoading ? 'Loading' : isFollowing ? 'Following' : 'Follow'}</span>
                </button>
                <button className="detail-sidebar-action" onClick={() => setShowShareModal(true)}>
                  <Share2 size={16} />
                  <span>Share</span>
                </button>
                <button className="detail-sidebar-action" onClick={handleForkPlaylist} disabled={forkLoading}>
                  <GitFork size={16} />
                  <span>{forkLoading ? 'Forking' : 'Fork'}</span>
                </button>
              </>
            )}
          </div>

          <div className="detail-sidebar-divider"></div>

          <div className="detail-sidebar-section">
            <h3 className="detail-sidebar-heading">AI Tools</h3>
            <button
              className="detail-sidebar-action"
              onClick={handleGenerateNotes}
              disabled={aiLoading.notes || allItems.length === 0}
            >
              {aiLoading.notes ? <span className="detail-btn-spinner" /> : <FileText size={16} />}
              <span>{aiLoading.notes ? 'Generating' : 'Notes'}</span>
            </button>
            <button
              className="detail-sidebar-action"
              onClick={handleGenerateFlashcards}
              disabled={aiLoading.flashcards || allItems.length === 0}
            >
              {aiLoading.flashcards ? <span className="detail-btn-spinner" /> : <Zap size={16} />}
              <span>{aiLoading.flashcards ? 'Generating' : 'Flashcards'}</span>
            </button>
            <button className="detail-sidebar-action" onClick={handleAskAI}>
              <Sparkles size={16} />
              <span>Ask AI</span>
            </button>
          </div>

          <div className="detail-sidebar-progress">
            <div className="detail-sidebar-progress-meta">
              <span>Progress</span>
              <strong>{Math.round(progressPercentage)}%</strong>
            </div>
            <div className="detail-sidebar-progress-track">
              <div style={{ width: `${progressPercentage}%` }}></div>
            </div>
          </div>

          <div className="detail-sidebar-stats">
            <div className="detail-sidebar-stat">
              <strong>{allItems.length}</strong>
              <span>Items</span>
            </div>
            <div className="detail-sidebar-stat">
              <strong>{requiredCount}</strong>
              <span>Required</span>
            </div>
            <div className="detail-sidebar-stat">
              <strong>{totalHours || 0}h</strong>
              <span>Hours</span>
            </div>
          </div>
        </aside>

        <main className="detail-main">
      <div className="detail-header">
        <div
          className="header-banner"
          style={{ background: `linear-gradient(135deg, ${playlist.cover_color}33 0%, ${playlist.cover_color}11 100%)` }}
        >
          <div className="banner-icon">
            <BookOpen size={48} strokeWidth={1.5} />
          </div>
        </div>

        <div className="header-content">
          <div className="header-meta">
            <span className="meta-badge">
              {playlist.is_public ? <Globe size={12} /> : <Lock size={12} />}
              {playlist.is_public ? 'Public' : 'Private'}
            </span>
            {playlist.category && (
              <span className="meta-badge category">{playlist.category}</span>
            )}
            {playlist.difficulty_level && (
              <span className="meta-badge difficulty">{playlist.difficulty_level}</span>
            )}
          </div>

          <h1 className="header-title">{playlist.title}</h1>
          <p className="header-description">{playlist.description}</p>

          <div className="header-stats">
            <div className="stat-item">
              <BookOpen size={16} />
              <span>{playlist.items?.length || 0} items</span>
            </div>
            <div className="stat-item">
              <Users size={16} />
              <span>{playlist.follower_count || 0} followers</span>
            </div>
            {playlist.estimated_hours > 0 && (
              <div className="stat-item">
                <Clock size={16} />
                <span>{playlist.estimated_hours}h</span>
              </div>
            )}
          </div>

          <div className="header-creator">
            <span className="creator-label">Created by</span>
            {playlist.creator.picture_url ? (
              <img src={playlist.creator.picture_url} alt="" className="creator-img" />
            ) : (
              <div className="creator-avatar">
                {(playlist.creator.first_name?.[0] || playlist.creator.username[0]).toUpperCase()}
              </div>
            )}
            <span className="creator-name">
              {playlist.creator.first_name || playlist.creator.username}
            </span>
          </div>

          {progressPercentage > 0 && (
            <div className="progress-section">
              <div className="progress-header">
                <span className="progress-label">Your Progress</span>
                <span className="progress-value">{Math.round(progressPercentage)}%</span>
              </div>
              <div className="progress-track">
                <div className="progress-bar" style={{ width: `${progressPercentage}%` }}></div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="detail-panels">
        <div className="playlist-panel-card studio-card">
          <div className="playlist-panel-header">
            <div>
              <span className="playlist-panel-eyebrow">Learning Studio</span>
              <h3>AI Status</h3>
            </div>
            <Sparkles size={20} />
          </div>

          {aiResult && (
            <div className={`studio-result ${aiResult.status}`}>
              {aiResult.status === 'success' ? (
                <>
                  <span>AI {aiResult.type === 'notes' ? 'notes' : 'flashcards'} are ready.</span>
                  {aiResult.type === 'notes' && aiResult.noteId && (
                    <button onClick={() => navigate(`/notes/editor/${aiResult.noteId}`)}>
                      Open Notes
                    </button>
                  )}
                  {aiResult.type === 'flashcards' && (
                    <button onClick={() => navigate('/flashcards')}>Open Flashcards</button>
                  )}
                </>
              ) : (
                <span>{aiResult.message}</span>
              )}
              <button className="studio-close" onClick={() => setAiResult(null)}>
                <X size={14} />
              </button>
            </div>
          )}

          {!aiResult && (
            <div className="studio-empty-state">
              <Sparkles size={18} />
              <span>Ready to generate notes, flashcards, or a study plan.</span>
            </div>
          )}
        </div>

        <div className="playlist-panel-card insights-card">
          <div className="playlist-panel-header">
            <div>
              <span className="playlist-panel-eyebrow">Playlist Insights</span>
              <h3>Snapshot</h3>
            </div>
          </div>
          <div className="insights-grid">
            <div className="insight-tile">
              <span className="insight-label">Required Items</span>
              <span className="insight-value">{requiredCount}</span>
            </div>
            <div className="insight-tile">
              <span className="insight-label">Optional Items</span>
              <span className="insight-value">{optionalCount}</span>
            </div>
            <div className="insight-tile">
              <span className="insight-label">Total Hours</span>
              <span className="insight-value">{totalHours || 0}h</span>
            </div>
            <div className="insight-tile">
              <span className="insight-label">Completed</span>
              <span className="insight-value">{completedItems.length}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="detail-body">
        <div className="items-header">
          <div className="view-heading" style={{ marginBottom: 0, paddingBottom: 0, border: 'none' }}>
            <span className="view-kicker">Collection</span>
            <h2 className="view-title">Playlist Items</h2>
            <p className="view-sub">{filteredItems.length} of {allItems.length} items</p>
          </div>
        </div>

        {allItems.length > 0 && (
          <div className="items-toolbar">
            <div className="item-filters">
              <button
                className={`filter-pill ${itemFilter === 'all' ? 'active' : ''}`}
                onClick={() => setItemFilter('all')}
              >
                All
              </button>
              {itemTypes.map(type => (
                <button
                  key={type}
                  className={`filter-pill ${itemFilter === type ? 'active' : ''}`}
                  onClick={() => setItemFilter(type)}
                >
                  {type.replace('_', ' ')}
                </button>
              ))}
            </div>
            <button
              className={`required-toggle ${showOnlyRequired ? 'active' : ''}`}
              onClick={() => setShowOnlyRequired(prev => !prev)}
            >
              {showOnlyRequired ? 'Showing Required' : 'Required Only'}
            </button>
          </div>
        )}

        {filteredItems.length > 0 ? (
          <div className="items-container">
            {filteredItems.map((item, index) => {
              const ItemIcon = getItemIcon(item.item_type);
              const isCompleted = completedItems.includes(item.id);
              const isExpanded = expandedItems[item.id];

              return (
                <div 
                  key={item.id} 
                  className={`playlist-item ${isCompleted ? 'completed' : ''}`}
                >
                  <div className="item-header" onClick={() => handleOpenItem(item)}>
                    <div className="item-number">{index + 1}</div>
                    
                    <div className="item-icon-wrapper">
                      <ItemIcon size={20} />
                    </div>

                    <div className="item-info">
                      <div className="item-name">{item.title}</div>
                      <div className="item-meta">
                        <span className="item-type">{item.item_type.replace('_', ' ')}</span>
                        {item.platform && (
                          <>
                            <span className="meta-separator">•</span>
                            <span>{item.platform}</span>
                          </>
                        )}
                        {item.duration_minutes && (
                          <>
                            <span className="meta-separator">•</span>
                            <span>{item.duration_minutes} min</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="item-actions">
                      {isFollowing && (
                        <button
                          className={`item-btn complete ${isCompleted ? 'active' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleCompletion(item.id, !isCompleted);
                          }}
                          disabled={updatingItem === item.id}
                          title={isCompleted ? 'Mark incomplete' : 'Mark complete'}
                        >
                          <CheckCircle size={18} />
                        </button>
                      )}
                      {(item.description || item.notes) && (
                        <button
                          className="item-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleItem(item.id);
                          }}
                        >
                          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </button>
                      )}
                      {playlist.is_owner && (
                        <button
                          className="item-btn delete"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteItem(item.id);
                          }}
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </div>

                  {isExpanded && (item.description || item.notes) && (
                    <div className="item-details">
                      {item.description && (
                        <div className="detail-block">
                          <strong>Description</strong>
                          <p>{item.description}</p>
                        </div>
                      )}
                      {item.notes && (
                        <div className="detail-block">
                          <strong>Notes</strong>
                          <p>{item.notes}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-items">
            <BookOpen size={56} />
            <h3>{allItems.length > 0 ? 'No matches' : 'No items yet'}</h3>
            <p>
              {allItems.length > 0
                ? 'Try adjusting your filters'
                : playlist.is_owner 
                  ? 'Start adding items to your playlist'
                  : 'This playlist is empty'}
            </p>
            {allItems.length > 0 && (
              <button className="empty-btn" onClick={() => {
                setItemFilter('all');
                setShowOnlyRequired(false);
              }}>
                Clear Filters
              </button>
            )}
          </div>
        )}
      </div>
        </main>
      </div>

      {showViewModal && itemContent && (
        <ViewItemModal
          item={viewingItem}
          content={itemContent}
          onClose={() => {
            setShowViewModal(false);
            setViewingItem(null);
            setItemContent(null);
          }}
        />
      )}

      {showAddItemModal && (
        <AddItemModal
          onClose={() => setShowAddItemModal(false)}
          onAdd={handleAddItem}
        />
      )}

      {showShareModal && (
        <PlaylistShareModal
          isOpen={showShareModal}
          playlist={playlist}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </div>
  );
};

export default PlaylistDetailPage;

const ViewItemModal = ({ item, content, onClose }) => {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box view-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{content.title}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-content">
          {content.type === 'note' && (
            <div 
              className="note-viewer" 
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(content.content || '<p>No content</p>') }}
            />
          )}

          {content.type === 'chat' && (
            <div className="chat-viewer">
              {content.messages && content.messages.length > 0 ? (
                content.messages.map((msg, index) => (
                  <div key={index} className="chat-pair">
                    <div className="chat-msg user-msg">
                      <div className="msg-label">You</div>
                      <MathRenderer
                        content={renderPlaylistMarkdown(msg.user_message)}
                        className="msg-text playlist-chat-render"
                      />
                    </div>
                    <div className="chat-msg ai-msg">
                      <div className="msg-label">AI</div>
                      <MathRenderer
                        content={renderPlaylistMarkdown(msg.ai_response)}
                        className="msg-text playlist-chat-render"
                      />
                    </div>
                  </div>
                ))
              ) : (
                <p>No messages</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const AddItemModal = ({ onClose, onAdd }) => {
  const token = localStorage.getItem('token');
  const userName = localStorage.getItem('username');
  const [itemType, setItemType] = useState('external_link');
  const [formData, setFormData] = useState({
    title: '',
    url: '',
    description: '',
    is_required: true,
    notes: '',
    item_id: null,
    platform: ''
  });

  const [userNotes, setUserNotes] = useState([]);
  const [userChats, setUserChats] = useState([]);
  const [userQuizzes, setUserQuizzes] = useState([]);
  const [userFlashcards, setUserFlashcards] = useState([]);
  const [loadingResources, setLoadingResources] = useState(false);
  const [addedItems, setAddedItems] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (['note', 'chat', 'quiz', 'flashcard'].includes(itemType)) {
      fetchUserResources();
    }
  }, [itemType]);

  const fetchUserResources = async () => {
    setLoadingResources(true);
    try {
      if (itemType === 'note') {
        const response = await fetch(`${API_URL}/get_notes?user_id=${encodeURIComponent(userName)}&summary=true&limit=100`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setUserNotes(Array.isArray(data) ? data : (data.notes || []));
        }
      } else if (itemType === 'chat') {
        const response = await fetch(`${API_URL}/get_chat_sessions?user_id=${encodeURIComponent(userName)}&limit=100`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setUserChats(Array.isArray(data) ? data : (data.sessions || []));
        }
      } else if (itemType === 'quiz') {
        const response = await fetch(`${API_URL}/get_question_sets?user_id=${userName}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setUserQuizzes(Array.isArray(data) ? data : (data.question_sets || []));
        }
      } else if (itemType === 'flashcard') {
        const response = await fetch(`${API_URL}/get_flashcard_history?user_id=${userName}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setUserFlashcards(Array.isArray(data) ? data : (data.flashcard_history || []));
        }
      }
    } catch (error) { /* silenced */ } finally {
      setLoadingResources(false);
    }
  };

  const handleAddToQueue = (e) => {
    e.preventDefault();
    const newItem = {
      item_type: itemType,
      ...formData,
      tempId: Date.now()
    };
    setAddedItems(prev => [...prev, newItem]);
    
    
    setFormData({
      title: '',
      url: '',
      description: '',
      is_required: true,
      notes: '',
      item_id: null,
      platform: ''
    });
  };

  const handleAddAndClose = async (e) => {
    e.preventDefault();
    const newItem = {
      item_type: itemType,
      ...formData
    };
    
    setIsSubmitting(true);
    try {
      await onAdd(newItem);
      onClose();
    } catch (error) { /* silenced */ } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveFromQueue = (tempId) => {
    setAddedItems(prev => prev.filter(item => item.tempId !== tempId));
  };

  const handleSubmitAll = async () => {
    if (addedItems.length === 0) return;
    
    setIsSubmitting(true);
    try {
      for (const item of addedItems) {
        const { tempId, ...itemData } = item;
        await onAdd(itemData);
      }
      onClose();
    } catch (error) { /* silenced */ } finally {
      setIsSubmitting(false);
    }
  };

  const handleResourceSelect = (resourceId, resourceTitle) => {
    setFormData(prev => ({
      ...prev,
      item_id: resourceId,
      title: resourceTitle
    }));
  };

  const itemTypes = [
    { value: 'external_link', label: 'Link', icon: LinkIcon },
    { value: 'youtube', label: 'YouTube', icon: Youtube },
    { value: 'pdf', label: 'PDF', icon: FileUp },
    { value: 'note', label: 'Note', icon: FileText },
    { value: 'chat', label: 'Chat', icon: MessageSquare },
    { value: 'quiz', label: 'Quiz', icon: BookOpen },
    { value: 'flashcard', label: 'Flashcard', icon: BookOpen }
  ];

  const getItemIcon = (type) => {
    const typeObj = itemTypes.find(t => t.value === type);
    return typeObj ? typeObj.icon : BookOpen;
  };

  return (
    <div className="add-item-fullpage">
      <div className="add-item-header">
        <div className="add-item-header-left">
          <p className="add-item-subtitle">ADD ITEMS TO PLAYLIST</p>
        </div>
        <div className="add-item-header-right">
          <button className="add-item-close-btn" onClick={onClose}>
            <X size={18} />
            <span>Close</span>
          </button>
        </div>
      </div>

      <div className="add-item-body">
        <div className="add-item-main">
          <div className="add-item-form-section">
            <h2 className="section-heading">Item Details</h2>
            
            <form onSubmit={handleAddToQueue} className="add-item-form">
              <div className="form-field">
                <label>Item Type</label>
                <div className="type-selector-grid">
                  {itemTypes.map(type => {
                    const Icon = type.icon;
                    return (
                      <button
                        key={type.value}
                        type="button"
                        className={`type-option-btn ${itemType === type.value ? 'active' : ''}`}
                        onClick={() => {
                          setItemType(type.value);
                          setFormData({
                            title: '',
                            url: '',
                            description: '',
                            is_required: true,
                            notes: '',
                            item_id: null,
                            platform: ''
                          });
                        }}
                      >
                        <Icon size={20} />
                        <span>{type.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {(itemType === 'note' || itemType === 'chat' || itemType === 'quiz' || itemType === 'flashcard') && (
                <div className="form-field">
                  <label>Select {itemType === 'flashcard' ? 'Flashcard Set' : itemType === 'quiz' ? 'Quiz' : itemType === 'note' ? 'Note' : 'Chat'}</label>
                  {loadingResources ? (
                    <div className="loading-text">Loading...</div>
                  ) : (
                    <div className="resource-selector-list">
                      {itemType === 'note' && userNotes.map(note => (
                        <div
                          key={note.id}
                          className={`resource-option-item ${formData.item_id === note.id ? 'selected' : ''}`}
                          onClick={() => handleResourceSelect(note.id, note.title)}
                        >
                          <FileText size={18} />
                          <span>{note.title}</span>
                          {formData.item_id === note.id && <Check size={18} />}
                        </div>
                      ))}
                      {itemType === 'chat' && userChats.map(chat => (
                        <div
                          key={chat.id}
                          className={`resource-option-item ${formData.item_id === chat.id ? 'selected' : ''}`}
                          onClick={() => handleResourceSelect(chat.id, chat.title)}
                        >
                          <MessageSquare size={18} />
                          <span>{chat.title}</span>
                          {formData.item_id === chat.id && <Check size={18} />}
                        </div>
                      ))}
                      {itemType === 'quiz' && userQuizzes.map(quiz => (
                        <div
                          key={quiz.id}
                          className={`resource-option-item ${formData.item_id === quiz.id ? 'selected' : ''}`}
                          onClick={() => handleResourceSelect(quiz.id, quiz.title || quiz.name)}
                        >
                          <BookOpen size={18} />
                          <span>{quiz.title || quiz.name}</span>
                          {formData.item_id === quiz.id && <Check size={18} />}
                        </div>
                      ))}
                      {itemType === 'flashcard' && userFlashcards.map(flashcard => {
                        
                        let cleanTitle = (flashcard.title || flashcard.name || '')
                          .replace(/^(Flashcards?:\s*|Cerbyl\s*|AI Generated\s*|ai generated\s*)/gi, '')
                          .replace(/^\s*:\s*/, '')
                          .trim();
                        cleanTitle = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);
                        
                        return (
                          <div
                            key={flashcard.id}
                            className={`resource-option-item ${formData.item_id === flashcard.id ? 'selected' : ''}`}
                            onClick={() => handleResourceSelect(flashcard.id, cleanTitle)}
                          >
                            <BookOpen size={18} />
                            <span>{cleanTitle}</span>
                            {formData.item_id === flashcard.id && <Check size={18} />}
                          </div>
                        );
                      })}

                      {((itemType === 'note' && userNotes.length === 0) || 
                        (itemType === 'chat' && userChats.length === 0) ||
                        (itemType === 'quiz' && userQuizzes.length === 0) ||
                        (itemType === 'flashcard' && userFlashcards.length === 0)) && (
                        <div className="no-resources">
                          No {itemType === 'flashcard' ? 'flashcard sets' : itemType === 'quiz' ? 'quizzes' : itemType === 'note' ? 'notes' : 'chats'} found
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {itemType !== 'note' && itemType !== 'chat' && itemType !== 'quiz' && itemType !== 'flashcard' && (
                <div className="form-field">
                  <label>Title</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder={itemType === 'course' ? 'e.g., Machine Learning Specialization' : 'Enter title'}
                    required
                  />
                </div>
              )}

              {(itemType === 'external_link' || itemType === 'youtube' || itemType === 'pdf' || 
                itemType === 'article' || itemType === 'course') && (
                <div className="form-field">
                  <label>URL</label>
                  <input
                    type="url"
                    value={formData.url}
                    onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
                    placeholder={itemType === 'course' ? 'https://www.coursera.org/learn/...' : 'https://...'}
                    required
                  />
                </div>
              )}

              {itemType === 'course' && (
                <div className="form-field">
                  <label>Platform (Optional)</label>
                  <select
                    value={formData.platform || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, platform: e.target.value }))}
                  >
                    <option value="">Select platform</option>
                    <option value="Coursera">Coursera</option>
                    <option value="edX">edX</option>
                    <option value="Udemy">Udemy</option>
                    <option value="Udacity">Udacity</option>
                    <option value="Khan Academy">Khan Academy</option>
                    <option value="LinkedIn Learning">LinkedIn Learning</option>
                    <option value="Pluralsight">Pluralsight</option>
                    <option value="Skillshare">Skillshare</option>
                    <option value="FreeCodeCamp">FreeCodeCamp</option>
                    <option value="MIT OpenCourseWare">MIT OpenCourseWare</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              )}

              <div className="form-field">
                <label>Description (Optional)</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Add a description..."
                  rows={3}
                />
              </div>

              <div className="form-actions">
                <button type="submit" className="add-to-queue-btn">
                  <Plus size={18} />
                  <span>Add to Queue</span>
                </button>
                <button type="button" className="done-btn" onClick={handleAddAndClose} disabled={isSubmitting}>
                  <Check size={18} />
                  <span>{isSubmitting ? 'Adding...' : 'Done'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="add-item-sidebar">
          <div className="queue-section">
            <div className="queue-header">
              <h2 className="section-heading">Queue</h2>
              <span className="queue-count">{addedItems.length} items</span>
            </div>

            {addedItems.length === 0 ? (
              <div className="queue-empty">
                <BookOpen size={48} />
                <p>No items in queue</p>
                <span>Add items to see them here</span>
              </div>
            ) : (
              <div className="queue-list">
                {addedItems.map((item) => {
                  const ItemIcon = getItemIcon(item.item_type);
                  return (
                    <div key={item.tempId} className="queue-item">
                      <div className="queue-item-icon">
                        <ItemIcon size={18} />
                      </div>
                      <div className="queue-item-info">
                        <div className="queue-item-title">{item.title}</div>
                        <div className="queue-item-type">{item.item_type.replace('_', ' ')}</div>
                      </div>
                      <button
                        className="queue-item-remove"
                        onClick={() => handleRemoveFromQueue(item.tempId)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {addedItems.length > 0 && (
              <button 
                className="submit-all-btn" 
                onClick={handleSubmitAll}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  'Adding Items...'
                ) : (
                  <>
                    <Check size={18} />
                    <span>Add {addedItems.length} Item{addedItems.length > 1 ? 's' : ''} to Playlist</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

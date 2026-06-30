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
        navigate(`/playlists/${data.uid || data.id}`);
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
      <svg className="pdp-geo-bg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1400 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <circle cx="1150" cy="180" r="460" fill="none" stroke="currentColor" strokeWidth="1"/>
        <circle cx="1150" cy="180" r="310" fill="none" stroke="currentColor" strokeWidth="0.6"/>
        <circle cx="1150" cy="180" r="170" fill="none" stroke="currentColor" strokeWidth="0.4"/>
        <circle cx="180" cy="720" r="280" fill="none" stroke="currentColor" strokeWidth="0.6"/>
        <circle cx="180" cy="720" r="160" fill="none" stroke="currentColor" strokeWidth="0.4"/>
        <line x1="0" y1="0" x2="1400" y2="900" stroke="currentColor" strokeWidth="0.4"/>
        <line x1="0" y1="900" x2="750" y2="0" stroke="currentColor" strokeWidth="0.3"/>
        <circle cx="1150" cy="180" r="4" fill="currentColor" opacity="0.5"/>
        <circle cx="180" cy="720" r="3" fill="currentColor" opacity="0.5"/>
        <circle cx="700" cy="450" r="2.5" fill="currentColor" opacity="0.4"/>
        <circle cx="400" cy="130" r="2" fill="currentColor" opacity="0.3"/>
        <circle cx="1050" cy="700" r="2" fill="currentColor" opacity="0.3"/>
      </svg>
      <div className="shc-topbar">
        <div className="shc-tagline"><span>LEARNING,</span> UNIFIED</div>
        <div className="shc-topbar-right">
          <button className="shc-top-btn" type="button" onClick={() => navigate('/playlists')}>Playlists</button>
          <button className="shc-top-btn" type="button" onClick={() => navigate('/dashboard-cerbyl')}>Dashboard</button>
        </div>
      </div>
      <div className="detail-main">

      <div className="detail-header">
        <div className="header-content">
          <div className="header-meta">
            <span className="meta-badge meta-badge--kicker">Learning Playlist</span>
            <span className="meta-badge">
              {playlist.is_public ? <Globe size={12} /> : <Lock size={12} />}
              {playlist.is_public ? 'Public' : 'Private'}
            </span>
            {playlist.category && (
              <span className="meta-badge category">{playlist.category}</span>
            )}
          </div>

          <h1 className="header-title">{playlist.title}</h1>
          {playlist.description && <p className="header-description">{playlist.description}</p>}

          <div className="header-stats">
            <div className="stat-item">
              <BookOpen size={14} />
              <span>{playlist.items?.length || 0} items</span>
            </div>
            <div className="stat-item">
              <Users size={14} />
              <span>{playlist.follower_count || 0} followers</span>
            </div>
            {playlist.estimated_hours > 0 && (
              <div className="stat-item">
                <Clock size={14} />
                <span>{playlist.estimated_hours}h</span>
              </div>
            )}
            <div className="stat-item stat-creator">
              {playlist.creator.picture_url ? (
                <img src={playlist.creator.picture_url} alt="" className="creator-img" />
              ) : (
                <div className="creator-avatar">
                  {(playlist.creator.first_name?.[0] || playlist.creator.username[0]).toUpperCase()}
                </div>
              )}
              <span>by {playlist.creator.first_name || playlist.creator.username}</span>
            </div>
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

          <div className="header-actions">
            {playlist.is_owner ? (
              <>
                <button className="ha-btn ha-btn--primary" type="button" onClick={() => setShowAddItemModal(true)}>
                  <Plus size={14} /> Add Item
                </button>
                <button className="ha-btn" type="button" onClick={() => setShowShareModal(true)}>
                  <Share2 size={14} /> Share
                </button>
                <button className="ha-btn ha-btn--danger" type="button" onClick={handleDeletePlaylist} disabled={deleteLoading}>
                  <Trash2 size={14} /> {deleteLoading ? 'Deleting…' : 'Delete'}
                </button>
              </>
            ) : (
              <>
                <button
                  className={`ha-btn ${isFollowing ? 'ha-btn--success' : 'ha-btn--primary'}`}
                  type="button" onClick={handleFollowToggle} disabled={followLoading}
                >
                  {isFollowing ? <Check size={14} /> : <Heart size={14} />}
                  {followLoading ? '…' : isFollowing ? 'Following' : 'Follow'}
                </button>
                <button className="ha-btn" type="button" onClick={() => setShowShareModal(true)}>
                  <Share2 size={14} /> Share
                </button>
                <button className="ha-btn" type="button" onClick={handleForkPlaylist} disabled={forkLoading}>
                  <GitFork size={14} /> {forkLoading ? 'Forking…' : 'Fork'}
                </button>
              </>
            )}
            <span className="ha-sep" />
            <button className="ha-btn ha-btn--ai" type="button" onClick={handleGenerateNotes} disabled={aiLoading.notes || allItems.length === 0}>
              {aiLoading.notes ? <span className="detail-btn-spinner" /> : <FileText size={14} />} Notes
            </button>
            <button className="ha-btn ha-btn--ai" type="button" onClick={handleGenerateFlashcards} disabled={aiLoading.flashcards || allItems.length === 0}>
              {aiLoading.flashcards ? <span className="detail-btn-spinner" /> : <Zap size={14} />} Flashcards
            </button>
            <button className="ha-btn ha-btn--ai" type="button" onClick={handleAskAI}>
              <Sparkles size={14} /> Ask AI
            </button>
          </div>
        </div>
      </div>

      {aiResult && (
        <div className={`pdp-ai-toast ${aiResult.status}`}>
          <Sparkles size={15} />
          {aiResult.status === 'success' ? (
            <>
              <span>AI {aiResult.type === 'notes' ? 'notes' : 'flashcards'} ready —</span>
              {aiResult.type === 'notes' && aiResult.noteId && (
                <button className="pdp-toast-link" onClick={() => navigate(`/notes/editor/${aiResult.noteId}`)}>Open Notes</button>
              )}
              {aiResult.type === 'flashcards' && (
                <button className="pdp-toast-link" onClick={() => navigate('/flashcards')}>Open Flashcards</button>
              )}
            </>
          ) : (
            <span>{aiResult.message}</span>
          )}
          <button className="pdp-toast-close" onClick={() => setAiResult(null)}><X size={13} /></button>
        </div>
      )}

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
            <div className="empty-icon-ring">
              <div className="empty-icon-inner">
                <BookOpen size={30} strokeWidth={1.5} />
              </div>
            </div>
            <span className="empty-kicker">
              {allItems.length > 0 ? 'Filter Results' : 'Empty Collection'}
            </span>
            <h3 className="empty-title">
              {allItems.length > 0 ? 'No Matches Found' : 'No Items Yet'}
            </h3>
            <p className="empty-sub">
              {allItems.length > 0
                ? 'Try adjusting your filters to find what you\'re looking for'
                : playlist.is_owner
                  ? 'Start building your playlist — add notes, videos, quizzes and more'
                  : 'This playlist hasn\'t been populated yet'}
            </p>
            {allItems.length > 0 && (
              <button className="empty-action-btn" onClick={() => {
                setItemFilter('all');
                setShowOnlyRequired(false);
              }}>
                Clear Filters
              </button>
            )}
          </div>
        )}
      </div>
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
      <div className="ai-header">
        <div className="ai-header-left">
          <span className="ai-kicker">Playlist</span>
          <h1 className="ai-title">Add Items</h1>
        </div>
        <button className="ai-close" type="button" onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      <div className="add-item-body">
        <div className="add-item-main">
          <div className="add-item-form-section">
            <div className="ai-section-head">
              <span className="ai-section-kicker">Step 1</span>
              <h2 className="ai-section-title">Choose & Configure</h2>
            </div>
            
            <form onSubmit={handleAddToQueue} className="add-item-form">
              <div className="form-field">
                <label className="ai-field-label">Item Type</label>
                <div className="ai-type-chips">
                  {itemTypes.map(type => {
                    const Icon = type.icon;
                    return (
                      <button
                        key={type.value}
                        type="button"
                        className={`ai-type-chip ${itemType === type.value ? 'active' : ''}`}
                        onClick={() => {
                          setItemType(type.value);
                          setFormData({ title: '', url: '', description: '', is_required: true, notes: '', item_id: null, platform: '' });
                        }}
                      >
                        <Icon size={15} />
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
              <div className="ai-section-head">
                <span className="ai-section-kicker">Step 2</span>
                <h2 className="ai-section-title">Queue</h2>
              </div>
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

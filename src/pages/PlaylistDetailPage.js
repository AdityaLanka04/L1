import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Plus, Edit3, Trash2, Check, Users, Clock, BookOpen,
  FileText, MessageSquare, ExternalLink, Youtube, FileUp, Link as LinkIcon,
  ChevronDown, ChevronUp, Share2, Heart, Lock, Globe, GraduationCap
} from 'lucide-react';
import './PlaylistDetailPage.css';
import { API_URL } from '../config';

const PlaylistDetailPage = () => {
  const { playlistId } = useParams();
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const userName = localStorage.getItem('username');
  
  const [playlist, setPlaylist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingItem, setViewingItem] = useState(null);
  const [itemContent, setItemContent] = useState(null);
  const [expandedItems, setExpandedItems] = useState({});
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  useEffect(() => {
    fetchPlaylistDetails();
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
    } catch (error) {
      console.error('Error fetching playlist:', error);
    } finally {
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
    } catch (error) {
      console.error('Error toggling follow:', error);
    } finally {
      setFollowLoading(false);
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
    } catch (error) {
      console.error('Error adding item:', error);
    }
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
    } catch (error) {
      console.error('Error deleting item:', error);
    }
  };

  const toggleItem = (itemId) => {
    setExpandedItems(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  const handleOpenItem = async (item) => {
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
        } catch (error) {
          console.error('Error loading item:', error);
        }
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
      quiz: BookOpen
    };
    return icons[type] || BookOpen;
  };

  if (loading) {
    return (
      <div className="detail-loading">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="detail-error">
        <h2>Playlist not found</h2>
        <button onClick={() => navigate('/playlists')} className="error-back-btn">
          <ArrowLeft size={18} />
          Back to Playlists
        </button>
      </div>
    );
  }

  const completedItems = playlist.user_progress?.completed_items || [];
  const progressPercentage = playlist.items?.length > 0 
    ? (completedItems.length / playlist.items.length) * 100 
    : 0;

  return (
    <div className="playlist-detail-container">
      {/* Top Bar */}
      <div className="detail-topbar">
        <div className="topbar-left">
          <button className="back-button" onClick={() => navigate('/playlists')}>
            <ArrowLeft size={18} />
            <span>Back</span>
          </button>
          <div className="topbar-divider"></div>
          <div className="breadcrumb">
            <span className="breadcrumb-link" onClick={() => navigate('/playlists')}>
              Playlists
            </span>
            <span className="breadcrumb-separator">/</span>
            <span className="breadcrumb-current">{playlist.title}</span>
          </div>
        </div>

        <div className="topbar-actions">
          {playlist.is_owner ? (
            <>
              <button className="action-button primary" onClick={() => setShowAddItemModal(true)}>
                <Plus size={18} />
                <span>Add Item</span>
              </button>
              <button className="action-button secondary">
                <Edit3 size={18} />
              </button>
            </>
          ) : (
            <button 
              className={`action-button ${isFollowing ? 'following' : 'primary'}`}
              onClick={handleFollowToggle}
              disabled={followLoading}
            >
              {followLoading ? (
                'Loading...'
              ) : isFollowing ? (
                <>
                  <Check size={18} />
                  <span>Following</span>
                </>
              ) : (
                <>
                  <Heart size={18} />
                  <span>Follow</span>
                </>
              )}
            </button>
          )}
          <button className="action-button secondary">
            <Share2 size={18} />
          </button>
        </div>
      </div>

      {/* Header Section */}
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
            <span className="meta-badge category">{playlist.category}</span>
            <span className="meta-badge difficulty">{playlist.difficulty_level}</span>
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

      {/* Items Section */}
      <div className="detail-body">
        <div className="items-header">
          <h2 className="items-title">Playlist Items</h2>
          <span className="items-count">{playlist.items?.length || 0} items</span>
        </div>

        {playlist.items && playlist.items.length > 0 ? (
          <div className="items-container">
            {playlist.items.map((item, index) => {
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
            <h3>No items yet</h3>
            <p>
              {playlist.is_owner 
                ? 'Start adding items to your playlist'
                : 'This playlist is empty'}
            </p>
            {playlist.is_owner && (
              <button className="empty-btn" onClick={() => setShowAddItemModal(true)}>
                <Plus size={18} />
                Add First Item
              </button>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
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
    </div>
  );
};

export default PlaylistDetailPage;


// ==================== VIEW ITEM MODAL ====================

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
              dangerouslySetInnerHTML={{ __html: content.content || '<p>No content</p>' }}
            />
          )}

          {content.type === 'chat' && (
            <div className="chat-viewer">
              {content.messages && content.messages.length > 0 ? (
                content.messages.map((msg, index) => (
                  <div key={index} className="chat-pair">
                    <div className="chat-msg user-msg">
                      <div className="msg-label">You</div>
                      <div className="msg-text">{msg.user_message}</div>
                    </div>
                    <div className="chat-msg ai-msg">
                      <div className="msg-label">AI</div>
                      <div className="msg-text">{msg.ai_response}</div>
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

// ==================== ADD ITEM MODAL ====================

const AddItemModal = ({ onClose, onAdd }) => {
  const token = localStorage.getItem('token');
  const userName = localStorage.getItem('username');
  const [itemType, setItemType] = useState('external_link');
  const [formData, setFormData] = useState({
    title: '',
    url: '',
    description: '',
    duration_minutes: '',
    is_required: true,
    notes: '',
    item_id: null
  });

  const [userNotes, setUserNotes] = useState([]);
  const [userChats, setUserChats] = useState([]);
  const [loadingResources, setLoadingResources] = useState(false);

  useEffect(() => {
    if (itemType === 'note' || itemType === 'chat') {
      fetchUserResources();
    }
  }, [itemType]);

  const fetchUserResources = async () => {
    setLoadingResources(true);
    try {
      if (itemType === 'note') {
        const response = await fetch(`${API_URL}/get_notes?user_id=${userName}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setUserNotes(Array.isArray(data) ? data : (data.notes || []));
        }
      } else if (itemType === 'chat') {
        const response = await fetch(`${API_URL}/get_chat_sessions?user_id=${userName}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setUserChats(Array.isArray(data) ? data : (data.sessions || []));
        }
      }
    } catch (error) {
      console.error('Error fetching resources:', error);
    } finally {
      setLoadingResources(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onAdd({
      item_type: itemType,
      ...formData,
      duration_minutes: formData.duration_minutes ? parseInt(formData.duration_minutes) : null
    });
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
    { value: 'course', label: 'Course', icon: GraduationCap },
    { value: 'note', label: 'Note', icon: FileText },
    { value: 'chat', label: 'Chat', icon: MessageSquare },
    { value: 'article', label: 'Article', icon: BookOpen }
  ];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box add-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add Item to Playlist</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-field">
            <label>Item Type</label>
            <div className="type-selector">
              {itemTypes.map(type => {
                const Icon = type.icon;
                return (
                  <button
                    key={type.value}
                    type="button"
                    className={`type-option ${itemType === type.value ? 'active' : ''}`}
                    onClick={() => {
                      setItemType(type.value);
                      setFormData({
                        title: '',
                        url: '',
                        description: '',
                        duration_minutes: '',
                        is_required: true,
                        notes: '',
                        item_id: null
                      });
                    }}
                  >
                    <Icon size={18} />
                    <span>{type.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {(itemType === 'note' || itemType === 'chat') && (
            <div className="form-field">
              <label>Select {itemType === 'note' ? 'Note' : 'Chat'}</label>
              {loadingResources ? (
                <div className="loading-text">Loading...</div>
              ) : (
                <div className="resource-selector">
                  {itemType === 'note' && userNotes.map(note => (
                    <div
                      key={note.id}
                      className={`resource-option ${formData.item_id === note.id ? 'selected' : ''}`}
                      onClick={() => handleResourceSelect(note.id, note.title)}
                    >
                      <FileText size={16} />
                      <span>{note.title}</span>
                      {formData.item_id === note.id && <Check size={16} />}
                    </div>
                  ))}
                  {itemType === 'chat' && userChats.map(chat => (
                    <div
                      key={chat.id}
                      className={`resource-option ${formData.item_id === chat.id ? 'selected' : ''}`}
                      onClick={() => handleResourceSelect(chat.id, chat.title)}
                    >
                      <MessageSquare size={16} />
                      <span>{chat.title}</span>
                      {formData.item_id === chat.id && <Check size={16} />}
                    </div>
                  ))}
                  {((itemType === 'note' && userNotes.length === 0) || 
                    (itemType === 'chat' && userChats.length === 0)) && (
                    <div className="no-resources">
                      No {itemType === 'note' ? 'notes' : 'chats'} found
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {itemType !== 'note' && itemType !== 'chat' && (
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

          <div className="form-field">
            <label>Duration (minutes)</label>
            <input
              type="number"
              value={formData.duration_minutes}
              onChange={(e) => setFormData(prev => ({ ...prev, duration_minutes: e.target.value }))}
              placeholder="30"
              min="0"
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Add Item
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

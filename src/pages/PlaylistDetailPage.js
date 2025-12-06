import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Plus, Edit3, Trash2, Check, Play, Users, Clock, BookOpen,
  FileText, MessageSquare, ExternalLink, Youtube, FileUp, Link as LinkIcon,
  ChevronDown, ChevronUp, Copy, Share2, Settings, MoreVertical, Star,
  Download, Eye, Lock, Globe, Award, Target, TrendingUp, Search, Filter
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
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingItem, setViewingItem] = useState(null);
  const [itemContent, setItemContent] = useState(null);
  const [expandedItems, setExpandedItems] = useState({});
  const [activeTab, setActiveTab] = useState('items'); // items, collaborators, analytics
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');

  useEffect(() => {
    console.log('PlaylistDetailPage mounted, playlistId:', playlistId);
    console.log('Token:', token ? 'exists' : 'missing');
    fetchPlaylistDetails();
  }, [playlistId]);

  const fetchPlaylistDetails = async () => {
    console.log('Fetching playlist details for ID:', playlistId);
    setLoading(true);
    try {
      const url = `${API_URL}/playlists/${playlistId}`;
      console.log('Fetching from URL:', url);
      
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      console.log('Response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('Playlist data received:', data);
        setPlaylist(data);
      } else {
        const errorText = await response.text();
        console.error('Failed to fetch playlist:', response.status, errorText);
      }
    } catch (error) {
      console.error('Error fetching playlist:', error);
    } finally {
      setLoading(false);
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
    if (!window.confirm('Delete this item from the playlist?')) return;
    
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
    switch (item.item_type) {
      case 'note':
      case 'chat':
        // Fetch and display content in modal
        if (item.item_id) {
          try {
            const response = await fetch(
              `${API_URL}/playlists/${playlistId}/items/${item.id}/view`,
              {
                headers: { 'Authorization': `Bearer ${token}` }
              }
            );
            
            if (response.ok) {
              const data = await response.json();
              setItemContent(data);
              setViewingItem(item);
              setShowViewModal(true);
            } else {
              alert('Unable to load content');
            }
          } catch (error) {
            console.error('Error loading item:', error);
            alert('Error loading content');
          }
        }
        break;
      
      case 'youtube':
      case 'external_link':
      case 'pdf':
      case 'article':
      case 'video':
        // Open external URL in new tab
        if (item.url) {
          window.open(item.url, '_blank', 'noopener,noreferrer');
        }
        break;
      
      case 'quiz':
        // Navigate to quiz if you have a quiz system
        if (item.url) {
          window.open(item.url, '_blank', 'noopener,noreferrer');
        }
        break;
      
      default:
        // Fallback to URL if available
        if (item.url) {
          window.open(item.url, '_blank', 'noopener,noreferrer');
        }
    }
  };

  const getItemIcon = (type) => {
    const icons = {
      note: FileText,
      chat: MessageSquare,
      external_link: ExternalLink,
      youtube: Youtube,
      pdf: FileUp,
      video: Play,
      article: BookOpen,
      quiz: Target
    };
    return icons[type] || BookOpen;
  };

  const filteredItems = playlist?.items?.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         item.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterType === 'all' || item.item_type === filterType;
    return matchesSearch && matchesFilter;
  }) || [];

  if (loading) {
    return (
      <div className="playlist-detail-page loading">
        <div className="loading-spinner">Loading playlist...</div>
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="playlist-detail-page error">
        <h2>Playlist not found</h2>
        <button onClick={() => navigate('/social')} className="back-btn">
          <ArrowLeft size={20} />
          Back to Social
        </button>
      </div>
    );
  }

  const completedItems = playlist.user_progress?.completed_items || [];
  const progressPercentage = playlist.items?.length > 0 
    ? (completedItems.length / playlist.items.length) * 100 
    : 0;

  return (
    <div className="playlist-detail-page">
      {/* Header */}
      <div className="playlist-header-section">
        <button onClick={() => navigate('/social')} className="back-btn">
          <ArrowLeft size={20} />
          Back
        </button>

        <div className="playlist-hero" style={{ borderLeft: `6px solid ${playlist.cover_color}` }}>
          <div className="playlist-hero-content">
            <div className="playlist-badges">
              <span className="badge category">{playlist.category}</span>
              <span className="badge difficulty">{playlist.difficulty_level}</span>
              {playlist.is_collaborative && (
                <span className="badge collaborative">
                  <Users size={14} />
                  Collaborative
                </span>
              )}
              {!playlist.is_public && (
                <span className="badge private">
                  <Lock size={14} />
                  Private
                </span>
              )}
            </div>

            <h1 className="playlist-title">{playlist.title}</h1>
            <p className="playlist-description">{playlist.description}</p>

            <div className="playlist-meta-stats">
              <div className="meta-item">
                <BookOpen size={18} />
                <span>{playlist.items?.length || 0} items</span>
              </div>
              <div className="meta-item">
                <Clock size={18} />
                <span>{playlist.estimated_hours || 0}h</span>
              </div>
              <div className="meta-item">
                <Users size={18} />
                <span>{playlist.follower_count || 0} followers</span>
              </div>

            </div>

            <div className="playlist-creator-info">
              {playlist.creator.picture_url ? (
                <img src={playlist.creator.picture_url} alt={playlist.creator.username} />
              ) : (
                <div className="creator-avatar">
                  {(playlist.creator.first_name?.[0] || playlist.creator.username[0]).toUpperCase()}
                </div>
              )}
              <div>
                <div className="creator-name">
                  {playlist.creator.first_name || playlist.creator.username}
                </div>
                <div className="creator-username">@{playlist.creator.username}</div>
              </div>
            </div>
          </div>

          <div className="playlist-actions">
            {playlist.is_owner ? (
              <>
                <button className="action-btn primary" onClick={() => setShowAddItemModal(true)}>
                  <Plus size={18} />
                  Add Item
                </button>
                <button className="action-btn secondary" onClick={() => setShowEditModal(true)}>
                  <Edit3 size={18} />
                  Edit
                </button>
                <button className="action-btn secondary">
                  <Settings size={18} />
                  Settings
                </button>
              </>
            ) : (
              <>
                <button className="action-btn secondary">
                  <Share2 size={18} />
                  Share
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="playlist-content">
        <div className="items-section">
            {/* Search and Filter */}
            <div className="items-controls">
              <div className="search-box">
                <Search size={18} />
                <input
                  type="text"
                  placeholder="Search items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <select 
                className="filter-select"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <option value="all">All Types</option>
                <option value="note">Notes</option>
                <option value="chat">AI Chats</option>
                <option value="pdf">PDFs</option>
                <option value="youtube">YouTube</option>
                <option value="external_link">Links</option>
                <option value="article">Articles</option>
              </select>
            </div>

            {/* Items List */}
            <div className="playlist-items-list">
              {filteredItems.length > 0 ? (
                filteredItems.map((item, index) => {
                  const ItemIcon = getItemIcon(item.item_type);
                  const isCompleted = completedItems.includes(item.id);
                  const isExpanded = expandedItems[item.id];

                  return (
                    <div 
                      key={item.id} 
                      className={`playlist-item ${isCompleted ? 'completed' : ''}`}
                      onClick={() => handleOpenItem(item)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="item-header">
                        <div className="item-left">
                          <div className="item-number">{index + 1}</div>
                          <ItemIcon size={22} className="item-icon" />
                          <div className="item-info">
                            <h4 className="item-title">
                              {item.title}
                              <span className="click-hint">Click to open</span>
                            </h4>
                            <div className="item-meta">
                              <span className="item-type">{item.item_type.replace('_', ' ')}</span>
                              {item.duration_minutes && (
                                <span className="item-duration">
                                  <Clock size={12} />
                                  {item.duration_minutes} min
                                </span>
                              )}
                              {item.is_required && <span className="required-badge">Required</span>}
                            </div>
                          </div>
                        </div>

                        <div className="item-actions">
                          {/* Open button for all item types */}
                          <button
                            className="item-action-btn open"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenItem(item);
                            }}
                            title="Open resource"
                          >
                            <ExternalLink size={18} />
                          </button>

                          {playlist.is_owner && (
                            <button
                              className="item-action-btn delete"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteItem(item.id);
                              }}
                              title="Delete item"
                            >
                              <Trash2 size={18} />
                            </button>
                          )}

                          {(item.description || item.notes) && (
                            <button 
                              className="item-action-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleItem(item.id);
                              }}
                              title={isExpanded ? 'Collapse' : 'Expand'}
                            >
                              {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                            </button>
                          )}
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="item-details">
                          {item.description && (
                            <div className="item-description">
                              <strong>Description:</strong>
                              <p>{item.description}</p>
                            </div>
                          )}
                          {item.notes && (
                            <div className="item-notes">
                              <strong>Creator's Notes:</strong>
                              <p>{item.notes}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="empty-items">
                  <BookOpen size={64} />
                  <h3>No items found</h3>
                  <p>
                    {searchQuery || filterType !== 'all'
                      ? 'Try adjusting your search or filters'
                      : playlist.is_owner
                      ? 'Start adding items to your playlist'
                      : 'This playlist is empty'}
                  </p>
                  {playlist.is_owner && (
                    <button className="add-first-item-btn" onClick={() => setShowAddItemModal(true)}>
                      <Plus size={20} />
                      Add First Item
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* View Item Modal */}
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

        {/* Add Item Modal */}
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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content view-item-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>{content.title}</h2>
            <p className="view-modal-subtitle">
              {content.type === 'note' ? 'Note' : 'AI Chat Session'} • 
              Read-only view from playlist
            </p>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="view-item-content">
          {content.type === 'note' && (
            <div className="note-viewer">
              <div 
                className="note-content" 
                dangerouslySetInnerHTML={{ __html: content.content || '<p>No content</p>' }}
              />
            </div>
          )}

          {content.type === 'chat' && (
            <div className="chat-viewer">
              {content.messages && content.messages.length > 0 ? (
                content.messages.map((msg, index) => (
                  <div key={index} className="chat-message-pair">
                    <div className="user-message">
                      <div className="message-label">You</div>
                      <div className="message-text">{msg.user_message}</div>
                    </div>
                    <div className="ai-message">
                      <div className="message-label">AI Tutor</div>
                      <div className="message-text">{msg.ai_response}</div>
                    </div>
                  </div>
                ))
              ) : (
                <p>No messages in this chat</p>
              )}
            </div>
          )}
        </div>

        <div className="view-modal-footer">
          <div className="owner-info">
            Created by: <strong>{content.owner?.username || 'Unknown'}</strong>
          </div>
          <button className="btn-primary" onClick={onClose}>
            Close
          </button>
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
          console.log('Notes data received:', data);
          // The API returns the array directly, not wrapped in an object
          const notesArray = Array.isArray(data) ? data : (data.notes || []);
          console.log('Setting notes:', notesArray);
          setUserNotes(notesArray);
        }
      } else if (itemType === 'chat') {
        const response = await fetch(`${API_URL}/get_chat_sessions?user_id=${userName}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          console.log('Chats data received:', data);
          // The API returns the array directly, not wrapped in an object
          const chatsArray = Array.isArray(data) ? data : (data.sessions || []);
          console.log('Setting chats:', chatsArray);
          setUserChats(chatsArray);
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
    { value: 'external_link', label: 'External Link', icon: LinkIcon },
    { value: 'youtube', label: 'YouTube Video', icon: Youtube },
    { value: 'pdf', label: 'PDF Document', icon: FileUp },
    { value: 'note', label: 'My Note', icon: FileText },
    { value: 'chat', label: 'AI Chat Session', icon: MessageSquare },
    { value: 'article', label: 'Article', icon: BookOpen },
    { value: 'video', label: 'Video', icon: Play },
    { value: 'quiz', label: 'Quiz', icon: Target }
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content add-item-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add Item to Playlist</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="add-item-form">
          {/* Item Type Selection */}
          <div className="form-group">
            <label>Item Type *</label>
            <div className="item-type-grid">
              {itemTypes.map(type => {
                const Icon = type.icon;
                return (
                  <button
                    key={type.value}
                    type="button"
                    className={`item-type-btn ${itemType === type.value ? 'active' : ''}`}
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
                    <Icon size={24} />
                    <span>{type.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Resource Selection for Notes/Chats */}
          {(itemType === 'note' || itemType === 'chat') && (
            <div className="form-group">
              <label>Select {itemType === 'note' ? 'Note' : 'Chat Session'} *</label>
              {loadingResources ? (
                <div className="loading-resources">Loading...</div>
              ) : (
                <div className="resource-list">
                  {console.log('Rendering notes, userNotes:', userNotes, 'length:', userNotes.length)}
                  {itemType === 'note' && userNotes.map(note => (
                    <div
                      key={note.id}
                      className={`resource-item ${formData.item_id === note.id ? 'selected' : ''}`}
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
                      className={`resource-item ${formData.item_id === chat.id ? 'selected' : ''}`}
                      onClick={() => handleResourceSelect(chat.id, chat.title)}
                    >
                      <MessageSquare size={18} />
                      <span>{chat.title}</span>
                      {formData.item_id === chat.id && <Check size={18} />}
                    </div>
                  ))}
                  {((itemType === 'note' && userNotes.length === 0) || 
                    (itemType === 'chat' && userChats.length === 0)) && (
                    <div className="no-resources">
                      No {itemType === 'note' ? 'notes' : 'chat sessions'} found
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Title */}
          {itemType !== 'note' && itemType !== 'chat' && (
            <div className="form-group">
              <label>Title *</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Enter item title"
                required
              />
            </div>
          )}

          {/* URL */}
          {(itemType === 'external_link' || itemType === 'youtube' || itemType === 'pdf' || 
            itemType === 'article' || itemType === 'video') && (
            <div className="form-group">
              <label>URL *</label>
              <input
                type="url"
                value={formData.url}
                onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
                placeholder={
                  itemType === 'youtube' 
                    ? 'https://youtube.com/watch?v=...' 
                    : 'https://example.com'
                }
                required
              />
            </div>
          )}

          {/* Description */}
          <div className="form-group">
            <label>Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe what learners will gain from this resource..."
              rows={3}
            />
          </div>

          {/* Duration */}
          <div className="form-row">
            <div className="form-group">
              <label>Duration (minutes)</label>
              <input
                type="number"
                value={formData.duration_minutes}
                onChange={(e) => setFormData(prev => ({ ...prev, duration_minutes: e.target.value }))}
                placeholder="30"
                min="0"
              />
            </div>

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={formData.is_required}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_required: e.target.checked }))}
                />
                <span>Required item</span>
              </label>
            </div>
          </div>

          {/* Creator Notes */}
          <div className="form-group">
            <label>Your Notes (for learners)</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Add any tips, context, or guidance for learners..."
              rows={2}
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              <Plus size={18} />
              Add Item
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

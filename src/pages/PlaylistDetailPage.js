import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Plus, Trash2, Check, Users, Clock, BookOpen, X,
  FileText, MessageSquare, ExternalLink, Youtube, FileUp, Link as LinkIcon,
  ChevronDown, ChevronUp, ChevronRight, Share2, Heart, Lock, Globe, GraduationCap
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
          <span>Back to Playlists</span>
          <ChevronRight size={18} />
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
        </div>

        <div className="topbar-right">
          {playlist.is_owner ? (
            <>
              <button className="action-button primary" onClick={() => setShowAddItemModal(true)}>
                <Plus size={18} />
                <span>Add Item</span>
              </button>
              <button className="action-button secondary">
                <Share2 size={18} />
              </button>
            </>
          ) : (
            <>
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
              <button className="action-button secondary">
                <Share2 size={18} />
              </button>
            </>
          )}
          <button className="back-button" onClick={() => navigate('/playlists')}>
            <span>Playlists</span>
            <ChevronRight size={14} />
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
            {playlist.category && (
              <span className="meta-badge category">{playlist.category}</span>
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

// ==================== ADD ITEM MODAL - FULL PAGE DESIGN ====================

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
    } catch (error) {
          } finally {
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
    
    // Reset form
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
    } catch (error) {
          } finally {
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
    } catch (error) {
          } finally {
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
                        // Clean up the title: remove "Flashcards:", "AI Generated", " : ", and capitalize first letter
                        let cleanTitle = (flashcard.title || flashcard.name || '')
                          .replace(/^(Flashcards?:\s*|AI Generated\s*|ai generated\s*)/gi, '')
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

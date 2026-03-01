import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Menu, Search, Plus, MessageSquare, FileText, Eye, Edit3, 
  Trash2, Clock, Share2, Users, ChevronLeft
} from 'lucide-react';
import ShareModal from './SharedModal';
import './SharedPage.css';
import { API_URL } from '../config';

const SharedPage = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const [userId, setUserId] = useState(null);
  const [sharedItems, setSharedItems] = useState([]);
  const [sharedFilter, setSharedFilter] = useState('all');
  const [sharedSearch, setSharedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [itemToShare, setItemToShare] = useState(null);
  
  const [myNotes, setMyNotes] = useState([]);
  const [myChats, setMyChats] = useState([]);
  const [showMyContentModal, setShowMyContentModal] = useState(false);
  const [myContentFilter, setMyContentFilter] = useState('all');

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, []);

  useEffect(() => {
    fetchUserProfile();
    fetchSharedContent();
  }, [token]);

  const fetchUserProfile = async () => {
    try {
      const response = await fetch(`${API_URL}/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setUserId(data.email || data.username);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  const fetchSharedContent = async () => {
    try {
      const response = await fetch(`${API_URL}/shared_with_me`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setSharedItems(data.shared_items || []);
      }
    } catch (error) {
      console.error('Error fetching shared content:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMyContent = async () => {
    try {
      const notesResponse = await fetch(`${API_URL}/get_notes?user_id=${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (notesResponse.ok) {
        const notesData = await notesResponse.json();
        setMyNotes(notesData);
      }

      const chatsResponse = await fetch(`${API_URL}/get_chat_sessions?user_id=${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (chatsResponse.ok) {
        const chatsData = await chatsResponse.json();
        setMyChats(chatsData.sessions || []);
      }
    } catch (error) {
      console.error('Error fetching my content:', error);
    }
  };

  const handleOpenSharedItem = (item) => {
    if (item.content_type === 'chat') {
      navigate(`/shared/chat/${item.content_id}`);
    } else if (item.content_type === 'note') {
      navigate(`/shared/note/${item.content_id}`);
    }
  };

  const handleDeleteSharedAccess = async (shareId) => {
    if (!window.confirm('Remove this shared item? You will no longer have access to it.')) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/remove_shared_access/${shareId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        setSharedItems(prev => prev.filter(item => item.id !== shareId));
      }
    } catch (error) {
      console.error('Error deleting shared access:', error);
    }
  };

  const handleShareNewContent = async () => {
    await fetchMyContent();
    setShowMyContentModal(true);
  };

  const handleSelectItemToShare = (item, type) => {
    setItemToShare({
      id: item.id,
      title: item.title,
      type: type
    });
    setShowMyContentModal(false);
    setShareModalOpen(true);
  };

  const handleShareSuccess = () => {
    fetchSharedContent();
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined 
    });
  };

  const getFilteredSharedItems = () => {
    let filtered = sharedItems;

    if (sharedFilter !== 'all') {
      filtered = filtered.filter(item => item.content_type === sharedFilter);
    }

    if (sharedSearch) {
      filtered = filtered.filter(item =>
        item.title.toLowerCase().includes(sharedSearch.toLowerCase()) ||
        item.shared_by.username.toLowerCase().includes(sharedSearch.toLowerCase()) ||
        (item.shared_by.first_name && item.shared_by.first_name.toLowerCase().includes(sharedSearch.toLowerCase()))
      );
    }

    return filtered;
  };

  const getFilteredMyContent = () => {
    if (myContentFilter === 'notes') return myNotes;
    if (myContentFilter === 'chats') return myChats;
    return [...myNotes.map(n => ({...n, type: 'note'})), ...myChats.map(c => ({...c, type: 'chat'}))];
  };

  const filteredSharedItems = getFilteredSharedItems();
  const filteredMyContent = getFilteredMyContent();

  if (loading) {
    return (
      <div className="sp-page">
        <div className="sp-loading-text">Loading shared content...</div>
      </div>
    );
  }

  return (
    <div className="sp-page">
      <header className="sp-header">
        <div className="sp-header-left">
          <button className="sp-nav-menu-btn" onClick={() => window.openGlobalNav && window.openGlobalNav()} aria-label="Open navigation">
            <Menu size={20} />
          </button>
          <h1 className="sp-logo" onClick={() => navigate('/search-hub')}>
            <div className="sp-logo-img" />
            cerbyl
          </h1>
          <div className="sp-header-divider"></div>
          <span className="sp-subtitle">SHARED CONTENT</span>
        </div>
        <nav className="sp-header-right">
          <button className="sp-nav-btn sp-nav-btn-ghost" onClick={() => navigate('/social')}>
            <ChevronLeft size={16} />
            Back to Social
          </button>
          <button className="sp-nav-btn sp-nav-btn-ghost" onClick={() => navigate('/dashboard')}>
            Dashboard
          </button>
        </nav>
      </header>

      <div className="sp-content-section">
        <div className="sp-section-header">
          <div className="sp-header-title-group">
            <Share2 size={32} className="sp-header-icon" />
            <div>
              <h2 className="sp-section-title">Shared with Me</h2>
              <p className="sp-section-description">Content shared by your friends and collaborators</p>
            </div>
          </div>
          <button 
            className="sp-share-new-content-btn"
            onClick={handleShareNewContent}
          >
            <Plus size={20} />
            <span>Share New Content</span>
          </button>
        </div>

        <div className="sp-controls">
          <div className="sp-search-container">
            <Search size={20} />
            <input
              type="text"
              placeholder="Search shared content..."
              value={sharedSearch}
              onChange={(e) => setSharedSearch(e.target.value)}
              className="sp-search-input"
            />
          </div>

          <div className="sp-filter-buttons">
            <button
              className={`sp-filter-btn ${sharedFilter === 'all' ? 'active' : ''}`}
              onClick={() => setSharedFilter('all')}
            >
              All
            </button>
            <button
              className={`sp-filter-btn ${sharedFilter === 'chat' ? 'active' : ''}`}
              onClick={() => setSharedFilter('chat')}
            >
              <MessageSquare size={14} />
              Chats
            </button>
            <button
              className={`sp-filter-btn ${sharedFilter === 'note' ? 'active' : ''}`}
              onClick={() => setSharedFilter('note')}
            >
              <FileText size={14} />
              Notes
            </button>
          </div>
        </div>

        {filteredSharedItems.length === 0 ? (
          <div className="sp-empty-state">
            <Share2 size={64} className="sp-empty-icon" />
            <h3 className="sp-empty-title">
              {sharedSearch || sharedFilter !== 'all'
                ? 'No shared content found'
                : 'No shared content yet'}
            </h3>
            <p className="sp-empty-description">
              {sharedSearch || sharedFilter !== 'all'
                ? 'Try adjusting your search or filters'
                : 'When friends share notes or AI chats with you, they will appear here'}
            </p>
          </div>
        ) : (
          <div className="sp-items-grid">
            {filteredSharedItems.map((item) => (
              <div key={item.id} className="sp-item-card">
                <div className="sp-item-header">
                  <div className="sp-content-type-badge" data-type={item.content_type}>
                    {item.content_type === 'chat' ? (
                      <MessageSquare size={16} />
                    ) : (
                      <FileText size={16} />
                    )}
                    <span>{item.content_type === 'chat' ? 'AI Chat' : 'Note'}</span>
                  </div>
                  
                  <div className="sp-permission-badge" data-permission={item.permission}>
                    {item.permission === 'view' ? (
                      <Eye size={14} />
                    ) : (
                      <Edit3 size={14} />
                    )}
                    <span>{item.permission === 'view' ? 'View' : 'Edit'}</span>
                  </div>
                </div>

                <div className="sp-item-content">
                  <h3 className="sp-item-title">{item.title}</h3>
                  
                  {item.message && (
                    <p className="sp-share-message">
                      "{item.message}"
                    </p>
                  )}

                  <div className="sp-shared-by">
                    <div className="sp-shared-by-avatar">
                      {item.shared_by.picture_url ? (
                        <img src={item.shared_by.picture_url} alt={item.shared_by.username} />
                      ) : (
                        <div className="sp-shared-by-avatar-placeholder">
                          {(item.shared_by.first_name?.[0] || item.shared_by.username[0]).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="sp-shared-by-info">
                      <span className="sp-shared-by-text">Shared by</span>
                      <span className="sp-shared-by-name">
                        {item.shared_by.first_name && item.shared_by.last_name
                          ? `${item.shared_by.first_name} ${item.shared_by.last_name}`
                          : item.shared_by.username}
                      </span>
                    </div>
                  </div>

                  <div className="sp-meta">
                    <div className="sp-meta-item">
                      <Clock size={12} />
                      <span>{formatDate(item.shared_at)}</span>
                    </div>
                  </div>
                </div>

                <div className="sp-item-footer">
                  <button 
                    className="sp-item-action-btn sp-open"
                    onClick={() => handleOpenSharedItem(item)}
                  >
                    {item.permission === 'view' ? (
                      <>
                        <Eye size={16} />
                        <span>View</span>
                      </>
                    ) : (
                      <>
                        <Edit3 size={16} />
                        <span>Open</span>
                      </>
                    )}
                  </button>
                  
                  <button 
                    className="sp-item-action-btn sp-remove"
                    onClick={() => handleDeleteSharedAccess(item.id)}
                    title="Remove from your shared items"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showMyContentModal && (
        <div className="sp-modal-overlay" onClick={() => setShowMyContentModal(false)}>
          <div className="sp-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="sp-modal-header">
              <h2>Select Content to Share</h2>
              <button className="sp-modal-close" onClick={() => setShowMyContentModal(false)}>
                <Trash2 size={20} />
              </button>
            </div>

            <div className="sp-modal-filters">
              <button
                className={`sp-filter-btn ${myContentFilter === 'all' ? 'active' : ''}`}
                onClick={() => setMyContentFilter('all')}
              >
                All
              </button>
              <button
                className={`sp-filter-btn ${myContentFilter === 'notes' ? 'active' : ''}`}
                onClick={() => setMyContentFilter('notes')}
              >
                <FileText size={14} />
                Notes
              </button>
              <button
                className={`sp-filter-btn ${myContentFilter === 'chats' ? 'active' : ''}`}
                onClick={() => setMyContentFilter('chats')}
              >
                <MessageSquare size={14} />
                Chats
              </button>
            </div>

            <div className="sp-my-content-list">
              {filteredMyContent.length === 0 ? (
                <div className="sp-empty-content">
                  No {myContentFilter === 'all' ? 'content' : myContentFilter} available to share
                </div>
              ) : (
                filteredMyContent.map((item) => (
                  <div
                    key={item.id}
                    className="sp-content-item"
                    onClick={() => handleSelectItemToShare(item, item.type || (myContentFilter === 'notes' ? 'note' : 'chat'))}
                  >
                    <div className="sp-content-item-icon">
                      {(item.type === 'note' || myContentFilter === 'notes') ? (
                        <FileText size={20} />
                      ) : (
                        <MessageSquare size={20} />
                      )}
                    </div>
                    <div className="sp-content-item-info">
                      <h4>{item.title}</h4>
                      <p>{(item.type === 'note' || myContentFilter === 'notes') ? 'Note' : 'AI Chat'}</p>
                    </div>
                    <div className="sp-content-item-share-icon">
                      <Share2 size={20} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {shareModalOpen && itemToShare && (
        <ShareModal
          isOpen={shareModalOpen}
          onClose={() => {
            setShareModalOpen(false);
            setItemToShare(null);
          }}
          itemType={itemToShare.type}
          itemId={itemToShare.id}
          itemTitle={itemToShare.title}
          onShare={handleShareSuccess}
        />
      )}
    </div>
  );
};

export default SharedPage;

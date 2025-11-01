import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, MessageSquare, Share2, TrendingUp, Search, UserPlus, Check, X, UserMinus, FileText, Eye, Edit3, Trash2, Clock, Plus } from 'lucide-react';
import ShareModal from './SharedModal';
import './Social.css';
import { API_URL } from '../config';
const Social = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const [userName, setUserName] = useState('User');
  const [userId, setUserId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [friendRequests, setFriendRequests] = useState({ received: [], sent: [] });
  const [friends, setFriends] = useState([]);
  const [sharedItems, setSharedItems] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeTab, setActiveTab] = useState('hub');
  const [sharedFilter, setSharedFilter] = useState('all');
  const [sharedSearch, setSharedSearch] = useState('');
  
  // Share Modal State
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [itemToShare, setItemToShare] = useState(null);
  
  // My Content State (for sharing)
  const [myNotes, setMyNotes] = useState([]);
  const [myChats, setMyChats] = useState([]);
  const [showMyContentModal, setShowMyContentModal] = useState(false);
  const [myContentFilter, setMyContentFilter] = useState('all'); // 'all', 'notes', 'chats'

  useEffect(() => {
    fetchUserProfile();
    fetchFriendRequests();
    fetchFriends();
    fetchSharedContent();
  }, [token]);

  const fetchUserProfile = async () => {
    try {
      const response = await fetch('${API_URL}/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setUserName(data.first_name || 'User');
        setUserId(data.email || data.username);
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  };

  const fetchFriendRequests = async () => {
    try {
      const response = await fetch('${API_URL}/friend_requests', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setFriendRequests(data);
      }
    } catch (error) {
      console.error('Error fetching friend requests:', error);
    }
  };

  const fetchFriends = async () => {
    try {
      const response = await fetch('${API_URL}/friends', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setFriends(data.friends);
      }
    } catch (error) {
      console.error('Error fetching friends:', error);
    }
  };

  const fetchSharedContent = async () => {
  try {
    console.log('🔄 Fetching shared content...');
    const token = localStorage.getItem('token');
    
    const response = await fetch('${API_URL}/shared_with_me', {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('📡 Shared content response status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Shared content data:', data);
      setSharedItems(data.shared_items || []);
    } else {
      console.error('❌ Failed to fetch shared content:', response.status);
      const errorText = await response.text();
      console.error('Error details:', errorText);
    }
  } catch (error) {
    console.error('❌ Error fetching shared content:', error);
  }
};

  const fetchMyContent = async () => {
    try {
      // Fetch notes
      const notesResponse = await fetch(`${API_URL}/get_notes?user_id=${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (notesResponse.ok) {
        const notesData = await notesResponse.json();
        setMyNotes(notesData);
      }

      // Fetch chats
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

  const handleSearch = async (query) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`${API_URL}/search_users?query=${encodeURIComponent(query)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.users);
      }
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const sendFriendRequest = async (receiverId) => {
    try {
      const response = await fetch('${API_URL}/send_friend_request', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ receiver_id: receiverId })
      });

      if (response.ok) {
        setSearchResults(prev => prev.map(user => 
          user.id === receiverId ? { ...user, request_sent: true } : user
        ));
        fetchFriendRequests();
      }
    } catch (error) {
      console.error('Error sending friend request:', error);
    }
  };

  const respondToFriendRequest = async (requestId, action) => {
    try {
      const response = await fetch('${API_URL}/respond_friend_request', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ request_id: requestId, action })
      });

      if (response.ok) {
        fetchFriendRequests();
        fetchFriends();
      }
    } catch (error) {
      console.error('Error responding to friend request:', error);
    }
  };

  const removeFriend = async (friendId) => {
    if (!window.confirm('Are you sure you want to remove this friend?')) return;
    
    try {
      const response = await fetch('${API_URL}/remove_friend', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ friend_id: friendId })
      });

      if (response.ok) {
        fetchFriends();
      }
    } catch (error) {
      console.error('Error removing friend:', error);
    }
  };

  // In Social.js - update the handleOpenSharedItem function
const handleOpenSharedItem = (item) => {
  if (item.content_type === 'chat') {
    // Navigate to AI Chat with shared content
    navigate(`/shared/chat/${item.content_id}`);
  } else if (item.content_type === 'note') {
    // Navigate to Notes with shared content
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
      console.error('Error removing shared access:', error);
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

  const handleShareSuccess = (data) => {
    console.log('Content shared successfully:', data);
    // Optionally refresh shared items or show notification
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

  const tools = [
    {
      icon: Users,
      title: 'Friend Activity',
      description: 'See what your friends are achieving. View their milestones, achievements, and give kudos.',
      path: '/activity-feed',
      id: 'activity'
    },
    {
      icon: TrendingUp,
      title: 'Leaderboards',
      description: 'Compete with friends and track your ranking. See who\'s leading in study streaks and achievements.',
      path: '/leaderboards',
      id: 'leaderboards'
    },
    {
      icon: MessageSquare,
      title: 'Quiz Battles',
      description: 'Challenge your friends to 1v1 quiz battles. Test your knowledge and compete for the top score.',
      path: '/quiz-battles',
      id: 'battles'
    },
    {
      icon: Share2,
      title: 'Shared Content',
      description: 'View and manage notes and AI chats that friends have shared with you.',
      onClick: () => setActiveTab('shared'),
      id: 'shared'
    }
  ];

  const renderUserCard = (user, actionButton) => (
    <div key={user.id} className="user-card">
      <div className="user-card-header">
        <div className="user-avatar">
          {user.picture_url ? (
            <img src={user.picture_url} alt={user.username} />
          ) : (
            <div className="user-avatar-placeholder">
              {(user.first_name?.[0] || user.username[0]).toUpperCase()}
            </div>
          )}
        </div>
        <div className="user-info">
          <h3 className="user-name">
            {user.first_name && user.last_name 
              ? `${user.first_name} ${user.last_name}` 
              : user.username}
          </h3>
          <p className="user-username">@{user.username}</p>
          {user.field_of_study && (
            <p className="user-field">{user.field_of_study}</p>
          )}
        </div>
        {actionButton}
      </div>

      {user.preferred_subjects && user.preferred_subjects.length > 0 && (
        <div className="user-subjects">
          <h4>Preferred Subjects</h4>
          <div className="subject-tags">
            {user.preferred_subjects.map((subject, idx) => (
              <span key={idx} className="subject-tag">{subject}</span>
            ))}
          </div>
        </div>
      )}

      {user.stats && (
        <div className="user-stats">
          <div className="stat-item">
            <span className="stat-value">{user.stats.total_lessons}</span>
            <span className="stat-label">Lessons</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{user.stats.total_hours}h</span>
            <span className="stat-label">Study Time</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{user.stats.day_streak}</span>
            <span className="stat-label">Day Streak</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{user.stats.accuracy_percentage}%</span>
            <span className="stat-label">Accuracy</span>
          </div>
        </div>
      )}
    </div>
  );

  const filteredSharedItems = getFilteredSharedItems();
  const filteredMyContent = getFilteredMyContent();

  return (
    <div className="hub-page">
      <header className="hub-header">
        <div className="hub-header-left">
          <h1 className="hub-logo">brainwave</h1>
          <span className="hub-subtitle">SOCIAL HUB</span>
        </div>
        <div className="hub-header-right">
          <button className="hub-nav-btn" onClick={() => navigate('/dashboard')}>Dashboard</button>
          <button className="hub-nav-btn logout" onClick={() => { localStorage.removeItem('token'); navigate('/login'); }}>Logout</button>
        </div>
      </header>

      <div className="hub-main-content">
        <div className="hub-welcome">
          <h2 className="hub-welcome-title">Welcome back, {userName}</h2>
          <p className="hub-welcome-subtitle">Connect with fellow learners and grow together</p>
          
          <div className="hub-tabs">
            <button 
              className={`hub-tab ${activeTab === 'hub' ? 'active' : ''}`}
              onClick={() => setActiveTab('hub')}
            >
              Hub
            </button>
            <button 
              className={`hub-tab ${activeTab === 'search' ? 'active' : ''}`}
              onClick={() => setActiveTab('search')}
            >
              Find Friends
            </button>
            <button 
              className={`hub-tab ${activeTab === 'requests' ? 'active' : ''}`}
              onClick={() => setActiveTab('requests')}
            >
              Requests {friendRequests.received.length > 0 && `(${friendRequests.received.length})`}
            </button>
            <button 
              className={`hub-tab ${activeTab === 'friends' ? 'active' : ''}`}
              onClick={() => setActiveTab('friends')}
            >
              Friends ({friends.length})
            </button>
            <button 
              className={`hub-tab ${activeTab === 'shared' ? 'active' : ''}`}
              onClick={() => setActiveTab('shared')}
            >
              Shared ({sharedItems.length})
            </button>
          </div>
        </div>

        {activeTab === 'hub' && (
          <div className="hub-grid">
            {tools.map(tool => {
              const IconComponent = tool.icon;
              return (
                <div 
                  key={tool.id}
                  className="hub-card"
                  onClick={tool.onClick || (() => navigate(tool.path))}
                >
                  <div className="hub-card-header">
                    <div className="hub-card-icon">
                      <IconComponent size={48} strokeWidth={1.5} />
                    </div>
                  </div>

                  <div className="hub-card-content">
                    <h3 className="hub-card-title">{tool.title}</h3>
                    <p className="hub-card-description">{tool.description}</p>
                  </div>

                  <div className="hub-card-footer">
                    <button className="hub-card-action">EXPLORE NOW</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'search' && (
          <div className="friend-section">
            <div className="search-container">
              <Search size={20} />
              <input
                type="text"
                placeholder="Search by username or email..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="search-input"
              />
            </div>

            {isSearching && <div className="loading-text">Searching...</div>}

            <div className="users-grid">
              {searchResults.map(user => renderUserCard(user, 
                user.is_friend ? (
                  <span className="friend-badge">Friends</span>
                ) : user.request_sent ? (
                  <span className="pending-badge">Request Sent</span>
                ) : user.request_received ? (
                  <span className="pending-badge">Pending Response</span>
                ) : (
                  <button 
                    className="social-action-button add-friend"
                    onClick={(e) => {
                      e.stopPropagation();
                      sendFriendRequest(user.id);
                    }}
                  >
                    <UserPlus size={14} />
                  </button>
                )
              ))}
            </div>

            {searchQuery.length >= 2 && !isSearching && searchResults.length === 0 && (
              <div className="empty-state">No users found matching "{searchQuery}"</div>
            )}
          </div>
        )}

        {activeTab === 'requests' && (
          <div className="friend-section">
            {friendRequests.received.length > 0 && (
              <div className="requests-section">
                <h3 className="section-title">Received Requests</h3>
                <div className="users-grid">
                  {friendRequests.received.map(request => renderUserCard(request,
                    <div className="request-actions">
                      <button 
                        className="social-action-button accept"
                        onClick={() => respondToFriendRequest(request.request_id, 'accept')}
                        title="Accept"
                      >
                        <Check size={14} />
                      </button>
                      <button 
                        className="social-action-button reject"
                        onClick={() => respondToFriendRequest(request.request_id, 'reject')}
                        title="Reject"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {friendRequests.sent.length > 0 && (
              <div className="requests-section">
                <h3 className="section-title">Sent Requests</h3>
                <div className="users-grid">
                  {friendRequests.sent.map(request => renderUserCard(request,
                    <span className="pending-badge">Pending</span>
                  ))}
                </div>
              </div>
            )}

            {friendRequests.received.length === 0 && friendRequests.sent.length === 0 && (
              <div className="empty-state">No pending friend requests</div>
            )}
          </div>
        )}

        {activeTab === 'friends' && (
          <div className="friend-section">
            {friends.length > 0 ? (
              <div className="users-grid">
                {friends.map(friend => renderUserCard(friend,
                  <button 
                    className="social-action-button remove"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFriend(friend.id);
                    }}
                    title="Remove Friend"
                  >
                    <UserMinus size={14} />
                  </button>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                You haven't added any friends yet. Search for users to connect!
              </div>
            )}
          </div>
        )}

        {activeTab === 'shared' && (
          <div className="friend-section">
            <div className="shared-header-actions">
              <button 
                className="share-new-content-btn"
                onClick={handleShareNewContent}
              >
                <Plus size={20} />
                <span>Share New Content</span>
              </button>
            </div>

            <div className="shared-controls">
              <div className="search-container">
                <Search size={20} />
                <input
                  type="text"
                  placeholder="Search shared content..."
                  value={sharedSearch}
                  onChange={(e) => setSharedSearch(e.target.value)}
                  className="search-input"
                />
              </div>

              <div className="shared-filter-buttons">
                <button
                  className={`filter-btn ${sharedFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setSharedFilter('all')}
                >
                  All
                </button>
                <button
                  className={`filter-btn ${sharedFilter === 'chat' ? 'active' : ''}`}
                  onClick={() => setSharedFilter('chat')}
                >
                  <MessageSquare size={14} />
                  Chats
                </button>
                <button
                  className={`filter-btn ${sharedFilter === 'note' ? 'active' : ''}`}
                  onClick={() => setSharedFilter('note')}
                >
                  <FileText size={14} />
                  Notes
                </button>
              </div>
            </div>

            {filteredSharedItems.length === 0 ? (
              <div className="empty-state">
                {sharedSearch || sharedFilter !== 'all'
                  ? 'No shared content found matching your filters'
                  : 'No content has been shared with you yet. When friends share notes or AI chats, they will appear here.'}
              </div>
            ) : (
              <div className="shared-items-grid">
                {filteredSharedItems.map((item) => (
                  <div key={item.id} className="shared-item-card">
                    <div className="shared-item-header">
                      <div className="content-type-badge" data-type={item.content_type}>
                        {item.content_type === 'chat' ? (
                          <MessageSquare size={16} />
                        ) : (
                          <FileText size={16} />
                        )}
                        <span>{item.content_type === 'chat' ? 'AI Chat' : 'Note'}</span>
                      </div>
                      
                      <div className="permission-badge" data-permission={item.permission}>
                        {item.permission === 'view' ? (
                          <Eye size={14} />
                        ) : (
                          <Edit3 size={14} />
                        )}
                        <span>{item.permission === 'view' ? 'View' : 'Edit'}</span>
                      </div>
                    </div>

                    <div className="shared-item-content">
                      <h3 className="shared-item-title">{item.title}</h3>
                      
                      {item.message && (
                        <p className="share-message">
                          "{item.message}"
                        </p>
                      )}

                      <div className="shared-by">
                        <div className="shared-by-avatar">
                          {item.shared_by.picture_url ? (
                            <img src={item.shared_by.picture_url} alt={item.shared_by.username} />
                          ) : (
                            <div className="shared-by-avatar-placeholder">
                              {(item.shared_by.first_name?.[0] || item.shared_by.username[0]).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="shared-by-info">
                          <span className="shared-by-text">Shared by</span>
                          <span className="shared-by-name">
                            {item.shared_by.first_name && item.shared_by.last_name
                              ? `${item.shared_by.first_name} ${item.shared_by.last_name}`
                              : item.shared_by.username}
                          </span>
                        </div>
                      </div>

                      <div className="shared-meta">
                        <div className="meta-item">
                          <Clock size={12} />
                          <span>{formatDate(item.shared_at)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="shared-item-footer">
                      <button 
                        className="shared-item-action-btn open"
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
                        className="shared-item-action-btn remove"
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
        )}
      </div>

      {/* My Content Selection Modal */}
      {showMyContentModal && (
        <div className="modal-overlay" onClick={() => setShowMyContentModal(false)}>
          <div className="modal-content my-content-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Select Content to Share</h2>
              <button className="modal-close" onClick={() => setShowMyContentModal(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-filters">
              <button
                className={`filter-btn ${myContentFilter === 'all' ? 'active' : ''}`}
                onClick={() => setMyContentFilter('all')}
              >
                All
              </button>
              <button
                className={`filter-btn ${myContentFilter === 'notes' ? 'active' : ''}`}
                onClick={() => setMyContentFilter('notes')}
              >
                <FileText size={14} />
                Notes ({myNotes.length})
              </button>
              <button
                className={`filter-btn ${myContentFilter === 'chats' ? 'active' : ''}`}
                onClick={() => setMyContentFilter('chats')}
              >
                <MessageSquare size={14} />
                Chats ({myChats.length})
              </button>
            </div>

            <div className="my-content-list">
              {filteredMyContent.length === 0 ? (
                <div className="empty-content">
                  No content available to share
                </div>
              ) : (
                filteredMyContent.map((item) => (
                  <div 
                    key={`${item.type || (myContentFilter === 'notes' ? 'note' : 'chat')}-${item.id}`}
                    className="content-item"
                    onClick={() => handleSelectItemToShare(item, item.type || (myContentFilter === 'notes' ? 'note' : 'chat'))}
                  >
                    <div className="content-item-icon">
                      {(item.type === 'chat' || myContentFilter === 'chats') ? (
                        <MessageSquare size={20} />
                      ) : (
                        <FileText size={20} />
                      )}
                    </div>
                    <div className="content-item-info">
                      <h4>{item.title || 'Untitled'}</h4>
                      <p>{formatDate(item.updated_at || item.created_at)}</p>
                    </div>
                    <Share2 size={16} className="content-item-share-icon" />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
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

export default Social;
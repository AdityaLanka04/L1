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
  
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [itemToShare, setItemToShare] = useState(null);
  
  const [myNotes, setMyNotes] = useState([]);
  const [myChats, setMyChats] = useState([]);
  const [showMyContentModal, setShowMyContentModal] = useState(false);
  const [myContentFilter, setMyContentFilter] = useState('all');

  useEffect(() => {
    fetchUserProfile();
    fetchFriendRequests();
    fetchFriends();
    fetchSharedContent();
  }, [token]);

  const fetchUserProfile = async () => {
    try {
      const response = await fetch(`${API_URL}/me`, {
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
      const response = await fetch(`${API_URL}/friend_requests`, {
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
      const response = await fetch(`${API_URL}/friends`, {
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
    
    const response = await fetch(`${API_URL}/shared_with_me`, {
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
      const response = await fetch(`${API_URL}/send_friend_request`, {
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
      const response = await fetch(`${API_URL}/respond_friend_request`, {
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
      const response = await fetch(`${API_URL}/remove_friend`, {
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

const handleOpenSharedItem = (item) => {
  if (item.content_type === 'chat') {
    navigate(`/shared/chat/${item.content_id}`);
  } else if (item.content_type === 'note') {
    navigate(`/shared/note/${item.content_id}`);
  }
};

const handleDeleteSharedAccess = async (sharedItemId) => {
  if (!window.confirm('Remove this item from your shared content?')) return;
  
  try {
    const response = await fetch(`${API_URL}/delete_shared_access/${sharedItemId}`, {
      method: 'DELETE',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      setSharedItems(prev => prev.filter(item => item.id !== sharedItemId));
    }
  } catch (error) {
    console.error('Error deleting shared access:', error);
  }
};

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now - date;
    const diffInHours = diffInMs / (1000 * 60 * 60);
    const diffInDays = diffInMs / (1000 * 60 * 60 * 24);
    
    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else if (diffInDays < 7) {
      return `${Math.floor(diffInDays)}d ago`;
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const handleShareNewContent = async () => {
    await fetchMyContent();
    setShowMyContentModal(true);
  };

  const handleSelectItemToShare = (item, type) => {
    setItemToShare({
      id: item.id,
      type: type,
      title: item.title || 'Untitled'
    });
    setShowMyContentModal(false);
    setShareModalOpen(true);
  };

  const handleShareSuccess = () => {
    fetchSharedContent();
  };

  const filteredSharedItems = sharedItems.filter(item => {
    const matchesFilter = sharedFilter === 'all' || item.content_type === sharedFilter;
    const matchesSearch = !sharedSearch || 
      item.title.toLowerCase().includes(sharedSearch.toLowerCase()) ||
      (item.message && item.message.toLowerCase().includes(sharedSearch.toLowerCase())) ||
      (item.shared_by.username && item.shared_by.username.toLowerCase().includes(sharedSearch.toLowerCase()));
    
    return matchesFilter && matchesSearch;
  });

  const filteredMyContent = (() => {
    if (myContentFilter === 'all') {
      const notes = myNotes.map(note => ({ ...note, type: 'note' }));
      const chats = myChats.map(chat => ({ ...chat, type: 'chat' }));
      return [...notes, ...chats].sort((a, b) => 
        new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at)
      );
    } else if (myContentFilter === 'notes') {
      return myNotes;
    } else {
      return myChats;
    }
  })();

  if (activeTab === 'hub') {
    return (
      <div className="hub-page">
        <header className="hub-header">
          <div className="hub-header-left">
            <div className="hub-logo">cerbyl</div>
            <div className="hub-subtitle">social hub</div>
          </div>
          <div className="hub-header-right">
            <button className="hub-nav-btn" onClick={() => navigate('/dashboard')}>
              Dashboard
            </button>
            <button className="hub-nav-btn logout" onClick={() => {
              localStorage.removeItem('token');
              navigate('/');
            }}>
              Logout
            </button>
          </div>
        </header>

        <main className="hub-main-content">
          <div className="hub-grid-container">
            <div className="grid-box span-3x3 hero">
              <div className="grid-box-content">
                <div className="grid-box-title">Cerbyl</div>
                <div className="grid-box-subtitle">AI-Powered Learning</div>
              </div>
            </div>

            <div className="grid-box span-2x1 accent-bg" onClick={() => setActiveTab('friends')}>
              <div className="grid-box-content">
                <Users className="grid-box-icon" size={48} />
                <div className="grid-box-title">Friends</div>
                <div className="grid-box-subtitle">Manage Connections</div>
              </div>
            </div>

            <div className="grid-box span-1x1 white-bg" onClick={() => setActiveTab('shared')}>
              <div className="grid-box-content">
                <Share2 className="grid-box-icon" size={40} />
                <div className="grid-box-title">Shared</div>
                <div className="grid-box-subtitle">Content Hub</div>
              </div>
            </div>

            <div className="grid-box span-2x1 black-bg" onClick={() => navigate('/quiz-battles')}>
              <div className="grid-box-content">
                <MessageSquare className="grid-box-icon" size={48} />
                <div className="grid-box-title">Quiz Battles</div>
                <div className="grid-box-subtitle">Challenge Friends</div>
              </div>
            </div>

            <div className="grid-box span-1x1 dark-variant">
              <div className="grid-box-content">
                <div className="grid-box-subtitle">Games</div>
              </div>
            </div>

            <div className="grid-box span-2x2 accent-glow" onClick={() => navigate('/leaderboards')}>
              <div className="grid-box-content">
                <TrendingUp className="grid-box-icon" size={56} />
                <div className="grid-box-title">Leaderboards</div>
                <div className="grid-box-subtitle">Top Performers</div>
              </div>
            </div>

            <div className="grid-box span-1x2 white-bg">
              <div className="grid-box-content">
                <div className="grid-box-subtitle">Social Hub</div>
              </div>
            </div>

            <div className="grid-box span-2x1 dark-variant" onClick={() => navigate('/activity-feed')}>
              <div className="grid-box-content">
                <Users className="grid-box-icon" size={48} />
                <div className="grid-box-title">Activity</div>
                <div className="grid-box-subtitle">Friend Updates</div>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="hub-page">
      <header className="hub-header">
        <div className="hub-header-left">
          <div className="hub-logo">cerbyl</div>
          <div className="hub-subtitle">social hub</div>
        </div>
        <div className="hub-header-right">
          <button className="hub-nav-btn" onClick={() => setActiveTab('hub')}>
            Home
          </button>
          <button className="hub-nav-btn" onClick={() => navigate('/dashboard')}>
            Dashboard
          </button>
          <button className="hub-nav-btn logout" onClick={() => {
            localStorage.removeItem('token');
            navigate('/');
          }}>
            Logout
          </button>
        </div>
      </header>

      <div className="hub-main-content">
        {activeTab === 'friends' && (
          <div className="friend-section">
            <div className="friend-header">
              <h2>Friends & Connections</h2>
              <p>Search for users, manage friend requests, and view your connections</p>
            </div>

            <div className="search-container">
              <Search size={20} />
              <input
                type="text"
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="search-input"
              />
            </div>

            {searchQuery && searchResults.length > 0 && (
              <>
                <div className="section-title">Search Results</div>
                <div className="users-grid">
                  {searchResults.map((user) => (
                    <div key={user.id} className="user-card">
                      <div className="user-card-header">
                        <div className="user-avatar">
                          {user.picture_url ? (
                            <img src={user.picture_url} alt={user.username} />
                          ) : (
                            (user.first_name?.[0] || user.username[0]).toUpperCase()
                          )}
                        </div>
                        <div className="user-info">
                          <div className="user-name">
                            {user.first_name && user.last_name 
                              ? `${user.first_name} ${user.last_name}`
                              : user.username}
                          </div>
                          <div className="user-email">{user.email || user.username}</div>
                        </div>
                      </div>

                      <div className="user-stats">
                        <div className="stat">
                          <span className="stat-value">{user.friend_count || 0}</span>
                          <span className="stat-label">Friends</span>
                        </div>
                        <div className="stat">
                          <span className="stat-value">{user.shared_count || 0}</span>
                          <span className="stat-label">Shared</span>
                        </div>
                        <div className="stat">
                          <span className="stat-value">{user.note_count || 0}</span>
                          <span className="stat-label">Notes</span>
                        </div>
                      </div>

                      <div className="user-actions">
                        {user.is_friend ? (
                          <button className="action-btn secondary disabled">
                            <Check size={16} />
                            Friends
                          </button>
                        ) : user.request_sent ? (
                          <button className="action-btn secondary disabled">
                            <Clock size={16} />
                            Pending
                          </button>
                        ) : (
                          <button 
                            className="action-btn primary"
                            onClick={() => sendFriendRequest(user.id)}
                          >
                            <UserPlus size={16} />
                            Add Friend
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {friendRequests.received.length > 0 && (
              <>
                <div className="section-title">Friend Requests</div>
                <div className="users-grid">
                  {friendRequests.received.map((request) => (
                    <div key={request.id} className="user-card">
                      <div className="user-card-header">
                        <div className="user-avatar">
                          {request.sender.picture_url ? (
                            <img src={request.sender.picture_url} alt={request.sender.username} />
                          ) : (
                            (request.sender.first_name?.[0] || request.sender.username[0]).toUpperCase()
                          )}
                        </div>
                        <div className="user-info">
                          <div className="user-name">
                            {request.sender.first_name && request.sender.last_name
                              ? `${request.sender.first_name} ${request.sender.last_name}`
                              : request.sender.username}
                          </div>
                          <div className="user-email">{request.sender.email || request.sender.username}</div>
                        </div>
                      </div>

                      <div className="user-actions">
                        <button 
                          className="action-btn success"
                          onClick={() => respondToFriendRequest(request.id, 'accept')}
                        >
                          <Check size={16} />
                          Accept
                        </button>
                        <button 
                          className="action-btn danger"
                          onClick={() => respondToFriendRequest(request.id, 'decline')}
                        >
                          <X size={16} />
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {friends.length > 0 && (
              <>
                <div className="section-title">Your Friends ({friends.length})</div>
                <div className="users-grid">
                  {friends.map((friend) => (
                    <div key={friend.id} className="user-card">
                      <div className="user-card-header">
                        <div className="user-avatar">
                          {friend.picture_url ? (
                            <img src={friend.picture_url} alt={friend.username} />
                          ) : (
                            (friend.first_name?.[0] || friend.username[0]).toUpperCase()
                          )}
                        </div>
                        <div className="user-info">
                          <div className="user-name">
                            {friend.first_name && friend.last_name
                              ? `${friend.first_name} ${friend.last_name}`
                              : friend.username}
                          </div>
                          <div className="user-email">{friend.email || friend.username}</div>
                        </div>
                      </div>

                      <div className="user-stats">
                        <div className="stat">
                          <span className="stat-value">{friend.friend_count || 0}</span>
                          <span className="stat-label">Friends</span>
                        </div>
                        <div className="stat">
                          <span className="stat-value">{friend.shared_count || 0}</span>
                          <span className="stat-label">Shared</span>
                        </div>
                        <div className="stat">
                          <span className="stat-value">{friend.note_count || 0}</span>
                          <span className="stat-label">Notes</span>
                        </div>
                      </div>

                      <div className="user-actions">
                        <button 
                          className="action-btn danger"
                          onClick={() => removeFriend(friend.id)}
                        >
                          <UserMinus size={16} />
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {!searchQuery && friendRequests.received.length === 0 && friends.length === 0 && (
              <div className="empty-state">
                No friends yet. Search for users above to start connecting!
              </div>
            )}
          </div>
        )}

        {activeTab === 'shared' && (
          <div className="shared-content-section">
            <div className="shared-header">
              <h2>Shared Content</h2>
              <p>View and manage content shared with you by friends</p>
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

              <button className="share-new-content-btn" onClick={handleShareNewContent}>
                <Plus size={16} />
                Share New
              </button>
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
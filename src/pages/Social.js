import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, MessageSquare, Share2, TrendingUp, Search, UserPlus, Check, X, UserMinus } from 'lucide-react';
import './Social.css';

const Social = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const [userName, setUserName] = useState('User');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [friendRequests, setFriendRequests] = useState({ received: [], sent: [] });
  const [friends, setFriends] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeTab, setActiveTab] = useState('hub'); // 'hub', 'search', 'requests', 'friends'

  useEffect(() => {
    fetchUserProfile();
    fetchFriendRequests();
    fetchFriends();
  }, [token]);

  const fetchUserProfile = async () => {
    try {
      const response = await fetch('http://localhost:8001/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setUserName(data.first_name || 'User');
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  };

  const fetchFriendRequests = async () => {
    try {
      const response = await fetch('http://localhost:8001/friend_requests', {
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
      const response = await fetch('http://localhost:8001/friends', {
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

  const handleSearch = async (query) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`http://localhost:8001/search_users?query=${encodeURIComponent(query)}`, {
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
      const response = await fetch('http://localhost:8001/send_friend_request', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ receiver_id: receiverId })
      });

      if (response.ok) {
        // Update search results to reflect the sent request
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
      const response = await fetch('http://localhost:8001/respond_friend_request', {
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
      const response = await fetch('http://localhost:8001/remove_friend', {
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
      title: 'Challenges',
      description: 'Join time-limited challenges. Complete goals and compete with the community.',
      path: '/challenges',
      id: 'challenges'
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
                  onClick={() => navigate(tool.path)}
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
      </div>
    </div>
  );
};

export default Social;
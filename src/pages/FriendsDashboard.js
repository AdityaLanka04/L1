import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, Search, UserPlus, Check, X, UserMinus, ArrowLeft,
  Clock, TrendingUp, Award, Activity, Zap, MessageSquare
} from 'lucide-react';
import './FriendsDashboard.css';
import { API_URL } from '../config';

const FriendsDashboard = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const [activeView, setActiveView] = useState('my-friends');
  
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState({ received: [], sent: [] });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchFriends();
    fetchFriendRequests();
    if (activeView === 'find-friends') {
      fetchAllUsers();
    }
  }, [activeView]);

  const fetchFriends = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/friends`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        console.log('👥 Friends API response:', data);
        console.log('👥 Friends list:', data.friends);
        
        const friendsList = data.friends || [];
        
        // Enhance friends data with stats from leaderboard
        const enhancedFriends = await enhanceFriendsWithStats(friendsList);
        setFriends(enhancedFriends);
      } else {
        console.error('❌ Friends API error:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('❌ Error fetching friends:', error);
    } finally {
      setLoading(false);
    }
  };

  const enhanceFriendsWithStats = async (friendsList) => {
    if (!friendsList || friendsList.length === 0) {
      return friendsList;
    }

    try {
      console.log('🔍 Fetching stats for users:', friendsList.map(f => ({ id: f.id, email: f.email })));
      
      // Try different API parameter combinations to find what works
      let response;
      let leaderboardData;
      
      // Try 1: Without period parameter
      console.log('📡 Trying API call without period parameter...');
      response = await fetch(
        `${API_URL}/leaderboard?category=global&metric=total_hours&limit=100`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      if (!response.ok) {
        console.log('❌ Attempt 1 failed, trying with period=all_time...');
        // Try 2: With period parameter
        response = await fetch(
          `${API_URL}/leaderboard?category=global&metric=total_hours&period=all_time&limit=100`,
          { headers: { 'Authorization': `Bearer ${token}` } }
        );
      }
      
      if (!response.ok) {
        console.error('❌ Leaderboard API error:', response.status, response.statusText);
        try {
          const errorText = await response.text();
          console.error('❌ Error response:', errorText);
        } catch (e) {
          console.error('❌ Could not read error response');
        }
        return friendsList;
      }
      
      leaderboardData = await response.json();
      const leaderboard = leaderboardData.leaderboard || [];
      
      console.log('✅ Leaderboard API success!');
      console.log('📊 Leaderboard data received:', leaderboard.length, 'entries');
      if (leaderboard.length > 0) {
        console.log('📊 Sample leaderboard entry:', leaderboard[0]);
      }
      
      // Create a map of user stats - check multiple ID fields
      const statsMap = {};
      leaderboard.forEach(entry => {
        // Try different possible ID field names
        const userId = entry.user_id || entry.id || entry.userId;
        if (userId) {
          statsMap[userId] = {
            total_hours: entry.score || 0,
            rank: entry.rank,
            email: entry.email
          };
        }
      });
      
      console.log('📊 Stats map created with', Object.keys(statsMap).length, 'entries');
      if (Object.keys(statsMap).length > 0) {
        console.log('📊 Sample stats entry:', Object.entries(statsMap)[0]);
      }
      
      // Fetch lessons count
      let lessonsResponse = await fetch(
        `${API_URL}/leaderboard?category=global&metric=lessons&limit=100`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      if (!lessonsResponse.ok) {
        lessonsResponse = await fetch(
          `${API_URL}/leaderboard?category=global&metric=lessons&period=all_time&limit=100`,
          { headers: { 'Authorization': `Bearer ${token}` } }
        );
      }
      
      if (lessonsResponse.ok) {
        const lessonsData = await lessonsResponse.json();
        const lessonsLeaderboard = lessonsData.leaderboard || [];
        
        console.log('📚 Lessons data received:', lessonsLeaderboard.length, 'entries');
        
        lessonsLeaderboard.forEach(entry => {
          const userId = entry.user_id || entry.id || entry.userId;
          if (userId) {
            if (statsMap[userId]) {
              statsMap[userId].lessons = entry.score || 0;
            } else {
              statsMap[userId] = { 
                lessons: entry.score || 0,
                total_hours: 0
              };
            }
          }
        });
      } else {
        console.warn('⚠️ Lessons API error:', lessonsResponse.status);
      }
      
      // Enhance friends with stats - try multiple ID matching strategies
      const enhancedFriends = friendsList.map(friend => {
        // Try multiple ID fields
        const friendId = friend.id || friend.user_id || friend.userId;
        const stats = statsMap[friendId];
        
        console.log(`👤 User ${friend.email || friend.username}:`, {
          friendId,
          friendIdType: typeof friendId,
          hasStats: !!stats,
          stats: stats,
          statsMapKeys: Object.keys(statsMap).slice(0, 5),
          statsMapFirstKey: Object.keys(statsMap)[0],
          statsMapFirstKeyType: typeof Object.keys(statsMap)[0]
        });
        
        return {
          ...friend,
          total_hours: stats?.total_hours || 0,
          total_activities: stats?.lessons || 0,
          achievements: friend.achievements || 0,
          rank: stats?.rank
        };
      });
      
      console.log('✅ Enhanced friends:', enhancedFriends.map(f => ({ 
        email: f.email, 
        hours: f.total_hours,
        activities: f.total_activities 
      })));
      
      return enhancedFriends;
    } catch (error) {
      console.error('❌ Error fetching user stats:', error);
      console.error('❌ Error stack:', error.stack);
    }
    
    // Return original list if stats fetch fails
    console.log('⚠️ Returning original friend list without stats enhancement');
    return friendsList;
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

  const fetchAllUsers = async () => {
    try {
      setLoading(true);
      // Fetch all users by searching with empty query or common letter
      const response = await fetch(`${API_URL}/search_users?query=a`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        const sortedUsers = (data.users || []).sort((a, b) => 
          (a.username || a.email).localeCompare(b.username || b.email)
        );
        
        // Enhance users with stats
        const enhancedUsers = await enhanceFriendsWithStats(sortedUsers);
        setAllUsers(enhancedUsers);
      }
    } catch (error) {
      console.error('Error fetching all users:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchUsers = async (query) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      setIsSearching(true);
      const response = await fetch(`${API_URL}/search_users?query=${encodeURIComponent(query)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        const sortedResults = (data.users || []).sort((a, b) => 
          (a.username || a.email).localeCompare(b.username || b.email)
        );
        
        // Enhance search results with stats
        const enhancedResults = await enhanceFriendsWithStats(sortedResults);
        setSearchResults(enhancedResults);
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
        // Update the UI to show request sent
        setSearchResults(prev => prev.map(user => 
          user.id === receiverId ? { ...user, request_sent: true } : user
        ));
        setAllUsers(prev => prev.map(user => 
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

  const cancelFriendRequest = async (requestId) => {
    try {
      // Use respond endpoint with reject action to cancel sent request
      const response = await fetch(`${API_URL}/respond_friend_request`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ request_id: requestId, action: 'reject' })
      });

      if (response.ok) {
        fetchFriendRequests();
      }
    } catch (error) {
      console.error('Error canceling friend request:', error);
    }
  };

  // Helper function to render avatar with profile picture support
  const renderAvatar = (user, className = "fd-friend-avatar") => {
    // Check for picture_url (backend field) and picture (Google OAuth field)
    const profilePicture = user.picture_url || user.picture || user.profile_picture;
    const displayName = user.username || user.email || 'U';
    const initial = displayName.charAt(0).toUpperCase();

    if (profilePicture) {
      return (
        <div className={className} style={{ position: 'relative', overflow: 'hidden' }}>
          <img 
            src={profilePicture} 
            alt={displayName}
            referrerPolicy="no-referrer"
            crossOrigin="anonymous"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block'
            }}
            onError={(e) => {
              // If image fails to load, hide it and show fallback
              e.target.style.display = 'none';
              const fallback = e.target.nextSibling;
              if (fallback) fallback.style.display = 'flex';
            }}
          />
          <div style={{ 
            display: 'none',
            width: '100%',
            height: '100%',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'absolute',
            top: 0,
            left: 0
          }}>
            {initial}
          </div>
        </div>
      );
    }
    
    return (
      <div className={className}>
        {initial}
      </div>
    );
  };

  const renderSidebar = () => (
    <div className="fd-sidebar">
      <div className="fd-sidebar-header">
        <Users className="fd-sidebar-logo-icon" size={28} />
        <div className="fd-sidebar-title">Friends Hub</div>
      </div>

      <nav className="fd-sidebar-nav">
        <button 
          className={`fd-sidebar-item ${activeView === 'my-friends' ? 'active' : ''}`}
          onClick={() => setActiveView('my-friends')}
        >
          <Users size={20} />
          <span>My Friends</span>
          {friends.length > 0 && <span className="fd-badge">{friends.length}</span>}
        </button>

        <button 
          className={`fd-sidebar-item ${activeView === 'find-friends' ? 'active' : ''}`}
          onClick={() => setActiveView('find-friends')}
        >
          <Search size={20} />
          <span>Find Friends</span>
        </button>

        <button 
          className={`fd-sidebar-item ${activeView === 'requests' ? 'active' : ''}`}
          onClick={() => setActiveView('requests')}
        >
          <UserPlus size={20} />
          <span>Requests</span>
          {(friendRequests.received.length + friendRequests.sent.length) > 0 && (
            <span className="fd-badge">{friendRequests.received.length + friendRequests.sent.length}</span>
          )}
        </button>
      </nav>

      <button className="fd-sidebar-back" onClick={() => navigate('/social')}>
        <ArrowLeft size={18} />
        <span>Back to Social Hub</span>
      </button>
    </div>
  );

  const renderFriendCard = (friend) => {
    // Get stats from friend object or use defaults
    // The API should return these fields from the leaderboard or user stats endpoint
    const totalHours = friend.total_hours || friend.hours_spent || 0;
    const totalActivities = friend.total_activities || friend.activity_count || friend.lessons || 0;
    const achievements = friend.achievements || friend.total_achievements || 0;
    
    return (
      <div key={friend.id} className="fd-friend-card">
        <div className="fd-friend-header">
          {renderAvatar(friend, "fd-friend-avatar")}
          <div className="fd-friend-info">
            <h3 className="fd-friend-name">{friend.username || friend.email}</h3>
            <p className="fd-friend-email">{friend.email}</p>
          </div>
          <button 
            className="fd-action-btn remove"
            onClick={() => removeFriend(friend.id)}
            title="Remove Friend"
          >
            <UserMinus size={18} />
          </button>
        </div>
        
        <div className="fd-friend-stats">
          <div className="fd-stat-item">
            <Clock size={16} />
            <div className="fd-stat-content">
              <span className="fd-stat-value">{Math.round(totalHours)}h</span>
              <span className="fd-stat-label">Hours Spent</span>
            </div>
          </div>
          <div className="fd-stat-item">
            <Activity size={16} />
            <div className="fd-stat-content">
              <span className="fd-stat-value">{totalActivities}</span>
              <span className="fd-stat-label">Activities</span>
            </div>
          </div>
          <div className="fd-stat-item">
            <Award size={16} />
            <div className="fd-stat-content">
              <span className="fd-stat-value">{achievements}</span>
              <span className="fd-stat-label">Achievements</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderUserCard = (user) => {
    const isRequestSent = user.request_sent || friendRequests.sent.some(req => req.id === user.id);
    const isRequestReceived = friendRequests.received.some(req => req.id === user.id);
    const isFriend = user.is_friend || friends.some(f => f.id === user.id);
    
    const totalHours = user.total_hours || user.hours_spent || 0;
    const totalActivities = user.total_activities || user.activity_count || user.lessons || 0;

    return (
      <div key={user.id} className="fd-user-card">
        {renderAvatar(user, "fd-user-avatar")}
        <div className="fd-user-info">
          <h4 className="fd-user-name">{user.username || user.email}</h4>
          <p className="fd-user-email">{user.email}</p>
          {(totalHours > 0 || totalActivities > 0) && (
            <div className="fd-user-stats-preview">
              {totalHours > 0 && (
                <span className="stat-preview">
                  <Clock size={12} />
                  {Math.round(totalHours)}h
                </span>
              )}
              {totalActivities > 0 && (
                <span className="stat-preview">
                  <Activity size={12} />
                  {totalActivities}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="fd-user-actions">
          {isFriend ? (
            <span className="fd-status-badge friend">Friends</span>
          ) : isRequestSent ? (
            <span className="fd-status-badge pending">Request Sent</span>
          ) : isRequestReceived ? (
            <span className="fd-status-badge pending">Pending Response</span>
          ) : (
            <button
              className="fd-action-btn add"
              onClick={() => sendFriendRequest(user.id)}
              title="Send Friend Request"
            >
              <UserPlus size={18} />
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderMyFriends = () => (
    <div className="fd-view">
      <div className="fd-view-header">
        <div className="fd-view-title-group">
          <Users className="fd-view-icon" size={32} />
          <div>
            <h2 className="fd-view-title">My Friends</h2>
            <p className="fd-view-subtitle">Manage your connections and see their activity</p>
          </div>
        </div>
      </div>

      <div className="fd-content">
        {loading ? (
          <div className="fd-loading">Loading friends...</div>
        ) : friends.length > 0 ? (
          <div className="fd-friends-grid">
            {friends.map(friend => renderFriendCard(friend))}
          </div>
        ) : (
          <div className="fd-empty-state">
            <Users size={64} />
            <h3>No Friends Yet</h3>
            <p>Start connecting with other learners!</p>
            <button
              className="fd-btn-primary"
              onClick={() => setActiveView('find-friends')}
            >
              <Search size={18} />
              <span>Find Friends</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );

  const renderFindFriends = () => (
    <div className="fd-view">
      <div className="fd-view-header">
        <div className="fd-view-title-group">
          <Search className="fd-view-icon" size={32} />
          <div>
            <h2 className="fd-view-title">Find Friends</h2>
            <p className="fd-view-subtitle">Search and connect with other learners</p>
          </div>
        </div>
      </div>

      <div className="fd-content">
        <div className="fd-search-box">
          <Search size={20} />
          <input
            type="text"
            placeholder="Search by username or email..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              searchUsers(e.target.value);
            }}
            className="fd-search-input"
          />
        </div>

        {isSearching && <div className="fd-loading">Searching...</div>}

        <div className="fd-users-list">
          {searchQuery.length >= 2 ? (
            searchResults.length > 0 ? (
              searchResults.map(user => renderUserCard(user))
            ) : !isSearching ? (
              <div className="fd-empty-state">
                <Search size={48} />
                <p>No users found matching "{searchQuery}"</p>
              </div>
            ) : null
          ) : (
            <>
              <h3 className="fd-section-title">All Users</h3>
              {allUsers.length > 0 ? (
                allUsers.map(user => renderUserCard(user))
              ) : loading ? (
                <div className="fd-loading">Loading users...</div>
              ) : (
                <div className="fd-empty-state">
                  <Users size={48} />
                  <p>No users available</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );

  const renderRequests = () => (
    <div className="fd-view">
      <div className="fd-view-header">
        <div className="fd-view-title-group">
          <UserPlus className="fd-view-icon" size={32} />
          <div>
            <h2 className="fd-view-title">Friend Requests</h2>
            <p className="fd-view-subtitle">Manage incoming and outgoing requests</p>
          </div>
        </div>
      </div>

      <div className="fd-content">
        {friendRequests.received.length > 0 && (
          <div className="fd-requests-section">
            <h3 className="fd-section-title">Received Requests ({friendRequests.received.length})</h3>
            <div className="fd-requests-list">
              {friendRequests.received.map(request => (
                <div key={request.request_id} className="fd-request-card">
                  {renderAvatar(request, "fd-user-avatar")}
                  <div className="fd-user-info">
                    <h4 className="fd-user-name">{request.username || request.email}</h4>
                    <p className="fd-user-email">{request.email}</p>
                  </div>
                  <div className="fd-request-actions">
                    <button
                      className="fd-action-btn accept"
                      onClick={() => respondToFriendRequest(request.request_id, 'accept')}
                      title="Accept"
                    >
                      <Check size={18} />
                    </button>
                    <button
                      className="fd-action-btn reject"
                      onClick={() => respondToFriendRequest(request.request_id, 'reject')}
                      title="Reject"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {friendRequests.sent.length > 0 && (
          <div className="fd-requests-section">
            <h3 className="fd-section-title">Sent Requests ({friendRequests.sent.length})</h3>
            <div className="fd-requests-list">
              {friendRequests.sent.map(request => (
                <div key={request.request_id} className="fd-request-card">
                  {renderAvatar(request, "fd-user-avatar")}
                  <div className="fd-user-info">
                    <h4 className="fd-user-name">{request.username || request.email}</h4>
                    <p className="fd-user-email">{request.email}</p>
                  </div>
                  <div className="fd-request-actions">
                    <button
                      className="fd-action-btn cancel"
                      onClick={() => cancelFriendRequest(request.request_id)}
                      title="Cancel Request"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {friendRequests.received.length === 0 && friendRequests.sent.length === 0 && (
          <div className="fd-empty-state">
            <UserPlus size={64} />
            <h3>No Pending Requests</h3>
            <p>You don't have any friend requests at the moment</p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="fd-container">
      {renderSidebar()}
      <div className="fd-main">
        {activeView === 'my-friends' && renderMyFriends()}
        {activeView === 'find-friends' && renderFindFriends()}
        {activeView === 'requests' && renderRequests()}
      </div>
    </div>
  );
};

export default FriendsDashboard;
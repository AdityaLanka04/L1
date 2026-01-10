import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Search, UserPlus, Check, X, UserMinus, ArrowLeft, Clock, Activity, Award, ChevronRight } from 'lucide-react';
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
    if (activeView === 'find-friends') fetchAllUsers();
  }, [activeView]);

  const fetchFriends = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/friends`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (response.ok) {
        const data = await response.json();
        const friendsList = data.friends || [];
        const enhancedFriends = await enhanceFriendsWithStats(friendsList);
        setFriends(enhancedFriends);
      }
    } catch (error) {  }
    finally { setLoading(false); }
  };

  const enhanceFriendsWithStats = async (friendsList) => {
    if (!friendsList || friendsList.length === 0) return friendsList;
    try {
      let response = await fetch(`${API_URL}/leaderboard?category=global&metric=total_hours&limit=100`,
        { headers: { 'Authorization': `Bearer ${token}` } });
      if (!response.ok) return friendsList;
      const leaderboardData = await response.json();
      const leaderboard = leaderboardData.leaderboard || [];
      const statsMap = {};
      leaderboard.forEach(entry => {
        const userId = entry.user_id || entry.id;
        if (userId) statsMap[userId] = { total_hours: entry.score || 0, rank: entry.rank };
      });
      return friendsList.map(friend => ({
        ...friend,
        total_hours: statsMap[friend.id]?.total_hours || 0,
        total_activities: friend.total_activities || 0,
        achievements: friend.achievements || 0
      }));
    } catch (error) { return friendsList; }
  };


  const fetchFriendRequests = async () => {
    try {
      const response = await fetch(`${API_URL}/friend_requests`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (response.ok) { const data = await response.json(); setFriendRequests(data); }
    } catch (error) {  }
  };

  const fetchAllUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/search_users?query=a`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (response.ok) {
        const data = await response.json();
        const sortedUsers = (data.users || []).sort((a, b) => (a.username || a.email).localeCompare(b.username || b.email));
        const enhancedUsers = await enhanceFriendsWithStats(sortedUsers);
        setAllUsers(enhancedUsers);
      }
    } catch (error) {  }
    finally { setLoading(false); }
  };

  const searchUsers = async (query) => {
    if (query.length < 2) { setSearchResults([]); return; }
    try {
      setIsSearching(true);
      const response = await fetch(`${API_URL}/search_users?query=${encodeURIComponent(query)}`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (response.ok) {
        const data = await response.json();
        const sortedResults = (data.users || []).sort((a, b) => (a.username || a.email).localeCompare(b.username || b.email));
        const enhancedResults = await enhanceFriendsWithStats(sortedResults);
        setSearchResults(enhancedResults);
      }
    } catch (error) {  }
    finally { setIsSearching(false); }
  };

  const sendFriendRequest = async (receiverId) => {
    try {
      const response = await fetch(`${API_URL}/send_friend_request`, {
        method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiver_id: receiverId })
      });
      if (response.ok) {
        setSearchResults(prev => prev.map(user => user.id === receiverId ? { ...user, request_sent: true } : user));
        setAllUsers(prev => prev.map(user => user.id === receiverId ? { ...user, request_sent: true } : user));
        fetchFriendRequests();
      }
    } catch (error) {  }
  };

  const respondToFriendRequest = async (requestId, action) => {
    try {
      const response = await fetch(`${API_URL}/respond_friend_request`, {
        method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: requestId, action })
      });
      if (response.ok) { fetchFriendRequests(); fetchFriends(); }
    } catch (error) {  }
  };

  const removeFriend = async (friendId) => {
    if (!window.confirm('Are you sure you want to remove this friend?')) return;
    try {
      const response = await fetch(`${API_URL}/remove_friend`, {
        method: 'DELETE', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ friend_id: friendId })
      });
      if (response.ok) fetchFriends();
    } catch (error) {  }
  };

  const cancelFriendRequest = async (requestId) => {
    try {
      const response = await fetch(`${API_URL}/respond_friend_request`, {
        method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: requestId, action: 'reject' })
      });
      if (response.ok) fetchFriendRequests();
    } catch (error) {  }
  };

  const renderAvatar = (user, className = "fd-friend-avatar") => {
    const profilePicture = user.picture_url || user.picture || user.profile_picture;
    const displayName = user.username || user.email || 'U';
    const initial = displayName.charAt(0).toUpperCase();
    if (profilePicture) {
      return (
        <div className={className}>
          <img src={profilePicture} alt={displayName} referrerPolicy="no-referrer" className="fd-avatar-image"
            onError={(e) => { e.target.style.display = 'none'; }} />
        </div>
      );
    }
    return <div className={className}>{initial}</div>;
  };


  const renderFriendCard = (friend) => (
    <div key={friend.id} className="fd-friend-card">
      <div className="fd-friend-header">
        {renderAvatar(friend, "fd-friend-avatar")}
        <div className="fd-friend-info">
          <h3 className="fd-friend-name">{friend.username || friend.email}</h3>
          <p className="fd-friend-email">{friend.email}</p>
        </div>
        <button className="fd-action-btn remove" onClick={() => removeFriend(friend.id)} title="Remove Friend">
          <UserMinus size={18} />
        </button>
      </div>
      <div className="fd-friend-stats">
        <div className="fd-stat-item">
          <Clock size={16} />
          <span className="fd-stat-value">{Math.round(friend.total_hours || 0)}h</span>
          <span className="fd-stat-label">Hours</span>
        </div>
        <div className="fd-stat-item">
          <Activity size={16} />
          <span className="fd-stat-value">{friend.total_activities || 0}</span>
          <span className="fd-stat-label">Activities</span>
        </div>
        <div className="fd-stat-item">
          <Award size={16} />
          <span className="fd-stat-value">{friend.achievements || 0}</span>
          <span className="fd-stat-label">Achievements</span>
        </div>
      </div>
    </div>
  );

  const renderUserCard = (user) => {
    const isRequestSent = user.request_sent || friendRequests.sent.some(req => req.id === user.id);
    const isRequestReceived = friendRequests.received.some(req => req.id === user.id);
    const isFriend = user.is_friend || friends.some(f => f.id === user.id);
    return (
      <div key={user.id} className="fd-user-card">
        {renderAvatar(user, "fd-user-avatar")}
        <div className="fd-user-info">
          <h4 className="fd-user-name">{user.username || user.email}</h4>
          <p className="fd-user-email">{user.email}</p>
        </div>
        <div className="fd-user-actions">
          {isFriend ? <span className="fd-status-badge friend">Friends</span>
           : isRequestSent ? <span className="fd-status-badge pending">Request Sent</span>
           : isRequestReceived ? <span className="fd-status-badge pending">Pending</span>
           : <button className="fd-action-btn add" onClick={() => sendFriendRequest(user.id)}><UserPlus size={18} /></button>}
        </div>
      </div>
    );
  };

  return (
    <div className="fd-container">
      {/* Standardized Header */}
      <header className="hub-header">
        <div className="hub-header-left">
          <h1 className="hub-logo">cerbyl</h1>
          <div className="hub-header-divider"></div>
          <p className="hub-header-subtitle">FRIENDS</p>
        </div>
        <div className="hub-header-right">
          <button className="hub-nav-btn hub-nav-btn-ghost" onClick={() => navigate('/dashboard')}>
            <span>Dashboard</span>
            <ChevronRight size={14} />
          </button>
        </div>
      </header>

      <div className="fd-layout">
        {/* Sidebar */}
        <div className="fd-sidebar">
          <nav className="fd-sidebar-nav">
            <button className={`fd-sidebar-item ${activeView === 'my-friends' ? 'active' : ''}`} onClick={() => setActiveView('my-friends')}>
              <span className="fd-nav-icon"><Users size={20} /></span>
              <span>My Friends</span>
              {friends.length > 0 && <span className="fd-badge">{friends.length}</span>}
            </button>
            <button className={`fd-sidebar-item ${activeView === 'find-friends' ? 'active' : ''}`} onClick={() => setActiveView('find-friends')}>
              <span className="fd-nav-icon"><Search size={20} /></span>
              <span>Find Friends</span>
            </button>
            <button className={`fd-sidebar-item ${activeView === 'requests' ? 'active' : ''}`} onClick={() => setActiveView('requests')}>
              <span className="fd-nav-icon"><UserPlus size={20} /></span>
              <span>Requests</span>
              {(friendRequests.received.length + friendRequests.sent.length) > 0 && 
                <span className="fd-badge">{friendRequests.received.length + friendRequests.sent.length}</span>}
            </button>
          </nav>
          <button className="fd-sidebar-back" onClick={() => navigate('/social')}>
            <ArrowLeft size={18} /><span>Back to Social</span>
          </button>
        </div>


        {/* Main Content */}
        <div className="fd-main">
          {activeView === 'find-friends' && (
            <div className="fd-header-actions">
              <div className="fd-search">
                <span className="fd-search-icon"><Search size={16} /></span>
                <input type="text" className="fd-search-input" placeholder="Search by username or email..."
                  value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); searchUsers(e.target.value); }} />
              </div>
            </div>
          )}

          <div className="fd-content">
            {/* My Friends View */}
            {activeView === 'my-friends' && (
              loading ? <div className="fd-loading"><div className="fd-spinner"></div><p>Loading friends...</p></div>
              : friends.length > 0 ? <div className="fd-friends-grid">{friends.map(friend => renderFriendCard(friend))}</div>
              : <div className="fd-empty-state">
                  <div className="fd-empty-icon"><Users size={32} /></div>
                  <h3>No Friends Yet</h3>
                  <p>Start connecting with other learners!</p>
                  <button className="fd-btn fd-btn-primary" onClick={() => setActiveView('find-friends')}>Find Friends</button>
                </div>
            )}

            {/* Find Friends View */}
            {activeView === 'find-friends' && (
              <>
                {isSearching && <div className="fd-loading"><div className="fd-spinner"></div><p>Searching...</p></div>}
                <div className="fd-users-list">
                  {searchQuery.length >= 2 ? (
                    searchResults.length > 0 ? searchResults.map(user => renderUserCard(user))
                    : !isSearching && <div className="fd-empty-state"><p>No users found matching "{searchQuery}"</p></div>
                  ) : (
                    <>
                      <h3 className="fd-section-title">All Users</h3>
                      {allUsers.length > 0 ? allUsers.map(user => renderUserCard(user))
                       : loading ? <div className="fd-loading"><div className="fd-spinner"></div></div>
                       : <div className="fd-empty-state"><p>No users available</p></div>}
                    </>
                  )}
                </div>
              </>
            )}

            {/* Requests View */}
            {activeView === 'requests' && (
              <>
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
                            <button className="fd-action-btn accept" onClick={() => respondToFriendRequest(request.request_id, 'accept')}><Check size={18} /></button>
                            <button className="fd-action-btn reject" onClick={() => respondToFriendRequest(request.request_id, 'reject')}><X size={18} /></button>
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
                            <button className="fd-action-btn cancel" onClick={() => cancelFriendRequest(request.request_id)}><X size={18} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {friendRequests.received.length === 0 && friendRequests.sent.length === 0 && (
                  <div className="fd-empty-state">
                    <div className="fd-empty-icon"><UserPlus size={32} /></div>
                    <h3>No Pending Requests</h3>
                    <p>You don't have any friend requests at the moment</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FriendsDashboard;

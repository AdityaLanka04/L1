import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Search, UserPlus, Check, X, UserMinus } from 'lucide-react';
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
  const [selfStats, setSelfStats] = useState(null);

  useEffect(() => {
    fetchSelfStats();
    fetchFriends();
    fetchFriendRequests();
    if (activeView === 'find-friends') fetchAllUsers();
  }, [activeView]);

  const fetchSelfStats = async () => {
    const username = localStorage.getItem('username');
    if (!username) return;
    try {
      const res = await fetch(`${API_URL}/get_gamification_stats?user_id=${encodeURIComponent(username)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setSelfStats(await res.json());
    } catch {
      
    }
  };

  const fetchLeaderboardStats = async () => {
    try {
      const res = await fetch(`${API_URL}/get_leaderboard?limit=200`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) return {};
      const data = await res.json();
      const map = {};
      (data.leaderboard || []).forEach(entry => {
        const uid = entry.user_id || entry.id;
        if (uid) map[uid] = {
          level: entry.level || 1,
          experience: entry.experience || 0,
          current_streak: entry.current_streak || 0,
          total_hours: entry.score || entry.total_hours || 0,
        };
      });
      return map;
    } catch { return {}; }
  };

  const fetchFriends = async () => {
    try {
      setLoading(true);
      const [res, statsMap] = await Promise.all([
        fetch(`${API_URL}/friends`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetchLeaderboardStats(),
      ]);
      if (res.ok) {
        const data = await res.json();
        const list = (data.friends || []).map(f => ({
          ...f,
          ...statsMap[f.id],
        }));
        setFriends(list);
      }
    } catch {
      
    } finally { setLoading(false); }
  };

  const fetchFriendRequests = async () => {
    try {
      const res = await fetch(`${API_URL}/friend_requests`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) { const data = await res.json(); setFriendRequests(data); }
    } catch {
      
    }
  };

  const fetchAllUsers = async () => {
    try {
      setLoading(true);
      const [res, statsMap] = await Promise.all([
        fetch(`${API_URL}/search_users?query=a`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetchLeaderboardStats(),
      ]);
      if (res.ok) {
        const data = await res.json();
        const list = (data.users || [])
          .sort((a, b) => (a.username || a.email).localeCompare(b.username || b.email))
          .map(u => ({ ...u, ...statsMap[u.id] }));
        setAllUsers(list);
      }
    } catch {
      
    } finally { setLoading(false); }
  };

  const searchUsers = async (query) => {
    if (query.length < 2) { setSearchResults([]); return; }
    try {
      setIsSearching(true);
      const [res, statsMap] = await Promise.all([
        fetch(`${API_URL}/search_users?query=${encodeURIComponent(query)}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetchLeaderboardStats(),
      ]);
      if (res.ok) {
        const data = await res.json();
        const list = (data.users || [])
          .sort((a, b) => (a.username || a.email).localeCompare(b.username || b.email))
          .map(u => ({ ...u, ...statsMap[u.id] }));
        setSearchResults(list);
      }
    } catch {
      
    } finally { setIsSearching(false); }
  };

  const sendFriendRequest = async (receiverId) => {
    try {
      const res = await fetch(`${API_URL}/send_friend_request`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiver_id: receiverId }),
      });
      if (res.ok) {
        setSearchResults(prev => prev.map(u => u.id === receiverId ? { ...u, request_sent: true } : u));
        setAllUsers(prev => prev.map(u => u.id === receiverId ? { ...u, request_sent: true } : u));
        fetchFriendRequests();
      }
    } catch {
      
    }
  };

  const respondToFriendRequest = async (requestId, action) => {
    try {
      const res = await fetch(`${API_URL}/respond_friend_request`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: requestId, action }),
      });
      if (res.ok) { fetchFriendRequests(); fetchFriends(); }
    } catch {
      
    }
  };

  const removeFriend = async (friendId) => {
    if (!window.confirm('Remove this friend?')) return;
    try {
      const res = await fetch(`${API_URL}/remove_friend`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ friend_id: friendId }),
      });
      if (res.ok) fetchFriends();
    } catch {
      
    }
  };

  const cancelFriendRequest = async (requestId) => {
    try {
      const res = await fetch(`${API_URL}/respond_friend_request`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: requestId, action: 'reject' }),
      });
      if (res.ok) fetchFriendRequests();
    } catch {
      
    }
  };

  const renderAvatar = (user, size = 'md') => {
    const pic = user.picture_url || user.picture || user.profile_picture;
    const name = user.username || user.email || 'U';
    const initial = name.charAt(0).toUpperCase();
    return (
      <div className={`fd-avatar fd-avatar--${size}`}>
        {pic
          ? <img src={pic} alt={name} referrerPolicy="no-referrer" onError={e => { e.target.style.display = 'none'; }} />
          : <span>{initial}</span>}
      </div>
    );
  };

  const getLevelLabel = (level) => {
    if (!level || level < 2) return 'Learner';
    if (level < 5) return 'Explorer';
    if (level < 10) return 'Scholar';
    if (level < 20) return 'Expert';
    return 'Master';
  };

  const renderFriendCard = (friend) => (
    <div key={friend.id} className="fd-friend-card">
      <div className="fd-friend-card-top">
        {renderAvatar(friend, 'lg')}
        <div className="fd-friend-identity">
          <div className="fd-friend-level-badge">LVL {friend.level || 1}</div>
          <h3 className="fd-friend-name">{friend.username || friend.email}</h3>
          <p className="fd-friend-role">{getLevelLabel(friend.level)}</p>
        </div>
        <button className="fd-remove-btn" onClick={() => removeFriend(friend.id)} title="Remove Friend">
          <X size={14} />
        </button>
      </div>

      <div className="fd-friend-stats">
        <div className="fd-stat fd-stat--xp">
          <span className="fd-stat-val">{(friend.experience || 0).toLocaleString()}</span>
          <span className="fd-stat-lbl">XP</span>
        </div>
        <div className="fd-stat fd-stat--streak">
          <span className="fd-stat-val">{friend.current_streak || 0}</span>
          <span className="fd-stat-lbl">Day Streak</span>
        </div>
        <div className="fd-stat fd-stat--hours">
          <span className="fd-stat-val">{friend.level || 1}</span>
          <span className="fd-stat-lbl">Level</span>
        </div>
      </div>

      <div className="fd-xp-bar">
        <div
          className="fd-xp-fill"
          style={{ width: `${Math.min(100, ((friend.experience % 1000) / 1000) * 100)}%` }}
        />
      </div>
    </div>
  );

  const renderUserCard = (user) => {
    const isRequestSent = user.request_sent || friendRequests.sent.some(r => r.id === user.id);
    const isRequestReceived = friendRequests.received.some(r => r.id === user.id);
    const isFriend = user.is_friend || friends.some(f => f.id === user.id);
    return (
      <div key={user.id} className="fd-user-row">
        {renderAvatar(user, 'md')}
        <div className="fd-user-row-info">
          <h4 className="fd-user-row-name">{user.username || user.email}</h4>
          <div className="fd-user-row-meta">
            <span className="fd-user-row-pill fd-pill--level">LVL {user.level || 1}</span>
            {(user.current_streak || 0) > 0 && (
              <><span className="fd-pill-sep">·</span><span className="fd-user-row-pill fd-pill--streak">{user.current_streak}D STREAK</span></>
            )}
            {(user.experience || 0) > 0 && (
              <><span className="fd-pill-sep">·</span><span className="fd-user-row-pill fd-pill--xp">{(user.experience || 0).toLocaleString()} XP</span></>
            )}
          </div>
        </div>
        <div className="fd-user-row-action">
          {isFriend
            ? <span className="fd-badge-pill fd-badge-pill--friend">Friends</span>
            : isRequestSent
            ? <span className="fd-badge-pill fd-badge-pill--pending">Sent</span>
            : isRequestReceived
            ? <span className="fd-badge-pill fd-badge-pill--pending">Pending</span>
            : (
              <button className="fd-add-btn" onClick={() => sendFriendRequest(user.id)}>
                <UserPlus size={15} />
                <span>Add</span>
              </button>
            )}
        </div>
      </div>
    );
  };

  const totalRequests = friendRequests.received.length + friendRequests.sent.length;

  return (
    <div className="fd-container">
      <svg className="geo-bg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <circle cx="600" cy="400" r="360" fill="none" stroke="currentColor" strokeWidth="1"/>
        <circle cx="600" cy="400" r="260" fill="none" stroke="currentColor" strokeWidth="0.8"/>
        <circle cx="600" cy="400" r="168" fill="none" stroke="currentColor" strokeWidth="0.7"/>
        <circle cx="600" cy="400" r="90" fill="none" stroke="currentColor" strokeWidth="0.6"/>
        <line x1="600" y1="0" x2="600" y2="800" stroke="currentColor" strokeWidth="0.5"/>
        <line x1="0" y1="400" x2="1200" y2="400" stroke="currentColor" strokeWidth="0.5"/>
        <line x1="0" y1="800" x2="500" y2="0" stroke="currentColor" strokeWidth="0.4"/>
        <line x1="1200" y1="0" x2="700" y2="800" stroke="currentColor" strokeWidth="0.4"/>
        <circle cx="600" cy="40" r="5" fill="currentColor"/>
        <circle cx="600" cy="760" r="5" fill="currentColor"/>
        <circle cx="240" cy="400" r="5" fill="currentColor"/>
        <circle cx="960" cy="400" r="5" fill="currentColor"/>
        <circle cx="345" cy="146" r="3.5" fill="currentColor"/>
        <circle cx="855" cy="654" r="3.5" fill="currentColor"/>
        <circle cx="855" cy="146" r="3.5" fill="currentColor"/>
        <circle cx="345" cy="654" r="3.5" fill="currentColor"/>
      </svg>
      <div className="fd-layout">
        <aside className="fd-sidebar">
          <div className="fd-self-level-card">
            <span className="fd-self-kicker">Your Level</span>
            <strong>Level {selfStats?.level || 1}</strong>
            <div className="fd-self-xp">{(selfStats?.total_points || 0).toLocaleString()} XP</div>
            <div className="fd-self-track">
              <span style={{ width: `${Math.min(100, Math.max(0, ((selfStats?.experience || 0) / Math.max(1, selfStats?.next_level_xp || 100)) * 100))}%` }} />
            </div>
          </div>
          <nav className="fd-sidebar-nav">
            <button
              className={`fd-sidebar-item ${activeView === 'my-friends' ? 'active' : ''}`}
              onClick={() => setActiveView('my-friends')}
            >
              <Users size={18} />
              <span>My Friends</span>
              {friends.length > 0 && <span className="fd-count">{friends.length}</span>}
            </button>
            <button
              className={`fd-sidebar-item ${activeView === 'find-friends' ? 'active' : ''}`}
              onClick={() => setActiveView('find-friends')}
            >
              <Search size={18} />
              <span>Find Friends</span>
            </button>
            <button
              className={`fd-sidebar-item ${activeView === 'requests' ? 'active' : ''}`}
              onClick={() => setActiveView('requests')}
            >
              <UserPlus size={18} />
              <span>Requests</span>
              {totalRequests > 0 && <span className="fd-count fd-count--alert">{totalRequests}</span>}
            </button>
          </nav>
        </aside>

        <main className="fd-main">
          {activeView === 'my-friends' && (
            loading
              ? <div className="fd-loading"><div className="fd-pulse-loader"><div className="fd-pulse-block fd-pulse-1" /><div className="fd-pulse-block fd-pulse-2" /><div className="fd-pulse-block fd-pulse-3" /></div></div>
              : friends.length > 0
              ? (
                <>
                  <div className="view-heading">
                    <span className="view-kicker">Your Network</span>
                    <h2 className="view-title">My Friends</h2>
                    <p className="view-sub">{friends.length} connection{friends.length !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="fd-friends-grid">
                    {friends.map(renderFriendCard)}
                  </div>
                </>
              )
              : (
                <div className="fd-empty">
                  <div className="fd-empty-icon"><Users size={36} /></div>
                  <h3>No friends yet</h3>
                  <p>Start building your study network</p>
                  <button className="fd-cta-btn" onClick={() => setActiveView('find-friends')}>
                    <Search size={16} /> Find Friends
                  </button>
                </div>
              )
          )}

          {activeView === 'find-friends' && (
            <>
              <div className="view-heading">
                <span className="view-kicker">Discover</span>
                <h2 className="view-title">Find Friends</h2>
                <p className="view-sub">Search and connect with learners</p>
              </div>
              <div className="fd-search-box">
                <Search size={16} className="fd-search-icon" />
                <input
                  type="text"
                  className="fd-search-input"
                  placeholder="Search by username or email..."
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); searchUsers(e.target.value); }}
                />
              </div>
              <div className="fd-users-list">
                {searchQuery.length >= 2
                  ? isSearching
                    ? <div className="fd-loading"><div className="fd-pulse-loader"><div className="fd-pulse-block fd-pulse-1" /><div className="fd-pulse-block fd-pulse-2" /><div className="fd-pulse-block fd-pulse-3" /></div></div>
                    : searchResults.length > 0
                    ? searchResults.map(renderUserCard)
                    : <div className="fd-empty"><p>No users found for "{searchQuery}"</p></div>
                  : loading
                  ? <div className="fd-loading"><div className="fd-pulse-loader"><div className="fd-pulse-block fd-pulse-1" /><div className="fd-pulse-block fd-pulse-2" /><div className="fd-pulse-block fd-pulse-3" /></div></div>
                  : allUsers.length > 0
                  ? allUsers.map(renderUserCard)
                  : <div className="fd-empty"><p>No users available</p></div>}
              </div>
            </>
          )}

          {activeView === 'requests' && (
            <>
              <div className="view-heading">
                <span className="view-kicker">Inbox</span>
                <h2 className="view-title">Requests</h2>
                <p className="view-sub">{totalRequests} pending</p>
              </div>

              {friendRequests.received.length > 0 && (
                <section className="fd-requests-section">
                  <h3 className="fd-section-label">Received <span>{friendRequests.received.length}</span></h3>
                  <div className="fd-users-list">
                    {friendRequests.received.map(req => (
                      <div key={req.request_id} className="fd-user-row">
                        {renderAvatar(req, 'md')}
                        <div className="fd-user-row-info">
                          <h4 className="fd-user-row-name">{req.username || req.email}</h4>
                          <p className="fd-user-row-email">{req.email}</p>
                        </div>
                        <div className="fd-user-row-action fd-request-btns">
                          <button className="fd-req-btn fd-req-btn--accept" onClick={() => respondToFriendRequest(req.request_id, 'accept')}>
                            <Check size={15} />
                          </button>
                          <button className="fd-req-btn fd-req-btn--reject" onClick={() => respondToFriendRequest(req.request_id, 'reject')}>
                            <X size={15} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {friendRequests.sent.length > 0 && (
                <section className="fd-requests-section">
                  <h3 className="fd-section-label">Sent <span>{friendRequests.sent.length}</span></h3>
                  <div className="fd-users-list">
                    {friendRequests.sent.map(req => (
                      <div key={req.request_id} className="fd-user-row">
                        {renderAvatar(req, 'md')}
                        <div className="fd-user-row-info">
                          <h4 className="fd-user-row-name">{req.username || req.email}</h4>
                          <p className="fd-user-row-email">{req.email}</p>
                        </div>
                        <div className="fd-user-row-action">
                          <button className="fd-req-btn fd-req-btn--reject" onClick={() => cancelFriendRequest(req.request_id)}>
                            <X size={15} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {totalRequests === 0 && (
                <div className="fd-empty">
                  <div className="fd-empty-icon"><UserPlus size={36} /></div>
                  <h3>No pending requests</h3>
                  <p>You're all caught up</p>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default FriendsDashboard;

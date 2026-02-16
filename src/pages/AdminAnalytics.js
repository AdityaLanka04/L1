import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Users, Activity, Zap, TrendingUp, Calendar } from 'lucide-react';
import './AdminAnalytics.css';
import { API_URL } from '../config';

const AdminAnalytics = () => {
  const navigate = useNavigate();
  
  // Get email from userProfile or username
  let userEmail = localStorage.getItem('username'); // username is the email
  try {
    const profile = JSON.parse(localStorage.getItem('userProfile') || '{}');
    if (profile.email) {
      userEmail = profile.email;
    }
  } catch (e) {
    // Use username as fallback
  }
  
  // Check if user is admin
  const ADMIN_EMAILS = ['aditya.s.lanka@gmail.com', 'cerbyl@gmail.com', 'stupendous0512@gmail.com'];
  
  useEffect(() => {
    if (!ADMIN_EMAILS.includes(userEmail)) {
      navigate('/dashboard');
    }
  }, [userEmail, navigate]);

  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userDetail, setUserDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState(30);

  useEffect(() => {
    if (ADMIN_EMAILS.includes(userEmail)) {
      loadOverview();
      loadUsers();
      
      // Auto-refresh every 30 seconds
      const interval = setInterval(() => {
        loadOverview();
        loadUsers();
      }, 30000);
      
      return () => clearInterval(interval);
    }
  }, [dateRange, userEmail]);

  const loadOverview = async () => {
    try {
      const token = localStorage.getItem('token');
      const userId = localStorage.getItem('user_id') || localStorage.getItem('username');
      
      const response = await fetch(`${API_URL}/admin/analytics/overview?days=${dateRange}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-User-Id': userId
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setOverview(data);
      }
    } catch (error) {
      console.error('Error loading overview:', error);
    }
  };

  const loadUsers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const userId = localStorage.getItem('user_id') || localStorage.getItem('username');
      
      const response = await fetch(`${API_URL}/admin/analytics/users?days=${dateRange}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-User-Id': userId
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUserDetail = async (userId) => {
    try {
      const token = localStorage.getItem('token');
      const myUserId = localStorage.getItem('user_id') || localStorage.getItem('username');
      
      const response = await fetch(`${API_URL}/admin/analytics/user/${userId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-User-Id': myUserId
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setUserDetail(data);
        setSelectedUser(userId);
      }
    } catch (error) {
      console.error('Error loading user detail:', error);
    }
  };

  const downloadAllCSV = async () => {
    try {
      const token = localStorage.getItem('token');
      const userId = localStorage.getItem('user_id') || localStorage.getItem('username');
      
      const response = await fetch(`${API_URL}/admin/analytics/export/csv?days=${dateRange}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-User-Id': userId
        }
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analytics_export_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Error downloading CSV:', error);
    }
  };

  const downloadUserCSV = async (userId, username) => {
    try {
      const token = localStorage.getItem('token');
      const myUserId = localStorage.getItem('user_id') || localStorage.getItem('username');
      
      const response = await fetch(`${API_URL}/admin/analytics/export/user/${userId}/csv`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-User-Id': myUserId
        }
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `user_${username}_analytics_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Error downloading user CSV:', error);
    }
  };

  if (!ADMIN_EMAILS.includes(userEmail)) {
    return null;
  }

  return (
    <div className="admin-analytics">
      <div className="aa-header">
        <h1>Admin Analytics Dashboard</h1>
        <div className="aa-header-actions">
          <select 
            value={dateRange} 
            onChange={(e) => setDateRange(Number(e.target.value))}
            className="aa-date-select"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last year</option>
          </select>
          <button onClick={downloadAllCSV} className="aa-btn-primary">
            <Download size={16} />
            Export All CSV
          </button>
        </div>
      </div>

      {overview && (
        <div className="aa-overview">
          <div className="aa-stat-card">
            <div className="aa-stat-icon">
              <Users size={24} />
            </div>
            <div className="aa-stat-content">
              <div className="aa-stat-label">Total Users</div>
              <div className="aa-stat-value">{overview.total_users}</div>
            </div>
          </div>

          <div className="aa-stat-card">
            <div className="aa-stat-icon">
              <Activity size={24} />
            </div>
            <div className="aa-stat-content">
              <div className="aa-stat-label">Active Users</div>
              <div className="aa-stat-value">{overview.active_users}</div>
            </div>
          </div>

          <div className="aa-stat-card">
            <div className="aa-stat-icon">
              <Zap size={24} />
            </div>
            <div className="aa-stat-content">
              <div className="aa-stat-label">Total Tokens</div>
              <div className="aa-stat-value">{overview.total_tokens.toLocaleString()}</div>
            </div>
          </div>

          <div className="aa-stat-card">
            <div className="aa-stat-icon">
              <TrendingUp size={24} />
            </div>
            <div className="aa-stat-content">
              <div className="aa-stat-label">Avg Tokens/User</div>
              <div className="aa-stat-value">
                {overview.active_users > 0 
                  ? Math.round(overview.total_tokens / overview.active_users).toLocaleString()
                  : 0
                }
              </div>
            </div>
          </div>
        </div>
      )}

      {overview && overview.tool_usage && (
        <div className="aa-section">
          <h2>Tool Usage</h2>
          <div className="aa-tool-grid">
            {overview.tool_usage.map((tool) => (
              <div key={tool.tool_name} className="aa-tool-card">
                <div className="aa-tool-name">{tool.tool_name}</div>
                <div className="aa-tool-stats">
                  <span>{tool.usage_count} uses</span>
                  <span>{tool.tokens?.toLocaleString() || 0} tokens</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="aa-section">
        <h2>Users</h2>
        {loading ? (
          <div className="aa-loading">Loading users...</div>
        ) : (
          <div className="aa-users-table">
            <table>
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Activities</th>
                  <th>Tokens Used</th>
                  <th>Last Activity</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} onClick={() => loadUserDetail(user.id)}>
                    <td>{user.username}</td>
                    <td>{user.email}</td>
                    <td>{user.total_activities || 0}</td>
                    <td>{(user.total_tokens || 0).toLocaleString()}</td>
                    <td>{user.last_activity ? new Date(user.last_activity).toLocaleString() : 'Never'}</td>
                    <td>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadUserCSV(user.id, user.username);
                        }}
                        className="aa-btn-small"
                      >
                        <Download size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {userDetail && (
        <div className="aa-user-detail">
          <div className="aa-detail-header">
            <h2>User Details: {userDetail.user.username}</h2>
            <button onClick={() => setUserDetail(null)} className="aa-btn-secondary">
              Close
            </button>
          </div>

          <div className="aa-detail-tools">
            <h3>Tool Usage Summary</h3>
            <div className="aa-tool-grid">
              {userDetail.tool_summary.map((tool) => (
                <div key={tool.tool_name} className="aa-tool-card">
                  <div className="aa-tool-name">{tool.tool_name}</div>
                  <div className="aa-tool-stats">
                    <span>{tool.usage_count} uses</span>
                    <span>{Math.round(tool.total_tokens || 0).toLocaleString()} tokens</span>
                    <span>Avg: {Math.round(tool.avg_tokens || 0)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="aa-detail-activities">
            <h3>Recent Activities (Last 1000)</h3>
            <div className="aa-activities-list">
              {userDetail.activities.map((activity) => (
                <div key={activity.id} className="aa-activity-item">
                  <div className="aa-activity-tool">{activity.tool_name}</div>
                  <div className="aa-activity-action">{activity.action}</div>
                  <div className="aa-activity-tokens">{activity.tokens_used} tokens</div>
                  <div className="aa-activity-time">
                    {new Date(activity.timestamp).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAnalytics;

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Download,
  Users,
  Activity,
  Zap,
  Database,
  Timer,
  AlertTriangle
} from 'lucide-react';
import './AdminAnalytics.css';
import { API_URL } from '../config';

const ADMIN_EMAILS = ['aditya.s.lanka@gmail.com'];

const formatNumber = (value) => {
  const safe = Number.isFinite(value) ? value : 0;
  return safe.toLocaleString();
};

const formatPercent = (value) => {
  const safe = Number.isFinite(value) ? value : 0;
  return `${safe.toFixed(1)}%`;
};

const formatSeconds = (value) => {
  if (!Number.isFinite(value)) return '0s';
  if (value >= 1) return `${value.toFixed(2)}s`;
  return `${(value * 1000).toFixed(0)}ms`;
};

const AdminAnalytics = () => {
  const navigate = useNavigate();

  let userEmail = localStorage.getItem('username');
  try {
    const profile = JSON.parse(localStorage.getItem('userProfile') || '{}');
    if (profile.email) {
      userEmail = profile.email;
    }
  } catch (e) {
    // ignore
  }

  useEffect(() => {
    if (!ADMIN_EMAILS.includes(userEmail)) {
      navigate('/dashboard');
    }
  }, [userEmail, navigate]);

  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [userDetail, setUserDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState(30);
  const [trendMetric, setTrendMetric] = useState('ai_tokens');
  const [toolView, setToolView] = useState('ai');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (ADMIN_EMAILS.includes(userEmail)) {
      loadOverview();
      loadUsers();

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
          Authorization: `Bearer ${token}`,
          'X-User-Id': userId,
        },
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
          Authorization: `Bearer ${token}`,
          'X-User-Id': userId,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
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
          Authorization: `Bearer ${token}`,
          'X-User-Id': myUserId,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUserDetail(data);
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
          Authorization: `Bearer ${token}`,
          'X-User-Id': userId,
        },
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
          Authorization: `Bearer ${token}`,
          'X-User-Id': myUserId,
        },
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

  const dailyUsage = useMemo(() => {
    const data = overview?.daily_usage || [];
    return [...data].sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [overview]);

  const trendConfig = {
    ai_tokens: { label: 'AI Tokens', color: 'var(--aa-accent)' },
    total_tokens: { label: 'Total Tokens', color: 'var(--aa-accent-soft)' },
    requests: { label: 'Requests', color: 'var(--aa-warm)' },
    ai_requests: { label: 'AI Requests', color: 'var(--aa-warm-strong)' },
  };

  const trendValues = dailyUsage.map((item) => item[trendMetric] || 0);
  const maxTrendValue = Math.max(...trendValues, 1);

  const toolUsage = overview?.tool_usage || [];
  const displayedTools = toolView === 'ai'
    ? toolUsage.filter((tool) => (tool.ai_requests || tool.ai_tokens))
    : toolUsage;

  const filteredUsers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return users;
    return users.filter((user) =>
      `${user.username} ${user.email}`.toLowerCase().includes(term)
    );
  }, [users, searchTerm]);

  if (!ADMIN_EMAILS.includes(userEmail)) {
    return null;
  }

  const aiTotalTokens = overview?.ai_tokens || 0;
  const aiPromptTokens = overview?.ai_prompt_tokens || 0;
  const aiCompletionTokens = overview?.ai_completion_tokens || 0;
  const promptRatio = aiTotalTokens ? (aiPromptTokens / aiTotalTokens) * 100 : 0;
  const completionRatio = aiTotalTokens ? (aiCompletionTokens / aiTotalTokens) * 100 : 0;

  return (
    <div className="admin-analytics">
      <div className="aa-hero">
        <div>
          <h1>Admin Analytics Dashboard</h1>
          <p>Real-time product usage, AI token efficiency, and reliability signals.</p>
        </div>
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
        <div className="aa-kpi-grid">
          <div className="aa-kpi-card">
            <div className="aa-kpi-icon"><Users size={20} /></div>
            <div>
              <div className="aa-kpi-label">Total Users</div>
              <div className="aa-kpi-value">{formatNumber(overview.total_users)}</div>
              <div className="aa-kpi-sub">Active: {formatNumber(overview.active_users)}</div>
            </div>
          </div>
          <div className="aa-kpi-card">
            <div className="aa-kpi-icon"><Activity size={20} /></div>
            <div>
              <div className="aa-kpi-label">Requests</div>
              <div className="aa-kpi-value">{formatNumber(overview.total_requests)}</div>
              <div className="aa-kpi-sub">AI Calls: {formatNumber(overview.ai_requests)}</div>
            </div>
          </div>
          <div className="aa-kpi-card">
            <div className="aa-kpi-icon"><Zap size={20} /></div>
            <div>
              <div className="aa-kpi-label">AI Tokens</div>
              <div className="aa-kpi-value">{formatNumber(overview.ai_tokens)}</div>
              <div className="aa-kpi-sub">Coverage: {formatPercent(overview.ai_token_coverage)}</div>
            </div>
          </div>
          <div className="aa-kpi-card">
            <div className="aa-kpi-icon"><Database size={20} /></div>
            <div>
              <div className="aa-kpi-label">Total Tokens</div>
              <div className="aa-kpi-value">{formatNumber(overview.total_tokens)}</div>
              <div className="aa-kpi-sub">Prompt: {formatNumber(overview.ai_prompt_tokens)}</div>
            </div>
          </div>
          <div className="aa-kpi-card">
            <div className="aa-kpi-icon"><Timer size={20} /></div>
            <div>
              <div className="aa-kpi-label">Latency</div>
              <div className="aa-kpi-value">{formatSeconds(overview.avg_latency)}</div>
              <div className="aa-kpi-sub">AI Avg: {formatSeconds(overview.avg_ai_latency)}</div>
            </div>
          </div>
          <div className="aa-kpi-card">
            <div className="aa-kpi-icon"><AlertTriangle size={20} /></div>
            <div>
              <div className="aa-kpi-label">Error Rate</div>
              <div className="aa-kpi-value">{formatPercent(overview.error_rate)}</div>
              <div className="aa-kpi-sub">AI: {formatPercent(overview.ai_error_rate)}</div>
            </div>
          </div>
        </div>
      )}

      {overview && (
        <div className="aa-grid">
          <div className="aa-card">
            <div className="aa-card-header">
              <div>
                <h2>Daily Trend</h2>
                <p>{trendConfig[trendMetric]?.label} over the last {dateRange} days</p>
              </div>
              <div className="aa-toggle">
                {Object.keys(trendConfig).map((key) => (
                  <button
                    key={key}
                    className={`aa-toggle-btn ${trendMetric === key ? 'active' : ''}`}
                    onClick={() => setTrendMetric(key)}
                  >
                    {trendConfig[key].label}
                  </button>
                ))}
              </div>
            </div>
            <div className="aa-chart">
              {dailyUsage.map((day) => {
                const value = day[trendMetric] || 0;
                const height = (value / maxTrendValue) * 100;
                const label = new Date(day.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                return (
                  <div key={day.date} className="aa-chart-bar">
                    <div
                      className="aa-chart-fill"
                      style={{ height: `${height}%`, background: trendConfig[trendMetric]?.color }}
                      title={`${label}: ${formatNumber(value)}`}
                    />
                    <span className="aa-chart-label">{label}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="aa-card">
            <div className="aa-card-header">
              <div>
                <h2>AI Token Mix</h2>
                <p>Prompt vs completion distribution</p>
              </div>
              <div className="aa-token-total">{formatNumber(aiTotalTokens)} tokens</div>
            </div>
            <div className="aa-token-bar">
              <div
                className="aa-token-segment aa-token-prompt"
                style={{ width: `${promptRatio}%` }}
                title={`Prompt ${formatNumber(aiPromptTokens)}`}
              />
              <div
                className="aa-token-segment aa-token-completion"
                style={{ width: `${completionRatio}%` }}
                title={`Completion ${formatNumber(aiCompletionTokens)}`}
              />
            </div>
            <div className="aa-token-legend">
              <div className="aa-token-legend-item">
                <span className="aa-token-dot aa-token-prompt" />
                Prompt {formatNumber(aiPromptTokens)}
              </div>
              <div className="aa-token-legend-item">
                <span className="aa-token-dot aa-token-completion" />
                Completion {formatNumber(aiCompletionTokens)}
              </div>
            </div>
            <div className="aa-token-stats">
              <div>
                <span>Prompt Share</span>
                <strong>{formatPercent(promptRatio)}</strong>
              </div>
              <div>
                <span>Completion Share</span>
                <strong>{formatPercent(completionRatio)}</strong>
              </div>
            </div>
            <div className="aa-models">
              <h3>Model Usage</h3>
              <div className="aa-model-list">
                {(overview.model_usage || []).map((model) => (
                  <div key={model.model} className="aa-model-item">
                    <div>
                      <span>{model.model}</span>
                      <strong>{formatNumber(model.total_tokens)}</strong>
                    </div>
                    <span>{formatNumber(model.requests)} calls</span>
                  </div>
                ))}
                {(!overview.model_usage || overview.model_usage.length === 0) && (
                  <div className="aa-empty">No model usage recorded yet.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {overview && (
        <div className="aa-section">
          <div className="aa-section-header">
            <h2>Tool Intelligence</h2>
            <div className="aa-toggle">
              <button
                className={`aa-toggle-btn ${toolView === 'ai' ? 'active' : ''}`}
                onClick={() => setToolView('ai')}
              >
                AI Tools
              </button>
              <button
                className={`aa-toggle-btn ${toolView === 'all' ? 'active' : ''}`}
                onClick={() => setToolView('all')}
              >
                All Tools
              </button>
            </div>
          </div>
          <div className="aa-table">
            <div className="aa-table-row aa-table-header">
              <span>Tool</span>
              <span>Requests</span>
              <span>AI Tokens</span>
              <span>Prompt</span>
              <span>Completion</span>
              <span>Avg Tokens</span>
              <span>Avg Latency</span>
              <span>Error Rate</span>
            </div>
            {displayedTools.slice(0, 12).map((tool) => (
              <div key={tool.tool_name} className="aa-table-row">
                <span className="aa-tool-name">{tool.tool_name}</span>
                <span>{formatNumber(tool.usage_count)}</span>
                <span>{formatNumber(tool.ai_tokens)}</span>
                <span>{formatNumber(tool.prompt_tokens)}</span>
                <span>{formatNumber(tool.completion_tokens)}</span>
                <span>{formatNumber(Math.round(tool.avg_tokens || 0))}</span>
                <span>{formatSeconds(tool.avg_latency || 0)}</span>
                <span>{formatPercent((tool.error_rate || 0) * 100)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="aa-section">
        <div className="aa-section-header">
          <div>
            <h2>Users</h2>
            <p>Inspect usage and AI cost by user</p>
          </div>
          <div className="aa-search">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by username or email"
            />
          </div>
        </div>
        {loading ? (
          <div className="aa-loading">Loading users...</div>
        ) : (
          <div className="aa-users-table">
            <table>
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Email</th>
                  <th>AI Calls</th>
                  <th>AI Tokens</th>
                  <th>Total Tokens</th>
                  <th>Coverage</th>
                  <th>Last Activity</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id} onClick={() => loadUserDetail(user.id)}>
                    <td>{user.username}</td>
                    <td>{user.email}</td>
                    <td>{formatNumber(user.ai_requests)}</td>
                    <td>{formatNumber(user.ai_tokens)}</td>
                    <td>{formatNumber(user.total_tokens)}</td>
                    <td>{formatPercent(user.ai_token_coverage || 0)}</td>
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
            <div>
              <h2>User Details: {userDetail.user.username}</h2>
              <p>{userDetail.user.email}</p>
            </div>
            <button onClick={() => setUserDetail(null)} className="aa-btn-secondary">
              Close
            </button>
          </div>

          <div className="aa-detail-kpis">
            <div>
              <span>AI Tokens</span>
              <strong>{formatNumber(userDetail.ai_summary?.ai_tokens || 0)}</strong>
            </div>
            <div>
              <span>AI Calls</span>
              <strong>{formatNumber(userDetail.ai_summary?.ai_requests || 0)}</strong>
            </div>
            <div>
              <span>Prompt Tokens</span>
              <strong>{formatNumber(userDetail.ai_summary?.prompt_tokens || 0)}</strong>
            </div>
            <div>
              <span>Completion Tokens</span>
              <strong>{formatNumber(userDetail.ai_summary?.completion_tokens || 0)}</strong>
            </div>
            <div>
              <span>Coverage</span>
              <strong>{formatPercent(userDetail.ai_summary?.ai_token_coverage || 0)}</strong>
            </div>
          </div>

          <div className="aa-detail-tools">
            <h3>Tool Usage Summary</h3>
            <div className="aa-table">
              <div className="aa-table-row aa-table-header">
                <span>Tool</span>
                <span>Requests</span>
                <span>AI Tokens</span>
                <span>Avg Tokens</span>
                <span>Latency</span>
                <span>Error Rate</span>
              </div>
            {(userDetail.tool_summary || []).map((tool) => (
                <div key={tool.tool_name} className="aa-table-row">
                  <span className="aa-tool-name">{tool.tool_name}</span>
                  <span>{formatNumber(tool.usage_count)}</span>
                  <span>{formatNumber(tool.ai_tokens)}</span>
                  <span>{formatNumber(Math.round(tool.avg_tokens || 0))}</span>
                  <span>{formatSeconds(tool.avg_latency || 0)}</span>
                  <span>{formatPercent((tool.error_rate || 0) * 100)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="aa-detail-activities">
            <h3>Recent Activities</h3>
            <div className="aa-activities-list">
              {(userDetail.activities || []).map((activity) => (
                <div key={activity.id} className="aa-activity-item">
                  <div className="aa-activity-tool">{activity.tool_name}</div>
                  <div className="aa-activity-action">{activity.action}</div>
                  <div className="aa-activity-tokens">{formatNumber(activity.tokens_used)} tokens</div>
                  <div className="aa-activity-time">
                    {new Date(activity.timestamp).toLocaleString()}
                  </div>
                  <div className="aa-activity-meta">
                    <span>{activity.model || 'n/a'}</span>
                    <span>{activity.endpoint || 'endpoint unknown'}</span>
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

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ChevronRight, Download, BarChart3, Activity, Zap, BookOpen, MessageSquare,
  Trophy, Target, Flame, Clock, Brain, Calendar, Menu, Cpu, Database, 
  Network, Sparkles, TrendingUp, TrendingDown, CheckCircle, AlertCircle, 
  Layers, GitBranch, Info
} from 'lucide-react';
import './Analytics.css';
import { API_URL } from '../config';
import { useTheme } from '../contexts/ThemeContext';
import GeoBackground from '../components/GeoBackground';

const Analytics = () => {
  const navigate = useNavigate();
  const { selectedTheme } = useTheme();
  const token = localStorage.getItem('token');
  const userName = localStorage.getItem('username');
  
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('week');
  const [chartType, setChartType] = useState('bar');
  const [selectedMetrics, setSelectedMetrics] = useState(['points', 'ai_chats', 'notes', 'flashcards', 'quizzes']);
  const [activeTab, setActiveTab] = useState('overview');
  
  const [weeklyData, setWeeklyData] = useState([]);
  const [dailyBreakdown, setDailyBreakdown] = useState([]);
  const [weeklyStats, setWeeklyStats] = useState({});
  const [gamificationStats, setGamificationStats] = useState({});
  const [historicalData, setHistoricalData] = useState([]);
  const [periodStats, setPeriodStats] = useState({ totalPoints: 0, totalActivities: 0 });
  const [mlStats, setMlStats] = useState(null);
  const [chatDetails, setChatDetails] = useState(null);
  const [flashcardDetails, setFlashcardDetails] = useState(null);
  const [contextSessions, setContextSessions] = useState([]);

  const tokens = selectedTheme?.tokens || {};
  const accent = tokens['--accent'] || '#D7B38C';

  const metricConfig = {
    points: { label: 'Points', color: accent, icon: Zap },
    ai_chats: { label: 'AI Chats', color: '#3b82f6', icon: MessageSquare },
    notes: { label: 'Notes', color: '#10b981', icon: BookOpen },
    flashcards: { label: 'Flashcards', color: '#f59e0b', icon: Brain },
    quizzes: { label: 'Quizzes', color: '#ef4444', icon: Target },
    study_minutes: { label: 'Study Time', color: accent, icon: Clock }
  };

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    loadAllData();
  }, [timeRange]);

  useEffect(() => {
    if (activeTab === 'ml-insights') {
      if (!mlStats) loadMLStats();
      if (!contextSessions.length) loadContextSessions();
    } else if (activeTab === 'detailed-stats') {
      if (!chatDetails) loadDetailedStats();
    }
  }, [activeTab]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadWeeklyProgress(),
        loadGamificationStats(),
        loadHistoricalData()
      ]);
    } catch (error) {
      console.error('Load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMLStats = async () => {
    try {
      const response = await fetch(`${API_URL}/get_ml_analytics?user_id=${userName}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setMlStats(data);
      }
    } catch (error) {
      console.error('Failed to load ML stats:', error);
    }
  };

  const loadContextSessions = async () => {
    try {
      const response = await fetch(`${API_URL}/get_context_sessions?user_id=${userName}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setContextSessions(data.sessions || []);
      }
    } catch (error) {
      console.error('Failed to load context sessions:', error);
    }
  };

  const loadDetailedStats = async () => {
    try {
      const [chatRes, flashcardRes] = await Promise.all([
        fetch(`${API_URL}/get_chat_details?user_id=${userName}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API_URL}/get_flashcard_details?user_id=${userName}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);
      
      if (chatRes.ok) {
        const chatData = await chatRes.json();
        setChatDetails(chatData);
      }
      
      if (flashcardRes.ok) {
        const flashcardData = await flashcardRes.json();
        setFlashcardDetails(flashcardData);
      }
    } catch (error) {
      console.error('Failed to load detailed stats:', error);
    }
  };

  const loadWeeklyProgress = async () => {
    try {
      const response = await fetch(`${API_URL}/get_weekly_progress?user_id=${userName}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setWeeklyData(data.weekly_data || []);
        setDailyBreakdown(data.daily_breakdown || []);
        setWeeklyStats(data.weekly_stats || {});
      }
    } catch (error) {
    // silenced
  }
  };

  const loadGamificationStats = async () => {
    try {
      const response = await fetch(`${API_URL}/get_gamification_stats?user_id=${userName}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setGamificationStats(data);
      }
    } catch (error) {
    // silenced
  }
  };

  const loadHistoricalData = async () => {
    try {
      const response = await fetch(`${API_URL}/get_analytics_history?user_id=${userName}&period=${timeRange}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setHistoricalData(data.history || []);
        setPeriodStats({
          totalPoints: data.total_points || 0,
          totalActivities: data.total_activities || 0,
          groupBy: data.group_by || 'day'
        });
      }
    } catch (error) {
    // silenced
  }
  };

  const toggleMetric = (metric) => {
    setSelectedMetrics(prev => 
      prev.includes(metric) 
        ? prev.filter(m => m !== metric)
        : [...prev, metric]
    );
  };

  const getChartData = () => {
    return historicalData.length > 0 ? historicalData : dailyBreakdown;
  };

  const chartData = getChartData();

  const getMaxValue = () => {
    if (!chartData.length) return 100;
    let max = 0;
    chartData.forEach(day => {
      selectedMetrics.forEach(metric => {
        const value = day[metric] || 0;
        if (value > max) max = value;
      });
    });
    return max || 100;
  };

  const exportData = () => {
    const dataToExport = chartData;
    const csvContent = [
      ['Date', 'Label', ...selectedMetrics.map(m => metricConfig[m].label)].join(','),
      ...dataToExport.map(day => 
        [day.date, day.label || day.day, ...selectedMetrics.map(m => day[m] || 0)].join(',')
      )
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics_${timeRange}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <div className="analytics-page">
        <div className="analytics-loading">
          <div className="loading-spinner"></div>
          <p>Loading analytics...</p>
        </div>
      </div>
    );
  }

  const totalPoints = periodStats.totalPoints || weeklyData.reduce((a, b) => a + b, 0);
  const avgPoints = chartData.length > 0 ? totalPoints / chartData.length : 0;
  const maxValue = getMaxValue();
  
  const getPeriodLabel = () => {
    switch(timeRange) {
      case 'week': return 'Weekly';
      case 'month': return 'Monthly';
      case 'year': return 'Yearly';
      case 'all': return 'All Time';
      default: return 'Weekly';
    }
  };

  return (
    <div className="analytics-page ds-page ds-loaded">
      <GeoBackground />
      <header className="analytics-header ds-header">
        <div className="analytics-header-content ds-header-content">
          <div className="analytics-header-left ds-header-left">
            <button className="nav-menu-btn" onClick={() => window.openGlobalNav && window.openGlobalNav()} aria-label="Open navigation">
              <Menu size={20} />
            </button>
            <h1 className="analytics-logo ds-header-title" onClick={() => navigate('/search-hub')}>
              <div className="analytics-logo-img ds-logo-img" />
              cerbyl
            </h1>
          </div>
          <div className="analytics-header-center ds-header-center">
            <span className="analytics-subtitle">ANALYTICS</span>
          </div>
          <nav className="analytics-header-right ds-header-right">
            <button className="analytics-nav-btn analytics-nav-btn-accent" onClick={() => navigate('/xp-roadmap')}>
              <Trophy size={16} />
              <span>XP ROADMAP</span>
            </button>
            <button className="analytics-nav-btn analytics-nav-btn-accent" onClick={exportData}>
              <Download size={16} />
              <span>EXPORT</span>
            </button>
            <button className="analytics-nav-btn analytics-nav-btn-ghost" onClick={() => navigate('/dashboard')}>
              <span>DASHBOARD</span>
              <ChevronRight size={14} />
            </button>
          </nav>
        </div>
      </header>

      <div className="analytics-container ds-container">
        <div className="analytics-tabs ds-tabs">
          <button 
            className={`analytics-tab ds-tab ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <BarChart3 size={16} />
            OVERVIEW
          </button>
          <button 
            className={`analytics-tab ds-tab ${activeTab === 'detailed-stats' ? 'active' : ''}`}
            onClick={() => setActiveTab('detailed-stats')}
          >
            <Database size={16} />
            DETAILED STATS
          </button>
          <button 
            className={`analytics-tab ds-tab ${activeTab === 'ml-insights' ? 'active' : ''}`}
            onClick={() => setActiveTab('ml-insights')}
          >
            <Cpu size={16} />
            ML INSIGHTS
          </button>
        </div>

        {activeTab === 'overview' && (
          <>
        <div className="analytics-summary-cards">
          <div className="analytics-card analytics-card-accent">
            <div className="analytics-card-icon">
              <Zap size={24} />
            </div>
            <div className="analytics-card-content">
              <span className="analytics-card-value">{totalPoints}</span>
              <span className="analytics-card-label">{getPeriodLabel()} Points</span>
            </div>
          </div>
          <div className="analytics-card">
            <div className="analytics-card-icon">
              <TrendingUp size={24} />
            </div>
            <div className="analytics-card-content">
              <span className="analytics-card-value">{avgPoints.toFixed(1)}</span>
              <span className="analytics-card-label">Avg/{periodStats.groupBy === 'month' ? 'Month' : periodStats.groupBy === 'week' ? 'Week' : 'Day'}</span>
            </div>
          </div>
          <div className="analytics-card">
            <div className="analytics-card-icon">
              <Flame size={24} />
            </div>
            <div className="analytics-card-content">
              <span className="analytics-card-value">{gamificationStats.current_streak || 0}</span>
              <span className="analytics-card-label">Day Streak</span>
            </div>
          </div>
          <div className="analytics-card">
            <div className="analytics-card-icon">
              <Trophy size={24} />
            </div>
            <div className="analytics-card-content">
              <span className="analytics-card-value">#{gamificationStats.global_rank || '-'}</span>
              <span className="analytics-card-label">Global Rank</span>
            </div>
          </div>
        </div>

        <div className="analytics-filters">
          <div className="analytics-filter-group">
            <label>Time Range</label>
            <div className="analytics-filter-buttons">
              <button className={`analytics-filter-btn ${timeRange === 'week' ? 'active' : ''}`} onClick={() => setTimeRange('week')}>
                <Clock size={14} /> week
              </button>
              <button className={`analytics-filter-btn ${timeRange === 'month' ? 'active' : ''}`} onClick={() => setTimeRange('month')}>
                <Calendar size={14} /> month
              </button>
              <button className={`analytics-filter-btn ${timeRange === 'year' ? 'active' : ''}`} onClick={() => setTimeRange('year')}>
                <Calendar size={14} /> year
              </button>
              <button className={`analytics-filter-btn ${timeRange === 'all' ? 'active' : ''}`} onClick={() => setTimeRange('all')}>
                <Activity size={14} /> all
              </button>
            </div>
          </div>
          
          <div className="analytics-filter-group">
            <label>Chart Type</label>
            <div className="analytics-filter-buttons">
              <button className={`analytics-filter-btn ${chartType === 'bar' ? 'active' : ''}`} onClick={() => setChartType('bar')}>
                <BarChart3 size={14} /> bar
              </button>
              <button className={`analytics-filter-btn ${chartType === 'line' ? 'active' : ''}`} onClick={() => setChartType('line')}>
                <Activity size={14} /> line
              </button>
            </div>
          </div>
        </div>

        <div className="analytics-metrics">
          <label>Show Metrics:</label>
          <div className="analytics-metric-chips">
            {Object.entries(metricConfig).map(([key, config]) => (
              <button
                key={key}
                className={`analytics-metric-chip ${selectedMetrics.includes(key) ? 'active' : ''}`}
                onClick={() => toggleMetric(key)}
              >
                {React.createElement(config.icon, { size: 14 })}
                {config.label}
              </button>
            ))}
          </div>
        </div>

        <div className="analytics-chart-section">
          <div className="analytics-chart-header">
            <div>
              <div className="view-heading">
                <span className="view-kicker">Your Data</span>
                <h2 className="view-title">Activity Overview</h2>
                <p className="view-sub">Insights into your learning activity</p>
              </div>
              <span className="analytics-chart-subtitle">{chartData.length} {periodStats.groupBy === 'month' ? 'months' : periodStats.groupBy === 'week' ? 'weeks' : 'days'} of data</span>
            </div>
            <div className="analytics-chart-legend">
              {selectedMetrics.map(metric => (
                <div key={metric} className="analytics-legend-item">
                  <span className="analytics-legend-dot" style={{ backgroundColor: metricConfig[metric].color }}></span>
                  <span>{metricConfig[metric].label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="analytics-chart-area">
            {chartData.length === 0 ? (
              <div className="analytics-chart-empty">
                <BarChart3 size={48} />
                <p>No activity data yet. Start learning to see your progress!</p>
              </div>
            ) : chartType === 'bar' ? (
              <div className="analytics-bar-chart">
                <div className="analytics-y-axis">
                  {[...Array(6)].map((_, i) => {
                    const value = Math.round((maxValue * (5 - i)) / 5 / 10) * 10;
                    return <span key={i} className="analytics-y-label">{value}</span>;
                  })}
                </div>
                <div className="analytics-bars-container">
                  {chartData.map((day, idx) => (
                    <div key={idx} className="analytics-bar-group">
                      <div className="analytics-bars">
                        {selectedMetrics.map(metric => {
                          const value = day[metric] || 0;
                          const height = maxValue > 0 ? (value / maxValue) * 100 : 0;
                          return (
                            <div
                              key={metric}
                              className="analytics-bar"
                              style={{ height: `${height}%`, backgroundColor: metricConfig[metric].color }}
                              title={`${day.label || day.day}: ${metricConfig[metric].label}: ${value}`}
                            />
                          );
                        })}
                      </div>
                      <span className="analytics-x-label">{day.label || day.day}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="analytics-line-chart">
                <svg viewBox={`0 0 ${Math.max(900, chartData.length * 22 + 60)} 420`} preserveAspectRatio="xMidYMid meet">
                  {[...Array(6)].map((_, i) => {
                    const value = Math.round((maxValue * (5 - i)) / 5 / 10) * 10;
                    const y = 30 + (i * 340) / 5;
                    return (
                      <g key={i}>
                        <text x="5" y={y + 4} fontSize="12" fill="var(--text-secondary)" fontWeight="500">{value}</text>
                        <line x1="50" y1={y} x2={Math.max(890, chartData.length * 22 + 50)} y2={y} stroke="var(--border)" strokeWidth="1" strokeDasharray={i === 5 ? "0" : "4,4"} />
                      </g>
                    );
                  })}
                  {selectedMetrics.map(metric => {
                    const points = chartData.map((day, idx) => {
                      const x = (idx / Math.max(chartData.length - 1, 1)) * (Math.max(830, chartData.length * 22)) + 60;
                      const value = day[metric] || 0;
                      const y = 370 - (maxValue > 0 ? (value / maxValue) * 340 : 0);
                      return `${x},${y}`;
                    }).join(' ');

                    return (
                      <g key={metric}>
                        <polyline fill="none" stroke={metricConfig[metric].color} strokeWidth="3" points={points} />
                        {chartData.length <= 50 && chartData.map((day, idx) => {
                          const x = (idx / Math.max(chartData.length - 1, 1)) * (Math.max(830, chartData.length * 22)) + 60;
                          const value = day[metric] || 0;
                          const y = 370 - (maxValue > 0 ? (value / maxValue) * 340 : 0);
                          return (
                            <circle key={idx} cx={x} cy={y} r={chartData.length > 30 ? 5 : 6} fill={metricConfig[metric].color}>
                              <title>{`${day.label || day.day}: ${metricConfig[metric].label}: ${value}`}</title>
                            </circle>
                          );
                        })}
                      </g>
                    );
                  })}
                  {chartData.map((day, idx) => {
                    const showLabel = chartData.length <= 15 || idx === 0 || idx === chartData.length - 1 || (chartData.length <= 30 && idx % 3 === 0) || (chartData.length > 30 && idx % 7 === 0);
                    if (!showLabel) return null;
                    const x = (idx / Math.max(chartData.length - 1, 1)) * (Math.max(830, chartData.length * 22)) + 60;
                    return <text key={idx} x={x} y="395" fontSize={chartData.length > 20 ? "11" : "12"} fill="var(--text-secondary)" textAnchor="middle" fontWeight="600">{(day.label || day.day).toUpperCase()}</text>;
                  })}
                </svg>
              </div>
            )}
          </div>
        </div>

        <div className="analytics-stats-grid">
          <div className="analytics-stat-card">
            <div className="analytics-stat-header">
              <MessageSquare size={18} />
              <span>AI Chats</span>
            </div>
            <div className="analytics-stat-values">
              <div className="analytics-stat-row">
                <span>This Week</span>
                <span className="analytics-stat-value">{weeklyStats.ai_chats || 0}</span>
              </div>
              <div className="analytics-stat-row">
                <span>All Time</span>
                <span className="analytics-stat-value">{gamificationStats.total_ai_chats || 0}</span>
              </div>
            </div>
          </div>

          <div className="analytics-stat-card">
            <div className="analytics-stat-header">
              <BookOpen size={18} />
              <span>Notes Created</span>
            </div>
            <div className="analytics-stat-values">
              <div className="analytics-stat-row">
                <span>This Week</span>
                <span className="analytics-stat-value">{weeklyStats.notes_created || 0}</span>
              </div>
              <div className="analytics-stat-row">
                <span>All Time</span>
                <span className="analytics-stat-value">{gamificationStats.total_notes_created || 0}</span>
              </div>
            </div>
          </div>

          <div className="analytics-stat-card">
            <div className="analytics-stat-header">
              <Brain size={18} />
              <span>Flashcards</span>
            </div>
            <div className="analytics-stat-values">
              <div className="analytics-stat-row">
                <span>This Week</span>
                <span className="analytics-stat-value">{weeklyStats.flashcards_created || 0}</span>
              </div>
              <div className="analytics-stat-row">
                <span>All Time</span>
                <span className="analytics-stat-value">{gamificationStats.total_flashcards_created || 0}</span>
              </div>
            </div>
          </div>

          <div className="analytics-stat-card">
            <div className="analytics-stat-header">
              <Target size={18} />
              <span>Quizzes</span>
            </div>
            <div className="analytics-stat-values">
              <div className="analytics-stat-row">
                <span>This Week</span>
                <span className="analytics-stat-value">{weeklyStats.quizzes_completed || 0}</span>
              </div>
              <div className="analytics-stat-row">
                <span>All Time</span>
                <span className="analytics-stat-value">{gamificationStats.total_quizzes_completed || 0}</span>
              </div>
            </div>
          </div>

          <div className="analytics-stat-card">
            <div className="analytics-stat-header">
              <Clock size={18} />
              <span>Study Time</span>
            </div>
            <div className="analytics-stat-values">
              <div className="analytics-stat-row">
                <span>This Week</span>
                <span className="analytics-stat-value">{Math.floor((weeklyStats.study_minutes || 0) / 60)}h {(weeklyStats.study_minutes || 0) % 60}m</span>
              </div>
              <div className="analytics-stat-row">
                <span>All Time</span>
                <span className="analytics-stat-value">{Math.floor((gamificationStats.total_study_minutes || 0) / 60)}h</span>
              </div>
            </div>
          </div>

          <div className="analytics-stat-card analytics-stat-card-accent">
            <div className="analytics-stat-header">
              <Zap size={18} />
              <span>Total Points</span>
            </div>
            <div className="analytics-stat-values">
              <div className="analytics-stat-row">
                <span>This Week</span>
                <span className="analytics-stat-value">{gamificationStats.weekly_points || 0}</span>
              </div>
              <div className="analytics-stat-row">
                <span>All Time</span>
                <span className="analytics-stat-value analytics-stat-highlight">{gamificationStats.total_points || 0}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="analytics-points-reference">
          <h3>Point System</h3>
          <div className="analytics-points-grid">
            <div className="analytics-point-item"><span>AI Chat</span><span>+1</span></div>
            <div className="analytics-point-item"><span>Answer Question</span><span>+2</span></div>
            <div className="analytics-point-item"><span>Battle Loss</span><span>+2</span></div>
            <div className="analytics-point-item"><span>Battle Draw</span><span>+5</span></div>
            <div className="analytics-point-item"><span>Flashcard Set</span><span>+10</span></div>
            <div className="analytics-point-item"><span>Battle Win</span><span>+10</span></div>
            <div className="analytics-point-item"><span>Complete Quiz</span><span>+15</span></div>
            <div className="analytics-point-item"><span>Create Note</span><span>+20</span></div>
            <div className="analytics-point-item"><span>Quiz 80%+</span><span>+30</span></div>
            <div className="analytics-point-item analytics-point-highlight"><span>Solo Quiz (max)</span><span>+40</span></div>
            <div className="analytics-point-item"><span>Study 1 Hour</span><span>+50</span></div>
          </div>
        </div>
          </>
        )}

        {activeTab === 'detailed-stats' && (
          <div className="detailed-stats-content">
            <div className="stats-section">
              <div className="stats-section-header">
                <MessageSquare size={24} />
                <div>
                  <h2>AI Chat Analytics</h2>
                  <p>Comprehensive breakdown of your AI tutor interactions</p>
                </div>
              </div>
              
              {chatDetails ? (
                <>
                  <div className="stats-grid">
                    <div className="stat-card">
                      <div className="stat-icon"><MessageSquare size={20} /></div>
                      <div className="stat-content">
                        <span className="stat-label">Total Chats</span>
                        <span className="stat-value">{chatDetails.total_chats || 0}</span>
                      </div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-icon"><Clock size={20} /></div>
                      <div className="stat-content">
                        <span className="stat-label">Avg Session Length</span>
                        <span className="stat-value">{chatDetails.avg_session_length || '0m'}</span>
                      </div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-icon"><TrendingUp size={20} /></div>
                      <div className="stat-content">
                        <span className="stat-label">Most Active Day</span>
                        <span className="stat-value">{chatDetails.most_active_day || 'N/A'}</span>
                      </div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-icon"><Sparkles size={20} /></div>
                      <div className="stat-content">
                        <span className="stat-label">Avg Messages/Chat</span>
                        <span className="stat-value">{chatDetails.avg_messages_per_chat || 0}</span>
                      </div>
                    </div>
                  </div>

                  <div className="intent-breakdown">
                    <h3>Intent Classification Breakdown</h3>
                    <div className="intent-grid">
                      {chatDetails.intent_breakdown && Object.entries(chatDetails.intent_breakdown).map(([intent, count]) => (
                        <div key={intent} className="intent-item">
                          <span className="intent-label">{intent}</span>
                          <div className="intent-bar-container">
                            <div 
                              className="intent-bar" 
                              style={{ 
                                width: `${(count / chatDetails.total_chats) * 100}%`,
                                background: accent 
                              }}
                            />
                          </div>
                          <span className="intent-count">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="concept-coverage">
                    <h3>Concepts Discussed</h3>
                    <div className="concept-tags">
                      {chatDetails.top_concepts && chatDetails.top_concepts.map((concept, idx) => (
                        <div key={idx} className="concept-tag">
                          <span className="concept-name">{concept.name}</span>
                          <span className="concept-count">{concept.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="stats-loading">
                  <div className="loading-spinner"></div>
                  <p>Loading chat analytics...</p>
                </div>
              )}
            </div>

            <div className="stats-section">
              <div className="stats-section-header">
                <Brain size={24} />
                <div>
                  <h2>Flashcard Analytics</h2>
                  <p>Detailed insights into your flashcard study sessions</p>
                </div>
              </div>
              
              {flashcardDetails ? (
                <>
                  <div className="stats-grid">
                    <div className="stat-card">
                      <div className="stat-icon"><Brain size={20} /></div>
                      <div className="stat-content">
                        <span className="stat-label">Total Reviews</span>
                        <span className="stat-value">{flashcardDetails.total_reviews || 0}</span>
                      </div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-icon"><CheckCircle size={20} /></div>
                      <div className="stat-content">
                        <span className="stat-label">Accuracy Rate</span>
                        <span className="stat-value">{flashcardDetails.accuracy_rate || '0%'}</span>
                      </div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-icon"><Flame size={20} /></div>
                      <div className="stat-content">
                        <span className="stat-label">Study Streak</span>
                        <span className="stat-value">{flashcardDetails.study_streak || 0} days</span>
                      </div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-icon"><Target size={20} /></div>
                      <div className="stat-content">
                        <span className="stat-label">Mastered Cards</span>
                        <span className="stat-value">{flashcardDetails.mastered_cards || 0}</span>
                      </div>
                    </div>
                  </div>

                  <div className="fsrs-stats">
                    <h3>FSRS Scheduler Performance</h3>
                    <div className="fsrs-grid">
                      <div className="fsrs-metric">
                        <span className="fsrs-label">Avg Retention</span>
                        <span className="fsrs-value">{flashcardDetails.avg_retention || '0%'}</span>
                      </div>
                      <div className="fsrs-metric">
                        <span className="fsrs-label">Cards Due Today</span>
                        <span className="fsrs-value">{flashcardDetails.cards_due_today || 0}</span>
                      </div>
                      <div className="fsrs-metric">
                        <span className="fsrs-label">Optimal Review Time</span>
                        <span className="fsrs-value">{flashcardDetails.optimal_review_time || 'N/A'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="difficulty-distribution">
                    <h3>Card Difficulty Distribution</h3>
                    <div className="difficulty-bars">
                      {flashcardDetails.difficulty_distribution && Object.entries(flashcardDetails.difficulty_distribution).map(([level, count]) => (
                        <div key={level} className="difficulty-bar-item">
                          <span className="difficulty-label">{level}</span>
                          <div className="difficulty-bar-bg">
                            <div 
                              className="difficulty-bar-fill" 
                              style={{ 
                                width: `${(count / flashcardDetails.total_reviews) * 100}%`,
                                background: level === 'easy' ? '#10b981' : level === 'medium' ? '#f59e0b' : '#ef4444'
                              }}
                            />
                          </div>
                          <span className="difficulty-count">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="stats-loading">
                  <div className="loading-spinner"></div>
                  <p>Loading flashcard analytics...</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'ml-insights' && (
          <div className="ml-insights-content">
            <div className="ml-intro">
              <Cpu size={32} />
              <h2>Machine Learning Transparency</h2>
              <p>Full visibility into how our AI models learn from your interactions and adapt to your learning style</p>
            </div>

            {mlStats ? (
              <>
                <div className="ml-section">
                  <div className="ml-section-header">
                    <Network size={24} />
                    <div>
                      <h3>Bayesian Knowledge Tracing (BKT)</h3>
                      <p>Real-time mastery estimation for each concept you study</p>
                    </div>
                  </div>
                  
                  <div className="bkt-overview">
                    <div className="bkt-stat">
                      <span className="bkt-label">Concepts Tracked</span>
                      <span className="bkt-value">{mlStats.bkt_concepts_tracked || 0}</span>
                    </div>
                    <div className="bkt-stat">
                      <span className="bkt-label">Total Updates</span>
                      <span className="bkt-value">{mlStats.bkt_total_updates || 0}</span>
                    </div>
                    <div className="bkt-stat">
                      <span className="bkt-label">Avg Mastery</span>
                      <span className="bkt-value">{mlStats.bkt_avg_mastery || '0%'}</span>
                    </div>
                  </div>

                  <div className="concept-mastery-list">
                    <h4>Top Concepts by Mastery</h4>
                    {mlStats.top_mastery_concepts && mlStats.top_mastery_concepts.map((concept, idx) => (
                      <div key={idx} className="mastery-item">
                        <div className="mastery-header">
                          <span className="mastery-concept">{concept.name}</span>
                          <span className="mastery-percent">{Math.round(concept.mastery * 100)}%</span>
                        </div>
                        <div className="mastery-bar-bg">
                          <div 
                            className="mastery-bar-fill" 
                            style={{ 
                              width: `${concept.mastery * 100}%`,
                              background: concept.mastery > 0.7 ? '#10b981' : concept.mastery > 0.4 ? '#f59e0b' : '#ef4444'
                            }}
                          />
                        </div>
                        <div className="mastery-meta">
                          <span>Interactions: {concept.interaction_count}</span>
                          <span>Last updated: {new Date(concept.last_updated).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="bkt-parameters">
                    <h4>Model Parameters</h4>
                    <div className="param-grid">
                      <div className="param-card">
                        <span className="param-name">P(Learn)</span>
                        <span className="param-value">{mlStats.bkt_p_learn || '0.09'}</span>
                        <span className="param-desc">Probability of learning per interaction</span>
                      </div>
                      <div className="param-card">
                        <span className="param-name">P(Slip)</span>
                        <span className="param-value">{mlStats.bkt_p_slip || '0.10'}</span>
                        <span className="param-desc">Probability of making a mistake despite knowing</span>
                      </div>
                      <div className="param-card">
                        <span className="param-name">P(Guess)</span>
                        <span className="param-value">{mlStats.bkt_p_guess || '0.20'}</span>
                        <span className="param-desc">Probability of guessing correctly</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="ml-section">
                  <div className="ml-section-header">
                    <GitBranch size={24} />
                    <div>
                      <h3>Reinforcement Learning Strategy Agent</h3>
                      <p>Thompson Sampling bandit that selects optimal teaching strategies</p>
                    </div>
                  </div>

                  <div className="rl-overview">
                    <div className="rl-stat">
                      <span className="rl-label">Total Episodes</span>
                      <span className="rl-value">{mlStats.rl_total_episodes || 0}</span>
                    </div>
                    <div className="rl-stat">
                      <span className="rl-label">Exploration Rate</span>
                      <span className="rl-value">{mlStats.rl_exploration_rate || '0%'}</span>
                    </div>
                    <div className="rl-stat">
                      <span className="rl-label">Best Strategy</span>
                      <span className="rl-value">{mlStats.rl_best_strategy || 'N/A'}</span>
                    </div>
                  </div>

                  <div className="strategy-performance">
                    <h4>Strategy Performance</h4>
                    {mlStats.strategy_performance && mlStats.strategy_performance.map((strategy, idx) => (
                      <div key={idx} className="strategy-item">
                        <div className="strategy-header">
                          <span className="strategy-name">{strategy.name}</span>
                          <span className="strategy-reward">Avg Reward: {strategy.avg_reward.toFixed(3)}</span>
                        </div>
                        <div className="strategy-stats">
                          <span>Uses: {strategy.use_count}</span>
                          <span>Success Rate: {strategy.success_rate}%</span>
                          <span>Confidence: {strategy.confidence.toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="rl-explanation">
                    <Info size={20} />
                    <div>
                      <h4>How It Works</h4>
                      <p>The RL agent uses Thompson Sampling to balance exploration (trying new strategies) and exploitation (using proven strategies). It learns which teaching approach works best for you based on your archetype, cognitive state, and mastery level.</p>
                    </div>
                  </div>
                </div>

                <div className="ml-section">
                  <div className="ml-section-header">
                    <Layers size={24} />
                    <div>
                      <h3>Affect Detection Pipeline</h3>
                      <p>Real-time frustration and engagement monitoring</p>
                    </div>
                  </div>

                  <div className="affect-overview">
                    <div className="affect-chart">
                      <h4>Frustration Trend (Last 10 Sessions)</h4>
                      <div className="trend-line">
                        {mlStats.frustration_trend && mlStats.frustration_trend.map((value, idx) => (
                          <div 
                            key={idx} 
                            className="trend-bar"
                            style={{ 
                              height: `${value * 100}%`,
                              background: value > 0.6 ? '#ef4444' : value > 0.3 ? '#f59e0b' : '#10b981'
                            }}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="affect-chart">
                      <h4>Engagement Trend (Last 10 Sessions)</h4>
                      <div className="trend-line">
                        {mlStats.engagement_trend && mlStats.engagement_trend.map((value, idx) => (
                          <div 
                            key={idx} 
                            className="trend-bar"
                            style={{ 
                              height: `${value * 100}%`,
                              background: value > 0.7 ? '#10b981' : value > 0.4 ? '#f59e0b' : '#ef4444'
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="cognitive-states">
                    <h4>Cognitive State Distribution</h4>
                    <div className="state-grid">
                      {mlStats.cognitive_state_distribution && Object.entries(mlStats.cognitive_state_distribution).map(([state, count]) => (
                        <div key={state} className="state-card">
                          <span className="state-name">{state}</span>
                          <span className="state-count">{count}</span>
                          <span className="state-percent">{Math.round((count / mlStats.total_ml_logs) * 100)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="ml-section ds-card">
                  <div className="ml-section-header">
                    <Database size={24} />
                    <div>
                      <h3>Context Sessions</h3>
                      <p>AI conversation context tracking and memory management</p>
                    </div>
                  </div>

                  {contextSessions.length > 0 ? (
                    <div className="context-sessions-list">
                      {contextSessions.map((session, idx) => (
                        <div key={idx} className="context-session-card ds-card-inner">
                          <div className="session-header">
                            <div className="session-info">
                              <span className="session-id">Session #{session.session_id}</span>
                              <span className="session-date">{new Date(session.started_at).toLocaleString()}</span>
                            </div>
                            <div className="session-stats">
                              <span className="session-messages">{session.message_count} messages</span>
                            </div>
                          </div>
                          
                          {session.current_concept_id && (
                            <div className="session-concept">
                              <Sparkles size={14} />
                              <span>Current Concept: {session.current_concept_id}</span>
                            </div>
                          )}
                          
                          {session.session_brief && (
                            <div className="session-brief">
                              <p>{session.session_brief}</p>
                            </div>
                          )}
                          
                          <div className="session-trends">
                            <div className="trend-item">
                              <span className="trend-label">Frustration</span>
                              <div className="trend-mini-bars">
                                {(session.frustration_trend || []).slice(-5).map((val, i) => (
                                  <div 
                                    key={i} 
                                    className="trend-mini-bar"
                                    style={{ 
                                      height: `${val * 100}%`,
                                      background: val > 0.6 ? '#ef4444' : val > 0.3 ? '#f59e0b' : '#10b981'
                                    }}
                                  />
                                ))}
                              </div>
                            </div>
                            <div className="trend-item">
                              <span className="trend-label">Engagement</span>
                              <div className="trend-mini-bars">
                                {(session.engagement_trend || []).slice(-5).map((val, i) => (
                                  <div 
                                    key={i} 
                                    className="trend-mini-bar"
                                    style={{ 
                                      height: `${val * 100}%`,
                                      background: val > 0.7 ? '#10b981' : val > 0.4 ? '#f59e0b' : '#ef4444'
                                    }}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>
                          
                          {session.last_message_at && (
                            <div className="session-footer">
                              <Clock size={12} />
                              <span>Last activity: {new Date(session.last_message_at).toLocaleString()}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="stats-loading">
                      <div className="loading-spinner"></div>
                      <p>Loading context sessions...</p>
                    </div>
                  )}
                </div>

                <div className="ml-section ds-card">
                  <div className="ml-section-header">
                    <Database size={24} />
                    <div>
                      <h3>Model Update History</h3>
                      <p>Track how the models have evolved with your interactions</p>
                    </div>
                  </div>

                  <div className="update-timeline">
                    {mlStats.recent_updates && mlStats.recent_updates.map((update, idx) => (
                      <div key={idx} className="update-item">
                        <div className="update-timestamp">{new Date(update.timestamp).toLocaleString()}</div>
                        <div className="update-content">
                          <span className="update-type">{update.update_type}</span>
                          <span className="update-desc">{update.description}</span>
                        </div>
                        <div className="update-impact">
                          {update.impact > 0 ? (
                            <><TrendingUp size={16} /> +{update.impact.toFixed(2)}</>
                          ) : (
                            <><TrendingDown size={16} /> {update.impact.toFixed(2)}</>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="ml-transparency-note">
                  <AlertCircle size={20} />
                  <div>
                    <h4>Full Transparency Commitment</h4>
                    <p>All ML models are trained exclusively on your data and adapt to your learning patterns. We never share your data with third parties. You can export all your ML data at any time from the Export button above.</p>
                  </div>
                </div>
              </>
            ) : (
              <div className="stats-loading">
                <div className="loading-spinner"></div>
                <p>Loading ML insights...</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Analytics;

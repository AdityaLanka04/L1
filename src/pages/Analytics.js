import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ChevronLeft, TrendingUp, Download, ChevronRight,
  BarChart3, Activity, Zap, BookOpen, MessageSquare,
  Trophy, Target, Flame, Clock, Brain, Swords, Calendar
} from 'lucide-react';
import './Analytics.css';
import { API_URL } from '../config';
import { useTheme } from '../contexts/ThemeContext';

const Analytics = () => {
  const navigate = useNavigate();
  const { selectedTheme } = useTheme();
  const token = localStorage.getItem('token');
  const userName = localStorage.getItem('username');
  
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [timeRange, setTimeRange] = useState('week');
  const [chartType, setChartType] = useState('bar');
  const [selectedMetrics, setSelectedMetrics] = useState(['points', 'ai_chats', 'notes', 'flashcards', 'quizzes']);
  
  const [weeklyData, setWeeklyData] = useState([]);
  const [dailyBreakdown, setDailyBreakdown] = useState([]);
  const [weeklyStats, setWeeklyStats] = useState({});
  const [gamificationStats, setGamificationStats] = useState({});
  const [historicalData, setHistoricalData] = useState([]);
  const [periodStats, setPeriodStats] = useState({ totalPoints: 0, totalActivities: 0 });
  
  // Weak areas state
  const [weakAreasData, setWeakAreasData] = useState(null);
  const [weakAreasLoading, setWeakAreasLoading] = useState(false);
  const [weakAreasFilter, setWeakAreasFilter] = useState('all'); // 'all', 'critical', 'needs_practice', 'improving'

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

  const loadAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadWeeklyProgress(),
        loadGamificationStats(),
        loadHistoricalData()
      ]);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const loadWeakAreas = async () => {
    setWeakAreasLoading(true);
    try {
      console.log('Loading weak areas for user:', userName);
      const response = await fetch(`${API_URL}/study_insights/strengths_weaknesses?user_id=${userName}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      console.log('Weak areas response status:', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('Weak areas data:', data);
        setWeakAreasData(data);
      } else {
        const errorText = await response.text();
        console.error('Weak areas error response:', errorText);
      }
    } catch (error) {
      console.error('Error loading weak areas:', error);
    } finally {
      setWeakAreasLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'weak-areas' && !weakAreasData) {
      loadWeakAreas();
    }
  }, [activeTab]);

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
    <div className="analytics-page">
      {/* Standardized Header - Exact copy from Profile */}
      <header className="analytics-header">
        <div className="analytics-header-left">
          <h1 className="analytics-logo" onClick={() => navigate('/dashboard')}>cerbyl</h1>
          <div className="analytics-header-divider"></div>
          <span className="analytics-subtitle">Analytics</span>
        </div>
        <nav className="analytics-header-right">
          <button className="analytics-nav-btn analytics-nav-btn-accent" onClick={exportData}>
            <Download size={16} />
            <span>Export</span>
          </button>
          <button className="analytics-nav-btn analytics-nav-btn-ghost" onClick={() => navigate('/dashboard')}>
            <span>Dashboard</span>
            <ChevronRight size={14} />
          </button>
        </nav>
      </header>

      <div className="analytics-container">
        {/* Tab Navigation */}
        <div className="analytics-tabs">
          <button 
            className={`analytics-tab ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <Activity size={16} />
            OVERVIEW
          </button>
          <button 
            className={`analytics-tab ${activeTab === 'weak-areas' ? 'active' : ''}`}
            onClick={() => setActiveTab('weak-areas')}
          >
            <Target size={16} />
            WEAK AREAS
          </button>
        </div>

        {/* Overview Tab Content */}
        {activeTab === 'overview' && (
          <>
        {/* Summary Cards */}
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

        {/* Filters */}
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

        {/* Metrics Toggles */}
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

        {/* Main Chart */}
        <div className="analytics-chart-section">
          <div className="analytics-chart-header">
            <div>
              <h2>Activity Overview</h2>
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

        {/* Stats Grid */}
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

        {/* Points Reference */}
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

        {/* Weak Areas Tab Content */}
        {activeTab === 'weak-areas' && (
          <div className="weak-areas-content">
            {weakAreasLoading ? (
              <div className="weak-areas-loading">
                <div className="loading-spinner"></div>
                <p>Analyzing your performance...</p>
              </div>
            ) : weakAreasData ? (
              <>
                {/* Summary Stats */}
                <div className="weak-areas-summary">
                  <div 
                    className={`weak-summary-card critical ${weakAreasFilter === 'critical' ? 'active' : ''}`}
                    onClick={() => setWeakAreasFilter(weakAreasFilter === 'critical' ? 'all' : 'critical')}
                    style={{ cursor: 'pointer' }}
                  >
                    <span className="weak-summary-value">{weakAreasData.summary?.critical_count || 0}</span>
                    <span className="weak-summary-label">CRITICAL</span>
                  </div>
                  <div 
                    className={`weak-summary-card needs-practice ${weakAreasFilter === 'needs_practice' ? 'active' : ''}`}
                    onClick={() => setWeakAreasFilter(weakAreasFilter === 'needs_practice' ? 'all' : 'needs_practice')}
                    style={{ cursor: 'pointer' }}
                  >
                    <span className="weak-summary-value">{weakAreasData.summary?.needs_practice_count || 0}</span>
                    <span className="weak-summary-label">NEEDS PRACTICE</span>
                  </div>
                  <div 
                    className={`weak-summary-card improving ${weakAreasFilter === 'improving' ? 'active' : ''}`}
                    onClick={() => setWeakAreasFilter(weakAreasFilter === 'improving' ? 'all' : 'improving')}
                    style={{ cursor: 'pointer' }}
                  >
                    <span className="weak-summary-value">{weakAreasData.summary?.improving_count || 0}</span>
                    <span className="weak-summary-label">IMPROVING</span>
                  </div>
                  <div 
                    className={`weak-summary-card strong ${weakAreasFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setWeakAreasFilter('all')}
                    style={{ cursor: 'pointer' }}
                  >
                    <span className="weak-summary-value">{weakAreasData.summary?.strong_count || 0}</span>
                    <span className="weak-summary-label">ALL</span>
                  </div>
                </div>

                {/* Critical Areas */}
                {(weakAreasFilter === 'all' || weakAreasFilter === 'critical') && weakAreasData.weak_areas?.critical?.length > 0 && (
                  <div className="weak-areas-section">
                    <h2 className="weak-section-title">CRITICAL AREAS</h2>
                    <div className="weak-areas-grid">
                      {weakAreasData.weak_areas.critical.map((area, idx) => (
                        <div key={idx} className="weak-area-card critical">
                          <div className="weak-card-header">
                            <h3 className="weak-card-topic">{area.topic}</h3>
                            <span className="weak-card-severity">{area.severity_score}</span>
                          </div>
                          <div className="weak-card-accuracy">
                            <span className="weak-accuracy-label">ACCURACY</span>
                            <span className="weak-accuracy-value">{area.accuracy}%</span>
                          </div>
                          <div className="weak-card-sources">
                            {area.sources?.includes('quiz') && <span className="weak-source-badge quiz">QUIZ</span>}
                            {area.sources?.includes('flashcard') && <span className="weak-source-badge flashcard">FLASHCARD</span>}
                            {area.sources?.includes('chat') && <span className="weak-source-badge chat">CHAT</span>}
                          </div>
                          <div className="weak-card-stats">
                            <div className="weak-stat">
                              <span className="weak-stat-label">Total</span>
                              <span className="weak-stat-value">{area.total_attempts}</span>
                            </div>
                            <div className="weak-stat">
                              <span className="weak-stat-label">Wrong</span>
                              <span className="weak-stat-value">{area.total_wrong}</span>
                            </div>
                          </div>
                          <button 
                            className="weak-practice-btn"
                            onClick={() => navigate('/ai-chat', { state: { initialMessage: `Help me practice ${area.topic}` }})}
                          >
                            PRACTICE NOW
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Needs Practice */}
                {(weakAreasFilter === 'all' || weakAreasFilter === 'needs_practice') && weakAreasData.weak_areas?.needs_practice?.length > 0 && (
                  <div className="weak-areas-section">
                    <h2 className="weak-section-title">NEEDS PRACTICE</h2>
                    <div className="weak-areas-grid">
                      {weakAreasData.weak_areas.needs_practice.map((area, idx) => (
                        <div key={idx} className="weak-area-card needs-practice">
                          <div className="weak-card-header">
                            <h3 className="weak-card-topic">{area.topic}</h3>
                            <span className="weak-card-severity">{area.severity_score}</span>
                          </div>
                          <div className="weak-card-accuracy">
                            <span className="weak-accuracy-label">ACCURACY</span>
                            <span className="weak-accuracy-value">{area.accuracy}%</span>
                          </div>
                          <div className="weak-card-sources">
                            {area.sources?.includes('quiz') && <span className="weak-source-badge quiz">QUIZ</span>}
                            {area.sources?.includes('flashcard') && <span className="weak-source-badge flashcard">FLASHCARD</span>}
                            {area.sources?.includes('chat') && <span className="weak-source-badge chat">CHAT</span>}
                          </div>
                          <div className="weak-card-stats">
                            <div className="weak-stat">
                              <span className="weak-stat-label">Total</span>
                              <span className="weak-stat-value">{area.total_attempts}</span>
                            </div>
                            <div className="weak-stat">
                              <span className="weak-stat-label">Wrong</span>
                              <span className="weak-stat-value">{area.total_wrong}</span>
                            </div>
                          </div>
                          <button 
                            className="weak-practice-btn"
                            onClick={() => navigate('/ai-chat', { state: { initialMessage: `Help me practice ${area.topic}` }})}
                          >
                            PRACTICE NOW
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Improving */}
                {(weakAreasFilter === 'all' || weakAreasFilter === 'improving') && weakAreasData.weak_areas?.improving?.length > 0 && (
                  <div className="weak-areas-section">
                    <h2 className="weak-section-title">IMPROVING</h2>
                    <div className="weak-areas-grid">
                      {weakAreasData.weak_areas.improving.map((area, idx) => (
                        <div key={idx} className="weak-area-card improving">
                          <div className="weak-card-header">
                            <h3 className="weak-card-topic">{area.topic}</h3>
                            <span className="weak-card-severity">{area.severity_score}</span>
                          </div>
                          <div className="weak-card-accuracy">
                            <span className="weak-accuracy-label">ACCURACY</span>
                            <span className="weak-accuracy-value">{area.accuracy}%</span>
                          </div>
                          <div className="weak-card-sources">
                            {area.sources?.includes('quiz') && <span className="weak-source-badge quiz">QUIZ</span>}
                            {area.sources?.includes('flashcard') && <span className="weak-source-badge flashcard">FLASHCARD</span>}
                            {area.sources?.includes('chat') && <span className="weak-source-badge chat">CHAT</span>}
                          </div>
                          <div className="weak-card-stats">
                            <div className="weak-stat">
                              <span className="weak-stat-label">Total</span>
                              <span className="weak-stat-value">{area.total_attempts}</span>
                            </div>
                            <div className="weak-stat">
                              <span className="weak-stat-label">Wrong</span>
                              <span className="weak-stat-value">{area.total_wrong}</span>
                            </div>
                          </div>
                          <button 
                            className="weak-practice-btn"
                            onClick={() => navigate('/ai-chat', { state: { initialMessage: `Help me practice ${area.topic}` }})}
                          >
                            PRACTICE NOW
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Empty State */}
                {weakAreasFilter === 'all' && !weakAreasData.weak_areas?.critical?.length && 
                 !weakAreasData.weak_areas?.needs_practice?.length && 
                 !weakAreasData.weak_areas?.improving?.length && (
                  <div className="weak-areas-empty">
                    <Trophy size={64} />
                    <h3>No Weak Areas Detected!</h3>
                    <p>You're doing great! Keep up the excellent work.</p>
                    <button className="weak-empty-btn" onClick={() => navigate('/ai-chat')}>
                      START LEARNING
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="weak-areas-empty">
                <Target size={64} />
                <h3>No Data Available</h3>
                <p>Start learning to see your weak areas analysis.</p>
                <button className="weak-empty-btn" onClick={() => navigate('/ai-chat')}>
                  START LEARNING
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Analytics;

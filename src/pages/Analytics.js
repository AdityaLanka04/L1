import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ChevronLeft, TrendingUp, Download,
  BarChart3, Activity, Zap, BookOpen, MessageSquare,
  Trophy, Target, Flame, Clock, Brain, Swords, Calendar
} from 'lucide-react';
import './Analytics.css';
import { API_URL } from '../config';

const Analytics = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const userName = localStorage.getItem('username');
  
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('week');
  const [chartType, setChartType] = useState('bar');
  const [selectedMetrics, setSelectedMetrics] = useState(['points', 'ai_chats', 'quizzes', 'flashcards']);
  
  const [weeklyData, setWeeklyData] = useState([]);
  const [dailyBreakdown, setDailyBreakdown] = useState([]);
  const [weeklyStats, setWeeklyStats] = useState({});
  const [gamificationStats, setGamificationStats] = useState({});
  const [historicalData, setHistoricalData] = useState([]);
  const [periodStats, setPeriodStats] = useState({ totalPoints: 0, totalActivities: 0 });

  const metricConfig = {
    points: { label: 'Points', color: '#8b5cf6', icon: Zap },
    ai_chats: { label: 'AI Chats', color: '#3b82f6', icon: MessageSquare },
    notes: { label: 'Notes', color: '#10b981', icon: BookOpen },
    flashcards: { label: 'Flashcards', color: '#f59e0b', icon: Brain },
    quizzes: { label: 'Quizzes', color: '#ef4444', icon: Target },
    solo_quizzes: { label: 'Solo Quizzes', color: '#ec4899', icon: Trophy },
    battles: { label: 'Battles', color: '#06b6d4', icon: Swords },
    study_minutes: { label: 'Study Time', color: '#84cc16', icon: Clock }
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
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
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
      console.error('Error loading weekly progress:', error);
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
      console.error('Error loading gamification stats:', error);
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
      console.error('Error loading historical data:', error);
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
        <div className="loading-container">
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
      <header className="analytics-header">
        <div className="analytics-header-inner">
          <div className="header-left">
            <div className="header-title">
              <h1>analytics dashboard</h1>
              <p>track your learning progress</p>
            </div>
          </div>
          <div className="header-right">
            <button className="back-btn" onClick={() => navigate('/dashboard')} title="Back to Dashboard">
              <ChevronLeft size={20} />
            </button>
            <button className="export-btn" onClick={exportData}>
              <Download size={16} />
              Export
            </button>
          </div>
        </div>
      </header>

      <div className="analytics-container">
        <div className="summary-cards">
          <div className="summary-card accent">
            <div className="card-icon"><Zap size={28} /></div>
            <div className="card-content">
              <span className="card-value">{totalPoints}</span>
              <span className="card-label">{getPeriodLabel()} Points</span>
            </div>
          </div>
          <div className="summary-card">
            <div className="card-icon"><TrendingUp size={28} /></div>
            <div className="card-content">
              <span className="card-value">{avgPoints.toFixed(1)}</span>
              <span className="card-label">Avg/{periodStats.groupBy === 'month' ? 'Month' : periodStats.groupBy === 'week' ? 'Week' : 'Day'}</span>
            </div>
          </div>
          <div className="summary-card">
            <div className="card-icon"><Flame size={28} /></div>
            <div className="card-content">
              <span className="card-value">{gamificationStats.current_streak || 0}</span>
              <span className="card-label">Day Streak</span>
            </div>
          </div>
          <div className="summary-card">
            <div className="card-icon"><Trophy size={28} /></div>
            <div className="card-content">
              <span className="card-value">#{gamificationStats.global_rank || '-'}</span>
              <span className="card-label">Global Rank</span>
            </div>
          </div>
        </div>

        <div className="filters-section">
          <div className="filter-group">
            <label>Time Range</label>
            <div className="filter-buttons">
              <button className={`filter-btn ${timeRange === 'week' ? 'active' : ''}`} onClick={() => setTimeRange('week')}>
                <Clock size={14} /> week
              </button>
              <button className={`filter-btn ${timeRange === 'month' ? 'active' : ''}`} onClick={() => setTimeRange('month')}>
                <Calendar size={14} /> month
              </button>
              <button className={`filter-btn ${timeRange === 'year' ? 'active' : ''}`} onClick={() => setTimeRange('year')}>
                <Calendar size={14} /> year
              </button>
              <button className={`filter-btn ${timeRange === 'all' ? 'active' : ''}`} onClick={() => setTimeRange('all')}>
                <Activity size={14} /> all
              </button>
            </div>
          </div>
          
          <div className="filter-group">
            <label>Chart Type</label>
            <div className="filter-buttons">
              <button className={`filter-btn ${chartType === 'bar' ? 'active' : ''}`} onClick={() => setChartType('bar')}>
                <BarChart3 size={14} /> bar
              </button>
              <button className={`filter-btn ${chartType === 'line' ? 'active' : ''}`} onClick={() => setChartType('line')}>
                <Activity size={14} /> line
              </button>
            </div>
          </div>
        </div>

        <div className="metrics-toggles">
          <label>Show Metrics:</label>
          <div className="metric-chips">
            {Object.entries(metricConfig).map(([key, config]) => (
              <button
                key={key}
                className={`metric-chip ${selectedMetrics.includes(key) ? 'active' : ''}`}
                onClick={() => toggleMetric(key)}
                style={{
                  '--chip-color': config.color,
                  '--chip-color-rgb': config.color.replace('#', '').match(/.{2}/g).map(x => parseInt(x, 16)).join(',')
                }}
              >
                {React.createElement(config.icon, { size: 14 })}
                {config.label}
              </button>
            ))}
          </div>
        </div>

        <div className="main-chart-section">
          <div className="chart-header">
            <div className="chart-title-section">
              <h2>activity overview</h2>
              <span className="chart-subtitle">{chartData.length} {periodStats.groupBy === 'month' ? 'months' : periodStats.groupBy === 'week' ? 'weeks' : 'days'} of data</span>
            </div>
            <div className="chart-legend">
              {selectedMetrics.map(metric => (
                <div key={metric} className="legend-item">
                  <span className="legend-dot" style={{ backgroundColor: metricConfig[metric].color }}></span>
                  <span>{metricConfig[metric].label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="chart-area">
            {chartData.length === 0 ? (
              <div className="chart-empty">
                <BarChart3 size={48} style={{ opacity: 0.3 }} />
                No activity data yet. Start learning to see your progress!
              </div>
            ) : chartType === 'bar' ? (
              <div className="bar-chart">
                <div className="y-axis">
                  {[...Array(6)].map((_, i) => (
                    <span key={i} className="y-label">
                      {Math.round((maxValue * (5 - i)) / 5)}
                    </span>
                  ))}
                </div>
                <div className="bars-container">
                  {chartData.map((day, idx) => (
                    <div key={idx} className="bar-group">
                      <div className="bars">
                        {selectedMetrics.map(metric => {
                          const value = day[metric] || 0;
                          const height = maxValue > 0 ? (value / maxValue) * 100 : 0;
                          return (
                            <div
                              key={metric}
                              className="bar"
                              style={{
                                height: `${height}%`,
                                backgroundColor: metricConfig[metric].color
                              }}
                              title={`${day.label || day.day}: ${metricConfig[metric].label}: ${value}`}
                            />
                          );
                        })}
                      </div>
                      <span className="x-label">{day.label || day.day}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="line-chart">
                <svg viewBox={`0 0 ${Math.max(700, chartData.length * 18)} 300`} preserveAspectRatio="xMidYMid meet">
                  <defs>
                    <linearGradient id="grid-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="rgba(255,255,255,0.05)" />
                      <stop offset="100%" stopColor="rgba(255,255,255,0.01)" />
                    </linearGradient>
                  </defs>
                  {[...Array(6)].map((_, i) => (
                    <line
                      key={i}
                      x1="10"
                      y1={10 + (i * 280) / 5}
                      x2={Math.max(690, chartData.length * 18)}
                      y2={10 + (i * 280) / 5}
                      stroke="rgba(255,255,255,0.05)"
                      strokeWidth="1"
                    />
                  ))}
                  {selectedMetrics.map(metric => {
                    const points = chartData.map((day, idx) => {
                      const x = (idx / Math.max(chartData.length - 1, 1)) * (Math.max(680, chartData.length * 18)) + 10;
                      const value = day[metric] || 0;
                      const y = 290 - (maxValue > 0 ? (value / maxValue) * 280 : 0);
                      return `${x},${y}`;
                    }).join(' ');

                    return (
                      <g key={metric}>
                        <polyline
                          fill="none"
                          stroke={metricConfig[metric].color}
                          strokeWidth="2"
                          points={points}
                        />
                        {chartData.length <= 50 && chartData.map((day, idx) => {
                          const x = (idx / Math.max(chartData.length - 1, 1)) * (Math.max(680, chartData.length * 18)) + 10;
                          const value = day[metric] || 0;
                          const y = 290 - (maxValue > 0 ? (value / maxValue) * 280 : 0);
                          return (
                            <circle
                              key={idx}
                              cx={x}
                              cy={y}
                              r={chartData.length > 30 ? 3 : 5}
                              fill={metricConfig[metric].color}
                            >
                              <title>{`${day.label || day.day}: ${metricConfig[metric].label}: ${value}`}</title>
                            </circle>
                          );
                        })}
                      </g>
                    );
                  })}
                </svg>
                <div className="line-x-labels" style={{
                  justifyContent: chartData.length > 15 ? 'flex-start' : 'space-around',
                  gap: chartData.length > 15 ? '0' : '8px',
                  overflowX: chartData.length > 15 ? 'auto' : 'visible'
                }}>
                  {chartData.map((day, idx) => {
                    const showLabel = chartData.length <= 15 || 
                      idx === 0 || 
                      idx === chartData.length - 1 || 
                      (chartData.length <= 30 && idx % 3 === 0) ||
                      (chartData.length > 30 && idx % 7 === 0);
                    return showLabel ? (
                      <span key={idx} style={{
                        fontSize: chartData.length > 20 ? '0.65rem' : '0.75rem',
                        minWidth: chartData.length > 15 ? `${100 / Math.min(chartData.length, 10)}%` : 'auto'
                      }}>{day.label || day.day}</span>
                    ) : null;
                  })}
                </div>
              </div>
            )}
          </div>
        </div>


        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-header">
              <MessageSquare size={20} style={{ color: metricConfig.ai_chats.color }} />
              <span>AI Chats</span>
            </div>
            <div className="stat-values">
              <div className="stat-row">
                <span>This Week</span>
                <span className="value">{weeklyStats.ai_chats || 0}</span>
              </div>
              <div className="stat-row">
                <span>All Time</span>
                <span className="value">{gamificationStats.total_ai_chats || 0}</span>
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <BookOpen size={20} style={{ color: metricConfig.notes.color }} />
              <span>Notes Created</span>
            </div>
            <div className="stat-values">
              <div className="stat-row">
                <span>This Week</span>
                <span className="value">{weeklyStats.notes_created || 0}</span>
              </div>
              <div className="stat-row">
                <span>All Time</span>
                <span className="value">{gamificationStats.total_notes_created || 0}</span>
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <Brain size={20} style={{ color: metricConfig.flashcards.color }} />
              <span>Flashcards</span>
            </div>
            <div className="stat-values">
              <div className="stat-row">
                <span>This Week</span>
                <span className="value">{weeklyStats.flashcards_created || 0}</span>
              </div>
              <div className="stat-row">
                <span>All Time</span>
                <span className="value">{gamificationStats.total_flashcards_created || 0}</span>
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <Target size={20} style={{ color: metricConfig.quizzes.color }} />
              <span>Quizzes</span>
            </div>
            <div className="stat-values">
              <div className="stat-row">
                <span>This Week</span>
                <span className="value">{weeklyStats.quizzes_completed || 0}</span>
              </div>
              <div className="stat-row">
                <span>All Time</span>
                <span className="value">{gamificationStats.total_quizzes_completed || 0}</span>
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <Trophy size={20} style={{ color: metricConfig.solo_quizzes.color }} />
              <span>Solo Quizzes</span>
            </div>
            <div className="stat-values">
              <div className="stat-row">
                <span>This Week</span>
                <span className="value">{weeklyStats.solo_quizzes || 0}</span>
              </div>
              <div className="stat-row">
                <span>All Time</span>
                <span className="value">{gamificationStats.total_solo_quizzes || 0}</span>
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <Swords size={20} style={{ color: metricConfig.battles.color }} />
              <span>Battles Won</span>
            </div>
            <div className="stat-values">
              <div className="stat-row">
                <span>This Week</span>
                <span className="value">{weeklyStats.battles_won || 0}</span>
              </div>
              <div className="stat-row">
                <span>All Time</span>
                <span className="value">{gamificationStats.total_battles_won || 0}</span>
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <Clock size={20} style={{ color: metricConfig.study_minutes.color }} />
              <span>Study Time</span>
            </div>
            <div className="stat-values">
              <div className="stat-row">
                <span>This Week</span>
                <span className="value">{Math.floor((weeklyStats.study_minutes || 0) / 60)}h {(weeklyStats.study_minutes || 0) % 60}m</span>
              </div>
              <div className="stat-row">
                <span>All Time</span>
                <span className="value">{Math.floor((gamificationStats.total_study_minutes || 0) / 60)}h</span>
              </div>
            </div>
          </div>

          <div className="stat-card accent-card">
            <div className="stat-header">
              <Zap size={20} />
              <span>Total Points</span>
            </div>
            <div className="stat-values">
              <div className="stat-row">
                <span>This Week</span>
                <span className="value">{gamificationStats.weekly_points || 0}</span>
              </div>
              <div className="stat-row">
                <span>All Time</span>
                <span className="value highlight">{gamificationStats.total_points || 0}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="points-reference">
          <h3>point system</h3>
          <div className="points-grid">
            <div className="point-item"><span>AI Chat</span><span>+1</span></div>
            <div className="point-item"><span>Answer Question</span><span>+2</span></div>
            <div className="point-item"><span>Battle Loss</span><span>+2</span></div>
            <div className="point-item"><span>Battle Draw</span><span>+5</span></div>
            <div className="point-item"><span>Flashcard Set</span><span>+10</span></div>
            <div className="point-item"><span>Battle Win</span><span>+10</span></div>
            <div className="point-item"><span>Complete Quiz</span><span>+15</span></div>
            <div className="point-item"><span>Create Note</span><span>+20</span></div>
            <div className="point-item"><span>Quiz 80%+</span><span>+30</span></div>
            <div className="point-item highlight"><span>Solo Quiz (max)</span><span>+40</span></div>
            <div className="point-item"><span>Study 1 Hour</span><span>+50</span></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
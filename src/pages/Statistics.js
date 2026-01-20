import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader, TrendingUp, BookOpen, Target, Clock } from 'lucide-react';
import './Statistics.css';
import { API_URL } from '../config';
const Statistics = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const [userName, setUserName] = useState('');

  // State
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [learningReviews, setLearningReviews] = useState([]);
  const [timeRange, setTimeRange] = useState('all');

  useEffect(() => {
    fetchUserProfile();
    fetchStatistics();
  }, [token, timeRange]);

  const fetchUserProfile = async () => {
    try {
      const response = await fetch(`${API_URL}/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setUserName(data.first_name || 'User');
      }
    } catch (error) {
          }
  };

  const fetchStatistics = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/get_learning_reviews?time_range=${timeRange}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setLearningReviews(data.reviews || []);
        
        // Calculate stats from reviews
        const calculatedStats = calculateStats(data.reviews || []);
        setStats(calculatedStats);
      }
    } catch (error) {
          } finally {
      setLoading(false);
    }
  };

  const calculateStats = (reviews) => {
    if (!reviews || reviews.length === 0) {
      return {
        totalSessions: 0,
        totalTime: 0,
        averageScore: 0,
        topicsCovered: 0,
        strengthAreas: [],
        improvementAreas: []
      };
    }

    const totalSessions = reviews.length;
    const totalTime = reviews.reduce((sum, r) => sum + (r.duration || 0), 0);
    const scores = reviews.filter(r => r.score !== undefined).map(r => r.score);
    const averageScore = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : 0;
    const uniqueTopics = new Set(reviews.map(r => r.topic).filter(Boolean));
    const topicsCovered = uniqueTopics.size;

    // Group by topic to find strengths/improvements
    const topicStats = {};
    reviews.forEach(r => {
      if (r.topic) {
        if (!topicStats[r.topic]) {
          topicStats[r.topic] = { scores: [], count: 0 };
        }
        topicStats[r.topic].count++;
        if (r.score !== undefined) {
          topicStats[r.topic].scores.push(r.score);
        }
      }
    });

    const topicPerformance = Object.entries(topicStats).map(([topic, data]) => ({
      topic,
      avgScore: data.scores.length > 0 ? (data.scores.reduce((a, b) => a + b, 0) / data.scores.length).toFixed(1) : 0,
      count: data.count
    }));

    const strengthAreas = topicPerformance.filter(t => t.avgScore >= 75).map(t => t.topic).slice(0, 3);
    const improvementAreas = topicPerformance.filter(t => t.avgScore < 60).map(t => t.topic).slice(0, 3);

    return {
      totalSessions,
      totalTime: Math.round(totalTime / 60), // convert to minutes
      averageScore,
      topicsCovered,
      strengthAreas,
      improvementAreas
    };
  };

  return (
    <div className="st-page">
      <header className="st-header">
        <div className="st-header-left">
          <button className="st-back-btn" onClick={() => navigate('/learning-review')}>
            <ArrowLeft size={20} />
            <span>BACK</span>
          </button>
          <div className="st-header-title-group">
            <h1 className="st-logo">
              <div className="st-logo-img" />
              cerbyl
            </h1>
            <span className="st-subtitle">STATISTICS</span>
          </div>
        </div>
        <div className="st-header-right">
          <button className="st-nav-btn" onClick={() => navigate('/dashboard')}>Dashboard</button>
          <button className="st-nav-btn logout" onClick={() => { localStorage.removeItem('token'); navigate('/login'); }}>Logout</button>
        </div>
      </header>

      <div className="st-filters">
        <div className="st-filter-group">
          <label className="st-filter-label">Time Range</label>
          <div className="st-filter-buttons">
            {['week', 'month', 'all'].map(range => (
              <button
                key={range}
                className={`st-filter-btn ${timeRange === range ? 'active' : ''}`}
                onClick={() => setTimeRange(range)}
              >
                {range.charAt(0).toUpperCase() + range.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="st-content">
        {loading ? (
          <div className="st-loading">
            <Loader size={40} className="st-spinner" />
            <p>Loading statistics...</p>
          </div>
        ) : !stats ? (
          <div className="st-empty">
            <p>No data available yet</p>
          </div>
        ) : (
          <>
            {/* STATS GRID */}
            <div className="st-stats-grid">
              <div className="st-stat-card">
                <div className="st-stat-icon">
                  <BookOpen size={24} />
                </div>
                <div className="st-stat-content">
                  <p className="st-stat-label">Total Sessions</p>
                  <p className="st-stat-value">{stats.totalSessions}</p>
                </div>
              </div>

              <div className="st-stat-card">
                <div className="st-stat-icon">
                  <Clock size={24} />
                </div>
                <div className="st-stat-content">
                  <p className="st-stat-label">Study Time (minutes)</p>
                  <p className="st-stat-value">{stats.totalTime}</p>
                </div>
              </div>

              <div className="st-stat-card">
                <div className="st-stat-icon">
                  <TrendingUp size={24} />
                </div>
                <div className="st-stat-content">
                  <p className="st-stat-label">Average Score</p>
                  <p className="st-stat-value">{stats.averageScore}%</p>
                </div>
              </div>

              <div className="st-stat-card">
                <div className="st-stat-icon">
                  <Target size={24} />
                </div>
                <div className="st-stat-content">
                  <p className="st-stat-label">Topics Covered</p>
                  <p className="st-stat-value">{stats.topicsCovered}</p>
                </div>
              </div>
            </div>

            {/* PERFORMANCE SECTIONS */}
            <div className="st-performance-grid">
              {/* STRENGTH AREAS */}
              <div className="st-performance-card">
                <div className="st-performance-header st-strength">
                  <TrendingUp size={20} />
                  <h3 className="st-performance-title">Strength Areas</h3>
                </div>
                {stats.strengthAreas.length > 0 ? (
                  <div className="st-performance-list">
                    {stats.strengthAreas.map((topic, idx) => (
                      <div key={idx} className="st-performance-item st-strength-item">
                        <div className="st-item-indicator"></div>
                        <span className="st-item-text">{topic}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="st-empty-text">No strong areas yet</p>
                )}
              </div>

              {/* IMPROVEMENT AREAS */}
              <div className="st-performance-card">
                <div className="st-performance-header st-warning">
                  <Target size={20} />
                  <h3 className="st-performance-title">Areas for Improvement</h3>
                </div>
                {stats.improvementAreas.length > 0 ? (
                  <div className="st-performance-list">
                    {stats.improvementAreas.map((topic, idx) => (
                      <div key={idx} className="st-performance-item st-improvement-item">
                        <div className="st-item-indicator"></div>
                        <span className="st-item-text">{topic}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="st-empty-text">Great job! No improvement areas</p>
                )}
              </div>
            </div>

            {/* RECENT REVIEWS */}
            {learningReviews.length > 0 && (
              <div className="st-reviews-section">
                <div className="st-section-header">
                  <h2 className="st-section-title">Recent Sessions</h2>
                  <p className="st-section-subtitle">Your learning history</p>
                </div>

                <div className="st-reviews-list">
                  {learningReviews.slice(0, 10).map((review, idx) => (
                    <div key={idx} className="st-review-item">
                      <div className="st-review-topic">
                        <p className="st-review-title">{review.topic || 'Untitled'}</p>
                        <p className="st-review-date">{new Date(review.created_at).toLocaleDateString()}</p>
                      </div>
                      <div className="st-review-stats">
                        {review.score !== undefined && (
                          <span className={`st-score ${review.score >= 70 ? 'high' : 'low'}`}>
                            {review.score}%
                          </span>
                        )}
                        {review.duration !== undefined && (
                          <span className="st-duration">{Math.round(review.duration / 60)}m</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Statistics;
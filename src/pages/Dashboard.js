import React, { useState, useEffect, useRef } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { HelpTour, HelpButton } from './HelpTour';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  CheckCircle, XCircle, Clock, Plus
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { rgbaFromHex } from '../utils/ThemeManager';
import ThemeSwitcher from '../components/ThemeSwitcher';
import './Dashboard.css';
import './HelpTour.css';

const Dashboard = () => {
  const { selectedTheme } = useTheme();
  
  const [userName, setUserName] = useState('');
  const [userProfile, setUserProfile] = useState(null);
  const [stats, setStats] = useState({
    streak: 0,
    totalQuestions: 0,
    minutes: 0,
    totalFlashcards: 0,
    totalNotes: 0,
    totalChatSessions: 0
  });

  const [heatmapData, setHeatmapData] = useState([]);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [heatmapLoading, setHeatmapLoading] = useState(true);

  const [sessionStartTime, setSessionStartTime] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [totalTimeToday, setTotalTimeToday] = useState(0);
  const [currentSessionTime, setCurrentSessionTime] = useState(0);

  // Help tour states
  const [showTour, setShowTour] = useState(false);
  const [hasSeenTour, setHasSeenTour] = useState(false);

  // Learning Review states
  const [learningReviews, setLearningReviews] = useState([]);
  const [activeLearningReview, setActiveLearningReview] = useState(null);

  // Widget customization states
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [widgets, setWidgets] = useState([
    { id: 'quick-actions', type: 'quick-actions', title: 'Quick Actions', enabled: true, size: 'medium' },
    { id: 'ai-assistant', type: 'ai-assistant', title: 'AI Learning Assistant', enabled: true, size: 'large' },
    { id: 'learning-review', type: 'learning-review', title: 'Learning Reviews', enabled: true, size: 'medium' },
    { id: 'stats', type: 'stats', title: 'Learning Stats', enabled: true, size: 'medium' },
    { id: 'daily-goal', type: 'daily-goal', title: 'Daily Goal', enabled: true, size: 'medium' },
    { id: 'recent-activity', type: 'recent-activity', title: 'Recent Activity', enabled: false, size: 'medium' },
    { id: 'heatmap', type: 'heatmap', title: 'Activity Heatmap', enabled: true, size: 'full' },
    { id: 'progress-chart', type: 'progress-chart', title: 'Weekly Progress', enabled: false, size: 'medium' },
    { id: 'motivational-quote', type: 'motivational-quote', title: 'Daily Quote', enabled: false, size: 'small' }
  ]);

  // Backend data states
  const [recentActivities, setRecentActivities] = useState([]);
  const [weeklyProgress, setWeeklyProgress] = useState([]);
  const [dailyGoal, setDailyGoal] = useState({ target: 20, completed: 0, percentage: 0 });
  const [motivationalQuote, setMotivationalQuote] = useState('');
  const [achievements, setAchievements] = useState([]);
  const [learningAnalytics, setLearningAnalytics] = useState(null);
  const [conversationStarters, setConversationStarters] = useState([]);

  const timeIntervalRef = useRef(null);
  const sessionUpdateRef = useRef(null);
  const lastActivityRef = useRef(Date.now());

  useEffect(() => {
    const token = localStorage.getItem('token');
    const username = localStorage.getItem('username');
    const profile = localStorage.getItem('userProfile');
    const savedWidgets = localStorage.getItem('dashboardWidgets');

    if (!token) {
      window.location.href = '/login';
      return;
    }

    if (username) setUserName(username);

    if (profile) {
      try {
        setUserProfile(JSON.parse(profile));
      } catch (error) {
        console.error('Error parsing user profile:', error);
      }
    }

    if (savedWidgets) {
      try {
        setWidgets(JSON.parse(savedWidgets));
      } catch (error) {
        console.error('Error parsing saved widgets:', error);
      }
    }
  }, []);

  useEffect(() => {
    const completedTour = localStorage.getItem('hasCompletedTour');
    setHasSeenTour(!!completedTour);

    if (!completedTour && userName) {
      const timer = setTimeout(() => setShowTour(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [userName]);

  useEffect(() => {
  if (userName) {
    loadUserStats();
    loadHeatmapData();
    loadDashboardData();
    startDashboardSession();
    
    // Poll for daily goal updates every 10 seconds
    const goalPollInterval = setInterval(() => {
      loadDashboardData();
    }, 10000);
    
    return () => {
      if (sessionStartTime && sessionId && userName) {
        endDashboardSession();
      }
      if (timeIntervalRef.current) clearInterval(timeIntervalRef.current);
      if (sessionUpdateRef.current) clearInterval(sessionUpdateRef.current);
      clearInterval(goalPollInterval);
    };
  }
}, [userName]);

  const loadLearningReviews = async () => {
    if (!userName) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:8001/get_learning_reviews?user_id=${userName}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setLearningReviews(data.reviews || []);
      }
    } catch (error) {
      console.error('Error loading learning reviews:', error);
    }
  };

  const createLearningReview = async () => {
  if (!userName) return;
  
  try {
    const token = localStorage.getItem('token');
    const sessionsResponse = await fetch(`http://localhost:8001/get_chat_sessions?user_id=${userName}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (sessionsResponse.ok) {
      const sessionsData = await sessionsResponse.json();
      const recentSessions = sessionsData.sessions?.slice(0, 3) || [];
      
      // If no sessions, just navigate to the learning review page
      if (recentSessions.length === 0) {
        await endDashboardSession();
        window.location.href = '/learning-review';
        return;
      }
      
      // If sessions exist, create review automatically
      const response = await fetch('http://localhost:8001/create_learning_review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          user_id: userName,
          chat_session_ids: recentSessions.map(s => s.id),
          review_title: `Learning Review - ${new Date().toLocaleDateString()}`,
          review_type: 'comprehensive'
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setActiveLearningReview(data);
        loadLearningReviews();
        await endDashboardSession();
        window.location.href = '/learning-review';
      } else {
        const errorData = await response.json();
        alert('Error creating review: ' + (errorData.detail || 'Unknown error'));
      }
    }
  } catch (error) {
    console.error('Error creating learning review:', error);
    // On error, still navigate to the page
    await endDashboardSession();
    window.location.href = '/learning-review';
  }
};

  const getScoreColor = (score) => {
    if (score >= 90) return 'score-excellent';
    if (score >= 70) return 'score-good';
    if (score >= 50) return 'score-fair';
    return 'score-poor';
  };

  const loadDashboardData = async () => {
  if (!userName) return;
  const token = localStorage.getItem('token');
  const headers = { 'Authorization': `Bearer ${token}` };

  try {
    // Daily Goal
    const dailyGoalResponse = await fetch(`http://localhost:8001/get_daily_goal_progress?user_id=${userName}`, { headers });
    if (dailyGoalResponse.ok) {
      const goalData = await dailyGoalResponse.json();
      setDailyGoal({
        target: goalData.daily_goal || 20,
        completed: goalData.questions_today || 0,
        percentage: goalData.percentage || 0
      });
    }

    // Weekly Progress
    const weeklyResponse = await fetch(`http://localhost:8001/get_weekly_progress?user_id=${userName}`, { headers });
    if (weeklyResponse.ok) {
      const weeklyData = await weeklyResponse.json();
      setWeeklyProgress(weeklyData.weekly_data || []);
    }

    // Achievements
    const achievementsResponse = await fetch(`http://localhost:8001/get_user_achievements?user_id=${userName}`, { headers });
    if (achievementsResponse.ok) {
      const achievementsData = await achievementsResponse.json();
      setAchievements(achievementsData.achievements || []);
    }

    // Learning Analytics
    const analyticsResponse = await fetch(`http://localhost:8001/get_learning_analytics?user_id=${userName}&period=week`, { headers });
    if (analyticsResponse.ok) {
      const analyticsData = await analyticsResponse.json();
      console.log('📊 Analytics received:', analyticsData);
      setLearningAnalytics(analyticsData);
    } else {
      console.error('❌ Analytics failed');
      setLearningAnalytics({ total_sessions: 0, total_time_minutes: 0 });
    }

    // Conversation Starters
    const startersResponse = await fetch(`http://localhost:8001/conversation_starters?user_id=${userName}`, { headers });
    if (startersResponse.ok) {
      const startersData = await startersResponse.json();
      setConversationStarters(startersData.suggestions || []);
    }

    loadMotivationalQuote();
    loadLearningReviews();
    
  } catch (error) {
    console.error('Error loading dashboard data:', error);
  }
};
  async function responseToJsonSafely(resp) {
    try { return await resp.json(); } catch { return {}; }
  }
   

  
  const loadMotivationalQuote = () => {
    const quotes = [
      "The expert in anything was once a beginner.",
      "Success is the sum of small efforts repeated day in and day out.",
      "Learning never exhausts the mind.",
      "The beautiful thing about learning is that no one can take it away from you.",
      "Education is the most powerful weapon which you can use to change the world."
    ];
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
    setMotivationalQuote(quotes[dayOfYear % quotes.length]);
  };

  const getActivityType = (topic) => {
    if (topic?.toLowerCase().includes('math')) return 'quiz';
    if (topic?.toLowerCase().includes('flashcard')) return 'notes';
    return 'notes';
  };

  const calculateScore = () => Math.floor(Math.random() * 30) + 70;

  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInHours = Math.floor((now - time) / (1000 * 60 * 60));
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
  };

  const saveWidgetConfiguration = () => {
    localStorage.setItem('dashboardWidgets', JSON.stringify(widgets));
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      setWidgets((widgets) => {
        const oldIndex = widgets.findIndex((widget) => widget.id === active.id);
        const newIndex = widgets.findIndex((widget) => widget.id === over.id);
        return arrayMove(widgets, oldIndex, newIndex);
      });
    }
  };

  const toggleWidget = (widgetId) => {
    setWidgets(widgets.map(widget =>
      widget.id === widgetId
        ? { ...widget, enabled: !widget.enabled }
        : widget
    ));
  };

  const changeWidgetSize = (widgetId, newSize) => {
    setWidgets(widgets.map(widget =>
      widget.id === widgetId
        ? { ...widget, size: newSize }
        : widget
    ));
  };

  const resetWidgets = () => {
    const defaultWidgets = [
      { id: 'quick-actions', type: 'quick-actions', title: 'Quick Actions', enabled: true, size: 'medium' },
      { id: 'ai-assistant', type: 'ai-assistant', title: 'AI Learning Assistant', enabled: true, size: 'large' },
      { id: 'learning-review', type: 'learning-review', title: 'Learning Reviews', enabled: true, size: 'medium' },
      { id: 'stats', type: 'stats', title: 'Learning Stats', enabled: true, size: 'medium' },
      { id: 'recent-activity', type: 'recent-activity', title: 'Recent Activity', enabled: false, size: 'medium' },
      { id: 'daily-goal', type: 'daily-goal', title: 'Daily Goal', enabled: true, size: 'medium' },
      { id: 'heatmap', type: 'heatmap', title: 'Activity Heatmap', enabled: true, size: 'full' },
      { id: 'progress-chart', type: 'progress-chart', title: 'Weekly Progress', enabled: false, size: 'medium' },
      { id: 'motivational-quote', type: 'motivational-quote', title: 'Daily Quote', enabled: false, size: 'small' }
    ];
    setWidgets(defaultWidgets);
  };

  const enabledWidgets = widgets.filter(widget => widget.enabled);

  const loadHeatmapData = async () => {
    if (!userName) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:8001/get_activity_heatmap?user_id=${userName}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setHeatmapData(data.heatmap_data || []);
        setTotalQuestions(data.total_count || 0);
      }
    } catch (error) {
      console.error('Error loading heatmap data:', error);
    } finally {
      setHeatmapLoading(false);
    }
  };

  const getActivityColor = (level) => {
  const accent = selectedTheme.tokens['--accent'];
  switch (level) {
    case 0: return rgbaFromHex(accent, 0.08);
    case 1: return rgbaFromHex(accent, 0.25);
    case 2: return rgbaFromHex(accent, 0.45);
    case 3: return rgbaFromHex(accent, 0.65);
    case 4: return rgbaFromHex(accent, 0.85);
    case 5: return accent;
    default: return rgbaFromHex(accent, 0.08);
  }
};

  const getTooltipText = (count, date) => {
    const dateObj = new Date(date);
    const dateStr = dateObj.toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
    });
    if (count === 0) return `No questions on ${dateStr}`;
    if (count === 1) return `1 question on ${dateStr}`;
    return `${count} questions on ${dateStr}`;
  };

  const getMonthName = (monthIndex) => {
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    return months[monthIndex];
  };

  const organizeDataByWeeks = () => {
    if (!heatmapData.length) return [];
    const startDate = new Date(heatmapData[0].date);
    const endDate = new Date(heatmapData[heatmapData.length - 1].date);

    const firstSunday = new Date(startDate);
    firstSunday.setDate(startDate.getDate() - startDate.getDay());

    const lastSaturday = new Date(endDate);
    lastSaturday.setDate(endDate.getDate() + (6 - endDate.getDay()));

    const weeks = [];
    const dataMap = new Map();
    heatmapData.forEach(day => dataMap.set(day.date, day));

    const currentDate = new Date(firstSunday);
    while (currentDate <= lastSaturday) {
      const week = [];
      for (let i = 0; i < 7; i++) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const dayData = dataMap.get(dateStr);
        if (dayData) {
          week.push(dayData);
        } else if (currentDate >= startDate && currentDate <= endDate) {
          week.push({ date: dateStr, count: 0, level: 0 });
        } else {
          week.push(null);
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }
      weeks.push(week);
    }
    return weeks;
  };

  const getMonthLabels = () => {
    if (!heatmapData.length) return [];
    const labels = [];
    const weeks = organizeDataByWeeks();
    let currentMonth = -1;
    weeks.forEach((week, weekIndex) => {
      const firstValidDay = week.find(day => day !== null);
      if (firstValidDay) {
        const date = new Date(firstValidDay.date);
        const month = date.getMonth();
        if (month !== currentMonth && weekIndex > 0) {
          labels.push({ month: getMonthName(month), position: weekIndex * 18 });
          currentMonth = month;
        }
      }
    });
    return labels;
  };

  const startDashboardSession = async () => {
    if (!userName) return;
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('user_id', userName);
      formData.append('session_type', 'dashboard');
      const response = await fetch('http://localhost:8001/start_session', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      if (response.ok) {
        const data = await response.json();
        setSessionId(data.session_id);
        const startTime = Date.now();
        setSessionStartTime(startTime);
        startTimeTracking();
        startSessionTimeUpdater();
      }
    } catch (error) {
      console.error('Error starting dashboard session:', error);
    }
  };

  const startTimeTracking = () => {
    timeIntervalRef.current = setInterval(() => {
      const now = Date.now();
      const timeSinceLastActivity = now - lastActivityRef.current;
      if (timeSinceLastActivity < 3 * 60 * 1000) {
        lastActivityRef.current = now;
      }
    }, 30000);

    const updateActivity = () => { lastActivityRef.current = Date.now(); };
    document.addEventListener('mousemove', updateActivity);
    document.addEventListener('click', updateActivity);
    document.addEventListener('keypress', updateActivity);
    document.addEventListener('scroll', updateActivity);
    document.addEventListener('focus', updateActivity);

    const cleanup = () => {
      document.removeEventListener('mousemove', updateActivity);
      document.removeEventListener('click', updateActivity);
      document.removeEventListener('keypress', updateActivity);
      document.removeEventListener('scroll', updateActivity);
      document.removeEventListener('focus', updateActivity);
    };
    window.dashboardTimeTrackingCleanup = cleanup;
  };

  const startSessionTimeUpdater = () => {
    sessionUpdateRef.current = setInterval(() => {
      if (sessionStartTime) {
        const elapsed = Math.floor((Date.now() - sessionStartTime) / (1000 * 60));
        setCurrentSessionTime(elapsed);
      }
    }, 10000);
  };

  const endDashboardSession = async () => {
    if (!sessionStartTime || !sessionId || !userName) return;
    try {
      const token = localStorage.getItem('token');
      const sessionDuration = (Date.now() - sessionStartTime) / (1000 * 60);
      if (sessionDuration >= 0.5) {
        const formData = new FormData();
        formData.append('user_id', userName);
        formData.append('session_id', sessionId);
        formData.append('time_spent_minutes', sessionDuration.toString());
        formData.append('session_type', 'dashboard');
        const response = await fetch('http://localhost:8001/end_session', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });
        if (response.ok) {
          const data = await response.json();
          setTotalTimeToday(data.total_time_today || 0);
          setTimeout(() => { loadUserStats(); }, 500);
        }
      }
    } catch (error) {
      console.error('Error ending dashboard session:', error);
    } finally {
      if (timeIntervalRef.current) clearInterval(timeIntervalRef.current);
      if (sessionUpdateRef.current) clearInterval(sessionUpdateRef.current);
      if (window.dashboardTimeTrackingCleanup) window.dashboardTimeTrackingCleanup();
    }
  };

  const startTour = () => setShowTour(true);
  const closeTour = () => setShowTour(false);
  const completeTour = () => {
    setShowTour(false);
    setHasSeenTour(true);
    localStorage.setItem('hasCompletedTour', '1');
  };

  const loadUserStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:8001/get_enhanced_user_stats?user_id=${userName}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const enhancedStats = await response.json();
        setStats({
          streak: enhancedStats.streak || 0,
          totalQuestions: enhancedStats.totalQuestions || 0,
          minutes: Math.round((enhancedStats.hours || 0) * 60) || 0,
          totalFlashcards: enhancedStats.totalFlashcards || 0,
          totalNotes: enhancedStats.totalNotes || 0,
          totalChatSessions: enhancedStats.totalChatSessions || 0
        });
        setTotalTimeToday(enhancedStats.total_time_today || 0);
      } else {
        setStats({ streak: 0, totalQuestions: 0, minutes: 0, totalFlashcards: 0, totalNotes: 0, totalChatSessions: 0 });
      }
    } catch (error) {
      console.error('Error loading stats:', error);
      setStats({ streak: 0, totalQuestions: 0, minutes: 0, totalFlashcards: 0, totalNotes: 0, totalChatSessions: 0 });
    }
  };

  const handleLogout = async () => {
    if (sessionStartTime && sessionId && userName) await endDashboardSession();
    if (userProfile?.googleUser && window.google) window.google.accounts.id.disableAutoSelect();
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('userProfile');
    localStorage.removeItem('dashboardWidgets');
    window.location.href = '/';
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  const displayName = userProfile?.firstName
    ? `${userProfile.firstName} ${userProfile.lastName || ''}`.trim()
    : userName;

  const navigateToAI = async () => {
    await endDashboardSession();
    window.location.href = '/ai-chat';
  };
  const generateFlashcards = async () => {
    await endDashboardSession();
    window.location.href = '/flashcards';
  };
  const openNotes = async () => {
    await endDashboardSession();
    window.location.href = '/notes';
  };
  const openProfile = async () => {
    await endDashboardSession();
    window.location.href = '/profile';
  };

  const getMotivationalMessage = () => {
    if (stats.totalQuestions === 0) return "Start your learning journey today";
    if (stats.streak === 0) return "Build your learning streak";
    if (stats.streak < 7) return `${7 - stats.streak} days to weekly streak`;
    return `${stats.streak} day learning streak`;
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const deleteLearningReview = async (reviewId, reviewTitle) => {
    const isConfirmed = window.confirm(
      `Are you sure you want to delete "${reviewTitle}"?\n\nThis action cannot be undone.`
    );
    if (!isConfirmed) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:8001/delete_learning_review/${reviewId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        setLearningReviews(prev => prev.filter(review => review.id !== reviewId));
        alert('Learning review deleted successfully');
      } else {
        const errorData = await response.json();
        alert('Error deleting review: ' + (errorData.detail || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error deleting learning review:', error);
      alert('Error deleting learning review');
    }
  };

  // Debug CSS variables
  useEffect(() => {
    console.log('Dashboard - Selected theme:', selectedTheme);
    console.log('Dashboard - Theme tokens:', selectedTheme.tokens);
    console.log('Dashboard - CSS --accent:', getComputedStyle(document.documentElement).getPropertyValue('--accent'));
    console.log('Dashboard - CSS --text-primary:', getComputedStyle(document.documentElement).getPropertyValue('--text-primary'));
  }, [selectedTheme]);

  const SortableWidget = ({ widget }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: widget.id, disabled: !isCustomizing });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      zIndex: isDragging ? 1000 : 'auto',
    };

    const handleButtonClick = (e, action) => {
      e.stopPropagation();
      e.preventDefault();
      action();
    };

    const accent = selectedTheme.tokens['--accent'];
    const accent2 = selectedTheme.tokens['--accent-2'];
    const textPrimary = selectedTheme.tokens['--text-primary'];
    const bgTop = selectedTheme.tokens['--bg-top'];

    const widgetContent = () => {
      switch (widget.type) {
        case 'stats':
          return (
            <div className="stats-overview-widget">
              <div className="widget-header">
                <h3 className="widget-title">Learning Stats</h3>
              </div>
              <div className="stat-grid-widget">
                <div className="stat-card-widget">
                  <div className="stat-content">
                    <div className="stat-number" style={{ color: accent }}>{stats.streak}</div>
                    <div className="stat-label">Day Streak</div>
                  </div>
                </div>
                <div className="stat-card-widget">
                  <div className="stat-content">
                    <div className="stat-number" style={{ color: accent }}>{stats.totalQuestions}</div>
                    <div className="stat-label">Total Questions</div>
                  </div>
                </div>
                <div className="stat-card-widget">
                  <div className="stat-content">
                    <div className="stat-number" style={{ color: accent }}>{stats.minutes}</div>
                    <div className="stat-label">Total Minutes</div>
                  </div>
                </div>
                <div className="stat-card-widget">
                  <div className="stat-content">
                    <div className="stat-number" style={{ color: accent }}>{stats.totalChatSessions}</div>
                    <div className="stat-label">AI Sessions</div>
                  </div>
                </div>
              </div>
            </div>
          );

        case 'ai-assistant':
          return (
            <div className="ai-assistant-card">
              <div className="card-header">
                <h3 className="card-title">AI Learning Assistant</h3>
                <div className="status-indicator active">Active</div>
              </div>

              <div className="ai-visual-section">
                <div className="ai-center-content">
                  <div
                    className="ai-icon-display"
                    onClick={!isCustomizing ? navigateToAI : undefined}
                    style={{
                      cursor: isCustomizing ? 'default' : 'pointer',
                      background: accent,
                      color: bgTop,
                      boxShadow: `0 8px 32px ${rgbaFromHex(accent, 0.35)}, 0 4px 16px ${rgbaFromHex(accent, 0.35)}`
                    }}
                  >
                    AI
                  </div>
                </div>
              </div>

              <div className="ai-action-section">
                <button
                  onClick={navigateToAI}
                  disabled={isCustomizing}
                  style={{
                    width: '100%',
                    background: accent,
                    color: bgTop,
                    border: 'none',
                    padding: '18px 24px',
                    fontSize: '14px',
                    fontWeight: '600',
                    letterSpacing: '1.2px',
                    textTransform: 'uppercase',
                    fontFamily: 'Quicksand, sans-serif',
                    cursor: isCustomizing ? 'not-allowed' : 'pointer',
                    transition: 'all 0.3s ease',
                    minHeight: '50px',
                    borderRadius: '0'
                  }}
                  onMouseEnter={(e) => {
                    if (!isCustomizing) {
                      e.target.style.background = `color-mix(in srgb, ${accent} 85%, white)`;
                      e.target.style.transform = 'translateY(-2px)';
                      e.target.style.boxShadow = `0 8px 25px ${rgbaFromHex(accent, 0.4)}`;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isCustomizing) {
                      e.target.style.background = accent;
                      e.target.style.transform = 'translateY(0)';
                      e.target.style.boxShadow = 'none';
                    }
                  }}
                >
                  Start AI Session
                </button>
              </div>

              <div className="ai-description">
                Personalized AI tutor ready to help with explanations, questions, and study guidance.
              </div>
            </div>
          );

        case 'daily-goal':
          return (
            <div className="daily-goal-widget">
              <div className="widget-header">
                <h3 className="widget-title">Daily Goal</h3>
              </div>
              <div className="goal-progress">
                <div className="goal-circle">
                  <svg width="80" height="80">
                    <circle cx="40" cy="40" r="35" stroke="var(--border)" strokeWidth="4" fill="transparent"/>
                    <circle
                      cx="40"
                      cy="40"
                      r="35"
                      stroke={accent}
                      strokeWidth="4"
                      fill="transparent"
                      strokeDasharray="220"
                      strokeDashoffset={220 - (220 * dailyGoal.percentage / 100)}
                      transform="rotate(-90 40 40)"
                    />
                  </svg>
                  <div className="goal-text">
                    <div className="goal-number" style={{ color: accent }}>{dailyGoal.completed}</div>
                    <div className="goal-target">/{dailyGoal.target}</div>
                  </div>
                </div>
                <div className="goal-label">Questions Today</div>
              </div>
            </div>
          );

        case 'learning-review':
          return (
            <div className="learning-review-widget">
              <div className="widget-header">
                <h3 className="widget-title">Learning Reviews</h3>
                <button
                  className="create-review-btn"
                  onClick={createLearningReview}
                  disabled={isCustomizing}
                  title="Create Review"
                  style={{
                    background: accent,
                    color: bgTop
                  }}
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>

              <div className="review-content">
                {learningReviews.length > 0 ? (
                  <>
                    <div className="review-list">
                      {learningReviews.slice(0, 3).map((review) => (
                        <div key={review.id} className="review-item">
                          <div className="review-header">
                            <div className="review-title">{review.title}</div>
                            <div className={`review-status ${review.status}`}>
                              {review.status === 'completed'
                                ? <CheckCircle className="w-3 h-3" />
                                : <Clock className="w-3 h-3" />}
                            </div>
                          </div>

                          <div className="review-stats">
                            <div className="review-stat">
                              <span className="stat-label">Score</span>
                              <span className={`stat-value ${getScoreColor(review.best_score)}`}>
                                {review.best_score}%
                              </span>
                            </div>
                            <div className="review-stat">
                              <span className="stat-label">Attempts</span>
                              <span className="stat-value">{review.attempt_count}</span>
                            </div>
                          </div>

                          <div className="review-actions">
                            {review.can_continue && (
                              <button
                                className="continue-btn"
                                onClick={async () => {
                                  await endDashboardSession();
                                  window.location.href = `/learning-review?id=${review.id}`;
                                }}
                                disabled={isCustomizing}
                                style={{
                                  background: accent,
                                  color: bgTop
                                }}
                              >
                                Continue
                              </button>
                            )}
                            <button
                              className="view-btn"
                              onClick={async () => {
                                await endDashboardSession();
                                window.location.href = `/learning-review?id=${review.id}`;
                              }}
                              disabled={isCustomizing}
                            >
                              View
                            </button>
                            <button
                              className="delete-review-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteLearningReview(review.id, review.title);
                              }}
                              disabled={isCustomizing}
                              title="Delete review"
                            >
                              <XCircle className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {learningReviews.length > 3 && (
                      <div className="view-all">
                        <button
                          className="view-all-btn"
                          onClick={async () => {
                            await endDashboardSession();
                            window.location.href = '/learning-review';
                          }}
                          disabled={isCustomizing}
                          style={{
                            borderColor: accent,
                            color: textPrimary
                          }}
                        >
                          View All ({learningReviews.length})
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="no-reviews">
                    <p className="no-reviews-text">No learning reviews yet</p>
                    <p className="no-reviews-subtitle">Test your knowledge from AI chat sessions</p>
                    <button
                      className="create-first-btn"
                      onClick={createLearningReview}
                      disabled={isCustomizing}
                      style={{ background: accent, color: bgTop }}
                    >
                      <Plus className="w-4 h-4" />
                      Create First Review
                    </button>
                  </div>
                )}
              </div>
            </div>
          );

        case 'recent-activity':
          return (
            <div className="recent-activity-widget">
              <div className="widget-header">
                <h3 className="widget-title">Recent Activity</h3>
              </div>
              <div className="activity-list">
                {recentActivities.length > 0 ? (
                  recentActivities.map((activity, idx) => (
                    <div key={idx} className="activity-item">
                      <div className="activity-icon">{activity.type.toUpperCase()}</div>
                      <div className="activity-details">
                        <div className="activity-subject">{activity.subject}</div>
                        <div className="activity-meta">
                          {activity.score && `Score: ${activity.score}% `}
                          {activity.question && `${activity.question.substring(0, 30)}...`}
                        </div>
                      </div>
                      <div className="activity-time">{activity.time}</div>
                    </div>
                  ))
                ) : (
                  <div className="no-activity">
                    <p>No recent activity found.</p>
                    <button onClick={navigateToAI} className="start-learning-btn" style={{ borderColor: accent, color: textPrimary }}>
                      Start Learning
                    </button>
                  </div>
                )}
              </div>
            </div>
          );

        case 'motivational-quote':
          return (
            <div className="motivational-quote-widget">
              <div className="widget-header">
                <h3 className="widget-title">Daily Quote</h3>
              </div>
              <div className="quote-content">
                <div className="quote-mark" style={{ color: accent2 }}>"</div>
                <div className="quote-text">{motivationalQuote}</div>
              </div>
              {achievements.length > 0 && (
                <div className="recent-achievement">
                  <div className="achievement-badge" style={{ borderColor: accent2 }}>
                    <span className="achievement-text">
                      Latest: {achievements[0]?.name}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );

        case 'progress-chart':
          return (
            <div className="progress-chart-widget">
              <div className="widget-header">
                <h3 className="widget-title">Weekly Progress</h3>
              </div>
              <div className="chart-container">
                <div className="chart-bars">
                  {weeklyProgress.length > 0 ? (
                    weeklyProgress.map((value, idx) => {
                      const maxValue = Math.max(...weeklyProgress, 1);
                      const height = (value / maxValue) * 100;
                      return (
                        <div key={idx} className="chart-bar">
                          <div
                            className="bar-fill"
                            style={{
                              height: `${height}%`,
                              background: `linear-gradient(180deg, ${accent} 0%, ${rgbaFromHex(accent, 0.35)} 100%)`
                            }}
                          />
                          <div className="bar-label">
                            {['M', 'T', 'W', 'T', 'F', 'S', 'S'][idx]}
                          </div>
                          <div className="bar-value">{value}</div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="no-data">
                      <p>No weekly data available</p>
                    </div>
                  )}
                </div>
              </div>
              {learningAnalytics && (
                <div className="analytics-summary">
                  <div className="analytics-stat">
                    <span className="stat-label">Avg. Sessions:</span>
                    <span className="stat-value">{learningAnalytics.average_per_day?.toFixed(1) || '0'}</span>
                  </div>
                  <div className="analytics-stat">
                    <span className="stat-label">Accuracy:</span>
                    <span className="stat-value">{learningAnalytics.accuracy_percentage?.toFixed(1) || '0'}%</span>
                  </div>
                </div>
              )}
            </div>
          );

        case 'heatmap':
          const weeks = organizeDataByWeeks();
          const monthLabels = getMonthLabels();
          return (
            <div className="activity-heatmap">
              <div className="heatmap-header">
                <h3 className="heatmap-title">last 12 months</h3>
                <div className="heatmap-stats">
                  <span className="total-questions">{totalQuestions} questions</span>
                </div>
              </div>

              {heatmapLoading ? (
                <div className="heatmap-loading">Loading activity data...</div>
              ) : (
                <>
                  <div className="heatmap-container">
                    <div className="heatmap-days">
                      <div className="day-label">sun</div>
                      <div className="day-label">mon</div>
                      <div className="day-label">tue</div>
                      <div className="day-label">wed</div>
                      <div className="day-label">thu</div>
                      <div className="day-label">fri</div>
                      <div className="day-label">sat</div>
                    </div>

                    <div className="heatmap-content">
                      <div className="month-labels">
                        {monthLabels.map((label, index) => (
                          <div
                            key={index}
                            className="month-label"
                            style={{ left: `${label.position}px` }}
                          >
                            {label.month}
                          </div>
                        ))}
                      </div>

                      <div className="heatmap-grid">
                        {weeks.map((week, weekIndex) => (
                          <div key={weekIndex} className="heatmap-week">
                            {week.map((day, dayIndex) => (
                              <div
                                key={`${weekIndex}-${dayIndex}`}
                                className="heatmap-day"
                                style={{
                                  backgroundColor: day ? getActivityColor(day.level) : 'transparent'
                                }}
                                title={day ? getTooltipText(day.count, day.date) : ''}
                              />
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="heatmap-legend">
                    <span className="legend-text">less</span>
                    <div className="legend-colors">
                      {[0, 1, 2, 3, 4, 5].map(level => (
                        <div
                          key={level}
                          className="legend-color"
                          style={{ backgroundColor: getActivityColor(level) }}
                        />
                      ))}
                    </div>
                    <span className="legend-text">more</span>
                  </div>
                </>
              )}
            </div>
          );

        case 'quick-actions':
  return (
    <div className="quick-actions">
      <h3 className="section-title">Quick Actions</h3>
      <div className="action-grid">
        <button 
          className="action-btn" 
          onClick={generateFlashcards}
          disabled={isCustomizing}
          style={{ color: accent, borderColor: `color-mix(in srgb, ${accent} 30%, transparent)` }}
        >
          <div className="action-label" style={{ color: accent }}>Flashcards</div>
          <div className="action-count">{stats.totalFlashcards}</div>
        </button>
        <button 
          className="action-btn" 
          onClick={openNotes}
          disabled={isCustomizing}
          style={{ color: accent, borderColor: `color-mix(in srgb, ${accent} 30%, transparent)` }}
        >
          <div className="action-label" style={{ color: accent }}>Study Notes</div>
          <div className="action-count">{stats.totalNotes}</div>
        </button>
        <button 
          className="action-btn" 
          onClick={openProfile}
          disabled={isCustomizing}
          style={{ color: accent, borderColor: `color-mix(in srgb, ${accent} 30%, transparent)` }}
        >
          <div className="action-label" style={{ color: accent }}>Profile</div>
          <div className="action-count">Setup</div>
        </button>
      </div>

      <div className="quick-stats">
        <div className="quick-stat">
          <span className="quick-stat-label">THIS WEEK:</span>
          <span className="quick-stat-value">
            {learningAnalytics?.total_sessions || 0} sessions
          </span>
        </div>
        <div className="quick-stat">
          <span className="quick-stat-label">TOTAL TIME:</span>
          <span className="quick-stat-value">
            {learningAnalytics?.total_time_minutes ? Math.round(learningAnalytics.total_time_minutes / 60) : 0} hrs
          </span>
        </div>
      </div>
    </div>
  );

        default:
          return <div>Unknown widget type</div>;
      }
    };

    return (
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        className={`dashboard-widget widget-${widget.size} ${isCustomizing ? 'customizing' : ''} ${isDragging ? 'dragging' : ''}`}
      >
        {isCustomizing && (
          <div className="widget-controls" onClick={(e) => e.stopPropagation()}>
            <div className="drag-handle" {...listeners}>⋮⋮</div>
            <div className="size-controls">
              <button
                className={`size-btn ${widget.size === 'small' ? 'active' : ''}`}
                onClick={(e) => handleButtonClick(e, () => changeWidgetSize(widget.id, 'small'))}
              >S</button>
              <button
                className={`size-btn ${widget.size === 'medium' ? 'active' : ''}`}
                onClick={(e) => handleButtonClick(e, () => changeWidgetSize(widget.id, 'medium'))}
              >M</button>
              <button
                className={`size-btn ${widget.size === 'large' ? 'active' : ''}`}
                onClick={(e) => handleButtonClick(e, () => changeWidgetSize(widget.id, 'large'))}
              >L</button>
              {widget.type === 'heatmap' && (
                <button
                  className={`size-btn ${widget.size === 'full' ? 'active' : ''}`}
                  onClick={(e) => handleButtonClick(e, () => changeWidgetSize(widget.id, 'full'))}
                >F</button>
              )}
            </div>
            <button className="remove-btn" onClick={(e) => handleButtonClick(e, () => toggleWidget(widget.id))}>×</button>
          </div>
        )}
        <div className={`widget-content ${isCustomizing ? 'customize-mode' : ''}`}>
          {widgetContent()}
        </div>
      </div>
    );
  };

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div className="header-content">
          <div className="header-left">
            <h1 className="dashboard-title">brainwave</h1>
          </div>
          <div className="header-right">
            <ThemeSwitcher />
            <div className="user-info">
              {userProfile?.picture && (
  <img
    src={userProfile.picture}
    alt="Profile"
    className="profile-picture"
    referrerPolicy="no-referrer"
    crossOrigin="anonymous"
  />
)}
              <span className="user-name">{displayName}</span>
            </div>

            <button
              className={`customize-btn ${isCustomizing ? 'active' : ''}`}
              onClick={() => {
                if (isCustomizing) saveWidgetConfiguration();
                setIsCustomizing(!isCustomizing);
              }}
            >
              {isCustomizing ? 'DONE' : 'CUSTOMIZE'}
            </button>
            <button className="profile-btn" onClick={openProfile}>PROFILE</button>
            <button className="logout-btn" onClick={handleLogout}>LOGOUT</button>
          </div>
        </div>
      </header>

      <main className="dashboard-main">
        <div className="welcome-section">
          <h2 className="welcome-text">
            {getGreeting()}, {displayName}
          </h2>
          <p className="welcome-subtitle">
            {getMotivationalMessage()}
          </p>

          {currentSessionTime > 0 && (
            <div className="session-info">
              <span className="session-time">
                Current session: {currentSessionTime} minutes
              </span>
              {totalTimeToday > 0 && (
                <span className="total-time">
                  • Total today: {Math.round(totalTimeToday)} minutes
                </span>
              )}
            </div>
          )}
        </div>

        {isCustomizing && (
          <div className="customization-panel">
            <div className="panel-header">
              <h3>Customize Your Dashboard</h3>
              <button className="reset-btn" onClick={resetWidgets}>
                Reset to Default
              </button>
            </div>
            <div className="available-widgets">
              <h4>Available Widgets</h4>
              <div className="widget-toggles">
                {widgets.map(widget => (
                  <label key={widget.id} className="widget-toggle">
                    <input
                      type="checkbox"
                      checked={widget.enabled}
                      onChange={() => toggleWidget(widget.id)}
                    />
                    <span className="toggle-text">{widget.title}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="customization-help">
              <p>Use drag handle (⋮⋮) to reorder • Use S/M/L/F buttons to resize • Toggle widgets on/off</p>
            </div>
          </div>
        )}

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={enabledWidgets.map(widget => widget.id)}
            strategy={rectSortingStrategy}
          >
            <div className="dashboard-widgets">
              {enabledWidgets.map((widget) => (
                <SortableWidget key={widget.id} widget={widget} />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {heatmapLoading && (
          <div className="loading-overlay">
            <div className="loading-spinner">Loading dashboard data...</div>
          </div>
        )}
      </main>

      <HelpTour
        isOpen={showTour}
        onClose={closeTour}
        onComplete={completeTour}
      />
      <HelpButton onStartTour={startTour} />
    </div>
  );
};

export default Dashboard;
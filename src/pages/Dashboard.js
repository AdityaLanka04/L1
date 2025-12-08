import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatToLocalTime, getRelativeTime } from '../utils/dateUtils';
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
  CheckCircle, XCircle, Clock, Plus, Users, Bell, Calendar as CalendarIcon, BookOpen
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { rgbaFromHex } from '../utils/ThemeManager';
import ThemeSwitcher from '../components/ThemeSwitcher';
import LoadingSpinner from '../components/LoadingSpinner';
import ProactiveNotification from '../components/ProactiveNotification';
import './Dashboard.css';
import { API_URL } from '../config';

/* Prevent CSS cascade from other pages */
if (document.querySelector('link[href*="Flashcards.css"]')) {
  const link = document.querySelector('link[href*="Flashcards.css"]');
  if (link) link.remove();
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { selectedTheme } = useTheme();
  const { showToast } = useToast();
  
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
    { id: 'stats', type: 'stats', title: 'Learning Stats', enabled: true, size: 'medium' },
    { id: 'ai-assistant', type: 'ai-assistant', title: 'AI Learning Assistant', enabled: true, size: 'large' },
    { id: 'notifications', type: 'notifications', title: 'AI Notifications', enabled: true, size: 'medium' },
    { id: 'learning-review', type: 'learning-review', title: 'Learning Reviews', enabled: true, size: 'medium' },
    { id: 'quick-actions', type: 'quick-actions', title: 'Quick Actions', enabled: true, size: 'medium' },
    { id: 'social', type: 'social', title: 'Social Hub', enabled: true, size: 'medium' },
    { id: 'activity-timeline', type: 'activity-timeline', title: 'Activity Timeline', enabled: true, size: 'medium' },
    { id: 'recent-activity', type: 'recent-activity', title: 'Recent Activity', enabled: false, size: 'medium' },
    { id: 'heatmap', type: 'heatmap', title: 'Activity Heatmap', enabled: true, size: 'full' },
    { id: 'progress-chart', type: 'progress-chart', title: 'Weekly Progress', enabled: false, size: 'medium' },
    { id: 'motivational-quote', type: 'motivational-quote', title: 'Daily Quote', enabled: false, size: 'small' }
  ]);

  // Backend data states
  const [recentActivities, setRecentActivities] = useState([]);
  const [weeklyProgress, setWeeklyProgress] = useState([]);
  const [motivationalQuote, setMotivationalQuote] = useState('');
  const [achievements, setAchievements] = useState([]);
  const [learningAnalytics, setLearningAnalytics] = useState(null);
  const [conversationStarters, setConversationStarters] = useState([]);
  
  // Notification states
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  
  // Proactive notification state
  const [proactiveNotif, setProactiveNotif] = useState(null);

  // Inactivity engagement states
  const [showInactivitySuggestion, setShowInactivitySuggestion] = useState(false);
  const [engagementSuggestions, setEngagementSuggestions] = useState([
    { id: 1, title: 'Start an AI Chat', description: 'Ask your AI tutor any question about your studies', icon: '💬', action: 'ai' },
    { id: 2, title: 'Practice with Flashcards', description: 'Review and master key concepts with interactive flashcards', icon: '📚', action: 'flashcards' },
    { id: 3, title: 'Generate Quiz Questions', description: 'Test your knowledge with auto-generated questions', icon: '❓', action: 'quiz' },
    { id: 4, title: 'Review Your Notes', description: 'Browse through your notes and organize concepts', icon: '📝', action: 'notes' },
    { id: 5, title: 'Explore Concept Web', description: 'Visualize connections between topics', icon: '🕸️', action: 'concepts' },
    { id: 6, title: 'Join Study Group', description: 'Connect and collaborate with other learners', icon: '👥', action: 'social' }
  ]);

  const timeIntervalRef = useRef(null);
  const sessionUpdateRef = useRef(null);
  const lastActivityRef = useRef(Date.now());
  const inactivityTimerRef = useRef(null);

  // Remove Flashcards.css to prevent style cascade
  useEffect(() => {
    const removeFlashcardsCSS = () => {
      const links = document.querySelectorAll('link[href*="Flashcards.css"]');
      links.forEach(link => link.remove());
      
      // Also remove any style elements from Flashcards.css
      const styles = document.querySelectorAll('style');
      styles.forEach(style => {
        if (style.textContent && style.textContent.includes('Flashcards')) {
          style.remove();
        }
      });
    };
    
    // Remove immediately
    removeFlashcardsCSS();
    
    // Check multiple times to catch late-loaded styles
    const timers = [
      setTimeout(removeFlashcardsCSS, 100),
      setTimeout(removeFlashcardsCSS, 300),
      setTimeout(removeFlashcardsCSS, 500)
    ];
    
    return () => timers.forEach(timer => clearTimeout(timer));
  }, []);

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
        let parsedWidgets = JSON.parse(savedWidgets);
        
        // Migration: Replace daily-goal with social widget
        parsedWidgets = parsedWidgets.map(widget => {
          if (widget.id === 'daily-goal' || widget.type === 'daily-goal') {
            return { id: 'social', type: 'social', title: 'Social Hub', enabled: widget.enabled, size: widget.size };
          }
          return widget;
        });
        
        // Migration: Add new widgets if they don't exist
        const existingIds = parsedWidgets.map(w => w.id);
        
        if (!existingIds.includes('social')) {
          parsedWidgets.push({ id: 'social', type: 'social', title: 'Social Hub', enabled: true, size: 'medium' });
        }
        
        if (!existingIds.includes('activity-timeline')) {
          parsedWidgets.push({ id: 'activity-timeline', type: 'activity-timeline', title: 'Activity Timeline', enabled: true, size: 'medium' });
        }
        
        setWidgets(parsedWidgets);
        // Save the migrated widgets back to localStorage
        localStorage.setItem('dashboardWidgets', JSON.stringify(parsedWidgets));
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
    // Check if this is a fresh login (not a refresh)
    const justLoggedIn = sessionStorage.getItem('justLoggedIn');
    const notificationAlreadyShown = sessionStorage.getItem('notificationShown');
    
    console.log('🔔 Dashboard mounted, justLoggedIn:', justLoggedIn, 'alreadyShown:', notificationAlreadyShown);
    
    if (justLoggedIn === 'true' && notificationAlreadyShown !== 'true') {
      console.log('🔔 Fresh login detected - clearing old notifications and showing ONE notification');
      sessionStorage.removeItem('justLoggedIn');
      sessionStorage.setItem('notificationShown', 'true');
      
      // Clear all previous notifications on fresh login
      clearAllNotifications();
      
      // Show notification after 2 seconds
      setTimeout(async () => {
        try {
          const token = localStorage.getItem('token');
          const url = `${API_URL}/check_proactive_message?user_id=${userName}&is_login=true`;
          console.log('🔔 Calling backend ONCE:', url);
          
          const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          
          const data = await response.json();
          console.log('🔔 Backend response:', data);
          
          if (data.should_notify && data.message) {
            console.log('🔔 Showing notification popup');
            
            setProactiveNotif({
              message: data.message,
              chatId: data.chat_id,
              urgencyScore: data.urgency_score || 0.8
            });
            
            // Reload notifications after 2 seconds
            setTimeout(() => {
              loadNotifications();
            }, 2000);
          }
        } catch (error) {
          console.error('🔔 Error:', error);
        }
      }, 2000);
    } else if (notificationAlreadyShown === 'true') {
      console.log('🔔 Notification already shown this session, skipping');
    }
    
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

  // ML-based idle detection for proactive notifications
  useEffect(() => {
    if (!userName) return;

    // Track user activity
    const trackActivity = () => {
      lastActivityRef.current = Date.now();
    };

    // Listen for user interactions
    window.addEventListener('click', trackActivity);
    window.addEventListener('keypress', trackActivity);
    window.addEventListener('scroll', trackActivity);

    // Check for idle every 2 minutes
    const idleCheckInterval = setInterval(async () => {
      const idleTime = Date.now() - lastActivityRef.current;
      const IDLE_THRESHOLD = 3 * 60 * 1000; // 3 minutes

      if (idleTime > IDLE_THRESHOLD && !proactiveNotif) {
        console.log('🔔 User is idle, checking for ML-based notification...');
        
        try {
          const token = localStorage.getItem('token');
          const response = await fetch(
            `${API_URL}/check_proactive_message?user_id=${userName}&is_idle=true`,
            { headers: { 'Authorization': `Bearer ${token}` } }
          );
          
          const data = await response.json();
          
          if (data.should_notify && data.message) {
            console.log('🔔 ML system suggests idle notification:', data.reason);
            setProactiveNotif({
              message: data.message,
              chatId: data.chat_id,
              urgencyScore: data.urgency_score || 0.7
            });
          }
        } catch (error) {
          console.error('🔔 Idle notification check failed:', error);
        }
      }
    }, 2 * 60 * 1000); // Check every 2 minutes

    return () => {
      window.removeEventListener('click', trackActivity);
      window.removeEventListener('keypress', trackActivity);
      window.removeEventListener('scroll', trackActivity);
      clearInterval(idleCheckInterval);
    };
  }, [userName, proactiveNotif]);

  // Inactivity engagement suggestions
  useEffect(() => {
    if (!userName) return;

    const trackActivity = () => {
      lastActivityRef.current = Date.now();
      setShowInactivitySuggestion(false);
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };

    window.addEventListener('click', trackActivity);
    window.addEventListener('keypress', trackActivity);
    window.addEventListener('mousemove', trackActivity);
    window.addEventListener('scroll', trackActivity);

    const inactivityCheckInterval = setInterval(() => {
      const inactiveTime = Date.now() - lastActivityRef.current;
      const INACTIVITY_THRESHOLD = 90 * 1000; // 90 seconds (1.5 minutes)

      if (inactiveTime > INACTIVITY_THRESHOLD && !showInactivitySuggestion) {
        setShowInactivitySuggestion(true);
      }
    }, 10 * 1000); // Check every 10 seconds

    return () => {
      window.removeEventListener('click', trackActivity);
      window.removeEventListener('keypress', trackActivity);
      window.removeEventListener('mousemove', trackActivity);
      window.removeEventListener('scroll', trackActivity);
      clearInterval(inactivityCheckInterval);
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, [userName, showInactivitySuggestion]);

  const handleEngagementSuggestion = async (action) => {
    setShowInactivitySuggestion(false);
    lastActivityRef.current = Date.now();
    
    await endDashboardSession();
    
    switch(action) {
      case 'ai':
        window.location.href = '/ai-chat';
        break;
      case 'flashcards':
        window.location.href = '/flashcards';
        break;
      case 'quiz':
        window.location.href = '/question-bank';
        break;
      case 'notes':
        window.location.href = '/notes-dashboard';
        break;
      case 'concepts':
        window.location.href = '/concept-web';
        break;
      case 'social':
        window.location.href = '/social';
        break;
      default:
        break;
    }
  };

  const loadLearningReviews = async () => {
    if (!userName) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/get_learning_reviews?user_id=${userName}`, {
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

  const clearAllNotifications = async () => {
    if (!userName) return;
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_URL}/clear_all_notifications?user_id=${userName}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setNotifications([]);
      setUnreadCount(0);
      console.log('📬 All notifications cleared');
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  };

  const loadNotifications = async () => {
    if (!userName) return;
    try {
      const token = localStorage.getItem('token');
      const url = `${API_URL}/get_notifications?user_id=${userName}`;
      console.log('📬 Loading notifications from:', url);
      
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        const newNotifications = data.notifications || [];
        console.log('📬 Loaded notifications:', newNotifications.length, newNotifications);
        
        setNotifications(newNotifications);
        setUnreadCount(newNotifications.filter(n => !n.is_read).length);
        console.log('📬 Notifications state updated:', newNotifications.length);
      } else {
        console.error('📬 Failed to load notifications:', response.status);
      }
    } catch (error) {
      console.error('📬 Error loading notifications:', error);
      // If endpoint doesn't exist, set empty array
      setNotifications([]);
      setUnreadCount(0);
    }
  };

  const markNotificationAsRead = async (notificationId) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_URL}/mark_notification_read/${notificationId}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      loadNotifications();
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllNotificationsAsRead = async () => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_URL}/mark_all_notifications_read?user_id=${userName}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      loadNotifications();
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_URL}/delete_notification/${notificationId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      loadNotifications();
      showToast('Notification deleted', 'success');
    } catch (error) {
      console.error('Error deleting notification:', error);
      showToast('Failed to delete notification', 'error');
    }
  };

  const createLearningReview = async () => {
  if (!userName) return;
  
  try {
    const token = localStorage.getItem('token');
    const sessionsResponse = await fetch(`${API_URL}/get_chat_sessions?user_id=${userName}`, {
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
      const response = await fetch(`${API_URL}/create_learning_review`, {
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
    // Weekly Progress
    const weeklyResponse = await fetch(`${API_URL}/get_weekly_progress?user_id=${userName}`, { headers });
    if (weeklyResponse.ok) {
      const weeklyData = await weeklyResponse.json();
      setWeeklyProgress(weeklyData.weekly_data || []);
    }

    // Achievements
    const achievementsResponse = await fetch(`${API_URL}/get_user_achievements?user_id=${userName}`, { headers });
    if (achievementsResponse.ok) {
      const achievementsData = await achievementsResponse.json();
      setAchievements(achievementsData.achievements || []);
    }

    // Learning Analytics
    const analyticsResponse = await fetch(`${API_URL}/get_learning_analytics?user_id=${userName}&period=week`, { headers });
    if (analyticsResponse.ok) {
      const analyticsData = await analyticsResponse.json();
      console.log('📊 Analytics received:', analyticsData);
      setLearningAnalytics(analyticsData);
    } else {
      console.error('❌ Analytics failed');
      setLearningAnalytics({ total_sessions: 0, total_time_minutes: 0 });
    }

    // Conversation Starters
    const startersResponse = await fetch(`${API_URL}/conversation_starters?user_id=${userName}`, { headers });
    if (startersResponse.ok) {
      const startersData = await startersResponse.json();
      setConversationStarters(startersData.suggestions || []);
    }

    loadMotivationalQuote();
    loadLearningReviews();
    loadNotifications();
    
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
      { id: 'stats', type: 'stats', title: 'Learning Stats', enabled: true, size: 'medium' },
      { id: 'ai-assistant', type: 'ai-assistant', title: 'AI Learning Assistant', enabled: true, size: 'large' },
      { id: 'notifications', type: 'notifications', title: 'AI Notifications', enabled: true, size: 'medium' },
      { id: 'learning-review', type: 'learning-review', title: 'Learning Reviews', enabled: true, size: 'medium' },
      { id: 'quick-actions', type: 'quick-actions', title: 'Quick Actions', enabled: true, size: 'medium' },
      { id: 'social', type: 'social', title: 'Social Hub', enabled: true, size: 'medium' },
      { id: 'activity-timeline', type: 'activity-timeline', title: 'Activity Timeline', enabled: true, size: 'medium' },
      { id: 'recent-activity', type: 'recent-activity', title: 'Recent Activity', enabled: false, size: 'medium' },
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
      const response = await fetch(`${API_URL}/get_activity_heatmap?user_id=${userName}`, {
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
      const response = await fetch(`${API_URL}/start_session`, {
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
        const response = await fetch(`${API_URL}/end_session`, {
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
      const response = await fetch(`${API_URL}/get_enhanced_user_stats?user_id=${userName}`, {
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
    sessionStorage.removeItem('notificationShown'); // Clear notification flag
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
      const response = await fetch(`${API_URL}/delete_learning_review/${reviewId}`, {
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
    const textSecondary = selectedTheme.tokens['--text-secondary'];
    const bgTop = selectedTheme.tokens['--bg-top'];
    const primaryContrast = selectedTheme.tokens['--primary-contrast'];
    // For colored widgets text/icons: black for light themes, white for dark themes
    const widgetContrastColor = selectedTheme.mode === 'light' ? '#000000' : '#ffffff';
    // For colored widgets buttons: WHITE bg for light themes, BLACK bg for dark themes - both with accent text
    const widgetButtonBg = selectedTheme.mode === 'light' ? '#ffffff' : '#000000';
    const widgetButtonText = accent;

    const widgetContent = () => {
      switch (widget.type) {
        case 'stats':
          // Weekly line graph data
          const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
          const maxWeeklyValue = Math.max(...weeklyProgress, 1);
          
          // Calculate totals for display
          const totalActivities = stats.totalQuestions + stats.totalFlashcards + stats.totalNotes + stats.totalChatSessions;
          
          return (
            <div className="stats-overview-widget">
              <div className="widget-header">
                <h3 className="widget-title">Weekly Activity</h3>
                {stats.streak > 0 && (
                  <div className="streak-badge-header">
                    <span className="streak-emoji">🔥</span>
                    <span className="streak-value">{stats.streak}</span>
                  </div>
                )}
              </div>
              <div className="stats-line-container">
                {weeklyProgress.some(v => v > 0) ? (
                  <>
                    <div className="line-chart-wrapper">
                      <svg viewBox="0 0 280 120" className="stats-line-chart" preserveAspectRatio="none">
                        {/* Grid lines */}
                        <line x1="30" y1="100" x2="270" y2="100" stroke={textSecondary} strokeOpacity="0.2" />
                        <line x1="30" y1="70" x2="270" y2="70" stroke={textSecondary} strokeOpacity="0.1" strokeDasharray="4" />
                        <line x1="30" y1="40" x2="270" y2="40" stroke={textSecondary} strokeOpacity="0.1" strokeDasharray="4" />
                        
                        {/* Area fill */}
                        <path
                          d={`M 30 100 ${weeklyProgress.map((val, i) => {
                            const x = 30 + (i * 40);
                            const y = 100 - (val / maxWeeklyValue) * 70;
                            return `L ${x} ${y}`;
                          }).join(' ')} L ${30 + 6 * 40} 100 Z`}
                          fill={`url(#areaGradient-${widget.id})`}
                        />
                        
                        {/* Line */}
                        <path
                          d={`M ${weeklyProgress.map((val, i) => {
                            const x = 30 + (i * 40);
                            const y = 100 - (val / maxWeeklyValue) * 70;
                            return `${i === 0 ? '' : 'L '}${x} ${y}`;
                          }).join(' ')}`}
                          fill="none"
                          stroke={accent}
                          strokeWidth="2"
                        />
                        
                        {/* Data points */}
                        {weeklyProgress.map((val, i) => {
                          const x = 30 + (i * 40);
                          const y = 100 - (val / maxWeeklyValue) * 70;
                          return (
                            <circle key={i} cx={x} cy={y} r="4" fill={accent} stroke={bgTop} strokeWidth="2" />
                          );
                        })}
                        
                        {/* Gradient definition */}
                        <defs>
                          <linearGradient id={`areaGradient-${widget.id}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={accent} stopOpacity="0.3" />
                            <stop offset="100%" stopColor={accent} stopOpacity="0.05" />
                          </linearGradient>
                        </defs>
                      </svg>
                      <div className="line-chart-labels">
                        {dayLabels.map((day, i) => (
                          <span key={i} className="day-label">{day}</span>
                        ))}
                      </div>
                    </div>
                    <div className="stats-summary">
                      <div className="stat-item">
                        <span className="stat-value">{stats.totalQuestions}</span>
                        <span className="stat-label">Questions</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-value">{stats.totalFlashcards}</span>
                        <span className="stat-label">Flashcards</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-value">{stats.totalNotes}</span>
                        <span className="stat-label">Notes</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-value">{stats.totalChatSessions}</span>
                        <span className="stat-label">AI Sessions</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="stats-empty">
                    <p>Start learning to see your weekly progress!</p>
                  </div>
                )}
              </div>
            </div>
          );

        case 'ai-assistant':
          return (
            <div className="ai-assistant-card">
              <div className="ai-visual-section">
                <div
                  className="ai-icon-display"
                  onClick={!isCustomizing ? navigateToAI : undefined}
                  style={{ cursor: isCustomizing ? 'default' : 'pointer' }}
                >
                  AI
                </div>
              </div>
              
              <div className="ai-stats-row">
                <div className="ai-stat">
                  <span className="ai-stat-value">{stats.totalQuestions}</span>
                  <span className="ai-stat-label">Questions</span>
                </div>
                <div className="ai-stat">
                  <span className="ai-stat-value">{stats.totalChatSessions}</span>
                  <span className="ai-stat-label">Sessions</span>
                </div>
              </div>
              
              <button
                onClick={navigateToAI}
                disabled={isCustomizing}
                className="start-session-btn"
              >
                Start AI Session
              </button>
            </div>
          );

        case 'notifications':
          return (
            <div className="social-widget widget-notifications-styled">
              <div className="widget-header">
                <h3 className="widget-title">ai notifications</h3>
              </div>
              <div className="social-content">
                <div>
                  <div className="social-icon-container">
                    <Bell size={64} strokeWidth={1.5} />
                  </div>
                  <p>No notifications</p>
                </div>
                <button
                  className="social-explore-btn"
                  onClick={async () => {
                    await endDashboardSession();
                    navigate('/ai-chat');
                  }}
                  disabled={isCustomizing}
                >
                  Open AI Chat
                </button>
              </div>
            </div>
          );

        case 'learning-review':
          return (
            <div className="social-widget widget-learning-styled">
              <div className="widget-header">
                <h3 className="widget-title">learning reviews</h3>
              </div>
              <div className="social-content">
                <div>
                  <div className="social-icon-container">
                    <BookOpen size={64} strokeWidth={1.5} />
                  </div>
                  <p>Analyze slides, generate practice questions and view topic roadmaps</p>
                </div>
                <button
                  className="social-explore-btn"
                  onClick={async () => {
                    await endDashboardSession();
                    navigate('/learning-review');
                  }}
                  disabled={isCustomizing}
                >
                  Go to Learning Hub
                </button>
              </div>
            </div>
          );

        case 'learning-review-old':
          return (
            <div className="learning-review-widget-old">
              <div className="widget-header">
                <h3 className="widget-title">Learning Reviews</h3>
              </div>

              <div className="review-content">
                <div className="review-center-content">
                  <div className="social-icon-container">
                    <BookOpen size={64} strokeWidth={1.5} style={{ color: primaryContrast }} />
                  </div>
                  <p className="review-description">Analyze slides, generate practice questions and view topic roadmaps</p>
                  <button
                    className="hub-link-btn-large"
                    onClick={() => navigate('/learning-review')}
                    disabled={isCustomizing}
                  >
                    Go to your learning Hub
                  </button>
                </div>
                
                {learningReviews.length > 0 && (
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
                )}
              </div>
            </div>
          );

        case 'social':
          return (
            <div className="social-widget">
              <div className="widget-header">
                <h3 className="widget-title">Social</h3>
              </div>
              <div className="social-content">
                <div>
                  <div className="social-icon-container">
                    <Users size={64} strokeWidth={1.5} style={{ color: accent }} />
                  </div>
                  <p>
                    Connect with fellow learners, join study groups, and collaborate.
                  </p>
                </div>
                <button
                  className="social-explore-btn"
                  onClick={async () => {
                    await endDashboardSession();
                    navigate('/social');
                  }}
                  disabled={isCustomizing}
                  style={{
                    background: accent,
                    color: bgTop
                  }}
                  onMouseEnter={(e) => {
                    if (!isCustomizing) {
                      e.target.style.background = `color-mix(in srgb, ${accent} 85%, white)`;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isCustomizing) {
                      e.target.style.background = accent;
                    }
                  }}
                >
                  Go to Social
                </button>
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
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  Loading activity data...
                </div>
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
    <div className="quick-actions-modern">
      <div className="widget-header">
        <h3 className="widget-title">Quick Actions</h3>
      </div>
      <div className="quick-actions-list">
        <div 
          className="quick-action-item" 
          onClick={!isCustomizing ? generateFlashcards : undefined}
        >
          <span className="action-label-modern">flashcards</span>
          <span className="action-description">Create study cards instantly</span>
        </div>
        <div 
          className="quick-action-item" 
          onClick={!isCustomizing ? openNotes : undefined}
        >
          <span className="action-label-modern">study notes</span>
          <span className="action-description">Write and organize notes</span>
        </div>
        <div 
          className="quick-action-item" 
          onClick={!isCustomizing ? (() => navigate('/concept-web')) : undefined}
        >
          <span className="action-label-modern">concept web</span>
          <span className="action-description">Visualize connections</span>
        </div>
        <div 
          className="quick-action-item" 
          onClick={!isCustomizing ? openProfile : undefined}
        >
          <span className="action-label-modern">profile</span>
          <span className="action-description">View your progress</span>
        </div>
      </div>
    </div>
  );

        case 'social':
          return (
            <div className="social-widget">
              <div className="widget-header">
                <h3 className="widget-title">Social Hub</h3>
              </div>
              <div className="social-content">
                <div className="social-icon-container">
                  <Users size={64} strokeWidth={1.5} style={{ color: accent }} />
                </div>
                <p>
                  Connect with fellow learners, join study groups, and collaborate.
                </p>
                <button
                  className="social-explore-btn"
                  onClick={async () => {
                    await endDashboardSession();
                    navigate('/social');
                  }}
                  disabled={isCustomizing}
                  style={{
                    background: accent,
                    color: bgTop
                  }}
                  onMouseEnter={(e) => {
                    if (!isCustomizing) {
                      e.target.style.background = `color-mix(in srgb, ${accent} 85%, white)`;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isCustomizing) {
                      e.target.style.background = accent;
                    }
                  }}
                >
                  Explore Social
                </button>
              </div>
            </div>
          );

        case 'activity-timeline':
          return (
            <div className="social-widget widget-timeline-styled">
              <div className="widget-header">
                <h3 className="widget-title">activity timeline</h3>
              </div>
              <div className="social-content">
                <div>
                  <div className="social-icon-container">
                    <Clock size={64} strokeWidth={1.5} />
                  </div>
                  <p>Track your learning activities in one unified timeline.</p>
                </div>
                <button
                  className="social-explore-btn"
                  onClick={async () => {
                    await endDashboardSession();
                    navigate('/activity-timeline');
                  }}
                  disabled={isCustomizing}
                >
                  View Timeline
                </button>
              </div>
            </div>
          );

        default:
          // Handle legacy daily-goal widget by redirecting to social
          if (widget.type === 'daily-goal') {
            return (
              <div className="social-widget">
                <div className="widget-header">
                  <h3 className="widget-title">Social</h3>
                </div>
                <div className="social-content">
                  <div className="social-icon-container">
                    <Users size={64} strokeWidth={1.5} style={{ color: accent }} />
                  </div>
                  <p>
                    Connect with fellow learners, join study groups, and collaborate.
                  </p>
                  <button
                    className="social-explore-btn"
                    onClick={async () => {
                      await endDashboardSession();
                      navigate('/social');
                    }}
                    disabled={isCustomizing}
                    style={{
                      background: accent,
                      color: bgTop
                    }}
                    onMouseEnter={(e) => {
                      if (!isCustomizing) {
                        e.target.style.background = `color-mix(in srgb, ${accent} 85%, white)`;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isCustomizing) {
                        e.target.style.background = accent;
                      }
                    }}
                  >
                    Go to Social
                  </button>
                </div>
              </div>
            );
          }
          return <div>Unknown widget type: {widget.type}</div>;
      }
    };

    const isHeroWidget = ['stats', 'quick-actions', 'ai-assistant'].includes(widget.type);
    const needsBorderedStyle = widget.type === 'stats' || widget.type === 'heatmap' || widget.type === 'social';
    
    return (
      <div
        ref={setNodeRef}
        style={{
          ...style,
          background: needsBorderedStyle ? 'var(--panel)' : (isHeroWidget ? accent : accent),
          border: needsBorderedStyle ? `3px solid ${accent}` : (isHeroWidget ? 'none' : 'none'),
          borderRadius: 0,
        }}
        {...attributes}
        className={`dashboard-widget widget-${widget.size} widget-${widget.type} ${isCustomizing ? 'customizing' : ''} ${isDragging ? 'dragging' : ''}`}
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
            {/* Notification Bell */}
            <div className="notification-container">
              <button 
                className="notification-bell"
                onClick={() => setShowNotifications(!showNotifications)}
                title="Notifications"
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="notification-badge">{unreadCount}</span>
                )}
              </button>
              
              {showNotifications && (
                <div className="notification-dropdown">
                  <div className="notif-header">
                    <span className="notif-title">Notifications</span>
                    {unreadCount > 0 && (
                      <button className="notif-clear-btn" onClick={markAllNotificationsAsRead}>
                        Mark all read
                      </button>
                    )}
                  </div>
                  
                  <div className="notif-list">
                    {notifications.length === 0 ? (
                      <div className="notif-empty">
                        <Bell size={32} />
                        <p>No notifications</p>
                      </div>
                    ) : (
                      notifications.map(notification => (
                        <div key={notification.id} className={`notif-item ${!notification.is_read ? 'notif-unread' : ''}`}>
                          <div className="notif-body">
                            <div className="notif-header-row">
                              <span className="notif-from">{notification.title}</span>
                              <button className="notif-delete" onClick={() => deleteNotification(notification.id)}>×</button>
                            </div>
                            <p className="notif-text">{notification.message}</p>
                            <span className="notif-time">{getRelativeTime(notification.created_at)}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            
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
            
            <ThemeSwitcher />
          </div>
          
          <h1 className="dashboard-title">cerbyl</h1>
          
          <div className="header-right">
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
            <div className="dashboard-layout-modern">
              <div className="dashboard-hero-grid">
                <div className="greeting-card-modern">
                  <h2 className="modern-greeting">
                    {getGreeting()},<br />{displayName}
                  </h2>
                  <p className="modern-subtitle">
                    {getMotivationalMessage()}
                  </p>
                  {currentSessionTime > 0 && (
                    <div className="session-info-modern">
                      <span className="session-time-modern">
                        Current session: {currentSessionTime} minutes
                      </span>
                      {totalTimeToday > 0 && (
                        <span className="total-time-modern">
                          • Total today: {Math.round(totalTimeToday)} minutes
                        </span>
                      )}
                    </div>
                  )}
                </div>
                
                <SortableWidget key="stats" widget={widgets.find(w => w.id === 'stats')} />
                
                <SortableWidget key="quick-actions" widget={widgets.find(w => w.id === 'quick-actions')} />
                
                <SortableWidget key="ai-assistant" widget={widgets.find(w => w.id === 'ai-assistant')} />
              </div>
              
              <div className="dashboard-secondary-section">
                {enabledWidgets
                  .filter(w => !['stats', 'quick-actions', 'ai-assistant'].includes(w.id))
                  .map((widget) => (
                    <SortableWidget key={widget.id} widget={widget} />
                  ))}
              </div>
            </div>
          </SortableContext>
        </DndContext>

        {heatmapLoading && <LoadingSpinner />}
      </main>

      <HelpTour
        isOpen={showTour}
        onClose={closeTour}
        onComplete={completeTour}
      />
      <HelpButton onStartTour={startTour} />
      
      {/* Inactivity Engagement Suggestions */}
      {showInactivitySuggestion && (
        <div className="inactivity-suggestion-overlay">
          <div className="inactivity-suggestion-modal">
            <div className="suggestion-header">
              <h2>Let's Keep Learning!</h2>
              <p>You've been idle for a bit. Here are some ways to continue:</p>
              <button 
                className="suggestion-close-btn"
                onClick={() => setShowInactivitySuggestion(false)}
              >
                ×
              </button>
            </div>
            
            <div className="suggestion-grid">
              {engagementSuggestions.map(suggestion => (
                <div 
                  key={suggestion.id}
                  className="suggestion-card"
                  onClick={() => handleEngagementSuggestion(suggestion.action)}
                >
                  <div className="suggestion-icon">{suggestion.icon}</div>
                  <div className="suggestion-content">
                    <h3>{suggestion.title}</h3>
                    <p>{suggestion.description}</p>
                  </div>
                  <div className="suggestion-arrow">→</div>
                </div>
              ))}
            </div>
            
            <div className="suggestion-footer">
              <button 
                className="suggestion-dismiss-btn"
                onClick={() => setShowInactivitySuggestion(false)}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Proactive Notification */}
      {proactiveNotif && (
        <ProactiveNotification
          message={proactiveNotif.message}
          chatId={proactiveNotif.chatId}
          urgencyScore={proactiveNotif.urgencyScore}
          onClose={() => setProactiveNotif(null)}
        />
      )}
    </div>
  );
};

export default Dashboard;
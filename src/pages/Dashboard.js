import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatToLocalTime, getRelativeTime } from '../utils/dateUtils';
import { HelpTour, HelpButton } from './HelpTour';
import {
  CheckCircle, XCircle, Clock, Plus, Users, Bell, Calendar as CalendarIcon, BookOpen, Zap,
  MessageSquare, HelpCircle, FileText, Network, ChevronRight, Search
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { rgbaFromHex } from '../utils/ThemeManager';
import ThemeSwitcher from '../components/ThemeSwitcher';
import LoadingSpinner from '../components/LoadingSpinner';
import SlideNotification from '../components/SlideNotification';
import ImportExportModal from '../components/ImportExportModal';
import './Dashboard.css';
import { API_URL } from '../config';

// Customization constants
const MANDATORY_WIDGETS = ['greeting', 'stats', 'quick-actions', 'ai-assistant', 'learning-review', 'social', 'activity-timeline', 'heatmap'];

const WIDGET_DEFINITIONS = {
  'greeting': { title: 'Greeting Card', mandatory: true, defaultSize: 'small' },
  'stats': { title: 'Weekly Activity', mandatory: true, defaultSize: 'small' },
  'quick-actions': { title: 'Quick Actions', mandatory: true, defaultSize: 'small' },
  'ai-assistant': { title: 'AI Chat', mandatory: true, defaultSize: 'medium' },
  'learning-review': { title: 'Learning Reviews', mandatory: true, defaultSize: 'small' },
  'social': { title: 'Social Hub', mandatory: true, defaultSize: 'small' },
  'activity-timeline': { title: 'Activity Timeline', mandatory: true, defaultSize: 'small' },
  'heatmap': { title: 'Activity Heatmap', mandatory: true, defaultSize: 'full' },
  'notifications': { title: 'AI Notifications', mandatory: false, defaultSize: 'small' },
  'recent-activity': { title: 'Recent Activity', mandatory: false, defaultSize: 'small' },
  'daily-goal': { title: 'Daily Goal', mandatory: false, defaultSize: 'small' }
};

const Dashboard = () => {
  const navigate = useNavigate();
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

  const [showTour, setShowTour] = useState(false);
  const [hasSeenTour, setHasSeenTour] = useState(false);

  const [learningReviews, setLearningReviews] = useState([]);
  const [activeLearningReview, setActiveLearningReview] = useState(null);
  
  const [showImportExport, setShowImportExport] = useState(false);
  const [importExportSource, setImportExportSource] = useState('notes');

  const [isCustomizing, setIsCustomizing] = useState(false);
  const [customizeError, setCustomizeError] = useState('');
  const [draggedWidget, setDraggedWidget] = useState(null);
  const [editingWidgets, setEditingWidgets] = useState([]);
  const [editingAvailable, setEditingAvailable] = useState([]);
  const [originalLayout, setOriginalLayout] = useState({ placed: [], available: [] });
  
  const defaultLayout = [
    { id: 'greeting', type: 'greeting', size: 'small', gridColumn: 1, gridRow: 1 },
    { id: 'stats', type: 'stats', size: 'small', gridColumn: 2, gridRow: 1 },
    { id: 'quick-actions', type: 'quick-actions', size: 'medium', gridColumn: 3, gridRow: 1 },
    { id: 'ai-assistant', type: 'ai-assistant', size: 'medium', gridColumn: 1, gridRow: 2 },
    { id: 'learning-review', type: 'learning-review', size: 'small', gridColumn: 3, gridRow: 3 },
    { id: 'social', type: 'social', size: 'small', gridColumn: 1, gridRow: 3 },
    { id: 'activity-timeline', type: 'activity-timeline', size: 'small', gridColumn: 2, gridRow: 3 },
    { id: 'heatmap', type: 'heatmap', size: 'full', gridColumn: 1, gridRow: 4 }
  ];

  const [placedWidgets, setPlacedWidgets] = useState(defaultLayout);
  const [availableWidgets, setAvailableWidgets] = useState([
    { id: 'notifications', type: 'notifications', title: 'AI Notifications', defaultSize: 'small' },
    { id: 'recent-activity', type: 'recent-activity', title: 'Recent Activity', defaultSize: 'small' },
    { id: 'daily-goal', type: 'daily-goal', title: 'Daily Goal', defaultSize: 'small' }
  ]);

  const [recentActivities, setRecentActivities] = useState([]);
  const [weeklyProgress, setWeeklyProgress] = useState([]);
  const [dailyBreakdown, setDailyBreakdown] = useState([]);
  const [weeklyStats, setWeeklyStats] = useState({});
  const [motivationalQuote, setMotivationalQuote] = useState('');
  const [randomQuote, setRandomQuote] = useState('');
  const [achievements, setAchievements] = useState([]);
  const [learningAnalytics, setLearningAnalytics] = useState(null);
  const [conversationStarters, setConversationStarters] = useState([]);
  
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  
  const [slideNotifQueue, setSlideNotifQueue] = useState([]);
  const [lastNotificationIds, setLastNotificationIds] = useState(new Set());
  const notificationPollRef = useRef(null);
  const lastNotificationCheckRef = useRef(0);

  const [showInactivitySuggestion, setShowInactivitySuggestion] = useState(false);
  const [engagementSuggestions, setEngagementSuggestions] = useState([
    { id: 1, title: 'Start an AI Chat', description: 'Ask your AI tutor any question about your studies', icon: 'chat', action: 'ai' },
    { id: 2, title: 'Practice with Flashcards', description: 'Review and master key concepts with interactive flashcards', icon: 'flashcards', action: 'flashcards' },
    { id: 3, title: 'Generate Quiz Questions', description: 'Test your knowledge with auto-generated questions', icon: 'quiz', action: 'quiz' },
    { id: 4, title: 'Review Your Notes', description: 'Browse through your notes and organize concepts', icon: 'notes', action: 'notes' },
    { id: 5, title: 'Explore Concept Web', description: 'Visualize connections between topics', icon: 'web', action: 'concepts' },
    { id: 6, title: 'Join Study Group', description: 'Connect and collaborate with other learners', icon: 'social', action: 'social' }
  ]);

  const timeIntervalRef = useRef(null);
  const sessionUpdateRef = useRef(null);
  const lastActivityRef = useRef(Date.now());
  const inactivityTimerRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const username = localStorage.getItem('username');
    const profile = localStorage.getItem('userProfile');
    const savedLayout = localStorage.getItem('dashboardLayout');

    if (!token) {
      window.location.href = '/login';
      return;
    }
    
    // Ensure safety flag is set if user has valid token
    // This handles page refreshes where sessionStorage might be cleared
    if (token && username) {
      sessionStorage.setItem('safetyAccepted', 'true');
      console.log('Dashboard: Safety flag set for authenticated user');
    }

    if (username) setUserName(username);

    if (profile) {
      try {
        setUserProfile(JSON.parse(profile));
      } catch (error) {
        console.error('Error parsing user profile:', error);
      }
    }

    if (savedLayout) {
      try {
        const parsed = JSON.parse(savedLayout);
        setPlacedWidgets(parsed.placed || defaultLayout);
        setAvailableWidgets(parsed.available || []);
      } catch (error) {
        console.error('Error parsing saved layout:', error);
      }
    }
  }, []);

  useEffect(() => {
    if (userName) {
      const tourKey = `hasCompletedTour_${userName}`;
      const completedTour = localStorage.getItem(tourKey);
      setHasSeenTour(!!completedTour);

      if (!completedTour) {
        const timer = setTimeout(() => setShowTour(true), 2000);
        return () => clearTimeout(timer);
      }
    }
  }, [userName]);

  useEffect(() => {
  if (userName) {
    loadUserStats();
    loadHeatmapData();
    loadDashboardData();
    startDashboardSession();
    
    const justLoggedIn = sessionStorage.getItem('justLoggedIn');
    const notificationKey = `welcomeNotificationShown_${userName}`;
    const hasShownBefore = localStorage.getItem(notificationKey);
    
    if (justLoggedIn && !hasShownBefore) {
      // Get user's first name from profile, fallback to username
      const displayName = userProfile?.firstName || userName.split('@')[0];
      
      const welcomeNotif = {
        id: `welcome-${Date.now()}`,
        title: 'Welcome Back!',
        message: `Ready to continue learning, ${displayName}?`,
        type: 'welcome',
        created_at: new Date().toISOString()
      };
      
      setTimeout(() => {
        setSlideNotifQueue(prev => {
          if (!prev.some(n => n.type === 'welcome')) {
            return [...prev, welcomeNotif];
          }
          return prev;
        });
        // Store in localStorage so it persists and is user-specific
        localStorage.setItem(notificationKey, 'true');
      }, 1500);
      
      sessionStorage.removeItem('justLoggedIn');
    }
    
    startNotificationPolling();
    checkForMissedAchievements();
  }

  return () => {
    endDashboardSession();
    if (notificationPollRef.current) {
      clearInterval(notificationPollRef.current);
    }
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
  };
}, [userName]);

  const loadDashboardData = async () => {
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({ user_id: userName });
      
      const response = await fetch(`${API_URL}/get_dashboard_data?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        setRecentActivities(data.recent_activities || []);
        setWeeklyProgress(data.weekly_progress || [0, 0, 0, 0, 0, 0, 0]);
        setDailyBreakdown(data.daily_breakdown || []);
        setWeeklyStats(data.weekly_stats || {});
        setMotivationalQuote(data.motivational_quote || 'Keep learning every day!');
        setRandomQuote(data.random_quote || 'Every expert was once a beginner.');
        setAchievements(data.achievements || []);
        setLearningAnalytics(data.learning_analytics || null);
        setConversationStarters(data.conversation_starters || []);
        setLearningReviews(data.learning_reviews || []);
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
  };

  const checkForMissedAchievements = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/check_missed_achievements?user_id=${userName}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.missed_achievements && data.missed_achievements.length > 0) {
          data.missed_achievements.forEach((achievement, index) => {
            setTimeout(() => {
              const achievementNotif = {
                id: `achievement-${achievement.id || Date.now()}-${index}`,
                title: '🏆 Achievement Unlocked!',
                message: achievement.name || achievement.description,
                type: 'achievement',
                created_at: new Date().toISOString()
              };
              setSlideNotifQueue(prev => [...prev, achievementNotif]);
            }, index * 2000);
          });
        }
      }
    } catch (error) {
      console.error('Error checking missed achievements:', error);
    }
  };

  const startNotificationPolling = () => {
    if (notificationPollRef.current) {
      clearInterval(notificationPollRef.current);
    }

    const pollNotifications = async () => {
      try {
        const token = localStorage.getItem('token');
        const now = Date.now();
        
        if (now - lastNotificationCheckRef.current < 10000) {
          return;
        }
        lastNotificationCheckRef.current = now;

        const response = await fetch(`${API_URL}/get_notifications?user_id=${userName}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
          const data = await response.json();
          const notifs = data.notifications || [];
          
          setNotifications(notifs);
          setUnreadCount(notifs.filter(n => !n.is_read).length);

          const newNotifs = notifs.filter(notif => 
            !lastNotificationIds.has(notif.id) && !notif.is_read
          );

          if (newNotifs.length > 0) {
            const newSlideNotifs = newNotifs.map(notif => ({
              id: notif.id,
              title: notif.title,
              message: notif.message,
              type: notif.notification_type || 'general',
              created_at: notif.created_at
            }));
            
            setSlideNotifQueue(prev => [...prev, ...newSlideNotifs]);
            setLastNotificationIds(prev => {
              const updated = new Set(prev);
              newNotifs.forEach(n => updated.add(n.id));
              return updated;
            });
          }
        }
      } catch (error) {
        console.error('Error polling notifications:', error);
      }
    };

    pollNotifications();
    notificationPollRef.current = setInterval(pollNotifications, 120000); // Poll every 2 minutes instead of 30 seconds
  };

  const removeSlideNotification = (notifId) => {
    setSlideNotifQueue(prev => prev.filter(n => n.id !== notifId));
    // Mark as read when dismissed so it doesn't show again
    markNotificationAsRead(notifId);
  };

  const markNotificationAsRead = async (notifId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/mark_notification_read/${notifId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setNotifications(prev => prev.map(n => 
          n.id === notifId ? { ...n, is_read: true } : n
        ));
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const deleteNotification = async (notifId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/delete_notification/${notifId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const wasUnread = notifications.find(n => n.id === notifId)?.is_read === false;
        setNotifications(prev => prev.filter(n => n.id !== notifId));
        setLastNotificationIds(prev => {
          const updated = new Set(prev);
          updated.add(notifId);
          return updated;
        });
        if (wasUnread) setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const handleEngagementSuggestion = (action) => {
    setShowInactivitySuggestion(false);
    switch(action) {
      case 'ai': navigate('/ai'); break;
      case 'flashcards': navigate('/flashcards'); break;
      case 'quiz': navigate('/quiz'); break;
      case 'notes': navigate('/notes'); break;
      case 'concepts': navigate('/concepts'); break;
      case 'social': navigate('/social'); break;
      default: break;
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  // Extract first name from userProfile or userName
  const getDisplayName = () => {
    if (userProfile?.firstName) return userProfile.firstName;
    if (userProfile?.first_name) return userProfile.first_name;
    if (userProfile?.name) {
      const nameParts = userProfile.name.split(' ');
      return nameParts[0];
    }
    // If userName is email, extract name before @
    if (userName && userName.includes('@')) {
      return userName.split('@')[0];
    }
    return userName || 'Student';
  };
  
  const displayName = getDisplayName();

  const navigateToAI = () => navigate('/ai-chat');
  const navigateToFlashcards = () => navigate('/flashcards');
  const navigateToQuiz = () => navigate('/quiz');
  const navigateToNotes = () => navigate('/notes');
  const navigateToGames = () => navigate('/games');
  const navigateToSocial = () => navigate('/social');
  const navigateToConcepts = () => navigate('/concepts');
  const openProfile = () => navigate('/profile');

  const handleLogout = async () => {
    await endDashboardSession();
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '/login';
  };

  const handleLearningReviewAction = async (reviewId, action) => {
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('user_id', userName);
      formData.append('review_id', reviewId);
      formData.append('action', action);

      const response = await fetch(`${API_URL}/update_learning_review`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (response.ok) {
        loadDashboardData();
      }
    } catch (error) {
      console.error('Error updating learning review:', error);
    }
  };

  const startLearningReview = (review) => {
    setActiveLearningReview(review);
    if (review.content_type === 'flashcard_deck') {
      navigate(`/flashcards?deck_id=${review.content_id}`);
    } else if (review.content_type === 'topic') {
      navigate(`/ai?topic=${encodeURIComponent(review.topic)}`);
    }
  };

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

  const openNotes = () => navigate('/notes');
  const generateFlashcards = () => navigate('/flashcards');

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

  const saveLayoutConfiguration = () => {
    const missingWidgets = MANDATORY_WIDGETS.filter(
      type => !editingWidgets.some(w => w.type === type)
    );
    
    if (missingWidgets.length > 0) {
      const names = missingWidgets.map(t => WIDGET_DEFINITIONS[t]?.title || t).join(', ');
      setCustomizeError(`Please place all required widgets: ${names}`);
      return false;
    }
    
    setCustomizeError('');
    // Apply editing state to actual state
    setPlacedWidgets(editingWidgets);
    setAvailableWidgets(editingAvailable.filter(w => !WIDGET_DEFINITIONS[w.type]?.mandatory));
    localStorage.setItem('dashboardLayout', JSON.stringify({
      placed: editingWidgets,
      available: editingAvailable.filter(w => !WIDGET_DEFINITIONS[w.type]?.mandatory)
    }));
    return true;
  };

  const handleWidgetDragStart = (e, widget, isFromGrid = false) => {
    setDraggedWidget({ ...widget, isFromGrid });
    e.dataTransfer.effectAllowed = 'move';
    
    // Enable auto-scroll when dragging near edges
    const handleDragOver = (e) => {
      const scrollThreshold = 100;
      const scrollSpeed = 10;
      
      if (e.clientY < scrollThreshold) {
        window.scrollBy(0, -scrollSpeed);
      } else if (e.clientY > window.innerHeight - scrollThreshold) {
        window.scrollBy(0, scrollSpeed);
      }
    };
    
    document.addEventListener('dragover', handleDragOver);
    e.dataTransfer.setData('cleanup', 'true');
    
    // Cleanup on drag end
    const cleanup = () => {
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('dragend', cleanup);
    };
    document.addEventListener('dragend', cleanup);
  };

  const handleGridCellDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleGridCellDrop = (e, targetCol, targetRow) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!draggedWidget) return;

    const isFromAvailable = editingAvailable.some(w => w.id === draggedWidget.id);
    const isFromGrid = draggedWidget.isFromGrid;
    
    if (isFromAvailable) {
      // Adding from available widgets
      let size = draggedWidget.defaultSize || 'small';
      if (draggedWidget.type === 'quick-actions') {
        size = 'medium';
      }
      
      const newWidget = {
        id: draggedWidget.id,
        type: draggedWidget.type,
        size: size,
        gridColumn: targetCol,
        gridRow: targetRow
      };

      setEditingWidgets(prev => [...prev, newWidget]);
      setEditingAvailable(prev => prev.filter(w => w.id !== draggedWidget.id));
    } else if (isFromGrid) {
      // Moving existing widget to new position
      setEditingWidgets(prev => prev.map(w => 
        w.id === draggedWidget.id 
          ? { ...w, gridColumn: targetCol, gridRow: targetRow }
          : w
      ));
    }

    setDraggedWidget(null);
  };

  const handleGridDrop = (e) => {
    e.preventDefault();
    setDraggedWidget(null);
  };

  const handleRemoveWidget = (widgetId) => {
    const widget = editingWidgets.find(w => w.id === widgetId);
    if (!widget) return;
    
    const def = WIDGET_DEFINITIONS[widget.type];
    
    setEditingWidgets(prev => prev.filter(w => w.id !== widgetId));
    setEditingAvailable(prev => [...prev, {
      id: widget.id,
      type: widget.type,
      title: def?.title || widget.type,
      defaultSize: widget.size,
      mandatory: def?.mandatory || false
    }]);
    setCustomizeError('');
  };

  const handleWidgetResize = (widgetId, newSize) => {
    setEditingWidgets(prev => prev.map(w => {
      if (w.id === widgetId) {
        return { ...w, size: newSize };
      }
      return w;
    }));
  };

  const resetLayout = () => {
    if (isCustomizing) {
      // In customize mode, reset editing state to default layout
      setEditingWidgets(defaultLayout);
      setEditingAvailable([
        { id: 'notifications', type: 'notifications', title: 'AI Notifications', defaultSize: 'small', mandatory: false },
        { id: 'recent-activity', type: 'recent-activity', title: 'Recent Activity', defaultSize: 'small', mandatory: false },
        { id: 'daily-goal', type: 'daily-goal', title: 'Daily Goal', defaultSize: 'small', mandatory: false }
      ]);
    } else {
      setPlacedWidgets(defaultLayout);
      setAvailableWidgets([
        { id: 'notifications', type: 'notifications', title: 'AI Notifications', defaultSize: 'small' },
        { id: 'recent-activity', type: 'recent-activity', title: 'Recent Activity', defaultSize: 'small' },
        { id: 'daily-goal', type: 'daily-goal', title: 'Daily Goal', defaultSize: 'small' }
      ]);
    }
  };

  const getWidgetDefinition = (type) => {
    const defs = {
      'greeting': { title: 'Greeting' },
      'stats': { title: 'Weekly Activity' },
      'quick-actions': { title: 'Quick Actions' },
      'ai-assistant': { title: 'AI Chat' },
      'learning-review': { title: 'Learning Reviews' },
      'social': { title: 'Social' },
      'activity-timeline': { title: 'Activity Timeline' },
      'heatmap': { title: 'Activity Heatmap' },
      'notifications': { title: 'AI Notifications' },
      'recent-activity': { title: 'Recent Activity' },
      'daily-goal': { title: 'Daily Goal' }
    };
    return defs[type] || { title: type };
  };

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
    const accent = selectedTheme?.tokens?.['--accent'] || '#D7B38C';
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
    if (userName) {
      const tourKey = `hasCompletedTour_${userName}`;
      localStorage.setItem(tourKey, '1');
    }
  };

  const loadUserStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/get_gamification_stats?user_id=${userName}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const gamificationStats = await response.json();
        setStats({
          streak: gamificationStats.current_streak || 0,
          totalQuestions: gamificationStats.total_questions_answered || 0,
          minutes: gamificationStats.total_study_minutes || 0,
          totalFlashcards: gamificationStats.total_flashcards_created || 0,
          totalNotes: gamificationStats.total_notes_created || 0,
          totalChatSessions: gamificationStats.total_chat_sessions || 0
        });
        setTotalTimeToday(0);
      } else {
        const fallbackResponse = await fetch(`${API_URL}/get_user_stats?user_id=${userName}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (fallbackResponse.ok) {
          const data = await fallbackResponse.json();
          setStats({
            streak: data.streak || 0,
            totalQuestions: data.total_questions || 0,
            minutes: data.minutes || 0,
            totalFlashcards: data.total_flashcards || 0,
            totalNotes: data.total_notes || 0,
            totalChatSessions: data.total_chat_sessions || 0
          });
          setTotalTimeToday(data.total_time_today || 0);
        }
      }
    } catch (error) {
      console.error('Error loading user stats:', error);
    }
  };

  const renderWidget = (widget) => {
    const tokens = selectedTheme?.tokens || {};
    const accent = tokens['--accent'] || '#D7B38C';
    const accent2 = tokens['--accent-2'] || '#B88F63';
    const textPrimary = tokens['--text-primary'] || '#EAECEF';
    const textSecondary = tokens['--text-secondary'] || '#B8C0CC';
    const bgTop = tokens['--bg-top'] || '#0a0a0b';
    const widgetContrastColor = selectedTheme?.mode === 'light' ? '#000000' : '#ffffff';

    switch (widget.type) {
      case 'greeting':
        const quoteToShow = randomQuote || motivationalQuote || 'Keep learning every day!';
        return (
          <div className="greeting-card-compact">
            <h2 className="greeting-text">{getGreeting()}, {displayName}</h2>
            <p className="greeting-quote">"{quoteToShow}"</p>
          </div>
        );

      case 'stats':
        // Weekly line graph data
        const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const maxWeeklyValue = Math.max(...weeklyProgress, 1);
        
        return (
          <div className="stats-overview-widget">
            <div className="widget-header">
              <h3 className="widget-title">weekly activity</h3>
              <div className="widget-header-right">
                <button className="analytics-btn" onClick={() => !isCustomizing && navigate('/analytics')} disabled={isCustomizing}>
                  <span>Analytics</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
            <div className="stats-line-container">
              <div className="stats-graph-section">
                <div className="line-chart-wrapper">
                  <svg viewBox="0 0 280 120" className="stats-line-chart" preserveAspectRatio="xMidYMid meet">
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
              </div>
              <div className="stats-numbers-section">
                <div className="stat-row">
                  <span className="stat-value">{totalQuestions}</span>
                  <span className="stat-label">questions</span>
                </div>
                <div className="stat-row">
                  <span className="stat-value">{stats.totalFlashcards}</span>
                  <span className="stat-label">flashcards</span>
                </div>
                <div className="stat-row">
                  <span className="stat-value">{stats.totalChatSessions}</span>
                  <span className="stat-label">sessions</span>
                </div>
                <div className="stat-row">
                  <span className="stat-value">{stats.totalNotes}</span>
                  <span className="stat-label">notes</span>
                </div>
              </div>
            </div>
          </div>
        );

      case 'quick-actions':
        return (
          <div className="quick-actions">
            <h3 className="section-title">quick actions</h3>
            <div className="action-grid">
              <button 
                className="action-btn" 
                onClick={!isCustomizing ? generateFlashcards : undefined}
              >
                <span className="action-label">flashcards</span>
                <span className="action-description">Create and review study cards</span>
              </button>
              <button 
                className="action-btn" 
                onClick={!isCustomizing ? openNotes : undefined}
              >
                <span className="action-label">study notes</span>
                <span className="action-description">Take and organize your notes</span>
              </button>
              <button 
                className="action-btn" 
                onClick={!isCustomizing ? (() => navigate('/concept-web')) : undefined}
              >
                <span className="action-label">concept web</span>
                <span className="action-description">Visualize topic connections</span>
              </button>
              <button 
                className="action-btn" 
                onClick={!isCustomizing ? openProfile : undefined}
              >
                <span className="action-label">profile</span>
                <span className="action-description">View your learning profile</span>
              </button>
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
              >
                AI
              </div>
            </div>
            <div className="ai-stats-row">
              <div className="ai-stat">
                <span className="ai-stat-value">{totalQuestions}</span>
                <span className="ai-stat-label">questions</span>
              </div>
              <div className="ai-stat">
                <span className="ai-stat-value">{stats.totalChatSessions}</span>
                <span className="ai-stat-label">sessions</span>
              </div>
            </div>
            <button 
              className="ai-chat-btn" 
              onClick={!isCustomizing ? navigateToAI : undefined}
            >
              START AI SESSION
            </button>
            <p className="ai-description">
              Get instant help with any topic, generate practice questions, and receive personalized learning guidance.
            </p>
          </div>
        );

      case 'learning-review':
        return (
          <div className="learning-review-widget">
            <div className="widget-header">
              <h3 className="widget-title">learning reviews</h3>
            </div>
            <div className="review-content-accent">
              <div className="review-icon-container">
                <BookOpen size={64} strokeWidth={1.5} />
              </div>
              <p className="review-description">
                Create and track your learning reviews to monitor progress.
              </p>
              <button 
                className="review-explore-btn" 
                onClick={!isCustomizing ? (() => navigate('/learning-hub')) : undefined}
                disabled={isCustomizing}
              >
                VIEW REVIEWS
              </button>
            </div>
          </div>
        );

      case 'social':
        return (
          <div className="social-widget">
            <div className="widget-header">
              <h3 className="widget-title">social hub</h3>
            </div>
            <div className="social-content">
              <div className="social-icon-container">
                <Users size={64} strokeWidth={1.5} />
              </div>
              <p>
                Connect with fellow learners, join study groups, and collaborate.
              </p>
              <button 
                className="social-explore-btn" 
                onClick={!isCustomizing ? navigateToSocial : undefined}
                disabled={isCustomizing}
              >
                EXPLORE SOCIAL
              </button>
            </div>
          </div>
        );

      case 'activity-timeline':
        return (
          <div className="recent-activity-widget">
            <div className="widget-header">
              <h3 className="widget-title">recent activity</h3>
            </div>
            <div className="activity-content-accent">
              <div className="activity-icon-container">
                <Clock size={64} strokeWidth={1.5} />
              </div>
              <p className="activity-description">
                Track your learning activities in one unified timeline.
              </p>
              <button 
                className="activity-explore-btn" 
                onClick={!isCustomizing ? (() => navigate('/activity-timeline')) : undefined}
                disabled={isCustomizing}
              >
                VIEW TIMELINE
              </button>
            </div>
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
                              key={dayIndex}
                              className="heatmap-day"
                              style={{
                                backgroundColor: day ? getActivityColor(day.level) : 'transparent',
                                opacity: day === null ? 0 : 1
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
                  <span className="legend-label">Less</span>
                  <div className="legend-scale">
                    {[0, 1, 2, 3, 4].map(level => (
                      <div
                        key={level}
                        className="legend-box"
                        style={{ backgroundColor: getActivityColor(level) }}
                      />
                    ))}
                  </div>
                  <span className="legend-label">More</span>
                </div>
              </>
            )}
          </div>
        );

      case 'notifications':
        return (
          <div className="notifications-widget">
            <div className="widget-header">
              <h3 className="widget-title">Notifications</h3>
            </div>
            <div className="notifications-list">
              {notifications.slice(0, widget.size === 'small' ? 3 : 5).length > 0 ? (
                notifications.slice(0, widget.size === 'small' ? 3 : 5).map(notif => (
                  <div key={notif.id} className={`notif-item-mini ${!notif.is_read ? 'unread' : ''}`}>
                    <div className="notif-dot" style={{ background: !notif.is_read ? accent : textSecondary }}></div>
                    <div className="notif-text-mini">{notif.title}</div>
                  </div>
                ))
              ) : (
                <div className="no-notifications">
                  <p>No notifications</p>
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
                  <button onClick={!isCustomizing ? navigateToAI : undefined} className="start-learning-btn" style={{ borderColor: accent, color: textPrimary }}>
                    Start Learning
                  </button>
                </div>
              )}
            </div>
          </div>
        );

      case 'daily-goal':
        const goalProgress = Math.min((stats.totalQuestions / 10) * 100, 100);
        return (
          <div className="daily-goal-widget">
            <div className="widget-header">
              <h3 className="widget-title">Daily Goal</h3>
            </div>
            <div className="goal-content">
              <div className="goal-progress-circle">
                <svg viewBox="0 0 100 100" className="progress-ring">
                  <circle cx="50" cy="50" r="45" fill="none" stroke={rgbaFromHex(accent, 0.2)} strokeWidth="10" />
                  <circle 
                    cx="50" 
                    cy="50" 
                    r="45" 
                    fill="none" 
                    stroke={accent} 
                    strokeWidth="10"
                    strokeDasharray={`${(goalProgress / 100) * 283} 283`}
                    strokeLinecap="round"
                    transform="rotate(-90 50 50)"
                  />
                </svg>
                <div className="goal-percentage">{Math.round(goalProgress)}%</div>
              </div>
              <div className="goal-details">
                <p className="goal-text">{stats.totalQuestions} / 10 questions today</p>
                <button className="goal-btn" onClick={!isCustomizing ? navigateToQuiz : undefined} style={{ borderColor: accent, color: textPrimary }}>
                  Continue
                </button>
              </div>
            </div>
          </div>
        );

      default:
        return <div>Unknown widget type: {widget.type}</div>;
    }
  };

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div className="header-content">
          <div className="header-left">
            <div className="dashboard-notifications-wrapper">
              <button className="dashboard-notif-bell-btn" onClick={() => setShowNotifications(!showNotifications)}>
                <Bell size={20} />
                {unreadCount > 0 && <span className="dashboard-notif-badge">{unreadCount}</span>}
              </button>
              
              {showNotifications && (
                <div className="dashboard-notif-panel">
                  <div className="dashboard-notif-panel-header">
                    <h3>Notifications</h3>
                    <button className="dashboard-notif-close-btn" onClick={() => setShowNotifications(false)}>×</button>
                  </div>
                  <div className="dashboard-notif-panel-content">
                    {notifications.length === 0 ? (
                      <div className="dashboard-no-notifications-placeholder">
                        <Bell size={32} opacity={0.3} />
                        <p>No notifications yet</p>
                      </div>
                    ) : (
                      notifications.map(notification => (
                        <div key={notification.id} className={`dashboard-notif-item ${!notification.is_read ? 'dashboard-notif-unread' : ''}`}>
                          <div className="dashboard-notif-body">
                            <div className="dashboard-notif-header-row">
                              <span className="dashboard-notif-from">{notification.title}</span>
                              <button className="dashboard-notif-delete" onClick={() => deleteNotification(notification.id)}>×</button>
                            </div>
                            <p className="dashboard-notif-text">{notification.message}</p>
                            <span className="dashboard-notif-time">{getRelativeTime(notification.created_at)}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            
            <div className="dashboard-user-info">
              {userProfile?.picture && (
  <img
    src={userProfile.picture}
    alt="Profile"
    className="dashboard-profile-picture"
    referrerPolicy="no-referrer"
    crossOrigin="anonymous"
  />
)}
              <span className="dashboard-user-name">{displayName}</span>
            </div>
            
            <ThemeSwitcher />
          </div>
          
          <h1 className="dashboard-title">cerbyl</h1>
          
          <div className="header-right">
            <button
              className="dashboard-search-hub-btn"
              onClick={() => navigate('/search-hub')}
              title="Go to Search Hub"
            >
              <Search size={18} />
              <span>SEARCH HUB</span>
            </button>
            {isCustomizing && (
              <button
                className="dashboard-cancel-btn"
                onClick={() => {
                  // Revert to original layout
                  setEditingWidgets(originalLayout.placed);
                  setEditingAvailable(originalLayout.available);
                  setCustomizeError('');
                  setIsCustomizing(false);
                }}
              >
                CANCEL
              </button>
            )}
            <button
              className={`dashboard-customize-btn ${isCustomizing ? 'active' : ''}`}
              onClick={() => {
                if (isCustomizing) {
                  const success = saveLayoutConfiguration();
                  if (success) {
                    setIsCustomizing(false);
                  }
                } else {
                  // Enter customize mode - store original state
                  setCustomizeError('');
                  // Store current state before entering customize mode
                  setOriginalLayout({
                    placed: [...placedWidgets],
                    available: [...availableWidgets]
                  });
                  // Move ALL widgets to available list
                  const allWidgets = [
                    ...placedWidgets.map(w => ({
                      id: w.id,
                      type: w.type,
                      title: WIDGET_DEFINITIONS[w.type]?.title || w.type,
                      defaultSize: w.size,
                      mandatory: WIDGET_DEFINITIONS[w.type]?.mandatory || false
                    })),
                    ...availableWidgets
                  ];
                  setEditingWidgets([]);
                  setEditingAvailable(allWidgets);
                  setIsCustomizing(true);
                }
              }}
            >
              {isCustomizing ? 'DONE' : 'CUSTOMIZE'}
            </button>
            <button className="dashboard-profile-btn" onClick={openProfile}>PROFILE</button>
            <button className="dashboard-logout-btn" onClick={handleLogout}>LOGOUT</button>
          </div>
        </div>
      </header>

      <main className="dashboard-main">
        {isCustomizing && (
          <div className="customization-panel">
            <div className="panel-header">
              <div className="customization-help">
                <p>Drag widgets onto the grid • Use S/M/L buttons to resize • Click × to remove</p>
              </div>
              <button className="reset-btn" onClick={resetLayout}>
                Reset to Default
              </button>
            </div>
            {customizeError && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid #ef4444',
                color: '#ef4444',
                padding: '12px 16px',
                marginBottom: '16px',
                fontSize: '13px',
                fontWeight: '500'
              }}>
                {customizeError}
              </div>
            )}
            <div className="available-widgets-section">
              <h4>Available Widgets {editingAvailable.filter(w => w.mandatory).length > 0 && <span style={{color: 'var(--danger)', fontSize: '11px', marginLeft: '8px'}}>({editingAvailable.filter(w => w.mandatory).length} required)</span>}</h4>
              <div className="available-widgets-list">
                {editingAvailable.map(widget => (
                  <div 
                    key={widget.id} 
                    className={`draggable-widget-item ${widget.mandatory ? 'mandatory' : ''}`}
                    draggable
                    onDragStart={(e) => handleWidgetDragStart(e, widget)}
                  >
                    {widget.title}
                    {widget.mandatory && <span className="mandatory-badge">*</span>}
                  </div>
                ))}
                {editingAvailable.length === 0 && (
                  <p style={{color: 'var(--text-secondary)', fontSize: '13px'}}>All widgets placed on grid</p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="dashboard-layout-modern">
          {isCustomizing ? (
            <div className="dashboard-grid-customize">
              {/* Render grid cells for 3 columns x 10 rows */}
              {Array.from({ length: 10 }).map((_, rowIndex) => (
                Array.from({ length: 3 }).map((_, colIndex) => {
                  const col = colIndex + 1;
                  const row = rowIndex + 1;
                  
                  // Check if this cell is occupied by a widget
                  const widgetInCell = editingWidgets.find(w => {
                    const widgetCol = w.gridColumn;
                    const widgetRow = w.gridRow;
                    
                    // Check if widget occupies this cell based on size
                    if (w.size === 'small') {
                      return widgetCol === col && widgetRow === row;
                    } else if (w.size === 'medium') {
                      // Quick actions is vertical (1 col x 2 rows), others are horizontal (2 cols x 1 row)
                      if (w.type === 'quick-actions') {
                        return widgetCol === col && (widgetRow === row || widgetRow === row - 1);
                      } else {
                        return widgetRow === row && (widgetCol === col || widgetCol === col - 1);
                      }
                    } else if (w.size === 'full') {
                      // Full spans 3 columns, 1 row
                      return widgetRow === row && (widgetCol === col || widgetCol === col - 1 || widgetCol === col - 2);
                    }
                    return false;
                  });
                  
                  // Only render widget at its starting position
                  const isWidgetStart = widgetInCell && widgetInCell.gridColumn === col && widgetInCell.gridRow === row;
                  
                  // Check if cell is part of a widget but not the start
                  const isOccupied = widgetInCell && !isWidgetStart;
                  
                  if (isOccupied) {
                    return null; // Skip rendering, this cell is part of another widget
                  }
                  
                  if (isWidgetStart) {
                    const getGridSpan = () => {
                      if (widgetInCell.size === 'full') {
                        return { gridColumn: 'span 3', gridRow: 'span 1' };
                      } else if (widgetInCell.size === 'medium') {
                        // Quick actions is vertical, others are horizontal
                        if (widgetInCell.type === 'quick-actions') {
                          return { gridColumn: 'span 1', gridRow: 'span 2' };
                        } else {
                          return { gridColumn: 'span 2', gridRow: 'span 1' };
                        }
                      } else {
                        return { gridColumn: 'span 1', gridRow: 'span 1' };
                      }
                    };
                    
                    const spanStyle = getGridSpan();
                    
                    return (
                      <div
                        key={`${col}-${row}`}
                        className={`dashboard-widget widget-${widgetInCell.size} customizing ${draggedWidget?.id === widgetInCell.id ? 'dragging' : ''}`}
                        data-type={widgetInCell.type}
                        style={spanStyle}
                        draggable
                        onDragStart={(e) => handleWidgetDragStart(e, widgetInCell, true)}
                        onDragOver={(e) => handleGridCellDragOver(e)}
                        onDrop={(e) => handleGridCellDrop(e, col, row)}
                      >
                        <div className="widget-controls">
                          <div className="drag-handle">⋮⋮</div>
                          {widgetInCell.type !== 'heatmap' && (
                            <>
                              <div className="size-controls">
                                <button className={`size-btn ${widgetInCell.size === 'small' ? 'active' : ''}`} onClick={() => handleWidgetResize(widgetInCell.id, 'small')}>S</button>
                                <button className={`size-btn ${widgetInCell.size === 'medium' ? 'active' : ''}`} onClick={() => handleWidgetResize(widgetInCell.id, 'medium')}>M</button>
                                <button className={`size-btn ${widgetInCell.size === 'full' ? 'active' : ''}`} onClick={() => handleWidgetResize(widgetInCell.id, 'full')}>F</button>
                              </div>
                              <button className="remove-btn" onClick={() => handleRemoveWidget(widgetInCell.id)}>×</button>
                            </>
                          )}
                          {widgetInCell.type === 'heatmap' && (
                            <>
                              <div className="size-controls">
                                <button className="size-btn active">FULL</button>
                              </div>
                              <button className="remove-btn" onClick={() => handleRemoveWidget(widgetInCell.id)}>×</button>
                            </>
                          )}
                        </div>
                        <div className="widget-content customize-mode">
                          {renderWidget(widgetInCell)}
                        </div>
                      </div>
                    );
                  }
                  
                  // Empty cell - drop zone
                  return (
                    <div
                      key={`${col}-${row}`}
                      className="grid-cell-empty"
                      onDragOver={(e) => handleGridCellDragOver(e)}
                      onDrop={(e) => handleGridCellDrop(e, col, row)}
                    >
                      <div className="cell-placeholder">{col},{row}</div>
                    </div>
                  );
                })
              ))}
            </div>
          ) : (
            <div className="dashboard-widgets-grid">
              {placedWidgets.map(widget => (
                <div
                  key={widget.id}
                  className={`dashboard-widget widget-${widget.size}`}
                  data-type={widget.type}
                >
                  {renderWidget(widget)}
                </div>
              ))}
            </div>
          )}
        </div>

        {heatmapLoading && <LoadingSpinner />}
      </main>

      <HelpTour
        isOpen={showTour}
        onClose={closeTour}
        onComplete={completeTour}
      />
      <HelpButton onStartTour={startTour} />
      
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
              {engagementSuggestions.map(suggestion => {
                const getIcon = () => {
                  switch(suggestion.icon) {
                    case 'chat': return <MessageSquare size={20} />;
                    case 'flashcards': return <BookOpen size={20} />;
                    case 'quiz': return <HelpCircle size={20} />;
                    case 'notes': return <FileText size={20} />;
                    case 'web': return <Network size={20} />;
                    case 'social': return <Users size={20} />;
                    default: return <Zap size={20} />;
                  }
                };
                return (
                  <div 
                    key={suggestion.id}
                    className="suggestion-card"
                    onClick={() => handleEngagementSuggestion(suggestion.action)}
                  >
                    <div className="suggestion-icon">{getIcon()}</div>
                    <div className="suggestion-content">
                      <h3>{suggestion.title}</h3>
                      <p>{suggestion.description}</p>
                    </div>
                    <div className="suggestion-arrow"><ChevronRight size={18} /></div>
                  </div>
                );
              })}
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
      
      {slideNotifQueue
        .filter(notif => notif && notif.id && (notif.title || notif.message))
        .slice(0, 3)
        .map((notif, index) => (
        <SlideNotification
          key={notif.id}
          notification={notif}
          onClose={() => removeSlideNotification(notif.id)}
          onMarkRead={markNotificationAsRead}
          style={{ top: `${80 + (index * 130)}px` }}
        />
      ))}
      
      <ImportExportModal
        isOpen={showImportExport}
        onClose={() => setShowImportExport(false)}
        mode="import"
        sourceType={importExportSource}
        onSuccess={(result) => {
          loadDashboardData();
        }}
      />
    </div>
  );
};

export default Dashboard;
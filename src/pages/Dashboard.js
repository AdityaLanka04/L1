import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatToLocalTime, getRelativeTime } from '../utils/dateUtils';
import { HelpTour, HelpButton } from './HelpTour';
import {
  CheckCircle, XCircle, Clock, Plus, Users, Bell, Calendar as CalendarIcon, BookOpen, Zap,
  MessageSquare, HelpCircle, FileText, Network, ChevronRight, Search, User, Home,
  Brain, Target, Flame, Settings, LogOut
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { rgbaFromHex } from '../utils/ThemeManager';
import ThemeSwitcher from '../components/ThemeSwitcher';
import LoadingSpinner from '../components/LoadingSpinner';
import SlideNotification from '../components/SlideNotification';
import ImportExportModal from '../components/ImportExportModal';
import './Dashboard.css';
import { API_URL } from '../config';
import logo from '../assets/logo.svg';

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
  const [currentQuestions, setCurrentQuestions] = useState(0);  // Current existing messages
  const [currentSessions, setCurrentSessions] = useState(0);    // Current existing sessions
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
          }

    if (username) setUserName(username);

    if (profile) {
      try {
        setUserProfile(JSON.parse(profile));
      } catch (error) {
              }
    }

    if (savedLayout) {
      try {
        const parsed = JSON.parse(savedLayout);
        setPlacedWidgets(parsed.placed || defaultLayout);
        setAvailableWidgets(parsed.available || []);
      } catch (error) {
              }
    }
  }, []);

  useEffect(() => {
    if (userName) {
      // Check if user just completed onboarding
      const justCompletedOnboarding = sessionStorage.getItem('justCompletedOnboarding') === 'true';
      const justLoggedIn = sessionStorage.getItem('justLoggedIn');
      
      if (justCompletedOnboarding && justLoggedIn) {
        sessionStorage.removeItem('justCompletedOnboarding'); // Clear flag
        setHasSeenTour(false);
        setTimeout(() => {
          setShowTour(true);
        }, 1000);
      } else {
        // Not first-time, don't show tour
        setHasSeenTour(true);
      }
    }
  }, [userName]);

  const checkIfFirstTimeUser = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/is_first_time_user?user_id=${userName}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        const isFirstTime = data.is_first_time;
        
                
        // If NOT first-time, mark tour as seen
        setHasSeenTour(!isFirstTime);

        // Auto-show tour ONLY for first-time users
        const justLoggedIn = sessionStorage.getItem('justLoggedIn');
        if (justLoggedIn && isFirstTime) {
          setTimeout(() => {
            setShowTour(true);
          }, 1000);
        }
      }
    } catch (error) {
      // Default to NOT showing tour if check fails
      setHasSeenTour(true);
    }
  };

  useEffect(() => {
  if (userName) {
    loadUserStats();
    loadHeatmapData();
    loadDashboardData();
    startDashboardSession();
    
    const justLoggedIn = sessionStorage.getItem('justLoggedIn');
    
    // Check if this is the first login today (not just first navigation)
    const today = new Date().toDateString();
    const lastLoginDate = localStorage.getItem(`lastLoginDate_${userName}`);
    const isFirstLoginToday = lastLoginDate !== today;
    
    // Check if study insights is enabled in user profile
    const profile = localStorage.getItem('userProfile');
    let showStudyInsights = true; // Default to true
    if (profile) {
      try {
        const parsed = JSON.parse(profile);
        showStudyInsights = parsed.showStudyInsights !== false;
      } catch (e) {}
    }
    
    if (justLoggedIn && isFirstLoginToday) {
      // Mark today as logged in
      localStorage.setItem(`lastLoginDate_${userName}`, today);
      sessionStorage.removeItem('justLoggedIn');
      
      // Check if user just completed onboarding (came from profile quiz)
      const isFirstTimeUser = sessionStorage.getItem('isFirstTimeUser') === 'true';
      sessionStorage.removeItem('isFirstTimeUser'); // Clear flag after reading
      
                  
      // Get user's first name from profile, fallback to username
      const displayName = userProfile?.firstName || userName.split('@')[0];
      
      // For returning users, fetch personalized welcome notification (only if study insights enabled)
      if (!isFirstTimeUser && showStudyInsights) {
        fetchPersonalizedWelcome(displayName);
      } else if (!isFirstTimeUser && !showStudyInsights) {
        // Show simple welcome without study insights
        const welcomeNotif = {
          id: `welcome-${Date.now()}`,
          title: 'Welcome Back!',
          message: `Ready to continue learning, ${displayName}?`,
          type: 'welcome',
          notification_type: 'welcome',
          created_at: new Date().toISOString()
        };
        
        setTimeout(() => {
          setSlideNotifQueue(prev => {
            if (!prev.some(n => n.type === 'welcome')) {
              return [...prev, welcomeNotif];
            }
            return prev;
          });
        }, 1500);
      } else {
        // For first-time users, show simple welcome
        const welcomeNotif = {
          id: `welcome-${Date.now()}`,
          title: 'Welcome!',
          message: `Let's get started with your learning journey, ${displayName}!`,
          type: 'welcome',
          notification_type: 'welcome',
          created_at: new Date().toISOString()
        };
        
        setTimeout(() => {
          setSlideNotifQueue(prev => {
            if (!prev.some(n => n.type === 'welcome')) {
              return [...prev, welcomeNotif];
            }
            return prev;
          });
        }, 3000);
      }
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

  const fetchPersonalizedWelcome = async (displayName) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/study_insights/welcome_notification?user_id=${userName}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        const notifData = data.notification;
        
        const welcomeNotif = {
          id: `welcome-${Date.now()}`,
          title: notifData.title || 'Welcome Back!',
          message: notifData.message || `Ready to continue learning, ${displayName}?`,
          type: 'welcome',
          notification_type: notifData.has_insights ? 'study_insights' : 'welcome',
          has_insights: notifData.has_insights,
          created_at: new Date().toISOString()
        };
        
        setTimeout(() => {
          setSlideNotifQueue(prev => {
            if (!prev.some(n => n.type === 'welcome')) {
              return [...prev, welcomeNotif];
            }
            return prev;
          });
        }, 1500);
      } else {
        // Fallback to simple welcome
        const welcomeNotif = {
          id: `welcome-${Date.now()}`,
          title: 'Welcome Back!',
          message: `Ready to continue learning, ${displayName}?`,
          type: 'welcome',
          notification_type: 'welcome',
          created_at: new Date().toISOString()
        };
        
        setTimeout(() => {
          setSlideNotifQueue(prev => {
            if (!prev.some(n => n.type === 'welcome')) {
              return [...prev, welcomeNotif];
            }
            return prev;
          });
        }, 1500);
      }
    } catch (error) {
            // Fallback to simple welcome
      const displayName = userProfile?.firstName || userName.split('@')[0];
      const welcomeNotif = {
        id: `welcome-${Date.now()}`,
        title: 'Welcome Back!',
        message: `Ready to continue learning, ${displayName}?`,
        type: 'welcome',
        notification_type: 'welcome',
        created_at: new Date().toISOString()
      };
      
      setTimeout(() => {
        setSlideNotifQueue(prev => {
          if (!prev.some(n => n.type === 'welcome')) {
            return [...prev, welcomeNotif];
          }
          return prev;
        });
      }, 1500);
    }
  };

  const loadDashboardData = async () => {
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({ user_id: userName });
      
      // Load weekly progress from dedicated endpoint
      const weeklyResponse = await fetch(`${API_URL}/get_weekly_progress?user_id=${userName}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (weeklyResponse.ok) {
        const weeklyData = await weeklyResponse.json();
        setWeeklyProgress(weeklyData.weekly_data || [0, 0, 0, 0, 0, 0, 0]);
        setDailyBreakdown(weeklyData.daily_breakdown || []);
        setWeeklyStats(weeklyData.weekly_stats || {});
      }
      
      // Load analytics data for weekly activity graph
      const analyticsResponse = await fetch(`${API_URL}/get_analytics_history?user_id=${userName}&period=week`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (analyticsResponse.ok) {
        const analyticsData = await analyticsResponse.json();
        const history = analyticsData.history || [];
        
        // Use analytics for weekly totals only (for the graph)
        const weeklyAIChats = history.reduce((sum, day) => sum + (day.ai_chats || 0), 0);
        const weeklyFlashcards = history.reduce((sum, day) => sum + (day.flashcards || 0), 0);
        const weeklyNotes = history.reduce((sum, day) => sum + (day.notes || 0), 0);
        const weeklyStudyMinutes = history.reduce((sum, day) => sum + (day.study_minutes || 0), 0);
        
        // Store weekly totals for display
        setWeeklyStats(prev => ({
          ...prev,
          weeklyAIChats,
          weeklyFlashcards,
          weeklyNotes,
          weeklyStudyMinutes
        }));
      }
      
      // Load other dashboard data including gamification stats
      const response = await fetch(`${API_URL}/get_dashboard_data?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Use gamification stats for ALL-TIME totals (this is what should be displayed)
        if (data.gamification) {
          setStats({
            streak: data.gamification.current_streak || 0,
            totalQuestions: data.gamification.total_ai_chats || 0,  // AI Chats (messages)
            totalFlashcards: data.gamification.total_flashcards_created || 0,  // Flashcard SETS created
            totalNotes: data.gamification.total_notes_created || 0,
            totalChatSessions: data.gamification.total_chat_sessions || 0,  // Actual session count
            minutes: data.gamification.total_study_minutes || 0
          });
          
          setTotalQuestions(data.gamification.total_ai_chats || 0);
          
          // Set current (existing) questions and sessions for AI widget
          setCurrentQuestions(data.gamification.current_messages || data.gamification.total_chat_sessions || 0);
          setCurrentSessions(data.gamification.total_chat_sessions || 0);
        }
        
        setRecentActivities(data.recent_activities || []);
        setMotivationalQuote(data.motivational_quote || 'Keep learning every day!');
        setRandomQuote(data.random_quote || 'Every expert was once a beginner.');
        setAchievements(data.achievements || []);
        setLearningAnalytics(data.learning_analytics || null);
        setConversationStarters(data.conversation_starters || []);
        setLearningReviews(data.learning_reviews || []);
      }
    } catch (error) {
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
    const greetings = {
      morning: ['Good morning', 'Rise and shine', 'Hello there', 'Welcome back', 'Great to see you'],
      afternoon: ['Good afternoon', 'Hello', 'Welcome back', 'Great to see you', 'Hey there'],
      evening: ['Good evening', 'Welcome back', 'Hello', 'Hey there', 'Great to see you']
    };
    
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
    
    if (hour < 12) {
      return greetings.morning[dayOfYear % greetings.morning.length];
    }
    if (hour < 18) {
      return greetings.afternoon[dayOfYear % greetings.afternoon.length];
    }
    return greetings.evening[dayOfYear % greetings.evening.length];
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

  const handleCustomize = () => {
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
      "Education is the most powerful weapon which you can use to change the world.",
      "The capacity to learn is a gift; the ability to learn is a skill; the willingness to learn is a choice.",
      "Live as if you were to die tomorrow. Learn as if you were to live forever.",
      "An investment in knowledge pays the best interest.",
      "The more that you read, the more things you will know. The more that you learn, the more places you'll go.",
      "Learning is not attained by chance, it must be sought for with ardor and attended to with diligence.",
      "The mind is not a vessel to be filled, but a fire to be kindled.",
      "Education is the passport to the future, for tomorrow belongs to those who prepare for it today.",
      "The roots of education are bitter, but the fruit is sweet.",
      "Develop a passion for learning. If you do, you will never cease to grow.",
      "The only person who is educated is the one who has learned how to learn and change.",
      "Learning is a treasure that will follow its owner everywhere.",
      "Knowledge is power. Information is liberating. Education is the premise of progress.",
      "The beautiful thing about learning is nobody can take it away from you.",
      "Study hard what interests you the most in the most undisciplined, irreverent and original manner possible.",
      "Intelligence plus character—that is the goal of true education.",
      "The function of education is to teach one to think intensively and to think critically.",
      "Anyone who stops learning is old, whether at twenty or eighty.",
      "Tell me and I forget. Teach me and I remember. Involve me and I learn.",
      "The expert in anything was once a beginner who refused to give up.",
      "Learning is the only thing the mind never exhausts, never fears, and never regrets."
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
    let isFirstMonth = true;
    
    weeks.forEach((week, weekIndex) => {
      const firstValidDay = week.find(day => day !== null);
      if (firstValidDay) {
        const date = new Date(firstValidDay.date);
        const month = date.getMonth();
        
        // Add label when month changes, but skip the very first month
        if (month !== currentMonth) {
          if (!isFirstMonth) {
            labels.push({ month: getMonthName(month), position: weekIndex * 18 });
          }
          currentMonth = month;
          isFirstMonth = false;
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
          } finally {
      if (timeIntervalRef.current) clearInterval(timeIntervalRef.current);
      if (sessionUpdateRef.current) clearInterval(sessionUpdateRef.current);
      if (window.dashboardTimeTrackingCleanup) window.dashboardTimeTrackingCleanup();
    }
  };

  const startTour = () => setShowTour(true);
  const closeTour = () => {
    setShowTour(false);
    setHasSeenTour(true);
  };
  const completeTour = () => {
    setShowTour(false);
    setHasSeenTour(true);
  };

  const checkIfFirstTimeUserForNotification = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/is_first_time_user?user_id=${userName}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        const isFirstTimeUser = data.is_first_time;
        
        // Get user's first name from profile, fallback to username
        const displayName = userProfile?.firstName || userName.split('@')[0];
        
        // Different message for first-time vs returning users
        const welcomeNotif = {
          id: `welcome-${Date.now()}`,
          title: isFirstTimeUser ? 'Welcome!' : 'Welcome Back!',
          message: isFirstTimeUser 
            ? `Let's get started with your learning journey, ${displayName}!`
            : `Ready to continue learning, ${displayName}?`,
          type: 'welcome',
          created_at: new Date().toISOString()
        };
        
        // For first-time users, show notification after tour completes
        // For returning users, show immediately
        const delay = isFirstTimeUser ? 3000 : 1500;
        
        setTimeout(() => {
          setSlideNotifQueue(prev => {
            if (!prev.some(n => n.type === 'welcome')) {
              return [...prev, welcomeNotif];
            }
            return prev;
          });
        }, delay);
      }
    } catch (error) {
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
        // Ensure we have valid data (7 days)
        const validWeeklyProgress = weeklyProgress && weeklyProgress.length === 7 ? weeklyProgress : [0, 0, 0, 0, 0, 0, 0];
        const maxWeeklyValue = Math.max(...validWeeklyProgress, 1);
        
        // Round to nearest multiple of 10
        const roundToTen = (num) => Math.ceil(num / 10) * 10;
        const maxRounded = roundToTen(maxWeeklyValue);
        
        // Create evenly spaced Y-axis labels (4 steps including 0)
        const step = maxRounded / 3;
        const yAxisSteps = [
          maxRounded,
          Math.round(step * 2 / 10) * 10,
          Math.round(step / 10) * 10,
          0
        ];
        
        // Calculate Y positions for each step (evenly spaced)
        const getYPosition = (value) => {
          return 100 - (value / maxRounded) * 70;
        };
        
        return (
          <div className="stats-overview-widget">
            <div className="widget-header">
              <h3 className="widget-title">weekly activity</h3>
            </div>
            <div className="stats-line-container">
              <div className="stats-graph-section">
                <div className="line-chart-wrapper">
                  <svg viewBox="0 0 300 120" className="stats-line-chart" preserveAspectRatio="xMidYMid meet">
                    {/* Y-axis reference numbers and grid lines */}
                    {yAxisSteps.map((value, i) => {
                      const y = getYPosition(value);
                      return (
                        <g key={i}>
                          <text x="5" y={y + 4} fontSize="10" fill={textSecondary} opacity="0.6">{value}</text>
                          <line 
                            x1="40" 
                            y1={y} 
                            x2="290" 
                            y2={y} 
                            stroke={textSecondary} 
                            strokeOpacity={i === 3 ? "0.3" : "0.15"} 
                            strokeDasharray="4,4"
                          />
                        </g>
                      );
                    })}
                    
                    {/* Area fill */}
                    <path
                      d={`M 40 100 ${validWeeklyProgress.map((val, i) => {
                        const x = 40 + (i * 41.67);
                        const y = 100 - (val / maxRounded) * 70;
                        return `L ${x} ${y}`;
                      }).join(' ')} L ${40 + 6 * 41.67} 100 Z`}
                      fill={`url(#areaGradient-${widget.id})`}
                    />
                    
                    {/* Line */}
                    <path
                      d={`M ${validWeeklyProgress.map((val, i) => {
                        const x = 40 + (i * 41.67);
                        const y = 100 - (val / maxRounded) * 70;
                        return `${i === 0 ? '' : 'L '}${x} ${y}`;
                      }).join(' ')}`}
                      fill="none"
                      stroke={accent}
                      strokeWidth="2"
                    />
                    
                    {/* Data points */}
                    {validWeeklyProgress.map((val, i) => {
                      const x = 40 + (i * 41.67);
                      const y = 100 - (val / maxRounded) * 70;
                      return (
                        <circle key={i} cx={x} cy={y} r="4" fill={accent} stroke={bgTop} strokeWidth="2" />
                      );
                    })}
                    
                    {/* Day labels directly in SVG for perfect alignment */}
                    {dayLabels.map((day, i) => {
                      const x = 40 + (i * 41.67);
                      return (
                        <text key={i} x={x} y="115" fontSize="10" fill={textSecondary} textAnchor="middle">{day}</text>
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
            <div className="widget-footer">
              <button className="analytics-btn" onClick={() => !isCustomizing && navigate('/analytics')} disabled={isCustomizing}>
                <span>Analytics</span>
                <ChevronRight size={16} />
              </button>
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
                <span className="ai-stat-value">{currentQuestions}</span>
                <span className="ai-stat-label">questions</span>
              </div>
              <div className="ai-stat">
                <span className="ai-stat-value">{currentSessions}</span>
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
                onClick={!isCustomizing ? (() => navigate('/learning-review')) : undefined}
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
      <aside className="dashboard-minimal-sidebar">
        <div className="sidebar-brand-empty"></div>

        <nav className="sidebar-navigation">
          <button className="sidebar-nav-btn active">
            <Home size={20}/>
            <span>Dashboard</span>
          </button>
          <button className="sidebar-nav-btn" onClick={() => navigate('/ai')}>
            <Brain size={20}/>
            <span>AI Chat</span>
          </button>
          <button className="sidebar-nav-btn" onClick={() => navigate('/flashcards')}>
            <BookOpen size={20}/>
            <span>Flashcards</span>
          </button>
          <button className="sidebar-nav-btn" onClick={() => navigate('/notes')}>
            <FileText size={20}/>
            <span>Notes</span>
          </button>
          <button className="sidebar-nav-btn" onClick={() => navigate('/concept-web')}>
            <Network size={20}/>
            <span>Concepts</span>
          </button>
          <button className="sidebar-nav-btn" onClick={() => navigate('/social')}>
            <Users size={20}/>
            <span>Social</span>
          </button>
        </nav>

        <div className="sidebar-footer-section">
          <button className="sidebar-nav-btn" onClick={() => navigate('/profile')}>
            <User size={20}/>
            <span>Profile</span>
          </button>
          <button className="sidebar-nav-btn" onClick={handleCustomize}>
            <Settings size={20}/>
            <span>Customize</span>
          </button>
          <button className="sidebar-nav-btn sidebar-logout-btn" onClick={handleLogout}>
            <LogOut size={20}/>
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <div className="dashboard-main-content">
        <header className="dashboard-header">
          <div className="header-content">
            <div className="header-left">
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
              
              <ThemeSwitcher />
              
              <button className="dashboard-profile-icon-btn" onClick={openProfile} title="Profile">
                <User size={20} />
              </button>
            </div>
            
            <div className="header-right">
              <button
                className="dashboard-search-hub-btn"
                onClick={() => navigate('/search-hub')}
                title="Go to Search Hub"
              >
                <Search size={14} />
                SEARCH HUB
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
              <button className="dashboard-logout-btn" onClick={handleLogout}>LOGOUT</button>
            </div>
          </div>
        </header>

        <main className="dashboard-main">
          {/* HERO SECTION - MASSIVE CENTERED LOGO LIKE THE HEART */}
          <div className="dashboard-hero-center">
            <div className="hero-content-wrapper">
              <div className="hero-greeting-section">
                <h2 className="greeting-text">Hey there, {displayName}</h2>
                <p className="greeting-quote">{randomQuote || "Every expert was once a beginner."}</p>
              </div>

              <div className="hero-logo-section">
                <div className="logo-container-main">
                  <svg className="cerbyl-logo-svg" viewBox="0 0 1920 1920" xmlns="http://www.w3.org/2000/svg">
                    <path d="M0 0 C5.66406926 0.71784982 11.33040098 1.4174704 16.9964962 2.1191082 C28.74384291 3.57445803 40.48927109 5.04477612 52.23364258 6.52392578 C69.98736578 8.75941024 87.74466567 10.96121746 105.51202393 13.08575439 C107.57126461 13.33199 109.63046481 13.57856428 111.68963623 13.82537842 C181.41752005 22.82609578 181.41752005 22.82609578 251.51098633 27.66455078 C252.71698486 27.7009668 253.9229834 27.73738281 255.16552734 27.77490234 C257.44692505 27.83665024 259.72873335 27.88548094 262.01074219 27.91748047 C272.65247648 28.17130639 282.96893265 30.0117926 292.48754883 34.93408203 C293.15383301 35.27375 293.82011719 35.61341797 294.5065918 35.96337891 C310.80616709 44.71996185 321.26421369 59.93695525 326.88208008 77.30126953 C331.45068766 95.24702305 329.0651648 114.9352315 320.42114258 131.14501953 C312.73594071 143.80830715 299.71178795 153.32419818 285.42504883 157.43408203 C267.38113039 160.82618859 248.20564715 159.72217764 229.93115234 159.91088867 C213.99198169 160.082565 198.27113652 160.68462143 182.42504883 162.43408203 C181.00951965 162.58189982 179.59391493 162.72899658 178.17822266 162.87524414 C137.59945983 167.19890034 98.06911463 175.60717709 58.67504883 186.12158203 C57.81740936 186.34969574 56.9597699 186.57780945 56.07614136 186.81283569 C46.47722631 189.37592946 37.00458483 192.14065981 27.60180664 195.35131836 C14.77556909 199.72300323 1.58286615 203.213158 -11.57495117 206.43408203 C-12.59588867 206.68416016 -13.61682617 206.93423828 -14.66870117 207.19189453 C-38.1751539 211.98775127 -62.60976595 208.05320573 -82.63037109 194.93896484 C-97.73499868 184.65370438 -106.059211 168.95154325 -110.07495117 151.35986328 C-110.88148597 146.6403745 -110.92136754 142.20051472 -110.57495117 137.43408203 C-110.5053418 136.34224609 -110.43573242 135.25041016 -110.36401367 134.12548828 C-109.11423714 121.66938217 -104.00443212 109.73519471 -94.28588867 101.49267578 C-79.185803 91.01351934 -61.92898913 85.77220108 -43.46557617 88.97314453 C-40.75948821 89.65340421 -38.18949077 90.46260528 -35.57495117 91.43408203 C-34.86983398 91.68931641 -34.1647168 91.94455078 -33.43823242 92.20751953 C-24.15802565 96.1821464 -17.78245397 104.26253336 -13.59448242 113.21533203 C-11.88523485 118.61157723 -12.08814351 123.84480887 -12.57495117 129.43408203 C-21.03472305 133.30140632 -28.33689819 133.91958555 -37.57495117 133.43408203 C-38.66223091 130.17224281 -38.5462772 128.03419529 -38.38745117 124.62158203 C-38.382862 120.81257229 -38.52010163 118.57120588 -39.94995117 114.99658203 C-45.14770082 109.92258833 -50.82499084 107.16002884 -58.13745117 106.93408203 C-66.3788158 107.38677671 -72.65039979 109.56875373 -78.71557617 115.27001953 C-86.21851753 124.00243447 -88.42151023 133.18694029 -87.57495117 144.43408203 C-86.88060004 147.90583771 -85.84666936 151.13314394 -84.57495117 154.43408203 C-84.19209961 155.44921875 -84.19209961 155.44921875 -83.80151367 156.48486328 C-79.62104232 166.05392385 -71.5704682 173.43131204 -62.57495117 178.43408203 C-61.90206055 178.81177734 -61.22916992 179.18947266 -60.53588867 179.57861328 C-45.32034058 187.18638733 -27.3512738 187.00282547 -11.46362305 181.73388672 C6.82004703 174.94793074 20.89054409 163.19728567 29.42504883 145.43408203 C39.54458082 121.78302394 39.66411737 97.3013561 30.98754883 73.15673828 C21.63020986 50.01579278 5.18900859 35.42420837 -17.57495117 25.43408203 C-57.7090625 9.75286637 -102.30509075 21.40274164 -140.25537109 37.64257812 C-158.74263357 45.7835267 -175.27198496 56.59240049 -191.57495117 68.43408203 C-192.17952148 68.86994629 -192.7840918 69.30581055 -193.40698242 69.75488281 C-204.61717471 77.85819305 -214.99713265 86.86393887 -225.10400391 96.2890625 C-227.87987159 98.87759645 -230.67457446 101.42321208 -233.57495117 103.87158203 C-248.6720631 116.7670318 -262.00597547 133.36218374 -273.57495117 149.43408203 C-274.03369629 150.06685059 -274.49244141 150.69961914 -274.96508789 151.3515625 C-296.56468276 181.21213003 -313.83271517 213.06591109 -324.57495117 248.43408203 C-324.79989258 249.16836426 -325.02483398 249.90264648 -325.2565918 250.65917969 C-326.83617998 255.88351252 -328.23702555 261.14319436 -329.57495117 266.43408203 C-329.81600586 267.36800781 -330.05706055 268.30193359 -330.30541992 269.26416016 C-343.52553209 321.30576923 -343.56855731 377.19245864 -331.57495117 429.43408203 C-331.34404785 430.44841309 -331.11314453 431.46274414 -330.87524414 432.5078125 C-322.01384515 470.90720813 -306.6314001 507.69687324 -284.57495117 540.43408203 C-284.13795898 541.08344727 -283.7009668 541.7328125 -283.25073242 542.40185547 C-278.01189035 550.11101308 -272.31260171 557.31460225 -266.21557617 564.35986328 C-263.82633294 567.12124404 -261.53958361 569.95423265 -259.26245117 572.80908203 C-245.76512755 589.32176518 -230.29970593 604.2242826 -213.57495117 617.43408203 C-212.35509078 618.42099237 -211.13641905 619.40937308 -209.91870117 620.39892578 C-208.61680773 621.45254588 -207.31472551 622.50593276 -206.01245117 623.55908203 C-205.42326904 624.03821045 -204.83408691 624.51733887 -204.22705078 625.01098633 C-187.79685821 638.21144673 -169.39062915 649.31419192 -150.82348633 659.22314453 C-148.5529653 660.44592241 -146.30421796 661.70311897 -144.05541992 662.96533203 C-127.23331567 672.2557175 -109.41063372 679.35533894 -91.57495117 686.43408203 C-90.39787598 686.90152832 -89.22080078 687.36897461 -88.00805664 687.85058594 C-70.91984219 694.5370531 -53.39400354 699.19566881 -35.57495117 703.43408203 C-34.35855957 703.72444336 -33.14216797 704.01480469 -31.88891602 704.31396484 C13.67602982 715.07968444 63.11881811 720.92227864 105.42504883 696.43408203 C122.43690282 685.91965873 134.18377173 671.75690602 139.73364258 652.46923828 C144.53730505 631.3819742 141.58654428 608.29284617 130.67504883 589.62158203 C119.78488843 572.92198663 102.65033649 562.81525703 83.42504883 558.43408203 C60.5043791 554.23195925 36.61755576 559.50735013 17.42504883 572.43408203 C7.29216784 579.59622743 0.42984137 587.63610697 -5.57495117 598.43408203 C-6.00163086 599.13919922 -6.42831055 599.84431641 -6.86791992 600.57080078 C-7.95312445 602.48757966 -8.77791751 604.38033018 -9.57495117 606.43408203 C-9.94491211 607.33384766 -10.31487305 608.23361328 -10.69604492 609.16064453 C-13.81870987 618.38817347 -13.97899451 627.54161806 -14.01245117 637.18408203 C-14.02157532 638.18702805 -14.02157532 638.18702805 -14.03088379 639.2102356 C-14.10110526 651.0333227 -12.04905931 660.89538188 -7.19995117 671.62158203 C-6.89758545 672.30430176 -6.59521973 672.98702148 -6.28369141 673.69042969 C-4.08654632 678.55400172 -1.5164483 682.9772682 1.42504883 687.43408203 C1.42504883 688.09408203 1.42504883 688.75408203 1.42504883 689.43408203 C-45.91220137 688.37572888 -96.31636472 657.53280326 -130.08666992 626.70361328 C-131.70258481 625.22975685 -133.32966351 623.76801453 -134.96948242 622.32080078 C-144.81434821 613.6210567 -154.1862063 604.53326873 -162.34838867 594.21923828 C-164.32692586 591.74433123 -166.37143713 589.34510814 -168.45239258 586.95629883 C-189.89732589 562.19659371 -207.09422055 533.19401748 -220.65014648 503.44824219 C-221.54384497 501.50182916 -222.45718511 499.56622829 -223.37963867 497.63330078 C-238.57495117 465.73781587 -238.57495117 465.73781587 -238.57495117 455.43408203 C-235.56813317 456.77407701 -233.57732508 458.23253495 -231.32495117 460.62158203 C-228.83479885 463.19154693 -226.29021919 465.60295077 -223.57495117 467.93408203 C-221.06823977 470.08813822 -218.72243947 472.2859788 -216.44995117 474.68408203 C-195.61710194 495.80037139 -167.43584618 511.46400847 -140.57495117 523.43408203 C-139.59268555 523.8783252 -139.59268555 523.8783252 -138.59057617 524.33154297 C-84.47494527 548.60240343 -21.90507026 552.34021633 36.42504883 545.43408203 C37.5678833 545.30783447 38.71071777 545.18158691 39.88818359 545.05151367 C51.34317111 543.71940376 62.65004442 541.71473585 73.98754883 539.62158203 C74.96425537 539.44223114 75.94096191 539.26288025 76.94726562 539.07809448 C91.16827836 536.46350992 105.36331277 533.81701248 119.42504883 530.43408203 C120.06448425 530.28046204 120.70391968 530.12684204 121.36273193 529.96856689 C139.98231421 525.4865848 158.50877514 520.78125971 176.83862305 515.21630859 C179.30259001 514.47111791 181.77074236 513.7424858 184.24145508 513.02001953 C210.86166845 505.2044325 237.11368933 496.23251112 263.32574463 487.16052246 C266.70084821 485.99260611 270.0766014 484.82657168 273.45239258 483.66064453 C274.40729332 483.33082329 274.40729332 483.33082329 275.38148499 482.99433899 C281.72768879 480.80277994 288.07551695 478.61597916 294.42504883 476.43408203 C295.34672852 476.11681152 296.2684082 475.79954102 297.21801758 475.47265625 C318.04349504 468.32472857 340.65482026 461.48736902 361.97973633 471.19970703 C362.78668945 471.60705078 363.59364258 472.01439453 364.42504883 472.43408203 C365.35575195 472.88267578 366.28645508 473.33126953 367.24536133 473.79345703 C383.1461544 482.17977609 393.76051763 495.87858585 399.92504883 512.55908203 C404.85598458 530.34099635 401.29544182 547.86811442 392.51733398 563.58642578 C385.98729248 574.63232522 376.73026016 582.31646927 365.76733398 588.66357422 C360.0962088 591.96308768 354.66948952 595.56906936 349.23754883 599.24658203 C340.02994938 605.45202864 330.62088627 611.2152474 321.06420898 616.86279297 C316.26389583 619.72077775 311.50407956 622.64524285 306.73754883 625.55908203 C289.55681404 636.02792923 272.14579247 645.98454278 254.53491211 655.7109375 C251.89735396 657.17238242 249.26616422 658.64389939 246.63989258 660.12548828 C233.41694353 667.57573759 219.93722742 674.52528455 206.42504883 681.43408203 C205.43359863 681.94148926 204.44214844 682.44889648 203.4206543 682.97167969 C137.58995096 716.55969611 70.35356643 742.04142975 -4.38745117 741.68408203 C-5.5272644 741.68131256 -6.66707764 741.67854309 -7.84143066 741.6756897 C-24.174 741.62917488 -40.33543983 741.30382036 -56.57495117 739.43408203 C-58.48898164 739.23715585 -60.40304481 739.04054733 -62.31713867 738.84423828 C-88.52499035 735.99873951 -114.19636862 730.45943535 -139.57495117 723.43408203 C-141.05257696 723.03605905 -142.5304113 722.63880866 -144.00854492 722.24267578 C-149.8037483 720.65195795 -155.30043094 718.77492505 -160.86425781 716.51586914 C-163.55900547 715.44044566 -166.2685277 714.42400618 -168.99291992 713.42626953 C-189.16034721 706.03880589 -208.8155388 697.93250902 -227.57495117 687.43408203 C-228.28973633 687.0420459 -229.00452148 686.65000977 -229.7409668 686.24609375 C-249.23518811 675.53625267 -267.95628859 663.24636825 -284.57495117 648.43408203 C-286.401455 646.94649039 -288.2347375 645.46718014 -290.07495117 643.99658203 C-299.72543611 636.11348241 -308.67142157 627.64844718 -316.96557617 618.35205078 C-318.64019262 616.47938838 -320.33653169 614.62580083 -322.05932617 612.79736328 C-359.70857838 572.69011849 -384.85680299 518.87398857 -396.57495117 465.43408203 C-396.72673828 464.76022461 -396.87852539 464.08636719 -397.03491211 463.39208984 C-418.72645956 365.42071473 -396.26701008 262.6833254 -341.57495117 173.43408203 C-329.80701991 155.21486063 -315.93532979 138.64741273 -301.57495117 122.43408203 C-300.99487305 121.76119141 -300.41479492 121.08830078 -299.81713867 120.39501953 C-289.16478868 108.23880836 -277.72080732 96.25757308 -264.95385742 86.31689453 C-262.50290011 84.37705639 -260.23662666 82.3142405 -257.94995117 80.18408203 C-251.5935947 74.40830615 -244.74294405 69.30304959 -237.87231445 64.16210938 C-235.6132476 62.46288778 -233.37258684 60.74159991 -231.13354492 59.01611328 C-219.43108096 50.09074085 -207.10817315 42.48391219 -194.39331055 35.08789062 C-191.75470865 33.53956342 -189.14702693 31.94850606 -186.53979492 30.34814453 C-129.19860482 -4.0508781 -64.64782354 -8.23966692 0 0 Z" fill="currentColor" transform="translate(957.574951171875,542.56591796875)"/>
                    <path d="M0 0 C11.41902627 8.96070661 19.34516176 19.94210974 24.55078125 33.5234375 C24.89109375 34.40773438 25.23140625 35.29203125 25.58203125 36.203125 C31.04983795 53.66972973 28.46692449 74.17922511 20.36328125 90.2734375 C10.14004996 107.93174609 -4.75974129 119.6639503 -24.19921875 125.8984375 C-44.33164146 130.82798133 -65.87034119 128.18029312 -83.74072266 117.61425781 C-97.74454629 108.67326267 -107.5108324 96.01653521 -113.44921875 80.5234375 C-113.78953125 79.63914062 -114.12984375 78.75484375 -114.48046875 77.84375 C-119.9304151 60.43419917 -117.35657197 39.99141034 -109.38671875 23.8984375 C-99.19774063 6.23609377 -84.19900165 -5.62730144 -64.69921875 -11.8515625 C-42.60267489 -17.26203312 -18.41734571 -13.65757211 0 0 Z M-90.44921875 9.5234375 C-91.04734375 10.03003906 -91.64546875 10.53664063 -92.26171875 11.05859375 C-103.90422958 21.63560694 -110.40258061 37.92946385 -111.6875 53.390625 C-112.10622672 70.36007624 -106.678554 87.20449633 -95.19921875 99.8984375 C-81.51624153 114.26380484 -64.35757002 122.25709464 -44.44921875 122.8984375 C-27.10747459 122.2956496 -11.36512388 116.17466025 1.55078125 104.5234375 C2.14890625 104.01683594 2.74703125 103.51023437 3.36328125 102.98828125 C15.00579208 92.41126806 21.50414311 76.11741115 22.7890625 60.65625 C23.20778922 43.68679876 17.7801165 26.84237867 6.30078125 14.1484375 C-7.38219597 -0.21692984 -24.54086748 -8.21021964 -44.44921875 -8.8515625 C-61.79096291 -8.2487746 -77.53331362 -2.12778525 -90.44921875 9.5234375 Z" fill="currentColor" transform="translate(1067.44921875,1117.4765625)"/>
                  </svg>
                </div>
                <h1 className="cerbyl-brand-text">cerbyl</h1>
              </div>

              <div className="bento-features-grid">
                <div className="bento-card bento-large" onClick={() => !isCustomizing && navigate('/ai')}>
                  <div className="bento-icon-wrapper">
                    <Brain size={40} />
                  </div>
                  <div className="bento-content">
                    <h3>AI Chat</h3>
                    <p>Intelligent tutoring</p>
                    <div className="bento-stat">{stats.totalChatSessions} sessions</div>
                  </div>
                </div>

                <div className="bento-card bento-medium" onClick={() => !isCustomizing && navigate('/flashcards')}>
                  <div className="bento-icon-wrapper">
                    <BookOpen size={32} />
                  </div>
                  <div className="bento-content">
                    <h3>Flashcards</h3>
                    <p>Master concepts</p>
                    <div className="bento-stat">{stats.totalFlashcards} created</div>
                  </div>
                </div>

                <div className="bento-card bento-medium" onClick={() => !isCustomizing && navigate('/notes')}>
                  <div className="bento-icon-wrapper">
                    <FileText size={32} />
                  </div>
                  <div className="bento-content">
                    <h3>Notes</h3>
                    <p>Organize learning</p>
                    <div className="bento-stat">{stats.totalNotes} written</div>
                  </div>
                </div>

                <div className="bento-card bento-small" onClick={() => !isCustomizing && navigate('/concept-web')}>
                  <div className="bento-icon-wrapper">
                    <Network size={28} />
                  </div>
                  <div className="bento-content">
                    <h3>Slide Explorer</h3>
                    <p>Visualize connections</p>
                  </div>
                </div>

                <div className="bento-card bento-small" onClick={() => !isCustomizing && navigate('/ai')}>
                  <div className="bento-icon-wrapper">
                    <HelpCircle size={28} />
                  </div>
                  <div className="bento-content">
                    <h3>Question Bank</h3>
                    <p>{stats.totalQuestions} answered</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          </div>

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
    </div>
  );
};

export default Dashboard;
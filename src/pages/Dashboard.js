import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatToLocalTime, getRelativeTime } from '../utils/dateUtils';
import { HelpTour, HelpButton } from './HelpTour';
import {
  CheckCircle, XCircle, Clock, Plus, Users, Bell, Calendar as CalendarIcon, BookOpen, Zap,
  MessageSquare, HelpCircle, FileText, Network, ChevronRight, Search, User, Home,
  Brain, Target, Flame, Settings, LogOut, Sparkles, TrendingUp, Layers, Trophy
, Menu} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { rgbaFromHex } from '../utils/ThemeManager';
import ThemeSwitcher from '../components/ThemeSwitcher';
import LoadingSpinner from '../components/LoadingSpinner';
import SlideNotification from '../components/SlideNotification';
import ImportExportModal from '../components/ImportExportModal';
import './Dashboard.css';
import { API_URL } from '../config';
import logo from '../assets/logo.svg';

// Default layout configuration (same as CustomizeDashboard)
const DEFAULT_LAYOUT_WIDGETS = [
  { id: 'ai-tutor', col: 1, row: 1, cols: 1, rows: 3, color: null, size: 'M' },
  { id: 'learning-hub-grid', col: 2, row: 1, cols: 2, rows: 3, color: null, size: 'L' },
  { id: 'social-hub', col: 4, row: 1, cols: 1, rows: 2, color: null, size: 'M' },
  { id: 'activity', col: 4, row: 3, cols: 1, rows: 2, color: null, size: 'M' },
  { id: 'concept-web', col: 4, row: 5, cols: 1, rows: 1, color: null, size: 'S' },
  { id: 'streak', col: 1, row: 4, cols: 1, rows: 2, color: null, size: 'M' },
  { id: 'notes', col: 2, row: 4, cols: 1, rows: 2, color: null, size: 'M' },
  { id: 'flashcards', col: 3, row: 4, cols: 1, rows: 2, color: null, size: 'M' },
  { id: 'heatmap', col: 1, row: 6, cols: 4, rows: 2, color: null, size: 'L' }
];

// Random greeting messages
const GREETING_MESSAGES = [
  "Ready to Learn?",
  "Let's Get Started",
  "Time to Shine",
  "Your Learning Journey",
  "Explore & Discover",
  "Knowledge Awaits",
  "Start Something New",
  "Level Up Today",
  "Master New Skills",
  "Unlock Your Potential",
  "Learn Something Amazing",
  "Your Study Hub",
  "Dive Into Learning",
  "Expand Your Mind",
  "Build Your Future",
  "Grow Every Day",
  "Challenge Yourself",
  "Discover More",
  "Keep Learning",
  "Stay Curious"
];

const getRandomGreeting = () => {
  return GREETING_MESSAGES[Math.floor(Math.random() * GREETING_MESSAGES.length)];
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

  // Layout state - load from localStorage
  const [dashboardLayout, setDashboardLayout] = useState(DEFAULT_LAYOUT_WIDGETS);

  const [heatmapData, setHeatmapData] = useState([]);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [currentQuestions, setCurrentQuestions] = useState(0);
  const [currentSessions, setCurrentSessions] = useState(0);
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

  const [isLoaded, setIsLoaded] = useState(false);

  const timeIntervalRef = useRef(null);
  const sessionUpdateRef = useRef(null);
  const lastActivityRef = useRef(Date.now());

  useEffect(() => {
    const token = localStorage.getItem('token');
    const username = localStorage.getItem('username');
    const profile = localStorage.getItem('userProfile');

    if (!token) {
      window.location.href = '/login';
      return;
    }
    
    if (token && username) {
      sessionStorage.setItem('safetyAccepted', 'true');
    }

    if (username) setUserName(username);

    if (profile) {
      try {
        setUserProfile(JSON.parse(profile));
      } catch (error) {}
    }

    // Load saved dashboard layout from localStorage
    try {
      const LAYOUT_VERSION = '2.1'; // Increment this to force layout reset
      const savedVersion = localStorage.getItem('dashboardLayoutVersion');
      const layoutName = localStorage.getItem('currentLayoutName') || 'Default';
      
      // Force reset to new layout if version changed
      if (savedVersion !== LAYOUT_VERSION) {
        localStorage.setItem('dashboardLayoutVersion', LAYOUT_VERSION);
        localStorage.setItem('currentLayoutName', 'Default');
        setDashboardLayout(DEFAULT_LAYOUT_WIDGETS);
      }
      // For Default layout, always use the hardcoded DEFAULT_LAYOUT_WIDGETS
      else if (layoutName === 'Default') {
        setDashboardLayout(DEFAULT_LAYOUT_WIDGETS);
      } else {
        const savedLayout = localStorage.getItem('currentDashboardLayout');
        if (savedLayout) {
          const layout = JSON.parse(savedLayout);
          if (layout.widgets && Array.isArray(layout.widgets)) {
            setDashboardLayout(layout.widgets);
          }
        }
      }
    } catch (error) {
      console.error('Error loading dashboard layout:', error);
    }

    setTimeout(() => setIsLoaded(true), 100);
  }, []);

  useEffect(() => {
    if (userName) {
      const justCompletedOnboarding = sessionStorage.getItem('justCompletedOnboarding') === 'true';
      const justLoggedIn = sessionStorage.getItem('justLoggedIn');
      
      if (justCompletedOnboarding && justLoggedIn) {
        sessionStorage.removeItem('justCompletedOnboarding');
        setHasSeenTour(false);
        setTimeout(() => {
          setShowTour(true);
        }, 1000);
      } else {
        setHasSeenTour(true);
      }
    }
  }, [userName]);

  useEffect(() => {
    if (userName) {
      loadUserStats();
      loadHeatmapData();
      loadDashboardData();
      startDashboardSession();
      startNotificationPolling();
      
      const justLoggedIn = sessionStorage.getItem('justLoggedIn');
      const today = new Date().toDateString();
      const lastLoginDate = localStorage.getItem(`lastLoginDate_${userName}`);
      const isFirstLoginToday = lastLoginDate !== today;
      
      // Check if study insights is enabled in user profile
      const profile = localStorage.getItem('userProfile');
      let showStudyInsights = true;
      if (profile) {
        try {
          const parsed = JSON.parse(profile);
          showStudyInsights = parsed.showStudyInsights !== false;
        } catch (e) {}
      }
      
      if (justLoggedIn && isFirstLoginToday) {
        localStorage.setItem(`lastLoginDate_${userName}`, today);
        sessionStorage.removeItem('justLoggedIn');
        
        // Check if user just completed onboarding
        const isFirstTimeUser = sessionStorage.getItem('isFirstTimeUser') === 'true';
        sessionStorage.removeItem('isFirstTimeUser');
        
        // Get display name
        const welcomeName = userProfile?.firstName || userProfile?.first_name || userName.split('@')[0];
        
        // For returning users, fetch personalized welcome notification
        if (!isFirstTimeUser && showStudyInsights) {
          fetchPersonalizedWelcome(welcomeName);
        } else if (!isFirstTimeUser && !showStudyInsights) {
          // Show simple welcome without study insights - create in database
          createWelcomeNotification(welcomeName, 'Welcome Back!', `Ready to continue learning, ${welcomeName}?`);
        } else {
          // For first-time users, show simple welcome - create in database
          createWelcomeNotification(welcomeName, 'Welcome!', `Let's get started with your learning journey, ${welcomeName}!`);
        }
      }
    }
    
    return () => {
      if (notificationPollRef.current) clearInterval(notificationPollRef.current);
      if (timeIntervalRef.current) clearInterval(timeIntervalRef.current);
      if (sessionUpdateRef.current) clearInterval(sessionUpdateRef.current);
    };
  }, [userName]);

  // Click outside handler for notifications
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showNotifications) {
        const notifPanel = document.querySelector('.ds-notif-panel');
        const notifButton = document.querySelector('.ds-notif-bell-btn');
        
        if (notifPanel && !notifPanel.contains(event.target) && 
            notifButton && !notifButton.contains(event.target)) {
          setShowNotifications(false);
        }
      }
    };

    if (showNotifications) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotifications]);

  const fetchPersonalizedWelcome = async (displayName) => {
    try {
      const token = localStorage.getItem('token');
      
      // First, create the notification in the database
      const createResponse = await fetch(`${API_URL}/create_notification`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: userName,
          title: 'Welcome Back!',
          message: `Ready to continue learning, ${displayName}?`,
          notification_type: 'welcome'
        })
      });
      
      if (createResponse.ok) {
        const createData = await createResponse.json();
        console.log('✅ Welcome notification created in DB:', createData);
        
        // Now fetch study insights if available
        const insightsResponse = await fetch(`${API_URL}/study_insights/welcome_notification?user_id=${userName}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (insightsResponse.ok) {
          const insightsData = await insightsResponse.json();
          const notifData = insightsData.notification;
          
          if (notifData.has_insights) {
            // Update the notification with insights
            await fetch(`${API_URL}/create_notification`, {
              method: 'POST',
              headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                user_id: userName,
                title: notifData.title || 'Study Insights',
                message: notifData.message,
                notification_type: 'study_insights'
              })
            });
          }
        }
        
        // Trigger a notification poll to show the new notification
        setTimeout(() => {
          if (notificationPollRef.current) {
            clearInterval(notificationPollRef.current);
          }
          startNotificationPolling();
        }, 1000);
      }
    } catch (error) {
      console.error('❌ Error creating welcome notification:', error);
      // Fallback: create simple notification
      createWelcomeNotification(displayName, 'Welcome Back!', `Ready to continue learning, ${displayName}?`);
    }
  };

  const createWelcomeNotification = async (displayName, title, message) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/create_notification`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: userName,
          title: title,
          message: message,
          notification_type: 'welcome'
        })
      });
      
      if (response.ok) {
        console.log('✅ Welcome notification created');
        // Trigger notification poll
        setTimeout(() => {
          if (notificationPollRef.current) {
            clearInterval(notificationPollRef.current);
          }
          startNotificationPolling();
        }, 1000);
      }
    } catch (error) {
      console.error('❌ Error creating welcome notification:', error);
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
    } catch (error) {}
  };

  const loadDashboardData = async () => {
    if (!userName) return;
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({ user_id: userName });
      
      const analyticsResponse = await fetch(`${API_URL}/get_analytics_history?user_id=${userName}&period=week`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (analyticsResponse.ok) {
        const analyticsData = await analyticsResponse.json();
        const history = analyticsData.history || [];
        
        const weeklyAIChats = history.reduce((sum, day) => sum + (day.ai_chats || 0), 0);
        const weeklyFlashcards = history.reduce((sum, day) => sum + (day.flashcards || 0), 0);
        const weeklyNotes = history.reduce((sum, day) => sum + (day.notes || 0), 0);
        const weeklyStudyMinutes = history.reduce((sum, day) => sum + (day.study_minutes || 0), 0);
        
        setWeeklyStats(prev => ({
          ...prev,
          weeklyAIChats,
          weeklyFlashcards,
          weeklyNotes,
          weeklyStudyMinutes
        }));
        
        // Extract weekly progress for graph
        const progressData = history.map(day => day.ai_chats + day.flashcards + day.notes);
        setWeeklyProgress(progressData.length === 7 ? progressData : [0, 0, 0, 0, 0, 0, 0]);
      }
      
      const response = await fetch(`${API_URL}/get_dashboard_data?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.gamification) {
          setStats({
            streak: data.gamification.current_streak || 0,
            totalQuestions: data.gamification.total_ai_chats || 0,
            totalFlashcards: data.gamification.total_flashcards_created || 0,
            totalNotes: data.gamification.total_notes_created || 0,
            totalChatSessions: data.gamification.total_chat_sessions || 0,
            minutes: data.gamification.total_study_minutes || 0
          });
          
          setTotalQuestions(data.gamification.total_ai_chats || 0);
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
    } catch (error) {}
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

  const startNotificationPolling = () => {
    if (notificationPollRef.current) {
      clearInterval(notificationPollRef.current);
    }

    const pollNotifications = async () => {
      try {
        const token = localStorage.getItem('token');
        const now = Date.now();
        
        // Throttle to prevent too frequent requests (5 seconds minimum)
        if (now - lastNotificationCheckRef.current < 5000) {
          return;
        }
        lastNotificationCheckRef.current = now;

        const response = await fetch(`${API_URL}/get_notifications?user_id=${userName}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
          const data = await response.json();
          const notifs = data.notifications || [];
          
          console.log('📬 Fetched notifications:', notifs.length, notifs);
          
          setNotifications(notifs);
          setUnreadCount(notifs.filter(n => !n.is_read).length);

          // Find new unread notifications that haven't been shown yet
          const newNotifs = notifs.filter(notif => 
            !lastNotificationIds.has(notif.id) && !notif.is_read
          );

          console.log('🆕 New notifications to show:', newNotifs.length, newNotifs);

          if (newNotifs.length > 0) {
            const newSlideNotifs = newNotifs.map(notif => ({
              id: notif.id,
              title: notif.title,
              message: notif.message,
              notification_type: notif.notification_type || 'general',
              created_at: notif.created_at
            }));
            
            console.log('🎯 Adding to slide queue:', newSlideNotifs);
            
            setSlideNotifQueue(prev => [...prev, ...newSlideNotifs]);
            setLastNotificationIds(prev => {
              const updated = new Set(prev);
              newNotifs.forEach(n => updated.add(n.id));
              return updated;
            });
          }
        } else {
          console.error('❌ Failed to fetch notifications:', response.status, response.statusText);
        }
      } catch (error) {
        console.error('❌ Error polling notifications:', error);
      }
    };

    // Poll immediately on start
    pollNotifications();
    
    // Then poll every 30 seconds (more frequent for better UX)
    notificationPollRef.current = setInterval(pollNotifications, 30000);
    
    console.log('✅ Notification polling started');
  };

  const removeSlideNotification = (notifId) => {
    console.log('🗑️ Removing slide notification:', notifId);
    setSlideNotifQueue(prev => prev.filter(n => n.id !== notifId));
    markNotificationAsRead(notifId);
  };

  const markNotificationAsRead = async (notifId) => {
    try {
      const token = localStorage.getItem('token');
      console.log('✅ Marking notification as read:', notifId);
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
    } catch (error) {}
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
    } catch (error) {}
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
    } catch (error) {}
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

  const getDisplayName = () => {
    if (userProfile?.firstName) return userProfile.firstName;
    if (userProfile?.first_name) return userProfile.first_name;
    if (userProfile?.name) {
      const nameParts = userProfile.name.split(' ');
      return nameParts[0];
    }
    if (userName && userName.includes('@')) {
      return userName.split('@')[0];
    }
    return userName || 'Student';
  };
  
  const displayName = getDisplayName();

  const formatNumber = (num) => {
    if (num >= 1000000) {
      return `${Math.floor(num / 1000000)}M`;
    }
    if (num >= 1000) {
      return `${Math.floor(num / 1000)}K`;
    }
    return num.toString();
  };

  // Heatmap helper functions
  const getActivityColor = (level, customColor = null) => {
    const colorToUse = customColor || selectedTheme?.tokens?.['--accent'] || '#D7B38C';
    switch (level) {
      case 0: return rgbaFromHex(colorToUse, 0.08);
      case 1: return rgbaFromHex(colorToUse, 0.25);
      case 2: return rgbaFromHex(colorToUse, 0.45);
      case 3: return rgbaFromHex(colorToUse, 0.65);
      case 4: return rgbaFromHex(colorToUse, 0.85);
      case 5: return colorToUse;
      default: return rgbaFromHex(colorToUse, 0.08);
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

  const navigateToAI = () => navigate('/ai-chat');
  const navigateToFlashcards = () => navigate('/flashcards');
  const navigateToQuiz = () => navigate('/quiz');
  const navigateToNotes = () => navigate('/notes');
  const navigateToGames = () => navigate('/games');
  const navigateToSocial = () => navigate('/social');
  const navigateToConcepts = () => navigate('/activity-timeline');
  const navigateToLearningReview = () => navigate('/learning-review');
  const navigateToActivityTimeline = () => navigate('/concept-web');
  const navigateToAnalytics = () => navigate('/analytics');
  const openProfile = () => navigate('/profile');
  const navigateToCustomize = () => navigate('/customize-dashboard');

  // Helper to get widget config from layout
  const getWidgetConfig = (widgetId) => {
    return dashboardLayout.find(w => w.id === widgetId) || null;
  };

  // Helper to get widget style
  const getWidgetStyle = (widgetId) => {
    const config = getWidgetConfig(widgetId);
    if (!config) return {};
    return {
      gridColumn: `${config.col} / span ${config.cols}`,
      gridRow: `${config.row} / span ${config.rows}`
    };
  };

  // Helper to get widget color
  const getWidgetColor = (widgetId) => {
    const config = getWidgetConfig(widgetId);
    return config?.color || accent;
  };

  // Helper to check if widget is small (1 row)
  const isWidgetSmall = (widgetId) => {
    const config = getWidgetConfig(widgetId);
    return config?.rows === 1;
  };

  const handleLogout = async () => {
    await endDashboardSession();
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '/login';
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

  const tokens = selectedTheme?.tokens || {};
  const accent = tokens['--accent'] || '#D7B38C';
  const accentHover = tokens['--accent-2'] || '#E5C9A8';
  const textPrimary = tokens['--text-primary'] || '#EAECEF';
  const textSecondary = tokens['--text-secondary'] || '#B8C0CC';
  const bgPrimary = tokens['--bg-primary'] || '#0b0b0c';
  const bgSecondary = tokens['--bg-secondary'] || '#16181d';
  const glow = tokens['--glow'] || 'rgba(215, 179, 140, 0.35)';
  const themeMode = selectedTheme?.mode || 'dark';

  return (
    <div className={`ds-page ${isLoaded ? 'ds-loaded' : ''}`} data-theme-mode={themeMode}>
      {slideNotifQueue.length > 0 && slideNotifQueue.map((notif, index) => (
        <SlideNotification
          key={notif.id}
          notification={notif}
          onClose={() => removeSlideNotification(notif.id)}
          onMarkRead={markNotificationAsRead}
          style={{ top: `${80 + (index * 120)}px` }}
        />
      ))}
      
      {showTour && (
        <HelpTour onClose={closeTour} onComplete={completeTour} />
      )}

      <header className="ds-header">
        <div className="ds-header-content">
          <button className="nav-menu-btn" onClick={() => window.openGlobalNav && window.openGlobalNav()} aria-label="Open navigation">
            <Menu size={20} />
          </button>
          <div className="ds-header-left">
            <div className="ds-user-info">
              {userProfile?.picture && (
                <img
                  src={userProfile.picture}
                  alt="Profile"
                  className="ds-profile-picture"
                  referrerPolicy="no-referrer"
                  crossOrigin="anonymous"
                />
              )}
              <span className="ds-user-name">{displayName}</span>
            </div>
            
            <div className="ds-notifications-wrapper">
              <button className="ds-notif-bell-btn" onClick={() => setShowNotifications(!showNotifications)}>
                <Bell size={20} />
                {unreadCount > 0 && <span className="ds-notif-badge">{unreadCount}</span>}
              </button>
              
              {showNotifications && (
                <>
                  {/* Backdrop blur overlay */}
                  <div 
                    className="ds-notif-backdrop" 
                    onClick={() => setShowNotifications(false)}
                  />
                  
                  <div className="ds-notif-panel" onClick={(e) => e.stopPropagation()}>
                    <div className="ds-notif-panel-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Bell size={18} />
                        <h3>Notifications</h3>
                      </div>
                      <button className="ds-notif-close-btn" onClick={() => setShowNotifications(false)}>×</button>
                    </div>
                    <div className="ds-notif-panel-content">
                      {notifications.length === 0 ? (
                        <div className="ds-no-notifications-placeholder">
                          <Bell size={48} />
                          <p>No notifications yet</p>
                        </div>
                      ) : (
                        notifications.map(notification => (
                          <div 
                            key={notification.id} 
                            className={`ds-notif-item ${!notification.is_read ? 'ds-notif-unread' : ''}`}
                            onClick={() => markNotificationAsRead(notification.id)}
                          >
                            <div className="ds-notif-icon">
                              <Sparkles size={20} />
                            </div>
                            <div className="ds-notif-body">
                              <div className="ds-notif-header-row">
                                <span className="ds-notif-from">{notification.title}</span>
                                <button 
                                  className="ds-notif-delete" 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteNotification(notification.id);
                                  }}
                                >
                                  ×
                                </button>
                              </div>
                              <p className="ds-notif-text">{notification.message}</p>
                              <span className="ds-notif-time">{getRelativeTime(notification.created_at)}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
            
            <ThemeSwitcher />
            
            <button className="ds-profile-icon-btn" onClick={openProfile}>
              <User size={20} />
            </button>
            
            <button className="ds-logout-icon-btn" onClick={handleLogout}>
              <LogOut size={20} />
            </button>
          </div>
          
          <div className="ds-header-center">
            <div className="ds-header-title" onClick={() => navigate('/search-hub')}>
              <div className="ds-logo-img"></div>
              cerbyl
            </div>
          </div>
          
          <div className="ds-header-right">
            <button
              className="ds-search-hub-btn"
              onClick={() => navigate('/search-hub')}
            >
              <Search size={14} />
              SEARCH HUB
            </button>
            
            <button
              className="ds-customize-btn"
              onClick={navigateToCustomize}
            >
              <Settings size={14} />
              CUSTOMIZE
            </button>
          </div>
        </div>
      </header>
      
      <div className="ds-background-effects">
        <div className="ds-bg-gradient-orb ds-bg-orb-1" style={{ background: `radial-gradient(circle, ${rgbaFromHex(accent, 0.2)} 0%, transparent 70%)` }}></div>
        <div className="ds-bg-gradient-orb ds-bg-orb-2" style={{ background: `radial-gradient(circle, ${rgbaFromHex(accent, 0.15)} 0%, transparent 70%)` }}></div>
      </div>
      
      <div className="ds-grid-container">
        
        {getWidgetConfig('ai-tutor') && (
        <div className="ds-card ds-tagline" onClick={navigateToAI} style={getWidgetStyle('ai-tutor')}>
          <div className="ds-card-glow" style={{ background: `radial-gradient(ellipse at 50% 0%, ${rgbaFromHex(getWidgetColor('ai-tutor'), 0.1)} 0%, transparent 70%)` }}></div>
          <ChevronRight className="ds-card-click-indicator" size={20} style={{ color: getWidgetColor('ai-tutor') }} />
          <div className="ds-ai-assistant-card">
            <div className="ds-ai-visual-section">
              <div className="ds-ai-icon-display">
                AI
              </div>
            </div>
            <div className="ds-ai-stats-row">
              <div className="ds-ai-stat">
                <span className="ds-ai-stat-value">{currentQuestions}</span>
                <span className="ds-ai-stat-label">questions</span>
              </div>
              <div className="ds-ai-stat">
                <span className="ds-ai-stat-value">{currentSessions}</span>
                <span className="ds-ai-stat-label">sessions</span>
              </div>
            </div>
            <button className="ds-ai-chat-btn" style={{ background: `linear-gradient(135deg, ${getWidgetColor('ai-tutor')} 0%, ${getWidgetColor('ai-tutor')} 100%)` }}>
              <span>START AI SESSION</span>
              <ChevronRight size={16} />
            </button>
            <p className="ds-ai-description">
              Get instant help with any topic, generate practice questions, and receive personalized learning guidance.
            </p>
          </div>
        </div>
        )}

        {getWidgetConfig('learning-hub-grid') && (
        <div className="ds-learning-hub-grid" style={{ 
          ...getWidgetStyle('learning-hub-grid'),
          '--dashboard-accent': getWidgetColor('learning-hub-grid'),
          '--dashboard-bg-primary': bgPrimary
        }}>
          <div className="ds-card-glow" style={{ background: `radial-gradient(ellipse at 50% 0%, ${rgbaFromHex(getWidgetColor('learning-hub-grid'), 0.1)} 0%, transparent 70%)` }}></div>
          <div className="ds-learning-hub-header">
            <h2 className="ds-learning-hub-title">
              {displayName}, {getRandomGreeting()}
            </h2>
            <p className="ds-learning-hub-subtitle">ACCELERATE YOUR LEARNING</p>
          </div>
          <div className="ds-learning-hub-grid-items">
            <div className="ds-learning-hub-grid-item" onClick={() => navigate('/knowledge-roadmap')}>
              <Target size={32} strokeWidth={1.5} />
              <h3>Roadmap</h3>
              <p>Concept maps</p>
            </div>
            <div className="ds-learning-hub-grid-item" onClick={() => navigate('/question-bank')}>
              <HelpCircle size={32} strokeWidth={1.5} />
              <h3>Questions</h3>
              <p>Practice bank</p>
            </div>
            <div className="ds-learning-hub-grid-item" onClick={() => navigate('/slide-explorer')}>
              <Layers size={32} strokeWidth={1.5} />
              <h3>Slides</h3>
              <p>AI analysis</p>
            </div>
            <div className="ds-learning-hub-grid-item" onClick={() => navigate('/weaknesses')}>
              <Sparkles size={32} strokeWidth={1.5} />
              <h3>Weak Areas</h3>
              <p>AI patterns</p>
            </div>
          </div>
        </div>
        )}

        {getWidgetConfig('social-hub') && (
        <div className="ds-card ds-icon-top" onClick={navigateToSocial} style={getWidgetStyle('social-hub')}>
          <div className="ds-card-glow" style={{ background: `radial-gradient(ellipse at 50% 0%, ${rgbaFromHex(getWidgetColor('social-hub'), 0.1)} 0%, transparent 70%)` }}></div>
          <ChevronRight className="ds-card-click-indicator" size={20} style={{ color: getWidgetColor('social-hub') }} />
          <div className="ds-social-widget">
            <div className="ds-social-icon-container">
              <Users size={48} strokeWidth={1.5} style={{ color: getWidgetColor('social-hub') }} />
            </div>
            <h3 className="ds-social-title">Social Hub</h3>
            <p className="ds-social-description">CONNECT WITH LEARNERS</p>
          </div>
        </div>
        )}

        {getWidgetConfig('concept-web') && (
        <div className="ds-card ds-feature ds-concept-web" onClick={navigateToConcepts} style={getWidgetStyle('concept-web')}>
          <div className="ds-card-glow" style={{ background: `radial-gradient(ellipse at 50% 0%, ${rgbaFromHex(getWidgetColor('concept-web'), 0.1)} 0%, transparent 70%)` }}></div>
          <ChevronRight className="ds-card-click-indicator" size={20} style={{ color: getWidgetColor('concept-web') }} />
          <div className="ds-feature-content">
            <div className="ds-feature-icon" style={{ background: `linear-gradient(135deg, ${getWidgetColor('concept-web')} 0%, ${getWidgetColor('concept-web')} 100%)`, boxShadow: `0 6px 20px ${rgbaFromHex(getWidgetColor('concept-web'), 0.3)}` }}>
              <CalendarIcon size={24} />
            </div>
            <h3 className="ds-feature-title">Activity Timeline</h3>
            <p className="ds-feature-description">
              Calendar & Reminders
            </p>
          </div>
        </div>
        )}

        {getWidgetConfig('streak') && (
        <div className="ds-card ds-users" style={getWidgetStyle('streak')}>
          <div className="ds-card-glow" style={{ background: `radial-gradient(ellipse at 50% 0%, ${rgbaFromHex(getWidgetColor('streak'), 0.1)} 0%, transparent 70%)` }}></div>
          <div className="ds-streak-content">
            <div className="ds-streak-header">
              <Flame size={24} style={{ color: getWidgetColor('streak') }} />
              <div className="ds-streak-info">
                <div className="ds-streak-number">{stats.streak || 0}</div>
                <div className="ds-streak-label">day streak</div>
              </div>
            </div>
            <div className="ds-line-chart-wrapper">
              <svg viewBox="0 0 300 100" className="ds-line-chart" preserveAspectRatio="xMidYMid meet">
                {(() => {
                  const validWeeklyProgress = weeklyProgress && weeklyProgress.length === 7 ? weeklyProgress : [0, 0, 0, 0, 0, 0, 0];
                  const maxValue = Math.max(...validWeeklyProgress, 1);
                  const maxRounded = Math.ceil(maxValue / 10) * 10;
                  const streakColor = getWidgetColor('streak');
                  
                  // Generate day labels based on current timezone
                  const getDayLabels = () => {
                    const today = new Date();
                    const dayLabels = [];
                    for (let i = 6; i >= 0; i--) {
                      const date = new Date(today);
                      date.setDate(today.getDate() - i);
                      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
                      // Use 'Th' for Thursday, first letter for others
                      if (dayName === 'Thu') {
                        dayLabels.push('Th');
                      } else {
                        dayLabels.push(dayName[0]);
                      }
                    }
                    return dayLabels;
                  };
                  
                  const dayLabels = getDayLabels();
                  
                  // Center the graph by adjusting starting position
                  const startX = 30;
                  const spacing = 37;
                  
                  return (
                    <>
                      <path
                        d={`M ${startX} 80 ${validWeeklyProgress.map((val, i) => {
                          const x = startX + (i * spacing);
                          const y = 80 - (val / maxRounded) * 60;
                          return `L ${x} ${y}`;
                        }).join(' ')} L ${startX + 6 * spacing} 80 Z`}
                        fill={`url(#areaGradient)`}
                      />
                      <path
                        d={`M ${validWeeklyProgress.map((val, i) => {
                          const x = startX + (i * spacing);
                          const y = 80 - (val / maxRounded) * 60;
                          return `${i === 0 ? '' : 'L '}${x} ${y}`;
                        }).join(' ')}`}
                        fill="none"
                        stroke={streakColor}
                        strokeWidth="2"
                      />
                      {validWeeklyProgress.map((val, i) => {
                        const x = startX + (i * spacing);
                        const y = 80 - (val / maxRounded) * 60;
                        return (
                          <circle key={i} cx={x} cy={y} r="3" fill={streakColor} stroke={bgPrimary} strokeWidth="2" />
                        );
                      })}
                      {dayLabels.map((day, i) => {
                        const x = startX + (i * spacing);
                        return (
                          <text key={i} x={x} y="95" fontSize="10" fill={textSecondary} textAnchor="middle">{day}</text>
                        );
                      })}
                      <defs>
                        <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={streakColor} stopOpacity="0.3" />
                          <stop offset="100%" stopColor={streakColor} stopOpacity="0.05" />
                        </linearGradient>
                      </defs>
                    </>
                  );
                })()}
              </svg>
            </div>
            <div className="ds-streak-actions">
              <button className="ds-analytics-btn" onClick={() => navigate('/xp-roadmap')} style={{ borderColor: getWidgetColor('streak'), color: getWidgetColor('streak') }}>
                <Trophy size={16} />
                <span>XP ROADMAP</span>
              </button>
              <button className="ds-analytics-btn" onClick={() => navigate('/analytics')} style={{ borderColor: getWidgetColor('streak'), color: getWidgetColor('streak') }}>
                <TrendingUp size={16} />
                <span>VIEW ANALYTICS</span>
              </button>
            </div>
          </div>
        </div>
        )}

        {getWidgetConfig('notes') && (
        <div className={`ds-card ds-feature ds-notes ${isWidgetSmall('notes') ? 'ds-widget-small' : ''}`} onClick={navigateToNotes} style={getWidgetStyle('notes')}>
          <div className="ds-card-glow" style={{ background: `radial-gradient(ellipse at 50% 0%, ${rgbaFromHex(getWidgetColor('notes'), 0.1)} 0%, transparent 70%)` }}></div>
          <ChevronRight className="ds-card-click-indicator" size={20} style={{ color: getWidgetColor('notes') }} />
          <div className="ds-feature-content">
            <div className="ds-feature-icon" style={{ background: `linear-gradient(135deg, ${getWidgetColor('notes')} 0%, ${getWidgetColor('notes')} 100%)`, boxShadow: `0 6px 20px ${rgbaFromHex(getWidgetColor('notes'), 0.3)}` }}>
              <FileText size={18} />
            </div>
            <h3 className="ds-feature-title">Notes</h3>
            <p className="ds-feature-description">
              AI-POWERED STUDY NOTES
            </p>
          </div>
        </div>
        )}

        {getWidgetConfig('flashcards') && (
        <div className={`ds-card ds-feature ds-flashcards ${isWidgetSmall('flashcards') ? 'ds-widget-small' : ''}`} onClick={navigateToFlashcards} style={getWidgetStyle('flashcards')}>
          <div className="ds-card-glow" style={{ background: `radial-gradient(ellipse at 50% 0%, ${rgbaFromHex(getWidgetColor('flashcards'), 0.1)} 0%, transparent 70%)` }}></div>
          <ChevronRight className="ds-card-click-indicator" size={20} style={{ color: getWidgetColor('flashcards') }} />
          <div className="ds-feature-content">
            <div className="ds-feature-icon" style={{ background: `linear-gradient(135deg, ${getWidgetColor('flashcards')} 0%, ${getWidgetColor('flashcards')} 100%)`, boxShadow: `0 6px 20px ${rgbaFromHex(getWidgetColor('flashcards'), 0.3)}` }}>
              <Layers size={18} />
            </div>
            <h3 className="ds-feature-title">Flashcards</h3>
            <p className="ds-feature-description">
              MASTER KEY CONCEPTS
            </p>
          </div>
        </div>
        )}

        {getWidgetConfig('learning-hub') && (
        <div className="ds-card ds-templates" style={getWidgetStyle('learning-hub')}>
          <div className="ds-card-glow" style={{ background: `radial-gradient(ellipse at 50% 0%, ${rgbaFromHex(getWidgetColor('learning-hub'), 0.1)} 0%, transparent 70%)` }}></div>
          <div className="ds-templates-content">
            <h3 className="ds-templates-title">Learning Hub</h3>
            <p className="ds-templates-description">
              ACCELERATE YOUR LEARNING
            </p>
            <div className="ds-learning-hub-list">
              <div className="ds-learning-hub-item" style={{ color: getWidgetColor('learning-hub') }} onClick={() => navigate('/knowledge-roadmap')}>
                <ChevronRight size={14} />
                <div className="ds-learning-hub-item-text">
                  <span className="ds-learning-hub-name">Knowledge Roadmap</span>
                  <span className="ds-learning-hub-desc">Build interactive concept maps</span>
                </div>
              </div>
              <div className="ds-learning-hub-item" style={{ color: getWidgetColor('learning-hub') }} onClick={() => navigate('/question-bank')}>
                <ChevronRight size={14} />
                <div className="ds-learning-hub-item-text">
                  <span className="ds-learning-hub-name">Question Bank</span>
                  <span className="ds-learning-hub-desc">Generate custom practice questions</span>
                </div>
              </div>
              <div className="ds-learning-hub-item" style={{ color: getWidgetColor('learning-hub') }} onClick={() => navigate('/slide-explorer')}>
                <ChevronRight size={14} />
                <div className="ds-learning-hub-item-text">
                  <span className="ds-learning-hub-name">Slide Explorer</span>
                  <span className="ds-learning-hub-desc">AI-powered slide analysis</span>
                </div>
              </div>
              <div className="ds-learning-hub-item" style={{ color: getWidgetColor('learning-hub') }} onClick={() => navigate('/weaknesses')}>
                <ChevronRight size={14} />
                <div className="ds-learning-hub-item-text">
                  <span className="ds-learning-hub-name">Insights</span>
                  <span className="ds-learning-hub-desc">AI insights into your learning patterns</span>
                </div>
              </div>
            </div>
            <button 
              className="ds-learning-hub-button" 
              onClick={() => navigate('/learning-review')}
              style={{ 
                background: `linear-gradient(135deg, ${getWidgetColor('learning-hub')} 0%, ${rgbaFromHex(getWidgetColor('learning-hub'), 0.8)} 100%)`,
                boxShadow: `0 4px 12px ${rgbaFromHex(getWidgetColor('learning-hub'), 0.3)}`
              }}
            >
              <span>Go to Learning Hub</span>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
        )}

        {getWidgetConfig('activity') && (
        <div className="ds-card ds-feature ds-activity" onClick={navigateToActivityTimeline} style={getWidgetStyle('activity')}>
          <div className="ds-card-glow" style={{ background: `radial-gradient(ellipse at 50% 0%, ${rgbaFromHex(getWidgetColor('activity'), 0.1)} 0%, transparent 70%)` }}></div>
          <ChevronRight className="ds-card-click-indicator" size={20} style={{ color: getWidgetColor('activity') }} />
          <div className="ds-feature-content">
            <div className="ds-feature-icon" style={{ background: `linear-gradient(135deg, ${getWidgetColor('activity')} 0%, ${getWidgetColor('activity')} 100%)`, boxShadow: `0 6px 20px ${rgbaFromHex(getWidgetColor('activity'), 0.3)}` }}>
              <Network size={24} />
            </div>
            <h3 className="ds-feature-title">Concept Web</h3>
            <p className="ds-feature-description">
              Visualize connections between topics and ideas.
            </p>
          </div>
        </div>
        )}

        {getWidgetConfig('heatmap') && (
        <div className="ds-card ds-heatmap" style={getWidgetStyle('heatmap')}>
          <div className="ds-card-glow" style={{ background: `radial-gradient(ellipse at 50% 0%, ${rgbaFromHex(getWidgetColor('heatmap'), 0.1)} 0%, transparent 70%)` }}></div>
          <div className="ds-activity-heatmap">
            <div className="ds-heatmap-header">
              <h3 className="ds-heatmap-title">last 12 months</h3>
              <div className="ds-heatmap-stats">
                <span className="ds-total-questions">{totalQuestions} questions</span>
              </div>
            </div>

            {heatmapLoading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: textSecondary }}>
                Loading activity data...
              </div>
            ) : (
              <>
                <div className="ds-heatmap-container">
                  <div className="ds-heatmap-days">
                    <div className="ds-day-label">sun</div>
                    <div className="ds-day-label">mon</div>
                    <div className="ds-day-label">tue</div>
                    <div className="ds-day-label">wed</div>
                    <div className="ds-day-label">thu</div>
                    <div className="ds-day-label">fri</div>
                    <div className="ds-day-label">sat</div>
                  </div>

                  <div className="ds-heatmap-content">
                    <div className="ds-month-labels">
                      {getMonthLabels().map((label, index) => (
                        <div
                          key={index}
                          className="ds-month-label"
                          style={{ left: `${label.position}px` }}
                        >
                          {label.month}
                        </div>
                      ))}
                    </div>
                    <div className="ds-heatmap-grid">
                      {organizeDataByWeeks().map((week, weekIndex) => (
                        <div key={weekIndex} className="ds-heatmap-week">
                          {week.map((day, dayIndex) => (
                            <div
                              key={dayIndex}
                              className="ds-heatmap-day"
                              style={{
                                backgroundColor: day ? getActivityColor(day.level, getWidgetConfig('heatmap')?.color) : 'transparent',
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

                <div className="ds-heatmap-legend">
                  <span className="ds-legend-label">Less</span>
                  <div className="ds-legend-scale">
                    {[0, 1, 2, 3, 4].map(level => (
                      <div
                        key={level}
                        className="ds-legend-box"
                        style={{ backgroundColor: getActivityColor(level, getWidgetConfig('heatmap')?.color) }}
                      />
                    ))}
                  </div>
                  <span className="ds-legend-label">More</span>
                </div>
              </>
            )}
          </div>
        </div>
        )}

        {!hasSeenTour && (
          <HelpButton onClick={startTour} />
        )}

      </div>
      
      {showImportExport && (
        <ImportExportModal
          source={importExportSource}
          onClose={() => setShowImportExport(false)}
        />
      )}
    </div>
  );
};

export default Dashboard;

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { API_URL } from '../config';
import { rgbaFromHex } from '../utils/ThemeManager';
import logo from '../assets/logo.svg';
import './dashboard2.css';

const Dashboard2 = () => {
const navigate = useNavigate();
const { selectedTheme } = useTheme();
const [userName, setUserName] = useState('');
const [userProfile, setUserProfile] = useState(null);
const [stats, setStats] = useState({ streak: 0, totalQuestions: 0, minutes: 0, totalFlashcards: 0, totalNotes: 0, totalChatSessions: 0 });
const [heatmapData, setHeatmapData] = useState([]);
const [totalQuestions, setTotalQuestions] = useState(0);
const [currentQuestions, setCurrentQuestions] = useState(0);
const [currentSessions, setCurrentSessions] = useState(0);
const [heatmapLoading, setHeatmapLoading] = useState(true);
const [sessionStartTime, setSessionStartTime] = useState(null);
const [sessionId, setSessionId] = useState(null);
const [totalTimeToday, setTotalTimeToday] = useState(0);
const [currentSessionTime, setCurrentSessionTime] = useState(0);
const [learningReviews, setLearningReviews] = useState([]);
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
const timeIntervalRef = useRef(null);
const sessionUpdateRef = useRef(null);
const lastActivityRef = useRef(Date.now());
const inactivityTimerRef = useRef(null);
const dashboardRef = useRef(null);
const [scrollY, setScrollY] = useState(0);
const [activityVisible, setActivityVisible] = useState(false);
const [gridWidgets, setGridWidgets] = useState([]);
const [draggedWidget, setDraggedWidget] = useState(null);
const [isResizing, setIsResizing] = useState(false);
const [resizeWidget, setResizeWidget] = useState(null);
const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, w: 0, h: 0 });
const widgetRefs = useRef({});

const getGreeting = useCallback(() => {
const hour = new Date().getHours();
const greetings = {
morning: ['Good morning', 'Rise and shine', 'Hello there', 'Welcome back', 'Great to see you'],
afternoon: ['Good afternoon', 'Hello', 'Welcome back', 'Great to see you', 'Hey there'],
evening: ['Good evening', 'Welcome back', 'Hello', 'Hey there', 'Great to see you']
};
const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
if (hour < 12) return greetings.morning[dayOfYear % greetings.morning.length];
if (hour < 18) return greetings.afternoon[dayOfYear % greetings.afternoon.length];
return greetings.evening[dayOfYear % greetings.evening.length];
}, []);

const getDisplayName = useCallback(() => {
if (userProfile?.firstName) return userProfile.firstName;
if (userProfile?.first_name) return userProfile.first_name;
if (userProfile?.name) return userProfile.name.split(' ')[0];
if (userName && userName.includes('@')) return userName.split('@')[0];
return userName || 'Student';
}, [userProfile, userName]);

const loadUserStats = useCallback(async () => {
if (!userName) return;
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
}
} catch (error) {}
}, [userName]);

const loadHeatmapData = useCallback(async () => {
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
} catch (error) {} finally { setHeatmapLoading(false); }
}, [userName]);

const loadDashboardData = useCallback(async () => {
if (!userName) return;
try {
const token = localStorage.getItem('token');
const params = new URLSearchParams({ user_id: userName });
const weeklyResponse = await fetch(`${API_URL}/get_weekly_progress?user_id=${userName}`, {
headers: { 'Authorization': `Bearer ${token}` }
});
if (weeklyResponse.ok) {
const weeklyData = await weeklyResponse.json();
setWeeklyProgress(weeklyData.weekly_data || [0, 0, 0, 0, 0, 0, 0]);
setDailyBreakdown(weeklyData.daily_breakdown || []);
setWeeklyStats(weeklyData.weekly_stats || {});
}
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
setWeeklyStats(prev => ({ ...prev, weeklyAIChats, weeklyFlashcards, weeklyNotes, weeklyStudyMinutes }));
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
}, [userName]);

const startDashboardSession = useCallback(async () => {
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
}, [userName]);

const startTimeTracking = useCallback(() => {
timeIntervalRef.current = setInterval(() => {
const now = Date.now();
const timeSinceLastActivity = now - lastActivityRef.current;
if (timeSinceLastActivity < 3 * 60 * 1000) lastActivityRef.current = now;
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
}, []);

const startSessionTimeUpdater = useCallback(() => {
sessionUpdateRef.current = setInterval(() => {
if (sessionStartTime) {
const elapsed = Math.floor((Date.now() - sessionStartTime) / (1000 * 60));
setCurrentSessionTime(elapsed);
}
}, 10000);
}, [sessionStartTime]);

const endDashboardSession = useCallback(async () => {
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
} catch (error) {} finally {
if (timeIntervalRef.current) clearInterval(timeIntervalRef.current);
if (sessionUpdateRef.current) clearInterval(sessionUpdateRef.current);
if (window.dashboardTimeTrackingCleanup) window.dashboardTimeTrackingCleanup();
}
}, [sessionStartTime, sessionId, userName, loadUserStats]);

const startNotificationPolling = useCallback(() => {
if (notificationPollRef.current) clearInterval(notificationPollRef.current);
const pollNotifications = async () => {
try {
const token = localStorage.getItem('token');
const now = Date.now();
if (now - lastNotificationCheckRef.current < 10000) return;
lastNotificationCheckRef.current = now;
const response = await fetch(`${API_URL}/get_notifications?user_id=${userName}`, {
headers: { 'Authorization': `Bearer ${token}` }
});
if (response.ok) {
const data = await response.json();
const notifs = data.notifications || [];
setNotifications(notifs);
setUnreadCount(notifs.filter(n => !n.is_read).length);
const newNotifs = notifs.filter(notif => !lastNotificationIds.has(notif.id) && !notif.is_read);
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
} catch (error) {}
};
pollNotifications();
notificationPollRef.current = setInterval(pollNotifications, 120000);
}, [userName, lastNotificationIds]);

const markNotificationAsRead = useCallback(async (notifId) => {
try {
const token = localStorage.getItem('token');
const response = await fetch(`${API_URL}/mark_notification_read/${notifId}`, {
method: 'PUT',
headers: { 'Authorization': `Bearer ${token}` }
});
if (response.ok) {
setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, is_read: true } : n));
setUnreadCount(prev => Math.max(0, prev - 1));
}
} catch (error) {}
}, []);

const deleteNotification = useCallback(async (notifId) => {
try {
const token = localStorage.getItem('token');
const response = await fetch(`${API_URL}/delete_notification/${notifId}`, {
method: 'DELETE',
headers: { 'Authorization': `Bearer ${token}` }
});
if (response.ok) {
const wasUnread = notifications.find(n => n.id === notifId)?.is_read === false;
setNotifications(prev => prev.filter(n => n.id !== notifId));
setLastNotificationIds(prev => { const updated = new Set(prev); updated.add(notifId); return updated; });
if (wasUnread) setUnreadCount(prev => Math.max(0, prev - 1));
}
} catch (error) {}
}, [notifications]);

const removeSlideNotification = useCallback((notifId) => {
setSlideNotifQueue(prev => prev.filter(n => n.id !== notifId));
markNotificationAsRead(notifId);
}, [markNotificationAsRead]);

const handleLogout = useCallback(async () => {
await endDashboardSession();
localStorage.clear();
sessionStorage.clear();
window.location.href = '/login';
}, [endDashboardSession]);

const navigateToAI = useCallback(() => navigate('/ai-chat'), [navigate]);
const navigateToFlashcards = useCallback(() => navigate('/flashcards'), [navigate]);
const navigateToNotes = useCallback(() => navigate('/notes'), [navigate]);
const navigateToSocial = useCallback(() => navigate('/social'), [navigate]);
const navigateToConcepts = useCallback(() => navigate('/concepts'), [navigate]);
const openProfile = useCallback(() => navigate('/profile'), [navigate]);

const handleScroll = useCallback(() => {
if (dashboardRef.current) {
const scrollTop = dashboardRef.current.scrollTop;
setScrollY(scrollTop);
if (scrollTop > 200) setActivityVisible(true);
else setActivityVisible(false);
}
}, []);

useEffect(() => {
const token = localStorage.getItem('token');
const username = localStorage.getItem('username');
const profile = localStorage.getItem('userProfile');
if (!token) { window.location.href = '/login'; return; }
if (token && username) sessionStorage.setItem('safetyAccepted', 'true');
if (username) setUserName(username);
if (profile) { try { setUserProfile(JSON.parse(profile)); } catch (error) {} }
}, []);

useEffect(() => {
if (userName) {
loadUserStats();
loadHeatmapData();
loadDashboardData();
startDashboardSession();
startNotificationPolling();
}
return () => {
endDashboardSession();
if (notificationPollRef.current) clearInterval(notificationPollRef.current);
if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
};
}, [userName, loadUserStats, loadHeatmapData, loadDashboardData, startDashboardSession, startNotificationPolling, endDashboardSession]);

useEffect(() => {
const dashboardEl = dashboardRef.current;
if (dashboardEl) {
dashboardEl.addEventListener('scroll', handleScroll, { passive: true });
return () => dashboardEl.removeEventListener('scroll', handleScroll);
}
}, [handleScroll]);

const getActivityColor = useCallback((level) => {
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
}, [selectedTheme]);

const organizeDataByWeeks = useCallback(() => {
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
if (dayData) week.push(dayData);
else if (currentDate >= startDate && currentDate <= endDate) week.push({ date: dateStr, count: 0, level: 0 });
else week.push(null);
currentDate.setDate(currentDate.getDate() + 1);
}
weeks.push(week);
}
return weeks;
}, [heatmapData]);

const getMonthLabels = useCallback(() => {
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
const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
labels.push({ month: monthNames[month], position: weekIndex * 18 });
}
currentMonth = month;
isFirstMonth = false;
}
}
});
return labels;
}, [heatmapData, organizeDataByWeeks]);

const getTooltipText = useCallback((count, date) => {
const dateObj = new Date(date);
const dateStr = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
if (count === 0) return `No questions on ${dateStr}`;
if (count === 1) return `1 question on ${dateStr}`;
return `${count} questions on ${dateStr}`;
}, []);

const displayName = getDisplayName();
const tokens = selectedTheme?.tokens || {};
const accent = tokens['--accent'] || '#D7B38C';
const primary = tokens['--primary'] || '#16181d';
const textPrimary = tokens['--text-primary'] || '#EAECEF';
const textSecondary = tokens['--text-secondary'] || '#B8C0CC';
const bgPrimary = tokens['--bg-primary'] || '#0b0b0c';
const bgSecondary = tokens['--bg-secondary'] || '#16181d';

const buildDOM = useCallback(() => {
const container = document.createElement('div');
container.className = 'db2-root';
container.setAttribute('data-theme-mode', selectedTheme?.mode || 'dark');

const gridContainer = document.createElement('div');
gridContainer.className = 'db2-grid';

const greetingWidget = document.createElement('div');
greetingWidget.className = 'db2-widget db2-greeting';
greetingWidget.innerHTML = `<div class="db2-greeting-content"><h1 class="db2-greeting-text">${getGreeting()}, ${displayName}</h1><p class="db2-greeting-quote">"${randomQuote || motivationalQuote || 'Keep learning every day!'}"</p></div>`;
gridContainer.appendChild(greetingWidget);

const centerWidget = document.createElement('div');
centerWidget.className = 'db2-widget db2-center';
const logoContainer = document.createElement('div');
logoContainer.className = 'db2-logo-container';
const logoPanel = document.createElement('div');
logoPanel.className = 'db2-logo-panel';
logoPanel.innerHTML = `<span class="db2-logo-text">cerbyl</span>`;
logoContainer.appendChild(logoPanel);
const logoCircle = document.createElement('div');
logoCircle.className = 'db2-logo-circle';
const logoImg = document.createElement('img');
logoImg.src = logo;
logoImg.alt = 'Cerbyl';
logoImg.className = 'db2-logo-img';
logoCircle.appendChild(logoImg);
logoContainer.appendChild(logoCircle);
centerWidget.appendChild(logoContainer);
gridContainer.appendChild(centerWidget);

const aiChatWidget = document.createElement('div');
aiChatWidget.className = 'db2-widget db2-ai-chat';
aiChatWidget.innerHTML = `<div class="db2-widget-header"><h3 class="db2-widget-title">AI Chat</h3></div><div class="db2-widget-body"><p class="db2-widget-desc">Get instant help with any topic, generate practice questions, and receive personalized learning guidance from your AI tutor.</p><div class="db2-ai-stats"><div class="db2-ai-stat"><span class="db2-ai-stat-value">${currentQuestions}</span><span class="db2-ai-stat-label">questions</span></div><div class="db2-ai-stat"><span class="db2-ai-stat-value">${currentSessions}</span><span class="db2-ai-stat-label">sessions</span></div></div><button class="db2-btn db2-btn-primary db2-ai-btn">START AI SESSION</button></div>`;
aiChatWidget.querySelector('.db2-ai-btn').addEventListener('click', navigateToAI);
gridContainer.appendChild(aiChatWidget);

const learningWidget = document.createElement('div');
learningWidget.className = 'db2-widget db2-learning';
learningWidget.innerHTML = `<div class="db2-widget-header"><h3 class="db2-widget-title">Learning Hub</h3></div><div class="db2-widget-body"><p class="db2-widget-desc">Access structured learning paths, track your progress, and master concepts through interactive study sessions.</p><div class="db2-learning-stats"><div class="db2-learning-stat"><span class="db2-learning-stat-value">${stats.streak}</span><span class="db2-learning-stat-label">day streak</span></div><div class="db2-learning-stat"><span class="db2-learning-stat-value">${Math.floor(stats.minutes / 60)}</span><span class="db2-learning-stat-label">hours studied</span></div></div><button class="db2-btn db2-btn-primary db2-learning-btn">EXPLORE LEARNING</button></div>`;
learningWidget.querySelector('.db2-learning-btn').addEventListener('click', () => navigate('/learning-review'));
gridContainer.appendChild(learningWidget);

return { container, gridContainer };
}, [selectedTheme, getGreeting, displayName, randomQuote, motivationalQuote, currentQuestions, currentSessions, stats, navigateToAI, navigate]);

const buildControlPanel = useCallback(() => {
const controlWidget = document.createElement('div');
controlWidget.className = 'db2-widget db2-control-panel';
controlWidget.innerHTML = `<div class="db2-control-grid"><button class="db2-control-btn db2-control-theme" title="Theme"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg></button><button class="db2-control-btn db2-control-profile" title="Profile"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></button><button class="db2-control-btn db2-control-settings" title="Settings"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></button><button class="db2-control-btn db2-control-logout" title="Logout"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg></button></div>`;
controlWidget.querySelector('.db2-control-profile').addEventListener('click', openProfile);
controlWidget.querySelector('.db2-control-logout').addEventListener('click', handleLogout);
return controlWidget;
}, [openProfile, handleLogout]);

const buildNotesWidget = useCallback(() => {
const notesWidget = document.createElement('div');
notesWidget.className = 'db2-widget db2-notes';
notesWidget.innerHTML = `<div class="db2-widget-header"><h3 class="db2-widget-title">Notes</h3></div><div class="db2-widget-body"><div class="db2-notes-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg></div><p class="db2-widget-desc">Organize your study notes and access them anytime.</p><div class="db2-notes-stat"><span class="db2-notes-stat-value">${stats.totalNotes}</span><span class="db2-notes-stat-label">notes created</span></div><button class="db2-btn db2-btn-secondary db2-notes-btn">VIEW NOTES</button></div>`;
notesWidget.querySelector('.db2-notes-btn').addEventListener('click', navigateToNotes);
return notesWidget;
}, [stats.totalNotes, navigateToNotes]);

const buildFlashcardsWidget = useCallback(() => {
const flashcardsWidget = document.createElement('div');
flashcardsWidget.className = 'db2-widget db2-flashcards';
flashcardsWidget.innerHTML = `<div class="db2-widget-header"><h3 class="db2-widget-title">Flashcards</h3></div><div class="db2-widget-body"><div class="db2-flashcards-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M12 8v8"/><path d="M8 12h8"/></svg></div><p class="db2-widget-desc">Create and review flashcards to master key concepts.</p><div class="db2-flashcards-stat"><span class="db2-flashcards-stat-value">${stats.totalFlashcards}</span><span class="db2-flashcards-stat-label">flashcards</span></div><button class="db2-btn db2-btn-secondary db2-flashcards-btn">STUDY NOW</button></div>`;
flashcardsWidget.querySelector('.db2-flashcards-btn').addEventListener('click', navigateToFlashcards);
return flashcardsWidget;
}, [stats.totalFlashcards, navigateToFlashcards]);

const buildSocialWidget = useCallback(() => {
const socialWidget = document.createElement('div');
socialWidget.className = 'db2-widget db2-social';
socialWidget.innerHTML = `<div class="db2-widget-header"><h3 class="db2-widget-title">Social Hub</h3></div><div class="db2-widget-body"><div class="db2-social-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div><p class="db2-widget-desc">Connect with fellow learners and collaborate.</p><button class="db2-btn db2-btn-secondary db2-social-btn">EXPLORE SOCIAL</button></div>`;
socialWidget.querySelector('.db2-social-btn').addEventListener('click', navigateToSocial);
return socialWidget;
}, [navigateToSocial]);

const buildAnalyticsWidget = useCallback(() => {
const analyticsWidget = document.createElement('div');
analyticsWidget.className = 'db2-widget db2-analytics';
const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const validWeeklyProgress = weeklyProgress && weeklyProgress.length === 7 ? weeklyProgress : [0, 0, 0, 0, 0, 0, 0];
const maxWeeklyValue = Math.max(...validWeeklyProgress, 1);
const maxRounded = Math.ceil(maxWeeklyValue / 10) * 10 || 10;
let pathD = '';
let areaD = `M 40 100 `;
validWeeklyProgress.forEach((val, i) => {
const x = 40 + (i * 41.67);
const y = 100 - (val / maxRounded) * 70;
if (i === 0) pathD += `M ${x} ${y} `;
else pathD += `L ${x} ${y} `;
areaD += `L ${x} ${y} `;
});
areaD += `L ${40 + 6 * 41.67} 100 Z`;
let circlesHtml = '';
validWeeklyProgress.forEach((val, i) => {
const x = 40 + (i * 41.67);
const y = 100 - (val / maxRounded) * 70;
circlesHtml += `<circle cx="${x}" cy="${y}" r="4" fill="var(--accent)" stroke="var(--bg-primary)" stroke-width="2"/>`;
});
let labelsHtml = '';
dayLabels.forEach((day, i) => {
const x = 40 + (i * 41.67);
labelsHtml += `<text x="${x}" y="115" font-size="10" fill="var(--text-secondary)" text-anchor="middle">${day}</text>`;
});
analyticsWidget.innerHTML = `<div class="db2-widget-header"><h3 class="db2-widget-title">Weekly Activity</h3></div><div class="db2-widget-body"><div class="db2-analytics-chart"><svg viewBox="0 0 300 120" preserveAspectRatio="xMidYMid meet"><defs><linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--accent)" stop-opacity="0.3"/><stop offset="100%" stop-color="var(--accent)" stop-opacity="0.05"/></linearGradient></defs><line x1="40" y1="30" x2="290" y2="30" stroke="var(--text-secondary)" stroke-opacity="0.15" stroke-dasharray="4,4"/><line x1="40" y1="65" x2="290" y2="65" stroke="var(--text-secondary)" stroke-opacity="0.15" stroke-dasharray="4,4"/><line x1="40" y1="100" x2="290" y2="100" stroke="var(--text-secondary)" stroke-opacity="0.3" stroke-dasharray="4,4"/><path d="${areaD}" fill="url(#areaGrad)"/><path d="${pathD}" fill="none" stroke="var(--accent)" stroke-width="2"/>${circlesHtml}${labelsHtml}</svg></div><div class="db2-analytics-stats"><div class="db2-analytics-stat"><span class="db2-analytics-stat-value">${totalQuestions}</span><span class="db2-analytics-stat-label">questions</span></div><div class="db2-analytics-stat"><span class="db2-analytics-stat-value">${stats.totalFlashcards}</span><span class="db2-analytics-stat-label">flashcards</span></div></div></div>`;
return analyticsWidget;
}, [weeklyProgress, totalQuestions, stats.totalFlashcards]);

const buildHeatmapWidget = useCallback(() => {
const heatmapWidget = document.createElement('div');
heatmapWidget.className = 'db2-widget db2-heatmap';
const weeks = organizeDataByWeeks();
const monthLabels = getMonthLabels();
let weeksHtml = '';
weeks.forEach((week, weekIndex) => {
let weekHtml = `<div class="db2-heatmap-week">`;
week.forEach((day, dayIndex) => {
if (day) {
const color = getActivityColor(day.level);
const tooltip = getTooltipText(day.count, day.date);
weekHtml += `<div class="db2-heatmap-day" style="background-color: ${color};" title="${tooltip}"></div>`;
} else {
weekHtml += `<div class="db2-heatmap-day db2-heatmap-day-empty"></div>`;
}
});
weekHtml += `</div>`;
weeksHtml += weekHtml;
});
let monthLabelsHtml = '';
monthLabels.forEach(label => {
monthLabelsHtml += `<div class="db2-heatmap-month" style="left: ${label.position}px;">${label.month}</div>`;
});
heatmapWidget.innerHTML = `<div class="db2-widget-header"><h3 class="db2-widget-title">Last 12 Months</h3><span class="db2-heatmap-total">${totalQuestions} questions</span></div><div class="db2-widget-body"><div class="db2-heatmap-container"><div class="db2-heatmap-days"><div class="db2-heatmap-day-label">sun</div><div class="db2-heatmap-day-label">mon</div><div class="db2-heatmap-day-label">tue</div><div class="db2-heatmap-day-label">wed</div><div class="db2-heatmap-day-label">thu</div><div class="db2-heatmap-day-label">fri</div><div class="db2-heatmap-day-label">sat</div></div><div class="db2-heatmap-content"><div class="db2-heatmap-months">${monthLabelsHtml}</div><div class="db2-heatmap-grid">${weeksHtml}</div></div></div><div class="db2-heatmap-legend"><span class="db2-heatmap-legend-label">Less</span><div class="db2-heatmap-legend-scale"><div class="db2-heatmap-legend-box" style="background-color: ${getActivityColor(0)};"></div><div class="db2-heatmap-legend-box" style="background-color: ${getActivityColor(1)};"></div><div class="db2-heatmap-legend-box" style="background-color: ${getActivityColor(2)};"></div><div class="db2-heatmap-legend-box" style="background-color: ${getActivityColor(3)};"></div><div class="db2-heatmap-legend-box" style="background-color: ${getActivityColor(4)};"></div></div><span class="db2-heatmap-legend-label">More</span></div></div>`;
return heatmapWidget;
}, [organizeDataByWeeks, getMonthLabels, getActivityColor, getTooltipText, totalQuestions]);

const buildActivityWidget = useCallback(() => {
const activityWidget = document.createElement('div');
activityWidget.className = 'db2-widget db2-activity';
activityWidget.style.opacity = activityVisible ? '1' : '0';
activityWidget.style.transform = activityVisible ? 'translateY(0)' : 'translateY(40px)';
let activitiesHtml = '';
if (recentActivities.length > 0) {
recentActivities.slice(0, 5).forEach(activity => {
activitiesHtml += `<div class="db2-activity-item"><div class="db2-activity-icon">${activity.type?.toUpperCase().charAt(0) || 'A'}</div><div class="db2-activity-details"><div class="db2-activity-subject">${activity.subject || 'Activity'}</div><div class="db2-activity-meta">${activity.question ? activity.question.substring(0, 40) + '...' : ''}</div></div><div class="db2-activity-time">${activity.time || ''}</div></div>`;
});
} else {
activitiesHtml = `<div class="db2-activity-empty"><p>No recent activity</p><button class="db2-btn db2-btn-primary db2-activity-start-btn">Start Learning</button></div>`;
}
activityWidget.innerHTML = `<div class="db2-widget-header"><h3 class="db2-widget-title">Recent Activity</h3></div><div class="db2-widget-body"><div class="db2-activity-list">${activitiesHtml}</div></div>`;
const startBtn = activityWidget.querySelector('.db2-activity-start-btn');
if (startBtn) startBtn.addEventListener('click', navigateToAI);
return activityWidget;
}, [activityVisible, recentActivities, navigateToAI]);

const buildNotificationPanel = useCallback(() => {
const panel = document.createElement('div');
panel.className = 'db2-notification-panel';
panel.style.display = showNotifications ? 'block' : 'none';
let notifsHtml = '';
if (notifications.length > 0) {
notifications.forEach(notif => {
notifsHtml += `<div class="db2-notif-item ${!notif.is_read ? 'db2-notif-unread' : ''}" data-id="${notif.id}"><div class="db2-notif-header"><span class="db2-notif-title">${notif.title}</span><button class="db2-notif-delete" data-id="${notif.id}">&times;</button></div><p class="db2-notif-message">${notif.message}</p></div>`;
});
} else {
notifsHtml = `<div class="db2-notif-empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="32" height="32"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg><p>No notifications</p></div>`;
}
panel.innerHTML = `<div class="db2-notif-panel-header"><h3>Notifications</h3><button class="db2-notif-close">&times;</button></div><div class="db2-notif-panel-content">${notifsHtml}</div>`;
panel.querySelector('.db2-notif-close').addEventListener('click', () => setShowNotifications(false));
panel.querySelectorAll('.db2-notif-delete').forEach(btn => {
btn.addEventListener('click', (e) => {
e.stopPropagation();
deleteNotification(parseInt(btn.dataset.id));
});
});
return panel;
}, [showNotifications, notifications, deleteNotification]);

const buildSlideNotifications = useCallback(() => {
const container = document.createElement('div');
container.className = 'db2-slide-notifs';
slideNotifQueue.slice(0, 3).forEach((notif, index) => {
const slideNotif = document.createElement('div');
slideNotif.className = 'db2-slide-notif';
slideNotif.style.animationDelay = `${index * 0.1}s`;
slideNotif.innerHTML = `<div class="db2-slide-notif-content"><h4 class="db2-slide-notif-title">${notif.title}</h4><p class="db2-slide-notif-message">${notif.message}</p></div><button class="db2-slide-notif-close" data-id="${notif.id}">&times;</button>`;
slideNotif.querySelector('.db2-slide-notif-close').addEventListener('click', () => removeSlideNotification(notif.id));
container.appendChild(slideNotif);
});
return container;
}, [slideNotifQueue, removeSlideNotification]);

const initDashboard = useCallback(() => {
if (!dashboardRef.current) return;
dashboardRef.current.innerHTML = '';
const root = document.createElement('div');
root.className = 'db2-root';
root.setAttribute('data-theme-mode', selectedTheme?.mode || 'dark');
const header = document.createElement('header');
header.className = 'db2-header';
header.innerHTML = `<div class="db2-header-left"><div class="db2-user-info">${userProfile?.picture ? `<img src="${userProfile.picture}" alt="Profile" class="db2-user-avatar" referrerpolicy="no-referrer" crossorigin="anonymous"/>` : ''}<span class="db2-user-name">${displayName}</span></div><button class="db2-notif-btn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>${unreadCount > 0 ? `<span class="db2-notif-badge">${unreadCount}</span>` : ''}</button></div><div class="db2-header-right"><button class="db2-search-btn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>SEARCH HUB</button><button class="db2-logout-btn">LOGOUT</button></div>`;
header.querySelector('.db2-notif-btn').addEventListener('click', () => setShowNotifications(prev => !prev));
header.querySelector('.db2-search-btn').addEventListener('click', () => navigate('/search-hub'));
header.querySelector('.db2-logout-btn').addEventListener('click', handleLogout);
root.appendChild(header);
const notifPanel = buildNotificationPanel();
root.appendChild(notifPanel);
const main = document.createElement('main');
main.className = 'db2-main';
const grid = document.createElement('div');
grid.className = 'db2-grid';
const greetingWidget = document.createElement('div');
greetingWidget.className = 'db2-widget db2-greeting';
greetingWidget.innerHTML = `<div class="db2-greeting-content"><h1 class="db2-greeting-text">${getGreeting()}, ${displayName}</h1><p class="db2-greeting-quote">"${randomQuote || motivationalQuote || 'Keep learning every day!'}"</p></div>`;
grid.appendChild(greetingWidget);
const centerWidget = document.createElement('div');
centerWidget.className = 'db2-widget db2-center';
centerWidget.innerHTML = `<div class="db2-logo-container"><div class="db2-logo-panel"><span class="db2-logo-text">cerbyl</span></div><div class="db2-logo-circle"><img src="${logo}" alt="Cerbyl" class="db2-logo-img"/></div><div class="db2-logo-glow"></div></div>`;
grid.appendChild(centerWidget);
const controlPanel = buildControlPanel();
grid.appendChild(controlPanel);
const aiChatWidget = document.createElement('div');
aiChatWidget.className = 'db2-widget db2-ai-chat';
aiChatWidget.innerHTML = `<div class="db2-widget-header"><h3 class="db2-widget-title">AI Chat</h3></div><div class="db2-widget-body"><p class="db2-widget-desc">Get instant help with any topic, generate practice questions, and receive personalized learning guidance from your AI tutor.</p><div class="db2-ai-stats"><div class="db2-ai-stat"><span class="db2-ai-stat-value">${currentQuestions}</span><span class="db2-ai-stat-label">questions</span></div><div class="db2-ai-stat"><span class="db2-ai-stat-value">${currentSessions}</span><span class="db2-ai-stat-label">sessions</span></div></div><button class="db2-btn db2-btn-primary db2-ai-btn">START AI SESSION</button></div>`;
aiChatWidget.querySelector('.db2-ai-btn').addEventListener('click', navigateToAI);
grid.appendChild(aiChatWidget);
const learningWidget = document.createElement('div');
learningWidget.className = 'db2-widget db2-learning';
learningWidget.innerHTML = `<div class="db2-widget-header"><h3 class="db2-widget-title">Learning Hub</h3></div><div class="db2-widget-body"><p class="db2-widget-desc">Access structured learning paths, track your progress, and master concepts through interactive study sessions.</p><div class="db2-learning-stats"><div class="db2-learning-stat"><span class="db2-learning-stat-value">${stats.streak}</span><span class="db2-learning-stat-label">day streak</span></div><div class="db2-learning-stat"><span class="db2-learning-stat-value">${Math.floor(stats.minutes / 60)}</span><span class="db2-learning-stat-label">hours studied</span></div></div><button class="db2-btn db2-btn-primary db2-learning-btn">EXPLORE LEARNING</button></div>`;
learningWidget.querySelector('.db2-learning-btn').addEventListener('click', () => navigate('/learning-review'));
grid.appendChild(learningWidget);
grid.appendChild(buildNotesWidget());
grid.appendChild(buildFlashcardsWidget());
grid.appendChild(buildSocialWidget());
grid.appendChild(buildAnalyticsWidget());
grid.appendChild(buildHeatmapWidget());
grid.appendChild(buildActivityWidget());
main.appendChild(grid);
root.appendChild(main);
root.appendChild(buildSlideNotifications());
dashboardRef.current.appendChild(root);
}, [selectedTheme, userProfile, displayName, unreadCount, getGreeting, randomQuote, motivationalQuote, currentQuestions, currentSessions, stats, navigate, handleLogout, navigateToAI, buildControlPanel, buildNotesWidget, buildFlashcardsWidget, buildSocialWidget, buildAnalyticsWidget, buildHeatmapWidget, buildActivityWidget, buildNotificationPanel, buildSlideNotifications]);

useEffect(() => {
initDashboard();
}, [initDashboard]);

useEffect(() => {
if (dashboardRef.current) {
const activityWidget = dashboardRef.current.querySelector('.db2-activity');
if (activityWidget) {
activityWidget.style.opacity = activityVisible ? '1' : '0';
activityWidget.style.transform = activityVisible ? 'translateY(0)' : 'translateY(40px)';
}
}
}, [activityVisible]);

useEffect(() => {
if (dashboardRef.current) {
const notifPanel = dashboardRef.current.querySelector('.db2-notification-panel');
if (notifPanel) notifPanel.style.display = showNotifications ? 'block' : 'none';
}
}, [showNotifications]);

return React.createElement('div', { ref: dashboardRef, className: 'db2-container' });
};

export default Dashboard2;

const buildQuickActionsWidget = useCallback(() => {
const quickActionsWidget = document.createElement('div');
quickActionsWidget.className = 'db2-widget db2-quick-actions';
quickActionsWidget.innerHTML = `<div class="db2-widget-header"><h3 class="db2-widget-title">Quick Actions</h3></div><div class="db2-widget-body"><div class="db2-quick-actions-grid"><button class="db2-quick-action-btn" data-action="flashcards"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M12 8v8"/><path d="M8 12h8"/></svg><span>Flashcards</span></button><button class="db2-quick-action-btn" data-action="notes"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><span>Notes</span></button><button class="db2-quick-action-btn" data-action="concepts"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="3"/><path d="M12 2v4"/><path d="M12 18v4"/><path d="M4.93 4.93l2.83 2.83"/><path d="M16.24 16.24l2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="M4.93 19.07l2.83-2.83"/><path d="M16.24 7.76l2.83-2.83"/></svg><span>Concepts</span></button><button class="db2-quick-action-btn" data-action="profile"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg><span>Profile</span></button></div></div>`;
quickActionsWidget.querySelector('[data-action="flashcards"]').addEventListener('click', navigateToFlashcards);
quickActionsWidget.querySelector('[data-action="notes"]').addEventListener('click', navigateToNotes);
quickActionsWidget.querySelector('[data-action="concepts"]').addEventListener('click', navigateToConcepts);
quickActionsWidget.querySelector('[data-action="profile"]').addEventListener('click', openProfile);
return quickActionsWidget;
}, [navigateToFlashcards, navigateToNotes, navigateToConcepts, openProfile]);

const buildStreakWidget = useCallback(() => {
const streakWidget = document.createElement('div');
streakWidget.className = 'db2-widget db2-streak';
const streakDays = [];
for (let i = 6; i >= 0; i--) {
const date = new Date();
date.setDate(date.getDate() - i);
const dayName = date.toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase();
const isActive = i < stats.streak;
streakDays.push(`<div class="db2-streak-day ${isActive ? 'active' : ''}"><span class="db2-streak-day-name">${dayName}</span><div class="db2-streak-day-dot"></div></div>`);
}
streakWidget.innerHTML = `<div class="db2-widget-header"><h3 class="db2-widget-title">Study Streak</h3></div><div class="db2-widget-body"><div class="db2-streak-value"><span class="db2-streak-number">${stats.streak}</span><span class="db2-streak-label">day streak</span></div><div class="db2-streak-days">${streakDays.join('')}</div><p class="db2-streak-message">${stats.streak > 0 ? 'Keep it up! You\'re on fire!' : 'Start your streak today!'}</p></div>`;
return streakWidget;
}, [stats.streak]);

const buildStudyTimeWidget = useCallback(() => {
const studyTimeWidget = document.createElement('div');
studyTimeWidget.className = 'db2-widget db2-study-time';
const hours = Math.floor(stats.minutes / 60);
const minutes = stats.minutes % 60;
const progressPercent = Math.min((stats.minutes / 120) * 100, 100);
studyTimeWidget.innerHTML = `<div class="db2-widget-header"><h3 class="db2-widget-title">Study Time</h3></div><div class="db2-widget-body"><div class="db2-study-time-display"><span class="db2-study-time-value">${hours}</span><span class="db2-study-time-unit">h</span><span class="db2-study-time-value">${minutes}</span><span class="db2-study-time-unit">m</span></div><div class="db2-study-time-progress"><div class="db2-study-time-progress-bar" style="width: ${progressPercent}%;"></div></div><p class="db2-study-time-goal">Daily goal: 2 hours</p></div>`;
return studyTimeWidget;
}, [stats.minutes]);

const buildAchievementsWidget = useCallback(() => {
const achievementsWidget = document.createElement('div');
achievementsWidget.className = 'db2-widget db2-achievements';
let achievementsHtml = '';
if (achievements.length > 0) {
achievements.slice(0, 4).forEach(achievement => {
achievementsHtml += `<div class="db2-achievement-item"><div class="db2-achievement-icon">${achievement.icon || '🏆'}</div><div class="db2-achievement-info"><span class="db2-achievement-name">${achievement.name || 'Achievement'}</span><span class="db2-achievement-desc">${achievement.description || ''}</span></div></div>`;
});
} else {
achievementsHtml = `<div class="db2-achievements-empty"><p>Complete activities to earn achievements!</p></div>`;
}
achievementsWidget.innerHTML = `<div class="db2-widget-header"><h3 class="db2-widget-title">Achievements</h3></div><div class="db2-widget-body"><div class="db2-achievements-list">${achievementsHtml}</div></div>`;
return achievementsWidget;
}, [achievements]);

const buildLearningReviewsWidget = useCallback(() => {
const reviewsWidget = document.createElement('div');
reviewsWidget.className = 'db2-widget db2-learning-reviews';
let reviewsHtml = '';
if (learningReviews.length > 0) {
learningReviews.slice(0, 3).forEach(review => {
reviewsHtml += `<div class="db2-review-item" data-id="${review.id}"><div class="db2-review-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg></div><div class="db2-review-info"><span class="db2-review-title">${review.topic || 'Review'}</span><span class="db2-review-type">${review.content_type || 'topic'}</span></div><button class="db2-review-start-btn">Start</button></div>`;
});
} else {
reviewsHtml = `<div class="db2-reviews-empty"><p>No learning reviews scheduled</p></div>`;
}
reviewsWidget.innerHTML = `<div class="db2-widget-header"><h3 class="db2-widget-title">Learning Reviews</h3></div><div class="db2-widget-body"><div class="db2-reviews-list">${reviewsHtml}</div><button class="db2-btn db2-btn-secondary db2-reviews-view-all">VIEW ALL REVIEWS</button></div>`;
reviewsWidget.querySelector('.db2-reviews-view-all').addEventListener('click', () => navigate('/learning-review'));
reviewsWidget.querySelectorAll('.db2-review-start-btn').forEach(btn => {
btn.addEventListener('click', (e) => {
const reviewId = e.target.closest('.db2-review-item').dataset.id;
const review = learningReviews.find(r => r.id === parseInt(reviewId));
if (review) {
if (review.content_type === 'flashcard_deck') navigate(`/flashcards?deck_id=${review.content_id}`);
else navigate(`/ai?topic=${encodeURIComponent(review.topic)}`);
}
});
});
return reviewsWidget;
}, [learningReviews, navigate]);

const buildConversationStartersWidget = useCallback(() => {
const startersWidget = document.createElement('div');
startersWidget.className = 'db2-widget db2-conversation-starters';
let startersHtml = '';
const defaultStarters = [
{ text: 'Explain quantum computing basics', icon: '🔬' },
{ text: 'Help me understand calculus', icon: '📐' },
{ text: 'What are the key events of World War II?', icon: '📚' },
{ text: 'Teach me about machine learning', icon: '🤖' }
];
const starters = conversationStarters.length > 0 ? conversationStarters : defaultStarters;
starters.slice(0, 4).forEach(starter => {
startersHtml += `<button class="db2-starter-btn" data-text="${starter.text || starter}"><span class="db2-starter-icon">${starter.icon || '💡'}</span><span class="db2-starter-text">${starter.text || starter}</span></button>`;
});
startersWidget.innerHTML = `<div class="db2-widget-header"><h3 class="db2-widget-title">Start a Conversation</h3></div><div class="db2-widget-body"><div class="db2-starters-list">${startersHtml}</div></div>`;
startersWidget.querySelectorAll('.db2-starter-btn').forEach(btn => {
btn.addEventListener('click', () => {
const text = btn.dataset.text;
navigate(`/ai-chat?prompt=${encodeURIComponent(text)}`);
});
});
return startersWidget;
}, [conversationStarters, navigate]);

const buildMotivationalWidget = useCallback(() => {
const motivationalWidget = document.createElement('div');
motivationalWidget.className = 'db2-widget db2-motivational';
const quote = randomQuote || motivationalQuote || 'The only way to do great work is to love what you do.';
motivationalWidget.innerHTML = `<div class="db2-motivational-content"><div class="db2-motivational-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/></svg></div><p class="db2-motivational-quote">"${quote}"</p></div>`;
return motivationalWidget;
}, [randomQuote, motivationalQuote]);

const buildGoalProgressWidget = useCallback(() => {
const goalWidget = document.createElement('div');
goalWidget.className = 'db2-widget db2-goal-progress';
const dailyGoal = 10;
const progress = Math.min((stats.totalQuestions / dailyGoal) * 100, 100);
const circumference = 2 * Math.PI * 45;
const strokeDashoffset = circumference - (progress / 100) * circumference;
goalWidget.innerHTML = `<div class="db2-widget-header"><h3 class="db2-widget-title">Daily Goal</h3></div><div class="db2-widget-body"><div class="db2-goal-circle"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="none" stroke="var(--accent)" stroke-opacity="0.2" stroke-width="8"/><circle cx="50" cy="50" r="45" fill="none" stroke="var(--accent)" stroke-width="8" stroke-linecap="square" stroke-dasharray="${circumference}" stroke-dashoffset="${strokeDashoffset}" transform="rotate(-90 50 50)"/></svg><div class="db2-goal-value"><span class="db2-goal-percent">${Math.round(progress)}%</span></div></div><div class="db2-goal-details"><p class="db2-goal-text">${stats.totalQuestions} / ${dailyGoal} questions</p><button class="db2-btn db2-btn-secondary db2-goal-continue">Continue Learning</button></div></div>`;
goalWidget.querySelector('.db2-goal-continue').addEventListener('click', navigateToAI);
return goalWidget;
}, [stats.totalQuestions, navigateToAI]);

const buildWeeklyOverviewWidget = useCallback(() => {
const weeklyWidget = document.createElement('div');
weeklyWidget.className = 'db2-widget db2-weekly-overview';
const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const validWeeklyProgress = weeklyProgress && weeklyProgress.length === 7 ? weeklyProgress : [0, 0, 0, 0, 0, 0, 0];
const maxValue = Math.max(...validWeeklyProgress, 1);
let barsHtml = '';
validWeeklyProgress.forEach((val, i) => {
const height = (val / maxValue) * 100;
barsHtml += `<div class="db2-weekly-bar-container"><div class="db2-weekly-bar" style="height: ${height}%;" data-value="${val}"></div><span class="db2-weekly-label">${dayLabels[i]}</span></div>`;
});
const totalWeekly = validWeeklyProgress.reduce((a, b) => a + b, 0);
weeklyWidget.innerHTML = `<div class="db2-widget-header"><h3 class="db2-widget-title">This Week</h3><span class="db2-weekly-total">${totalWeekly} activities</span></div><div class="db2-widget-body"><div class="db2-weekly-chart">${barsHtml}</div></div>`;
return weeklyWidget;
}, [weeklyProgress]);

const buildUpcomingWidget = useCallback(() => {
const upcomingWidget = document.createElement('div');
upcomingWidget.className = 'db2-widget db2-upcoming';
const upcomingItems = [
{ title: 'Review Flashcards', time: 'Today', type: 'flashcard' },
{ title: 'Complete Quiz', time: 'Tomorrow', type: 'quiz' },
{ title: 'Study Session', time: 'In 2 days', type: 'study' }
];
let itemsHtml = '';
upcomingItems.forEach(item => {
itemsHtml += `<div class="db2-upcoming-item"><div class="db2-upcoming-icon db2-upcoming-${item.type}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div><div class="db2-upcoming-info"><span class="db2-upcoming-title">${item.title}</span><span class="db2-upcoming-time">${item.time}</span></div></div>`;
});
upcomingWidget.innerHTML = `<div class="db2-widget-header"><h3 class="db2-widget-title">Upcoming</h3></div><div class="db2-widget-body"><div class="db2-upcoming-list">${itemsHtml}</div></div>`;
return upcomingWidget;
}, []);

const buildResourcesWidget = useCallback(() => {
const resourcesWidget = document.createElement('div');
resourcesWidget.className = 'db2-widget db2-resources';
const resources = [
{ title: 'Study Guide', desc: 'Tips for effective learning', icon: '📖' },
{ title: 'Keyboard Shortcuts', desc: 'Navigate faster', icon: '⌨️' },
{ title: 'Help Center', desc: 'Get support', icon: '❓' }
];
let resourcesHtml = '';
resources.forEach(resource => {
resourcesHtml += `<div class="db2-resource-item"><span class="db2-resource-icon">${resource.icon}</span><div class="db2-resource-info"><span class="db2-resource-title">${resource.title}</span><span class="db2-resource-desc">${resource.desc}</span></div></div>`;
});
resourcesWidget.innerHTML = `<div class="db2-widget-header"><h3 class="db2-widget-title">Resources</h3></div><div class="db2-widget-body"><div class="db2-resources-list">${resourcesHtml}</div></div>`;
return resourcesWidget;
}, []);

const buildTipsWidget = useCallback(() => {
const tipsWidget = document.createElement('div');
tipsWidget.className = 'db2-widget db2-tips';
const tips = [
'Use spaced repetition for better retention',
'Take breaks every 25 minutes (Pomodoro technique)',
'Review notes within 24 hours of learning',
'Teach concepts to others to solidify understanding',
'Connect new information to what you already know'
];
const randomTip = tips[Math.floor(Math.random() * tips.length)];
tipsWidget.innerHTML = `<div class="db2-widget-header"><h3 class="db2-widget-title">Study Tip</h3></div><div class="db2-widget-body"><div class="db2-tip-content"><div class="db2-tip-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg></div><p class="db2-tip-text">${randomTip}</p></div></div>`;
return tipsWidget;
}, []);

const buildSubjectsWidget = useCallback(() => {
const subjectsWidget = document.createElement('div');
subjectsWidget.className = 'db2-widget db2-subjects';
const subjects = [
{ name: 'Mathematics', progress: 75, color: '#3b82f6' },
{ name: 'Science', progress: 60, color: '#10b981' },
{ name: 'History', progress: 45, color: '#f59e0b' },
{ name: 'Languages', progress: 30, color: '#8b5cf6' }
];
let subjectsHtml = '';
subjects.forEach(subject => {
subjectsHtml += `<div class="db2-subject-item"><div class="db2-subject-header"><span class="db2-subject-name">${subject.name}</span><span class="db2-subject-percent">${subject.progress}%</span></div><div class="db2-subject-progress"><div class="db2-subject-progress-bar" style="width: ${subject.progress}%; background: ${subject.color};"></div></div></div>`;
});
subjectsWidget.innerHTML = `<div class="db2-widget-header"><h3 class="db2-widget-title">Subject Progress</h3></div><div class="db2-widget-body"><div class="db2-subjects-list">${subjectsHtml}</div></div>`;
return subjectsWidget;
}, []);

const buildChallengesWidget = useCallback(() => {
const challengesWidget = document.createElement('div');
challengesWidget.className = 'db2-widget db2-challenges';
const challenges = [
{ title: 'Complete 5 flashcard sets', progress: 3, total: 5, reward: '50 XP' },
{ title: 'Study for 2 hours', progress: 45, total: 120, reward: '100 XP' },
{ title: 'Answer 20 questions', progress: 12, total: 20, reward: '75 XP' }
];
let challengesHtml = '';
challenges.forEach(challenge => {
const percent = (challenge.progress / challenge.total) * 100;
challengesHtml += `<div class="db2-challenge-item"><div class="db2-challenge-info"><span class="db2-challenge-title">${challenge.title}</span><span class="db2-challenge-reward">${challenge.reward}</span></div><div class="db2-challenge-progress"><div class="db2-challenge-progress-bar" style="width: ${percent}%;"></div></div><span class="db2-challenge-status">${challenge.progress}/${challenge.total}</span></div>`;
});
challengesWidget.innerHTML = `<div class="db2-widget-header"><h3 class="db2-widget-title">Daily Challenges</h3></div><div class="db2-widget-body"><div class="db2-challenges-list">${challengesHtml}</div></div>`;
return challengesWidget;
}, []);

const buildLeaderboardWidget = useCallback(() => {
const leaderboardWidget = document.createElement('div');
leaderboardWidget.className = 'db2-widget db2-leaderboard';
const leaders = [
{ name: 'Alex', score: 2450, rank: 1 },
{ name: 'Jordan', score: 2380, rank: 2 },
{ name: 'Taylor', score: 2290, rank: 3 },
{ name: displayName, score: 1850, rank: 15, isUser: true }
];
let leadersHtml = '';
leaders.forEach(leader => {
leadersHtml += `<div class="db2-leader-item ${leader.isUser ? 'db2-leader-user' : ''}"><span class="db2-leader-rank">#${leader.rank}</span><span class="db2-leader-name">${leader.name}</span><span class="db2-leader-score">${leader.score.toLocaleString()} XP</span></div>`;
});
leaderboardWidget.innerHTML = `<div class="db2-widget-header"><h3 class="db2-widget-title">Leaderboard</h3></div><div class="db2-widget-body"><div class="db2-leaders-list">${leadersHtml}</div></div>`;
return leaderboardWidget;
}, [displayName]);

const buildRecentNotesWidget = useCallback(() => {
const recentNotesWidget = document.createElement('div');
recentNotesWidget.className = 'db2-widget db2-recent-notes';
const recentNotes = [
{ title: 'Physics Chapter 5', date: 'Today', preview: 'Newton\'s laws of motion...' },
{ title: 'History Essay Draft', date: 'Yesterday', preview: 'The industrial revolution...' },
{ title: 'Math Formulas', date: '2 days ago', preview: 'Quadratic formula: x = ...' }
];
let notesHtml = '';
recentNotes.forEach(note => {
notesHtml += `<div class="db2-recent-note-item"><div class="db2-recent-note-header"><span class="db2-recent-note-title">${note.title}</span><span class="db2-recent-note-date">${note.date}</span></div><p class="db2-recent-note-preview">${note.preview}</p></div>`;
});
recentNotesWidget.innerHTML = `<div class="db2-widget-header"><h3 class="db2-widget-title">Recent Notes</h3></div><div class="db2-widget-body"><div class="db2-recent-notes-list">${notesHtml}</div><button class="db2-btn db2-btn-secondary db2-view-all-notes">VIEW ALL NOTES</button></div>`;
recentNotesWidget.querySelector('.db2-view-all-notes').addEventListener('click', navigateToNotes);
return recentNotesWidget;
}, [navigateToNotes]);

const buildRecentFlashcardsWidget = useCallback(() => {
const recentFlashcardsWidget = document.createElement('div');
recentFlashcardsWidget.className = 'db2-widget db2-recent-flashcards';
const recentDecks = [
{ title: 'Biology Terms', cards: 25, mastery: 80 },
{ title: 'Spanish Vocabulary', cards: 50, mastery: 65 },
{ title: 'Chemistry Elements', cards: 30, mastery: 45 }
];
let decksHtml = '';
recentDecks.forEach(deck => {
decksHtml += `<div class="db2-recent-deck-item"><div class="db2-recent-deck-info"><span class="db2-recent-deck-title">${deck.title}</span><span class="db2-recent-deck-cards">${deck.cards} cards</span></div><div class="db2-recent-deck-mastery"><div class="db2-recent-deck-mastery-bar" style="width: ${deck.mastery}%;"></div></div><span class="db2-recent-deck-percent">${deck.mastery}%</span></div>`;
});
recentFlashcardsWidget.innerHTML = `<div class="db2-widget-header"><h3 class="db2-widget-title">Recent Flashcards</h3></div><div class="db2-widget-body"><div class="db2-recent-decks-list">${decksHtml}</div><button class="db2-btn db2-btn-secondary db2-view-all-flashcards">VIEW ALL FLASHCARDS</button></div>`;
recentFlashcardsWidget.querySelector('.db2-view-all-flashcards').addEventListener('click', navigateToFlashcards);
return recentFlashcardsWidget;
}, [navigateToFlashcards]);

const buildStudySessionsWidget = useCallback(() => {
const sessionsWidget = document.createElement('div');
sessionsWidget.className = 'db2-widget db2-study-sessions';
const sessions = [
{ topic: 'Calculus Review', duration: '45 min', date: 'Today', score: 85 },
{ topic: 'World History', duration: '30 min', date: 'Yesterday', score: 92 },
{ topic: 'Chemistry Lab', duration: '60 min', date: '2 days ago', score: 78 }
];
let sessionsHtml = '';
sessions.forEach(session => {
sessionsHtml += `<div class="db2-session-item"><div class="db2-session-info"><span class="db2-session-topic">${session.topic}</span><span class="db2-session-meta">${session.duration} • ${session.date}</span></div><div class="db2-session-score">${session.score}%</div></div>`;
});
sessionsWidget.innerHTML = `<div class="db2-widget-header"><h3 class="db2-widget-title">Study Sessions</h3></div><div class="db2-widget-body"><div class="db2-sessions-list">${sessionsHtml}</div></div>`;
return sessionsWidget;
}, []);

const buildFocusModeWidget = useCallback(() => {
const focusWidget = document.createElement('div');
focusWidget.className = 'db2-widget db2-focus-mode';
focusWidget.innerHTML = `<div class="db2-widget-header"><h3 class="db2-widget-title">Focus Mode</h3></div><div class="db2-widget-body"><div class="db2-focus-content"><div class="db2-focus-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div><p class="db2-focus-desc">Start a focused study session with no distractions.</p><button class="db2-btn db2-btn-primary db2-start-focus">START FOCUS SESSION</button></div></div>`;
focusWidget.querySelector('.db2-start-focus').addEventListener('click', () => {
alert('Focus mode coming soon!');
});
return focusWidget;
}, []);

const buildCalendarWidget = useCallback(() => {
const calendarWidget = document.createElement('div');
calendarWidget.className = 'db2-widget db2-calendar-widget';
const today = new Date();
const currentMonth = today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).getDay();
let daysHtml = '';
for (let i = 0; i < firstDay; i++) {
daysHtml += `<div class="db2-calendar-day db2-calendar-day-empty"></div>`;
}
for (let i = 1; i <= daysInMonth; i++) {
const isToday = i === today.getDate();
daysHtml += `<div class="db2-calendar-day ${isToday ? 'db2-calendar-day-today' : ''}">${i}</div>`;
}
calendarWidget.innerHTML = `<div class="db2-widget-header"><h3 class="db2-widget-title">${currentMonth}</h3></div><div class="db2-widget-body"><div class="db2-calendar-weekdays"><span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span></div><div class="db2-calendar-days">${daysHtml}</div></div>`;
return calendarWidget;
}, []);

const buildInsightsWidget = useCallback(() => {
const insightsWidget = document.createElement('div');
insightsWidget.className = 'db2-widget db2-insights';
const insights = learningAnalytics ? [
{ label: 'Best Study Time', value: learningAnalytics.best_time || 'Morning' },
{ label: 'Strongest Subject', value: learningAnalytics.strongest_subject || 'Mathematics' },
{ label: 'Weekly Improvement', value: `+${learningAnalytics.improvement || 15}%` }
] : [
{ label: 'Best Study Time', value: 'Morning' },
{ label: 'Strongest Subject', value: 'Mathematics' },
{ label: 'Weekly Improvement', value: '+15%' }
];
let insightsHtml = '';
insights.forEach(insight => {
insightsHtml += `<div class="db2-insight-item"><span class="db2-insight-label">${insight.label}</span><span class="db2-insight-value">${insight.value}</span></div>`;
});
insightsWidget.innerHTML = `<div class="db2-widget-header"><h3 class="db2-widget-title">Learning Insights</h3></div><div class="db2-widget-body"><div class="db2-insights-list">${insightsHtml}</div><button class="db2-btn db2-btn-secondary db2-view-insights">VIEW DETAILED INSIGHTS</button></div>`;
insightsWidget.querySelector('.db2-view-insights').addEventListener('click', () => navigate('/analytics'));
return insightsWidget;
}, [learningAnalytics, navigate]);

const buildQuickStatsWidget = useCallback(() => {
const quickStatsWidget = document.createElement('div');
quickStatsWidget.className = 'db2-widget db2-quick-stats';
const quickStats = [
{ icon: '🔥', value: stats.streak, label: 'Day Streak' },
{ icon: '❓', value: stats.totalQuestions, label: 'Questions' },
{ icon: '📚', value: stats.totalFlashcards, label: 'Flashcards' },
{ icon: '📝', value: stats.totalNotes, label: 'Notes' }
];
let statsHtml = '';
quickStats.forEach(stat => {
statsHtml += `<div class="db2-quick-stat-item"><span class="db2-quick-stat-icon">${stat.icon}</span><span class="db2-quick-stat-value">${stat.value}</span><span class="db2-quick-stat-label">${stat.label}</span></div>`;
});
quickStatsWidget.innerHTML = `<div class="db2-quick-stats-grid">${statsHtml}</div>`;
return quickStatsWidget;
}, [stats]);

const buildWelcomeWidget = useCallback(() => {
const welcomeWidget = document.createElement('div');
welcomeWidget.className = 'db2-widget db2-welcome';
const hour = new Date().getHours();
let timeOfDay = 'day';
if (hour < 12) timeOfDay = 'morning';
else if (hour < 18) timeOfDay = 'afternoon';
else timeOfDay = 'evening';
welcomeWidget.innerHTML = `<div class="db2-welcome-content"><div class="db2-welcome-text"><h2 class="db2-welcome-greeting">Good ${timeOfDay}, ${displayName}!</h2><p class="db2-welcome-message">Ready to continue your learning journey?</p></div><div class="db2-welcome-actions"><button class="db2-btn db2-btn-primary db2-welcome-start">Start Learning</button><button class="db2-btn db2-btn-secondary db2-welcome-review">Review Progress</button></div></div>`;
welcomeWidget.querySelector('.db2-welcome-start').addEventListener('click', navigateToAI);
welcomeWidget.querySelector('.db2-welcome-review').addEventListener('click', () => navigate('/analytics'));
return welcomeWidget;
}, [displayName, navigateToAI, navigate]);

const buildProgressRingWidget = useCallback(() => {
const progressWidget = document.createElement('div');
progressWidget.className = 'db2-widget db2-progress-ring';
const metrics = [
{ label: 'Questions', value: stats.totalQuestions, max: 100, color: 'var(--accent)' },
{ label: 'Flashcards', value: stats.totalFlashcards, max: 50, color: '#10b981' },
{ label: 'Notes', value: stats.totalNotes, max: 20, color: '#3b82f6' }
];
let ringsHtml = '';
metrics.forEach((metric, index) => {
const percent = Math.min((metric.value / metric.max) * 100, 100);
const circumference = 2 * Math.PI * 35;
const offset = circumference - (percent / 100) * circumference;
const rotation = -90 + (index * 120);
ringsHtml += `<div class="db2-progress-ring-item"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="35" fill="none" stroke="${metric.color}" stroke-opacity="0.2" stroke-width="6"/><circle cx="50" cy="50" r="35" fill="none" stroke="${metric.color}" stroke-width="6" stroke-linecap="square" stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" transform="rotate(${rotation} 50 50)"/></svg><div class="db2-progress-ring-label"><span class="db2-progress-ring-value">${metric.value}</span><span class="db2-progress-ring-text">${metric.label}</span></div></div>`;
});
progressWidget.innerHTML = `<div class="db2-widget-header"><h3 class="db2-widget-title">Progress Overview</h3></div><div class="db2-widget-body"><div class="db2-progress-rings">${ringsHtml}</div></div>`;
return progressWidget;
}, [stats]);

const buildNotificationSettingsWidget = useCallback(() => {
const settingsWidget = document.createElement('div');
settingsWidget.className = 'db2-widget db2-notification-settings';
const settings = [
{ id: 'study-reminders', label: 'Study Reminders', enabled: true },
{ id: 'achievement-alerts', label: 'Achievement Alerts', enabled: true },
{ id: 'weekly-summary', label: 'Weekly Summary', enabled: false },
{ id: 'friend-activity', label: 'Friend Activity', enabled: true }
];
let settingsHtml = '';
settings.forEach(setting => {
settingsHtml += `<div class="db2-setting-item"><span class="db2-setting-label">${setting.label}</span><div class="db2-setting-toggle ${setting.enabled ? 'active' : ''}" data-id="${setting.id}"><div class="db2-setting-toggle-handle"></div></div></div>`;
});
settingsWidget.innerHTML = `<div class="db2-widget-header"><h3 class="db2-widget-title">Notification Settings</h3></div><div class="db2-widget-body"><div class="db2-settings-list">${settingsHtml}</div></div>`;
settingsWidget.querySelectorAll('.db2-setting-toggle').forEach(toggle => {
toggle.addEventListener('click', () => {
toggle.classList.toggle('active');
});
});
return settingsWidget;
}, []);

const buildThemePreviewWidget = useCallback(() => {
const themeWidget = document.createElement('div');
themeWidget.className = 'db2-widget db2-theme-preview';
const themes = [
{ id: 'gold-dark', name: 'Gold', color: '#D7B38C' },
{ id: 'blue-dark', name: 'Ocean', color: '#3B82F6' },
{ id: 'green-dark', name: 'Emerald', color: '#10B981' },
{ id: 'purple-dark', name: 'Royal', color: '#8B5CF6' },
{ id: 'rose-dark', name: 'Rose', color: '#EC4899' }
];
let themesHtml = '';
themes.forEach(theme => {
const isActive = selectedTheme?.id === theme.id;
themesHtml += `<button class="db2-theme-btn ${isActive ? 'active' : ''}" data-theme="${theme.id}" style="--theme-color: ${theme.color};"><span class="db2-theme-dot" style="background: ${theme.color};"></span><span class="db2-theme-name">${theme.name}</span></button>`;
});
themeWidget.innerHTML = `<div class="db2-widget-header"><h3 class="db2-widget-title">Theme</h3></div><div class="db2-widget-body"><div class="db2-themes-grid">${themesHtml}</div></div>`;
return themeWidget;
}, [selectedTheme]);

const buildShortcutsWidget = useCallback(() => {
const shortcutsWidget = document.createElement('div');
shortcutsWidget.className = 'db2-widget db2-shortcuts';
const shortcuts = [
{ keys: ['Ctrl', 'K'], action: 'Quick Search' },
{ keys: ['Ctrl', 'N'], action: 'New Note' },
{ keys: ['Ctrl', 'F'], action: 'New Flashcard' },
{ keys: ['Ctrl', '/'], action: 'AI Chat' }
];
let shortcutsHtml = '';
shortcuts.forEach(shortcut => {
const keysHtml = shortcut.keys.map(key => `<kbd class="db2-shortcut-key">${key}</kbd>`).join('<span class="db2-shortcut-plus">+</span>');
shortcutsHtml += `<div class="db2-shortcut-item"><div class="db2-shortcut-keys">${keysHtml}</div><span class="db2-shortcut-action">${shortcut.action}</span></div>`;
});
shortcutsWidget.innerHTML = `<div class="db2-widget-header"><h3 class="db2-widget-title">Keyboard Shortcuts</h3></div><div class="db2-widget-body"><div class="db2-shortcuts-list">${shortcutsHtml}</div></div>`;
return shortcutsWidget;
}, []);

const buildStorageWidget = useCallback(() => {
const storageWidget = document.createElement('div');
storageWidget.className = 'db2-widget db2-storage';
const usedStorage = 2.4;
const totalStorage = 10;
const usedPercent = (usedStorage / totalStorage) * 100;
storageWidget.innerHTML = `<div class="db2-widget-header"><h3 class="db2-widget-title">Storage</h3></div><div class="db2-widget-body"><div class="db2-storage-info"><span class="db2-storage-used">${usedStorage} GB</span><span class="db2-storage-total">of ${totalStorage} GB used</span></div><div class="db2-storage-bar"><div class="db2-storage-bar-fill" style="width: ${usedPercent}%;"></div></div><div class="db2-storage-breakdown"><div class="db2-storage-item"><span class="db2-storage-item-color" style="background: var(--accent);"></span><span class="db2-storage-item-label">Notes</span><span class="db2-storage-item-size">1.2 GB</span></div><div class="db2-storage-item"><span class="db2-storage-item-color" style="background: #10b981;"></span><span class="db2-storage-item-label">Flashcards</span><span class="db2-storage-item-size">0.8 GB</span></div><div class="db2-storage-item"><span class="db2-storage-item-color" style="background: #3b82f6;"></span><span class="db2-storage-item-label">Media</span><span class="db2-storage-item-size">0.4 GB</span></div></div></div>`;
return storageWidget;
}, []);

const buildActivityFeedWidget = useCallback(() => {
const feedWidget = document.createElement('div');
feedWidget.className = 'db2-widget db2-activity-feed';
const activities = [
{ type: 'achievement', text: 'Earned "Quick Learner" badge', time: '2 hours ago' },
{ type: 'flashcard', text: 'Completed Biology flashcard set', time: '4 hours ago' },
{ type: 'note', text: 'Created new note: Physics Chapter 5', time: 'Yesterday' },
{ type: 'ai', text: 'Had 15-minute AI tutoring session', time: 'Yesterday' },
{ type: 'streak', text: 'Extended study streak to 7 days!', time: '2 days ago' }
];
let feedHtml = '';
activities.forEach(activity => {
const iconMap = {
achievement: '🏆',
flashcard: '📚',
note: '📝',
ai: '🤖',
streak: '🔥'
};
feedHtml += `<div class="db2-feed-item"><span class="db2-feed-icon">${iconMap[activity.type] || '📌'}</span><div class="db2-feed-content"><span class="db2-feed-text">${activity.text}</span><span class="db2-feed-time">${activity.time}</span></div></div>`;
});
feedWidget.innerHTML = `<div class="db2-widget-header"><h3 class="db2-widget-title">Activity Feed</h3></div><div class="db2-widget-body"><div class="db2-feed-list">${feedHtml}</div></div>`;
return feedWidget;
}, []);

const buildQuickLinksWidget = useCallback(() => {
const linksWidget = document.createElement('div');
linksWidget.className = 'db2-widget db2-quick-links';
const links = [
{ label: 'AI Chat', icon: '💬', action: navigateToAI },
{ label: 'Flashcards', icon: '📚', action: navigateToFlashcards },
{ label: 'Notes', icon: '📝', action: navigateToNotes },
{ label: 'Concepts', icon: '🔗', action: navigateToConcepts },
{ label: 'Social', icon: '👥', action: navigateToSocial },
{ label: 'Profile', icon: '👤', action: openProfile }
];
let linksHtml = '';
links.forEach((link, index) => {
linksHtml += `<button class="db2-quick-link-btn" data-index="${index}"><span class="db2-quick-link-icon">${link.icon}</span><span class="db2-quick-link-label">${link.label}</span></button>`;
});
linksWidget.innerHTML = `<div class="db2-quick-links-grid">${linksHtml}</div>`;
linksWidget.querySelectorAll('.db2-quick-link-btn').forEach((btn, index) => {
btn.addEventListener('click', links[index].action);
});
return linksWidget;
}, [navigateToAI, navigateToFlashcards, navigateToNotes, navigateToConcepts, navigateToSocial, openProfile]);
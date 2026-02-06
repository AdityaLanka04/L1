import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar as CalendarIcon, Clock, FileText, BookOpen, 
  MessageSquare, Award, ChevronLeft, ChevronRight, ArrowLeft,
  X, TrendingUp, Flame, BarChart3, Plus, Bell, AlertCircle,
  CheckSquare, Trash2, Flag, List, Star, CalendarDays, CheckCircle2,
  Circle, ChevronDown, ChevronUp, MoreHorizontal, Edit3, Search,
  Repeat, MapPin, Link, Tag, Sun, FolderPlus, Users, Settings,
  Filter, Download, Upload, Grid, Columns, Menu, EyeOff, Eye,
  Maximize2, Minimize2, RefreshCw, Share2, Copy, Archive,
  Zap, Target, Activity, PieChart, Hash, AtSign, Mail,
  Phone, Video, Coffee, Home, Briefcase, GraduationCap,
  Heart, Star as StarFilled, Bookmark, Layers, Layout
} from 'lucide-react';
import './ActivityTimeline.css';
import { API_URL } from '../config';

const ActivityTimeline = () => {
  const navigate = useNavigate();
  const userName = localStorage.getItem('username');
  
  // Core view states
  const [viewMode, setViewMode] = useState('calendar');
  const [calendarViewType, setCalendarViewType] = useState('week'); // 'day', 'week' or 'month'
  const [timelineViewType, setTimelineViewType] = useState('list'); // 'list' or 'compact'
  const [filterMonth, setFilterMonth] = useState(new Date()); // Month filter for reminders
  
  // Data states
  const [activities, setActivities] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [reminderLists, setReminderLists] = useState([]);
  const [smartListCounts, setSmartListCounts] = useState({});
  
  // Loading and UI states
  const [loading, setLoading] = useState(true);
  const [selectedFilters, setSelectedFilters] = useState(['all', 'note', 'flashcard', 'quiz', 'chat']);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [currentWeekStart, setCurrentWeekStart] = useState(getWeekStart(new Date()));
  const [selectedDay, setSelectedDay] = useState(null);
  const [showDayModal, setShowDayModal] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [showListModal, setShowListModal] = useState(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showActivitiesPopup, setShowActivitiesPopup] = useState(false);
  const [popupActivities, setPopupActivities] = useState([]);
  const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });
  
  // Reminder states
  const [selectedSmartList, setSelectedSmartList] = useState('all');
  const [selectedListId, setSelectedListId] = useState(null);
  const [expandedReminders, setExpandedReminders] = useState({});
  const [editingReminder, setEditingReminder] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);
  
  // Calendar preferences
  const [preferences, setPreferences] = useState({
    showWeekends: true,
    startWeekOnMonday: false,
    timeFormat24h: false,
    showCompletedTasks: true,
    defaultView: 'week',
    theme: 'auto',
    compactMode: false,
    showMiniCalendar: true,
    showTimeline: true,
    enableNotifications: true,
    notificationSound: true
  });
  
  // Time slots for week view
  const [timeSlots, setTimeSlots] = useState(
    Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      label: formatHour(i, preferences.timeFormat24h)
    }))
  );
  
  // Drag and drop states
  const [draggedReminder, setDraggedReminder] = useState(null);
  const [dragOverSlot, setDragOverSlot] = useState(null);
  
  // Refs
  const notificationCheckRef = useRef(null);
  const weekScrollRef = useRef(null);
  const monthScrollRef = useRef(null);
  
  // Forms
  const [reminderForm, setReminderForm] = useState({
    title: '',
    description: '',
    notes: '',
    url: '',
    reminder_date: '',
    due_date: '',
    reminder_type: 'reminder',
    priority: 'none',
    color: 'var(--accent-primary)',
    is_flagged: false,
    notify_before_minutes: 15,
    list_id: null,
    recurring: 'none',
    recurring_interval: 1,
    recurring_end_date: '',
    location: '',
    tags: '',
    attendees: []
  });

  const [listForm, setListForm] = useState({
    name: '',
    color: 'var(--accent-primary)',
    icon: 'list'
  });

  // Helper function to get week start
  function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.setDate(diff));
  }

  // Helper function to format hour
  function formatHour(hour, is24h) {
    if (is24h) {
      return `${hour.toString().padStart(2, '0')}:00`;
    }
    if (hour === 0) return '12 AM';
    if (hour === 12) return '12 PM';
    return hour > 12 ? `${hour - 12} PM` : `${hour} AM`;
  }

  // Icon mappings
  const listIcons = [
    { id: 'list', icon: List, label: 'List' },
    { id: 'star', icon: Star, label: 'Star' },
    { id: 'book', icon: BookOpen, label: 'Book' },
    { id: 'calendar', icon: CalendarDays, label: 'Calendar' },
    { id: 'flag', icon: Flag, label: 'Flag' },
    { id: 'bell', icon: Bell, label: 'Bell' },
    { id: 'briefcase', icon: Briefcase, label: 'Work' },
    { id: 'home', icon: Home, label: 'Home' },
    { id: 'graduation', icon: GraduationCap, label: 'Education' },
    { id: 'heart', icon: Heart, label: 'Personal' },
    { id: 'coffee', icon: Coffee, label: 'Break' },
    { id: 'target', icon: Target, label: 'Goal' }
  ];

  const priorityConfig = {
    none: { color: 'var(--text-secondary)', label: 'None', markers: '' },
    low: { color: 'var(--accent-blue)', label: 'Low', markers: '!' },
    medium: { color: 'var(--accent-warning)', label: 'Medium', markers: '!!' },
    high: { color: 'var(--accent-danger)', label: 'High', markers: '!!!' }
  };

  const reminderTypeIcons = {
    reminder: Bell,
    task: CheckSquare,
    event: CalendarDays,
    meeting: Users,
    call: Phone,
    email: Mail
  };

  // Color palette for customization
  const colorPalette = [
    { id: 'blue', value: 'var(--accent-primary)', label: 'Blue' },
    { id: 'purple', value: 'var(--accent-purple)', label: 'Purple' },
    { id: 'pink', value: 'var(--accent-pink)', label: 'Pink' },
    { id: 'red', value: 'var(--accent-danger)', label: 'Red' },
    { id: 'orange', value: 'var(--accent-warning)', label: 'Orange' },
    { id: 'yellow', value: 'var(--accent-yellow)', label: 'Yellow' },
    { id: 'green', value: 'var(--accent-success)', label: 'Green' },
    { id: 'teal', value: 'var(--accent-teal)', label: 'Teal' }
  ];

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    
    // Load preferences from localStorage
    const savedPrefs = localStorage.getItem('calendarPreferences');
    if (savedPrefs) {
      try {
        setPreferences(JSON.parse(savedPrefs));
      } catch (e) {
        console.error('Failed to load preferences:', e);
      }
    }
  }, []);

  // Save preferences to localStorage
  useEffect(() => {
    localStorage.setItem('calendarPreferences', JSON.stringify(preferences));
    
    // Update time slots when format changes
    setTimeSlots(
      Array.from({ length: 24 }, (_, i) => ({
        hour: i,
        label: formatHour(i, preferences.timeFormat24h)
      }))
    );
  }, [preferences]);

  // Load all data
  useEffect(() => {
    loadAllActivities();
    loadReminders();
    loadReminderLists();
  }, []);

  // Reload reminders when filters change
  useEffect(() => {
    loadReminders();
  }, [selectedSmartList, selectedListId]);
  
  // Reload lists to update counts when reminders change
  useEffect(() => {
    loadReminderLists();
  }, [reminders.length]);

  // Auto-scroll to current time in week view
  useEffect(() => {
    if (calendarViewType === 'week' && weekScrollRef.current) {
      const now = new Date();
      const currentHour = now.getHours();
      const scrollPosition = (currentHour * 80) - 200; // 80px per hour, offset for visibility
      
      setTimeout(() => {
        weekScrollRef.current?.scrollTo({
          top: Math.max(0, scrollPosition),
          behavior: 'smooth'
        });
      }, 100);
    }
  }, [calendarViewType]);

  // Data loading functions
  const loadReminderLists = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/get_reminder_lists?user_id=${userName}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setReminderLists(data.lists || []);
        setSmartListCounts(data.smart_lists || {});
      }
    } catch (error) {
      console.error('Error loading reminder lists:', error);
    }
  };

  const loadReminders = async () => {
    try {
      const token = localStorage.getItem('token');
      let url = `${API_URL}/get_reminders?user_id=${userName}`;
      
      if (selectedSmartList && selectedSmartList !== 'list') {
        url += `&smart_list=${selectedSmartList}`;
      } else if (selectedListId) {
        url += `&list_id=${selectedListId}`;
      }
      
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setReminders(data);
      }
    } catch (error) {
      console.error('Error loading reminders:', error);
    }
  };

  const loadAllActivities = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const allActivities = [];

      // Load Notes
      const notesRes = await fetch(`${API_URL}/get_notes?user_id=${userName}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (notesRes.ok) {
        const notes = await notesRes.json();
        notes.forEach(note => {
          if (!note.is_deleted) {
            allActivities.push({
              id: `note-${note.id}`,
              type: 'note',
              title: note.title || 'Untitled Note',
              content: note.content?.replace(/<[^>]+>/g, '').substring(0, 150),
              timestamp: new Date(note.updated_at),
              color: '#86efac',
              data: note
            });
          }
        });
      }

      // Load Flashcard Sets
      try {
        const flashcardsRes = await fetch(`${API_URL}/get_flashcards?user_id=${userName}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (flashcardsRes.ok) {
          const flashcardData = await flashcardsRes.json();
          if (Array.isArray(flashcardData)) {
            const setGroups = {};
            flashcardData.forEach(card => {
              const setId = card.set_id || 'default';
              if (!setGroups[setId]) {
                setGroups[setId] = {
                  cards: [],
                  setTitle: card.set_title || 'Flashcard Set',
                  createdAt: card.created_at || card.updated_at
                };
              }
              setGroups[setId].cards.push(card);
            });

            Object.entries(setGroups).forEach(([setId, setData]) => {
              allActivities.push({
                id: `flashcard-set-${setId}`,
                type: 'flashcard',
                title: setData.setTitle,
                content: `${setData.cards.length} flashcard${setData.cards.length !== 1 ? 's' : ''}`,
                timestamp: new Date(setData.createdAt),
                color: '#fcd34d',
                data: { setId, cards: setData.cards, cardCount: setData.cards.length }
              });
            });
          }
        }
      } catch (e) {
        console.error('Error loading flashcards:', e);
      }

      // Load Chat Sessions
      const chatRes = await fetch(`${API_URL}/get_chat_sessions?user_id=${userName}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (chatRes.ok) {
        const chats = await chatRes.json();
        chats.sessions?.forEach(chat => {
          allActivities.push({
            id: `chat-${chat.id}`,
            type: 'chat',
            title: chat.title || 'AI Chat Session',
            content: 'AI conversation',
            timestamp: new Date(chat.updated_at),
            color: '#93c5fd',
            data: chat
          });
      });
      }

      allActivities.sort((a, b) => a.timestamp - b.timestamp);
      setActivities(allActivities);
    } catch (error) {
      console.error('Error loading activities:', error);
    } finally {
      setLoading(false);
    }
  };

  // Reminder CRUD operations
  const createReminderList = async () => {
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('user_id', userName);
      formData.append('name', listForm.name);
      formData.append('color', listForm.color);
      formData.append('icon', listForm.icon);

      const res = await fetch(`${API_URL}/create_reminder_list`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      if (res.ok) {
        await loadReminderLists();
        setShowListModal(false);
        setListForm({ name: '', color: 'var(--accent-primary)', icon: 'list' });
      }
    } catch (error) {
      console.error('Error creating list:', error);
    }
  };

  const deleteReminderList = async (listId) => {
    if (!window.confirm('Delete this list and all its reminders?')) return;
    
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_URL}/delete_reminder_list/${listId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      await loadReminderLists();
      await loadReminders();
      if (selectedListId === listId) {
        setSelectedListId(null);
        setSelectedSmartList('all');
      }
    } catch (error) {
      console.error('Error deleting list:', error);
    }
  };

  const createReminder = async () => {
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('user_id', userName);
      
      Object.keys(reminderForm).forEach(key => {
        if (reminderForm[key] !== null && reminderForm[key] !== '') {
          if (key === 'attendees') {
            formData.append(key, JSON.stringify(reminderForm[key]));
          } else {
            formData.append(key, reminderForm[key]);
          }
        }
      });
      
      formData.append('user_timezone', Intl.DateTimeFormat().resolvedOptions().timeZone);
      formData.append('timezone_offset', new Date().getTimezoneOffset());
      
      if (selectedListId && !reminderForm.list_id) {
        formData.append('list_id', selectedListId);
      }

      const res = await fetch(`${API_URL}/create_reminder`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      if (res.ok) {
        await loadReminders();
        await loadReminderLists();
        setShowReminderModal(false);
        resetReminderForm();
      }
    } catch (error) {
      console.error('Error creating reminder:', error);
    }
  };

  const updateReminder = async (reminderId, updates) => {
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      
      Object.keys(updates).forEach(key => {
        if (key === 'attendees') {
          formData.append(key, JSON.stringify(updates[key]));
        } else {
          formData.append(key, updates[key]);
        }
      });

      const res = await fetch(`${API_URL}/update_reminder/${reminderId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      if (res.ok) {
        await loadReminders();
        await loadReminderLists();
      }
    } catch (error) {
      console.error('Error updating reminder:', error);
    }
  };

  const toggleReminderComplete = async (reminder) => {
    const newCompleted = !reminder.is_completed;
    await updateReminder(reminder.id, { is_completed: newCompleted });
  };

  const toggleReminderFlag = async (reminder) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_URL}/toggle_reminder_flag/${reminder.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      await loadReminders();
      await loadReminderLists();
    } catch (error) {
      console.error('Error toggling flag:', error);
    }
  };

  const deleteReminder = async (reminderId) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_URL}/delete_reminder/${reminderId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      await loadReminders();
      await loadReminderLists();
    } catch (error) {
      console.error('Error deleting reminder:', error);
    }
  };

  const resetReminderForm = () => {
    setReminderForm({
      title: '',
      description: '',
      notes: '',
      url: '',
      reminder_date: '',
      due_date: '',
      reminder_type: 'reminder',
      priority: 'none',
      color: 'var(--accent-primary)',
      is_flagged: false,
      notify_before_minutes: 15,
      list_id: selectedListId,
      recurring: 'none',
      recurring_interval: 1,
      recurring_end_date: '',
      location: '',
      tags: '',
      attendees: []
    });
    setEditingReminder(null);
  };

  const openEditReminder = (reminder) => {
    setReminderForm({
      title: reminder.title || '',
      description: reminder.description || '',
      notes: reminder.notes || '',
      url: reminder.url || '',
      reminder_date: reminder.reminder_date ? reminder.reminder_date.slice(0, 16) : '',
      due_date: reminder.due_date ? reminder.due_date.slice(0, 16) : '',
      reminder_type: reminder.reminder_type || 'reminder',
      priority: reminder.priority || 'none',
      color: reminder.color || 'var(--accent-primary)',
      is_flagged: reminder.is_flagged || false,
      notify_before_minutes: reminder.notify_before_minutes || 15,
      list_id: reminder.list_id,
      recurring: reminder.recurring || 'none',
      recurring_interval: reminder.recurring_interval || 1,
      recurring_end_date: reminder.recurring_end_date ? reminder.recurring_end_date.slice(0, 16) : '',
      location: reminder.location || '',
      tags: Array.isArray(reminder.tags) ? reminder.tags.join(', ') : '',
      attendees: reminder.attendees || []
    });
    setEditingReminder(reminder);
    setShowReminderModal(true);
  };

  const saveEditedReminder = async () => {
    if (!editingReminder) return;
    
    await updateReminder(editingReminder.id, reminderForm);
    setShowReminderModal(false);
    resetReminderForm();
  };

  // Drag and drop handlers
  const handleDragStart = (e, reminder) => {
    setDraggedReminder(reminder);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, day, hour) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverSlot({ day, hour });
  };

  const handleDrop = async (e, day, hour) => {
    e.preventDefault();
    if (!draggedReminder) return;

    const newDate = new Date(day);
    newDate.setHours(hour, 0, 0, 0);

    await updateReminder(draggedReminder.id, {
      reminder_date: newDate.toISOString().slice(0, 16)
    });

    setDraggedReminder(null);
    setDragOverSlot(null);
  };

  const handleDragEnd = () => {
    setDraggedReminder(null);
    setDragOverSlot(null);
  };

  // Analytics and stats
  const getActivityStats = () => {
    return {
      total: activities.length,
      notes: activities.filter(a => a.type === 'note').length,
      flashcards: activities.filter(a => a.type === 'flashcard').length,
      quizzes: activities.filter(a => a.type === 'quiz').length,
      chats: activities.filter(a => a.type === 'chat').length,
      streak: calculateStreak()
    };
  };

  const calculateStreak = () => {
    if (activities.length === 0) return 0;
    
    const sortedDates = [...new Set(activities.map(a => a.timestamp.toDateString()))].sort((a, b) => 
      new Date(b) - new Date(a)
    );
    
    let streak = 0;
    let currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    
    for (let dateStr of sortedDates) {
      const date = new Date(dateStr);
      date.setHours(0, 0, 0, 0);
      const diffDays = Math.floor((currentDate - date) / (1000 * 60 * 60 * 24));
      
      if (diffDays === streak) {
        streak++;
      } else if (diffDays > streak) {
        break;
      }
    }
    
    return streak;
  };

  const getProductivityScore = () => {
    const today = new Date();
    const todayActivities = activities.filter(a => 
      a.timestamp.toDateString() === today.toDateString()
    );
    return Math.min(100, Math.round((todayActivities.length / 10) * 100));
  };

  const getMostProductiveTime = () => {
    const hourCounts = {};
    activities.forEach(a => {
      const hour = a.timestamp.getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });
    
    const maxHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0];
    if (!maxHour) return 'N/A';
    
    const hour = parseInt(maxHour[0]);
    return formatHour(hour, preferences.timeFormat24h);
  };

  // Export functionality
  const exportCalendarData = () => {
    const data = {
      activities: activities.map(a => ({
        type: a.type,
        title: a.title,
        date: a.timestamp.toISOString(),
        content: a.content
      })),
      reminders: reminders.map(r => ({
        title: r.title,
        description: r.description,
        date: r.reminder_date,
        priority: r.priority,
        type: r.reminder_type,
        tags: r.tags,
        location: r.location
      })),
      exported_at: new Date().toISOString(),
      user: userName
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `brainwave-calendar-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Navigation
  const handleActivityClick = (activity) => {
    switch (activity.type) {
      case 'note':
        navigate(`/notes/editor/${activity.data.id}`);
        break;
      case 'chat':
        navigate(`/ai-chat/${activity.data.id}`);
        break;
      case 'flashcard':
        navigate('/flashcards');
        break;
      case 'quiz':
        navigate('/quiz-hub');
        break;
      default:
        break;
    }
  };

  const getFilteredActivities = () => {
    if (selectedFilters.includes('all')) return activities;
    return activities.filter(a => selectedFilters.includes(a.type));
  };

  const toggleFilter = (filter) => {
    if (filter === 'all') {
      // If clicking "all", select everything
      setSelectedFilters(['all', 'note', 'flashcard', 'quiz', 'chat']);
    } else {
      // Remove 'all' if it's there
      let newFilters = selectedFilters.filter(f => f !== 'all');
      
      if (newFilters.includes(filter)) {
        // Remove the filter
        newFilters = newFilters.filter(f => f !== filter);
        // If nothing left, select all
        if (newFilters.length === 0) {
          newFilters = ['all', 'note', 'flashcard', 'quiz', 'chat'];
        }
      } else {
        // Add the filter
        newFilters = [...newFilters, filter];
        // If all types are selected, add 'all'
        if (newFilters.length === 4 && 
            newFilters.includes('note') && 
            newFilters.includes('flashcard') && 
            newFilters.includes('quiz') && 
            newFilters.includes('chat')) {
          newFilters = ['all', 'note', 'flashcard', 'quiz', 'chat'];
        }
      }
      
      setSelectedFilters(newFilters);
    }
  };

  // Get activities and reminders for a specific day
  const getItemsForDay = (date) => {
    const dayActivities = getFilteredActivities().filter(activity => 
      activity.timestamp.toDateString() === date.toDateString()
    );
    
    const dayReminders = reminders.filter(reminder => {
      if (!reminder.reminder_date) return false;
      const reminderDate = new Date(reminder.reminder_date);
      return reminderDate.toDateString() === date.toDateString();
    });

    return { activities: dayActivities, reminders: dayReminders };
  };

  // Get items for a specific hour on a specific day
  const getItemsForHour = (date, hour) => {
    const items = getItemsForDay(date);
    
    const hourReminders = items.reminders.filter(r => {
      const reminderDate = new Date(r.reminder_date);
      return reminderDate.getHours() === hour;
    });
    
    const hourActivities = items.activities.filter(a => {
      return a.timestamp.getHours() === hour;
    });

    return { reminders: hourReminders, activities: hourActivities };
  };

  // Calendar helper functions
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = preferences.startWeekOnMonday 
      ? (firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1)
      : firstDay.getDay();

    const days = [];
    const prevMonthDays = new Date(year, month, 0).getDate();
    
    // Previous month days
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      days.push({ 
        date: prevMonthDays - i, 
        isCurrentMonth: false, 
        fullDate: new Date(year, month - 1, prevMonthDays - i) 
      });
    }
    
    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ 
        date: i, 
        isCurrentMonth: true, 
        fullDate: new Date(year, month, i) 
      });
    }
    
    // Next month days to complete grid
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      days.push({ 
        date: i, 
        isCurrentMonth: false, 
        fullDate: new Date(year, month + 1, i) 
      });
    }

    return days;
  };

  const getWeekDays = (startDate) => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      days.push(date);
    }
    return days;
  };

  const isToday = (date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isSameDay = (date1, date2) => {
    return date1.toDateString() === date2.toDateString();
  };

  // Navigation functions
  const goToPreviousMonth = () => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(currentMonth.getMonth() - 1);
    setCurrentMonth(newDate);
  };

  const goToNextMonth = () => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(currentMonth.getMonth() + 1);
    setCurrentMonth(newDate);
  };

  const goToPreviousWeek = () => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(currentWeekStart.getDate() - 7);
    setCurrentWeekStart(newDate);
  };

  const goToNextWeek = () => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(currentWeekStart.getDate() + 7);
    setCurrentWeekStart(newDate);
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentMonth(today);
    setCurrentWeekStart(getWeekStart(today));
    setCalendarViewType('day'); // Switch to day view
  };

  // Render mini calendar (left sidebar)
  const renderMiniCalendar = () => {
    const days = getDaysInMonth(currentMonth);
    const weekDays = preferences.startWeekOnMonday 
      ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
      : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return (
      <div className="at-mini-calendar">
        <div className="at-mini-calendar-header">
          <button className="at-mini-nav-btn" onClick={goToPreviousMonth}>
            <ChevronLeft size={16} />
          </button>
          <h3>{currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h3>
          <button className="at-mini-nav-btn" onClick={goToNextMonth}>
            <ChevronRight size={16} />
          </button>
        </div>
        
        <div className="at-mini-calendar-grid">
          {weekDays.map(day => (
            <div key={day} className="at-mini-calendar-weekday">{day}</div>
          ))}
          
          {days.map((day, index) => {
            const { activities: dayActivities, reminders: dayReminders } = getItemsForDay(day.fullDate);
            const hasItems = dayActivities.length > 0 || dayReminders.length > 0;
            
            return (
              <button
                key={index}
                className={`at-mini-calendar-day ${!day.isCurrentMonth ? 'other-month' : ''} ${isToday(day.fullDate) ? 'today' : ''} ${hasItems ? 'has-items' : ''}`}
                onClick={() => {
                  if (calendarViewType === 'week') {
                    setCurrentWeekStart(getWeekStart(day.fullDate));
                  }
                  setCurrentMonth(day.fullDate);
                }}
              >
                <span className="at-mini-day-number">{day.date}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // Render week view
  const renderWeekView = () => {
    const weekDays = getWeekDays(currentWeekStart);
    const weekDayLabels = preferences.startWeekOnMonday
      ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
      : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return (
      <div className="at-week-view-container">
        <div className="at-week-view-header">
          <div className="at-week-view-nav">
            <button className="at-week-nav-btn" onClick={goToPreviousWeek}>
              <ChevronLeft size={18} />
            </button>
            <div className="at-week-date-range">
              <h2>
                {weekDays[0].toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} - {' '}
                {weekDays[6].toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </h2>
            </div>
            <button className="at-week-nav-btn" onClick={goToNextWeek}>
              <ChevronRight size={18} />
            </button>
          </div>
          
          <div className="at-week-view-actions">
            <button 
              className={`at-toggle-btn ${calendarViewType === 'day' ? 'active' : ''}`}
              onClick={() => setCalendarViewType('day')}
            >
              <Sun size={16} />
              <span>Day</span>
            </button>
            <button 
              className={`at-toggle-btn ${calendarViewType === 'week' ? 'active' : ''}`}
              onClick={() => setCalendarViewType('week')}
            >
              <Columns size={16} />
              <span>Week</span>
            </button>
            <button 
              className={`at-toggle-btn ${calendarViewType === 'month' ? 'active' : ''}`}
              onClick={() => setCalendarViewType('month')}
            >
              <Grid size={16} />
              <span>Month</span>
            </button>
          </div>
        </div>

        {showStats && (
          <div className="at-stats-panel">
            <div className="at-stat-item">
              <div className="at-stat-icon" style={{ background: 'var(--accent-primary)' }}>
                <Activity size={18} />
              </div>
              <div className="at-stat-content">
                <div className="at-stat-value">{getActivityStats().total}</div>
                <div className="at-stat-label">Total Activities</div>
              </div>
            </div>
            <div className="at-stat-item">
              <div className="at-stat-icon" style={{ background: 'var(--accent-warning)' }}>
                <Flame size={18} />
              </div>
              <div className="at-stat-content">
                <div className="at-stat-value">{getActivityStats().streak}</div>
                <div className="at-stat-label">Day Streak</div>
              </div>
            </div>
            <div className="at-stat-item">
              <div className="at-stat-icon" style={{ background: 'var(--accent-success)' }}>
                <Target size={18} />
              </div>
              <div className="at-stat-content">
                <div className="at-stat-value">{getProductivityScore()}%</div>
                <div className="at-stat-label">Productivity</div>
              </div>
            </div>
            <div className="at-stat-item">
              <div className="at-stat-icon" style={{ background: 'var(--accent-purple)' }}>
                <Clock size={18} />
              </div>
              <div className="at-stat-content">
                <div className="at-stat-value">{getMostProductiveTime()}</div>
                <div className="at-stat-label">Peak Time</div>
              </div>
            </div>
          </div>
        )}

        <div className="at-week-view-grid" ref={weekScrollRef}>
          <div className="at-week-view-timeline">
            <div className="at-week-view-corner"></div>
            {timeSlots.map(slot => (
              <div key={slot.hour} className="at-week-timeline-slot">
                <span className="at-week-timeline-label">{slot.label}</span>
              </div>
            ))}
          </div>

          {weekDays.map((day, dayIndex) => {
            const dayLabel = weekDayLabels[dayIndex];
            const dayDate = day.getDate();
            const isTodayDay = isToday(day);

            return (
              <div key={dayIndex} className={`at-week-day-column ${isTodayDay ? 'today' : ''}`}>
                <div className="at-week-day-header">
                  <div className="at-week-day-label">{dayLabel}</div>
                  <div className={`at-week-day-date ${isTodayDay ? 'today' : ''}`}>
                    {dayDate}
                  </div>
                </div>
                
                <div className="at-week-day-slots">
                  {timeSlots.map(slot => {
                    const { reminders: hourReminders, activities: hourActivities } = getItemsForHour(day, slot.hour);
                    const isDragOver = dragOverSlot?.day?.toDateString() === day.toDateString() && dragOverSlot?.hour === slot.hour;

                    return (
                      <div 
                        key={slot.hour} 
                        className={`at-week-time-slot ${isDragOver ? 'drag-over' : ''} ${slot.hour === new Date().getHours() && isTodayDay ? 'current-hour' : ''}`}
                        onDragOver={(e) => handleDragOver(e, day, slot.hour)}
                        onDrop={(e) => handleDrop(e, day, slot.hour)}
                      >
                        {hourReminders.map(reminder => (
                          <div
                            key={reminder.id}
                            className={`at-week-reminder-card ${reminder.is_completed ? 'completed' : ''} ${reminder.is_flagged ? 'flagged' : ''}`}
                            style={{ 
                              background: `${reminder.color}B0`
                            }}
                            draggable
                            onDragStart={(e) => handleDragStart(e, reminder)}
                            onDragEnd={handleDragEnd}
                            onClick={() => openEditReminder(reminder)}
                          >
                            <div className="at-week-reminder-header">
                              <div className="at-week-reminder-time">
                                {new Date(reminder.reminder_date).toLocaleTimeString('en-US', { 
                                  hour: '2-digit', 
                                  minute: '2-digit',
                                  hour12: !preferences.timeFormat24h
                                })}
                              </div>
                              {reminder.is_flagged && (
                                <Flag size={12} className="at-reminder-flag-icon" />
                              )}
                            </div>
                            <div className="at-week-reminder-title">{reminder.title}</div>
                            {reminder.location && (
                              <div className="at-week-reminder-meta">
                                <MapPin size={10} />
                                <span>{reminder.location}</span>
                              </div>
                            )}
                            {reminder.priority !== 'none' && (
                              <div className="at-week-reminder-priority" style={{ color: priorityConfig[reminder.priority].color }}>
                                {priorityConfig[reminder.priority].markers}
                              </div>
                            )}
                          </div>
                        ))}
                        
                        {hourActivities.length > 0 && (
                          <div
                            key={hourActivities[0].id}
                            className={`at-week-activity-card ${hourActivities[0].type}`}
                            style={{
                              background: `${hourActivities[0].color}E0`
                            }}
                            onClick={() => handleActivityClick(hourActivities[0])}
                          >
                            <div className="at-week-activity-header">
                              <div className="at-week-activity-icon">
                                {hourActivities[0].type === 'note' && <FileText size={12} />}
                                {hourActivities[0].type === 'flashcard' && <BookOpen size={12} />}
                                {hourActivities[0].type === 'quiz' && <Award size={12} />}
                                {hourActivities[0].type === 'chat' && <MessageSquare size={12} />}
                              </div>
                              <div className="at-week-activity-time">
                                {hourActivities[0].timestamp.toLocaleTimeString('en-US', { 
                                  hour: '2-digit', 
                                  minute: '2-digit',
                                  hour12: !preferences.timeFormat24h
                                })}
                              </div>
                            </div>
                            <div className="at-week-activity-title">{hourActivities[0].title}</div>
                            {hourActivities.length > 1 && (
                              <div 
                                className="at-week-more-items"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setPopupPosition({ x: rect.left, y: rect.bottom + 5 });
                                  setPopupActivities(hourActivities);
                                  setShowActivitiesPopup(true);
                                }}
                              >
                                +{hourActivities.length - 1} more
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Render day view (Today's activities and reminders)
  const renderDayView = () => {
    const viewDate = currentMonth; // Use currentMonth as the selected date for day view
    const { activities: dayActivities, reminders: dayReminders } = getItemsForDay(viewDate);
    
    return (
      <div className="at-week-view-container">
        <div className="at-week-view-header">
          <div className="at-week-view-nav">
            <button className="at-week-nav-btn" onClick={() => {
              const prevDay = new Date(viewDate);
              prevDay.setDate(viewDate.getDate() - 1);
              setCurrentMonth(prevDay);
            }}>
              <ChevronLeft size={18} />
            </button>
            <div className="at-week-date-range">
              <h2>
                {viewDate.toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  month: 'long', 
                  day: 'numeric',
                  year: 'numeric'
                })}
              </h2>
            </div>
            <button className="at-week-nav-btn" onClick={() => {
              const nextDay = new Date(viewDate);
              nextDay.setDate(viewDate.getDate() + 1);
              setCurrentMonth(nextDay);
            }}>
              <ChevronRight size={18} />
            </button>
          </div>
          
          <div className="at-week-view-actions">
            <button 
              className={`at-toggle-btn ${calendarViewType === 'day' ? 'active' : ''}`}
              onClick={() => setCalendarViewType('day')}
            >
              <Sun size={16} />
              <span>Day</span>
            </button>
            <button 
              className={`at-toggle-btn ${calendarViewType === 'week' ? 'active' : ''}`}
              onClick={() => setCalendarViewType('week')}
            >
              <Columns size={16} />
              <span>Week</span>
            </button>
            <button 
              className={`at-toggle-btn ${calendarViewType === 'month' ? 'active' : ''}`}
              onClick={() => setCalendarViewType('month')}
            >
              <Grid size={16} />
              <span>Month</span>
            </button>
          </div>
        </div>

        <div className="at-day-view-content">
          {/* Reminders Section */}
          {dayReminders.length > 0 && (
            <div className="at-day-section">
              <div className="at-day-section-header">
                <Bell size={18} />
                <h3>Reminders & Tasks</h3>
                <span className="at-day-section-count">{dayReminders.length}</span>
              </div>
              <div className="at-day-items-list">
                {dayReminders.map(reminder => {
                  const ReminderIcon = reminderTypeIcons[reminder.reminder_type] || Bell;
                  return (
                    <div
                      key={reminder.id}
                      className={`at-day-reminder-card ${reminder.is_completed ? 'completed' : ''}`}
                      style={{ borderLeft: `4px solid ${reminder.color}` }}
                    >
                      <div className="at-day-reminder-header">
                        <button
                          className="at-reminder-checkbox"
                          onClick={() => toggleReminderComplete(reminder)}
                        >
                          {reminder.is_completed ? (
                            <CheckCircle2 size={20} style={{ color: reminder.color }} />
                          ) : (
                            <Circle size={20} style={{ color: reminder.color }} />
                          )}
                        </button>
                        <div className="at-day-reminder-info">
                          <h4 className={reminder.is_completed ? 'completed-text' : ''}>
                            {reminder.title}
                          </h4>
                          {reminder.reminder_date && (
                            <div className="at-day-reminder-time">
                              <Clock size={14} />
                              {new Date(reminder.reminder_date).toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: !preferences.timeFormat24h
                              })}
                            </div>
                          )}
                        </div>
                        <div className="at-day-reminder-actions">
                          {reminder.priority !== 'none' && (
                            <span 
                              className="at-reminder-priority-badge"
                              style={{ color: priorityConfig[reminder.priority].color }}
                            >
                              {priorityConfig[reminder.priority].markers}
                            </span>
                          )}
                          <button
                            className="at-reminder-flag-btn"
                            onClick={() => toggleReminderFlag(reminder)}
                          >
                            <Flag 
                              size={16} 
                              fill={reminder.is_flagged ? 'var(--accent-danger)' : 'none'}
                              color={reminder.is_flagged ? 'var(--accent-danger)' : 'var(--text-tertiary)'}
                            />
                          </button>
                          <button
                            className="at-reminder-edit-btn"
                            onClick={() => openEditReminder(reminder)}
                          >
                            <Edit3 size={16} />
                          </button>
                        </div>
                      </div>
                      {reminder.description && (
                        <p className="at-day-reminder-description">{reminder.description}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Activities Section */}
          {dayActivities.length > 0 && (
            <div className="at-day-section">
              <div className="at-day-section-header">
                <Activity size={18} />
                <h3>Activities</h3>
                <span className="at-day-section-count">{dayActivities.length}</span>
              </div>
              <div className="at-day-items-list">
                {dayActivities.map(activity => {
                  const ActivityIcon = activity.type === 'note' ? FileText :
                                      activity.type === 'flashcard' ? BookOpen :
                                      activity.type === 'chat' ? MessageSquare :
                                      activity.type === 'quiz' ? Award : FileText;
                  
                  return (
                    <div
                      key={activity.id}
                      className="at-day-activity-card"
                      style={{ borderLeft: `4px solid ${activity.color}` }}
                      onClick={() => handleActivityClick(activity)}
                    >
                      <div className="at-day-activity-icon" style={{ background: `${activity.color}30` }}>
                        <ActivityIcon size={18} style={{ color: activity.color }} />
                      </div>
                      <div className="at-day-activity-info">
                        <h4>{activity.title}</h4>
                        <p className="at-day-activity-content">{activity.content}</p>
                        <div className="at-day-activity-time">
                          <Clock size={14} />
                          {activity.timestamp.toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: !preferences.timeFormat24h
                          })}
                        </div>
                      </div>
                      <div className="at-day-activity-type">
                        {activity.type}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty State */}
          {dayReminders.length === 0 && dayActivities.length === 0 && (
            <div className="at-day-empty-state">
              <Sun size={48} />
              <h3>Nothing scheduled for this day</h3>
              <p>No activities or reminders found.</p>
              <button 
                className="at-view-action-btn primary"
                onClick={() => setShowReminderModal(true)}
              >
                <Plus size={16} />
                <span>Add Reminder</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render month view
  const renderMonthView = () => {
    const days = getDaysInMonth(currentMonth);
    const weekDays = preferences.startWeekOnMonday
      ? ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
      : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    return (
      <div className="at-month-view-container" ref={monthScrollRef}>
        <div className="at-month-view-header">
          <div className="at-month-view-nav">
            <button className="at-month-nav-btn" onClick={goToPreviousMonth}>
              <ChevronLeft size={18} />
            </button>
            <h2>{currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h2>
            <button className="at-month-nav-btn" onClick={goToNextMonth}>
              <ChevronRight size={18} />
            </button>
          </div>
          
          <div className="at-month-view-actions">
            <button 
              className={`at-toggle-btn ${calendarViewType === 'day' ? 'active' : ''}`}
              onClick={() => setCalendarViewType('day')}
            >
              <Sun size={16} />
              <span>Day</span>
            </button>
            <button 
              className={`at-toggle-btn ${calendarViewType === 'week' ? 'active' : ''}`}
              onClick={() => setCalendarViewType('week')}
            >
              <Columns size={16} />
              <span>Week</span>
            </button>
            <button 
              className={`at-toggle-btn ${calendarViewType === 'month' ? 'active' : ''}`}
              onClick={() => setCalendarViewType('month')}
            >
              <Grid size={16} />
              <span>Month</span>
            </button>
          </div>
        </div>

        {showStats && (
          <div className="at-stats-panel">
            <div className="at-stat-item">
              <div className="at-stat-icon" style={{ background: 'var(--accent-primary)' }}>
                <Activity size={18} />
              </div>
              <div className="at-stat-content">
                <div className="at-stat-value">{getActivityStats().total}</div>
                <div className="at-stat-label">Total Activities</div>
              </div>
            </div>
            <div className="at-stat-item">
              <div className="at-stat-icon" style={{ background: 'var(--accent-warning)' }}>
                <Flame size={18} />
              </div>
              <div className="at-stat-content">
                <div className="at-stat-value">{getActivityStats().streak}</div>
                <div className="at-stat-label">Day Streak</div>
              </div>
            </div>
            <div className="at-stat-item">
              <div className="at-stat-icon" style={{ background: 'var(--accent-success)' }}>
                <FileText size={18} />
              </div>
              <div className="at-stat-content">
                <div className="at-stat-value">{getActivityStats().notes}</div>
                <div className="at-stat-label">Notes</div>
              </div>
            </div>
            <div className="at-stat-item">
              <div className="at-stat-icon" style={{ background: 'var(--accent-purple)' }}>
                <BookOpen size={18} />
              </div>
              <div className="at-stat-content">
                <div className="at-stat-value">{getActivityStats().flashcards}</div>
                <div className="at-stat-label">Flashcards</div>
              </div>
            </div>
          </div>
        )}

        <div className="at-month-view-grid">
          {weekDays.map(day => (
            <div key={day} className="at-month-weekday-header">{day}</div>
          ))}
          
          {days.map((day, index) => {
            const { activities: dayActivities, reminders: dayReminders } = getItemsForDay(day.fullDate);
            const totalItems = dayActivities.length + dayReminders.length;
            const displayItems = [...dayReminders.slice(0, 2), ...dayActivities.slice(0, 2 - Math.min(dayReminders.length, 2))];
            
            return (
              <div
                key={index}
                className={`at-month-day-cell ${!day.isCurrentMonth ? 'other-month' : ''} ${isToday(day.fullDate) ? 'today' : ''} ${totalItems > 0 ? 'has-items' : ''}`}
                onClick={() => {
                  if (totalItems > 0) {
                    setSelectedDay({ 
                      date: day.fullDate, 
                      activities: dayActivities, 
                      reminders: dayReminders 
                    });
                    setShowDayModal(true);
                  }
                }}
              >
                <div className="at-month-day-header">
                  <span className="at-month-day-number">{day.date}</span>
                  {totalItems > 0 && (
                    <span className="at-month-day-count">{totalItems}</span>
                  )}
                </div>
                
                <div className="at-month-day-items">
                  {displayItems.map((item, itemIndex) => {
                    if (item.reminder_date) {
                      // It's a reminder
                      return (
                        <div
                          key={`reminder-${item.id}`}
                          className={`at-month-item-card reminder ${item.is_completed ? 'completed' : ''}`}
                          style={{ 
                            borderLeft: `3px solid ${item.color}`,
                            background: `${item.color}15`
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditReminder(item);
                          }}
                        >
                          <div className="at-month-item-time">
                            {new Date(item.reminder_date).toLocaleTimeString('en-US', { 
                              hour: '2-digit', 
                              minute: '2-digit',
                              hour12: !preferences.timeFormat24h
                            })}
                          </div>
                          <div className="at-month-item-title">{item.title}</div>
                          {item.is_flagged && <Flag size={10} className="at-month-item-flag" />}
                        </div>
                      );
                    } else {
                      // It's an activity
                      return (
                        <div
                          key={item.id}
                          className={`at-month-item-card activity ${item.type}`}
                          style={{
                            borderLeft: `3px solid ${item.color}`,
                            background: `${item.color}15`
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleActivityClick(item);
                          }}
                        >
                          <div className="at-month-item-icon">
                            {item.type === 'note' && <FileText size={10} />}
                            {item.type === 'flashcard' && <BookOpen size={10} />}
                            {item.type === 'quiz' && <Award size={10} />}
                            {item.type === 'chat' && <MessageSquare size={10} />}
                          </div>
                          <div className="at-month-item-title">{item.title}</div>
                        </div>
                      );
                    }
                  })}
                  {totalItems > 2 && (
                    <div className="at-month-more-items">
                      +{totalItems - 2} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Render timeline view
  const renderTimeline = () => {
    const filtered = getFilteredActivities();
    
    if (filtered.length === 0) {
      return (
        <div className="at-empty-state">
          <div className="at-empty-state-icon">
            <Clock size={64} />
          </div>
          <h3>No activities yet</h3>
          <p>Your activity timeline will appear here</p>
        </div>
      );
    }

    const grouped = {};
    filtered.forEach(activity => {
      const dateKey = activity.timestamp.toDateString();
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(activity);
    });

    return (
      <div className="at-timeline-view-container">
        <div className="at-timeline-header-section">
          <h2>Activity Timeline</h2>
          <div className="at-timeline-actions">
            <button className="at-view-action-btn" onClick={exportCalendarData}>
              <Download size={16} />
              <span>Export</span>
            </button>
          </div>
        </div>

        <div className="at-timeline-list">
          <div className="at-timeline-line"></div>
          {Object.entries(grouped).map(([date, items]) => (
            <div key={date} className="at-timeline-date-group">
              <div className="at-timeline-date-badge">
                <CalendarDays size={14} />
                <span>{new Date(date).toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  month: 'long', 
                  day: 'numeric',
                  year: 'numeric'
                })}</span>
              </div>
              
              <div className="at-timeline-items">
                {items.map(activity => (
                  <div 
                    key={activity.id} 
                    className={`at-timeline-activity-card ${activity.type}`}
                    onClick={() => handleActivityClick(activity)}
                    style={{
                      borderLeft: `3px solid ${activity.color}`,
                      background: `${activity.color}10`
                    }}
                  >
                    <div className="at-timeline-activity-dot" style={{ background: activity.color }}></div>
                    <div className="at-timeline-activity-content">
                      <div className="at-timeline-activity-header">
                        <div className="at-timeline-activity-icon" style={{ background: activity.color }}>
                          {activity.type === 'note' && <FileText size={16} />}
                          {activity.type === 'flashcard' && <BookOpen size={16} />}
                          {activity.type === 'quiz' && <Award size={16} />}
                          {activity.type === 'chat' && <MessageSquare size={16} />}
                        </div>
                        <div className="at-timeline-activity-info">
                          <div className="at-timeline-activity-title">{activity.title}</div>
                          <div className="at-timeline-activity-time">
                            <Clock size={12} />
                            {activity.timestamp.toLocaleTimeString('en-US', { 
                              hour: '2-digit', 
                              minute: '2-digit',
                              hour12: !preferences.timeFormat24h
                            })}
                          </div>
                        </div>
                      </div>
                      {activity.content && (
                        <div className="at-timeline-activity-description">{activity.content}</div>
                      )}
                      <div className="at-timeline-activity-badge">{activity.type}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Render reminders view
  const renderReminders = () => {
    // Start with all reminders from backend (already filtered by smart list)
    let filteredReminders = reminders;
    
    // Apply search filter
    if (searchQuery) {
      filteredReminders = filteredReminders.filter(r => 
        r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.description && r.description.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }
    
    // Apply month filter only if a specific month is selected (not current month)
    const currentMonth = new Date();
    const isCurrentMonth = filterMonth.getMonth() === currentMonth.getMonth() && 
                          filterMonth.getFullYear() === currentMonth.getFullYear();
    
    if (!isCurrentMonth) {
      filteredReminders = filteredReminders.filter(r => {
        if (!r.reminder_date) return true; // Show reminders without dates
        const reminderDate = new Date(r.reminder_date);
        return reminderDate.getMonth() === filterMonth.getMonth() && 
               reminderDate.getFullYear() === filterMonth.getFullYear();
      });
    }

    return (
      <div className="at-reminders-view-container">
        <div className="at-reminders-sidebar">
          <div className="at-sidebar-section">
            <h4 className="at-sidebar-section-title">Smart Lists</h4>
            <div className="at-smart-lists">
              <button 
                className={`at-smart-list-item ${selectedSmartList === 'today' && !selectedListId ? 'active' : ''}`}
                onClick={() => { setSelectedSmartList('today'); setSelectedListId(null); }}
              >
                <div className="at-smart-list-icon today">
                  <Sun size={16} />
                </div>
                <span className="at-smart-list-name">Today</span>
                <span className="at-smart-list-count">{smartListCounts.today || 0}</span>
              </button>
              
              <button 
                className={`at-smart-list-item ${selectedSmartList === 'scheduled' && !selectedListId ? 'active' : ''}`}
                onClick={() => { setSelectedSmartList('scheduled'); setSelectedListId(null); }}
              >
                <div className="at-smart-list-icon scheduled">
                  <CalendarDays size={16} />
                </div>
                <span className="at-smart-list-name">Scheduled</span>
                <span className="at-smart-list-count">{smartListCounts.scheduled || 0}</span>
              </button>
              
              <button 
                className={`at-smart-list-item ${selectedSmartList === 'flagged' && !selectedListId ? 'active' : ''}`}
                onClick={() => { setSelectedSmartList('flagged'); setSelectedListId(null); }}
              >
                <div className="at-smart-list-icon flagged">
                  <Flag size={16} />
                </div>
                <span className="at-smart-list-name">Flagged</span>
                <span className="at-smart-list-count">{smartListCounts.flagged || 0}</span>
              </button>
              
              <button 
                className={`at-smart-list-item ${selectedSmartList === 'all' && !selectedListId ? 'active' : ''}`}
                onClick={() => { setSelectedSmartList('all'); setSelectedListId(null); }}
              >
                <div className="at-smart-list-icon all">
                  <List size={16} />
                </div>
                <span className="at-smart-list-name">All</span>
                <span className="at-smart-list-count">{smartListCounts.all || 0}</span>
              </button>
              
              <button 
                className={`at-smart-list-item ${selectedSmartList === 'completed' && !selectedListId ? 'active' : ''}`}
                onClick={() => { setSelectedSmartList('completed'); setSelectedListId(null); }}
              >
                <div className="at-smart-list-icon completed">
                  <CheckCircle2 size={16} />
                </div>
                <span className="at-smart-list-name">Completed</span>
                <span className="at-smart-list-count">{smartListCounts.completed || 0}</span>
              </button>
            </div>
          </div>

          <div className="at-sidebar-divider"></div>

          <div className="at-sidebar-section">
            <div className="at-sidebar-section-header">
              <h4 className="at-sidebar-section-title">My Lists</h4>
              <button 
                className="at-sidebar-add-btn" 
                onClick={() => setShowListModal(true)}
              >
                <Plus size={14} />
              </button>
            </div>
            
            <div className="at-user-lists">
              {reminderLists.length === 0 ? (
                <div className="at-empty-lists">
                  <p>No custom lists yet</p>
                </div>
              ) : (
                reminderLists.map(list => {
                  const IconComponent = listIcons.find(i => i.id === list.icon)?.icon || List;
                  return (
                    <button 
                      key={list.id}
                      className={`at-user-list-item ${selectedListId === list.id ? 'active' : ''}`}
                      onClick={() => { 
                        setSelectedListId(list.id); 
                        setSelectedSmartList('list'); 
                      }}
                    >
                      <div className="at-user-list-icon" style={{ background: list.color }}>
                        <IconComponent size={12} />
                      </div>
                      <span className="at-user-list-name">{list.name}</span>
                      <span className="at-user-list-count">{list.reminder_count || 0}</span>
                      <button 
                        className="at-user-list-delete"
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          deleteReminderList(list.id); 
                        }}
                      >
                        <Trash2 size={11} />
                      </button>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="at-reminders-main-content">
          <div className="at-reminders-content-header">
            <h2>
              {selectedSmartList === 'today' && !selectedListId && 'Today'}
              {selectedSmartList === 'scheduled' && !selectedListId && 'Scheduled'}
              {selectedSmartList === 'flagged' && !selectedListId && 'Flagged'}
              {selectedSmartList === 'all' && !selectedListId && 'All Reminders'}
              {selectedSmartList === 'completed' && !selectedListId && 'Completed'}
              {selectedListId && reminderLists.find(l => l.id === selectedListId)?.name}
            </h2>
            
            <div className="at-reminders-toolbar">
              <div className="at-search-input-wrapper">
                <Search size={16} />
                <input 
                  type="text" 
                  placeholder="Search reminders..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="at-search-input"
                />
              </div>
              
              <div className="at-month-filter-wrapper">
                <button 
                  className="at-month-nav-btn"
                  onClick={() => {
                    const newMonth = new Date(filterMonth);
                    newMonth.setMonth(newMonth.getMonth() - 1);
                    setFilterMonth(newMonth);
                  }}
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="at-month-filter-label">
                  {filterMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </span>
                <button 
                  className="at-month-nav-btn"
                  onClick={() => {
                    const newMonth = new Date(filterMonth);
                    newMonth.setMonth(newMonth.getMonth() + 1);
                    setFilterMonth(newMonth);
                  }}
                >
                  <ChevronRight size={14} />
                </button>
                <button 
                  className="at-month-reset-btn"
                  onClick={() => setFilterMonth(new Date())}
                  title="Reset to current month"
                >
                  <RefreshCw size={14} />
                </button>
              </div>
            </div>
          </div>

          <div className="at-reminders-list-content">
            {filteredReminders.length === 0 ? (
              <div className="at-empty-state">
                <div className="at-empty-state-icon">
                  <Bell size={64} />
                </div>
                <h3>No reminders</h3>
                <p>Create a new reminder to get started</p>
                <button 
                  className="at-empty-state-btn"
                  onClick={() => { 
                    resetReminderForm(); 
                    setShowReminderModal(true); 
                  }}
                >
                  <Plus size={16} />
                  <span>Create Reminder</span>
                </button>
              </div>
            ) : (
              filteredReminders.map(reminder => (
                <div 
                  key={reminder.id} 
                  className={`at-reminder-list-item ${reminder.is_completed ? 'completed' : ''} ${reminder.is_flagged ? 'flagged' : ''}`}
                  style={{ color: reminder.color }}
                >
                  <button 
                    className="at-reminder-checkbox-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleReminderComplete(reminder);
                    }}
                  >
                    {reminder.is_completed ? (
                      <CheckCircle2 size={22} style={{ color: reminder.color }} />
                    ) : (
                      <Circle size={22} style={{ color: reminder.color }} />
                    )}
                  </button>
                  
                  <div className="at-reminder-content-area">
                    <div className="at-reminder-main-info">
                      <div className="at-reminder-title-row">
                        <span className="at-reminder-title-text">{reminder.title}</span>
                        {reminder.priority !== 'none' && (
                          <span 
                            className="at-reminder-priority-badge"
                            style={{ color: priorityConfig[reminder.priority].color }}
                          >
                            {priorityConfig[reminder.priority].markers}
                          </span>
                        )}
                      </div>
                      
                      {reminder.description && (
                        <p className="at-reminder-description-text">{reminder.description}</p>
                      )}
                      
                      <div className="at-reminder-dates-row">
                        {reminder.reminder_date ? (
                          <span className="at-reminder-date-badge reminder-date">
                            <CalendarDays size={13} />
                            <span>{new Date(reminder.reminder_date).toLocaleDateString('en-US', { 
                              month: 'short', 
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: !preferences.timeFormat24h
                            })}</span>
                          </span>
                        ) : (
                          <span className="at-reminder-date-badge reminder-date no-date">
                            <CalendarDays size={13} />
                            <span>No due date</span>
                          </span>
                        )}
                        {reminder.created_at && (
                          <span className="at-reminder-date-badge created-date">
                            <Clock size={13} />
                            <span>{new Date(reminder.created_at).toLocaleDateString('en-US', { 
                              month: 'short', 
                              day: 'numeric',
                              year: 'numeric'
                            })}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="at-reminder-actions-panel">
                    <button
                      className="at-reminder-action-btn view-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedDay({ 
                          date: reminder.reminder_date ? new Date(reminder.reminder_date) : new Date(),
                          reminders: [reminder]
                        });
                        setShowDayModal(true);
                      }}
                      title="View details"
                    >
                      <Eye size={18} />
                    </button>
                    <button
                      className="at-reminder-action-btn edit-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditReminder(reminder);
                      }}
                      title="Edit reminder"
                    >
                      <Edit3 size={18} />
                    </button>
                    <button
                      className="at-reminder-action-btn flag-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleReminderFlag(reminder);
                      }}
                      title={reminder.is_flagged ? "Unflag" : "Flag"}
                    >
                      <Flag 
                        size={18} 
                        fill={reminder.is_flagged ? 'currentColor' : 'none'}
                      />
                    </button>
                    <button
                      className="at-reminder-action-btn delete-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm('Are you sure you want to delete this reminder?')) {
                          deleteReminder(reminder.id);
                        }
                      }}
                      title="Delete reminder"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  };

  // Main render
  return (
    <div className="at-activity-timeline-page">
      {/* Top Navigation Bar */}
      <header className="at-profile-header">
        <div className="at-profile-header-left">
          <button className="nav-menu-btn" onClick={() => window.openGlobalNav && window.openGlobalNav()} aria-label="Open navigation">
            <Menu size={20} />
          </button>
          <h1 className="at-profile-logo" onClick={() => navigate('/search-hub')}>
            <div className="at-profile-logo-img" />
            cerbyl
          </h1>
          <div className="at-profile-header-divider"></div>
          <span className="at-profile-subtitle">calendar & timeline</span>
        </div>
        <nav className="at-profile-header-right">
          <button 
            className={`at-profile-nav-btn at-profile-nav-btn-ghost ${showStats ? 'active' : ''}`}
            onClick={() => setShowStats(!showStats)}
          >
            <BarChart3 size={14} />
            <span>Stats</span>
          </button>
          <button 
            className="at-profile-nav-btn at-profile-nav-btn-ghost" 
            onClick={exportCalendarData}
          >
            <Download size={14} />
            <span>Export</span>
          </button>
          <button className="at-profile-nav-btn profile-nav-btn-ghost" onClick={() => navigate('/dashboard')}>
            <span>Dashboard</span>
            <ChevronRight size={14} />
          </button>
        </nav>
      </header>

      {/* Main Content Area */}
      <div className="at-main-content-area">
        {preferences.showMiniCalendar && (
          <aside className="at-left-sidebar">
            {/* View Mode Buttons */}
            <div className="at-sidebar-view-modes">
              <button 
                className={`at-sidebar-view-btn ${viewMode === 'calendar' ? 'active' : ''}`}
                onClick={() => setViewMode('calendar')}
              >
                <CalendarIcon size={14} />
                <span>Calendar</span>
              </button>
              <button 
                className={`at-sidebar-view-btn ${viewMode === 'timeline' ? 'active' : ''}`}
                onClick={() => setViewMode('timeline')}
              >
                <Clock size={14} />
                <span>Timeline</span>
              </button>
              <button 
                className={`at-sidebar-view-btn ${viewMode === 'reminders' ? 'active' : ''}`}
                onClick={() => setViewMode('reminders')}
              >
                <Bell size={14} />
                <span>Reminders</span>
                {smartListCounts.all > 0 && (
                  <span className="at-sidebar-badge">{smartListCounts.all}</span>
                )}
              </button>
            </div>
            
            {viewMode === 'calendar' && renderMiniCalendar()}
            
            {/* Activity Filters Box */}
            {viewMode !== 'reminders' && (
              <div className="at-sidebar-filters">
                <button 
                  className={`at-sidebar-filter-btn ${selectedFilters.includes('all') ? 'active' : ''}`}
                  onClick={() => toggleFilter('all')}
                >
                  <span className="at-filter-checkbox">
                  {selectedFilters.includes('all') && <span className="at-checkbox-dot"></span>}
                </span>
                <span>All Activities</span>
              </button>
              <button 
                className={`at-sidebar-filter-btn ${selectedFilters.includes('note') ? 'active' : ''}`}
                onClick={() => toggleFilter('note')}
                data-color="#86efac"
              >
                <span className="at-filter-checkbox">
                  {selectedFilters.includes('note') && <span className="at-checkbox-dot"></span>}
                </span>
                <span className="at-filter-bullet" style={{ backgroundColor: '#86efac' }}></span>
                <span>Notes</span>
              </button>
              <button 
                className={`at-sidebar-filter-btn ${selectedFilters.includes('flashcard') ? 'active' : ''}`}
                onClick={() => toggleFilter('flashcard')}
                data-color="#fcd34d"
              >
                <span className="at-filter-checkbox">
                  {selectedFilters.includes('flashcard') && <span className="at-checkbox-dot"></span>}
                </span>
                <span className="at-filter-bullet" style={{ backgroundColor: '#fcd34d' }}></span>
                <span>Flashcards</span>
              </button>
              <button 
                className={`at-sidebar-filter-btn ${selectedFilters.includes('quiz') ? 'active' : ''}`}
                onClick={() => toggleFilter('quiz')}
                data-color="#f9a8d4"
              >
                <span className="at-filter-checkbox">
                  {selectedFilters.includes('quiz') && <span className="at-checkbox-dot"></span>}
                </span>
                <span className="at-filter-bullet" style={{ backgroundColor: '#f9a8d4' }}></span>
                <span>Quizzes</span>
              </button>
              <button 
                className={`at-sidebar-filter-btn ${selectedFilters.includes('chat') ? 'active' : ''}`}
                onClick={() => toggleFilter('chat')}
                data-color="#93c5fd"
              >
                <span className="at-filter-checkbox">
                  {selectedFilters.includes('chat') && <span className="at-checkbox-dot"></span>}
                </span>
                <span className="at-filter-bullet" style={{ backgroundColor: '#93c5fd' }}></span>
                <span>AI Chats</span>
              </button>
            </div>
            )}
          </aside>
        )}

        <main className="at-content-main">
          {loading ? (
            <div className="at-loading-container">
              <div className="at-loading-spinner"></div>
              <p>Loading your data...</p>
            </div>
          ) : (
            <>
              {viewMode === 'timeline' && renderTimeline()}
              {viewMode === 'calendar' && (
                <>
                  {calendarViewType === 'day' && renderDayView()}
                  {calendarViewType === 'week' && renderWeekView()}
                  {calendarViewType === 'month' && renderMonthView()}
                </>
              )}
              {viewMode === 'reminders' && renderReminders()}
            </>
          )}
        </main>
      </div>

      {/* Day Detail Modal / Reminder View */}
      {showDayModal && selectedDay && (
        <div className="at-modal-overlay" onClick={() => setShowDayModal(false)}>
          <div className="at-modal-container at-reminder-view-modal" onClick={(e) => e.stopPropagation()}>
            <div className="at-modal-header">
              <h2>
                {selectedDay.reminders?.length === 1 && !selectedDay.activities?.length 
                  ? 'Reminder Details' 
                  : selectedDay.date.toLocaleDateString('en-US', { 
                      weekday: 'long', 
                      month: 'long', 
                      day: 'numeric', 
                      year: 'numeric' 
                    })
                }
              </h2>
              <button className="at-modal-close-btn" onClick={() => setShowDayModal(false)}>
                <X size={20} />
              </button>
            </div>
            
            <div className="at-modal-content">
              {selectedDay.reminders?.length === 1 && !selectedDay.activities?.length ? (
                /* Single Reminder View */
                <div className="at-reminder-detail-view">
                  {selectedDay.reminders.map(reminder => (
                    <div key={reminder.id} className="at-reminder-detail-card">
                      <div className="at-reminder-detail-header">
                        <div className="at-reminder-detail-title-row">
                          <button 
                            className="at-reminder-checkbox-btn"
                            onClick={() => toggleReminderComplete(reminder)}
                          >
                            {reminder.is_completed ? (
                              <CheckCircle2 size={28} style={{ color: reminder.color }} />
                            ) : (
                              <Circle size={28} style={{ color: reminder.color }} />
                            )}
                          </button>
                          <h3 className={reminder.is_completed ? 'completed' : ''}>{reminder.title}</h3>
                          {reminder.is_flagged && (
                            <Flag size={20} fill="var(--accent-warning)" color="var(--accent-warning)" />
                          )}
                        </div>
                        {reminder.priority !== 'none' && (
                          <div className="at-reminder-detail-priority">
                            <span style={{ color: priorityConfig[reminder.priority].color }}>
                              {priorityConfig[reminder.priority].label} Priority {priorityConfig[reminder.priority].markers}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      {reminder.description && (
                        <div className="at-reminder-detail-section">
                          <h4><FileText size={16} /> Description</h4>
                          <p>{reminder.description}</p>
                        </div>
                      )}
                      
                      <div className="at-reminder-detail-info-grid">
                        {reminder.reminder_date && (
                          <div className="at-reminder-detail-info-item">
                            <CalendarDays size={18} />
                            <div>
                              <span className="label">Due Date</span>
                              <span className="value">{new Date(reminder.reminder_date).toLocaleDateString('en-US', { 
                                weekday: 'long',
                                month: 'long', 
                                day: 'numeric',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: !preferences.timeFormat24h
                              })}</span>
                            </div>
                          </div>
                        )}
                        
                        {reminder.created_at && (
                          <div className="at-reminder-detail-info-item">
                            <Clock size={18} />
                            <div>
                              <span className="label">Created</span>
                              <span className="value">{new Date(reminder.created_at).toLocaleDateString('en-US', { 
                                month: 'long', 
                                day: 'numeric',
                                year: 'numeric'
                              })}</span>
                            </div>
                          </div>
                        )}
                        
                        {reminder.location && (
                          <div className="at-reminder-detail-info-item">
                            <MapPin size={18} />
                            <div>
                              <span className="label">Location</span>
                              <span className="value">{reminder.location}</span>
                            </div>
                          </div>
                        )}
                        
                        {reminder.url && (
                          <div className="at-reminder-detail-info-item">
                            <Link size={18} />
                            <div>
                              <span className="label">URL</span>
                              <a href={reminder.url} target="_blank" rel="noopener noreferrer" className="value link">{reminder.url}</a>
                            </div>
                          </div>
                        )}
                        
                        {reminder.recurring !== 'none' && (
                          <div className="at-reminder-detail-info-item">
                            <Repeat size={18} />
                            <div>
                              <span className="label">Repeats</span>
                              <span className="value">{reminder.recurring} {reminder.recurring_interval > 1 ? `(every ${reminder.recurring_interval})` : ''}</span>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <div className="at-reminder-detail-actions">
                        <button 
                          className="at-detail-action-btn edit"
                          onClick={() => {
                            openEditReminder(reminder);
                            setShowDayModal(false);
                          }}
                        >
                          <Edit3 size={18} />
                          <span>EDIT REMINDER</span>
                        </button>
                        <button 
                          className="at-detail-action-btn delete"
                          onClick={() => {
                            if (window.confirm('Are you sure you want to delete this reminder?')) {
                              deleteReminder(reminder.id);
                              setShowDayModal(false);
                            }
                          }}
                        >
                          <Trash2 size={18} />
                          <span>DELETE</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* Day Timeline View */
                <>
                  <div className="at-day-summary">
                    <span>{selectedDay.reminders?.length || 0} reminders</span>
                    <span className="at-summary-divider">•</span>
                    <span>{selectedDay.activities?.length || 0} activities</span>
                  </div>

                  <div className="at-day-timeline">
                {Array.from({ length: 24 }, (_, hour) => {
                  const hourReminders = (selectedDay.reminders || []).filter(r => 
                    new Date(r.reminder_date).getHours() === hour
                  );
                  const hourActivities = selectedDay.activities.filter(a => 
                    a.timestamp.getHours() === hour
                  );
                  
                  if (hourReminders.length === 0 && hourActivities.length === 0) return null;
                  
                  return (
                    <div key={hour} className="at-day-timeline-hour">
                      <div className="at-day-timeline-time">
                        {formatHour(hour, preferences.timeFormat24h)}
                      </div>
                      <div className="at-day-timeline-items">
                        {hourReminders.map(reminder => (
                          <div 
                            key={`r-${reminder.id}`} 
                            className="at-day-timeline-item reminder"
                            style={{
                              borderLeft: `3px solid ${reminder.color}`,
                              background: `${reminder.color}15`
                            }}
                            onClick={() => {
                              openEditReminder(reminder);
                              setShowDayModal(false);
                            }}
                          >
                            <div className="at-day-item-header">
                              <Bell size={14} style={{ color: reminder.color }} />
                              <span className="at-day-item-time">
                                {new Date(reminder.reminder_date).toLocaleTimeString('en-US', { 
                                  hour: '2-digit', 
                                  minute: '2-digit',
                                  hour12: !preferences.timeFormat24h
                                })}
                              </span>
                            </div>
                            <div className="at-day-item-title">{reminder.title}</div>
                            {reminder.description && (
                              <div className="at-day-item-desc">{reminder.description}</div>
                            )}
                          </div>
                        ))}
                        
                        {hourActivities.map(activity => (
                          <div 
                            key={activity.id} 
                            className={`at-day-timeline-item activity ${activity.type}`}
                            style={{
                              borderLeft: `3px solid ${activity.color}`,
                              background: `${activity.color}15`
                            }}
                            onClick={() => {
                              handleActivityClick(activity);
                              setShowDayModal(false);
                            }}
                          >
                            <div className="at-day-item-header">
                              {activity.type === 'note' && <FileText size={14} style={{ color: activity.color }} />}
                              {activity.type === 'flashcard' && <BookOpen size={14} style={{ color: activity.color }} />}
                              {activity.type === 'quiz' && <Award size={14} style={{ color: activity.color }} />}
                              {activity.type === 'chat' && <MessageSquare size={14} style={{ color: activity.color }} />}
                              <span className="at-day-item-time">
                                {activity.timestamp.toLocaleTimeString('en-US', { 
                                  hour: '2-digit', 
                                  minute: '2-digit',
                                  hour12: !preferences.timeFormat24h
                                })}
                              </span>
                            </div>
                            <div className="at-day-item-title">{activity.title}</div>
                            {activity.content && (
                              <div className="at-day-item-desc">{activity.content}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reminder Create/Edit Modal */}
      {showReminderModal && (
        <div className="at-modal-overlay" onClick={() => { setShowReminderModal(false); resetReminderForm(); }}>
          <div className="at-modal-container reminder-modal" onClick={(e) => e.stopPropagation()}>
            <div className="at-modal-header">
              <h2>{editingReminder ? 'Edit Reminder' : 'New Reminder'}</h2>
              <button className="at-modal-close-btn" onClick={() => { setShowReminderModal(false); resetReminderForm(); }}>
                <X size={20} />
              </button>
            </div>
            
            <div className="at-modal-content">
              <div className="at-reminder-form-container">
                {/* Title */}
                <div className="at-form-field">
                  <label className="at-form-label">Title *</label>
                  <input 
                    type="text" 
                    className="at-form-input"
                    value={reminderForm.title} 
                    onChange={(e) => setReminderForm({...reminderForm, title: e.target.value})} 
                    placeholder="What do you need to remember?"
                    autoFocus
                  />
                </div>
                
                {/* Description */}
                <div className="at-form-field">
                  <label className="at-form-label">Description</label>
                  <textarea 
                    className="at-form-textarea"
                    value={reminderForm.description} 
                    onChange={(e) => setReminderForm({...reminderForm, description: e.target.value})} 
                    placeholder="Add details..."
                    rows="3"
                  />
                </div>
                
                {/* Date & Time Row */}
                <div className="at-form-row">
                  <div className="at-form-field">
                    <label className="at-form-label">
                      <CalendarDays size={14} />
                      <span>Date & Time</span>
                    </label>
                    <input 
                      type="datetime-local" 
                      className="at-form-input"
                      value={reminderForm.reminder_date} 
                      onChange={(e) => setReminderForm({...reminderForm, reminder_date: e.target.value})} 
                    />
                  </div>
                  
                  <div className="at-form-field">
                    <label className="at-form-label">
                      <Bell size={14} />
                      <span>Notify Before</span>
                    </label>
                    <select 
                      className="at-form-select"
                      value={reminderForm.notify_before_minutes} 
                      onChange={(e) => setReminderForm({...reminderForm, notify_before_minutes: parseInt(e.target.value)})}
                    >
                      <option value="0">At time</option>
                      <option value="5">5 minutes</option>
                      <option value="15">15 minutes</option>
                      <option value="30">30 minutes</option>
                      <option value="60">1 hour</option>
                      <option value="1440">1 day</option>
                    </select>
                  </div>
                </div>

                {/* Priority & List Row */}
                <div className="at-form-row">
                  <div className="at-form-field">
                    <label className="at-form-label">
                      <Flag size={14} />
                      <span>Priority</span>
                    </label>
                    <select 
                      className="at-form-select"
                      value={reminderForm.priority} 
                      onChange={(e) => setReminderForm({...reminderForm, priority: e.target.value})}
                    >
                      <option value="none">None</option>
                      <option value="low">Low (!)</option>
                      <option value="medium">Medium (!!)</option>
                      <option value="high">High (!!!)</option>
                    </select>
                  </div>
                  
                  <div className="at-form-field">
                    <label className="at-form-label">
                      <List size={14} />
                      <span>List</span>
                    </label>
                    <select 
                      className="at-form-select"
                      value={reminderForm.list_id || ''} 
                      onChange={(e) => setReminderForm({...reminderForm, list_id: e.target.value ? parseInt(e.target.value) : null})}
                    >
                      <option value="">No List</option>
                      {reminderLists.map(list => (
                        <option key={list.id} value={list.id}>{list.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Repeat & Color Row */}
                <div className="at-form-row">
                  <div className="at-form-field">
                    <label className="at-form-label">
                      <Repeat size={14} />
                      <span>Repeat</span>
                    </label>
                    <select 
                      className="at-form-select"
                      value={reminderForm.recurring} 
                      onChange={(e) => setReminderForm({...reminderForm, recurring: e.target.value})}
                    >
                      <option value="none">Never</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </div>
                  
                  <div className="at-form-field">
                    <label className="at-form-label">
                      <Tag size={14} />
                      <span>Color</span>
                    </label>
                    <div className="at-color-picker-grid">
                      {colorPalette.map(color => (
                        <button
                          key={color.id}
                          className={`at-color-option ${reminderForm.color === color.value ? 'selected' : ''}`}
                          style={{ background: color.value }}
                          onClick={() => setReminderForm({...reminderForm, color: color.value})}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Recurring Options */}
                {reminderForm.recurring !== 'none' && (
                  <div className="at-form-row">
                    <div className="at-form-field">
                      <label className="at-form-label">Repeat Every</label>
                      <input 
                        type="number" 
                        className="at-form-input"
                        min="1" 
                        value={reminderForm.recurring_interval} 
                        onChange={(e) => setReminderForm({...reminderForm, recurring_interval: parseInt(e.target.value)})} 
                      />
                    </div>
                    <div className="at-form-field">
                      <label className="at-form-label">End Date (optional)</label>
                      <input 
                        type="datetime-local" 
                        className="at-form-input"
                        value={reminderForm.recurring_end_date} 
                        onChange={(e) => setReminderForm({...reminderForm, recurring_end_date: e.target.value})} 
                      />
                    </div>
                  </div>
                )}

                {/* Location */}
                <div className="at-form-field">
                  <label className="at-form-label">
                    <MapPin size={14} />
                    <span>Location (optional)</span>
                  </label>
                  <input 
                    type="text" 
                    className="at-form-input"
                    value={reminderForm.location} 
                    onChange={(e) => setReminderForm({...reminderForm, location: e.target.value})} 
                    placeholder="Add a location"
                  />
                </div>

                {/* URL */}
                <div className="at-form-field">
                  <label className="at-form-label">
                    <Link size={14} />
                    <span>URL (optional)</span>
                  </label>
                  <input 
                    type="url" 
                    className="at-form-input"
                    value={reminderForm.url} 
                    onChange={(e) => setReminderForm({...reminderForm, url: e.target.value})} 
                    placeholder="Add a link"
                  />
                </div>

                {/* Flag Toggle */}
                <div className="at-form-field checkbox-field">
                  <label className="at-checkbox-label">
                    <input 
                      type="checkbox" 
                      checked={reminderForm.is_flagged} 
                      onChange={(e) => setReminderForm({...reminderForm, is_flagged: e.target.checked})} 
                    />
                    <Flag size={14} />
                    <span>Flag this reminder</span>
                  </label>
                </div>
                
                {/* Action Buttons */}
                <div className="at-form-actions">
                  <button 
                    className="at-form-btn cancel"
                    onClick={() => { 
                      setShowReminderModal(false); 
                      resetReminderForm(); 
                    }}
                  >
                    CANCEL
                  </button>
                  <button 
                    className="at-form-btn primary"
                    onClick={editingReminder ? saveEditedReminder : createReminder} 
                    disabled={!reminderForm.title.trim()}
                  >
                    <span>{editingReminder ? 'SAVE CHANGES' : 'CREATE REMINDER'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* List Create Modal */}
      {showListModal && (
        <div className="at-modal-overlay" onClick={() => setShowListModal(false)}>
          <div className="at-modal-container list-modal" onClick={(e) => e.stopPropagation()}>
            <div className="at-modal-header">
              <h2>Create New List</h2>
              <button className="at-modal-close-btn" onClick={() => setShowListModal(false)}>
                <X size={20} />
              </button>
            </div>
            
            <div className="at-modal-content">
              <div className="at-list-form-container">
                {/* List Name */}
                <div className="at-form-field">
                  <label className="at-form-label">List Name *</label>
                  <input 
                    type="text" 
                    className="at-form-input"
                    value={listForm.name} 
                    onChange={(e) => setListForm({...listForm, name: e.target.value})} 
                    placeholder="Enter list name"
                    autoFocus
                  />
                </div>
                
                {/* Color Picker */}
                <div className="at-form-field">
                  <label className="at-form-label">Color</label>
                  <div className="at-color-picker-grid">
                    {colorPalette.map(color => (
                      <button
                        key={color.id}
                        className={`at-color-option ${listForm.color === color.value ? 'selected' : ''}`}
                        style={{ background: color.value }}
                        onClick={() => setListForm({...listForm, color: color.value})}
                      />
                    ))}
                  </div>
                </div>

                {/* Icon Picker */}
                <div className="at-form-field">
                  <label className="at-form-label">Icon</label>
                  <div className="at-icon-picker-grid">
                    {listIcons.map(({ id, icon: Icon, label }) => (
                      <button
                        key={id}
                        className={`at-icon-picker-btn ${listForm.icon === id ? 'selected' : ''}`}
                        onClick={() => setListForm({...listForm, icon: id})}
                        style={{ 
                          borderColor: listForm.icon === id ? listForm.color : 'transparent',
                          color: listForm.icon === id ? listForm.color : 'var(--text-secondary)'
                        }}
                      >
                        <Icon size={20} />
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Action Buttons */}
                <div className="at-form-actions">
                  <button 
                    className="at-form-btn cancel"
                    onClick={() => setShowListModal(false)}
                  >
                    Cancel
                  </button>
                  <button 
                    className="at-form-btn primary"
                    style={{ background: listForm.color }}
                    onClick={createReminderList} 
                    disabled={!listForm.name.trim()}
                  >
                    <Plus size={16} />
                    <span>Create List</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Activities Popup */}
      {showActivitiesPopup && (
        <div 
          className="at-activities-popup-overlay"
          onClick={() => setShowActivitiesPopup(false)}
        >
          <div 
            className="at-activities-popup"
            style={{
              position: 'fixed',
              left: `${popupPosition.x}px`,
              top: `${popupPosition.y}px`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="at-popup-header">
              <h3>Activities ({popupActivities.length})</h3>
              <button onClick={() => setShowActivitiesPopup(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="at-popup-content">
              {popupActivities.map(activity => (
                <div
                  key={activity.id}
                  className="at-popup-activity-item"
                  style={{ background: `${activity.color}E0` }}
                  onClick={() => {
                    handleActivityClick(activity);
                    setShowActivitiesPopup(false);
                  }}
                >
                  <div className="at-popup-activity-icon">
                    {activity.type === 'note' && <FileText size={14} />}
                    {activity.type === 'flashcard' && <BookOpen size={14} />}
                    {activity.type === 'quiz' && <Award size={14} />}
                    {activity.type === 'chat' && <MessageSquare size={14} />}
                  </div>
                  <div className="at-popup-activity-info">
                    <div className="at-popup-activity-title">{activity.title}</div>
                    <div className="at-popup-activity-time">
                      {activity.timestamp.toLocaleTimeString('en-US', { 
                        hour: '2-digit', 
                        minute: '2-digit',
                        hour12: !preferences.timeFormat24h
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      
      {/* Floating Action Button for New Reminder */}
      {viewMode === 'reminders' && (
        <button 
          className="at-fab-btn"
          onClick={() => {
            resetReminderForm();
            setShowReminderModal(true);
          }}
          title="Create New Reminder"
        >
          <Plus size={24} />
        </button>
      )}
    </div>
  );
};

export default ActivityTimeline;
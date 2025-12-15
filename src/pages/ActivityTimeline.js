import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar as CalendarIcon, Clock, FileText, BookOpen, 
  MessageSquare, Award, ChevronLeft, ChevronRight, ArrowLeft,
  X, TrendingUp, Flame, BarChart3, Plus, Bell, AlertCircle,
  CheckSquare, Trash2, Flag, List, Star, CalendarDays, CheckCircle2,
  Circle, ChevronDown, ChevronUp, MoreHorizontal, Edit3, Search,
  Repeat, MapPin, Link, Tag, Sun, FolderPlus
} from 'lucide-react';
import './ActivityTimeline.css';
import { API_URL } from '../config';

const ActivityTimeline = () => {
  const navigate = useNavigate();
  const userName = localStorage.getItem('username');
  
  const [viewMode, setViewMode] = useState('timeline');
  const [activities, setActivities] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [reminderLists, setReminderLists] = useState([]);
  const [smartListCounts, setSmartListCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);
  const [showDayModal, setShowDayModal] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [showListModal, setShowListModal] = useState(false);
  const [selectedSmartList, setSelectedSmartList] = useState('all');
  const [selectedListId, setSelectedListId] = useState(null);
  const [expandedReminders, setExpandedReminders] = useState({});
  const [editingReminder, setEditingReminder] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);
  const notificationCheckRef = useRef(null);

  const [reminderForm, setReminderForm] = useState({
    title: '',
    description: '',
    notes: '',
    url: '',
    reminder_date: '',
    due_date: '',
    reminder_type: 'reminder',
    priority: 'none',
    color: '#3b82f6',
    is_flagged: false,
    notify_before_minutes: 15,
    list_id: null,
    recurring: 'none',
    recurring_interval: 1,
    recurring_end_date: '',
    location: '',
    tags: ''
  });

  const [listForm, setListForm] = useState({
    name: '',
    color: '#3b82f6',
    icon: 'list'
  });

  const listIcons = [
    { id: 'list', icon: List },
    { id: 'star', icon: Star },
    { id: 'book', icon: BookOpen },
    { id: 'calendar', icon: CalendarDays },
    { id: 'flag', icon: Flag },
    { id: 'bell', icon: Bell }
  ];

  const priorityColors = {
    none: 'var(--text-secondary)',
    low: '#3b82f6',
    medium: '#f59e0b',
    high: '#ef4444'
  };

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Reminder notifications are now handled by the Dashboard component
  // to prevent duplicates. This component focuses on display only.

  // Browser notifications are now handled centrally by the Dashboard component

  useEffect(() => {
    loadAllActivities();
    loadReminders();
    loadReminderLists();
  }, []);

  useEffect(() => {
    loadReminders();
  }, [selectedSmartList, selectedListId]);

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
        setListForm({ name: '', color: '#3b82f6', icon: 'list' });
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
          formData.append(key, reminderForm[key]);
        }
      });
      
      // Add timezone information for better time handling
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

  const fixReminderTimezones = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/fix-reminder-timezones?user_id=${userName}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        console.log('Timezone fix result:', data);
        
        if (data.fixed_reminders && data.fixed_reminders.length > 0) {
          alert(`Fixed ${data.fixed_reminders.length} reminders with incorrect timezones!`);
          await loadReminders(); // Reload to show updated times
        } else {
          alert('No reminders needed timezone fixing.');
        }
      }
    } catch (error) {
      console.error('Error fixing reminder timezones:', error);
      alert('Error fixing reminder timezones. Please try again.');
    }
  };

  const updateReminder = async (reminderId, updates) => {
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      
      Object.keys(updates).forEach(key => {
        formData.append(key, updates[key]);
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

  const addSubtask = async (parentId, title) => {
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('title', title);

      const res = await fetch(`${API_URL}/add_subtask/${parentId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      if (res.ok) {
        await loadReminders();
      }
    } catch (error) {
      console.error('Error adding subtask:', error);
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
      color: '#3b82f6',
      is_flagged: false,
      notify_before_minutes: 15,
      list_id: selectedListId,
      recurring: 'none',
      recurring_interval: 1,
      recurring_end_date: '',
      location: '',
      tags: ''
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
      color: reminder.color || '#3b82f6',
      is_flagged: reminder.is_flagged || false,
      notify_before_minutes: reminder.notify_before_minutes || 15,
      list_id: reminder.list_id,
      recurring: reminder.recurring || 'none',
      recurring_interval: reminder.recurring_interval || 1,
      recurring_end_date: reminder.recurring_end_date ? reminder.recurring_end_date.slice(0, 16) : '',
      location: reminder.location || '',
      tags: Array.isArray(reminder.tags) ? reminder.tags.join(', ') : ''
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
    return `${hour === 0 ? 12 : hour > 12 ? hour - 12 : hour}${hour >= 12 ? 'PM' : 'AM'}`;
  };

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
        type: r.reminder_type
      }))
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `calendar-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const bulkDeleteReminders = async () => {
    if (!window.confirm(`Delete ${selectedItems.length} reminders?`)) return;
    
    for (const id of selectedItems) {
      await deleteReminder(id);
    }
    setSelectedItems([]);
    setBulkMode(false);
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
              data: note
            });
          }
        });
      }

      // Load Flashcard Sets (not individual cards)
      try {
        const flashcardsRes = await fetch(`${API_URL}/get_flashcards?user_id=${userName}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (flashcardsRes.ok) {
          const flashcardData = await flashcardsRes.json();
          if (Array.isArray(flashcardData)) {
            // Group flashcards by set and create one activity per set
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

            // Create one activity per flashcard set
            Object.entries(setGroups).forEach(([setId, setData]) => {
              allActivities.push({
                id: `flashcard-set-${setId}`,
                type: 'flashcard',
                title: setData.setTitle,
                content: `${setData.cards.length} flashcard${setData.cards.length !== 1 ? 's' : ''}`,
                timestamp: new Date(setData.createdAt),
                data: { setId, cards: setData.cards, cardCount: setData.cards.length }
              });
            });
          }
        }
      } catch (e) {
        console.log('Flashcards endpoint not available');
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
            data: chat
          });
        });
      }

      allActivities.sort((a, b) => b.timestamp - a.timestamp);
      setActivities(allActivities);
    } catch (error) {
      console.error('Error loading activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredActivities = () => {
    if (filterType === 'all') return activities;
    return activities.filter(a => a.type === filterType);
  };

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

  const renderTimeline = () => {
    const filtered = getFilteredActivities();
    
    if (filtered.length === 0) {
      return (
        <div className="empty-timeline">
          <Clock size={64} />
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
      <div className="timeline-container">
        <div className="timeline-line"></div>
        {Object.entries(grouped).map(([date, items]) => (
          <div key={date} className="timeline-date-group">
            <div className="timeline-date-header">
              <span className="timeline-date-label">{date}</span>
              <div className="timeline-date-line"></div>
            </div>
            {items.map(activity => (
              <div key={activity.id} className="timeline-item">
                <div className={`timeline-dot ${activity.type}`}></div>
                <div className="timeline-card" onClick={() => handleActivityClick(activity)}>
                  <div className="timeline-card-header">
                    <div className={`timeline-card-icon ${activity.type}`}>
                      {activity.type === 'note' && <FileText size={16} />}
                      {activity.type === 'flashcard' && <BookOpen size={16} />}
                      {activity.type === 'quiz' && <Award size={16} />}
                      {activity.type === 'chat' && <MessageSquare size={16} />}
                    </div>
                    <div className="timeline-card-info">
                      <div className="timeline-card-title">{activity.title}</div>
                      <div className="timeline-card-time">{activity.timestamp.toLocaleTimeString()}</div>
                    </div>
                  </div>
                  {activity.content && <div className="timeline-card-content">{activity.content}</div>}
                  <div className="timeline-card-meta"><span>{activity.type}</span></div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  };

  const renderReminders = () => {
    const filteredReminders = searchQuery 
      ? reminders.filter(r => 
          r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (r.description && r.description.toLowerCase().includes(searchQuery.toLowerCase()))
        )
      : reminders;

    return (
      <div className="reminders-container">
        {/* Sidebar */}
        <div className="reminders-sidebar">
          <div className="sidebar-section">
            <h4>Smart Lists</h4>
            <div className="smart-lists">
              <button 
                className={`smart-list-item ${selectedSmartList === 'today' ? 'active' : ''}`}
                onClick={() => { setSelectedSmartList('today'); setSelectedListId(null); }}
              >
                <div className="smart-list-icon today"><Sun size={18} /></div>
                <span>Today</span>
                <span className="smart-list-count">{smartListCounts.today || 0}</span>
              </button>
              <button 
                className={`smart-list-item ${selectedSmartList === 'scheduled' ? 'active' : ''}`}
                onClick={() => { setSelectedSmartList('scheduled'); setSelectedListId(null); }}
              >
                <div className="smart-list-icon scheduled"><CalendarDays size={18} /></div>
                <span>Scheduled</span>
                <span className="smart-list-count">{smartListCounts.scheduled || 0}</span>
              </button>
              <button 
                className={`smart-list-item ${selectedSmartList === 'flagged' ? 'active' : ''}`}
                onClick={() => { setSelectedSmartList('flagged'); setSelectedListId(null); }}
              >
                <div className="smart-list-icon flagged"><Flag size={18} /></div>
                <span>Flagged</span>
                <span className="smart-list-count">{smartListCounts.flagged || 0}</span>
              </button>
              <button 
                className={`smart-list-item ${selectedSmartList === 'all' ? 'active' : ''}`}
                onClick={() => { setSelectedSmartList('all'); setSelectedListId(null); }}
              >
                <div className="smart-list-icon all"><List size={18} /></div>
                <span>All</span>
                <span className="smart-list-count">{smartListCounts.all || 0}</span>
              </button>
              <button 
                className={`smart-list-item ${selectedSmartList === 'completed' ? 'active' : ''}`}
                onClick={() => { setSelectedSmartList('completed'); setSelectedListId(null); }}
              >
                <div className="smart-list-icon completed"><CheckCircle2 size={18} /></div>
                <span>Completed</span>
                <span className="smart-list-count">{smartListCounts.completed || 0}</span>
              </button>
            </div>
          </div>

          <div className="sidebar-section">
            <div className="sidebar-section-header">
              <h4>My Lists</h4>
              <button className="add-list-btn" onClick={() => setShowListModal(true)} title="Add List">
                <FolderPlus size={16} />
              </button>
            </div>
            <div className="user-lists">
              {reminderLists.map(list => {
                const IconComponent = listIcons.find(i => i.id === list.icon)?.icon || List;
                return (
                  <button 
                    key={list.id}
                    className={`user-list-item ${selectedListId === list.id ? 'active' : ''}`}
                    onClick={() => { setSelectedListId(list.id); setSelectedSmartList('list'); }}
                  >
                    <div className="user-list-icon" style={{ background: list.color }}>
                      <IconComponent size={14} />
                    </div>
                    <span>{list.name}</span>
                    <span className="user-list-count">{list.reminder_count}</span>
                    <button 
                      className="delete-list-btn"
                      onClick={(e) => { e.stopPropagation(); deleteReminderList(list.id); }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="reminders-main">
          <div className="reminders-header">
            <h2>
              {selectedSmartList === 'today' && 'Today'}
              {selectedSmartList === 'scheduled' && 'Scheduled'}
              {selectedSmartList === 'flagged' && 'Flagged'}
              {selectedSmartList === 'all' && 'All Reminders'}
              {selectedSmartList === 'completed' && 'Completed'}
              {selectedSmartList === 'list' && reminderLists.find(l => l.id === selectedListId)?.name}
            </h2>
            <div className="reminders-actions">
              <div className="search-box">
                <Search size={18} />
                <input 
                  type="text" 
                  placeholder="Search reminders..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <button className="add-reminder-btn" onClick={() => { resetReminderForm(); setShowReminderModal(true); }}>
                <Plus size={18} />
                <span>New Reminder</span>
              </button>
            </div>
          </div>

          <div className="reminders-list">
            {filteredReminders.length === 0 ? (
              <div className="empty-reminders">
                <Bell size={48} />
                <h3>No reminders</h3>
                <p>Create a new reminder to get started</p>
              </div>
            ) : (
              filteredReminders.map(reminder => (
                <div 
                  key={reminder.id} 
                  className={`reminder-item ${reminder.is_completed ? 'completed' : ''} ${reminder.is_flagged ? 'flagged' : ''}`}
                >
                  <button 
                    className="reminder-checkbox"
                    onClick={() => toggleReminderComplete(reminder)}
                  >
                    {reminder.is_completed ? (
                      <CheckCircle2 size={22} className="checked" />
                    ) : (
                      <Circle size={22} style={{ color: reminder.color }} />
                    )}
                  </button>
                  
                  <div className="reminder-content" onClick={() => openEditReminder(reminder)}>
                    <div className="reminder-title-row">
                      <span className={`reminder-title ${reminder.is_completed ? 'completed' : ''}`}>
                        {reminder.title}
                      </span>
                      {reminder.priority !== 'none' && (
                        <span className="priority-indicator" style={{ color: priorityColors[reminder.priority] }}>
                          {'!'.repeat(reminder.priority === 'high' ? 3 : reminder.priority === 'medium' ? 2 : 1)}
                        </span>
                      )}
                    </div>
                    
                    {reminder.description && (
                      <div className="reminder-description">{reminder.description}</div>
                    )}
                    
                    <div className="reminder-meta">
                      {reminder.reminder_date && (
                        <span className="reminder-date">
                          <CalendarDays size={12} />
                          {new Date(reminder.reminder_date).toLocaleDateString('en-US', { 
                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
                          })}
                        </span>
                      )}
                      {reminder.recurring !== 'none' && (
                        <span className="reminder-recurring">
                          <Repeat size={12} />
                          {reminder.recurring}
                        </span>
                      )}
                      {reminder.location && (
                        <span className="reminder-location">
                          <MapPin size={12} />
                          {reminder.location}
                        </span>
                      )}
                      {reminder.url && (
                        <span className="reminder-url">
                          <Link size={12} />
                          Link
                        </span>
                      )}
                      {reminder.list_id && (
                        <span className="reminder-list-badge" style={{ 
                          background: reminderLists.find(l => l.id === reminder.list_id)?.color 
                        }}>
                          {reminderLists.find(l => l.id === reminder.list_id)?.name}
                        </span>
                      )}
                    </div>

                    {/* Subtasks */}
                    {reminder.subtasks && reminder.subtasks.length > 0 && (
                      <div className="subtasks-section">
                        <button 
                          className="subtasks-toggle"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedReminders(prev => ({
                              ...prev,
                              [reminder.id]: !prev[reminder.id]
                            }));
                          }}
                        >
                          {expandedReminders[reminder.id] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          {reminder.subtasks.length} subtask{reminder.subtasks.length > 1 ? 's' : ''}
                        </button>
                        {expandedReminders[reminder.id] && (
                          <div className="subtasks-list">
                            {reminder.subtasks.map(subtask => (
                              <div key={subtask.id} className="subtask-item">
                                <button 
                                  className="subtask-checkbox"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleReminderComplete(subtask);
                                  }}
                                >
                                  {subtask.is_completed ? (
                                    <CheckCircle2 size={16} className="checked" />
                                  ) : (
                                    <Circle size={16} />
                                  )}
                                </button>
                                <span className={subtask.is_completed ? 'completed' : ''}>{subtask.title}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="reminder-actions">
                    <button 
                      className={`flag-btn ${reminder.is_flagged ? 'flagged' : ''}`}
                      onClick={() => toggleReminderFlag(reminder)}
                      title="Flag"
                    >
                      <Flag size={16} />
                    </button>
                    <button 
                      className="delete-btn"
                      onClick={() => {
                        if (window.confirm('Delete this reminder?')) {
                          deleteReminder(reminder.id);
                        }
                      }}
                      title="Delete"
                    >
                      <Trash2 size={16} />
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

  const renderCalendar = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    const prevMonthDays = new Date(year, month, 0).getDate();
    
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      days.push({ date: prevMonthDays - i, isCurrentMonth: false, fullDate: new Date(year, month - 1, prevMonthDays - i) });
    }
    
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ date: i, isCurrentMonth: true, fullDate: new Date(year, month, i) });
    }
    
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      days.push({ date: i, isCurrentMonth: false, fullDate: new Date(year, month + 1, i) });
    }

    const getActivitiesForDay = (date) => {
      return getFilteredActivities().filter(activity => 
        activity.timestamp.toDateString() === date.toDateString()
      );
    };

    const getRemindersForDay = (date) => {
      return reminders.filter(reminder => {
        if (!reminder.reminder_date) return false;
        const reminderDate = new Date(reminder.reminder_date);
        return reminderDate.toDateString() === date.toDateString();
      });
    };

    const isToday = (date) => date.toDateString() === new Date().toDateString();

    const handleDayClick = (day, dayActivities, dayReminders) => {
      if (dayActivities.length > 0 || dayReminders.length > 0) {
        setSelectedDay({ date: day.fullDate, activities: dayActivities, reminders: dayReminders });
        setShowDayModal(true);
      }
    };

    return (
      <div className="calendar-container">
        <div className="calendar-nav">
          <h2>{currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h2>
          <div className="calendar-controls">
            <button className="calendar-add-btn" onClick={() => { resetReminderForm(); setShowReminderModal(true); }}>
              <Plus size={16} /> Add Reminder
            </button>
            <button className="calendar-stats-btn" onClick={() => setShowStats(!showStats)}>
              <BarChart3 size={16} /> Stats
            </button>
            <button className="calendar-stats-btn" onClick={() => setShowAnalytics(!showAnalytics)}>
              <TrendingUp size={16} /> Analytics
            </button>
            <button className="calendar-stats-btn" onClick={exportCalendarData}>
              <FileText size={16} /> Export
            </button>
            <div className="calendar-nav-buttons">
              <button className="calendar-nav-btn" onClick={() => setCurrentMonth(new Date(year, month - 1))}>
                <ChevronLeft size={16} />
              </button>
              <button className="calendar-nav-btn" onClick={() => setCurrentMonth(new Date())}>Today</button>
              <button className="calendar-nav-btn" onClick={() => setCurrentMonth(new Date(year, month + 1))}>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>

        {showStats && (
          <div className="calendar-stats">
            <div className="stat-card">
              <div className="stat-icon" style={{ background: '#3b82f6' }}><TrendingUp size={20} /></div>
              <div className="stat-info">
                <div className="stat-value">{getActivityStats().total}</div>
                <div className="stat-label">Total Activities</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: '#f59e0b' }}><Flame size={20} /></div>
              <div className="stat-info">
                <div className="stat-value">{getActivityStats().streak}</div>
                <div className="stat-label">Day Streak</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: '#10b981' }}><FileText size={20} /></div>
              <div className="stat-info">
                <div className="stat-value">{getActivityStats().notes}</div>
                <div className="stat-label">Notes</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: '#8b5cf6' }}><BookOpen size={20} /></div>
              <div className="stat-info">
                <div className="stat-value">{getActivityStats().flashcards}</div>
                <div className="stat-label">Flashcards</div>
              </div>
            </div>
          </div>
        )}

        {showAnalytics && (
          <div className="analytics-panel">
            <h3>Productivity Analytics</h3>
            <div className="analytics-grid">
              <div className="analytics-item">
                <span className="analytics-label">Today's Productivity</span>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${getProductivityScore()}%` }}></div>
                </div>
                <span className="analytics-value">{getProductivityScore()}%</span>
              </div>
              <div className="analytics-item">
                <span className="analytics-label">Most Productive Time</span>
                <span className="analytics-value">{getMostProductiveTime()}</span>
              </div>
              <div className="analytics-item">
                <span className="analytics-label">Upcoming Reminders</span>
                <span className="analytics-value">{smartListCounts.scheduled || 0}</span>
              </div>
            </div>
          </div>
        )}
        
        <div className="calendar-grid">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="calendar-day-header">{day}</div>
          ))}
          
          {days.map((day, index) => {
            const dayActivities = getActivitiesForDay(day.fullDate);
            const dayReminders = getRemindersForDay(day.fullDate);
            const totalItems = dayActivities.length + dayReminders.length;
            
            return (
              <div
                key={index}
                className={`calendar-day ${!day.isCurrentMonth ? 'other-month' : ''} ${isToday(day.fullDate) ? 'today' : ''}`}
                onClick={() => handleDayClick(day, dayActivities, dayReminders)}
                style={{ cursor: totalItems > 0 ? 'pointer' : 'default' }}
              >
                <div className="calendar-day-number">
                  {day.date}
                  {totalItems > 0 && <span className="activity-count-badge">{totalItems}</span>}
                </div>
                <div className="calendar-activities">
                  {dayReminders.slice(0, 2).map(reminder => (
                    <div
                      key={`reminder-${reminder.id}`}
                      className="calendar-reminder"
                      style={{ background: reminder.color, borderLeft: `3px solid ${reminder.color}`, opacity: reminder.is_completed ? 0.5 : 1 }}
                      title={`${reminder.title} - ${new Date(reminder.reminder_date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`}
                    >
                      {reminder.priority === 'high' && <AlertCircle size={10} />}
                      {reminder.is_flagged && <Flag size={10} />}
                      <span>{reminder.title}</span>
                    </div>
                  ))}
                  {dayActivities.slice(0, 2 - Math.min(dayReminders.length, 2)).map(activity => (
                    <div key={activity.id} className={`calendar-activity ${activity.type}`} title={activity.title}>
                      {activity.type === 'note' && <FileText size={10} />}
                      {activity.type === 'flashcard' && <BookOpen size={10} />}
                      {activity.type === 'quiz' && <Award size={10} />}
                      {activity.type === 'chat' && <MessageSquare size={10} />}
                      <span>{activity.title}</span>
                    </div>
                  ))}
                  {totalItems > 3 && <div className="calendar-activity more-activities">+{totalItems - 3} more</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="activity-timeline-page">
      <div className="timeline-header">
        <div className="timeline-header-content">
          <div className="timeline-header-left">
            <h1 onClick={() => navigate('/dashboard')}>cerbyl</h1>
            <span className="timeline-subtitle">activity timeline</span>
          </div>
          <button className="timeline-back-btn" onClick={() => navigate('/dashboard')} title="Back to Dashboard">
            <ChevronLeft size={18} />
            <span>Back</span>
          </button>
        </div>
      </div>

      <div className="timeline-tabs">
        <button className={`timeline-tab ${viewMode === 'timeline' ? 'active' : ''}`} onClick={() => setViewMode('timeline')}>
          <Clock size={16} /> Timeline
        </button>
        <button className={`timeline-tab ${viewMode === 'calendar' ? 'active' : ''}`} onClick={() => setViewMode('calendar')}>
          <CalendarIcon size={16} /> Calendar
        </button>
        <button className={`timeline-tab ${viewMode === 'reminders' ? 'active' : ''}`} onClick={() => setViewMode('reminders')}>
          <Bell size={16} /> Reminders
          {smartListCounts.all > 0 && <span className="tab-badge">{smartListCounts.all}</span>}
        </button>
      </div>

      <div className="timeline-content">
        {viewMode !== 'reminders' && (
          <div className="timeline-filters">
            <button className={`filter-chip ${filterType === 'all' ? 'active' : ''}`} onClick={() => setFilterType('all')}>All Activities</button>
            <button className={`filter-chip ${filterType === 'note' ? 'active' : ''}`} onClick={() => setFilterType('note')}><FileText size={14} /> Notes</button>
            <button className={`filter-chip ${filterType === 'flashcard' ? 'active' : ''}`} onClick={() => setFilterType('flashcard')}><BookOpen size={14} /> Flashcards</button>
            <button className={`filter-chip ${filterType === 'quiz' ? 'active' : ''}`} onClick={() => setFilterType('quiz')}><Award size={14} /> Quizzes</button>
            <button className={`filter-chip ${filterType === 'chat' ? 'active' : ''}`} onClick={() => setFilterType('chat')}><MessageSquare size={14} /> AI Chats</button>
          </div>
        )}

        {loading ? (
          <div className="loading-spinner"><div className="spinner"></div></div>
        ) : (
          <>
            {viewMode === 'timeline' && renderTimeline()}
            {viewMode === 'calendar' && renderCalendar()}
            {viewMode === 'reminders' && renderReminders()}
          </>
        )}
      </div>

      {/* Day Modal */}
      {showDayModal && selectedDay && (
        <div className="day-modal-overlay" onClick={() => setShowDayModal(false)}>
          <div className="day-modal" onClick={(e) => e.stopPropagation()}>
            <div className="day-modal-header">
              <h3>{selectedDay.date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</h3>
              <button onClick={() => setShowDayModal(false)}><X size={20} /></button>
            </div>
            <div className="day-modal-content">
              <div className="day-modal-stats">
                <span>{selectedDay.reminders?.length || 0} reminders, {selectedDay.activities.length} activities</span>
              </div>
              <div className="day-timeline-view">
                {Array.from({ length: 24 }, (_, hour) => {
                  const hourReminders = (selectedDay.reminders || []).filter(r => new Date(r.reminder_date).getHours() === hour);
                  const hourActivities = selectedDay.activities.filter(a => a.timestamp.getHours() === hour);
                  
                  if (hourReminders.length === 0 && hourActivities.length === 0) return null;
                  
                  return (
                    <div key={hour} className="timeline-hour-block">
                      <div className="timeline-hour-label">
                        {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
                      </div>
                      <div className="timeline-hour-items">
                        {hourReminders.map(reminder => (
                          <div key={`reminder-${reminder.id}`} className="timeline-reminder-item" style={{ borderLeftColor: reminder.color }}>
                            <div className="timeline-item-header">
                              <div className="timeline-item-icon" style={{ background: reminder.color }}><Bell size={16} /></div>
                              <div className="timeline-item-info">
                                <div className="timeline-item-title">{reminder.title}</div>
                                <div className="timeline-item-time">
                                  {new Date(reminder.reminder_date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                  <span className="timeline-item-badge">{reminder.priority}</span>
                                </div>
                                {reminder.description && <div className="timeline-item-desc">{reminder.description}</div>}
                              </div>
                              <button className="timeline-item-delete" onClick={async (e) => { e.stopPropagation(); if (window.confirm('Delete this reminder?')) { await deleteReminder(reminder.id); setShowDayModal(false); } }} title="Delete reminder">
                                <X size={16} />
                              </button>
                            </div>
                          </div>
                        ))}
                        {hourActivities.map(activity => (
                          <div key={activity.id} className={`timeline-activity-item ${activity.type}`} onClick={() => { handleActivityClick(activity); setShowDayModal(false); }}>
                            <div className="timeline-item-header">
                              <div className={`timeline-item-icon ${activity.type}`}>
                                {activity.type === 'note' && <FileText size={16} />}
                                {activity.type === 'flashcard' && <BookOpen size={16} />}
                                {activity.type === 'quiz' && <Award size={16} />}
                                {activity.type === 'chat' && <MessageSquare size={16} />}
                              </div>
                              <div className="timeline-item-info">
                                <div className="timeline-item-title">{activity.title}</div>
                                <div className="timeline-item-time">
                                  {activity.timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                  <span className="timeline-item-badge">{activity.type}</span>
                                </div>
                                {activity.content && <div className="timeline-item-desc">{activity.content}</div>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reminder Modal */}
      {showReminderModal && (
        <div className="reminder-modal-overlay" onClick={() => { setShowReminderModal(false); resetReminderForm(); }}>
          <div className="reminder-modal" onClick={(e) => e.stopPropagation()}>
            <div className="reminder-modal-header">
              <h3>{editingReminder ? 'Edit Reminder' : 'New Reminder'}</h3>
              <button onClick={() => { setShowReminderModal(false); resetReminderForm(); }}><X size={20} /></button>
            </div>
            <div className="reminder-modal-content">
              <div className="reminder-form">
                <div className="form-group">
                  <label>Title *</label>
                  <input type="text" value={reminderForm.title} onChange={(e) => setReminderForm({...reminderForm, title: e.target.value})} placeholder="What do you need to remember?" />
                </div>
                
                <div className="form-group">
                  <label>Notes</label>
                  <textarea value={reminderForm.description} onChange={(e) => setReminderForm({...reminderForm, description: e.target.value})} placeholder="Add notes..." rows="2" />
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label><CalendarDays size={14} /> Date & Time</label>
                    <input type="datetime-local" value={reminderForm.reminder_date} onChange={(e) => setReminderForm({...reminderForm, reminder_date: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label><Bell size={14} /> Notify Before</label>
                    <select value={reminderForm.notify_before_minutes} onChange={(e) => setReminderForm({...reminderForm, notify_before_minutes: parseInt(e.target.value)})}>
                      <option value="0">At time of event</option>
                      <option value="5">5 minutes before</option>
                      <option value="15">15 minutes before</option>
                      <option value="30">30 minutes before</option>
                      <option value="60">1 hour before</option>
                      <option value="1440">1 day before</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label><Flag size={14} /> Priority</label>
                    <select value={reminderForm.priority} onChange={(e) => setReminderForm({...reminderForm, priority: e.target.value})}>
                      <option value="none">None</option>
                      <option value="low">Low (!)</option>
                      <option value="medium">Medium (!!)</option>
                      <option value="high">High (!!!)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label><List size={14} /> List</label>
                    <select value={reminderForm.list_id || ''} onChange={(e) => setReminderForm({...reminderForm, list_id: e.target.value ? parseInt(e.target.value) : null})}>
                      <option value="">No List</option>
                      {reminderLists.map(list => (
                        <option key={list.id} value={list.id}>{list.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label><Repeat size={14} /> Repeat</label>
                    <select value={reminderForm.recurring} onChange={(e) => setReminderForm({...reminderForm, recurring: e.target.value})}>
                      <option value="none">Never</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Color</label>
                    <input type="color" value={reminderForm.color} onChange={(e) => setReminderForm({...reminderForm, color: e.target.value})} />
                  </div>
                </div>

                {reminderForm.recurring !== 'none' && (
                  <div className="form-row">
                    <div className="form-group">
                      <label>Repeat Every</label>
                      <input type="number" min="1" value={reminderForm.recurring_interval} onChange={(e) => setReminderForm({...reminderForm, recurring_interval: parseInt(e.target.value)})} />
                    </div>
                    <div className="form-group">
                      <label>End Date (optional)</label>
                      <input type="datetime-local" value={reminderForm.recurring_end_date} onChange={(e) => setReminderForm({...reminderForm, recurring_end_date: e.target.value})} />
                    </div>
                  </div>
                )}

                <div className="form-group">
                  <label><MapPin size={14} /> Location (optional)</label>
                  <input type="text" value={reminderForm.location} onChange={(e) => setReminderForm({...reminderForm, location: e.target.value})} placeholder="Add a location" />
                </div>

                <div className="form-group">
                  <label><Link size={14} /> URL (optional)</label>
                  <input type="url" value={reminderForm.url} onChange={(e) => setReminderForm({...reminderForm, url: e.target.value})} placeholder="Add a link" />
                </div>

                <div className="form-group flag-toggle">
                  <label>
                    <input type="checkbox" checked={reminderForm.is_flagged} onChange={(e) => setReminderForm({...reminderForm, is_flagged: e.target.checked})} />
                    <Flag size={14} /> Flag this reminder
                  </label>
                </div>
                
                <div className="form-actions">
                  <button className="btn-cancel" onClick={() => { setShowReminderModal(false); resetReminderForm(); }}>Cancel</button>
                  <button className="btn-create" onClick={editingReminder ? saveEditedReminder : createReminder} disabled={!reminderForm.title}>
                    <Plus size={16} /> {editingReminder ? 'Save Changes' : 'Create Reminder'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* List Modal */}
      {showListModal && (
        <div className="reminder-modal-overlay" onClick={() => setShowListModal(false)}>
          <div className="reminder-modal list-modal" onClick={(e) => e.stopPropagation()}>
            <div className="reminder-modal-header">
              <h3>New List</h3>
              <button onClick={() => setShowListModal(false)}><X size={20} /></button>
            </div>
            <div className="reminder-modal-content">
              <div className="reminder-form">
                <div className="form-group">
                  <label>List Name *</label>
                  <input type="text" value={listForm.name} onChange={(e) => setListForm({...listForm, name: e.target.value})} placeholder="Enter list name" />
                </div>
                
                <div className="form-group">
                  <label>Color</label>
                  <div className="color-picker-row">
                    {['#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'].map(color => (
                      <button key={color} className={`color-option ${listForm.color === color ? 'selected' : ''}`} style={{ background: color }} onClick={() => setListForm({...listForm, color})} />
                    ))}
                    <input type="color" value={listForm.color} onChange={(e) => setListForm({...listForm, color: e.target.value})} className="custom-color" />
                  </div>
                </div>

                <div className="form-group">
                  <label>Icon</label>
                  <div className="icon-picker-row">
                    {listIcons.map(({ id, icon: Icon }) => (
                      <button key={id} className={`icon-option ${listForm.icon === id ? 'selected' : ''}`} onClick={() => setListForm({...listForm, icon: id})} style={{ borderColor: listForm.icon === id ? listForm.color : 'transparent' }}>
                        <Icon size={18} />
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="form-actions">
                  <button className="btn-cancel" onClick={() => setShowListModal(false)}>Cancel</button>
                  <button className="btn-create" onClick={createReminderList} disabled={!listForm.name} style={{ background: listForm.color }}>
                    <Plus size={16} /> Create List
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActivityTimeline;

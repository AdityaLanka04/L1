import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar as CalendarIcon, Clock, FileText, BookOpen, 
  MessageSquare, Award, ChevronLeft, ChevronRight, ArrowLeft,
  X, TrendingUp, Flame, BarChart3, Plus, Bell, AlertCircle,
  CheckSquare, Trash2
} from 'lucide-react';
import './ActivityTimeline.css';
import { API_URL } from '../config';
import { useToast } from '../contexts/ToastContext';

const ActivityTimeline = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const userName = localStorage.getItem('username');
  
  const [viewMode, setViewMode] = useState('timeline');
  const [activities, setActivities] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);
  const [showDayModal, setShowDayModal] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [quickAddDate, setQuickAddDate] = useState(null);
  const [timeFilter, setTimeFilter] = useState('all');
  const [selectedItems, setSelectedItems] = useState([]);
  const [bulkMode, setBulkMode] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [reminderForm, setReminderForm] = useState({
    title: '',
    description: '',
    reminder_date: '',
    reminder_type: 'event',
    priority: 'medium',
    color: '#3b82f6',
    notify_before_minutes: 15,
    recurring: 'none', // none, daily, weekly, monthly
    recurring_end_date: ''
  });

  const getProductivityScore = () => {
    const today = new Date();
    const todayActivities = activities.filter(a => 
      a.timestamp.toDateString() === today.toDateString()
    );
    
    const score = Math.min(100, (todayActivities.length / 10) * 100);
    return Math.round(score);
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

  const toggleBulkSelect = (id) => {
    setSelectedItems(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const bulkDeleteReminders = async () => {
    if (!window.confirm(`Delete ${selectedItems.length} reminders?`)) return;
    
    for (const id of selectedItems) {
      await deleteReminder(id);
    }
    setSelectedItems([]);
    setBulkMode(false);
  };

  useEffect(() => {
    loadAllActivities();
    loadReminders();
  }, []);

  const loadReminders = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/get_reminders?user_id=${userName}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        console.log('Loaded reminders:', data);
        setReminders(data);
      }
    } catch (error) {
      console.error('Error loading reminders:', error);
    }
  };

  const createReminder = async () => {
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('user_id', userName);
      
      // Convert datetime-local format to ISO format
      const isoDate = reminderForm.reminder_date ? new Date(reminderForm.reminder_date).toISOString() : '';
      
      Object.keys(reminderForm).forEach(key => {
        if (key === 'reminder_date') {
          formData.append(key, isoDate);
        } else {
          formData.append(key, reminderForm[key]);
        }
      });

      const res = await fetch(`${API_URL}/create_reminder`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      if (res.ok) {
        const result = await res.json();
        console.log('Reminder created:', result);
        await loadReminders();
        setShowReminderModal(false);
        setReminderForm({
          title: '',
          description: '',
          reminder_date: '',
          reminder_type: 'event',
          priority: 'medium',
          color: '#3b82f6',
          notify_before_minutes: 15
        });
        showToast(`Reminder "${reminderForm.title}" created! You'll be notified ${reminderForm.notify_before_minutes} minutes before.`, 'success');
      } else {
        showToast('Failed to create reminder', 'error');
      }
    } catch (error) {
      console.error('Error creating reminder:', error);
      showToast('Error creating reminder', 'error');
    }
  };

  const toggleReminderComplete = async (reminderId, isCompleted) => {
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('is_completed', !isCompleted);

      await fetch(`${API_URL}/update_reminder/${reminderId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      await loadReminders();
    } catch (error) {
      console.error('Error updating reminder:', error);
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
    } catch (error) {
      console.error('Error deleting reminder:', error);
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
              data: note
            });
          }
        });
      }

      // Load Flashcards
      try {
        const flashcardsRes = await fetch(`${API_URL}/get_flashcards?user_id=${userName}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (flashcardsRes.ok) {
          const flashcards = await flashcardsRes.json();
          if (Array.isArray(flashcards)) {
            flashcards.forEach(card => {
              allActivities.push({
                id: `flashcard-${card.id}`,
                type: 'flashcard',
                title: 'Flashcard',
                content: card.question?.substring(0, 150),
                timestamp: new Date(card.created_at || card.updated_at),
                data: card
              });
            });
          }
        }
      } catch (e) {
        console.log('Flashcards endpoint not available:', e.message);
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

      // Load Quiz History (if available)
      try {
        const quizRes = await fetch(`${API_URL}/get_quiz_history?user_id=${userName}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (quizRes.ok) {
          const quizzes = await quizRes.json();
          if (Array.isArray(quizzes)) {
            quizzes.forEach(quiz => {
              allActivities.push({
                id: `quiz-${quiz.id}`,
                type: 'quiz',
                title: quiz.title || 'Quiz Session',
                content: `Score: ${quiz.score || 0}%`,
                timestamp: new Date(quiz.completed_at || quiz.created_at),
                data: quiz
              });
            });
          }
        }
      } catch (e) {
        console.log('Quiz history endpoint not available:', e.message);
      }

      // Sort by timestamp (newest first)
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
    const stats = {
      total: activities.length,
      notes: activities.filter(a => a.type === 'note').length,
      flashcards: activities.filter(a => a.type === 'flashcard').length,
      quizzes: activities.filter(a => a.type === 'quiz').length,
      chats: activities.filter(a => a.type === 'chat').length,
      streak: calculateStreak()
    };
    return stats;
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

    // Group by date
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
                <div 
                  className="timeline-card"
                  onClick={() => handleActivityClick(activity)}
                >
                  <div className="timeline-card-header">
                    <div className={`timeline-card-icon ${activity.type}`}>
                      {activity.type === 'note' && <FileText size={16} />}
                      {activity.type === 'flashcard' && <BookOpen size={16} />}
                      {activity.type === 'quiz' && <Award size={16} />}
                      {activity.type === 'chat' && <MessageSquare size={16} />}
                    </div>
                    <div className="timeline-card-info">
                      <div className="timeline-card-title">{activity.title}</div>
                      <div className="timeline-card-time">
                        {activity.timestamp.toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                  {activity.content && (
                    <div className="timeline-card-content">{activity.content}</div>
                  )}
                  <div className="timeline-card-meta">
                    <span>{activity.type}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
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
    
    // Next month days
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      days.push({
        date: i,
        isCurrentMonth: false,
        fullDate: new Date(year, month + 1, i)
      });
    }

    const getActivitiesForDay = (date) => {
      return getFilteredActivities().filter(activity => {
        return activity.timestamp.toDateString() === date.toDateString();
      });
    };

    const getRemindersForDay = (date) => {
      const dayReminders = reminders.filter(reminder => {
        const reminderDate = new Date(reminder.reminder_date);
        const match = reminderDate.toDateString() === date.toDateString();
        if (match) {
          console.log('Found reminder for date:', date.toDateString(), reminder);
        }
        return match;
      });
      return dayReminders;
    };

    const isToday = (date) => {
      return date.toDateString() === new Date().toDateString();
    };

    const handleDayClick = (day, dayActivities, dayReminders) => {
      if (dayActivities.length > 0 || dayReminders.length > 0) {
        setSelectedDay({ 
          date: day.fullDate, 
          activities: dayActivities,
          reminders: dayReminders 
        });
        setShowDayModal(true);
      }
    };

    return (
      <div className="calendar-container">
        <div className="calendar-nav">
          <h2>{currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h2>
          <div className="calendar-controls">
            <button
              className="calendar-add-btn"
              onClick={() => setShowReminderModal(true)}
              title="Add Reminder"
            >
              <Plus size={16} />
              Add Reminder
            </button>
            <button
              className="calendar-stats-btn"
              onClick={() => setShowStats(!showStats)}
              title="View Statistics"
            >
              <BarChart3 size={16} />
              Stats
            </button>
            <button
              className="calendar-stats-btn"
              onClick={() => setShowAnalytics(!showAnalytics)}
              title="Analytics"
            >
              <TrendingUp size={16} />
              Analytics
            </button>
            <button
              className="calendar-stats-btn"
              onClick={exportCalendarData}
              title="Export Data"
            >
              <FileText size={16} />
              Export
            </button>
            {viewMode === 'calendar' && (
              <button
                className={`calendar-stats-btn ${bulkMode ? 'active' : ''}`}
                onClick={() => {
                  setBulkMode(!bulkMode);
                  setSelectedItems([]);
                }}
                title="Bulk Operations"
              >
                <CheckSquare size={16} />
                Bulk Edit
              </button>
            )}
            <div className="calendar-nav-buttons">
              <button
                className="calendar-nav-btn"
                onClick={() => setCurrentMonth(new Date(year, month - 1))}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                className="calendar-nav-btn"
                onClick={() => setCurrentMonth(new Date())}
              >
                Today
              </button>
              <button
                className="calendar-nav-btn"
                onClick={() => setCurrentMonth(new Date(year, month + 1))}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>

        {showStats && (
          <div className="calendar-stats">
            <div className="stat-card">
              <div className="stat-icon" style={{ background: '#3b82f6' }}>
                <TrendingUp size={20} />
              </div>
              <div className="stat-info">
                <div className="stat-value">{getActivityStats().total}</div>
                <div className="stat-label">Total Activities</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: '#f59e0b' }}>
                <Flame size={20} />
              </div>
              <div className="stat-info">
                <div className="stat-value">{getActivityStats().streak}</div>
                <div className="stat-label">Day Streak</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: '#10b981' }}>
                <FileText size={20} />
              </div>
              <div className="stat-info">
                <div className="stat-value">{getActivityStats().notes}</div>
                <div className="stat-label">Notes</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: '#8b5cf6' }}>
                <BookOpen size={20} />
              </div>
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
                <span className="analytics-label">Avg Activities/Day</span>
                <span className="analytics-value">
                  {activities.length > 0 ? Math.round(activities.length / Math.max(1, getActivityStats().streak)) : 0}
                </span>
              </div>
              <div className="analytics-item">
                <span className="analytics-label">Upcoming Reminders</span>
                <span className="analytics-value">
                  {reminders.filter(r => !r.is_completed && new Date(r.reminder_date) > new Date()).length}
                </span>
              </div>
            </div>
          </div>
        )}

        {bulkMode && selectedItems.length > 0 && (
          <div className="bulk-actions-bar">
            <span>{selectedItems.length} selected</span>
            <button className="bulk-action-btn delete" onClick={bulkDeleteReminders}>
              <Trash2 size={16} />
              Delete Selected
            </button>
            <button className="bulk-action-btn" onClick={() => {
              setSelectedItems([]);
              setBulkMode(false);
            }}>
              Cancel
            </button>
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
                  {totalItems > 0 && (
                    <span className="activity-count-badge">{totalItems}</span>
                  )}
                </div>
                <div className="calendar-activities">
                  {dayReminders.map(reminder => (
                    <div
                      key={`reminder-${reminder.id}`}
                      className="calendar-reminder"
                      style={{ 
                        background: reminder.color,
                        borderLeft: `3px solid ${reminder.color}`,
                        opacity: reminder.is_completed ? 0.5 : 1
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        // Show reminder details
                      }}
                      title={`${reminder.title} - ${new Date(reminder.reminder_date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`}
                    >
                      {reminder.priority === 'urgent' && <AlertCircle size={10} />}
                      {reminder.priority === 'high' && <Bell size={10} />}
                      <span>{reminder.title}</span>
                    </div>
                  ))}
                  {dayActivities.slice(0, 2).map(activity => (
                    <div
                      key={activity.id}
                      className={`calendar-activity ${activity.type}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleActivityClick(activity);
                      }}
                      title={activity.title}
                    >
                      {activity.type === 'note' && <FileText size={10} />}
                      {activity.type === 'flashcard' && <BookOpen size={10} />}
                      {activity.type === 'quiz' && <Award size={10} />}
                      {activity.type === 'chat' && <MessageSquare size={10} />}
                      <span>{activity.title}</span>
                    </div>
                  ))}
                  {totalItems > 3 && (
                    <div className="calendar-activity more-activities">
                      +{totalItems - 3} more
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

  return (
    <div className="activity-timeline-page">
      <div className="timeline-header">
        <div className="timeline-header-title">
          <button
            className="timeline-back-btn"
            onClick={() => navigate('/dashboard')}
            title="Back to Dashboard"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1>Activity Timeline</h1>
            <p>Track all your learning activities in one place</p>
          </div>
        </div>
      </div>

      <div className="timeline-tabs">
        <button
          className={`timeline-tab ${viewMode === 'timeline' ? 'active' : ''}`}
          onClick={() => setViewMode('timeline')}
        >
          <Clock size={16} />
          Timeline
        </button>
        <button
          className={`timeline-tab ${viewMode === 'calendar' ? 'active' : ''}`}
          onClick={() => setViewMode('calendar')}
        >
          <CalendarIcon size={16} />
          Calendar
        </button>
      </div>

      <div className="timeline-content">
        <div className="timeline-filters">
          <button
            className={`filter-chip ${filterType === 'all' ? 'active' : ''}`}
            onClick={() => setFilterType('all')}
          >
            All Activities
          </button>
          <button
            className={`filter-chip ${filterType === 'note' ? 'active' : ''}`}
            onClick={() => setFilterType('note')}
          >
            <FileText size={14} />
            Notes
          </button>
          <button
            className={`filter-chip ${filterType === 'flashcard' ? 'active' : ''}`}
            onClick={() => setFilterType('flashcard')}
          >
            <BookOpen size={14} />
            Flashcards
          </button>
          <button
            className={`filter-chip ${filterType === 'quiz' ? 'active' : ''}`}
            onClick={() => setFilterType('quiz')}
          >
            <Award size={14} />
            Quizzes
          </button>
          <button
            className={`filter-chip ${filterType === 'chat' ? 'active' : ''}`}
            onClick={() => setFilterType('chat')}
          >
            <MessageSquare size={14} />
            AI Chats
          </button>
        </div>

        {loading ? (
          <div className="loading-spinner">
            <div className="spinner"></div>
          </div>
        ) : (
          <>
            {viewMode === 'timeline' && renderTimeline()}
            {viewMode === 'calendar' && renderCalendar()}
          </>
        )}
      </div>

      {showDayModal && selectedDay && (
        <div className="day-modal-overlay" onClick={() => setShowDayModal(false)}>
          <div className="day-modal" onClick={(e) => e.stopPropagation()}>
            <div className="day-modal-header">
              <h3>
                {selectedDay.date.toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  month: 'long', 
                  day: 'numeric',
                  year: 'numeric'
                })}
              </h3>
              <button onClick={() => setShowDayModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="day-modal-content">
              <div className="day-modal-stats">
                <span>
                  {selectedDay.reminders?.length || 0} reminders, {selectedDay.activities.length} activities
                </span>
              </div>

              {/* Timeline View by Hour */}
              <div className="day-timeline-view">
                {Array.from({ length: 24 }, (_, hour) => {
                  const hourReminders = (selectedDay.reminders || []).filter(r => {
                    const rDate = new Date(r.reminder_date);
                    return rDate.getHours() === hour;
                  });
                  const hourActivities = selectedDay.activities.filter(a => {
                    return a.timestamp.getHours() === hour;
                  });
                  
                  if (hourReminders.length === 0 && hourActivities.length === 0) return null;
                  
                  return (
                    <div key={hour} className="timeline-hour-block">
                      <div className="timeline-hour-label">
                        {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
                      </div>
                      <div className="timeline-hour-items">
                        {/* Reminders */}
                        {hourReminders.map(reminder => (
                          <div
                            key={`reminder-${reminder.id}`}
                            className="timeline-reminder-item"
                            style={{ borderLeftColor: reminder.color }}
                          >
                            <div className="timeline-item-header">
                              <div className="timeline-item-icon" style={{ background: reminder.color }}>
                                <Bell size={16} />
                              </div>
                              <div className="timeline-item-info">
                                <div className="timeline-item-title">{reminder.title}</div>
                                <div className="timeline-item-time">
                                  {new Date(reminder.reminder_date).toLocaleTimeString('en-US', { 
                                    hour: '2-digit', 
                                    minute: '2-digit' 
                                  })}
                                  <span className="timeline-item-badge">{reminder.priority}</span>
                                </div>
                                {reminder.description && (
                                  <div className="timeline-item-desc">{reminder.description}</div>
                                )}
                              </div>
                              <button
                                className="timeline-item-delete"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (window.confirm('Delete this reminder?')) {
                                    await deleteReminder(reminder.id);
                                    setShowDayModal(false);
                                  }
                                }}
                                title="Delete reminder"
                              >
                                <X size={16} />
                              </button>
                            </div>
                          </div>
                        ))}
                        
                        {/* Activities */}
                        {hourActivities.map(activity => (
                          <div
                            key={activity.id}
                            className={`timeline-activity-item ${activity.type}`}
                            onClick={() => {
                              handleActivityClick(activity);
                              setShowDayModal(false);
                            }}
                          >
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
                                  {activity.timestamp.toLocaleTimeString('en-US', { 
                                    hour: '2-digit', 
                                    minute: '2-digit' 
                                  })}
                                  <span className="timeline-item-badge">{activity.type}</span>
                                </div>
                                {activity.content && (
                                  <div className="timeline-item-desc">{activity.content}</div>
                                )}
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

      {showReminderModal && (
        <div className="reminder-modal-overlay" onClick={() => setShowReminderModal(false)}>
          <div className="reminder-modal" onClick={(e) => e.stopPropagation()}>
            <div className="reminder-modal-header">
              <h3>Add Reminder</h3>
              <button onClick={() => setShowReminderModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="reminder-modal-content">
              <div className="reminder-form">
                <div className="form-group">
                  <label>Title *</label>
                  <input
                    type="text"
                    value={reminderForm.title}
                    onChange={(e) => setReminderForm({...reminderForm, title: e.target.value})}
                    placeholder="Enter reminder title"
                  />
                </div>
                
                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    value={reminderForm.description}
                    onChange={(e) => setReminderForm({...reminderForm, description: e.target.value})}
                    placeholder="Enter description (optional)"
                    rows="3"
                  />
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label>Date & Time *</label>
                    <input
                      type="datetime-local"
                      value={reminderForm.reminder_date}
                      onChange={(e) => setReminderForm({...reminderForm, reminder_date: e.target.value})}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Type</label>
                    <select
                      value={reminderForm.reminder_type}
                      onChange={(e) => setReminderForm({...reminderForm, reminder_type: e.target.value})}
                    >
                      <option value="event">Event</option>
                      <option value="reminder">Reminder</option>
                      <option value="deadline">Deadline</option>
                      <option value="study_session">Study Session</option>
                    </select>
                  </div>
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label>Priority</label>
                    <select
                      value={reminderForm.priority}
                      onChange={(e) => setReminderForm({...reminderForm, priority: e.target.value})}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label>Color</label>
                    <input
                      type="color"
                      value={reminderForm.color}
                      onChange={(e) => setReminderForm({...reminderForm, color: e.target.value})}
                    />
                  </div>
                </div>
                
                <div className="form-group">
                  <label>Notify Before (minutes)</label>
                  <input
                    type="number"
                    value={reminderForm.notify_before_minutes}
                    onChange={(e) => setReminderForm({...reminderForm, notify_before_minutes: parseInt(e.target.value)})}
                    min="0"
                    step="5"
                  />
                </div>
                
                <div className="form-actions">
                  <button 
                    className="btn-cancel" 
                    onClick={() => setShowReminderModal(false)}
                  >
                    Cancel
                  </button>
                  <button 
                    className="btn-create" 
                    onClick={createReminder}
                    disabled={!reminderForm.title || !reminderForm.reminder_date}
                  >
                    <Plus size={16} />
                    Create Reminder
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

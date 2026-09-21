export const cleanNotificationMessage = (message = '') => String(message).replace(/\s*\[(?:reminder_id|reminder_due_at|login_return):[^\]]*\]/g, '').trim();
export const notificationRoute = (notification = {}, role = '') => {
  if (notification.action_url?.startsWith('/') && !notification.action_url.startsWith('//') && !notification.action_url.includes('\\')) return notification.action_url;
  const type = notification.notification_type || '';
  if (type.startsWith('class_')) return `/${role === 'educator' ? 'educator' : 'student'}/notifications`;
  if (type.startsWith('battle_')) return '/quiz-battles';
  if (type.startsWith('token_usage_')) return '/profile?upgrade=1';
  if (['reminder', 'calendar_event', 'inactivity'].includes(type)) return '/activity-timeline';
  if (type.startsWith('quiz_')) return '/quiz-hub';
  if (type.startsWith('flashcard')) return '/flashcards';
  if (['level_up', 'streak_milestone', 'streak_broken', 'achievement'].includes(type)) return '/profile';
  if (type === 'milestone') return '/knowledge-map';
  if (['proactive_ai', 'ai_chat_milestone'].includes(type)) return '/ai-chat';
  if (type === 'notes_milestone') return '/notes';
  if (type === 'questions_milestone') return '/question-bank';
  if (type === 'study_time_milestone') return '/analytics';
  if (type === 'friend_request') return '/friends?view=requests';
  if (type.startsWith('friend_')) return '/friends';
  if (['share_received', 'content_shared'].includes(type)) return '/social';
  if (type.startsWith('challenge_')) return '/challenges';
  if (['study_insights', 'welcome_insights'].includes(type)) return '/study-insights';
  return null;
};
export const notificationTime = (date) => {
  const value = Date.parse(date);
  if (!Number.isFinite(value)) return '';
  const minutes = Math.floor(Math.max(0, Date.now() - value) / 60000);
  return minutes < 1 ? 'Just now' : minutes < 60 ? `${minutes} min ago` : new Date(value).toLocaleString();
};
export const notificationMessage = (notification) => {
  const message = cleanNotificationMessage(notification.message);
  if (!notification.reminder_due_at) return message;
  return `${message.replace(/\s*\(in \d+ min\)/g, '')} · ${notification.dueNow ? 'Scheduled for' : 'Due'} ${new Date(notification.reminder_due_at).toLocaleString()}`;
};
export const notificationsEnabled = () => {
  try { return JSON.parse(localStorage.getItem('userProfile') || '{}').notificationsEnabled !== false; } catch { return true; }
};

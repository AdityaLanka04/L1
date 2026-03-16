import AsyncStorage from '@react-native-async-storage/async-storage';

const FALLBACK_API_URL = 'http://192.168.1.178:8000/api';

function normalizeApiUrl(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, '');
  if (!trimmed) return FALLBACK_API_URL;
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
}

export const API_URL = normalizeApiUrl(process.env.EXPO_PUBLIC_API_URL ?? FALLBACK_API_URL);

async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem('token');
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ── Auth ─────────────────────────────────────────────────────────────
export async function login(username: string, password: string) {
  const body = new URLSearchParams({ username, password, grant_type: 'password' });
  const res = await fetch(`${API_URL}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) throw new Error('Invalid credentials');
  return res.json(); // { access_token, token_type }
}

export async function getMe() {
  const headers = await authHeaders();
  const res = await fetch(`${API_URL}/me`, { headers });
  if (!res.ok) throw new Error('Unauthorized');
  return res.json(); // { username, email, first_name, ... }
}

// ── Stats ─────────────────────────────────────────────────────────────
export async function getEnhancedStats(userId: string) {
  const headers = await authHeaders();
  const res = await fetch(`${API_URL}/get_enhanced_user_stats?user_id=${encodeURIComponent(userId)}`, { headers });
  return res.json(); // { streak, hours, totalChatSessions, totalFlashcards, totalNotes, ... }
}

export async function getWeeklyBingo(userId: string) {
  const headers = await authHeaders();
  const res = await fetch(`${API_URL}/get_weekly_bingo_stats?user_id=${encodeURIComponent(userId)}`, { headers });
  return res.json();
}

// ── Session time tracking ─────────────────────────────────────────────
export async function startSession(userId: string, sessionType = 'mobile_app') {
  const headers = await authHeaders();
  const body = new URLSearchParams({ user_id: userId, session_type: sessionType });
  const res = await fetch(`${API_URL}/start_session`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  return res.json(); // { session_id, start_time }
}

export async function endSession(userId: string, sessionId: string, timeSpentMinutes: number, sessionType = 'mobile_app') {
  const headers = await authHeaders();
  const body = new URLSearchParams({
    user_id: userId,
    session_id: sessionId,
    time_spent_minutes: String(timeSpentMinutes),
    session_type: sessionType,
  });
  const res = await fetch(`${API_URL}/end_session`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  return res.json();
}

// ── Chat ─────────────────────────────────────────────────────────────
export async function getConversationStarters(userId: string) {
  const headers = await authHeaders();
  const res = await fetch(`${API_URL}/conversation_starters?user_id=${encodeURIComponent(userId)}`, { headers });
  return res.json(); // { starters: string[] }
}

export async function createChatSession(userId: string, title = 'New Chat') {
  const headers = await authHeaders();
  const res = await fetch(`${API_URL}/create_chat_session`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, title }),
  });
  return res.json(); // { id, title, ... }
}

export async function askAI(userId: string, question: string, chatId?: number) {
  const body = new URLSearchParams({
    user_id: userId,
    question,
    use_hs_context: 'false',
    ...(chatId ? { chat_id: String(chatId) } : {}),
  });
  const res = await fetch(`${API_URL}/ask/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  return res.json(); // { response, chat_id, ... }
}

// ── Social ────────────────────────────────────────────────────────────
export async function getFriends(userId: string) {
  const headers = await authHeaders();
  const res = await fetch(`${API_URL}/friends?user_id=${encodeURIComponent(userId)}`, { headers });
  return res.json();
}

export async function getFriendRequests(userId: string) {
  const headers = await authHeaders();
  const res = await fetch(`${API_URL}/friend_requests?user_id=${encodeURIComponent(userId)}`, { headers });
  return res.json(); // { received: [], sent: [] }
}

export async function getFriendActivityFeed(userId: string) {
  const headers = await authHeaders();
  const res = await fetch(`${API_URL}/friend_activity_feed?user_id=${encodeURIComponent(userId)}`, { headers });
  return res.json();
}

export async function respondFriendRequest(userId: string, requestId: number, action: 'accept' | 'decline') {
  const headers = await authHeaders();
  const res = await fetch(`${API_URL}/respond_friend_request`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, request_id: requestId, action }),
  });
  return res.json();
}

export async function searchUsers(userId: string, query: string) {
  const headers = await authHeaders();
  const res = await fetch(`${API_URL}/search_users?user_id=${encodeURIComponent(userId)}&query=${encodeURIComponent(query)}`, { headers });
  return res.json();
}

// ── Flashcard Sets ────────────────────────────────────────────────────
export async function getFlashcardHistory(userId: string, limit = 50, offset = 0) {
  const headers = await authHeaders();
  const res = await fetch(`${API_URL}/get_flashcard_history?user_id=${encodeURIComponent(userId)}&limit=${limit}&offset=${offset}`, { headers });
  return res.json(); // { flashcard_history: [{id, title, card_count, accuracy_percentage, source_type, ...}] }
}

export async function getFlashcardsInSet(setId: number) {
  const headers = await authHeaders();
  const res = await fetch(`${API_URL}/get_flashcards_in_set?set_id=${setId}`, { headers });
  return res.json(); // { set_title, flashcards: [{id, question, answer, difficulty}] }
}

// ── Notes ─────────────────────────────────────────────────────────────
export async function getNotes(userId: string) {
  const headers = await authHeaders();
  const res = await fetch(`${API_URL}/get_notes?user_id=${encodeURIComponent(userId)}`, { headers });
  return res.json(); // [{id, title, content, updated_at, is_favorite, folder_id}]
}

// ── AI Media Notes ────────────────────────────────────────────────────
export async function processMediaYouTube(userId: string, youtubeUrl: string, noteStyle = 'detailed') {
  const headers = await authHeaders();
  const body = new FormData();
  body.append('user_id', userId);
  body.append('youtube_url', youtubeUrl);
  body.append('note_style', noteStyle);
  body.append('difficulty', 'intermediate');
  body.append('subject', 'general');
  const res = await fetch(`${API_URL}/media/process`, {
    method: 'POST',
    headers,
    body,
  });
  return res.json();
}

export async function getMediaHistory(userId: string) {
  const headers = await authHeaders();
  const res = await fetch(`${API_URL}/media/history?user_id=${encodeURIComponent(userId)}`, { headers });
  return res.json(); // { history: [{id, title, created_at, preview}] }
}

export async function saveMediaNotes(
  userId: string,
  title: string,
  content: string,
  transcript?: string,
  analysis?: any,
) {
  const headers = await authHeaders();
  const res = await fetch(`${API_URL}/media/save-notes`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, title, content, transcript, analysis }),
  });
  return res.json(); // { success, note_id }
}

// ── Weekly Progress ───────────────────────────────────────────────────
export async function getWeeklyProgress(userId: string) {
  const headers = await authHeaders();
  const res = await fetch(`${API_URL}/get_weekly_progress?user_id=${encodeURIComponent(userId)}`, { headers });
  return res.json(); // { daily_breakdown: [{day, ai_chats, notes, flashcards, ...}], weekly_stats, ... }
}

// ── Flashcard Stats ───────────────────────────────────────────────────
export async function getFlashcardStatistics(userId: string) {
  const headers = await authHeaders();
  const res = await fetch(`${API_URL}/get_flashcard_statistics?user_id=${encodeURIComponent(userId)}`, { headers });
  return res.json(); // { total_sets, total_cards, cards_mastered, average_accuracy }
}

// ── Chat History ─────────────────────────────────────────────────────
export async function getChatSessions(userId: string) {
  const headers = await authHeaders();
  const res = await fetch(`${API_URL}/get_chat_sessions?user_id=${encodeURIComponent(userId)}`, { headers });
  return res.json(); // { sessions: [{id, title, updated_at}] }
}

export async function getChatMessages(chatId: number) {
  const headers = await authHeaders();
  const res = await fetch(`${API_URL}/get_chat_messages?chat_id=${chatId}`, { headers });
  return res.json(); // [{id, type, content, timestamp}]
}

// ── Register ──────────────────────────────────────────────────────────
export async function register(data: {
  first_name: string;
  last_name: string;
  email: string;
  username: string;
  password: string;
}) {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  } catch {
    throw new Error(`Network request failed. Could not reach backend at ${API_URL}.`);
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Registration failed');
  }
  return res.json();
}

// ── Google OAuth ──────────────────────────────────────────────────────
export async function googleAuth(idToken: string) {
  const res = await fetch(`${API_URL}/google-auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: idToken }),
  });
  if (!res.ok) throw new Error('Google auth failed');
  return res.json(); // { access_token, token_type, user_info }
}

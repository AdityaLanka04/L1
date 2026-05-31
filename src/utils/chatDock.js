export const CHAT_DOCK_KEY = 'cerbyl.chatDock';
const CHAT_DOCK_EVENT = 'cerbyl:chat-dock-update';
const LEGACY_CHAT_DOCK_KEY = 'cerbyl.chatDock';

function getStorage() {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      return window.sessionStorage;
    }
  } catch {
    
  }
  return null;
}

function cleanupLegacyLocalStorage() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(LEGACY_CHAT_DOCK_KEY);
    }
  } catch {
    
  }
}

export function getChatDockState() {
  cleanupLegacyLocalStorage();
  const storage = getStorage();
  if (!storage) return { enabled: false, chatId: null };
  const raw = storage.getItem(CHAT_DOCK_KEY);
  if (!raw) return { enabled: false, chatId: null };
  try {
    const parsed = JSON.parse(raw);
    return {
      enabled: Boolean(parsed?.enabled),
      chatId: parsed?.chatId ? Number(parsed.chatId) : null,
      title: parsed?.title || '',
      updatedAt: parsed?.updatedAt || null,
    };
  } catch {
    return { enabled: false, chatId: null };
  }
}

export function setChatDockState(nextState) {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(CHAT_DOCK_KEY, JSON.stringify(nextState));
  window.dispatchEvent(new CustomEvent(CHAT_DOCK_EVENT, { detail: nextState }));
}

export function enableChatDock({ chatId, title = '' }) {
  if (!chatId) return;
  const current = getChatDockState();
  setChatDockState({
    ...current,
    enabled: true,
    chatId: Number(chatId),
    title,
    updatedAt: Date.now(),
  });
}

export function disableChatDock() {
  const current = getChatDockState();
  setChatDockState({
    ...current,
    enabled: false,
    updatedAt: Date.now(),
  });
}

export function listenChatDockUpdates(handler) {
  const wrapped = (event) => {
    if (event?.detail) handler(event.detail);
    else handler(getChatDockState());
  };
  window.addEventListener(CHAT_DOCK_EVENT, wrapped);
  return () => window.removeEventListener(CHAT_DOCK_EVENT, wrapped);
}

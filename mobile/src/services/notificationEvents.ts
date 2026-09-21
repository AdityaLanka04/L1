const listeners = new Set<() => void>();
export const notifyInboxChanged = () => listeners.forEach(listener => listener());
export const subscribeInbox = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };

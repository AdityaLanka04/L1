import React from 'react';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NotificationProvider, useNotifications } from '../../contexts/NotificationContext';
const note = (id = 1, props = {}) => ({ id, title: 'Reminder', message: 'Read this', notification_type: 'reminder', created_at: new Date().toISOString(), is_read: false, ...props });
const reply = (rows, unread = rows.filter(n => !n.is_read).length) => ({ ok: true, json: async () => ({ notifications: rows, unread_count: unread, total_count: rows.length, next_cursor: null }) });
let context;
function Probe() { context = useNotifications(); return <><span data-testid="count">{context.unreadCount}</span><span data-testid="slides">{context.slideQueue.length}</span><span data-testid="rows">{context.notifications.length}</span></>; }
function mount() { return render(<MemoryRouter><NotificationProvider><Probe /></NotificationProvider></MemoryRouter>); }
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('token', 'a'); localStorage.setItem('username', 'alice'); global.fetch = jest.fn(); });
afterEach(() => { jest.useRealTimers(); });
it('uses server unread count beyond the loaded page', async () => { fetch.mockResolvedValue(reply([note(1, {is_read: true})], 15)); mount(); await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('15')); });
it('does not decrement count when marking an already-read item', async () => { fetch.mockResolvedValue(reply([note(1, {is_read: true}), note(2)])); mount(); await waitFor(() => expect(context.notifications).toHaveLength(2)); fetch.mockResolvedValue({ok: true}); await act(async () => { await context.markNotificationAsRead(1); }); expect(context.unreadCount).toBe(1); });
it('cancels due alerts after mark read', async () => { jest.useFakeTimers(); fetch.mockResolvedValue(reply([note(1, {reminder_due_at: new Date(Date.now()+60000).toISOString()})])); mount(); await act(async () => {}); fetch.mockResolvedValue({ok:true}); await act(async () => { await context.markNotificationAsRead(1); }); fetch.mockResolvedValue(reply([note(1, {is_read:true})])); await act(async () => { jest.advanceTimersByTime(61000); }); expect(context.slideQueue).toHaveLength(0); });
it('rejects a poll captured before a successful deletion', async () => { fetch.mockResolvedValue(reply([note()])); mount(); await waitFor(() => expect(context.notifications).toHaveLength(1)); let resolve; fetch.mockImplementationOnce(() => new Promise(r => { resolve=r; })); act(() => { context.refreshNotifications(); }); fetch.mockResolvedValue({ok:true}); await act(async () => { await context.deleteNotification(1); }); await act(async () => { resolve(reply([note()])); }); expect(context.notifications).toHaveLength(0); });
it('removes private state immediately on logout and ignores its pending response', async () => { fetch.mockResolvedValue(reply([note()])); mount(); await waitFor(() => expect(context.notifications).toHaveLength(1)); let resolve; fetch.mockImplementationOnce(() => new Promise(r=>{resolve=r;})); act(()=>{context.refreshNotifications();}); act(()=>{localStorage.clear(); window.dispatchEvent(new Event('auth-session-changed'));}); await act(async()=>{resolve(reply([note()]));}); expect(context.notifications).toHaveLength(0); expect(context.slideQueue).toHaveLength(0); });
it('keeps inbox history when popup alerts are disabled', async () => { localStorage.setItem('userProfile', JSON.stringify({notificationsEnabled:false})); fetch.mockResolvedValue(reply([note()])); mount(); await waitFor(()=>expect(context.notifications).toHaveLength(1)); expect(context.slideQueue).toHaveLength(0); });
it('coalesces immediately due alerts', async () => { jest.useFakeTimers(); fetch.mockResolvedValue(reply([note(1,{reminder_due_at:new Date().toISOString()})])); mount(); await act(async()=>{}); await act(async()=>{jest.advanceTimersByTime(1);}); expect(context.slideQueue).toHaveLength(1); });
it('honors Retry-After on manual refresh', async () => { fetch.mockResolvedValue({ok:false,status:429,headers:{get:()=> '60'}}); mount(); await waitFor(()=>expect(context.error).toContain('busy')); await act(async()=>{await context.refreshNotifications();}); expect(fetch).toHaveBeenCalledTimes(1); });
it('reconciles a remotely disabled preference without hiding inbox history', async () => {
  const response = reply([note()]);
  response.json = async () => ({ notifications:[note()],unread_count:1,total_count:1,next_cursor:null,notifications_enabled:false });
  fetch.mockResolvedValue(response); mount();
  await waitFor(()=>expect(context.notifications).toHaveLength(1));
  expect(context.slideQueue).toHaveLength(0);
});
it('does not repeat dismissed recent popups after remount', async () => {
  const n = note(); fetch.mockResolvedValue(reply([n])); const first=mount();
  await waitFor(()=>expect(context.slideQueue).toHaveLength(1));
  act(()=>context.removeSlideNotification(context.slideQueue[0].queueKey)); first.unmount();
  mount(); await waitFor(()=>expect(context.notifications).toHaveLength(1)); expect(context.slideQueue).toHaveLength(0);
});

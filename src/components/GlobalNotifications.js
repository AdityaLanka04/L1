import { getCachedAccountSession } from '../utils/institutionSession';
import { useNavigate } from 'react-router-dom';
import SlideNotification from './SlideNotification';
import { useNotifications } from '../contexts/NotificationContext';
import useModalFocus from '../hooks/useModalFocus';
import { notificationRoute, notificationMessage, notificationTime } from '../utils/notificationPresentation';
import './NotificationDetails.css';

export default function GlobalNotifications() {
  const { slideQueue, removeSlideNotification, selectedNotification, closeNotification, error } = useNotifications();
  const navigate = useNavigate();
  const dialog = useModalFocus(Boolean(selectedNotification), closeNotification);
  let role = getCachedAccountSession()?.role || '';
  try { role = role || JSON.parse(localStorage.getItem('userProfile') || '{}').account_role; } catch { /* default learner */ }
  const route = selectedNotification && notificationRoute(selectedNotification, role);
  return <>
    <div className="slide-notif-stack" aria-live="polite" aria-label="Notifications">
      {!selectedNotification && slideQueue.slice(0, 1).map(n => <SlideNotification key={n.queueKey} notification={n} onClose={() => removeSlideNotification(n.queueKey)} />)}
    </div>
    {selectedNotification && <div className="notification-detail-backdrop">
      <section className="notification-detail" ref={dialog} role="dialog" aria-modal="true" aria-labelledby="notification-detail-title" tabIndex={-1}>
        <button type="button" onClick={closeNotification} aria-label="Close notification">Close</button>
        <h2 id="notification-detail-title">{selectedNotification.title}</h2>
        <time>{notificationTime(selectedNotification.created_at)}</time>
        <p>{notificationMessage(selectedNotification)}</p>
        {error && <p role="alert">{error}</p>}
        {route && <button type="button" onClick={() => { closeNotification(); navigate(route); }}>Open related activity</button>}
      </section>
    </div>}
  </>;
}

import SlideNotification from './SlideNotification';
import { useNotifications } from '../contexts/NotificationContext';

const GlobalNotifications = () => {
  const { slideQueue, removeSlideNotification, markNotificationAsRead } = useNotifications();

  if (!slideQueue || slideQueue.length === 0) {
    return null;
  }

  return (
    <div className="slide-notif-stack" aria-live="polite" aria-label="Notifications">
      {slideQueue.map((notif, index) => (
        <SlideNotification
          key={`${notif.id}-${notif.created_at || index}`}
          notification={notif}
          onClose={() => removeSlideNotification(notif.id)}
          onMarkRead={markNotificationAsRead}
        />
      ))}
    </div>
  );
};

export default GlobalNotifications;

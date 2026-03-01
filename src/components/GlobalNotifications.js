import React from 'react';
import SlideNotification from './SlideNotification';
import { useNotifications } from '../contexts/NotificationContext';

const GlobalNotifications = () => {
  const { slideQueue, removeSlideNotification, markNotificationAsRead } = useNotifications();

  if (!slideQueue || slideQueue.length === 0) {
    return null;
  }

  return (
    <>
      {slideQueue.map((notif, index) => (
        <SlideNotification
          key={notif.id}
          notification={notif}
          onClose={() => removeSlideNotification(notif.id)}
          onMarkRead={markNotificationAsRead}
          style={{ top: `${80 + (index * 120)}px` }}
        />
      ))}
    </>
  );
};

export default GlobalNotifications;

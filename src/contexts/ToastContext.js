import { createContext, useContext, useState, useCallback } from 'react';
import ToastNotification from '../components/ToastNotification';

const ToastContext = createContext();
let toastSequence = 0;

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((notification) => {
    const id = ++toastSequence;
    const toastWithId = { ...notification, id };
    
    setToasts(prev => [...prev, toastWithId]);
    
    
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="toast-container" role="status" aria-live="polite" aria-relevant="additions">
        {toasts.slice(0, 1).map(toast => (
          <ToastNotification
            key={toast.id}
            notification={toast}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import TrialModal from './TrialModal';
import trialManager from '../utils/trialManager';

const TRIAL_ACCESSIBLE_ROUTES = new Set([
  '/dashboard-cerbyl',
  '/dashboard',
  '/ai-chat',
  '/flashcards',
  '/notes',
  '/learning-review',
]);

const TrialWrapper = ({ children }) => {
  const [trialStatus, setTrialStatus] = useState(null);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [showExpiredModal, setShowExpiredModal] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [allowTrialAccess, setAllowTrialAccess] = useState(false);
  const [trialInitialized, setTrialInitialized] = useState(false);

  const timerRef = useRef(null);
  const checkIntervalRef = useRef(null);
  const location = useLocation();
  const isTrialAccessibleRoute = TRIAL_ACCESSIBLE_ROUTES.has(location.pathname);

  const clearTimers = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current);
      checkIntervalRef.current = null;
    }
  }, []);

  const startTrialTimer = useCallback(() => {
    clearTimers();

    timerRef.current = setInterval(() => {
      const currentStatus = trialManager.getCurrentStatus();

      if (currentStatus.expired) {
        setShowExpiredModal(true);
        setTimeRemaining(0);
        setAllowTrialAccess(false);
        clearTimers();
        return;
      }

      setTimeRemaining(currentStatus.timeRemaining);
      if (currentStatus.showWarning) {
        setShowWarningModal(true);
      }
    }, 1000);

    checkIntervalRef.current = setInterval(async () => {
      try {
        const fingerprint = trialManager.generateFingerprint();
        const serverCheck = await trialManager.checkServerTrial(fingerprint);
        if (serverCheck.blocked) {
          setShowExpiredModal(true);
          setAllowTrialAccess(false);
          clearTimers();
        }
      } catch (error) {
        // best effort only
      }
    }, 30000);
  }, [clearTimers]);

  const initializeTrial = useCallback(async () => {
    setIsLoading(true);
    setTrialInitialized(false);

    if (trialManager.isUserLoggedIn()) {
      clearTimers();
      setAllowTrialAccess(true);
      setShowWarningModal(false);
      setShowExpiredModal(false);
      setTrialInitialized(true);
      setIsLoading(false);
      return;
    }

    if (!isTrialAccessibleRoute) {
      clearTimers();
      setAllowTrialAccess(true);
      setShowWarningModal(false);
      setShowExpiredModal(false);
      setTrialInitialized(true);
      setIsLoading(false);
      return;
    }

    try {
      const status = await trialManager.initializeTrial();
      setTrialStatus(status);

      if (status.expired) {
        clearTimers();
        setShowExpiredModal(true);
        setAllowTrialAccess(false);
        setTimeRemaining(0);
      } else {
        setShowExpiredModal(false);
        setAllowTrialAccess(true);
        setTimeRemaining(status.timeRemaining);
        startTrialTimer();
      }
    } catch (error) {
      clearTimers();
      setAllowTrialAccess(false);
    } finally {
      setTrialInitialized(true);
      setIsLoading(false);
    }
  }, [clearTimers, isTrialAccessibleRoute, startTrialTimer]);

  useEffect(() => {
    initializeTrial();
    return clearTimers;
  }, [clearTimers, initializeTrial]);

  const handleWarningClose = () => {
    setShowWarningModal(false);
  };

  const handleExpiredClose = () => {
    // Keep expired modal open until user logs in or registers.
  };

  const handleLogin = () => {
    setShowWarningModal(false);
    setShowExpiredModal(false);
  };

  const handleRegister = () => {
    setShowWarningModal(false);
    setShowExpiredModal(false);
  };

  if (isLoading || !trialInitialized) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          background: '#000',
          color: '#d4af37',
        }}
      >
        <div>Loading cerbyl...</div>
      </div>
    );
  }

  if (trialManager.isUserLoggedIn()) {
    return React.isValidElement(children)
      ? React.cloneElement(children, { trialMode: false, trialInitialized: true })
      : children;
  }

  if (isTrialAccessibleRoute && !allowTrialAccess && showExpiredModal) {
    return (
      <div>
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: '#000',
            zIndex: 9998,
            pointerEvents: 'all',
          }}
        />
        <TrialModal
          isOpen={showExpiredModal}
          onClose={handleExpiredClose}
          timeRemaining={0}
          isWarning={false}
          onLogin={handleLogin}
          onRegister={handleRegister}
        />
      </div>
    );
  }

  const childrenWithProps = React.isValidElement(children)
    ? React.cloneElement(children, {
        trialMode: isTrialAccessibleRoute,
        trialInitialized: true,
        trialStatus,
      })
    : children;

  return (
    <div>
      {childrenWithProps}

      {isTrialAccessibleRoute && timeRemaining > 0 && !showExpiredModal && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            background: 'rgba(212, 175, 55, 0.1)',
            border: '1px solid #d4af37',
            borderRadius: '8px',
            padding: '8px 12px',
            color: '#d4af37',
            fontSize: '14px',
            fontWeight: '600',
            zIndex: 1000,
            backdropFilter: 'blur(10px)',
            fontFamily: 'monospace',
          }}
        >
          Trial: {trialManager.formatTimeRemaining(timeRemaining)}
        </div>
      )}

      <TrialModal
        isOpen={showWarningModal}
        onClose={handleWarningClose}
        timeRemaining={timeRemaining}
        isWarning
        onLogin={handleLogin}
        onRegister={handleRegister}
      />

      <TrialModal
        isOpen={showExpiredModal}
        onClose={handleExpiredClose}
        timeRemaining={0}
        isWarning={false}
        onLogin={handleLogin}
        onRegister={handleRegister}
      />
    </div>
  );
};

export default TrialWrapper;

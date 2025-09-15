// src/pages/TrialWrapper.js (Fixed Navigation)

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import TrialModal from './TrialModal';
import trialManager from '../utils/trialManager';

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

  // Routes that should be accessible during trial
  const trialAccessibleRoutes = ['/dashboard', '/ai-chat', '/flashcards', '/notes', '/learning-review'];
  const isTrialAccessibleRoute = trialAccessibleRoutes.includes(location.pathname);

  const initializeTrial = useCallback(async () => {
    console.log('Initializing trial...', { path: location.pathname, isLoggedIn: trialManager.isUserLoggedIn() });
    
    // Skip trial for logged-in users
    if (trialManager.isUserLoggedIn()) {
      console.log('User is logged in, skipping trial');
      setIsLoading(false);
      setAllowTrialAccess(true);
      setTrialInitialized(true);
      return;
    }

    // If user is on a protected route but not logged in, start trial
    if (isTrialAccessibleRoute) {
      try {
        const status = await trialManager.initializeTrial();
        console.log('Trial status:', status);
        setTrialStatus(status);
        
        if (status.expired) {
          console.log('Trial expired, showing modal');
          setShowExpiredModal(true);
          setAllowTrialAccess(false);
          setIsLoading(false);
          setTrialInitialized(true);
          return;
        }

        console.log('Trial active, allowing access');
        setTimeRemaining(status.timeRemaining);
        setAllowTrialAccess(true);
        setTrialInitialized(true);
        startTrialTimer();
        setIsLoading(false);
      } catch (error) {
        console.error('Trial initialization failed:', error);
        setAllowTrialAccess(false);
        setIsLoading(false);
        setTrialInitialized(true);
      }
    } else {
      // For non-protected routes (homepage, login, register), allow access without trial
      console.log('Non-protected route, allowing access');
      setIsLoading(false);
      setAllowTrialAccess(true);
      setTrialInitialized(true);
    }
  }, [location.pathname, isTrialAccessibleRoute]);

  const startTrialTimer = useCallback(() => {
    console.log('Starting trial timer');
    
    // Update timer every second
    timerRef.current = setInterval(() => {
      const currentStatus = trialManager.getCurrentStatus();
      
      if (currentStatus.expired) {
        console.log('Trial expired during timer');
        setShowExpiredModal(true);
        setTimeRemaining(0);
        setAllowTrialAccess(false);
        if (timerRef.current) clearInterval(timerRef.current);
        return;
      }

      setTimeRemaining(currentStatus.timeRemaining);

      // Show warning modal when 1 minute remains
      if (currentStatus.showWarning && !showWarningModal && !showExpiredModal) {
        console.log('Showing warning modal');
        setShowWarningModal(true);
      }
    }, 1000);

    // Check server status every 30 seconds
    checkIntervalRef.current = setInterval(async () => {
      try {
        const fingerprint = trialManager.generateFingerprint();
        const serverCheck = await trialManager.checkServerTrial(fingerprint);
        if (serverCheck.blocked) {
          console.log('Server blocked trial');
          setShowExpiredModal(true);
          setAllowTrialAccess(false);
          if (timerRef.current) clearInterval(timerRef.current);
          if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
        }
      } catch (error) {
        console.warn('Server check failed:', error);
      }
    }, 30000);
  }, [showWarningModal, showExpiredModal]);

  useEffect(() => {
    initializeTrial();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
    };
  }, [initializeTrial]);

  // Re-initialize when route changes
  useEffect(() => {
    console.log('Route changed to:', location.pathname);
    setTrialInitialized(false);
    initializeTrial();
  }, [location.pathname, initializeTrial]);

  const handleWarningClose = () => {
    setShowWarningModal(false);
  };

  const handleExpiredClose = () => {
    // Don't allow closing expired modal - user must register or login
  };

  const handleLogin = () => {
    setShowWarningModal(false);
    setShowExpiredModal(false);
  };

  const handleRegister = () => {
    setShowWarningModal(false);
    setShowExpiredModal(false);
  };

  // Show loading state
  if (isLoading || !trialInitialized) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        background: '#000',
        color: '#d4af37'
      }}>
        <div>Loading Brainwave...</div>
      </div>
    );
  }

  // If user is logged in, always allow access
  if (trialManager.isUserLoggedIn()) {
    return React.cloneElement(children, { trialMode: false, trialInitialized: true });
  }

  // For trial users on protected routes, check if trial access is allowed
  if (isTrialAccessibleRoute && !allowTrialAccess && showExpiredModal) {
    return (
      <div>
        {/* Block interface when trial is expired */}
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: '#000',
          zIndex: 9998,
          pointerEvents: 'all'
        }} />

        {/* Expired Modal */}
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

  // Pass trial status to children
  const childrenWithProps = React.cloneElement(children, { 
    trialMode: !trialManager.isUserLoggedIn() && isTrialAccessibleRoute,
    trialInitialized: true
  });

  // Render with trial restrictions for trial users
  return (
    <div>
      {childrenWithProps}
      
      {/* Trial Timer Display (only show for trial users on protected routes) */}
      {!trialManager.isUserLoggedIn() && isTrialAccessibleRoute && timeRemaining > 0 && !showExpiredModal && (
        <div style={{
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
          fontFamily: 'monospace'
        }}>
          Trial: {trialManager.formatTimeRemaining(timeRemaining)}
        </div>
      )}

      {/* Warning Modal */}
      <TrialModal
        isOpen={showWarningModal}
        onClose={handleWarningClose}
        timeRemaining={timeRemaining}
        isWarning={true}
        onLogin={handleLogin}
        onRegister={handleRegister}
      />

      {/* Expired Modal */}
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
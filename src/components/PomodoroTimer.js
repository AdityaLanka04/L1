import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Clock, Coffee, Target } from 'lucide-react';
import './PomodoroTimer.css';

const PomodoroTimer = ({ noteId, onTimeTracked }) => {
  const [minutes, setMinutes] = useState(25);
  const [seconds, setSeconds] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [mode, setMode] = useState('work'); // work, shortBreak, longBreak
  const [sessionsCompleted, setSessionsCompleted] = useState(0);
  const intervalRef = useRef(null);

  const WORK_TIME = 25;
  const SHORT_BREAK = 5;
  const LONG_BREAK = 15;

  useEffect(() => {
    if (isActive && (minutes > 0 || seconds > 0)) {
      intervalRef.current = setInterval(() => {
        if (seconds === 0) {
          if (minutes === 0) {
            handleTimerComplete();
          } else {
            setMinutes(minutes - 1);
            setSeconds(59);
          }
        } else {
          setSeconds(seconds - 1);
        }
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }

    return () => clearInterval(intervalRef.current);
  }, [isActive, minutes, seconds]);

  const handleTimerComplete = () => {
    setIsActive(false);
    
    if (mode === 'work') {
      const newSessions = sessionsCompleted + 1;
      setSessionsCompleted(newSessions);
      
      // Track time spent on note
      if (onTimeTracked && noteId) {
        onTimeTracked(noteId, WORK_TIME);
      }
      
      // Play notification sound
      playNotificationSound();
      
      // Switch to break
      if (newSessions % 4 === 0) {
        setMode('longBreak');
        setMinutes(LONG_BREAK);
      } else {
        setMode('shortBreak');
        setMinutes(SHORT_BREAK);
      }
      setSeconds(0);
      
      // Show notification
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Pomodoro Complete!', {
          body: 'Time for a break!',
          icon: '/favicon.ico'
        });
      }
    } else {
      // Break complete, back to work
      setMode('work');
      setMinutes(WORK_TIME);
      setSeconds(0);
      
      playNotificationSound();
      
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Break Complete!', {
          body: 'Ready to focus again?',
          icon: '/favicon.ico'
        });
      }
    }
  };

  const playNotificationSound = () => {
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIGGS57OihUBELTKXh8bllHAU2jdXvzn0pBSh+zPDajzsKElyx6OyrWBQLSKDf8sFuIwUrgc7y2Yk2CBhkuezooVARDEyl4fG5ZRwFNo3V7859KQUofsz');
    audio.play().catch(e => {});
  };

  const toggleTimer = () => {
    setIsActive(!isActive);
    
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  };

  const resetTimer = () => {
    setIsActive(false);
    setMode('work');
    setMinutes(WORK_TIME);
    setSeconds(0);
  };

  const switchMode = (newMode) => {
    setIsActive(false);
    setMode(newMode);
    
    switch (newMode) {
      case 'work':
        setMinutes(WORK_TIME);
        break;
      case 'shortBreak':
        setMinutes(SHORT_BREAK);
        break;
      case 'longBreak':
        setMinutes(LONG_BREAK);
        break;
      default:
        setMinutes(WORK_TIME);
    }
    setSeconds(0);
  };

  const formatTime = (mins, secs) => {
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getProgress = () => {
    const totalSeconds = mode === 'work' ? WORK_TIME * 60 : 
                        mode === 'shortBreak' ? SHORT_BREAK * 60 : 
                        LONG_BREAK * 60;
    const currentSeconds = minutes * 60 + seconds;
    return ((totalSeconds - currentSeconds) / totalSeconds) * 100;
  };

  return (
    <div className="pomodoro-timer">
      <div className="pomodoro-header">
        <Clock size={18} />
        <span>Focus Timer</span>
      </div>

      <div className="pomodoro-modes">
        <button
          className={`mode-btn ${mode === 'work' ? 'active' : ''}`}
          onClick={() => switchMode('work')}
        >
          <Target size={14} />
          Work
        </button>
        <button
          className={`mode-btn ${mode === 'shortBreak' ? 'active' : ''}`}
          onClick={() => switchMode('shortBreak')}
        >
          <Coffee size={14} />
          Short Break
        </button>
        <button
          className={`mode-btn ${mode === 'longBreak' ? 'active' : ''}`}
          onClick={() => switchMode('longBreak')}
        >
          <Coffee size={14} />
          Long Break
        </button>
      </div>

      <div className="pomodoro-display">
        <svg className="progress-ring" width="200" height="200">
          <circle
            className="progress-ring-bg"
            cx="100"
            cy="100"
            r="90"
          />
          <circle
            className="progress-ring-fill"
            cx="100"
            cy="100"
            r="90"
            style={{
              strokeDasharray: `${2 * Math.PI * 90}`,
              strokeDashoffset: `${2 * Math.PI * 90 * (1 - getProgress() / 100)}`
            }}
          />
        </svg>
        <div className="timer-text">
          {formatTime(minutes, seconds)}
        </div>
      </div>

      <div className="pomodoro-controls">
        <button className="control-btn" onClick={toggleTimer}>
          {isActive ? <Pause size={20} /> : <Play size={20} />}
        </button>
        <button className="control-btn" onClick={resetTimer}>
          <RotateCcw size={20} />
        </button>
      </div>

      <div className="pomodoro-stats">
        <div className="stat-item">
          <span className="stat-label">Sessions Today</span>
          <span className="stat-value">{sessionsCompleted}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Time Focused</span>
          <span className="stat-value">{sessionsCompleted * WORK_TIME}m</span>
        </div>
      </div>
    </div>
  );
};

export default PomodoroTimer;

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock } from 'lucide-react';
import PomodoroTimer from '../components/PomodoroTimer';
import './PomodoroPage.css';

const PomodoroPage = () => {
  const navigate = useNavigate();
  const [userName] = useState(localStorage.getItem('username') || 'User');
  const [userProfile] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('userProfile') || '{}');
    } catch {
      return {};
    }
  });

  return (
    <div className="pomodoro-page">
      <div className="pomodoro-header">
        <div className="header-left">
          <button className="back-btn" onClick={() => navigate('/dashboard')}>
            <ArrowLeft size={18} />
            Back
          </button>
        </div>
        
        <h1 className="pomodoro-title">
          <Clock size={28} />
          <span>pomodoro focus</span>
        </h1>

        <div className="header-right">
          {userProfile?.profilePicture && (
            <img 
              src={userProfile.profilePicture} 
              alt="Profile" 
              className="profile-picture" 
            />
          )}
          <span className="user-name">{userName}</span>
        </div>
      </div>

      <main className="pomodoro-main">
        <div className="pomodoro-container">
          <div className="pomodoro-intro">
            <h2>Focus Timer</h2>
            <p>Use the Pomodoro Technique to boost your productivity. Work in focused 25-minute intervals with short breaks in between.</p>
          </div>

          <div className="pomodoro-timer-wrapper">
            <PomodoroTimer 
              noteId={null}
              onTimeTracked={(noteId, minutes) => {
                              }}
            />
          </div>

          <div className="pomodoro-tips">
            <h3>Tips for Effective Focus Sessions</h3>
            <ul>
              <li>Eliminate distractions before starting</li>
              <li>Focus on one task at a time</li>
              <li>Take breaks seriously - they help maintain focus</li>
              <li>Track your progress and adjust as needed</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PomodoroPage;

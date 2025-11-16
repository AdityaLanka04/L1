import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from "react-router-dom";
import Dashboard from './pages/Dashboard';
import AIChat from './pages/AIChat';
import Homepage from './pages/Homepage';
import SafetyLogin from './pages/SafetyLogin';
import LearningReviewHub from './pages/LearningReviewHub';
import Social from './pages/Social';
import FriendsDashboard from './pages/FriendsDashboard';
import ActivityFeed from './pages/ActivityFeed';
import Leaderboards from './pages/Leaderboards';
import QuizHub from './pages/QuizHub';
import QuizBattle from './pages/QuizBattle';
import QuizBattleSession from './pages/QuizBattleSession';
import SoloQuiz from './pages/SoloQuiz';
import SoloQuizSession from './pages/SoloQuizSession';
import ChallengeSession from './pages/ChallengeSession';
import SharedContent from './pages/SharedContent';
import KnowledgeRoadmap from './pages/KnowledgeRoadmap';
import ConceptWeb from './pages/ConceptWeb';
import QuestionBank from './pages/Questionbankdashboard';
import SlideExplorer from './pages/SlideExplorer';
import Statistics from './pages/Statistics';
import Flashcards from './pages/Flashcards';
import Notes from './pages/NotesRedesign';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/profile';
import ProfileQuiz from './pages/ProfileQuiz';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';
import SharedItemViewer from './pages/SharedItemViewer';
import NotesRedesign from './pages/NotesRedesign';
import Games from './pages/Games';
import ProactiveNotification from './components/ProactiveNotification';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';

function App() {
  const [proactiveNotification, setProactiveNotification] = useState(null);
  const [lastCheckTime, setLastCheckTime] = useState(Date.now());
  const [lastActivityTime, setLastActivityTime] = useState(Date.now());
  const [isIdle, setIsIdle] = useState(false);

  // Track user activity for idle detection
  useEffect(() => {
    const updateActivity = () => {
      setLastActivityTime(Date.now());
      setIsIdle(false);
    };

    // Listen to user interactions
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach(event => {
      document.addEventListener(event, updateActivity);
    });

    // Check for idle every 10 seconds
    const idleCheckInterval = setInterval(() => {
      const timeSinceActivity = Date.now() - lastActivityTime;
      const oneMinute = 60 * 1000;
      
      if (timeSinceActivity >= oneMinute && !isIdle) {
        console.log('🔔 User is idle for 1 minute, checking for proactive message...');
        setIsIdle(true);
        // Use the global function
        if (window.checkProactiveMessage) {
          window.checkProactiveMessage(true);
        }
      }
    }, 10000);

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, updateActivity);
      });
      clearInterval(idleCheckInterval);
    };
  }, [lastActivityTime, isIdle]);

  // Check for proactive AI messages periodically
  useEffect(() => {
    const checkProactiveMessage = async (forceIdle = false) => {
      const userId = localStorage.getItem('username');
      if (!userId) {
        console.log('🔔 No username found, skipping check');
        return;
      }

      try {
        const url = `${API_BASE_URL}/api/check_proactive_message?user_id=${userId}${forceIdle ? '&is_idle=true' : ''}`;
        console.log('🔔 Checking proactive message:', url);
        
        const response = await fetch(url);
        const data = await response.json();

        console.log('🔔 Proactive message response:', data);

        if (data.should_notify && data.message) {
          console.log('🔔 SHOWING NOTIFICATION!', data);
          setProactiveNotification({
            message: data.message,
            chatId: data.chat_id,
            urgencyScore: data.urgency_score || 0.5,
            reason: data.reason
          });
          setLastCheckTime(Date.now());
          setIsIdle(false);
        } else {
          console.log('🔔 No notification to show:', data);
        }
      } catch (error) {
        console.error('🔔 Error checking proactive message:', error);
      }
    };
    
    // Make checkProactiveMessage available globally
    window.checkProactiveMessage = checkProactiveMessage;

    // FORCE SHOW TEST NOTIFICATION IMMEDIATELY (doesn't depend on backend)
    const userId = localStorage.getItem('username');
    const userProfile = localStorage.getItem('userProfile');
    
    if (userId) {
      console.log('🔔 User logged in:', userId);
      
      let firstName = 'there';
      try {
        if (userProfile) {
          const profile = JSON.parse(userProfile);
          firstName = profile.firstName || 'there';
        }
      } catch (e) {
        console.log('Could not parse user profile');
      }

      console.log('🔔 FORCING TEST NOTIFICATION in 2 seconds...');
      const notificationTimer = setTimeout(() => {
        console.log('🔔 SHOWING FORCED TEST NOTIFICATION NOW!');
        const testNotif = {
          message: `Hey ${firstName}! 👋 I'm your AI tutor. What would you like to learn today? Click here to start chatting!`,
          chatId: null,
          urgencyScore: 0.8,
          reason: 'test'
        };
        console.log('🔔 Setting notification state:', testNotif);
        setProactiveNotification(testNotif);
        console.log('🔔 Notification state set! Should render now...');
      }, 2000);

      // Also try to check backend after 10 seconds (but don't fail if it's down)
      const backendCheckTimer = setTimeout(() => {
        console.log('🔔 Attempting to check backend for real notification...');
        checkProactiveMessage().catch(err => {
          console.log('🔔 Backend check failed (expected if backend is down):', err);
        });
      }, 10000);
    } else {
      console.log('🔔 No user logged in, skipping notification');
    }

    // Add global function to manually trigger notification for testing
    window.showTestNotification = () => {
      console.log('🔔 Manual test notification triggered!');
      setProactiveNotification({
        message: "This is a manual test notification! Click to open AI chat.",
        chatId: null,
        urgencyScore: 0.9,
        reason: 'manual_test'
      });
    };
    console.log('🔔 Added window.showTestNotification() - call this in console to test!');

    // Check every 20 seconds for proactive messages (more frequent)
    const interval = setInterval(() => {
      const userId = localStorage.getItem('username');
      if (userId) {
        const timeSinceLastCheck = Date.now() - lastCheckTime;
        if (timeSinceLastCheck >= 2 * 60 * 1000) { // 2 minutes
          console.log('🔔 Periodic check for proactive message...');
          checkProactiveMessage();
        }
      }
    }, 20 * 1000);

    return () => clearInterval(interval);
  }, [lastCheckTime]);

  return (
    <ThemeProvider>
      <ToastProvider>
        <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-top)', color: 'var(--text-primary)' }}>
        {/* Proactive AI Notification - appears on all pages */}
        {proactiveNotification && (
          <>
            {console.log('🔔 RENDERING ProactiveNotification component!', proactiveNotification)}
            <ProactiveNotification
              message={proactiveNotification.message}
              chatId={proactiveNotification.chatId}
              urgencyScore={proactiveNotification.urgencyScore}
              onClose={() => {
                console.log('🔔 Closing notification');
                setProactiveNotification(null);
              }}
            />
          </>
        )}
        
        <Routes>
          <Route path="/" element={<SafetyLogin />} />
          <Route path="/homepage" element={<Homepage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/profile-quiz" element={<ProfileQuiz />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/ai-chat" element={<AIChat />} />
          <Route path="/ai-chat/:chatId?" element={<AIChat />} />
          <Route path="/learning-review" element={<LearningReviewHub />} />
          <Route path="/social" element={<Social />} />
          <Route path="/friends" element={<FriendsDashboard />} />
          <Route path="/activity-feed" element={<ActivityFeed />} />
          <Route path="/leaderboards" element={<Leaderboards />} />
          <Route path="/quiz-hub" element={<QuizHub />} />
          <Route path="/quiz-battles" element={<QuizBattle />} />
          <Route path="/quiz-battle/:battleId" element={<QuizBattleSession />} />
          <Route path="/solo-quiz" element={<SoloQuiz />} />
          <Route path="/solo-quiz/:quizId" element={<SoloQuizSession />} />
          <Route path="/games" element={<Games />} />
          <Route path="/challenges" element={<Games />} />
          <Route path="/challenge/:challengeId" element={<ChallengeSession />} />
          <Route path="/shared" element={<SharedContent />} />
          <Route path="/shared/:contentType/:contentId" element={<SharedContent />} />
          <Route path="/knowledge-roadmap" element={<KnowledgeRoadmap />} />
          <Route path="/concept-web" element={<ConceptWeb />} />
          <Route path="/question-bank" element={<QuestionBank />} />
          <Route path="/slide-explorer" element={<SlideExplorer />} />
          <Route path="/statistics" element={<Statistics />} />
          <Route path="/flashcards" element={<Flashcards />} />
          <Route path="/notes" element={<Notes />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/home" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
          <Route path="/shared/:contentType/:contentId" element={<SharedItemViewer />} />
          <Route path="/shared/chat/:chatId" element={<AIChat sharedMode={true} />} />
          <Route path="/shared/note/:noteId" element={<NotesRedesign sharedMode={true} />} />
        </Routes>
        </div>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
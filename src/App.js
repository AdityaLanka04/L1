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

  // Proactive notification system - shows after login
  useEffect(() => {
    const checkForProactiveNotification = async () => {
      const username = localStorage.getItem('username');
      if (!username) return;

      try {
        const response = await fetch(`${API_BASE_URL}/api/check_proactive_message?user_id=${username}`);
        const data = await response.json();

        if (data.should_notify && data.message) {
          // Show ONLY popup notification (not dashboard notification to avoid duplicates)
          setProactiveNotification({
            message: data.message,
            chatId: data.chat_id,
            urgencyScore: data.urgency_score || 0.7,
            reason: data.reason
          });
        }
      } catch (error) {
        console.log('Proactive notification check failed:', error);
      }
    };

    // Add manual test function
    window.showTestNotification = () => {
      const username = localStorage.getItem('username');
      const userProfile = localStorage.getItem('userProfile');
      let firstName = 'there';
      try {
        if (userProfile) {
          const profile = JSON.parse(userProfile);
          firstName = profile.firstName || 'there';
        }
      } catch (e) {}

      // Show ONLY popup notification for test
      setProactiveNotification({
        message: `Hey ${firstName}! 👋 I'm your AI tutor. What would you like to learn today?`,
        chatId: null,
        urgencyScore: 0.8,
        reason: 'test'
      });
    };

    // Check for notification after login
    const username = localStorage.getItem('username');
    if (username) {
      // Check immediately after 3 seconds
      setTimeout(() => checkForProactiveNotification(), 3000);
      
      // Check periodically every 5 minutes
      const interval = setInterval(() => checkForProactiveNotification(), 5 * 60 * 1000);
      
      return () => clearInterval(interval);
    }
  }, []);

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
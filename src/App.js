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
import NotesHub from './pages/NotesHub';
import AudioVideoNotes from './pages/AudioVideoNotes';
import MyNotes from './pages/MyNotes';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/profile';
import ProfileQuiz from './pages/ProfileQuiz';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';
import SharedItemViewer from './pages/SharedItemViewer';
import NotesRedesign from './pages/NotesRedesign';
import NotesDashboard from './pages/NotesDashboard';
import ActivityTimeline from './pages/ActivityTimeline';
import Games from './pages/Games';
import ProactiveNotification from './components/ProactiveNotification';
import ProtectedRoute from './components/ProtectedRoute';
import SafetyProtectedRoute from './components/SafetyProtectedRoute';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';

function App() {
  const [notification, setNotification] = useState(null);

  // Notification logic moved to Dashboard.js for better control
  // No notification checks in App.js - only on login in Dashboard

  return (
    <ThemeProvider>
      <ToastProvider>
        <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-top)', color: 'var(--text-primary)' }}>
          {/* Notification Popup */}
          {notification && (
            <ProactiveNotification
              message={notification.message}
              chatId={notification.chatId}
              urgencyScore={notification.urgencyScore}
              onClose={() => setNotification(null)}
            />
          )}
          
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<SafetyLogin />} />
            <Route path="/login" element={<SafetyProtectedRoute><Login /></SafetyProtectedRoute>} />
            <Route path="/register" element={<SafetyProtectedRoute><Register /></SafetyProtectedRoute>} />
            
            {/* Protected Routes */}
            <Route path="/homepage" element={<ProtectedRoute><Homepage /></ProtectedRoute>} />
            <Route path="/profile-quiz" element={<ProtectedRoute><ProfileQuiz /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/ai-chat" element={<ProtectedRoute><AIChat /></ProtectedRoute>} />
            <Route path="/ai-chat/:chatId?" element={<ProtectedRoute><AIChat /></ProtectedRoute>} />
            <Route path="/learning-review" element={<ProtectedRoute><LearningReviewHub /></ProtectedRoute>} />
            <Route path="/social" element={<ProtectedRoute><Social /></ProtectedRoute>} />
            <Route path="/friends" element={<ProtectedRoute><FriendsDashboard /></ProtectedRoute>} />
            <Route path="/activity-feed" element={<ProtectedRoute><ActivityFeed /></ProtectedRoute>} />
            <Route path="/leaderboards" element={<ProtectedRoute><Leaderboards /></ProtectedRoute>} />
            <Route path="/quiz-hub" element={<ProtectedRoute><QuizHub /></ProtectedRoute>} />
            <Route path="/quiz-battles" element={<ProtectedRoute><QuizBattle /></ProtectedRoute>} />
            <Route path="/quiz-battle/:battleId" element={<ProtectedRoute><QuizBattleSession /></ProtectedRoute>} />
            <Route path="/solo-quiz" element={<ProtectedRoute><SoloQuiz /></ProtectedRoute>} />
            <Route path="/solo-quiz/:quizId" element={<ProtectedRoute><SoloQuizSession /></ProtectedRoute>} />
            <Route path="/games" element={<ProtectedRoute><Games /></ProtectedRoute>} />
            <Route path="/challenges" element={<ProtectedRoute><Games /></ProtectedRoute>} />
            <Route path="/challenge/:challengeId" element={<ProtectedRoute><ChallengeSession /></ProtectedRoute>} />
            <Route path="/shared" element={<SharedContent />} />
            <Route path="/shared/:contentType/:contentId" element={<SharedContent />} />
            <Route path="/knowledge-roadmap" element={<ProtectedRoute><KnowledgeRoadmap /></ProtectedRoute>} />
            <Route path="/concept-web" element={<ProtectedRoute><ConceptWeb /></ProtectedRoute>} />
            <Route path="/question-bank" element={<ProtectedRoute><QuestionBank /></ProtectedRoute>} />
            <Route path="/slide-explorer" element={<ProtectedRoute><SlideExplorer /></ProtectedRoute>} />
            <Route path="/statistics" element={<ProtectedRoute><Statistics /></ProtectedRoute>} />
            <Route path="/flashcards" element={<ProtectedRoute><Flashcards /></ProtectedRoute>} />
            <Route path="/notes" element={<ProtectedRoute><NotesHub /></ProtectedRoute>} />
            <Route path="/notes/dashboard" element={<ProtectedRoute><NotesDashboard /></ProtectedRoute>} />
            <Route path="/notes/audio-video" element={<ProtectedRoute><AudioVideoNotes /></ProtectedRoute>} />
            <Route path="/notes/my-notes" element={<ProtectedRoute><MyNotes /></ProtectedRoute>} />
            <Route path="/notes/editor/:noteId" element={<ProtectedRoute><Notes /></ProtectedRoute>} />
            <Route path="/activity-timeline" element={<ProtectedRoute><ActivityTimeline /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
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

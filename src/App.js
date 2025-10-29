import React from 'react';
import { Routes, Route, Navigate } from "react-router-dom";
import Dashboard from './pages/Dashboard';
import AIChat from './pages/AIChat';
import Homepage from './pages/Homepage';
import LearningReviewHub from './pages/LearningReviewHub';
import Social from './pages/Social';
import ActivityFeed from './pages/ActivityFeed';
import Leaderboards from './pages/Leaderboards';
import QuizBattle from './pages/QuizBattle';
import Challenges from './pages/Challenges';
import KnowledgeRoadmap from './pages/KnowledgeRoadmap';
import Questionbankdashboard from './pages/Questionbankdashboard';
import SlideExplorer from './pages/SlideExplorer';
import Statistics from './pages/Statistics';
import Flashcards from './pages/Flashcards';
import Notes from './pages/NotesRedesign';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/profile';
import ProfileQuiz from './pages/ProfileQuiz';
import { ThemeProvider } from './contexts/ThemeContext';


function App() {
  return (
    <ThemeProvider>
      <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-top)', color: 'var(--text-primary)' }}>
        <Routes>
          <Route path="/" element={<Homepage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/profile-quiz" element={<ProfileQuiz />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/ai-chat" element={<AIChat />} />
          <Route path="/ai-chat/:chatId?" element={<AIChat />} />
          <Route path="/learning-review" element={<LearningReviewHub />} />
          <Route path="/social" element={<Social />} />
          <Route path="/activity-feed" element={<ActivityFeed />} />
          <Route path="/leaderboards" element={<Leaderboards />} />
          <Route path="/quiz-battles" element={<QuizBattle />} />
          <Route path="/challenges" element={<Challenges />} />
          <Route path="/knowledge-roadmap" element={<KnowledgeRoadmap />} />
          <Route path="/question-bank" element={<Questionbankdashboard />} />
          <Route path="/slide-explorer" element={<SlideExplorer />} />
          <Route path="/statistics" element={<Statistics />} />
          <Route path="/flashcards" element={<Flashcards />} />
          <Route path="/notes" element={<Notes />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/home" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </ThemeProvider>
  );
}

export default App;
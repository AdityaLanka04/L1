import React from 'react';
import { Routes, Route, Navigate } from "react-router-dom";
import Dashboard from './pages/Dashboard';
import AIChat from './pages/AIChat';
import Homepage from './pages/Homepage';
import SafetyLogin from './pages/SafetyLogin';
import LearningReviewHub from './pages/LearningReviewHub';
import Social from './pages/Social';
import ActivityFeed from './pages/ActivityFeed';
import Leaderboards from './pages/Leaderboards';
import QuizBattle from './pages/QuizBattle';
import QuizBattleSession from './pages/QuizBattleSession';
import Challenges from './pages/Challenges';
import ChallengeSession from './pages/ChallengeSession';
import SharedContent from './pages/SharedContent';
import KnowledgeRoadmap from './pages/KnowledgeRoadmap';
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
import SharedItemViewer from './pages/SharedItemViewer';
import NotesRedesign from './pages/NotesRedesign';


function App() {
  return (
    <ThemeProvider>
      <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-top)', color: 'var(--text-primary)' }}>
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
          <Route path="/activity-feed" element={<ActivityFeed />} />
          <Route path="/leaderboards" element={<Leaderboards />} />
          <Route path="/quiz-battles" element={<QuizBattle />} />
          <Route path="/quiz-battle/:battleId" element={<QuizBattleSession />} />
          <Route path="/challenges" element={<Challenges />} />
          <Route path="/challenge/:challengeId" element={<ChallengeSession />} />
          <Route path="/shared" element={<SharedContent />} />
          <Route path="/shared/:contentType/:contentId" element={<SharedContent />} />
          <Route path="/knowledge-roadmap" element={<KnowledgeRoadmap />} />
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
    </ThemeProvider>
  );
}

export default App;
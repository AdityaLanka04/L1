import React, { useState, lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';
import { NotificationProvider } from './contexts/NotificationContext';
import ProactiveNotification from './components/ProactiveNotification';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import AIChatDock from './components/AIChatDock';
import LoadingSpinner from './components/LoadingSpinner';
import GlobalNotifications from './components/GlobalNotifications';
import RateLimitHandler from './components/RateLimitHandler';
import './styles/ui-safety.css';

// Pages are lazy-loaded so each route ships as its own chunk instead of
// inflating the initial bundle with ~60 page components up front.
const Dashboard = lazy(() => import('./pages/Dashboard'));
const DashboardCerbyl = lazy(() => import('./pages/DashboardCerbyl'));
const AIChat = lazy(() => import('./pages/AIChat'));
const Homepage = lazy(() => import('./pages/Homepage'));
const LearningReviewHub = lazy(() => import('./pages/LearningReviewHub'));
const Social = lazy(() => import('./pages/Social'));
const SharedPage = lazy(() => import('./pages/SharedPage'));
const FriendsDashboard = lazy(() => import('./pages/FriendsDashboard'));
const ActivityFeed = lazy(() => import('./pages/ActivityFeed'));
const Leaderboards = lazy(() => import('./pages/Leaderboards'));
const QuizHub = lazy(() => import('./pages/QuizHub'));
const QuizBattle = lazy(() => import('./pages/QuizBattle'));
const QuizBattleSession = lazy(() => import('./pages/QuizBattleSession'));
const SoloQuiz = lazy(() => import('./pages/SoloQuiz'));
const SoloQuizSession = lazy(() => import('./pages/SoloQuizSession'));
const SoloQuizReview = lazy(() => import('./pages/SoloQuizReview'));
const Analytics = lazy(() => import('./pages/Analytics'));
const ChallengeSession = lazy(() => import('./pages/ChallengeSession'));
const Challenges = lazy(() => import('./pages/Challenges'));
const KnowledgeMap = lazy(() => import('./pages/KnowledgeMap'));
const ConceptWeb = lazy(() => import('./pages/ConceptWeb'));
const QuestionBank = lazy(() => import('./pages/Questionbankdashboard'));
const SlideExplorer = lazy(() => import('./pages/SlideExplorer'));
const Statistics = lazy(() => import('./pages/Statistics'));
const Flashcards = lazy(() => import('./pages/Flashcards'));
const NotesRedesign = lazy(() => import('./pages/NotesRedesign'));
const NotesHub = lazy(() => import('./pages/NotesHub'));
const AudioVideoNotes = lazy(() => import('./pages/AudioVideoNotes'));
const AIMediaNotes = lazy(() => import('./pages/AIMediaNotes'));
const MyNotes = lazy(() => import('./pages/MyNotes'));
const NotesPodcastMode = lazy(() => import('./pages/NotesPodcastMode'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Profile = lazy(() => import('./pages/ProfileNew'));
const ProfileQuiz = lazy(() => import('./pages/ProfileQuiz'));
const SearchHub = lazy(() => import('./pages/SearchHub'));
const Landing = lazy(() => import('./pages/Landing'));
const StudyInsights = lazy(() => import('./pages/StudyInsights'));
const Weaknesses = lazy(() => import('./pages/Weaknesses'));
const WeaknessPractice = lazy(() => import('./pages/WeaknessPractice'));
const WeaknessTips = lazy(() => import('./pages/WeaknessTips'));
const SharedItemViewer = lazy(() => import('./pages/SharedItemViewer'));
const PublicFlashcardView = lazy(() => import('./pages/PublicFlashcardView'));
const PublicChatView = lazy(() => import('./pages/PublicChatView'));
const NotesDashboard = lazy(() => import('./pages/NotesDashboard'));
const ActivityTimeline = lazy(() => import('./pages/ActivityTimeline'));
const CustomizeDashboard = lazy(() => import('./pages/CustomizeDashboard'));
const Games = lazy(() => import('./pages/Games'));
const PlaylistDetailPage = lazy(() => import('./pages/PlaylistDetailPage'));
const PlaylistsPage = lazy(() => import('./pages/PlaylistsPage'));
const XPRoadmap = lazy(() => import('./pages/XPRoadmap'));
const LearningPaths = lazy(() => import('./pages/LearningPaths'));
const LearningPathDetail = lazy(() => import('./pages/LearningPathDetail'));
const AdminAnalytics = lazy(() => import('./pages/AdminAnalytics'));
const AdminApiUsage = lazy(() => import('./pages/AdminApiUsage'));
const CanvasHub = lazy(() => import('./pages/CanvasHub'));
const Vault = lazy(() => import('./pages/Vault'));
const ContextFileAnalysis = lazy(() => import('./pages/ContextFileAnalysis'));

function App() {
  const [notification, setNotification] = useState(null);

  return (
    <ThemeProvider>
      <NotificationProvider>
        <ToastProvider>
          <RateLimitHandler />
          <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-top)', color: 'var(--text-primary)' }}>
            <GlobalNotifications />
            <AIChatDock />
            {notification && (
              <ProactiveNotification
                message={notification.message}
                chatId={notification.chatId}
                urgencyScore={notification.urgencyScore}
                onClose={() => setNotification(null)}
              />
            )}
            <ErrorBoundary>
              <Suspense fallback={<LoadingSpinner />}>
                <Routes>
                  <Route path="/" element={<Landing />} />
                  <Route path="/search-hub" element={<ProtectedRoute><SearchHub /></ProtectedRoute>} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/homepage" element={<ProtectedRoute><Homepage /></ProtectedRoute>} />
                  <Route path="/profile-quiz" element={<ProtectedRoute><ProfileQuiz /></ProtectedRoute>} />
                  <Route path="/dashboard-cerbyl" element={<ProtectedRoute><DashboardCerbyl /></ProtectedRoute>} />
                  <Route path="/dashboard" element={<Navigate to="/dashboard-cerbyl" replace />} />
                  <Route path="/dashboard-classic" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                  <Route path="/study-insights" element={<ProtectedRoute><StudyInsights /></ProtectedRoute>} />
                  <Route path="/weaknesses" element={<ProtectedRoute><Weaknesses /></ProtectedRoute>} />
                  <Route path="/weakness-practice" element={<ProtectedRoute><WeaknessPractice /></ProtectedRoute>} />
                  <Route path="/practice/:id" element={<ProtectedRoute><WeaknessPractice /></ProtectedRoute>} />
                  <Route path="/weakness-tips/:topic" element={<ProtectedRoute><WeaknessTips /></ProtectedRoute>} />
                  <Route path="/ai-chat" element={<ProtectedRoute><AIChat /></ProtectedRoute>} />
                  <Route path="/ai-chat/:chatId?" element={<ProtectedRoute><AIChat /></ProtectedRoute>} />
                  <Route path="/learning-review" element={<ProtectedRoute><LearningReviewHub /></ProtectedRoute>} />
                  <Route path="/social" element={<ProtectedRoute><Social /></ProtectedRoute>} />
                  <Route path="/shared" element={<ProtectedRoute><SharedPage /></ProtectedRoute>} />
                  <Route path="/shared/:contentType/:contentId" element={<SharedItemViewer />} />
                  <Route path="/shared/chat/:chatId" element={<AIChat sharedMode={true} />} />
                  <Route path="/shared/note/:noteId" element={<NotesRedesign sharedMode={true} />} />
                  <Route path="/flashcards/share/:token" element={<PublicFlashcardView />} />
                  <Route path="/chat/share/:token" element={<PublicChatView />} />
                  <Route path="/playlists" element={<ProtectedRoute><PlaylistsPage /></ProtectedRoute>} />
                  <Route path="/playlists/:playlistId" element={<ProtectedRoute><PlaylistDetailPage /></ProtectedRoute>} />
                  <Route path="/friends" element={<ProtectedRoute><FriendsDashboard /></ProtectedRoute>} />
                  <Route path="/activity-feed" element={<ProtectedRoute><ActivityFeed /></ProtectedRoute>} />
                  <Route path="/leaderboards" element={<ProtectedRoute><Leaderboards /></ProtectedRoute>} />
                  <Route path="/quiz-hub" element={<ProtectedRoute><QuizHub /></ProtectedRoute>} />
                  <Route path="/quiz-battles" element={<ProtectedRoute><QuizBattle /></ProtectedRoute>} />
                  <Route path="/quiz-battle/:battleId" element={<ProtectedRoute><QuizBattleSession /></ProtectedRoute>} />
                  <Route path="/solo-quiz" element={<ProtectedRoute><SoloQuiz /></ProtectedRoute>} />
                  <Route path="/solo-quiz/session" element={<ProtectedRoute><SoloQuizSession /></ProtectedRoute>} />
                  <Route path="/solo-quiz/review" element={<ProtectedRoute><SoloQuizReview /></ProtectedRoute>} />
                  <Route path="/solo-quiz/review/:quizId" element={<ProtectedRoute><SoloQuizReview /></ProtectedRoute>} />
                  <Route path="/solo-quiz/:quizId" element={<ProtectedRoute><SoloQuizSession /></ProtectedRoute>} />
                  <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
                  <Route path="/games" element={<ProtectedRoute><Games /></ProtectedRoute>} />
                  <Route path="/xp-roadmap" element={<ProtectedRoute><XPRoadmap /></ProtectedRoute>} />
                  <Route path="/challenges" element={<ProtectedRoute><Challenges /></ProtectedRoute>} />
                  <Route path="/challenge/:challengeId" element={<ProtectedRoute><ChallengeSession /></ProtectedRoute>} />
                  <Route path="/knowledge-map" element={<ProtectedRoute><KnowledgeMap /></ProtectedRoute>} />
                  <Route path="/knowledge-map/:mapId" element={<ProtectedRoute><KnowledgeMap /></ProtectedRoute>} />
                  <Route path="/knowledge-roadmap" element={<ProtectedRoute><KnowledgeMap /></ProtectedRoute>} />
                  <Route path="/knowledge-roadmap/:roadmapId" element={<ProtectedRoute><KnowledgeMap /></ProtectedRoute>} />
                  <Route path="/concept-web" element={<ProtectedRoute><ConceptWeb /></ProtectedRoute>} />
                  <Route path="/learning-paths" element={<ProtectedRoute><LearningPaths /></ProtectedRoute>} />
                  <Route path="/learning-paths/:pathId" element={<ProtectedRoute><LearningPathDetail /></ProtectedRoute>} />
                  <Route path="/question-bank" element={<ProtectedRoute><QuestionBank /></ProtectedRoute>} />
                  <Route path="/slide-explorer" element={<ProtectedRoute><SlideExplorer /></ProtectedRoute>} />
                  <Route path="/statistics" element={<ProtectedRoute><Statistics /></ProtectedRoute>} />
                  <Route path="/flashcards" element={<ProtectedRoute><Flashcards /></ProtectedRoute>} />
                  <Route path="/notes" element={<ProtectedRoute><NotesHub /></ProtectedRoute>} />
                  <Route path="/notes/dashboard" element={<ProtectedRoute><NotesDashboard /></ProtectedRoute>} />
                  <Route path="/notes/audio-video" element={<ProtectedRoute><AudioVideoNotes /></ProtectedRoute>} />
                  <Route path="/notes/ai-media" element={<ProtectedRoute><AIMediaNotes /></ProtectedRoute>} />
                  <Route path="/notes/ai-media/my-notes" element={<ProtectedRoute><AIMediaNotes /></ProtectedRoute>} />
                  <Route path="/notes/ai-media/:noteId" element={<ProtectedRoute><AIMediaNotes /></ProtectedRoute>} />
                  <Route path="/notes/my-notes" element={<ProtectedRoute><MyNotes /></ProtectedRoute>} />
                  <Route path="/notes/podcast" element={<ProtectedRoute><NotesPodcastMode /></ProtectedRoute>} />
                  <Route path="/notes/editor/:noteId" element={<ProtectedRoute><NotesRedesign /></ProtectedRoute>} />
                  <Route path="/activity-timeline" element={<ProtectedRoute><ActivityTimeline /></ProtectedRoute>} />
                  <Route path="/customize-dashboard" element={<ProtectedRoute><CustomizeDashboard /></ProtectedRoute>} />
                  <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                  <Route path="/admin/analytics" element={<ProtectedRoute><AdminAnalytics /></ProtectedRoute>} />
                  <Route path="/admin/api-usage" element={<ProtectedRoute><AdminApiUsage /></ProtectedRoute>} />
                  <Route path="/admin/api_usage" element={<Navigate to="/admin/api-usage" replace />} />
                  <Route path="/api-usage" element={<Navigate to="/admin/api-usage" replace />} />
                  <Route path="/api_usage" element={<Navigate to="/admin/api-usage" replace />} />
                  <Route path="/contexthub" element={<ProtectedRoute><Vault /></ProtectedRoute>} />
                  <Route path="/contexthub/file/:docId" element={<ProtectedRoute><ContextFileAnalysis /></ProtectedRoute>} />
                  <Route path="/context" element={<Navigate to="/contexthub" replace />} />
                  <Route path="/vault" element={<Navigate to="/contexthub" replace />} />
                  <Route path="/canvas" element={<ProtectedRoute><CanvasHub /></ProtectedRoute>} />
                  <Route path="/home" element={<Navigate to="/dashboard-cerbyl" replace />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </ErrorBoundary>
          </div>
        </ToastProvider>
      </NotificationProvider>
    </ThemeProvider>
  );
}

export default App;

// src/App.js (Corrected import path)

import React from 'react';
import Dashboard from './pages/Dashboard';
import AIChat from './pages/AIChat';
import Homepage from './pages/Homepage';
import LearningReview from './pages/LearningReview';
import Flashcards from './pages/Flashcards';
import Notes from './pages/Notes';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/profile';
import TrialWrapper from './pages/TrialWrapper'; // UPDATED PATH
import { Routes, Route, Navigate } from "react-router-dom";

function App() {
  return (
    <div className="min-h-screen bg-black">
      {/* WRAP EVERYTHING WITH TRIAL WRAPPER */}
      <TrialWrapper>
        <Routes>
          <Route path="/" element={<Homepage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/ai-chat" element={<AIChat />} />
          <Route path="/learning-review" element={<LearningReview />} />
          <Route path="/flashcards" element={<Flashcards />} />
          <Route path="/notes" element={<Notes />} />
          <Route path="/home" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </TrialWrapper>
    </div>
  );
}

export default App;
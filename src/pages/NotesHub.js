import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload, Youtube, FileText, Mic, Video, BookOpen, Edit3, User
} from 'lucide-react';
import './NotesHub.css';
import { API_URL } from '../config';

const NotesHub = () => {
  const navigate = useNavigate();





  return (
    <div className="notes-hub-split">
      <div className="notes-hub-header">
        <div className="header-left">
          <h1 className="page-title">CERBYL</h1>
          <span className="page-subtitle">study notes</span>
        </div>
        <button onClick={() => navigate('/dashboard')} className="back-to-dashboard">
          back to dashboard
        </button>
      </div>

      <div className="split-container">
        {/* Left Section - Audio/Video Notes */}
        <div className="split-section left-section" onClick={() => navigate('/notes/audio-video')}>
          <div className="section-content">
            <div className="section-icon-box">
              <Mic size={48} strokeWidth={1.5} />
            </div>
            
            <h2 className="section-title">generate from media</h2>
            <p className="section-subtitle">GENERATE FROM MEDIA</p>
            
            <div className="section-features">
              <div className="feature-item">
                <Upload size={14} />
                <span>Upload Audio Files</span>
              </div>
              <div className="feature-item">
                <Video size={14} />
                <span>Upload Videos</span>
              </div>
              <div className="feature-item">
                <Youtube size={14} />
                <span>YouTube Links</span>
              </div>
            </div>

            <button className="section-cta">
              START GENERATING
            </button>
          </div>
        </div>

        <div className="divider-vertical">
          <span>OR</span>
        </div>

        {/* Right Section - My Notes */}
        <div className="split-section right-section" onClick={() => navigate('/notes/my-notes')}>
          <div className="section-content">
            <div className="section-icon-box">
              <BookOpen size={48} strokeWidth={1.5} />
            </div>
            
            <h2 className="section-title">my notes</h2>
            <p className="section-subtitle">MANUAL NOTE-TAKING</p>
            
            <div className="section-features">
              <div className="feature-item">
                <Edit3 size={14} />
                <span>Rich Text Editor</span>
              </div>
              <div className="feature-item">
                <FileText size={14} />
                <span>Organize Notes</span>
              </div>
              <div className="feature-item">
                <User size={14} />
                <span>Personal Library</span>
              </div>
            </div>

            <button className="section-cta">
              VIEW MY NOTES
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotesHub;

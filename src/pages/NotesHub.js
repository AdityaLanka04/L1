import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload, Youtube, FileText, Mic, Video, BookOpen, Edit3, User, Zap
} from 'lucide-react';
import './NotesHub.css';
import { API_URL } from '../config';
import ImportExportModal from '../components/ImportExportModal';

const NotesHub = () => {
  const navigate = useNavigate();
  const [showImportExport, setShowImportExport] = useState(false);



  return (
    <div className="notes-hub-page notes-hub-split">
      <div className="notes-hub-header">
        <div className="header-left">
          <h1 className="page-title">cerbyl</h1>
          <span className="page-subtitle">study notes</span>
        </div>
        <div className="header-actions">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setShowImportExport(true);
            }} 
            className="convert-btn"
            title="Convert notes"
          >
            <Zap size={18} />
            <span>Convert</span>
          </button>
          <button onClick={() => navigate('/dashboard')} className="back-to-dashboard">
            back to dashboard
          </button>
        </div>
      </div>

      <div className="split-container">
        {/* Left Section - AI Media Notes */}
        <div className="split-section left-section" onClick={() => navigate('/notes/ai-media')}>
          <div className="section-content">
            <div className="section-icon-box">
              <Mic size={48} strokeWidth={1.5} />
            </div>
            
            <h2 className="section-title">AI Media Notes</h2>
            <p className="section-subtitle">AI-POWERED TRANSCRIPTION & NOTES</p>
            
            <div className="section-features">
              <div className="feature-item">
                <Upload size={14} />
                <span>Audio & Video Files</span>
              </div>
              <div className="feature-item">
                <Youtube size={14} />
                <span>YouTube Transcripts</span>
              </div>
              <div className="feature-item">
                <FileText size={14} />
                <span>AI-Generated Notes</span>
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
      
      {/* Import/Export Modal */}
      <ImportExportModal
        isOpen={showImportExport}
        onClose={() => setShowImportExport(false)}
        mode="import"
        sourceType="notes"
        onSuccess={(result) => {
          alert("Successfully converted notes!");
        }}
      />
    </div>
  );
};

export default NotesHub;

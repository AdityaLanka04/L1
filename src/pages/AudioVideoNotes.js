import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Youtube, FileText, Save, Copy, RefreshCw, Mic, Loader, ArrowLeft } from 'lucide-react';
import './AudioVideoNotes.css';
import { API_URL } from '../config';

const AudioVideoNotes = () => {
  const navigate = useNavigate();
  const userName = localStorage.getItem('username');

  const [uploadedFile, setUploadedFile] = useState(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [generatedNotes, setGeneratedNotes] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setUploadedFile(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      setUploadedFile(file);
    }
  };

  const generateNotesFromMedia = async () => {
    if (!uploadedFile && !youtubeUrl) {
      alert('Please upload a file or provide a YouTube URL');
      return;
    }

    setIsGenerating(true);
    setGenerationProgress(0);

    try {
      const formData = new FormData();
      formData.append('user_id', userName);
      
      if (uploadedFile) {
        formData.append('file', uploadedFile);
      } else if (youtubeUrl) {
        formData.append('youtube_url', youtubeUrl);
      }

      const progressInterval = setInterval(() => {
        setGenerationProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/generate_notes_from_media`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      clearInterval(progressInterval);
      setGenerationProgress(100);

      if (response.ok) {
        const data = await response.json();
        setGeneratedNotes(data.notes);
      } else {
        throw new Error('Failed to generate notes');
      }
    } catch (error) {
            alert('Failed to generate notes. Please try again.');
    } finally {
      setIsGenerating(false);
      setTimeout(() => setGenerationProgress(0), 1000);
    }
  };

  const copyNotes = () => {
    navigator.clipboard.writeText(generatedNotes);
    alert('Notes copied to clipboard!');
  };

  const saveToMyNotes = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/create_note`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          user_id: userName,
          title: 'Generated Notes',
          content: generatedNotes
        })
      });

      if (response.ok) {
        const newNote = await response.json();
        alert('Notes saved successfully!');
        navigate(`/notes/editor/${newNote.id}`);
      }
    } catch (error) {
            alert('Failed to save notes');
    }
  };

  const regenerateNotes = () => {
    setGeneratedNotes('');
    generateNotesFromMedia();
  };

  return (
    <div className="audio-video-notes-page">
      <div className="page-header-bar">
        <div className="header-left">
          <h1 className="page-title-main">audio / video notes</h1>
          <p className="page-subtitle-main">generate notes from media files</p>
        </div>
        <button onClick={() => navigate('/notes')} className="back-btn">
          back to notes
        </button>
      </div>

      <div className="content-grid">
        <div className="upload-panel">
          <h2>Upload Media</h2>
          
          <div
            className={`upload-area ${isDragging ? 'dragging' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              type="file"
              id="file-upload"
              accept="audio/*,video/*"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
            <label htmlFor="file-upload" className="upload-label">
              <Upload size={48} />
              <p>Drag & drop or click to upload</p>
              <span>Supports audio & video files</span>
            </label>
            {uploadedFile && (
              <div className="uploaded-file">
                <FileText size={20} />
                <span>{uploadedFile.name}</span>
              </div>
            )}
          </div>

          <div className="divider">
            <span>or</span>
          </div>

          <div className="youtube-input-group">
            <Youtube size={20} />
            <input
              type="text"
              placeholder="Paste YouTube URL here..."
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
            />
          </div>

          <button
            onClick={generateNotesFromMedia}
            disabled={isGenerating || (!uploadedFile && !youtubeUrl)}
            className="generate-btn"
          >
            {isGenerating ? (
              <>
                <Loader size={18} className="spinner" />
                Generating...
              </>
            ) : (
              <>
                <Mic size={18} />
                Generate Notes
              </>
            )}
          </button>

          {isGenerating && (
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${generationProgress}%` }} />
            </div>
          )}
        </div>

        {generatedNotes && (
          <div className="output-panel">
            <div className="output-header">
              <h2>Generated Notes</h2>
              <div className="output-actions">
                <button onClick={copyNotes} className="action-btn">
                  <Copy size={16} />
                  Copy
                </button>
                <button onClick={saveToMyNotes} className="action-btn primary">
                  <Save size={16} />
                  Save to My Notes
                </button>
                <button onClick={regenerateNotes} className="action-btn">
                  <RefreshCw size={16} />
                  Regenerate
                </button>
              </div>
            </div>
            <div className="notes-output" dangerouslySetInnerHTML={{ __html: generatedNotes }} />
          </div>
        )}
      </div>
    </div>
  );
};

export default AudioVideoNotes;

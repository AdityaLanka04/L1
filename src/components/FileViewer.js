import React, { useState } from 'react';
import { X, Download, ExternalLink } from 'lucide-react';
import './FileViewer.css';

const FileViewer = ({ fileUrl, fileName, fileType, onClose }) => {
  const [loading, setLoading] = useState(true);

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenExternal = () => {
    window.open(fileUrl, '_blank');
  };

  return (
    <div className="file-viewer-overlay" onClick={onClose}>
      <div className="file-viewer-modal" onClick={(e) => e.stopPropagation()}>
        <div className="file-viewer-header">
          <h3>{fileName}</h3>
          <div className="file-viewer-actions">
            <button onClick={handleDownload} title="Download">
              <Download size={18} />
            </button>
            <button onClick={handleOpenExternal} title="Open in new tab">
              <ExternalLink size={18} />
            </button>
            <button onClick={onClose} title="Close">
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="file-viewer-content">
          {loading && <div className="file-viewer-loading">Loading document...</div>}
          {fileType === 'pdf' ? (
            <iframe
              src={fileUrl}
              title={fileName}
              onLoad={() => setLoading(false)}
              style={{ display: loading ? 'none' : 'block' }}
            />
          ) : (
            <div className="file-viewer-unsupported">
              <p>Preview not available for this file type.</p>
              <button onClick={handleDownload} className="download-btn">
                <Download size={16} />
                Download {fileName}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FileViewer;

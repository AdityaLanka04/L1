import React from 'react';
import { X, Check } from 'lucide-react';
import './TemplatePreview.css';

const TemplatePreview = ({ template, onClose, onSelect }) => {
  if (!template) return null;

  return (
    <div className="template-preview-overlay" onClick={onClose}>
      <div className="template-preview-modal" onClick={(e) => e.stopPropagation()}>
        <div className="template-preview-header">
          <h2>{template.name}</h2>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        
        <div className="template-preview-content">
          <div className="template-preview-description">
            <p>{template.description}</p>
          </div>
          
          <div className="template-preview-body">
            <div className="preview-label">Preview:</div>
            <div 
              className="template-preview-render"
              dangerouslySetInnerHTML={{ __html: template.content }}
            />
          </div>
        </div>
        
        <div className="template-preview-footer">
          <button className="cancel-btn" onClick={onClose}>
            Cancel
          </button>
          <button className="use-template-btn" onClick={() => onSelect(template)}>
            <Check size={18} />
            Use This Template
          </button>
        </div>
      </div>
    </div>
  );
};

export default TemplatePreview;

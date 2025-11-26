import React, { useState, useEffect } from 'react';
import { X, FileText, Calendar, Briefcase, BookOpen, CheckSquare, Users, Trash2, Edit } from 'lucide-react';
import './Templates.css';

const BUILT_IN_TEMPLATES = [
  {
    id: 'meeting-notes',
    name: 'Meeting Notes',
    description: 'Structured template for meeting documentation',
    icon: Users,
    category: 'work',
    content: `# Meeting Notes - {{date}}

## Attendees
- 

## Agenda
1. 

## Discussion Points
- 

## Action Items
- [ ] 

## Next Steps
- 

## Notes
`
  },
  {
    id: 'daily-journal',
    name: 'Daily Journal',
    description: 'Daily reflection and planning template',
    icon: Calendar,
    category: 'personal',
    content: `# Daily Journal - {{date}}

## Morning Reflection
What am I grateful for today?
- 

## Goals for Today
- [ ] 
- [ ] 
- [ ] 

## Priorities
1. 
2. 
3. 

## Evening Reflection
What went well today?
- 

What could be improved?
- 

## Tomorrow's Focus
- 
`
  },
  {
    id: 'project-plan',
    name: 'Project Plan',
    description: 'Comprehensive project planning template',
    icon: Briefcase,
    category: 'work',
    content: `# Project Plan: {{title}}

## Overview
**Project Name:** 
**Start Date:** {{date}}
**End Date:** 
**Project Manager:** {{user}}

## Objectives
- 

## Scope
### In Scope
- 

### Out of Scope
- 

## Milestones
1. 
2. 
3. 

## Resources
- 

## Risks
- 

## Success Criteria
- 
`
  },
  {
    id: 'study-notes',
    name: 'Study Notes',
    description: 'Organized study and learning template',
    icon: BookOpen,
    category: 'education',
    content: `# Study Notes - {{title}}

## Topic Overview
**Subject:** 
**Date:** {{date}}
**Source:** 

## Key Concepts
1. 

## Detailed Notes
### Section 1
- 

### Section 2
- 

## Important Formulas/Definitions
- 

## Examples
1. 

## Questions to Review
- [ ] 

## Summary
`
  },
  {
    id: 'task-list',
    name: 'Task List',
    description: 'Simple task management template',
    icon: CheckSquare,
    category: 'productivity',
    content: `# Task List - {{date}}

## High Priority
- [ ] 

## Medium Priority
- [ ] 

## Low Priority
- [ ] 

## Completed Today
- [x] 

## Notes
`
  },
  {
    id: 'weekly-review',
    name: 'Weekly Review',
    description: 'Weekly reflection and planning',
    icon: Calendar,
    category: 'personal',
    content: `# Weekly Review - Week of {{date}}

## Accomplishments This Week
- 

## Challenges Faced
- 

## Lessons Learned
- 

## Goals for Next Week
1. 
2. 
3. 

## Areas for Improvement
- 

## Gratitude
- 
`
  }
];

const Templates = ({ onSelectTemplate, onClose, userName }) => {
  const [activeTab, setActiveTab] = useState('built-in');
  const [customTemplates, setCustomTemplates] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTemplate, setNewTemplate] = useState({ name: '', description: '', content: '' });

  useEffect(() => {
    // Load custom templates from localStorage
    const saved = JSON.parse(localStorage.getItem('customTemplates') || '[]');
    setCustomTemplates(saved);
  }, []);

  const saveCustomTemplate = () => {
    if (!newTemplate.name.trim() || !newTemplate.content.trim()) {
      alert('Please fill in template name and content');
      return;
    }

    const template = {
      id: `custom-${Date.now()}`,
      ...newTemplate,
      createdAt: new Date().toISOString()
    };

    const updated = [...customTemplates, template];
    setCustomTemplates(updated);
    localStorage.setItem('customTemplates', JSON.stringify(updated));
    
    setNewTemplate({ name: '', description: '', content: '' });
    setShowCreateForm(false);
  };

  const deleteCustomTemplate = (id) => {
    if (!window.confirm('Delete this template?')) return;
    
    const updated = customTemplates.filter(t => t.id !== id);
    setCustomTemplates(updated);
    localStorage.setItem('customTemplates', JSON.stringify(updated));
  };

  const applyTemplate = (template) => {
    let content = template.content;
    
    // Replace variables
    const now = new Date();
    content = content.replace(/\{\{date\}\}/g, now.toLocaleDateString());
    content = content.replace(/\{\{time\}\}/g, now.toLocaleTimeString());
    content = content.replace(/\{\{user\}\}/g, userName || 'User');
    content = content.replace(/\{\{title\}\}/g, template.name);
    
    // Convert markdown to blocks
    const blocks = parseMarkdownToBlocks(content);
    
    onSelectTemplate({
      title: template.name,
      content: content,
      blocks: blocks
    });
    onClose();
  };

  const parseMarkdownToBlocks = (markdown) => {
    const lines = markdown.split('\n');
    const blocks = [];
    let currentListItems = [];
    let currentListType = null;

    const flushList = () => {
      if (currentListItems.length > 0) {
        currentListItems.forEach(item => {
          blocks.push({
            id: Date.now() + Math.random(),
            type: currentListType === 'todo' ? 'todo' : currentListType === 'numbered' ? 'numberedList' : 'bulletList',
            content: cleanMarkdown(item.content),
            properties: currentListType === 'todo' ? { checked: item.checked } : {}
          });
        });
        currentListItems = [];
        currentListType = null;
      }
    };

    // Helper function to clean markdown formatting from text
    const cleanMarkdown = (text) => {
      return text
        .replace(/\*\*(.*?)\*\*/g, '$1')  // Remove bold **text**
        .replace(/\*(.*?)\*/g, '$1')      // Remove italic *text*
        .replace(/__(.*?)__/g, '$1')      // Remove bold __text__
        .replace(/_(.*?)_/g, '$1')        // Remove italic _text_
        .replace(/`(.*?)`/g, '$1')        // Remove inline code `text`
        .trim();
    };

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      
      // Skip empty lines
      if (!trimmed) {
        flushList();
        return;
      }

      // Heading 1
      if (trimmed.startsWith('# ') && !trimmed.startsWith('## ')) {
        flushList();
        blocks.push({
          id: Date.now() + Math.random() + index,
          type: 'heading1',
          content: cleanMarkdown(trimmed.substring(2)),
          properties: {}
        });
      }
      // Heading 2
      else if (trimmed.startsWith('## ') && !trimmed.startsWith('### ')) {
        flushList();
        blocks.push({
          id: Date.now() + Math.random() + index,
          type: 'heading2',
          content: cleanMarkdown(trimmed.substring(3)),
          properties: {}
        });
      }
      // Heading 3
      else if (trimmed.startsWith('### ')) {
        flushList();
        blocks.push({
          id: Date.now() + Math.random() + index,
          type: 'heading3',
          content: cleanMarkdown(trimmed.substring(4)),
          properties: {}
        });
      }
      // Todo list
      else if (trimmed.startsWith('- [ ]') || trimmed.startsWith('- [x]')) {
        if (currentListType !== 'todo') {
          flushList();
          currentListType = 'todo';
        }
        currentListItems.push({
          content: trimmed.substring(5).trim(),
          checked: trimmed.includes('[x]')
        });
      }
      // Bullet list
      else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        if (currentListType !== 'bullet') {
          flushList();
          currentListType = 'bullet';
        }
        currentListItems.push({
          content: trimmed.substring(2).trim()
        });
      }
      // Numbered list
      else if (/^\d+\.\s/.test(trimmed)) {
        if (currentListType !== 'numbered') {
          flushList();
          currentListType = 'numbered';
        }
        currentListItems.push({
          content: trimmed.replace(/^\d+\.\s/, '').trim()
        });
      }
      // Code block
      else if (trimmed.startsWith('```')) {
        flushList();
        // Skip code block markers for now
        return;
      }
      // Divider
      else if (trimmed === '---' || trimmed === '***') {
        flushList();
        blocks.push({
          id: Date.now() + Math.random() + index,
          type: 'divider',
          content: '',
          properties: {}
        });
      }
      // Quote
      else if (trimmed.startsWith('> ')) {
        flushList();
        blocks.push({
          id: Date.now() + Math.random() + index,
          type: 'quote',
          content: cleanMarkdown(trimmed.substring(2)),
          properties: {}
        });
      }
      // Regular paragraph (clean all markdown formatting)
      else {
        flushList();
        blocks.push({
          id: Date.now() + Math.random() + index,
          type: 'paragraph',
          content: cleanMarkdown(trimmed),
          properties: {}
        });
      }
    });

    // Flush any remaining list items
    flushList();

    // If no blocks were created, add a default paragraph
    if (blocks.length === 0) {
      blocks.push({
        id: Date.now(),
        type: 'paragraph',
        content: '',
        properties: {}
      });
    }

    return blocks;
  };

  const filteredBuiltIn = activeTab === 'built-in' 
    ? BUILT_IN_TEMPLATES 
    : BUILT_IN_TEMPLATES.filter(t => t.category === activeTab);

  return (
    <div className="templates-modal">
        <div className="templates-header">
          <h2>Note Templates</h2>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="templates-tabs">
          <button
            className={`template-tab ${activeTab === 'built-in' ? 'active' : ''}`}
            onClick={() => setActiveTab('built-in')}
          >
            All Templates
          </button>
          <button
            className={`template-tab ${activeTab === 'work' ? 'active' : ''}`}
            onClick={() => setActiveTab('work')}
          >
            Work
          </button>
          <button
            className={`template-tab ${activeTab === 'personal' ? 'active' : ''}`}
            onClick={() => setActiveTab('personal')}
          >
            Personal
          </button>
          <button
            className={`template-tab ${activeTab === 'education' ? 'active' : ''}`}
            onClick={() => setActiveTab('education')}
          >
            Education
          </button>
          <button
            className={`template-tab ${activeTab === 'custom' ? 'active' : ''}`}
            onClick={() => setActiveTab('custom')}
          >
            Custom ({customTemplates.length})
          </button>
        </div>

        <div className="templates-content">
          {activeTab === 'custom' ? (
            <>
              {!showCreateForm && (
                <button
                  className="template-card"
                  style={{ borderStyle: 'dashed' }}
                  onClick={() => setShowCreateForm(true)}
                >
                  <div className="template-icon">
                    <FileText size={24} />
                  </div>
                  <h3>Create Custom Template</h3>
                  <p>Build your own reusable note template</p>
                </button>
              )}

              {showCreateForm && (
                <div className="custom-template-form">
                  <h3>Create New Template</h3>
                  <div className="form-group">
                    <label>Template Name</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g., Bug Report, Recipe, etc."
                      value={newTemplate.name}
                      onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Description</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Brief description of this template"
                      value={newTemplate.description}
                      onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Template Content</label>
                    <textarea
                      className="form-textarea"
                      placeholder="Enter your template content here..."
                      value={newTemplate.content}
                      onChange={(e) => setNewTemplate({ ...newTemplate, content: e.target.value })}
                    />
                    <div className="template-variables-hint">
                      <strong>Available Variables:</strong>
                      <div>
                        <code>{'{{date}}'}</code> - Current date
                        <br />
                        <code>{'{{time}}'}</code> - Current time
                        <br />
                        <code>{'{{user}}'}</code> - Your username
                        <br />
                        <code>{'{{title}}'}</code> - Template name
                      </div>
                    </div>
                  </div>
                  <div className="form-actions">
                    <button
                      className="form-btn form-btn-cancel"
                      onClick={() => {
                        setShowCreateForm(false);
                        setNewTemplate({ name: '', description: '', content: '' });
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      className="form-btn form-btn-save"
                      onClick={saveCustomTemplate}
                    >
                      Save Template
                    </button>
                  </div>
                </div>
              )}

              {customTemplates.length > 0 && (
                <div className="saved-templates-list" style={{ marginTop: '20px' }}>
                  {customTemplates.map(template => (
                    <div key={template.id} className="saved-template-item">
                      <div
                        className="saved-template-info"
                        onClick={() => applyTemplate(template)}
                      >
                        <h4>{template.name}</h4>
                        <p>{template.description || 'No description'}</p>
                      </div>
                      <div className="saved-template-actions">
                        <button
                          className="template-action-btn"
                          onClick={() => applyTemplate(template)}
                        >
                          Use
                        </button>
                        <button
                          className="template-action-btn delete"
                          onClick={() => deleteCustomTemplate(template.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="templates-grid">
              {filteredBuiltIn.map(template => {
                const Icon = template.icon;
                return (
                  <div
                    key={template.id}
                    className="template-card"
                    onClick={() => applyTemplate(template)}
                  >
                    <div className="template-icon">
                      <Icon size={24} />
                    </div>
                    <h3>{template.name}</h3>
                    <p>{template.description}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
  );
};

export default Templates;

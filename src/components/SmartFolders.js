import React, { useState, useEffect } from 'react';
import { FolderPlus, Trash2, Check, X, Sparkles, Filter } from 'lucide-react';
import './SmartFolders.css';

const SmartFolders = ({ notes = [], onFolderSelect, onClose }) => {
  const [smartFolders, setSmartFolders] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newFolder, setNewFolder] = useState({
    name: '',
    rules: [{ type: 'tag', operator: 'contains', value: '' }]
  });

  const templates = [
    {
      name: 'Recent Notes',
      rules: [{ type: 'date', operator: 'last', value: '7' }]
    },
    {
      name: 'Favorites',
      rules: [{ type: 'favorite', operator: 'is', value: 'true' }]
    },
    {
      name: 'Long Notes',
      rules: [{ type: 'wordCount', operator: 'greater', value: '500' }]
    },
    {
      name: 'Untagged',
      rules: [{ type: 'tag', operator: 'empty', value: '' }]
    }
  ];

  useEffect(() => {
    const stored = localStorage.getItem('smartFolders');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setSmartFolders(Array.isArray(parsed) ? parsed : []);
      } catch (e) {
        console.error('Error loading smart folders:', e);
        setSmartFolders([]);
      }
    }
  }, []);

  const saveSmartFolders = (folders) => {
    setSmartFolders(folders);
    localStorage.setItem('smartFolders', JSON.stringify(folders));
  };

  const createSmartFolder = () => {
    if (!newFolder.name.trim()) {
      alert('Please enter a folder name');
      return;
    }

    const hasValidRules = newFolder.rules.every(rule => {
      if (rule.operator === 'empty') return true;
      return rule.value && rule.value.trim() !== '';
    });

    if (!hasValidRules) {
      alert('Please fill in all rule values');
      return;
    }

    const folder = {
      id: Date.now(),
      name: newFolder.name,
      rules: newFolder.rules,
      createdAt: new Date().toISOString()
    };

    saveSmartFolders([...smartFolders, folder]);
    setNewFolder({ name: '', rules: [{ type: 'tag', operator: 'contains', value: '' }] });
    setShowCreateModal(false);
  };

  const deleteSmartFolder = (id, e) => {
    e.stopPropagation();
    if (window.confirm('Delete this smart folder?')) {
      saveSmartFolders(smartFolders.filter(f => f.id !== id));
    }
  };

  const addRule = () => {
    setNewFolder({
      ...newFolder,
      rules: [...newFolder.rules, { type: 'tag', operator: 'contains', value: '' }]
    });
  };

  const updateRule = (index, field, value) => {
    const updatedRules = [...newFolder.rules];
    updatedRules[index] = { ...updatedRules[index], [field]: value };
    
    // Auto-adjust operator when type changes
    if (field === 'type') {
      if (value === 'tag') {
        updatedRules[index].operator = 'contains';
      } else if (value === 'title') {
        updatedRules[index].operator = 'contains';
      } else if (value === 'date') {
        updatedRules[index].operator = 'last';
      } else if (value === 'favorite') {
        updatedRules[index].operator = 'is';
      } else if (value === 'wordCount') {
        updatedRules[index].operator = 'greater';
      }
    }
    
    setNewFolder({ ...newFolder, rules: updatedRules });
  };

  const removeRule = (index) => {
    if (newFolder.rules.length === 1) return;
    setNewFolder({
      ...newFolder,
      rules: newFolder.rules.filter((_, i) => i !== index)
    });
  };

  const applyTemplate = (template) => {
    setNewFolder({
      name: template.name,
      rules: JSON.parse(JSON.stringify(template.rules))
    });
    setShowCreateModal(true);
  };

  const extractTags = (content) => {
    if (!content) return [];
    const tagRegex = /#(\w+)/g;
    const matches = content.match(tagRegex) || [];
    return matches.map(tag => tag.substring(1));
  };

  const filterNotesByRules = (folder) => {
    if (!notes || !Array.isArray(notes)) return [];
    
    return notes.filter(note => {
      if (!note) return false;
      
      return folder.rules.every(rule => {
        try {
          switch (rule.type) {
            case 'tag': {
              const tags = extractTags(note.content || '');
              if (rule.operator === 'contains') {
                if (!rule.value) return true;
                return tags.some(tag => 
                  tag.toLowerCase().includes(rule.value.toLowerCase())
                );
              } else if (rule.operator === 'empty') {
                return tags.length === 0;
              }
              return true;
            }
            
            case 'date': {
              const noteDate = new Date(note.updated_at || note.created_at);
              if (isNaN(noteDate.getTime())) return false;
              
              const daysAgo = parseInt(rule.value) || 0;
              const cutoffDate = new Date();
              cutoffDate.setDate(cutoffDate.getDate() - daysAgo);
              
              if (rule.operator === 'last') {
                return noteDate >= cutoffDate;
              }
              return true;
            }
            
            case 'favorite': {
              if (rule.operator === 'is') {
                return note.is_favorite === (rule.value === 'true');
              }
              return true;
            }
            
            case 'wordCount': {
              const text = (note.content || '').replace(/<[^>]+>/g, '').trim();
              const words = text.split(/\s+/).filter(w => w.length > 0);
              const count = words.length;
              const threshold = parseInt(rule.value) || 0;
              
              if (rule.operator === 'greater') {
                return count > threshold;
              } else if (rule.operator === 'less') {
                return count < threshold;
              }
              return true;
            }
            
            case 'title': {
              if (rule.operator === 'contains') {
                if (!rule.value) return true;
                return (note.title || '').toLowerCase().includes(rule.value.toLowerCase());
              }
              return true;
            }
            
            default:
              return true;
          }
        } catch (e) {
          console.error('Error filtering note:', e);
          return false;
        }
      });
    });
  };

  const handleFolderClick = (folder) => {
    const filteredNotes = filterNotesByRules(folder);
    if (onFolderSelect) {
      onFolderSelect(filteredNotes, folder.name);
    }
  };

  return (
    <div className="smart-folders-panel">
      <div className="smart-folders-header">
        <div className="header-title">
          <Sparkles size={18} />
          <h3>Smart Folders</h3>
        </div>
        <button className="close-btn" onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      <div className="smart-folders-content">
        <div className="templates-section">
          <h4>Quick Templates</h4>
          <div className="templates-grid">
            {templates.map((template, idx) => (
              <button
                key={idx}
                className="template-card"
                onClick={() => applyTemplate(template)}
              >
                <span className="template-name">{template.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="folders-section">
          <div className="section-header">
            <h4>Your Smart Folders</h4>
            <button
              className="create-btn"
              onClick={() => setShowCreateModal(true)}
            >
              <FolderPlus size={16} />
              Create
            </button>
          </div>

          <div className="folders-list">
            {smartFolders.length === 0 ? (
              <div className="empty-state">
                <Filter size={32} style={{ opacity: 0.3, marginBottom: '12px' }} />
                <p>No smart folders yet</p>
                <p className="hint">Create one to auto-organize your notes</p>
              </div>
            ) : (
              smartFolders.map(folder => {
                const matchingNotes = filterNotesByRules(folder);
                return (
                  <div key={folder.id} className="smart-folder-item">
                    <button
                      className="folder-button"
                      onClick={() => handleFolderClick(folder)}
                    >
                      <span className="folder-name">{folder.name}</span>
                      <span className="folder-count">{matchingNotes.length}</span>
                    </button>
                    <button
                      className="delete-btn"
                      onClick={(e) => deleteSmartFolder(folder.id, e)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {showCreateModal && (
        <div className="smart-folder-modal" onClick={(e) => {
          if (e.target.className === 'smart-folder-modal') {
            setShowCreateModal(false);
          }
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create Smart Folder</h3>
              <button onClick={() => setShowCreateModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label>Folder Name</label>
                <input
                  type="text"
                  value={newFolder.name}
                  onChange={(e) => setNewFolder({ ...newFolder, name: e.target.value })}
                  placeholder="e.g., Work Notes"
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label>Rules (all must match)</label>
                {newFolder.rules.map((rule, idx) => (
                  <div key={idx} className="rule-row">
                    <select
                      value={rule.type}
                      onChange={(e) => updateRule(idx, 'type', e.target.value)}
                    >
                      <option value="tag">Tag</option>
                      <option value="title">Title</option>
                      <option value="date">Date</option>
                      <option value="favorite">Favorite</option>
                      <option value="wordCount">Word Count</option>
                    </select>

                    <select
                      value={rule.operator}
                      onChange={(e) => updateRule(idx, 'operator', e.target.value)}
                    >
                      {rule.type === 'tag' && (
                        <>
                          <option value="contains">contains</option>
                          <option value="empty">is empty</option>
                        </>
                      )}
                      {rule.type === 'title' && (
                        <option value="contains">contains</option>
                      )}
                      {rule.type === 'date' && (
                        <option value="last">last</option>
                      )}
                      {rule.type === 'favorite' && (
                        <option value="is">is</option>
                      )}
                      {rule.type === 'wordCount' && (
                        <>
                          <option value="greater">greater than</option>
                          <option value="less">less than</option>
                        </>
                      )}
                    </select>

                    {rule.operator !== 'empty' && (
                      <input
                        type="text"
                        value={rule.value}
                        onChange={(e) => updateRule(idx, 'value', e.target.value)}
                        placeholder={
                          rule.type === 'date' ? 'days (e.g., 7)' :
                          rule.type === 'wordCount' ? 'number (e.g., 500)' :
                          rule.type === 'favorite' ? 'true or false' :
                          'value'
                        }
                      />
                    )}

                    <button
                      className="remove-rule-btn"
                      onClick={() => removeRule(idx)}
                      disabled={newFolder.rules.length === 1}
                      title={newFolder.rules.length === 1 ? 'At least one rule required' : 'Remove rule'}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}

                <button className="add-rule-btn" onClick={addRule}>
                  + Add Rule
                </button>
              </div>
            </div>

            <div className="modal-footer">
              <button className="cancel-btn" onClick={() => setShowCreateModal(false)}>
                Cancel
              </button>
              <button className="create-btn" onClick={createSmartFolder}>
                <Check size={16} />
                Create Folder
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SmartFolders;

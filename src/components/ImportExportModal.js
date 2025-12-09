import { useState, useEffect } from 'react';
import { 
  X, Download, FileText, HelpCircle, 
  Zap, CheckCircle, Loader, ArrowRight 
} from 'lucide-react';
import { API_URL } from '../config';
import './ImportExportModal.css';

const ImportExportModal = ({ 
  isOpen, 
  onClose, 
  mode = 'import', // 'import' or 'export'
  sourceType, // 'notes', 'flashcards', 'questions', etc.
  onSuccess 
}) => {
  const [step, setStep] = useState(1);
  const [selectedItems, setSelectedItems] = useState([]);
  const [availableItems, setAvailableItems] = useState([]);
  const [destinationType, setDestinationType] = useState('');
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [options, setOptions] = useState({
    cardCount: 10,
    questionCount: 10,
    difficulty: 'medium',
    formatStyle: 'structured'
  });

  const userName = localStorage.getItem('username');
  const token = localStorage.getItem('token');

  // Define conversion options based on source type
  const conversionOptions = {
    notes: [
      { value: 'flashcards', label: 'Flashcards', icon: <HelpCircle size={24} />, description: 'Convert to study flashcards' },
      { value: 'questions', label: 'Questions', icon: <HelpCircle size={24} />, description: 'Generate practice questions' }
    ],
    flashcards: [
      { value: 'notes', label: 'Notes', icon: <FileText size={24} />, description: 'Create study guide' },
      { value: 'questions', label: 'Questions', icon: <HelpCircle size={24} />, description: 'Convert to quiz questions' },
      { value: 'csv', label: 'CSV Export', icon: <Download size={24} />, description: 'Download as CSV file' }
    ],
    questions: [
      { value: 'flashcards', label: 'Flashcards', icon: <Zap size={24} />, description: 'Convert to flashcards' },
      { value: 'notes', label: 'Study Guide', icon: <FileText size={24} />, description: 'Create study notes' },
      { value: 'pdf', label: 'PDF Export', icon: <Download size={24} />, description: 'Download as PDF' }
    ],
    media: [
      { value: 'questions', label: 'Questions', icon: <HelpCircle size={24} />, description: 'Generate from transcript' }
    ],
    playlist: [
      { value: 'notes', label: 'Notes', icon: <FileText size={24} />, description: 'Compile playlist content' },
      { value: 'flashcards', label: 'Flashcards', icon: <Zap size={24} />, description: 'Generate flashcards' }
    ]
  };

  useEffect(() => {
    if (isOpen && step === 1) {
      loadAvailableItems();
    }
  }, [isOpen, sourceType, step]);

  const loadAvailableItems = async () => {
    setLoading(true);
    try {
      let endpoint = '';
      
      switch (sourceType) {
        case 'notes':
          endpoint = `${API_URL}/get_notes?user_id=${userName}`;
          break;
        case 'flashcards':
          endpoint = `${API_URL}/get_flashcard_history?user_id=${userName}&limit=100`;
          break;
        case 'questions':
          endpoint = `${API_URL}/get_generated_questions?user_id=${userName}`;
          break;
        case 'media':
          endpoint = `${API_URL}/media/history?user_id=${userName}`;
          break;
        case 'playlist':
          endpoint = `${API_URL}/playlists?my_playlists=true`;
          break;
        default:
          return;
      }

      const response = await fetch(endpoint, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        
        // Format data based on source type
        let items = [];
        if (sourceType === 'notes') {
          items = data.filter(n => !n.is_deleted);
        } else if (sourceType === 'flashcards') {
          items = data.flashcard_history || [];
        } else if (sourceType === 'questions') {
          items = data.question_sets || [];
        } else if (sourceType === 'media') {
          items = data.history || [];
        } else if (sourceType === 'playlist') {
          items = data.playlists || [];
        }
        
        setAvailableItems(items);
      }
    } catch (error) {
      console.error('Error loading items:', error);
    }
    setLoading(false);
  };


  const handleItemToggle = (itemId) => {
    setSelectedItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const handleSelectAll = () => {
    if (selectedItems.length === availableItems.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(availableItems.map(item => item.id));
    }
  };

  const handleConvert = async () => {
    if (selectedItems.length === 0) return;
    
    setProcessing(true);
    try {
      let endpoint = '';
      let payload = {};

      // Determine endpoint and payload based on conversion
      if (sourceType === 'notes' && destinationType === 'flashcards') {
        endpoint = `${API_URL}/import_export/notes_to_flashcards`;
        payload = {
          note_ids: selectedItems,
          card_count: options.cardCount,
          difficulty: options.difficulty
        };
      } else if (sourceType === 'notes' && destinationType === 'questions') {
        endpoint = `${API_URL}/import_export/notes_to_questions`;
        payload = {
          note_ids: selectedItems,
          question_count: options.questionCount,
          difficulty: options.difficulty
        };
      } else if (sourceType === 'flashcards' && destinationType === 'notes') {
        endpoint = `${API_URL}/import_export/flashcards_to_notes`;
        payload = {
          set_ids: selectedItems,
          format_style: options.formatStyle
        };
      } else if (sourceType === 'flashcards' && destinationType === 'questions') {
        endpoint = `${API_URL}/import_export/flashcards_to_questions`;
        payload = { set_ids: selectedItems };
      } else if (sourceType === 'flashcards' && destinationType === 'csv') {
        endpoint = `${API_URL}/import_export/export_flashcards_csv`;
        payload = { set_ids: selectedItems };
      } else if (sourceType === 'questions' && destinationType === 'flashcards') {
        endpoint = `${API_URL}/import_export/questions_to_flashcards`;
        payload = { set_ids: selectedItems };
      } else if (sourceType === 'questions' && destinationType === 'notes') {
        endpoint = `${API_URL}/import_export/questions_to_notes`;
        payload = { set_ids: selectedItems };
      } else if (sourceType === 'questions' && destinationType === 'pdf') {
        endpoint = `${API_URL}/import_export/export_questions_pdf`;
        payload = { set_ids: selectedItems };
      } else if (sourceType === 'media' && destinationType === 'questions') {
        endpoint = `${API_URL}/import_export/media_to_questions`;
        payload = {
          media_ids: selectedItems,
          question_count: options.questionCount
        };
      } else if (sourceType === 'playlist' && destinationType === 'notes') {
        endpoint = `${API_URL}/import_export/playlist_to_notes`;
        payload = { playlist_id: selectedItems[0] };
      } else if (sourceType === 'playlist' && destinationType === 'flashcards') {
        endpoint = `${API_URL}/import_export/playlist_to_flashcards`;
        payload = {
          playlist_id: selectedItems[0],
          card_count: options.cardCount
        };
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const data = await response.json();
        
        if (data.success) {
          // Handle file downloads for exports
          if (destinationType === 'csv' || destinationType === 'pdf') {
            downloadFile(data.content, data.filename);
            setResult({
              success: true,
              message: `Successfully exported to ${destinationType.toUpperCase()}`,
              type: 'export'
            });
          } else {
            setResult({
              success: true,
              message: `Successfully converted to ${destinationType}!`,
              details: data,
              type: 'import'
            });
          }
          setStep(3);
          
          if (onSuccess) {
            onSuccess(data);
          }
        } else {
          throw new Error(data.error || 'Conversion failed');
        }
      } else {
        throw new Error('Failed to convert');
      }
    } catch (error) {
      console.error('Conversion error:', error);
      setResult({
        success: false,
        message: error.message || 'Conversion failed',
        type: 'error'
      });
      setStep(3);
    }
    setProcessing(false);
  };

  const downloadFile = (content, filename) => {
    const blob = new Blob([content], { 
      type: filename.endsWith('.csv') ? 'text/csv' : 'text/html' 
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const resetModal = () => {
    setStep(1);
    setSelectedItems([]);
    setDestinationType('');
    setResult(null);
    setOptions({
      cardCount: 10,
      questionCount: 10,
      difficulty: 'medium',
      formatStyle: 'structured'
    });
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  if (!isOpen) return null;

  const getItemTitle = (item) => {
    return item.title || item.name || item.original_filename || 'Untitled';
  };

  const getItemCount = (item) => {
    if (sourceType === 'flashcards') return `${item.card_count || 0} cards`;
    if (sourceType === 'questions') return `${item.total_questions || 0} questions`;
    if (sourceType === 'playlist') return `${item.item_count || 0} items`;
    return '';
  };

  return (
    <div className="import-export-overlay" onClick={handleClose}>
      <div className="import-export-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="header-content">
            <Zap size={24} className="header-icon" />
            <div>
              <h2>
                {mode === 'import' ? 'Convert' : 'Export'} {sourceType}
              </h2>
              <p className="header-subtitle">
                Step {step} of 3
              </p>
            </div>
          </div>
          <button className="close-btn" onClick={handleClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {/* Step 1: Select Items */}
          {step === 1 && (
            <div className="step-content">
              <h3>Select {sourceType} to convert</h3>
              
              <div className="select-all-bar">
                <button 
                  className="select-all-btn"
                  onClick={handleSelectAll}
                >
                  {selectedItems.length === availableItems.length ? 'Deselect All' : 'Select All'}
                </button>
                <span className="selection-count">
                  {selectedItems.length} of {availableItems.length} selected
                </span>
              </div>

              <div className="items-list">
                {loading ? (
                  <div className="loading-state">
                    <Loader className="spinner" size={32} />
                    <p>Loading {sourceType}...</p>
                  </div>
                ) : availableItems.length === 0 ? (
                  <div className="empty-state">
                    <FileText size={48} />
                    <p>No {sourceType} found</p>
                  </div>
                ) : (
                  availableItems.map(item => (
                    <div 
                      key={item.id}
                      className={`item-card ${selectedItems.includes(item.id) ? 'selected' : ''}`}
                      onClick={() => handleItemToggle(item.id)}
                    >
                      <div className="item-checkbox">
                        {selectedItems.includes(item.id) && <CheckCircle size={20} />}
                      </div>
                      <div className="item-info">
                        <h4>{getItemTitle(item)}</h4>
                        <p className="item-meta">{getItemCount(item)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="modal-actions">
                <button className="btn-secondary" onClick={handleClose}>
                  Cancel
                </button>
                <button 
                  className="btn-primary"
                  onClick={() => setStep(2)}
                  disabled={selectedItems.length === 0}
                >
                  Next <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Choose Destination & Options */}
          {step === 2 && (
            <div className="step-content">
              <h3>Convert to...</h3>
              
              <div className="conversion-options">
                {conversionOptions[sourceType]?.map(option => (
                  <div
                    key={option.value}
                    className={`conversion-card ${destinationType === option.value ? 'selected' : ''}`}
                    onClick={() => setDestinationType(option.value)}
                  >
                    <div className="conversion-icon-svg">{option.icon}</div>
                    <h4>{option.label}</h4>
                    <p>{option.description}</p>
                  </div>
                ))}
              </div>

              {/* Options based on destination */}
              {destinationType && (
                <div className="conversion-settings">
                  <h4>Settings</h4>
                  
                  {(destinationType === 'flashcards' || destinationType === 'questions') && (
                    <>
                      <div className="setting-group">
                        <label>
                          {destinationType === 'flashcards' ? 'Number of Cards' : 'Number of Questions'}
                        </label>
                        <input
                          type="number"
                          min="5"
                          max="50"
                          value={destinationType === 'flashcards' ? options.cardCount : options.questionCount}
                          onChange={(e) => setOptions(prev => ({
                            ...prev,
                            [destinationType === 'flashcards' ? 'cardCount' : 'questionCount']: parseInt(e.target.value)
                          }))}
                        />
                      </div>
                      
                      <div className="setting-group">
                        <label>Difficulty</label>
                        <select
                          value={options.difficulty}
                          onChange={(e) => setOptions(prev => ({ ...prev, difficulty: e.target.value }))}
                        >
                          <option value="easy">Easy</option>
                          <option value="medium">Medium</option>
                          <option value="hard">Hard</option>
                        </select>
                      </div>
                    </>
                  )}

                  {destinationType === 'notes' && sourceType === 'flashcards' && (
                    <div className="setting-group">
                      <label>Format Style</label>
                      <select
                        value={options.formatStyle}
                        onChange={(e) => setOptions(prev => ({ ...prev, formatStyle: e.target.value }))}
                      >
                        <option value="structured">Structured (Headings)</option>
                        <option value="qa">Q&A Format</option>
                        <option value="summary">Summary List</option>
                      </select>
                    </div>
                  )}
                </div>
              )}

              <div className="modal-actions">
                <button className="btn-secondary" onClick={() => setStep(1)}>
                  Back
                </button>
                <button 
                  className="btn-primary"
                  onClick={handleConvert}
                  disabled={!destinationType || processing}
                >
                  {processing ? (
                    <>
                      <Loader className="spinner" size={16} />
                      Converting...
                    </>
                  ) : (
                    <>
                      Convert <Zap size={16} />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Result */}
          {step === 3 && result && (
            <div className="step-content result-step">
              <div className={`result-icon ${result.success ? 'success' : 'error'}`}>
                {result.success ? <CheckCircle size={64} /> : <X size={64} />}
              </div>
              
              <h3>{result.message}</h3>
              
              {result.success && result.details && (
                <div className="result-details">
                  {result.details.set_title && (
                    <p><strong>Created:</strong> {result.details.set_title}</p>
                  )}
                  {result.details.note_title && (
                    <p><strong>Created:</strong> {result.details.note_title}</p>
                  )}
                  {result.details.card_count && (
                    <p><strong>Cards:</strong> {result.details.card_count}</p>
                  )}
                  {result.details.question_count && (
                    <p><strong>Questions:</strong> {result.details.question_count}</p>
                  )}
                </div>
              )}

              <div className="modal-actions">
                <button className="btn-secondary" onClick={handleClose}>
                  Close
                </button>
                {result.success && result.type === 'import' && (
                  <button className="btn-primary" onClick={resetModal}>
                    Convert More
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportExportModal;

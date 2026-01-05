import { useState, useEffect } from 'react';
import { 
  X, Download, FileText, HelpCircle, 
  Zap, CheckCircle, Loader, ArrowRight 
} from 'lucide-react';
import { API_URL } from '../config';
import conversionAgentService from '../services/conversionAgentService';
import './ImportExportModal.css';

const ImportExportModal = ({ 
  isOpen, 
  onClose, 
  mode = 'import',
  sourceType,
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
    formatStyle: 'structured',
    depthLevel: 'standard'
  });

  const userName = localStorage.getItem('username');
  const token = localStorage.getItem('token');

  const conversionOptions = {
    notes: [
      { value: 'flashcards', label: 'Flashcards', icon: <Zap size={24} />, description: 'Convert to study flashcards' },
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
      let result;
      
      // Use the conversion agent service for all conversions
      const conversionResult = await conversionAgentService.convert({
        userId: userName,
        sourceType: sourceType,
        sourceIds: selectedItems,
        destinationType: destinationType,
        cardCount: options.cardCount,
        questionCount: options.questionCount,
        difficulty: options.difficulty,
        formatStyle: options.formatStyle,
        depthLevel: options.depthLevel
      });

      if (conversionResult.success) {
        // Handle export types (CSV/PDF)
        if (destinationType === 'csv' || destinationType === 'pdf') {
          const exportResult = conversionResult.result;
          if (exportResult && exportResult.content) {
            conversionAgentService.downloadFile(exportResult.content, exportResult.filename);
          }
          setResult({
            success: true,
            message: `Successfully exported to ${destinationType.toUpperCase()}`,
            type: 'export'
          });
        } else {
          // Handle conversion types
          setResult({
            success: true,
            message: `Successfully converted to ${destinationType}!`,
            details: conversionResult.result,
            type: 'import'
          });
        }
        setStep(3);
        
        if (onSuccess) {
          onSuccess(conversionResult.result);
        }
      } else {
        throw new Error(conversionResult.response || 'Conversion failed');
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

  const resetModal = () => {
    setStep(1);
    setSelectedItems([]);
    setDestinationType('');
    setResult(null);
    setOptions({
      cardCount: 10,
      questionCount: 10,
      difficulty: 'medium',
      formatStyle: 'structured',
      depthLevel: 'standard'
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
    <div className="iem-overlay" onClick={handleClose}>
      <div className="iem-modal" onClick={(e) => e.stopPropagation()}>
        <div className="iem-header">
          <div className="iem-header-content">
            <Zap size={24} className="iem-header-icon" />
            <div>
              <h2>
                {mode === 'import' ? 'Convert' : 'Export'} {sourceType}
              </h2>
              <p className="iem-header-subtitle">
                Step {step} of 3 • Powered by AI Agent
              </p>
            </div>
          </div>
          <button className="iem-close-btn" onClick={handleClose}>
            <X size={20} />
          </button>
        </div>

        <div className="iem-body">
          {step === 1 && (
            <div className="iem-step-content">
              <h3>Select {sourceType} to convert</h3>
              
              <div className="iem-select-bar">
                <button 
                  className="iem-select-all-btn"
                  onClick={handleSelectAll}
                >
                  {selectedItems.length === availableItems.length ? 'Deselect All' : 'Select All'}
                </button>
                <span className="iem-selection-count">
                  {selectedItems.length} of {availableItems.length} selected
                </span>
              </div>

              <div className="iem-items-list">
                {loading ? (
                  <div className="iem-loading">
                    <Loader className="iem-spinner" size={32} />
                    <p>Loading {sourceType}...</p>
                  </div>
                ) : availableItems.length === 0 ? (
                  <div className="iem-empty">
                    <FileText size={48} />
                    <p>No {sourceType} found</p>
                  </div>
                ) : (
                  availableItems.map(item => (
                    <div 
                      key={item.id}
                      className={`iem-item-card ${selectedItems.includes(item.id) ? 'selected' : ''}`}
                      onClick={() => handleItemToggle(item.id)}
                    >
                      <div className="iem-item-checkbox">
                        {selectedItems.includes(item.id) && <CheckCircle size={20} />}
                      </div>
                      <div className="iem-item-info">
                        <h4>{getItemTitle(item)}</h4>
                        <p className="iem-item-meta">{getItemCount(item)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="iem-actions">
                <button className="iem-btn iem-btn-secondary" onClick={handleClose}>
                  Cancel
                </button>
                <button 
                  className="iem-btn iem-btn-primary"
                  onClick={() => setStep(2)}
                  disabled={selectedItems.length === 0}
                >
                  Next <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="iem-step-content">
              <h3>Convert to...</h3>
              
              <div className="iem-conversion-grid">
                {conversionOptions[sourceType]?.map(option => (
                  <div
                    key={option.value}
                    className={`iem-conversion-card ${destinationType === option.value ? 'selected' : ''}`}
                    onClick={() => setDestinationType(option.value)}
                  >
                    <div className="iem-conversion-icon">{option.icon}</div>
                    <h4>{option.label}</h4>
                    <p>{option.description}</p>
                  </div>
                ))}
              </div>

              {destinationType && (
                <div className="iem-settings">
                  <h4>Settings</h4>
                  
                  {destinationType === 'flashcards' && (
                    <>
                      <div className="iem-setting-group">
                        <label>Number of Cards</label>
                        <input
                          type="number"
                          className="iem-input"
                          min="5"
                          max="50"
                          value={options.cardCount || ''}
                          onChange={(e) => setOptions(prev => ({
                            ...prev,
                            cardCount: parseInt(e.target.value) || 10
                          }))}
                        />
                      </div>
                      
                      <div className="iem-setting-group">
                        <label>Difficulty</label>
                        <select
                          className="iem-select"
                          value={options.difficulty}
                          onChange={(e) => setOptions(prev => ({ ...prev, difficulty: e.target.value }))}
                        >
                          <option value="easy">Easy</option>
                          <option value="medium">Medium</option>
                          <option value="hard">Hard</option>
                        </select>
                      </div>

                      <div className="iem-setting-group">
                        <label>Depth Level</label>
                        <select
                          className="iem-select"
                          value={options.depthLevel}
                          onChange={(e) => setOptions(prev => ({ ...prev, depthLevel: e.target.value }))}
                        >
                          <option value="surface">Surface (Basic recall)</option>
                          <option value="standard">Standard (Balanced)</option>
                          <option value="deep">Deep (Advanced)</option>
                        </select>
                      </div>
                    </>
                  )}

                  {destinationType === 'questions' && (
                    <>
                      <div className="iem-setting-group">
                        <label>Number of Questions</label>
                        <input
                          type="number"
                          className="iem-input"
                          min="5"
                          max="50"
                          value={options.questionCount || ''}
                          onChange={(e) => setOptions(prev => ({
                            ...prev,
                            questionCount: parseInt(e.target.value) || 10
                          }))}
                        />
                      </div>
                      
                      <div className="iem-setting-group">
                        <label>Difficulty</label>
                        <select
                          className="iem-select"
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

                  {destinationType === 'notes' && (
                    <div className="iem-setting-group">
                      <label>Format Style</label>
                      <select
                        className="iem-select"
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

              <div className="iem-actions">
                <button className="iem-btn iem-btn-secondary" onClick={() => setStep(1)}>
                  Back
                </button>
                <button 
                  className="iem-btn iem-btn-primary"
                  onClick={handleConvert}
                  disabled={!destinationType || processing}
                >
                  {processing ? (
                    <>
                      <Loader className="iem-spinner" size={16} />
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

          {step === 3 && result && (
            <div className="iem-step-content iem-result">
              <div className={`iem-result-icon ${result.success ? 'success' : 'error'}`}>
                {result.success ? <CheckCircle size={64} /> : <X size={64} />}
              </div>
              
              <h3>{result.message}</h3>
              
              {result.success && result.details && (
                <div className="iem-result-details">
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

              <div className="iem-actions">
                <button className="iem-btn iem-btn-secondary" onClick={handleClose}>
                  Close
                </button>
                {result.success && result.type === 'import' && (
                  <button className="iem-btn iem-btn-primary" onClick={resetModal}>
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

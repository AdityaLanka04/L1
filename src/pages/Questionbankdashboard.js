import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Upload, MessageSquare, Sparkles, FileText, Trash2, Zap, CheckCircle, XCircle,
  Loader, FileUp, BookOpen, Download, FileDown, Eye, Edit3, RefreshCw, Layers,
  AlertTriangle, Star, X, Save, Settings, ArrowUpRight, Check
} from 'lucide-react';
import './Questionbankdashboard.css';
import './QuestionbankConvert.css';
import './QuestionbankLibrary.css';
import { API_URL } from '../config';
import ImportExportModal from '../components/ImportExportModal';
import SocialHubChrome from '../components/SocialHubChrome';
import questionBankAgentService from '../services/questionBankAgentService';
import { queuedAIJsonFetch } from '../services/aiJobService';
import MathRenderer from '../components/MathRenderer';

const CONTEXT_SELECTION_KEY = 'ctx_selected_doc_ids';

const QUESTION_VIEWS = [
  { key: 'question-sets', label: 'Library', icon: FileText },
  { key: 'custom', label: 'Generator', icon: Sparkles },
];

const GENERATOR_SOURCES = [
  { key: 'text', label: 'Paste text' },
  { key: 'pdf', label: 'PDF' },
  { key: 'study', label: 'Notes, cards & chat' },
];

const getQuestionText = (question) => (
  question?.question_text || question?.question || ''
);

const normalizeQuestionText = (value) => (
  String(value || '').trim().replace(/\s+/g, ' ').toLowerCase()
);

const normalizeQuestionForStudy = (question = {}) => {
  const options = Array.isArray(question.options)
    ? question.options.filter(option => String(option || '').trim())
    : [];
  let questionType = question.question_type;

  if (!questionType && options.length > 0) {
    const normalizedOptions = options.map(option => normalizeQuestionText(option));
    questionType = normalizedOptions.length === 2
      && normalizedOptions.includes('true')
      && normalizedOptions.includes('false')
      ? 'true_false'
      : 'multiple_choice';
  }

  let correctAnswer = String(question.correct_answer || '').trim();
  const letterMatch = correctAnswer.match(/^(?:option\s*)?([a-d])(?:[).:-])?$/i);
  if (questionType === 'multiple_choice' && letterMatch) {
    const optionIndex = letterMatch[1].toUpperCase().charCodeAt(0) - 65;
    correctAnswer = options[optionIndex] || correctAnswer;
  }

  return {
    ...question,
    question_type: questionType || 'short_answer',
    options,
    correct_answer: correctAnswer
  };
};

const getQuestionSignature = (question) => {
  const options = Array.isArray(question?.options)
    ? question.options.map(normalizeQuestionText).join('|')
    : '';

  return [
    normalizeQuestionText(getQuestionText(question)),
    normalizeQuestionText(question?.correct_answer),
    options
  ].join('::');
};

const dedupeQuestions = (questions = []) => {
  if (!Array.isArray(questions)) return [];

  const seen = new Set();
  return questions.filter((question) => {
    const signature = getQuestionSignature(question);
    if (!signature.replace(/:/g, '')) return true;
    if (seen.has(signature)) return false;
    seen.add(signature);
    return true;
  });
};

const withDedupedQuestions = (questionSet) => {
  const questions = dedupeQuestions(
    Array.isArray(questionSet?.questions)
      ? questionSet.questions.map(normalizeQuestionForStudy)
      : []
  );
  return {
    ...questionSet,
    questions,
    total_questions: questions.length
  };
};

const formatDocumentType = (documentType) => {
  const value = String(documentType || '').trim();
  if (!value || value.toLowerCase() === 'unknown') return 'PDF source';

  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const formatSourceDate = (value) => {
  if (!value) return 'No upload date';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No upload date';

  return date.toLocaleDateString();
};

const QuestionBankDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const token = localStorage.getItem('token');
  const userId = localStorage.getItem('user_id') || localStorage.getItem('username');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [activeView, setActiveView] = useState('question-sets');
  const [generatorSource, setGeneratorSource] = useState('text');
  const [questionSets, setQuestionSets] = useState([]);
  const [uploadedDocuments, setUploadedDocuments] = useState([]);
  const [chatSessions, setChatSessions] = useState([]);
  const [studyNotes, setStudyNotes] = useState([]);
  const [flashcardSets, setFlashcardSets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [contextGenerationStatus, setContextGenerationStatus] = useState('');
  const contextGenerationRef = useRef('');
  const [exportingPdf, setExportingPdf] = useState(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportSetId, setExportSetId] = useState(null);
  const [includeAnswers, setIncludeAnswers] = useState(false);
  const [renamingSetId, setRenamingSetId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameSaving, setRenameSaving] = useState(false);
  const [renameError, setRenameError] = useState('');

  const [showStudyModal, setShowStudyModal] = useState(false);
  const [showImportExport, setShowImportExport] = useState(false);

  const [selectedDocument, setSelectedDocument] = useState(null);
  const [selectedPDFs, setSelectedPDFs] = useState([]);  
  const [selectedSources, setSelectedSources] = useState([]);
  const [customContent, setCustomContent] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [questionCount, setQuestionCount] = useState(10);
  const [difficultyMix, setDifficultyMix] = useState({ easy: 30, medium: 50, hard: 20 });
  const [adaptiveDifficulty, setAdaptiveDifficulty] = useState(false);
  const [questionTypes, setQuestionTypes] = useState(['multiple_choice', 'true_false', 'short_answer']);
  const autoStartRef = useRef(null);

  const getDifficultyCounts = () => {
    const total = difficultyMix.easy + difficultyMix.medium + difficultyMix.hard;
    if (total === 0) return { easy: 0, medium: 0, hard: 0 };

    const normalizedEasy = difficultyMix.easy / total;
    const normalizedMedium = difficultyMix.medium / total;
    const normalizedHard = difficultyMix.hard / total;

    const count = typeof questionCount === 'number' ? questionCount : 10;
    let easyCount = Math.round(normalizedEasy * count);
    let mediumCount = Math.round(normalizedMedium * count);
    let hardCount = Math.round(normalizedHard * count);

    const diff = count - (easyCount + mediumCount + hardCount);
    if (diff !== 0) {
      
      if (mediumCount >= easyCount && mediumCount >= hardCount) {
        mediumCount += diff;
      } else if (easyCount >= hardCount) {
        easyCount += diff;
      } else {
        hardCount += diff;
      }
    }
    
    return { easy: easyCount, medium: mediumCount, hard: hardCount };
  };
  
  const difficultyCount = getDifficultyCounts();

  const handleDifficultyChange = (level, newValue) => {
    const value = parseInt(newValue);
    const others = ['easy', 'medium', 'hard'].filter(l => l !== level);
    const currentOthersTotal = others.reduce((sum, l) => sum + difficultyMix[l], 0);
    const remaining = 100 - value;
    
    if (currentOthersTotal === 0) {
      
      setDifficultyMix({
        ...difficultyMix,
        [level]: value,
        [others[0]]: Math.floor(remaining / 2),
        [others[1]]: Math.ceil(remaining / 2)
      });
    } else {
      
      const scale = remaining / currentOthersTotal;
      const newMix = { [level]: value };
      let allocated = value;
      
      others.forEach((l, idx) => {
        if (idx === others.length - 1) {
          
          newMix[l] = 100 - allocated;
        } else {
          newMix[l] = Math.round(difficultyMix[l] * scale);
          allocated += newMix[l];
        }
      });
      
      setDifficultyMix(newMix);
    }
  };

  const handleQuestionCountChange = (e) => {
    const value = e.target.value;
    
    if (value === '') {
      setQuestionCount('');
      return;
    }
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= 0) {
      setQuestionCount(Math.min(Math.max(num, 1), 100));
    }
  };

  const handleQuestionCountBlur = () => {
    
    if (questionCount === '' || questionCount < 1) {
      setQuestionCount(10);
    }
  };

  const [selectedQuestionSet, setSelectedQuestionSet] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState(null);
  const [sessionStartTime, setSessionStartTime] = useState(null);

  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewQuestions, setPreviewQuestions] = useState([]);
  const [previewStats, setPreviewStats] = useState(null);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [regenerateFeedback, setRegenerateFeedback] = useState('');

  const [customPrompt, setCustomPrompt] = useState('');
  const [referenceDocId, setReferenceDocId] = useState(null);
  const defaultQuestionTypes = ['multiple_choice'];

  useEffect(() => {
    document.querySelector('.qbd-rb-main')?.scrollTo({ top: 0, behavior: 'auto' });
  }, [activeView]);

  const getSelectedQuestionTypes = () => (
    questionTypes.length > 0 ? questionTypes : defaultQuestionTypes
  );

  const ensureQuestionTypesSelected = () => {
    if (questionTypes.length > 0) return true;
    alert('Please select at least one question type in Generation Settings.');
    return false;
  };

  useEffect(() => {
    const contextDocIds = location.state?.contextDocIds;
    const openView = location.state?.openView;
    const topicFromContext = location.state?.topic;

    if (Array.isArray(contextDocIds) && contextDocIds.length > 0) {
      try {
        localStorage.setItem(CONTEXT_SELECTION_KEY, JSON.stringify(contextDocIds));
      } catch {
        
      }
    }
    if (openView === 'upload-pdf' || openView === 'chat-slides') {
      setActiveView('custom');
      setGeneratorSource(openView === 'upload-pdf' ? 'pdf' : 'study');
    } else if (openView && QUESTION_VIEWS.some((v) => v.key === openView)) {
      setActiveView(openView);
    }
    if (typeof topicFromContext === 'string' && topicFromContext.trim()) {
      setCustomPrompt(topicFromContext.trim());
      setCustomTitle(`Quiz: ${topicFromContext.trim().slice(0, 60)}`);
    }
  }, [location.state]);

  useEffect(() => {
    const contextDocIds = location.state?.contextDocIds;
    const autoGenerateFromContext = Boolean(location.state?.autoGenerateFromContext);
    if (!autoGenerateFromContext || !userId || !token) return;
    if (!Array.isArray(contextDocIds) || contextDocIds.length === 0) return;
    const generationKey = contextDocIds.map(String).join(',');
    if (contextGenerationRef.current === generationKey) return;
    contextGenerationRef.current = generationKey;

    const run = async () => {
      try {
        setContextGenerationStatus('Generating a grounded quiz from your selected sources…');
        setLoading(true);
        const response = await queuedAIJsonFetch('/generate_practice_questions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            user_id: userId,
            topic: location.state?.topic || 'Selected context files',
            title: `Quiz: ${(location.state?.topic || 'Selected context').slice(0, 60)}`,
            question_count: 12,
            question_types: ['multiple_choice', 'true_false', 'short_answer'],
            use_hs_context: true,
            context_doc_ids: contextDocIds
          })
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data?.questions?.length) {
          throw new Error(data.detail || 'Failed to generate quiz from selected context');
        }

        await fetchQuestionSets();
        setSelectedQuestionSet(withDedupedQuestions({
          id: data.question_set_id || data.id,
          title: data.title || 'Context Quiz',
          questions: data.questions
        }));
        setShowStudyModal(true);
        setCurrentQuestion(0);
        setUserAnswers({});
        setShowResults(false);
        setSessionStartTime(Date.now());
        setContextGenerationStatus('');
      } catch (error) {
        setContextGenerationStatus(error.message || 'Failed to generate quiz from selected context.');
      } finally {
        setLoading(false);
        navigate('/question-bank', { replace: true, state: {} });
      }
    };

    run();
  }, [location.state, userId, token, navigate]);

  useEffect(() => {
    fetchQuestionSets();
    fetchUploadedDocuments();
    fetchChatSessions();
    fetchStudyNotes();
    fetchFlashcardSets();
  }, [activeView]);

  useEffect(() => {
    const generatedQuestions = location.state?.generatedQuestions;
    
    if (generatedQuestions && userId) {
      const createGeneratedQuestionSet = async () => {
        try {
          setLoading(true);
          const uniqueQuestions = dedupeQuestions(generatedQuestions.questions);
          
          const response = await fetch(`${API_URL}/qb/save_question_set`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              user_id: userId,
              title: generatedQuestions.title,
              questions: uniqueQuestions,
              source: 'learning_path'
            })
          });
          
          if (response.ok) {
            const data = await response.json();

            await fetchQuestionSets();

            const newSet = {
              id: data.set_id,
              title: generatedQuestions.title,
              questions: uniqueQuestions,
              total_questions: uniqueQuestions.length
            };
            
            setSelectedQuestionSet(newSet);
            setShowStudyModal(true);
            setCurrentQuestion(0);
            setUserAnswers({});
            setShowResults(false);
            setSessionStartTime(Date.now());

            navigate('/question-bank', { replace: true, state: {} });
          }
        } catch (error) {
          console.error('Error creating generated question set:', error);
          alert('Failed to create question set from learning path');
        } finally {
          setLoading(false);
        }
      };
      
      createGeneratedQuestionSet();
    }
  }, [location.state, userId, token, navigate]);

  const fetchQuestionSets = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/qb/get_question_sets?user_id=${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setQuestionSets(data.question_sets || []);
      } else {
        console.error('📡 Failed to fetch question sets:', response.statusText);
      }
    } catch (error) {
      console.error('📡 Error fetching question sets:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUploadedDocuments = async () => {
    try {
      const response = await fetch(`${API_URL}/qb/get_uploaded_documents?user_id=${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setUploadedDocuments(data.documents || []);
      }
    } catch (error) { /* silenced */ }
  };

  const fetchChatSessions = async () => {
    try {
      const response = await fetch(`${API_URL}/get_chat_sessions?user_id=${encodeURIComponent(userId)}&limit=100`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setChatSessions(data.sessions || []);
      }
    } catch (error) { /* silenced */ }
  };

  const fetchStudyNotes = async () => {
    try {
      const response = await fetch(`${API_URL}/get_notes?user_id=${encodeURIComponent(userId)}&summary=true&limit=100`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setStudyNotes(Array.isArray(data) ? data : []);
      }
    } catch (error) { /* silenced */ }
  };

  const fetchFlashcardSets = async () => {
    try {
      const response = await fetch(`${API_URL}/get_flashcard_history?user_id=${encodeURIComponent(userId)}&limit=100&offset=0`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setFlashcardSets(Array.isArray(data.flashcard_history) ? data.flashcard_history : []);
      }
    } catch (error) { /* silenced */ }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/qb/upload_pdf?user_id=${userId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        alert(`PDF uploaded successfully! Document type: ${formatDocumentType(data.analysis?.document_type)}`);
        await fetchUploadedDocuments();
      } else {
        alert('Failed to upload PDF');
      }
    } catch (error) {
            alert('Error uploading PDF');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateFromMultiplePDFs = async () => {
    if (selectedPDFs.length === 0) {
      alert('Please select at least one PDF document');
      return;
    }
    if (!ensureQuestionTypesSelected()) return;

    try {
      setLoading(true);
      const selectedQuestionTypes = getSelectedQuestionTypes();

      const useSmartGeneration = customPrompt.trim() || referenceDocId;

      const isSingleQuestionDoc = !useSmartGeneration
        && selectedPDFs.length === 1
        && ((selectedPDFs[0].document_type || '').toLowerCase() === 'questions');

      if (isSingleQuestionDoc) {
        const response = await questionBankAgentService.generateFromPDF({
          userId,
          sourceId: selectedPDFs[0].id,
          questionCount: questionCount || 10,
          difficultyMix: difficultyCount,
          questionTypes: selectedQuestionTypes,
          topics: null,
          adaptiveDifficulty
        });

        if (response.status === 'success') {
          alert(`Generated ${response.question_count} similar questions from ${selectedPDFs[0].filename}!`);
          resetSelections();
          await fetchQuestionSets();
          setActiveView('question-sets');
          return;
        }
      }
      
      if (useSmartGeneration) {
        
        const response = await questionBankAgentService.smartGenerate({
          userId,
          sourceIds: selectedPDFs.map(p => p.id),
          questionCount: questionCount || 10,
          difficultyMix: difficultyCount,
          title: selectedPDFs.length === 1 
            ? `Questions from ${selectedPDFs[0].filename}`
            : `Smart Questions from ${selectedPDFs.length} documents`,
          questionTypes: selectedQuestionTypes,
          customPrompt: customPrompt.trim() || null,
          referenceDocumentId: referenceDocId,
          contentDocumentIds: selectedPDFs.filter(p => p.id !== referenceDocId).map(p => p.id),
          adaptiveDifficulty
        });

        if (response.status === 'success') {
          alert(`Successfully generated ${response.question_count} questions using smart generation!`);
          resetSelections();
          await fetchQuestionSets();
          setActiveView('question-sets');
        } else {
          alert('Failed to generate questions: ' + (response.error || 'Unknown error'));
        }
      } else {
        
        const response = await questionBankAgentService.generateFromMultiplePDFs({
          userId,
          sourceIds: selectedPDFs.map(p => p.id),
          questionCount: questionCount || 10,
          difficultyMix: difficultyCount,
          title: selectedPDFs.length === 1 
            ? `Questions from ${selectedPDFs[0].filename}`
            : `Questions from ${selectedPDFs.length} documents`,
          questionTypes: selectedQuestionTypes,
          adaptiveDifficulty
        });

        if (response.status === 'success') {
          alert(`Successfully generated ${response.question_count} questions from ${selectedPDFs.length} document(s)!`);
          resetSelections();
          await fetchQuestionSets();
          setActiveView('question-sets');
        } else {
          alert('Failed to generate questions: ' + (response.error || 'Unknown error'));
        }
      }
    } catch (error) {
      console.error('❌ Error:', error);
      alert('Error generating questions: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const resetSelections = () => {
    setSelectedPDFs([]);
    setSelectedDocument(null);
    setCustomPrompt('');
    setReferenceDocId(null);
  };

  const togglePDFSelection = (doc) => {
    const isSelected = selectedPDFs.some(p => p.id === doc.id);
    if (isSelected) {
      setSelectedPDFs(selectedPDFs.filter(p => p.id !== doc.id));
    } else {
      setSelectedPDFs([...selectedPDFs, doc]);
    }
    
    setSelectedDocument(null);
  };

  const handleDeleteDocument = async (docId, e) => {
    e.stopPropagation(); 
    
    if (!window.confirm('Are you sure you want to delete this PDF? This cannot be undone.')) {
      return;
    }

    try {
      setLoading(true);
      await questionBankAgentService.deleteDocument(userId, docId);

      setSelectedPDFs(selectedPDFs.filter(p => p.id !== docId));
      if (selectedDocument === docId) {
        setSelectedDocument(null);
      }
      
      await fetchUploadedDocuments();
      alert('Document deleted successfully');
    } catch (error) {
      console.error('❌ Error deleting document:', error);
      alert('Error deleting document: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const clearPDFSelection = () => {
    setSelectedPDFs([]);
    setSelectedDocument(null);
    setCustomPrompt('');
    setReferenceDocId(null);
  };

  const handleGenerateFromChatSlides = async () => {
    if (selectedSources.length === 0) {
      alert('Please select at least one source');
      return;
    }
    if (!ensureQuestionTypesSelected()) return;

    try {
      setLoading(true);
      const selectedQuestionTypes = getSelectedQuestionTypes();
      
      const response = await questionBankAgentService.generateFromSources({
        userId,
        sources: selectedSources,
        questionCount: questionCount || 10,
        difficultyMix: difficultyCount,
        questionTypes: selectedQuestionTypes,
        customPrompt: customPrompt.trim() || null,
        sessionId: `qb_sources_${userId}_${Date.now()}`,
        adaptiveDifficulty
      });

      if (response.success) {
        alert(`Successfully generated questions from ${selectedSources.length} sources!`);
        setSelectedSources([]);
        await fetchQuestionSets();
        setActiveView('question-sets');
      } else {
        alert('Failed to generate questions: ' + (response.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('❌ Error:', error);
      alert('Error generating questions: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateCustom = async () => {
    if (!customContent.trim()) {
      alert('Please enter some content');
      return;
    }
    if (!ensureQuestionTypesSelected()) return;

    try {
      setLoading(true);
      const selectedQuestionTypes = getSelectedQuestionTypes();
      
      const response = await questionBankAgentService.generateFromCustom({
        userId,
        content: customContent,
        title: customTitle || 'Custom Question Set',
        questionCount: questionCount || 10,
        difficultyMix: difficultyCount,
        questionTypes: selectedQuestionTypes,
        customPrompt: customPrompt.trim() || null,
        sessionId: `qb_custom_${userId}_${Date.now()}`,
        adaptiveDifficulty
      });

      if (response.success || response.status === 'success') {
        alert(`Successfully generated ${response.questions?.length || response.question_count || questionCount} questions!`);
        setCustomContent('');
        setCustomTitle('');
        await fetchQuestionSets();
        setActiveView('question-sets');
      } else {
        alert('Failed to generate questions: ' + (response.error || response.detail || response.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('❌ Error:', error);
      alert('Error generating questions: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const startStudySession = async (setId) => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/qb/get_question_set/${setId}?user_id=${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        const questionSet = withDedupedQuestions(data);
        if (questionSet.questions && questionSet.questions.length > 0) {
        } else {
        }
        setSelectedQuestionSet(questionSet);
        setCurrentQuestion(0);
        setUserAnswers({});
        setShowResults(false);
        setResults(null);
        setSessionStartTime(Date.now());
        setShowStudyModal(true);
      } else {
        const errorText = await response.text();
        console.error('📚 Failed to load question set:', response.statusText, errorText);
        alert('Failed to load questions');
      }
    } catch (error) {
      console.error('📚 Error:', error);
      alert('Error loading questions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const setIdParam = params.get('set_id');
    if (!setIdParam) return;
    const parsedId = parseInt(setIdParam, 10);
    if (Number.isNaN(parsedId)) return;
    if (autoStartRef.current === parsedId) return;
    autoStartRef.current = parsedId;
    startStudySession(parsedId);
  }, [location.search]);

  const handleAnswerChange = (questionId, answer) => {
    setUserAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const submitAnswers = async () => {
    if (loading || !selectedQuestionSet?.id) return;

    const timeTaken = Math.floor((Date.now() - sessionStartTime) / 1000);
    const answersPayload = Object.fromEntries(
      Object.entries(userAnswers).map(([questionId, answer]) => [String(questionId), answer])
    );

    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/qb/submit_answers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          user_id: userId,
          question_set_id: selectedQuestionSet.id,
          answers: answersPayload,
          time_taken_seconds: timeTaken
        })
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        setResults(data);
        setShowResults(true);
        await fetchQuestionSets();
      } else {
        alert(`Failed to submit answers: ${data.detail || data.message || response.statusText || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error submitting answers:', error);
      alert(`Error submitting answers: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const deleteQuestionSet = async (setId) => {
    if (!window.confirm('Are you sure you want to delete this question set?')) return;

    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/qb/delete_question_set/${setId}?user_id=${encodeURIComponent(userId)}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        await fetchQuestionSets();
      } else {
        const data = await response.json().catch(() => ({}));
        alert(`Failed to delete question set: ${data.detail || data.message || response.statusText || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error deleting question set:', error);
      alert(`Error deleting question set: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const beginRenameQuestionSet = (set) => {
    setRenamingSetId(set.id);
    setRenameValue(set.title || '');
    setRenameError('');
  };

  const cancelRenameQuestionSet = () => {
    if (renameSaving) return;
    setRenamingSetId(null);
    setRenameValue('');
    setRenameError('');
  };

  const saveQuestionSetName = async (setId) => {
    const title = renameValue.trim().replace(/\s+/g, ' ');
    if (!title) {
      setRenameError('Enter a name for this question set.');
      return;
    }

    setRenameSaving(true);
    setRenameError('');
    try {
      const response = await fetch(
        `${API_URL}/qb/question_sets/${setId}/title?user_id=${encodeURIComponent(userId)}`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ title }),
        }
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.detail || 'Unable to rename this question set.');

      setQuestionSets((sets) => sets.map((set) => (
        set.id === setId ? { ...set, title: payload.title, updated_at: payload.updated_at || set.updated_at } : set
      )));
      setRenamingSetId(null);
      setRenameValue('');
    } catch (error) {
      setRenameError(error.message || 'Unable to rename this question set.');
    } finally {
      setRenameSaving(false);
    }
  };

  const exportQuestionSetPdf = async (setId, withAnswers = false) => {
    try {
      setExportingPdf(setId);
      
      const response = await fetch(
        `${API_URL}/qb/export_question_set_pdf/${setId}?user_id=${userId}&include_answers=${withAnswers}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }

      const blob = await response.blob();

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'Question_Set.pdf';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename=(.+)/);
        if (filenameMatch) {
          filename = filenameMatch[1].replace(/"/g, '');
        }
      }
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      setShowExportModal(false);
      setExportSetId(null);
      setIncludeAnswers(false);
      
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Error generating PDF. Please try again.');
    } finally {
      setExportingPdf(null);
    }
  };

  const openExportModal = (setId) => {
    setExportSetId(setId);
    setIncludeAnswers(false);
    setShowExportModal(true);
  };

  const exportSet = questionSets.find((set) => String(set.id) === String(exportSetId));
  const exportQuestionCount = exportSet?.question_count || exportSet?.questions_count || exportSet?.questions?.length || null;

  const toggleSourceSelection = (type, id, title) => {
    if (id === undefined || id === null || id === '') {
      alert(`Cannot select ${type || 'source'} because it is missing an ID. Please refresh and try again.`);
      return;
    }

    const normalizedId = Number.isNaN(Number(id)) ? id : Number(id);
    const sourceKey = `${type}-${id}`;
    const exists = selectedSources.find(s => `${s.type}-${s.id}` === sourceKey);
    
    if (exists) {
      setSelectedSources(selectedSources.filter(s => `${s.type}-${s.id}` !== sourceKey));
    } else {
      setSelectedSources([...selectedSources, { type, id: normalizedId, title: title || `${type} ${id}` }]);
    }
  };

  const generateSimilarQuestion = async (questionId) => {
    try {
      setLoading(true);
      const response = await queuedAIJsonFetch('/qb/generate_similar_question', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          user_id: userId,
          question_id: questionId,
          difficulty: null
        })
      });

      if (response.ok) {
        await response.json();
        alert('Similar question generated successfully! Added to your question set.');
        await fetchQuestionSets();
      } else {
        alert('Failed to generate similar question');
      }
    } catch (error) {
            alert('Error generating similar question');
    } finally {
      setLoading(false);
    }
  };

  // ==================== AI FEATURE HANDLERS ====================

  // Enhance prompt with AI
  // Extract topics from selected documents
  // Preview generate questions
  // Regenerate a single question in preview
  const handleRegenerateQuestion = async (index) => {
    const question = previewQuestions[index];
    if (!regenerateFeedback.trim()) {
      setRegenerateFeedback('Make it better');
    }

    try {
      setEditingQuestion(index);
      
      const result = await questionBankAgentService.regenerateQuestion(
        userId,
        question,
        regenerateFeedback || 'Make it better',
        selectedPDFs.length > 0 ? selectedPDFs[0].id : null
      );

      if (result.regenerated) {
        const newQuestions = [...previewQuestions];
        newQuestions[index] = { ...result.regenerated, quality_score: 7 };
        setPreviewQuestions(newQuestions);
        setRegenerateFeedback('');
      }
    } catch (error) {
      console.error('Regeneration error:', error);
      alert('Failed to regenerate question');
    } finally {
      setEditingQuestion(null);
    }
  };

  // Save previewed questions
  const handleSavePreviewedQuestions = async () => {
    if (previewQuestions.length === 0) return;

    try {
      setLoading(true);
      
      const title = selectedPDFs.length === 1 
        ? `Questions from ${selectedPDFs[0].filename}`
        : `Questions from ${selectedPDFs.length} documents`;

      const result = await questionBankAgentService.savePreviewedQuestions(
        userId,
        previewQuestions,
        title,
        `Generated with AI preview. Quality score: ${previewStats?.average_quality_score || 'N/A'}`
      );

      if (result.status === 'success') {
        alert(`Saved ${result.question_count} questions!`);
        setShowPreviewModal(false);
        setPreviewQuestions([]);
        resetSelections();
        await fetchQuestionSets();
        setActiveView('question-sets');
      }
    } catch (error) {
      console.error('Save error:', error);
      alert('Failed to save questions: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Remove question from preview
  const removeQuestionFromPreview = (index) => {
    const newQuestions = previewQuestions.filter((_, i) => i !== index);
    setPreviewQuestions(newQuestions);
    if (previewStats) {
      setPreviewStats({
        ...previewStats,
        total: newQuestions.length
      });
    }
  };

  // ==================== END AI FEATURE HANDLERS ====================

  const renderViewContent = () => {
    if (activeView === 'custom') return renderCustom();
    if (activeView === 'question-sets') return renderQuestionSets();
    return renderQuestionSets();
  };

  const renderGenerationSettings = () => (
    <>
      <div className="qbd-setting-group">
        <label>Number of Questions</label>
        <input
          type="number"
          min="1"
          max="100"
          value={questionCount}
          onChange={handleQuestionCountChange}
          onBlur={handleQuestionCountBlur}
          className="qbd-input"
        />
      </div>

      <div className="qbd-setting-group">
        <label>Difficulty Mix</label>
        <div className="qbd-difficulty-sliders">
          {['easy', 'medium', 'hard'].map((level) => (
            <div key={level} className="qbd-slider-item">
              <span>{level.charAt(0).toUpperCase() + level.slice(1)}: {difficultyCount[level]} ({difficultyMix[level]}%)</span>
              <input
                type="range"
                min="0"
                max="100"
                value={difficultyMix[level]}
                onChange={(e) => handleDifficultyChange(level, e.target.value)}
              />
            </div>
          ))}
        </div>
        <label className="qbd-checkbox-label" style={{ marginTop: '8px' }}>
          <input
            type="checkbox"
            checked={adaptiveDifficulty}
            onChange={(e) => setAdaptiveDifficulty(e.target.checked)}
          />
          <span>Adaptive difficulty (let past performance on this topic override the mix above)</span>
        </label>
      </div>

      <div className="qbd-setting-group">
        <label>Question Types</label>
        <div className="qbd-checkbox-group">
          {['multiple_choice', 'true_false', 'short_answer', 'fill_blank'].map(type => (
            <label key={type} className="qbd-checkbox-label">
              <input
                type="checkbox"
                checked={questionTypes.includes(type)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setQuestionTypes([...questionTypes, type]);
                  } else {
                    setQuestionTypes(questionTypes.filter(t => t !== type));
                  }
                }}
              />
              <span>{type.replace(/_/g, ' ')}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="qbd-setting-group qbd-prompt-section">
        <label>Custom Instructions (Optional)</label>
        <textarea
          value={customPrompt}
          onChange={(e) => setCustomPrompt(e.target.value)}
          placeholder="e.g., Focus on exam-style application questions with short explanations."
          className="qbd-textarea qbd-prompt-input"
          rows={3}
        />
      </div>
    </>
  );

  const renderUploadPDF = () => (
    <div className="qbd-source-studio">
      <div className="qbd-content-grid">
        <div className="qbd-upload-section">
          <div className="qbd-upload-box">
            <div className="qbd-upload-mark">
              <FileUp size={28} />
            </div>
            <div className="qbd-upload-copy">
              <h3>Upload a PDF</h3>
              <p>Then select one or more of your PDFs below to generate questions from them.</p>
            </div>
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
              id="pdf-upload-input"
            />
            <label htmlFor="pdf-upload-input" className="qbd-btn-primary">
              {loading ? <Loader className="qbd-spin" size={18} /> : <Upload size={18} />}
              <span>{loading ? 'Uploading...' : 'Choose PDF'}</span>
            </label>
          </div>
        </div>

        {uploadedDocuments.length > 0 && (
          <div className="qbd-documents-section">
            <div className="qbd-section-header-row">
              <h3 className="qbd-section-title">Your PDFs ({uploadedDocuments.length})</h3>
              {selectedPDFs.length > 0 && (
                <div className="qbd-selection-info">
                  <span className="qbd-selection-count">{selectedPDFs.length} selected</span>
                  <button className="qbd-btn-text" onClick={clearPDFSelection}>Clear</button>
                </div>
              )}
            </div>

            <div className="qbd-documents-grid">
              {uploadedDocuments.map(doc => {
                const isSelected = selectedPDFs.some(p => p.id === doc.id);
                return (
                  <div
                    key={doc.id}
                    className={`qbd-document-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => togglePDFSelection(doc)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePDFSelection(doc); } }}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="qbd-source-check">
                      {isSelected && <CheckCircle size={20} />}
                    </div>
                    <button
                      className="qbd-document-delete-btn"
                      onClick={(e) => handleDeleteDocument(doc.id, e)}
                      title="Delete this PDF"
                    >
                      <Trash2 size={16} />
                    </button>
                    <div className="qbd-document-header">
                      <FileText size={24} />
                      <div className="qbd-document-info">
                        <h4>{doc.filename}</h4>
                        <p>{new Date(doc.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {selectedPDFs.length > 0 && (
              <div className="qbd-generation-settings">
                {renderGenerationSettings()}
                <button
                  className="qbd-btn-primary qbd-btn-large"
                  onClick={handleGenerateFromMultiplePDFs}
                  disabled={loading}
                >
                  {loading ? <Loader className="qbd-spin" size={18} /> : <Sparkles size={18} />}
                  <span>
                    {loading
                      ? 'Generating...'
                      : `Generate from ${selectedPDFs.length} PDF${selectedPDFs.length > 1 ? 's' : ''}`}
                  </span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const renderStudySourceGroup = (type, label, Icon, items, getMeta) => (
    <div className="qbd-source-section">
      <h3 className="qbd-section-title">{label} ({items.length})</h3>
      {items.length === 0 ? (
        <p className="qbd-section-hint">Nothing here yet.</p>
      ) : (
        <div className="qbd-source-grid">
          {items.map(item => {
            const isSelected = selectedSources.some(s => s.type === type && s.id === item.id);
            const title = item.title || 'Untitled';
            return (
              <div
                key={`${type}-${item.id}`}
                className={`qbd-source-card ${isSelected ? 'selected' : ''}`}
                onClick={() => toggleSourceSelection(type, item.id, title)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSourceSelection(type, item.id, title); } }}
                role="button"
                tabIndex={0}
              >
                <div className="qbd-source-check">
                  {isSelected && <CheckCircle size={20} />}
                </div>
                <Icon size={22} />
                <h4>{title}</h4>
                <p>{getMeta(item)}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderChatSlides = () => (
    <div className="qbd-context-studio">
      <div className="qbd-content-sections">
        {renderStudySourceGroup('note', 'Notes', BookOpen, studyNotes, (note) => formatSourceDate(note.updated_at || note.created_at))}
        {renderStudySourceGroup('flashcards', 'Flashcard sets', Layers, flashcardSets, (set) => `${set.card_count || 0} cards`)}
        {renderStudySourceGroup('chat', 'AI chats', MessageSquare, chatSessions, (chat) => formatSourceDate(chat.created_at))}

        {selectedSources.length > 0 && (
          <div className="qbd-generation-settings">
            <h3 className="qbd-section-title">Selected ({selectedSources.length})</h3>
            <div className="qbd-selected-sources">
              {selectedSources.map((source) => (
                <span key={`${source.type}-${source.id}`} className="qbd-selected-tag">
                  {source.title}
                  <button onClick={() => toggleSourceSelection(source.type, source.id, source.title)}>×</button>
                </span>
              ))}
            </div>
            {renderGenerationSettings()}
            <button
              className="qbd-btn-primary qbd-btn-large"
              onClick={handleGenerateFromChatSlides}
              disabled={loading}
            >
              {loading ? <Loader className="qbd-spin" size={18} /> : <Sparkles size={18} />}
              <span>{loading ? 'Generating...' : 'Generate Questions'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );

  const renderCustom = () => (
    <div className="qbd-view qbd-studio-view qbd-builder-studio">
      <div className="qbd-view-header">
        <div className="qbd-view-title-group">
          <h2 className="qbd-view-title">Generator</h2>
        </div>
      </div>

      <div className="qbd-gen-sources" role="tablist" aria-label="Generate questions from">
        {GENERATOR_SOURCES.map((source) => (
          <button
            key={source.key}
            className={generatorSource === source.key ? 'active' : ''}
            onClick={() => setGeneratorSource(source.key)}
            role="tab"
            aria-selected={generatorSource === source.key}
            type="button"
          >
            {source.label}
          </button>
        ))}
      </div>

      {generatorSource === 'pdf' && renderUploadPDF()}
      {generatorSource === 'study' && renderChatSlides()}
      {generatorSource === 'text' && (
      <div className="qbd-custom-container">
        <div className="qbd-custom-layout">
          <div className="qbd-custom-card qbd-custom-card--editor">
            <div className="qbd-custom-section-header">
              <div className="qbd-custom-section-icon">
                <FileText size={20} />
              </div>
              <h3 className="qbd-custom-section-title">Source & brief</h3>
            </div>

            <div className="qbd-custom-input-wrapper">
              <label className="qbd-custom-label">Question Set Title</label>
              <input
                type="text"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder="e.g., Physics Chapter 5 Review"
                className="qbd-custom-input"
              />
            </div>

            <div className="qbd-custom-input-wrapper" style={{ marginBottom: 0 }}>
              <label className="qbd-custom-label">Content (paste notes, articles, or any study material)</label>
              <textarea
                value={customContent}
                onChange={(e) => setCustomContent(e.target.value)}
                placeholder="Paste your content here... The AI will analyze it and generate relevant practice questions."
                className="qbd-textarea-large"
                rows={16}
              />
              <div className="qbd-custom-content-meta">
                <span>{customContent.trim() ? customContent.trim().split(/\s+/).length : 0} words</span>
                <span>{customContent.length} characters</span>
              </div>
            </div>
          </div>

          <div className="qbd-custom-card qbd-custom-card--settings">
            <div className="qbd-custom-section-header">
              <div className="qbd-custom-section-icon">
                <Settings size={20} />
              </div>
              <h3 className="qbd-custom-section-title">Practice blueprint</h3>
            </div>

            <div className="qbd-settings-row">
              <div className="qbd-custom-input-wrapper qbd-custom-input-wrapper--compact">
                <label className="qbd-custom-label">Number of Questions</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={questionCount}
                  onChange={handleQuestionCountChange}
                  onBlur={handleQuestionCountBlur}
                  className="qbd-custom-input"
                />
              </div>
            </div>

            <div className="qbd-difficulty-section">
              <label className="qbd-custom-label" style={{ marginBottom: '16px' }}>Difficulty Mix</label>
              <div className="qbd-difficulty-sliders">
                <div className="qbd-slider-item">
                  <div className="qbd-slider-header">
                    <span className="qbd-slider-label">
                      <span>Easy</span>
                    </span>
                    <span className="qbd-slider-value">{difficultyCount.easy} ({difficultyMix.easy}%)</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={difficultyMix.easy}
                    onChange={(e) => handleDifficultyChange('easy', e.target.value)}
                  />
                </div>

                <div className="qbd-slider-item">
                  <div className="qbd-slider-header">
                    <span className="qbd-slider-label">
                      <span>Medium</span>
                    </span>
                    <span className="qbd-slider-value">{difficultyCount.medium} ({difficultyMix.medium}%)</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={difficultyMix.medium}
                    onChange={(e) => handleDifficultyChange('medium', e.target.value)}
                  />
                </div>

                <div className="qbd-slider-item">
                  <div className="qbd-slider-header">
                    <span className="qbd-slider-label">
                      <span>Hard</span>
                    </span>
                    <span className="qbd-slider-value">{difficultyCount.hard} ({difficultyMix.hard}%)</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={difficultyMix.hard}
                    onChange={(e) => handleDifficultyChange('hard', e.target.value)}
                  />
                </div>
              </div>
              <div className="qbd-difficulty-total">
                Total: {difficultyCount.easy + difficultyCount.medium + difficultyCount.hard} questions
              </div>
              <label className="qbd-checkbox-label" style={{ marginTop: '8px' }}>
                <input
                  type="checkbox"
                  checked={adaptiveDifficulty}
                  onChange={(e) => setAdaptiveDifficulty(e.target.checked)}
                />
                <span>Adaptive difficulty (let past performance on this topic override the mix above)</span>
              </label>
            </div>

            <div className="qbd-custom-input-wrapper" style={{ marginBottom: 0 }}>
              <label className="qbd-custom-label">Question Types</label>
              <div className="qbd-checkbox-grid">
                {[
                  { value: 'multiple_choice', label: 'Multiple Choice' },
                  { value: 'true_false', label: 'True/False' },
                  { value: 'short_answer', label: 'Short Answer' },
                  { value: 'fill_blank', label: 'Fill in the Blank' }
                ].map(type => (
                  <label key={type.value} className="qbd-checkbox-label">
                    <input
                      type="checkbox"
                      checked={questionTypes.includes(type.value)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setQuestionTypes([...questionTypes, type.value]);
                        } else {
                          setQuestionTypes(questionTypes.filter(t => t !== type.value));
                        }
                      }}
                    />
                    <span>{type.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="qbd-custom-input-wrapper" style={{ marginTop: '20px' }}>
              <label className="qbd-custom-label">Custom Instructions (Optional)</label>
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="e.g., Ask scenario-based questions, keep explanations short, and prioritize weak conceptual areas."
                className="qbd-textarea qbd-prompt-input"
                rows={4}
              />
            </div>

            <button
              className="qbd-generate-button"
              onClick={handleGenerateCustom}
              disabled={loading || !customContent.trim()}
            >
              {loading ? <Loader className="qbd-spin" size={20} /> : <Sparkles size={20} />}
              <span>{loading ? 'Generating Questions...' : 'Generate Questions'}</span>
            </button>
          </div>
        </div>
      </div>
      )}
    </div>
  );

  const renderQuestionSets = () => {
    const sortedSets = [...questionSets].sort(
      (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    );

    const getSetStatus = (set) => {
      const attempts = Number(set.attempts || 0);
      const score = Number(set.best_score || 0);
      if (!attempts) return 'Not started';
      if (score >= 80) return 'Strong';
      if (score >= 60) return 'Building';
      return 'Needs review';
    };

    return (
    <div className="qbd-view qbd-question-hub">
      <header className="qbd-qh-hero">
        <div className="qbd-qh-hero-copy">
          <h1 className="plain-page-title">Question Bank</h1>
        </div>
      </header>

      <div className="plx-library">
        {loading ? (
          <div className="plx-state">
            <Loader className="qbd-spin" size={28} />
            <p>Loading your library</p>
          </div>
        ) : sortedSets.length === 0 ? (
          <div className="plx-state plx-state--empty">
            <div className="plx-empty-mark"><FileText size={24} /></div>
            <span>Your library is empty</span>
            <h2>No Question Sets</h2>
            <p>Use Create Questions in the sidebar to generate your first set.</p>
          </div>
        ) : (
          <div className="plx-grid plx-grid--list">
            {sortedSets.map((set) => {
              const title = set.title || 'Untitled question set';
              const attempts = Number(set.attempts || 0);
              const score = Number(set.best_score || 0);
              const questionTotal = Number(set.total_questions || 0);
              const stackSize = Math.max(1, Math.min(questionTotal, 5));
              const coverMark = title
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map(word => word[0])
                .join('')
                .toUpperCase() || 'QB';
              const isRenaming = renamingSetId === set.id;

              return (
                <article
                  key={set.id}
                  className="plx-card"
                  onClick={() => { if (!isRenaming) startStudySession(set.id); }}
                  onKeyDown={(event) => {
                    if (isRenaming) return;
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      startStudySession(set.id);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`Practice ${title}`}
                >
                  <div className="plx-card-top">
                    <div className="plx-stack-visual" aria-hidden="true">
                      {Array.from({ length: stackSize }).map((_, stackIndex) => (
                        <span key={stackIndex} style={{ '--stack-index': stackIndex }} />
                      ))}
                      <strong>{coverMark}</strong>
                    </div>

                    <div className="plx-card-main">
                      <div className="plx-card-badges">
                        <span>{formatDocumentType(set.source_type)}</span>
                        <span>{getSetStatus(set)}</span>
                      </div>
                      {isRenaming ? (
                        <div className="qbd-qh-rename-editor" onClick={(event) => event.stopPropagation()}>
                          <input
                            value={renameValue}
                            onChange={(event) => {
                              setRenameValue(event.target.value);
                              if (renameError) setRenameError('');
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') saveQuestionSetName(set.id);
                              if (event.key === 'Escape') cancelRenameQuestionSet();
                            }}
                            aria-label="Question set name"
                            autoFocus
                            maxLength={120}
                          />
                          <button
                            className="qbd-qh-rename-confirm"
                            onClick={() => saveQuestionSetName(set.id)}
                            disabled={renameSaving}
                            aria-label="Save question set name"
                            type="button"
                          >
                            {renameSaving ? <Loader className="qbd-spin" size={15} /> : <Check size={15} />}
                          </button>
                          <button
                            className="qbd-qh-rename-cancel"
                            onClick={cancelRenameQuestionSet}
                            disabled={renameSaving}
                            aria-label="Cancel renaming question set"
                            type="button"
                          >
                            <X size={15} />
                          </button>
                        </div>
                      ) : (
                        <h2>{title}</h2>
                      )}
                      {isRenaming && renameError ? <span className="qbd-qh-rename-error" role="alert">{renameError}</span> : null}
                      <p>{set.description || 'A focused question set ready for practice.'}</p>
                    </div>

                    <ArrowUpRight className="plx-open-cue" size={17} aria-hidden="true" />
                  </div>

                  <div className="plx-card-data">
                    <div><FileText size={13} /><strong>{questionTotal}</strong><span>questions</span></div>
                    <div><RefreshCw size={13} /><strong>{attempts}</strong><span>attempts</span></div>
                    <div><Star size={13} /><strong>{attempts ? `${score}%` : '—'}</strong><span>best</span></div>
                  </div>

                  {attempts > 0 && (
                    <div className="plx-progress">
                      <div><span>Best score</span><strong>{score}%</strong></div>
                      <div className="plx-progress-track"><span style={{ width: `${score}%` }} /></div>
                    </div>
                  )}

                  <footer className="plx-card-footer">
                    <div className="plx-creator">
                      <div><small>Created</small><strong>{set.created_at ? new Date(set.created_at).toLocaleDateString() : '—'}</strong></div>
                    </div>

                    <div className="plx-card-controls" aria-label={`Actions for ${title}`}>
                      <button
                        type="button"
                        title="Rename"
                        aria-label={`Rename ${title}`}
                        onClick={(event) => { event.stopPropagation(); beginRenameQuestionSet(set); }}
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        type="button"
                        title="Export"
                        aria-label={`Export ${title}`}
                        onClick={(event) => { event.stopPropagation(); openExportModal(set.id); }}
                      >
                        <Download size={14} />
                      </button>
                      <button
                        type="button"
                        className="danger"
                        title="Delete"
                        aria-label={`Delete ${title}`}
                        onClick={(event) => { event.stopPropagation(); deleteQuestionSet(set.id); }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </footer>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
  };

  const renderStudyModal = () => {
    if (!showStudyModal || !selectedQuestionSet) return null;

    // Guard against missing or empty questions
    const questions = selectedQuestionSet.questions || [];

    if (questions.length === 0) {
      return (
        <div className="qbd-modal-overlay">
          <div className="qbd-modal" role="dialog" aria-modal="true" aria-labelledby="qbd-study-title" onClick={e => e.stopPropagation()}>
            <div className="qbd-modal-header">
              <h3 id="qbd-study-title">{selectedQuestionSet?.title || 'Quiz Session'}</h3>
              <button type="button" className="qbd-modal-close" aria-label="Close practice session" onClick={() => setShowStudyModal(false)}>×</button>
            </div>
            <div className="qbd-modal-content">
              <p style={{ textAlign: 'center', padding: '40px' }}>No questions found in this set.</p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="qbd-modal-overlay">
        <div className="qbd-modal" role="dialog" aria-modal="true" aria-labelledby="qbd-study-title" onClick={e => e.stopPropagation()}>
          <div className="qbd-modal-header">
            <h3 id="qbd-study-title">{selectedQuestionSet?.title || 'Quiz Session'}</h3>
            <button type="button" className="qbd-modal-close" aria-label="Close practice session" onClick={() => setShowStudyModal(false)}>×</button>
          </div>

          <div className="qbd-modal-content">
            {!showResults ? (
              <>
                <div className="qbd-progress-bar-container">
                  <span className="qbd-progress-text">
                    Question {currentQuestion + 1} of {questions.length}
                  </span>
                  <div className="qbd-progress-bar">
                    <div 
                      className="qbd-progress-fill"
                      style={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }}
                    />
                  </div>
                </div>

                {questions.map((q, idx) => (
                  <div 
                    key={q.id}
                    style={{ display: idx === currentQuestion ? 'block' : 'none' }}
                  >
                    <div className="qbd-question-header">
                      <span className={`qbd-difficulty-badge ${q.difficulty}`}>{q.difficulty}</span>
                      <span className="qbd-topic-badge">{q.topic}</span>
                    </div>

                    <MathRenderer content={q.question_text || ''} className="qbd-question-text" />

                    {q.question_type === 'multiple_choice' && (
                      <div className="qbd-options">
                        {(Array.isArray(q.options) ? q.options : []).map((option, optIdx) => (
                          <label key={optIdx} className="qbd-option">
                            <input
                              type="radio"
                              name={`question-${q.id}`}
                              value={option}
                              checked={userAnswers[q.id] === option}
                              onChange={() => handleAnswerChange(q.id, option)}
                            />
                            <MathRenderer content={option || ''} className="qbd-option-text" />
                          </label>
                        ))}
                      </div>
                    )}

                    {q.question_type === 'true_false' && (
                      <div className="qbd-options">
                        <label className="qbd-option">
                          <input
                            type="radio"
                            name={`question-${q.id}`}
                            value="true"
                            checked={userAnswers[q.id] === 'true'}
                            onChange={() => handleAnswerChange(q.id, 'true')}
                          />
                          <span>True</span>
                        </label>
                        <label className="qbd-option">
                          <input
                            type="radio"
                            name={`question-${q.id}`}
                            value="false"
                            checked={userAnswers[q.id] === 'false'}
                            onChange={() => handleAnswerChange(q.id, 'false')}
                          />
                          <span>False</span>
                        </label>
                      </div>
                    )}

                    {(q.question_type === 'short_answer' || q.question_type === 'fill_blank') && (
                      <textarea
                        className="qbd-textarea"
                        value={userAnswers[q.id] || ''}
                        onChange={e => handleAnswerChange(q.id, e.target.value)}
                        placeholder="Type your answer here..."
                        rows={4}
                      />
                    )}
                  </div>
                ))}

                <div className="qbd-navigation-btns">
                  <button 
                    className="qbd-btn-secondary"
                    onClick={() => setCurrentQuestion(Math.max(0, currentQuestion - 1))}
                    disabled={currentQuestion === 0}
                  >
                    Previous
                  </button>
                  {currentQuestion < questions.length - 1 ? (
                    <button 
                      className="qbd-btn-primary"
                      onClick={() => setCurrentQuestion(currentQuestion + 1)}
                    >
                      Next
                    </button>
                  ) : (
                    <button 
                      type="button"
                      className="qbd-btn-primary"
                      onClick={submitAnswers}
                      disabled={loading}
                    >
                      {loading ? 'Submitting...' : 'Submit Answers'}
                    </button>
                  )}
                </div>
              </>
            ) : results && (
              <div className="qbd-results">
                <div className="qbd-results-header">
                  <div className="qbd-score-circle">
                    <span className="qbd-score-value">{results.score}%</span>
                    <span className="qbd-score-label">Score</span>
                  </div>
                  <div className="qbd-results-stats">
                    <div className="qbd-result-stat correct">
                      <CheckCircle size={24} />
                      <span>{results.correct_count} Correct</span>
                    </div>
                    <div className="qbd-result-stat incorrect">
                      <XCircle size={24} />
                      <span>{results.total_questions - results.correct_count} Incorrect</span>
                    </div>
                  </div>
                </div>

                {results.adaptation && (
                  <div className="qbd-adaptation-box">
                    <h4>AI Recommendation</h4>
                    <p><strong>Next Difficulty:</strong> {results.adaptation.recommended_difficulty}</p>
                    <p>{results.adaptation.reason}</p>
                    <div className="qbd-suggested-distribution">
                      <span>Suggested Mix:</span>
                      <span>Easy: {results.adaptation.suggested_distribution.easy}</span>
                      <span>Medium: {results.adaptation.suggested_distribution.medium}</span>
                      <span>Hard: {results.adaptation.suggested_distribution.hard}</span>
                    </div>
                  </div>
                )}

                <div className="qbd-results-details">
                  <h4>Review Your Answers</h4>
                  {results.details.map((detail, idx) => (
                    <div key={idx} className={`qbd-result-item ${detail.is_correct ? 'correct' : 'incorrect'}`}>
                      <div className="qbd-result-indicator">
                        {detail.is_correct ? <CheckCircle size={20} /> : <XCircle size={20} />}
                      </div>
                      <div className="qbd-result-content">
                        <div className="qbd-result-question"><strong>Q{idx + 1}:</strong> <MathRenderer content={detail.question_text || ''} className="qbd-result-question-math" /></div>
                        <p className="qbd-result-answer">
                          <strong>Your answer:</strong> {detail.user_answer || 'No answer'}
                        </p>
                        {!detail.is_correct && (
                          <p className="qbd-result-correct">
                            <strong>Correct answer:</strong> {detail.correct_answer}
                          </p>
                        )}
                        {detail.explanation && (
                          <p className="qbd-result-explanation">{detail.explanation}</p>
                        )}
                        {!detail.is_correct && detail.question_id && (
                          <button 
                            className="qbd-btn-secondary qbd-btn-small"
                            onClick={() => generateSimilarQuestion(detail.question_id)}
                            disabled={loading}
                            style={{ marginTop: '10px' }}
                          >
                            <Zap size={16} style={{ marginRight: '5px' }} />
                            {loading ? 'Generating...' : 'Generate Similar Question'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <button 
                  className="qbd-btn-primary qbd-btn-large"
                  onClick={() => {
                    setShowStudyModal(false);
                    setShowResults(false);
                    fetchQuestionSets();
                  }}
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const sidebarLead = (
    <button className="qbd-hub-create" onClick={() => setActiveView('custom')} type="button">
      <Sparkles size={15} />
      <span>Create Questions</span>
    </button>
  );

  return (
    <div className="qbd-hub with-social-chrome">
      <SocialHubChrome
        brandKicker="Questions"
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
        sidebarLead={sidebarLead}
        sideSections={[
          {
            label: 'Question bank',
            items: QUESTION_VIEWS.filter((view) => view.key === 'question-sets').map((view) => ({
              icon: view.icon,
              label: view.label,
              active: activeView === view.key,
              count: view.key === 'question-sets' ? questionSets.length : null,
              onClick: () => setActiveView(view.key),
            })),
          },
        ]}
      >
        <main className="qbd-hub-main">
          <div className="qbd-hub-mobile-nav" aria-label="Question Hub views">
            {QUESTION_VIEWS.map((view) => {
              const Icon = view.icon;
              return (
                <button
                  key={view.key}
                  className={activeView === view.key ? 'active' : ''}
                  onClick={() => setActiveView(view.key)}
                  type="button"
                >
                  <Icon size={14} />
                  <span>{view.label}</span>
                </button>
              );
            })}
          </div>
          <div className="qbd-main">
            <div className="qbd-content">
              {contextGenerationStatus && (
                <div className="qbd-loading" role="status" aria-live="polite">
                  {contextGenerationStatus.startsWith('Generating') && <Loader className="qbd-spin" size={28} />}
                  <p>{contextGenerationStatus}</p>
                </div>
              )}
              {!contextGenerationStatus.startsWith('Generating') && renderViewContent()}
            </div>
          </div>
        </main>
      </SocialHubChrome>
      {renderStudyModal()}
      {/* Import/Export Modal */}
      <ImportExportModal
        isOpen={showImportExport}
        onClose={() => setShowImportExport(false)}
        mode="import"
        sourceType="questions"
        onSuccess={(result) => {
          if (result.shouldNavigate) {
            // Navigate based on destination type
            if (result.destinationType === 'flashcards') {
              // Navigate to flashcards with the set ID
              if (result.set_id) {
                navigate(`/flashcards?set_id=${result.set_id}&mode=preview`);
              } else {
                navigate('/flashcards');
              }
            } else if (result.destinationType === 'notes') {
              // Navigate to the created note
              if (result.note_id) {
                navigate(`/notes/editor/${result.note_id}`);
              } else {
                navigate('/notes');
              }
            } else {
              fetchQuestionSets();
            }
          } else {
            alert("Successfully converted questions!");
            fetchQuestionSets();
          }
        }}
      />
      
      {/* PDF Export Modal */}
      {showExportModal && (
        <div className="qbd-modal-overlay" onClick={() => setShowExportModal(false)}>
          <div className="qbd-export-modal" role="dialog" aria-modal="true" aria-labelledby="qbd-export-title" onClick={(e) => e.stopPropagation()}>
            <div className="qbd-export-modal-header">
              <div className="qbd-export-modal-icon">
                <FileDown size={32} />
              </div>
              <span className="qbd-export-kicker">Ready for print</span>
              <h2 id="qbd-export-title">Export question set</h2>
              <p>A clear, print-ready PDF with room to think and review.</p>
            </div>
            
            <div className="qbd-export-modal-content">
              <div className="qbd-export-document" aria-label="Selected question set">
                <div>
                  <span>Question set</span>
                  <strong>{exportSet?.title || 'Selected question set'}</strong>
                </div>
                <small>{exportQuestionCount ? `${exportQuestionCount} questions` : 'Practice set'} · PDF</small>
              </div>

              <div className="qbd-export-option">
                <label className="qbd-export-checkbox">
                  <input
                    type="checkbox"
                    checked={includeAnswers}
                    onChange={(e) => setIncludeAnswers(e.target.checked)}
                  />
                  <span className="qbd-checkbox-custom"></span>
                  <div className="qbd-export-option-text">
                    <span className="qbd-export-option-title">Include Answer Key</span>
                    <span className="qbd-export-option-desc">Add answers and explanations at the end of the document</span>
                  </div>
                </label>
              </div>
              
              <div className="qbd-export-features">
                <h4>Inside your PDF</h4>
                <ul>
                  <li><CheckCircle size={14} /> A focused cover and question metadata</li>
                  <li><CheckCircle size={14} /> Generous response space and readable options</li>
                  <li><CheckCircle size={14} /> Topic and difficulty markers for every question</li>
                  <li><CheckCircle size={14} /> Consistent headers, dates, and page numbers</li>
                </ul>
              </div>
            </div>
            
            <div className="qbd-export-modal-actions">
              <button 
                className="qbd-btn-secondary"
                onClick={() => setShowExportModal(false)}
              >
                Cancel
              </button>
              <button 
                className="qbd-btn-primary"
                onClick={() => exportQuestionSetPdf(exportSetId, includeAnswers)}
                disabled={exportingPdf}
              >
                {exportingPdf ? (
                  <>
                    <Loader className="qbd-spin" size={18} />
                    <span>Generating PDF...</span>
                  </>
                ) : (
                  <>
                    <Download size={18} />
                    <span>Download PDF</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Questions Modal */}
      {showPreviewModal && (
        <div className="qbd-modal-overlay" onClick={() => setShowPreviewModal(false)}>
          <div className="qbd-preview-modal" role="dialog" aria-modal="true" aria-labelledby="qbd-preview-title" onClick={e => e.stopPropagation()}>
            <div className="qbd-preview-header">
              <div className="qbd-preview-title">
                <Eye size={24} />
                <div>
                  <h2 id="qbd-preview-title">Preview Questions</h2>
                  <p>Review, edit, or regenerate before saving</p>
                </div>
              </div>
              <button type="button" className="qbd-modal-close" aria-label="Close question preview" onClick={() => setShowPreviewModal(false)}>
                <X size={20} />
              </button>
            </div>

            {previewStats && (
              <div className="qbd-preview-stats">
                <div className="qbd-stat-chip">
                  <FileText size={14} />
                  <span>{previewStats.total} Questions</span>
                </div>
                <div className="qbd-stat-chip">
                  <Star size={14} />
                  <span>Quality: {previewStats.average_quality_score}/10</span>
                </div>
                {previewStats.weak_topics && previewStats.weak_topics.length > 0 && (
                  <div className="qbd-topic-badges">
                    <span className="qbd-topic-badge-label">Weak focus:</span>
                    {previewStats.weak_topics.map((topic, idx) => (
                      <span key={`${topic}-${idx}`} className="qbd-topic-badge weak">
                        {topic}
                      </span>
                    ))}
                  </div>
                )}
                {previewStats.strong_topics && previewStats.strong_topics.length > 0 && (
                  <div className="qbd-topic-badges">
                    <span className="qbd-topic-badge-label">Strong challenge:</span>
                    {previewStats.strong_topics.map((topic, idx) => (
                      <span key={`${topic}-${idx}`} className="qbd-topic-badge strong">
                        {topic}
                      </span>
                    ))}
                  </div>
                )}
                {previewStats.potential_duplicates > 0 && (
                  <div className="qbd-stat-chip warning">
                    <AlertTriangle size={14} />
                    <span>{previewStats.potential_duplicates} Potential Duplicates</span>
                  </div>
                )}
                {previewStats.bloom_distribution && (
                  <div className="qbd-bloom-dist">
                    {Object.entries(previewStats.bloom_distribution).map(([level, count]) => (
                      <span key={level} className={`qbd-bloom-chip ${level}`}>
                        {level}: {count}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="qbd-preview-questions">
              {previewQuestions.map((q, idx) => (
                <div 
                  key={idx} 
                  className={`qbd-preview-question ${q.is_potential_duplicate ? 'duplicate-warning' : ''}`}
                >
                  <div className="qbd-preview-q-header">
                    <span className="qbd-q-number">Q{idx + 1}</span>
                    <span className={`qbd-difficulty-badge ${q.difficulty}`}>{q.difficulty}</span>
                    {q.bloom_level && (
                      <span className={`qbd-bloom-badge ${q.bloom_level}`}>{q.bloom_level}</span>
                    )}
                    {q.quality_score && (
                      <span className="qbd-quality-badge">
                        <Star size={12} /> {q.quality_score.toFixed(1)}
                      </span>
                    )}
                    {q.is_potential_duplicate && (
                      <span className="qbd-duplicate-badge">
                        <AlertTriangle size={12} /> Similar exists
                      </span>
                    )}
                  </div>
                  
                  <p className="qbd-preview-q-text">{q.question_text}</p>
                  
                  {q.options && q.options.length > 0 && (
                    <div className="qbd-preview-options">
                      {q.options.map((opt, oidx) => (
                        <div 
                          key={oidx} 
                          className={`qbd-preview-option ${opt === q.correct_answer ? 'correct' : ''}`}
                        >
                          {String.fromCharCode(65 + oidx)}. {opt}
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <div className="qbd-preview-answer">
                    <strong>Answer:</strong> {q.correct_answer}
                  </div>
                  
                  {q.explanation && (
                    <div className="qbd-preview-explanation">
                      <strong>Explanation:</strong> {q.explanation}
                    </div>
                  )}

                  <div className="qbd-preview-q-actions">
                    <div className="qbd-regenerate-input">
                      <input
                        type="text"
                        placeholder="Feedback for regeneration..."
                        value={editingQuestion === idx ? regenerateFeedback : ''}
                        onChange={(e) => {
                          setEditingQuestion(idx);
                          setRegenerateFeedback(e.target.value);
                        }}
                        onFocus={() => setEditingQuestion(idx)}
                      />
                      <button 
                        onClick={() => handleRegenerateQuestion(idx)}
                        disabled={editingQuestion === idx && loading}
                        title="Regenerate this question"
                      >
                        {editingQuestion === idx && loading ? (
                          <Loader className="qbd-spin" size={14} />
                        ) : (
                          <RefreshCw size={14} />
                        )}
                      </button>
                    </div>
                    <button 
                      className="qbd-remove-q-btn"
                      onClick={() => removeQuestionFromPreview(idx)}
                      title="Remove this question"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="qbd-preview-footer">
              <button 
                className="qbd-btn-secondary"
                onClick={() => setShowPreviewModal(false)}
              >
                Cancel
              </button>
              <button 
                className="qbd-btn-primary"
                onClick={handleSavePreviewedQuestions}
                disabled={loading || previewQuestions.length === 0}
              >
                {loading ? (
                  <>
                    <Loader className="qbd-spin" size={18} />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    <span>Save {previewQuestions.length} Questions</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default QuestionBankDashboard;

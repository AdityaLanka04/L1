import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Upload, MessageSquare, Sparkles, FileText, BarChart3, 
  Plus, Play, Trash2, TrendingUp, Target, Brain, Zap, Award, 
  CheckCircle, XCircle, Loader, Clock, FileUp, BookOpen, PieChart, ChevronLeft,
  Download, FileDown, Eye, Edit3, RefreshCw, Layers, AlertTriangle, 
  Star, GitMerge, Wand2, List, ChevronDown, ChevronUp, X, Save, ChevronRight
} from 'lucide-react';
import './Questionbankdashboard.css';
import './QuestionbankConvert.css';
import { API_URL } from '../config';
import ImportExportModal from '../components/ImportExportModal';
import questionBankAgentService from '../services/questionBankAgentService';
const QuestionBankDashboard = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const userId = localStorage.getItem('user_id') || localStorage.getItem('username');

  const [activeView, setActiveView] = useState('question-sets');
  const [questionSets, setQuestionSets] = useState([]);
  const [uploadedDocuments, setUploadedDocuments] = useState([]);
  const [chatSessions, setChatSessions] = useState([]);
  const [uploadedSlides, setUploadedSlides] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportSetId, setExportSetId] = useState(null);
  const [includeAnswers, setIncludeAnswers] = useState(false);

  // Weak Areas State
  const [weakAreas, setWeakAreas] = useState([]);
  const [wrongAnswers, setWrongAnswers] = useState([]);
  const [practiceRecommendations, setPracticeRecommendations] = useState(null);
  const [generatingPractice, setGeneratingPractice] = useState(false);
  const [selectedWeakTopic, setSelectedWeakTopic] = useState(null);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [showStudyModal, setShowStudyModal] = useState(false);
  const [showImportExport, setShowImportExport] = useState(false);

  const [selectedDocument, setSelectedDocument] = useState(null);
  const [selectedPDFs, setSelectedPDFs] = useState([]);  // For multi-PDF selection
  const [selectedSources, setSelectedSources] = useState([]);
  const [customContent, setCustomContent] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [questionCount, setQuestionCount] = useState(10);
  const [difficultyMix, setDifficultyMix] = useState({ easy: 30, medium: 50, hard: 20 }); // Percentages
  const [questionTypes, setQuestionTypes] = useState(['multiple_choice', 'true_false', 'short_answer']);

  // Calculate actual difficulty counts from percentages, ensuring they sum to questionCount
  const getDifficultyCounts = () => {
    const total = difficultyMix.easy + difficultyMix.medium + difficultyMix.hard;
    if (total === 0) return { easy: 0, medium: 0, hard: 0 };
    
    // Normalize percentages to ensure they sum to 100%
    const normalizedEasy = difficultyMix.easy / total;
    const normalizedMedium = difficultyMix.medium / total;
    const normalizedHard = difficultyMix.hard / total;
    
    // Calculate counts
    const count = typeof questionCount === 'number' ? questionCount : 10;
    let easyCount = Math.round(normalizedEasy * count);
    let mediumCount = Math.round(normalizedMedium * count);
    let hardCount = Math.round(normalizedHard * count);
    
    // Adjust for rounding errors to ensure total matches questionCount
    const diff = count - (easyCount + mediumCount + hardCount);
    if (diff !== 0) {
      // Add/subtract from the largest category
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
  
  // Handle difficulty slider change - adjust others to maintain 100% total
  const handleDifficultyChange = (level, newValue) => {
    const value = parseInt(newValue);
    const others = ['easy', 'medium', 'hard'].filter(l => l !== level);
    const currentOthersTotal = others.reduce((sum, l) => sum + difficultyMix[l], 0);
    const remaining = 100 - value;
    
    if (currentOthersTotal === 0) {
      // If others are 0, split remaining equally
      setDifficultyMix({
        ...difficultyMix,
        [level]: value,
        [others[0]]: Math.floor(remaining / 2),
        [others[1]]: Math.ceil(remaining / 2)
      });
    } else {
      // Scale others proportionally
      const scale = remaining / currentOthersTotal;
      const newMix = { [level]: value };
      let allocated = value;
      
      others.forEach((l, idx) => {
        if (idx === others.length - 1) {
          // Last one gets the remainder to ensure exactly 100
          newMix[l] = 100 - allocated;
        } else {
          newMix[l] = Math.round(difficultyMix[l] * scale);
          allocated += newMix[l];
        }
      });
      
      setDifficultyMix(newMix);
    }
  };

  // Handle question count change with better UX
  const handleQuestionCountChange = (e) => {
    const value = e.target.value;
    // Allow empty string while typing
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
    // Reset to default if empty or invalid on blur
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

  // AI Features State
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewQuestions, setPreviewQuestions] = useState([]);
  const [previewStats, setPreviewStats] = useState(null);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [regenerateFeedback, setRegenerateFeedback] = useState('');
  const [extractedTopics, setExtractedTopics] = useState(null);
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [showTopicsPanel, setShowTopicsPanel] = useState(false);
  const [enhancedPrompt, setEnhancedPrompt] = useState('');
  const [isEnhancingPrompt, setIsEnhancingPrompt] = useState(false);
  const [weaknessAnalysis, setWeaknessAnalysis] = useState(null);
  const [showWeaknessPanel, setShowWeaknessPanel] = useState(false);
  
  // Batch operations state
  const [selectedSets, setSelectedSets] = useState([]);
  const [showBatchActions, setShowBatchActions] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeTitle, setMergeTitle] = useState('');
  const [deleteOriginals, setDeleteOriginals] = useState(false);

  // Smart generation state
  const [customPrompt, setCustomPrompt] = useState('');
  const [referenceDocId, setReferenceDocId] = useState(null);
  const [showSmartOptions, setShowSmartOptions] = useState(false);

  useEffect(() => {
    fetchQuestionSets();
    fetchUploadedDocuments();
    fetchChatSessions();
    fetchUploadedSlides();
    if (activeView === 'analytics') {
      fetchAnalytics();
    }
    if (activeView === 'weak-areas') {
      fetchWeakAreas();
      fetchPracticeRecommendations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView]);

  const fetchQuestionSets = async () => {
    try {
      setLoading(true);
      console.log('📡 Fetching question sets for user:', userId);
      const response = await fetch(`${API_URL}/qb/get_question_sets?user_id=${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      console.log('📡 Response status:', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('📡 Question sets data:', data);
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
    } catch (error) {
          }
  };

  const fetchChatSessions = async () => {
    try {
      const response = await fetch(`${API_URL}/get_chat_sessions?user_id=${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setChatSessions(data.sessions || []);
      }
    } catch (error) {
          }
  };

  const fetchUploadedSlides = async () => {
    try {
      const response = await fetch(`${API_URL}/get_uploaded_slides?user_id=${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setUploadedSlides(data.slides || []);
      }
    } catch (error) {
          }
  };

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/qb/get_analytics?user_id=${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setAnalytics(data);
      }
    } catch (error) {
          } finally {
      setLoading(false);
    }
  };

  // ==================== WEAK AREAS FUNCTIONS ====================

  const fetchWeakAreas = async () => {
    try {
      setLoading(true);
      const data = await questionBankAgentService.getWeakAreas(userId);
      setWeakAreas(data.weak_areas || []);
    } catch (error) {
      console.error('Error fetching weak areas:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchWrongAnswers = async (topic = null) => {
    try {
      const data = await questionBankAgentService.getWrongAnswers(userId, topic, 50);
      setWrongAnswers(data.wrong_answers || []);
    } catch (error) {
      console.error('Error fetching wrong answers:', error);
    }
  };

  const fetchPracticeRecommendations = async () => {
    try {
      const data = await questionBankAgentService.getPracticeRecommendations(userId);
      setPracticeRecommendations(data);
    } catch (error) {
      console.error('Error fetching recommendations:', error);
    }
  };

  const handleGeneratePractice = async (topic = null) => {
    try {
      setGeneratingPractice(true);
      const data = await questionBankAgentService.generatePractice(userId, topic, 10, true);
      
      if (data.practice_set_id) {
        alert(`Practice set created with ${data.total_questions} questions!`);
        await fetchQuestionSets();
        setActiveView('question-sets');
      } else {
        alert(data.message || 'Could not generate practice questions');
      }
    } catch (error) {
      console.error('Error generating practice:', error);
      alert('Failed to generate practice: ' + error.message);
    } finally {
      setGeneratingPractice(false);
    }
  };

  const handleMarkReviewed = async (wrongAnswerId, understood = true) => {
    try {
      await questionBankAgentService.markWrongAnswerReviewed(wrongAnswerId, understood);
      // Refresh wrong answers
      await fetchWrongAnswers(selectedWeakTopic);
    } catch (error) {
      console.error('Error marking reviewed:', error);
    }
  };

  const handleResetWeakArea = async (weakAreaId, action = 'mastered') => {
    try {
      await questionBankAgentService.resetWeakArea(weakAreaId, action);
      await fetchWeakAreas();
    } catch (error) {
      console.error('Error resetting weak area:', error);
    }
  };

  // ==================== END WEAK AREAS FUNCTIONS ====================

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
        alert(`PDF uploaded successfully! Document type: ${data.analysis.document_type}`);
        await fetchUploadedDocuments();
        setShowUploadModal(false);
      } else {
        alert('Failed to upload PDF');
      }
    } catch (error) {
            alert('Error uploading PDF');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateFromPDF = async () => {
    // Check if we have multiple PDFs selected
    if (selectedPDFs.length > 0) {
      await handleGenerateFromMultiplePDFs();
      return;
    }
    
    if (!selectedDocument) {
      alert('Please select a PDF document');
      return;
    }

    try {
      setLoading(true);
      console.log('🚀 Calling Question Bank Agent - Generate from PDF:', { userId, selectedDocument, questionCount, difficultyCount });
      
      const response = await questionBankAgentService.generateFromPDF({
        userId,
        sourceId: selectedDocument,
        questionCount: questionCount || 10,
        difficultyMix: difficultyCount,
        sessionId: `qb_pdf_${userId}_${Date.now()}`
      });

      console.log('✅ Agent response:', response);
      
      if (response.success) {
        alert(`Successfully generated ${response.questions?.length || questionCount} questions!`);
        setShowUploadModal(false);
        setSelectedDocument(null);
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

  const handleGenerateFromMultiplePDFs = async () => {
    if (selectedPDFs.length === 0) {
      alert('Please select at least one PDF document');
      return;
    }

    try {
      setLoading(true);
      
      // Check if using smart generation (custom prompt or reference doc)
      const useSmartGeneration = customPrompt.trim() || referenceDocId;
      
      if (useSmartGeneration) {
        console.log('🧠 Smart generation:', { userId, selectedPDFs, customPrompt, referenceDocId, difficultyCount });
        
        const response = await questionBankAgentService.smartGenerate({
          userId,
          sourceIds: selectedPDFs.map(p => p.id),
          questionCount: questionCount || 10,
          difficultyMix: difficultyCount,
          title: selectedPDFs.length === 1 
            ? `Questions from ${selectedPDFs[0].filename}`
            : `Smart Questions from ${selectedPDFs.length} documents`,
          questionTypes,
          customPrompt: customPrompt.trim() || null,
          referenceDocumentId: referenceDocId,
          contentDocumentIds: selectedPDFs.filter(p => p.id !== referenceDocId).map(p => p.id)
        });

        console.log('✅ Smart Response:', response);
        
        if (response.status === 'success') {
          alert(`Successfully generated ${response.question_count} questions using smart generation!`);
          resetSelections();
          await fetchQuestionSets();
          setActiveView('question-sets');
        } else {
          alert('Failed to generate questions: ' + (response.error || 'Unknown error'));
        }
      } else {
        console.log('🚀 Standard generation:', { userId, selectedPDFs, questionCount, difficultyCount });
        
        const response = await questionBankAgentService.generateFromMultiplePDFs({
          userId,
          sourceIds: selectedPDFs.map(p => p.id),
          questionCount: questionCount || 10,
          difficultyMix: difficultyCount,
          title: selectedPDFs.length === 1 
            ? `Questions from ${selectedPDFs[0].filename}`
            : `Questions from ${selectedPDFs.length} documents`,
          questionTypes
        });

        console.log('✅ Response:', response);
        
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
    setShowSmartOptions(false);
  };

  const toggleReferenceDoc = (docId) => {
    if (referenceDocId === docId) {
      setReferenceDocId(null);
    } else {
      setReferenceDocId(docId);
    }
  };

  const togglePDFSelection = (doc) => {
    const isSelected = selectedPDFs.some(p => p.id === doc.id);
    if (isSelected) {
      setSelectedPDFs(selectedPDFs.filter(p => p.id !== doc.id));
    } else {
      setSelectedPDFs([...selectedPDFs, doc]);
    }
    // Clear single selection when using multi-select
    setSelectedDocument(null);
  };

  const handleDeleteDocument = async (docId, e) => {
    e.stopPropagation(); // Prevent card selection
    
    if (!window.confirm('Are you sure you want to delete this PDF? This cannot be undone.')) {
      return;
    }

    try {
      setLoading(true);
      await questionBankAgentService.deleteDocument(userId, docId);
      
      // Remove from selected PDFs if it was selected
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
    setShowSmartOptions(false);
  };

  const handleGenerateFromChatSlides = async () => {
    if (selectedSources.length === 0) {
      alert('Please select at least one source');
      return;
    }

    try {
      setLoading(true);
      console.log('🚀 Calling Question Bank Agent - Generate from sources:', { userId, selectedSources, questionCount, difficultyCount });
      
      const response = await questionBankAgentService.generateFromSources({
        userId,
        sources: selectedSources,
        questionCount: questionCount || 10,
        difficultyMix: difficultyCount,
        sessionId: `qb_sources_${userId}_${Date.now()}`
      });

      console.log('✅ Agent response:', response);
      
      if (response.success) {
        alert(`Successfully generated questions from ${selectedSources.length} sources!`);
        setShowGenerateModal(false);
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

    try {
      setLoading(true);
      console.log('🚀 Calling Question Bank Agent - Generate from custom content:', { userId, contentLength: customContent.length, difficultyCount });
      
      const response = await questionBankAgentService.generateFromCustom({
        userId,
        content: customContent,
        title: customTitle || 'Custom Question Set',
        questionCount: questionCount || 10,
        difficultyMix: difficultyCount,
        sessionId: `qb_custom_${userId}_${Date.now()}`
      });

      console.log('✅ Agent response:', response);
      console.log('✅ Response success:', response.success);
      console.log('✅ Questions count:', response.questions?.length);
      console.log('✅ Full response:', JSON.stringify(response, null, 2));
      
      if (response.success) {
        alert(`Successfully generated ${response.questions?.length || response.question_count || questionCount} questions!`);
        setShowCustomModal(false);
        setCustomContent('');
        setCustomTitle('');
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

  const startStudySession = async (setId) => {
    try {
      setLoading(true);
      console.log('📚 Starting study session for set:', setId);
      const response = await fetch(`${API_URL}/qb/get_question_set/${setId}?user_id=${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      console.log('📚 Response status:', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('📚 Question set data:', data);
        console.log('📚 Questions array:', data.questions);
        console.log('📚 Questions count:', data.questions?.length);
        if (data.questions && data.questions.length > 0) {
          console.log('📚 First question:', JSON.stringify(data.questions[0], null, 2));
          console.log('📚 First question options:', data.questions[0].options);
          console.log('📚 First question options type:', typeof data.questions[0].options);
          console.log('📚 First question options isArray:', Array.isArray(data.questions[0].options));
        } else {
          console.log('📚 No questions in response!');
        }
        setSelectedQuestionSet(data);
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

  const handleAnswerChange = (questionId, answer) => {
    setUserAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const submitAnswers = async () => {
    const timeTaken = Math.floor((Date.now() - sessionStartTime) / 1000);

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
          answers: userAnswers,
          time_taken_seconds: timeTaken
        })
      });

      if (response.ok) {
        const data = await response.json();
        setResults(data);
        setShowResults(true);
        await fetchQuestionSets();
        if (activeView === 'analytics') {
          await fetchAnalytics();
        }
      }
    } catch (error) {
            alert('Error submitting answers');
    } finally {
      setLoading(false);
    }
  };

  const deleteQuestionSet = async (setId) => {
    if (!window.confirm('Are you sure you want to delete this question set?')) return;

    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/qb/delete_question_set/${setId}?user_id=${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        await fetchQuestionSets();
      }
    } catch (error) {
            alert('Error deleting question set');
    } finally {
      setLoading(false);
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
      
      // Get the blob from response
      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // Get filename from Content-Disposition header or use default
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

  const toggleSourceSelection = (type, id, title) => {
    const sourceKey = `${type}-${id}`;
    const exists = selectedSources.find(s => `${s.type}-${s.id}` === sourceKey);
    
    if (exists) {
      setSelectedSources(selectedSources.filter(s => `${s.type}-${s.id}` !== sourceKey));
    } else {
      setSelectedSources([...selectedSources, { type, id, title }]);
    }
  };

  const generateSimilarQuestion = async (questionId) => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/qb/generate_similar_question`, {
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
  const handleEnhancePrompt = async () => {
    if (!customPrompt.trim()) return;
    
    try {
      setIsEnhancingPrompt(true);
      const contentSummary = selectedPDFs.length > 0 
        ? `Documents: ${selectedPDFs.map(p => p.filename).join(', ')}`
        : '';
      
      const result = await questionBankAgentService.enhancePrompt(customPrompt, contentSummary);
      
      if (result.enhanced) {
        setEnhancedPrompt(result.enhanced.enhanced_prompt);
        setCustomPrompt(result.enhanced.enhanced_prompt);
        
        // Apply suggested settings if available
        if (result.enhanced.suggested_difficulty_distribution) {
          setDifficultyMix(result.enhanced.suggested_difficulty_distribution);
        }
      }
    } catch (error) {
      console.error('Prompt enhancement error:', error);
    } finally {
      setIsEnhancingPrompt(false);
    }
  };

  // Extract topics from selected documents
  const handleExtractTopics = async () => {
    if (selectedPDFs.length === 0) return;
    
    try {
      setLoading(true);
      const result = await questionBankAgentService.extractTopics(
        userId, 
        selectedPDFs[0].id
      );
      
      if (result.topics) {
        setExtractedTopics(result.topics);
        setShowTopicsPanel(true);
      }
    } catch (error) {
      console.error('Topic extraction error:', error);
      alert('Failed to extract topics');
    } finally {
      setLoading(false);
    }
  };

  // Preview generate questions
  const handlePreviewGenerate = async () => {
    if (selectedPDFs.length === 0) {
      alert('Please select at least one PDF');
      return;
    }

    try {
      setLoading(true);
      
      const result = await questionBankAgentService.previewGenerate({
        userId,
        sourceIds: selectedPDFs.map(p => p.id),
        questionCount: questionCount || 10,
        difficultyMix: difficultyCount,
        questionTypes,
        topics: selectedTopics.length > 0 ? selectedTopics : null,
        customPrompt: customPrompt.trim() || null
      });

      if (result.status === 'success') {
        setPreviewQuestions(result.questions);
        setPreviewStats(result.stats);
        setShowPreviewModal(true);
      }
    } catch (error) {
      console.error('Preview generation error:', error);
      alert('Failed to generate preview: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

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

  // Analyze weaknesses
  const handleAnalyzeWeaknesses = async () => {
    try {
      setLoading(true);
      const result = await questionBankAgentService.analyzeWeaknesses(userId);
      
      if (result.analysis) {
        setWeaknessAnalysis(result.analysis);
        setShowWeaknessPanel(true);
      } else {
        alert('No performance data available yet. Complete some question sets first!');
      }
    } catch (error) {
      console.error('Weakness analysis error:', error);
      alert('Failed to analyze weaknesses');
    } finally {
      setLoading(false);
    }
  };

  // Generate adaptive questions
  const handleGenerateAdaptive = async () => {
    if (selectedPDFs.length === 0) {
      alert('Please select at least one PDF');
      return;
    }

    try {
      setLoading(true);
      
      const result = await questionBankAgentService.generateAdaptive(
        userId,
        selectedPDFs.map(p => p.id),
        questionCount || 10
      );

      if (result.status === 'success') {
        setPreviewQuestions(result.questions);
        setWeaknessAnalysis(result.weakness_analysis);
        setPreviewStats({
          total: result.questions.length,
          average_quality_score: 7,
          adaptive: true
        });
        setShowPreviewModal(true);
      }
    } catch (error) {
      console.error('Adaptive generation error:', error);
      alert('Failed to generate adaptive questions: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Toggle set selection for batch operations
  const toggleSetSelection = (setId) => {
    if (selectedSets.includes(setId)) {
      setSelectedSets(selectedSets.filter(id => id !== setId));
    } else {
      setSelectedSets([...selectedSets, setId]);
    }
  };

  // Batch delete
  const handleBatchDelete = async () => {
    if (selectedSets.length === 0) return;
    
    if (!window.confirm(`Delete ${selectedSets.length} question set(s)? This cannot be undone.`)) {
      return;
    }

    try {
      setLoading(true);
      const result = await questionBankAgentService.batchDelete(userId, selectedSets);
      
      if (result.status === 'success') {
        alert(`Deleted ${result.deleted_count} question set(s)`);
        setSelectedSets([]);
        await fetchQuestionSets();
      }
    } catch (error) {
      console.error('Batch delete error:', error);
      alert('Failed to delete: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Merge sets
  const handleMergeSets = async () => {
    if (selectedSets.length < 2) {
      alert('Select at least 2 question sets to merge');
      return;
    }

    if (!mergeTitle.trim()) {
      alert('Please enter a title for the merged set');
      return;
    }

    try {
      setLoading(true);
      const result = await questionBankAgentService.mergeSets(
        userId,
        selectedSets,
        mergeTitle,
        deleteOriginals
      );

      if (result.status === 'success') {
        alert(`Merged ${result.source_sets.length} sets into "${mergeTitle}" (${result.total_questions} questions)`);
        setShowMergeModal(false);
        setSelectedSets([]);
        setMergeTitle('');
        setDeleteOriginals(false);
        await fetchQuestionSets();
      }
    } catch (error) {
      console.error('Merge error:', error);
      alert('Failed to merge: ' + error.message);
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

  const renderSidebar = () => (
    <div className="qbd-sidebar">
      <nav className="qbd-sidebar-nav">
        <button 
          className={`qbd-sidebar-item ${activeView === 'upload-pdf' ? 'active' : ''}`}
          onClick={() => setActiveView('upload-pdf')}
        >
          <Upload size={20} />
          <span className="qbd-nav-text">PDF Sources</span>
        </button>

        <button 
          className={`qbd-sidebar-item ${activeView === 'chat-slides' ? 'active' : ''}`}
          onClick={() => setActiveView('chat-slides')}
        >
          <MessageSquare size={20} />
          <span className="qbd-nav-text">AI Chat & Slides</span>
        </button>

        <button 
          className={`qbd-sidebar-item ${activeView === 'custom' ? 'active' : ''}`}
          onClick={() => setActiveView('custom')}
        >
          <Sparkles size={20} />
          <span className="qbd-nav-text">Generate Custom</span>
        </button>

        <button 
          className={`qbd-sidebar-item ${activeView === 'question-sets' ? 'active' : ''}`}
          onClick={() => setActiveView('question-sets')}
        >
          <FileText size={20} />
          <span className="qbd-nav-text">All Question Sets</span>
        </button>

        <button 
          className={`qbd-sidebar-item ${activeView === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveView('analytics')}
        >
          <BarChart3 size={20} />
          <span className="qbd-nav-text">Analytics</span>
        </button>

        <button 
          className={`qbd-sidebar-item ${activeView === 'weak-areas' ? 'active' : ''}`}
          onClick={() => setActiveView('weak-areas')}
        >
          <AlertTriangle size={20} />
          <span className="qbd-nav-text">Weak Areas</span>
        </button>
        
        <button 
          className="qbd-sidebar-item qbd-convert-btn"
          onClick={() => setShowImportExport(true)}
        >
          <Zap size={20} />
          <span className="qbd-nav-text">Convert</span>
        </button>
      </nav>

      <div className="qbd-sidebar-footer">
        <button className="qbd-sidebar-item" onClick={() => navigate('/dashboard')}>
          <ChevronLeft size={20} />
          <span className="qbd-nav-text">Dashboard</span>
        </button>
        <button className="qbd-sidebar-item" onClick={() => navigate('/ai-chat')}>
          <MessageSquare size={20} />
          <span className="qbd-nav-text">AI Chat</span>
        </button>
      </div>
    </div>
  );

  const renderUploadPDF = () => (
    <div className="qbd-view">
      <div className="qbd-view-header">
        <div className="qbd-view-title-group">
          <Upload className="qbd-view-icon" size={32} />
          <div>
            <h2 className="qbd-view-title">PDF Sources</h2>
            <p className="qbd-view-subtitle">Upload PDFs and select multiple sources to generate questions</p>
          </div>
        </div>
      </div>

      <div className="qbd-content-grid">
        <div className="qbd-upload-section">
          <div className="qbd-upload-box">
            <FileUp size={48} />
            <h3>Add PDF Source</h3>
            <p>Upload PDFs to use as sources for question generation</p>
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
              id="pdf-upload-input"
            />
            <label htmlFor="pdf-upload-input" className="qbd-btn-primary">
              {loading ? <Loader className="qbd-spin" size={18} /> : <Upload size={18} />}
              <span>{loading ? 'Uploading...' : 'Add PDF'}</span>
            </label>
          </div>
        </div>

        {uploadedDocuments.length > 0 && (
          <div className="qbd-documents-section">
            <div className="qbd-section-header-row">
              <h3 className="qbd-section-title">
                <BookOpen size={20} />
                Your Sources ({uploadedDocuments.length})
              </h3>
              {selectedPDFs.length > 0 && (
                <div className="qbd-selection-info">
                  <span className="qbd-selection-count">{selectedPDFs.length} selected</span>
                  <button className="qbd-btn-text" onClick={clearPDFSelection}>Clear</button>
                </div>
              )}
            </div>
            
            <p className="qbd-section-hint">Click to select multiple PDFs as sources for question generation</p>
            
            <div className="qbd-documents-grid">
              {uploadedDocuments.map(doc => {
                const isSelected = selectedPDFs.some(p => p.id === doc.id);
                return (
                  <div 
                    key={doc.id} 
                    className={`qbd-document-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => togglePDFSelection(doc)}
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
                        <p>{doc.document_type}</p>
                      </div>
                    </div>
                    {doc.analysis && (
                      <div className="qbd-document-topics">
                        {doc.analysis.main_topics?.slice(0, 3).map((topic, idx) => (
                          <span key={idx} className="qbd-topic-tag">{topic}</span>
                        ))}
                      </div>
                    )}
                    <div className="qbd-document-footer">
                      <span className="qbd-document-date">
                        {new Date(doc.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Selected Sources Summary with Smart Options */}
            {selectedPDFs.length > 0 && (
              <div className="qbd-selected-sources-panel">
                <div className="qbd-panel-header">
                  <h4>Selected Sources ({selectedPDFs.length})</h4>
                  {selectedPDFs.length >= 2 && (
                    <button 
                      className={`qbd-smart-toggle ${showSmartOptions ? 'active' : ''}`}
                      onClick={() => setShowSmartOptions(!showSmartOptions)}
                    >
                      <Brain size={16} />
                      <span>Smart Mode</span>
                    </button>
                  )}
                </div>
                
                <div className="qbd-selected-sources-list">
                  {selectedPDFs.map(pdf => (
                    <div key={pdf.id} className={`qbd-selected-source-item ${referenceDocId === pdf.id ? 'reference' : ''}`}>
                      <FileText size={16} />
                      <span className="qbd-source-name">{pdf.filename}</span>
                      {showSmartOptions && (
                        <button 
                          className={`qbd-ref-toggle ${referenceDocId === pdf.id ? 'active' : ''}`}
                          onClick={() => toggleReferenceDoc(pdf.id)}
                          title={referenceDocId === pdf.id ? 'Remove as reference' : 'Set as reference (sample questions)'}
                        >
                          {referenceDocId === pdf.id ? '📋 Reference' : 'Set as Reference'}
                        </button>
                      )}
                      <button 
                        className="qbd-remove-source-btn"
                        onClick={() => togglePDFSelection(pdf)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>

                {showSmartOptions && (
                  <div className="qbd-smart-hint">
                    <Sparkles size={14} />
                    <span>
                      {referenceDocId 
                        ? "Reference doc will be used as style guide. Other docs are content sources."
                        : "Tip: Mark one PDF as 'Reference' (e.g., sample questions) to match its style"}
                    </span>
                  </div>
                )}
              </div>
            )}

            {selectedPDFs.length > 0 && (
              <div className="qbd-generation-settings">
                <h3 className="qbd-section-title">Generation Settings</h3>

                {/* Custom Prompt Section */}
                <div className="qbd-setting-group qbd-prompt-section">
                  <label>
                    <Sparkles size={16} />
                    Custom Instructions (Optional)
                  </label>
                  <textarea
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="e.g., 'Generate questions similar to the sample questions from my textbook' or 'Focus on practical applications and real-world scenarios' or 'Create exam-style questions covering chapters 3-5'"
                    className="qbd-textarea qbd-prompt-input"
                    rows={3}
                  />
                  <div className="qbd-prompt-examples">
                    <span className="qbd-examples-label">Quick prompts:</span>
                    <button onClick={() => setCustomPrompt('Generate questions similar to the sample questions style from my textbook content')}>
                      Match sample style
                    </button>
                    <button onClick={() => setCustomPrompt('Focus on practical applications and real-world scenarios')}>
                      Practical focus
                    </button>
                    <button onClick={() => setCustomPrompt('Create exam-style questions with detailed explanations')}>
                      Exam style
                    </button>
                  </div>
                </div>
                
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
                    <div className="qbd-slider-item">
                      <span>Easy: {difficultyCount.easy} ({difficultyMix.easy}%)</span>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={difficultyMix.easy}
                        onChange={(e) => handleDifficultyChange('easy', e.target.value)}
                      />
                    </div>
                    <div className="qbd-slider-item">
                      <span>Medium: {difficultyCount.medium} ({difficultyMix.medium}%)</span>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={difficultyMix.medium}
                        onChange={(e) => handleDifficultyChange('medium', e.target.value)}
                      />
                    </div>
                    <div className="qbd-slider-item">
                      <span>Hard: {difficultyCount.hard} ({difficultyMix.hard}%)</span>
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

                {/* AI Feature Buttons */}
                <div className="qbd-ai-actions">
                  <button 
                    className="qbd-btn-secondary qbd-ai-btn"
                    onClick={handleExtractTopics}
                    disabled={loading || selectedPDFs.length === 0}
                    title="Extract topics from documents"
                  >
                    <List size={16} />
                    <span>Extract Topics</span>
                  </button>
                  
                  <button 
                    className="qbd-btn-secondary qbd-ai-btn"
                    onClick={handlePreviewGenerate}
                    disabled={loading || selectedPDFs.length === 0}
                    title="Preview questions before saving"
                  >
                    <Eye size={16} />
                    <span>Preview & Edit</span>
                  </button>
                  
                  <button 
                    className="qbd-btn-secondary qbd-ai-btn qbd-adaptive-btn"
                    onClick={handleGenerateAdaptive}
                    disabled={loading || selectedPDFs.length === 0}
                    title="Generate questions targeting your weak areas"
                  >
                    <Target size={16} />
                    <span>Adaptive</span>
                  </button>
                </div>

                {/* Topics Panel */}
                {showTopicsPanel && extractedTopics && (
                  <div className="qbd-topics-panel">
                    <div className="qbd-topics-header">
                      <h4><List size={16} /> Select Topics to Focus On</h4>
                      <button onClick={() => setShowTopicsPanel(false)}><X size={16} /></button>
                    </div>
                    <div className="qbd-topics-list">
                      {extractedTopics.chapters?.map((chapter, idx) => (
                        <div key={idx} className="qbd-chapter-group">
                          <h5>{chapter.name}</h5>
                          <div className="qbd-topic-chips">
                            {chapter.topics?.map((topic, tidx) => (
                              <button
                                key={tidx}
                                className={`qbd-topic-chip ${selectedTopics.includes(topic.name) ? 'selected' : ''}`}
                                onClick={() => {
                                  if (selectedTopics.includes(topic.name)) {
                                    setSelectedTopics(selectedTopics.filter(t => t !== topic.name));
                                  } else {
                                    setSelectedTopics([...selectedTopics, topic.name]);
                                  }
                                }}
                              >
                                {topic.name}
                                <span className="qbd-topic-potential">{topic.question_potential}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    {selectedTopics.length > 0 && (
                      <div className="qbd-selected-topics">
                        <span>Selected: {selectedTopics.length} topics</span>
                        <button onClick={() => setSelectedTopics([])}>Clear</button>
                      </div>
                    )}
                  </div>
                )}

                <button 
                  className={`qbd-btn-primary qbd-btn-large ${(customPrompt.trim() || referenceDocId) ? 'qbd-smart-btn' : ''}`}
                  onClick={handleGenerateFromMultiplePDFs}
                  disabled={loading}
                >
                  {loading ? <Loader className="qbd-spin" size={18} /> : (customPrompt.trim() || referenceDocId) ? <Brain size={18} /> : <Sparkles size={18} />}
                  <span>
                    {loading 
                      ? 'Generating...' 
                      : (customPrompt.trim() || referenceDocId)
                        ? `Smart Generate from ${selectedPDFs.length} Source${selectedPDFs.length > 1 ? 's' : ''}`
                        : `Generate from ${selectedPDFs.length} Source${selectedPDFs.length > 1 ? 's' : ''}`
                    }
                  </span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const renderChatSlides = () => (
    <div className="qbd-view">
      <div className="qbd-view-header">
        <div className="qbd-view-title-group">
          <MessageSquare className="qbd-view-icon" size={32} />
          <div>
            <h2 className="qbd-view-title">AI Chat & Slides</h2>
            <p className="qbd-view-subtitle">Generate questions from your AI conversations and slide presentations</p>
          </div>
        </div>
      </div>

      <div className="qbd-content-sections">
        <div className="qbd-source-section">
          <h3 className="qbd-section-title">
            <MessageSquare size={20} />
            AI Chat Sessions ({chatSessions.length})
          </h3>
          <div className="qbd-source-grid">
            {chatSessions.map(chat => {
              const isSelected = selectedSources.some(s => s.type === 'chat' && s.id === chat.id);
              return (
                <div 
                  key={chat.id}
                  className={`qbd-source-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => toggleSourceSelection('chat', chat.id, chat.title)}
                >
                  <div className="qbd-source-check">
                    {isSelected && <CheckCircle size={20} />}
                  </div>
                  <MessageSquare size={24} />
                  <h4>{chat.title}</h4>
                  <p>{new Date(chat.created_at).toLocaleDateString()}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="qbd-source-section">
          <h3 className="qbd-section-title">
            <FileText size={20} />
            Uploaded Slides ({uploadedSlides.length})
          </h3>
          <div className="qbd-source-grid">
            {uploadedSlides.map(slide => {
              const isSelected = selectedSources.some(s => s.type === 'slide' && s.id === slide.id);
              return (
                <div 
                  key={slide.id}
                  className={`qbd-source-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => toggleSourceSelection('slide', slide.id, slide.title)}
                >
                  <div className="qbd-source-check">
                    {isSelected && <CheckCircle size={20} />}
                  </div>
                  <FileText size={24} />
                  <h4>{slide.title}</h4>
                  <p>{new Date(slide.created_at).toLocaleDateString()}</p>
                </div>
              );
            })}
          </div>
        </div>

        {selectedSources.length > 0 && (
          <div className="qbd-generation-settings">
            <h3 className="qbd-section-title">
              Selected Sources ({selectedSources.length})
            </h3>
            <div className="qbd-selected-sources">
              {selectedSources.map((source, idx) => (
                <span key={idx} className="qbd-selected-tag">
                  {source.title}
                  <button onClick={() => toggleSourceSelection(source.type, source.id, source.title)}>×</button>
                </span>
              ))}
            </div>

            <div className="qbd-setting-group">
              <label>Total Questions</label>
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
                <div className="qbd-slider-item">
                  <span>Easy: {difficultyCount.easy} ({difficultyMix.easy}%)</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={difficultyMix.easy}
                    onChange={(e) => handleDifficultyChange('easy', e.target.value)}
                  />
                </div>
                <div className="qbd-slider-item">
                  <span>Medium: {difficultyCount.medium} ({difficultyMix.medium}%)</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={difficultyMix.medium}
                    onChange={(e) => handleDifficultyChange('medium', e.target.value)}
                  />
                </div>
                <div className="qbd-slider-item">
                  <span>Hard: {difficultyCount.hard} ({difficultyMix.hard}%)</span>
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
            </div>

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
    <div className="qbd-view">
      <div className="qbd-view-header">
        <div className="qbd-view-title-group">
          <Sparkles className="qbd-view-icon" size={32} />
          <div>
            <h2 className="qbd-view-title">Generate Custom Questions</h2>
            <p className="qbd-view-subtitle">Enter any content and let AI create practice questions</p>
          </div>
        </div>
      </div>

      <div className="qbd-custom-container">
        <div className="qbd-setting-group">
          <label>Question Set Title</label>
          <input
            type="text"
            value={customTitle}
            onChange={(e) => setCustomTitle(e.target.value)}
            placeholder="e.g., Physics Chapter 5 Review"
            className="qbd-input"
          />
        </div>

        <div className="qbd-setting-group">
          <label>Content (paste notes, articles, or any study material)</label>
          <textarea
            value={customContent}
            onChange={(e) => setCustomContent(e.target.value)}
            placeholder="Paste your content here..."
            className="qbd-textarea-large"
            rows={12}
          />
        </div>

        <div className="qbd-settings-row">
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
        </div>

        <div className="qbd-setting-group">
          <label>Difficulty Mix</label>
          <div className="qbd-difficulty-sliders">
            <div className="qbd-slider-item">
              <span>Easy: {difficultyCount.easy} ({difficultyMix.easy}%)</span>
              <input
                type="range"
                min="0"
                max="100"
                value={difficultyMix.easy}
                onChange={(e) => handleDifficultyChange('easy', e.target.value)}
              />
            </div>
            <div className="qbd-slider-item">
              <span>Medium: {difficultyCount.medium} ({difficultyMix.medium}%)</span>
              <input
                type="range"
                min="0"
                max="100"
                value={difficultyMix.medium}
                onChange={(e) => handleDifficultyChange('medium', e.target.value)}
              />
            </div>
            <div className="qbd-slider-item">
              <span>Hard: {difficultyCount.hard} ({difficultyMix.hard}%)</span>
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

        <button 
          className="qbd-btn-primary qbd-btn-large"
          onClick={handleGenerateCustom}
          disabled={loading || !customContent.trim()}
        >
          {loading ? <Loader className="qbd-spin" size={18} /> : <Sparkles size={18} />}
          <span>{loading ? 'Generating...' : 'Generate Questions'}</span>
        </button>
      </div>
    </div>
  );

  const renderQuestionSets = () => {
    console.log('🎨 Rendering question sets view, questionSets:', questionSets, 'loading:', loading);
    return (
    <div className="qbd-view">
      {/* Batch Selection Header */}
      {questionSets.length > 0 && (
        <div className="qbd-sets-header">
          <div className="qbd-sets-title">
            <h2>Your Question Sets ({questionSets.length})</h2>
          </div>
          <div className="qbd-sets-actions">
            <button 
              className="qbd-btn-secondary qbd-btn-small"
              onClick={() => {
                if (selectedSets.length === questionSets.length) {
                  setSelectedSets([]);
                } else {
                  setSelectedSets(questionSets.map(s => s.id));
                }
              }}
            >
              {selectedSets.length === questionSets.length ? 'Deselect All' : 'Select All'}
            </button>
            <button 
              className="qbd-btn-secondary qbd-btn-small"
              onClick={handleAnalyzeWeaknesses}
              disabled={loading}
            >
              <Target size={14} />
              <span>Analyze Weaknesses</span>
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="qbd-loading">
          <Loader className="qbd-spin" size={48} />
          <p>Loading question sets...</p>
        </div>
      ) : questionSets.length === 0 ? (
        <div className="qbd-empty-state">
          <FileText size={64} />
          <h3>No Question Sets Yet</h3>
          <p>Generate your first question set to get started</p>
          <button className="qbd-btn-primary" onClick={() => setActiveView('upload-pdf')}>
            <Plus size={18} />
            Create Question Set
          </button>
        </div>
      ) : (
        <div className="qbd-sets-grid">
          {questionSets.map(set => {
            const isSelected = selectedSets.includes(set.id);
            return (
              <div 
                key={set.id} 
                className={`qbd-set-card ${isSelected ? 'selected' : ''}`}
                onClick={() => startStudySession(set.id)}
              >
                {/* Cover Area with Icon */}
                <div className="qbd-set-card-cover">
                  <div className="qbd-set-cover-icon">
                    <Brain size={80} />
                  </div>
                  <button 
                    className="qbd-set-delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteQuestionSet(set.id);
                    }}
                    title="Delete question set"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {/* Content Section */}
                <div className="qbd-set-content">
                  <h3>{set.title || 'Untitled Quiz'}</h3>
                  <p>{set.description || 'No description'}</p>
                  
                  <div className="qbd-set-meta">
                    <span className="qbd-source-badge">{set.source_type}</span>
                    <span className="qbd-date-badge">
                      {new Date(set.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="qbd-set-stats">
                    <div className="qbd-stat-item">
                      <FileText size={14} />
                      <span>{set.total_questions} questions</span>
                    </div>
                    <div className="qbd-stat-item">
                      <Target size={14} />
                      <span>Best: {set.best_score}%</span>
                    </div>
                    <div className="qbd-stat-item">
                      <TrendingUp size={14} />
                      <span>{set.attempts} attempts</span>
                    </div>
                  </div>

                  <div className="qbd-set-actions">
                    <button 
                      className="qbd-set-study-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        startStudySession(set.id);
                      }}
                    >
                      <Play size={16} />
                      <span>Study</span>
                    </button>
                    <button 
                      className="qbd-set-export"
                      onClick={(e) => {
                        e.stopPropagation();
                        openExportModal(set.id);
                      }}
                      disabled={exportingPdf === set.id}
                    >
                      {exportingPdf === set.id ? (
                        <Loader className="qbd-spin" size={16} />
                      ) : (
                        <Download size={16} />
                      )}
                      <span>Export</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
  };

  const renderAnalytics = () => (
    <div className="qbd-view">
      <div className="qbd-view-header">
        <div className="qbd-view-title-group">
          <BarChart3 className="qbd-view-icon" size={32} />
          <div>
            <h2 className="qbd-view-title">Performance Analytics</h2>
            <p className="qbd-view-subtitle">Track your progress and identify areas for improvement</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="qbd-loading">
          <Loader className="qbd-spin" size={48} />
          <p>Loading analytics...</p>
        </div>
      ) : !analytics ? (
        <div className="qbd-empty-state">
          <PieChart size={64} />
          <h3>No Data Yet</h3>
          <p>Complete some question sets to see your analytics</p>
        </div>
      ) : (
        <div className="qbd-analytics-grid">
          <div className="qbd-stats-overview">
            <div className="qbd-stat-box">
              <div className="qbd-stat-icon success">
                <Award size={24} />
              </div>
              <div className="qbd-stat-data">
                <span className="qbd-stat-value">{analytics.total_sessions}</span>
                <span className="qbd-stat-label">Total Sessions</span>
              </div>
            </div>

            <div className="qbd-stat-box">
              <div className="qbd-stat-icon primary">
                <Target size={24} />
              </div>
              <div className="qbd-stat-data">
                <span className="qbd-stat-value">{analytics.average_score}%</span>
                <span className="qbd-stat-label">Average Score</span>
              </div>
            </div>

            <div className="qbd-stat-box">
              <div className="qbd-stat-icon accent">
                <Brain size={24} />
              </div>
              <div className="qbd-stat-data">
                <span className="qbd-stat-value">{analytics.total_questions_answered}</span>
                <span className="qbd-stat-label">Questions Answered</span>
              </div>
            </div>

            <div className="qbd-stat-box">
              <div className="qbd-stat-icon warning">
                <TrendingUp size={24} />
              </div>
              <div className="qbd-stat-data">
                <span className="qbd-stat-value">{analytics.recent_scores[0] || 0}%</span>
                <span className="qbd-stat-label">Latest Score</span>
              </div>
            </div>
          </div>

          {analytics.adaptive_recommendation && (
            <div className="qbd-adaptive-box">
              <div className="qbd-adaptive-header">
                <Zap size={24} />
                <h3>AI Recommendation</h3>
              </div>
              <div className="qbd-adaptive-content">
                <p className="qbd-adaptive-rec">
                  Recommended Difficulty: <strong>{analytics.adaptive_recommendation.recommended_difficulty}</strong>
                </p>
                <p className="qbd-adaptive-reason">{analytics.adaptive_recommendation.reason}</p>
                <div className="qbd-adaptive-dist">
                  <span>Suggested Mix:</span>
                  <span>Easy: {analytics.adaptive_recommendation.suggested_distribution.easy}</span>
                  <span>Medium: {analytics.adaptive_recommendation.suggested_distribution.medium}</span>
                  <span>Hard: {analytics.adaptive_recommendation.suggested_distribution.hard}</span>
                </div>
              </div>
            </div>
          )}

          <div className="qbd-performance-section">
            <h3 className="qbd-section-title">
              <TrendingUp size={20} />
              Topic Performance
            </h3>
            <div className="qbd-performance-list">
              {analytics.topic_performance?.map((topic, idx) => (
                <div key={idx} className="qbd-performance-item">
                  <div className="qbd-performance-info">
                    <span className="qbd-performance-topic">{topic.topic}</span>
                    <span className="qbd-performance-stats">
                      {topic.correct_answers}/{topic.total_questions} correct
                    </span>
                  </div>
                  <div className="qbd-performance-bar">
                    <div 
                      className="qbd-performance-fill"
                      style={{ 
                        width: `${topic.accuracy}%`,
                        backgroundColor: topic.accuracy >= 80 ? 'var(--success)' : topic.accuracy >= 60 ? 'var(--warning)' : 'var(--danger)'
                      }}
                    />
                  </div>
                  <span className="qbd-performance-accuracy">{topic.accuracy}%</span>
                </div>
              ))}
            </div>
          </div>

          <div className="qbd-difficulty-section">
            <h3 className="qbd-section-title">
              <Target size={20} />
              Difficulty Breakdown
            </h3>
            <div className="qbd-difficulty-grid">
              {analytics.difficulty_performance?.map((diff, idx) => (
                <div key={idx} className="qbd-difficulty-card">
                  <div className={`qbd-difficulty-badge ${diff.difficulty}`}>
                    {diff.difficulty}
                  </div>
                  <div className="qbd-difficulty-stats">
                    <span className="qbd-difficulty-accuracy">{diff.accuracy}%</span>
                    <span className="qbd-difficulty-count">
                      {diff.correct_answers}/{diff.total_questions}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {analytics.weak_topics && analytics.weak_topics.length > 0 && (
            <div className="qbd-weak-topics">
              <h3 className="qbd-section-title">
                <Target size={20} />
                Focus Areas
              </h3>
              <div className="qbd-topics-list">
                {analytics.weak_topics.map((topic, idx) => (
                  <div key={idx} className="qbd-weak-topic-card">
                    <span className="qbd-weak-topic-name">{topic.topic}</span>
                    <span className="qbd-weak-topic-accuracy">{topic.accuracy}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderWeakAreas = () => (
    <div className="qbd-view">
      <div className="qbd-view-header">
        <div className="qbd-view-title-group">
          <AlertTriangle className="qbd-view-icon" size={32} />
          <div>
            <h2 className="qbd-view-title">Weak Areas & Practice</h2>
            <p className="qbd-view-subtitle">Track your struggles and generate targeted practice</p>
          </div>
        </div>
        <button 
          className="qbd-btn-primary"
          onClick={() => handleGeneratePractice(null)}
          disabled={generatingPractice || weakAreas.length === 0}
        >
          {generatingPractice ? <Loader className="qbd-spin" size={18} /> : <Zap size={18} />}
          <span>{generatingPractice ? 'Generating...' : 'Practice All Weak Areas'}</span>
        </button>
      </div>

      {loading ? (
        <div className="qbd-loading">
          <Loader className="qbd-spin" size={48} />
          <p>Loading weak areas...</p>
        </div>
      ) : weakAreas.length === 0 ? (
        <div className="qbd-empty-state">
          <CheckCircle size={64} />
          <h3>No Weak Areas Found!</h3>
          <p>Complete some question sets to identify areas that need practice</p>
        </div>
      ) : (
        <div className="qbd-weak-areas-content">
          {/* Recommendations Panel */}
          {practiceRecommendations && practiceRecommendations.recommendations?.length > 0 && (
            <div className="qbd-recommendations-panel">
              <h3 className="qbd-section-title">
                <Brain size={20} />
                AI Recommendations
              </h3>
              <div className="qbd-recommendations-list">
                {practiceRecommendations.recommendations.map((rec, idx) => (
                  <div key={idx} className={`qbd-recommendation-card ${rec.type}`}>
                    <div className="qbd-rec-header">
                      {rec.type === 'critical' && <AlertTriangle size={20} className="qbd-rec-icon critical" />}
                      {rec.type === 'declining' && <TrendingUp size={20} className="qbd-rec-icon declining" style={{transform: 'rotate(180deg)'}} />}
                      {rec.type === 'stale' && <Clock size={20} className="qbd-rec-icon stale" />}
                      {rec.type === 'review' && <Eye size={20} className="qbd-rec-icon review" />}
                      <h4>{rec.title}</h4>
                    </div>
                    <p className="qbd-rec-description">{rec.description}</p>
                    {rec.topics && (
                      <div className="qbd-rec-topics">
                        {rec.topics.slice(0, 3).map((topic, i) => (
                          <span key={i} className="qbd-topic-tag">{topic}</span>
                        ))}
                      </div>
                    )}
                    <button 
                      className="qbd-btn-secondary qbd-btn-sm"
                      onClick={() => rec.action === 'generate_practice' 
                        ? handleGeneratePractice(rec.topics?.[0]) 
                        : setSelectedWeakTopic(rec.topics?.[0])}
                    >
                      {rec.action === 'generate_practice' ? 'Practice Now' : 'Review'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Summary Stats */}
          <div className="qbd-weak-stats-row">
            <div className="qbd-stat-box">
              <div className="qbd-stat-icon warning">
                <AlertTriangle size={24} />
              </div>
              <div className="qbd-stat-data">
                <span className="qbd-stat-value">{weakAreas.length}</span>
                <span className="qbd-stat-label">Weak Topics</span>
              </div>
            </div>
            <div className="qbd-stat-box">
              <div className="qbd-stat-icon danger">
                <XCircle size={24} />
              </div>
              <div className="qbd-stat-data">
                <span className="qbd-stat-value">
                  {weakAreas.filter(wa => wa.priority >= 8).length}
                </span>
                <span className="qbd-stat-label">Critical</span>
              </div>
            </div>
            <div className="qbd-stat-box">
              <div className="qbd-stat-icon primary">
                <TrendingUp size={24} />
              </div>
              <div className="qbd-stat-data">
                <span className="qbd-stat-value">
                  {weakAreas.filter(wa => wa.status === 'improving').length}
                </span>
                <span className="qbd-stat-label">Improving</span>
              </div>
            </div>
            <div className="qbd-stat-box">
              <div className="qbd-stat-icon success">
                <Target size={24} />
              </div>
              <div className="qbd-stat-data">
                <span className="qbd-stat-value">
                  {practiceRecommendations?.summary?.unreviewed_mistakes || 0}
                </span>
                <span className="qbd-stat-label">To Review</span>
              </div>
            </div>
          </div>

          {/* Weak Areas List */}
          <div className="qbd-weak-areas-section">
            <h3 className="qbd-section-title">
              <Target size={20} />
              Topics Needing Practice
            </h3>
            <div className="qbd-weak-areas-list">
              {weakAreas.map((wa) => (
                <div 
                  key={wa.id} 
                  className={`qbd-weak-area-card ${wa.priority >= 8 ? 'critical' : wa.priority >= 5 ? 'medium' : 'low'}`}
                  onClick={() => {
                    setSelectedWeakTopic(wa.topic);
                    fetchWrongAnswers(wa.topic);
                  }}
                >
                  <div className="qbd-weak-area-header">
                    <div className="qbd-weak-area-info">
                      <h4 className="qbd-weak-area-topic">{wa.topic}</h4>
                      <div className="qbd-weak-area-meta">
                        <span className={`qbd-status-badge ${wa.status}`}>{wa.status.replace('_', ' ')}</span>
                        <span className="qbd-weak-area-stats">
                          {wa.correct_count}/{wa.total_questions} correct
                        </span>
                      </div>
                    </div>
                    <div className="qbd-weak-area-accuracy">
                      <span className={`qbd-accuracy-value ${wa.accuracy < 50 ? 'low' : wa.accuracy < 70 ? 'medium' : 'high'}`}>
                        {wa.accuracy.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                  
                  <div className="qbd-weak-area-bar">
                    <div 
                      className="qbd-weak-area-fill"
                      style={{ 
                        width: `${wa.accuracy}%`,
                        backgroundColor: wa.accuracy < 50 ? 'var(--danger)' : wa.accuracy < 70 ? 'var(--warning)' : 'var(--success)'
                      }}
                    />
                  </div>

                  <div className="qbd-weak-area-footer">
                    <div className="qbd-weak-area-details">
                      {wa.consecutive_wrong > 0 && (
                        <span className="qbd-streak-badge">
                          <XCircle size={14} /> {wa.consecutive_wrong} wrong streak
                        </span>
                      )}
                      {wa.practice_sessions > 0 && (
                        <span className="qbd-practice-badge">
                          <RefreshCw size={14} /> {wa.practice_sessions} practice sessions
                        </span>
                      )}
                    </div>
                    <div className="qbd-weak-area-actions">
                      <button 
                        className="qbd-btn-icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleGeneratePractice(wa.topic);
                        }}
                        title="Practice this topic"
                      >
                        <Play size={16} />
                      </button>
                      <button 
                        className="qbd-btn-icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleResetWeakArea(wa.id, 'mastered');
                        }}
                        title="Mark as mastered"
                      >
                        <CheckCircle size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Wrong Answers Review Panel */}
          {selectedWeakTopic && (
            <div className="qbd-wrong-answers-panel">
              <div className="qbd-panel-header">
                <h3>
                  <Eye size={20} />
                  Review Wrong Answers: {selectedWeakTopic}
                </h3>
                <button 
                  className="qbd-btn-text"
                  onClick={() => setSelectedWeakTopic(null)}
                >
                  <X size={18} /> Close
                </button>
              </div>
              
              {wrongAnswers.length === 0 ? (
                <p className="qbd-empty-text">No wrong answers to review for this topic</p>
              ) : (
                <div className="qbd-wrong-answers-list">
                  {wrongAnswers.map((wa) => (
                    <div key={wa.id} className={`qbd-wrong-answer-card ${wa.reviewed ? 'reviewed' : ''}`}>
                      <div className="qbd-wrong-answer-question">
                        <span className="qbd-difficulty-badge">{wa.difficulty}</span>
                        <p>{wa.question_text}</p>
                      </div>
                      <div className="qbd-wrong-answer-comparison">
                        <div className="qbd-answer-box wrong">
                          <span className="qbd-answer-label">Your Answer</span>
                          <span className="qbd-answer-text">{wa.user_answer}</span>
                        </div>
                        <div className="qbd-answer-box correct">
                          <span className="qbd-answer-label">Correct Answer</span>
                          <span className="qbd-answer-text">{wa.correct_answer}</span>
                        </div>
                      </div>
                      {!wa.reviewed && (
                        <div className="qbd-wrong-answer-actions">
                          <button 
                            className="qbd-btn-secondary qbd-btn-sm"
                            onClick={() => handleMarkReviewed(wa.id, true)}
                          >
                            <CheckCircle size={14} /> I understand now
                          </button>
                          <button 
                            className="qbd-btn-text qbd-btn-sm"
                            onClick={() => handleMarkReviewed(wa.id, false)}
                          >
                            Still confused
                          </button>
                        </div>
                      )}
                      {wa.reviewed && (
                        <div className="qbd-reviewed-badge">
                          <CheckCircle size={14} /> Reviewed
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderStudyModal = () => {
    if (!showStudyModal || !selectedQuestionSet) return null;

    // Guard against missing or empty questions
    const questions = selectedQuestionSet.questions || [];
    console.log('📚 renderStudyModal - questions:', questions);
    console.log('📚 renderStudyModal - questions length:', questions.length);

    if (questions.length === 0) {
      return (
        <div className="qbd-modal-overlay">
          <div className="qbd-modal" onClick={e => e.stopPropagation()}>
            <div className="qbd-modal-header">
              <h3>{selectedQuestionSet?.title || 'Quiz Session'}</h3>
              <button className="qbd-modal-close" onClick={() => setShowStudyModal(false)}>×</button>
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
        <div className="qbd-modal" onClick={e => e.stopPropagation()}>
          <div className="qbd-modal-header">
            <h3>{selectedQuestionSet?.title || 'Quiz Session'}</h3>
            <button className="qbd-modal-close" onClick={() => setShowStudyModal(false)}>×</button>
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

                    <p className="qbd-question-text">{q.question_text}</p>

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
                            <span>{option}</span>
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
                        <p className="qbd-result-question"><strong>Q{idx + 1}:</strong> {detail.question_text}</p>
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

  return (
    <div className="qbd-container">
      {/* Header - Full Width */}
      <header className="qbd-header">
        <div className="qbd-header-left">
          <div className="qbd-header-title" onClick={() => navigate('/dashboard')}>
            <div className="qbd-logo-img"></div>
            cerbyl
          </div>
          <div className="qbd-header-divider"></div>
          <p className="qbd-header-subtitle">QUIZ HUB</p>
        </div>
        <nav className="qbd-header-right">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setShowImportExport(true);
            }} 
            className="qbd-nav-btn qbd-nav-btn-accent"
          >
            <Zap size={16} />
            <span>Convert</span>
          </button>
          <button className="qbd-nav-btn qbd-nav-btn-ghost" onClick={() => navigate('/dashboard')}>
            <span>Dashboard</span>
            <ChevronRight size={14} />
          </button>
        </nav>
      </header>

      {/* Sidebar and Content */}
      <div className="qbd-body">
        {renderSidebar()}
        <div className="qbd-main">
          {/* Content */}
          <div className="qbd-content">
            {activeView === 'upload-pdf' && renderUploadPDF()}
            {activeView === 'chat-slides' && renderChatSlides()}
            {activeView === 'custom' && renderCustom()}
            {activeView === 'question-sets' && renderQuestionSets()}
            {activeView === 'analytics' && renderAnalytics()}
            {activeView === 'weak-areas' && renderWeakAreas()}
          </div>
        </div>
      </div>
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
                navigate(`/notes/${result.note_id}`);
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
          <div className="qbd-export-modal" onClick={(e) => e.stopPropagation()}>
            <div className="qbd-export-modal-header">
              <div className="qbd-export-modal-icon">
                <FileDown size={32} />
              </div>
              <h2>Export Question Set</h2>
              <p>Generate a professionally formatted PDF document</p>
            </div>
            
            <div className="qbd-export-modal-content">
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
                <h4>PDF Features:</h4>
                <ul>
                  <li><CheckCircle size={14} /> Professional academic formatting</li>
                  <li><CheckCircle size={14} /> LaTeX math expression support</li>
                  <li><CheckCircle size={14} /> Difficulty level indicators</li>
                  <li><CheckCircle size={14} /> Topic categorization</li>
                  <li><CheckCircle size={14} /> Page numbers and headers</li>
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
          <div className="qbd-preview-modal" onClick={e => e.stopPropagation()}>
            <div className="qbd-preview-header">
              <div className="qbd-preview-title">
                <Eye size={24} />
                <div>
                  <h2>Preview Questions</h2>
                  <p>Review, edit, or regenerate before saving</p>
                </div>
              </div>
              <button className="qbd-modal-close" onClick={() => setShowPreviewModal(false)}>
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

      {/* Merge Sets Modal */}
      {showMergeModal && (
        <div className="qbd-modal-overlay" onClick={() => setShowMergeModal(false)}>
          <div className="qbd-merge-modal" onClick={e => e.stopPropagation()}>
            <div className="qbd-merge-header">
              <GitMerge size={24} />
              <h2>Merge Question Sets</h2>
            </div>
            
            <div className="qbd-merge-content">
              <p>Merging {selectedSets.length} question sets</p>
              
              <div className="qbd-setting-group">
                <label>New Set Title</label>
                <input
                  type="text"
                  value={mergeTitle}
                  onChange={(e) => setMergeTitle(e.target.value)}
                  placeholder="Enter title for merged set..."
                  className="qbd-input"
                />
              </div>
              
              <label className="qbd-checkbox-label">
                <input
                  type="checkbox"
                  checked={deleteOriginals}
                  onChange={(e) => setDeleteOriginals(e.target.checked)}
                />
                <span>Delete original sets after merging</span>
              </label>
            </div>
            
            <div className="qbd-merge-actions">
              <button 
                className="qbd-btn-secondary"
                onClick={() => {
                  setShowMergeModal(false);
                  setMergeTitle('');
                  setDeleteOriginals(false);
                }}
              >
                Cancel
              </button>
              <button 
                className="qbd-btn-primary"
                onClick={handleMergeSets}
                disabled={loading || !mergeTitle.trim()}
              >
                {loading ? <Loader className="qbd-spin" size={18} /> : <GitMerge size={18} />}
                <span>Merge Sets</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Actions Bar */}
      {selectedSets.length > 0 && (
        <div className="qbd-batch-bar">
          <span>{selectedSets.length} set(s) selected</span>
          <div className="qbd-batch-actions">
            <button onClick={() => setShowMergeModal(true)} disabled={selectedSets.length < 2}>
              <GitMerge size={16} />
              <span>Merge</span>
            </button>
            <button onClick={handleBatchDelete} className="qbd-batch-delete">
              <Trash2 size={16} />
              <span>Delete</span>
            </button>
            <button onClick={() => setSelectedSets([])} className="qbd-batch-clear">
              <X size={16} />
              <span>Clear</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuestionBankDashboard;
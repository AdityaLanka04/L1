import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  ArrowLeft, Upload, MessageSquare, Sparkles, FileText, BarChart3, 
  Plus, Play, Trash2, TrendingUp, Target, Brain, Zap, Award, 
  CheckCircle, XCircle, Loader, Clock, FileUp, BookOpen, PieChart, ChevronLeft,
  Download, FileDown, Eye, Edit3, RefreshCw, Layers, AlertTriangle, 
  Star, GitMerge, Wand2, List, ChevronDown, ChevronUp, X, Save, ChevronRight
, Menu} from 'lucide-react';
import './Questionbankdashboard.css';
import './QuestionbankConvert.css';
import { API_URL } from '../config';
import ImportExportModal from '../components/ImportExportModal';
import questionBankAgentService from '../services/questionBankAgentService';
const QuestionBankDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
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

  // Handle generated questions from Learning Path
  useEffect(() => {
    const generatedQuestions = location.state?.generatedQuestions;
    
    if (generatedQuestions && userId) {
      const createGeneratedQuestionSet = async () => {
        try {
          setLoading(true);
          
          const response = await fetch(`${API_URL}/qb/save_question_set`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              user_id: userId,
              title: generatedQuestions.title,
              questions: generatedQuestions.questions,
              source: 'learning_path'
            })
          });
          
          if (response.ok) {
            const data = await response.json();
            
            // Refresh question sets
            await fetchQuestionSets();
            
            // Navigate to the new set in study mode
            const newSet = {
              id: data.set_id,
              title: generatedQuestions.title,
              questions: generatedQuestions.questions
            };
            
            setSelectedQuestionSet(newSet);
            setShowStudyModal(true);
            setCurrentQuestion(0);
            setUserAnswers({});
            setShowResults(false);
            setSessionStartTime(Date.now());
            
            // Clear the state
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
          <span>Dashboard</span>
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );

  // Main component return
  return (
    <div className="qbd-page">
      {/* Sidebar and Content */}
      <div className="qbd-body">
        {renderSidebar()}
        <div className="qbd-main">
          {/* Content */}
          <div className="qbd-content">
            {/* TODO: Restore render functions */}
            {activeView === 'upload-pdf' && <div>Upload PDF view - under maintenance</div>}
            {activeView === 'chat-slides' && <div>Chat & Slides view - under maintenance</div>}
            {activeView === 'custom' && <div>Custom generation view - under maintenance</div>}
            {activeView === 'question-sets' && <div>Question Sets view - under maintenance</div>}
            {activeView === 'analytics' && <div>Analytics view - under maintenance</div>}
            {activeView === 'weak-areas' && <div>Weak Areas view - under maintenance</div>}
          </div>
        </div>
      </div>
      {/* {renderStudyModal()} */}
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
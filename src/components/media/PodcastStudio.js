import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookmarkPlus,
  Copy,
  Download,
  Headphones,
  Languages,
  List,
  Loader2,
  MessageCircle,
  Mic,
  Pause,
  Play,
  Send,
  SkipForward,
  Sparkles,
  Square,
  Trash2,
  Volume2,
} from 'lucide-react';
import podcastAgentService from '../../services/podcastAgentService';
import { API_URL, getAuthToken } from '../../config/api';
import './PodcastStudio.css';

const getTranscriptFromResults = (results) => {
  const transcript = (results?.transcript || '').trim();
  if (transcript.length > 0) return transcript;

  const notesHtml = results?.notes?.content || '';
  if (!notesHtml) return '';

  const temp = document.createElement('div');
  temp.innerHTML = notesHtml;
  return (temp.textContent || temp.innerText || '').trim();
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const formatTime = (seconds) => {
  const total = Math.max(0, Number(seconds || 0));
  const mins = Math.floor(total / 60);
  const secs = Math.floor(total % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const difficultyIndexMap = {
  basic: 0,
  intermediate: 1,
  advanced: 2,
};

const difficultyFromIndex = (index) => {
  if (index <= 0) return 'basic';
  if (index >= 2) return 'advanced';
  return 'intermediate';
};

const PodcastStudio = ({ results, userName }) => {
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const currentUtteranceRef = useRef(null);
  const chatListRef = useRef(null);
  const recognitionRef = useRef(null);

  const [voiceModes, setVoiceModes] = useState([]);
  const [selectedVoiceMode, setSelectedVoiceMode] = useState('coach');
  const [voiceProfile, setVoiceProfile] = useState(null);

  const [voicePersonas, setVoicePersonas] = useState([]);
  const [selectedPersona, setSelectedPersona] = useState('mentor');
  const [personaProfile, setPersonaProfile] = useState(null);

  const [languages, setLanguages] = useState([]);
  const [answerLanguage, setAnswerLanguage] = useState('en');
  const [questionLanguage, setQuestionLanguage] = useState('en');

  const [difficulties, setDifficulties] = useState([]);
  const [selectedDifficulty, setSelectedDifficulty] = useState('intermediate');

  const [voices, setVoices] = useState([]);
  const [selectedVoiceUri, setSelectedVoiceUri] = useState('');
  const [playbackRate, setPlaybackRate] = useState(1);
  const [autoPlay, setAutoPlay] = useState(true);

  const [sessionId, setSessionId] = useState('');
  const [episodeTitle, setEpisodeTitle] = useState('');
  const [currentSegment, setCurrentSegment] = useState('');
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [totalSegments, setTotalSegments] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [chapters, setChapters] = useState([]);
  const [bookmarks, setBookmarks] = useState([]);
  const [savedSessions, setSavedSessions] = useState([]);

  const [conversation, setConversation] = useState([]);
  const [question, setQuestion] = useState('');
  const [followUps, setFollowUps] = useState([]);
  const [keyTakeaways, setKeyTakeaways] = useState([]);

  const [mcqState, setMcqState] = useState({ active: false });
  const [mcqFeedback, setMcqFeedback] = useState('');

  const [handsFreeEnabled, setHandsFreeEnabled] = useState(false);
  const [wakePhrase, setWakePhrase] = useState('hey cerbyl');
  const [isHandsFreeListening, setIsHandsFreeListening] = useState(false);

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isFetchingNext, setIsFetchingNext] = useState(false);
  const [isAsking, setIsAsking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isLoadingSaved, setIsLoadingSaved] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const transcript = useMemo(() => getTranscriptFromResults(results), [results]);
  const keyConcepts = results?.analysis?.key_concepts || [];

  const progressPercent = useMemo(() => {
    if (totalSegments <= 0 || currentIndex < 0) return 0;
    return Math.min(100, Math.round(((currentIndex + 1) / totalSegments) * 100));
  }, [currentIndex, totalSegments]);

  const quickQuestions = useMemo(() => {
    const conceptQuestions = keyConcepts
      .slice(0, 4)
      .map((concept) => `Explain ${concept} in simple terms.`);
    const extras = [
      'Give me a quick recap in 3 points.',
      'What are the most important exam takeaways?',
      'Ask me 5 quiz questions now.',
      'What should I revise first for this topic?',
    ];
    return [...conceptQuestions, ...extras];
  }, [keyConcepts]);

  const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const recognitionSupported = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

  const stopRecordingCleanup = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    setIsRecording(false);
  };

  const stopSpeaking = () => {
    if (!speechSupported) return;
    window.speechSynthesis.cancel();
    currentUtteranceRef.current = null;
    setIsSpeaking(false);
  };

  const stopHandsFree = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch (e) {
        // ignore stop errors
      }
    }
    setIsHandsFreeListening(false);
  };

  const applySessionPayload = (data) => {
    setSessionId(data.session_id || '');
    setEpisodeTitle(data.episode_title || data.title || results?.filename || 'Media Podcast');
    setCurrentSegment(data.current_segment || data?.current_chapter?.content || '');
    setCurrentIndex(data.current_index ?? -1);
    setTotalSegments(data.total_segments || (data.chapters || []).length || 0);
    setHasMore(Boolean(data.has_more));

    setSelectedVoiceMode(data.voice_mode || selectedVoiceMode);
    setVoiceProfile(data.voice_profile || null);

    setSelectedPersona(data.voice_persona || selectedPersona);
    setPersonaProfile(data.persona_profile || null);

    setSelectedDifficulty(data.difficulty || selectedDifficulty);
    setAnswerLanguage(data.answer_language || answerLanguage);

    setChapters(data.chapters || []);
    setBookmarks(data.bookmarks || []);
    setKeyTakeaways(data.key_takeaways || []);
    setFollowUps([]);

    if (data.mcq_state) {
      setMcqState(data.mcq_state);
    }

    const options = data.session_options || {};
    if (typeof options.hands_free === 'boolean') {
      setHandsFreeEnabled(options.hands_free);
    }
    if (options.wake_phrase) {
      setWakePhrase(options.wake_phrase);
    }
  };

  const persistSettings = async (override = {}) => {
    if (!sessionId) return;
    try {
      const res = await podcastAgentService.updateSettings({
        user_id: userName,
        session_id: sessionId,
        voice_mode: override.voice_mode || selectedVoiceMode,
        voice_persona: override.voice_persona || selectedPersona,
        difficulty: override.difficulty || selectedDifficulty,
        answer_language: override.answer_language || answerLanguage,
        session_options: {
          hands_free: typeof override.hands_free === 'boolean' ? override.hands_free : handsFreeEnabled,
          wake_phrase: override.wake_phrase || wakePhrase,
        },
      });
      if (res.voice_profile) setVoiceProfile(res.voice_profile);
      if (res.persona_profile) setPersonaProfile(res.persona_profile);
    } catch (e) {
      setError(e.message || 'Failed to update podcast settings');
    }
  };

  const startHandsFreeLoop = () => {
    if (!recognitionSupported) {
      setError('Hands-free mode is not supported in this browser.');
      return;
    }

    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!recognitionRef.current) {
      const recognition = new Recognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = questionLanguage === 'en' ? 'en-US' : questionLanguage;

      recognition.onstart = () => setIsHandsFreeListening(true);
      recognition.onerror = () => setIsHandsFreeListening(false);
      recognition.onend = () => {
        setIsHandsFreeListening(false);
        if (handsFreeEnabled && sessionId) {
          setTimeout(() => {
            try {
              recognition.start();
            } catch (e) {
              // ignore repeated start errors
            }
          }, 250);
        }
      };

      recognition.onresult = (event) => {
        const last = event.results[event.results.length - 1];
        if (!last || !last.isFinal) return;

        const raw = (last[0]?.transcript || '').trim();
        if (!raw) return;

        const lower = raw.toLowerCase();
        const wake = wakePhrase.trim().toLowerCase();

        if (wake && !lower.includes(wake)) {
          return;
        }

        let cleaned = raw;
        if (wake) {
          const idx = lower.indexOf(wake);
          if (idx >= 0) {
            cleaned = raw.slice(idx + wake.length).trim();
          }
        }

        if (cleaned.length > 1) {
          askQuestion(cleaned);
        }
      };

      recognitionRef.current = recognition;
    }

    recognitionRef.current.lang = questionLanguage === 'en' ? 'en-US' : questionLanguage;
    try {
      recognitionRef.current.start();
    } catch (e) {
      // ignore if already started
    }
  };

  const loadSessionMemory = async () => {
    if (!userName) return;
    setIsLoadingSaved(true);
    try {
      const res = await podcastAgentService.getSavedSessions(userName, 20);
      setSavedSessions(res.sessions || []);
    } catch (e) {
      // non-blocking
    } finally {
      setIsLoadingSaved(false);
    }
  };

  useEffect(() => {
    let ignore = false;

    const loadMeta = async () => {
      try {
        const [modeRes, personaRes, languageRes, difficultyRes] = await Promise.all([
          podcastAgentService.getVoiceModes(),
          podcastAgentService.getVoicePersonas(),
          podcastAgentService.getLanguages(),
          podcastAgentService.getDifficulties(),
        ]);

        if (ignore) return;

        setVoiceModes(modeRes?.voice_modes || []);
        setVoicePersonas(personaRes?.voice_personas || []);
        setLanguages(languageRes?.languages || []);
        setDifficulties(difficultyRes?.difficulties || []);
      } catch (e) {
        if (!ignore) {
          setError(e.message || 'Failed to load podcast configuration');
        }
      }
    };

    loadMeta();
    loadSessionMemory();

    return () => {
      ignore = true;
    };
  }, [userName]);

  useEffect(() => {
    if (!speechSupported) return undefined;

    const synth = window.speechSynthesis;

    const loadVoices = () => {
      const list = synth.getVoices() || [];
      setVoices(list);
      if (!selectedVoiceUri && list.length > 0) {
        const englishVoice = list.find((voice) => voice.lang?.toLowerCase().startsWith('en'));
        setSelectedVoiceUri((englishVoice || list[0]).voiceURI);
      }
    };

    loadVoices();
    synth.addEventListener('voiceschanged', loadVoices);

    return () => {
      synth.removeEventListener('voiceschanged', loadVoices);
    };
  }, [speechSupported, selectedVoiceUri]);

  useEffect(() => {
    return () => {
      stopSpeaking();
      stopRecordingCleanup();
      stopHandsFree();
    };
  }, []);

  useEffect(() => {
    stopSpeaking();
    stopHandsFree();
    setSessionId('');
    setEpisodeTitle('');
    setCurrentSegment('');
    setCurrentIndex(-1);
    setTotalSegments(0);
    setHasMore(false);
    setConversation([]);
    setQuestion('');
    setChapters([]);
    setBookmarks([]);
    setFollowUps([]);
    setKeyTakeaways([]);
    setMcqState({ active: false });
    setMcqFeedback('');
    setCopied(false);
    setError('');
    setHandsFreeEnabled(false);
  }, [results?.filename]);

  useEffect(() => {
    if (chatListRef.current) {
      chatListRef.current.scrollTop = chatListRef.current.scrollHeight;
    }
  }, [conversation.length]);

  const speakText = (text) => {
    if (!speechSupported || !text) return;

    stopSpeaking();

    const utterance = new SpeechSynthesisUtterance(text);
    const selectedVoice = voices.find((voice) => voice.voiceURI === selectedVoiceUri);

    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    const modeRate = voiceProfile?.speech_rate || 1;
    const modePitch = voiceProfile?.speech_pitch || 1;
    const personaRate = personaProfile?.speech_rate || 1;
    const personaPitch = personaProfile?.speech_pitch || 1;

    utterance.rate = clamp(((modeRate + personaRate) / 2) * playbackRate, 0.75, 1.35);
    utterance.pitch = clamp((modePitch + personaPitch) / 2, 0.75, 1.3);
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    currentUtteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const appendConversation = (entry) => {
    setConversation((prev) => [...prev, { ...entry, id: `${Date.now()}-${Math.random()}` }]);
  };

  const speakIfEnabled = (text) => {
    if (autoPlay) {
      speakText(text);
    }
  };

  const startSession = async () => {
    if (!transcript || transcript.length < 100) {
      setError('This note does not have enough transcript content to create a podcast session.');
      return;
    }

    setError('');
    setIsStarting(true);

    try {
      const response = await podcastAgentService.startSession({
        user_id: userName,
        transcript,
        analysis: results?.analysis || {},
        title: results?.filename || 'Media Podcast',
        source_type: results?.source_type || 'media',
        voice_mode: selectedVoiceMode,
        voice_persona: selectedPersona,
        difficulty: selectedDifficulty,
        answer_language: answerLanguage,
        session_options: {
          hands_free: handsFreeEnabled,
          wake_phrase: wakePhrase,
        },
      });

      applySessionPayload(response);
      setConversation([]);
      if (response.current_segment) {
        appendConversation({ role: 'assistant', type: 'narration', content: response.current_segment });
        speakIfEnabled(response.current_segment);
      }
      await loadSessionMemory();
    } catch (e) {
      setError(e.message || 'Failed to start podcast session');
    } finally {
      setIsStarting(false);
    }
  };

  const resumeSession = async (targetSessionId) => {
    if (!targetSessionId) return;
    setError('');
    try {
      const response = await podcastAgentService.resumeSession({
        user_id: userName,
        session_id: targetSessionId,
      });
      applySessionPayload(response);
      setConversation([]);
      if (response.current_segment) {
        appendConversation({ role: 'assistant', type: 'narration', content: response.current_segment });
      }
    } catch (e) {
      setError(e.message || 'Failed to resume podcast session');
    }
  };

  const fetchNextSegment = async () => {
    if (!sessionId) return;

    setError('');
    setIsFetchingNext(true);

    try {
      const response = await podcastAgentService.nextSegment({
        user_id: userName,
        session_id: sessionId,
      });

      setCurrentSegment(response.current_segment || '');
      setCurrentIndex(response.current_index ?? currentIndex);
      setTotalSegments(response.total_segments || totalSegments);
      setHasMore(Boolean(response.has_more));

      if (response.chapter) {
        setCurrentIndex(response.chapter.index);
      }

      if (response.current_segment) {
        appendConversation({ role: 'assistant', type: 'narration', content: response.current_segment });
        speakIfEnabled(response.current_segment);
      }
    } catch (e) {
      setError(e.message || 'Failed to load next segment');
    } finally {
      setIsFetchingNext(false);
    }
  };

  const jumpToChapter = async (chapterIndex) => {
    if (!sessionId) return;

    setError('');
    try {
      const response = await podcastAgentService.jumpToChapter({
        user_id: userName,
        session_id: sessionId,
        chapter_index: chapterIndex,
      });

      setCurrentSegment(response.current_segment || '');
      setCurrentIndex(response.current_index ?? chapterIndex);
      setTotalSegments(response.total_segments || totalSegments);
      setHasMore(Boolean(response.has_more));

      if (response.current_segment) {
        appendConversation({ role: 'assistant', type: 'narration', content: response.current_segment });
        speakIfEnabled(response.current_segment);
      }
    } catch (e) {
      setError(e.message || 'Failed to jump chapter');
    }
  };

  const addBookmark = async () => {
    if (!sessionId) return;

    setError('');
    try {
      const response = await podcastAgentService.addBookmark({
        user_id: userName,
        session_id: sessionId,
        chapter_index: currentIndex >= 0 ? currentIndex : 0,
      });

      setBookmarks(response.bookmarks || []);
    } catch (e) {
      setError(e.message || 'Failed to add bookmark');
    }
  };

  const replayBookmark = async (bookmarkId) => {
    if (!sessionId || !bookmarkId) return;

    setError('');
    try {
      const response = await podcastAgentService.replayBookmark({
        user_id: userName,
        session_id: sessionId,
        bookmark_id: bookmarkId,
      });

      setCurrentSegment(response.current_segment || '');
      setCurrentIndex(response.current_index ?? currentIndex);
      setTotalSegments(response.total_segments || totalSegments);
      setHasMore(Boolean(response.has_more));

      if (response.current_segment) {
        appendConversation({ role: 'assistant', type: 'narration', content: response.current_segment });
        speakIfEnabled(response.current_segment);
      }
    } catch (e) {
      setError(e.message || 'Failed to replay bookmark');
    }
  };

  const startMcqDrill = async () => {
    if (!sessionId) {
      setError('Start a podcast session first.');
      return;
    }

    setError('');
    setMcqFeedback('');

    try {
      const response = await podcastAgentService.startMcqDrill({
        user_id: userName,
        session_id: sessionId,
        count: 5,
      });
      setMcqState(response);
    } catch (e) {
      setError(e.message || 'Failed to start MCQ drill');
    }
  };

  const answerMcq = async (selectedIndex) => {
    if (!sessionId || !mcqState?.question) return;

    try {
      const response = await podcastAgentService.answerMcq({
        user_id: userName,
        session_id: sessionId,
        question_index: mcqState.question.index,
        selected_index: selectedIndex,
      });

      setMcqFeedback(
        `${response.is_correct ? 'Correct' : 'Incorrect'} · ${response.explanation || ''}`
      );

      if (response.completed) {
        setMcqState({
          active: false,
          score: response.score,
          total: response.total,
          completed: true,
          summary: response.summary,
        });
      } else {
        setMcqState((prev) => ({
          ...prev,
          active: true,
          score: response.score,
          total: response.total,
          current_index: response.next_question?.index,
          question: response.next_question,
        }));
      }
    } catch (e) {
      setError(e.message || 'Failed to answer MCQ');
    }
  };

  const askQuestion = async (questionText = question) => {
    if (!sessionId) {
      setError('Start a podcast session first.');
      return;
    }

    const cleaned = (questionText || '').trim();
    if (!cleaned) return;

    setError('');
    setIsAsking(true);

    appendConversation({ role: 'user', type: 'question', content: cleaned });
    setQuestion('');

    try {
      const response = await podcastAgentService.askQuestion({
        user_id: userName,
        session_id: sessionId,
        question: cleaned,
        voice_mode: selectedVoiceMode,
        voice_persona: selectedPersona,
        difficulty: selectedDifficulty,
        question_language: questionLanguage,
        answer_language: answerLanguage,
      });

      if (response.voice_profile) setVoiceProfile(response.voice_profile);
      if (response.persona_profile) setPersonaProfile(response.persona_profile);
      if (response.answer_language) setAnswerLanguage(response.answer_language);

      const answer = response.answer || 'I could not generate a response right now.';
      appendConversation({ role: 'assistant', type: 'answer', content: answer });
      setFollowUps(response.follow_up_suggestions || []);
      speakIfEnabled(answer);

      if (response.mcq_drill) {
        setMcqState(response.mcq_drill);
      }
    } catch (e) {
      setError(e.message || 'Failed to ask question');
    } finally {
      setIsAsking(false);
    }
  };

  const transcribeQuestionBlob = async (audioBlob) => {
    if (!audioBlob || audioBlob.size === 0) {
      setError('No audio recorded. Please try again.');
      return;
    }

    setIsTranscribing(true);
    setError('');

    try {
      const token = getAuthToken();
      const formData = new FormData();
      formData.append('audio_file', audioBlob, 'podcast-question.webm');
      formData.append('user_id', userName);

      const response = await fetch(`${API_URL}/transcribe_audio/`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Voice transcription failed');
      }

      const data = await response.json();
      const transcriptQuestion = (data?.transcript || '').trim();

      if (!transcriptQuestion) {
        throw new Error('No question detected in recorded audio');
      }

      setQuestion(transcriptQuestion);
      await askQuestion(transcriptQuestion);
    } catch (e) {
      setError(e.message || 'Failed to transcribe voice question');
    } finally {
      setIsTranscribing(false);
    }
  };

  const startRecordingQuestion = async () => {
    if (isRecording || isTranscribing) return;

    setError('');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      let recorder;
      try {
        recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      } catch (e) {
        recorder = new MediaRecorder(stream);
      }

      audioChunksRef.current = [];
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stopRecordingCleanup();
        await transcribeQuestionBlob(blob);
      };

      recorder.start();
      setIsRecording(true);
    } catch (e) {
      setError('Microphone access failed. Check browser permissions and try again.');
      stopRecordingCleanup();
    }
  };

  const stopRecordingQuestion = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const toggleHandsFree = async () => {
    if (!sessionId) {
      setError('Start or resume a session before enabling hands-free mode.');
      return;
    }

    const next = !handsFreeEnabled;
    setHandsFreeEnabled(next);

    if (next) {
      startHandsFreeLoop();
    } else {
      stopHandsFree();
    }

    await persistSettings({ hands_free: next, wake_phrase: wakePhrase });
  };

  const stopSession = async () => {
    stopSpeaking();
    stopHandsFree();

    if (!sessionId) {
      return;
    }

    try {
      await podcastAgentService.stopSession({
        user_id: userName,
        session_id: sessionId,
      });
    } catch (e) {
      // keep UX responsive even if backend stop fails
    }

    setSessionId('');
    setHasMore(false);
    setCurrentSegment('');
    setCurrentIndex(-1);
    setTotalSegments(0);
    setChapters([]);
    setBookmarks([]);
    setFollowUps([]);
    setHandsFreeEnabled(false);
    await loadSessionMemory();
  };

  const handleVoiceModeChange = async (modeId) => {
    setSelectedVoiceMode(modeId);

    if (!sessionId) return;

    try {
      const response = await podcastAgentService.setVoiceMode({
        user_id: userName,
        session_id: sessionId,
        voice_mode: modeId,
      });
      if (response.voice_profile) {
        setVoiceProfile(response.voice_profile);
      }
    } catch (e) {
      setError(e.message || 'Failed to switch voice mode');
    }
  };

  const handlePersonaChange = async (personaId) => {
    setSelectedPersona(personaId);
    if (sessionId) {
      await persistSettings({ voice_persona: personaId });
    }
  };

  const handleDifficultyChange = async (difficulty) => {
    setSelectedDifficulty(difficulty);
    if (sessionId) {
      await persistSettings({ difficulty });
    }
  };

  const handleAnswerLanguageChange = async (lang) => {
    setAnswerLanguage(lang);
    if (sessionId) {
      await persistSettings({ answer_language: lang });
    }
  };

  const clearConversation = () => {
    setConversation([]);
    setCopied(false);
    setFollowUps([]);
  };

  const copyLatestAnswer = async () => {
    const latestAssistant = [...conversation].reverse().find((item) => item.role === 'assistant');
    if (!latestAssistant?.content) return;
    try {
      await navigator.clipboard.writeText(latestAssistant.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch (e) {
      setError('Failed to copy response');
    }
  };

  const exportSession = async (formatType) => {
    if (!sessionId) {
      setError('No active session to export.');
      return;
    }

    setIsExporting(true);
    setError('');

    try {
      const response = await podcastAgentService.exportSession({
        user_id: userName,
        session_id: sessionId,
        format_type: formatType,
      });

      const blob = new Blob([response.content || ''], {
        type: formatType === 'json' ? 'application/json' : 'text/markdown;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = response.filename || `podcast-session.${formatType === 'json' ? 'json' : 'md'}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message || 'Failed to export podcast session');
    } finally {
      setIsExporting(false);
    }
  };

  const handleQuestionKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      askQuestion(question);
    }
  };

  const difficultySliderValue = difficultyIndexMap[selectedDifficulty] ?? 1;

  return (
    <div className="podcast-studio">
      <div className="podcast-hero">
        <div>
          <p className="podcast-kicker">Podcast Studio Pro</p>
          <h3>{episodeTitle || 'Turn This Media Into An Interactive Podcast'}</h3>
          <p>
            Chapters, bookmarks, live drill mode, multilingual Q&A, follow-ups, and hands-free interaction.
          </p>
          <div className="podcast-hero-stats">
            <span className="podcast-stat">{transcript.split(' ').filter(Boolean).length.toLocaleString()} words</span>
            <span className="podcast-stat">{keyConcepts.length} key concepts</span>
            <span className="podcast-stat">{totalSegments > 0 ? `${totalSegments} chapters` : '0 chapters'}</span>
            <span className="podcast-stat">{bookmarks.length} bookmarks</span>
          </div>
        </div>
        <div className="podcast-hero-badge">
          <Headphones size={18} />
          <span>{sessionId ? 'Live Session' : 'Ready'}</span>
        </div>
      </div>

      <div className="podcast-controls-grid">
        <div className="podcast-card">
          <div className="podcast-card-header">
            <Sparkles size={16} />
            <h4>Voice Mode + Persona</h4>
          </div>

          <div className="podcast-mode-list">
            {voiceModes.map((mode) => (
              <button
                key={mode.id}
                className={`podcast-mode-pill ${selectedVoiceMode === mode.id ? 'active' : ''}`}
                onClick={() => handleVoiceModeChange(mode.id)}
              >
                <strong>{mode.label}</strong>
                <span>{mode.description}</span>
              </button>
            ))}
          </div>

          <div className="podcast-playback-row" style={{ marginTop: '10px' }}>
            <label>Persona</label>
            <select value={selectedPersona} onChange={(e) => handlePersonaChange(e.target.value)}>
              {voicePersonas.map((persona) => (
                <option key={persona.id} value={persona.id}>
                  {persona.label}
                </option>
              ))}
            </select>
          </div>

          <div className="podcast-playback-row">
            <label>Difficulty</label>
            <input
              type="range"
              min="0"
              max="2"
              step="1"
              value={difficultySliderValue}
              onChange={(e) => handleDifficultyChange(difficultyFromIndex(Number(e.target.value)))}
            />
            <span>{selectedDifficulty}</span>
          </div>
        </div>

        <div className="podcast-card">
          <div className="podcast-card-header">
            <Languages size={16} />
            <h4>Language + Playback</h4>
          </div>

          <div className="podcast-playback-row">
            <label>Ask In</label>
            <select value={questionLanguage} onChange={(e) => setQuestionLanguage(e.target.value)}>
              {languages.map((lang) => (
                <option key={lang.code} value={lang.code}>{lang.label}</option>
              ))}
            </select>
          </div>

          <div className="podcast-playback-row">
            <label>Answer In</label>
            <select value={answerLanguage} onChange={(e) => handleAnswerLanguageChange(e.target.value)}>
              {languages.map((lang) => (
                <option key={lang.code} value={lang.code}>{lang.label}</option>
              ))}
            </select>
          </div>

          <div className="podcast-playback-row">
            <label>Browser Voice</label>
            <select
              value={selectedVoiceUri}
              onChange={(e) => setSelectedVoiceUri(e.target.value)}
              disabled={!speechSupported || voices.length === 0}
            >
              {voices.length === 0 && <option value="">No speech voices available</option>}
              {voices.map((voice) => (
                <option key={voice.voiceURI} value={voice.voiceURI}>
                  {voice.name} ({voice.lang})
                </option>
              ))}
            </select>
          </div>

          <div className="podcast-playback-row">
            <label>Speed</label>
            <input
              type="range"
              min="0.85"
              max="1.2"
              step="0.01"
              value={playbackRate}
              onChange={(e) => setPlaybackRate(Number(e.target.value))}
            />
            <span>{playbackRate.toFixed(2)}x</span>
          </div>

          <div className="podcast-toggle-row">
            <label>
              <input type="checkbox" checked={autoPlay} onChange={(e) => setAutoPlay(e.target.checked)} />
              Auto-play generated responses
            </label>
          </div>

          <div className="podcast-toggle-row">
            <label>
              <input type="checkbox" checked={handsFreeEnabled} onChange={toggleHandsFree} />
              Hands-free mode ({isHandsFreeListening ? 'listening' : 'idle'})
            </label>
            <input
              type="text"
              value={wakePhrase}
              onChange={(e) => setWakePhrase(e.target.value)}
              onBlur={() => persistSettings({ wake_phrase: wakePhrase })}
              placeholder="Wake phrase"
              className="podcast-wake-input"
              disabled={!handsFreeEnabled}
            />
          </div>
        </div>

        <div className="podcast-card">
          <div className="podcast-card-header">
            <List size={16} />
            <h4>Session Memory</h4>
          </div>

          <div className="podcast-buttons" style={{ justifyContent: 'flex-start', marginBottom: '10px' }}>
            {!sessionId ? (
              <button className="podcast-btn primary" onClick={startSession} disabled={isStarting}>
                {isStarting ? <Loader2 size={16} className="spin" /> : <Play size={16} />}
                <span>{isStarting ? 'Starting...' : 'Start New'}</span>
              </button>
            ) : (
              <>
                <button className="podcast-btn" onClick={() => speakText(currentSegment)} disabled={!currentSegment || !speechSupported}>
                  <Play size={16} />
                  <span>Play</span>
                </button>
                <button className="podcast-btn" onClick={stopSpeaking} disabled={!isSpeaking}>
                  <Pause size={16} />
                  <span>Pause</span>
                </button>
                <button className="podcast-btn" onClick={fetchNextSegment} disabled={isFetchingNext || !hasMore}>
                  {isFetchingNext ? <Loader2 size={16} className="spin" /> : <SkipForward size={16} />}
                  <span>Next</span>
                </button>
                <button className="podcast-btn danger" onClick={stopSession}>
                  <Square size={16} />
                  <span>Stop</span>
                </button>
              </>
            )}
          </div>

          <div className="podcast-saved-list">
            {isLoadingSaved ? (
              <p className="podcast-placeholder">Loading previous sessions...</p>
            ) : savedSessions.length === 0 ? (
              <p className="podcast-placeholder">No saved sessions yet.</p>
            ) : (
              savedSessions.slice(0, 6).map((item) => (
                <button
                  key={item.session_id}
                  className="podcast-saved-item"
                  onClick={() => resumeSession(item.session_id)}
                >
                  <strong>{item.title || 'Podcast Session'}</strong>
                  <span>{item.voice_mode} · {item.difficulty} · chapter {Math.max((item.current_index || 0) + 1, 1)}</span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="podcast-main-panel">
        <div className="podcast-segment-panel">
          <div className="podcast-segment-header">
            <div>
              <h4>Current Chapter</h4>
              <p>
                {totalSegments > 0
                  ? `Chapter ${Math.max(currentIndex + 1, 1)} of ${totalSegments}`
                  : 'No active chapter'}
              </p>
            </div>

            <div className="podcast-buttons">
              <button className="podcast-btn" onClick={addBookmark} disabled={!sessionId}>
                <BookmarkPlus size={16} />
                <span>Bookmark</span>
              </button>
              <button className="podcast-btn" onClick={startMcqDrill} disabled={!sessionId}>
                <Sparkles size={16} />
                <span>MCQ Drill</span>
              </button>
              <button className="podcast-btn" onClick={() => exportSession('markdown')} disabled={!sessionId || isExporting}>
                {isExporting ? <Loader2 size={16} className="spin" /> : <Download size={16} />}
                <span>Export MD</span>
              </button>
              <button className="podcast-btn" onClick={() => exportSession('json')} disabled={!sessionId || isExporting}>
                <Download size={16} />
                <span>Export JSON</span>
              </button>
            </div>
          </div>

          <div className="podcast-progress-wrap">
            <div className="podcast-progress-bar">
              <div className="podcast-progress-fill" style={{ width: `${progressPercent}%` }} />
            </div>
            <span>{progressPercent}% complete</span>
          </div>

          <div className="podcast-segment-body">
            {currentSegment ? (
              <p>{currentSegment}</p>
            ) : (
              <p className="podcast-placeholder">
                Start or resume a session to generate chapters from this media transcript.
              </p>
            )}

            {keyTakeaways.length > 0 && (
              <div className="podcast-takeaways">
                <h5>Key Takeaways</h5>
                {keyTakeaways.map((item, idx) => (
                  <span key={`${item}-${idx}`} className="podcast-takeaway-item">{item}</span>
                ))}
              </div>
            )}

            {chapters.length > 0 && (
              <div className="podcast-chapter-list">
                <h5>Chapter List</h5>
                {chapters.map((chapter) => (
                  <button
                    key={`chapter-${chapter.index}`}
                    className={`podcast-chapter-item ${chapter.index === currentIndex ? 'active' : ''}`}
                    onClick={() => jumpToChapter(chapter.index)}
                  >
                    <strong>{chapter.index + 1}. {chapter.title}</strong>
                    <span>{formatTime(chapter.start_second)} · {chapter.duration_seconds}s</span>
                  </button>
                ))}
              </div>
            )}

            {bookmarks.length > 0 && (
              <div className="podcast-bookmarks">
                <h5>Bookmarks (Replay This Point)</h5>
                {bookmarks.map((bookmark) => (
                  <button
                    key={`bookmark-${bookmark.id}`}
                    className="podcast-bookmark-item"
                    onClick={() => replayBookmark(bookmark.id)}
                  >
                    <strong>{bookmark.label}</strong>
                    <span>{bookmark.timestamp_label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="podcast-chat-panel">
          <div className="podcast-chat-header">
            <MessageCircle size={16} />
            <h4>Q&A + Follow-ups</h4>
            <div className="podcast-chat-tools">
              <button
                className="podcast-tool-btn"
                onClick={copyLatestAnswer}
                disabled={!conversation.some((item) => item.role === 'assistant')}
              >
                <Copy size={14} />
                <span>{copied ? 'Copied' : 'Copy Latest'}</span>
              </button>
              <button className="podcast-tool-btn" onClick={clearConversation} disabled={conversation.length === 0}>
                <Trash2 size={14} />
                <span>Clear</span>
              </button>
            </div>
          </div>

          <div className="podcast-chat-list" ref={chatListRef}>
            {conversation.length === 0 ? (
              <p className="podcast-placeholder">No conversation yet. Start or resume a session and ask your first question.</p>
            ) : (
              conversation.map((entry) => (
                <div key={entry.id} className={`podcast-chat-bubble ${entry.role}`}>
                  <span className="podcast-chat-role">{entry.role === 'assistant' ? 'Podcast AI' : 'You'}</span>
                  <p>{entry.content}</p>
                </div>
              ))
            )}

            {followUps.length > 0 && (
              <div className="podcast-followups">
                <h5>Follow-up suggestions</h5>
                <div className="podcast-quick-questions">
                  {followUps.map((item, idx) => (
                    <button
                      key={`follow-up-${idx}`}
                      className="podcast-question-chip"
                      onClick={() => askQuestion(item)}
                      disabled={!sessionId || isAsking || isTranscribing}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {mcqState?.active && mcqState?.question && (
              <div className="podcast-mcq-card">
                <h5>MCQ Drill ({(mcqState.current_index || 0) + 1}/{mcqState.total || 0})</h5>
                <p>{mcqState.question.question}</p>
                <div className="podcast-mcq-options">
                  {(mcqState.question.options || []).map((option, index) => (
                    <button
                      key={`mcq-opt-${index}`}
                      className="podcast-question-chip"
                      onClick={() => answerMcq(index)}
                      disabled={isAsking}
                    >
                      {String.fromCharCode(65 + index)}. {option}
                    </button>
                  ))}
                </div>
                {mcqFeedback && <p className="podcast-helper-text">{mcqFeedback}</p>}
              </div>
            )}

            {!mcqState?.active && mcqState?.completed && (
              <div className="podcast-mcq-card">
                <h5>MCQ Drill Complete</h5>
                <p>{mcqState.summary || `Score: ${mcqState.score}/${mcqState.total}`}</p>
              </div>
            )}
          </div>

          <div className="podcast-ask-row">
            <div className="podcast-quick-questions">
              {quickQuestions.map((item, index) => (
                <button
                  key={`${item}-${index}`}
                  className="podcast-question-chip"
                  onClick={() => setQuestion(item)}
                  disabled={!sessionId || isAsking || isTranscribing}
                >
                  {item}
                </button>
              ))}
            </div>
            <textarea
              placeholder="Ask a question about this media..."
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleQuestionKeyDown}
              rows={2}
              disabled={!sessionId || isAsking}
            />

            <div className="podcast-ask-actions">
              <button
                className={`podcast-btn ${isRecording ? 'danger' : ''}`}
                onClick={isRecording ? stopRecordingQuestion : startRecordingQuestion}
                disabled={!sessionId || isTranscribing || isAsking}
              >
                {isTranscribing ? <Loader2 size={16} className="spin" /> : isRecording ? <Square size={16} /> : <Mic size={16} />}
                <span>
                  {isTranscribing ? 'Transcribing...' : isRecording ? 'Stop Recording' : 'Talk To Ask'}
                </span>
              </button>

              <button
                className="podcast-btn primary"
                onClick={() => askQuestion(question)}
                disabled={!sessionId || !question.trim() || isAsking}
              >
                {isAsking ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
                <span>{isAsking ? 'Asking...' : 'Ask'}</span>
              </button>
            </div>
            {!sessionId && (
              <p className="podcast-helper-text">
                Start or resume a session first. Talk/Ask controls unlock once session is live.
              </p>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="podcast-error">
          <Mic size={14} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

export default PodcastStudio;

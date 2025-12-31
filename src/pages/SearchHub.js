import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Sparkles, Clock, Users, BookOpen, FileText, Layers, ChevronRight, X, Filter, Calendar, Play, HelpCircle, RefreshCw, Edit, MessageCircle, Target, Palette, Brain, TrendingUp, Zap, BarChart3, LogIn, UserPlus } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import './SearchHub.css';
import { API_URL } from '../config/api';
import { THEMES } from '../utils/ThemeManager';

const SearchHub = () => {
  const navigate = useNavigate();
  const { selectedTheme, changeTheme } = useTheme();
  const searchInputRef = useRef(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState(null);
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [recentSearches, setRecentSearches] = useState([]);
  const [userName, setUserName] = useState('');
  const [showThemeSelector, setShowThemeSelector] = useState(false);
  
  const [isCreating, setIsCreating] = useState(false);
  const [creatingMessage, setCreatingMessage] = useState('');
  
  const [personalizedPrompts, setPersonalizedPrompts] = useState([]);
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [followUpContext, setFollowUpContext] = useState(null);
  
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    content_types: 'all',
    sort_by: 'relevance',
    date_from: '',
    date_to: ''
  });
  
  const [didYouMean, setDidYouMean] = useState(null);
  const [relatedSearches, setRelatedSearches] = useState([]);
  
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteResults, setAutocompleteResults] = useState([]);
  const [selectedAutocompleteIndex, setSelectedAutocompleteIndex] = useState(-1);
  const autocompleteDebounceRef = useRef(null);
  const [showLoginMessage, setShowLoginMessage] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

  useEffect(() => {
    const username = localStorage.getItem('username');
    const token = localStorage.getItem('token');

    // Only consider logged in if BOTH username AND token exist
    if (username && token) {
      setUserName(username);
      loadRecentSearches(username);
      loadPersonalizedPrompts(username);
    } else {
      // Not logged in - clear any stale data and show default recommendations
      setUserName('');
      const defaultPrompts = [
        { text: 'explain quantum physics', reason: 'Popular topic', priority: 'high' },
        { text: 'how to learn faster', reason: 'Study tips', priority: 'high' },
        { text: 'summarize world history', reason: 'Quick overview', priority: 'medium' },
        { text: 'explain calculus basics', reason: 'Math fundamentals', priority: 'medium' },
        { text: 'what is machine learning', reason: 'Tech trends', priority: 'medium' },
        { text: 'improve memory retention', reason: 'Brain training', priority: 'low' },
        { text: 'learn a new language', reason: 'Language skills', priority: 'low' },
        { text: 'understand economics', reason: 'Financial literacy', priority: 'low' },
      ];
      setPersonalizedPrompts(defaultPrompts);
    }

    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, []);

  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === '/' && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  useEffect(() => {
    // Scroll back to top when no search results
    if (!searchResults && !isSearching && !isCreating) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [searchResults, isSearching, isCreating]);

  useEffect(() => {
    // Scroll to show all autocomplete suggestions
    if (showAutocomplete && autocompleteResults.length > 0) {
      // Wait for dropdown to render
      setTimeout(() => {
        const dropdown = document.querySelector('.autocomplete-dropdown');
        if (dropdown) {
          const lastItem = dropdown.lastElementChild;
          if (lastItem) {
            // Get position of last item
            const rect = lastItem.getBoundingClientRect();
            const absoluteTop = window.pageYOffset + rect.top;
            const absoluteBottom = window.pageYOffset + rect.bottom;
            
            // Scroll to show last item with 10px padding at bottom
            window.scrollTo({ 
              top: absoluteBottom - window.innerHeight + 10, 
              behavior: 'smooth' 
            });
          }
        }
      }, 200);
    }
  }, [showAutocomplete, autocompleteResults]);

  useEffect(() => {
    // Scroll back to top when autocomplete closes
    if (!showAutocomplete && !searchResults && !isSearching) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [showAutocomplete, searchResults, isSearching]);

  useEffect(() => {
    // Close autocomplete when clicking outside
    const handleClickOutside = (e) => {
      if (searchInputRef.current && !searchInputRef.current.closest('form').contains(e.target)) {
        setShowAutocomplete(false);
        setShowSuggestions(false);
        // Scroll back to top when clicking away
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };

    if (showAutocomplete || showSuggestions) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showAutocomplete, showSuggestions]);

  const loadRecentSearches = (username) => {
    const saved = localStorage.getItem(`recentSearches_${username}`);
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved));
      } catch (error) {
        console.error('Error loading recent searches:', error);
      }
    }
  };

  const loadPersonalizedPrompts = async (username) => {
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('user_id', username);
      
      const response = await fetch(`${API_URL}/get_personalized_prompts`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      
      if (response.ok) {
        const data = await response.json();
        const userTopicPrompts = (data.prompts || []).map(prompt => ({
          ...prompt,
          text: typeof prompt.text === 'string' ? prompt.text : (prompt.text?.label || 'Unknown'),
          reason: typeof prompt.reason === 'string' ? prompt.reason : (prompt.reason?.label || null)
        })).slice(0, 4);
        
        const adaptiveLearningPrompts = [
          { text: 'what is my learning style', reason: 'AI detects your preferences', priority: 'high' },
          { text: 'show knowledge gaps', reason: 'Find your blind spots', priority: 'high' },
          { text: 'optimize my retention', reason: 'Spaced repetition schedule', priority: 'medium' },
          { text: 'what will I forget next', reason: 'Predict forgetting curve', priority: 'medium' },
          { text: 'detect my burnout risk', reason: 'Mental health monitoring', priority: 'medium' },
          { text: 'adapt difficulty to my level', reason: 'Auto-adjust content difficulty', priority: 'low' },
        ];
        
        const remainingSlots = 10 - userTopicPrompts.length;
        const combinedPrompts = [
          ...userTopicPrompts,
          ...adaptiveLearningPrompts.slice(0, remainingSlots)
        ];
        
        setPersonalizedPrompts(combinedPrompts);
      } else {
        console.log('Personalized prompts endpoint not available, using defaults');
        setPersonalizedPrompts([]);
      }
    } catch (error) {
      console.error('Error loading personalized prompts:', error);
      setPersonalizedPrompts([]);
    }
  };

  const saveRecentSearch = (query) => {
    const updated = [query, ...recentSearches.filter(q => q !== query)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem(`recentSearches_${userName}`, JSON.stringify(updated));
  };

  const generateSuggestions = (input) => {
    if (!input || input.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const inputLower = input.toLowerCase();
    const commandSuggestions = [];

    const commands = [
      { pattern: 'create', suggestions: [
        { text: 'create a note on {topic}', icon: '📝', action: 'create_note' },
        { text: 'create flashcards on {topic}', icon: '🃏', action: 'create_flashcards' },
        { text: 'create a quiz on {topic}', icon: '❓', action: 'create_quiz' },
        { text: 'create a personalized curriculum for {topic}', icon: '📚', action: 'create_curriculum' },
      ]},
      { pattern: 'make', suggestions: [
        { text: 'make a note about {topic}', icon: '📝', action: 'create_note' },
        { text: 'make flashcards for {topic}', icon: '🃏', action: 'create_flashcards' },
        { text: 'make a quiz about {topic}', icon: '❓', action: 'create_quiz' },
      ]},
      { pattern: 'adapt', suggestions: [
        { text: 'adapt difficulty to my level', icon: '🎯', action: 'adapt_difficulty' },
        { text: 'adapt content for me', icon: '✨', action: 'adapt_content' },
      ]},
      { pattern: 'review', suggestions: [
        { text: 'review flashcards', icon: '📚', action: 'review_flashcards' },
        { text: 'review weak flashcards', icon: '⚠️', action: 'review_flashcards' },
        { text: 'review what I\'ll forget next', icon: '🔮', action: 'predict_forgetting' },
      ]},
      { pattern: 'show', suggestions: [
        { text: 'show my progress', icon: '📊', action: 'show_progress' },
        { text: 'show weak areas', icon: '🔍', action: 'show_weak_areas' },
        { text: 'show my achievements', icon: '🏆', action: 'show_achievements' },
        { text: 'show my learning style', icon: '🧠', action: 'show_learning_style' },
        { text: 'show knowledge gaps', icon: '🕳️', action: 'show_knowledge_gaps' },
      ]},
      { pattern: 'find', suggestions: [
        { text: 'find my knowledge blind spots', icon: '🔍', action: 'show_knowledge_gaps' },
        { text: 'find my study twin', icon: '👥', action: 'find_study_twin' },
        { text: 'find complementary learners', icon: '🤝', action: 'find_complementary' },
      ]},
      { pattern: 'what', suggestions: [
        { text: 'what am I weak in', icon: '🔍', action: 'show_weak_areas' },
        { text: 'what is my learning style', icon: '🧠', action: 'show_learning_style' },
        { text: 'what will I forget next', icon: '🔮', action: 'predict_forgetting' },
        { text: 'what are my knowledge gaps', icon: '🕳️', action: 'show_knowledge_gaps' },
        { text: 'what should I study next', icon: '🎯', action: 'suggest_next_topic' },
      ]},
      { pattern: 'explain', suggestions: [
        { text: 'explain {topic} step-by-step', icon: '📖', action: 'explain' },
        { text: 'explain like I\'m 5', icon: '👶', action: 'eli5' },
        { text: 'explain with examples', icon: '💡', action: 'explain_examples' },
      ]},
      { pattern: 'summarize', suggestions: [
        { text: 'summarize {topic}', icon: '📋', action: 'summarize' },
        { text: 'summarize my notes on {topic}', icon: '📝', action: 'summarize_notes' },
      ]},
      { pattern: 'quiz', suggestions: [
        { text: 'quiz me on {topic}', icon: '❓', action: 'quiz' },
        { text: 'quiz me on weak areas', icon: '⚠️', action: 'quiz_weak' },
      ]},
      { pattern: 'optimize', suggestions: [
        { text: 'optimize my retention', icon: '🧠', action: 'optimize_retention' },
        { text: 'optimize my study schedule', icon: '📅', action: 'optimize_schedule' },
      ]},
      { pattern: 'predict', suggestions: [
        { text: 'predict what I\'ll forget next', icon: '🔮', action: 'predict_forgetting' },
        { text: 'predict my performance', icon: '📊', action: 'predict_performance' },
      ]},
      { pattern: 'detect', suggestions: [
        { text: 'detect my burnout risk', icon: '😰', action: 'detect_burnout' },
        { text: 'detect knowledge gaps', icon: '🕳️', action: 'show_knowledge_gaps' },
      ]},
    ];

    for (const command of commands) {
      if (inputLower.includes(command.pattern)) {
        const words = inputLower.split(' ');
        const patternIndex = words.indexOf(command.pattern);
        const topic = words.slice(patternIndex + 1).join(' ');

        command.suggestions.forEach(suggestion => {
          const finalText = suggestion.text.replace('{topic}', topic || '...');
          commandSuggestions.push({
            ...suggestion,
            text: finalText
          });
        });
        break;
      }
    }

    if (commandSuggestions.length > 0) {
      setSuggestions(commandSuggestions.slice(0, 5));
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSearch = async (query = searchQuery) => {
    console.log('🔍 handleSearch called with query:', query);
    if (!query || !query.trim()) {
      console.log('⚠️ Empty query, returning');
      return;
    }

    const finalQuery = query.trim();
    console.log('🚀 Starting search...');
    setIsSearching(true);
    setShowSuggestions(false);
    setShowAutocomplete(false);
    saveRecentSearch(finalQuery);

    // Scroll down to show results
    window.scrollTo({ top: window.innerHeight, behavior: 'smooth' });

    try {
      const token = localStorage.getItem('token');
      console.log('🔑 Token exists:', !!token);
      console.log('👤 Username:', userName);
      
      // First, detect intent using AI
      console.log('🤖 Detecting intent...');
      const intentFormData = new FormData();
      intentFormData.append('user_id', userName || 'guest');
      intentFormData.append('query', finalQuery);
      
      const intentResponse = await fetch(`${API_URL}/detect_search_intent`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: intentFormData
      });
      
      console.log('📥 Intent response status:', intentResponse.status);
      
      if (intentResponse.ok) {
        const intentData = await intentResponse.json();
        console.log('🎯 Intent data:', intentData);
        
        // Execute action based on intent
        if (intentData.intent === 'action') {
          console.log('⚡ Executing action:', intentData.action);
          await executeAction(intentData);
          return;
        }
      }
      
      // If no action intent, perform regular search
      console.log('🔎 Performing regular search...');
      const formData = new FormData();
      formData.append('user_id', userName || 'guest');
      formData.append('query', finalQuery);
      formData.append('content_types', filters.content_types);
      formData.append('sort_by', filters.sort_by);
      if (filters.date_from) formData.append('date_from', filters.date_from);
      if (filters.date_to) formData.append('date_to', filters.date_to);

      const response = await fetch(`${API_URL}/search_content`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      console.log('📥 Search response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Search results:', data);
        setSearchResults(data);
        setDidYouMean(data.did_you_mean || null);
        setRelatedSearches(data.related_searches || []);
        
        if (data.total_results === 0 || !data.results || data.results.length === 0) {
          console.log('💡 No results, getting AI description...');
          await getAiDescription(finalQuery);
        } else {
          setAiSuggestion(data.ai_suggestion || null);
        }
      } else {
        throw new Error('Search failed');
      }
    } catch (error) {
      console.error('❌ Error searching:', error);
      // Even on error, try to get AI description
      await getAiDescription(finalQuery);
    } finally {
      console.log('🏁 Search complete, setting isSearching to false');
      setIsSearching(false);
    }
  };

  const getAiDescription = async (topic) => {
    try {
      console.log('🤖 Getting AI description for:', topic);
      console.log('🔗 API_URL:', API_URL);
      const token = localStorage.getItem('token');
      
      // Try to get AI-generated description from backend
      const formData = new FormData();
      formData.append('user_id', userName || 'guest');
      formData.append('topic', topic);
      
      const fullUrl = `${API_URL}/generate_topic_description`;
      console.log('📡 Calling:', fullUrl);
      
      const response = await fetch(fullUrl, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      
      console.log('📥 Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ AI description received:', data);
        setAiSuggestion({
          description: data.description || data.summary || `Let me help you learn about ${topic}.`,
          suggestions: [
            `create flashcards on ${topic}`,
            `create a note on ${topic}`,
            `explain ${topic} in detail`,
            `quiz me on ${topic}`
          ]
        });
        
        // Set empty results but keep the query
        setSearchResults({
          results: [],
          total_results: 0,
          query: topic,
          has_ai_description: true
        });
      } else {
        console.log('⚠️ Response not OK, status:', response.status);
        const errorText = await response.text();
        console.log('❌ Error response:', errorText);
        
        // Fallback: Show helpful message
        setAiSuggestion({
          description: `I couldn't find any existing study materials about "${topic}". Let's create some! I can help you generate flashcards, notes, or start a learning session.`,
          suggestions: [
            `create flashcards on ${topic}`,
            `create a note on ${topic}`,
            `explain ${topic}`,
            `start learning ${topic}`
          ]
        });
        
        setSearchResults({
          results: [],
          total_results: 0,
          query: topic,
          has_ai_description: true
        });
      }
    } catch (error) {
      console.error('❌ Error getting AI description:', error);
      // Fallback AI suggestion
      setAiSuggestion({
        description: `I couldn't find any existing study materials about "${topic}". Would you like to create some? I can help you generate flashcards, notes, or start a learning session.`,
        suggestions: [
          `create flashcards on ${topic}`,
          `create a note on ${topic}`,
          `explain ${topic}`
        ]
      });
      
      setSearchResults({
        results: [],
        total_results: 0,
        query: topic,
        has_ai_description: true
      });
    }
  };

  const executeAction = async (intentData) => {
    console.log('⚡ executeAction called with:', intentData);
    const { action, parameters } = intentData;
    
    try {
      console.log('🎬 Executing action:', action);
      switch (action) {
        case 'create_note':
          console.log('📝 Creating note');
          setIsCreating(true);
          setCreatingMessage('Creating note...');
          navigate('/notes');
          break;
          
        case 'create_flashcards':
          console.log('🃏 Creating flashcards');
          setIsCreating(true);
          setCreatingMessage(`Creating flashcards on ${parameters.topic}...`);
          setTimeout(() => {
            setIsCreating(false);
            navigate('/flashcards', { 
              state: { 
                autoCreate: true,
                topic: parameters.topic,
                count: parameters.count || 10
              } 
            });
          }, 500);
          break;
          
        case 'create_quiz':
          console.log('❓ Starting quiz');
          setIsCreating(true);
          setCreatingMessage('Preparing quiz...');
          setTimeout(() => {
            setIsCreating(false);
            navigate('/solo-quiz');
          }, 500);
          break;
          
        case 'start_chat':
          console.log('💬 Starting chat');
          navigate('/ai-chat', { 
            state: { 
              initialMessage: parameters.message || parameters.topic
            } 
          });
          break;
          
        case 'show_progress':
          navigate('/study-insights');
          break;
          
        case 'show_achievements':
          navigate('/study-insights');
          break;
          
        default:
          console.log('🔄 Unknown action, performing regular search');
          // Fall back to regular search
          setIsSearching(false);
          break;
      }
    } catch (error) {
      console.error('❌ Error executing action:', error);
      setIsCreating(false);
      setIsSearching(false);
    }
  };

  const handleAutocomplete = async (query) => {
    if (!query || query.length < 2) {
      setShowAutocomplete(false);
      setAutocompleteResults([]);
      return;
    }

    if (autocompleteDebounceRef.current) {
      clearTimeout(autocompleteDebounceRef.current);
    }

    autocompleteDebounceRef.current = setTimeout(async () => {
      try {
        const token = localStorage.getItem('token');
        const formData = new FormData();
        formData.append('query', query);
        formData.append('user_id', userName || 'guest');

        const response = await fetch(`${API_URL}/autocomplete`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });

        if (response.ok) {
          const data = await response.json();
          if (data.suggestions && data.suggestions.length > 0) {
            setAutocompleteResults(data.suggestions.slice(0, 10));
            setShowAutocomplete(true);
            return;
          }
        }
      } catch (error) {
        console.error('Autocomplete error:', error);
      }

      // Fallback: Show filtered recent searches and personalized prompts
      const queryLower = query.toLowerCase();
      const filteredRecent = recentSearches
        .filter(search => search.toLowerCase().includes(queryLower))
        .slice(0, 5)
        .map(text => ({ text, type: 'recent' }));
      
      const filteredPrompts = personalizedPrompts
        .filter(prompt => prompt.text.toLowerCase().includes(queryLower))
        .slice(0, 5)
        .map(prompt => ({ text: prompt.text, type: 'suggestion' }));

      const combined = [...filteredRecent, ...filteredPrompts].slice(0, 10);
      
      if (combined.length > 0) {
        setAutocompleteResults(combined);
        setShowAutocomplete(true);
      } else {
        setShowAutocomplete(false);
      }
    }, 300);
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    generateSuggestions(value);
    handleAutocomplete(value);
  };

  const handleKeyDown = (e) => {
    if (showAutocomplete && autocompleteResults.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedAutocompleteIndex(prev => 
          prev < autocompleteResults.length - 1 ? prev + 1 : 0
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedAutocompleteIndex(prev => 
          prev > 0 ? prev - 1 : autocompleteResults.length - 1
        );
      } else if (e.key === 'Enter' && selectedAutocompleteIndex >= 0) {
        e.preventDefault();
        const selected = autocompleteResults[selectedAutocompleteIndex];
        setSearchQuery(selected.text);
        handleSearch(selected.text);
        setShowAutocomplete(false);
      }
    } else if (e.key === 'Enter') {
      handleSearch();
    } else if (e.key === 'Escape') {
      setShowAutocomplete(false);
      setShowSuggestions(false);
    }
  };

  const handleResultClick = (result) => {
    if (result.type === 'flashcards' || result.type === 'flashcard_deck') {
      navigate(`/flashcards/${result.id}`);
    } else if (result.type === 'notes' || result.type === 'note') {
      navigate(`/notes/${result.id}`);
    } else if (result.type === 'chats' || result.type === 'chat') {
      navigate(`/chat/${result.id}`);
    } else if (result.type === 'roadmap') {
      navigate(`/roadmap/${result.id}`);
    }
  };

  const handleSmartAction = async (e, result, action) => {
    e.stopPropagation();

    if (action.type === 'review') {
      navigate(`/flashcards/${result.id}`);
    } else if (action.type === 'continue_chat') {
      navigate(`/chat/${result.id}`);
    } else if (action.type === 'edit_note') {
      navigate(`/notes/${result.id}`);
    } else if (action.type === 'view_progress') {
      navigate(`/progress`);
    }
  };

  const getSmartActionIcon = (iconName) => {
    const icons = {
      'play': <Play size={14} />,
      'message': <MessageCircle size={14} />,
      'edit': <Edit size={14} />,
      'chart': <BarChart3 size={14} />,
      'target': <Target size={14} />
    };
    return icons[iconName] || <ChevronRight size={14} />;
  };

  const handleCreateContent = async (type) => {
    // Check if user is logged in
    if (!userName) {
      setShowLoginModal(true);
      return;
    }
    
    setIsCreating(true);
    
    const messages = {
      flashcards: 'Creating flashcards...',
      notes: 'Opening notes editor...',
      'ai-chat': 'Starting AI chat...'
    };
    
    setCreatingMessage(messages[type] || 'Creating content...');

    try {
      if (type === 'flashcards') {
        const token = localStorage.getItem('token');
        const formData = new FormData();
        formData.append('user_id', userName);
        formData.append('deck_name', searchQuery);
        formData.append('subject', searchQuery);

        const response = await fetch(`${API_URL}/flashcards/create_deck`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });

        if (response.ok) {
          const data = await response.json();
          navigate(`/flashcards/${data.deck_id}`);
        }
      } else if (type === 'notes') {
        navigate(`/notes/new?topic=${encodeURIComponent(searchQuery)}`);
      } else if (type === 'ai-chat') {
        navigate(`/chat/new?query=${encodeURIComponent(searchQuery)}`);
      }
    } catch (error) {
      console.error('Error creating content:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    if (days < 365) return `${Math.floor(days / 30)} months ago`;
    return date.toLocaleDateString();
  };

  const getContentTypeIcon = (type) => {
    const icons = {
      flashcards: <Layers size={20} />,
      flashcard_deck: <Layers size={20} />,
      notes: <FileText size={20} />,
      note: <FileText size={20} />,
      chats: <MessageCircle size={20} />,
      chat: <MessageCircle size={20} />,
      roadmap: <Target size={20} />,
      default: <Search size={20} />
    };
    return icons[type] || icons.default;
  };

  const activeFilterCount = () => {
    let count = 0;
    if (filters.content_types !== 'all') count++;
    if (filters.sort_by !== 'relevance') count++;
    if (filters.date_from) count++;
    if (filters.date_to) count++;
    return count;
  };

  return (
    <div className="search-hub-page">
      <header className="search-hub-header">
        <div className="header-content">
          <div className="header-buttons">
            <button 
              className="theme-btn"
              onClick={() => setShowThemeSelector(!showThemeSelector)}
            >
              <Palette size={18} />
            </button>

            {!userName && (
              <>
                <button 
                  className="header-text-btn login-signup-btn"
                  onClick={() => navigate('/login')}
                >
                  Login
                </button>
                <button 
                  className="header-text-btn login-signup-btn"
                  onClick={() => navigate('/register')}
                >
                  Sign Up
                </button>
              </>
            )}
            
            {showThemeSelector && (
              <div className="theme-selector-dropdown">
                <div className="theme-section">
                  <h4>Dark Themes</h4>
                  <div className="theme-grid">
                    {Object.entries(THEMES)
                      .filter(([_, theme]) => !theme.isLight)
                      .map(([key, theme]) => (
                        <button
                          key={key}
                          className={`theme-option theme-option-dark ${selectedTheme === key ? 'active' : ''}`}
                          onClick={() => {
                            changeTheme(key);
                            setShowThemeSelector(false);
                          }}
                          style={{
                            '--theme-primary': theme.primary,
                            '--theme-accent': theme.accent
                          }}
                        >
                          {theme.name}
                          <div className="theme-colors">
                            <span 
                              className="theme-color-dot" 
                              style={{ background: theme.primary }}
                            />
                            <span 
                              className="theme-color-dot" 
                              style={{ background: theme.accent }}
                            />
                          </div>
                        </button>
                      ))}
                  </div>
                </div>
                
                <div className="theme-section">
                  <h4>Light Themes</h4>
                  <div className="theme-grid">
                    {Object.entries(THEMES)
                      .filter(([_, theme]) => theme.isLight)
                      .map(([key, theme]) => (
                        <button
                          key={key}
                          className={`theme-option theme-option-light ${selectedTheme === key ? 'active' : ''}`}
                          onClick={() => {
                            changeTheme(key);
                            setShowThemeSelector(false);
                          }}
                          style={{
                            '--theme-primary': theme.primary,
                            '--theme-accent': theme.accent
                          }}
                        >
                          {theme.name}
                          <div className="theme-colors">
                            <span 
                              className="theme-color-dot" 
                              style={{ background: theme.primary }}
                            />
                            <span 
                              className="theme-color-dot" 
                              style={{ background: theme.accent }}
                            />
                          </div>
                        </button>
                      ))}
                  </div>
                </div>
              </div>
            )}
            
            {userName ? (
              <>
                <button 
                  className="header-text-btn login-signup-btn"
                  onClick={() => navigate('/dashboard')}
                >
                  Dashboard
                </button>
                <button 
                  className="header-text-btn login-signup-btn"
                  onClick={() => {
                    localStorage.removeItem('token');
                    localStorage.removeItem('username');
                    setUserName('');
                    window.location.reload();
                  }}
                >
                  Logout
                </button>
              </>
            ) : (
              <button 
                className="header-text-btn login-signup-btn"
                onClick={() => {
                  setShowLoginMessage(true);
                  setTimeout(() => setShowLoginMessage(false), 3000);
                }}
              >
                Dashboard
              </button>
            )}
          </div>
        </div>
      </header>

      {showLoginMessage && (
        <div className="login-required-message">
          PLEASE LOGIN TO CONTINUE
        </div>
      )}

      <main className="search-hub-content">
        {!searchResults && !isSearching && !isCreating ? (
          <div className="hero-section">
            <div className="geometric-background">
              <div className="brain-circle brain-circle-1"></div>
              <div className="brain-circle brain-circle-2"></div>
              <div className="brain-circle brain-circle-3"></div>
              <div className="neural-path neural-path-1"></div>
              <div className="neural-path neural-path-2"></div>
              <div className="neural-path neural-path-3"></div>
            </div>

            <div className="hero-content">
              {personalizedPrompts.length > 0 && (
                <div className="recommendations-section">
                  <h2 className="recommendations-title">RECOMMENDATIONS</h2>

                  <div className="recommendations-grid">
                    {personalizedPrompts.map((prompt, index) => {
                      const icons = {
                        high: <Brain className="rec-icon" />,
                        medium: <Target className="rec-icon" />,
                        low: <Zap className="rec-icon" />
                      };
                      
                      return (
                        <button
                          key={index}
                          className="recommendation-card"
                          data-priority={prompt.priority}
                          onClick={() => {
                            setSearchQuery(prompt.text);
                            handleSearch(prompt.text);
                          }}
                        >
                          <div className="rec-icon-wrapper">
                            {icons[prompt.priority] || <Sparkles className="rec-icon" />}
                          </div>
                          <div className="rec-content">
                            <span className="rec-category">{prompt.priority || 'Suggestion'}</span>
                            <span className="rec-text">{prompt.text}</span>
                            {prompt.reason && <span className="rec-reason">{prompt.reason}</span>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="logo-search-container">
                <div className="giant-logo">
                  <span className="logo-text">cerbyl</span>
                  <div className="search-box-wrapper">
                    <form onSubmit={(e) => { e.preventDefault(); handleSearch(); }} className="search-box-cutout">
                      <input
                        ref={searchInputRef}
                        id="search-input"
                        type="text"
                        value={searchQuery}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        onFocus={() => {
                          // Scroll down when clicking on search bar
                          if (showAutocomplete && autocompleteResults.length > 0) {
                            setTimeout(() => {
                              const dropdown = document.querySelector('.autocomplete-dropdown');
                              if (dropdown) {
                                const lastItem = dropdown.lastElementChild;
                                if (lastItem) {
                                  const rect = lastItem.getBoundingClientRect();
                                  const absoluteBottom = window.pageYOffset + rect.bottom;
                                  window.scrollTo({ 
                                    top: absoluteBottom - window.innerHeight + 10, 
                                    behavior: 'smooth' 
                                  });
                                }
                              }
                            }, 200);
                          }
                        }}
                        placeholder="Search for anything..."
                        className="hero-search-input"
                        autoComplete="off"
                      />
                      <button type="submit" className="search-submit-btn" aria-label="Search">
                        <Search size={20} />
                      </button>
                    </form>
                    {showAutocomplete && autocompleteResults.length > 0 && (
                      <div className="autocomplete-dropdown">
                        {autocompleteResults.map((suggestion, index) => (
                          <button
                            key={index}
                            type="button"
                            className={`autocomplete-item ${index === selectedAutocompleteIndex ? 'selected' : ''}`}
                            onClick={() => {
                              setSearchQuery(suggestion.text);
                              handleSearch(suggestion.text);
                              setShowAutocomplete(false);
                            }}
                          >
                            <Search size={16} />
                            <span>{suggestion.text}</span>
                            {suggestion.type && <span className="suggestion-type">{suggestion.type}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="search-helper-text">
                    EXPLORE ANY TOPIC OF INTEREST, FROM SCIENCE TO HISTORY
                  </p>
                </div>
              </div>

              <p className="hero-subtitle">
                Search your learning materials and explore public content
              </p>

              <div className="keyboard-hint">
                Press <kbd>/</kbd> to search
              </div>

            </div>

            <div className="content-section">
              {recentSearches.length > 0 && (
                <div className="recent-searches-section">
                  <div className="section-header">
                    <Clock className="section-icon" />
                    <h2 className="section-title">Recent Searches</h2>
                  </div>

                  <div className="recent-searches-list">
                    {recentSearches.map((search, index) => (
                      <button
                        key={index}
                        className="recent-search-btn"
                        onClick={() => {
                          setSearchQuery(search);
                          handleSearch(search);
                        }}
                      >
                        <Clock size={16} />
                        {search}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : isCreating ? (
          <div className="creating-content">
            <div className="creating-content-container">
              <div className="pulse-loader">
                <div className="pulse-square pulse-1"></div>
                <div className="pulse-square pulse-2"></div>
                <div className="pulse-square pulse-3"></div>
              </div>
              <h2>{creatingMessage}</h2>
              <p>Please wait while we set things up...</p>
            </div>
          </div>
        ) : isSearching ? (
          <div className="loading-state">
            <div className="pulse-loader">
              <div className="pulse-square pulse-1"></div>
              <div className="pulse-square pulse-2"></div>
              <div className="pulse-square pulse-3"></div>
            </div>
            <p>Searching...</p>
          </div>
        ) : (
          <div className="results-container">
            <div className="results-header">
              <div className="results-info">
                {aiSuggestion && searchResults?.has_ai_description ? (
                  <p>Exploring "<strong>{searchQuery}</strong>"</p>
                ) : (
                  <p>
                    Found <strong>{searchResults?.total_results || 0}</strong> results for "<strong>{searchQuery}</strong>"
                  </p>
                )}
              </div>
              <div className="results-actions">
                <button 
                  className="back-btn-compact"
                  onClick={() => {
                    setSearchResults(null);
                    setAiSuggestion(null);
                    setSearchQuery('');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                >
                  Back
                </button>
                <button 
                  className={`filter-btn ${showFilters ? 'active' : ''}`}
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <Filter size={16} />
                  FILTERS
                  {activeFilterCount() > 0 && (
                    <span className="filter-badge">{activeFilterCount()}</span>
                  )}
                </button>
              </div>
            </div>

            {showFilters && (
              <div className="filters-panel">
                <div className="filter-group">
                  <label>Content Type</label>
                  <select 
                    value={filters.content_types}
                    onChange={(e) => setFilters({...filters, content_types: e.target.value})}
                  >
                    <option value="all">All</option>
                    <option value="flashcards">Flashcards</option>
                    <option value="notes">Notes</option>
                    <option value="chats">Chats</option>
                    <option value="roadmaps">Roadmaps</option>
                  </select>
                </div>

                <div className="filter-group">
                  <label>Sort By</label>
                  <select 
                    value={filters.sort_by}
                    onChange={(e) => setFilters({...filters, sort_by: e.target.value})}
                  >
                    <option value="relevance">Relevance</option>
                    <option value="date">Date</option>
                    <option value="name">Name</option>
                  </select>
                </div>

                <div className="filter-group">
                  <label>Date From</label>
                  <input 
                    type="date"
                    value={filters.date_from}
                    onChange={(e) => setFilters({...filters, date_from: e.target.value})}
                  />
                </div>

                <div className="filter-group">
                  <label>Date To</label>
                  <input 
                    type="date"
                    value={filters.date_to}
                    onChange={(e) => setFilters({...filters, date_to: e.target.value})}
                  />
                </div>

                <button 
                  className="apply-filters-btn"
                  onClick={() => handleSearch()}
                >
                  <RefreshCw size={16} />
                  Apply Filters
                </button>
              </div>
            )}

            <div className="results-content">
              {/* AI Description Section - Show at top when available */}
              {aiSuggestion && aiSuggestion.description && (
                <div className="ai-description-section">
                  <div className="ai-description-header">
                    <Sparkles size={20} />
                    <h3>AI Overview</h3>
                  </div>
                  <p className="ai-description-text">{aiSuggestion.description}</p>
                  
                  <button
                    className="continue-chat-btn"
                    onClick={() => {
                      if (!userName) {
                        setShowLoginModal(true);
                        return;
                      }
                      navigate('/ai-chat', { 
                        state: { 
                          initialMessage: `Tell me more about ${searchQuery}`
                        } 
                      });
                    }}
                  >
                    <MessageCircle size={16} />
                    Continue in AI Chat
                  </button>
                </div>
              )}

              {/* Search Results Grid */}
              {searchResults && searchResults.results && searchResults.results.length > 0 ? (
                <>
                  {/* User Results Section Header */}
                  <div className="results-section-header">
                    <h3>User Results</h3>
                    <p>Study materials created by the community</p>
                  </div>

                  <div className="results-grid">
                    {searchResults.results.map((result, index) => (
                      <div
                        key={result.id || index}
                        className={`result-card ${result.featured ? 'featured' : ''}`}
                        data-priority={result.priority}
                        onClick={() => handleResultClick(result)}
                      >
                        <div className="result-icon">
                          {getContentTypeIcon(result.type)}
                        </div>
                        <div className="result-details">
                          <h3 className="result-title">{result.title || result.name}</h3>
                          
                          {result.description && (
                            <p className="result-description">{result.description}</p>
                          )}
                          
                          {result.card_count !== undefined && (
                            <p className="result-card-count">{result.card_count} cards</p>
                          )}
                          
                          {result.question_count !== undefined && (
                            <p className="result-card-count">{result.question_count} questions</p>
                          )}
                          
                          <div className="result-meta">
                            {result.author && (
                              <span className="result-author">
                                <Users size={14} />
                                Created by {result.is_own ? 'You' : result.author}
                              </span>
                            )}
                            {result.created_at && (
                              <span className="result-date">
                                <Clock size={14} />
                                {formatDate(result.created_at)}
                              </span>
                            )}
                            {result.source_type && (
                              <span className="result-source">
                                {result.source_type === 'ai_generated' ? '🤖 AI Generated' : '✍️ Manual'}
                              </span>
                            )}
                            {result.is_public !== undefined && (
                              <span className={`result-visibility ${result.is_public ? 'public' : 'private'}`}>
                                {result.is_public ? '🌍 Public' : '🔒 Private'}
                              </span>
                            )}
                          </div>
                          
                          <span className="result-type-badge">{result.type.replace('_', ' ')}</span>
                          
                          {result.smart_actions && result.smart_actions.length > 0 && (
                            <div className="smart-actions">
                              {result.smart_actions.map((action, actionIndex) => (
                                <button
                                  key={actionIndex}
                                  className="smart-action-btn"
                                  onClick={(e) => handleSmartAction(e, result, action)}
                                  title={action.label}
                                >
                                  {getSmartActionIcon(action.icon)}
                                  <span>{action.label}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <ChevronRight size={20} className="result-arrow" />
                      </div>
                    ))}
                  </div>
                  
                  {relatedSearches && relatedSearches.length > 0 && (
                    <div className="related-searches">
                      <h4>Related Searches</h4>
                      <div className="related-searches-list">
                        {relatedSearches.map((related, index) => (
                          <button
                            key={index}
                            className="related-search-btn"
                            onClick={() => {
                              setSearchQuery(related);
                              handleSearch(related);
                            }}
                          >
                            <Search size={14} />
                            {related}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : searchResults?.has_ai_description ? (
                /* No results but has AI description - show create options */
                <div className="no-results-with-ai">
                  <div className="create-options">
                    <h4>Create study materials or explore this topic:</h4>
                    <div className="create-options-grid">
                      <button
                        className="create-option-card"
                        onClick={() => handleCreateContent('flashcards')}
                      >
                        <Layers size={32} />
                        <h5>Create Flashcards</h5>
                        <p>Build a deck to study this topic</p>
                      </button>
                      <button
                        className="create-option-card"
                        onClick={() => handleCreateContent('notes')}
                      >
                        <FileText size={32} />
                        <h5>Take Notes</h5>
                        <p>Start documenting your learning</p>
                      </button>
                      <button
                        className="create-option-card"
                        onClick={() => handleCreateContent('ai-chat')}
                      >
                        <MessageCircle size={32} />
                        <h5>Ask AI</h5>
                        <p>Get help from your AI tutor</p>
                      </button>
                      <button
                        className="create-option-card"
                        onClick={() => {
                          if (!userName) {
                            setShowLoginModal(true);
                            return;
                          }
                          navigate('/dashboard');
                        }}
                      >
                        <BarChart3 size={32} />
                        <h5>View Progress</h5>
                        <p>Track your learning journey</p>
                      </button>
                    </div>
                  </div>
                </div>
              ) : searchResults?.action_executed ? (
                <div className="ai-response-section">
                  <div className="ai-suggestion">
                    <div className="ai-suggestion-header">
                      <Sparkles size={24} />
                      <h3>AI Assistant</h3>
                    </div>
                    <p className="ai-description">{aiSuggestion.description}</p>
                    
                    <div className="create-options">
                      <h4>Or create something new:</h4>
                      <div className="create-options-grid">
                        <button
                          className="create-option-card"
                          onClick={() => handleCreateContent('flashcards')}
                        >
                          <Layers size={32} />
                          <h5>Create Flashcards</h5>
                          <p>Build a deck to study this topic</p>
                        </button>
                        <button
                          className="create-option-card"
                          onClick={() => handleCreateContent('notes')}
                        >
                          <FileText size={32} />
                          <h5>Take Notes</h5>
                          <p>Start documenting your learning</p>
                        </button>
                        <button
                          className="create-option-card"
                          onClick={() => handleCreateContent('ai-chat')}
                        >
                          <Sparkles size={32} />
                          <h5>Ask AI</h5>
                          <p>Get help from your AI tutor</p>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="no-results">
                  <div className="no-results-icon">
                    {searchResults.action_executed === 'show_weak_areas' ? (
                      <Sparkles size={48} />
                    ) : (
                      <Search size={48} />
                    )}
                  </div>
                  <h2>
                    {searchResults.action_executed === 'show_weak_areas' 
                      ? "Great job! You don't have any weak areas yet!" 
                      : `No results found for "${searchQuery}"`}
                  </h2>
                  
                  {didYouMean && (
                    <div className="did-you-mean">
                      <span>Did you mean: </span>
                      <button 
                        className="did-you-mean-btn"
                        onClick={() => {
                          setSearchQuery(didYouMean);
                          handleSearch(didYouMean);
                        }}
                      >
                        {didYouMean}
                      </button>
                    </div>
                  )}
                  
                  {aiSuggestion && (
                    <div className="ai-suggestion">
                      <div className="ai-suggestion-header">
                        <Sparkles size={24} />
                        <h3>
                          {searchResults.action_executed === 'show_weak_areas' 
                            ? 'Recommended Next Steps' 
                            : 'AI Assistant'}
                        </h3>
                      </div>
                      <p className="ai-description">{aiSuggestion.description}</p>
                      
                      <div className="create-options">
                        <h4>Or create something new:</h4>
                        <div className="create-options-grid">
                          <button
                            className="create-option-card"
                            onClick={() => handleCreateContent('flashcards')}
                          >
                            <Layers size={32} />
                            <h5>Create Flashcards</h5>
                            <p>Build a deck to study this topic</p>
                          </button>
                          <button
                            className="create-option-card"
                            onClick={() => handleCreateContent('notes')}
                          >
                            <FileText size={32} />
                            <h5>Take Notes</h5>
                            <p>Start documenting your learning</p>
                          </button>
                          <button
                            className="create-option-card"
                            onClick={() => handleCreateContent('ai-chat')}
                          >
                            <Sparkles size={32} />
                            <h5>Ask AI</h5>
                            <p>Get help from your AI tutor</p>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Login Required Modal */}
      {showLoginModal && (
        <div className="login-required-modal" onClick={() => setShowLoginModal(false)}>
          <div className="login-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="login-modal-header">
              <Sparkles size={28} />
              <h3>Sign In Required</h3>
            </div>
            <p className="login-modal-text">
              To unlock the full power of Cerbyl and access personalized learning features, you'll need to create an account or sign in. 
              Join thousands of learners who are already mastering their subjects with AI-powered study tools, adaptive flashcards, 
              intelligent progress tracking, and personalized learning paths tailored just for you.
            </p>
            <div className="login-modal-actions">
              <button 
                className="login-modal-btn"
                onClick={() => {
                  setShowLoginModal(false);
                  navigate('/login');
                }}
              >
                Sign In
              </button>
              <button 
                className="login-modal-btn secondary"
                onClick={() => {
                  setShowLoginModal(false);
                  navigate('/register');
                }}
              >
                Create Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchHub;
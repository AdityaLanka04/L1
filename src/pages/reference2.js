import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Sparkles, Clock, Users, BookOpen, FileText, Layers, ChevronRight, X, Filter, Calendar, Play, HelpCircle, RefreshCw, Edit, MessageCircle, Target, Palette } from 'lucide-react';
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
  
  // Loading state for actions
  const [isCreating, setIsCreating] = useState(false);
  const [creatingMessage, setCreatingMessage] = useState('');
  
  // Personalized prompts
  const [personalizedPrompts, setPersonalizedPrompts] = useState([]);
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [followUpContext, setFollowUpContext] = useState(null);
  
  // Autocomplete states
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  
  // Filter states
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    content_types: 'all',
    sort_by: 'relevance',
    date_from: '',
    date_to: ''
  });
  
  // AI Enhancement states
  const [didYouMean, setDidYouMean] = useState(null);
  const [relatedSearches, setRelatedSearches] = useState([]);
  
  // Autocomplete states (Google-style)
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteResults, setAutocompleteResults] = useState([]);
  const [selectedAutocompleteIndex, setSelectedAutocompleteIndex] = useState(-1);
  const autocompleteDebounceRef = useRef(null);

  useEffect(() => {
    const username = localStorage.getItem('username');

    if (username) {
      setUserName(username);
      loadRecentSearches(username);
      loadPersonalizedPrompts(username);
    }

    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, []);

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
        // Ensure prompts have string values, not objects
        const userTopicPrompts = (data.prompts || []).map(prompt => ({
          ...prompt,
          text: typeof prompt.text === 'string' ? prompt.text : (prompt.text?.label || 'Unknown'),
          reason: typeof prompt.reason === 'string' ? prompt.reason : (prompt.reason?.label || null)
        })).slice(0, 4); // Take first 4 topic-based prompts
        
        // Add adaptive learning prompts (always show these)
        const adaptiveLearningPrompts = [
          { text: 'what is my learning style', reason: 'AI detects your preferences', priority: 'high' },
          { text: 'show knowledge gaps', reason: 'Find your blind spots', priority: 'high' },
          { text: 'optimize my retention', reason: 'Spaced repetition schedule', priority: 'medium' },
          { text: 'what will I forget next', reason: 'Predict forgetting curve', priority: 'medium' },
          { text: 'detect my burnout risk', reason: 'Mental health monitoring', priority: 'medium' },
          { text: 'adapt difficulty to my level', reason: 'Auto-adjust content difficulty', priority: 'low' },
        ];
        
        // Combine: 4 user topic prompts + remaining adaptive prompts (up to 10 total)
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

  // Generate smart suggestions based on input
  const generateSuggestions = (input) => {
    if (!input || input.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const inputLower = input.toLowerCase();
    const commandSuggestions = [];

    // Command templates - ENHANCED WITH ADAPTIVE LEARNING
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
        { text: 'what is {topic}', icon: '💬', action: 'start_chat' },
      ]},
      { pattern: 'optimize', suggestions: [
        { text: 'optimize my retention', icon: '🎯', action: 'optimize_retention' },
        { text: 'optimize my study schedule', icon: '📅', action: 'optimize_schedule' },
      ]},
      { pattern: 'suggest', suggestions: [
        { text: 'suggest break times', icon: '☕', action: 'suggest_breaks' },
        { text: 'suggest prerequisite topics', icon: '📖', action: 'suggest_prerequisites' },
      ]},
      { pattern: 'detect', suggestions: [
        { text: 'detect my burnout risk', icon: '⚡', action: 'detect_burnout' },
      ]},
      { pattern: 'predict', suggestions: [
        { text: 'predict my focus level', icon: '🎯', action: 'predict_focus' },
        { text: 'predict what I\'ll forget', icon: '🔮', action: 'predict_forgetting' },
      ]},
      { pattern: 'simplify', suggestions: [
        { text: 'simplify {topic} for beginners', icon: '📖', action: 'simplify_content' },
      ]},
      { pattern: 'explain', suggestions: [
        { text: 'explain {topic}', icon: '💬', action: 'start_chat' },
        { text: 'explain {topic} step-by-step', icon: '📝', action: 'tutor_step_by_step' },
        { text: 'explain {topic} with analogies', icon: '🔄', action: 'create_analogies' },
        { text: 'explain {topic} like I\'m 5', icon: '👶', action: 'explain_like_im_five' },
      ]},
      { pattern: 'help', suggestions: [
        { text: 'help me with {topic}', icon: '💬', action: 'start_chat' },
      ]},
      // NEW NLP PATTERNS
      { pattern: 'compare', suggestions: [
        { text: 'compare {topic}', icon: '⚖️', action: 'compare_topics' },
      ]},
      { pattern: 'test', suggestions: [
        { text: 'test me on {topic}', icon: '📝', action: 'test_me' },
        { text: 'test my knowledge of {topic}', icon: '🧠', action: 'test_me' },
      ]},
      { pattern: 'quiz', suggestions: [
        { text: 'quiz me on {topic}', icon: '❓', action: 'test_me' },
        { text: 'quick quiz on {topic}', icon: '⚡', action: 'test_me' },
      ]},
      { pattern: 'define', suggestions: [
        { text: 'define {topic}', icon: '📖', action: 'define' },
        { text: 'what is {topic}', icon: '❓', action: 'define' },
      ]},
      { pattern: 'example', suggestions: [
        { text: 'give examples of {topic}', icon: '📝', action: 'give_examples' },
        { text: 'show examples of {topic}', icon: '👁️', action: 'give_examples' },
      ]},
      { pattern: 'prerequisite', suggestions: [
        { text: 'prerequisites for {topic}', icon: '📋', action: 'list_prerequisites' },
        { text: 'what do I need to know before {topic}', icon: '🤔', action: 'list_prerequisites' },
      ]},
      { pattern: 'practice', suggestions: [
        { text: 'practice problems on {topic}', icon: '✏️', action: 'practice_problems' },
        { text: 'practice {topic}', icon: '💪', action: 'practice_problems' },
      ]},
      { pattern: 'summarize', suggestions: [
        { text: 'summarize {topic}', icon: '📄', action: 'summarize_topic' },
        { text: 'give me a summary of {topic}', icon: '📋', action: 'summarize_topic' },
      ]},
      { pattern: 'how', suggestions: [
        { text: 'how to {topic}', icon: '🔧', action: 'how_to' },
        { text: 'how do I {topic}', icon: '❓', action: 'how_to' },
        { text: 'how am I doing', icon: '📊', action: 'show_statistics' },
      ]},
      { pattern: 'pros', suggestions: [
        { text: 'pros and cons of {topic}', icon: '⚖️', action: 'pros_and_cons' },
      ]},
      { pattern: 'timeline', suggestions: [
        { text: 'timeline of {topic}', icon: '📅', action: 'timeline' },
        { text: 'history of {topic}', icon: '📜', action: 'timeline' },
      ]},
      { pattern: 'remind', suggestions: [
        { text: 'remind me to study {topic}', icon: '⏰', action: 'remind_me' },
        { text: 'remind me about {topic}', icon: '🔔', action: 'remind_me' },
      ]},
      { pattern: 'due', suggestions: [
        { text: 'what\'s due today', icon: '📅', action: 'whats_due' },
        { text: 'what do I need to review', icon: '📚', action: 'whats_due' },
      ]},
      { pattern: 'daily', suggestions: [
        { text: 'start daily review', icon: '📚', action: 'daily_review' },
        { text: 'daily practice', icon: '💪', action: 'daily_review' },
      ]},
      { pattern: 'random', suggestions: [
        { text: 'random flashcard', icon: '🎲', action: 'random_flashcard' },
        { text: 'surprise me with a flashcard', icon: '🎁', action: 'random_flashcard' },
      ]},
      { pattern: 'mind', suggestions: [
        { text: 'mind map for {topic}', icon: '🧠', action: 'mind_map' },
        { text: 'create mind map of {topic}', icon: '🗺️', action: 'mind_map' },
      ]},
      { pattern: 'resource', suggestions: [
        { text: 'resources for {topic}', icon: '📚', action: 'suggest_resources' },
        { text: 'learning resources for {topic}', icon: '🎓', action: 'suggest_resources' },
      ]},
      { pattern: 'export', suggestions: [
        { text: 'export my flashcards', icon: '📤', action: 'export_content' },
        { text: 'export my notes', icon: '📤', action: 'export_content' },
      ]},
      { pattern: 'stat', suggestions: [
        { text: 'show my statistics', icon: '📊', action: 'show_statistics' },
        { text: 'my stats this week', icon: '📈', action: 'show_statistics' },
      ]},
    ];

    // Find matching commands
    for (const cmd of commands) {
      if (inputLower.includes(cmd.pattern)) {
        for (const sug of cmd.suggestions) {
          // Replace {topic} with actual input
          let suggestionText = sug.text;
          if (suggestionText.includes('{topic}')) {
            // Extract topic from input
            const topic = input.replace(new RegExp(cmd.pattern, 'i'), '').trim();
            if (topic) {
              suggestionText = suggestionText.replace('{topic}', topic);
            }
          }
          commandSuggestions.push({
            ...sug,
            text: suggestionText,
            fullCommand: suggestionText
          });
        }
        break; // Only match first pattern
      }
    }

    // If no command match, suggest general commands
    if (commandSuggestions.length === 0) {
      commandSuggestions.push(
        { text: `create a note on ${input}`, icon: '', action: 'create_note', fullCommand: `create a note on ${input}` },
        { text: `create flashcards on ${input}`, icon: '', action: 'create_flashcards', fullCommand: `create flashcards on ${input}` },
        { text: `explain ${input}`, icon: '', action: 'start_chat', fullCommand: `explain ${input}` },
      );
    }

    // Add recent searches if they match
    const matchingRecent = recentSearches.filter(r => 
      r.toLowerCase().includes(inputLower)
    ).slice(0, 3).map(r => ({
      text: r,
      icon: '',
      action: 'search',
      fullCommand: r,
      isRecent: true
    }));

    setSuggestions([...commandSuggestions, ...matchingRecent]);
    setShowSuggestions(true);
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    generateSuggestions(value);
    setSelectedSuggestionIndex(-1);
    setSelectedAutocompleteIndex(-1);
    
    // Fetch autocomplete suggestions with debounce
    if (autocompleteDebounceRef.current) {
      clearTimeout(autocompleteDebounceRef.current);
    }
    
    if (value.length >= 2) {
      autocompleteDebounceRef.current = setTimeout(() => {
        fetchAutocomplete(value);
      }, 150); // 150ms debounce
    } else {
      setAutocompleteResults([]);
      setShowAutocomplete(false);
    }
  };
  
  // Fetch autocomplete suggestions from backend
  const fetchAutocomplete = async (query) => {
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('user_id', userName);
      formData.append('query', query);
      
      const response = await fetch(`${API_URL}/autocomplete`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      
      if (response.ok) {
        const data = await response.json();
        setAutocompleteResults(data.suggestions || []);
        setShowAutocomplete(true);
      }
    } catch (error) {
      console.error('Autocomplete error:', error);
    }
  };
  
  // Handle autocomplete item selection
  const handleAutocompleteSelect = (item) => {
    setSearchQuery(item.text);
    setShowAutocomplete(false);
    setAutocompleteResults([]);
    
    if (item.type === 'command') {
      handleSearch(item.text);
    } else if (item.type === 'content') {
      // Navigate directly to the content
      handleResultClick({ type: item.contentType, id: item.id, set_id: item.setId });
    } else {
      handleSearch(item.text);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    setSearchQuery(suggestion.fullCommand);
    setShowSuggestions(false);
    handleSearch(suggestion.fullCommand);
  };

  const handleSearch = async (query = searchQuery) => {
    console.log('🔍 handleSearch called with query:', query);
    if (!query.trim()) {
      console.log('⚠️ Empty query, returning');
      return;
    }

    console.log('🚀 Starting search...');
    setIsSearching(true);
    saveRecentSearch(query);

    try {
      const token = localStorage.getItem('token');
      console.log('🔑 Token exists:', !!token);
      console.log('👤 Username:', userName);
      
      // First, detect intent using AI
      console.log('🤖 Detecting intent...');
      const intentFormData = new FormData();
      intentFormData.append('user_id', userName);
      intentFormData.append('query', query);
      
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
      formData.append('user_id', userName);
      formData.append('query', query);
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
        
        // Set AI enhancement data
        setDidYouMean(data.did_you_mean || null);
        setRelatedSearches(data.related_searches || []);
        
        if (data.total_results === 0) {
          console.log('💡 No results, getting AI suggestion...');
          await getAiSuggestion(query);
        }
      }
    } catch (error) {
      console.error('❌ Error searching:', error);
      await getAiSuggestion(query);
    } finally {
      console.log('🏁 Search complete, setting isSearching to false');
      setIsSearching(false);
    }
  };
  
  const executeAction = async (intentData) => {
    console.log('⚡ executeAction called with:', intentData);
    const { action, parameters } = intentData;
    
    try {
      console.log('🎬 Executing action:', action);
      switch (action) {
        case 'create_note':
          console.log('📝 Creating note with title:', parameters.title);
          setIsCreating(true);
          setCreatingMessage('Creating note...');
          
          // Create the note via API first, then navigate to it
          try {
            const token = localStorage.getItem('token');
            const noteTitle = parameters.title || parameters.topic || 'New Note';
            const noteContent = parameters.content || '';
            
            console.log('🔑 Creating note with:', { noteTitle, noteContent, userName });
            
            const res = await fetch(`${API_URL}/create_note`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                user_id: userName,
                title: noteTitle,
                content: noteContent,
                folder_id: null
              })
            });
            
            console.log('📥 Create note response status:', res.status);
            
            if (res.ok) {
              const newNote = await res.json();
              console.log('✅ Note created:', newNote);
              setIsCreating(false);
              // Navigate to the editor with the new note ID
              navigate(`/notes/editor/${newNote.id}`);
            } else {
              const errorText = await res.text();
              console.error('❌ Failed to create note:', res.status, errorText);
              setIsCreating(false);
              // Fallback to notes hub
              navigate('/notes');
            }
          } catch (error) {
            console.error('❌ Error creating note:', error);
            setIsCreating(false);
            // Fallback to notes hub
            navigate('/notes');
          }
          break;
          
        case 'create_flashcards':
          console.log('🃏 Creating flashcard set with topic:', parameters.topic);
          setIsCreating(true);
          setCreatingMessage(`Creating ${parameters.count || 10} flashcards on ${parameters.topic}...`);
          
          // Create flashcard set via API first, then navigate to it
          try {
            const token = localStorage.getItem('token');
            const topic = parameters.topic || 'New Flashcard Set';
            const count = parameters.count || 10;
            
            console.log('🔑 Creating flashcard set with:', { topic, count, userName });
            
            // Call the generate_flashcards endpoint
            const formData = new FormData();
            formData.append('user_id', userName);
            formData.append('topic', topic);
            formData.append('card_count', count);
            formData.append('difficulty_level', 'medium');
            formData.append('depth_level', 'standard');
            formData.append('save_to_set', 'true');
            formData.append('set_title', topic);
            
            const res = await fetch(`${API_URL}/generate_flashcards`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`
              },
              body: formData
            });
            
            console.log('📥 Generate flashcards response status:', res.status);
            
            if (res.ok) {
              const data = await res.json();
              console.log('✅ Flashcard set created:', data);
              
              setIsCreating(false);
              setIsSearching(false);
              
              // Navigate to the specific flashcard set if set_id is returned
              if (data.set_id) {
                console.log('🚀 Navigating to flashcard set:', data.set_id);
                setTimeout(() => {
                  navigate(`/flashcards?set_id=${data.set_id}`);
                }, 100);
              } else {
                // Fallback to flashcards page
                console.log('🚀 Navigating to flashcards page');
                setTimeout(() => {
                  navigate('/flashcards');
                }, 100);
              }
            } else {
              const errorText = await res.text();
              console.error('❌ Failed to create flashcard set:', res.status, errorText);
              
              setIsCreating(false);
              setIsSearching(false);
              
              // Fallback to flashcards page
              navigate('/flashcards', { 
                state: { 
                  autoCreate: true,
                  topic: topic,
                  count: count
                } 
              });
            }
          } catch (error) {
            console.error('❌ Error creating flashcard set:', error);
            
            setIsCreating(false);
            setIsSearching(false);
            
            // Fallback to flashcards page
            navigate('/flashcards', { 
              state: { 
                autoCreate: true,
                topic: parameters.topic,
                count: parameters.count || 10
              } 
            });
          }
          break;
          
        case 'create_quiz':
          console.log('❓ Starting solo quiz');
          setIsCreating(true);
          setCreatingMessage(`Preparing quiz on ${parameters.topics?.[0] || 'selected topics'}...`);
          
          // Navigate to solo quiz with auto-start parameters
          setTimeout(() => {
            setIsCreating(false);
            navigate('/solo-quiz', { 
              state: { 
                autoStart: true,
                topics: parameters.topics || [],
                difficulty: parameters.difficulty || 'medium',
                questionCount: parameters.count || 10
              } 
            });
          }, 500);
          break;
          
        case 'start_chat':
          console.log('💬 Navigating to ai-chat');
          navigate('/ai-chat', { 
            state: { 
              initialMessage: parameters.message || parameters.topic
            } 
          });
          break;
          
        case 'review_flashcards':
          console.log('📚 Fetching flashcards for review');
          // Fetch flashcards that need review
          const token = localStorage.getItem('token');
          const reviewFormData = new FormData();
          reviewFormData.append('user_id', userName);
          reviewFormData.append('filter', parameters.filter || 'needs_review');
          
          const reviewResponse = await fetch(`${API_URL}/get_flashcards_for_review`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: reviewFormData
          });
          
          if (reviewResponse.ok) {
            const reviewData = await reviewResponse.json();
            if (reviewData.set_id) {
              console.log('✅ Navigating to flashcard set:', reviewData.set_id);
              navigate(`/flashcards?set_id=${reviewData.set_id}&review=true`);
            } else {
              console.log('✅ Setting search results with flashcards');
              setSearchResults({
                total_results: reviewData.flashcards?.length || 0,
                results: reviewData.flashcards || [],
                query: searchQuery,
                action_executed: 'review_flashcards'
              });
            }
          }
          break;
          
        case 'show_weak_areas':
          console.log('📊 Fetching weak areas');
          setIsCreating(true);
          setCreatingMessage('Analyzing your performance...');
          
          // Fetch user's weak areas and display them
          try {
            const weakToken = localStorage.getItem('token');
            const weakFormData = new FormData();
            weakFormData.append('user_id', userName);
            
            const weakResponse = await fetch(`${API_URL}/get_weak_areas`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${weakToken}` },
              body: weakFormData
            });
            
            if (weakResponse.ok) {
              const weakData = await weakResponse.json();
              console.log('✅ Weak areas data:', weakData);
              
              setIsCreating(false);
              setIsSearching(false);
              
              // Backend ALWAYS returns topics, so always display them
              setSearchResults({
                total_results: weakData.weak_areas?.length || 0,
                results: weakData.weak_areas || [],
                query: searchQuery,
                action_executed: 'show_weak_areas',
                show_as_suggestions: true  // Flag to show different UI
              });
            } else {
              console.error('❌ Failed to fetch weak areas');
              setIsCreating(false);
              setIsSearching(false);
            }
          } catch (error) {
            console.error('❌ Error fetching weak areas:', error);
            setIsCreating(false);
            setIsSearching(false);
          }
          break;
          
        case 'show_progress':
          navigate('/study-insights');
          break;
          
        case 'show_achievements':
          navigate('/study-insights');
          break;
        
        // NEW SMART FEATURES
        case 'suggest_study_next':
          console.log('🎯 Getting study suggestions');
          setIsCreating(true);
          setCreatingMessage('Analyzing what you should study next...');
          
          try {
            const token = localStorage.getItem('token');
            const formData = new FormData();
            formData.append('user_id', userName);
            
            const res = await fetch(`${API_URL}/suggest_study_next`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${token}` },
              body: formData
            });
            
            if (res.ok) {
              const data = await res.json();
              setIsCreating(false);
              setIsSearching(false);
              setSearchResults({
                total_results: data.suggestions?.length || 0,
                results: data.suggestions || [],
                query: searchQuery,
                action_executed: 'suggest_study_next'
              });
            }
          } catch (error) {
            console.error('Error getting suggestions:', error);
            setIsCreating(false);
            setIsSearching(false);
          }
          break;
        
        case 'summarize_notes':
          console.log('📝 Summarizing notes');
          setIsCreating(true);
          setCreatingMessage(`Summarizing notes${parameters.topic ? ` on ${parameters.topic}` : ''}...`);
          
          try {
            const token = localStorage.getItem('token');
            const formData = new FormData();
            formData.append('user_id', userName);
            if (parameters.topic) formData.append('topic', parameters.topic);
            
            const res = await fetch(`${API_URL}/summarize_notes`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${token}` },
              body: formData
            });
            
            if (res.ok) {
              const data = await res.json();
              setIsCreating(false);
              setIsSearching(false);
              // Show summary in AI suggestion area
              setAiSuggestion({
                description: data.summary,
                suggestions: []
              });
              setSearchResults({
                total_results: 0,
                results: [],
                query: searchQuery,
                action_executed: 'summarize_notes'
              });
            }
          } catch (error) {
            console.error('Error summarizing notes:', error);
            setIsCreating(false);
            setIsSearching(false);
          }
          break;
        
        case 'create_study_plan':
          console.log('📅 Creating study plan');
          setIsCreating(true);
          setCreatingMessage(`Creating study plan for ${parameters.topic || 'your goals'}...`);
          
          try {
            const token = localStorage.getItem('token');
            const formData = new FormData();
            formData.append('user_id', userName);
            formData.append('topic', parameters.topic || 'general studies');
            formData.append('duration', parameters.duration || 30);
            
            const res = await fetch(`${API_URL}/create_study_plan`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${token}` },
              body: formData
            });
            
            if (res.ok) {
              const data = await res.json();
              setIsCreating(false);
              setIsSearching(false);
              setAiSuggestion({
                description: data.plan,
                suggestions: []
              });
              setSearchResults({
                total_results: 0,
                results: [],
                query: searchQuery,
                action_executed: 'create_study_plan'
              });
            }
          } catch (error) {
            console.error('Error creating study plan:', error);
            setIsCreating(false);
            setIsSearching(false);
          }
          break;
        
        case 'search_recent':
          console.log('🕐 Searching recent content');
          setIsCreating(true);
          setCreatingMessage('Finding recent content...');
          
          try {
            const token = localStorage.getItem('token');
            const formData = new FormData();
            formData.append('user_id', userName);
            formData.append('timeframe', parameters.timeframe || 'recent');
            
            const res = await fetch(`${API_URL}/search_recent_content`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${token}` },
              body: formData
            });
            
            if (res.ok) {
              const data = await res.json();
              setIsCreating(false);
              setIsSearching(false);
              setSearchResults({
                total_results: data.results?.length || 0,
                results: data.results || [],
                query: searchQuery,
                action_executed: 'search_recent'
              });
            }
          } catch (error) {
            console.error('Error searching recent:', error);
            setIsCreating(false);
            setIsSearching(false);
          }
          break;
        
        case 'find_study_buddies':
          console.log('👥 Finding study buddies');
          navigate('/social');
          break;
        
        case 'challenge_friend':
          console.log('⚔️ Starting quiz battle');
          navigate('/quiz-battles');
          break;
        
        case 'show_popular_content':
          console.log('🔥 Showing popular content');
          setIsCreating(true);
          setCreatingMessage('Finding trending content...');
          
          try {
            const token = localStorage.getItem('token');
            const formData = new FormData();
            if (parameters.topic) formData.append('topic', parameters.topic);
            
            const res = await fetch(`${API_URL}/get_popular_content`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${token}` },
              body: formData
            });
            
            if (res.ok) {
              const data = await res.json();
              setIsCreating(false);
              setIsSearching(false);
              setSearchResults({
                total_results: data.content?.length || 0,
                results: data.content || [],
                query: searchQuery,
                action_executed: 'show_popular_content'
              });
            }
          } catch (error) {
            console.error('Error getting popular content:', error);
            setIsCreating(false);
            setIsSearching(false);
          }
          break;
        
        case 'recommend_topics':
        case 'schedule_study':
        case 'generate_practice_problems':
        case 'create_mind_map':
          // Navigate to AI chat with the query for these complex features
          navigate('/ai-chat', { 
            state: { 
              initialMessage: searchQuery
            } 
          });
          break;
        
        // NEW NLP ACTIONS
        case 'compare_topics':
          console.log('⚖️ Comparing topics:', parameters.topics);
          navigate('/ai-chat', { 
            state: { 
              initialMessage: `Compare and contrast: ${parameters.topics?.join(' vs ') || searchQuery}`
            } 
          });
          break;
        
        case 'explain_like_im_five':
          console.log('👶 ELI5:', parameters.topic);
          navigate('/ai-chat', { 
            state: { 
              initialMessage: `Explain ${parameters.topic || searchQuery} like I'm 5 years old. Use simple words and fun analogies.`
            } 
          });
          break;
        
        case 'give_examples':
          console.log('📝 Giving examples:', parameters.topic);
          navigate('/ai-chat', { 
            state: { 
              initialMessage: `Give me ${parameters.count || 5} clear examples of ${parameters.topic || searchQuery}`
            } 
          });
          break;
        
        case 'test_me':
          console.log('📝 Testing on:', parameters.topic);
          navigate('/solo-quiz', { 
            state: { 
              autoStart: true,
              topics: [parameters.topic],
              difficulty: parameters.difficulty || 'medium',
              questionCount: 5
            } 
          });
          break;
        
        case 'define':
          console.log('📖 Defining:', parameters.term);
          navigate('/ai-chat', { 
            state: { 
              initialMessage: `Define "${parameters.term || searchQuery}" clearly and concisely. Include etymology if interesting.`
            } 
          });
          break;
        
        case 'list_prerequisites':
          console.log('📋 Prerequisites for:', parameters.topic);
          navigate('/ai-chat', { 
            state: { 
              initialMessage: `What are the prerequisites I need to know before learning ${parameters.topic || searchQuery}? List them in order from basic to advanced.`
            } 
          });
          break;
        
        case 'suggest_resources':
          console.log('📚 Resources for:', parameters.topic);
          navigate('/ai-chat', { 
            state: { 
              initialMessage: `Suggest the best learning resources for ${parameters.topic || searchQuery}. Include books, websites, videos, and courses.`
            } 
          });
          break;
        
        case 'practice_problems':
          console.log('✏️ Practice problems for:', parameters.topic);
          navigate('/ai-chat', { 
            state: { 
              initialMessage: `Give me ${parameters.count || 5} ${parameters.difficulty || 'medium'} difficulty practice problems on ${parameters.topic || searchQuery}. Include solutions.`
            } 
          });
          break;
        
        case 'summarize_topic':
          console.log('📄 Summarizing:', parameters.topic);
          const lengthMap = { short: '2-3 sentences', medium: '1 paragraph', long: '3-4 paragraphs' };
          navigate('/ai-chat', { 
            state: { 
              initialMessage: `Summarize ${parameters.topic || searchQuery} in ${lengthMap[parameters.length] || '1 paragraph'}.`
            } 
          });
          break;
        
        case 'show_statistics':
          console.log('📊 Showing statistics');
          navigate('/study-insights');
          break;
        
        case 'set_goal':
          console.log('🎯 Setting goal:', parameters.goal);
          navigate('/dashboard', { 
            state: { 
              openGoalModal: true,
              goalText: parameters.goal,
              deadline: parameters.deadline
            } 
          });
          break;
        
        case 'remind_me':
          console.log('⏰ Setting reminder:', parameters.topic);
          setAiSuggestion({
            description: `I'll remind you to study ${parameters.topic}${parameters.time ? ` ${parameters.time}` : ''}. Reminders feature coming soon!`,
            suggestions: []
          });
          setSearchResults({
            total_results: 0,
            results: [],
            query: searchQuery,
            action_executed: 'remind_me'
          });
          setIsSearching(false);
          break;
        
        case 'export_content':
          console.log('📤 Exporting content');
          navigate('/settings', { 
            state: { 
              tab: 'export',
              contentType: parameters.content_type,
              topic: parameters.topic
            } 
          });
          break;
        
        case 'how_to':
          console.log('📝 How to:', parameters.task);
          navigate('/ai-chat', { 
            state: { 
              initialMessage: `How do I ${parameters.task || searchQuery}? Give me step-by-step instructions.`
            } 
          });
          break;
        
        case 'pros_and_cons':
          console.log('⚖️ Pros and cons:', parameters.topic);
          navigate('/ai-chat', { 
            state: { 
              initialMessage: `List the pros and cons of ${parameters.topic || searchQuery} in a clear table format.`
            } 
          });
          break;
        
        case 'timeline':
          console.log('📅 Timeline:', parameters.topic);
          navigate('/ai-chat', { 
            state: { 
              initialMessage: `Create a timeline of key events for ${parameters.topic || searchQuery}. Include dates and brief descriptions.`
            } 
          });
          break;
        
        case 'mind_map':
          console.log('🧠 Mind map:', parameters.topic);
          navigate('/ai-chat', { 
            state: { 
              initialMessage: `Create a text-based mind map for ${parameters.topic || searchQuery}. Show the main concept in the center with branches to related subtopics.`
            } 
          });
          break;
        
        case 'daily_review':
        case 'whats_due':
          console.log('📚 Daily review / What\'s due');
          setIsCreating(true);
          setCreatingMessage('Finding items due for review...');
          
          try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/adaptive/retention?user_id=${userName}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (res.ok) {
              const data = await res.json();
              setIsCreating(false);
              setIsSearching(false);
              
              const reviewResults = (data.due_reviews || []).map((review, idx) => ({
                id: `review_${idx}`,
                type: 'review_item',
                title: review.topic,
                description: `Mastery: ${(review.mastery_level * 100).toFixed(0)}% | ${review.days_overdue} days overdue`,
                priority: review.priority
              }));
              
              setAiSuggestion({
                description: reviewResults.length > 0 
                  ? `You have ${reviewResults.length} topics due for review today.`
                  : `Great job! You're all caught up. Nothing due for review right now.`,
                suggestions: []
              });
              
              setSearchResults({
                total_results: reviewResults.length,
                results: reviewResults,
                query: searchQuery,
                action_executed: 'whats_due'
              });
            }
          } catch (error) {
            console.error('Error getting due items:', error);
            setIsCreating(false);
            setIsSearching(false);
          }
          break;
        
        case 'random_flashcard':
          console.log('🎲 Random flashcard');
          navigate('/flashcards', { 
            state: { 
              randomMode: true,
              topic: parameters.topic
            } 
          });
          break;
        
        // ADAPTIVE LEARNING FEATURES
        case 'adapt_difficulty':
          console.log('🎯 Adapting difficulty level');
          setIsCreating(true);
          setCreatingMessage('Analyzing your performance...');
          
          try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/adaptive/difficulty?user_id=${userName}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (res.ok) {
              const data = await res.json();
              setIsCreating(false);
              setIsSearching(false);
              setAiSuggestion({
                description: `Your content difficulty has been adapted to ${data.difficulty_level} level. ${data.message}`,
                suggestions: []
              });
              setSearchResults({
                total_results: 0,
                results: [],
                query: searchQuery,
                action_executed: 'adapt_difficulty'
              });
            }
          } catch (error) {
            console.error('Error adapting difficulty:', error);
            setIsCreating(false);
            setIsSearching(false);
          }
          break;
        
        case 'show_learning_style':
          console.log('🧠 Detecting learning style');
          setIsCreating(true);
          setCreatingMessage('Analyzing your learning patterns...');
          
          try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/adaptive/learning-style?user_id=${userName}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (res.ok) {
              const data = await res.json();
              setIsCreating(false);
              setIsSearching(false);
              
              const styleBreakdown = Object.entries(data.style_breakdown)
                .map(([style, score]) => `${style}: ${(score * 100).toFixed(0)}%`)
                .join(', ');
              
              setAiSuggestion({
                description: `Your dominant learning style is ${data.learning_style}. Breakdown: ${styleBreakdown}`,
                suggestions: data.adaptations.format_hints || []
              });
              setSearchResults({
                total_results: 0,
                results: [],
                query: searchQuery,
                action_executed: 'show_learning_style'
              });
            }
          } catch (error) {
            console.error('Error detecting learning style:', error);
            setIsCreating(false);
            setIsSearching(false);
          }
          break;
        
        case 'show_knowledge_gaps':
          console.log('🕳️ Finding knowledge gaps');
          setIsCreating(true);
          setCreatingMessage('Analyzing your knowledge blind spots...');
          
          try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/adaptive/knowledge-gaps?user_id=${userName}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (res.ok) {
              const data = await res.json();
              setIsCreating(false);
              setIsSearching(false);
              
              const gapResults = data.knowledge_gaps.map(gap => ({
                id: gap.topic,
                type: 'knowledge_gap',
                title: gap.topic,
                description: `Mastery: ${(gap.mastery_level * 100).toFixed(0)}% | Severity: ${gap.gap_severity}`,
                severity: gap.gap_severity,
                remediation: gap.remediation
              }));
              
              setSearchResults({
                total_results: gapResults.length,
                results: gapResults,
                query: searchQuery,
                action_executed: 'show_knowledge_gaps'
              });
            }
          } catch (error) {
            console.error('Error finding knowledge gaps:', error);
            setIsCreating(false);
            setIsSearching(false);
          }
          break;
        
        case 'create_curriculum':
          console.log('📚 Creating personalized curriculum');
          setIsCreating(true);
          setCreatingMessage(`Building personalized curriculum for ${parameters.topic}...`);
          
          try {
            const token = localStorage.getItem('token');
            const res = await fetch(
              `${API_URL}/adaptive/curriculum?user_id=${userName}&goal_topic=${parameters.topic}`,
              { headers: { 'Authorization': `Bearer ${token}` } }
            );
            
            if (res.ok) {
              const data = await res.json();
              setIsCreating(false);
              setIsSearching(false);
              
              const curriculumResults = data.curriculum.map((item, idx) => ({
                id: `curriculum_${idx}`,
                type: 'curriculum_item',
                title: item.topic,
                description: `${item.type} | Current: ${(item.current_mastery * 100).toFixed(0)}% → Target: ${(item.target_mastery * 100).toFixed(0)}% | ${item.estimated_hours}h`,
                priority: item.priority,
                curriculum_type: item.type
              }));
              
              setSearchResults({
                total_results: curriculumResults.length,
                results: curriculumResults,
                query: searchQuery,
                action_executed: 'create_curriculum'
              });
            }
          } catch (error) {
            console.error('Error creating curriculum:', error);
            setIsCreating(false);
            setIsSearching(false);
          }
          break;
        
        case 'optimize_retention':
          console.log('🎯 Optimizing retention');
          setIsCreating(true);
          setCreatingMessage('Analyzing your retention patterns...');
          
          try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/adaptive/retention?user_id=${userName}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (res.ok) {
              const data = await res.json();
              setIsCreating(false);
              setIsSearching(false);
              
              const reviewResults = data.due_reviews.map((review, idx) => ({
                id: `review_${idx}`,
                type: 'review_item',
                title: review.topic,
                description: `Mastery: ${(review.mastery_level * 100).toFixed(0)}% | ${review.days_overdue} days overdue`,
                priority: review.priority
              }));
              
              setSearchResults({
                total_results: reviewResults.length,
                results: reviewResults,
                query: searchQuery,
                action_executed: 'optimize_retention'
              });
            }
          } catch (error) {
            console.error('Error optimizing retention:', error);
            setIsCreating(false);
            setIsSearching(false);
          }
          break;
        
        case 'predict_forgetting':
          console.log('🔮 Predicting forgetting');
          setIsCreating(true);
          setCreatingMessage('Predicting what you\'ll forget next...');
          
          try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/adaptive/predict-forgetting?user_id=${userName}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (res.ok) {
              const data = await res.json();
              setIsCreating(false);
              setIsSearching(false);
              
              if (data.prediction) {
                setAiSuggestion({
                  description: data.message,
                  suggestions: [`review ${data.prediction.topic}`, `create flashcards on ${data.prediction.topic}`]
                });
              } else {
                setAiSuggestion({
                  description: data.message,
                  suggestions: []
                });
              }
              
              setSearchResults({
                total_results: 0,
                results: [],
                query: searchQuery,
                action_executed: 'predict_forgetting'
              });
            }
          } catch (error) {
            console.error('Error predicting forgetting:', error);
            setIsCreating(false);
            setIsSearching(false);
          }
          break;
        
        case 'detect_burnout':
          console.log('⚡ Detecting burnout risk');
          setIsCreating(true);
          setCreatingMessage('Analyzing your study patterns...');
          
          try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/adaptive/burnout-risk?user_id=${userName}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (res.ok) {
              const data = await res.json();
              setIsCreating(false);
              setIsSearching(false);
              
              const analysis = data.burnout_analysis;
              const recommendations = analysis.recommendations.join(', ');
              
              setAiSuggestion({
                description: `Burnout Risk: ${analysis.risk_level.toUpperCase()} (${(analysis.risk_score * 100).toFixed(0)}%). ${recommendations}`,
                suggestions: analysis.recommendations.slice(0, 3)
              });
              
              setSearchResults({
                total_results: 0,
                results: [],
                query: searchQuery,
                action_executed: 'detect_burnout'
              });
            }
          } catch (error) {
            console.error('Error detecting burnout:', error);
            setIsCreating(false);
            setIsSearching(false);
          }
          break;
        
        case 'suggest_breaks':
          console.log('☕ Suggesting break times');
          setIsCreating(true);
          setCreatingMessage('Calculating optimal break schedule...');
          
          try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/adaptive/break-schedule?user_id=${userName}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (res.ok) {
              const data = await res.json();
              setIsCreating(false);
              setIsSearching(false);
              
              const breakSchedule = data.break_schedule
                .map(b => `Take a ${b.break_duration}min break after ${b.after_minutes}min`)
                .join(', ');
              
              setAiSuggestion({
                description: `Optimal break schedule: ${breakSchedule}. ${data.message}`,
                suggestions: []
              });
              
              setSearchResults({
                total_results: 0,
                results: [],
                query: searchQuery,
                action_executed: 'suggest_breaks'
              });
            }
          } catch (error) {
            console.error('Error suggesting breaks:', error);
            setIsCreating(false);
            setIsSearching(false);
          }
          break;
        
        case 'predict_focus':
          console.log('🎯 Predicting focus level');
          const currentHour = new Date().getHours();
          setIsCreating(true);
          setCreatingMessage('Analyzing your focus patterns...');
          
          try {
            const token = localStorage.getItem('token');
            const res = await fetch(
              `${API_URL}/adaptive/focus-prediction?user_id=${userName}&time_of_day=${currentHour}`,
              { headers: { 'Authorization': `Bearer ${token}` } }
            );
            
            if (res.ok) {
              const data = await res.json();
              setIsCreating(false);
              setIsSearching(false);
              
              const prediction = data.focus_prediction;
              setAiSuggestion({
                description: `Your predicted focus level right now: ${(prediction.predicted_focus * 100).toFixed(0)}%. Peak hour: ${prediction.peak_hour}:00. This time is ${prediction.recommendation} for studying.`,
                suggestions: []
              });
              
              setSearchResults({
                total_results: 0,
                results: [],
                query: searchQuery,
                action_executed: 'predict_focus'
              });
            }
          } catch (error) {
            console.error('Error predicting focus:', error);
            setIsCreating(false);
            setIsSearching(false);
          }
          break;
        
        case 'find_study_twin':
          console.log('👥 Finding study twin');
          setIsCreating(true);
          setCreatingMessage('Finding your perfect study partner...');
          
          try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/adaptive/study-twin?user_id=${userName}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (res.ok) {
              const data = await res.json();
              setIsCreating(false);
              setIsSearching(false);
              
              if (data.study_twin) {
                setAiSuggestion({
                  description: `${data.message} ${data.study_twin.name} (${(data.study_twin.similarity_score * 100).toFixed(0)}% match)`,
                  suggestions: ['find complementary learners', 'challenge friend to quiz']
                });
              } else {
                setAiSuggestion({
                  description: data.message,
                  suggestions: []
                });
              }
              
              setSearchResults({
                total_results: 0,
                results: [],
                query: searchQuery,
                action_executed: 'find_study_twin'
              });
            }
          } catch (error) {
            console.error('Error finding study twin:', error);
            setIsCreating(false);
            setIsSearching(false);
          }
          break;
        
        case 'find_complementary':
          console.log('🤝 Finding complementary learners');
          setIsCreating(true);
          setCreatingMessage('Finding learners with complementary strengths...');
          
          try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/adaptive/complementary-learners?user_id=${userName}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (res.ok) {
              const data = await res.json();
              setIsCreating(false);
              setIsSearching(false);
              
              const learnerResults = data.complementary_learners.map((learner, idx) => ({
                id: `learner_${idx}`,
                type: 'complementary_learner',
                title: learner.name,
                description: `Can help you with: ${learner.can_help_you_with.join(', ')} | You can help with: ${learner.you_can_help_with.join(', ')}`,
                synergy_score: learner.synergy_score
              }));
              
              setSearchResults({
                total_results: learnerResults.length,
                results: learnerResults,
                query: searchQuery,
                action_executed: 'find_complementary'
              });
            }
          } catch (error) {
            console.error('Error finding complementary learners:', error);
            setIsCreating(false);
            setIsSearching(false);
          }
          break;
        
        case 'tutor_step_by_step':
        case 'create_analogies':
        case 'simplify_content':
          // These use AI tutor modes - navigate to chat with special mode
          navigate('/ai-chat', { 
            state: { 
              initialMessage: searchQuery,
              tutorMode: action
            } 
          });
          break;
          
        default:
          // Unknown action, perform regular search
          setIsSearching(false);
          handleSearch(searchQuery);
      }
    } catch (error) {
      console.error('Error executing action:', error);
      setIsSearching(false);
    }
  };

  const getAiSuggestion = async (query) => {
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('user_id', userName);
      formData.append('query', query);

      const response = await fetch(`${API_URL}/get_search_suggestion`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        setAiSuggestion(data);
      }
    } catch (error) {
      console.error('Error getting AI suggestion:', error);
      setAiSuggestion({
        description: `It looks like you're searching for "${query}". This could be a great topic to explore!`,
        suggestions: []
      });
    }
  };

  const handleCreateContent = (type) => {
    switch (type) {
      case 'flashcards':
        // Show loading state like adaptive learning does
        setIsCreating(true);
        setIsSearching(true);
        setCreatingMessage(`Creating flashcards on ${searchQuery || 'this topic'}...`);
        
        // Create flashcard set via API
        (async () => {
          try {
            const token = localStorage.getItem('token');
            const topic = searchQuery || 'New Flashcard Set';
            const count = 10;
            
            const formData = new FormData();
            formData.append('user_id', userName);
            formData.append('topic', topic);
            formData.append('card_count', count);
            formData.append('difficulty_level', 'medium');
            formData.append('depth_level', 'standard');
            formData.append('save_to_set', 'true');
            formData.append('set_title', topic);
            
            const res = await fetch(`${API_URL}/generate_flashcards`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${token}` },
              body: formData
            });
            
            if (res.ok) {
              const data = await res.json();
              setIsCreating(false);
              setIsSearching(false);
              
              if (data.set_id) {
                navigate(`/flashcards?set_id=${data.set_id}`);
              } else {
                navigate('/flashcards');
              }
            } else {
              setIsCreating(false);
              setIsSearching(false);
              navigate('/flashcards', { state: { autoCreate: true, topic, count } });
            }
          } catch (error) {
            console.error('Error creating flashcard set:', error);
            setIsCreating(false);
            setIsSearching(false);
            navigate('/flashcards', { state: { autoCreate: true, topic: searchQuery, count: 10 } });
          }
        })();
        break;
      case 'notes':
        navigate('/notes', { state: { topic: searchQuery } });
        break;
      case 'ai-chat':
        navigate('/ai-chat', { state: { initialMessage: searchQuery } });
        break;
      default:
        break;
    }
  };

  const handleResultClick = (result) => {
    console.log('Clicked result:', result); // Debug log
    switch (result.type) {
      case 'flashcard':
      case 'flashcard_set':
        navigate(`/flashcards?set_id=${result.id}`);
        break;
      case 'note':
        navigate(`/my-notes?note_id=${result.id}`);
        break;
      case 'deck':
        navigate(`/flashcards?set_id=${result.id}`);
        break;
      case 'chat':
        navigate(`/ai-chat?session_id=${result.id}`);
        break;
      case 'question_set':
        navigate(`/question-bank?set_id=${result.id}`);
        break;
      default:
        console.log('Unknown result type:', result.type);
        break;
    }
  };

  // Handle smart action clicks on search results
  const handleSmartAction = (e, result, action) => {
    e.stopPropagation(); // Prevent triggering the card click
    
    switch (action.action) {
      case 'study':
      case 'view_set':
        navigate(`/flashcards?set_id=${result.set_id || result.id}`);
        break;
      case 'quiz':
        navigate('/solo-quiz', { 
          state: { 
            autoStart: true,
            topics: [result.title || result.set_name],
            fromSearch: true
          } 
        });
        break;
      case 'review':
        navigate(`/flashcards?set_id=${result.set_id || result.id}&review=true`);
        break;
      case 'edit':
        navigate(`/notes/editor/${result.id}`);
        break;
      case 'create_flashcards':
        navigate('/flashcards', { 
          state: { 
            autoCreate: true,
            topic: result.title,
            fromNote: result.type === 'note' ? result.id : null
          } 
        });
        break;
      case 'summarize':
        navigate('/ai-chat', { 
          state: { 
            initialMessage: `Summarize my note titled "${result.title}"`
          } 
        });
        break;
      case 'continue':
        navigate(`/ai-chat?session_id=${result.id}`);
        break;
      case 'start_quiz':
      case 'practice':
        navigate(`/solo-quiz`, { 
          state: { 
            questionSetId: result.id,
            autoStart: true
          } 
        });
        break;
      default:
        console.log('Unknown smart action:', action.action);
    }
  };

  // Get icon for smart action
  const getSmartActionIcon = (iconName) => {
    switch (iconName) {
      case 'play': return <Play size={14} />;
      case 'help-circle': return <HelpCircle size={14} />;
      case 'refresh-cw': return <RefreshCw size={14} />;
      case 'edit': return <Edit size={14} />;
      case 'layers': return <Layers size={14} />;
      case 'file-text': return <FileText size={14} />;
      case 'message-circle': return <MessageCircle size={14} />;
      case 'target': return <Target size={14} />;
      default: return <ChevronRight size={14} />;
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults(null);
    setAiSuggestion(null);
    setDidYouMean(null);
    setRelatedSearches([]);
    setShowFilters(false);
    setFilters({
      content_types: 'all',
      sort_by: 'relevance',
      date_from: '',
      date_to: ''
    });
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };
  
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };
  
  const applyFilters = () => {
    handleSearch(searchQuery);
    setShowFilters(false);
  };
  
  const clearFilters = () => {
    setFilters({
      content_types: 'all',
      sort_by: 'relevance',
      date_from: '',
      date_to: ''
    });
    handleSearch(searchQuery);
  };
  
  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.content_types !== 'all') count++;
    if (filters.sort_by !== 'relevance') count++;
    if (filters.date_from) count++;
    if (filters.date_to) count++;
    return count;
  };

  const handleKeyDown = (e) => {
    // Handle autocomplete navigation first
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
        handleAutocompleteSelect(autocompleteResults[selectedAutocompleteIndex]);
        return;
      } else if (e.key === 'Escape') {
        setShowAutocomplete(false);
        setSelectedAutocompleteIndex(-1);
        return;
      } else if (e.key === 'Tab' && selectedAutocompleteIndex >= 0) {
        e.preventDefault();
        setSearchQuery(autocompleteResults[selectedAutocompleteIndex].text);
        setShowAutocomplete(false);
        return;
      }
    }
    
    if (e.key === 'Enter') {
      if (selectedSuggestionIndex >= 0 && suggestions[selectedSuggestionIndex]) {
        // Use selected suggestion
        handleSuggestionClick(suggestions[selectedSuggestionIndex]);
      } else {
        // Regular search
        handleSearch();
      }
      setShowSuggestions(false);
      setShowAutocomplete(false);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setShowAutocomplete(false);
      setSelectedSuggestionIndex(-1);
      setSelectedAutocompleteIndex(-1);
    }
  };

  const getResultIcon = (type) => {
    switch (type) {
      case 'flashcard':
      case 'deck':
        return <Layers size={20} />;
      case 'note':
        return <FileText size={20} />;
      case 'chat':
        return <Sparkles size={20} />;
      default:
        return <BookOpen size={20} />;
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  const handleThemeChange = (themeId) => {
    changeTheme(themeId);
    setShowThemeSelector(false);
  };

  return (
    <div className="search-hub-page">
      {/* Header */}
      <header className="search-hub-header">
        <div className="header-content">
          <button 
            className="theme-selector-btn" 
            onClick={() => setShowThemeSelector(!showThemeSelector)}
          >
            <Palette size={16} />
            Theme
          </button>
          <button className="dashboard-btn" onClick={() => navigate('/study-insights')}>
            Dashboard
          </button>
          {showThemeSelector && (
            <div className="theme-selector-dropdown">
              <div className="theme-section">
                <h4>Dark Themes</h4>
                <div className="theme-grid">
                  {Object.values(THEMES).filter(t => t.mode === 'dark').map(theme => (
                    <button
                      key={theme.id}
                      className={`theme-option theme-option-dark ${selectedTheme === theme.id ? 'active' : ''}`}
                      onClick={() => handleThemeChange(theme.id)}
                      style={{ 
                        '--theme-primary': '#0b0b0c',
                        '--theme-accent': theme.accent
                      }}
                    >
                      <span className="sparkle"></span>
                      <span className="sparkle"></span>
                      <span className="sparkle"></span>
                      {theme.name}
                      <div className="theme-colors">
                        <div className="theme-color-dot theme-color-primary" style={{ background: '#0b0b0c' }}></div>
                        <div className="theme-color-dot theme-color-accent" style={{ background: theme.accent }}></div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="theme-section">
                <h4>Light Themes</h4>
                <div className="theme-grid">
                  {Object.values(THEMES).filter(t => t.mode === 'light').map(theme => (
                    <button
                      key={theme.id}
                      className={`theme-option theme-option-light ${selectedTheme === theme.id ? 'active' : ''}`}
                      onClick={() => handleThemeChange(theme.id)}
                      style={{ 
                        '--theme-primary': '#fefefe',
                        '--theme-accent': theme.accent
                      }}
                    >
                      <span className="sparkle"></span>
                      <span className="sparkle"></span>
                      <span className="sparkle"></span>
                      {theme.name}
                      <div className="theme-colors">
                        <div className="theme-color-dot theme-color-primary" style={{ background: '#fefefe' }}></div>
                        <div className="theme-color-dot theme-color-accent" style={{ background: theme.accent }}></div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="search-hub-main">
        {isCreating ? (
          /* Creating Content Loading */
          <div className="creating-content">
            <div className="creating-content-container">
              <div className="pulse-loader">
                <div className="pulse-square pulse-1"></div>
                <div className="pulse-square pulse-2"></div>
                <div className="pulse-square pulse-3"></div>
              </div>
              <h2>{creatingMessage}</h2>
              <p>Please wait while we generate your content...</p>
            </div>
          </div>
        ) : !searchResults ? (
          /* Search Home */
          <div className="search-home">
            <div className="search-home-content">
              {/* Logo */}
              <h1 className="search-logo">
                <span className="logo-c">C</span>
                <span className="logo-e">e</span>
                <span className="logo-r">r</span>
                <span className="logo-b">b</span>
                <span className="logo-y">y</span>
                <span className="logo-l">l</span>
              </h1>
              <p className="search-tagline">Search for anything you created or any other user created and made public</p>

              {/* Search Box */}
              <div className="search-box-container">
                <div className="search-box-wrapper">
                  <Search className="search-icon" size={20} />
                  <input
                    ref={searchInputRef}
                    type="text"
                    className="search-input"
                    placeholder="Search for anything..."
                    value={searchQuery}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    onFocus={() => searchQuery.length >= 2 && setShowAutocomplete(true)}
                    onBlur={() => setTimeout(() => setShowAutocomplete(false), 200)}
                    autoComplete="off"
                  />
                  
                  {/* Autocomplete Dropdown */}
                  {showAutocomplete && autocompleteResults.length > 0 && (
                    <div className="autocomplete-dropdown">
                      {autocompleteResults.map((item, index) => (
                        <div
                          key={index}
                          className={`autocomplete-item ${selectedAutocompleteIndex === index ? 'selected' : ''} ${item.type}`}
                          onClick={() => handleAutocompleteSelect(item)}
                          onMouseEnter={() => setSelectedAutocompleteIndex(index)}
                        >
                          <div className="autocomplete-icon">
                            {item.type === 'command' && <Sparkles size={16} />}
                            {item.type === 'content' && <FileText size={16} />}
                            {item.type === 'recent' && <Clock size={16} />}
                            {item.type === 'suggestion' && <Search size={16} />}
                          </div>
                          <div className="autocomplete-content">
                            <span className="autocomplete-text">{item.text}</span>
                            {item.subtext && <span className="autocomplete-subtext">{item.subtext}</span>}
                          </div>
                          {item.type === 'command' && <span className="autocomplete-badge">Command</span>}
                          {item.type === 'content' && <span className="autocomplete-badge content">{item.contentType}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className="search-actions">
                  <button className="search-btn" onClick={() => handleSearch()} disabled={!searchQuery.trim()}>
                    Cerbyl Search
                  </button>
                </div>
              </div>

              {/* Sample Prompts - Personalized */}
              <div className="sample-prompts">
                <div className="section-header">
                  <Sparkles size={18} />
                  <h3>{personalizedPrompts.length > 0 ? 'Recommended For You' : 'Try These Adaptive Learning Commands'}</h3>
                </div>
                <div className="prompt-grid">
                  {(personalizedPrompts.length > 0 ? personalizedPrompts : [
                    { text: 'adapt difficulty to my level', reason: 'Auto-adjust content difficulty', priority: 'high' },
                    { text: 'what is my learning style', reason: 'AI detects your preferences', priority: 'high' },
                    { text: 'show knowledge gaps', reason: 'Find your blind spots', priority: 'high' },
                    { text: 'optimize my retention', reason: 'Spaced repetition schedule', priority: 'medium' },
                    { text: 'what will I forget next', reason: 'Predict forgetting curve', priority: 'medium' },
                    { text: 'detect my burnout risk', reason: 'Mental health monitoring', priority: 'medium' },
                    { text: 'find my study twin', reason: 'Match with similar learners', priority: 'low' },
                    { text: 'suggest break times', reason: 'Optimal rest periods', priority: 'low' },
                    { text: 'create flashcards on machine learning', reason: null, priority: 'low' },
                    { text: 'explain neural networks step-by-step', reason: 'Structured learning', priority: 'low' },
                  ]).map((prompt, index) => {
                    // Ensure text and reason are strings, not objects
                    const promptText = typeof prompt.text === 'string' ? prompt.text : (prompt.text?.label || 'Unknown');
                    const promptReason = typeof prompt.reason === 'string' ? prompt.reason : (prompt.reason?.label || null);
                    
                    return (
                      <button
                        key={index}
                        className={`prompt-card ${prompt.priority || ''}`}
                        onClick={() => {
                          setSearchQuery(promptText);
                          handleSearch(promptText);
                        }}
                        title={promptReason || ''}
                      >
                        {prompt.priority === 'high' && <Sparkles size={16} />}
                        <span>{promptText}</span>
                        {promptReason && <span className="prompt-reason">{promptReason}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Search Results */
          <div className="search-results">
            <div className="results-container">
              {/* Search Header */}
              <div className="results-header">
                <button className="back-btn-compact" onClick={clearSearch}>
                  Back
                </button>
                <button 
                  className={`filter-btn ${getActiveFilterCount() > 0 ? 'active' : ''}`}
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <Filter size={20} />
                  Filters
                  {getActiveFilterCount() > 0 && (
                    <span className="filter-badge">{getActiveFilterCount()}</span>
                  )}
                </button>
              </div>

              {/* Filter Panel */}
              {showFilters && (
                <div className="filter-panel">
                  <div className="filter-section">
                    <label>Content Type</label>
                    <select 
                      value={filters.content_types}
                      onChange={(e) => handleFilterChange('content_types', e.target.value)}
                    >
                      <option value="all">All Content</option>
                      <option value="flashcard_set">Flashcard Sets</option>
                      <option value="flashcard">Individual Flashcards</option>
                      <option value="note">Notes</option>
                      <option value="chat">Chat Sessions</option>
                      <option value="question_set">Question Sets</option>
                      <option value="flashcard_set,flashcard">All Flashcards</option>
                      <option value="note,chat">Notes & Chats</option>
                    </select>
                  </div>

                  <div className="filter-section">
                    <label>Sort By</label>
                    <select 
                      value={filters.sort_by}
                      onChange={(e) => handleFilterChange('sort_by', e.target.value)}
                    >
                      <option value="relevance">Relevance</option>
                      <option value="date_desc">Newest First</option>
                      <option value="date_asc">Oldest First</option>
                      <option value="title_asc">Title (A-Z)</option>
                      <option value="title_desc">Title (Z-A)</option>
                    </select>
                  </div>

                  <div className="filter-section">
                    <label>Date Range</label>
                    <div className="date-range-inputs">
                      <div className="date-input-group">
                        <Calendar size={16} />
                        <input
                          type="date"
                          value={filters.date_from}
                          onChange={(e) => handleFilterChange('date_from', e.target.value)}
                          placeholder="From"
                        />
                      </div>
                      <span className="date-separator">to</span>
                      <div className="date-input-group">
                        <Calendar size={16} />
                        <input
                          type="date"
                          value={filters.date_to}
                          onChange={(e) => handleFilterChange('date_to', e.target.value)}
                          placeholder="To"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="filter-actions">
                    <button className="clear-filters-btn" onClick={clearFilters}>
                      Clear All
                    </button>
                    <button className="apply-filters-btn" onClick={applyFilters}>
                      Apply Filters
                    </button>
                  </div>
                </div>
              )}

              {isSearching ? (
                <div className="loading-state">
                  <div className="pulse-loader">
                    <div className="pulse-square pulse-1"></div>
                    <div className="pulse-square pulse-2"></div>
                    <div className="pulse-square pulse-3"></div>
                  </div>
                  <p>Searching...</p>
                </div>
              ) : searchResults.total_results > 0 ? (
                <>
                  <div className="results-info">
                    {searchResults.action_executed === 'show_weak_areas' ? (
                      <p>
                        {searchResults.results.some(r => r.type === 'weak_area' || r.type === 'flashcard_set') ? (
                          <>Found <strong>{searchResults.total_results}</strong> areas that need attention</>
                        ) : (
                          <>Here are <strong>{searchResults.total_results}</strong> personalized suggestions for you</>
                        )}
                      </p>
                    ) : (
                      <p>Found <strong>{searchResults.total_results}</strong> results for "<strong>{searchQuery}</strong>"</p>
                    )}
                  </div>

                  {/* Results Grid */}
                  <div className="results-grid">
                    {searchResults.results.map((result, index) => (
                      <div
                        key={index}
                        className="result-card"
                        onClick={() => handleResultClick(result)}
                      >
                        <div className="result-icon">
                          {getResultIcon(result.type)}
                        </div>
                        <div className="result-content">
                          <div className="result-header">
                            <h3>{result.title}</h3>
                          </div>
                          {result.description && (
                            <p className="result-description">{result.description}</p>
                          )}
                          <div className="result-meta">
                            {result.author && (
                              <span className="result-author">
                                <Users size={14} />
                                {result.author === userName ? 'You' : result.author}
                              </span>
                            )}
                            {result.visibility && (
                              <span className={`result-visibility ${result.visibility}`}>
                                {result.visibility}
                              </span>
                            )}
                            {result.created_at && (
                              <span className="result-date">
                                <Clock size={14} />
                                {formatDate(result.created_at)}
                              </span>
                            )}
                          </div>
                          <span className="result-type">{result.type}</span>
                          
                          {/* Smart Actions */}
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
                  
                  {/* Related Searches */}
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
              ) : aiSuggestion && searchResults.action_executed ? (
                /* AI-Only Response (no search results needed) */
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
                /* No Results - Search yielded nothing */
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
                  
                  {/* Did You Mean suggestion */}
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
    </div>
  );
};

export default SearchHub;
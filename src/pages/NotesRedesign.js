import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ReactQuill, { Quill } from "react-quill";
import "react-quill/dist/quill.snow.css";
import "./NotesRedesign.css";
import "./NotesRedesignConvert.css";
import "./NotesRedesignSmartFolders.css";
import "./NotesRedesignChatImport.css";
import CustomPopup from "./CustomPopup";
import { useTheme } from '../contexts/ThemeContext';
import { 
  Plus, FileText, Upload, Search, Star, Trash2, 
  FolderPlus, Folder, Download, FileDown, Printer, 
  Eye, Edit3, Maximize2, Minimize2, Menu, X, 
  ChevronDown, ChevronRight, Check, Sparkles, Mic, MicOff, 
  MoreVertical, Archive, RefreshCw, Save, Clock,
  AlignLeft, Bold, Italic, Underline, 
  List, ListOrdered, Link2, Image, Code,
  ArrowLeft, Tag, Layout, Filter, Palette, Command, Zap
} from 'lucide-react';
import { API_URL } from '../config';
import gamificationService from '../services/gamificationService';
import noteAgentService from '../services/noteAgentService';
import ImportExportModal from '../components/ImportExportModal';

// Enhanced Notes Features
import SimpleBlockEditor from '../components/SimpleBlockEditor';
import AdvancedSearch from '../components/AdvancedSearch';
import Templates from '../components/Templates';
import TemplatePreview from '../components/TemplatePreview';
import RecentlyViewed from '../components/RecentlyViewed';
import PageProperties from '../components/PageProperties';
import CanvasMode from '../components/CanvasMode';
import SmartFolders from '../components/SmartFolders';
import KeyboardShortcuts from '../components/KeyboardShortcuts';
import useKeyboardShortcuts from '../hooks/useKeyboardShortcuts';

// Utility functions
const htmlToBlocks = (html) => {
  if (!html || html.trim() === '') {
    return [{
      id: Date.now(),
      type: 'paragraph',
      content: '',
      properties: {}
    }];
  }
  
  const blocks = [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  // Process each element in the body
  const processNode = (node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent.trim();
      if (text) {
        blocks.push({
          id: Date.now() + Math.random(),
          type: 'paragraph',
          content: text,
          properties: {}
        });
      }
      return;
    }
    
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tagName = node.tagName.toLowerCase();
      const content = node.innerHTML || node.textContent || '';
      const textContent = node.textContent.trim();
      
      if (!textContent) return;
      
      switch (tagName) {
        case 'h1':
          blocks.push({
            id: Date.now() + Math.random(),
            type: 'heading1',
            content: textContent,
            properties: {}
          });
          break;
        case 'h2':
          blocks.push({
            id: Date.now() + Math.random(),
            type: 'heading2',
            content: textContent,
            properties: {}
          });
          break;
        case 'h3':
          blocks.push({
            id: Date.now() + Math.random(),
            type: 'heading3',
            content: textContent,
            properties: {}
          });
          break;
        case 'ul':
          // Process each list item as a separate bullet block
          Array.from(node.querySelectorAll('li')).forEach(li => {
            blocks.push({
              id: Date.now() + Math.random(),
              type: 'bulletList',
              content: li.textContent.trim(),
              properties: {}
            });
          });
          break;
        case 'ol':
          // Process each list item as a separate numbered block
          Array.from(node.querySelectorAll('li')).forEach(li => {
            blocks.push({
              id: Date.now() + Math.random(),
              type: 'numberedList',
              content: li.textContent.trim(),
              properties: {}
            });
          });
          break;
        case 'blockquote':
          blocks.push({
            id: Date.now() + Math.random(),
            type: 'quote',
            content: textContent,
            properties: {}
          });
          break;
        case 'pre':
        case 'code':
          blocks.push({
            id: Date.now() + Math.random(),
            type: 'code',
            content: textContent,
            properties: {}
          });
          break;
        case 'hr':
          blocks.push({
            id: Date.now() + Math.random(),
            type: 'divider',
            content: '',
            properties: {}
          });
          break;
        case 'p':
          if (textContent) {
            blocks.push({
              id: Date.now() + Math.random(),
              type: 'paragraph',
              content: content,
              properties: {}
            });
          }
          break;
        case 'div':
        case 'section':
        case 'article':
          // Process children
          Array.from(node.childNodes).forEach(processNode);
          break;
        default:
          // For other elements, create a paragraph with the content
          if (textContent && !['ul', 'ol', 'li'].includes(tagName)) {
            blocks.push({
              id: Date.now() + Math.random(),
              type: 'paragraph',
              content: content,
              properties: {}
            });
          }
      }
    }
  };
  
  // Process all body children
  Array.from(doc.body.childNodes).forEach(processNode);
  
  // If no blocks were created, create a default paragraph
  if (blocks.length === 0) {
    blocks.push({
      id: Date.now(),
      type: 'paragraph',
      content: html.replace(/<[^>]*>/g, ''),
      properties: {}
    });
  }
  
  return blocks;
};

const blocksToHtml = (blocks) => {
  if (!blocks || blocks.length === 0) return '';
  
  return blocks.map(block => {
    const content = block.content || '';
    
    switch (block.type) {
      case 'heading1':
        return `<h1>${content}</h1>`;
      case 'heading2':
        return `<h2>${content}</h2>`;
      case 'heading3':
        return `<h3>${content}</h3>`;
      case 'bulletList':
        return `<ul><li>${content}</li></ul>`;
      case 'numberedList':
        return `<ol><li>${content}</li></ol>`;
      case 'quote':
        return `<blockquote>${content}</blockquote>`;
      case 'code':
        return `<pre><code>${content}</code></pre>`;
      case 'divider':
        return '<hr/>';
      case 'todo':
        return `<div><input type="checkbox" ${block.properties?.checked ? 'checked' : ''}/> ${content}</div>`;
      case 'callout':
      case 'info':
      case 'warning':
      case 'success':
      case 'tip':
        return `<div class="callout ${block.type}">${content}</div>`;
      default:
        return `<p>${content}</p>`;
    }
  }).join('\n');
};

// Stub components
const QuickSwitcher = null;
const FormattingToolbar = ({ onAIAssist, showAI, onInsertBlock }) => null;
const SlashMenu = ({ isOpen, position, onSelect, onClose }) => null;
const BacklinksPanel = ({ backlinks, onNoteClick }) => null;
const TagsPanel = ({ tags, selectedTag, onTagSelect, onClose }) => null;

// Stub hooks
const useQuickSwitcher = (notes, folders, selectNote) => ({ QuickSwitcherComponent: null });
const useTags = (notes) => ({ allTags: [] });
const useBacklinks = (selectedNote, notes) => [];
const useSlashCommands = (quillRef) => ({ 
  showSlashMenu: false, 
  slashMenuPosition: {}, 
  setShowSlashMenu: () => {}, 
  insertBlock: () => {} 
});

// Utility functions
const parsePageLinks = (content) => [];
const parseTags = (content) => [];
const filterNotesByTag = (notes, tag) => notes;

// Remove problematic imports and register them conditionally
let QuillTableUI;
try {
  QuillTableUI = require('quill-table-ui');
  if (QuillTableUI && QuillTableUI.default) {
    Quill.register('modules/tableUI', QuillTableUI.default);
  }
} catch (error) {
  }

let katex;
try {
  katex = require('katex');
  if (katex) {
    window.katex = katex;
  }
} catch (error) {
  }

const NotesRedesign = ({ sharedMode = false }) => {
  const { noteId } = useParams();
  const navigate = useNavigate();
  
  // Shared content state
  const [sharedNoteData, setSharedNoteData] = useState(null);
  const [isSharedContent, setIsSharedContent] = useState(sharedMode);
  const [canEdit, setCanEdit] = useState(false);

  // User state
  const [userName, setUserName] = useState("");
  const [userProfile, setUserProfile] = useState(null);
  
  // Notes state
  const [notes, setNotes] = useState([]);
  const [selectedNote, setSelectedNote] = useState(null);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [canvasData, setCanvasData] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  
  // UI state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  const [autoSaved, setAutoSaved] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [titleSectionCollapsed, setTitleSectionCollapsed] = useState(false);
  const [viewMode, setViewMode] = useState("edit");
  
  // AI state
  const [showAIDropdown, setShowAIDropdown] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiDropdownPosition, setAiDropdownPosition] = useState({ top: 0, left: 0 });
  const [generatingAI, setGeneratingAI] = useState(false);
  const [showAIButton, setShowAIButton] = useState(false);
  const [aiButtonPosition, setAiButtonPosition] = useState({ top: 0, left: 0 });
  const [selectedRange, setSelectedRange] = useState(null);
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [aiAssistAction, setAiAssistAction] = useState("improve");
  const [aiAssistTone, setAiAssistTone] = useState("professional");
  const [selectedText, setSelectedText] = useState("");

  // AI Suggestion state (for approve/reject workflow)
  const [aiSuggestion, setAiSuggestion] = useState(null); // { original, suggested, range, action }
  const [showAISuggestionModal, setShowAISuggestionModal] = useState(false);

  // Folder state
  const [folders, setFolders] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderColor, setNewFolderColor] = useState("#D7B38C");
  
  // Trash state
  const [showTrash, setShowTrash] = useState(false);
  const [trashedNotes, setTrashedNotes] = useState([]);
  
  // Other state
  const [showFavorites, setShowFavorites] = useState(false);
  const [customFont, setCustomFont] = useState("Inter");
  const [draggedNote, setDraggedNote] = useState(null);
  const [dragOverFolder, setDragOverFolder] = useState(null);

  // Font options
  const FONTS = [
    'Inter', 'Arial', 'Georgia', 'Times New Roman', 'Courier New', 
    'Monaco', 'Roboto', 'Open Sans', 'Lato', 'Montserrat'
  ];
  
  // Enhanced features state
  const [showTagsPanel, setShowTagsPanel] = useState(false);
  const [selectedTagFilter, setSelectedTagFilter] = useState(null);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState(null);
  
  // Block editor state
  const [noteBlocks, setNoteBlocks] = useState([{
    id: Date.now(),
    type: 'paragraph',
    content: '',
    properties: {}
  }]);
  const [showAIFloatingButton, setShowAIFloatingButton] = useState(false);
  const [aiFloatingPosition, setAiFloatingPosition] = useState({ top: 0, left: 0 });
  const [selectedTextContent, setSelectedTextContent] = useState('');
  const [selectedBlockId, setSelectedBlockId] = useState(null);
  
  // New features state
  const [recentlyViewed, setRecentlyViewed] = useState([]);
  const [showRecentlyViewed, setShowRecentlyViewed] = useState(false);
  const [pageProperties, setPageProperties] = useState([
    { id: '1', name: 'Created', type: 'date', value: new Date().toISOString().split('T')[0] },
    { id: '2', name: 'Status', type: 'text', value: 'Draft' },
    { id: '3', name: 'Tags', type: 'tags', value: '' },
  ]);
  const [showPageProperties, setShowPageProperties] = useState(false);
  const [editorDarkMode, setEditorDarkMode] = useState(false);
  
  // New features state
  const [showCanvasMode, setShowCanvasMode] = useState(false);
  const [showSmartFolders, setShowSmartFolders] = useState(false);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Chat import state
  const [showChatImport, setShowChatImport] = useState(false);
  const [chatSessions, setChatSessions] = useState([]);
  const [selectedSessions, setSelectedSessions] = useState([]);
  const [importMode, setImportMode] = useState("summary");
  const [importing, setImporting] = useState(false);
  
  // Import/Export state
  const [showImportExport, setShowImportExport] = useState(false);
  
  // Debug: Log when showChatImport changes
  useEffect(() => {
          }, [showChatImport, chatSessions]);

  // Voice state
  const [isRecording, setIsRecording] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [processingVoice, setProcessingVoice] = useState(false);
  
  // Refs
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const quillRef = useRef(null);
  const saveTimeout = useRef(null);
  const aiInputRef = useRef(null);

  // Popup state
  const [popup, setPopup] = useState({ isOpen: false, title: "", message: "" });
  const showPopup = (title, message) => setPopup({ isOpen: true, title, message });
  const closePopup = () => setPopup({ isOpen: false, title: "", message: "" });
  
  const { selectedTheme } = useTheme();
  
  // Theme effects
  useEffect(() => {
          }, [selectedTheme]);

  useEffect(() => {
    if (selectedTheme && selectedTheme.tokens) {
      const root = document.documentElement;
      
      Object.entries(selectedTheme.tokens).forEach(([key, value]) => {
        root.style.setProperty(`--${key}`, value);
      });
      
          }
  }, [selectedTheme]);

  // Font registration
  useEffect(() => {
    if (typeof Quill !== 'undefined') {
      try {
        const Font = Quill.import('formats/font');
        Font.whitelist = [
          'inter',
          'arial', 
          'times-new-roman',
          'georgia',
          'courier',
          'verdana',
          'helvetica',
          'comic-sans',
          'impact',
          'trebuchet',
          'palatino',
          'garamond',
          'bookman',
          'avant-garde',
          'roboto',
          'open-sans',
          'lato',
          'montserrat',
          'source-sans',
          'merriweather',
          'playfair',
          'eb-garamond'
        ];
        Quill.register(Font, true);
      } catch (error) {
              }
    }
  }, []);

  // Load shared note function
  const loadSharedNote = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_URL}/shared/note/${noteId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setSharedNoteData(data);
        setIsSharedContent(true);
        setCanEdit(data.permission === 'edit' || data.is_owner);
        
        // Set up the note with shared data
        setSelectedNote({
          id: data.content_id,
          title: data.title,
          content: data.content,
          updated_at: data.updated_at
        });
        setNoteTitle(data.title);
        setNoteContent(data.content);
      } else {
        throw new Error('Failed to load shared note');
      }
    } catch (error) {
            showPopup("Error", "Failed to load shared note");
      navigate('/social');
    }
  };

  // Initial load effect
  useEffect(() => {
    const token = localStorage.getItem("token");
    const username = localStorage.getItem("username");
    const profile = localStorage.getItem("userProfile");
    const savedFont = localStorage.getItem("preferredFont");

    if (!token) {
      navigate("/login");
      return;
    }
    
    if (savedFont) {
      setCustomFont(savedFont);
    }
    
    if (sharedMode && noteId) {
      loadSharedNote();
    } else {
      if (username) setUserName(username);
      if (profile) {
        try {
          setUserProfile(JSON.parse(profile));
        } catch (error) {
                  }
      }
    }
  }, [navigate, sharedMode, noteId]);

  // Load notes and folders effect
  useEffect(() => {
    if (userName && !isSharedContent) {
      loadNotes();
      loadFolders();
      loadChatSessions();
      
      // Load recently viewed from localStorage
      const stored = localStorage.getItem(`recentlyViewed_${userName}`);
      if (stored) {
        try {
          setRecentlyViewed(JSON.parse(stored));
        } catch (e) {
                  }
      }
    }
  }, [userName, isSharedContent]);

  const loadNotes = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/get_notes?user_id=${userName}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const activeNotes = data.filter(n => !n.is_deleted);
        setNotes(activeNotes);
        
        // If noteId is provided in URL, select that note
        if (noteId && !sharedMode) {
          const specificNote = activeNotes.find(n => n.id === parseInt(noteId));
          if (specificNote) {
            selectNote(specificNote);
          } else if (activeNotes.length > 0) {
            selectNote(activeNotes[0]);
          }
        } else if (activeNotes.length > 0 && !selectedNote) {
          selectNote(activeNotes[0]);
        }
      } else {
        throw new Error(`Failed to load notes: ${res.status}`);
      }
    } catch (e) {
            showPopup("Error", "Failed to load notes");
    }
  };

  const [quillReady, setQuillReady] = useState(false);

  useEffect(() => {
    const checkEditorReady = setInterval(() => {
      const q = quillRef.current?.getEditor?.();
      if (q) {
        setQuillReady(true);
        clearInterval(checkEditorReady);
      }
    }, 200);
    return () => clearInterval(checkEditorReady);
  }, []);

  const handleTextSelection = useCallback(() => {
    if (!canEdit && isSharedContent) return;
    
    const quill = quillRef.current?.getEditor();
    if (!quill) return;

    const selection = quill.getSelection();
    if (selection && selection.length > 0) {
      const text = quill.getText(selection.index, selection.length).trim();

      if (text.length > 3) {
        setSelectedText(text);
        setSelectedRange(selection);

        const bounds = quill.getBounds(selection.index, selection.length);
        const rect = quill.container.getBoundingClientRect();

        const top = rect.top + bounds.bottom + window.scrollY + 8;
        const left = rect.left + bounds.left + bounds.width / 2 + window.scrollX;

        setAiButtonPosition({ top, left });
        setShowAIButton(true);
        return;
      }
    }

    setShowAIButton(false);
    setSelectedText("");
    setSelectedRange(null);
  }, [canEdit, isSharedContent]);

  useEffect(() => {
    if (!quillReady || (isSharedContent && !canEdit)) return;

    const quill = quillRef.current?.getEditor();
    if (!quill || !quill.root) return;

    let debounceTimer = null;

    const onSelectionChange = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => handleTextSelection(), 150);
    };

    quill.root.addEventListener("mouseup", onSelectionChange);
    quill.root.addEventListener("keyup", onSelectionChange);
    document.addEventListener("selectionchange", onSelectionChange);

    const onHide = (e) => {
      if (
        showAIButton &&
        !e.target.closest(".ai-floating-button") &&
        !e.target.closest(".ql-editor")
      ) {
        setShowAIButton(false);
      }
    };

    document.addEventListener("mousedown", onHide);
    document.addEventListener("scroll", () => setShowAIButton(false));

    return () => {
      clearTimeout(debounceTimer);
      if (quill.root) {
        quill.root.removeEventListener("mouseup", onSelectionChange);
        quill.root.removeEventListener("keyup", onSelectionChange);
      }
      document.removeEventListener("selectionchange", onSelectionChange);
      document.removeEventListener("mousedown", onHide);
      document.removeEventListener("scroll", () => setShowAIButton(false));
    };
  }, [handleTextSelection, showAIButton, quillReady, canEdit, isSharedContent]);

  const handleAIButtonClick = () => {
    if (isSharedContent && !canEdit) return;
    setShowAIAssistant(true);
    setShowAIButton(false);
  };

  const processSelectedText = async (action) => {
    if (!selectedText || !selectedText.trim() || (isSharedContent && !canEdit)) {
      showPopup("No Text Selected", "Please select text first");
      return;
    }

    setGeneratingAI(true);

    try {
      // Use the note agent service
      const result = await noteAgentService.invoke(action, {
        userId: userName,
        content: selectedText,
        tone: aiAssistTone,
        context: noteContent
      });

      if (!result.success) throw new Error("AI processing failed");

      const resultContent = result.content || result.response;

      // Show suggestion modal instead of directly applying
      setAiSuggestion({
        original: selectedText,
        suggested: resultContent,
        range: selectedRange,
        action: action
      });
      setShowAISuggestionModal(true);
      setShowAIAssistant(false);
      
    } catch (error) {
      console.error("AI processing error:", error);
      showPopup("Error", "Failed to process text");
    } finally {
      setGeneratingAI(false);
    }
  };

  // Apply AI suggestion
  const applyAISuggestion = () => {
    if (!aiSuggestion) return;

    // Handle block editor case
    if (aiSuggestion.isBlockEditor) {
      let updatedBlocks;
      const blockIndex = noteBlocks.findIndex(b => String(b.id) === String(aiSuggestion.blockId));
      
      if (blockIndex !== -1 && aiSuggestion.blockId) {
        if (aiSuggestion.action === 'continue') {
          // Continue: append the result to the existing content
          updatedBlocks = noteBlocks.map((block, idx) => {
            if (idx === blockIndex) {
              return {
                ...block,
                content: block.content + ' ' + aiSuggestion.suggested
              };
            }
            return block;
          });
        } else if (aiSuggestion.action === 'generate') {
          // Generate: add new block at the end
          const newBlock = {
            id: Date.now() + Math.random(),
            type: 'paragraph',
            content: aiSuggestion.suggested,
            properties: {}
          };
          updatedBlocks = [...noteBlocks, newBlock];
        } else {
          // Improve, simplify, expand, summarize, fix_grammar, translate: replace the block content
          updatedBlocks = noteBlocks.map((block, idx) => {
            if (idx === blockIndex) {
              return {
                ...block,
                content: aiSuggestion.suggested
              };
            }
            return block;
          });
        }
      } else {
        // No selected block - add new block at the end
        const newBlock = {
          id: Date.now() + Math.random(),
          type: 'paragraph',
          content: aiSuggestion.suggested,
          properties: {}
        };
        updatedBlocks = [...noteBlocks, newBlock];
      }
      
      // Update state
      setNoteBlocks(updatedBlocks);
      
      // Trigger save
      setTimeout(() => {
        handleBlocksChange(updatedBlocks);
      }, 100);
    } else {
      // Handle Quill editor case
      const quill = quillRef.current?.getEditor();
      if (quill && aiSuggestion.range) {
        quill.deleteText(aiSuggestion.range.index, aiSuggestion.range.length);
        quill.insertText(aiSuggestion.range.index, aiSuggestion.suggested);
        quill.setSelection(aiSuggestion.range.index + aiSuggestion.suggested.length);
        setNoteContent(quill.root.innerHTML);
      }
    }

    showPopup("Applied", "AI suggestion applied successfully");
    setAiSuggestion(null);
    setShowAISuggestionModal(false);
    setSelectedText("");
    setSelectedRange(null);
    setSelectedBlockId(null);
  };

  // Reject AI suggestion
  const rejectAISuggestion = () => {
    setAiSuggestion(null);
    setShowAISuggestionModal(false);
    setSelectedText("");
    setSelectedRange(null);
    setSelectedBlockId(null);
  };

  // Explain text without modifying (new feature)
  const explainTextOnly = async () => {
    if (!selectedText || !selectedText.trim()) {
      showPopup("No Text Selected", "Please select text first");
      return;
    }

    setGeneratingAI(true);

    try {
      const result = await noteAgentService.invoke('explain', {
        userId: userName,
        content: selectedText,
        context: noteContent
      });

      if (!result.success) throw new Error("AI explanation failed");

      const explanation = result.content || result.response;
      
      // Show explanation in a popup without modifying the note
      setAiSuggestion({
        original: selectedText,
        suggested: explanation,
        range: null, // null range means explanation only, no replacement
        action: 'explain'
      });
      setShowAISuggestionModal(true);
      setShowAIAssistant(false);
      
    } catch (error) {
      console.error("AI explanation error:", error);
      showPopup("Error", "Failed to explain text");
    } finally {
      setGeneratingAI(false);
    }
  };

  const quickTextAction = async (actionType) => {
    if (isSharedContent && !canEdit) return;
    
    setGeneratingAI(true);

    try {
      // Map old action types to new agent actions
      const actionMap = {
        'explain': 'explain',
        'key_points': 'key_points',
        'guide': 'generate',
        'summary': 'summarize',
        'general': 'generate'
      };
      
      const agentAction = actionMap[actionType] || 'generate';
      
      // Use the note agent service
      const result = await noteAgentService.invoke(agentAction, {
        userId: userName,
        content: selectedText,
        topic: selectedText,
        context: noteContent
      });

      if (!result.success) throw new Error("AI generation failed");

      const resultContent = result.content || result.response;
      const quill = quillRef.current?.getEditor();

      if (quill && selectedRange) {
        const insertPosition = selectedRange.index + selectedRange.length;
        quill.insertText(insertPosition, "\n\n");
        quill.clipboard.dangerouslyPasteHTML(insertPosition + 2, resultContent);
        quill.setSelection(insertPosition + resultContent.length + 2);
      }

      setNoteContent(quill.root.innerHTML);
      showPopup("Success", `${actionType} content added`);
    } catch (error) {
            showPopup("Error", "Failed to generate content");
    } finally {
      setGeneratingAI(false);
      setSelectedText("");
      setSelectedRange(null);
    }
  };

  const loadFolders = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/get_folders?user_id=${userName}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setFolders(data.folders || []);
      }
    } catch (e) {
          }
  };

  const loadTrash = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/get_trash?user_id=${userName}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTrashedNotes(data.trash || []);
      }
    } catch (e) {
          }
  };

  const loadChatSessions = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/get_chat_sessions?user_id=${userName}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setChatSessions(data.sessions || []);
      }
    } catch (e) {
          }
  };

  const createFolder = async () => {
    if (!newFolderName.trim()) {
      showPopup("Error", "Folder name cannot be empty");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/create_folder`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          user_id: userName,
          name: newFolderName,
          color: newFolderColor,
        }),
      });

      if (res.ok) {
        const folder = await res.json();
        setFolders(prev => [...prev, folder]);
        setNewFolderName("");
        setNewFolderColor("#D7B38C");
        setShowFolderModal(false);
        
        setSelectedFolder(folder.id);
        setShowFavorites(false);
        setShowTrash(false);
        
        showPopup("Success", "Folder created successfully");
      } else {
        throw new Error(`Failed to create folder: ${res.status}`);
      }
    } catch (e) {
            showPopup("Error", "Failed to create folder");
    }
  };

  const createNoteInFolder = async (folderId) => {
    if (isSharedContent) return;
    
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/create_note`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          user_id: userName,
          title: "Untitled Note",
          content: "",
          folder_id: folderId,
        }),
      });
      
      if (res.ok) {
        const newNote = await res.json();
        setNotes(prev => [newNote, ...prev]);
        selectNote(newNote);
        await loadFolders();

        setTimeout(() => {
          const quill = quillRef.current?.getEditor();
          if (quill) {
            quill.focus();
            quill.setSelection(0, 0);
          }
        }, 150);

        showPopup("Created", "New note created in folder");
      } else {
        throw new Error(`Failed to create note: ${res.status}`);
      }
    } catch (error) {
            showPopup("Error", "Failed to create note");
    }
  };

  const deleteFolder = async (folderId) => {
    if (!window.confirm("Delete this folder? Notes will be moved to root.")) return;

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/delete_folder/${folderId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setFolders(prev => prev.filter(f => f.id !== folderId));
        await loadNotes();
        await loadFolders();
        showPopup("Success", "Folder deleted");
      } else {
        throw new Error(`Failed to delete folder: ${res.status}`);
      }
    } catch (e) {
            showPopup("Error", "Failed to delete folder");
    }
  };

  const moveNoteToFolder = async (noteId, folderId) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/move_note_to_folder`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ note_id: noteId, folder_id: folderId }),
      });

      if (res.ok) {
        setNotes(prev => prev.map(n => n.id === noteId ? { ...n, folder_id: folderId } : n));
        
        if (selectedNote?.id === noteId) {
          setSelectedNote(prev => ({ ...prev, folder_id: folderId }));
        }
        
        await loadFolders();
        
        showPopup("Success", "Note moved to folder");
      } else {
        throw new Error(`Failed to move note: ${res.status}`);
      }
    } catch (e) {
            showPopup("Error", "Failed to move note");
    }
  };

  const handleDragStart = (e, note) => {
    if (isSharedContent) return;
    
    e.dataTransfer.effectAllowed = 'move';
    setDraggedNote(note);
    e.target.style.opacity = '0.5';
  };

  const handleDragEnd = (e) => {
    if (e.target) {
      e.target.style.opacity = '1';
    }
    setDraggedNote(null);
    setDragOverFolder(null);
  };

  const handleDragOver = (e, folderId) => {
    if (isSharedContent) return;
    
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverFolder(folderId);
  };

  const handleDragLeave = (e) => {
    setDragOverFolder(null);
  };

  const handleDrop = async (e, folderId) => {
    if (isSharedContent) return;
    
    e.preventDefault();
    setDragOverFolder(null);
    
    if (draggedNote) {
      await moveNoteToFolder(draggedNote.id, folderId);
      setDraggedNote(null);
    }
  };

  const toggleFavorite = async (noteId) => {
    if (isSharedContent) return;
    
    const note = notes.find(n => n.id === noteId);
    if (!note) return;

    const newFavoriteStatus = !note.is_favorite;

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/toggle_favorite`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ note_id: noteId, is_favorite: newFavoriteStatus }),
      });

      if (res.ok) {
        setNotes(prev => prev.map(n => n.id === noteId ? { ...n, is_favorite: newFavoriteStatus } : n));
        if (selectedNote?.id === noteId) {
          setSelectedNote(prev => ({ ...prev, is_favorite: newFavoriteStatus }));
        }
        showPopup("Success", newFavoriteStatus ? "Added to favorites" : "Removed from favorites");
      }
    } catch (e) {
          }
  };

  const moveToTrash = async (noteId) => {
    if (isSharedContent) return;
    
    try {
      if (saveTimeout.current) {
        clearTimeout(saveTimeout.current);
        saveTimeout.current = null;
      }
      
      if (selectedNote?.id === noteId) {
        setSelectedNote(null);
        setNoteTitle("");
        setNoteContent("");
      }
      
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/soft_delete_note/${noteId}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setNotes(prev => prev.filter(n => n.id !== noteId));
        
        const remaining = notes.filter(n => n.id !== noteId && !n.is_deleted);
        if (remaining.length > 0) {
          setTimeout(() => selectNote(remaining[0]), 100);
        }
        
        await loadFolders();
        
        showPopup("Moved to Trash", "Note moved to trash (recoverable for 30 days)");
      } else {
        throw new Error(`Failed to move to trash: ${res.status}`);
      }
    } catch (e) {
            showPopup("Error", "Failed to move note to trash");
    }
  };

  const restoreNote = async (noteId) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/restore_note/${noteId}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        await loadNotes();
        await loadTrash();
        await loadFolders();
        showPopup("Restored", "Note restored successfully");
      } else {
        throw new Error(`Failed to restore note: ${res.status}`);
      }
    } catch (e) {
            showPopup("Error", "Failed to restore note");
    }
  };

  const permanentDelete = async (noteId) => {
    if (!window.confirm("Permanently delete this note? This cannot be undone!")) return;

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/permanent_delete_note/${noteId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setTrashedNotes(prev => prev.filter(n => n.id !== noteId));
        showPopup("Deleted", "Note permanently deleted");
      } else {
        throw new Error(`Failed to delete note: ${res.status}`);
      }
    } catch (e) {
            showPopup("Error", "Failed to delete note");
    }
  };

  // Word count effect
  useEffect(() => {
    if (noteContent) {
      const text = noteContent.replace(/<[^>]+>/g, "").trim();
      const words = text.split(/\s+/).filter((w) => w.length > 0);
      setWordCount(words.length);
      setCharCount(text.length);
    } else {
      setWordCount(0);
      setCharCount(0);
    }
  }, [noteContent]);

  const createNewNote = async () => {
    if (isSharedContent) return;
    
    try {
      const token = localStorage.getItem("token");
      
      const folderId = selectedFolder && selectedFolder !== 0 ? selectedFolder : null;
      
      const res = await fetch(`${API_URL}/create_note`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          user_id: userName,
          title: "Untitled Note",
          content: "",
          folder_id: folderId,
        }),
      });
      
      if (res.ok) {
        const newNote = await res.json();
        setNotes(prev => [newNote, ...prev]);
        selectNote(newNote);
        await loadFolders();

        setTimeout(() => {
          const quill = quillRef.current?.getEditor();
          if (quill) {
            quill.focus();
            quill.setSelection(0, 0);
          }
        }, 150);

        const folderName = folders.find(f => f.id === folderId)?.name;
        showPopup("Created", folderName ? `New note created in ${folderName}` : "New note created");
        
        // Track gamification activity
        gamificationService.trackNoteCreated(userName);
      } else {
        throw new Error(`Failed to create note: ${res.status}`);
      }
    } catch (error) {
            showPopup("Error", "Failed to create note");
    }
  };

  const duplicateNote = async (note) => {
    if (isSharedContent) return;
    
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/create_note`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          user_id: userName,
          title: `${note.title} (Copy)`,
          content: note.content,
        }),
      });
      if (res.ok) {
        const newNote = await res.json();
        setNotes(prev => [newNote, ...prev]);
        selectNote(newNote);
        showPopup("Duplicated", "Note duplicated successfully");
      } else {
        throw new Error(`Failed to duplicate note: ${res.status}`);
      }
    } catch (error) {
            showPopup("Error", "Failed to duplicate note");
    }
  };

  const selectNote = (n) => {
    setSelectedNote(n);
    setNoteTitle(n.title);
    setNoteContent(n.content);
    setCanvasData(n.canvas_data || "");
    
    // Convert HTML content to blocks
    let blocks = htmlToBlocks(n.content);
    
    // Ensure we always have at least one block
    if (!blocks || blocks.length === 0) {
      blocks = [{
        id: Date.now(),
        type: 'paragraph',
        content: '',
        properties: {}
      }];
    }
    
    setNoteBlocks(blocks);
    setViewMode("edit");
    
    // Track recently viewed
    trackRecentlyViewed(n);
    
    // Load note properties if they exist
    if (n.properties) {
      try {
        const props = typeof n.properties === 'string' ? JSON.parse(n.properties) : n.properties;
        if (Array.isArray(props)) {
          setPageProperties(props);
        }
      } catch (e) {
              }
    }
  };
  
  // Track recently viewed notes
  const trackRecentlyViewed = (note) => {
    const viewedItem = {
      id: note.id,
      title: note.title,
      viewedAt: new Date().toISOString()
    };
    
    // Add to beginning, remove duplicates, keep last 10
    const updated = [
      viewedItem,
      ...recentlyViewed.filter(item => item.id !== note.id)
    ].slice(0, 10);
    
    setRecentlyViewed(updated);
    localStorage.setItem(`recentlyViewed_${userName}`, JSON.stringify(updated));
  };
  
  // Enhanced features handlers
  const handleTagSelect = (tag) => {
    setSelectedTagFilter(tag);
    setShowFavorites(false);
    setShowTrash(false);
    setSelectedFolder(null);
  };

  const handleClearTagFilter = () => {
    setSelectedTagFilter(null);
  };

  // Keyboard shortcuts handlers
  const keyboardHandlers = {
    onSave: () => selectedNote && autoSave(),
    onPrint: () => exportAsPDF(),
    onQuickSearch: () => setShowAdvancedSearch(true),
    onNewNote: () => createNewNote(),
    onDuplicate: () => selectedNote && duplicateNote(selectedNote),
    onExport: () => selectedNote && exportAsText(),
    onShowShortcuts: () => setShowKeyboardShortcuts(!showKeyboardShortcuts),
    onEscape: () => {
      setShowKeyboardShortcuts(false);
      setShowAdvancedSearch(false);
      setShowTemplates(false);
      setShowRecentlyViewed(false);
      setShowPageProperties(false);
      setShowCanvasMode(false);
      setShowSmartFolders(false);
    },
    onPreviousNote: () => {
      const currentIndex = filteredNotes.findIndex(n => n.id === selectedNote?.id);
      if (currentIndex > 0) {
        selectNote(filteredNotes[currentIndex - 1]);
      }
    },
    onNextNote: () => {
      const currentIndex = filteredNotes.findIndex(n => n.id === selectedNote?.id);
      if (currentIndex < filteredNotes.length - 1) {
        selectNote(filteredNotes[currentIndex + 1]);
      }
    },
    onScrollTop: () => {
      const editor = document.querySelector('.block-editor-container');
      if (editor) editor.scrollTo({ top: 0, behavior: 'smooth' });
    },
    onScrollBottom: () => {
      const editor = document.querySelector('.block-editor-container');
      if (editor) editor.scrollTo({ top: editor.scrollHeight, behavior: 'smooth' });
    },
    onToggleSidebar: () => setSidebarOpen(!sidebarOpen),
    onToggleFocusMode: () => setTitleSectionCollapsed(!titleSectionCollapsed),
    onGoToDashboard: () => navigate('/dashboard'),
    onGoToAIChat: () => navigate('/ai-chat'),
    onGoToNotes: () => navigate('/notes/dashboard'),
    onFullscreen: () => setTitleSectionCollapsed(!titleSectionCollapsed),
    onPreviewMode: () => setViewMode('preview'),
    onEditMode: () => setViewMode('edit'),
    onToggleDarkEditor: () => setEditorDarkMode(true),
    onToggleLightEditor: () => setEditorDarkMode(false),
    onToggleFavorite: () => selectedNote && toggleFavorite(selectedNote.id),
    onDelete: () => selectedNote && moveToTrash(selectedNote.id),
  };

  // Use keyboard shortcuts hook
  useKeyboardShortcuts(keyboardHandlers);

  // Block editor handlers
  const handleBlocksChange = (newBlocks) => {
    setNoteBlocks(newBlocks);
    // Convert blocks to HTML for saving
    const html = blocksToHtml(newBlocks);
    setNoteContent(html);
  };

  const handleInsertBlock = (blockType) => {
    // Add a new block of the specified type at the end
    const newBlock = {
      id: Date.now() + Math.random(),
      type: blockType,
      content: '',
      properties: {}
    };
    const newBlocks = [...noteBlocks, newBlock];
    setNoteBlocks(newBlocks);
    handleBlocksChange(newBlocks);
  };

  const handleTemplateSelect = (template) => {
    setNoteTitle(template.title);
    
    // If template already has blocks, use them
    if (template.blocks && template.blocks.length > 0) {
      setNoteBlocks(template.blocks);
      // Convert blocks to HTML for saving
      const html = blocksToHtml(template.blocks);
      setNoteContent(html);
    } else {
      // Fallback to HTML conversion
      const blocks = htmlToBlocks(template.content);
      setNoteBlocks(blocks);
      setNoteContent(template.content);
    }
  };

  // Enhanced features hooks (must be after selectNote is defined)
  const { QuickSwitcherComponent } = useQuickSwitcher(notes, folders, selectNote);
  const { allTags } = useTags(notes);
  const backlinks = useBacklinks(selectedNote, notes);
  const { 
    showSlashMenu, 
    slashMenuPosition, 
    setShowSlashMenu, 
    insertBlock 
  } = useSlashCommands(quillRef);

  const autoSave = useCallback(async () => {
    if (!selectedNote) return;
    
    // For shared notes, use the update_shared_note endpoint
    if (isSharedContent) {
      if (!canEdit) return;
      
      setSaving(true);
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/update_shared_note/${selectedNote.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            title: noteTitle,
            content: noteContent,
            canvas_data: canvasData,
          }),
        });

        if (res.ok) {
          setSaving(false);
          setAutoSaved(true);
          setTimeout(() => setAutoSaved(false), 2000);
        } else {
          throw new Error(`Save failed: ${res.status}`);
        }
      } catch (error) {
        setSaving(false);
                showPopup("Error", "Failed to save changes");
      }
    } else {
      // Normal save logic for own notes
      const noteStillExists = notes.find(n => n.id === selectedNote.id);
      if (!noteStillExists) return;
      
      if (selectedNote.is_deleted || noteStillExists.is_deleted) return;
      
      setSaving(true);
      
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_URL}/update_note`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            note_id: selectedNote.id,
            title: noteTitle,
            content: noteContent,
            canvas_data: canvasData,
          }),
        });
        
        if (res.ok) {
          setSaving(false);
          setAutoSaved(true);
          setTimeout(() => setAutoSaved(false), 2000);

          setNotes((prev) =>
            prev.map((n) =>
              n.id === selectedNote.id ? { ...n, title: noteTitle, content: noteContent, canvas_data: canvasData } : n
            )
          );
        } else if (res.status === 400) {
          setSaving(false);
          
          setNotes(prev => prev.filter(n => n.id !== selectedNote.id));
          setSelectedNote(null);
          setNoteTitle("");
          setNoteContent("");
          
          showPopup("Note Deleted", "This note has been moved to trash");
        } else {
          throw new Error(`Save failed: ${res.status}`);
        }
      } catch (error) {
        setSaving(false);
                showPopup("Error", "Failed to save note");
      }
    }
  }, [selectedNote, noteTitle, noteContent, notes, isSharedContent, canEdit]);

  // Auto-save effect
  useEffect(() => {
    if (saveTimeout.current) {
      clearTimeout(saveTimeout.current);
      saveTimeout.current = null;
    }
    
    if (selectedNote && (isSharedContent ? canEdit : !selectedNote.is_deleted)) {
      saveTimeout.current = setTimeout(() => {
        if (selectedNote && (isSharedContent ? canEdit : !selectedNote.is_deleted)) {
          autoSave();
        }
      }, 1500);
    }
    
    return () => {
      if (saveTimeout.current) {
        clearTimeout(saveTimeout.current);
        saveTimeout.current = null;
      }
    };
  }, [noteContent, noteTitle, canvasData, selectedNote, autoSave, isSharedContent, canEdit]);

  // Keyboard shortcut for save
  useEffect(() => {
    const handleKey = (e) => {
      if (e.ctrlKey && e.key === "s") {
        e.preventDefault();
        autoSave();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [autoSave]);

  // Keyboard shortcut for fullscreen
  useEffect(() => {
    const handleFullscreenKey = (e) => {
      if (e.key === "F11") {
        e.preventDefault();
        setIsFullscreen(!isFullscreen);
      } else if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener("keydown", handleFullscreenKey);
    return () => window.removeEventListener("keydown", handleFullscreenKey);
  }, [isFullscreen]);

  // Handle page link clicks
  useEffect(() => {
    const handlePageLinkClick = (e) => {
      if (e.target.classList.contains('page-link')) {
        const noteId = parseInt(e.target.dataset.noteId);
        const note = notes.find(n => n.id === noteId);
        if (note) selectNote(note);
      }
    };

    const editor = quillRef.current?.getEditor();
    if (editor && editor.root) {
      editor.root.addEventListener('click', handlePageLinkClick);
      return () => editor.root.removeEventListener('click', handlePageLinkClick);
    }
  }, [notes, quillRef]);

  // Handle tag clicks
  useEffect(() => {
    const handleTagClick = (e) => {
      if (e.target.classList.contains('tag')) {
        const tag = e.target.dataset.tag;
        handleTagSelect(tag);
        setShowTagsPanel(true);
      }
    };

    const editor = quillRef.current?.getEditor();
    if (editor && editor.root) {
      editor.root.addEventListener('click', handleTagClick);
      return () => editor.root.removeEventListener('click', handleTagClick);
    }
  }, [quillRef]);

  // Handle text selection for AI assistant in block editor
  useEffect(() => {
    if (isSharedContent && !canEdit) return;

    const handleSelection = () => {
      const selection = window.getSelection();
      const selectedText = selection.toString().trim();

      if (selectedText && selectedText.length > 3) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        // Find the block that contains the selection
        let blockId = null;
        let node = range.startContainer;
        while (node && node !== document.body) {
          if (node.nodeType === 1) { // Element node
            const blockWrapper = node.closest('[data-block-id]');
            if (blockWrapper) {
              blockId = blockWrapper.getAttribute('data-block-id');
              break;
            }
          }
          node = node.parentNode;
        }

        setAiFloatingPosition({
          top: rect.bottom + window.scrollY + 8,
          left: rect.left + rect.width / 2 + window.scrollX
        });
        setSelectedTextContent(selectedText);
        setSelectedBlockId(blockId);
        setShowAIFloatingButton(true);
      } else {
        setShowAIFloatingButton(false);
        setSelectedTextContent('');
        setSelectedBlockId(null);
      }
    };

    document.addEventListener('mouseup', handleSelection);
    document.addEventListener('keyup', handleSelection);

    return () => {
      document.removeEventListener('mouseup', handleSelection);
      document.removeEventListener('keyup', handleSelection);
    };
  }, [isSharedContent, canEdit]);

  const handleEditorChange = (content, delta, source, editor) => {
    if (isSharedContent && !canEdit) return;
    
    setNoteContent(content);

    if (source === "user" && delta && delta.ops) {
      const lastOp = delta.ops[delta.ops.length - 1];
      if (lastOp.insert === "/") {
        const quill = quillRef.current?.getEditor();
        if (quill) {
          const selection = quill.getSelection();
          if (selection) {
            const bounds = quill.getBounds(selection.index);
            const editorRect = quill.container.getBoundingClientRect();
            setAiDropdownPosition({
              top: editorRect.top + bounds.top + 30,
              left: editorRect.left + bounds.left,
            });
            setShowAIDropdown(true);
            setAiPrompt("");
            quill.deleteText(selection.index - 1, 1);

            setTimeout(() => aiInputRef.current?.focus(), 100);
          }
        }
      }
    }
  };

  const generateAIContent = async () => {
    if (!aiPrompt.trim() || (isSharedContent && !canEdit)) {
      showPopup("Empty Prompt", "Please enter a prompt for AI generation");
      return;
    }

    setGeneratingAI(true);
    try {
      // Determine action type from prompt
      let actionType = "generate";
      if (aiPrompt.toLowerCase().includes("explain")) {
        actionType = "explain";
      } else if (aiPrompt.toLowerCase().includes("key points")) {
        actionType = "key_points";
      } else if (aiPrompt.toLowerCase().includes("outline")) {
        actionType = "outline";
      } else if (aiPrompt.toLowerCase().includes("summarize")) {
        actionType = "summarize";
      }

      // Use the note agent service
      const result = await noteAgentService.invoke(actionType, {
        userId: userName,
        topic: aiPrompt,
        content: aiPrompt,
        context: noteContent
      });

      if (!result.success) throw new Error("AI generation failed");

      const resultContent = result.content || result.response;
      const quill = quillRef.current?.getEditor();

      if (quill) {
        const range = quill.getSelection();
        const index = range ? range.index : quill.getLength();
        quill.insertText(index, "\n");
        quill.clipboard.dangerouslyPasteHTML(index + 1, resultContent);
        quill.setSelection(index + resultContent.length + 1);
      }

      setNoteContent(quillRef.current?.getEditor().root.innerHTML);
      showPopup("Success", "Content inserted successfully");
    } catch (error) {
            showPopup("Error", "Failed to generate AI content");
    } finally {
      setGeneratingAI(false);
      setShowAIDropdown(false);
      setAiPrompt("");
    }
  };

  const quickAIAction = async (actionType) => {
    if (isSharedContent && !canEdit) return;
    
    setGeneratingAI(true);
    try {
      // Map old action types to new agent actions
      const actionMap = {
        'explain': 'explain',
        'key_points': 'key_points',
        'guide': 'generate',
        'summary': 'summarize',
        'general': 'generate'
      };
      
      const agentAction = actionMap[actionType] || 'generate';
      
      // Use the note agent service
      const result = await noteAgentService.invoke(agentAction, {
        userId: userName,
        topic: aiPrompt || "Generate content",
        content: aiPrompt || "Generate content",
        context: noteContent
      });

      if (!result.success) throw new Error("AI generation failed");

      const resultContent = result.content || result.response;
      const quill = quillRef.current?.getEditor();

      if (quill) {
        const range = quill.getSelection();
        const index = range ? range.index : quill.getLength();
        quill.insertText(index, "\n");
        quill.clipboard.dangerouslyPasteHTML(index + 1, resultContent);
        quill.setSelection(index + resultContent.length + 1);
      }

      setNoteContent(quillRef.current?.getEditor().root.innerHTML);
      showPopup("Success", `${actionType} content inserted`);
    } catch (error) {
            showPopup("Error", "Failed to generate content");
    } finally {
      setGeneratingAI(false);
      setShowAIDropdown(false);
    }
  };

  const convertMarkdownToHTML = (markdown) => {
    let html = markdown;

    html = html.replace(/^[=\-*]{3,}\s*$/gim, '');
    html = html.replace(/\n{3,}/g, '\n\n');
    html = html.replace(/^###\s+(.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^##\s+(.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^#\s+(.*$)/gim, '<h1>$1</h1>');
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__(.*?)__/g, '<strong>$1</strong>');
    html = html.replace(/(?<!\*)\*(?!\*)([^\*]+?)\*(?!\*)/g, '<em>$1</em>');
    html = html.replace(/(?<!_)_(?!_)([^_]+?)_(?!_)/g, '<em>$1</em>');
    html = html.replace(/^\s*[-*]\s+(.*)$/gim, '<li>$1</li>');
    html = html.replace(/(<li>.*?<\/li>\s*)+/gis, (match) => {
      return `<ul>${match}</ul>`;
    });
    html = html.replace(/^\s*(\d+)\.\s+(.*)$/gim, '<li>$2</li>');
    html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

    const blocks = html.split(/\n\n+/);
    
    html = blocks.map(block => {
      block = block.trim();
      if (!block) return '';
      if (block.startsWith('<h') || 
          block.startsWith('<ul>') || 
          block.startsWith('<ol>') || 
          block.startsWith('<pre>') ||
          block.startsWith('<blockquote>') ||
          block === '<li>' ||
          block.startsWith('<div>')) {
        return block;
      }
      return `<p>${block.replace(/\n/g, '<br>')}</p>`;
    }).filter(block => block).join('\n\n');

    html = html.replace(/\n{3,}/g, '\n\n');
    html = html.trim();

    return html;
  };

  const startVoiceRecording = async () => {
    if (isSharedContent && !canEdit) return;
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const options = { mimeType: 'audio/webm' };
      const mediaRecorder = new MediaRecorder(stream, options);
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                
        if (audioBlob.size === 0) {
          showPopup("Error", "No audio was recorded. Please try again.");
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        
        await processVoiceToText(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
            showPopup("Recording", "Voice recording started");
    } catch (error) {
            showPopup("Error", "Failed to start recording. Please check microphone permissions.");
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const processVoiceToText = async (audioBlob) => {
    setProcessingVoice(true);
    try {
      const token = localStorage.getItem("token");
      const formData = new FormData();
      formData.append("audio_file", audioBlob, "recording.webm");
      formData.append("user_id", userName);

                  
      const transcribeRes = await fetch(`${API_URL}/transcribe_audio/`, {
        method: "POST",
        headers: { 
          Authorization: `Bearer ${token}`
        },
        body: formData,
      });

      
      if (!transcribeRes.ok) {
        const errorText = await transcribeRes.text();
                throw new Error(`Transcription failed: ${transcribeRes.status} - ${errorText}`);
      }

      const transcribeData = await transcribeRes.json();
            
      const transcript = transcribeData.transcript;
      setVoiceTranscript(transcript);

      
      // Use the note agent service for voice transcription processing
      const result = await noteAgentService.invoke('generate', {
        userId: userName,
        topic: transcript,
        content: transcript,
        context: noteContent
      });

      if (!result.success) {
        throw new Error("AI response failed");
      }

      const resultContent = result.content || result.response;
            
      const quill = quillRef.current?.getEditor();

      if (quill) {
        const range = quill.getSelection();
        const index = range ? range.index : quill.getLength();
        quill.insertText(index, "\n\n");
        quill.clipboard.dangerouslyPasteHTML(index + 2, resultContent);
        quill.setSelection(index + resultContent.length + 2);
      }

      setNoteContent(quillRef.current?.getEditor().root.innerHTML);
      showPopup("Success", "Voice transcribed and AI response added to note");
      setVoiceTranscript("");
    } catch (error) {
            showPopup("Error", error.message || "Failed to process voice input");
    } finally {
      setProcessingVoice(false);
    }
  };

  const aiWritingAssist = async () => {
    if (isSharedContent && !canEdit && aiAssistAction !== 'explain_only') return;
    
    // Handle explain_only action separately
    if (aiAssistAction === 'explain_only') {
      await explainTextOnly();
      return;
    }
    
    // Get text to process
    let textToProcess = selectedText;
    
    // For generate action, we don't need selected text
    if (aiAssistAction !== 'generate' && (!textToProcess || !textToProcess.trim())) {
      // Try to get selected text from the editor
      const selection = window.getSelection();
      if (selection && selection.toString()) {
        textToProcess = selection.toString();
      }
    }

    if (aiAssistAction !== 'generate' && (!textToProcess || !textToProcess.trim())) {
      showPopup("No Text Selected", "Please select text or enter text to process");
      return;
    }

    setGeneratingAI(true);
    try {
      // Map actions to note agent actions
      const actionMap = {
        'generate': 'generate',
        'continue': 'continue',
        'improve': 'improve',
        'simplify': 'simplify',
        'expand': 'expand',
        'summarize': 'summarize',
        'fix_grammar': 'grammar',
        'grammar': 'grammar',
        'tone_change': 'tone_change',
        'translate': 'improve'  // Use improve as fallback for translate
      };
      
      const agentAction = actionMap[aiAssistAction] || aiAssistAction;
      
      // Use the note agent service
      const result = await noteAgentService.invoke(agentAction, {
        userId: userName,
        content: textToProcess || selectedText,
        topic: textToProcess || selectedText,
        tone: aiAssistTone,
        context: noteBlocks.map(b => b.content).join('\n')
      });

      if (!result.success) throw new Error("AI assist failed");

      const resultText = result.content || result.response;
      
      if (!resultText || resultText.trim() === '') {
        showPopup("Error", "AI returned empty response");
        setGeneratingAI(false);
        return;
      }
      
      // Show suggestion modal for user approval instead of directly applying
      setAiSuggestion({
        original: textToProcess || selectedText,
        suggested: resultText.trim(),
        range: selectedRange,
        action: aiAssistAction,
        blockId: selectedBlockId,
        isBlockEditor: true
      });
      setShowAISuggestionModal(true);
      setShowAIAssistant(false);
      
    } catch (error) {
            showPopup("Error", "Failed to process text");
    } finally {
      setGeneratingAI(false);
    }
  };

  const handleSessionToggle = (sid) =>
    setSelectedSessions((prev) => (prev.includes(sid) ? prev.filter((id) => id !== sid) : [...prev, sid]));

  const selectAllSessions = () => setSelectedSessions(chatSessions.map((s) => s.id));
  const clearAllSessions = () => setSelectedSessions([]);

  const convertChatToNote = async () => {
                
    if (selectedSessions.length === 0) {
      showPopup("No Sessions Selected", "Please select at least one chat session.");
      return;
    }
    setImporting(true);
    try {
      const token = localStorage.getItem("token");
      
      // Use the conversion agent service for chat-to-notes conversion
      const conversionAgentService = (await import('../services/conversionAgentService')).default;
      
      const result = await conversionAgentService.chatToNotes(
        userName,
        selectedSessions,
        { formatStyle: importMode === 'summary' ? 'summary' : 'structured' }
      );
      
      if (result.success && result.result) {
        const noteResult = result.result;
        
        // Refresh notes list
        await loadNotes();
        
        setShowChatImport(false);
        setSelectedSessions([]);
        
        // Navigate to the newly created note if we have the ID
        if (noteResult.note_id) {
          navigate(`/notes/editor/${noteResult.note_id}`);
        }
        
        showPopup("Conversion Successful", `"${noteResult.note_title || 'Note'}" created successfully via AI Agent.`);
      } else {
        throw new Error(result.response || 'Conversion failed');
      }
    } catch (err) {
      console.error('Chat to note conversion error:', err);
      showPopup("Conversion Failed", "Unable to convert chat to note.");
    }
    setImporting(false);
  };

  const exportAsPDF = () => {
    const printWindow = window.open('', '_blank');
    
    const styles = `
      <style>
        body {
          font-family: ${customFont}, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          padding: 40px;
          max-width: 800px;
          margin: 0 auto;
          color: #1a1a1a;
          line-height: 1.8;
          position: relative;
        }
        
        body::before {
          content: 'cerbylAI';
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(-45deg);
          font-size: 120px;
          font-weight: 900;
          color: #d3d3d3;
          opacity: 0.15;
          z-index: -1;
          white-space: nowrap;
          pointer-events: none;
          letter-spacing: 8px;
          text-transform: uppercase;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        
        h1 {
          font-size: 32px;
          font-weight: 700;
          margin-bottom: 20px;
          color: #000;
          position: relative;
          z-index: 1;
        }
        
        .metadata {
          color: #666;
          font-size: 12px;
          margin-bottom: 30px;
          padding-bottom: 15px;
          border-bottom: 2px solid #e0e0e0;
          position: relative;
          z-index: 1;
        }
        
        .content {
          position: relative;
          z-index: 1;
        }
        
        img { 
          max-width: 100%; 
          height: auto; 
        }
        
        pre { 
          background: #f5f5f5; 
          padding: 15px; 
          border-radius: 0; 
          overflow-x: auto; 
        }
        
        code { 
          background: #f5f5f5; 
          padding: 2px 6px; 
          border-radius: 0; 
          font-family: 'Courier New', monospace; 
        }
        
        blockquote { 
          border-left: 4px solid #2196f3; 
          padding-left: 15px; 
          color: #666; 
          font-style: italic; 
        }
        
        a { 
          color: #2196f3; 
        }
        
        ul, ol { 
          margin: 12px 0; 
          padding-left: 30px; 
        }
        
        li { 
          margin: 6px 0; 
          line-height: 1.6; 
        }
        
        table { 
          border-collapse: collapse; 
          width: 100%; 
          margin: 20px 0; 
        }
        
        th, td { 
          border: 1px solid #ddd; 
          padding: 12px; 
          text-align: left; 
        }
        
        th { 
          background-color: #f5f5f5; 
          font-weight: 600; 
        }
        
        @media print {
          body::before {
            content: 'cerbylAI';
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 120px;
            font-weight: 900;
            color: #d3d3d3;
            opacity: 0.15;
            z-index: -1;
            white-space: nowrap;
            pointer-events: none;
            letter-spacing: 8px;
            text-transform: uppercase;
          }
          
          @page {
            margin: 0.5in;
          }
          
          h1, h2, h3, h4, h5, h6 {
            page-break-after: avoid;
          }
          
          table, pre, blockquote, img {
            page-break-inside: avoid;
          }
        }
      </style>
    `;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>${noteTitle || 'Note'}</title>
          ${styles}
        </head>
        <body>
          <h1>${noteTitle || 'Untitled Note'}</h1>
          <div class="metadata">
            Last edited: ${new Date(selectedNote.updated_at).toLocaleString()}<br>
            ${wordCount} words - ${charCount} characters
          </div>
          <div class="content">
            ${noteContent}
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();

    setTimeout(() => {
      printWindow.print();
    }, 250);

    showPopup("Export", "Print dialog opened - Save as PDF with cerbylAI watermark");
  };

  const exportAsText = () => {
    const text = noteContent.replace(/<[^>]+>/g, "");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${noteTitle || "note"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showPopup("Exported", "Note exported as text");
  };

  const getFilteredNotes = () => {
    let filtered = notes.filter(
      (n) =>
        !n.is_deleted &&
        (n.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        n.content.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    if (showFavorites) {
      filtered = filtered.filter(n => n.is_favorite);
    } else if (selectedFolder) {
      filtered = filtered.filter(n => n.folder_id === selectedFolder);
    } else if (selectedFolder === 0) {
      filtered = filtered.filter(n => !n.folder_id);
    }

    // Tag filtering
    if (selectedTagFilter) {
      filtered = filterNotesByTag(filtered, selectedTagFilter);
    }

    return filtered;
  };

  const filteredNotes = getFilteredNotes();

  const modules = {
    toolbar: {
      container: [
        [{ header: [1, 2, 3, 4, 5, 6, false] }],
        [{ font: [
          'inter', 'arial', 'times-new-roman', 'georgia', 'courier', 'verdana',
          'helvetica', 'comic-sans', 'impact', 'trebuchet', 'palatino', 'garamond',
          'bookman', 'avant-garde', 'roboto', 'open-sans', 'lato', 'montserrat',
          'source-sans', 'merriweather', 'playfair', 'eb-garamond'
        ] }],
        [{ size: ["small", false, "large", "huge"] }],
        ["bold", "italic", "underline", "strike"],
        [{ color: [] }, { background: [] }],
        [{ script: "sub" }, { script: "super" }],
        [{ list: "ordered" }, { list: "bullet" }, { indent: "-1" }, { indent: "+1" }],
        [{ direction: "rtl" }],
        ["blockquote", "code-block"],
        ["link", "image", "video", "formula"],
        ["clean"],
      ]
    },
    formula: true,
  };

  const formats = [
    "header",
    "font",
    "size",
    "bold",
    "italic",
    "underline",
    "strike",
    "color",
    "background",
    "script",
    "list",
    "bullet",
    "indent",
    "direction",
    "blockquote",
    "code-block",
    "link",
    "image",
    "video",
    "formula",
    "table",
  ];

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to logout?")) {
      localStorage.clear();
      navigate("/");
    }
  };

  return (
    <div className={`notes-redesign ${viewMode === "preview" ? "preview-mode" : ""} ${isFullscreen ? "fullscreen-mode" : ""}`}>
      {/* Quick Switcher (Cmd+K) */}
      {QuickSwitcherComponent}
      
      {/* Slash Menu */}
      <SlashMenu
        isOpen={showSlashMenu}
        position={slashMenuPosition}
        onSelect={insertBlock}
        onClose={() => setShowSlashMenu(false)}
      />

      {/* Header - Exact MyNotes mn-header Style */}
      <header className={`top-nav-new ${titleSectionCollapsed ? 'hidden' : ''}`}>
        <div className="nav-left">
          <button className="nav-menu-btn" onClick={() => window.openGlobalNav && window.openGlobalNav()} aria-label="Open navigation">
            <Menu size={20} />
          </button>
          {!isSharedContent && (
            <button
              onClick={() => navigate('/notes/my-notes')}
              className="toggle-sidebar nr-exit-btn"
              title="Exit to My Notes"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          {isSharedContent && (
            <button
              onClick={() => navigate('/social')}
              className="toggle-sidebar"
              title="Back to Social"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <h1 className="nr-header-title" onClick={() => navigate('/dashboard')}>
            <img src="/logo.svg" alt="" style={{ height: '24px', marginRight: '8px', filter: 'brightness(0) saturate(100%) invert(77%) sepia(48%) saturate(456%) hue-rotate(359deg) brightness(95%) contrast(89%)' }} />
            cerbyl
          </h1>
          <div className="nr-header-divider"></div>
          <p className="nr-header-subtitle">NOTES EDITOR</p>
          {isSharedContent && <span className="shared-badge">SHARED</span>}
        </div>

        {isSharedContent && sharedNoteData && (
          <div className="nav-center">
            <div className="shared-note-info">
              <span className="shared-by">
                Shared by: {sharedNoteData.owner?.username}
              </span>
              <span className={`permission-badge ${sharedNoteData.permission}`}>
                {sharedNoteData.permission === 'view' ? 'View Only' : 'Can Edit'}
              </span>
            </div>
          </div>
        )}

        <nav className="nav-actions-new">
          {!isSharedContent && (
            <>
              <button className="nr-nav-btn-ghost" onClick={() => setShowRecentlyViewed(!showRecentlyViewed)}>
                <span>Recent</span>
                <ChevronRight size={14} />
              </button>
              <button className="nr-nav-btn-ghost" onClick={() => setShowCanvasMode(true)}>
                <span>Canvas</span>
                <ChevronRight size={14} />
              </button>
            </>
          )}
          <button className="nr-nav-btn-ghost" onClick={() => navigate("/notes/my-notes")}>
            <span>My Notes</span>
            <ChevronRight size={14} />
          </button>
          <button className="nr-nav-btn-ghost" onClick={() => navigate('/dashboard')}>
            <span>Dashboard</span>
            <ChevronRight size={14} />
          </button>
        </nav>
      </header>

      {/* Body - Sidebar + Content */}
      <div className="nr-body">
        {selectedNote ? (
          <div className="editor-with-sidepanel">
            {/* Floating Menu Button - shows when sidebar is closed */}
            {!sidebarOpen && !isSharedContent && (
              <button 
                className="nr-show-sidebar-btn" 
                onClick={() => setSidebarOpen(true)}
                title="Show Tools Panel"
              >
                <Menu size={20} />
              </button>
            )}

            {/* LEFT SIDE TOOLS PANEL */}
            <aside className={`tools-sidepanel ${sidebarOpen && !isSharedContent ? "open" : "closed"}`}>
              <div className="tools-panel-header">
                <h3>TOOLS</h3>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="close-panel-btn"
                  title="Close panel"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="tools-panel-content">
                {/* View Mode Section */}
                <div className="tool-section">
                  <label className="tool-section-label">VIEW MODE</label>
                  <div className="tool-buttons-group">
                    <button
                      className={`tool-panel-btn ${viewMode === "edit" ? "active" : ""}`}
                      onClick={() => setViewMode("edit")}
                      title="Edit mode"
                    >
                      <Edit3 size={16} />
                      <span>Edit</span>
                    </button>
                  </div>
                </div>

                {/* Editor Theme Section */}
                <div className="tool-section">
                  <label className="tool-section-label">EDITOR THEME</label>
                  <div className="tool-buttons-group">
                    <button
                      className={`tool-panel-btn ${!editorDarkMode ? "active" : ""}`}
                      onClick={() => setEditorDarkMode(false)}
                      title="Light editor"
                    >
                      <Eye size={16} />
                      <span>Light</span>
                    </button>
                    <button
                      className={`tool-panel-btn ${editorDarkMode ? "active" : ""}`}
                      onClick={() => setEditorDarkMode(true)}
                      title="Dark editor"
                    >
                      <Eye size={16} />
                      <span>Dark</span>
                    </button>
                  </div>
                </div>

                {/* Export Section */}
                <div className="tool-section">
                  <label className="tool-section-label">EXPORT</label>
                  <div className="tool-buttons-group">
                    <button 
                      className="tool-panel-btn" 
                      onClick={exportAsPDF} 
                      title="Export as PDF"
                    >
                      <FileDown size={16} />
                      <span>PDF</span>
                    </button>
                    <button 
                      className="tool-panel-btn" 
                      onClick={exportAsText} 
                      title="Export as Text"
                    >
                      <Download size={16} />
                      <span>TXT</span>
                    </button>
                  </div>
                </div>

                {/* AI Tools Section */}
                <div className="tool-section">
                  <label className="tool-section-label">AI TOOLS</label>
                  <div className="tool-buttons-group">
                    <button
                      className="tool-panel-btn"
                      onClick={() => setShowAIAssistant(true)}
                      title="AI Writing Assistant"
                    >
                      <Sparkles size={16} />
                      <span>AI Assist</span>
                    </button>
                    <button
                      className="tool-panel-btn"
                      onClick={() => {
                                                                        setShowChatImport(true);
                      }}
                      title="Import from AI Chat"
                    >
                      <Upload size={16} />
                      <span>From Chat</span>
                    </button>
                    <button
                      className="tool-panel-btn convert-btn"
                      onClick={() => setShowImportExport(true)}
                      title="Convert Notes"
                    >
                      <Zap size={16} />
                      <span>Convert</span>
                    </button>
                  </div>
                </div>

                {/* Search & Templates Section */}
                <div className="tool-section">
                  <label className="tool-section-label">QUICK ACTIONS</label>
                  <div className="tool-buttons-group">
                    <button
                      className="tool-panel-btn"
                      onClick={() => setShowAdvancedSearch(true)}
                      title="Advanced Search"
                    >
                      <Filter size={16} />
                      <span>Search</span>
                    </button>
                    <button
                      className="tool-panel-btn"
                      onClick={() => setShowTemplates(true)}
                      title="Templates"
                    >
                      <Layout size={16} />
                      <span>Templates</span>
                    </button>
                  </div>
                </div>

                {/* Tags Section */}
                <div className="tool-section">
                  <label className="tool-section-label">ORGANIZATION</label>
                  <div className="tool-buttons-group">
                    <button 
                      onClick={() => setShowTagsPanel(!showTagsPanel)}
                      className={`tool-panel-btn ${showTagsPanel ? 'active' : ''}`}
                      title="Toggle tags panel"
                    >
                      <Tag size={16} />
                      <span>Tags</span>
                    </button>
                  </div>
                </div>

                {/* Visual & Interactive Features */}
                <div className="tool-section">
                  <label className="tool-section-label">VISUAL TOOLS</label>
                  <div className="tool-buttons-group">
                    <button 
                      onClick={() => setShowCanvasMode(true)}
                      className="tool-panel-btn"
                      title="Canvas Mode - Draw and brainstorm"
                    >
                      <Palette size={16} />
                      <span>Canvas</span>
                    </button>
                  </div>
                </div>
              </div>
            </aside>

            <div className={`editor-content ${editorDarkMode ? 'dark-mode' : ''} ${titleSectionCollapsed ? 'toolbar-hidden' : ''} ${!sidebarOpen ? 'sidebar-closed' : ''}`}>
              {isSharedContent && !canEdit && (
                <div className="view-only-banner">
                  <Eye size={16} />
                  <span>View Only - You don't have permission to edit this shared note</span>
                </div>
              )}
              
              <div className={`title-section ${titleSectionCollapsed ? 'collapsed' : ''}`}>
              <div className="title-section-header">
                <div className="title-section-content">
                  <input
                    type="text"
                    className="title-input-new"
                    value={noteTitle}
                    onChange={(e) => setNoteTitle(e.target.value)}
                    placeholder="Untitled Note"
                    style={{ fontFamily: customFont }}
                    disabled={isSharedContent && !canEdit}
                  />
                  <div className="title-meta">
                    <span className="last-edited">
                      Last edited: {new Date(selectedNote.updated_at).toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="title-actions">
                  <button
                    className="title-action-btn"
                    onClick={() => setIsFullscreen(!isFullscreen)}
                    title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                  >
                    {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                  </button>
                  <button
                    className="title-collapse-btn"
                    onClick={() => setTitleSectionCollapsed(!titleSectionCollapsed)}
                    title={titleSectionCollapsed ? "Expand title" : "Collapse title"}
                  >
                    <ChevronDown size={16} className={titleSectionCollapsed ? '' : 'rotated'} />
                  </button>
                </div>
              </div>
            </div>

            <div className="block-editor-wrapper" style={{ position: 'relative' }}>
              {/* Floating expand button when collapsed - inside block editor */}
              {titleSectionCollapsed && (
                <button
                  className={`floating-expand-btn ${editorDarkMode ? 'dark' : 'light'}`}
                  onClick={() => setTitleSectionCollapsed(false)}
                  title="Show navigation"
                >
                  <ChevronDown size={20} />
                </button>
              )}
              {viewMode === "edit" && (!isSharedContent || canEdit) && (
                <div className="formatting-toolbar-wrapper">
                  <div className="formatting-toolbar">
                    {/* Headers */}
                    <select 
                      className="format-select"
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value) {
                          document.execCommand('formatBlock', false, value);
                          e.target.value = '';
                        }
                      }}
                      defaultValue=""
                    >
                      <option value="">Normal</option>
                      <option value="h1">Heading 1</option>
                      <option value="h2">Heading 2</option>
                      <option value="h3">Heading 3</option>
                      <option value="h4">Heading 4</option>
                      <option value="h5">Heading 5</option>
                      <option value="h6">Heading 6</option>
                    </select>
                    
                    {/* Font Family */}
                    <select 
                      className="format-select"
                      value={customFont}
                      onChange={(e) => {
                        setCustomFont(e.target.value);
                        localStorage.setItem('preferredFont', e.target.value);
                      }}
                      title="Font Family"
                    >
                      {FONTS.map(font => (
                        <option key={font} value={font}>{font}</option>
                      ))}
                    </select>
                    
                    {/* Font Size */}
                    <select 
                      className="format-select"
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value) {
                          document.execCommand('fontSize', false, value);
                          e.target.value = '';
                        }
                      }}
                      defaultValue=""
                    >
                      <option value="">Size</option>
                      <option value="1">Small</option>
                      <option value="3">Normal</option>
                      <option value="5">Large</option>
                      <option value="7">Huge</option>
                    </select>
                    
                    <div className="toolbar-divider"></div>
                    
                    {/* Text Formatting */}
                    <button 
                      className="format-btn" 
                      onClick={() => document.execCommand('bold')}
                      title="Bold (Ctrl+B)"
                    >
                      <Bold size={16} />
                    </button>
                    <button 
                      className="format-btn" 
                      onClick={() => document.execCommand('italic')}
                      title="Italic (Ctrl+I)"
                    >
                      <Italic size={16} />
                    </button>
                    <button 
                      className="format-btn" 
                      onClick={() => document.execCommand('underline')}
                      title="Underline (Ctrl+U)"
                    >
                      <Underline size={16} />
                    </button>
                    <button 
                      className="format-btn" 
                      onClick={() => document.execCommand('strikeThrough')}
                      title="Strikethrough"
                    >
                      <span style={{ textDecoration: 'line-through', fontSize: '14px', fontWeight: 'bold' }}>S</span>
                    </button>
                    
                    <div className="toolbar-divider"></div>
                    
                    {/* Colors */}
                    <input
                      type="color"
                      className="format-color"
                      onChange={(e) => document.execCommand('foreColor', false, e.target.value)}
                      title="Text Color"
                    />
                    <input
                      type="color"
                      className="format-color"
                      onChange={(e) => document.execCommand('backColor', false, e.target.value)}
                      title="Background Color"
                    />
                    
                    <div className="toolbar-divider"></div>
                    
                    {/* Lists */}
                    <button 
                      className="format-btn" 
                      onClick={() => document.execCommand('insertUnorderedList')}
                      title="Bullet List"
                    >
                      <List size={16} />
                    </button>
                    <button 
                      className="format-btn" 
                      onClick={() => document.execCommand('insertOrderedList')}
                      title="Numbered List"
                    >
                      <ListOrdered size={16} />
                    </button>
                    
                    {/* Alignment */}
                    <button 
                      className="format-btn" 
                      onClick={() => document.execCommand('justifyLeft')}
                      title="Align Left"
                    >
                      <AlignLeft size={16} />
                    </button>
                    <button 
                      className="format-btn" 
                      onClick={() => document.execCommand('justifyCenter')}
                      title="Align Center"
                    >
                      <span style={{ fontSize: '16px' }}>≡</span>
                    </button>
                    <button 
                      className="format-btn" 
                      onClick={() => document.execCommand('justifyRight')}
                      title="Align Right"
                    >
                      <span style={{ fontSize: '16px' }}>≣</span>
                    </button>
                    
                    <div className="toolbar-divider"></div>
                    
                    {/* Media & Code */}
                    <button 
                      className="format-btn" 
                      onClick={() => {
                        const url = prompt('Enter URL:');
                        if (url) document.execCommand('createLink', false, url);
                      }}
                      title="Insert Link"
                    >
                      <Link2 size={16} />
                    </button>
                    <button 
                      className="format-btn" 
                      onClick={() => {
                        const url = prompt('Enter image URL:');
                        if (url) document.execCommand('insertImage', false, url);
                      }}
                      title="Insert Image"
                    >
                      <Image size={16} />
                    </button>
                    <button 
                      className="format-btn" 
                      onClick={() => {
                        // Insert a new code block
                        const newBlock = {
                          id: Date.now() + Math.random(),
                          type: 'code',
                          content: '',
                          properties: { language: 'javascript' }
                        };
                        const newBlocks = [...noteBlocks, newBlock];
                        setNoteBlocks(newBlocks);
                        handleBlocksChange(newBlocks);
                      }}
                      title="Insert Code Block"
                    >
                      <Code size={16} />
                    </button>
                    
                    <div className="toolbar-divider"></div>
                    
                    {/* AI */}
                    <button 
                      className="format-btn" 
                      onClick={() => setShowAIAssistant(true)}
                      title="AI Assistant"
                    >
                      <Sparkles size={16} />
                    </button>
                    
                    {/* Clear Formatting */}
                    <button 
                      className="format-btn" 
                      onClick={() => document.execCommand('removeFormat')}
                      title="Clear Formatting"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              )}
              
              {/* Page Properties */}
              {showPageProperties && !isSharedContent && (
                <PageProperties
                  properties={pageProperties}
                  onChange={(newProps) => {
                    setPageProperties(newProps);
                    // Save properties with note
                    if (selectedNote) {
                      // You can save this to the note's properties field
                                          }
                  }}
                  readOnly={viewMode === "preview"}
                />
              )}

              {/* Exit Preview Button */}
              {viewMode === "preview" && (
                <button
                  className="exit-preview-btn"
                  onClick={() => setViewMode("edit")}
                  title="Exit preview mode"
                >
                  <X size={18} />
                  Exit Preview
                </button>
              )}

              <div 
                className={`block-editor-container ${editorDarkMode ? 'dark-mode' : ''}`} 
                style={{ fontFamily: customFont }}
              >
                <SimpleBlockEditor
                  blocks={noteBlocks}
                  onChange={handleBlocksChange}
                  readOnly={viewMode === "preview" || (isSharedContent && !canEdit)}
                  darkMode={editorDarkMode}
                />
              </div>

              {/* AI Floating Button on Selection */}
              {showAIFloatingButton && !isSharedContent && (
                <div
                  className="ai-floating-button"
                  style={{
                    position: 'fixed',
                    top: aiFloatingPosition.top,
                    left: aiFloatingPosition.left,
                    transform: 'translateX(-50%)',
                    zIndex: 1000
                  }}
                >
                  <button
                    onClick={() => {
                      setSelectedText(selectedTextContent);
                      setShowAIAssistant(true);
                      setShowAIFloatingButton(false);
                    }}
                    className={`ai-assist-btn ${editorDarkMode ? 'dark' : 'light'}`}
                  >
                    <Sparkles size={16} />
                    AI Assist
                  </button>
                </div>
              )}
            </div>

            <div className="note-footer">
              <div className="footer-left">
                <span className="stat-item">
                  {wordCount} {wordCount === 1 ? "word" : "words"}
                </span>
                <span className="stat-divider">-</span>
                <span className="stat-item">
                  {charCount} {charCount === 1 ? "character" : "characters"}
                </span>
              </div>
              <div className="footer-right">
                {saving ? (
                  <span className="saving-indicator">Saving...</span>
                ) : autoSaved ? (
                  <span className="saved-indicator">Saved <Check size={14} /></span>
                ) : (
                  <span className="unsaved-indicator">Unsaved</span>
                )}
              </div>
            </div>

              {/* Backlinks Panel */}
              {selectedNote && backlinks.length > 0 && !isSharedContent && (
                <div style={{ padding: '0 60px 40px' }}>
                  <BacklinksPanel
                    backlinks={backlinks}
                    onNoteClick={selectNote}
                  />
                </div>
              )}
            </div>


          </div>
        ) : (
          <div className="empty-state-new">
            <div className="empty-icon-large"></div>
            <h2>No Note Selected</h2>
            <p>Select a note from the sidebar or create a new one to get started</p>
            {!isSharedContent && (
              <button className="btn-create-empty" onClick={createNewNote}>
                Create New Note
              </button>
            )}
          </div>
        )}
      </div> {/* Close nr-body */}

      {showAIButton && (
        <div
          className="ai-floating-button"
          style={{
            position: "absolute",
            top: `${aiButtonPosition.top}px`,
            left: `${aiButtonPosition.left}px`,
            opacity: showAIButton ? 1 : 0,
          }}
          onClick={handleAIButtonClick}
        >
          <span className="ai-button-icon"></span>
          <span className="ai-button-text">Ask AI</span>
        </div>
      )}

      {showAIDropdown && (
        <>
          <div className="ai-overlay" onClick={() => setShowAIDropdown(false)} />
          <div
            className="ai-dropdown-new"
            style={{
              position: "fixed",
              top: `${aiDropdownPosition.top}px`,
              left: `${aiDropdownPosition.left}px`,
            }}
          >
            <div className="ai-dropdown-header">
              <span className="ai-icon"></span>
              <span>AI Content Generator</span>
            </div>
            <input
              ref={aiInputRef}
              type="text"
              className="ai-prompt-input"
              value={aiPrompt}
              placeholder="e.g., Explain quantum entanglement, Write a summary about..."
              onChange={(e) => setAiPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !generatingAI) generateAIContent();
                if (e.key === "Escape") setShowAIDropdown(false);
              }}
              disabled={generatingAI}
            />
            <div className="ai-examples">
              <button 
                onClick={() => {
                  setAiPrompt("Explain this concept in simple terms");
                  quickAIAction("explain");
                }}
                disabled={generatingAI}
              >
                Explain
              </button>
              <button 
                onClick={() => {
                  setAiPrompt("Give me 5 key points");
                  quickAIAction("key_points");
                }}
                disabled={generatingAI}
              >
                Key Points
              </button>
              <button 
                onClick={() => {
                  setAiPrompt("Write a detailed guide");
                  quickAIAction("guide");
                }}
                disabled={generatingAI}
              >
                Guide
              </button>
              <button 
                onClick={() => quickAIAction("summary")}
                disabled={generatingAI}
              >
                Summarize
              </button>
            </div>
            <div className="ai-dropdown-actions">
              <button
                className="ai-btn-cancel"
                onClick={() => setShowAIDropdown(false)}
                disabled={generatingAI}
              >
                Cancel
              </button>
              <button
                className="ai-btn-generate"
                onClick={generateAIContent}
                disabled={generatingAI || !aiPrompt.trim()}
              >
                {generatingAI ? (
                  <>
                    <span className="spinner"></span> Generating...
                  </>
                ) : (
                  <>Generate</>
                )}
              </button>
            </div>
          </div>
        </>
      )}

      {showAIAssistant && (
        <>
          <div className="ai-overlay" onClick={() => setShowAIAssistant(false)} />
          <div className="ai-assistant-modal">
            <div className="ai-assistant-header">
              <h3>AI Writing Assistant</h3>
              <button
                className="modal-close-btn"
                onClick={() => setShowAIAssistant(false)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="ai-assistant-content">
              <div className="ai-assistant-section">
                <label>Select Action:</label>
                <div className="ai-action-buttons">
                  <button
                    className={`ai-action-btn ${aiAssistAction === 'generate' ? 'active' : ''}`}
                    onClick={() => setAiAssistAction('generate')}
                  >
                    <Sparkles size={14} style={{ marginRight: '4px', display: 'inline' }} />
                    Generate Content
                  </button>
                  <button
                    className={`ai-action-btn ${aiAssistAction === 'continue' ? 'active' : ''}`}
                    onClick={() => setAiAssistAction('continue')}
                  >
                    Continue Writing
                  </button>
                  <button
                    className={`ai-action-btn ${aiAssistAction === 'improve' ? 'active' : ''}`}
                    onClick={() => setAiAssistAction('improve')}
                  >
                    Improve
                  </button>
                  <button
                    className={`ai-action-btn ${aiAssistAction === 'simplify' ? 'active' : ''}`}
                    onClick={() => setAiAssistAction('simplify')}
                  >
                    Simplify
                  </button>
                  <button
                    className={`ai-action-btn ${aiAssistAction === 'expand' ? 'active' : ''}`}
                    onClick={() => setAiAssistAction('expand')}
                  >
                    Expand
                  </button>
                  <button
                    className={`ai-action-btn ${aiAssistAction === 'grammar' ? 'active' : ''}`}
                    onClick={() => setAiAssistAction('grammar')}
                  >
                    Fix Grammar
                  </button>
                  <button
                    className={`ai-action-btn ${aiAssistAction === 'summarize' ? 'active' : ''}`}
                    onClick={() => setAiAssistAction('summarize')}
                  >
                    Summarize
                  </button>
                  <button
                    className={`ai-action-btn ${aiAssistAction === 'tone_change' ? 'active' : ''}`}
                    onClick={() => setAiAssistAction('tone_change')}
                  >
                    Change Tone
                  </button>
                  <button
                    className={`ai-action-btn ${aiAssistAction === 'code' ? 'active' : ''}`}
                    onClick={() => setAiAssistAction('code')}
                  >
                    <Code size={14} style={{ marginRight: '4px', display: 'inline' }} />
                    Code
                  </button>
                  <button
                    className={`ai-action-btn explain-only ${aiAssistAction === 'explain_only' ? 'active' : ''}`}
                    onClick={() => setAiAssistAction('explain_only')}
                    title="Get explanation without modifying text"
                  >
                    <Eye size={14} style={{ marginRight: '4px', display: 'inline' }} />
                    Explain Only
                  </button>
                </div>
              </div>

              {aiAssistAction === 'tone_change' && (
                <div className="ai-assistant-section">
                  <label>Select Tone:</label>
                  <select
                    value={aiAssistTone}
                    onChange={(e) => setAiAssistTone(e.target.value)}
                    className="tone-selector"
                  >
                    <option value="professional">Professional</option>
                    <option value="casual">Casual</option>
                    <option value="formal">Formal</option>
                    <option value="friendly">Friendly</option>
                    <option value="academic">Academic</option>
                    <option value="creative">Creative</option>
                    <option value="persuasive">Persuasive</option>
                  </select>
                </div>
              )}

              <div className="ai-assistant-section">
                <label>{aiAssistAction === 'generate' ? 'Topic or Prompt:' : 'Text to Process:'}</label>
                <textarea
                  className={`ai-text-input ${aiAssistAction === 'code' ? 'code-mode' : ''}`}
                  placeholder={
                    aiAssistAction === 'generate' 
                      ? 'Enter a topic or prompt to generate content about...' 
                      : aiAssistAction === 'code' 
                        ? 'Enter or paste your code here...' 
                        : 'Enter text or select text in the editor...'
                  }
                  value={selectedText}
                  onChange={(e) => setSelectedText(e.target.value)}
                  rows={8}
                />
              </div>

              <div className="ai-assistant-section">
                <label>Voice to Text:</label>
                <div className="voice-to-text-container">
                  <button
                    className={`voice-record-btn ${isRecording ? 'recording' : ''}`}
                    onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
                    disabled={processingVoice}
                  >
                    {isRecording ? (
                      <>
                        <MicOff size={18} />
                        <span className="recording-indicator"></span>
                        Stop Recording
                      </>
                    ) : processingVoice ? (
                      <>
                        <span className="spinner"></span>
                        Processing...
                      </>
                    ) : (
                      <>
                        <Mic size={18} />
                        Start Voice Recording
                      </>
                    )}
                  </button>
                  {voiceTranscript && (
                    <div className="voice-transcript-preview">
                      <label>Transcript:</label>
                      <p>{voiceTranscript}</p>
                    </div>
                  )}
                  <p className="voice-help-text">
                    Click to record your voice. AI will transcribe and respond to your question.
                  </p>
                </div>
              </div>

              <div className="ai-assistant-actions">
                <button
                  className="ai-btn-cancel"
                  onClick={() => setShowAIAssistant(false)}
                  disabled={generatingAI || processingVoice}
                >
                  Cancel
                </button>
                <button
                  className="ai-btn-generate"
                  onClick={aiWritingAssist}
                  disabled={generatingAI || processingVoice}
                >
                  {generatingAI ? (
                    <>
                      <span className="spinner"></span> Processing...
                    </>
                  ) : (
                    <>Process Text</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* AI Suggestion Modal - Shows AI changes for approval with inline diff */}
      {showAISuggestionModal && aiSuggestion && (
        <>
          <div className="ai-overlay" onClick={rejectAISuggestion} />
          <div className="ai-suggestion-modal">
            <div className="ai-suggestion-header">
              <h3>
                <Sparkles size={20} />
                {aiSuggestion.action === 'explain' || aiSuggestion.action === 'explain_only' 
                  ? 'AI Explanation' 
                  : `AI ${aiSuggestion.action?.charAt(0).toUpperCase() + aiSuggestion.action?.slice(1) || 'Suggestion'}`}
              </h3>
              <button
                className="modal-close-btn"
                onClick={rejectAISuggestion}
              >
                <X size={20} />
              </button>
            </div>

            <div className="ai-suggestion-content">
              {/* Show original text with strikethrough for non-explain actions */}
              {aiSuggestion.action !== 'explain' && aiSuggestion.action !== 'explain_only' && aiSuggestion.action !== 'generate' && (
                <div className="ai-suggestion-section">
                  <label className="ai-suggestion-label">
                    <span className="label-icon remove">−</span>
                    Original Text
                  </label>
                  <div className="ai-suggestion-text original">
                    <span className="diff-removed">{aiSuggestion.original}</span>
                  </div>
                </div>
              )}

              {/* Show suggested/new text with highlight - render HTML properly */}
              <div className="ai-suggestion-section">
                <label className="ai-suggestion-label">
                  <span className={`label-icon ${aiSuggestion.action === 'explain' || aiSuggestion.action === 'explain_only' ? 'info' : 'add'}`}>
                    {aiSuggestion.action === 'explain' || aiSuggestion.action === 'explain_only' ? 'i' : '+'}
                  </span>
                  {aiSuggestion.action === 'explain' || aiSuggestion.action === 'explain_only' 
                    ? 'Explanation' 
                    : aiSuggestion.action === 'generate' 
                      ? 'Generated Content'
                      : 'Suggested Change'}
                </label>
                <div 
                  className={`ai-suggestion-text suggested ${aiSuggestion.action === 'explain' || aiSuggestion.action === 'explain_only' ? 'explanation-only' : ''}`}
                  dangerouslySetInnerHTML={{ 
                    __html: `<div class="${aiSuggestion.action === 'explain' || aiSuggestion.action === 'explain_only' ? '' : 'diff-added-content'}">${aiSuggestion.suggested}</div>` 
                  }}
                />
              </div>

              {/* Hint text */}
              {aiSuggestion.action !== 'explain' && aiSuggestion.action !== 'explain_only' && (
                <p className="ai-suggestion-hint">
                  Review the changes above. The <span className="hint-removed">red text</span> will be replaced with the <span className="hint-added">green text</span>.
                </p>
              )}
            </div>

            <div className="ai-suggestion-actions">
              <button
                className="ai-suggestion-btn reject"
                onClick={rejectAISuggestion}
              >
                <X size={16} />
                {aiSuggestion.action === 'explain' || aiSuggestion.action === 'explain_only' ? 'Close' : 'Reject'}
              </button>
              {aiSuggestion.action !== 'explain' && aiSuggestion.action !== 'explain_only' && (
                <button
                  className="ai-suggestion-btn apply"
                  onClick={applyAISuggestion}
                >
                  <Check size={16} />
                  Accept
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {showFolderModal && (
        <>
          <div className="ai-overlay" onClick={() => setShowFolderModal(false)} />
          <div className="folder-modal">
            <div className="folder-modal-header">
              <h3>Create New Folder</h3>
              <button
                className="modal-close-btn"
                onClick={() => setShowFolderModal(false)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="folder-modal-content">
              <input
                type="text"
                className="folder-name-input"
                placeholder="Folder name..."
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") createFolder();
                }}
              />
              <div className="color-picker-section">
                <label>Folder Color:</label>
                <div className="color-picker-options">
                  {['#D7B38C', '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE'].map(color => (
                    <button
                      key={color}
                      className={`color-option ${newFolderColor === color ? 'active' : ''}`}
                      style={{ backgroundColor: color }}
                      onClick={() => setNewFolderColor(color)}
                    />
                  ))}
                </div>
              </div>
              <div className="folder-modal-actions">
                <button
                  className="ai-btn-cancel"
                  onClick={() => setShowFolderModal(false)}
                >
                  Cancel
                </button>
                <button className="ai-btn-generate" onClick={createFolder}>
                  Create Folder
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {showChatImport && (
        <>
          <div className="chat-import-overlay" onClick={() => setShowChatImport(false)} />
          <div className="chat-import-modal-new" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-new">
              <h2>Convert Chat to Notes</h2>
              <button className="modal-close-btn" onClick={() => setShowChatImport(false)}><X size={20} /></button>
            </div>
            <div className="modal-content-new">
              <div className="import-mode-section-new">
                <h3>Choose Import Style</h3>
                <div className="import-mode-options-new">
                  {["summary", "exam_prep", "full"].map((mode) => (
                    <label
                      key={mode}
                      className={`mode-option-new ${importMode === mode ? "selected" : ""}`}
                    >
                      <input
                        type="radio"
                        value={mode}
                        checked={importMode === mode}
                        onChange={(e) => setImportMode(e.target.value)}
                      />
                      <div className="mode-content-new">
                        <strong>
                          {mode === "summary"
                            ? "Study Notes"
                            : mode === "exam_prep"
                            ? "Exam Prep Guide"
                            : "Full Transcript"}
                        </strong>
                        <p>
                          {mode === "summary"
                            ? "Organized key concepts and explanations."
                            : mode === "exam_prep"
                            ? "Comprehensive structured study guide."
                            : "Complete conversation record."}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="sessions-section-new">
                <div className="sessions-header-new">
                  <h3>Select Chat Sessions ({selectedSessions.length} selected)</h3>
                  <div className="selection-actions-new">
                    <button onClick={selectAllSessions} className="select-all-btn-new">
                      Select All
                    </button>
                    <button onClick={clearAllSessions} className="clear-all-btn-new">
                      Clear All
                    </button>
                  </div>
                </div>
                <div className="sessions-list-new">
                  {chatSessions.length === 0 ? (
                    <div className="no-sessions-new">
                      <p>No chat sessions available</p>
                    </div>
                  ) : (
                    chatSessions.map((session) => (
                      <label
                        key={session.id}
                        className={`session-item-new ${selectedSessions.includes(session.id) ? "selected" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedSessions.includes(session.id)}
                          onChange={() => handleSessionToggle(session.id)}
                        />
                        <div className="session-info-new">
                          <div className="session-title-new">{session.title || "Untitled Session"}</div>
                          <div className="session-date-new">
                            {new Date(session.updated_at).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="modal-footer-new">
              <button
                className="cancel-btn-new"
                onClick={() => setShowChatImport(false)}
                disabled={importing}
              >
                Cancel
              </button>
              <button
                className="import-btn-new"
                onClick={convertChatToNote}
                disabled={importing || selectedSessions.length === 0}
              >
                {importing ? (
                  <>
                    <span className="spinner"></span> Converting...
                  </>
                ) : (
                  <>Convert to Note</>
                )}
              </button>
            </div>
          </div>
        </>
      )}

      <CustomPopup
        isOpen={popup.isOpen}
        onClose={closePopup}
        title={popup.title}
        message={popup.message}
      />

      {/* Tags Panel */}
      {showTagsPanel && !isSharedContent && (
        <TagsPanel
          tags={allTags}
          selectedTag={selectedTagFilter}
          onTagSelect={handleTagSelect}
          onClose={() => setShowTagsPanel(false)}
        />
      )}

      {/* Advanced Search */}
      {showAdvancedSearch && !isSharedContent && (
        <>
          <div className="ai-overlay" onClick={() => setShowAdvancedSearch(false)} />
          <AdvancedSearch
            notes={notes}
            folders={folders}
            onSelectNote={selectNote}
            onClose={() => setShowAdvancedSearch(false)}
          />
        </>
      )}

      {/* Templates */}
      {showTemplates && !isSharedContent && (
        <>
          <div className="ai-overlay" onClick={() => setShowTemplates(false)} />
          <Templates
            onSelectTemplate={handleTemplateSelect}
            onClose={() => setShowTemplates(false)}
            userName={userName}
          />
        </>
      )}

      {/* Recently Viewed */}
      {showRecentlyViewed && !isSharedContent && (
        <>
          <div className="ai-overlay" onClick={() => setShowRecentlyViewed(false)} />
          <div className="recently-viewed-modal">
            <RecentlyViewed
              items={recentlyViewed}
              onSelect={(id) => {
                const note = notes.find(n => n.id === id);
                if (note) {
                  selectNote(note);
                }
                setShowRecentlyViewed(false);
              }}
              onClose={() => setShowRecentlyViewed(false)}
            />
          </div>
        </>
      )}

      {/* Canvas Mode */}
      {showCanvasMode && !isSharedContent && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 }}>
          <CanvasMode
            initialContent={canvasData}
            onClose={() => setShowCanvasMode(false)}
            onSave={(newCanvasData, shouldClose = false) => {
              setCanvasData(newCanvasData);
              if (shouldClose) {
                setShowCanvasMode(false);
              }
              // Trigger auto-save after a short delay
              setTimeout(() => autoSave(), 100);
            }}
          />
        </div>
      )}

      {/* Smart Folders */}
      {showSmartFolders && !isSharedContent && (
        <>
          <div 
            className="ai-overlay" 
            style={{ zIndex: 10000 }} 
            onClick={() => setShowSmartFolders(false)} 
          />
          <SmartFolders
            notes={notes}
            onFolderSelect={(filteredNotes, folderName) => {
                            // You can add logic here to display filtered notes
              setShowSmartFolders(false);
            }}
            onClose={() => setShowSmartFolders(false)}
          />
        </>
      )}

      {/* Keyboard Shortcuts Panel */}
      <KeyboardShortcuts
        isOpen={showKeyboardShortcuts}
        onClose={() => setShowKeyboardShortcuts(false)}
      />
      
      {/* Import/Export Modal */}
      <ImportExportModal
        isOpen={showImportExport}
        onClose={() => setShowImportExport(false)}
        mode="import"
        sourceType="notes"
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
            } else if (result.destinationType === 'questions') {
              // Navigate to question bank
              navigate('/question-bank');
            } else if (result.destinationType === 'notes') {
              // Navigate to the created note
              if (result.note_id) {
                navigate(`/notes/${result.note_id}`);
              } else {
                loadNotes();
              }
            }
          } else {
            showPopup("Success", `Successfully converted notes!`);
            loadNotes();
          }
        }}
      />
    </div>
  );
};

export default NotesRedesign;
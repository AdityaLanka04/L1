import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ReactQuill, { Quill } from "react-quill";
import "react-quill/dist/quill.snow.css";
import "./NotesRedesign.css";
import CustomPopup from "./CustomPopup";
import { useTheme } from '../contexts/ThemeContext';
import { 
  Plus, FileText, Upload, Search, Star, Trash2, 
  FolderPlus, Folder, Download, FileDown, Printer, 
  Eye, Edit3, Maximize2, Minimize2, Menu, X, 
  ChevronDown, Check, Sparkles, Mic, MicOff, 
  MoreVertical, Archive, RefreshCw, Save, Clock,
  AlignLeft, Bold, Italic, Underline, 
  List, ListOrdered, Link2, Image, Code,
  ArrowLeft
} from 'lucide-react';

// Remove problematic imports and register them conditionally
let QuillTableUI;
try {
  QuillTableUI = require('quill-table-ui');
  if (QuillTableUI && QuillTableUI.default) {
    Quill.register('modules/tableUI', QuillTableUI.default);
  }
} catch (error) {
  console.warn('Quill Table UI not available:', error);
}

let katex;
try {
  katex = require('katex');
  if (katex) {
    window.katex = katex;
  }
} catch (error) {
  console.warn('KaTeX not available:', error);
}

const NotesRedesign = ({ sharedMode = false }) => {
  const { noteId } = useParams();
  const navigate = useNavigate();
  
  // Add shared content state
  const [sharedNoteData, setSharedNoteData] = useState(null);
  const [isSharedContent, setIsSharedContent] = useState(sharedMode);
  const [canEdit, setCanEdit] = useState(false);

  // ... existing state ...
  const [userName, setUserName] = useState("");
  const [userProfile, setUserProfile] = useState(null);
  const [notes, setNotes] = useState([]);
  const [selectedNote, setSelectedNote] = useState(null);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  const [autoSaved, setAutoSaved] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [titleSectionCollapsed, setTitleSectionCollapsed] = useState(false);
  
  const [showAIDropdown, setShowAIDropdown] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiDropdownPosition, setAiDropdownPosition] = useState({ top: 0, left: 0 });
  const [generatingAI, setGeneratingAI] = useState(false);

  const { selectedTheme } = useTheme();
  
  useEffect(() => {
    console.log('Notes - Selected theme:', selectedTheme);
    console.log('Notes - Theme tokens:', selectedTheme?.tokens);
  }, [selectedTheme]);

  useEffect(() => {
    if (selectedTheme && selectedTheme.tokens) {
      const root = document.documentElement;
      
      Object.entries(selectedTheme.tokens).forEach(([key, value]) => {
        root.style.setProperty(`--${key}`, value);
      });
      
      console.log('Applied theme variables to DOM');
    }
  }, [selectedTheme]);

  const [viewMode, setViewMode] = useState("edit");

  // Fix Font registration - check if Quill is available
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
        console.warn('Font registration failed:', error);
      }
    }
  }, []);
  
  const [showAIButton, setShowAIButton] = useState(false);
  const [aiButtonPosition, setAiButtonPosition] = useState({ top: 0, left: 0 });
  const [selectedRange, setSelectedRange] = useState(null);

  const [folders, setFolders] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderColor, setNewFolderColor] = useState("#D7B38C");
  const [showTrash, setShowTrash] = useState(false);
  const [trashedNotes, setTrashedNotes] = useState([]);
  const [showFavorites, setShowFavorites] = useState(false);
  const [customFont, setCustomFont] = useState("Inter");
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [aiAssistAction, setAiAssistAction] = useState("improve");
  const [aiAssistTone, setAiAssistTone] = useState("professional");
  const [selectedText, setSelectedText] = useState("");

  const [draggedNote, setDraggedNote] = useState(null);
  const [dragOverFolder, setDragOverFolder] = useState(null);

  const [showChatImport, setShowChatImport] = useState(false);
  const [chatSessions, setChatSessions] = useState([]);
  const [selectedSessions, setSelectedSessions] = useState([]);
  const [importMode, setImportMode] = useState("summary");
  const [importing, setImporting] = useState(false);

  const [isRecording, setIsRecording] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [processingVoice, setProcessingVoice] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const quillRef = useRef(null);
  const saveTimeout = useRef(null);
  const aiInputRef = useRef(null);

  const [popup, setPopup] = useState({ isOpen: false, title: "", message: "" });
  const showPopup = (title, message) => setPopup({ isOpen: true, title, message });
  const closePopup = () => setPopup({ isOpen: false, title: "", message: "" });

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
      console.error('Error loading shared note:', error);
      navigate('/social');
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    const username = localStorage.getItem("username");
    const profile = localStorage.getItem("userProfile");

    if (!token) {
      navigate("/login");
      return;
    }
    
    if (sharedMode && noteId) {
      loadSharedNote();
    } else {
      // Normal notes loading logic
      if (username) setUserName(username);
      if (profile) {
        try {
          setUserProfile(JSON.parse(profile));
        } catch (error) {
          console.error("Error parsing user profile:", error);
        }
      }
    }
  }, [navigate, sharedMode, noteId]);

  useEffect(() => {
    if (userName && !isSharedContent) {
      loadNotes();
      loadFolders();
      loadChatSessions();
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
        if (activeNotes.length > 0 && !selectedNote) {
          selectNote(activeNotes[0]);
        }
      } else {
        throw new Error(`Failed to load notes: ${res.status}`);
      }
    } catch (e) {
      console.error("Error loading notes:", e);
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
    if (!canEdit) return; // Don't show AI button if no edit permission
    
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
  }, [canEdit]);

  useEffect(() => {
    if (!quillReady || !canEdit) return;

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
  }, [handleTextSelection, showAIButton, quillReady, canEdit]);

  const handleAIButtonClick = () => {
    if (!canEdit) return;
    setShowAIAssistant(true);
    setShowAIButton(false);
  };

  const processSelectedText = async (action) => {
    if (!selectedText || !selectedText.trim() || !canEdit) {
      showPopup("No Text Selected", "Please select text first");
      return;
    }

    console.log(`Processing text with action: ${action}`);
    setGeneratingAI(true);

    try {
      const token = localStorage.getItem("token");
      const res = await fetch("${API_URL}/ai_writing_assistant/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          user_id: userName,
          content: selectedText,
          action: action,
          tone: aiAssistTone,
          context: noteContent,
        }),
      });

      if (!res.ok) throw new Error("AI processing failed");

      const data = await res.json();
      const quill = quillRef.current?.getEditor();

      if (quill && selectedRange) {
        quill.deleteText(selectedRange.index, selectedRange.length);
        quill.insertText(selectedRange.index, data.result);
        quill.setSelection(selectedRange.index + data.result.length);
      }

      setNoteContent(quill.root.innerHTML);
      showPopup("Success", `Text ${action} completed`);
    } catch (error) {
      console.error("AI processing error:", error);
      showPopup("Error", "Failed to process text");
    } finally {
      setGeneratingAI(false);
      setSelectedText("");
      setSelectedRange(null);
    }
  };

  const quickTextAction = async (actionType) => {
    if (!canEdit) return;
    
    console.log(`Quick action: ${actionType}`);
    setGeneratingAI(true);

    try {
      const token = localStorage.getItem("token");
      
      const fd = new FormData();
      fd.append("user_id", userName);
      fd.append("prompt", selectedText);
      fd.append("content_type", actionType);
      fd.append("existing_content", noteContent);

      const res = await fetch("${API_URL}/generate_note_content/", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });

      if (!res.ok) throw new Error("AI generation failed");

      const data = await res.json();
      const quill = quillRef.current?.getEditor();

      if (quill && selectedRange) {
        const insertPosition = selectedRange.index + selectedRange.length;
        quill.insertText(insertPosition, "\n\n");
        quill.clipboard.dangerouslyPasteHTML(insertPosition + 2, data.content);
        quill.setSelection(insertPosition + data.content.length + 2);
      }

      setNoteContent(quill.root.innerHTML);
      showPopup("Success", `${actionType} content added`);
    } catch (error) {
      console.error("AI action error:", error);
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
      console.error("Error loading folders:", e);
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
      console.error("Error loading trash:", e);
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
      console.error("Error loading chat sessions:", e);
    }
  };

  const createFolder = async () => {
    if (!newFolderName.trim()) {
      showPopup("Error", "Folder name cannot be empty");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const res = await fetch("${API_URL}/create_folder", {
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
      console.error("Error creating folder:", e);
      showPopup("Error", "Failed to create folder");
    }
  };

  const createNoteInFolder = async (folderId) => {
    if (isSharedContent) return;
    
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("${API_URL}/create_note", {
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
      console.error("Error creating note in folder:", error);
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
      console.error("Error deleting folder:", e);
      showPopup("Error", "Failed to delete folder");
    }
  };

  const moveNoteToFolder = async (noteId, folderId) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("${API_URL}/move_note_to_folder", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}` },
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
      console.error("Error moving note:", e);
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
      const res = await fetch("${API_URL}/toggle_favorite", {
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
      console.error("Error toggling favorite:", e);
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
      console.error("Error moving to trash:", e);
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
      console.error("Error restoring note:", e);
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
      console.error("Error permanently deleting:", e);
      showPopup("Error", "Failed to delete note");
    }
  };

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
      
      const res = await fetch("${API_URL}/create_note", {
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
      } else {
        throw new Error(`Failed to create note: ${res.status}`);
      }
    } catch (error) {
      console.error("Error creating new note:", error);
      showPopup("Error", "Failed to create note");
    }
  };

  const duplicateNote = async (note) => {
    if (isSharedContent) return;
    
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("${API_URL}/create_note", {
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
      console.error("Error duplicating note:", error);
      showPopup("Error", "Failed to duplicate note");
    }
  };

  const selectNote = (n) => {
    setSelectedNote(n);
    setNoteTitle(n.title);
    setNoteContent(n.content);
    setViewMode("edit");

    setTimeout(() => {
      const quill = quillRef.current?.getEditor();
      if (quill) {
        quill.setSelection(0, 0);
      }
    }, 100);
  };

  const autoSave = useCallback(async () => {
    if (!selectedNote) return;
    
    // For shared notes, use the update_shared_note endpoint
    if (isSharedContent) {
      if (!canEdit) return; // Don't save if no edit permission
      
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
        console.error('Save error:', error);
      }
    } else {
      // Normal save logic for own notes
      const noteStillExists = notes.find(n => n.id === selectedNote.id);
      if (!noteStillExists) return;
      
      if (selectedNote.is_deleted || noteStillExists.is_deleted) return;
      
      setSaving(true);
      
      try {
        const token = localStorage.getItem("token");
        const res = await fetch("${API_URL}/update_note", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            note_id: selectedNote.id,
            title: noteTitle,
            content: noteContent,
          }),
        });
        
        if (res.ok) {
          setSaving(false);
          setAutoSaved(true);
          setTimeout(() => setAutoSaved(false), 2000);

          setNotes((prev) =>
            prev.map((n) =>
              n.id === selectedNote.id ? { ...n, title: noteTitle, content: noteContent } : n
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
        console.error("Save error:", error);
      }
    }
  }, [selectedNote, noteTitle, noteContent, notes, isSharedContent, canEdit]);

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
  }, [noteContent, noteTitle, selectedNote, autoSave, isSharedContent, canEdit]);

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

  const handleEditorChange = (content, delta, source, editor) => {
    if (!canEdit) return;
    
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
    if (!aiPrompt.trim() || !canEdit) {
      showPopup("Empty Prompt", "Please enter a prompt for AI generation");
      return;
    }

    setGeneratingAI(true);
    try {
      const token = localStorage.getItem("token");
      
      let actionType = "general";
      if (aiPrompt.toLowerCase().includes("explain")) {
        actionType = "explain";
      } else if (aiPrompt.toLowerCase().includes("key points")) {
        actionType = "key_points";
      } else if (aiPrompt.toLowerCase().includes("guide")) {
        actionType = "guide";
      }

      const fd = new FormData();
      fd.append("user_id", userName);
      fd.append("prompt", aiPrompt);
      fd.append("content_type", actionType);
      fd.append("existing_content", noteContent);

      const res = await fetch("${API_URL}/generate_note_content/", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });

      if (!res.ok) throw new Error("AI generation failed");

      const data = await res.json();
      const quill = quillRef.current?.getEditor();

      if (quill) {
        const range = quill.getSelection();
        const index = range ? range.index : quill.getLength();
        quill.insertText(index, "\n");
        quill.clipboard.dangerouslyPasteHTML(index + 1, data.content);
        quill.setSelection(index + data.content.length + 1);
      }

      setNoteContent(quillRef.current?.getEditor().root.innerHTML);
      showPopup("AI Generated", "Content inserted successfully");
    } catch (error) {
      console.error("AI generation error:", error);
      showPopup("Error", "Failed to generate AI content");
    } finally {
      setGeneratingAI(false);
      setShowAIDropdown(false);
      setAiPrompt("");
    }
  };

  const quickAIAction = async (actionType) => {
    if (!canEdit) return;
    
    setGeneratingAI(true);
    try {
      const token = localStorage.getItem("token");
      
      const fd = new FormData();
      fd.append("user_id", userName);
      fd.append("prompt", aiPrompt || "Generate content");
      fd.append("content_type", actionType);
      fd.append("existing_content", noteContent);

      const res = await fetch("${API_URL}/generate_note_content/", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });

      if (!res.ok) throw new Error("AI generation failed");

      const data = await res.json();
      const quill = quillRef.current?.getEditor();

      if (quill) {
        const range = quill.getSelection();
        const index = range ? range.index : quill.getLength();
        quill.insertText(index, "\n");
        quill.clipboard.dangerouslyPasteHTML(index + 1, data.content);
        quill.setSelection(index + data.content.length + 1);
      }

      setNoteContent(quillRef.current?.getEditor().root.innerHTML);
      showPopup("AI Generated", `${actionType} content inserted`);
    } catch (error) {
      console.error("AI action error:", error);
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
    if (!canEdit) return;
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const options = { mimeType: 'audio/webm' };
      const mediaRecorder = new MediaRecorder(stream, options);
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          console.log("Audio chunk received:", event.data.size, "bytes");
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        console.log("Recording stopped, total chunks:", audioChunksRef.current.length);
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        console.log("Audio blob created, size:", audioBlob.size, "bytes");
        
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
      console.log("Recording started");
      showPopup("Recording", "Voice recording started");
    } catch (error) {
      console.error("Error starting recording:", error);
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

      console.log("Sending audio to transcribe endpoint...");
      console.log("Audio blob size:", audioBlob.size);
      console.log("User:", userName);

      const transcribeRes = await fetch("${API_URL}/transcribe_audio/", {
        method: "POST",
        headers: { 
          Authorization: `Bearer ${token}`
        },
        body: formData,
      });

      console.log("Transcribe response status:", transcribeRes.status);

      if (!transcribeRes.ok) {
        const errorText = await transcribeRes.text();
        console.error("Transcription error:", errorText);
        throw new Error(`Transcription failed: ${transcribeRes.status} - ${errorText}`);
      }

      const transcribeData = await transcribeRes.json();
      console.log("Transcription result:", transcribeData);
      
      const transcript = transcribeData.transcript;
      setVoiceTranscript(transcript);

      console.log("Sending transcript to AI:", transcript);

      const aiRes = await fetch("${API_URL}/generate_note_content/", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: (() => {
          const fd = new FormData();
          fd.append("user_id", userName);
          fd.append("prompt", transcript);
          fd.append("content_type", "voice_response");
          fd.append("existing_content", noteContent);
          return fd;
        })(),
      });

      if (!aiRes.ok) {
        const errorText = await aiRes.text();
        console.error("AI generation error:", errorText);
        throw new Error(`AI response failed: ${aiRes.status}`);
      }

      const aiData = await aiRes.json();
      console.log("AI response received");
      
      const quill = quillRef.current?.getEditor();

      if (quill) {
        const range = quill.getSelection();
        const index = range ? range.index : quill.getLength();
        quill.insertText(index, "\n\n");
        quill.clipboard.dangerouslyPasteHTML(index + 2, aiData.content);
        quill.setSelection(index + aiData.content.length + 2);
      }

      setNoteContent(quillRef.current?.getEditor().root.innerHTML);
      showPopup("Success", "Voice transcribed and AI response added to note");
      setVoiceTranscript("");
    } catch (error) {
      console.error("Voice processing error:", error);
      showPopup("Error", error.message || "Failed to process voice input");
    } finally {
      setProcessingVoice(false);
    }
  };

  const aiWritingAssist = async () => {
    if (!canEdit) return;
    
    const quill = quillRef.current?.getEditor();
    if (!quill) return;

    const range = quill.getSelection();
    let textToProcess = selectedText;

    if (!textToProcess && range && range.length > 0) {
      textToProcess = quill.getText(range.index, range.length);
    }

    if (!textToProcess || !textToProcess.trim()) {
      showPopup("No Text Selected", "Please select text or enter text to process");
      return;
    }

    setGeneratingAI(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("${API_URL}/ai_writing_assistant/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          user_id: userName,
          content: textToProcess,
          action: aiAssistAction,
          tone: aiAssistTone,
          context: noteContent,
        }),
      });

      if (!res.ok) throw new Error("AI assist failed");

      const data = await res.json();

      if (range && range.length > 0) {
        quill.deleteText(range.index, range.length);
        quill.insertText(range.index, data.result);
        quill.setSelection(range.index + data.result.length);
      } else {
        const cursorPos = range ? range.index : quill.getLength();
        quill.insertText(cursorPos, "\n\n" + data.result);
        quill.setSelection(cursorPos + data.result.length + 2);
      }

      setNoteContent(quill.root.innerHTML);
      setShowAIAssistant(false);
      setSelectedText("");
      showPopup("AI Assistant", `Text ${aiAssistAction} successfully`);
    } catch (error) {
      console.error("AI assistant error:", error);
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
      const allMessages = [];
      
      for (const sid of selectedSessions) {
        const r = await fetch(`${API_URL}/get_chat_history/${sid}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (r.ok) {
          const data = await r.json();
          const s = chatSessions.find((x) => x.id === sid);
          allMessages.push({ sessionTitle: s?.title || "Chat Session", messages: data.messages });
        }
      }

      const conversationData = allMessages
        .map((s) => s.messages.map((m) => `Q: ${m.user_message}\nA: ${m.ai_response}`).join("\n\n"))
        .join("\n\n--- New Session ---\n\n");

      const summaryRes = await fetch("${API_URL}/generate_note_summary/", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: (() => {
          const fd = new FormData();
          fd.append("user_id", userName);
          fd.append("conversation_data", conversationData);
          fd.append("session_titles", JSON.stringify(allMessages.map((s) => s.sessionTitle)));
          fd.append("import_mode", importMode);
          return fd;
        })(),
      });

      let title = "Generated Note from Chat";
      let content = "";
      
      if (summaryRes.ok) {
        const d = await summaryRes.json();
        title = d.title;
        content = d.content;
        content = convertMarkdownToHTML(content);
      } else {
        content = allMessages
          .map(
            (s, i) =>
              `<h2>${s.sessionTitle}</h2>` +
              s.messages.map((m, j) => `<b>Q${j + 1}:</b> ${m.user_message}<br/><b>A:</b> ${m.ai_response}`).join("<br/><br/>")
          )
          .join("<hr/>");
      }

      const createRes = await fetch("${API_URL}/create_note", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ user_id: userName, title, content }),
      });
      
      if (createRes.ok) {
        const newNote = await createRes.json();
        setNotes(prev => [newNote, ...prev]);
        selectNote(newNote);
        setShowChatImport(false);
        setSelectedSessions([]);
        showPopup("Conversion Successful", `"${title}" created successfully.`);
      } else {
        throw new Error(`Failed to create note: ${createRes.status}`);
      }
    } catch (err) {
      console.error("Convert error:", err);
      showPopup("Conversion Failed", "Unable to convert chat to note.");
    }
    setImporting(false);
  };

  const exportAsPDF = () => {
    const printWindow = window.open('', '_blank');
    
    const styles = `
      <style>
        body {
          font-family: '${customFont}', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          padding: 40px;
          max-width: 800px;
          margin: 0 auto;
          color: #1a1a1a;
          line-height: 1.8;
          position: relative;
        }
        
        /* Diagonal Centered Watermark */
        body::before {
          content: 'BrainWaveAI';
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
        
        /* Print Styles */
        @media print {
          body::before {
            content: 'BrainWaveAI';
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

    showPopup("Export", "Print dialog opened - Save as PDF with BrainWaveAI watermark");
  };

  const exportAsText = () => {
    const text = noteContent.replace(/<[^>]+>/g, "");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${noteTitle || "note"}.txt`;
    a.click();
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
    <div className="notes-redesign">
      <div className={`notes-sidebar-new ${sidebarOpen && !isSharedContent ? "open" : "closed"}`}>
        <div className="sidebar-header-new">
          <div className="sidebar-title">
            <h2>My Notes</h2>
            <span className="notes-count">{notes.length}</span>
          </div>
          <div className="sidebar-actions">
            <button onClick={createNewNote} className="btn-new-note" title="Create new note">
              <Plus size={18} /> New Note
            </button>
            <button onClick={() => setShowChatImport(true)} className="btn-import-chat" title="Import from AI Chat">
              <Upload size={16} /> From Chat
            </button>
          </div>
        </div>

        <div className="sidebar-filters">
          <button
            className={`filter-btn ${!showFavorites && !showTrash && !selectedFolder ? 'active' : ''}`}
            onClick={() => {
              setShowFavorites(false);
              setShowTrash(false);
              setSelectedFolder(null);
            }}
          >
            <FileText size={16} /> All Notes
          </button>
          <button
            className={`filter-btn ${showFavorites ? 'active' : ''}`}
            onClick={() => {
              setShowFavorites(!showFavorites);
              setShowTrash(false);
              setSelectedFolder(null);
            }}
          >
            <Star size={16} /> Favorites
          </button>
          <button
            className={`filter-btn ${showTrash ? 'active' : ''}`}
            onClick={() => {
              setShowTrash(!showTrash);
              setShowFavorites(false);
              setSelectedFolder(null);
              if (!showTrash) loadTrash();
            }}
          >
            <Trash2 size={16} /> Trash
          </button>
        </div>

        <div className="folders-section">
          <div className="folders-header">
            <h3>Folders</h3>
            <button onClick={() => setShowFolderModal(true)} className="btn-add-folder">
              <FolderPlus size={18} />
            </button>
          </div>
          <div className="folders-list">
            {folders.length === 0 && (
              <div
                className={`folder-item ${selectedFolder === 0 ? 'active' : ''} ${dragOverFolder === 0 ? 'drag-over' : ''}`}
                onClick={() => {
                  setSelectedFolder(0);
                  setShowFavorites(false);
                  setShowTrash(false);
                }}
                onDragOver={(e) => handleDragOver(e, null)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, null)}
              >
                <span>Notes not in a folder</span>
                <span className="folder-count">
                  {notes.filter(n => !n.folder_id).length}
                </span>
              </div>
            )}
            
            {folders.map((folder) => (
              <div key={folder.id} className="folder-item-wrapper">
                <div
                  className={`folder-item ${selectedFolder === folder.id ? 'active' : ''} ${dragOverFolder === folder.id ? 'drag-over' : ''}`}
                  onClick={() => {
                    setSelectedFolder(folder.id);
                    setShowFavorites(false);
                    setShowTrash(false);
                  }}
                  onDragOver={(e) => handleDragOver(e, folder.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, folder.id)}
                  style={{ borderLeft: `3px solid ${folder.color}` }}
                >
                  <span>{folder.name}</span>
                  <div className="folder-actions">
                    <span className="folder-count">{folder.note_count || 0}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        createNoteInFolder(folder.id);
                      }}
                      className="folder-add-note-btn"
                      title="Add note to this folder"
                    >
                      <Plus size={14} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteFolder(folder.id);
                      }}
                      className="folder-delete-btn"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            
            {folders.length > 0 && notes.filter(n => !n.folder_id && !n.is_deleted).length > 0 && (
              <div
                className={`folder-item unfiled-notes ${selectedFolder === 0 ? 'active' : ''} ${dragOverFolder === 0 ? 'drag-over' : ''}`}
                onClick={() => {
                  setSelectedFolder(0);
                  setShowFavorites(false);
                  setShowTrash(false);
                }}
                onDragOver={(e) => handleDragOver(e, null)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, null)}
              >
                <span>Unfiled Notes</span>
                <span className="folder-count">
                  {notes.filter(n => !n.folder_id && !n.is_deleted).length}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="search-container">
          <input
            type="text"
            className="search-input-new"
            placeholder="Search notes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="notes-list-new">
          {showTrash ? (
            trashedNotes.length === 0 ? (
              <div className="no-notes-new">
                <div className="empty-icon"></div>
                <p>Trash is empty</p>
              </div>
            ) : (
              trashedNotes.map((n) => (
                <div key={n.id} className="note-item-new trash-item">
                  <div className="note-title-small">{n.title || "Untitled"}</div>
                  <div className="note-snippet">
                    Deleted {Math.max(0, 30 - (30 - n.days_remaining))} days ago - {n.days_remaining} days remaining
                  </div>
                  <div className="trash-actions">
                    <button
                      onClick={() => restoreNote(n.id)}
                      className="restore-btn"
                    >
                      Restore
                    </button>
                    <button
                      onClick={() => permanentDelete(n.id)}
                      className="permanent-delete-btn"
                    >
                      Delete Forever
                    </button>
                  </div>
                </div>
              ))
            )
          ) : filteredNotes.length === 0 ? (
            <div className="no-notes-new">
              <div className="empty-icon"></div>
              <p>No notes found</p>
              <button onClick={createNewNote} className="create-first-note">
                Create your first note
              </button>
            </div>
          ) : (
            filteredNotes.map((n) => (
              <div
                key={n.id}
                className={`note-item-new ${selectedNote?.id === n.id ? "active" : ""}`}
                onClick={() => selectNote(n)}
                draggable={!isSharedContent}
                onDragStart={(e) => handleDragStart(e, n)}
                onDragEnd={handleDragEnd}
              >
                <div className="note-item-header">
                  <div className="note-title-small">
                    {n.is_favorite && <span className="favorite-star"><Star size={14} fill="currentColor" /></span>}
                    {n.title || "Untitled"}
                  </div>
                  <div className="note-actions">
                    <button
                      className={`note-action-btn favorite ${n.is_favorite ? 'active' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(n.id);
                      }}
                      title={n.is_favorite ? "Remove from favorites" : "Add to favorites"}
                    >
                      {n.is_favorite ? <Star size={14} fill="currentColor" /> : <Star size={14} />}
                    </button>
                    <button
                      className="note-action-btn duplicate"
                      onClick={(e) => {
                        e.stopPropagation();
                        duplicateNote(n);
                      }}
                      title="Duplicate note"
                    >
                      <Archive size={14} />
                    </button>
                    <button
                      className="note-action-btn delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        moveToTrash(n.id);
                      }}
                      title="Move to trash"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="note-snippet">
                  {n.content.replace(/<[^>]+>/g, "").slice(0, 100) || "Empty note"}
                </div>
                <div className="note-meta">
                  <span className="note-date">
                    {new Date(n.updated_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                  <span className="note-time">
                    {new Date(n.updated_at).toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {n.folder_id && (
                    <span className="note-folder-badge">
                      {folders.find(f => f.id === n.folder_id)?.name || 'Folder'}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="editor-area-new">
        <div className="top-nav-new">
          <div className="nav-left">
            {isSharedContent ? (
              <button
                onClick={() => navigate('/social')}
                className="toggle-sidebar"
                title="Back to Social"
              >
                <ArrowLeft size={18} />
              </button>
            ) : (
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="toggle-sidebar"
                title="Toggle sidebar"
              >
                {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
            )}
            <div className="nav-title">
              Brainwave Notes
              {isSharedContent && <span className="shared-badge">SHARED</span>}
            </div>
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

          <div className="nav-center">
            {selectedNote && (
              <div className="editor-tools">
                <button
                  className={`tool-btn ${viewMode === "edit" ? "active" : ""}`}
                  onClick={() => setViewMode("edit")}
                  title="Edit mode"
                  disabled={isSharedContent && !canEdit}
                >
                  <Edit3 size={16} /> Edit
                </button>
                <button
                  className={`tool-btn ${viewMode === "preview" ? "active" : ""}`}
                  onClick={() => setViewMode("preview")}
                  title="Preview mode"
                >
                  <Eye size={16} /> Preview
                </button>
                <div className="tool-divider"></div>
                <button className="tool-btn" onClick={exportAsPDF} title="Export as PDF">
                  <FileDown size={16} /> PDF
                </button>
                <button className="tool-btn" onClick={exportAsText} title="Export as Text">
                  <Download size={16} /> TXT
                </button>
                <div className="tool-divider"></div>
                <button
                  className="tool-btn"
                  onClick={() => setShowAIAssistant(true)}
                  title="AI Writing Assistant"
                  disabled={isSharedContent && !canEdit}
                >
                  <Sparkles size={16} /> AI Assist
                </button>
              </div>
            )}
          </div>

          <div className="nav-actions-new">
            <button className="nav-btn" onClick={() => navigate("/dashboard")}>
              Dashboard
            </button>
            <button className="nav-btn" onClick={() => navigate("/ai-chat")}>
              AI Chat
            </button>
            <button className="logout-btn-new" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>

        {/* Conditionally disable editing for view-only shared notes */}
        {viewMode === "edit" && isSharedContent && !canEdit && (
          <div className="view-only-overlay">
            <Eye size={24} />
            <p>This is a shared note with view-only access</p>
          </div>
        )}

        {selectedNote ? (
          <div className="editor-content">
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
                <button
                  className="title-collapse-btn"
                  onClick={() => setTitleSectionCollapsed(!titleSectionCollapsed)}
                  title={titleSectionCollapsed ? "Expand title" : "Collapse title"}
                >
                  <ChevronDown size={16} className={titleSectionCollapsed ? '' : 'rotated'} />
                </button>
              </div>
            </div>

            {viewMode === "edit" ? (
              <div className="quill-container">
                <ReactQuill
                  ref={quillRef}
                  theme="snow"
                  value={noteContent}
                  onChange={handleEditorChange}
                  modules={modules}
                  formats={formats}
                  placeholder={isSharedContent && !canEdit ? "You have view-only access to this shared note" : "Start typing your notes here... (Press '/' for AI assistance)"}
                  className="quill-editor-enhanced"
                  style={{ fontFamily: customFont }}
                  readOnly={isSharedContent && !canEdit}
                />
              </div>
            ) : (
              <div className="quill-container">
                <ReactQuill
                  theme="snow"
                  value={noteContent}
                  readOnly={true}
                  modules={modules}
                  formats={formats}
                  className="quill-editor-enhanced"
                  style={{ fontFamily: customFont }}
                />
              </div>
            )}

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
          </div>
        ) : (
          <div className="empty-state-new">
            <div className="empty-icon-large"></div>
            <h2>No Note Selected</h2>
            <p>Select a note from the sidebar or create a new one to get started</p>
            <button className="btn-create-empty" onClick={createNewNote}>
              Create New Note
            </button>
          </div>
        )}
      </div>

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
                <label>Text to Process:</label>
                <textarea
                  className={`ai-text-input ${aiAssistAction === 'code' ? 'code-mode' : ''}`}
                  placeholder={aiAssistAction === 'code' ? 'Enter or paste your code here...' : 'Enter text or select text in the editor...'}
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
    </div>
  );
};

export default NotesRedesign;
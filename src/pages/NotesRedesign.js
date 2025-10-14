import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import ReactQuill, { Quill } from "react-quill";
import "react-quill/dist/quill.snow.css";
import "./NotesRedesign.css";
import CustomPopup from "./CustomPopup";

// Import Quill modules for advanced features
import QuillTableUI from 'quill-table-ui';
import 'quill-table-ui/dist/index.css';

// KaTeX for math equations
import katex from 'katex';
import 'katex/dist/katex.min.css';
Quill.register('modules/tableUI', QuillTableUI);
window.katex = katex;

const NotesRedesign = () => {
  // STATE
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

  // AI / Slash Command
  const [showAIDropdown, setShowAIDropdown] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiDropdownPosition, setAiDropdownPosition] = useState({ top: 0, left: 0 });
  const [generatingAI, setGeneratingAI] = useState(false);

  // View Mode
  const [viewMode, setViewMode] = useState("edit");
  
  // Text selection menu states
  const [showTextActionMenu, setShowTextActionMenu] = useState(false);
  const [textActionMenuPosition, setTextActionMenuPosition] = useState({ top: 0, left: 0 });
  const [selectedRange, setSelectedRange] = useState(null);

  // FOLDERS & FEATURES STATE
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

  // DRAG & DROP STATE
  const [draggedNote, setDraggedNote] = useState(null);
  const [dragOverFolder, setDragOverFolder] = useState(null);

  // CHAT IMPORT STATE
  const [showChatImport, setShowChatImport] = useState(false);
  const [chatSessions, setChatSessions] = useState([]);
  const [selectedSessions, setSelectedSessions] = useState([]);
  const [importMode, setImportMode] = useState("summary");
  const [importing, setImporting] = useState(false);

  const navigate = useNavigate();
  const quillRef = useRef(null);
  const saveTimeout = useRef(null);
  const aiInputRef = useRef(null);

  // Popup
  const [popup, setPopup] = useState({ isOpen: false, title: "", message: "" });
  const showPopup = (title, message) => setPopup({ isOpen: true, title, message });
  const closePopup = () => setPopup({ isOpen: false, title: "", message: "" });

  // AUTH
  useEffect(() => {
    const token = localStorage.getItem("token");
    const username = localStorage.getItem("username");
    const profile = localStorage.getItem("userProfile");

    if (!token) navigate("/login");
    if (username) setUserName(username);
    if (profile) {
      try {
        setUserProfile(JSON.parse(profile));
      } catch {}
    }
  }, [navigate]);

  // LOAD NOTES, FOLDERS & CHAT SESSIONS
  useEffect(() => {
    if (userName) {
      loadNotes();
      loadFolders();
      loadChatSessions();
    }
  }, [userName]);

  const loadNotes = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`http://localhost:8001/get_notes?user_id=${userName}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        console.log("Loaded notes:", data);
        
        const activeNotes = data.filter(n => !n.is_deleted);
        setNotes(activeNotes);
        
        if (activeNotes.length > 0 && !selectedNote) {
          selectNote(activeNotes[0]);
        }
      }
    } catch (e) {
      console.error("Error loading notes:", e);
      showPopup("Error", "Failed to load notes");
    }
  };

  // HANDLE TEXT SELECTION IN EDITOR
  const handleTextSelection = useCallback(() => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;

    const range = quill.getSelection();
    
    if (range && range.length > 0) {
      const selectedText = quill.getText(range.index, range.length);
      
      if (selectedText.trim().length > 0) {
        setSelectedText(selectedText);
        setSelectedRange(range);
        
        const bounds = quill.getBounds(range.index, range.length);
        const editorRect = quill.container.getBoundingClientRect();
        
        setTextActionMenuPosition({
          top: editorRect.top + bounds.bottom + window.scrollY + 5,
          left: editorRect.left + bounds.left + window.scrollX,
        });
        
        setShowTextActionMenu(true);
      }
    } else {
      setShowTextActionMenu(false);
    }
  }, []);

  // Listen for text selection
  useEffect(() => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;

    quill.on('selection-change', handleTextSelection);

    return () => {
      quill.off('selection-change', handleTextSelection);
    };
  }, [handleTextSelection]);

  // PROCESS SELECTED TEXT WITH AI
  const processSelectedText = async (action) => {
    if (!selectedText || !selectedText.trim()) {
      showPopup("No Text Selected", "Please select text first");
      return;
    }

    setGeneratingAI(true);
    setShowTextActionMenu(false);

    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://localhost:8001/ai_writing_assistant/", {
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

  // QUICK AI ACTION FROM TEXT MENU
  const quickTextAction = async (actionType) => {
    setGeneratingAI(true);
    setShowTextActionMenu(false);

    try {
      const token = localStorage.getItem("token");
      
      const fd = new FormData();
      fd.append("user_id", userName);
      fd.append("prompt", selectedText);
      fd.append("content_type", actionType);
      fd.append("existing_content", noteContent);

      const res = await fetch("http://localhost:8001/generate_note_content/", {
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
      const res = await fetch(`http://localhost:8001/get_folders?user_id=${userName}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        console.log("Loaded folders:", data.folders);
        setFolders(data.folders || []);
      }
    } catch (e) {
      console.error("Error loading folders:", e);
    }
  };

  const loadTrash = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`http://localhost:8001/get_trash?user_id=${userName}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        console.log("Loaded trash:", data.trash);
        setTrashedNotes(data.trash || []);
      }
    } catch (e) {
      console.error("Error loading trash:", e);
    }
  };

  const loadChatSessions = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`http://localhost:8001/get_chat_sessions?user_id=${userName}`, {
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

  // FOLDER MANAGEMENT
  const createFolder = async () => {
    if (!newFolderName.trim()) {
      showPopup("Error", "Folder name cannot be empty");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://localhost:8001/create_folder", {
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
        setFolders([...folders, folder]);
        setNewFolderName("");
        setNewFolderColor("#D7B38C");
        setShowFolderModal(false);
        
        setSelectedFolder(folder.id);
        setShowFavorites(false);
        setShowTrash(false);
        
        showPopup("Success", "Folder created successfully");
      }
    } catch (e) {
      console.error("Error creating folder:", e);
      showPopup("Error", "Failed to create folder");
    }
  };

  const createNoteInFolder = async (folderId) => {
    const token = localStorage.getItem("token");
    const res = await fetch("http://localhost:8001/create_note", {
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
      setNotes((p) => [newNote, ...p]);
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
    }
  };

  const deleteFolder = async (folderId) => {
    if (!window.confirm("Delete this folder? Notes will be moved to root.")) return;

    try {
      const token = localStorage.getItem("token");
      await fetch(`http://localhost:8001/delete_folder/${folderId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      setFolders(folders.filter(f => f.id !== folderId));
      await loadNotes();
      await loadFolders();
      showPopup("Success", "Folder deleted");
    } catch (e) {
      console.error("Error deleting folder:", e);
    }
  };

  const moveNoteToFolder = async (noteId, folderId) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://localhost:8001/move_note_to_folder", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}` },
        body: JSON.stringify({ note_id: noteId, folder_id: folderId }),
      });

      if (res.ok) {
        setNotes(notes.map(n => n.id === noteId ? { ...n, folder_id: folderId } : n));
        
        if (selectedNote?.id === noteId) {
          setSelectedNote({ ...selectedNote, folder_id: folderId });
        }
        
        await loadFolders();
        
        console.log(`Note ${noteId} moved to folder ${folderId}`);
        showPopup("Success", "Note moved to folder");
      }
    } catch (e) {
      console.error("Error moving note:", e);
      showPopup("Error", "Failed to move note");
    }
  };

  // DRAG & DROP HANDLERS
  const handleDragStart = (e, note) => {
    e.dataTransfer.effectAllowed = 'move';
    setDraggedNote(note);
    e.target.style.opacity = '0.5';
  };

  const handleDragEnd = (e) => {
    e.target.style.opacity = '1';
    setDraggedNote(null);
    setDragOverFolder(null);
  };

  const handleDragOver = (e, folderId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverFolder(folderId);
  };

  const handleDragLeave = (e) => {
    setDragOverFolder(null);
  };

  const handleDrop = async (e, folderId) => {
    e.preventDefault();
    setDragOverFolder(null);
    
    if (draggedNote) {
      await moveNoteToFolder(draggedNote.id, folderId);
      setDraggedNote(null);
    }
  };

  // FAVORITES
  const toggleFavorite = async (noteId) => {
    const note = notes.find(n => n.id === noteId);
    const newFavoriteStatus = !note.is_favorite;

    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://localhost:8001/toggle_favorite", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ note_id: noteId, is_favorite: newFavoriteStatus }),
      });

      if (res.ok) {
        setNotes(notes.map(n => n.id === noteId ? { ...n, is_favorite: newFavoriteStatus } : n));
        if (selectedNote?.id === noteId) {
          setSelectedNote({ ...selectedNote, is_favorite: newFavoriteStatus });
        }
        showPopup("Success", newFavoriteStatus ? "Added to favorites" : "Removed from favorites");
      }
    } catch (e) {
      console.error("Error toggling favorite:", e);
    }
  };

  // MOVE TO TRASH
  const moveToTrash = async (noteId) => {
    try {
      console.log(`Attempting to move note ${noteId} to trash`);
      
      if (saveTimeout.current) {
        clearTimeout(saveTimeout.current);
        saveTimeout.current = null;
        console.log("Auto-save timer cleared");
      }
      
      if (selectedNote?.id === noteId) {
        setSelectedNote(null);
        setNoteTitle("");
        setNoteContent("");
      }
      
      const token = localStorage.getItem("token");
      const res = await fetch(`http://localhost:8001/soft_delete_note/${noteId}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        console.log(`Note ${noteId} moved to trash on backend`);
        
        setNotes(prevNotes => prevNotes.filter(n => n.id !== noteId));
        
        const remaining = notes.filter(n => n.id !== noteId && !n.is_deleted);
        if (remaining.length > 0) {
          setTimeout(() => selectNote(remaining[0]), 100);
        }
        
        await loadFolders();
        
        showPopup("Moved to Trash", "Note moved to trash (recoverable for 30 days)");
      } else {
        console.error("Failed to delete note on backend");
        showPopup("Error", "Failed to move note to trash");
      }
    } catch (e) {
      console.error("Error moving to trash:", e);
      showPopup("Error", "Failed to move note to trash");
    }
  };

  const restoreNote = async (noteId) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`http://localhost:8001/restore_note/${noteId}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        console.log(`Note ${noteId} restored`);
        await loadNotes();
        await loadTrash();
        await loadFolders();
        showPopup("Restored", "Note restored successfully");
      }
    } catch (e) {
      console.error("Error restoring note:", e);
    }
  };

  const permanentDelete = async (noteId) => {
    if (!window.confirm("Permanently delete this note? This cannot be undone!")) return;

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`http://localhost:8001/permanent_delete_note/${noteId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setTrashedNotes(trashedNotes.filter(n => n.id !== noteId));
        showPopup("Deleted", "Note permanently deleted");
      }
    } catch (e) {
      console.error("Error permanently deleting:", e);
    }
  };

  // WORD & CHAR COUNT
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

  // CRUD
  const createNewNote = async () => {
    const token = localStorage.getItem("token");
    
    const folderId = selectedFolder && selectedFolder !== 0 ? selectedFolder : null;
    
    const res = await fetch("http://localhost:8001/create_note", {
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
      setNotes((p) => [newNote, ...p]);
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
    }
  };

  const duplicateNote = async (note) => {
    const token = localStorage.getItem("token");
    const res = await fetch("http://localhost:8001/create_note", {
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
      setNotes((p) => [newNote, ...p]);
      selectNote(newNote);
      showPopup("Duplicated", "Note duplicated successfully");
    }
  };

  const selectNote = (n) => {
    setSelectedNote(n);
    setNoteTitle(n.title);
    setNoteContent(n.content);
    setViewMode("edit");
    setCustomFont(n.custom_font || "Inter");

    setTimeout(() => {
      const quill = quillRef.current?.getEditor();
      if (quill) {
        quill.setSelection(0, 0);
      }
    }, 100);
  };

  // AUTO SAVE
  const autoSave = useCallback(async () => {
    if (!selectedNote) {
      console.log("No note selected, skipping auto-save");
      return;
    }
    
    const noteStillExists = notes.find(n => n.id === selectedNote.id);
    if (!noteStillExists) {
      console.log("Note no longer exists in notes array, skipping auto-save");
      return;
    }
    
    if (selectedNote.is_deleted || noteStillExists.is_deleted) {
      console.log("Note is deleted, skipping auto-save");
      return;
    }
    
    console.log(`Auto-saving note ${selectedNote.id}...`);
    setSaving(true);
    
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://localhost:8001/update_note", {
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
        
        console.log(`Note ${selectedNote.id} saved successfully`);
      } else if (res.status === 400) {
        console.log("Note is deleted on backend, stopping auto-save");
        setSaving(false);
        
        setNotes(prev => prev.filter(n => n.id !== selectedNote.id));
        setSelectedNote(null);
        setNoteTitle("");
        setNoteContent("");
        
        showPopup("Note Deleted", "This note has been moved to trash");
      } else {
        throw new Error(`Failed to save: ${res.status}`);
      }
    } catch (error) {
      setSaving(false);
      console.error("Save error:", error);
    }
  }, [selectedNote, noteTitle, noteContent, notes]);

  // AUTO SAVE TRIGGER
  useEffect(() => {
    if (saveTimeout.current) {
      clearTimeout(saveTimeout.current);
      saveTimeout.current = null;
    }
    
    if (selectedNote && !selectedNote.is_deleted) {
      console.log("Setting auto-save timeout for 1.5 seconds...");
      saveTimeout.current = setTimeout(() => {
        if (selectedNote && !selectedNote.is_deleted) {
          autoSave();
        } else {
          console.log("Note deleted, canceling scheduled auto-save");
        }
      }, 1500);
    }
    
    return () => {
      if (saveTimeout.current) {
        clearTimeout(saveTimeout.current);
        saveTimeout.current = null;
      }
    };
  }, [noteContent, noteTitle, selectedNote, autoSave]);

  // MANUAL SAVE WITH CTRL+S
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

  // HANDLE EDITOR CHANGES
  const handleEditorChange = (content, delta, source, editor) => {
    setNoteContent(content);

    if (source === "user" && delta.ops) {
      const lastOp = delta.ops[delta.ops.length - 1];
      if (lastOp.insert === "/") {
        const quill = quillRef.current?.getEditor();
        if (quill) {
          const selection = quill.getSelection();
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
  };

  // AI GENERATION WITH SPECIFIC PROMPTS
  const generateAIContent = async () => {
    if (!aiPrompt.trim()) {
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

      const res = await fetch("http://localhost:8001/generate_note_content/", {
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

  // QUICK ACTION BUTTONS FOR AI DROPDOWN
  const quickAIAction = async (actionType) => {
    setGeneratingAI(true);
    try {
      const token = localStorage.getItem("token");
      
      const fd = new FormData();
      fd.append("user_id", userName);
      fd.append("prompt", aiPrompt || "Generate content");
      fd.append("content_type", actionType);
      fd.append("existing_content", noteContent);

      const res = await fetch("http://localhost:8001/generate_note_content/", {
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

  // ENHANCED AI WRITING ASSISTANT
  const aiWritingAssist = async () => {
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
      const res = await fetch("http://localhost:8001/ai_writing_assistant/", {
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

  // CHAT TO NOTE CONVERSION
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
        const r = await fetch(`http://localhost:8001/get_chat_history/${sid}`, {
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

      const summaryRes = await fetch("http://localhost:8001/generate_note_summary/", {
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
      } else {
        content = allMessages
          .map(
            (s, i) =>
              `<h2>${s.sessionTitle}</h2>` +
              s.messages.map((m, j) => `<b>Q${j + 1}:</b> ${m.user_message}<br/><b>A:</b> ${m.ai_response}`).join("<br/><br/>")
          )
          .join("<hr/>");
      }

      const createRes = await fetch("http://localhost:8001/create_note", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ user_id: userName, title, content }),
      });
      
      if (createRes.ok) {
        const newNote = await createRes.json();
        setNotes((p) => [newNote, ...p]);
        selectNote(newNote);
        setShowChatImport(false);
        setSelectedSessions([]);
        showPopup("Conversion Successful", `"${title}" created successfully.`);
      }
    } catch (err) {
      console.error("Convert error:", err);
      showPopup("Conversion Failed", "Unable to convert chat to note.");
    }
    setImporting(false);
  };

  // EXPORT
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
        }
        h1 {
          font-size: 32px;
          font-weight: 700;
          margin-bottom: 20px;
          color: #000;
        }
        .metadata {
          color: #666;
          font-size: 12px;
          margin-bottom: 30px;
          padding-bottom: 15px;
          border-bottom: 2px solid #e0e0e0;
        }
        img { max-width: 100%; height: auto; }
        pre { background: #f5f5f5; padding: 15px; border-radius: 5px; overflow-x: auto; }
        blockquote { border-left: 4px solid #2196f3; padding-left: 15px; color: #666; font-style: italic; }
        a { color: #2196f3; }
        table { border-collapse: collapse; width: 100%; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
        th { background-color: #f5f5f5; font-weight: 600; }
      </style>
    `;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${noteTitle || 'Note'}</title>
          ${styles}
        </head>
        <body>
          <h1>${noteTitle || 'Untitled Note'}</h1>
          <div class="metadata">
            Last edited: ${new Date(selectedNote.updated_at).toLocaleString()}<br>
            ${wordCount} words - ${charCount} characters
          </div>
          ${noteContent}
        </body>
      </html>
    `);

    printWindow.document.close();

    setTimeout(() => {
      printWindow.print();
    }, 250);

    showPopup("Export", "Print dialog opened - Save as PDF");
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

  // FILTERED NOTES LIST
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

  // ENHANCED QUILL MODULES WITH ALL FEATURES
  const modules = {
    toolbar: [
      [{ header: [1, 2, 3, 4, 5, 6, false] }],
      [{ font: ["Inter", "Arial", "Courier", "Georgia", "Times New Roman", "Verdana"] }],
      [{ size: ["small", false, "large", "huge"] }],
      ["bold", "italic", "underline", "strike"],
      [{ color: [] }, { background: [] }],
      [{ script: "sub" }, { script: "super" }],
      [{ list: "ordered" }, { list: "bullet" }, { indent: "-1" }, { indent: "+1" }],
      [{ direction: "rtl" }, { align: [] }],
      ["blockquote", "code-block"],
      ["link", "image", "video", "formula"],
      ["clean"],
    ],
    tableUI: true,
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
    "align",
    "blockquote",
    "code-block",
    "link",
    "image",
    "video",
    "formula",
    "table",
  ];

  // LOGOUT
  const handleLogout = () => {
    if (window.confirm("Are you sure you want to logout?")) {
      localStorage.clear();
      navigate("/");
    }
  };

  // RENDER
  return (
    <div className="notes-redesign">
      {/* Sidebar */}
      <div className={`notes-sidebar-new ${sidebarOpen ? "open" : "closed"}`}>
        <div className="sidebar-header-new">
          <div className="sidebar-title">
            <h2>My Notes</h2>
            <span className="notes-count">{notes.length}</span>
          </div>
          <div className="sidebar-actions">
            <button onClick={createNewNote} className="btn-new-note" title="Create new note">
              <span>+</span> New Note
            </button>
            <button onClick={() => setShowChatImport(true)} className="btn-import-chat" title="Import from AI Chat">
              From Chat
            </button>
          </div>
        </div>

        {/* Folder & Filter Section */}
        <div className="sidebar-filters">
          <button
            className={`filter-btn ${!showFavorites && !showTrash && !selectedFolder ? 'active' : ''}`}
            onClick={() => {
              setShowFavorites(false);
              setShowTrash(false);
              setSelectedFolder(null);
            }}
          >
            All Notes
          </button>
          <button
            className={`filter-btn ${showFavorites ? 'active' : ''}`}
            onClick={() => {
              setShowFavorites(!showFavorites);
              setShowTrash(false);
              setSelectedFolder(null);
            }}
          >
            Favorites
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
            Trash
          </button>
        </div>

        {/* Folders Section with Drag & Drop */}
        <div className="folders-section">
          <div className="folders-header">
            <h3>Folders</h3>
            <button onClick={() => setShowFolderModal(true)} className="btn-add-folder">
              +
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
                      +
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteFolder(folder.id);
                      }}
                      className="folder-delete-btn"
                    >
                      ×
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

        {/* Notes List with Drag & Drop */}
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
                draggable
                onDragStart={(e) => handleDragStart(e, n)}
                onDragEnd={handleDragEnd}
              >
                <div className="note-item-header">
                  <div className="note-title-small">
                    {n.is_favorite && <span className="favorite-star">star</span>}
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
                      star
                    </button>
                    <button
                      className="note-action-btn duplicate"
                      onClick={(e) => {
                        e.stopPropagation();
                        duplicateNote(n);
                      }}
                      title="Duplicate note"
                    >
                      copy
                    </button>
                    <button
                      className="note-action-btn delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        moveToTrash(n.id);
                      }}
                      title="Move to trash"
                    >
                      trash
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

      {/* Editor */}
      <div className="editor-area-new">
        {/* Top Navigation Bar */}
        <div className="top-nav-new">
          <div className="nav-left">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="toggle-sidebar"
              title="Toggle sidebar"
            >
              {sidebarOpen ? "back" : "menu"}
            </button>
            <div className="nav-title">Brainwave Notes</div>
          </div>

          <div className="nav-center">
            {selectedNote && (
              <div className="editor-tools">
                <button
                  className={`tool-btn ${viewMode === "edit" ? "active" : ""}`}
                  onClick={() => setViewMode("edit")}
                  title="Edit mode"
                >
                  Edit
                </button>
                <button
                  className={`tool-btn ${viewMode === "preview" ? "active" : ""}`}
                  onClick={() => setViewMode("preview")}
                  title="Preview mode"
                >
                  Preview
                </button>
                <div className="tool-divider"></div>
                <button className="tool-btn" onClick={exportAsPDF} title="Export as PDF">
                  PDF
                </button>
                <button className="tool-btn" onClick={exportAsText} title="Export as Text">
                  TXT
                </button>
                <div className="tool-divider"></div>
                <button
                  className="tool-btn"
                  onClick={() => setShowAIAssistant(true)}
                  title="AI Writing Assistant"
                >
                  AI Assist
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

        {/* Editor Content */}
        {selectedNote ? (
          <div className="editor-content">
            {/* Collapsible Title Section */}
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
                  />
                  <div className="title-meta">
                    <span className="last-edited">
                      Last edited: {new Date(selectedNote.updated_at).toLocaleString()}
                    </span>
                    <span className="font-selector-label">Font:</span>
                    <select
                      value={customFont}
                      onChange={(e) => setCustomFont(e.target.value)}
                      className="font-selector"
                    >
                      <option value="Inter">Inter</option>
                      <option value="Arial">Arial</option>
                      <option value="Georgia">Georgia</option>
                      <option value="Times New Roman">Times New Roman</option>
                      <option value="Courier New">Courier New</option>
                      <option value="Verdana">Verdana</option>
                      <option value="Comic Sans MS">Comic Sans MS</option>
                      <option value="Trebuchet MS">Trebuchet MS</option>
                    </select>
                  </div>
                </div>
                <button
                  className="title-collapse-btn"
                  onClick={() => setTitleSectionCollapsed(!titleSectionCollapsed)}
                  title={titleSectionCollapsed ? "Expand title" : "Collapse title"}
                >
                  {titleSectionCollapsed ? 'down' : 'up'}
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
                  placeholder="Start typing your notes here... (Press '/' for AI assistance)"
                  className="quill-editor-enhanced"
                  style={{ fontFamily: customFont }}
                />
              </div>
            ) : (
              <div className="preview-mode">
                <div
                  className="preview-content"
                  dangerouslySetInnerHTML={{ __html: noteContent }}
                  style={{ fontFamily: customFont }}
                />
              </div>
            )}

            {/* Footer Stats */}
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
                  <span className="saved-indicator">Saved</span>
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

      {/* AI Slash Command Dropdown */}
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
              <span className="ai-icon">AI</span>
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

      {/* AI Writing Assistant Modal */}
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
                ×
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
                  className="ai-text-input"
                  placeholder="Enter text or select text in the editor..."
                  value={selectedText}
                  onChange={(e) => setSelectedText(e.target.value)}
                  rows={8}
                />
              </div>

              <div className="ai-assistant-actions">
                <button
                  className="ai-btn-cancel"
                  onClick={() => setShowAIAssistant(false)}
                  disabled={generatingAI}
                >
                  Cancel
                </button>
                <button
                  className="ai-btn-generate"
                  onClick={aiWritingAssist}
                  disabled={generatingAI}
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

      {/* Create Folder Modal */}
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
                ×
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

      {/* CHAT IMPORT MODAL */}
      {showChatImport && (
        <>
          <div className="ai-overlay" onClick={() => setShowChatImport(false)} />
          <div className="chat-import-modal-new" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-new">
              <h2>Convert Chat to Notes</h2>
              <button className="modal-close-btn" onClick={() => setShowChatImport(false)}>×</button>
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

      {/* CUSTOM POPUP */}
      <CustomPopup
        isOpen={popup.isOpen}
        onClose={closePopup}
        title={popup.title}
        message={popup.message}
      />

      {/* TEXT SELECTION ACTION MENU */}
      {showTextActionMenu && (
        <>
          <div 
            className="text-action-overlay" 
            onClick={() => setShowTextActionMenu(false)}
          />
          <div
            className="text-action-menu"
            style={{
              position: "fixed",
              top: `${textActionMenuPosition.top}px`,
              left: `${textActionMenuPosition.left}px`,
            }}
          >
            <div className="text-action-header">
              <span className="text-action-icon">AI</span>
              <span>AI Actions for Selected Text</span>
              <button
                className="text-action-close"
                onClick={() => setShowTextActionMenu(false)}
              >
                ×
              </button>
            </div>

            <div className="text-action-section">
              <div className="text-action-label">Transform Text:</div>
              <div className="text-action-buttons">
                <button
                  onClick={() => processSelectedText("improve")}
                  disabled={generatingAI}
                  className="text-action-btn"
                >
                  <span className="btn-icon">+</span>
                  Improve
                </button>
                <button
                  onClick={() => processSelectedText("simplify")}
                  disabled={generatingAI}
                  className="text-action-btn"
                >
                  <span className="btn-icon">-</span>
                  Simplify
                </button>
                <button
                  onClick={() => processSelectedText("expand")}
                  disabled={generatingAI}
                  className="text-action-btn"
                >
                  <span className="btn-icon">+</span>
                  Expand
                </button>
                <button
                  onClick={() => processSelectedText("grammar")}
                  disabled={generatingAI}
                  className="text-action-btn"
                >
                  <span className="btn-icon">✓</span>
                  Fix Grammar
                </button>
              </div>
            </div>

            <div className="text-action-divider"></div>

            <div className="text-action-section">
              <div className="text-action-label">Generate Content:</div>
              <div className="text-action-buttons">
                <button
                  onClick={() => quickTextAction("explain")}
                  disabled={generatingAI}
                  className="text-action-btn"
                >
                  <span className="btn-icon">?</span>
                  Explain
                </button>
                <button
                  onClick={() => quickTextAction("key_points")}
                  disabled={generatingAI}
                  className="text-action-btn"
                >
                  <span className="btn-icon">•</span>
                  Key Points
                </button>
                <button
                  onClick={() => quickTextAction("summary")}
                  disabled={generatingAI}
                  className="text-action-btn"
                >
                  <span className="btn-icon">=</span>
                  Summarize
                </button>
              </div>
            </div>

            <div className="text-action-divider"></div>

            <div className="text-action-section">
              <div className="text-action-label">Change Tone:</div>
              <div className="text-action-tone-selector">
                <select
                  value={aiAssistTone}
                  onChange={(e) => setAiAssistTone(e.target.value)}
                  className="tone-select"
                  disabled={generatingAI}
                >
                  <option value="professional">Professional</option>
                  <option value="casual">Casual</option>
                  <option value="formal">Formal</option>
                  <option value="friendly">Friendly</option>
                  <option value="academic">Academic</option>
                  <option value="creative">Creative</option>
                </select>
                <button
                  onClick={() => processSelectedText("tone_change")}
                  disabled={generatingAI}
                  className="text-action-btn-apply"
                >
                  Apply Tone
                </button>
              </div>
            </div>

            {generatingAI && (
              <div className="text-action-loading">
                <span className="spinner"></span>
                <span>Processing...</span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default NotesRedesign;
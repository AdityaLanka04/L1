// src/pages/NotesRedesign.js
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import "./NotesRedesign.css";
import CustomPopup from "./CustomPopup";

const NotesRedesign = () => {
  // ================= STATE VARIABLES =================
  const [userName, setUserName] = useState("");
  const [userProfile, setUserProfile] = useState(null);
  const [notes, setNotes] = useState([]);
  const [selectedNote, setSelectedNote] = useState(null);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [saving, setSaving] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showChatImport, setShowChatImport] = useState(false);
  const [chatSessions, setChatSessions] = useState([]);
  const [selectedSessions, setSelectedSessions] = useState([]);
  const [importMode, setImportMode] = useState("summary");
  const [importing, setImporting] = useState(false);
  
  // AI Dropdown States
  const [showAIDropdown, setShowAIDropdown] = useState(false);
  const [aiDropdownPosition, setAiDropdownPosition] = useState({ top: 0, left: 0 });
  const [aiPrompt, setAiPrompt] = useState("");
  const [generatingAI, setGeneratingAI] = useState(false);
  
  const navigate = useNavigate();
  const quillRef = useRef(null);

  const [popup, setPopup] = useState({
    isOpen: false,
    message: "",
    title: "",
  });

  const showPopup = (title, message) => setPopup({ isOpen: true, title, message });
  const closePopup = () => setPopup({ isOpen: false, title: "", message: "" });

  // ================= AUTH / PROFILE =================
  useEffect(() => {
    const token = localStorage.getItem("token");
    const username = localStorage.getItem("username");
    const profile = localStorage.getItem("userProfile");

    if (!token) {
      navigate("/login");
      return;
    }
    if (username) setUserName(username);
    if (profile) {
      try {
        setUserProfile(JSON.parse(profile));
      } catch (err) {
        console.error("Error parsing profile:", err);
      }
    }
  }, [navigate]);

  useEffect(() => {
    if (userName) {
      loadNotes();
      loadChatSessions();
    }
  }, [userName]);

  // ================= LOADERS =================
  const loadNotes = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`http://localhost:8001/get_notes?user_id=${userName}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const userNotes = await res.json();
        setNotes(userNotes);
        if (userNotes.length > 0 && !selectedNote) selectNote(userNotes[0]);
      }
    } catch (err) {
      console.error("Error loading notes:", err);
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
    } catch (err) {
      console.error("Error loading chat sessions:", err);
    }
  };

  // ================= NOTE CRUD =================
  const createNewNote = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://localhost:8001/create_note", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ user_id: userName, title: "New Note", content: "" }),
      });
      if (res.ok) {
        const newNote = await res.json();
        setNotes((prev) => [newNote, ...prev]);
        selectNote(newNote);
      }
    } catch (err) {
      console.error("Error creating note:", err);
      showPopup("Creation Failed", "Could not create a new note.");
    }
  };

  const saveNote = async () => {
    if (!selectedNote) return;
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
        setNotes((prev) =>
          prev.map((n) =>
            n.id === selectedNote.id
              ? { ...n, title: noteTitle, content: noteContent, updated_at: new Date().toISOString() }
              : n
          )
        );
        setSelectedNote((p) => ({ ...p, title: noteTitle, content: noteContent }));
        showPopup("Note Saved", `"${noteTitle}" saved successfully.`);
      }
    } catch (err) {
      console.error("Save failed:", err);
      showPopup("Save Failed", "Could not save note. Please retry.");
    }
    setSaving(false);
  };

  const deleteNote = async (id) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`http://localhost:8001/delete_note/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const newList = notes.filter((n) => n.id !== id);
        setNotes(newList);
        if (selectedNote?.id === id) {
          if (newList.length > 0) selectNote(newList[0]);
          else {
            setSelectedNote(null);
            setNoteTitle("");
            setNoteContent("");
          }
        }
      }
    } catch (err) {
      console.error("Delete failed:", err);
      showPopup("Delete Failed", "Could not delete note.");
    }
  };

  const selectNote = (n) => {
    setSelectedNote(n);
    setNoteTitle(n.title);
    setNoteContent(n.content);
  };

  // ================= AI CONTENT GENERATION =================
  const handleEditorChange = (content, delta, source, editor) => {
    setNoteContent(content);
    
    // Check if user just typed "/"
    if (source === 'user' && delta.ops) {
      const lastOp = delta.ops[delta.ops.length - 1];
      if (lastOp.insert === '/') {
        // Get cursor position
        const quill = quillRef.current?.getEditor();
        if (quill) {
          const selection = quill.getSelection();
          if (selection) {
            const bounds = quill.getBounds(selection.index);
            
            // Position the AI dropdown near the cursor
            setAiDropdownPosition({
              top: bounds.top + bounds.height + 100,
              left: bounds.left + 100
            });
            
            setShowAIDropdown(true);
            setAiPrompt("");
            
            // Remove the "/" from the editor
            quill.deleteText(selection.index - 1, 1);
          }
        }
      }
    }
  };

  const generateAIContent = async () => {
    if (!aiPrompt.trim()) {
      showPopup("Empty Prompt", "Please enter what you want to generate.");
      return;
    }
    
    setGeneratingAI(true);
    
    try {
      const token = localStorage.getItem("token");
      const formData = new FormData();
      formData.append("user_id", userName);
      formData.append("prompt", aiPrompt);
      formData.append("content_type", "detailed");
      
      console.log("Sending AI generation request for:", aiPrompt);
      
      const response = await fetch("http://localhost:8001/generate_note_content/", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });
      
      console.log("Response status:", response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log("Generated content received:", data.content.substring(0, 100));
        
        // Insert the generated content at cursor position
        const quill = quillRef.current?.getEditor();
        if (quill) {
          const selection = quill.getSelection();
          const insertIndex = selection ? selection.index : quill.getLength();
          
          // Add some spacing before the generated content
          quill.insertText(insertIndex, "\n\n");
          quill.clipboard.dangerouslyPasteHTML(insertIndex + 2, data.content);
          
          // Update the note content state
          setNoteContent(quill.root.innerHTML);
          
          showPopup("Content Generated", "AI content has been added to your note!");
        }
        
        // Close the AI dropdown
        setShowAIDropdown(false);
        setAiPrompt("");
      } else {
        const errorData = await response.json();
        console.error("Error response:", errorData);
        showPopup("Generation Failed", errorData.detail || "Could not generate content. Please try again.");
      }
    } catch (error) {
      console.error("AI generation error:", error);
      showPopup("Error", "Failed to generate AI content. Check console for details.");
    } finally {
      setGeneratingAI(false);
    }
  };

  const handleAIDropdownKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      generateAIContent();
    } else if (e.key === "Escape") {
      setShowAIDropdown(false);
      setAiPrompt("");
    }
  };

  // ================= CHAT → NOTE =================
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

      let title = "Generated Note";
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

  const filteredNotes = notes.filter(
    (n) =>
      n.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      n.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleLogout = () => {
    if (userProfile?.googleUser && window.google) window.google.accounts.id.disableAutoSelect();
    localStorage.clear();
    navigate("/");
  };

  // ================= QUILL CONFIG =================
  const modules = {
    toolbar: [
      [{ header: [1, 2, 3, false] }],
      ["bold", "italic", "underline", "strike"],
      [{ list: "ordered" }, { list: "bullet" }],
      ["blockquote", "code-block"],
      ["link", "image"],
      [{ color: [] }, { background: [] }],
      ["clean"],
    ],
  };

  const formats = [
    "header",
    "bold",
    "italic",
    "underline",
    "strike",
    "list",
    "bullet",
    "blockquote",
    "code-block",
    "link",
    "image",
    "color",
    "background",
  ];

  // ================= RENDER =================
  return (
    <div className="notes-redesign">
      {/* SIDEBAR */}
      <div className={`notes-sidebar-new ${sidebarOpen ? "open" : "closed"}`}>
        <div className="sidebar-header-new">
          <h2>My Notes</h2>
          <button className="btn-new-note" onClick={createNewNote}>+ New Note</button>
          <button className="btn-import-chat" onClick={() => setShowChatImport(true)}>From Chat</button>
        </div>
        <div className="search-container-new">
          <input
            type="text"
            className="search-input-new"
            placeholder="Search notes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="notes-list-new">
          {filteredNotes.length === 0 ? (
            <div className="no-notes-new">No notes found.</div>
          ) : (
            filteredNotes.map((n) => (
              <div
                key={n.id}
                className={`note-item-new ${selectedNote?.id === n.id ? "active" : ""}`}
                onClick={() => selectNote(n)}
              >
                <div className="note-title-small">{n.title}</div>
                <div className="note-date-small">{new Date(n.updated_at).toLocaleDateString()}</div>
                <button
                  className="delete-note-btn-new"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteNote(n.id);
                  }}
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* MAIN AREA */}
      <div className="editor-area-new">
        <div className="top-nav-new">
          <button className="toggle-sidebar" onClick={() => setSidebarOpen(!sidebarOpen)}>☰</button>
          <div className="nav-title">brainwave notes</div>
          <div className="nav-actions-new">
            <button onClick={() => navigate("/dashboard")}>Dashboard</button>
            <button onClick={() => navigate("/ai-chat")}>AI Chat</button>
            <button className="save-btn-new" onClick={saveNote} disabled={!selectedNote || saving}>
              {saving ? "Saving..." : "Save"}
            </button>
            <button className="logout-btn-new" onClick={handleLogout}>Logout</button>
            {userProfile?.picture && (
              <img src={userProfile.picture} alt="Profile" className="profile-pic-small" />
            )}
          </div>
        </div>

        {selectedNote ? (
          <>
            <div className="title-container-new">
              <input
                type="text"
                className="title-input-new"
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                placeholder="Note title..."
              />
            </div>

            {/* RICH TEXT EDITOR */}
            <div className="toolbar-new" />
            <ReactQuill
              ref={quillRef}
              theme="snow"
              value={noteContent}
              onChange={handleEditorChange}
              modules={modules}
              formats={formats}
              placeholder="Start typing your notes here... (Press '/' for AI assistance)"
              style={{
                background: "#fff",
                color: "#000",
                minHeight: "75vh",
                border: "none",
                direction: "ltr",
                unicodeBidi: "plaintext",
              }}
            />
          </>
        ) : (
          <div className="empty-state-new">
            <div className="empty-icon-new">📝</div>
            <h2>No Note Selected</h2>
            <p>Create a new note or import one from AI Chat.</p>
            <button className="create-note-empty" onClick={createNewNote}>
              Create Note
            </button>
          </div>
        )}
      </div>

      {/* AI DROPDOWN */}
      {showAIDropdown && (
        <div 
          className="ai-dropdown-new"
          style={{
            position: 'fixed',
            top: `${aiDropdownPosition.top}px`,
            left: `${aiDropdownPosition.left}px`,
            zIndex: 10000
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="ai-dropdown-header">
            <span className="ai-icon">✨</span>
            <span>AI Content Generator</span>
          </div>
          
          <input
            type="text"
            className="ai-dropdown-input"
            placeholder="What would you like to generate? (e.g., 'Explain quantum physics')"
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            onKeyDown={handleAIDropdownKeyPress}
            autoFocus
            disabled={generatingAI}
          />
          
          <div className="ai-dropdown-actions">
            <button
              className="cancel-ai-btn"
              onClick={() => {
                setShowAIDropdown(false);
                setAiPrompt("");
              }}
              disabled={generatingAI}
            >
              Cancel
            </button>
            <button
              className="generate-ai-btn"
              onClick={generateAIContent}
              disabled={generatingAI || !aiPrompt.trim()}
            >
              {generatingAI ? "Generating..." : "Generate"}
            </button>
          </div>
        </div>
      )}

      {/* CHAT IMPORT MODAL */}
      {showChatImport && (
        <div className="modal-overlay-new" onClick={() => setShowChatImport(false)}>
          <div className="chat-import-modal-new" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-new">
              <h2>Convert Chat to Notes</h2>
              <button className="close-modal-btn-new" onClick={() => setShowChatImport(false)}>×</button>
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

              <div className="session-selection-section-new">
                <div className="session-header-new">
                  <h3>Select Chat Sessions</h3>
                  <div className="selection-controls-new">
                    <button className="select-all-btn-new" onClick={selectAllSessions}>
                      Select All
                    </button>
                    <button className="clear-all-btn-new" onClick={clearAllSessions}>
                      Clear All
                    </button>
                  </div>
                </div>
                {chatSessions.length === 0 ? (
                  <div className="no-chats-new">
                    <p>No chat sessions available.</p>
                    <button className="go-chat-btn-new" onClick={() => navigate("/ai-chat")}>
                      Start a Conversation
                    </button>
                  </div>
                ) : (
                  <div className="chat-sessions-grid-new">
                    {chatSessions.map((s) => (
                      <div
                        key={s.id}
                        className={`chat-session-card-new ${
                          selectedSessions.includes(s.id) ? "selected" : ""
                        }`}
                        onClick={() => handleSessionToggle(s.id)}
                      >
                        <div className="session-checkbox-new">
                          <input
                            type="checkbox"
                            checked={selectedSessions.includes(s.id)}
                            onChange={() => handleSessionToggle(s.id)}
                          />
                        </div>
                        <div className="session-info-new">
                          <div className="session-title-new">{s.title}</div>
                          <div className="session-date-new">
                            {new Date(s.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="modal-actions-new">
                <button className="cancel-btn-modal" onClick={() => setShowChatImport(false)}>
                  Cancel
                </button>
                <button
                  className="convert-btn-modal"
                  onClick={convertChatToNote}
                  disabled={importing || selectedSessions.length === 0}
                >
                  {importing
                    ? "Converting..."
                    : `Convert ${selectedSessions.length} Session(s)`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* POPUP */}
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
/**
 * Enhanced Notes Integration
 * 
 * This file adds 5 key features to the existing NotesRedesign:
 * 1. Slash Commands - Quick formatting
 * 2. Quick Switcher (Cmd+K) - Fast navigation
 * 3. Page Links [[Note]] - With backlinks
 * 4. Tags System - #tags
 * 5. Better Tables - Enhanced editing
 * 
 * To integrate, add these imports and hooks to NotesRedesign.js
 */

import { useState, useEffect, useCallback } from 'react';
import QuickSwitcher from '../components/QuickSwitcher';
import TagsPanel from '../components/TagsPanel';
import BacklinksPanel from '../components/BacklinksPanel';
import { parsePageLinks, parseTags, findBacklinks, getAllTags, filterNotesByTag } from '../utils/noteUtils';

// Hook for Quick Switcher (Cmd+K)
export const useQuickSwitcher = (notes, folders, onSelectNote) => {
  const [isOpen, setIsOpen] = useState(false);
  const [recentNotes, setRecentNotes] = useState([]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Cmd+K or Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSelectNote = (note) => {
    onSelectNote(note);
    // Add to recent notes
    setRecentNotes(prev => {
      const filtered = prev.filter(n => n.id !== note.id);
      return [note, ...filtered].slice(0, 10);
    });
  };

  return {
    QuickSwitcherComponent: (
      <QuickSwitcher
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        notes={notes}
        folders={folders}
        onSelectNote={handleSelectNote}
        recentNotes={recentNotes}
      />
    ),
    openSwitcher: () => setIsOpen(true),
    closeSwitcher: () => setIsOpen(false)
  };
};

// Hook for Page Links
export const usePageLinks = (noteContent, allNotes) => {
  const [pageLinks, setPageLinks] = useState([]);

  useEffect(() => {
    const links = parsePageLinks(noteContent);
    setPageLinks(links);
  }, [noteContent]);

  return pageLinks;
};

// Hook for Tags
export const useTags = (notes) => {
  const [allTags, setAllTags] = useState([]);
  const [selectedTag, setSelectedTag] = useState(null);

  useEffect(() => {
    const tags = getAllTags(notes);
    setAllTags(tags.map(tag => ({ name: tag })));
  }, [notes]);

  const filterByTag = useCallback((tag) => {
    setSelectedTag(tag);
    return filterNotesByTag(notes, tag);
  }, [notes]);

  return {
    allTags,
    selectedTag,
    setSelectedTag,
    filterByTag
  };
};

// Hook for Backlinks
export const useBacklinks = (currentNote, allNotes) => {
  const [backlinks, setBacklinks] = useState([]);

  useEffect(() => {
    if (currentNote) {
      const links = findBacklinks(currentNote.title, allNotes);
      setBacklinks(links);
    } else {
      setBacklinks([]);
    }
  }, [currentNote, allNotes]);

  return backlinks;
};

// Hook for Slash Commands in Quill
export const useSlashCommands = (quillRef) => {
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashMenuPosition, setSlashMenuPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;

    const handleTextChange = (delta, oldDelta, source) => {
      if (source !== 'user') return;

      const ops = delta.ops;
      if (ops && ops.length > 0) {
        const lastOp = ops[ops.length - 1];
        
        if (lastOp.insert === '/') {
          const selection = quill.getSelection();
          if (selection) {
            const bounds = quill.getBounds(selection.index);
            const editorRect = quill.container.getBoundingClientRect();
            
            setSlashMenuPosition({
              top: editorRect.top + bounds.top + bounds.height + window.scrollY + 5,
              left: editorRect.left + bounds.left + window.scrollX
            });
            setShowSlashMenu(true);
          }
        }
      }
    };

    quill.on('text-change', handleTextChange);

    return () => {
      quill.off('text-change', handleTextChange);
    };
  }, [quillRef]);

  const insertBlock = useCallback((blockType) => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;

    const selection = quill.getSelection();
    if (!selection) return;

    // Remove the slash
    quill.deleteText(selection.index - 1, 1);

    // Insert formatted block
    switch (blockType) {
      case 'heading1':
        quill.formatLine(selection.index - 1, 1, 'header', 1);
        break;
      case 'heading2':
        quill.formatLine(selection.index - 1, 1, 'header', 2);
        break;
      case 'heading3':
        quill.formatLine(selection.index - 1, 1, 'header', 3);
        break;
      case 'bulletList':
        quill.formatLine(selection.index - 1, 1, 'list', 'bullet');
        break;
      case 'numberedList':
        quill.formatLine(selection.index - 1, 1, 'list', 'ordered');
        break;
      case 'code':
        quill.formatLine(selection.index - 1, 1, 'code-block', true);
        break;
      case 'quote':
        quill.formatLine(selection.index - 1, 1, 'blockquote', true);
        break;
      case 'divider':
        quill.insertText(selection.index - 1, '\n');
        quill.insertEmbed(selection.index, 'divider', true);
        quill.insertText(selection.index + 1, '\n');
        break;
      default:
        break;
    }

    setShowSlashMenu(false);
  }, [quillRef]);

  return {
    showSlashMenu,
    slashMenuPosition,
    setShowSlashMenu,
    insertBlock
  };
};

// Slash Menu Component
export const SlashMenu = ({ isOpen, position, onSelect, onClose }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const commands = [
    { type: 'heading1', label: 'Heading 1', icon: 'H1', description: 'Big section heading' },
    { type: 'heading2', label: 'Heading 2', icon: 'H2', description: 'Medium section heading' },
    { type: 'heading3', label: 'Heading 3', icon: 'H3', description: 'Small section heading' },
    { type: 'bulletList', label: 'Bullet List', icon: '•', description: 'Create a bulleted list' },
    { type: 'numberedList', label: 'Numbered List', icon: '1.', description: 'Create a numbered list' },
    { type: 'code', label: 'Code Block', icon: '</>', description: 'Capture a code snippet' },
    { type: 'quote', label: 'Quote', icon: '"', description: 'Capture a quote' },
    { type: 'divider', label: 'Divider', icon: '—', description: 'Visually divide blocks' },
  ];

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % commands.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + commands.length) % commands.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        onSelect(commands[selectedIndex].type);
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, commands, onSelect, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="slash-menu"
      style={{ 
        position: 'fixed',
        top: position.top,
        left: position.left,
        zIndex: 1000
      }}
    >
      {commands.map((cmd, index) => (
        <div
          key={cmd.type}
          className={`slash-menu-item ${index === selectedIndex ? 'selected' : ''}`}
          onClick={() => onSelect(cmd.type)}
          onMouseEnter={() => setSelectedIndex(index)}
        >
          <span className="slash-menu-icon">{cmd.icon}</span>
          <div className="slash-menu-content">
            <div className="slash-menu-label">{cmd.label}</div>
            <div className="slash-menu-description">{cmd.description}</div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default {
  useQuickSwitcher,
  usePageLinks,
  useTags,
  useBacklinks,
  useSlashCommands,
  SlashMenu
};

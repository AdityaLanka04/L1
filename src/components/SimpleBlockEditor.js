import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Type, Heading1, Heading2, Heading3, List, ListOrdered,
  CheckSquare, Code, Quote, AlertCircle, ChevronRight,
  Minus, GripVertical, Plus, Trash2, MoreVertical, Copy,
  ArrowUp, ArrowDown, Image, Link2, Table, FileText,
  Lightbulb, Star, Zap, BookOpen, Calendar, Tag,
  Hash, AtSign, MapPin, Clock, Paperclip
} from 'lucide-react';
import './BlockEditor.css';
import CodeBlock from './CodeBlock';
import TableBlock from './TableBlock';
import FileViewer from './FileViewer';

const BLOCK_TYPES = [
  // Basic Text
  { type: 'paragraph', label: 'Text', icon: Type, description: 'Plain text paragraph', category: 'Basic' },
  { type: 'heading1', label: 'Heading 1', icon: Heading1, description: 'Large section heading', category: 'Basic' },
  { type: 'heading2', label: 'Heading 2', icon: Heading2, description: 'Medium section heading', category: 'Basic' },
  { type: 'heading3', label: 'Heading 3', icon: Heading3, description: 'Small section heading', category: 'Basic' },
  
  // Lists
  { type: 'bulletList', label: 'Bullet list', icon: List, description: 'Unordered list', category: 'Lists' },
  { type: 'numberedList', label: 'Numbered list', icon: ListOrdered, description: 'Ordered list', category: 'Lists' },
  { type: 'todo', label: 'To-do', icon: CheckSquare, description: 'Checkbox list item', category: 'Lists' },
  
  // Advanced
  { type: 'code', label: 'Code', icon: Code, description: 'Code block with syntax', category: 'Advanced' },
  { type: 'quote', label: 'Quote', icon: Quote, description: 'Blockquote', category: 'Advanced' },
  { type: 'callout', label: 'Callout', icon: AlertCircle, description: 'Highlighted info box', category: 'Advanced' },
  { type: 'toggle', label: 'Toggle', icon: ChevronRight, description: 'Collapsible section', category: 'Advanced' },
  { type: 'table', label: 'Table', icon: Table, description: 'Structured data table', category: 'Advanced' },
  
  // Special
  { type: 'divider', label: 'Divider', icon: Minus, description: 'Horizontal line', category: 'Special' },
  { type: 'image', label: 'Image', icon: Image, description: 'Embed an image', category: 'Media' },
  { type: 'file', label: 'File', icon: Paperclip, description: 'Attach PDF or Word doc', category: 'Media' },
  { type: 'link', label: 'Link', icon: Link2, description: 'Bookmark or link', category: 'Special' },
  { type: 'table', label: 'Table', icon: Table, description: 'Simple table', category: 'Advanced' },
  
  // Callout Variants
  { type: 'info', label: 'Info', icon: Lightbulb, description: 'Information callout', category: 'Callouts' },
  { type: 'warning', label: 'Warning', icon: AlertCircle, description: 'Warning callout', category: 'Callouts' },
  { type: 'success', label: 'Success', icon: Star, description: 'Success callout', category: 'Callouts' },
  { type: 'tip', label: 'Tip', icon: Zap, description: 'Tip or hint', category: 'Callouts' },
  
  // Organization
  { type: 'page', label: 'Page', icon: FileText, description: 'Sub-page reference', category: 'Organization' },
  { type: 'bookmark', label: 'Bookmark', icon: BookOpen, description: 'Bookmark link', category: 'Organization' },
  { type: 'date', label: 'Date', icon: Calendar, description: 'Date mention', category: 'Organization' },
  { type: 'tag', label: 'Tag', icon: Tag, description: 'Tag or label', category: 'Organization' },
];

const SimpleBlockEditor = ({ blocks, onChange, readOnly = false }) => {
  const [hoveredBlockId, setHoveredBlockId] = useState(null);
  const [showBlockMenu, setShowBlockMenu] = useState(null);
  const [draggedBlockId, setDraggedBlockId] = useState(null);
  const [dropIndicator, setDropIndicator] = useState(null); // { blockId, position: 'above' | 'below' }
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashMenuPosition, setSlashMenuPosition] = useState({ top: 0, left: 0 });
  const [activeBlockId, setActiveBlockId] = useState(null);
  const [selectedMenuIndex, setSelectedMenuIndex] = useState(0);
  const [viewingFile, setViewingFile] = useState(null);
  const [lastKeyPress, setLastKeyPress] = useState({ key: '', time: 0 });
  const blockRefs = useRef({});
  const blockWrapperRefs = useRef({});
  const slashMenuRef = useRef(null);
  const draggedBlockIdRef = useRef(null);

  const updateBlock = useCallback((blockId, updates) => {
    const newBlocks = blocks.map(b =>
      b.id === blockId ? { ...b, ...updates } : b
    );
    onChange(newBlocks);
  }, [blocks, onChange]);

  const handleFileUpload = async (blockId, file) => {
    if (!file) return;
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const response = await fetch('http://localhost:8000/api/upload-attachment', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      
      if (!response.ok) throw new Error('Upload failed');
      
      const data = await response.json();
      
      updateBlock(blockId, {
        properties: {
          fileName: data.filename,
          fileUrl: data.url,
          fileSize: data.size,
          fileType: data.type
        }
      });
    } catch (error) {
      console.error('File upload error:', error);
      alert('Failed to upload file');
    }
  };

  const addBlock = useCallback((index) => {
    const newBlock = {
      id: Date.now() + Math.random(),
      type: 'paragraph',
      content: '',
      properties: {}
    };
    const newBlocks = [...blocks];
    newBlocks.splice(index + 1, 0, newBlock);
    onChange(newBlocks);
    setTimeout(() => blockRefs.current[newBlock.id]?.focus(), 0);
  }, [blocks, onChange]);

  const deleteBlock = useCallback((blockId) => {
    if (blocks.length === 1) return;
    const index = blocks.findIndex(b => b.id === blockId);
    const newBlocks = blocks.filter(b => b.id !== blockId);
    onChange(newBlocks);
    if (index > 0) {
      setTimeout(() => blockRefs.current[blocks[index - 1].id]?.focus(), 0);
    }
  }, [blocks, onChange]);

  const duplicateBlock = useCallback((blockId) => {
    const index = blocks.findIndex(b => b.id === blockId);
    const block = blocks[index];
    const newBlock = { ...block, id: Date.now() + Math.random() };
    const newBlocks = [...blocks];
    newBlocks.splice(index + 1, 0, newBlock);
    onChange(newBlocks);
  }, [blocks, onChange]);

  const moveBlock = useCallback((blockId, direction) => {
    const index = blocks.findIndex(b => b.id === blockId);
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === blocks.length - 1)) return;
    
    const newBlocks = [...blocks];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newBlocks[index], newBlocks[targetIndex]] = [newBlocks[targetIndex], newBlocks[index]];
    onChange(newBlocks);
  }, [blocks, onChange]);

  const handleKeyDown = (e, blockId, index) => {
    // Slash menu navigation
    if (showSlashMenu) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedMenuIndex(prev => (prev + 1) % BLOCK_TYPES.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedMenuIndex(prev => (prev - 1 + BLOCK_TYPES.length) % BLOCK_TYPES.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selectedType = BLOCK_TYPES[selectedMenuIndex];
        const el = blockRefs.current[blockId];
        
        if (el) {
          // Remove the slash from content
          const content = el.textContent.replace(/\/$/, '').trim();
          el.textContent = content;
          
          // Update block with new type and content
          updateBlock(blockId, { type: selectedType.type, content });
          
          // Close menu
          setShowSlashMenu(false);
          
          // Focus and place cursor at the end
          setTimeout(() => {
            el.focus();
            const range = document.createRange();
            const sel = window.getSelection();
            if (el.childNodes.length > 0) {
              range.selectNodeContents(el);
              range.collapse(false);
            } else {
              range.setStart(el, 0);
              range.setEnd(el, 0);
            }
            sel.removeAllRanges();
            sel.addRange(range);
          }, 0);
        }
        return;
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setShowSlashMenu(false);
        // Remove the slash
        const el = blockRefs.current[blockId];
        if (el) {
          const content = el.textContent.replace(/\/$/, '');
          el.textContent = content;
          updateBlock(blockId, { content });
        }
        return;
      }
      return;
    }

    // Check for "dd" shortcut to delete block
    const now = Date.now();
    if (e.key === 'd' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const el = blockRefs.current[blockId];
      // Only trigger if block is empty or cursor is at start
      if (el && (el.textContent === '' || window.getSelection()?.anchorOffset === 0)) {
        if (lastKeyPress.key === 'd' && (now - lastKeyPress.time) < 500) {
          // Double 'd' detected - delete block
          e.preventDefault();
          deleteBlock(blockId);
          setLastKeyPress({ key: '', time: 0 });
          return;
        } else {
          setLastKeyPress({ key: 'd', time: now });
        }
      }
    } else if (e.key !== 'd') {
      setLastKeyPress({ key: '', time: 0 });
    }

    // Keyboard shortcuts for formatting
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
      switch(e.key.toLowerCase()) {
        case 'b':
          e.preventDefault();
          document.execCommand('bold');
          return;
        case 'i':
          e.preventDefault();
          document.execCommand('italic');
          return;
        case 'u':
          e.preventDefault();
          document.execCommand('underline');
          return;
        case 'e':
          e.preventDefault();
          document.execCommand('insertHTML', false, '<code>' + window.getSelection().toString() + '</code>');
          return;
        default:
          break;
      }
    }

    // Shift+Enter creates new block, Enter creates line break within block
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        // Shift+Enter creates a new block
        e.preventDefault();
        addBlock(index);
      }
      // Regular Enter allows default behavior (line break within block)
    } else if (e.key === 'Backspace') {
      const el = blockRefs.current[blockId];
      if (el && el.textContent === '') {
        e.preventDefault();
        deleteBlock(blockId);
      }
    }
  };

  const handleInput = (e, blockId) => {
    const content = e.currentTarget.textContent || '';
    
    // Markdown shortcuts detection
    const trimmedContent = content.trim();
    
    // Check for markdown at start of line
    if (trimmedContent.endsWith(' ') && content.length > 1) {
      const beforeSpace = trimmedContent.slice(0, -1);
      
      // Heading shortcuts
      if (beforeSpace === '#') {
        updateBlock(blockId, { type: 'heading1', content: '' });
        e.currentTarget.textContent = '';
        return;
      } else if (beforeSpace === '##') {
        updateBlock(blockId, { type: 'heading2', content: '' });
        e.currentTarget.textContent = '';
        return;
      } else if (beforeSpace === '###') {
        updateBlock(blockId, { type: 'heading3', content: '' });
        e.currentTarget.textContent = '';
        return;
      }
      // List shortcuts
      else if (beforeSpace === '-' || beforeSpace === '*') {
        updateBlock(blockId, { type: 'bulletList', content: '' });
        e.currentTarget.textContent = '';
        return;
      } else if (beforeSpace === '1.' || beforeSpace.match(/^\d+\.$/)) {
        updateBlock(blockId, { type: 'numberedList', content: '' });
        e.currentTarget.textContent = '';
        return;
      }
      // Todo shortcut
      else if (beforeSpace === '[]' || beforeSpace === '[ ]') {
        updateBlock(blockId, { type: 'todo', content: '', properties: { checked: false } });
        e.currentTarget.textContent = '';
        return;
      }
      // Quote shortcut
      else if (beforeSpace === '>') {
        updateBlock(blockId, { type: 'quote', content: '' });
        e.currentTarget.textContent = '';
        return;
      }
      // Code shortcut
      else if (beforeSpace === '```') {
        updateBlock(blockId, { type: 'code', content: '' });
        e.currentTarget.textContent = '';
        return;
      }
      // Divider shortcut
      else if (beforeSpace === '---' || beforeSpace === '***') {
        updateBlock(blockId, { type: 'divider', content: '' });
        e.currentTarget.textContent = '';
        return;
      }
    }
    
    // Check for slash command BEFORE updating - trigger when / is typed at start or after space
    const lastChar = content[content.length - 1];
    const beforeLastChar = content[content.length - 2];
    
    if (lastChar === '/' && (!beforeLastChar || beforeLastChar === ' ' || content.length === 1)) {
      setShowSlashMenu(true);
      setActiveBlockId(blockId);
      setSelectedMenuIndex(0);
    } else if (showSlashMenu && !content.includes('/')) {
      setShowSlashMenu(false);
    }
    
    // Update block content AFTER checking for slash
    updateBlock(blockId, { content });
  };

  const handleDragStart = useCallback((e, blockId) => {
    // Prevent default browser drag behavior for text selection
    e.stopPropagation();
    
    // Set drag data
    draggedBlockIdRef.current = blockId;
    setDraggedBlockId(blockId);
    
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', blockId.toString());
    
    // Create a custom drag image clone
    const blockWrapper = blockWrapperRefs.current[blockId];
    if (blockWrapper) {
      const rect = blockWrapper.getBoundingClientRect();
      
      // Create a clone for the drag image
      const clone = blockWrapper.cloneNode(true);
      clone.style.position = 'absolute';
      clone.style.top = '-9999px';
      clone.style.left = '-9999px';
      clone.style.width = `${rect.width}px`;
      clone.style.background = '#1a1a1a';
      clone.style.color = '#ffffff';
      clone.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
      clone.style.borderRadius = '6px';
      clone.style.padding = '8px 12px';
      clone.style.opacity = '0.95';
      clone.style.pointerEvents = 'none';
      clone.id = 'drag-ghost';
      
      // Ensure all child text elements have white color
      const allElements = clone.querySelectorAll('*');
      allElements.forEach(el => {
        el.style.color = '#ffffff';
      });
      
      document.body.appendChild(clone);
      
      // Set the clone as drag image with cursor at center-left
      e.dataTransfer.setDragImage(clone, 20, rect.height / 2);
      
      // Remove the clone after a short delay
      requestAnimationFrame(() => {
        setTimeout(() => {
          const ghost = document.getElementById('drag-ghost');
          if (ghost) {
            document.body.removeChild(ghost);
          }
        }, 0);
      });
    }
  }, []);

  const handleDragOver = useCallback((e, targetBlockId) => {
    e.preventDefault();
    e.stopPropagation();
    
    const draggedId = draggedBlockIdRef.current;
    if (!draggedId || draggedId === targetBlockId) {
      return;
    }
    
    e.dataTransfer.dropEffect = 'move';
    
    // Determine if we should show indicator above or below based on mouse position
    const blockWrapper = blockWrapperRefs.current[targetBlockId];
    if (blockWrapper) {
      const rect = blockWrapper.getBoundingClientRect();
      const mouseY = e.clientY;
      const midpoint = rect.top + rect.height / 2;
      const position = mouseY < midpoint ? 'above' : 'below';
      
      setDropIndicator({ blockId: targetBlockId, position });
    }
  }, []);

  const handleDragEnter = useCallback((e, targetBlockId) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    
    // Only clear indicator if we're leaving the editor entirely
    const relatedTarget = e.relatedTarget;
    const currentTarget = e.currentTarget;
    
    if (!currentTarget.contains(relatedTarget)) {
      setDropIndicator(null);
    }
  }, []);

  const handleDrop = useCallback((e, targetBlockId) => {
    e.preventDefault();
    e.stopPropagation();
    
    const draggedId = draggedBlockIdRef.current;
    
    if (!draggedId || draggedId === targetBlockId) {
      draggedBlockIdRef.current = null;
      setDraggedBlockId(null);
      setDropIndicator(null);
      return;
    }
    
    const dragIndex = blocks.findIndex(b => b.id === draggedId);
    let targetIndex = blocks.findIndex(b => b.id === targetBlockId);
    
    if (dragIndex === -1 || targetIndex === -1) {
      draggedBlockIdRef.current = null;
      setDraggedBlockId(null);
      setDropIndicator(null);
      return;
    }
    
    // Adjust target index based on drop position indicator
    if (dropIndicator?.position === 'below') {
      targetIndex += 1;
    }
    
    // Adjust for the removal of the dragged item
    if (dragIndex < targetIndex) {
      targetIndex -= 1;
    }
    
    const newBlocks = [...blocks];
    const [draggedBlock] = newBlocks.splice(dragIndex, 1);
    newBlocks.splice(targetIndex, 0, draggedBlock);
    
    onChange(newBlocks);
    
    draggedBlockIdRef.current = null;
    setDraggedBlockId(null);
    setDropIndicator(null);
  }, [blocks, onChange, dropIndicator]);

  const handleDragEnd = useCallback(() => {
    draggedBlockIdRef.current = null;
    setDraggedBlockId(null);
    setDropIndicator(null);
  }, []);

  // Handle drag over the editor container for edge cases
  const handleEditorDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleEditorDrop = useCallback((e) => {
    e.preventDefault();
    // Reset state if dropped on editor but not on a block
    draggedBlockIdRef.current = null;
    setDraggedBlockId(null);
    setDropIndicator(null);
  }, []);

  // Close slash menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (slashMenuRef.current && !slashMenuRef.current.contains(e.target)) {
        setShowSlashMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close block menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showBlockMenu && !e.target.closest('.block-menu-dropdown') && !e.target.closest('.block-control-btn')) {
        setShowBlockMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showBlockMenu]);

  const renderBlockContent = (block) => {
    // Special handling for code blocks - don't use contentEditable
    if (block.type === 'code') {
      return (
        <CodeBlock
          code={block.content || ''}
          language={block.properties?.language || 'javascript'}
          onChange={(newCode, newLang) => {
            updateBlock(block.id, {
              content: newCode,
              properties: { ...block.properties, language: newLang }
            });
          }}
          readOnly={readOnly}
        />
      );
    }

    // Special handling for table blocks
    if (block.type === 'table') {
      return (
        <TableBlock
          data={block.properties?.tableData || {}}
          onChange={(tableData) => {
            updateBlock(block.id, {
              properties: { ...block.properties, tableData }
            });
          }}
        />
      );
    }

    const handleContentInput = (e) => {
      // Save cursor position
      const selection = window.getSelection();
      const range = selection.getRangeAt(0);
      const cursorOffset = range.startOffset;
      const cursorNode = range.startContainer;
      
      handleInput(e, block.id);
      
      // Restore cursor position after state update
      requestAnimationFrame(() => {
        try {
          const newRange = document.createRange();
          const newSelection = window.getSelection();
          newRange.setStart(cursorNode, cursorOffset);
          newRange.collapse(true);
          newSelection.removeAllRanges();
          newSelection.addRange(newRange);
        } catch (err) {
          // Cursor restoration failed, ignore
        }
      });
    };
    
    const props = {
      ref: (el) => { 
        blockRefs.current[block.id] = el;
        // Set initial content only once
        if (el && el.textContent !== block.content) {
          el.textContent = block.content;
        }
      },
      contentEditable: !readOnly && block.type !== 'divider',
      suppressContentEditableWarning: true,
      onInput: handleContentInput,
      onBlur: (e) => {
        const content = e.currentTarget.textContent || '';
        if (content !== block.content) {
          updateBlock(block.id, { content });
        }
      },
      onKeyDown: (e) => handleKeyDown(e, block.id, blocks.findIndex(b => b.id === block.id)),
      className: `block-content block-${block.type}`,
      'data-placeholder': block.content ? '' : `Type something...`
    };

    switch (block.type) {
      case 'heading1':
        return <h1 {...props} />;
      case 'heading2':
        return <h2 {...props} />;
      case 'heading3':
        return <h3 {...props} />;
      case 'quote':
        return <blockquote {...props} />;
      case 'callout':
        return (
          <div className="block-callout-inner">
            <AlertCircle size={20} />
            <div {...props} />
          </div>
        );
      case 'divider':
        return <hr className="block-divider-line" />;
      case 'file':
        return (
          <div className="block-file-inner">
            {!block.properties?.fileUrl ? (
              <div className="file-upload-zone">
                <input
                  type="file"
                  accept=".pdf,.docx,.doc"
                  onChange={(e) => handleFileUpload(block.id, e.target.files[0])}
                  style={{ display: 'none' }}
                  id={`file-input-${block.id}`}
                  disabled={readOnly}
                />
                <label htmlFor={`file-input-${block.id}`} className="file-upload-label">
                  <Paperclip size={20} />
                  <span>Click to upload PDF or Word document</span>
                </label>
              </div>
            ) : (
              <div className="file-attachment">
                <FileText size={24} className="file-icon" />
                <div 
                  className="file-details"
                  onClick={() => setViewingFile({
                    url: block.properties.fileUrl,
                    name: block.properties.fileName,
                    type: block.properties.fileType
                  })}
                  style={{ cursor: 'pointer' }}
                >
                  <span className="file-name">
                    {block.properties.fileName}
                  </span>
                  <span className="file-size">
                    {(block.properties.fileSize / 1024 / 1024).toFixed(2)} MB
                  </span>
                </div>
                {!readOnly && (
                  <button
                    className="file-remove-btn"
                    onClick={() => updateBlock(block.id, { properties: {} })}
                    title="Remove file"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            )}
          </div>
        );
      case 'todo':
        return (
          <div className="block-todo-inner">
            <input
              type="checkbox"
              checked={block.properties?.checked || false}
              onChange={(e) => updateBlock(block.id, {
                properties: { ...block.properties, checked: e.target.checked }
              })}
            />
            <div {...props} />
          </div>
        );
      case 'toggle':
        return (
          <div className="block-toggle-inner">
            <button
              className="toggle-button"
              onClick={() => updateBlock(block.id, {
                properties: { ...block.properties, expanded: !block.properties?.expanded }
              })}
            >
              <ChevronRight 
                size={16} 
                style={{ 
                  transform: block.properties?.expanded ? 'rotate(90deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s'
                }}
              />
            </button>
            <div {...props} />
          </div>
        );
      case 'info':
        return (
          <div className="block-callout-inner block-info">
            <Lightbulb size={20} />
            <div {...props} />
          </div>
        );
      case 'warning':
        return (
          <div className="block-callout-inner block-warning">
            <AlertCircle size={20} />
            <div {...props} />
          </div>
        );
      case 'success':
        return (
          <div className="block-callout-inner block-success">
            <Star size={20} />
            <div {...props} />
          </div>
        );
      case 'tip':
        return (
          <div className="block-callout-inner block-tip">
            <Zap size={20} />
            <div {...props} />
          </div>
        );
      case 'image':
        return (
          <div className="block-image-wrapper">
            <Image size={48} style={{ opacity: 0.3 }} />
            <div {...props} placeholder="Add image URL or description..." />
          </div>
        );
      case 'link':
        return (
          <div className="block-link-wrapper">
            <Link2 size={16} />
            <div {...props} placeholder="Paste link..." />
          </div>
        );
      case 'table':
        return (
          <div className="block-table-wrapper">
            <Table size={16} />
            <div {...props} placeholder="Table content..." />
          </div>
        );
      case 'page':
        return (
          <div className="block-page-wrapper">
            <FileText size={16} />
            <div {...props} placeholder="Page name..." />
          </div>
        );
      case 'bookmark':
        return (
          <div className="block-bookmark-wrapper">
            <BookOpen size={16} />
            <div {...props} placeholder="Bookmark title..." />
          </div>
        );
      case 'date':
        return (
          <div className="block-date-wrapper">
            <Calendar size={16} />
            <div {...props} placeholder="Date..." />
          </div>
        );
      case 'tag':
        return (
          <div className="block-tag-wrapper">
            <Tag size={16} />
            <div {...props} placeholder="Tag name..." />
          </div>
        );
      default:
        return <p {...props} />;
    }
  };

  // Determine if controls should be visible for a block
  const shouldShowControls = (blockId) => {
    if (readOnly) return false;
    // Always show controls for hovered block, dragged block, or block with open menu
    return hoveredBlockId === blockId || draggedBlockId === blockId || showBlockMenu === blockId;
  };

  return (
    <>
    <div 
      className="block-editor"
      onDragOver={handleEditorDragOver}
      onDrop={handleEditorDrop}
    >
      {blocks.map((block, index) => {
        const isDragging = draggedBlockId === block.id;
        const showAboveIndicator = dropIndicator?.blockId === block.id && dropIndicator?.position === 'above';
        const showBelowIndicator = dropIndicator?.blockId === block.id && dropIndicator?.position === 'below';
        
        return (
          <div
            key={block.id}
            ref={(el) => { blockWrapperRefs.current[block.id] = el; }}
            data-block-id={block.id}
            className={`block-wrapper ${isDragging ? 'dragging' : ''}`}
            onMouseEnter={() => !readOnly && !draggedBlockId && !showBlockMenu && setHoveredBlockId(block.id)}
            onMouseLeave={() => !readOnly && !draggedBlockId && showBlockMenu !== block.id && setHoveredBlockId(null)}
            onDragOver={(e) => handleDragOver(e, block.id)}
            onDragEnter={(e) => handleDragEnter(e, block.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, block.id)}
          >
            {/* Drop indicator above */}
            {!readOnly && showAboveIndicator && (
              <div className="drop-indicator drop-indicator-above" />
            )}
            
            {/* Block controls - only render if not readOnly */}
            {!readOnly && (
            <div className={`block-controls ${shouldShowControls(block.id) ? 'visible' : ''}`}>
              <div 
                className="block-control-btn drag-handle" 
                title="Drag to reorder"
                draggable="true"
                onDragStart={(e) => handleDragStart(e, block.id)}
                onDragEnd={handleDragEnd}
              >
                <GripVertical size={16} />
              </div>
              <button
                className="block-control-btn"
                onClick={() => addBlock(index)}
                title="Add block"
              >
                <Plus size={16} />
              </button>
              <button
                className="block-control-btn"
                onClick={() => setShowBlockMenu(showBlockMenu === block.id ? null : block.id)}
                title="More"
              >
                <MoreVertical size={16} />
              </button>

              {showBlockMenu === block.id && (
                <div className="block-menu-dropdown">
                  <div className="menu-label">Actions</div>
                  <button onClick={() => { duplicateBlock(block.id); setShowBlockMenu(null); }}>
                    <Copy size={14} /> Duplicate
                  </button>
                  <button onClick={() => { 
                    const content = block.content;
                    navigator.clipboard.writeText(content);
                    setShowBlockMenu(null);
                  }}>
                    <Copy size={14} /> Copy text
                  </button>
                  <button onClick={() => { deleteBlock(block.id); setShowBlockMenu(null); }}>
                    <Trash2 size={14} /> Delete
                  </button>
                  
                  <div className="menu-divider"></div>
                  <div className="menu-label">Move</div>
                  <button onClick={() => { moveBlock(block.id, 'up'); setShowBlockMenu(null); }} disabled={index === 0}>
                    <ArrowUp size={14} /> Move up
                  </button>
                  <button onClick={() => { moveBlock(block.id, 'down'); setShowBlockMenu(null); }} disabled={index === blocks.length - 1}>
                    <ArrowDown size={14} /> Move down
                  </button>
                  
                  <div className="menu-divider"></div>
                  <div className="menu-label">Turn into</div>
                  {BLOCK_TYPES.map(bt => (
                    <button
                      key={bt.type}
                      onClick={() => {
                        updateBlock(block.id, { type: bt.type });
                        setShowBlockMenu(null);
                      }}
                      className={block.type === bt.type ? 'active' : ''}
                    >
                      <bt.icon size={14} /> {bt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            )}
            
            <div className="block-content-wrapper">
              {renderBlockContent(block)}
            </div>
            
            {/* Drop indicator below */}
            {!readOnly && showBelowIndicator && (
              <div className="drop-indicator drop-indicator-below" />
            )}
            
            {/* Slash Menu - render inside the active block */}
            {showSlashMenu && activeBlockId === block.id && (
              <div
                ref={slashMenuRef}
                className="slash-menu"
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: '0',
                  marginTop: '4px',
                  zIndex: 1000
                }}
              >
          {BLOCK_TYPES.map((blockType, index) => {
            const Icon = blockType.icon;
            return (
              <div
                key={blockType.type}
                className={`slash-menu-item ${index === selectedMenuIndex ? 'selected' : ''}`}
                onClick={() => {
                  const el = blockRefs.current[activeBlockId];
                  if (el) {
                    // Remove the slash from content
                    const content = el.textContent.replace(/\/$/, '').trim();
                    el.textContent = content;
                    
                    // Update block with new type and content
                    updateBlock(activeBlockId, { type: blockType.type, content });
                    
                    // Close menu
                    setShowSlashMenu(false);
                    
                    // Focus and place cursor at the end
                    setTimeout(() => {
                      el.focus();
                      const range = document.createRange();
                      const sel = window.getSelection();
                      if (el.childNodes.length > 0) {
                        range.selectNodeContents(el);
                        range.collapse(false);
                      } else {
                        range.setStart(el, 0);
                        range.setEnd(el, 0);
                      }
                      sel.removeAllRanges();
                      sel.addRange(range);
                    }, 0);
                  }
                }}
                onMouseEnter={() => setSelectedMenuIndex(index)}
              >
                <Icon size={18} />
                <div className="slash-menu-item-content">
                  <div className="slash-menu-item-label">{blockType.label}</div>
                  <div className="slash-menu-item-description">{blockType.description}</div>
                </div>
              </div>
            );
          })}
              </div>
            )}
          </div>
        );
      })}
    </div>
    
    {viewingFile && (
      <FileViewer
        fileUrl={viewingFile.url}
        fileName={viewingFile.name}
        fileType={viewingFile.type}
        onClose={() => setViewingFile(null)}
      />
    )}
    </>
  );
};

export default SimpleBlockEditor;
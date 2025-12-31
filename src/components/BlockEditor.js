import React, { useState, useRef, useEffect } from 'react';
import { 
  Type, Heading1, Heading2, Heading3, List, ListOrdered, 
  CheckSquare, Code, Quote, AlertCircle, ChevronRight,
  Minus, Image as ImageIcon, Link2, Table, GripVertical,
  Plus, Trash2, MoreVertical, Copy, ArrowUp, ArrowDown, FileText, Paperclip
} from 'lucide-react';
import './BlockEditor.css';
import FileViewer from './FileViewer';

const BLOCK_TYPES = [
  { type: 'paragraph', label: 'Text', icon: Type, description: 'Just start writing with plain text' },
  { type: 'heading1', label: 'Heading 1', icon: Heading1, description: 'Big section heading' },
  { type: 'heading2', label: 'Heading 2', icon: Heading2, description: 'Medium section heading' },
  { type: 'heading3', label: 'Heading 3', icon: Heading3, description: 'Small section heading' },
  { type: 'bulletList', label: 'Bulleted list', icon: List, description: 'Create a simple bulleted list' },
  { type: 'numberedList', label: 'Numbered list', icon: ListOrdered, description: 'Create a list with numbering' },
  { type: 'todo', label: 'To-do list', icon: CheckSquare, description: 'Track tasks with a to-do list' },
  { type: 'toggle', label: 'Toggle list', icon: ChevronRight, description: 'Toggles can hide and show content' },
  { type: 'code', label: 'Code', icon: Code, description: 'Capture a code snippet' },
  { type: 'quote', label: 'Quote', icon: Quote, description: 'Capture a quote' },
  { type: 'callout', label: 'Callout', icon: AlertCircle, description: 'Make writing stand out' },
  { type: 'divider', label: 'Divider', icon: Minus, description: 'Visually divide blocks' },
  { type: 'image', label: 'Image', icon: ImageIcon, description: 'Upload or embed an image' },
  { type: 'file', label: 'File', icon: Paperclip, description: 'Attach PDF or Word document' },
  { type: 'table', label: 'Table', icon: Table, description: 'Add a table' },
];

const BlockEditor = ({ blocks, onChange, readOnly = false }) => {
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashMenuPosition, setSlashMenuPosition] = useState({ top: 0, left: 0 });
  const [slashMenuFilter, setSlashMenuFilter] = useState('');
  const [activeBlockId, setActiveBlockId] = useState(null);
  const [selectedBlockIndex, setSelectedBlockIndex] = useState(0);
  const [hoveredBlockId, setHoveredBlockId] = useState(null);
  const [draggedBlockId, setDraggedBlockId] = useState(null);
  const [showBlockMenu, setShowBlockMenu] = useState(null);
  const [focusedBlockId, setFocusedBlockId] = useState(null);
  const [viewingFile, setViewingFile] = useState(null);
  
  const editorRef = useRef(null);
  const slashMenuRef = useRef(null);
  const blockRefs = useRef({});

  const filteredBlockTypes = BLOCK_TYPES.filter(bt => 
    bt.label.toLowerCase().includes(slashMenuFilter.toLowerCase()) ||
    bt.type.toLowerCase().includes(slashMenuFilter.toLowerCase())
  );

  // Block manipulation functions
  const addBlock = (index, type = 'paragraph') => {
    const newBlock = {
      id: Date.now() + Math.random(),
      type,
      content: '',
      properties: {}
    };
    const newBlocks = [...blocks];
    newBlocks.splice(index + 1, 0, newBlock);
    onChange(newBlocks);
    
    setTimeout(() => {
      const blockElement = blockRefs.current[newBlock.id];
      if (blockElement) blockElement.focus();
    }, 0);
  };

  const deleteBlock = (blockId) => {
    if (blocks.length === 1) return;
    const blockIndex = blocks.findIndex(b => b.id === blockId);
    const newBlocks = blocks.filter(b => b.id !== blockId);
    onChange(newBlocks);
    
    if (blockIndex > 0) {
      setTimeout(() => {
        const prevBlock = blockRefs.current[blocks[blockIndex - 1].id];
        if (prevBlock) prevBlock.focus();
      }, 0);
    }
  };

  const duplicateBlock = (blockId) => {
    const blockIndex = blocks.findIndex(b => b.id === blockId);
    const block = blocks[blockIndex];
    const newBlock = {
      ...block,
      id: Date.now() + Math.random()
    };
    const newBlocks = [...blocks];
    newBlocks.splice(blockIndex + 1, 0, newBlock);
    onChange(newBlocks);
  };

  const moveBlockUp = (blockId) => {
    const blockIndex = blocks.findIndex(b => b.id === blockId);
    if (blockIndex === 0) return;
    
    const newBlocks = [...blocks];
    [newBlocks[blockIndex - 1], newBlocks[blockIndex]] = [newBlocks[blockIndex], newBlocks[blockIndex - 1]];
    onChange(newBlocks);
  };

  const moveBlockDown = (blockId) => {
    const blockIndex = blocks.findIndex(b => b.id === blockId);
    if (blockIndex === blocks.length - 1) return;
    
    const newBlocks = [...blocks];
    [newBlocks[blockIndex], newBlocks[blockIndex + 1]] = [newBlocks[blockIndex + 1], newBlocks[blockIndex]];
    onChange(newBlocks);
  };

  const changeBlockType = (blockId, newType) => {
    const newBlocks = blocks.map(block =>
      block.id === blockId ? { ...block, type: newType } : block
    );
    onChange(newBlocks);
  };

  // Drag and drop handlers
  const handleDragStart = (e, blockId) => {
    if (readOnly) return;
    setDraggedBlockId(blockId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, blockId) => {
    if (readOnly) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, targetBlockId) => {
    if (readOnly) return;
    e.preventDefault();
    
    if (draggedBlockId === targetBlockId) return;
    
    const draggedIndex = blocks.findIndex(b => b.id === draggedBlockId);
    const targetIndex = blocks.findIndex(b => b.id === targetBlockId);
    
    const newBlocks = [...blocks];
    const [draggedBlock] = newBlocks.splice(draggedIndex, 1);
    newBlocks.splice(targetIndex, 0, draggedBlock);
    
    onChange(newBlocks);
    setDraggedBlockId(null);
  };

  const handleDragEnd = () => {
    setDraggedBlockId(null);
  };

  const handleKeyDown = (e, blockId, blockIndex) => {
    if (readOnly) return;

    // Handle slash command
    if (e.key === '/') {
      const selection = window.getSelection();
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      
      setSlashMenuPosition({
        top: rect.bottom + window.scrollY + 5,
        left: rect.left + window.scrollX
      });
      setShowSlashMenu(true);
      setActiveBlockId(blockId);
      setSlashMenuFilter('');
      setSelectedBlockIndex(0);
    }

    // Handle slash menu navigation
    if (showSlashMenu) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedBlockIndex(prev => 
          prev < filteredBlockTypes.length - 1 ? prev + 1 : 0
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedBlockIndex(prev => 
          prev > 0 ? prev - 1 : filteredBlockTypes.length - 1
        );
      } else if (e.key === 'Enter' && showSlashMenu) {
        e.preventDefault();
        handleBlockTypeSelect(filteredBlockTypes[selectedBlockIndex].type);
      } else if (e.key === 'Escape') {
        setShowSlashMenu(false);
      }
    }

    // Handle Enter key for new blocks
    if (e.key === 'Enter' && !e.shiftKey && !showSlashMenu) {
      e.preventDefault();
      const newBlock = {
        id: Date.now(),
        type: 'paragraph',
        content: '',
        properties: {}
      };
      const newBlocks = [...blocks];
      newBlocks.splice(blockIndex + 1, 0, newBlock);
      onChange(newBlocks);
      
      setTimeout(() => {
        const nextBlock = document.querySelector(`[data-block-id="${newBlock.id}"]`);
        if (nextBlock) nextBlock.focus();
      }, 0);
    }

    // Handle Backspace on empty block
    if (e.key === 'Backspace') {
      const block = blocks[blockIndex];
      if (!block.content || block.content.trim() === '') {
        e.preventDefault();
        if (blocks.length > 1) {
          const newBlocks = blocks.filter((_, i) => i !== blockIndex);
          onChange(newBlocks);
          
          if (blockIndex > 0) {
            setTimeout(() => {
              const prevBlock = document.querySelector(`[data-block-id="${blocks[blockIndex - 1].id}"]`);
              if (prevBlock) {
                prevBlock.focus();
                const range = document.createRange();
                const sel = window.getSelection();
                range.selectNodeContents(prevBlock);
                range.collapse(false);
                sel.removeAllRanges();
                sel.addRange(range);
              }
            }, 0);
          }
        }
      }
    }
  };

  const handleInput = (e, blockId) => {
    if (readOnly) return;
    
    const content = e.currentTarget.textContent || '';
    
    // Check for slash command
    if (content.endsWith('/') && !showSlashMenu) {
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        
        setSlashMenuPosition({
          top: rect.bottom + window.scrollY + 5,
          left: rect.left + window.scrollX
        });
        setShowSlashMenu(true);
        setActiveBlockId(blockId);
        setSlashMenuFilter('');
      }
    } else if (showSlashMenu) {
      const slashIndex = content.lastIndexOf('/');
      if (slashIndex === -1) {
        setShowSlashMenu(false);
      } else {
        setSlashMenuFilter(content.substring(slashIndex + 1));
      }
    }
  };

  const handleBlockTypeSelect = (type) => {
    const newBlocks = blocks.map(block =>
      block.id === activeBlockId ? { ...block, type, content: block.content.replace(/\/$/, '') } : block
    );
    onChange(newBlocks);
    setShowSlashMenu(false);
    
    setTimeout(() => {
      const blockElement = document.querySelector(`[data-block-id="${activeBlockId}"]`);
      if (blockElement) blockElement.focus();
    }, 0);
  };

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
      
      const newBlocks = blocks.map(block =>
        block.id === blockId ? {
          ...block,
          properties: {
            ...block.properties,
            fileName: data.filename,
            fileUrl: data.url,
            fileSize: data.size,
            fileType: data.type
          }
        } : block
      );
      onChange(newBlocks);
    } catch (error) {
            alert('Failed to upload file');
    }
  };

  const renderBlock = (block, index) => {
    const isHovered = hoveredBlockId === block.id;
    const isDragging = draggedBlockId === block.id;
    const isFocused = focusedBlockId === block.id;
    
    // Use a ref-based approach to avoid re-rendering issues
    const getCommonProps = (TagName) => ({
      ref: (el) => {
        if (el && blockRefs.current[block.id] !== el) {
          blockRefs.current[block.id] = el;
          // Only set content if it's different to avoid cursor jump
          if (el.textContent !== block.content) {
            el.textContent = block.content;
          }
        }
      },
      'data-block-id': block.id,
      contentEditable: !readOnly && block.type !== 'divider',
      suppressContentEditableWarning: true,
      onKeyDown: (e) => handleKeyDown(e, block.id, index),
      onInput: (e) => handleInput(e, block.id),
      onFocus: () => setFocusedBlockId(block.id),
      onBlur: () => {
        setFocusedBlockId(null);
        // Sync content on blur to ensure consistency
        const el = blockRefs.current[block.id];
        if (el && el.textContent !== block.content) {
          const newBlocks = blocks.map(b =>
            b.id === block.id ? { ...b, content: el.textContent } : b
          );
          onChange(newBlocks);
        }
      },
      className: `block-content block-${block.type}`,
      'data-placeholder': block.content ? '' : getPlaceholder(block.type)
    });

    let blockContent;
    switch (block.type) {
      case 'heading1':
        blockContent = <h1 {...getCommonProps('h1')} />;
        break;
      case 'heading2':
        blockContent = <h2 {...getCommonProps('h2')} />;
        break;
      case 'heading3':
        blockContent = <h3 {...getCommonProps('h3')} />;
        break;
      case 'code':
        blockContent = (
          <pre className="block-code-wrapper">
            <code {...getCommonProps('code')} />
          </pre>
        );
        break;
      case 'quote':
        blockContent = <blockquote {...getCommonProps('blockquote')} />;
        break;
      case 'callout':
        blockContent = (
          <div className="block-callout-inner" style={{ borderColor: block.properties?.color || '#D7B38C' }}>
            <AlertCircle size={20} />
            <div {...getCommonProps('div')} />
          </div>
        );
        break;
      case 'divider':
        blockContent = <hr className="block-divider-line" />;
        break;
      case 'file':
        blockContent = (
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
                    onClick={() => {
                      const newBlocks = blocks.map(b =>
                        b.id === block.id ? { ...b, properties: {} } : b
                      );
                      onChange(newBlocks);
                    }}
                    title="Remove file"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            )}
          </div>
        );
        break;
      case 'todo':
        blockContent = (
          <div className="block-todo-inner">
            <input 
              type="checkbox" 
              checked={block.properties?.checked || false}
              onChange={(e) => {
                const newBlocks = blocks.map(b =>
                  b.id === block.id ? { ...b, properties: { ...b.properties, checked: e.target.checked } } : b
                );
                onChange(newBlocks);
              }}
              disabled={readOnly}
            />
            <div {...getCommonProps('div')} />
          </div>
        );
        break;
      case 'toggle':
        blockContent = (
          <div className="block-toggle-inner">
            <button
              className="toggle-button"
              onClick={() => {
                const newBlocks = blocks.map(b =>
                  b.id === block.id ? { ...b, properties: { ...b.properties, expanded: !b.properties?.expanded } } : b
                );
                onChange(newBlocks);
              }}
            >
              <ChevronRight 
                size={16} 
                style={{ transform: block.properties?.expanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
              />
            </button>
            <div {...getCommonProps('div')} />
          </div>
        );
        break;
      default:
        blockContent = <p {...getCommonProps('p')} />;
    }

    return (
      <div
        key={block.id}
        className={`block-wrapper ${isDragging ? 'dragging' : ''} ${isFocused ? 'focused' : ''}`}
        onMouseEnter={() => !readOnly && setHoveredBlockId(block.id)}
        onMouseLeave={() => !readOnly && setHoveredBlockId(null)}
        draggable={!readOnly}
        onDragStart={(e) => handleDragStart(e, block.id)}
        onDragOver={(e) => handleDragOver(e, block.id)}
        onDrop={(e) => handleDrop(e, block.id)}
        onDragEnd={handleDragEnd}
      >
        {!readOnly && (isHovered || isFocused) && (
          <div className="block-controls">
            <button
              className="block-control-btn drag-handle"
              title="Drag to move"
            >
              <GripVertical size={16} />
            </button>
            <button
              className="block-control-btn add-block"
              onClick={() => addBlock(index)}
              title="Add block below"
            >
              <Plus size={16} />
            </button>
            <button
              className="block-control-btn block-menu"
              onClick={() => setShowBlockMenu(showBlockMenu === block.id ? null : block.id)}
              title="More options"
            >
              <MoreVertical size={16} />
            </button>
            
            {showBlockMenu === block.id && (
              <div className="block-menu-dropdown" style={{
                background: '#ffffff',
                backgroundColor: '#ffffff',
                backdropFilter: 'none',
                WebkitBackdropFilter: 'none',
                opacity: 1
              }}>
                <button onClick={() => { deleteBlock(block.id); setShowBlockMenu(null); }} style={{ background: '#ffffff', backgroundColor: '#ffffff' }}>
                  <Trash2 size={14} /> Delete
                </button>
                <button onClick={() => { duplicateBlock(block.id); setShowBlockMenu(null); }} style={{ background: '#ffffff', backgroundColor: '#ffffff' }}>
                  <Copy size={14} /> Duplicate
                </button>
                <button onClick={() => { moveBlockUp(block.id); setShowBlockMenu(null); }} disabled={index === 0} style={{ background: '#ffffff', backgroundColor: '#ffffff' }}>
                  <ArrowUp size={14} /> Move up
                </button>
                <button onClick={() => { moveBlockDown(block.id); setShowBlockMenu(null); }} disabled={index === blocks.length - 1} style={{ background: '#ffffff', backgroundColor: '#ffffff' }}>
                  <ArrowDown size={14} /> Move down
                </button>
                <div className="menu-divider" style={{ background: '#e0e0e0', backgroundColor: '#e0e0e0' }}></div>
                <div className="menu-label" style={{ background: '#ffffff', backgroundColor: '#ffffff', color: '#666666' }}>Turn into</div>
                {BLOCK_TYPES.slice(0, 6).map(bt => (
                  <button 
                    key={bt.type}
                    onClick={() => { changeBlockType(block.id, bt.type); setShowBlockMenu(null); }}
                    style={{ background: '#ffffff', backgroundColor: '#ffffff' }}
                  >
                    <bt.icon size={14} /> {bt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="block-content-wrapper">
          {blockContent}
        </div>
      </div>
    );
  };

  const getPlaceholder = (type) => {
    switch (type) {
      case 'heading1': return 'Heading 1';
      case 'heading2': return 'Heading 2';
      case 'heading3': return 'Heading 3';
      case 'code': return '// Code';
      case 'quote': return 'Quote';
      case 'callout': return 'Callout';
      case 'todo': return 'To-do';
      default: return "Type '/' for commands";
    }
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (slashMenuRef.current && !slashMenuRef.current.contains(e.target)) {
        setShowSlashMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <>
    <div className="block-editor" ref={editorRef}>
      {blocks.map((block, index) => renderBlock(block, index))}
      
      {showSlashMenu && (
        <div 
          ref={slashMenuRef}
          className="slash-menu"
          style={{ top: slashMenuPosition.top, left: slashMenuPosition.left }}
        >
          {filteredBlockTypes.map((blockType, index) => {
            const Icon = blockType.icon;
            return (
              <div
                key={blockType.type}
                className={`slash-menu-item ${index === selectedBlockIndex ? 'selected' : ''}`}
                onClick={() => handleBlockTypeSelect(blockType.type)}
                onMouseEnter={() => setSelectedBlockIndex(index)}
              >
                <Icon size={18} />
                <div className="slash-menu-item-content">
                  <div className="slash-menu-item-label">{blockType.label}</div>
                  <div className="slash-menu-item-description">{blockType.description}</div>
                </div>
              </div>
            );
          })}
          {filteredBlockTypes.length === 0 && (
            <div className="slash-menu-empty">No results</div>
          )}
        </div>
      )}
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

export default BlockEditor;

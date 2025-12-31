import React, { useState } from 'react';
import {
  Bold, Italic, Underline, Strikethrough, Code, Link2,
  List, ListOrdered, Quote, Heading1, Heading2, Heading3,
  AlignLeft, AlignCenter, AlignRight, Image, Table,
  MoreHorizontal, Palette, Type, Sparkles
} from 'lucide-react';
import './FormattingToolbar.css';

const FONTS = [
  // Sans-serif fonts
  'Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat',
  'Source Sans 3', 'Arial', 'Helvetica', 'Verdana', 'Tahoma',
  'Trebuchet MS', 'Segoe UI', 'Calibri', 'Futura', 'Avenir',
  
  // Serif fonts
  'Merriweather', 'Playfair Display', 'EB Garamond', 'Georgia',
  'Times New Roman', 'Baskerville', 'Palatino', 'Garamond',
  'Didot', 'Bodoni', 'Rockwell',
  
  // Monospace fonts
  'Courier New', 'Monaco', 'Consolas', 'Fira Code', 'Source Code Pro',
  'JetBrains Mono', 'IBM Plex Mono', 'Inconsolata',
  
  // Display/Decorative fonts
  'Comic Sans MS', 'Impact', 'Brush Script MT', 'Papyrus',
  'Copperplate', 'Luminari', 'Chalkboard', 'Marker Felt'
];

const FormattingToolbar = ({ onFormat, onAIAssist, showAI = true, onInsertBlock }) => {
  const [showMore, setShowMore] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showFontPicker, setShowFontPicker] = useState(false);
  const [savedSelection, setSavedSelection] = useState(null);
  const [activeFormats, setActiveFormats] = useState({
    bold: false,
    italic: false,
    underline: false,
    strikeThrough: false
  });

  const saveSelection = () => {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      setSavedSelection(selection.getRangeAt(0));
      updateActiveFormats();
    }
  };

  const restoreSelection = () => {
    if (savedSelection) {
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(savedSelection);
    }
  };

  const updateActiveFormats = () => {
    try {
      setActiveFormats({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        strikeThrough: document.queryCommandState('strikeThrough')
      });
    } catch (err) {
      // Ignore errors
    }
  };

  const formatText = (command, value = null) => {
    // Restore selection if it was saved
    restoreSelection();
    
    // Apply formatting
    try {
      const success = document.execCommand(command, false, value);
      if (!success) {
              }
      
      if (onFormat) onFormat(command, value);
      
      // Save the new selection and update active formats
      saveSelection();
    } catch (err) {
          }
  };

  // Update active formats when selection changes
  React.useEffect(() => {
    const handleSelectionChange = () => {
      updateActiveFormats();
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, []);

  const insertBlock = (type) => {
    if (onInsertBlock) onInsertBlock(type);
  };

  const colors = [
    '#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00',
    '#FF00FF', '#00FFFF', '#FFA500', '#800080', '#008000',
    '#D7B38C', '#808080', '#FFFFFF'
  ];

  return (
    <div 
      className="formatting-toolbar"
      onMouseDown={(e) => {
        // Prevent toolbar clicks from removing selection
        e.preventDefault();
        saveSelection();
      }}
    >
      <div className="toolbar-group">
        <button
          className={`toolbar-btn ${activeFormats.bold ? 'active' : ''}`}
          onClick={() => formatText('bold')}
          title="Bold (Cmd+B)"
        >
          <Bold size={16} />
        </button>
        <button
          className={`toolbar-btn ${activeFormats.italic ? 'active' : ''}`}
          onClick={() => formatText('italic')}
          title="Italic (Cmd+I)"
        >
          <Italic size={16} />
        </button>
        <button
          className={`toolbar-btn ${activeFormats.underline ? 'active' : ''}`}
          onClick={() => formatText('underline')}
          title="Underline (Cmd+U)"
        >
          <Underline size={16} />
        </button>
        <button
          className={`toolbar-btn ${activeFormats.strikeThrough ? 'active' : ''}`}
          onClick={() => formatText('strikeThrough')}
          title="Strikethrough"
        >
          <Strikethrough size={16} />
        </button>
        <button
          className="toolbar-btn"
          onClick={() => formatText('insertHTML', '<code>' + window.getSelection().toString() + '</code>')}
          title="Inline code"
        >
          <Code size={16} />
        </button>
      </div>

      <div className="toolbar-divider"></div>

      <div className="toolbar-group">
        <button
          className="toolbar-btn"
          onClick={() => setShowFontPicker(!showFontPicker)}
          title="Font family"
        >
          <Type size={16} />
        </button>
        {showFontPicker && (
          <div className="font-picker-dropdown">
            {FONTS.map(font => (
              <button
                key={font}
                className="font-option"
                style={{ fontFamily: font }}
                onClick={() => {
                  restoreSelection();
                  const selection = window.getSelection();
                  if (selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0);
                    const selectedText = range.toString();
                    
                    if (selectedText) {
                      // Create a span with the font
                      const span = document.createElement('span');
                      span.style.fontFamily = font;
                      span.textContent = selectedText;
                      
                      // Replace selection with styled span
                      range.deleteContents();
                      range.insertNode(span);
                      
                      // Move cursor after the span
                      range.setStartAfter(span);
                      range.setEndAfter(span);
                      selection.removeAllRanges();
                      selection.addRange(range);
                    }
                  }
                  setShowFontPicker(false);
                  saveSelection();
                }}
              >
                {font}
              </button>
            ))}
          </div>
        )}
        <button
          className="toolbar-btn"
          onClick={() => {
            const url = prompt('Enter URL:');
            if (url) formatText('createLink', url);
          }}
          title="Insert link"
        >
          <Link2 size={16} />
        </button>
        <button
          className="toolbar-btn"
          onClick={() => setShowColorPicker(!showColorPicker)}
          title="Text color"
        >
          <Palette size={16} />
        </button>
        {showColorPicker && (
          <div className="color-picker-dropdown">
            {colors.map(color => (
              <button
                key={color}
                className="color-swatch"
                style={{ background: color }}
                onClick={() => {
                  formatText('foreColor', color);
                  setShowColorPicker(false);
                }}
              />
            ))}
          </div>
        )}
      </div>

      <div className="toolbar-divider"></div>

      <div className="toolbar-group">
        <button
          className="toolbar-btn"
          onClick={() => insertBlock ? insertBlock('heading1') : formatText('formatBlock', 'h1')}
          title="Heading 1"
        >
          <Heading1 size={16} />
        </button>
        <button
          className="toolbar-btn"
          onClick={() => insertBlock ? insertBlock('heading2') : formatText('formatBlock', 'h2')}
          title="Heading 2"
        >
          <Heading2 size={16} />
        </button>
        <button
          className="toolbar-btn"
          onClick={() => insertBlock ? insertBlock('heading3') : formatText('formatBlock', 'h3')}
          title="Heading 3"
        >
          <Heading3 size={16} />
        </button>
      </div>

      <div className="toolbar-divider"></div>

      <div className="toolbar-group">
        <button
          className="toolbar-btn"
          onClick={() => insertBlock ? insertBlock('bulletList') : formatText('insertUnorderedList')}
          title="Bullet list"
        >
          <List size={16} />
        </button>
        <button
          className="toolbar-btn"
          onClick={() => insertBlock ? insertBlock('numberedList') : formatText('insertOrderedList')}
          title="Numbered list"
        >
          <ListOrdered size={16} />
        </button>
        <button
          className="toolbar-btn"
          onClick={() => insertBlock ? insertBlock('quote') : formatText('formatBlock', 'blockquote')}
          title="Quote"
        >
          <Quote size={16} />
        </button>
      </div>

      {showAI && (
        <>
          <div className="toolbar-divider"></div>
          <div className="toolbar-group">
            <button
              className="toolbar-btn toolbar-btn-ai"
              onClick={onAIAssist}
              title="AI Assistant"
            >
              <Sparkles size={16} />
              <span>AI</span>
            </button>
          </div>
        </>
      )}

      <div className="toolbar-divider"></div>

      <div className="toolbar-group">
        <button
          className="toolbar-btn"
          onClick={() => setShowMore(!showMore)}
          title="More options"
        >
          <MoreHorizontal size={16} />
        </button>
      </div>

      {showMore && (
        <div className="toolbar-more-dropdown">
          <button onClick={() => { formatText('justifyLeft'); setShowMore(false); }}>
            <AlignLeft size={14} /> Align Left
          </button>
          <button onClick={() => { formatText('justifyCenter'); setShowMore(false); }}>
            <AlignCenter size={14} /> Align Center
          </button>
          <button onClick={() => { formatText('justifyRight'); setShowMore(false); }}>
            <AlignRight size={14} /> Align Right
          </button>
          <div className="menu-divider"></div>
          <button onClick={() => { formatText('removeFormat'); setShowMore(false); }}>
            <Type size={14} /> Clear Formatting
          </button>
        </div>
      )}
    </div>
  );
};

export default FormattingToolbar;

import React, { useState, useRef, useEffect } from 'react';
import {
  Square, Circle, Type, Minus, Trash2, Move, ZoomIn, ZoomOut, 
  Download, Undo, Redo, Palette, X, ArrowLeft, StickyNote,
  Image as ImageIcon, Pen, Eraser, MousePointer, Save, Grid, Ruler,
  Check, Clock, Command, ArrowRight, Lock, Unlock, Eye, Map
} from 'lucide-react';
import './CanvasMode.css';

const CanvasMode = ({ initialContent, onClose, onSave }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  
  const [tool, setTool] = useState('select');
  const [elements, setElements] = useState([]);
  const [selectedElement, setSelectedElement] = useState(null);
  const [drawing, setDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState([]);
  const [zoom, setZoom] = useState(0.5);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState(null);
  const [color, setColor] = useState('#FFFFFF');
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [history, setHistory] = useState([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [showGrid, setShowGrid] = useState(true);
  const [showRuler, setShowRuler] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [editingText, setEditingText] = useState(null);
  const [rulerTool, setRulerTool] = useState(null); // { x, y, angle, length }
  const [draggingRuler, setDraggingRuler] = useState(null); // 'body', 'start', 'end'
  const [rulerDragStart, setRulerDragStart] = useState(null);
  const [autoSaving, setAutoSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const autoSaveTimeout = useRef(null);
  const [selectedElements, setSelectedElements] = useState([]); // Multi-select
  const [copiedElements, setCopiedElements] = useState([]);
  const [fillColor, setFillColor] = useState('transparent');
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [opacity, setOpacity] = useState(1);
  const [backgroundPattern, setBackgroundPattern] = useState('none');
  const [showMinimap, setShowMinimap] = useState(false);
  const fileInputRef = useRef(null);
  const GRID_SIZE = 20;

  const COLORS = [
    '#FFFFFF', '#000000', '#FF6B6B', '#4ECDC4', 
    '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', 
    '#BB8FCE', '#85C1E2', '#52B788', '#F4A261'
  ];

  const STICKY_COLORS = [
    '#FFF59D', // Classic yellow
    '#FFE082', // Warm yellow
    '#FFCCBC', // Peach
    '#F8BBD0', // Pink
    '#E1BEE7', // Purple
    '#C5CAE9', // Blue
    '#B2DFDB', // Teal
    '#C8E6C9', // Green
    '#FFE0B2', // Orange
    '#D7CCC8', // Brown
  ];

  const STROKE_WIDTHS = [1, 2, 4, 6, 8, 12];

  // Load initial content
  useEffect(() => {
    if (initialContent) {
      try {
        const parsed = JSON.parse(initialContent);
        if (parsed.canvasElements) {
          setElements(parsed.canvasElements);
          setHistory([[...parsed.canvasElements]]);
        }
      } catch (e) {
        console.log('No canvas data to load');
      }
    }
  }, [initialContent]);

  // Copy/Paste functionality
  const copySelected = () => {
    if (selectedElements.length > 0) {
      setCopiedElements(selectedElements.map(el => ({ ...el })));
    } else if (selectedElement) {
      setCopiedElements([{ ...selectedElement }]);
    }
  };

  const pasteElements = () => {
    if (copiedElements.length > 0) {
      const newElements = copiedElements.map(el => ({
        ...el,
        id: Date.now() + Math.random(),
        x: el.x + 20,
        y: el.y + 20
      }));
      setElements([...elements, ...newElements]);
      addToHistory([...elements, ...newElements]);
      setSelectedElements(newElements);
    }
  };

  const duplicateSelected = () => {
    copySelected();
    setTimeout(() => pasteElements(), 10);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (editingText) return; // Don't trigger shortcuts while editing text
      
      if (e.key === 'v' || e.key === 'V') setTool('select');
      else if (e.key === 'd' || e.key === 'D') setTool('draw');
      else if (e.key === 'r' || e.key === 'R') setTool('rectangle');
      else if (e.key === 'c' || e.key === 'C') setTool('circle');
      else if (e.key === 'l' || e.key === 'L') setTool('line');
      else if (e.key === 't' || e.key === 'T') setTool('text');
      else if (e.key === 's' || e.key === 'S') setTool('sticky');
      else if (e.key === 'a' || e.key === 'A') setTool('arrow');
      else if (e.key === 'e' || e.key === 'E') setTool('eraser');
      else if (e.key === 'i' || e.key === 'I') fileInputRef.current?.click();
      else if (e.key === 'g' || e.key === 'G') setShowGrid(!showGrid);
      else if (e.key === 'h' || e.key === 'H') setShowRuler(!showRuler);
      else if (e.key === 'm' || e.key === 'M') setShowMinimap(!showMinimap);
      else if (e.key === '?') setShowShortcuts(!showShortcuts);
      else if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected();
      else if (e.key === '+' || e.key === '=') setZoom(Math.min(zoom + 0.1, 10));
      else if (e.key === '-' || e.key === '_') setZoom(Math.max(zoom - 0.1, 0.1));
      else if (e.key === '0') setZoom(1);
      else if (e.key === '1') setZoom(0.5);
      else if (e.key === '2') setZoom(2);
      else if (e.ctrlKey || e.metaKey) {
        if (e.key === 'c' || e.key === 'C') {
          e.preventDefault();
          copySelected();
        } else if (e.key === 'v' || e.key === 'V') {
          e.preventDefault();
          pasteElements();
        } else if (e.key === 'd' || e.key === 'D') {
          e.preventDefault();
          duplicateSelected();
        } else if (e.key === 'a' || e.key === 'A') {
          e.preventDefault();
          setSelectedElements([...elements]);
        } else if (e.key === 'z' || e.key === 'Z') {
          e.preventDefault();
          if (e.shiftKey) redo();
          else undo();
        } else if (e.key === 'y' || e.key === 'Y') {
          e.preventDefault();
          redo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tool, showGrid, showRuler, zoom, selectedElement, selectedElements, editingText, historyIndex, history, copiedElements, elements, showShortcuts]);

  const addToHistory = (newElements) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push([...newElements]);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const undo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setElements([...history[newIndex]]);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setElements([...history[newIndex]]);
    }
  };

  const getMousePos = (e) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    let x = (e.clientX - rect.left - pan.x) / zoom;
    let y = (e.clientY - rect.top - pan.y) / zoom;
    
    // Snap to ruler if ruler tool is active and we're drawing
    if (rulerTool && (drawing || tool === 'draw' || tool === 'line')) {
      const angle = rulerTool.angle || 0;
      
      // Rotate point to ruler's coordinate system
      const dx = x - rulerTool.x;
      const dy = y - rulerTool.y;
      const rotatedX = dx * Math.cos(-angle) - dy * Math.sin(-angle);
      const rotatedY = dx * Math.sin(-angle) + dy * Math.cos(-angle);
      
      // Check if close to ruler (within 20px)
      if (Math.abs(rotatedY) < 20 && rotatedX >= -10 && rotatedX <= rulerTool.length + 10) {
        // Snap to ruler line
        const snappedRotatedY = 0;
        
        // Rotate back to canvas coordinates
        const snappedDx = rotatedX * Math.cos(angle) - snappedRotatedY * Math.sin(angle);
        const snappedDy = rotatedX * Math.sin(angle) + snappedRotatedY * Math.cos(angle);
        
        x = rulerTool.x + snappedDx;
        y = rulerTool.y + snappedDy;
      }
    }
    // Snap to grid if enabled
    else if (snapToGrid && showGrid) {
      x = Math.round(x / GRID_SIZE) * GRID_SIZE;
      y = Math.round(y / GRID_SIZE) * GRID_SIZE;
    }
    
    return { x, y };
  };

  const isPointInElement = (x, y, element) => {
    if (element.type === 'rectangle' || element.type === 'sticky') {
      return x >= element.x && x <= element.x + element.width &&
             y >= element.y && y <= element.y + element.height;
    } else if (element.type === 'circle') {
      const dx = x - element.x;
      const dy = y - element.y;
      return Math.sqrt(dx * dx + dy * dy) <= element.radius;
    } else if (element.type === 'text') {
      return x >= element.x && x <= element.x + 200 &&
             y >= element.y - 20 && y <= element.y + 20;
    } else if (element.type === 'draw') {
      return element.points.some(point => {
        const dx = x - point.x;
        const dy = y - point.y;
        return Math.sqrt(dx * dx + dy * dy) <= 10;
      });
    }
    return false;
  };

  const handleMouseDown = (e) => {
    const pos = getMousePos(e);

    // Check if clicking on ruler tool
    if (rulerTool && tool === 'select') {
      const startDist = Math.sqrt(Math.pow(pos.x - rulerTool.x, 2) + Math.pow(pos.y - rulerTool.y, 2));
      const endDist = Math.sqrt(Math.pow(pos.x - (rulerTool.x + rulerTool.length), 2) + Math.pow(pos.y - rulerTool.y, 2));
      
      // Check if clicking on start handle
      if (startDist < 15) {
        setDraggingRuler('start');
        setRulerDragStart(pos);
        return;
      }
      // Check if clicking on end handle
      if (endDist < 15) {
        setDraggingRuler('end');
        setRulerDragStart(pos);
        return;
      }
      // Check if clicking on ruler body
      const distToLine = Math.abs((pos.y - rulerTool.y));
      if (distToLine < 10 && pos.x >= rulerTool.x && pos.x <= rulerTool.x + rulerTool.length) {
        setDraggingRuler('body');
        setRulerDragStart({ x: pos.x - rulerTool.x, y: pos.y - rulerTool.y });
        return;
      }
    }

    if (tool === 'select') {
      const clicked = [...elements].reverse().find(el => isPointInElement(pos.x, pos.y, el));
      if (clicked) {
        setSelectedElement(clicked);
        setDragStart({ x: pos.x - clicked.x, y: pos.y - clicked.y });
      } else {
        setSelectedElement(null);
        setIsPanning(true);
        setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      }
    } else if (tool === 'draw') {
      setDrawing(true);
      setCurrentPath([pos]);
    } else if (tool === 'eraser') {
      // Eraser: find and delete element under cursor
      const clicked = [...elements].reverse().find(el => isPointInElement(pos.x, pos.y, el));
      if (clicked) {
        const newElements = elements.filter(el => el.id !== clicked.id);
        setElements(newElements);
        addToHistory(newElements);
      }
      setDrawing(true); // Allow continuous erasing
    } else if (tool === 'text') {
      const newElement = {
        id: Date.now(),
        type: 'text',
        x: pos.x,
        y: pos.y,
        text: 'Double click to edit',
        color,
        fontSize: 18
      };
      const newElements = [...elements, newElement];
      setElements(newElements);
      addToHistory(newElements);
      setTool('select');
    } else if (tool === 'sticky') {
      // Use sticky colors or default to yellow
      const stickyColor = STICKY_COLORS.includes(color) ? color : '#FFF59D';
      const newElement = {
        id: Date.now(),
        type: 'sticky',
        x: pos.x,
        y: pos.y,
        width: 200,
        height: 180,
        text: 'Click to edit...',
        color: stickyColor,
        priority: 'normal',
        timestamp: new Date().toLocaleString(),
        opacity: opacity
      };
      const newElements = [...elements, newElement];
      setElements(newElements);
      addToHistory(newElements);
      setTool('select');
    } else if (tool === 'arrow') {
      setDrawing(true);
      setDragStart(pos);
    } else if (tool === 'rectangle') {
      setDrawing(true);
      setDragStart(pos);
    } else if (tool === 'circle') {
      setDrawing(true);
      setDragStart(pos);
    } else if (tool === 'line') {
      setDrawing(true);
      setDragStart(pos);
    }
  };

  const handleMouseMove = (e) => {
    const pos = getMousePos(e);

    // Handle ruler dragging
    if (draggingRuler && rulerTool) {
      if (draggingRuler === 'body') {
        // Move entire ruler
        setRulerTool({
          ...rulerTool,
          x: pos.x - rulerDragStart.x,
          y: pos.y - rulerDragStart.y
        });
      } else if (draggingRuler === 'start') {
        // Move start point - calculate end point first
        const angle = rulerTool.angle || 0;
        const endX = rulerTool.x + rulerTool.length * Math.cos(angle);
        const endY = rulerTool.y + rulerTool.length * Math.sin(angle);
        
        // Calculate new angle and length from new start to old end
        const dx = endX - pos.x;
        const dy = endY - pos.y;
        const newLength = Math.sqrt(dx * dx + dy * dy);
        const newAngle = Math.atan2(dy, dx);
        
        setRulerTool({
          x: pos.x,
          y: pos.y,
          length: newLength,
          angle: newAngle
        });
      } else if (draggingRuler === 'end') {
        // Move end point (changes length and angle)
        const dx = pos.x - rulerTool.x;
        const dy = pos.y - rulerTool.y;
        const newLength = Math.sqrt(dx * dx + dy * dy);
        const newAngle = Math.atan2(dy, dx);
        
        setRulerTool({
          ...rulerTool,
          length: newLength,
          angle: newAngle
        });
      }
      return;
    }

    if (isPanning) {
      const newPanX = e.clientX - panStart.x;
      const newPanY = e.clientY - panStart.y;
      
      // Constrain pan so you can't go beyond 0,0
      setPan({
        x: Math.min(newPanX, 0),
        y: Math.min(newPanY, 0)
      });
    } else if (drawing) {
      if (tool === 'draw') {
        setCurrentPath([...currentPath, pos]);
      } else if (tool === 'eraser') {
        // Continuous erasing while dragging
        const clicked = [...elements].reverse().find(el => isPointInElement(pos.x, pos.y, el));
        if (clicked) {
          const newElements = elements.filter(el => el.id !== clicked.id);
          setElements(newElements);
          addToHistory(newElements);
        }
      }
    } else if (selectedElement && dragStart && tool === 'select') {
      const newElements = elements.map(el => {
        if (el.id === selectedElement.id) {
          return { ...el, x: pos.x - dragStart.x, y: pos.y - dragStart.y };
        }
        return el;
      });
      setElements(newElements);
      setSelectedElement({ ...selectedElement, x: pos.x - dragStart.x, y: pos.y - dragStart.y });
    }
  };

  const handleMouseUp = (e) => {
    const pos = getMousePos(e);

    // Stop ruler dragging
    if (draggingRuler) {
      setDraggingRuler(null);
      setRulerDragStart(null);
      return;
    }

    if (drawing) {
      if (tool === 'draw' && currentPath.length > 1) {
        const newElement = {
          id: Date.now(),
          type: 'draw',
          points: currentPath,
          color,
          strokeWidth
        };
        const newElements = [...elements, newElement];
        setElements(newElements);
        addToHistory(newElements);
        setCurrentPath([]);
      } else if (tool === 'rectangle' && dragStart) {
        const newElement = {
          id: Date.now(),
          type: 'rectangle',
          x: Math.min(dragStart.x, pos.x),
          y: Math.min(dragStart.y, pos.y),
          width: Math.abs(pos.x - dragStart.x),
          height: Math.abs(pos.y - dragStart.y),
          color,
          strokeWidth
        };
        if (newElement.width > 5 && newElement.height > 5) {
          const newElements = [...elements, newElement];
          setElements(newElements);
          addToHistory(newElements);
        }
        setTool('select');
      } else if (tool === 'circle' && dragStart) {
        const radius = Math.sqrt(
          Math.pow(pos.x - dragStart.x, 2) + Math.pow(pos.y - dragStart.y, 2)
        );
        const newElement = {
          id: Date.now(),
          type: 'circle',
          x: dragStart.x,
          y: dragStart.y,
          radius,
          color,
          strokeWidth
        };
        if (radius > 5) {
          const newElements = [...elements, newElement];
          setElements(newElements);
          addToHistory(newElements);
        }
        setTool('select');
      } else if (tool === 'line' && dragStart) {
        const newElement = {
          id: Date.now(),
          type: 'line',
          x1: dragStart.x,
          y1: dragStart.y,
          x2: pos.x,
          y2: pos.y,
          color,
          strokeWidth,
          opacity
        };
        const newElements = [...elements, newElement];
        setElements(newElements);
        addToHistory(newElements);
        setTool('select');
      } else if (tool === 'arrow' && dragStart) {
        const newElement = {
          id: Date.now(),
          type: 'arrow',
          x1: dragStart.x,
          y1: dragStart.y,
          x2: pos.x,
          y2: pos.y,
          color,
          strokeWidth,
          opacity
        };
        const newElements = [...elements, newElement];
        setElements(newElements);
        addToHistory(newElements);
        setTool('select');
      }
      setDrawing(false);
      setDragStart(null);
    }

    if (isPanning) {
      setIsPanning(false);
    }

    if (selectedElement && dragStart) {
      addToHistory(elements);
      setDragStart(null);
    }
  };

  const handleDoubleClick = (e) => {
    const pos = getMousePos(e);
    const clicked = [...elements].reverse().find(el => isPointInElement(pos.x, pos.y, el));
    
    if (clicked && (clicked.type === 'text' || clicked.type === 'sticky')) {
      setEditingText(clicked);
    }
  };

  const updateText = (id, newText) => {
    const newElements = elements.map(el => 
      el.id === id ? { ...el, text: newText } : el
    );
    setElements(newElements);
    addToHistory(newElements);
  };

  const deleteSelected = () => {
    if (selectedElement) {
      const newElements = elements.filter(el => el.id !== selectedElement.id);
      setElements(newElements);
      addToHistory(newElements);
      setSelectedElement(null);
    }
  };

  const clearCanvas = () => {
    if (window.confirm('Clear entire canvas?')) {
      setElements([]);
      addToHistory([]);
      setSelectedElement(null);
    }
  };

  const handleSave = (shouldClose = false) => {
    const canvasData = JSON.stringify({ canvasElements: elements });
    if (onSave) {
      onSave(canvasData, shouldClose);
    }
    setLastSaved(new Date());
  };

  // Auto-save effect
  useEffect(() => {
    if (autoSaveTimeout.current) {
      clearTimeout(autoSaveTimeout.current);
    }

    if (elements.length > 0) {
      setAutoSaving(true);
      autoSaveTimeout.current = setTimeout(() => {
        const canvasData = JSON.stringify({ canvasElements: elements });
        if (onSave) {
          onSave(canvasData);
        }
        setLastSaved(new Date());
        setAutoSaving(false);
      }, 2000);
    }

    return () => {
      if (autoSaveTimeout.current) {
        clearTimeout(autoSaveTimeout.current);
      }
    };
  }, [elements, onSave]);

  const exportAsImage = () => {
    // Create a temporary canvas for export
    const canvas = document.createElement('canvas');
    canvas.width = 2000;
    canvas.height = 2000;
    const ctx = canvas.getContext('2d');
    
    // White background
    ctx.fillStyle = '#0f1012';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw all elements
    elements.forEach(el => {
      ctx.strokeStyle = el.color || '#FFFFFF';
      ctx.fillStyle = el.color || '#FFFFFF';
      ctx.lineWidth = el.strokeWidth || 2;
      
      if (el.type === 'draw') {
        ctx.beginPath();
        el.points.forEach((point, i) => {
          if (i === 0) ctx.moveTo(point.x, point.y);
          else ctx.lineTo(point.x, point.y);
        });
        ctx.stroke();
      } else if (el.type === 'rectangle') {
        ctx.strokeRect(el.x, el.y, el.width, el.height);
      } else if (el.type === 'circle') {
        ctx.beginPath();
        ctx.arc(el.x, el.y, el.radius, 0, Math.PI * 2);
        ctx.stroke();
      } else if (el.type === 'line') {
        ctx.beginPath();
        ctx.moveTo(el.x1, el.y1);
        ctx.lineTo(el.x2, el.y2);
        ctx.stroke();
      } else if (el.type === 'text') {
        ctx.font = `${el.fontSize}px Inter`;
        ctx.fillText(el.text, el.x, el.y);
      } else if (el.type === 'sticky') {
        ctx.fillStyle = el.color;
        ctx.fillRect(el.x, el.y, el.width, el.height);
        ctx.fillStyle = '#000000';
        ctx.font = '14px Inter';
        ctx.fillText(el.text, el.x + 10, el.y + 30);
      }
    });
    
    // Download
    const link = document.createElement('a');
    link.download = 'canvas-export.png';
    link.href = canvas.toDataURL();
    link.click();
  };

  return (
    <div className="canvas-mode">
      {/* Toolbar */}
      <div className="canvas-toolbar">
        <div className="toolbar-section">
          <button onClick={onClose} className="tool-btn back-btn" title="Back to Notes">
            <ArrowLeft size={20} />
            <span>Back</span>
          </button>
        </div>

        <div className="toolbar-section">
          <button 
            onClick={() => setTool('select')} 
            className={`tool-btn ${tool === 'select' ? 'active' : ''}`}
            title="Select (V)"
          >
            <MousePointer size={20} />
          </button>
          <button 
            onClick={() => setTool('draw')} 
            className={`tool-btn ${tool === 'draw' ? 'active' : ''}`}
            title="Draw (D)"
          >
            <Pen size={20} />
          </button>
          <button 
            onClick={() => setTool('eraser')} 
            className={`tool-btn ${tool === 'eraser' ? 'active' : ''}`}
            title="Eraser (E)"
          >
            <Eraser size={20} />
          </button>
        </div>

        <div className="toolbar-section">
          <button 
            onClick={() => setTool('rectangle')} 
            className={`tool-btn ${tool === 'rectangle' ? 'active' : ''}`}
            title="Rectangle (R)"
          >
            <Square size={20} />
          </button>
          <button 
            onClick={() => setTool('circle')} 
            className={`tool-btn ${tool === 'circle' ? 'active' : ''}`}
            title="Circle (C)"
          >
            <Circle size={20} />
          </button>
          <button 
            onClick={() => setTool('line')} 
            className={`tool-btn ${tool === 'line' ? 'active' : ''}`}
            title="Line (L)"
          >
            <Minus size={20} />
          </button>
          <button 
            onClick={() => setTool('text')} 
            className={`tool-btn ${tool === 'text' ? 'active' : ''}`}
            title="Text (T)"
          >
            <Type size={20} />
          </button>
          <button 
            onClick={() => setTool('sticky')} 
            className={`tool-btn ${tool === 'sticky' ? 'active' : ''}`}
            title="Sticky Note (S)"
          >
            <StickyNote size={20} />
          </button>
          <button 
            onClick={() => setTool('arrow')} 
            className={`tool-btn ${tool === 'arrow' ? 'active' : ''}`}
            title="Arrow/Connector (A)"
          >
            <ArrowRight size={20} />
          </button>
          <button 
            onClick={() => fileInputRef.current?.click()} 
            className="tool-btn"
            title="Upload Image (I)"
          >
            <ImageIcon size={20} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                  const newElement = {
                    id: Date.now(),
                    type: 'image',
                    x: 100,
                    y: 100,
                    width: 200,
                    height: 200,
                    src: event.target.result,
                    opacity: 1
                  };
                  const newElements = [...elements, newElement];
                  setElements(newElements);
                  addToHistory(newElements);
                };
                reader.readAsDataURL(file);
              }
            }}
          />
        </div>

        <div className="toolbar-section">
          <button onClick={undo} disabled={historyIndex === 0} className="tool-btn" title="Undo (Ctrl+Z)">
            <Undo size={20} />
          </button>
          <button onClick={redo} disabled={historyIndex === history.length - 1} className="tool-btn" title="Redo (Ctrl+Y)">
            <Redo size={20} />
          </button>
          <button onClick={deleteSelected} disabled={!selectedElement} className="tool-btn" title="Delete (Del)">
            <Trash2 size={20} />
          </button>
          <button onClick={clearCanvas} className="tool-btn" title="Clear All">
            <X size={20} />
          </button>
        </div>

        <div className="toolbar-section">
          <button onClick={() => setZoom(Math.min(zoom + 0.1, 10))} className="tool-btn" title="Zoom In (+)">
            <ZoomIn size={20} />
          </button>
          <span className="zoom-level">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(Math.max(zoom - 0.1, 0.1))} className="tool-btn" title="Zoom Out (-)">
            <ZoomOut size={20} />
          </button>
        </div>

        <div className="toolbar-section">
          <button onClick={copySelected} className="tool-btn" title="Copy (Ctrl+C)" disabled={!selectedElement && selectedElements.length === 0}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
          </button>
          <button onClick={pasteElements} className="tool-btn" title="Paste (Ctrl+V)" disabled={copiedElements.length === 0}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
            </svg>
          </button>
          <button onClick={duplicateSelected} className="tool-btn" title="Duplicate (Ctrl+D)" disabled={!selectedElement && selectedElements.length === 0}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              <circle cx="15" cy="15" r="2" fill="currentColor"></circle>
            </svg>
          </button>
        </div>

        <div className="toolbar-section">
          <button onClick={() => setShowMinimap(!showMinimap)} className={`tool-btn ${showMinimap ? 'active' : ''}`} title="Toggle Minimap (M)">
            <Map size={20} />
          </button>
          <button onClick={() => setShowGrid(!showGrid)} className={`tool-btn ${showGrid ? 'active' : ''}`} title="Toggle Grid (G)">
            <Grid size={20} />
          </button>
          <button onClick={() => setShowRuler(!showRuler)} className={`tool-btn ${showRuler ? 'active' : ''}`} title="Toggle Measurement Rulers">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="6" width="20" height="12" rx="2"/>
              <line x1="6" y1="6" x2="6" y2="10"/>
              <line x1="10" y1="6" x2="10" y2="10"/>
              <line x1="14" y1="6" x2="14" y2="10"/>
              <line x1="18" y1="6" x2="18" y2="10"/>
            </svg>
          </button>
          <select 
            value={backgroundPattern} 
            onChange={(e) => setBackgroundPattern(e.target.value)}
            className="tool-btn"
            style={{ width: 'auto', padding: '8px' }}
            title="Background Pattern"
          >
            <option value="none">No Pattern</option>
            <option value="dots">Dots</option>
            <option value="lines">Lines</option>
            <option value="cross">Cross</option>
            <option value="diagonal">Diagonal</option>
          </select>
          <button 
            onClick={() => {
              if (rulerTool) {
                setRulerTool(null);
              } else {
                setRulerTool({ x: 200, y: 200, angle: 0, length: 400 });
              }
            }} 
            className={`tool-btn ${rulerTool ? 'active' : ''}`} 
            title="Draggable Ruler Tool"
          >
            <Ruler size={20} />
          </button>
          <button 
            onClick={() => setSnapToGrid(!snapToGrid)} 
            className={`tool-btn ${snapToGrid ? 'active' : ''}`} 
            title="Snap to Grid"
            disabled={!showGrid}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M3 3h6v6H3zM15 3h6v6h-6zM3 15h6v6H3zM15 15h6v6h-6z"/>
            </svg>
          </button>
        </div>

        <div className="toolbar-section">
          {autoSaving ? (
            <span className="tool-btn" style={{ color: 'var(--warning)', cursor: 'default' }}>
              <Clock size={20} />
              <span>Saving...</span>
            </span>
          ) : lastSaved ? (
            <span className="tool-btn" style={{ color: 'var(--success)', cursor: 'default' }}>
              <Check size={20} />
              <span>Saved</span>
            </span>
          ) : null}
          <button onClick={() => handleSave(true)} className="tool-btn save-btn" title="Save and Close">
            <Save size={20} />
            <span>Save</span>
          </button>
          <button onClick={exportAsImage} className="tool-btn" title="Export as Image">
            <Download size={20} />
          </button>
        </div>
      </div>

      {/* Color & Stroke Picker */}
      <div className="canvas-properties">
        <div className="property-group">
          <label>{tool === 'sticky' ? 'Sticky Color:' : 'Color:'}</label>
          <div className="color-palette">
            {(tool === 'sticky' ? STICKY_COLORS : COLORS).map(c => (
              <button
                key={c}
                className={`color-btn ${color === c ? 'active' : ''}`}
                style={{ 
                  background: c, 
                  border: c === '#FFFFFF' ? '2px solid #666' : 'none',
                  boxShadow: tool === 'sticky' ? '0 2px 4px rgba(0,0,0,0.2)' : 'none'
                }}
                onClick={() => setColor(c)}
                title={c}
              />
            ))}
          </div>
        </div>
        <div className="property-group">
          <label>Stroke:</label>
          <div className="stroke-palette">
            {STROKE_WIDTHS.map(w => (
              <button
                key={w}
                className={`stroke-btn ${strokeWidth === w ? 'active' : ''}`}
                onClick={() => setStrokeWidth(w)}
                title={`${w}px`}
              >
                <div style={{ width: '100%', height: `${w}px`, background: 'var(--accent)' }} />
              </button>
            ))}
          </div>
        </div>
        <div className="property-group">
          <label>Opacity:</label>
          <input 
            type="range" 
            min="0" 
            max="1" 
            step="0.1" 
            value={opacity}
            onChange={(e) => setOpacity(parseFloat(e.target.value))}
            style={{ width: '100px' }}
            title={`${Math.round(opacity * 100)}%`}
          />
          <span style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: '700', minWidth: '40px' }}>
            {Math.round(opacity * 100)}%
          </span>
        </div>
      </div>

      {/* Fixed Rulers */}
      {showRuler && (
        <>
          {/* Horizontal Ruler */}
          <div className="horizontal-ruler">
            {Array.from({ length: 100 }, (_, i) => i * 100).map(x => {
              const screenX = x * zoom + pan.x;
              if (screenX < 0 || screenX > (containerRef.current?.clientWidth || 2000)) return null;
              return (
                <div key={`h-${x}`} className="ruler-mark" style={{ left: `${screenX}px` }}>
                  <div className={`ruler-tick ${x % 500 === 0 ? 'major' : 'minor'}`} />
                  {x % 500 === 0 && <span className="ruler-label">{x}</span>}
                </div>
              );
            })}
          </div>
          
          {/* Vertical Ruler */}
          <div className="vertical-ruler">
            {Array.from({ length: 100 }, (_, i) => i * 100).map(y => {
              const screenY = y * zoom + pan.y;
              if (screenY < 0 || screenY > (containerRef.current?.clientHeight || 2000)) return null;
              return (
                <div key={`v-${y}`} className="ruler-mark" style={{ top: `${screenY}px` }}>
                  <div className={`ruler-tick ${y % 500 === 0 ? 'major' : 'minor'}`} />
                  {y % 500 === 0 && <span className="ruler-label">{y}</span>}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Canvas Container */}
      <div 
        ref={containerRef}
        className={`canvas-container ${snapToGrid ? 'snap-active' : ''}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        style={{ cursor: tool === 'eraser' ? 'not-allowed' : tool === 'select' ? 'default' : 'crosshair' }}
      >
        <svg 
          className="canvas-svg"
          width="100000"
          height="100000"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0'
          }}
        >
          {/* Grid */}
          {showGrid && (
            <defs>
              <pattern id="grid" width={GRID_SIZE} height={GRID_SIZE} patternUnits="userSpaceOnUse">
                <path d={`M ${GRID_SIZE} 0 L 0 0 0 ${GRID_SIZE}`} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5"/>
              </pattern>
            </defs>
          )}
          {showGrid && <rect x="-10000" y="-10000" width="20000" height="20000" fill="url(#grid)" />}

          {/* Draggable Ruler Tool */}
          {rulerTool && (
            <g transform={`rotate(${(rulerTool.angle || 0) * 180 / Math.PI} ${rulerTool.x} ${rulerTool.y})`}>
              {/* Ruler snap zone (invisible but shows the snap area) */}
              <line
                x1={rulerTool.x}
                y1={rulerTool.y}
                x2={rulerTool.x + rulerTool.length}
                y2={rulerTool.y}
                stroke="#D7B38C"
                strokeWidth="40"
                strokeLinecap="round"
                opacity="0.1"
              />
              {/* Ruler body */}
              <line
                x1={rulerTool.x}
                y1={rulerTool.y}
                x2={rulerTool.x + rulerTool.length}
                y2={rulerTool.y}
                stroke="#D7B38C"
                strokeWidth="4"
                strokeLinecap="round"
              />
              {/* Measurement marks */}
              {Array.from({ length: Math.floor(rulerTool.length / 50) + 1 }, (_, i) => i * 50).map(offset => (
                <g key={offset}>
                  <line
                    x1={rulerTool.x + offset}
                    y1={rulerTool.y - (offset % 100 === 0 ? 15 : 8)}
                    x2={rulerTool.x + offset}
                    y2={rulerTool.y + (offset % 100 === 0 ? 15 : 8)}
                    stroke="#D7B38C"
                    strokeWidth="2"
                  />
                  {offset % 100 === 0 && (
                    <text
                      x={rulerTool.x + offset}
                      y={rulerTool.y - 20}
                      fill="#D7B38C"
                      fontSize="12"
                      fontFamily="Inter"
                      fontWeight="700"
                      textAnchor="middle"
                    >
                      {offset}
                    </text>
                  )}
                </g>
              ))}
              {/* Drag handles */}
              <circle
                cx={rulerTool.x}
                cy={rulerTool.y}
                r="10"
                fill="#D7B38C"
                stroke="#0f1012"
                strokeWidth="2"
                style={{ cursor: 'move' }}
              />
              <circle
                cx={rulerTool.x + rulerTool.length}
                cy={rulerTool.y}
                r="10"
                fill="#D7B38C"
                stroke="#0f1012"
                strokeWidth="2"
                style={{ cursor: 'ew-resize' }}
              />
              {/* Length label */}
              <text
                x={rulerTool.x + rulerTool.length / 2}
                y={rulerTool.y + 35}
                fill="#D7B38C"
                fontSize="14"
                fontFamily="Inter"
                fontWeight="700"
                textAnchor="middle"
              >
                {Math.round(rulerTool.length)}px
              </text>
            </g>
          )}

          {/* Render Elements */}
          {elements.map(el => {
            if (el.type === 'draw') {
              return (
                <polyline
                  key={el.id}
                  points={el.points.map(p => `${p.x},${p.y}`).join(' ')}
                  fill="none"
                  stroke={el.color}
                  strokeWidth={el.strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={selectedElement?.id === el.id ? 'selected' : ''}
                />
              );
            } else if (el.type === 'rectangle') {
              return (
                <rect
                  key={el.id}
                  x={el.x}
                  y={el.y}
                  width={el.width}
                  height={el.height}
                  fill="none"
                  stroke={el.color}
                  strokeWidth={el.strokeWidth}
                  className={selectedElement?.id === el.id ? 'selected' : ''}
                />
              );
            } else if (el.type === 'circle') {
              return (
                <circle
                  key={el.id}
                  cx={el.x}
                  cy={el.y}
                  r={el.radius}
                  fill="none"
                  stroke={el.color}
                  strokeWidth={el.strokeWidth}
                  className={selectedElement?.id === el.id ? 'selected' : ''}
                />
              );
            } else if (el.type === 'line') {
              return (
                <line
                  key={el.id}
                  x1={el.x1}
                  y1={el.y1}
                  x2={el.x2}
                  y2={el.y2}
                  stroke={el.color}
                  strokeWidth={el.strokeWidth}
                  strokeLinecap="round"
                  opacity={el.opacity || 1}
                  className={selectedElement?.id === el.id ? 'selected' : ''}
                />
              );
            } else if (el.type === 'arrow') {
              const angle = Math.atan2(el.y2 - el.y1, el.x2 - el.x1);
              const arrowLength = 15;
              return (
                <g key={el.id} className={selectedElement?.id === el.id ? 'selected' : ''}>
                  <line
                    x1={el.x1}
                    y1={el.y1}
                    x2={el.x2}
                    y2={el.y2}
                    stroke={el.color}
                    strokeWidth={el.strokeWidth}
                    strokeLinecap="round"
                    opacity={el.opacity || 1}
                  />
                  <polygon
                    points={`${el.x2},${el.y2} ${el.x2 - arrowLength * Math.cos(angle - Math.PI / 6)},${el.y2 - arrowLength * Math.sin(angle - Math.PI / 6)} ${el.x2 - arrowLength * Math.cos(angle + Math.PI / 6)},${el.y2 - arrowLength * Math.sin(angle + Math.PI / 6)}`}
                    fill={el.color}
                    opacity={el.opacity || 1}
                  />
                </g>
              );
            } else if (el.type === 'image') {
              return (
                <image
                  key={el.id}
                  x={el.x}
                  y={el.y}
                  width={el.width}
                  height={el.height}
                  href={el.src}
                  opacity={el.opacity || 1}
                  className={selectedElement?.id === el.id ? 'selected' : ''}
                  style={{ cursor: 'move' }}
                />
              );
            } else if (el.type === 'text') {
              return (
                <text
                  key={el.id}
                  x={el.x}
                  y={el.y}
                  fill={el.color}
                  fontSize={el.fontSize}
                  fontFamily="Inter"
                  className={selectedElement?.id === el.id ? 'selected' : ''}
                  style={{ cursor: 'text' }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setEditingText(el);
                  }}
                >
                  {el.text}
                </text>
              );
            } else if (el.type === 'sticky') {
              return (
                <g key={el.id} className={selectedElement?.id === el.id ? 'selected' : ''}>
                  {/* Shadow layers for depth */}
                  <rect
                    x={el.x + 3}
                    y={el.y + 3}
                    width={el.width}
                    height={el.height}
                    fill="rgba(0,0,0,0.15)"
                    rx="2"
                  />
                  <rect
                    x={el.x + 2}
                    y={el.y + 2}
                    width={el.width}
                    height={el.height}
                    fill="rgba(0,0,0,0.1)"
                    rx="2"
                  />
                  {/* Main sticky note body */}
                  <rect
                    x={el.x}
                    y={el.y}
                    width={el.width}
                    height={el.height}
                    fill={el.color}
                    stroke={`color-mix(in srgb, ${el.color} 70%, black)`}
                    strokeWidth="1"
                    rx="2"
                  />
                  {/* Top fold/tape effect */}
                  <rect
                    x={el.x}
                    y={el.y}
                    width={el.width}
                    height="20"
                    fill={`color-mix(in srgb, ${el.color} 85%, white)`}
                    opacity="0.6"
                    rx="2"
                  />
                  {/* Priority badge */}
                  {el.priority && el.priority !== 'normal' && (
                    <g>
                      <circle
                        cx={el.x + el.width - 15}
                        cy={el.y + 15}
                        r="8"
                        fill={el.priority === 'urgent' ? '#EF4444' : el.priority === 'important' ? '#F59E0B' : '#10B981'}
                        stroke="white"
                        strokeWidth="2"
                      />
                      <text
                        x={el.x + el.width - 15}
                        y={el.y + 19}
                        fill="white"
                        fontSize="10"
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        {el.priority === 'urgent' ? '!' : el.priority === 'important' ? '★' : '✓'}
                      </text>
                    </g>
                  )}
                  {/* Subtle lines for paper texture */}
                  <line
                    x1={el.x + 15}
                    y1={el.y + 40}
                    x2={el.x + el.width - 15}
                    y2={el.y + 40}
                    stroke="rgba(0,0,0,0.05)"
                    strokeWidth="1"
                  />
                  <line
                    x1={el.x + 15}
                    y1={el.y + 60}
                    x2={el.x + el.width - 15}
                    y2={el.y + 60}
                    stroke="rgba(0,0,0,0.05)"
                    strokeWidth="1"
                  />
                  <line
                    x1={el.x + 15}
                    y1={el.y + 80}
                    x2={el.x + el.width - 15}
                    y2={el.y + 80}
                    stroke="rgba(0,0,0,0.05)"
                    strokeWidth="1"
                  />
                  {/* Content */}
                  <foreignObject x={el.x} y={el.y} width={el.width} height={el.height}>
                    <div 
                      style={{
                        padding: '24px 16px 16px 16px',
                        fontSize: '14px',
                        fontWeight: '500',
                        color: '#2d2d2d',
                        wordWrap: 'break-word',
                        height: '100%',
                        overflow: 'auto',
                        cursor: 'text',
                        fontFamily: "'Indie Flower', 'Comic Sans MS', cursive",
                        lineHeight: '1.6',
                        textShadow: '0 1px 1px rgba(255,255,255,0.5)'
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setEditingText(el);
                      }}
                    >
                      {el.text}
                    </div>
                  </foreignObject>
                  {/* Corner curl effect */}
                  <path
                    d={`M ${el.x + el.width - 20} ${el.y + el.height} 
                        L ${el.x + el.width} ${el.y + el.height - 20} 
                        L ${el.x + el.width} ${el.y + el.height} Z`}
                    fill={`color-mix(in srgb, ${el.color} 60%, black)`}
                    opacity="0.3"
                  />
                </g>
              );
            }
            return null;
          })}

          {/* Current Drawing Path */}
          {drawing && tool === 'draw' && currentPath.length > 0 && (
            <polyline
              points={currentPath.map(p => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Preview shapes while drawing */}
          {drawing && dragStart && tool === 'rectangle' && (
            <rect
              x={Math.min(dragStart.x, (currentPath[currentPath.length - 1] || dragStart).x)}
              y={Math.min(dragStart.y, (currentPath[currentPath.length - 1] || dragStart).y)}
              width={Math.abs((currentPath[currentPath.length - 1] || dragStart).x - dragStart.x)}
              height={Math.abs((currentPath[currentPath.length - 1] || dragStart).y - dragStart.y)}
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth}
              opacity="0.5"
            />
          )}
        </svg>
      </div>

      {/* Text Editing Modal */}
      {editingText && (
        <div className="text-edit-modal">
          <div className="text-edit-content">
            <h3>Edit {editingText.type === 'sticky' ? 'Sticky Note' : 'Text'}</h3>
            <textarea
              value={editingText.text}
              onChange={(e) => setEditingText({ ...editingText, text: e.target.value })}
              rows={editingText.type === 'sticky' ? 6 : 3}
              autoFocus
            />
            <div className="text-edit-actions">
              <button onClick={() => {
                updateText(editingText.id, editingText.text);
                setEditingText(null);
              }} className="btn-save">
                Save
              </button>
              <button onClick={() => setEditingText(null)} className="btn-cancel">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Minimap */}
      {showMinimap && (
        <div className="minimap">
          <div className="minimap-header">
            <span>Overview</span>
            <button onClick={() => setShowMinimap(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <X size={14} />
            </button>
          </div>
          <svg width="150" height="150" style={{ background: 'var(--bg-bottom)', border: '1px solid var(--border)' }}>
            {elements.map(el => {
              const scale = 0.05;
              if (el.type === 'rectangle') {
                return <rect key={el.id} x={el.x * scale} y={el.y * scale} width={el.width * scale} height={el.height * scale} fill={el.color} opacity="0.5" />;
              } else if (el.type === 'circle') {
                return <circle key={el.id} cx={el.x * scale} cy={el.y * scale} r={el.radius * scale} fill={el.color} opacity="0.5" />;
              } else if (el.type === 'sticky') {
                return <rect key={el.id} x={el.x * scale} y={el.y * scale} width={el.width * scale} height={el.height * scale} fill={el.color} opacity="0.7" />;
              }
              return null;
            })}
            {/* Viewport indicator */}
            <rect
              x={-pan.x * zoom * 0.05}
              y={-pan.y * zoom * 0.05}
              width={150 / zoom}
              height={150 / zoom}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="2"
              opacity="0.5"
            />
          </svg>
        </div>
      )}

      {/* Keyboard Shortcuts Panel */}
      {showShortcuts && (
        <div className="shortcuts-overlay" onClick={() => setShowShortcuts(false)}>
          <div className="shortcuts-panel" onClick={(e) => e.stopPropagation()}>
            <div className="shortcuts-header">
              <h3>Keyboard Shortcuts</h3>
              <button onClick={() => setShowShortcuts(false)} className="close-shortcuts">
                <X size={20} />
              </button>
            </div>
            <div className="shortcuts-grid">
              <div className="shortcut-section">
                <h4>Tools</h4>
                <div className="shortcut-item"><kbd>V</kbd> Select</div>
                <div className="shortcut-item"><kbd>D</kbd> Draw</div>
                <div className="shortcut-item"><kbd>E</kbd> Eraser</div>
                <div className="shortcut-item"><kbd>R</kbd> Rectangle</div>
                <div className="shortcut-item"><kbd>C</kbd> Circle</div>
                <div className="shortcut-item"><kbd>L</kbd> Line</div>
                <div className="shortcut-item"><kbd>A</kbd> Arrow</div>
                <div className="shortcut-item"><kbd>T</kbd> Text</div>
                <div className="shortcut-item"><kbd>S</kbd> Sticky Note</div>
                <div className="shortcut-item"><kbd>I</kbd> Upload Image</div>
              </div>
              <div className="shortcut-section">
                <h4>View</h4>
                <div className="shortcut-item"><kbd>G</kbd> Toggle Grid</div>
                <div className="shortcut-item"><kbd>H</kbd> Toggle Rulers</div>
                <div className="shortcut-item"><kbd>M</kbd> Toggle Minimap</div>
                <div className="shortcut-item"><kbd>+</kbd> Zoom In</div>
                <div className="shortcut-item"><kbd>-</kbd> Zoom Out</div>
                <div className="shortcut-item"><kbd>0</kbd> Reset Zoom (100%)</div>
                <div className="shortcut-item"><kbd>1</kbd> Zoom to 50%</div>
                <div className="shortcut-item"><kbd>2</kbd> Zoom to 200%</div>
              </div>
              <div className="shortcut-section">
                <h4>Edit</h4>
                <div className="shortcut-item"><kbd>{navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}</kbd> + <kbd>C</kbd> Copy</div>
                <div className="shortcut-item"><kbd>{navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}</kbd> + <kbd>V</kbd> Paste</div>
                <div className="shortcut-item"><kbd>{navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}</kbd> + <kbd>D</kbd> Duplicate</div>
                <div className="shortcut-item"><kbd>{navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}</kbd> + <kbd>A</kbd> Select All</div>
                <div className="shortcut-item"><kbd>{navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}</kbd> + <kbd>Z</kbd> Undo</div>
                <div className="shortcut-item"><kbd>{navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}</kbd> + <kbd>Y</kbd> Redo</div>
                <div className="shortcut-item"><kbd>Del</kbd> Delete</div>
              </div>
              <div className="shortcut-section">
                <h4>Help</h4>
                <div className="shortcut-item"><kbd>?</kbd> Show Shortcuts</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Help Button */}
      <button 
        className="floating-help-btn" 
        onClick={() => setShowShortcuts(true)}
        title="Keyboard Shortcuts (?)"
      >
        <Command size={20} />
      </button>
    </div>
  );
};

export default CanvasMode;

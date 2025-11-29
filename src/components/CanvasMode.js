import React, { useState, useRef } from 'react';
import {
  Square, Circle, Type, Minus, Trash2,
  Move, ZoomIn, ZoomOut, Download, Undo, Redo, Palette, X
} from 'lucide-react';
import './CanvasMode.css';

const CanvasMode = ({ onClose }) => {
  const containerRef = useRef(null);
  const [tool, setTool] = useState('select');
  const [elements, setElements] = useState([]);
  const [selectedElement, setSelectedElement] = useState(null);
  const [drawing, setDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState([]);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState(null);
  const [color, setColor] = useState('#D7B38C');
  const [history, setHistory] = useState([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const COLORS = ['#D7B38C', '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE'];

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
    return {
      x: (e.clientX - rect.left - pan.x) / zoom,
      y: (e.clientY - rect.top - pan.y) / zoom
    };
  };

  const handleMouseDown = (e) => {
    const pos = getMousePos(e);

    if (tool === 'select') {
      const clicked = elements.find(el => isPointInElement(pos.x, pos.y, el));
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
    } else if (tool === 'text') {
      const newElement = {
        id: Date.now(),
        type: 'text',
        x: pos.x,
        y: pos.y,
        text: 'Double click to edit',
        color,
        fontSize: 16
      };
      const newElements = [...elements, newElement];
      setElements(newElements);
      addToHistory(newElements);
    } else if (tool === 'sticky') {
      const newElement = {
        id: Date.now(),
        type: 'sticky',
        x: pos.x,
        y: pos.y,
        width: 200,
        height: 150,
        text: 'New sticky note',
        color
      };
      const newElements = [...elements, newElement];
      setElements(newElements);
      addToHistory(newElements);
    } else if (tool === 'shape') {
      const newElement = {
        id: Date.now(),
        type: 'rectangle',
        x: pos.x,
        y: pos.y,
        width: 150,
        height: 100,
        color
      };
      const newElements = [...elements, newElement];
      setElements(newElements);
      addToHistory(newElements);
    }
  };

  const handleMouseMove = (e) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
    } else if (drawing) {
      const pos = getMousePos(e);
      setCurrentPath([...currentPath, pos]);
    } else if (selectedElement && dragStart && tool === 'select') {
      const pos = getMousePos(e);
      const newElements = elements.map(el =>
        el.id === selectedElement.id
          ? { ...el, x: pos.x - dragStart.x, y: pos.y - dragStart.y }
          : el
      );
      setElements(newElements);
    }
  };

  const handleMouseUp = () => {
    if (drawing && currentPath.length > 1) {
      const newElement = {
        id: Date.now(),
        type: 'path',
        path: currentPath,
        color
      };
      const newElements = [...elements, newElement];
      setElements(newElements);
      addToHistory(newElements);
      setCurrentPath([]);
    }
    if (selectedElement && dragStart) {
      addToHistory(elements);
    }
    setDrawing(false);
    setIsPanning(false);
    setDragStart(null);
  };

  const isPointInElement = (x, y, element) => {
    if (element.type === 'sticky' || element.type === 'rectangle') {
      return x >= element.x && x <= element.x + element.width &&
             y >= element.y && y <= element.y + element.height;
    }
    if (element.type === 'text') {
      return x >= element.x && x <= element.x + 200 &&
             y >= element.y - 20 && y <= element.y + 20;
    }
    return false;
  };

  const deleteSelected = () => {
    if (selectedElement) {
      const newElements = elements.filter(el => el.id !== selectedElement.id);
      setElements(newElements);
      addToHistory(newElements);
      setSelectedElement(null);
    }
  };

  const handleEditElement = (element) => {
    const newText = prompt('Edit text:', element.text);
    if (newText !== null) {
      const newElements = elements.map(el =>
        el.id === element.id ? { ...el, text: newText } : el
      );
      setElements(newElements);
      addToHistory(newElements);
    }
  };

  return (
    <div className="canvas-mode">
      <div className="canvas-toolbar">
        <div className="toolbar-section">
          <button
            className={`tool-btn ${tool === 'select' ? 'active' : ''}`}
            onClick={() => setTool('select')}
            title="Select & Move"
          >
            <Move size={18} />
          </button>
          <button
            className={`tool-btn ${tool === 'draw' ? 'active' : ''}`}
            onClick={() => setTool('draw')}
            title="Draw"
          >
            <Minus size={18} />
          </button>
          <button
            className={`tool-btn ${tool === 'text' ? 'active' : ''}`}
            onClick={() => setTool('text')}
            title="Add Text"
          >
            <Type size={18} />
          </button>
          <button
            className={`tool-btn ${tool === 'sticky' ? 'active' : ''}`}
            onClick={() => setTool('sticky')}
            title="Sticky Note"
          >
            <Square size={18} />
          </button>
          <button
            className={`tool-btn ${tool === 'shape' ? 'active' : ''}`}
            onClick={() => setTool('shape')}
            title="Add Shape"
          >
            <Circle size={18} />
          </button>
        </div>

        <div className="toolbar-divider" />

        <div className="toolbar-section">
          <Palette size={16} style={{ color: 'var(--text-secondary)' }} />
          {COLORS.map(c => (
            <button
              key={c}
              className={`color-btn ${color === c ? 'active' : ''}`}
              style={{ backgroundColor: c }}
              onClick={() => setColor(c)}
              title={c}
            />
          ))}
        </div>

        <div className="toolbar-divider" />

        <div className="toolbar-section">
          <button className="tool-btn" onClick={undo} disabled={historyIndex <= 0} title="Undo">
            <Undo size={18} />
          </button>
          <button className="tool-btn" onClick={redo} disabled={historyIndex >= history.length - 1} title="Redo">
            <Redo size={18} />
          </button>
          <button className="tool-btn" onClick={deleteSelected} disabled={!selectedElement} title="Delete Selected">
            <Trash2 size={18} />
          </button>
        </div>

        <div className="toolbar-divider" />

        <div className="toolbar-section">
          <button className="tool-btn" onClick={() => setZoom(Math.min(3, zoom + 0.2))} title="Zoom In">
            <ZoomIn size={18} />
          </button>
          <span className="zoom-level">{Math.round(zoom * 100)}%</span>
          <button className="tool-btn" onClick={() => setZoom(Math.max(0.5, zoom - 0.2))} title="Zoom Out">
            <ZoomOut size={18} />
          </button>
          <button className="tool-btn" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} title="Reset View">
            Reset
          </button>
        </div>

        <div className="toolbar-divider" />

        <div className="toolbar-section">
          <button className="close-btn" onClick={onClose}>
            <X size={16} style={{ marginRight: '6px' }} />
            Close Canvas
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="canvas-area"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          cursor: tool === 'select' ? (isPanning ? 'grabbing' : 'grab') : 
                  tool === 'draw' ? 'crosshair' : 'pointer'
        }}
      >
        <svg
          width="100%"
          height="100%"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            pointerEvents: 'none'
          }}
        >
          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {elements.map(element => {
              if (element.type === 'path') {
                const pathData = element.path.map((p, i) =>
                  i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`
                ).join(' ');
                return (
                  <path
                    key={element.id}
                    d={pathData}
                    stroke={element.color}
                    strokeWidth={3 / zoom}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                );
              }
              if (element.type === 'rectangle') {
                return (
                  <rect
                    key={element.id}
                    x={element.x}
                    y={element.y}
                    width={element.width}
                    height={element.height}
                    fill="none"
                    stroke={element.color}
                    strokeWidth={2 / zoom}
                    rx="8"
                  />
                );
              }
              return null;
            })}

            {drawing && currentPath.length > 1 && (
              <path
                d={currentPath.map((p, i) =>
                  i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`
                ).join(' ')}
                stroke={color}
                strokeWidth={3 / zoom}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </g>
        </svg>

        <div
          className="html-layer"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0'
          }}
        >
          {elements.map(element => {
            if (element.type === 'sticky') {
              return (
                <div
                  key={element.id}
                  className={`sticky-note ${selectedElement?.id === element.id ? 'selected' : ''}`}
                  style={{
                    position: 'absolute',
                    left: `${element.x}px`,
                    top: `${element.y}px`,
                    width: `${element.width}px`,
                    height: `${element.height}px`,
                    backgroundColor: element.color
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    handleEditElement(element);
                  }}
                >
                  {element.text}
                </div>
              );
            }
            if (element.type === 'text') {
              return (
                <div
                  key={element.id}
                  className={`canvas-text ${selectedElement?.id === element.id ? 'selected' : ''}`}
                  style={{
                    position: 'absolute',
                    left: `${element.x}px`,
                    top: `${element.y}px`,
                    color: element.color,
                    fontSize: `${element.fontSize}px`
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    handleEditElement(element);
                  }}
                >
                  {element.text}
                </div>
              );
            }
            return null;
          })}
        </div>
      </div>

      <div className="canvas-help">
        <div className="help-item">
          <strong>Select:</strong> Click elements to select, drag to move, click empty space to pan
        </div>
        <div className="help-item">
          <strong>Draw:</strong> Click and drag to draw freehand
        </div>
        <div className="help-item">
          <strong>Double-click:</strong> Edit text on sticky notes and text elements
        </div>
      </div>
    </div>
  );
};

export default CanvasMode;

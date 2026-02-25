import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Square, Circle, Type, Minus, Trash2, Move, ZoomIn, ZoomOut, 
  Download, Undo, Redo, Palette, X, ArrowLeft, StickyNote,
  Image as ImageIcon, Pen, Eraser, MousePointer, Save, Grid, Ruler,
  Check, Clock, Command, ArrowRight, Lock, Unlock, Eye, Map
} from 'lucide-react';
import './CanvasMode.css';

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

const pathLength = (points) => points.reduce((sum, p, i) => {
  if (i === 0) return 0;
  return sum + distance(p, points[i - 1]);
}, 0);

const pointToLineDistance = (p, a, b) => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return distance(p, a);
  const numerator = Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x);
  return numerator / length;
};

const getBoundingBox = (points) => {
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = maxX - minX;
  const height = maxY - minY;
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const size = Math.max(width, height);
  return { minX, maxX, minY, maxY, width, height, centerX, centerY, size };
};

const simplifyPath = (points, tolerance) => {
  if (points.length <= 2) return points;
  const sqTolerance = tolerance * tolerance;
  const markers = new Uint8Array(points.length);
  markers[0] = 1;
  markers[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];

  const getSqSegDist = (p, p1, p2) => {
    let x = p1.x;
    let y = p1.y;
    let dx = p2.x - x;
    let dy = p2.y - y;

    if (dx !== 0 || dy !== 0) {
      const t = ((p.x - x) * dx + (p.y - y) * dy) / (dx * dx + dy * dy);
      if (t > 1) {
        x = p2.x;
        y = p2.y;
      } else if (t > 0) {
        x += dx * t;
        y += dy * t;
      }
    }

    dx = p.x - x;
    dy = p.y - y;
    return dx * dx + dy * dy;
  };

  while (stack.length) {
    const [first, last] = stack.pop();
    let maxSqDist = 0;
    let index = 0;

    for (let i = first + 1; i < last; i++) {
      const sqDist = getSqSegDist(points[i], points[first], points[last]);
      if (sqDist > maxSqDist) {
        index = i;
        maxSqDist = sqDist;
      }
    }

    if (maxSqDist > sqTolerance) {
      markers[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }

  return points.filter((_, i) => markers[i]);
};

const recognizeShape = (points) => {
  if (points.length < 8) return null;

  const totalDistance = pathLength(points);
  const { minX, maxX, minY, maxY, width, height, centerX, centerY, size } = getBoundingBox(points);

  if (totalDistance < 60 || size < 12) return null;

  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  const directDistance = distance(firstPoint, lastPoint);
  const straightness = directDistance / totalDistance;
  const maxDeviation = points.reduce((max, p) => Math.max(max, pointToLineDistance(p, firstPoint, lastPoint)), 0);

  if (straightness > 0.92 && maxDeviation < Math.max(4, size * 0.03)) {
    return {
      type: 'line',
      x1: firstPoint.x,
      y1: firstPoint.y,
      x2: lastPoint.x,
      y2: lastPoint.y
    };
  }

  const closingDistance = distance(firstPoint, lastPoint);
  const isClosed = closingDistance < Math.max(12, size * 0.1);
  if (!isClosed || size < 24) return null;

  const simplified = simplifyPath(points, Math.max(2, size * 0.02));
  const aspectRatio = Math.min(width, height) / Math.max(width, height);

  const radii = simplified.map(p => Math.hypot(p.x - centerX, p.y - centerY));
  const avgRadius = radii.reduce((sum, r) => sum + r, 0) / radii.length;
  const radiusVariance = radii.reduce((sum, r) => sum + Math.abs(r - avgRadius), 0) / radii.length;
  const circularityScore = 1 - (radiusVariance / (avgRadius || 1));

  if (circularityScore > 0.82 && aspectRatio > 0.78) {
    return {
      type: 'circle',
      x: centerX,
      y: centerY,
      radius: avgRadius
    };
  }

  const rx = width / 2 || 1;
  const ry = height / 2 || 1;
  const ellipseError = simplified.reduce((sum, p) => {
    const dx = (p.x - centerX) / rx;
    const dy = (p.y - centerY) / ry;
    const norm = (dx * dx) + (dy * dy);
    return sum + Math.abs(1 - norm);
  }, 0) / simplified.length;

  const edgeTolerance = Math.max(6, size * 0.05);
  const edgeHits = simplified.filter(p => {
    const dx = Math.min(Math.abs(p.x - minX), Math.abs(p.x - maxX));
    const dy = Math.min(Math.abs(p.y - minY), Math.abs(p.y - maxY));
    return Math.min(dx, dy) < edgeTolerance;
  });
  const edgeRatio = edgeHits.length / simplified.length;

  if (ellipseError < 0.32 && aspectRatio > 0.35) {
    return {
      type: 'ellipse',
      x: centerX,
      y: centerY,
      rx: Math.max(8, rx),
      ry: Math.max(8, ry)
    };
  }

  if (edgeRatio > 0.72 || aspectRatio < 0.35) {
    return {
      type: 'rectangle',
      x: minX,
      y: minY,
      width,
      height
    };
  }

  return null;
};

const smoothPath = (points) => {
  if (points.length < 4) return points;
  
  const smoothed = [points[0]];
  
  for (let i = 0; i < points.length - 3; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const p2 = points[i + 2];
    const p3 = points[i + 3];
    
    
    for (let t = 0; t < 1; t += 0.25) {
      const t2 = t * t;
      const t3 = t2 * t;
      
      const x = 0.5 * (
        (2 * p1.x) +
        (-p0.x + p2.x) * t +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3
      );
      
      const y = 0.5 * (
        (2 * p1.y) +
        (-p0.y + p2.y) * t +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3
      );
      
      smoothed.push({ x, y });
    }
  }
  
  smoothed.push(points[points.length - 1]);
  return smoothed;
};

const getElementBounds = (el) => {
  if (el.type === 'rectangle' || el.type === 'sticky' || el.type === 'table' || el.type === 'image') {
    return { x: el.x, y: el.y, width: el.width || 0, height: el.height || 0 };
  }
  if (el.type === 'circle') {
    const radius = el.radius || 0;
    return { x: el.x - radius, y: el.y - radius, width: radius * 2, height: radius * 2 };
  }
  if (el.type === 'ellipse') {
    const rx = el.rx || 0;
    const ry = el.ry || 0;
    return { x: el.x - rx, y: el.y - ry, width: rx * 2, height: ry * 2 };
  }
  if (el.type === 'line' || el.type === 'arrow') {
    const minX = Math.min(el.x1, el.x2);
    const maxX = Math.max(el.x1, el.x2);
    const minY = Math.min(el.y1, el.y2);
    const maxY = Math.max(el.y1, el.y2);
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }
  if (el.type === 'draw') {
    const xs = el.points.map(p => p.x);
    const ys = el.points.map(p => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }
  if (el.type === 'text') {
    return { x: el.x, y: el.y - 20, width: 220, height: 32 };
  }
  return { x: 0, y: 0, width: 0, height: 0 };
};

const translateElement = (el, dx, dy) => {
  if (el.type === 'rectangle' || el.type === 'sticky' || el.type === 'table' || el.type === 'image' || el.type === 'text') {
    return { ...el, x: el.x + dx, y: el.y + dy };
  }
  if (el.type === 'circle' || el.type === 'ellipse') {
    return { ...el, x: el.x + dx, y: el.y + dy };
  }
  if (el.type === 'line' || el.type === 'arrow') {
    return { ...el, x1: el.x1 + dx, y1: el.y1 + dy, x2: el.x2 + dx, y2: el.y2 + dy };
  }
  if (el.type === 'draw') {
    return { ...el, points: el.points.map(p => ({ x: p.x + dx, y: p.y + dy })) };
  }
  return el;
};

const getElementsBounds = (items) => {
  if (!items || items.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  const bounds = items.map(getElementBounds);
  const minX = Math.min(...bounds.map(b => b.x));
  const minY = Math.min(...bounds.map(b => b.y));
  const maxX = Math.max(...bounds.map(b => b.x + b.width));
  const maxY = Math.max(...bounds.map(b => b.y + b.height));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
};

const CanvasMode = ({ initialContent, onClose, onSave }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const elementsRef = useRef([]);
  const selectedElementRef = useRef(null);
  const selectedElementsRef = useRef([]);
  const selectedIdsRef = useRef(new Set());
  const currentPathRef = useRef([]);
  const pendingStateRef = useRef({});
  const rafRef = useRef(null);
  const lastSerializedRef = useRef('');
  const hydratedRef = useRef(false);
  const eraseDirtyRef = useRef(false);
  const selectionStartRef = useRef(null);
  const selectionAdditiveRef = useRef(false);
  const selectionBaseRef = useRef(new Set());
  const dragSelectionRef = useRef(null);
  
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
  const [color, setColor] = useState('#111827');
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [history, setHistory] = useState([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [showGrid, setShowGrid] = useState(false);
  const [showRuler, setShowRuler] = useState(false);
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [editingText, setEditingText] = useState(null);
  const [rulerTool, setRulerTool] = useState(null); 
  const [draggingRuler, setDraggingRuler] = useState(null); 
  const [rulerDragStart, setRulerDragStart] = useState(null);
  const [autoSaving, setAutoSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const autoSaveTimeout = useRef(null);
  const [selectedElements, setSelectedElements] = useState([]); 
  const [selectionBox, setSelectionBox] = useState(null);
  const [copiedElements, setCopiedElements] = useState([]);
  const [fillColor, setFillColor] = useState('transparent');
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [opacity, setOpacity] = useState(1);
  const [drawStyle, setDrawStyle] = useState('pen');
  const [backgroundPattern, setBackgroundPattern] = useState('dots');
  const [showMinimap, setShowMinimap] = useState(false);
  const [resizing, setResizing] = useState(null); 
  const [rotating, setRotating] = useState(null); 
  const [previewShape, setPreviewShape] = useState(null); 
  const [shapeRecognition, setShapeRecognition] = useState(true); 
  const [smoothDrawing, setSmoothDrawing] = useState(true); 
  const [showTableCreator, setShowTableCreator] = useState(false);
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);
  const fileInputRef = useRef(null);
  const GRID_SIZE = 20;
  const MIN_POINT_DISTANCE = 1.5;

  const COLORS = [
    '#111827', '#374151', '#1D4ED8', '#0EA5E9',
    '#14B8A6', '#16A34A', '#FDE68A', '#F59E0B',
    '#F97316', '#EF4444', '#A855F7', '#94A3B8'
  ];

  const STICKY_COLORS = [
    '#FFF59D', 
    '#FFE082', 
    '#FFCCBC', 
    '#F8BBD0', 
    '#E1BEE7', 
    '#C5CAE9', 
    '#B2DFDB', 
    '#C8E6C9', 
    '#FFE0B2', 
    '#D7CCC8', 
  ];

  const STROKE_WIDTHS = [1, 2, 4, 6, 8, 12];
  const serializeElements = (items) => JSON.stringify({ canvasElements: items });
  const isLightColor = (hex) => {
    if (!hex || hex[0] !== '#' || hex.length !== 7) return false;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return luminance > 0.78;
  };
  const selectedIdSet = useMemo(() => new Set(selectedElements.map(el => el.id)), [selectedElements]);

  const getElementsByIds = (idsSet) => elementsRef.current.filter(el => idsSet.has(el.id));

  const updateSelection = (idsSet) => {
    const selection = getElementsByIds(idsSet);
    selectedIdsRef.current = new Set(selection.map(el => el.id));
    selectedElementsRef.current = selection;
    setSelectedElements(selection);
    if (selection.length === 1) {
      setSelectedElement(selection[0]);
      selectedElementRef.current = selection[0];
    } else {
      setSelectedElement(null);
      selectedElementRef.current = null;
    }
  };

  const clearSelection = () => {
    selectedIdsRef.current = new Set();
    selectedElementsRef.current = [];
    setSelectedElements([]);
    setSelectedElement(null);
    selectedElementRef.current = null;
  };

  const applyDrawStyle = (style) => {
    setDrawStyle(style);
    if (style === 'pen') {
      setStrokeWidth(2);
      setOpacity(1);
    } else if (style === 'marker') {
      setStrokeWidth(6);
      setOpacity(0.7);
    } else if (style === 'highlighter') {
      setStrokeWidth(14);
      setOpacity(0.35);
    }
  };

  const scheduleStateUpdate = (updates) => {
    pendingStateRef.current = { ...pendingStateRef.current, ...updates };
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const pending = pendingStateRef.current;
      pendingStateRef.current = {};
      if (Object.prototype.hasOwnProperty.call(pending, 'elements')) {
        setElements(pending.elements);
      }
      if (Object.prototype.hasOwnProperty.call(pending, 'currentPath')) {
        setCurrentPath(pending.currentPath);
      }
      if (Object.prototype.hasOwnProperty.call(pending, 'previewShape')) {
        setPreviewShape(pending.previewShape);
      }
      if (Object.prototype.hasOwnProperty.call(pending, 'selectedElement')) {
        setSelectedElement(pending.selectedElement);
      }
    });
  };

  const commitElements = (newElements, { addHistory = false } = {}) => {
    elementsRef.current = newElements;
    scheduleStateUpdate({ elements: newElements });
    if (addHistory) addToHistory(newElements);
  };

  
  useEffect(() => {
    let parsedElements = [];
    if (initialContent) {
      try {
        const parsed = JSON.parse(initialContent);
        if (Array.isArray(parsed.canvasElements)) {
          parsedElements = parsed.canvasElements;
        }
      } catch (e) {
              }
    }
    setElements(parsedElements);
    elementsRef.current = parsedElements;
    setHistory([[...parsedElements]]);
    setHistoryIndex(0);
    lastSerializedRef.current = serializeElements(parsedElements);
    hydratedRef.current = true;
  }, [initialContent]);

  useEffect(() => {
    elementsRef.current = elements;
  }, [elements]);

  useEffect(() => {
    if (selectedIdsRef.current.size === 0) return;
    const validIds = new Set(elements.map(el => el.id));
    const filtered = new Set([...selectedIdsRef.current].filter(id => validIds.has(id)));
    if (filtered.size !== selectedIdsRef.current.size) {
      updateSelection(filtered);
    }
  }, [elements]);

  useEffect(() => {
    selectedElementRef.current = selectedElement;
  }, [selectedElement]);

  useEffect(() => {
    selectedElementsRef.current = selectedElements;
  }, [selectedElements]);

  useEffect(() => {
    currentPathRef.current = currentPath;
  }, [currentPath]);

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  
  const copySelected = () => {
    if (selectedIdsRef.current.size > 0) {
      setCopiedElements(getElementsByIds(selectedIdsRef.current).map(el => ({ ...el })));
    } else if (selectedElementRef.current) {
      setCopiedElements([{ ...selectedElementRef.current }]);
    }
  };

  const pasteElements = () => {
    if (copiedElements.length > 0) {
      const baseElements = elementsRef.current;
      const newElements = copiedElements.map(el => ({
        ...el,
        id: Date.now() + Math.random(),
        x: el.x + 20,
        y: el.y + 20
      }));
      commitElements([...baseElements, ...newElements], { addHistory: true });
      updateSelection(new Set(newElements.map(el => el.id)));
    }
  };

  const duplicateSelected = () => {
    copySelected();
    setTimeout(() => pasteElements(), 10);
  };

  
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (editingText) return; 
      
      if (e.key === 'v' || e.key === 'V') setTool('select');
      else if (e.key === 'p' || e.key === 'P') setTool('pan');
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
          updateSelection(new Set(elementsRef.current.map(el => el.id)));
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
      commitElements([...history[newIndex]]);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      commitElements([...history[newIndex]]);
    }
  };

  const getMousePos = (e) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    let x = (e.clientX - rect.left - pan.x) / zoom;
    let y = (e.clientY - rect.top - pan.y) / zoom;
    
    
    if (rulerTool && (drawing || tool === 'draw' || tool === 'line')) {
      const angle = rulerTool.angle || 0;
      
      
      const dx = x - rulerTool.x;
      const dy = y - rulerTool.y;
      const rotatedX = dx * Math.cos(-angle) - dy * Math.sin(-angle);
      const rotatedY = dx * Math.sin(-angle) + dy * Math.cos(-angle);
      
      
      if (Math.abs(rotatedY) < 20 && rotatedX >= -10 && rotatedX <= rulerTool.length + 10) {
        
        const snappedRotatedY = 0;
        
        
        const snappedDx = rotatedX * Math.cos(angle) - snappedRotatedY * Math.sin(angle);
        const snappedDy = rotatedX * Math.sin(angle) + snappedRotatedY * Math.cos(angle);
        
        x = rulerTool.x + snappedDx;
        y = rulerTool.y + snappedDy;
      }
    }
    
    else if (snapToGrid && showGrid) {
      x = Math.round(x / GRID_SIZE) * GRID_SIZE;
      y = Math.round(y / GRID_SIZE) * GRID_SIZE;
    }
    
    return { x, y };
  };

  const isPointInElement = (x, y, element) => {
    if (element.type === 'rectangle' || element.type === 'sticky' || element.type === 'table') {
      return x >= element.x && x <= element.x + (element.width || 0) &&
             y >= element.y && y <= element.y + (element.height || 0);
    } else if (element.type === 'circle' || element.type === 'ellipse') {
      const dx = x - element.x;
      const dy = y - element.y;
      if (element.type === 'ellipse') {
        const rx = element.rx || 0;
        const ry = element.ry || 0;
        if (rx === 0 || ry === 0) return false;
        return (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1;
      }
      return Math.sqrt(dx * dx + dy * dy) <= (element.radius || 0);
    } else if (element.type === 'text') {
      return x >= element.x && x <= element.x + 200 &&
             y >= element.y - 20 && y <= element.y + 20;
    } else if (element.type === 'draw') {
      return element.points.some(point => {
        const dx = x - point.x;
        const dy = y - point.y;
        return Math.sqrt(dx * dx + dy * dy) <= 10;
      });
    } else if (element.type === 'line' || element.type === 'arrow') {
      
      const dx = element.x2 - element.x1;
      const dy = element.y2 - element.y1;
      const length = Math.sqrt(dx * dx + dy * dy);
      const dot = ((x - element.x1) * dx + (y - element.y1) * dy) / (length * length);
      if (dot < 0 || dot > 1) return false;
      const closestX = element.x1 + dot * dx;
      const closestY = element.y1 + dot * dy;
      const distance = Math.sqrt(Math.pow(x - closestX, 2) + Math.pow(y - closestY, 2));
      return distance <= 10;
    }
    return false;
  };

  const getResizeHandle = (x, y, element) => {
    if (!element || (element.type !== 'rectangle' && element.type !== 'sticky' && element.type !== 'circle' && element.type !== 'ellipse' && element.type !== 'table')) return null;
    
    const handleSize = 8;
    
    if (element.type === 'circle' || element.type === 'ellipse') {
      
      const radiusX = element.type === 'ellipse' ? (element.rx || 0) : (element.radius || 0);
      const radiusY = element.type === 'ellipse' ? (element.ry || 0) : (element.radius || 0);
      if (Math.abs(x - (element.x + radiusX)) < handleSize && Math.abs(y - element.y) < handleSize) return 'e';
      if (Math.abs(x - (element.x - radiusX)) < handleSize && Math.abs(y - element.y) < handleSize) return 'w';
      if (Math.abs(x - element.x) < handleSize && Math.abs(y - (element.y + radiusY)) < handleSize) return 's';
      if (Math.abs(x - element.x) < handleSize && Math.abs(y - (element.y - radiusY)) < handleSize) return 'n';
      return null;
    }
    
    const width = element.width || 0;
    const height = element.height || 0;
    const right = element.x + width;
    const bottom = element.y + height;
    
    
    if (Math.abs(x - right) < handleSize && Math.abs(y - bottom) < handleSize) return 'se';
    if (Math.abs(x - element.x) < handleSize && Math.abs(y - bottom) < handleSize) return 'sw';
    if (Math.abs(x - right) < handleSize && Math.abs(y - element.y) < handleSize) return 'ne';
    if (Math.abs(x - element.x) < handleSize && Math.abs(y - element.y) < handleSize) return 'nw';
    
    
    if (Math.abs(x - right) < handleSize && y > element.y + handleSize && y < bottom - handleSize) return 'e';
    if (Math.abs(x - element.x) < handleSize && y > element.y + handleSize && y < bottom - handleSize) return 'w';
    if (Math.abs(y - bottom) < handleSize && x > element.x + handleSize && x < right - handleSize) return 's';
    if (Math.abs(y - element.y) < handleSize && x > element.x + handleSize && x < right - handleSize) return 'n';
    
    return null;
  };

  const handleMouseDown = (e) => {
    const pos = getMousePos(e);
    const liveElements = elementsRef.current;

    
    if (rulerTool && tool === 'select') {
      const startDist = Math.sqrt(Math.pow(pos.x - rulerTool.x, 2) + Math.pow(pos.y - rulerTool.y, 2));
      const endDist = Math.sqrt(Math.pow(pos.x - (rulerTool.x + rulerTool.length), 2) + Math.pow(pos.y - rulerTool.y, 2));
      
      
      if (startDist < 15) {
        setDraggingRuler('start');
        setRulerDragStart(pos);
        return;
      }
      
      if (endDist < 15) {
        setDraggingRuler('end');
        setRulerDragStart(pos);
        return;
      }
      
      const distToLine = Math.abs((pos.y - rulerTool.y));
      if (distToLine < 10 && pos.x >= rulerTool.x && pos.x <= rulerTool.x + rulerTool.length) {
        setDraggingRuler('body');
        setRulerDragStart({ x: pos.x - rulerTool.x, y: pos.y - rulerTool.y });
        return;
      }
    }

    if (tool === 'pan') {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      return;
    }

    if (tool === 'select') {
      
      const clicked = [...liveElements].reverse().find(el => isPointInElement(pos.x, pos.y, el));
      
      if (clicked) {
        const handle = getResizeHandle(pos.x, pos.y, clicked);
        
        if (handle) {
          
          updateSelection(new Set([clicked.id]));
          const resizeData = {
            element: clicked,
            handle,
            startX: pos.x,
            startY: pos.y,
            startWidth: clicked.width || 0,
            startHeight: clicked.height || 0,
            startRadius: clicked.radius || 0,
            startRx: clicked.rx || 0,
            startRy: clicked.ry || 0,
            startPosX: clicked.x,
            startPosY: clicked.y
          };
          setResizing(resizeData);
          return;
        }

        if (e.shiftKey) {
          const nextIds = new Set(selectedIdsRef.current);
          if (nextIds.has(clicked.id)) nextIds.delete(clicked.id);
          else nextIds.add(clicked.id);
          updateSelection(nextIds);
          return;
        }

        if (selectedIdsRef.current.size > 1 && selectedIdsRef.current.has(clicked.id)) {
          dragSelectionRef.current = {
            start: pos,
            snapshot: new Map(selectedElementsRef.current.map(el => [el.id, el]))
          };
          setDragStart(null);
          return;
        }
        
        updateSelection(new Set([clicked.id]));
        setDragStart({ x: pos.x - clicked.x, y: pos.y - clicked.y });
      } else {
        selectionStartRef.current = pos;
        selectionAdditiveRef.current = e.shiftKey;
        selectionBaseRef.current = new Set(selectedIdsRef.current);
        setSelectionBox({ x: pos.x, y: pos.y, width: 0, height: 0 });
        setDragStart(null);
        if (!e.shiftKey) {
          clearSelection();
        }
      }
    } else if (tool === 'draw') {
      setDrawing(true);
      currentPathRef.current = [pos];
      scheduleStateUpdate({ currentPath: currentPathRef.current });
    } else if (tool === 'eraser') {
      
      eraseDirtyRef.current = false;
      const clicked = [...liveElements].reverse().find(el => isPointInElement(pos.x, pos.y, el));
      if (clicked) {
        const newElements = liveElements.filter(el => el.id !== clicked.id);
        commitElements(newElements);
        eraseDirtyRef.current = true;
      }
      setDrawing(true); 
    } else if (tool === 'text') {
      const newElement = {
        id: Date.now(),
        type: 'text',
        x: pos.x,
        y: pos.y,
        text: 'Double click to edit',
        color,
        fontSize: 18,
        opacity
      };
      const newElements = [...liveElements, newElement];
      commitElements(newElements, { addHistory: true });
      setTool('select');
    } else if (tool === 'sticky') {
      
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
      const newElements = [...liveElements, newElement];
      commitElements(newElements, { addHistory: true });
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
    const liveElements = elementsRef.current;
    const activeElement = selectedElementRef.current;

    
    if (draggingRuler && rulerTool) {
      if (draggingRuler === 'body') {
        
        setRulerTool({
          ...rulerTool,
          x: pos.x - rulerDragStart.x,
          y: pos.y - rulerDragStart.y
        });
      } else if (draggingRuler === 'start') {
        
        const angle = rulerTool.angle || 0;
        const endX = rulerTool.x + rulerTool.length * Math.cos(angle);
        const endY = rulerTool.y + rulerTool.length * Math.sin(angle);
        
        
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

    
    if (resizing) {
      const pos = getMousePos(e);
      const deltaX = pos.x - resizing.startX;
      const deltaY = pos.y - resizing.startY;
      
      const newElements = liveElements.map(el => {
        if (el.id === resizing.element.id) {
          const minSize = el.type === 'sticky' ? 100 : 20;
          
          if (el.type === 'circle' || el.type === 'ellipse') {
            
            if (el.type === 'ellipse') {
              let newRx = resizing.startRx || 0;
              let newRy = resizing.startRy || 0;
              const minRadius = Math.max(12, minSize);
              if (resizing.handle === 'e') newRx = Math.max(minRadius, (resizing.startRx || 0) + deltaX);
              else if (resizing.handle === 'w') newRx = Math.max(minRadius, (resizing.startRx || 0) - deltaX);
              else if (resizing.handle === 's') newRy = Math.max(minRadius, (resizing.startRy || 0) + deltaY);
              else if (resizing.handle === 'n') newRy = Math.max(minRadius, (resizing.startRy || 0) - deltaY);
              return { ...el, rx: newRx, ry: newRy };
            }
            let newRadius = resizing.startRadius;
            if (resizing.handle === 'e') newRadius = Math.max(minSize, resizing.startRadius + deltaX);
            else if (resizing.handle === 'w') newRadius = Math.max(minSize, resizing.startRadius - deltaX);
            else if (resizing.handle === 's') newRadius = Math.max(minSize, resizing.startRadius + deltaY);
            else if (resizing.handle === 'n') newRadius = Math.max(minSize, resizing.startRadius - deltaY);
            return { ...el, radius: newRadius };
          } else {
            
            let newWidth = resizing.startWidth;
            let newHeight = resizing.startHeight;
            let newX = el.x;
            let newY = el.y;
            
            if (resizing.handle === 'se') {
              newWidth = Math.max(minSize, resizing.startWidth + deltaX);
              newHeight = Math.max(minSize, resizing.startHeight + deltaY);
            } else if (resizing.handle === 'sw') {
              newWidth = Math.max(minSize, resizing.startWidth - deltaX);
              newHeight = Math.max(minSize, resizing.startHeight + deltaY);
              newX = resizing.startPosX + (resizing.startWidth - newWidth);
            } else if (resizing.handle === 'ne') {
              newWidth = Math.max(minSize, resizing.startWidth + deltaX);
              newHeight = Math.max(minSize, resizing.startHeight - deltaY);
              newY = resizing.startPosY + (resizing.startHeight - newHeight);
            } else if (resizing.handle === 'nw') {
              newWidth = Math.max(minSize, resizing.startWidth - deltaX);
              newHeight = Math.max(minSize, resizing.startHeight - deltaY);
              newX = resizing.startPosX + (resizing.startWidth - newWidth);
              newY = resizing.startPosY + (resizing.startHeight - newHeight);
            } else if (resizing.handle === 'e') {
              newWidth = Math.max(minSize, resizing.startWidth + deltaX);
            } else if (resizing.handle === 'w') {
              newWidth = Math.max(minSize, resizing.startWidth - deltaX);
              newX = resizing.startPosX + (resizing.startWidth - newWidth);
            } else if (resizing.handle === 's') {
              newHeight = Math.max(minSize, resizing.startHeight + deltaY);
            } else if (resizing.handle === 'n') {
              newHeight = Math.max(minSize, resizing.startHeight - deltaY);
              newY = resizing.startPosY + (resizing.startHeight - newHeight);
            }
            
            return { ...el, width: newWidth, height: newHeight, x: newX, y: newY };
          }
        }
        return el;
      });
      
      commitElements(newElements);
      return;
    }

    if (dragSelectionRef.current && tool === 'select') {
      const { start, snapshot } = dragSelectionRef.current;
      const dx = pos.x - start.x;
      const dy = pos.y - start.y;
      const newElements = liveElements.map(el => (
        snapshot.has(el.id) ? translateElement(snapshot.get(el.id), dx, dy) : el
      ));
      commitElements(newElements);
      return;
    }

    if (selectionStartRef.current && tool === 'select') {
      const start = selectionStartRef.current;
      const box = {
        x: Math.min(start.x, pos.x),
        y: Math.min(start.y, pos.y),
        width: Math.abs(pos.x - start.x),
        height: Math.abs(pos.y - start.y)
      };
      setSelectionBox(box);
      return;
    }

    if (isPanning) {
      const newPanX = e.clientX - panStart.x;
      const newPanY = e.clientY - panStart.y;
      
      
      setPan({
        x: Math.min(newPanX, 0),
        y: Math.min(newPanY, 0)
      });
    } else if (drawing) {
      if (tool === 'draw') {
        const lastPoint = currentPathRef.current[currentPathRef.current.length - 1];
        if (!lastPoint || distance(lastPoint, pos) >= MIN_POINT_DISTANCE) {
          currentPathRef.current = [...currentPathRef.current, pos];
          scheduleStateUpdate({ currentPath: currentPathRef.current });
        }
      } else if (tool === 'eraser') {
        
        const clicked = [...liveElements].reverse().find(el => isPointInElement(pos.x, pos.y, el));
        if (clicked) {
          const newElements = liveElements.filter(el => el.id !== clicked.id);
          commitElements(newElements);
          eraseDirtyRef.current = true;
        }
      } else if (dragStart) {
        
        if (tool === 'rectangle') {
          scheduleStateUpdate({ previewShape: {
            type: 'rectangle',
            x: Math.min(dragStart.x, pos.x),
            y: Math.min(dragStart.y, pos.y),
            width: Math.abs(pos.x - dragStart.x),
            height: Math.abs(pos.y - dragStart.y)
          }});
        } else if (tool === 'circle') {
          const radius = Math.sqrt(Math.pow(pos.x - dragStart.x, 2) + Math.pow(pos.y - dragStart.y, 2));
          scheduleStateUpdate({ previewShape: {
            type: 'circle',
            x: dragStart.x,
            y: dragStart.y,
            radius
          }});
        } else if (tool === 'line' || tool === 'arrow') {
          scheduleStateUpdate({ previewShape: {
            type: tool,
            x1: dragStart.x,
            y1: dragStart.y,
            x2: pos.x,
            y2: pos.y
          }});
        }
      }
    } else if (activeElement && dragStart && tool === 'select') {
      const updatedSelected = { ...activeElement, x: pos.x - dragStart.x, y: pos.y - dragStart.y };
      const newElements = liveElements.map(el => {
        if (el.id === activeElement.id) {
          return updatedSelected;
        }
        return el;
      });
      commitElements(newElements);
      selectedElementRef.current = updatedSelected;
      scheduleStateUpdate({ selectedElement: updatedSelected });
    }
  };

  const handleMouseUp = (e) => {
    const pos = getMousePos(e);

    
    if (draggingRuler) {
      setDraggingRuler(null);
      setRulerDragStart(null);
      return;
    }

    
    if (resizing) {
      addToHistory(elementsRef.current);
      setResizing(null);
      return;
    }

    if (dragSelectionRef.current && tool === 'select') {
      addToHistory(elementsRef.current);
      dragSelectionRef.current = null;
      return;
    }

    if (selectionStartRef.current && tool === 'select') {
      const start = selectionStartRef.current;
      const box = {
        x: Math.min(start.x, pos.x),
        y: Math.min(start.y, pos.y),
        width: Math.abs(pos.x - start.x),
        height: Math.abs(pos.y - start.y)
      };
      if (box.width >= 4 && box.height >= 4) {
        const idsInBox = new Set();
        elementsRef.current.forEach(el => {
          const bounds = getElementBounds(el);
          const intersects = !(
            bounds.x > box.x + box.width ||
            bounds.x + bounds.width < box.x ||
            bounds.y > box.y + box.height ||
            bounds.y + bounds.height < box.y
          );
          if (intersects) idsInBox.add(el.id);
        });
        const finalIds = selectionAdditiveRef.current
          ? new Set([...selectionBaseRef.current, ...idsInBox])
          : idsInBox;
        updateSelection(finalIds);
      } else if (!selectionAdditiveRef.current) {
        clearSelection();
      }
      setSelectionBox(null);
      selectionStartRef.current = null;
      selectionAdditiveRef.current = false;
      selectionBaseRef.current = new Set();
      return;
    }

    if (drawing && tool === 'draw') {
      const lastPoint = currentPathRef.current[currentPathRef.current.length - 1];
      if (!lastPoint || distance(lastPoint, pos) >= MIN_POINT_DISTANCE) {
        currentPathRef.current = [...currentPathRef.current, pos];
      }
    }

    if (drawing) {
      if (tool === 'draw' && currentPathRef.current.length > 1) {
        let finalElement;
        const pathPoints = currentPathRef.current;
        
        
        if (shapeRecognition && pathPoints.length > 10) {
          const recognized = recognizeShape(pathPoints);
          if (recognized) {
            finalElement = { ...recognized, id: Date.now(), color, strokeWidth, fillColor: 'transparent', opacity };
          }
        }
        
        
        if (!finalElement) {
          const smoothedPath = smoothDrawing ? smoothPath(pathPoints) : pathPoints;
          finalElement = {
            id: Date.now(),
            type: 'draw',
            points: smoothedPath,
            color,
            strokeWidth,
            fillColor: 'transparent',
            opacity,
            drawStyle
          };
        }
        
        const newElements = [...elementsRef.current, finalElement];
        commitElements(newElements, { addHistory: true });
        currentPathRef.current = [];
        scheduleStateUpdate({ currentPath: [] });
      } else if (tool === 'eraser') {
        if (eraseDirtyRef.current) {
          addToHistory(elementsRef.current);
          eraseDirtyRef.current = false;
        }
      } else if (tool === 'rectangle' && dragStart) {
        const newElement = {
          id: Date.now(),
          type: 'rectangle',
          x: Math.min(dragStart.x, pos.x),
          y: Math.min(dragStart.y, pos.y),
          width: Math.abs(pos.x - dragStart.x),
          height: Math.abs(pos.y - dragStart.y),
          color,
          strokeWidth,
          fillColor,
          opacity
        };
        if (newElement.width > 5 && newElement.height > 5) {
          const newElements = [...elementsRef.current, newElement];
          commitElements(newElements, { addHistory: true });
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
          strokeWidth,
          fillColor,
          opacity
        };
        if (radius > 5) {
          const newElements = [...elementsRef.current, newElement];
          commitElements(newElements, { addHistory: true });
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
        const newElements = [...elementsRef.current, newElement];
        commitElements(newElements, { addHistory: true });
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
        const newElements = [...elementsRef.current, newElement];
        commitElements(newElements, { addHistory: true });
        setTool('select');
      }
      if (tool === 'draw') {
        currentPathRef.current = [];
        scheduleStateUpdate({ currentPath: [] });
      }
      setDrawing(false);
      setDragStart(null);
      scheduleStateUpdate({ previewShape: null }); 
    }

    if (isPanning) {
      setIsPanning(false);
    }

    if (selectedElementRef.current && dragStart) {
      addToHistory(elementsRef.current);
      setDragStart(null);
    }
  };

  const handleDoubleClick = (e) => {
    const pos = getMousePos(e);
    const clicked = [...elementsRef.current].reverse().find(el => isPointInElement(pos.x, pos.y, el));
    
    if (clicked && (clicked.type === 'text' || clicked.type === 'sticky')) {
      setEditingText(clicked);
    }
  };

  const updateText = (id, newText) => {
    const newElements = elementsRef.current.map(el => 
      el.id === id ? { ...el, text: newText } : el
    );
    commitElements(newElements, { addHistory: true });
  };

  const deleteSelected = () => {
    if (selectedIdsRef.current.size > 0) {
      const newElements = elementsRef.current.filter(el => !selectedIdsRef.current.has(el.id));
      commitElements(newElements, { addHistory: true });
      clearSelection();
      return;
    }
    if (selectedElementRef.current) {
      const newElements = elementsRef.current.filter(el => el.id !== selectedElementRef.current.id);
      commitElements(newElements, { addHistory: true });
      clearSelection();
    }
  };

  const clearCanvas = () => {
    if (window.confirm('Clear entire canvas?')) {
      commitElements([], { addHistory: true });
      clearSelection();
    }
  };

  const handleSave = (shouldClose = false) => {
    const canvasData = serializeElements(elementsRef.current);
    const shouldGeneratePreview = shouldClose || (onSave && onSave.length >= 3);
    const previewData = shouldGeneratePreview ? renderPreviewDataUrl() : undefined;
    const hasChanges = canvasData !== lastSerializedRef.current;

    if (onSave && (hasChanges || shouldClose)) {
      if (autoSaveTimeout.current) {
        clearTimeout(autoSaveTimeout.current);
        autoSaveTimeout.current = null;
      }
      if (hasChanges) {
        lastSerializedRef.current = canvasData;
      }
      try {
        if (previewData !== undefined) {
          onSave(canvasData, shouldClose, previewData);
        } else {
          onSave(canvasData, shouldClose);
        }
        if (hasChanges) {
          setLastSaved(new Date());
        }
      } catch (error) {
              } finally {
        setAutoSaving(false);
      }
    }
    if (shouldClose) {
      onClose?.();
    }
  };

  const renderPreviewDataUrl = () => {
    const items = elementsRef.current;
    if (!items || items.length === 0) return '';
    const padding = 40;
    const bounds = getElementsBounds(items);
    const width = Math.min(1400, Math.max(360, bounds.width + padding * 2));
    const height = Math.min(1000, Math.max(240, bounds.height + padding * 2));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    ctx.fillStyle = '#fbf8f2';
    ctx.fillRect(0, 0, width, height);
    ctx.save();
    ctx.translate(-bounds.x + padding, -bounds.y + padding);
    drawElementsToContext(ctx, items);
    ctx.restore();
    return canvas.toDataURL('image/png');
  };

  const drawElementsToContext = (ctx, items) => {
    items.forEach(el => {
      ctx.strokeStyle = el.color || '#111827';
      ctx.fillStyle = el.color || '#111827';
      ctx.lineWidth = el.strokeWidth || 2;
      ctx.globalAlpha = el.opacity || 1;
      
      if (el.type === 'draw') {
        ctx.beginPath();
        el.points.forEach((point, i) => {
          if (i === 0) ctx.moveTo(point.x, point.y);
          else ctx.lineTo(point.x, point.y);
        });
        ctx.stroke();
      } else if (el.type === 'rectangle') {
        if (el.fillColor && el.fillColor !== 'transparent') {
          ctx.fillStyle = el.fillColor;
          ctx.fillRect(el.x, el.y, el.width, el.height);
          ctx.fillStyle = el.color || '#111827';
        }
        ctx.strokeRect(el.x, el.y, el.width, el.height);
      } else if (el.type === 'circle') {
        ctx.beginPath();
        ctx.arc(el.x, el.y, el.radius, 0, Math.PI * 2);
        if (el.fillColor && el.fillColor !== 'transparent') {
          ctx.fillStyle = el.fillColor;
          ctx.fill();
          ctx.fillStyle = el.color || '#111827';
        }
        ctx.stroke();
      } else if (el.type === 'ellipse') {
        ctx.beginPath();
        if (ctx.ellipse) {
          ctx.ellipse(el.x, el.y, el.rx, el.ry, 0, 0, Math.PI * 2);
        } else {
          ctx.save();
          ctx.translate(el.x, el.y);
          ctx.scale(el.rx, el.ry);
          ctx.arc(0, 0, 1, 0, Math.PI * 2);
          ctx.restore();
        }
        if (el.fillColor && el.fillColor !== 'transparent') {
          ctx.fillStyle = el.fillColor;
          ctx.fill();
          ctx.fillStyle = el.color || '#111827';
        }
        ctx.stroke();
      } else if (el.type === 'line') {
        ctx.beginPath();
        ctx.moveTo(el.x1, el.y1);
        ctx.lineTo(el.x2, el.y2);
        ctx.stroke();
      } else if (el.type === 'arrow') {
        const angle = Math.atan2(el.y2 - el.y1, el.x2 - el.x1);
        const arrowLength = 15;
        ctx.beginPath();
        ctx.moveTo(el.x1, el.y1);
        ctx.lineTo(el.x2, el.y2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(el.x2, el.y2);
        ctx.lineTo(el.x2 - arrowLength * Math.cos(angle - Math.PI / 6), el.y2 - arrowLength * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(el.x2 - arrowLength * Math.cos(angle + Math.PI / 6), el.y2 - arrowLength * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fillStyle = el.color || '#111827';
        ctx.fill();
      } else if (el.type === 'text') {
        ctx.font = `${el.fontSize}px Manrope`;
        ctx.fillText(el.text, el.x, el.y);
      } else if (el.type === 'sticky') {
        ctx.fillStyle = el.color;
        ctx.fillRect(el.x, el.y, el.width, el.height);
        ctx.fillStyle = '#000000';
        ctx.font = '14px Manrope';
        ctx.fillText(el.text, el.x + 10, el.y + 30);
      }
    });
    ctx.globalAlpha = 1;
  };

  const handleClose = () => {
    handleSave(true);
  };

  
  useEffect(() => {
    if (!onSave || !hydratedRef.current) return;

    const nextSerialized = serializeElements(elements);
    if (nextSerialized === lastSerializedRef.current) return;

    if (autoSaveTimeout.current) {
      clearTimeout(autoSaveTimeout.current);
      autoSaveTimeout.current = null;
    }

    setAutoSaving(true);
    autoSaveTimeout.current = setTimeout(() => {
      const latestSerialized = serializeElements(elementsRef.current);
      if (latestSerialized !== lastSerializedRef.current && onSave) {
        lastSerializedRef.current = latestSerialized;
        onSave(latestSerialized);
        setLastSaved(new Date());
      }
      setAutoSaving(false);
    }, 1200);

    return () => {
      if (autoSaveTimeout.current) {
        clearTimeout(autoSaveTimeout.current);
        autoSaveTimeout.current = null;
      }
    };
  }, [elements, onSave]);

  useEffect(() => () => {
    if (!onSave || !hydratedRef.current) return;
    const canvasData = serializeElements(elementsRef.current);
    if (canvasData !== lastSerializedRef.current) {
      onSave(canvasData);
    }
  }, [onSave]);

  const exportAsImage = () => {
    const items = elementsRef.current;
    if (!items.length) return;
    const padding = 60;
    const bounds = getElementsBounds(items);
    const width = Math.min(2400, Math.max(800, bounds.width + padding * 2));
    const height = Math.min(1800, Math.max(600, bounds.height + padding * 2));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fbf8f2';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(-bounds.x + padding, -bounds.y + padding);
    drawElementsToContext(ctx, items);
    ctx.restore();
    const link = document.createElement('a');
    link.download = 'canvas-export.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="canvas-mode">
      <div className="canvas-toolbar">
        <div className="toolbar-section">
          <button onClick={handleClose} className="tool-btn back-btn" title="Back to note">
            <ArrowLeft size={20} />
            <span>Back</span>
          </button>
          <button onClick={handleClose} className="tool-btn close-btn" title="Close canvas">
            <X size={18} />
          </button>
        </div>

        <div className="toolbar-section">
          <button 
            onClick={() => setTool('select')} 
            className={`tool-btn ${tool === 'select' ? 'active' : ''}`}
          >
            <MousePointer size={20} />
          </button>
          <button 
            onClick={() => setTool('pan')} 
            className={`tool-btn ${tool === 'pan' ? 'active' : ''}`}
          >
            <Move size={20} />
          </button>
          <button 
            onClick={() => setTool('draw')} 
            className={`tool-btn ${tool === 'draw' ? 'active' : ''}`}
          >
            <Pen size={20} />
          </button>
          <button 
            onClick={() => setTool('eraser')} 
            className={`tool-btn ${tool === 'eraser' ? 'active' : ''}`}
          >
            <Eraser size={20} />
          </button>
        </div>

        <div className="toolbar-section">
          <button 
            onClick={() => setTool('rectangle')} 
            className={`tool-btn ${tool === 'rectangle' ? 'active' : ''}`}
          >
            <Square size={20} />
          </button>
          <button 
            onClick={() => setTool('circle')} 
            className={`tool-btn ${tool === 'circle' ? 'active' : ''}`}
          >
            <Circle size={20} />
          </button>
          <button 
            onClick={() => setTool('line')} 
            className={`tool-btn ${tool === 'line' ? 'active' : ''}`}
          >
            <Minus size={20} />
          </button>
          <button 
            onClick={() => setTool('text')} 
            className={`tool-btn ${tool === 'text' ? 'active' : ''}`}
          >
            <Type size={20} />
          </button>
          <button 
            onClick={() => setTool('sticky')} 
            className={`tool-btn ${tool === 'sticky' ? 'active' : ''}`}
          >
            <StickyNote size={20} />
          </button>
          <button 
            onClick={() => setTool('arrow')} 
            className={`tool-btn ${tool === 'arrow' ? 'active' : ''}`}
          >
            <ArrowRight size={20} />
          </button>
          <button 
            onClick={() => setShowTableCreator(true)} 
            className="tool-btn"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <line x1="3" y1="9" x2="21" y2="9"/>
              <line x1="3" y1="15" x2="21" y2="15"/>
              <line x1="9" y1="3" x2="9" y2="21"/>
              <line x1="15" y1="3" x2="15" y2="21"/>
            </svg>
          </button>
          <button 
            onClick={() => fileInputRef.current?.click()} 
            className="tool-btn"
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
                    opacity
                  };
                  const newElements = [...elementsRef.current, newElement];
                  commitElements(newElements, { addHistory: true });
                };
                reader.readAsDataURL(file);
              }
            }}
          />
        </div>

        <div className="toolbar-section">
          <button onClick={undo} disabled={historyIndex === 0} className="tool-btn">
            <Undo size={20} />
          </button>
          <button onClick={redo} disabled={historyIndex === history.length - 1} className="tool-btn">
            <Redo size={20} />
          </button>
          <button onClick={deleteSelected} disabled={!selectedElement && selectedElements.length === 0} className="tool-btn">
            <Trash2 size={20} />
          </button>
          <button onClick={clearCanvas} className="tool-btn" title="Clear canvas">
            <Eraser size={20} />
          </button>
        </div>

        <div className="toolbar-section">
          <button onClick={() => setZoom(Math.min(zoom + 0.1, 10))} className="tool-btn">
            <ZoomIn size={20} />
          </button>
          <span className="zoom-level">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(Math.max(zoom - 0.1, 0.1))} className="tool-btn">
            <ZoomOut size={20} />
          </button>
        </div>

        <div className="toolbar-section">
          <button onClick={copySelected} className="tool-btn" disabled={!selectedElement && selectedElements.length === 0}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
          </button>
          <button onClick={pasteElements} className="tool-btn" disabled={copiedElements.length === 0}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
            </svg>
          </button>
          <button onClick={duplicateSelected} className="tool-btn" disabled={!selectedElement && selectedElements.length === 0}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              <circle cx="15" cy="15" r="2" fill="currentColor"></circle>
            </svg>
          </button>
        </div>

        <div className="toolbar-section">
          <button onClick={() => setShowMinimap(!showMinimap)} className={`tool-btn ${showMinimap ? 'active' : ''}`}>
            <Map size={20} />
          </button>
          <button onClick={() => setShowGrid(!showGrid)} className={`tool-btn ${showGrid ? 'active' : ''}`}>
            <Grid size={20} />
          </button>
          <button onClick={() => setShowRuler(!showRuler)} className={`tool-btn ${showRuler ? 'active' : ''}`}>
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
          >
            <Ruler size={20} />
          </button>
          <button 
            onClick={() => setSnapToGrid(!snapToGrid)} 
            className={`tool-btn ${snapToGrid ? 'active' : ''}`}
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
          <button onClick={() => handleSave(true)} className="tool-btn save-btn">
            <Save size={20} />
            <span>Save</span>
          </button>
          <button onClick={exportAsImage} className="tool-btn">
            <Download size={20} />
          </button>
        </div>
      </div>

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
                  border: isLightColor(c) ? '1px solid rgba(15, 23, 42, 0.2)' : 'none',
                  boxShadow: tool === 'sticky' ? '0 2px 4px rgba(0,0,0,0.2)' : 'none'
                }}
                onClick={() => setColor(c)}
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
              >
                <div style={{ width: '100%', height: `${w}px`, background: 'var(--accent)' }} />
              </button>
            ))}
          </div>
        </div>
        {(tool === 'rectangle' || tool === 'circle') && (
          <div className="property-group">
            <label>Fill:</label>
            <div className="color-palette">
              <button
                className={`color-btn ${fillColor === 'transparent' ? 'active' : ''}`}
                style={{ 
                  background: 'transparent',
                  border: '1px solid rgba(15, 23, 42, 0.25)',
                  position: 'relative'
                }}
                onClick={() => setFillColor('transparent')}
              >
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%) rotate(45deg)',
                  width: '100%',
                  height: '2px',
                  background: '#ff0000'
                }} />
              </button>
              {COLORS.map(c => (
                <button
                  key={`fill-${c}`}
                className={`color-btn ${fillColor === c ? 'active' : ''}`}
                style={{ 
                  background: c, 
                  border: isLightColor(c) ? '1px solid rgba(15, 23, 42, 0.2)' : 'none'
                }}
                onClick={() => setFillColor(c)}
              />
              ))}
            </div>
          </div>
        )}
        {tool === 'draw' && (
          <>
            <div className="property-group">
              <label>Pen:</label>
              <div className="pen-style">
                <button
                  type="button"
                  className={`pen-style-btn ${drawStyle === 'pen' ? 'active' : ''}`}
                  onClick={() => applyDrawStyle('pen')}
                >
                  Pen
                </button>
                <button
                  type="button"
                  className={`pen-style-btn ${drawStyle === 'marker' ? 'active' : ''}`}
                  onClick={() => applyDrawStyle('marker')}
                >
                  Marker
                </button>
                <button
                  type="button"
                  className={`pen-style-btn ${drawStyle === 'highlighter' ? 'active' : ''}`}
                  onClick={() => applyDrawStyle('highlighter')}
                >
                  Highlighter
                </button>
              </div>
            </div>
            <div className="property-group" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '11px' }}>
                <input 
                  type="checkbox" 
                  checked={shapeRecognition}
                  onChange={(e) => setShapeRecognition(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                Shape Recognition
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '11px' }}>
                <input 
                  type="checkbox" 
                  checked={smoothDrawing}
                  onChange={(e) => setSmoothDrawing(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                Smooth Drawing
              </label>
            </div>
          </>
        )}
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
          />
          <span style={{ fontSize: '11px', color: 'var(--accent-ink)', fontWeight: '700', minWidth: '40px' }}>
            {Math.round(opacity * 100)}%
          </span>
        </div>
      </div>

      {showRuler && (
        <>
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

      <div 
        ref={containerRef}
        className={`canvas-container ${snapToGrid ? 'snap-active' : ''} pattern-${backgroundPattern}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        style={{ 
          cursor: resizing 
            ? (resizing.handle === 'se' || resizing.handle === 'nw' ? 'nwse-resize' : 'nesw-resize')
            : isPanning ? 'grabbing'
            : tool === 'pan' ? 'grab'
            : tool === 'eraser' ? 'crosshair' 
            : tool === 'select' ? 'default' 
            : 'crosshair' 
        }}
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
          {showGrid && (
            <defs>
              <pattern id="grid" width={GRID_SIZE} height={GRID_SIZE} patternUnits="userSpaceOnUse">
                <path d={`M ${GRID_SIZE} 0 L 0 0 L 0 ${GRID_SIZE}`} fill="none" stroke="rgba(15, 23, 42, 0.08)" strokeWidth="0.5"/>
              </pattern>
            </defs>
          )}
          {showGrid && <rect x="-10000" y="-10000" width="20000" height="20000" fill="url(#grid)" />}

          {rulerTool && (
            <g transform={`rotate(${(rulerTool.angle || 0) * 180 / Math.PI} ${rulerTool.x} ${rulerTool.y})`}>
              <line
                x1={rulerTool.x}
                y1={rulerTool.y}
                x2={rulerTool.x + rulerTool.length}
                y2={rulerTool.y}
                stroke="#f1b26c"
                strokeWidth="40"
                strokeLinecap="round"
                opacity="0.1"
              />
              <line
                x1={rulerTool.x}
                y1={rulerTool.y}
                x2={rulerTool.x + rulerTool.length}
                y2={rulerTool.y}
                stroke="#f1b26c"
                strokeWidth="4"
                strokeLinecap="round"
              />
              {Array.from({ length: Math.floor(rulerTool.length / 50) + 1 }, (_, i) => i * 50).map(offset => (
                <g key={offset}>
                  <line
                    x1={rulerTool.x + offset}
                    y1={rulerTool.y - (offset % 100 === 0 ? 15 : 8)}
                    x2={rulerTool.x + offset}
                    y2={rulerTool.y + (offset % 100 === 0 ? 15 : 8)}
                    stroke="#f1b26c"
                    strokeWidth="2"
                  />
                  {offset % 100 === 0 && (
                    <text
                      x={rulerTool.x + offset}
                      y={rulerTool.y - 20}
                      fill="#f1b26c"
                      fontSize="12"
                      fontFamily="Manrope"
                      fontWeight="700"
                      textAnchor="middle"
                    >
                      {offset}
                    </text>
                  )}
                </g>
              ))}
              <circle
                cx={rulerTool.x}
                cy={rulerTool.y}
                r="10"
                fill="#f1b26c"
                stroke="#0f1012"
                strokeWidth="2"
                style={{ cursor: 'move' }}
              />
              <circle
                cx={rulerTool.x + rulerTool.length}
                cy={rulerTool.y}
                r="10"
                fill="#f1b26c"
                stroke="#0f1012"
                strokeWidth="2"
                style={{ cursor: 'ew-resize' }}
              />
              <text
                x={rulerTool.x + rulerTool.length / 2}
                y={rulerTool.y + 35}
                fill="#f1b26c"
                fontSize="14"
                fontFamily="Manrope"
                fontWeight="700"
                textAnchor="middle"
              >
                {Math.round(rulerTool.length)}px
              </text>
            </g>
          )}

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
                  opacity={el.opacity || 1}
                  className={selectedIdSet.has(el.id) ? 'selected' : ''}
                />
              );
            } else if (el.type === 'rectangle') {
              return (
                <g key={el.id}>
                  <rect
                    x={el.x}
                    y={el.y}
                    width={el.width}
                    height={el.height}
                    fill={el.fillColor || 'none'}
                    stroke={el.color}
                    strokeWidth={el.strokeWidth}
                    opacity={el.opacity || 1}
                    className={selectedIdSet.has(el.id) ? 'selected' : ''}
                  />
                  {selectedElement?.id === el.id && tool === 'select' && selectedIdSet.size <= 1 && (
                    <>
                      <circle cx={el.x} cy={el.y} r="6" fill="#f1b26c" stroke="#1f2937" strokeWidth="1.5" style={{ cursor: 'nwse-resize' }} />
                      <circle cx={el.x + el.width} cy={el.y} r="6" fill="#f1b26c" stroke="#1f2937" strokeWidth="1.5" style={{ cursor: 'nesw-resize' }} />
                      <circle cx={el.x} cy={el.y + el.height} r="6" fill="#f1b26c" stroke="#1f2937" strokeWidth="1.5" style={{ cursor: 'nesw-resize' }} />
                      <circle cx={el.x + el.width} cy={el.y + el.height} r="6" fill="#f1b26c" stroke="#1f2937" strokeWidth="1.5" style={{ cursor: 'nwse-resize' }} />
                      <circle cx={el.x + el.width / 2} cy={el.y} r="6" fill="#f1b26c" stroke="#1f2937" strokeWidth="1.5" style={{ cursor: 'ns-resize' }} />
                      <circle cx={el.x + el.width / 2} cy={el.y + el.height} r="6" fill="#f1b26c" stroke="#1f2937" strokeWidth="1.5" style={{ cursor: 'ns-resize' }} />
                      <circle cx={el.x} cy={el.y + el.height / 2} r="6" fill="#f1b26c" stroke="#1f2937" strokeWidth="1.5" style={{ cursor: 'ew-resize' }} />
                      <circle cx={el.x + el.width} cy={el.y + el.height / 2} r="6" fill="#f1b26c" stroke="#1f2937" strokeWidth="1.5" style={{ cursor: 'ew-resize' }} />
                    </>
                  )}
                </g>
              );
            } else if (el.type === 'circle') {
              return (
                <g key={el.id}>
                  <circle
                    cx={el.x}
                    cy={el.y}
                    r={el.radius}
                    fill={el.fillColor || 'none'}
                    stroke={el.color}
                    strokeWidth={el.strokeWidth}
                    opacity={el.opacity || 1}
                    className={selectedIdSet.has(el.id) ? 'selected' : ''}
                  />
                  {selectedElement?.id === el.id && tool === 'select' && selectedIdSet.size <= 1 && (
                    <>
                      <circle cx={el.x + el.radius} cy={el.y} r="6" fill="#f1b26c" stroke="#1f2937" strokeWidth="1.5" style={{ cursor: 'ew-resize' }} />
                      <circle cx={el.x - el.radius} cy={el.y} r="6" fill="#f1b26c" stroke="#1f2937" strokeWidth="1.5" style={{ cursor: 'ew-resize' }} />
                      <circle cx={el.x} cy={el.y + el.radius} r="6" fill="#f1b26c" stroke="#1f2937" strokeWidth="1.5" style={{ cursor: 'ns-resize' }} />
                      <circle cx={el.x} cy={el.y - el.radius} r="6" fill="#f1b26c" stroke="#1f2937" strokeWidth="1.5" style={{ cursor: 'ns-resize' }} />
                    </>
                  )}
                </g>
              );
            } else if (el.type === 'ellipse') {
              return (
                <g key={el.id}>
                  <ellipse
                    cx={el.x}
                    cy={el.y}
                    rx={el.rx}
                    ry={el.ry}
                    fill={el.fillColor || 'none'}
                    stroke={el.color}
                    strokeWidth={el.strokeWidth}
                    opacity={el.opacity || 1}
                    className={selectedIdSet.has(el.id) ? 'selected' : ''}
                  />
                  {selectedElement?.id === el.id && tool === 'select' && selectedIdSet.size <= 1 && (
                    <>
                      <circle cx={el.x + el.rx} cy={el.y} r="6" fill="#f1b26c" stroke="#1f2937" strokeWidth="1.5" style={{ cursor: 'ew-resize' }} />
                      <circle cx={el.x - el.rx} cy={el.y} r="6" fill="#f1b26c" stroke="#1f2937" strokeWidth="1.5" style={{ cursor: 'ew-resize' }} />
                      <circle cx={el.x} cy={el.y + el.ry} r="6" fill="#f1b26c" stroke="#1f2937" strokeWidth="1.5" style={{ cursor: 'ns-resize' }} />
                      <circle cx={el.x} cy={el.y - el.ry} r="6" fill="#f1b26c" stroke="#1f2937" strokeWidth="1.5" style={{ cursor: 'ns-resize' }} />
                    </>
                  )}
                </g>
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
                  className={selectedIdSet.has(el.id) ? 'selected' : ''}
                />
              );
            } else if (el.type === 'arrow') {
              const angle = Math.atan2(el.y2 - el.y1, el.x2 - el.x1);
              const arrowLength = 15;
              return (
                <g key={el.id} className={selectedIdSet.has(el.id) ? 'selected' : ''}>
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
                  className={selectedIdSet.has(el.id) ? 'selected' : ''}
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
                  fontFamily="Manrope"
                  opacity={el.opacity || 1}
                  className={selectedIdSet.has(el.id) ? 'selected' : ''}
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
                <g key={el.id} className={selectedIdSet.has(el.id) ? 'selected' : ''} opacity={el.opacity || 1}>
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
                  <rect
                    x={el.x}
                    y={el.y}
                    width={el.width}
                    height="20"
                    fill={`color-mix(in srgb, ${el.color} 85%, white)`}
                    opacity="0.6"
                    rx="2"
                  />
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
                  <path
                    d={`M ${el.x + el.width - 20} ${el.y + el.height} 
                        L ${el.x + el.width} ${el.y + el.height - 20} 
                        L ${el.x + el.width} ${el.y + el.height} Z`}
                    fill={`color-mix(in srgb, ${el.color} 60%, black)`}
                    opacity="0.3"
                  />
                  
                  {selectedElement?.id === el.id && tool === 'select' && selectedIdSet.size <= 1 && (
                    <>
                      <circle
                        cx={el.x + el.width}
                        cy={el.y + el.height}
                        r="6"
                        fill="#f1b26c"
                        stroke="#1f2937"
                        strokeWidth="1.5"
                        style={{ cursor: 'nwse-resize' }}
                      />
                      <circle
                        cx={el.x}
                        cy={el.y + el.height}
                        r="6"
                        fill="#f1b26c"
                        stroke="#1f2937"
                        strokeWidth="1.5"
                        style={{ cursor: 'nesw-resize' }}
                      />
                      <circle
                        cx={el.x + el.width}
                        cy={el.y}
                        r="6"
                        fill="#f1b26c"
                        stroke="#1f2937"
                        strokeWidth="1.5"
                        style={{ cursor: 'nesw-resize' }}
                      />
                      <circle
                        cx={el.x}
                        cy={el.y}
                        r="6"
                        fill="#f1b26c"
                        stroke="#1f2937"
                        strokeWidth="1.5"
                        style={{ cursor: 'nwse-resize' }}
                      />
                    </>
                  )}
                </g>
              );
            } else if (el.type === 'table') {
              
              return (
                <g key={el.id} className={selectedIdSet.has(el.id) ? 'selected' : ''} opacity={el.opacity || 1}>
                  <rect
                    x={el.x}
                    y={el.y}
                    width={el.width}
                    height={el.height}
                    fill="#FFFFFF"
                    stroke={el.color || '#000000'}
                    strokeWidth={el.strokeWidth || 2}
                  />
                  
                  <rect
                    x={el.x}
                    y={el.y}
                    width={el.width}
                    height={el.cellHeight}
                    fill="#F0F0F0"
                    opacity="0.8"
                  />
                  
                  {Array.from({ length: el.rows - 1 }, (_, i) => (
                    <line
                      key={`row-${i}`}
                      x1={el.x}
                      y1={el.y + (i + 1) * el.cellHeight}
                      x2={el.x + el.width}
                      y2={el.y + (i + 1) * el.cellHeight}
                      stroke={el.color || '#000000'}
                      strokeWidth={el.strokeWidth || 2}
                    />
                  ))}
                  
                  {Array.from({ length: el.cols - 1 }, (_, i) => (
                    <line
                      key={`col-${i}`}
                      x1={el.x + (i + 1) * el.cellWidth}
                      y1={el.y}
                      x2={el.x + (i + 1) * el.cellWidth}
                      y2={el.y + el.height}
                      stroke={el.color || '#000000'}
                      strokeWidth={el.strokeWidth || 2}
                    />
                  ))}
                  
                  {Array.from({ length: el.cols }, (_, colIndex) => (
                    <text
                      key={`header-${colIndex}`}
                      x={el.x + colIndex * el.cellWidth + el.cellWidth / 2}
                      y={el.y + el.cellHeight / 2 + 5}
                      textAnchor="middle"
                      fill="#333333"
                      fontSize="14"
                      fontWeight="600"
                      fontFamily="Manrope"
                    >
                      {String.fromCharCode(65 + colIndex)}
                    </text>
                  ))}
                  
                  {Array.from({ length: el.rows - 1 }, (_, rowIndex) => (
                    <text
                      key={`row-label-${rowIndex}`}
                      x={el.x + 15}
                      y={el.y + (rowIndex + 1) * el.cellHeight + el.cellHeight / 2 + 5}
                      textAnchor="start"
                      fill="#666666"
                      fontSize="12"
                      fontFamily="Manrope"
                    >
                      {rowIndex + 1}
                    </text>
                  ))}
                  
                  {selectedElement?.id === el.id && tool === 'select' && selectedIdSet.size <= 1 && (
                    <>
                      <circle cx={el.x + el.width} cy={el.y + el.height} r="6" fill="#f1b26c" stroke="#1f2937" strokeWidth="1.5" style={{ cursor: 'nwse-resize' }} />
                      <circle cx={el.x} cy={el.y + el.height} r="6" fill="#f1b26c" stroke="#1f2937" strokeWidth="1.5" style={{ cursor: 'nesw-resize' }} />
                      <circle cx={el.x + el.width} cy={el.y} r="6" fill="#f1b26c" stroke="#1f2937" strokeWidth="1.5" style={{ cursor: 'nesw-resize' }} />
                      <circle cx={el.x} cy={el.y} r="6" fill="#f1b26c" stroke="#1f2937" strokeWidth="1.5" style={{ cursor: 'nwse-resize' }} />
                      <circle cx={el.x + el.width / 2} cy={el.y} r="6" fill="#f1b26c" stroke="#1f2937" strokeWidth="1.5" style={{ cursor: 'ns-resize' }} />
                      <circle cx={el.x + el.width / 2} cy={el.y + el.height} r="6" fill="#f1b26c" stroke="#1f2937" strokeWidth="1.5" style={{ cursor: 'ns-resize' }} />
                      <circle cx={el.x} cy={el.y + el.height / 2} r="6" fill="#f1b26c" stroke="#1f2937" strokeWidth="1.5" style={{ cursor: 'ew-resize' }} />
                      <circle cx={el.x + el.width} cy={el.y + el.height / 2} r="6" fill="#f1b26c" stroke="#1f2937" strokeWidth="1.5" style={{ cursor: 'ew-resize' }} />
                    </>
                  )}
                </g>
              );
            }
            return null;
          })}

          {drawing && tool === 'draw' && currentPath.length > 0 && (
            <polyline
              points={currentPath.map(p => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={opacity}
            />
          )}

          {previewShape && (
            <>
              {previewShape.type === 'rectangle' && (
                <rect
                  x={previewShape.x}
                  y={previewShape.y}
                  width={previewShape.width}
                  height={previewShape.height}
                  fill={fillColor === 'transparent' ? 'none' : fillColor}
                  stroke={color}
                  strokeWidth={strokeWidth}
                  opacity="0.6"
                  strokeDasharray="5,5"
                />
              )}
              {previewShape.type === 'circle' && (
                <circle
                  cx={previewShape.x}
                  cy={previewShape.y}
                  r={previewShape.radius}
                  fill={fillColor === 'transparent' ? 'none' : fillColor}
                  stroke={color}
                  strokeWidth={strokeWidth}
                  opacity="0.6"
                  strokeDasharray="5,5"
                />
              )}
              {(previewShape.type === 'line' || previewShape.type === 'arrow') && (
                <g opacity="0.6">
                  <line
                    x1={previewShape.x1}
                    y1={previewShape.y1}
                    x2={previewShape.x2}
                    y2={previewShape.y2}
                    stroke={color}
                    strokeWidth={strokeWidth}
                    strokeDasharray="5,5"
                  />
                  {previewShape.type === 'arrow' && (
                    <polygon
                      points={`${previewShape.x2},${previewShape.y2} ${previewShape.x2 - 15 * Math.cos(Math.atan2(previewShape.y2 - previewShape.y1, previewShape.x2 - previewShape.x1) - Math.PI / 6)},${previewShape.y2 - 15 * Math.sin(Math.atan2(previewShape.y2 - previewShape.y1, previewShape.x2 - previewShape.x1) - Math.PI / 6)} ${previewShape.x2 - 15 * Math.cos(Math.atan2(previewShape.y2 - previewShape.y1, previewShape.x2 - previewShape.x1) + Math.PI / 6)},${previewShape.y2 - 15 * Math.sin(Math.atan2(previewShape.y2 - previewShape.y1, previewShape.x2 - previewShape.x1) + Math.PI / 6)}`}
                      fill={color}
                    />
                  )}
                </g>
              )}
            </>
          )}

          {selectionBox && (
            <rect
              x={selectionBox.x}
              y={selectionBox.y}
              width={selectionBox.width}
              height={selectionBox.height}
              fill="rgba(17, 24, 39, 0.08)"
              stroke="rgba(17, 24, 39, 0.5)"
              strokeDasharray="6,4"
            />
          )}
        </svg>
      </div>

      {showTableCreator && (
        <div className="text-edit-modal" onClick={() => setShowTableCreator(false)}>
          <div className="text-edit-content" onClick={(e) => e.stopPropagation()} style={{ minWidth: '300px' }}>
            <h3>Create Table</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <label style={{ minWidth: '80px', fontSize: '13px', fontWeight: '600' }}>Rows:</label>
                <input 
                  type="number" 
                  min="1" 
                  max="20" 
                  value={tableRows}
                  onChange={(e) => setTableRows(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
                  style={{ flex: 1, padding: '8px', fontSize: '14px', background: '#ffffff', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: '8px' }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <label style={{ minWidth: '80px', fontSize: '13px', fontWeight: '600' }}>Columns:</label>
                <input 
                  type="number" 
                  min="1" 
                  max="20" 
                  value={tableCols}
                  onChange={(e) => setTableCols(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
                  style={{ flex: 1, padding: '8px', fontSize: '14px', background: '#ffffff', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: '8px' }}
                />
              </div>
            </div>
            <div className="text-edit-actions">
              <button onClick={() => {
                
                const cellWidth = 120;
                const cellHeight = 40;
                const tableWidth = tableCols * cellWidth;
                const tableHeight = tableRows * cellHeight;
                const startX = 200;
                const startY = 200;
                
                const newElement = {
                  id: Date.now(),
                  type: 'table',
                  x: startX,
                  y: startY,
                  rows: tableRows,
                  cols: tableCols,
                  cellWidth,
                  cellHeight,
                  width: tableWidth,
                  height: tableHeight,
                  cells: Array(tableRows).fill(null).map(() => Array(tableCols).fill('')),
                  color,
                  strokeWidth: 2,
                  opacity
                };
                
                const newElements = [...elementsRef.current, newElement];
                commitElements(newElements, { addHistory: true });
                setShowTableCreator(false);
                setTool('select');
              }} className="btn-save">
                Create
              </button>
              <button onClick={() => setShowTableCreator(false)} className="btn-cancel">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

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

      {showMinimap && (
        <div className="minimap">
          <div className="minimap-header">
            <span>Overview</span>
            <button onClick={() => setShowMinimap(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <X size={14} />
            </button>
          </div>
          <svg width="150" height="150" style={{ background: 'var(--canvas-bg)', border: '1px solid var(--border)', borderRadius: '10px' }}>
            {elements.map(el => {
              const scale = 0.05;
              if (el.type === 'rectangle') {
                return <rect key={el.id} x={el.x * scale} y={el.y * scale} width={el.width * scale} height={el.height * scale} fill={el.color} opacity="0.5" />;
              } else if (el.type === 'circle') {
                return <circle key={el.id} cx={el.x * scale} cy={el.y * scale} r={el.radius * scale} fill={el.color} opacity="0.5" />;
              } else if (el.type === 'ellipse') {
                return <ellipse key={el.id} cx={el.x * scale} cy={el.y * scale} rx={el.rx * scale} ry={el.ry * scale} fill={el.color} opacity="0.5" />;
              } else if (el.type === 'sticky') {
                return <rect key={el.id} x={el.x * scale} y={el.y * scale} width={el.width * scale} height={el.height * scale} fill={el.color} opacity="0.7" />;
              }
              return null;
            })}
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
                <div className="shortcut-item"><kbd>P</kbd> Pan</div>
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

      <button 
        className="floating-help-btn" 
        onClick={() => setShowShortcuts(true)}
      >
        <Command size={20} />
      </button>
    </div>
  );
};

export default CanvasMode;

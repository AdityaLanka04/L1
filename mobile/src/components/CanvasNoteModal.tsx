import { useEffect, useMemo, useRef, useState, type ComponentProps } from 'react';
import {
  LayoutChangeEvent,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Circle, G, Line, Path, Polygon, Rect, Text as SvgText } from 'react-native-svg';
import Ionicons from '@expo/vector-icons/Ionicons';
import HapticTouchable from './HapticTouchable';
import { NOTE_FONT_OPTIONS, normalizeNoteFont, resolveNoteFont } from '../constants/noteFonts';
import { rgbaFromHex } from '../utils/theme';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import {
  type CanvasDrawElement,
  type CanvasElement,
  type CanvasLineElement,
  type CanvasPoint,
  createCanvasPreviewDataUrl,
  distance,
  parseCanvasElements,
  pathFromPoints,
  serializeCanvasElements,
  simplifyStrokePoints,
} from '../utils/noteCanvas';

type ThemeColors = {
  bgPrimary: string;
  panel: string;
  panelAlt: string;
  accent: string;
  accentHover: string;
  borderStrong: string;
  textSecondary: string;
  danger: string;
  isLight: boolean;
};

type Props = {
  visible: boolean;
  initialData?: string;
  theme: ThemeColors;
  onClose: () => void;
  onSave: (canvasData: string, previewData: string) => void;
};

type ToolMode =
  | 'select'
  | 'draw'
  | 'eraser'
  | 'rectangle'
  | 'circle'
  | 'line'
  | 'arrow'
  | 'text'
  | 'sticky';

type DrawStyle = 'pen' | 'marker' | 'highlighter';
type BackgroundPattern = 'none' | 'dots' | 'lines' | 'cross' | 'diagonal';

type DragState =
  | {
      mode: 'move';
      start: CanvasPoint;
      selectedId: string | number;
      originElement: CanvasElement;
    }
  | {
      mode: 'shape';
      start: CanvasPoint;
      tool: ToolMode;
    }
  | {
      mode: 'erase';
    }
  | null;

const COLORS = [
  '#171717',
  '#3b3b3b',
  '#1d4ed8',
  '#0284c7',
  '#0f766e',
  '#15803d',
  '#ca8a04',
  '#ea580c',
  '#dc2626',
  '#9333ea',
  '#64748b',
] as const;

const STICKY_COLORS = [
  '#fff2a8',
  '#ffdca8',
  '#ffc9b8',
  '#ffd0de',
  '#ead5ff',
  '#dbeafe',
  '#ccfbf1',
  '#dcfce7',
] as const;

const STROKE_WIDTHS = [1, 2, 4, 6, 10];
const FONT_SIZES = [14, 18, 24, 32];

const TOOLS: Array<{ value: ToolMode; label: string; icon: ComponentProps<typeof Ionicons>['name'] }> = [
  { value: 'select', label: 'select', icon: 'scan-outline' },
  { value: 'draw', label: 'draw', icon: 'brush-outline' },
  { value: 'eraser', label: 'erase', icon: 'remove-outline' },
  { value: 'rectangle', label: 'rect', icon: 'square-outline' },
  { value: 'circle', label: 'circle', icon: 'ellipse-outline' },
  { value: 'line', label: 'line', icon: 'remove-outline' },
  { value: 'arrow', label: 'arrow', icon: 'arrow-forward-outline' },
  { value: 'text', label: 'text', icon: 'text-outline' },
  { value: 'sticky', label: 'sticky', icon: 'document-text-outline' },
];

function cloneElements(elements: CanvasElement[]) {
  return elements.map((element) => {
    if (element.type === 'draw') {
      return { ...element, points: element.points.map((point) => ({ ...point })) };
    }
    return { ...element };
  });
}

function normalizeOpacity(drawStyle: DrawStyle, opacity: number) {
  if (drawStyle === 'marker') return Math.min(opacity, 0.7);
  if (drawStyle === 'highlighter') return Math.min(opacity, 0.32);
  return opacity;
}

function effectiveStrokeWidth(drawStyle: DrawStyle, strokeWidth: number) {
  if (drawStyle === 'marker') return Math.max(strokeWidth, 6);
  if (drawStyle === 'highlighter') return Math.max(strokeWidth, 14);
  return strokeWidth;
}

function smoothPath(points: CanvasPoint[]) {
  if (points.length < 4) return points;
  const smoothed = [points[0]];

  for (let i = 0; i < points.length - 3; i += 1) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const p2 = points[i + 2];
    const p3 = points[i + 3];

    for (let t = 0; t < 1; t += 0.25) {
      const t2 = t * t;
      const t3 = t2 * t;
      smoothed.push({
        x:
          0.5 *
          ((2 * p1.x) +
            (-p0.x + p2.x) * t +
            (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
            (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y:
          0.5 *
          ((2 * p1.y) +
            (-p0.y + p2.y) * t +
            (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
            (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }

  smoothed.push(points[points.length - 1]);
  return smoothed;
}

function pathLength(points: CanvasPoint[]) {
  return points.reduce((sum, point, index) => {
    if (index === 0) return 0;
    return sum + distance(point, points[index - 1]);
  }, 0);
}

function pointToLineDistance(point: CanvasPoint, start: CanvasPoint, end: CanvasPoint) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (!length) return distance(point, start);
  const numerator = Math.abs(dy * point.x - dx * point.y + end.x * start.y - end.y * start.x);
  return numerator / length;
}

function getBounds(element: CanvasElement) {
  if (element.type === 'draw') {
    const xs = element.points.map((point) => point.x);
    const ys = element.points.map((point) => point.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  if (element.type === 'rectangle' || element.type === 'sticky') {
    return { x: element.x, y: element.y, width: element.width, height: element.height };
  }

  if (element.type === 'circle') {
    return {
      x: element.x - element.radius,
      y: element.y - element.radius,
      width: element.radius * 2,
      height: element.radius * 2,
    };
  }

  if (element.type === 'line' || element.type === 'arrow') {
    return {
      x: Math.min(element.x1, element.x2),
      y: Math.min(element.y1, element.y2),
      width: Math.abs(element.x2 - element.x1),
      height: Math.abs(element.y2 - element.y1),
    };
  }

  if (element.type === 'text') {
    const lines = element.text.split('\n');
    const widest = lines.reduce((max: number, line: string) => Math.max(max, line.length), 0);
    return {
      x: element.x,
      y: element.y - element.fontSize,
      width: Math.max(120, widest * element.fontSize * 0.55),
      height: Math.max(element.fontSize * 1.5, lines.length * element.fontSize * 1.2),
    };
  }

  return { x: 0, y: 0, width: 0, height: 0 };
}

function isPointInsideElement(point: CanvasPoint, element: CanvasElement) {
  if (element.type === 'draw') {
    return element.points.some((strokePoint) => distance(strokePoint, point) <= Math.max(10, element.strokeWidth + 6));
  }

  if (element.type === 'rectangle' || element.type === 'sticky') {
    return point.x >= element.x && point.x <= element.x + element.width && point.y >= element.y && point.y <= element.y + element.height;
  }

  if (element.type === 'circle') {
    return distance(point, { x: element.x, y: element.y }) <= element.radius;
  }

  if (element.type === 'line' || element.type === 'arrow') {
    const dx = element.x2 - element.x1;
    const dy = element.y2 - element.y1;
    const lengthSq = dx * dx + dy * dy;
    if (!lengthSq) return false;
    const t = ((point.x - element.x1) * dx + (point.y - element.y1) * dy) / lengthSq;
    if (t < 0 || t > 1) return false;
    const projected = {
      x: element.x1 + t * dx,
      y: element.y1 + t * dy,
    };
    return distance(point, projected) <= 12;
  }

  const bounds = getBounds(element);
  return point.x >= bounds.x && point.x <= bounds.x + bounds.width && point.y >= bounds.y && point.y <= bounds.y + bounds.height;
}

function moveElement(element: CanvasElement, dx: number, dy: number): CanvasElement {
  if (element.type === 'draw') {
    return { ...element, points: element.points.map((point) => ({ x: point.x + dx, y: point.y + dy })) };
  }
  if (element.type === 'rectangle' || element.type === 'circle' || element.type === 'text' || element.type === 'sticky') {
    return { ...element, x: element.x + dx, y: element.y + dy } as CanvasElement;
  }
  return {
    ...element,
    x1: element.x1 + dx,
    y1: element.y1 + dy,
    x2: element.x2 + dx,
    y2: element.y2 + dy,
  };
}

function renderArrowHead(element: CanvasLineElement) {
  const angle = Math.atan2(element.y2 - element.y1, element.x2 - element.x1);
  const arrowLength = 16;
  const p1 = {
    x: element.x2 - arrowLength * Math.cos(angle - Math.PI / 6),
    y: element.y2 - arrowLength * Math.sin(angle - Math.PI / 6),
  };
  const p2 = {
    x: element.x2 - arrowLength * Math.cos(angle + Math.PI / 6),
    y: element.y2 - arrowLength * Math.sin(angle + Math.PI / 6),
  };
  return `${element.x2},${element.y2} ${p1.x},${p1.y} ${p2.x},${p2.y}`;
}

function renderPattern(pattern: BackgroundPattern, width: number, height: number, color: string) {
  if (pattern === 'none') return null;

  if (pattern === 'dots') {
    return Array.from({ length: Math.ceil(width / 26) }).flatMap((_, xIndex) =>
      Array.from({ length: Math.ceil(height / 26) }).map((__, yIndex) => (
        <Circle key={`dot-${xIndex}-${yIndex}`} cx={xIndex * 26 + 13} cy={yIndex * 26 + 13} r={1.1} fill={color} />
      ))
    );
  }

  if (pattern === 'lines') {
    return Array.from({ length: Math.ceil(height / 30) }).map((_, index) => (
      <Line key={`line-${index}`} x1={0} y1={index * 30} x2={width} y2={index * 30} stroke={color} strokeWidth={1} />
    ));
  }

  if (pattern === 'cross') {
    return (
      <>
        {Array.from({ length: Math.ceil(width / 30) }).map((_, index) => (
          <Line key={`cross-v-${index}`} x1={index * 30} y1={0} x2={index * 30} y2={height} stroke={color} strokeWidth={1} />
        ))}
        {Array.from({ length: Math.ceil(height / 30) }).map((_, index) => (
          <Line key={`cross-h-${index}`} x1={0} y1={index * 30} x2={width} y2={index * 30} stroke={color} strokeWidth={1} />
        ))}
      </>
    );
  }

  return Array.from({ length: Math.ceil((width + height) / 42) }).map((_, index) => {
    const x = index * 28 - height;
    return <Line key={`diag-${index}`} x1={x} y1={height} x2={x + height} y2={0} stroke={color} strokeWidth={1} />;
  });
}

function createShapePreview(
  tool: ToolMode,
  start: CanvasPoint,
  end: CanvasPoint,
  color: string,
  strokeWidth: number,
  fillColor: string,
  opacity: number
): CanvasElement | null {
  if (tool === 'rectangle') {
    return {
      id: 'preview',
      type: 'rectangle',
      x: Math.min(start.x, end.x),
      y: Math.min(start.y, end.y),
      width: Math.abs(end.x - start.x),
      height: Math.abs(end.y - start.y),
      color,
      strokeWidth,
      fillColor,
      opacity,
    };
  }

  if (tool === 'circle') {
    const center = {
      x: (start.x + end.x) / 2,
      y: (start.y + end.y) / 2,
    };
    return {
      id: 'preview',
      type: 'circle',
      x: center.x,
      y: center.y,
      radius: Math.max(Math.abs(end.x - start.x), Math.abs(end.y - start.y)) / 2,
      color,
      strokeWidth,
      fillColor,
      opacity,
    };
  }

  if (tool === 'line' || tool === 'arrow') {
    return {
      id: 'preview',
      type: tool,
      x1: start.x,
      y1: start.y,
      x2: end.x,
      y2: end.y,
      color,
      strokeWidth,
      opacity,
    };
  }

  return null;
}

function recognizeShape(points: CanvasPoint[]) {
  if (points.length < 8) return null;

  const totalDistance = pathLength(points);
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = maxX - minX;
  const height = maxY - minY;
  const size = Math.max(width, height);
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  const directDistance = distance(firstPoint, lastPoint);
  const straightness = directDistance / totalDistance;
  const maxDeviation = points.reduce((max, point) => Math.max(max, pointToLineDistance(point, firstPoint, lastPoint)), 0);

  if (straightness > 0.92 && maxDeviation < Math.max(4, size * 0.03)) {
    return {
      type: 'line' as const,
      x1: firstPoint.x,
      y1: firstPoint.y,
      x2: lastPoint.x,
      y2: lastPoint.y,
    };
  }

  const closingDistance = distance(firstPoint, lastPoint);
  const isClosed = closingDistance < Math.max(12, size * 0.1);
  if (!isClosed || size < 24) return null;

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const aspectRatio = Math.min(width, height) / Math.max(width, height);
  const radii = points.map((point) => Math.hypot(point.x - centerX, point.y - centerY));
  const avgRadius = radii.reduce((sum, radius) => sum + radius, 0) / radii.length;
  const radiusVariance = radii.reduce((sum, radius) => sum + Math.abs(radius - avgRadius), 0) / radii.length;
  const circularityScore = 1 - radiusVariance / (avgRadius || 1);

  if (circularityScore > 0.82 && aspectRatio > 0.78) {
    return {
      type: 'circle' as const,
      x: centerX,
      y: centerY,
      radius: avgRadius,
    };
  }

  return {
    type: 'rectangle' as const,
    x: minX,
    y: minY,
    width,
    height,
  };
}

function renderTextElement(
  text: string,
  x: number,
  y: number,
  color: string,
  fontSize: number,
  fontFamily?: string,
  opacity = 1
) {
  const family = resolveNoteFont(fontFamily, 'body');
  return text.split('\n').map((line, index) => (
    <SvgText
      key={`${x}-${y}-${index}`}
      x={x}
      y={y + index * fontSize * 1.22}
      fill={color}
      fontSize={fontSize}
      fontFamily={family}
      fontWeight="600"
      opacity={opacity}
    >
      {line || ' '}
    </SvgText>
  ));
}

function renderElement(element: CanvasElement, selected: boolean) {
  const selectionColor = '#f0b465';

  if (element.type === 'draw') {
    return (
      <Path
        key={String(element.id)}
        d={pathFromPoints(element.points)}
        fill="none"
        stroke={selected ? selectionColor : element.color}
        strokeWidth={selected ? element.strokeWidth + 1 : element.strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={element.opacity ?? 1}
      />
    );
  }

  if (element.type === 'rectangle') {
    return (
      <Rect
        key={String(element.id)}
        x={element.x}
        y={element.y}
        width={element.width}
        height={element.height}
        rx={18}
        fill={element.fillColor && element.fillColor !== 'transparent' ? element.fillColor : 'transparent'}
        stroke={selected ? selectionColor : element.color}
        strokeWidth={selected ? element.strokeWidth + 1 : element.strokeWidth}
        opacity={element.opacity ?? 1}
      />
    );
  }

  if (element.type === 'circle') {
    return (
      <Circle
        key={String(element.id)}
        cx={element.x}
        cy={element.y}
        r={element.radius}
        fill={element.fillColor && element.fillColor !== 'transparent' ? element.fillColor : 'transparent'}
        stroke={selected ? selectionColor : element.color}
        strokeWidth={selected ? element.strokeWidth + 1 : element.strokeWidth}
        opacity={element.opacity ?? 1}
      />
    );
  }

  if (element.type === 'line') {
    return (
      <Line
        key={String(element.id)}
        x1={element.x1}
        y1={element.y1}
        x2={element.x2}
        y2={element.y2}
        stroke={selected ? selectionColor : element.color}
        strokeWidth={selected ? element.strokeWidth + 1 : element.strokeWidth}
        strokeLinecap="round"
        opacity={element.opacity ?? 1}
      />
    );
  }

  if (element.type === 'arrow') {
    return (
      <G key={String(element.id)} opacity={element.opacity ?? 1}>
        <Line
          x1={element.x1}
          y1={element.y1}
          x2={element.x2}
          y2={element.y2}
          stroke={selected ? selectionColor : element.color}
          strokeWidth={selected ? element.strokeWidth + 1 : element.strokeWidth}
          strokeLinecap="round"
        />
        <Polygon points={renderArrowHead(element)} fill={selected ? selectionColor : element.color} />
      </G>
    );
  }

  if (element.type === 'text') {
    return (
      <G key={String(element.id)}>
        {renderTextElement(
          element.text,
          element.x,
          element.y,
          selected ? selectionColor : element.color,
          element.fontSize,
          element.fontFamily,
          element.opacity ?? 1
        )}
      </G>
    );
  }

  if (element.type !== 'sticky') {
    return null;
  }

  return (
    <G key={String(element.id)} opacity={element.opacity ?? 1}>
      <Rect
        x={element.x}
        y={element.y}
        width={element.width}
        height={element.height}
        rx={18}
        fill={element.color}
        stroke={selected ? selectionColor : rgbaFromHex('#171717', 0.12)}
        strokeWidth={selected ? 2 : 1}
      />
      {renderTextElement(element.text || 'Sticky note', element.x + 16, element.y + 28, '#2d2d2d', 14, element.fontFamily, 1)}
    </G>
  );
}

export function CanvasPreview({
  canvasData,
  height = 190,
  theme,
}: {
  canvasData?: string;
  height?: number;
  theme: ThemeColors;
}) {
  const width = 320;
  const elements = parseCanvasElements(canvasData);
  const lineColor = rgbaFromHex(theme.textSecondary, theme.isLight ? 0.12 : 0.18);

  return (
    <View
      style={[
        previewStyles.wrap,
        {
          height,
          borderColor: rgbaFromHex(theme.borderStrong, 0.88),
          backgroundColor: '#fffdf8',
        },
      ]}
    >
      <Svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}>
        {renderPattern('lines', width, height, lineColor)}
        {elements.map((element) => renderElement(element, false))}
      </Svg>
      {elements.length === 0 ? (
        <View style={previewStyles.empty}>
          <Ionicons name="brush-outline" size={18} color={theme.textSecondary} />
          <Text style={[previewStyles.emptyText, { color: theme.textSecondary }]}>no canvas content yet</Text>
        </View>
      ) : null}
    </View>
  );
}

export default function CanvasNoteModal({ visible, initialData, theme, onClose, onSave }: Props) {
  const layout = useResponsiveLayout();
  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | number | null>(null);
  const [tool, setTool] = useState<ToolMode>('draw');
  const [drawStyle, setDrawStyle] = useState<DrawStyle>('pen');
  const [color, setColor] = useState<string>(COLORS[0]);
  const [fillColor, setFillColor] = useState('transparent');
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [fontSize, setFontSize] = useState(18);
  const [fontFamily, setFontFamily] = useState('Inter');
  const [opacity, setOpacity] = useState(1);
  const [backgroundPattern, setBackgroundPattern] = useState<BackgroundPattern>('dots');
  const [showGrid, setShowGrid] = useState(false);
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [smoothDrawing, setSmoothDrawing] = useState(true);
  const [shapeRecognition, setShapeRecognition] = useState(true);
  const [canvasSize, setCanvasSize] = useState({ width: 360, height: 580 });
  const [currentStroke, setCurrentStroke] = useState<CanvasDrawElement | null>(null);
  const [previewShape, setPreviewShape] = useState<CanvasElement | null>(null);
  const [history, setHistory] = useState<CanvasElement[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [showTextModal, setShowTextModal] = useState(false);
  const [textDraft, setTextDraft] = useState('');
  const [textTarget, setTextTarget] = useState<{
    mode: 'create' | 'edit';
    tool: 'text' | 'sticky';
    point?: CanvasPoint;
    id?: string | number;
  } | null>(null);

  const elementsRef = useRef<CanvasElement[]>([]);
  const strokeRef = useRef<CanvasDrawElement | null>(null);
  const dragRef = useRef<DragState>(null);
  const historyRef = useRef<CanvasElement[][]>([[]]);
  const historyIndexRef = useRef(0);

  const selectedElement = selectedId != null ? elements.find((element) => element.id === selectedId) ?? null : null;
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;
  const selectedIsShape = selectedElement?.type === 'rectangle' || selectedElement?.type === 'circle';
  const selectedIsText = selectedElement?.type === 'text';
  const selectedIsSticky = selectedElement?.type === 'sticky';
  const selectedIsDraw = selectedElement?.type === 'draw';

  useEffect(() => {
    if (!visible) return;
    const nextElements = cloneElements(parseCanvasElements(initialData));
    const nextHistory = [cloneElements(nextElements)];
    setElements(nextElements);
    elementsRef.current = nextElements;
    setSelectedId(null);
    setTool('draw');
    setDrawStyle('pen');
    setColor(COLORS[0]);
    setFillColor('transparent');
    setStrokeWidth(2);
    setFontSize(18);
    setFontFamily('Inter');
    setOpacity(1);
    setBackgroundPattern('dots');
    setShowGrid(false);
    setSnapToGrid(false);
    setSmoothDrawing(true);
    setShapeRecognition(true);
    setCurrentStroke(null);
    setPreviewShape(null);
    strokeRef.current = null;
    dragRef.current = null;
    historyRef.current = nextHistory;
    historyIndexRef.current = 0;
    setHistory(nextHistory);
    setHistoryIndex(0);
  }, [initialData, visible]);

  useEffect(() => {
    if (!selectedElement) return;
    if ('color' in selectedElement) setColor(selectedElement.color);
    if ('opacity' in selectedElement && typeof selectedElement.opacity === 'number') setOpacity(selectedElement.opacity);
    if (
      selectedElement.type === 'rectangle' ||
      selectedElement.type === 'circle' ||
      selectedElement.type === 'line' ||
      selectedElement.type === 'arrow' ||
      selectedElement.type === 'draw'
    ) {
      setStrokeWidth(selectedElement.strokeWidth);
    }
    if (selectedElement.type === 'rectangle' || selectedElement.type === 'circle') {
      setFillColor(selectedElement.fillColor || 'transparent');
    }
    if (selectedElement.type === 'draw') {
      setDrawStyle(selectedElement.drawStyle || 'pen');
    }
    if (selectedElement.type === 'text') {
      setFontSize(selectedElement.fontSize);
      setFontFamily(normalizeNoteFont(selectedElement.fontFamily));
    }
    if (selectedElement.type === 'sticky') {
      setFontFamily(normalizeNoteFont(selectedElement.fontFamily));
    }
  }, [selectedElement]);

  const commitElements = (nextElements: CanvasElement[], addHistory = true) => {
    const cloned = cloneElements(nextElements);
    setElements(cloned);
    elementsRef.current = cloned;
    if (!addHistory) return;
    const nextHistory = [...historyRef.current.slice(0, historyIndexRef.current + 1), cloneElements(cloned)];
    historyRef.current = nextHistory;
    historyIndexRef.current = nextHistory.length - 1;
    setHistory(nextHistory);
    setHistoryIndex(historyIndexRef.current);
  };

  const patchSelected = (updater: (element: CanvasElement) => CanvasElement) => {
    if (selectedId == null) return;
    commitElements(elementsRef.current.map((element) => (element.id === selectedId ? updater(element) : element)));
  };

  const toCanvasPoint = (x: number, y: number): CanvasPoint => {
    let point = { x, y };
    if (showGrid && snapToGrid) {
      point = {
        x: Math.round(point.x / 30) * 30,
        y: Math.round(point.y / 30) * 30,
      };
    }
    return point;
  };

  const handleUndo = () => {
    if (!canUndo) return;
    const nextIndex = historyIndexRef.current - 1;
    historyIndexRef.current = nextIndex;
    setHistoryIndex(nextIndex);
    const nextElements = cloneElements(historyRef.current[nextIndex]);
    setElements(nextElements);
    elementsRef.current = nextElements;
    setSelectedId(null);
  };

  const handleRedo = () => {
    if (!canRedo) return;
    const nextIndex = historyIndexRef.current + 1;
    historyIndexRef.current = nextIndex;
    setHistoryIndex(nextIndex);
    const nextElements = cloneElements(historyRef.current[nextIndex]);
    setElements(nextElements);
    elementsRef.current = nextElements;
    setSelectedId(null);
  };

  const handleDelete = () => {
    if (selectedId == null) return;
    commitElements(elementsRef.current.filter((element) => element.id !== selectedId));
    setSelectedId(null);
  };

  const handleDuplicate = () => {
    if (!selectedElement) return;
    const dx = 24;
    const dy = 24;
    const nextId = `${selectedElement.type}-${Date.now()}`;
    const duplicate = moveElement({ ...selectedElement, id: nextId } as CanvasElement, dx, dy);
    commitElements([...elementsRef.current, duplicate]);
    setSelectedId(duplicate.id);
  };

  const handleClear = () => {
    if (!elementsRef.current.length) return;
    commitElements([]);
    setSelectedId(null);
  };

  const openTextEditor = (
    toolType: 'text' | 'sticky',
    mode: 'create' | 'edit',
    point?: CanvasPoint,
    id?: string | number,
    initialText = ''
  ) => {
    setTextTarget({ tool: toolType, mode, point, id });
    setTextDraft(initialText);
    setShowTextModal(true);
  };

  const closeTextModal = () => {
    setShowTextModal(false);
    setTextDraft('');
    setTextTarget(null);
  };

  const saveTextEditor = () => {
    if (!textTarget) return;

    if (textTarget.mode === 'edit' && textTarget.id != null) {
      commitElements(elementsRef.current.map((element) => {
        if (element.id !== textTarget.id) return element;
        if (element.type === 'text' || element.type === 'sticky') {
          return { ...element, text: textDraft, fontFamily: normalizeNoteFont(fontFamily) };
        }
        return element;
      }));
    } else if (textTarget.point) {
      const nextElement: CanvasElement =
        textTarget.tool === 'text'
          ? {
              id: `text-${Date.now()}`,
              type: 'text',
              x: textTarget.point.x,
              y: textTarget.point.y,
              text: textDraft || 'Text',
              color,
              fontSize,
              fontFamily: normalizeNoteFont(fontFamily),
              opacity,
            }
          : {
              id: `sticky-${Date.now()}`,
              type: 'sticky',
              x: textTarget.point.x,
              y: textTarget.point.y,
              width: 220,
              height: 160,
              text: textDraft || 'Sticky note',
              color: STICKY_COLORS.includes(color as (typeof STICKY_COLORS)[number]) ? color : STICKY_COLORS[0],
              fontFamily: normalizeNoteFont(fontFamily),
              opacity,
              priority: 'normal',
              timestamp: new Date().toISOString(),
            };
      commitElements([...elementsRef.current, nextElement]);
      setSelectedId(nextElement.id);
    }

    closeTextModal();
  };

  const saveCanvas = () => {
    const canvasData = serializeCanvasElements(elementsRef.current);
    const previewData = createCanvasPreviewDataUrl(canvasData, Math.max(320, canvasSize.width), Math.max(220, canvasSize.height));
    onSave(canvasData, previewData);
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          const point = toCanvasPoint(event.nativeEvent.locationX, event.nativeEvent.locationY);
          const hit = [...elementsRef.current].reverse().find((element) => isPointInsideElement(point, element));

          if (tool === 'select') {
            if (hit) {
              setSelectedId(hit.id);
              dragRef.current = {
                mode: 'move',
                start: point,
                selectedId: hit.id,
                originElement: hit,
              };
            } else {
              setSelectedId(null);
              dragRef.current = null;
            }
            return;
          }

          if (tool === 'eraser') {
            dragRef.current = { mode: 'erase' };
            const remaining = elementsRef.current.filter((element) => !isPointInsideElement(point, element));
            if (remaining.length !== elementsRef.current.length) {
              elementsRef.current = remaining;
              setElements(cloneElements(remaining));
              setSelectedId(null);
            }
            return;
          }

          if (tool === 'text' || tool === 'sticky') {
            openTextEditor(tool, 'create', point);
            return;
          }

          if (tool === 'draw') {
            const nextStroke: CanvasDrawElement = {
              id: `draw-${Date.now()}`,
              type: 'draw',
              points: [point],
              color,
              strokeWidth: effectiveStrokeWidth(drawStyle, strokeWidth),
              opacity: normalizeOpacity(drawStyle, opacity),
              drawStyle,
            };
            strokeRef.current = nextStroke;
            setCurrentStroke(nextStroke);
            return;
          }

          dragRef.current = { mode: 'shape', start: point, tool };
          setPreviewShape(createShapePreview(tool, point, point, color, strokeWidth, fillColor, opacity));
        },
        onPanResponderMove: (event) => {
          const point = toCanvasPoint(event.nativeEvent.locationX, event.nativeEvent.locationY);
          const active = dragRef.current;

          if (tool === 'draw' && strokeRef.current && !active) {
            const current = strokeRef.current;
            if (distance(current.points[current.points.length - 1], point) >= 1) {
              current.points.push(point);
              setCurrentStroke({ ...current, points: [...current.points] });
            }
            return;
          }

          if (!active) return;

          if (active.mode === 'move') {
            const dx = point.x - active.start.x;
            const dy = point.y - active.start.y;
            setElements(elementsRef.current.map((element) => (
              element.id === active.selectedId ? moveElement(active.originElement, dx, dy) : element
            )));
            return;
          }

          if (active.mode === 'erase') {
            const remaining = elementsRef.current.filter((element) => !isPointInsideElement(point, element));
            if (remaining.length !== elementsRef.current.length) {
              elementsRef.current = remaining;
              setElements(cloneElements(remaining));
            }
            return;
          }

          if (active.mode === 'shape') {
            setPreviewShape(createShapePreview(active.tool, active.start, point, color, strokeWidth, fillColor, opacity));
            return;
          }
        },
        onPanResponderRelease: (event) => {
          const point = toCanvasPoint(event.nativeEvent.locationX, event.nativeEvent.locationY);
          const active = dragRef.current;

          if (tool === 'draw' && strokeRef.current) {
            let points = simplifyStrokePoints(strokeRef.current.points, 1.6);
            if (smoothDrawing) points = smoothPath(points);

            if (points.length > 1) {
              if (shapeRecognition) {
                const recognized = recognizeShape(points);
                if (recognized) {
                  const recognizedElement: CanvasElement =
                    recognized.type === 'line'
                      ? {
                          id: `line-${Date.now()}`,
                          type: 'line',
                          x1: recognized.x1,
                          y1: recognized.y1,
                          x2: recognized.x2,
                          y2: recognized.y2,
                          color,
                          strokeWidth,
                          opacity,
                        }
                      : recognized.type === 'circle'
                        ? {
                            id: `circle-${Date.now()}`,
                            type: 'circle',
                            x: recognized.x,
                            y: recognized.y,
                            radius: recognized.radius,
                            color,
                            strokeWidth,
                            fillColor,
                            opacity,
                          }
                        : {
                            id: `rectangle-${Date.now()}`,
                            type: 'rectangle',
                            x: recognized.x,
                            y: recognized.y,
                            width: recognized.width,
                            height: recognized.height,
                            color,
                            strokeWidth,
                            fillColor,
                            opacity,
                          };
                  commitElements([...elementsRef.current, recognizedElement]);
                  setSelectedId(recognizedElement.id);
                } else {
                  const nextStroke = { ...strokeRef.current, points };
                  commitElements([...elementsRef.current, nextStroke]);
                  setSelectedId(nextStroke.id);
                }
              } else {
                const nextStroke = { ...strokeRef.current, points };
                commitElements([...elementsRef.current, nextStroke]);
                setSelectedId(nextStroke.id);
              }
            }

            strokeRef.current = null;
            setCurrentStroke(null);
          } else if (active?.mode === 'move') {
            const dx = point.x - active.start.x;
            const dy = point.y - active.start.y;
            commitElements(elementsRef.current.map((element) => (
              element.id === active.selectedId ? moveElement(active.originElement, dx, dy) : element
            )));
          } else if (active?.mode === 'erase') {
            commitElements(elementsRef.current);
          } else if (active?.mode === 'shape' && previewShape) {
            const valid =
              (previewShape.type === 'rectangle' && previewShape.width > 4 && previewShape.height > 4) ||
              (previewShape.type === 'circle' && previewShape.radius > 4) ||
              ((previewShape.type === 'line' || previewShape.type === 'arrow') &&
                (Math.abs(previewShape.x2 - previewShape.x1) > 4 || Math.abs(previewShape.y2 - previewShape.y1) > 4));
            if (valid) {
              const nextElement = { ...previewShape, id: `${previewShape.type}-${Date.now()}` } as CanvasElement;
              commitElements([...elementsRef.current, nextElement]);
              setSelectedId(nextElement.id);
            }
            setPreviewShape(null);
          }

          dragRef.current = null;
        },
        onPanResponderTerminate: () => {
          dragRef.current = null;
          strokeRef.current = null;
          setCurrentStroke(null);
          setPreviewShape(null);
        },
      }),
    [color, drawStyle, fillColor, opacity, previewShape, shapeRecognition, showGrid, smoothDrawing, snapToGrid, strokeWidth, tool]
  );

  const onCanvasLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setCanvasSize({ width, height });
    }
  };

  const toolbarBorder = rgbaFromHex(theme.borderStrong, theme.isLight ? 0.88 : 0.84);
  const softAccent = rgbaFromHex(theme.accent, theme.isLight ? 0.1 : 0.16);
  const paperInk = rgbaFromHex(theme.textSecondary, theme.isLight ? 0.1 : 0.16);
  const showSideDock = layout.isTablet && layout.isLandscape;
  const useWrappedToolbar = layout.isTablet;
  const dockWidth = layout.threeColumn ? 372 : 334;
  const minimumStageHeight = showSideDock ? Math.max(520, layout.height - 210) : layout.isTablet ? 520 : 340;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={[styles.root, { backgroundColor: theme.bgPrimary }]}>
        <View style={[styles.header, { borderBottomColor: toolbarBorder }]}>
          <HapticTouchable onPress={onClose} style={styles.headerBtn} haptic="selection">
            <Ionicons name="chevron-back" size={22} color={theme.accentHover} />
          </HapticTouchable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: theme.accentHover }]}>canvas</Text>
            <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>rebuilt for reliable drawing, writing, and moving</Text>
          </View>
          <HapticTouchable style={[styles.headerSaveBtn, { backgroundColor: theme.accent }]} onPress={saveCanvas} haptic="success">
            <Text style={[styles.headerSaveText, { color: theme.bgPrimary }]}>save</Text>
          </HapticTouchable>
        </View>

        <View style={styles.workspace}>
          <View style={[styles.toolbarCard, useWrappedToolbar && styles.toolbarCardWide, { borderColor: toolbarBorder, backgroundColor: rgbaFromHex(theme.panel, 0.96) }]}>
            {useWrappedToolbar ? (
              <View style={styles.toolGrid}>
                {TOOLS.map((toolDef) => {
                  const active = toolDef.value === tool;
                  return (
                    <HapticTouchable
                      key={toolDef.value}
                      style={[
                        styles.toolChip,
                        styles.toolChipWide,
                        {
                          borderColor: active ? theme.accent : toolbarBorder,
                          backgroundColor: active ? theme.accent : rgbaFromHex(theme.panelAlt, 0.96),
                        },
                      ]}
                      onPress={() => setTool(toolDef.value)}
                      haptic="selection"
                    >
                      <Ionicons name={toolDef.icon} size={16} color={active ? theme.bgPrimary : theme.accentHover} />
                      <Text style={[styles.toolChipText, { color: active ? theme.bgPrimary : theme.accentHover }]}>{toolDef.label}</Text>
                    </HapticTouchable>
                  );
                })}
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.toolRow}>
                {TOOLS.map((toolDef) => {
                  const active = toolDef.value === tool;
                  return (
                    <HapticTouchable
                      key={toolDef.value}
                      style={[
                        styles.toolChip,
                        {
                          borderColor: active ? theme.accent : toolbarBorder,
                          backgroundColor: active ? theme.accent : rgbaFromHex(theme.panelAlt, 0.96),
                        },
                      ]}
                      onPress={() => setTool(toolDef.value)}
                      haptic="selection"
                    >
                      <Ionicons name={toolDef.icon} size={16} color={active ? theme.bgPrimary : theme.accentHover} />
                      <Text style={[styles.toolChipText, { color: active ? theme.bgPrimary : theme.accentHover }]}>{toolDef.label}</Text>
                    </HapticTouchable>
                  );
                })}
              </ScrollView>
            )}
          </View>

          <View style={[styles.canvasBody, showSideDock && styles.canvasBodyWide]}>
            <View style={[styles.stageWrap, showSideDock && styles.stageWrapWide]}>
              <View
                style={[
                  styles.stageCard,
                  showSideDock && styles.stageCardWide,
                  { borderColor: toolbarBorder, backgroundColor: '#fffdf8', minHeight: minimumStageHeight },
                ]}
                onLayout={onCanvasLayout}
              >
                <View style={styles.stageMetaRow}>
                  <View style={[styles.stageBadge, { borderColor: toolbarBorder, backgroundColor: rgbaFromHex(theme.panel, 0.9) }]}>
                    <Text style={[styles.stageBadgeText, { color: theme.accentHover }]}>
                      {selectedElement ? `${selectedElement.type} selected` : `${elements.length} item${elements.length === 1 ? '' : 's'}`}
                    </Text>
                  </View>
                  <View style={styles.inlineActionRow}>
                    <HapticTouchable style={[styles.inlineIconBtn, { borderColor: toolbarBorder }]} onPress={handleUndo} disabled={!canUndo} haptic="selection">
                      <Ionicons name="arrow-undo-outline" size={18} color={canUndo ? theme.accentHover : theme.textSecondary} />
                    </HapticTouchable>
                    <HapticTouchable style={[styles.inlineIconBtn, { borderColor: toolbarBorder }]} onPress={handleRedo} disabled={!canRedo} haptic="selection">
                      <Ionicons name="arrow-redo-outline" size={18} color={canRedo ? theme.accentHover : theme.textSecondary} />
                    </HapticTouchable>
                  </View>
                </View>

                <View style={[styles.stageTouchArea, showSideDock && styles.stageTouchAreaWide]} {...panResponder.panHandlers}>
                  <Svg width="100%" height="100%" viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`}>
                    <Rect x={0} y={0} width={canvasSize.width} height={canvasSize.height} fill="#fffdf8" />
                    {renderPattern(backgroundPattern, canvasSize.width, canvasSize.height, paperInk)}
                    {showGrid ? (
                      <>
                        {Array.from({ length: Math.ceil(canvasSize.width / 30) }).map((_, index) => (
                          <Line key={`grid-v-${index}`} x1={index * 30} y1={0} x2={index * 30} y2={canvasSize.height} stroke={rgbaFromHex(theme.textSecondary, 0.08)} strokeWidth={1} />
                        ))}
                        {Array.from({ length: Math.ceil(canvasSize.height / 30) }).map((_, index) => (
                          <Line key={`grid-h-${index}`} x1={0} y1={index * 30} x2={canvasSize.width} y2={index * 30} stroke={rgbaFromHex(theme.textSecondary, 0.08)} strokeWidth={1} />
                        ))}
                      </>
                    ) : null}

                    {elements.map((element) => (
                      <G key={String(element.id)}>
                        {renderElement(element, selectedId === element.id)}
                        {selectedId === element.id ? (() => {
                          const bounds = getBounds(element);
                          return (
                            <Rect
                              x={bounds.x - 8}
                              y={bounds.y - 8}
                              width={Math.max(20, bounds.width + 16)}
                              height={Math.max(20, bounds.height + 16)}
                              fill="none"
                              stroke="#f0b465"
                              strokeWidth={1.5}
                              strokeDasharray="6 4"
                              rx={14}
                            />
                          );
                        })() : null}
                      </G>
                    ))}

                    {previewShape ? renderElement(previewShape, true) : null}
                    {currentStroke ? renderElement(currentStroke, false) : null}
                  </Svg>
                </View>
              </View>
            </View>

            <View
              style={[
                styles.dockCard,
                showSideDock ? styles.dockCardSide : styles.dockCardBottom,
                { borderTopColor: toolbarBorder, backgroundColor: rgbaFromHex(theme.panel, 0.98), width: showSideDock ? dockWidth : undefined, borderLeftColor: toolbarBorder },
              ]}
            >
              <ScrollView contentContainerStyle={styles.dockContent} showsVerticalScrollIndicator={false}>
            <View style={styles.propertyGroup}>
              <Text style={[styles.sectionLabel, { color: theme.accentHover }]}>actions</Text>
              <View style={styles.inlineActionRow}>
                <HapticTouchable style={[styles.actionChip, { borderColor: toolbarBorder, backgroundColor: softAccent }]} onPress={handleDuplicate} disabled={!selectedElement} haptic="selection">
                  <Ionicons name="duplicate-outline" size={16} color={selectedElement ? theme.accentHover : theme.textSecondary} />
                  <Text style={[styles.actionChipText, { color: selectedElement ? theme.accentHover : theme.textSecondary }]}>duplicate</Text>
                </HapticTouchable>
                <HapticTouchable style={[styles.actionChip, { borderColor: toolbarBorder, backgroundColor: softAccent }]} onPress={handleDelete} disabled={!selectedElement} haptic="warning">
                  <Ionicons name="trash-outline" size={16} color={selectedElement ? theme.danger : theme.textSecondary} />
                  <Text style={[styles.actionChipText, { color: selectedElement ? theme.danger : theme.textSecondary }]}>delete</Text>
                </HapticTouchable>
                <HapticTouchable style={[styles.actionChip, { borderColor: toolbarBorder, backgroundColor: softAccent }]} onPress={handleClear} disabled={!elements.length} haptic="warning">
                  <Ionicons name="close-circle-outline" size={16} color={elements.length ? theme.danger : theme.textSecondary} />
                  <Text style={[styles.actionChipText, { color: elements.length ? theme.danger : theme.textSecondary }]}>clear</Text>
                </HapticTouchable>
                {(selectedIsText || selectedIsSticky) ? (
                  <HapticTouchable
                    style={[styles.actionChip, { borderColor: theme.accent, backgroundColor: rgbaFromHex(theme.accent, 0.16) }]}
                    onPress={() => openTextEditor(selectedIsSticky ? 'sticky' : 'text', 'edit', undefined, selectedElement?.id, selectedElement?.text ?? '')}
                    haptic="selection"
                  >
                    <Ionicons name="create-outline" size={16} color={theme.accentHover} />
                    <Text style={[styles.actionChipText, { color: theme.accentHover }]}>edit text</Text>
                  </HapticTouchable>
                ) : null}
              </View>
            </View>

            <View style={styles.propertyGroup}>
              <Text style={[styles.sectionLabel, { color: theme.accentHover }]}>color</Text>
              <View style={styles.paletteWrap}>
                {(tool === 'sticky' || selectedIsSticky ? STICKY_COLORS : COLORS).map((preset) => {
                  const active = color === preset;
                  return (
                    <HapticTouchable
                      key={preset}
                      style={[styles.colorDot, { backgroundColor: preset, borderColor: active ? theme.accentHover : toolbarBorder }]}
                      onPress={() => {
                        setColor(preset);
                        if (selectedId != null) {
                          patchSelected((element) => ('color' in element ? { ...element, color: preset } : element));
                        }
                      }}
                      haptic="selection"
                    >
                      {active ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
                    </HapticTouchable>
                  );
                })}
              </View>
            </View>

            <View style={styles.propertyGroup}>
              <Text style={[styles.sectionLabel, { color: theme.accentHover }]}>stroke</Text>
              <View style={styles.strokeWrap}>
                {STROKE_WIDTHS.map((width) => (
                  <HapticTouchable
                    key={width}
                    style={[
                      styles.strokeChip,
                      {
                        borderColor: strokeWidth === width ? theme.accent : toolbarBorder,
                        backgroundColor: strokeWidth === width ? softAccent : rgbaFromHex(theme.panelAlt, 0.96),
                      },
                    ]}
                    onPress={() => {
                      setStrokeWidth(width);
                      if (selectedId != null) {
                        patchSelected((element) => {
                          if (element.type === 'draw') {
                            return { ...element, strokeWidth: effectiveStrokeWidth(drawStyle, width) };
                          }
                          if (
                            element.type === 'rectangle' ||
                            element.type === 'circle' ||
                            element.type === 'line' ||
                            element.type === 'arrow'
                          ) {
                            return { ...element, strokeWidth: width };
                          }
                          return element;
                        });
                      }
                    }}
                    haptic="selection"
                  >
                    <View style={{ width: 28, height: Math.max(2, width), borderRadius: width / 2, backgroundColor: theme.accentHover }} />
                  </HapticTouchable>
                ))}
              </View>
            </View>

            {(tool === 'draw' || selectedIsDraw) ? (
              <View style={styles.propertyGroup}>
                <Text style={[styles.sectionLabel, { color: theme.accentHover }]}>draw style</Text>
                <View style={styles.inlineActionRow}>
                  {(['pen', 'marker', 'highlighter'] as DrawStyle[]).map((value) => (
                    <HapticTouchable
                      key={value}
                      style={[
                        styles.actionChip,
                        {
                          borderColor: drawStyle === value ? theme.accent : toolbarBorder,
                          backgroundColor: drawStyle === value ? softAccent : rgbaFromHex(theme.panelAlt, 0.96),
                        },
                      ]}
                      onPress={() => setDrawStyle(value)}
                      haptic="selection"
                    >
                      <Text style={[styles.actionChipText, { color: theme.accentHover }]}>{value}</Text>
                    </HapticTouchable>
                  ))}
                </View>
              </View>
            ) : null}

            {(tool === 'rectangle' || tool === 'circle' || selectedIsShape) ? (
              <View style={styles.propertyGroup}>
                <Text style={[styles.sectionLabel, { color: theme.accentHover }]}>fill</Text>
                <View style={styles.paletteWrap}>
                  <HapticTouchable
                    style={[styles.colorDot, { backgroundColor: '#ffffff', borderColor: fillColor === 'transparent' ? theme.accentHover : toolbarBorder }]}
                    onPress={() => {
                      setFillColor('transparent');
                      if (selectedId != null) {
                        patchSelected((element) => (
                          element.type === 'rectangle' || element.type === 'circle'
                            ? { ...element, fillColor: 'transparent' }
                            : element
                        ));
                      }
                    }}
                    haptic="selection"
                  >
                    <Ionicons name="close" size={14} color={theme.danger} />
                  </HapticTouchable>
                  {COLORS.map((preset) => (
                    <HapticTouchable
                      key={`fill-${preset}`}
                      style={[styles.colorDot, { backgroundColor: preset, borderColor: fillColor === preset ? theme.accentHover : toolbarBorder }]}
                      onPress={() => {
                        setFillColor(preset);
                        if (selectedId != null) {
                          patchSelected((element) => (
                            element.type === 'rectangle' || element.type === 'circle'
                              ? { ...element, fillColor: preset }
                              : element
                          ));
                        }
                      }}
                      haptic="selection"
                    />
                  ))}
                </View>
              </View>
            ) : null}

            {(tool === 'text' || selectedIsText || tool === 'sticky' || selectedIsSticky) ? (
              <View style={styles.propertyGroup}>
                <Text style={[styles.sectionLabel, { color: theme.accentHover }]}>font</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.inlineActionRow}>
                  {NOTE_FONT_OPTIONS.map((font) => (
                    <HapticTouchable
                      key={font}
                      style={[
                        styles.actionChip,
                        {
                          borderColor: fontFamily === font ? theme.accent : toolbarBorder,
                          backgroundColor: fontFamily === font ? softAccent : rgbaFromHex(theme.panelAlt, 0.96),
                        },
                      ]}
                      onPress={() => {
                        setFontFamily(font);
                        if (selectedId != null) {
                          patchSelected((element) => (
                            element.type === 'text' || element.type === 'sticky'
                              ? { ...element, fontFamily: font }
                              : element
                          ));
                        }
                      }}
                      haptic="selection"
                    >
                      <Text style={[styles.actionChipText, { color: theme.accentHover, fontFamily: resolveNoteFont(font, 'body') }]}>{font}</Text>
                    </HapticTouchable>
                  ))}
                </ScrollView>
                {(tool === 'text' || selectedIsText) ? (
                  <View style={styles.inlineActionRow}>
                    {FONT_SIZES.map((size) => (
                      <HapticTouchable
                        key={size}
                        style={[
                          styles.actionChip,
                          {
                            borderColor: fontSize === size ? theme.accent : toolbarBorder,
                            backgroundColor: fontSize === size ? softAccent : rgbaFromHex(theme.panelAlt, 0.96),
                          },
                        ]}
                        onPress={() => {
                          setFontSize(size);
                          if (selectedId != null) {
                            patchSelected((element) => (
                              element.type === 'text' ? { ...element, fontSize: size } : element
                            ));
                          }
                        }}
                        haptic="selection"
                      >
                        <Text style={[styles.actionChipText, { color: theme.accentHover }]}>{size}</Text>
                      </HapticTouchable>
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}

            <View style={styles.propertyGroup}>
              <Text style={[styles.sectionLabel, { color: theme.accentHover }]}>opacity</Text>
              <View style={styles.inlineActionRow}>
                {[0.25, 0.5, 0.75, 1].map((value) => (
                  <HapticTouchable
                    key={String(value)}
                    style={[
                      styles.actionChip,
                      {
                        borderColor: opacity === value ? theme.accent : toolbarBorder,
                        backgroundColor: opacity === value ? softAccent : rgbaFromHex(theme.panelAlt, 0.96),
                      },
                    ]}
                    onPress={() => {
                      setOpacity(value);
                      if (selectedId != null) {
                        patchSelected((element) => (
                          element.type === 'draw'
                            ? { ...element, opacity: normalizeOpacity(drawStyle, value) }
                            : { ...element, opacity: value }
                        ));
                      }
                    }}
                    haptic="selection"
                  >
                    <Text style={[styles.actionChipText, { color: theme.accentHover }]}>{Math.round(value * 100)}%</Text>
                  </HapticTouchable>
                ))}
              </View>
            </View>

            <View style={styles.propertyGroup}>
              <Text style={[styles.sectionLabel, { color: theme.accentHover }]}>canvas</Text>
              <View style={styles.inlineActionRow}>
                {[
                  ['grid', showGrid, () => setShowGrid((value) => !value)],
                  ['snap', snapToGrid, () => setSnapToGrid((value) => !value)],
                  ['smooth', smoothDrawing, () => setSmoothDrawing((value) => !value)],
                  ['shape detect', shapeRecognition, () => setShapeRecognition((value) => !value)],
                ].map(([label, active, onPress]) => (
                  <HapticTouchable
                    key={String(label)}
                    style={[
                      styles.actionChip,
                      {
                        borderColor: active ? theme.accent : toolbarBorder,
                        backgroundColor: active ? softAccent : rgbaFromHex(theme.panelAlt, 0.96),
                      },
                    ]}
                    onPress={onPress as () => void}
                    haptic="selection"
                  >
                    <Text style={[styles.actionChipText, { color: theme.accentHover }]}>{label as string}</Text>
                  </HapticTouchable>
                ))}
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.inlineActionRow}>
                {(['dots', 'lines', 'cross', 'diagonal', 'none'] as BackgroundPattern[]).map((pattern) => (
                  <HapticTouchable
                    key={pattern}
                    style={[
                      styles.actionChip,
                      {
                        borderColor: backgroundPattern === pattern ? theme.accent : toolbarBorder,
                        backgroundColor: backgroundPattern === pattern ? softAccent : rgbaFromHex(theme.panelAlt, 0.96),
                      },
                    ]}
                    onPress={() => setBackgroundPattern(pattern)}
                    haptic="selection"
                  >
                    <Text style={[styles.actionChipText, { color: theme.accentHover }]}>{pattern}</Text>
                  </HapticTouchable>
                ))}
              </ScrollView>
            </View>
            </ScrollView>
            </View>
          </View>
        </View>

        <Modal transparent animationType="fade" visible={showTextModal} onRequestClose={closeTextModal}>
          <View style={styles.textModalRoot}>
            <Pressable style={styles.textModalBackdrop} onPress={closeTextModal} />
            <View style={[styles.textModalCard, { backgroundColor: theme.panel, borderColor: toolbarBorder }]}>
              <Text style={[styles.textModalTitle, { color: theme.accentHover }]}>
                {textTarget ? `${textTarget.mode === 'edit' ? 'Edit' : 'Add'} ${textTarget.tool === 'sticky' ? 'Sticky Note' : 'Text'}` : 'Edit'}
              </Text>
              <TextInput
                value={textDraft}
                onChangeText={setTextDraft}
                multiline
                autoFocus
                placeholder={textTarget?.tool === 'sticky' ? 'Write your sticky note...' : 'Write your canvas text...'}
                placeholderTextColor={theme.textSecondary}
                style={[
                  styles.textModalInput,
                  {
                    color: theme.accentHover,
                    borderColor: toolbarBorder,
                    backgroundColor: theme.panelAlt,
                    fontFamily: resolveNoteFont(fontFamily, 'body'),
                  },
                ]}
              />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.inlineActionRow}>
                {NOTE_FONT_OPTIONS.map((font) => (
                  <HapticTouchable
                    key={`modal-${font}`}
                    style={[
                      styles.actionChip,
                      {
                        borderColor: fontFamily === font ? theme.accent : toolbarBorder,
                        backgroundColor: fontFamily === font ? softAccent : rgbaFromHex(theme.panelAlt, 0.96),
                      },
                    ]}
                    onPress={() => setFontFamily(font)}
                    haptic="selection"
                  >
                    <Text style={[styles.actionChipText, { color: theme.accentHover, fontFamily: resolveNoteFont(font, 'body') }]}>{font}</Text>
                  </HapticTouchable>
                ))}
              </ScrollView>
              <View style={styles.textModalActions}>
                <HapticTouchable style={[styles.textModalBtnSecondary, { borderColor: toolbarBorder, backgroundColor: theme.panelAlt }]} onPress={closeTextModal} haptic="selection">
                  <Text style={[styles.textModalBtnSecondaryText, { color: theme.accentHover }]}>cancel</Text>
                </HapticTouchable>
                <HapticTouchable style={[styles.textModalBtnPrimary, { backgroundColor: theme.accent }]} onPress={saveTextEditor} haptic="success">
                  <Text style={[styles.textModalBtnPrimaryText, { color: theme.bgPrimary }]}>save</Text>
                </HapticTouchable>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
}

const previewStyles = StyleSheet.create({
  wrap: {
    width: '100%',
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  empty: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'lowercase',
  },
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.6,
    textTransform: 'lowercase',
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'lowercase',
  },
  headerSaveBtn: {
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  headerSaveText: {
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'lowercase',
  },
  toolbarCard: {
    marginHorizontal: 12,
    marginTop: 12,
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
  },
  toolbarCardWide: {
    overflow: 'visible',
  },
  toolRow: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  toolGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  toolChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  toolChipWide: {
    minWidth: 114,
    justifyContent: 'center',
  },
  toolChipText: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'lowercase',
  },
  workspace: {
    flex: 1,
  },
  canvasBody: {
    flex: 1,
  },
  canvasBodyWide: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  stageWrap: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 10,
  },
  stageWrapWide: {
    paddingRight: 10,
    paddingBottom: 12,
  },
  stageCard: {
    flex: 1,
    borderRadius: 34,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 10,
  },
  stageCardWide: {
    padding: 12,
  },
  stageMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 10,
  },
  stageBadge: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  stageBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'lowercase',
  },
  stageTouchArea: {
    flex: 1,
    borderRadius: 28,
    overflow: 'hidden',
  },
  stageTouchAreaWide: {
    minHeight: 420,
  },
  inlineActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  inlineIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.36)',
  },
  dockCard: {
    minHeight: 230,
  },
  dockCardBottom: {
    borderTopWidth: 1,
    maxHeight: 290,
  },
  dockCardSide: {
    borderLeftWidth: 1,
  },
  dockContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 22,
    gap: 14,
  },
  propertyGroup: {
    gap: 10,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'lowercase',
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  actionChipText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'lowercase',
  },
  paletteWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  colorDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  strokeWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  strokeChip: {
    width: 48,
    height: 38,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textModalRoot: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: 'rgba(10, 12, 20, 0.45)',
  },
  textModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  textModalCard: {
    borderRadius: 26,
    borderWidth: 1,
    padding: 18,
    gap: 12,
  },
  textModalTitle: {
    fontSize: 18,
    fontWeight: '900',
    textTransform: 'lowercase',
  },
  textModalInput: {
    minHeight: 132,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  textModalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  textModalBtnSecondary: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  textModalBtnSecondaryText: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'lowercase',
  },
  textModalBtnPrimary: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  textModalBtnPrimaryText: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'lowercase',
  },
});

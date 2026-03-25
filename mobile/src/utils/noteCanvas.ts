import { Buffer } from 'buffer';
import { getStroke } from 'perfect-freehand';

export type CanvasPoint = {
  x: number;
  y: number;
};

export type CanvasDrawStyle =
  | 'pen'
  | 'pencil'
  | 'fountain'
  | 'brush'
  | 'crayon'
  | 'marker'
  | 'highlighter'
  | 'charcoal'
  | 'calligraphy'
  | 'spray'
  | 'chalk';

export type CanvasStrokePattern = 'solid' | 'dashed' | 'dotted';
export type CanvasPolygonKind = 'triangle' | 'diamond' | 'star';

export type CanvasDrawElement = {
  id: string | number;
  type: 'draw';
  points: CanvasPoint[];
  color: string;
  strokeWidth: number;
  opacity?: number;
  drawStyle?: CanvasDrawStyle;
};

export type CanvasRectangleElement = {
  id: string | number;
  type: 'rectangle';
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  strokeWidth: number;
  strokePattern?: CanvasStrokePattern;
  fillColor?: string;
  opacity?: number;
};

export type CanvasCircleElement = {
  id: string | number;
  type: 'circle';
  x: number;
  y: number;
  radius: number;
  color: string;
  strokeWidth: number;
  strokePattern?: CanvasStrokePattern;
  fillColor?: string;
  opacity?: number;
};

export type CanvasLineElement = {
  id: string | number;
  type: 'line' | 'arrow';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  strokeWidth: number;
  strokePattern?: CanvasStrokePattern;
  opacity?: number;
};

export type CanvasPolygonElement = {
  id: string | number;
  type: 'polygon';
  polygonKind: CanvasPolygonKind;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  strokeWidth: number;
  strokePattern?: CanvasStrokePattern;
  fillColor?: string;
  opacity?: number;
};

export type CanvasTextElement = {
  id: string | number;
  type: 'text';
  x: number;
  y: number;
  text: string;
  color: string;
  fontSize: number;
  fontFamily?: string;
  opacity?: number;
};

export type CanvasStickyElement = {
  id: string | number;
  type: 'sticky';
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  color: string;
  fontFamily?: string;
  opacity?: number;
  priority?: 'normal' | 'important' | 'urgent';
  timestamp?: string;
};

export type CanvasElement =
  | CanvasDrawElement
  | CanvasRectangleElement
  | CanvasCircleElement
  | CanvasLineElement
  | CanvasPolygonElement
  | CanvasTextElement
  | CanvasStickyElement;

export type NoteCanvasBlock =
  | {
      id: string;
      type: 'text';
      content: string;
    }
  | {
      id: string;
      type: 'canvas';
      canvasData: string;
      canvasPreview: string;
    };

const CANVAS_BLOCK_RE = /<div class="canvas-block"[^>]*data-block-type="canvas"[^>]*data-canvas="([^"]*)"[^>]*data-thumb="([^"]*)"[^>]*><\/div>/gi;

export function encodeBlockPayload(value: string) {
  if (!value) return '';
  try {
    return Buffer.from(value, 'utf8').toString('base64');
  } catch {
    return '';
  }
}

export function decodeBlockPayload(value: string) {
  if (!value) return '';
  try {
    return Buffer.from(value, 'base64').toString('utf8');
  } catch {
    return '';
  }
}

export function serializeCanvasElements(elements: CanvasElement[]) {
  return JSON.stringify({ canvasElements: elements });
}

export function parseCanvasElements(raw?: string | null): CanvasElement[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as any;

    if (Array.isArray(parsed?.canvasElements)) {
      return parsed.canvasElements
        .map(sanitizeCanvasElement)
        .filter(Boolean) as CanvasElement[];
    }

    if (parsed?.version === 1 && Array.isArray(parsed?.strokes)) {
      return parsed.strokes
        .map((stroke: any, index: number) => ({
          id: stroke?.id ?? `legacy-stroke-${index}`,
          type: 'draw' as const,
          points: Array.isArray(stroke?.points) ? stroke.points.map(sanitizePoint).filter(Boolean) : [],
          color: typeof stroke?.color === 'string' ? stroke.color : '#111827',
          strokeWidth: typeof stroke?.width === 'number' ? stroke.width : 2,
          opacity: 1,
          drawStyle: 'pen' as const,
        }))
        .filter((stroke: CanvasDrawElement) => stroke.points.length > 0);
    }

    return [];
  } catch {
    return [];
  }
}

function sanitizePoint(point: any): CanvasPoint | null {
  const x = Number(point?.x);
  const y = Number(point?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

function sanitizeCanvasElement(element: any): CanvasElement | null {
  if (!element || typeof element !== 'object') return null;
  const id = element.id ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const allowedStrokePatterns = new Set(['solid', 'dashed', 'dotted']);
  const strokePattern =
    typeof element.strokePattern === 'string' && allowedStrokePatterns.has(element.strokePattern)
      ? (element.strokePattern as CanvasStrokePattern)
      : 'solid';

  if (element.type === 'draw') {
    const allowedDrawStyles = new Set(['pen', 'pencil', 'fountain', 'brush', 'crayon', 'marker', 'highlighter', 'charcoal', 'calligraphy', 'spray', 'chalk']);
    const points = Array.isArray(element.points) ? element.points.map(sanitizePoint).filter(Boolean) : [];
    if (!points.length) return null;
    return {
      id,
      type: 'draw',
      points,
      color: typeof element.color === 'string' ? element.color : '#111827',
      strokeWidth: typeof element.strokeWidth === 'number' ? element.strokeWidth : 2,
      opacity: typeof element.opacity === 'number' ? element.opacity : 1,
      drawStyle: typeof element.drawStyle === 'string' && allowedDrawStyles.has(element.drawStyle) ? element.drawStyle : 'pen',
    };
  }

  if (element.type === 'rectangle') {
    return {
      id,
      type: 'rectangle',
      x: Number(element.x ?? 0),
      y: Number(element.y ?? 0),
      width: Math.max(1, Number(element.width ?? 0)),
      height: Math.max(1, Number(element.height ?? 0)),
      color: typeof element.color === 'string' ? element.color : '#111827',
      strokeWidth: typeof element.strokeWidth === 'number' ? element.strokeWidth : 2,
      strokePattern,
      fillColor: typeof element.fillColor === 'string' ? element.fillColor : 'transparent',
      opacity: typeof element.opacity === 'number' ? element.opacity : 1,
    };
  }

  if (element.type === 'circle') {
    return {
      id,
      type: 'circle',
      x: Number(element.x ?? 0),
      y: Number(element.y ?? 0),
      radius: Math.max(1, Number(element.radius ?? 0)),
      color: typeof element.color === 'string' ? element.color : '#111827',
      strokeWidth: typeof element.strokeWidth === 'number' ? element.strokeWidth : 2,
      strokePattern,
      fillColor: typeof element.fillColor === 'string' ? element.fillColor : 'transparent',
      opacity: typeof element.opacity === 'number' ? element.opacity : 1,
    };
  }

  if (element.type === 'line' || element.type === 'arrow') {
    return {
      id,
      type: element.type,
      x1: Number(element.x1 ?? 0),
      y1: Number(element.y1 ?? 0),
      x2: Number(element.x2 ?? 0),
      y2: Number(element.y2 ?? 0),
      color: typeof element.color === 'string' ? element.color : '#111827',
      strokeWidth: typeof element.strokeWidth === 'number' ? element.strokeWidth : 2,
      strokePattern,
      opacity: typeof element.opacity === 'number' ? element.opacity : 1,
    };
  }

  if (element.type === 'polygon') {
    const allowedKinds = new Set(['triangle', 'diamond', 'star']);
    return {
      id,
      type: 'polygon',
      polygonKind:
        typeof element.polygonKind === 'string' && allowedKinds.has(element.polygonKind)
          ? (element.polygonKind as CanvasPolygonKind)
          : 'triangle',
      x: Number(element.x ?? 0),
      y: Number(element.y ?? 0),
      width: Math.max(1, Number(element.width ?? 0)),
      height: Math.max(1, Number(element.height ?? 0)),
      color: typeof element.color === 'string' ? element.color : '#111827',
      strokeWidth: typeof element.strokeWidth === 'number' ? element.strokeWidth : 2,
      strokePattern,
      fillColor: typeof element.fillColor === 'string' ? element.fillColor : 'transparent',
      opacity: typeof element.opacity === 'number' ? element.opacity : 1,
    };
  }

  if (element.type === 'text') {
    return {
      id,
      type: 'text',
      x: Number(element.x ?? 0),
      y: Number(element.y ?? 0),
      text: typeof element.text === 'string' ? element.text : 'Text',
      color: typeof element.color === 'string' ? element.color : '#111827',
      fontSize: typeof element.fontSize === 'number' ? element.fontSize : 18,
      fontFamily: typeof element.fontFamily === 'string' ? element.fontFamily : 'Inter',
      opacity: typeof element.opacity === 'number' ? element.opacity : 1,
    };
  }

  if (element.type === 'sticky') {
    return {
      id,
      type: 'sticky',
      x: Number(element.x ?? 0),
      y: Number(element.y ?? 0),
      width: Math.max(80, Number(element.width ?? 180)),
      height: Math.max(80, Number(element.height ?? 140)),
      text: typeof element.text === 'string' ? element.text : '',
      color: typeof element.color === 'string' ? element.color : '#FFF59D',
      fontFamily: typeof element.fontFamily === 'string' ? element.fontFamily : 'Inter',
      opacity: typeof element.opacity === 'number' ? element.opacity : 1,
      priority: element.priority === 'important' || element.priority === 'urgent' ? element.priority : 'normal',
      timestamp: typeof element.timestamp === 'string' ? element.timestamp : undefined,
    };
  }

  return null;
}

export function parseNoteCanvasBlocks(content?: string | null): NoteCanvasBlock[] {
  const source = content ?? '';
  const blocks: NoteCanvasBlock[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let textIndex = 0;
  let canvasIndex = 0;

  CANVAS_BLOCK_RE.lastIndex = 0;
  while ((match = CANVAS_BLOCK_RE.exec(source)) !== null) {
    const rawText = source.slice(lastIndex, match.index);
    if (rawText.trim() || blocks.length === 0) {
      blocks.push({
        id: `text-${textIndex}-${lastIndex}`,
        type: 'text',
        content: rawText,
      });
      textIndex += 1;
    }

    blocks.push({
      id: `canvas-${canvasIndex}-${match.index}`,
      type: 'canvas',
      canvasData: decodeBlockPayload(match[1] || ''),
      canvasPreview: decodeBlockPayload(match[2] || ''),
    });
    canvasIndex += 1;
    lastIndex = CANVAS_BLOCK_RE.lastIndex;
  }

  const trailingText = source.slice(lastIndex);
  if (trailingText.trim() || blocks.length === 0 || blocks[blocks.length - 1]?.type !== 'text') {
    blocks.push({
      id: `text-${textIndex}-${lastIndex}`,
      type: 'text',
      content: trailingText,
    });
  }

  return blocks;
}

export function buildNoteContentFromBlocks(blocks: NoteCanvasBlock[]) {
  return blocks
    .map((block) => {
      if (block.type === 'text') return block.content;
      return `<div class="canvas-block" data-block-type="canvas" data-canvas="${encodeBlockPayload(block.canvasData || '')}" data-thumb="${encodeBlockPayload(block.canvasPreview || '')}"></div>`;
    })
    .join('\n\n')
    .trim();
}

export function createTextBlock(content = ''): NoteCanvasBlock {
  return {
    id: `text-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type: 'text',
    content,
  };
}

export function createCanvasBlock(canvasData = '', canvasPreview = ''): NoteCanvasBlock {
  return {
    id: `canvas-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type: 'canvas',
    canvasData,
    canvasPreview,
  };
}

export function serializeBlocksForComparison(blocks: NoteCanvasBlock[]) {
  return JSON.stringify(
    blocks.map((block) => (
      block.type === 'text'
        ? { type: block.type, content: block.content }
        : { type: block.type, canvasData: block.canvasData, canvasPreview: block.canvasPreview }
    ))
  );
}

export function hasCanvasPayload(content?: string | null) {
  return parseNoteCanvasBlocks(content).some((block) => block.type === 'canvas');
}

export function getPlainNoteText(content?: string | null) {
  const textContent = parseNoteCanvasBlocks(content)
    .filter((block) => block.type === 'text')
    .map((block) => block.content)
    .join('\n\n');
  if (!textContent) return '';
  return textContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function distance(a: CanvasPoint, b: CanvasPoint) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function simplifyStrokePoints(points: CanvasPoint[], minDistance = 1.6) {
  if (points.length <= 2) return points;
  const simplified = [points[0]];
  for (let i = 1; i < points.length; i += 1) {
    if (distance(points[i], simplified[simplified.length - 1]) >= minDistance) {
      simplified.push(points[i]);
    }
  }
  const lastPoint = points[points.length - 1];
  if (simplified[simplified.length - 1] !== lastPoint) {
    simplified.push(lastPoint);
  }
  return simplified;
}

export function pathFromPoints(points: CanvasPoint[]) {
  if (!points.length) return '';
  if (points.length === 1) {
    const point = points[0];
    return `M ${point.x} ${point.y} L ${point.x + 0.01} ${point.y + 0.01}`;
  }
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i += 1) {
    const current = points[i];
    const next = points[i + 1];
    const midX = (current.x + next.x) / 2;
    const midY = (current.y + next.y) / 2;
    path += ` Q ${current.x} ${current.y} ${midX} ${midY}`;
  }
  const last = points[points.length - 1];
  path += ` L ${last.x} ${last.y}`;
  return path;
}

const average = (a: number, b: number) => (a + b) / 2;

export function getStrokeDashArray(pattern: CanvasStrokePattern, strokeWidth: number) {
  if (pattern === 'dashed') return `${Math.max(6, strokeWidth * 2.6)} ${Math.max(4, strokeWidth * 1.8)}`;
  if (pattern === 'dotted') return `${Math.max(1, strokeWidth * 0.8)} ${Math.max(5, strokeWidth * 2.2)}`;
  return undefined;
}

export function getStrokeDashIntervals(pattern: CanvasStrokePattern, strokeWidth: number) {
  if (pattern === 'dashed') return [Math.max(6, strokeWidth * 2.6), Math.max(4, strokeWidth * 1.8)];
  if (pattern === 'dotted') return [Math.max(1, strokeWidth * 0.8), Math.max(5, strokeWidth * 2.2)];
  return undefined;
}

export function getPolygonPoints(kind: CanvasPolygonKind, x: number, y: number, width: number, height: number) {
  if (kind === 'diamond') {
    return [
      { x: x + width / 2, y },
      { x: x + width, y: y + height / 2 },
      { x: x + width / 2, y: y + height },
      { x, y: y + height / 2 },
    ];
  }

  if (kind === 'star') {
    const cx = x + width / 2;
    const cy = y + height / 2;
    const outer = Math.min(width, height) / 2;
    const inner = outer * 0.46;
    return Array.from({ length: 10 }).map((_, index) => {
      const angle = -Math.PI / 2 + (index * Math.PI) / 5;
      const radius = index % 2 === 0 ? outer : inner;
      return {
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
      };
    });
  }

  return [
    { x: x + width / 2, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ];
}

export function getClosedPathFromPoints(points: CanvasPoint[]) {
  if (!points.length) return '';
  const [first, ...rest] = points;
  return `M ${first.x} ${first.y} ${rest.map((point) => `L ${point.x} ${point.y}`).join(' ')} Z`;
}

function getSvgPathFromStroke(points: number[][], closed = true) {
  const len = points.length;
  if (len < 4) return '';

  let a = points[0];
  let b = points[1];
  const c = points[2];

  let result = `M${a[0].toFixed(2)},${a[1].toFixed(2)} Q${b[0].toFixed(2)},${b[1].toFixed(2)} ${average(b[0], c[0]).toFixed(2)},${average(b[1], c[1]).toFixed(2)} T`;

  for (let i = 2, max = len - 1; i < max; i += 1) {
    a = points[i];
    b = points[i + 1];
    result += `${average(a[0], b[0]).toFixed(2)},${average(a[1], b[1]).toFixed(2)} `;
  }

  if (closed) result += 'Z';
  return result;
}

function jitterPoints(points: CanvasPoint[], amount: number) {
  if (amount <= 0) return points;
  return points.map((point, index) => ({
    x: point.x + Math.sin(index * 1.71) * amount,
    y: point.y + Math.cos(index * 1.37) * amount,
  }));
}

function buildFreehandPath(points: CanvasPoint[], options: Parameters<typeof getStroke>[1]) {
  const outlinePoints = getStroke(points, {
    ...options,
    last: true,
  }) as number[][];

  return getSvgPathFromStroke(outlinePoints);
}

export function getDrawStylePaths(
  points: CanvasPoint[],
  drawStyle: CanvasDrawStyle = 'pen',
  strokeWidth = 2,
  opacity = 1
) {
  if (points.length < 2) {
    return pathFromPoints(points)
      ? [{ path: pathFromPoints(points), opacity }]
      : [];
  }

  const build = (input: CanvasPoint[], size: number, options: Omit<Parameters<typeof getStroke>[1], 'size'> = {}) => ({
    path: buildFreehandPath(input, {
      size,
      thinning: 0.5,
      smoothing: 0.5,
      streamline: 0.5,
      simulatePressure: true,
      ...options,
    }),
  });

  const size = Math.max(1, strokeWidth);

  switch (drawStyle) {
    case 'pencil':
      return [
        { ...build(points, Math.max(1.5, size * 1.05), { thinning: 0.2, smoothing: 0.16, streamline: 0.08 }), opacity: Math.min(opacity * 0.55, 0.55) },
        { ...build(jitterPoints(points, size * 0.16), Math.max(1, size * 0.9), { thinning: 0.08, smoothing: 0.08, streamline: 0.04 }), opacity: Math.min(opacity * 0.18, 0.18) },
      ].filter((layer) => layer.path);
    case 'fountain':
      return [
        { ...build(points, Math.max(2, size * 1.85), { thinning: 0.9, smoothing: 0.74, streamline: 0.34, start: { taper: size * 0.8 }, end: { taper: size * 1.8 } }), opacity: Math.min(opacity * 0.24, 0.24) },
        { ...build(points, Math.max(1.5, size * 1.15), { thinning: 0.82, smoothing: 0.78, streamline: 0.38, start: { taper: size * 0.6 }, end: { taper: size * 1.3 } }), opacity },
      ].filter((layer) => layer.path);
    case 'brush':
      return [
        { ...build(points, Math.max(4, size * 2.5), { thinning: 0.58, smoothing: 0.84, streamline: 0.22, start: { taper: size * 1.1 }, end: { taper: size * 2.2 } }), opacity: Math.min(opacity * 0.24, 0.24) },
        { ...build(jitterPoints(points, size * 0.12), Math.max(3, size * 1.75), { thinning: 0.42, smoothing: 0.7, streamline: 0.18 }), opacity: Math.min(opacity * 0.72, 0.72) },
        { ...build(points, Math.max(2, size * 1.2), { thinning: 0.24, smoothing: 0.56, streamline: 0.15 }), opacity },
      ].filter((layer) => layer.path);
    case 'crayon':
      return [
        { ...build(points, Math.max(3, size * 1.9), { thinning: 0.05, smoothing: 0.06, streamline: 0.03 }), opacity: Math.min(opacity * 0.38, 0.38) },
        { ...build(jitterPoints(points, size * 0.22), Math.max(2.5, size * 1.55), { thinning: 0.03, smoothing: 0.04, streamline: 0.02 }), opacity: Math.min(opacity * 0.2, 0.2) },
        { ...build(jitterPoints(points, size * 0.3), Math.max(2, size * 1.15), { thinning: 0.02, smoothing: 0.02, streamline: 0.01 }), opacity: Math.min(opacity * 0.11, 0.11) },
      ].filter((layer) => layer.path);
    case 'marker':
      return [
        { ...build(points, Math.max(6, size * 2.1), { thinning: 0.02, smoothing: 0.88, streamline: 0.72, simulatePressure: false }), opacity: Math.min(opacity * 0.78, 0.78) },
      ].filter((layer) => layer.path);
    case 'highlighter':
      return [
        { ...build(points, Math.max(12, size * 2.6), { thinning: 0, smoothing: 0.92, streamline: 0.84, simulatePressure: false }), opacity: Math.min(opacity * 0.24, 0.24) },
      ].filter((layer) => layer.path);
    case 'charcoal':
      return [
        { ...build(points, Math.max(4, size * 2.3), { thinning: 0.08, smoothing: 0.1, streamline: 0.04 }), opacity: Math.min(opacity * 0.26, 0.26) },
        { ...build(jitterPoints(points, size * 0.34), Math.max(3, size * 1.7), { thinning: 0.04, smoothing: 0.05, streamline: 0.02 }), opacity: Math.min(opacity * 0.18, 0.18) },
        { ...build(jitterPoints(points, size * 0.18), Math.max(2, size * 1.2), { thinning: 0.02, smoothing: 0.04, streamline: 0.02 }), opacity: Math.min(opacity * 0.72, 0.72) },
      ].filter((layer) => layer.path);
    case 'calligraphy':
      return [
        { ...build(points, Math.max(4, size * 2.4), { thinning: 1, smoothing: 0.72, streamline: 0.36, start: { taper: size * 1.2 }, end: { taper: size * 2.2 } }), opacity: Math.min(opacity * 0.18, 0.18) },
        { ...build(points, Math.max(2.4, size * 1.5), { thinning: 0.95, smoothing: 0.78, streamline: 0.32, start: { taper: size * 0.8 }, end: { taper: size * 1.4 } }), opacity },
      ].filter((layer) => layer.path);
    case 'spray':
      return [
        { ...build(jitterPoints(points, size * 0.52), Math.max(1.2, size * 0.68), { thinning: 0.04, smoothing: 0.16, streamline: 0.04, simulatePressure: false }), opacity: Math.min(opacity * 0.12, 0.12) },
        { ...build(jitterPoints(points, size * 0.34), Math.max(1, size * 0.52), { thinning: 0.02, smoothing: 0.12, streamline: 0.03, simulatePressure: false }), opacity: Math.min(opacity * 0.18, 0.18) },
        { ...build(points, Math.max(1, size * 0.44), { thinning: 0.01, smoothing: 0.12, streamline: 0.03, simulatePressure: false }), opacity: Math.min(opacity * 0.2, 0.2) },
        { ...build(jitterPoints(points, size * 0.24), Math.max(0.8, size * 0.32), { thinning: 0.01, smoothing: 0.1, streamline: 0.02, simulatePressure: false }), opacity: Math.min(opacity * 0.16, 0.16) },
      ].filter((layer) => layer.path);
    case 'chalk':
      return [
        { ...build(points, Math.max(4, size * 2.15), { thinning: 0.04, smoothing: 0.12, streamline: 0.08, simulatePressure: false }), opacity: Math.min(opacity * 0.22, 0.22) },
        { ...build(jitterPoints(points, size * 0.28), Math.max(2.6, size * 1.44), { thinning: 0.03, smoothing: 0.1, streamline: 0.04, simulatePressure: false }), opacity: Math.min(opacity * 0.52, 0.52) },
        { ...build(jitterPoints(points, size * 0.12), Math.max(2, size * 1.06), { thinning: 0.02, smoothing: 0.08, streamline: 0.03, simulatePressure: false }), opacity: Math.min(opacity * 0.84, 0.84) },
      ].filter((layer) => layer.path);
    case 'pen':
    default:
      return [
        { ...build(points, Math.max(2, size * 1.2), { thinning: 0.74, smoothing: 0.74, streamline: 0.42, end: { taper: size * 0.8 } }), opacity },
      ].filter((layer) => layer.path);
  }
}

function renderElementSvg(element: CanvasElement) {
  if (element.type === 'draw') {
    return getDrawStylePaths(element.points, element.drawStyle || 'pen', element.strokeWidth, element.opacity ?? 1)
      .map((layer) => `<path d="${layer.path}" fill="${element.color}" opacity="${layer.opacity}" />`)
      .join('');
  }
  if (element.type === 'rectangle') {
    const fill = element.fillColor && element.fillColor !== 'transparent' ? element.fillColor : 'none';
    const dashArray = getStrokeDashArray(element.strokePattern || 'solid', element.strokeWidth);
    const dashMarkup = dashArray ? ` stroke-dasharray="${dashArray}"` : '';
    return `<rect x="${element.x}" y="${element.y}" width="${element.width}" height="${element.height}" rx="8" fill="${fill}" stroke="${element.color}" stroke-width="${element.strokeWidth}"${dashMarkup} opacity="${element.opacity ?? 1}" />`;
  }
  if (element.type === 'circle') {
    const fill = element.fillColor && element.fillColor !== 'transparent' ? element.fillColor : 'none';
    const dashArray = getStrokeDashArray(element.strokePattern || 'solid', element.strokeWidth);
    const dashMarkup = dashArray ? ` stroke-dasharray="${dashArray}"` : '';
    return `<circle cx="${element.x}" cy="${element.y}" r="${element.radius}" fill="${fill}" stroke="${element.color}" stroke-width="${element.strokeWidth}"${dashMarkup} opacity="${element.opacity ?? 1}" />`;
  }
  if (element.type === 'line') {
    const dashArray = getStrokeDashArray(element.strokePattern || 'solid', element.strokeWidth);
    const dashMarkup = dashArray ? ` stroke-dasharray="${dashArray}"` : '';
    return `<line x1="${element.x1}" y1="${element.y1}" x2="${element.x2}" y2="${element.y2}" stroke="${element.color}" stroke-width="${element.strokeWidth}" stroke-linecap="round"${dashMarkup} opacity="${element.opacity ?? 1}" />`;
  }
  if (element.type === 'arrow') {
    const angle = Math.atan2(element.y2 - element.y1, element.x2 - element.x1);
    const arrowLength = 14;
    const p1x = element.x2 - arrowLength * Math.cos(angle - Math.PI / 6);
    const p1y = element.y2 - arrowLength * Math.sin(angle - Math.PI / 6);
    const p2x = element.x2 - arrowLength * Math.cos(angle + Math.PI / 6);
    const p2y = element.y2 - arrowLength * Math.sin(angle + Math.PI / 6);
    const dashArray = getStrokeDashArray(element.strokePattern || 'solid', element.strokeWidth);
    const dashMarkup = dashArray ? ` stroke-dasharray="${dashArray}"` : '';
    return [
      `<line x1="${element.x1}" y1="${element.y1}" x2="${element.x2}" y2="${element.y2}" stroke="${element.color}" stroke-width="${element.strokeWidth}" stroke-linecap="round"${dashMarkup} opacity="${element.opacity ?? 1}" />`,
      `<polygon points="${element.x2},${element.y2} ${p1x},${p1y} ${p2x},${p2y}" fill="${element.color}" opacity="${element.opacity ?? 1}" />`,
    ].join('');
  }
  if (element.type === 'polygon') {
    const fill = element.fillColor && element.fillColor !== 'transparent' ? element.fillColor : 'none';
    const points = getPolygonPoints(element.polygonKind, element.x, element.y, element.width, element.height)
      .map((point) => `${point.x},${point.y}`)
      .join(' ');
    const dashArray = getStrokeDashArray(element.strokePattern || 'solid', element.strokeWidth);
    const dashMarkup = dashArray ? ` stroke-dasharray="${dashArray}"` : '';
    return `<polygon points="${points}" fill="${fill}" stroke="${element.color}" stroke-width="${element.strokeWidth}"${dashMarkup} opacity="${element.opacity ?? 1}" />`;
  }
  if (element.type === 'text') {
    return `<text x="${element.x}" y="${element.y}" fill="${element.color}" font-size="${element.fontSize}" font-family="${escapeXml(element.fontFamily || 'Inter')}" opacity="${element.opacity ?? 1}">${escapeXml(element.text)}</text>`;
  }
  if (element.type === 'sticky') {
    return [
      `<rect x="${element.x}" y="${element.y}" width="${element.width}" height="${element.height}" rx="10" fill="${element.color}" stroke="rgba(0,0,0,0.12)" opacity="${element.opacity ?? 1}" />`,
      `<text x="${element.x + 12}" y="${element.y + 26}" fill="#2d2d2d" font-size="14" font-family="${escapeXml(element.fontFamily || 'Inter')}">${escapeXml(element.text || '')}</text>`,
    ].join('');
  }
  return '';
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function createCanvasPreviewDataUrl(rawCanvasData: string, width = 300, height = 180) {
  const elements = parseCanvasElements(rawCanvasData);
  const markup = elements.map(renderElementSvg).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#fffdf7" />${markup}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

import { Buffer } from 'buffer';

export type CanvasPoint = {
  x: number;
  y: number;
};

export type CanvasDrawElement = {
  id: string | number;
  type: 'draw';
  points: CanvasPoint[];
  color: string;
  strokeWidth: number;
  opacity?: number;
  drawStyle?: 'pen' | 'marker' | 'highlighter';
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

  if (element.type === 'draw') {
    const points = Array.isArray(element.points) ? element.points.map(sanitizePoint).filter(Boolean) : [];
    if (!points.length) return null;
    return {
      id,
      type: 'draw',
      points,
      color: typeof element.color === 'string' ? element.color : '#111827',
      strokeWidth: typeof element.strokeWidth === 'number' ? element.strokeWidth : 2,
      opacity: typeof element.opacity === 'number' ? element.opacity : 1,
      drawStyle: element.drawStyle === 'marker' || element.drawStyle === 'highlighter' ? element.drawStyle : 'pen',
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

function renderElementSvg(element: CanvasElement) {
  if (element.type === 'draw') {
    return `<path d="${pathFromPoints(element.points)}" fill="none" stroke="${element.color}" stroke-width="${element.strokeWidth}" stroke-linecap="round" stroke-linejoin="round" opacity="${element.opacity ?? 1}" />`;
  }
  if (element.type === 'rectangle') {
    const fill = element.fillColor && element.fillColor !== 'transparent' ? element.fillColor : 'none';
    return `<rect x="${element.x}" y="${element.y}" width="${element.width}" height="${element.height}" rx="8" fill="${fill}" stroke="${element.color}" stroke-width="${element.strokeWidth}" opacity="${element.opacity ?? 1}" />`;
  }
  if (element.type === 'circle') {
    const fill = element.fillColor && element.fillColor !== 'transparent' ? element.fillColor : 'none';
    return `<circle cx="${element.x}" cy="${element.y}" r="${element.radius}" fill="${fill}" stroke="${element.color}" stroke-width="${element.strokeWidth}" opacity="${element.opacity ?? 1}" />`;
  }
  if (element.type === 'line') {
    return `<line x1="${element.x1}" y1="${element.y1}" x2="${element.x2}" y2="${element.y2}" stroke="${element.color}" stroke-width="${element.strokeWidth}" stroke-linecap="round" opacity="${element.opacity ?? 1}" />`;
  }
  if (element.type === 'arrow') {
    const angle = Math.atan2(element.y2 - element.y1, element.x2 - element.x1);
    const arrowLength = 14;
    const p1x = element.x2 - arrowLength * Math.cos(angle - Math.PI / 6);
    const p1y = element.y2 - arrowLength * Math.sin(angle - Math.PI / 6);
    const p2x = element.x2 - arrowLength * Math.cos(angle + Math.PI / 6);
    const p2y = element.y2 - arrowLength * Math.sin(angle + Math.PI / 6);
    return [
      `<line x1="${element.x1}" y1="${element.y1}" x2="${element.x2}" y2="${element.y2}" stroke="${element.color}" stroke-width="${element.strokeWidth}" stroke-linecap="round" opacity="${element.opacity ?? 1}" />`,
      `<polygon points="${element.x2},${element.y2} ${p1x},${p1y} ${p2x},${p2y}" fill="${element.color}" opacity="${element.opacity ?? 1}" />`,
    ].join('');
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

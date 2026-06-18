export const clearInlineTextColors = (fragment) => {
  const coloredElements = fragment?.querySelectorAll?.('[style], [data-note-color]') || [];

  coloredElements.forEach((node) => {
    node.style?.removeProperty('color');
    node.removeAttribute?.('data-note-color');
    if (node.getAttribute?.('style') === '') {
      node.removeAttribute('style');
    }
  });

  return fragment;
};

export const clearInlineFontFamilies = (fragment) => {
  const fontElements = fragment?.querySelectorAll?.('[style], [data-note-font]') || [];

  fontElements.forEach((node) => {
    node.style?.removeProperty('font-family');
    node.removeAttribute?.('data-note-font');
    if (node.getAttribute?.('style') === '') {
      node.removeAttribute('style');
    }
  });

  return fragment;
};

export const clearInlineFontSizes = (fragment) => {
  const sizeElements = fragment?.querySelectorAll?.('[style], [size], [data-note-size]') || [];

  sizeElements.forEach((node) => {
    node.style?.removeProperty('font-size');
    node.removeAttribute?.('size');
    node.removeAttribute?.('data-note-size');
    if (node.getAttribute?.('style') === '') {
      node.removeAttribute('style');
    }
  });

  return fragment;
};

export const applyInlineFontSize = (range, fontSize) => {
  if (!range || range.collapsed || !fontSize) return null;

  const selectedContent = clearInlineFontSizes(range.extractContents());
  const sizeSpan = document.createElement('span');
  sizeSpan.style.fontSize = fontSize;
  sizeSpan.dataset.noteSize = fontSize;
  sizeSpan.appendChild(selectedContent);
  range.insertNode(sizeSpan);
  range.selectNodeContents(sizeSpan);

  return sizeSpan;
};

const CSS_FONT_SIZE_KEYWORDS = {
  'xx-small': 9,
  'x-small': 10,
  small: 13,
  medium: 16,
  large: 18,
  'x-large': 24,
  'xx-large': 32,
  'xxx-large': 48
};

const LEGACY_FONT_SIZES = {
  1: 10,
  2: 13,
  3: 16,
  4: 18,
  5: 24,
  6: 32,
  7: 48
};

const fontSizeToPixels = (fontSize) => {
  if (!fontSize) return null;
  const normalizedSize = String(fontSize).trim().toLowerCase();
  if (CSS_FONT_SIZE_KEYWORDS[normalizedSize]) {
    return CSS_FONT_SIZE_KEYWORDS[normalizedSize];
  }

  const pixels = Number.parseFloat(normalizedSize);
  return Number.isFinite(pixels) ? pixels : null;
};

const closestAvailableFontSize = (fontSize, availableSizes, fallbackSize) => {
  const targetPixels = fontSizeToPixels(fontSize);
  if (targetPixels === null) return fallbackSize;

  return availableSizes.reduce((closest, candidate) => {
    const candidatePixels = fontSizeToPixels(candidate);
    const closestPixels = fontSizeToPixels(closest);
    return Math.abs(candidatePixels - targetPixels) < Math.abs(closestPixels - targetPixels)
      ? candidate
      : closest;
  }, fallbackSize);
};

const getRangeBoundaryNode = (range) => {
  let node = range?.startContainer;
  if (!node || node.nodeType !== Node.ELEMENT_NODE) return node;

  const children = node.childNodes;
  if (!children.length) return node;

  const childIndex = range.collapsed && range.startOffset > 0
    ? range.startOffset - 1
    : Math.min(range.startOffset, children.length - 1);

  return children[childIndex] || node;
};

export const getRangeFontSize = (range, availableSizes, fallbackSize = '16px') => {
  if (!range || !Array.isArray(availableSizes) || availableSizes.length === 0) {
    return fallbackSize;
  }

  const boundaryNode = getRangeBoundaryNode(range);
  let element = boundaryNode?.nodeType === Node.ELEMENT_NODE
    ? boundaryNode
    : boundaryNode?.parentElement;

  while (element) {
    const noteSize = element.dataset?.noteSize;
    if (noteSize) {
      return closestAvailableFontSize(noteSize, availableSizes, fallbackSize);
    }

    const inlineSize = element.style?.fontSize;
    if (inlineSize) {
      return closestAvailableFontSize(inlineSize, availableSizes, fallbackSize);
    }

    if (element.tagName === 'FONT' && element.getAttribute('size')) {
      const legacyPixels = LEGACY_FONT_SIZES[element.getAttribute('size')];
      if (legacyPixels) {
        return closestAvailableFontSize(`${legacyPixels}px`, availableSizes, fallbackSize);
      }
    }

    if (element.matches?.('[contenteditable="true"]')) break;
    element = element.parentElement;
  }

  const computedElement = boundaryNode?.nodeType === Node.ELEMENT_NODE
    ? boundaryNode
    : boundaryNode?.parentElement;
  const computedSize = computedElement && typeof window !== 'undefined'
    ? window.getComputedStyle(computedElement).fontSize
    : null;

  return closestAvailableFontSize(computedSize, availableSizes, fallbackSize);
};

export const getRangeBlockFormat = (range, fallbackFormat = 'p') => {
  if (!range) return fallbackFormat;

  const boundaryNode = getRangeBoundaryNode(range);
  let element = boundaryNode?.nodeType === Node.ELEMENT_NODE
    ? boundaryNode
    : boundaryNode?.parentElement;

  while (element) {
    const tagName = element.tagName?.toLowerCase();
    if (/^h[1-6]$/.test(tagName)) return tagName;
    if (tagName === 'p') return 'p';

    for (let level = 1; level <= 6; level += 1) {
      if (element.classList?.contains(`block-heading${level}`)) {
        return `h${level}`;
      }
    }

    if (element.matches?.('[contenteditable="true"]')) break;
    element = element.parentElement;
  }

  return fallbackFormat;
};

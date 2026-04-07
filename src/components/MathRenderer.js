import { useEffect, useRef, memo } from 'react';
import renderMathInElement from 'katex/contrib/auto-render/auto-render';
import 'katex/dist/katex.min.css';
import './MathRenderer.css';

// Only use $$ and $ delimiters — \( conflicts with normal text parentheses
const KATEX_OPTS = {
  delimiters: [
    { left: '$$', right: '$$', display: true },
    { left: '$',  right: '$',  display: false },
  ],
  throwOnError: false,
  errorColor: '#f59e0b',
  strict: false,
  trust: false,
  macros: {
    '\\R': '\\mathbb{R}',
    '\\N': '\\mathbb{N}',
    '\\Z': '\\mathbb{Z}',
    '\\Q': '\\mathbb{Q}',
    '\\C': '\\mathbb{C}',
  },
};

const MathRenderer = memo(({ content, className = '' }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !content) return;

    // Sanitize: strip script tags and inline event handlers
    const sanitized = content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '');

    containerRef.current.innerHTML = sanitized;

    try {
      renderMathInElement(containerRef.current, KATEX_OPTS);
    } catch {
      // silenced — KaTeX errors are non-fatal
    }
  }, [content]);

  return <div ref={containerRef} className={`math-content ${className}`} />;
});

MathRenderer.displayName = 'MathRenderer';

export default MathRenderer;

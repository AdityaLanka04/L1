import { useEffect, useRef, memo } from 'react';
import './MathRenderer.css';

const KATEX_VERSION = '0.16.11';

let katexLoaded = false;
let katexLoading = null;

const loadKaTeX = () => {
  if (katexLoaded) return Promise.resolve();
  if (katexLoading) return katexLoading;

  katexLoading = new Promise((resolve, reject) => {
    if (!document.getElementById('katex-css')) {
      const css = document.createElement('link');
      css.id = 'katex-css';
      css.rel = 'stylesheet';
      css.href = `https://cdn.jsdelivr.net/npm/katex@${KATEX_VERSION}/dist/katex.min.css`;
      document.head.appendChild(css);
    }

    const loadScript = (src) => {
      return new Promise((res, rej) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = res;
        script.onerror = rej;
        document.head.appendChild(script);
      });
    };

    loadScript(`https://cdn.jsdelivr.net/npm/katex@${KATEX_VERSION}/dist/katex.min.js`)
      .then(() => loadScript(`https://cdn.jsdelivr.net/npm/katex@${KATEX_VERSION}/dist/contrib/auto-render.min.js`))
      .then(() => {
        katexLoaded = true;
        resolve();
      })
      .catch(reject);
  });

  return katexLoading;
};

const MathRenderer = memo(({ content, className = '' }) => {
  const containerRef = useRef(null);
  const renderedRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current || !content) return;

    renderedRef.current = false;
    containerRef.current.innerHTML = content;

    loadKaTeX()
      .then(() => {
        if (!containerRef.current || renderedRef.current) return;
        if (!window.renderMathInElement) return;

        try {
          window.renderMathInElement(containerRef.current, {
            delimiters: [
              { left: '$$', right: '$$', display: true },
              { left: '$', right: '$', display: false },
              { left: '\\[', right: '\\]', display: true },
              { left: '\\(', right: '\\)', display: false }
            ],
            throwOnError: false,
            errorColor: '#f59e0b',
            strict: false,
            trust: true,
            macros: {
              "\\R": "\\mathbb{R}",
              "\\N": "\\mathbb{N}",
              "\\Z": "\\mathbb{Z}",
              "\\Q": "\\mathbb{Q}",
              "\\C": "\\mathbb{C}"
            }
          });
          renderedRef.current = true;
        } catch (err) {
                  }
      })
      .catch(err => {});
  }, [content]);

  return (
    <div
      ref={containerRef}
      className={`math-content ${className}`}
    />
  );
});

MathRenderer.displayName = 'MathRenderer';

export const InlineMath = memo(({ math }) => {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current || !math) return;

    loadKaTeX().then(() => {
      if (window.katex && ref.current) {
        try {
          window.katex.render(math, ref.current, {
            throwOnError: false,
            displayMode: false
          });
        } catch (e) {
          ref.current.textContent = math;
        }
      }
    });
  }, [math]);

  return <span ref={ref} className="math-inline" />;
});

InlineMath.displayName = 'InlineMath';

export const DisplayMath = memo(({ math }) => {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current || !math) return;

    loadKaTeX().then(() => {
      if (window.katex && ref.current) {
        try {
          window.katex.render(math, ref.current, {
            throwOnError: false,
            displayMode: true
          });
        } catch (e) {
          ref.current.textContent = math;
        }
      }
    });
  }, [math]);

  return <div ref={ref} className="math-block" />;
});

DisplayMath.displayName = 'DisplayMath';

export default MathRenderer;
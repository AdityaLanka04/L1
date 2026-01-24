import { useEffect, useRef, memo } from 'react';
import './MathRenderer.css';

const KATEX_VERSION = '0.16.11';

let katexLoaded = false;
let katexLoading = null;

const loadKaTeX = () => {
  if (katexLoaded) return Promise.resolve();
  if (katexLoading) return katexLoading;

  katexLoading = new Promise((resolve, reject) => {
    if (window.katex && window.renderMathInElement) {
      katexLoaded = true;
      resolve();
      return;
    }

    if (!document.getElementById('katex-css')) {
      const css = document.createElement('link');
      css.id = 'katex-css';
      css.rel = 'stylesheet';
      css.href = `https://cdn.jsdelivr.net/npm/katex@${KATEX_VERSION}/dist/katex.min.css`;
      css.integrity = 'sha384-nB0miv6/jRmo5UMMR1wu3Gz6NLsoTkbqJghGIsx//Rlm+ZU03BU6SQNC66uf4l5+';
      css.crossOrigin = 'anonymous';
      document.head.appendChild(css);
    }

    const loadScript = (src, integrity) => {
      return new Promise((res, rej) => {
        const script = document.createElement('script');
        script.src = src;
        if (integrity) {
          script.integrity = integrity;
          script.crossOrigin = 'anonymous';
        }
        script.onload = res;
        script.onerror = rej;
        document.head.appendChild(script);
      });
    };

    loadScript(
      `https://cdn.jsdelivr.net/npm/katex@${KATEX_VERSION}/dist/katex.min.js`,
      'sha384-7zkQWkzuo3B5mTepMUcHkMB5jZaolc2xDwL6VFqjFALcbeS9Ggm/Yr2r3Dy4lfFg'
    )
      .then(() => loadScript(
        `https://cdn.jsdelivr.net/npm/katex@${KATEX_VERSION}/dist/contrib/auto-render.min.js`,
        'sha384-43gviWU0YVjaDtb/GhzOouOXtZMP/7XUzwPTstBeZFe/+rCMvRwr4yROQP43s0Xk'
      ))
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
              "\\C": "\\mathbb{C}",
              "\\log": "\\operatorname{log}",
              "\\ln": "\\operatorname{ln}",
              "\\sin": "\\operatorname{sin}",
              "\\cos": "\\operatorname{cos}",
              "\\tan": "\\operatorname{tan}"
            }
          });
          renderedRef.current = true;
        } catch (err) {
          console.error('KaTeX rendering error:', err);
        }
      })
      .catch(err => {
        console.error('Failed to load KaTeX:', err);
      });
  }, [content]);

  return (
    <div
      ref={containerRef}
      className={`math-content ${className}`}
    />
  );
});

MathRenderer.displayName = 'MathRenderer';

export default MathRenderer;
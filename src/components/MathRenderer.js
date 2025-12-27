import React, { useEffect, useRef, useState } from 'react';
import './MathRenderer.css';

const MathRenderer = ({ content }) => {
  const containerRef = useRef(null);
  const [isRendered, setIsRendered] = useState(false);
  const renderTimeoutRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !content) return;

    const preprocessedContent = preprocessMathContent(content);
    containerRef.current.innerHTML = preprocessedContent;

    if (window.katex && window.renderMathInElement) {
      renderMath();
    } else {
      loadKaTeX();
    }

    return () => {
      if (renderTimeoutRef.current) {
        clearTimeout(renderTimeoutRef.current);
      }
    };
  }, [content]);

  const preprocessMathContent = (text) => {
    if (!text) return '';
    
    let processed = text;

    processed = processed.replace(/\\\[/g, '$$').replace(/\\\]/g, '$$');
    processed = processed.replace(/\\\(/g, '$').replace(/\\\)/g, '$');

    const patterns = [
      /(\w+)\^(\d+)/g,
      /(\w+)_(\d+)/g,
      /(\w+)\^{([^}]+)}/g,
      /(\w+)_{([^}]+)}/g,
      /\\frac{([^}]+)}{([^}]+)}/g,
      /\\sqrt{([^}]+)}/g,
      /\\sqrt\[(\d+)\]{([^}]+)}/g,
      /([a-zA-Z0-9]+)\s*\/\s*([a-zA-Z0-9]+)(?=\s|$|[,.])/g,
      /∫|∑|∏|∮|∯|∰|⨌|lim|Σ|Π/g,
      /\\sum_{([^}]+)}\^{([^}]+)}/g,
      /\\int_{([^}]+)}\^{([^}]+)}/g,
      /\\prod_{([^}]+)}\^{([^}]+)}/g,
      /\\lim_{([^}]+)}/g,
      /d\/dx|∂\/∂[a-z]/g,
      /[αβγδεζηθικλμνξοπρστυφχψωΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ]/g,
      /[∀∃∈∉⊂⊃∪∩∧∨¬⇒⇔≡]/g,
      /[≈≠≤≥<>±×÷·√∞]/g
    ];

    const hasMathPattern = patterns.some(pattern => pattern.test(text));
    
    if (hasMathPattern) {
      processed = wrapMathExpressions(processed);
    }

    return processed;
  };

  const wrapMathExpressions = (text) => {
    const lines = text.split('\n');
    const result = [];
    let inCodeBlock = false;
    let inMathBlock = false;

    for (let line of lines) {
      if (line.trim().startsWith('```')) {
        inCodeBlock = !inCodeBlock;
        result.push(line);
        continue;
      }

      if (inCodeBlock) {
        result.push(line);
        continue;
      }

      if (line.includes('$$')) {
        inMathBlock = !inMathBlock;
        result.push(line);
        continue;
      }

      if (inMathBlock) {
        result.push(line);
        continue;
      }

      let processedLine = line;

      const fractionPattern = /(?<![\$\\])(\w+)\s*\/\s*(\w+)(?=\s|$|[,.])/g;
      processedLine = processedLine.replace(fractionPattern, (match, num, den) => {
        if (match.includes('http') || match.includes('://')) return match;
        return `$\\frac{${num}}{${den}}$`;
      });

      const superscriptPattern = /(?<![\$\\])(\w+)\^{?(\w+)}?(?=\s|$|[,.])/g;
      processedLine = processedLine.replace(superscriptPattern, (match, base, exp) => {
        if (exp.length > 1 && !match.includes('{')) return match;
        return `$${base}^{${exp}}$`;
      });

      const subscriptPattern = /(?<![\$\\])(\w+)_{?(\w+)}?(?=\s|$|[,.])/g;
      processedLine = processedLine.replace(subscriptPattern, (match, base, sub) => {
        if (sub.length > 1 && !match.includes('{')) return match;
        return `$${base}_{${sub}}$`;
      });

      const sumPattern = /(?<![\$\\])(∑|Σ|sum)(?:_{([^}^$]+)})?(?:\^{([^}$]+)})?/g;
      processedLine = processedLine.replace(sumPattern, (match, symbol, lower, upper) => {
        if (lower && upper) return `$$\\sum_{${lower}}^{${upper}}$$`;
        if (lower) return `$\\sum_{${lower}}$`;
        return '$\\sum$';
      });

      const integralPattern = /(?<![\$\\])(∫|integral)(?:_{([^}^$]+)})?(?:\^{([^}$]+)})?/g;
      processedLine = processedLine.replace(integralPattern, (match, symbol, lower, upper) => {
        if (lower && upper) return `$$\\int_{${lower}}^{${upper}}$$`;
        if (lower) return `$\\int_{${lower}}$`;
        return '$\\int$';
      });

      const productPattern = /(?<![\$\\])(∏|Π|prod)(?:_{([^}^$]+)})?(?:\^{([^}$]+)})?/g;
      processedLine = processedLine.replace(productPattern, (match, symbol, lower, upper) => {
        if (lower && upper) return `$$\\prod_{${lower}}^{${upper}}$$`;
        if (lower) return `$\\prod_{${lower}}$`;
        return '$\\prod$';
      });

      const limitPattern = /(?<![\$\\])lim(?:_{([^}$]+)})?/g;
      processedLine = processedLine.replace(limitPattern, (match, approach) => {
        if (approach) return `$\\lim_{${approach}}$`;
        return '$\\lim$';
      });

      const sqrtPattern = /(?<![\$\\])√{?([^}$\s]+)}?/g;
      processedLine = processedLine.replace(sqrtPattern, (match, content) => {
        return `$\\sqrt{${content}}$`;
      });

      const greekPattern = /(?<![\$\\])([αβγδεζηθικλμνξοπρστυφχψωΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ])/g;
      processedLine = processedLine.replace(greekPattern, (match) => {
        const greekMap = {
          'α': '\\alpha', 'β': '\\beta', 'γ': '\\gamma', 'δ': '\\delta',
          'ε': '\\varepsilon', 'ζ': '\\zeta', 'η': '\\eta', 'θ': '\\theta',
          'ι': '\\iota', 'κ': '\\kappa', 'λ': '\\lambda', 'μ': '\\mu',
          'ν': '\\nu', 'ξ': '\\xi', 'ο': 'o', 'π': '\\pi',
          'ρ': '\\rho', 'σ': '\\sigma', 'τ': '\\tau', 'υ': '\\upsilon',
          'φ': '\\phi', 'χ': '\\chi', 'ψ': '\\psi', 'ω': '\\omega',
          'Α': 'A', 'Β': 'B', 'Γ': '\\Gamma', 'Δ': '\\Delta',
          'Ε': 'E', 'Ζ': 'Z', 'Η': 'H', 'Θ': '\\Theta',
          'Ι': 'I', 'Κ': 'K', 'Λ': '\\Lambda', 'Μ': 'M',
          'Ν': 'N', 'Ξ': '\\Xi', 'Ο': 'O', 'Π': '\\Pi',
          'Ρ': 'P', 'Σ': '\\Sigma', 'Τ': 'T', 'Υ': '\\Upsilon',
          'Φ': '\\Phi', 'Χ': 'X', 'Ψ': '\\Psi', 'Ω': '\\Omega'
        };
        return greekMap[match] ? `$${greekMap[match]}$` : match;
      });

      result.push(processedLine);
    }

    return result.join('\n');
  };

  const loadKaTeX = () => {
    if (!document.querySelector('link[href*="katex"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css';
      link.crossOrigin = 'anonymous';
      link.integrity = 'sha384-n8MVd4RsNIU0tAv4ct0nTaAbDJwPJzDEaqSD1odI+WdtXRGWt2kTvGFasHpSy3SV';
      document.head.appendChild(link);
    }

    if (!window.katex) {
      const script1 = document.createElement('script');
      script1.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js';
      script1.crossOrigin = 'anonymous';
      script1.integrity = 'sha384-XjKyOOlGwcjNTAIQHIpgOno0Hl1YQqzUOEleOLALmuqehneUG+vnGctmUb0ZY0l8';
      script1.onload = () => {
        loadAutoRender();
      };
      script1.onerror = () => {
        console.error('Failed to load KaTeX');
      };
      document.head.appendChild(script1);
    } else {
      loadAutoRender();
    }
  };

  const loadAutoRender = () => {
    if (!window.renderMathInElement) {
      const script2 = document.createElement('script');
      script2.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js';
      script2.crossOrigin = 'anonymous';
      script2.integrity = 'sha384-+VBxd3r6XgURycqtZ117nYw44OOcIax56Z4dCRWbxyPt0Koah1uHoK0o4+/RRE05';
      script2.onload = () => {
        renderMath();
      };
      script2.onerror = () => {
        console.error('Failed to load KaTeX auto-render');
      };
      document.head.appendChild(script2);
    } else {
      renderMath();
    }
  };

  const renderMath = () => {
    if (!containerRef.current || !window.renderMathInElement) return;

    if (renderTimeoutRef.current) {
      clearTimeout(renderTimeoutRef.current);
    }

    renderTimeoutRef.current = setTimeout(() => {
      try {
        window.renderMathInElement(containerRef.current, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false },
            { left: '\\[', right: '\\]', display: true },
            { left: '\\(', right: '\\)', display: false }
          ],
          throwOnError: false,
          errorColor: '#ff6b6b',
          strict: false,
          trust: false,
          macros: {
            "\\RR": "\\mathbb{R}",
            "\\NN": "\\mathbb{N}",
            "\\ZZ": "\\mathbb{Z}",
            "\\QQ": "\\mathbb{Q}",
            "\\CC": "\\mathbb{C}"
          },
          ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
          ignoredClasses: ['code-block', 'code-block-container']
        });
        
        setIsRendered(true);
      } catch (error) {
        console.error('KaTeX render error:', error);
      }
    }, 10);
  };

  return (
    <div 
      ref={containerRef} 
      className={`math-content ${isRendered ? 'math-rendered' : ''}`}
    />
  );
};

export default MathRenderer;
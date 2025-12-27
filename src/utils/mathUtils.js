export const detectMathContent = (text) => {
  if (!text) return false;

  const mathPatterns = [
    /\$\$[\s\S]+?\$\$/,
    /\$[^$]+?\$/,
    /\\\[[\s\S]+?\\\]/,
    /\\\([^)]+?\\\)/,
    /\\frac\{[^}]+\}\{[^}]+\}/,
    /\\sqrt\{[^}]+\}/,
    /\\sum_\{[^}]+\}\^\{[^}]+\}/,
    /\\int_\{[^}]+\}\^\{[^}]+\}/,
    /\\prod_\{[^}]+\}\^\{[^}]+\}/,
    /\\lim_\{[^}]+\}/,
    /\w+\^\d+/,
    /\w+_\d+/,
    /\w+\^{[^}]+}/,
    /\w+_{[^}]+}/,
    /[∫∑∏∮∯∰⨌]/,
    /[αβγδεζηθικλμνξοπρστυφχψωΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ]/,
    /[∀∃∈∉⊂⊃∪∩∧∨¬⇒⇔≡]/,
    /[≈≠≤≥±×÷·√∞∂∇]/,
    /d\/dx|∂\/∂/
  ];

  return mathPatterns.some(pattern => pattern.test(text));
};

export const processMathInContent = (text) => {
  if (!text) return '';
  
  const lines = text.split('\n');
  const processedLines = [];
  let inCodeBlock = false;
  let inPreTag = false;
  let inMathBlock = false;
  
  for (let line of lines) {
    if (line.trim().startsWith('```') || line.trim().startsWith('<pre')) {
      inCodeBlock = !inCodeBlock;
      processedLines.push(line);
      continue;
    }

    if (line.includes('<pre')) inPreTag = true;
    if (line.includes('</pre')) inPreTag = false;
    
    if (inCodeBlock || inPreTag) {
      processedLines.push(line);
      continue;
    }
    
    if (line.includes('$$')) {
      inMathBlock = !inMathBlock;
      processedLines.push(line);
      continue;
    }
    
    if (inMathBlock) {
      processedLines.push(line);
      continue;
    }
    
    let processedLine = line;
    
    processedLine = processedLine.replace(/\^(\d+)/g, '^{$1}');
    processedLine = processedLine.replace(/_(\d+)/g, '_{$1}');
    
    processedLine = processedLine.replace(/([a-zA-Z])\s*\^\s*\{([^}]+)\}/g, (match, base, exp) => {
      if (match.includes('$')) return match;
      return `$${base}^{${exp}}$`;
    });
    
    processedLine = processedLine.replace(/([a-zA-Z])\s*_\s*\{([^}]+)\}/g, (match, base, sub) => {
      if (match.includes('$')) return match;
      return `$${base}_{${sub}}$`;
    });
    
    processedLine = processedLine.replace(/(?<!\$)([a-zA-Z])\s*\^\s*\{(\d+)\}(?!\$)/g, '$$$1^{$2}$$');
    processedLine = processedLine.replace(/(?<!\$)([a-zA-Z])\s*_\s*\{(\d+)\}(?!\$)/g, '$$$1_{$2}$$');
    
    processedLine = processedLine.replace(/(?<!\$)([a-zA-Z])(\d+)\s*\^\s*\{(\d+)\}(?!\$)/g, '$$$1$2^{$3}$$');
    
    processedLine = processedLine.replace(/(?<!\$)([a-zA-Z]+)\s*\^\s*\(([^)]+)\)(?!\$)/g, '$$$1^{$2}$$');
    processedLine = processedLine.replace(/(?<!\$)([a-zA-Z]+)\s*_\s*\(([^)]+)\)(?!\$)/g, '$$$1_{$2}$$');
    
    processedLine = processedLine.replace(/\bf\s*\^\s*['′]+\s*\(([^)]+)\)/g, (match, content) => {
      const primes = (match.match(/['′]/g) || []).length;
      return `$f${'\''.repeat(primes)}(${content})$`;
    });
    
    processedLine = processedLine.replace(/\bf\s*\(([^)]+)\)\s*\^\s*['′]+/g, (match, content) => {
      const primes = (match.match(/['′]/g) || []).length;
      return `$f(${content})${'\''.repeat(primes)}$`;
    });
    
    processedLine = processedLine.replace(/(?<!\$)([a-zA-Z])\s*x\s*\^\s*\{(\d+)\}(?!\$)/g, '$$$$1x^{$2}$$');
    
    processedLine = processedLine.replace(/(?<![\\$])(\w+)\s*\/\s*(\w+)(?=[\s,.)!?]|$)/g, (match, num, den, offset, string) => {
      if (match.includes('http') || match.includes('://') || match.includes('www')) return match;
      if (string.substring(Math.max(0, offset - 10), offset).includes('```')) return match;
      if (string.substring(Math.max(0, offset - 10), offset).includes('$')) return match;
      
      const beforeChar = offset > 0 ? string[offset - 1] : '';
      const afterMatch = string.substring(offset + match.length, offset + match.length + 10);
      
      if (beforeChar === '/' || afterMatch.startsWith('/')) return match;
      
      if (/^\d+$/.test(num) && /^\d+$/.test(den)) {
        return `$\\frac{${num}}{${den}}$`;
      }
      
      if (num.length <= 4 && den.length <= 4 && /^[a-zA-Z0-9]+$/.test(num) && /^[a-zA-Z0-9]+$/.test(den)) {
        return `$\\frac{${num}}{${den}}$`;
      }
      
      return match;
    });
    
    processedLine = processedLine.replace(/(∑|Σ)\s*_?\s*\{([^}]+)\}\s*\^?\s*\{([^}]+)\}/g, (match, symbol, lower, upper) => {
      if (match.includes('$')) return match;
      return `$$\\sum_{${lower}}^{${upper}}$$`;
    });
    
    processedLine = processedLine.replace(/(∫)\s*_?\s*\{([^}]+)\}\s*\^?\s*\{([^}]+)\}/g, (match, symbol, lower, upper) => {
      if (match.includes('$')) return match;
      return `$$\\int_{${lower}}^{${upper}}$$`;
    });
    
    processedLine = processedLine.replace(/(∏|Π)\s*_?\s*\{([^}]+)\}\s*\^?\s*\{([^}]+)\}/g, (match, symbol, lower, upper) => {
      if (match.includes('$')) return match;
      return `$$\\prod_{${lower}}^{${upper}}$$`;
    });
    
    processedLine = processedLine.replace(/\blim\s*_?\s*\{([^}]+)\}/g, (match, approach) => {
      if (match.includes('$')) return match;
      return `$\\lim_{${approach}}$`;
    });
    
    processedLine = processedLine.replace(/(?<!\$)√\s*\{([^}]+)\}(?!\$)/g, '$\\sqrt{$1}$');
    processedLine = processedLine.replace(/(?<!\$)√([a-zA-Z0-9])(?!\$)/g, '$\\sqrt{$1}$');
    
    const greekMap = {
      'α': '\\alpha', 'β': '\\beta', 'γ': '\\gamma', 'δ': '\\delta',
      'ε': '\\varepsilon', 'ζ': '\\zeta', 'η': '\\eta', 'θ': '\\theta',
      'ι': '\\iota', 'κ': '\\kappa', 'λ': '\\lambda', 'μ': '\\mu',
      'ν': '\\nu', 'ξ': '\\xi', 'π': '\\pi', 'ρ': '\\rho',
      'σ': '\\sigma', 'τ': '\\tau', 'υ': '\\upsilon', 'φ': '\\phi',
      'χ': '\\chi', 'ψ': '\\psi', 'ω': '\\omega',
      'Γ': '\\Gamma', 'Δ': '\\Delta', 'Θ': '\\Theta', 'Λ': '\\Lambda',
      'Ξ': '\\Xi', 'Π': '\\Pi', 'Σ': '\\Sigma', 'Υ': '\\Upsilon',
      'Φ': '\\Phi', 'Ψ': '\\Psi', 'Ω': '\\Omega'
    };
    
    for (const [unicode, latex] of Object.entries(greekMap)) {
      const pattern = new RegExp(`(?<!\\$|\\\\)${unicode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?!\\w|\\$)`, 'g');
      processedLine = processedLine.replace(pattern, `$${latex}$`);
    }
    
    const symbolMap = {
      '∞': '\\infty',
      '≈': '\\approx',
      '≠': '\\neq',
      '≤': '\\leq',
      '≥': '\\geq',
      '±': '\\pm',
      '×': '\\times',
      '÷': '\\div',
      '·': '\\cdot',
      '∂': '\\partial',
      '∇': '\\nabla',
      '∀': '\\forall',
      '∃': '\\exists',
      '∈': '\\in',
      '∉': '\\notin',
      '⊂': '\\subset',
      '⊃': '\\supset',
      '∪': '\\cup',
      '∩': '\\cap',
      '∧': '\\wedge',
      '∨': '\\vee',
      '¬': '\\neg',
      '⇒': '\\Rightarrow',
      '⇔': '\\Leftrightarrow',
      '≡': '\\equiv'
    };
    
    for (const [unicode, latex] of Object.entries(symbolMap)) {
      const pattern = new RegExp(`(?<!\\$|\\\\)${unicode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g');
      processedLine = processedLine.replace(pattern, `$${latex}$`);
    }
    
    processedLine = processedLine.replace(/\$\s*\$/g, '');
    processedLine = processedLine.replace(/\$\$\s*\$\$/g, '');
    
    processedLine = processedLine.replace(/(\$+)([^$]*)\1/g, (match, delim, content) => {
      if (!content.trim()) return '';
      return match;
    });
    
    processedLines.push(processedLine);
  }
  
  return processedLines.join('\n');
};

export const normalizeMathDelimiters = (text) => {
  if (!text) return '';
  
  let normalized = text;
  normalized = normalized.replace(/\\\[/g, '$$').replace(/\\\]/g, '$$');
  normalized = normalized.replace(/\\\(/g, '$').replace(/\\\)/g, '$');
  
  return normalized;
};

export const cleanMathDelimiters = (text) => {
  if (!text) return '';
  
  let cleaned = text;
  cleaned = cleaned.replace(/\$\$\s*\$\$/g, '');
  cleaned = cleaned.replace(/\$\s*\$/g, '');
  
  cleaned = cleaned.replace(/\$\$([^$]+)\$\$/g, (match, content) => {
    return content.trim() ? match : '';
  });
  
  cleaned = cleaned.replace(/\$([^$]+)\$/g, (match, content) => {
    return content.trim() ? match : '';
  });
  
  return cleaned;
};

export default {
  detectMathContent,
  processMathInContent,
  normalizeMathDelimiters,
  cleanMathDelimiters
};
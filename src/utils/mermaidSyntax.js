/** Repair label punctuation without inventing diagram nodes or relationships. */
export function repairMermaidSyntax(source = '') {
  const text = String(source || '').trim();
  if (!/^(?:graph|flowchart)\s/i.test(text)) return text;
  // Parentheses inside an unquoted rectangular label are parsed as shapes.
  // Limit this to ordinary rectangles; leave quoted labels and other shapes alone.
  return text.replace(/(\b[A-Za-z_][A-Za-z0-9_]*\[)([^\[\]\n]*)(\])/g, (match, open, label, close) => {
    if (/^["\/\\]/.test(label) || /[\/\\]$/.test(label) || !/[(){}]/.test(label)) return match;
    return `${open}"${label.replace(/"/g, '#quot;')}"${close}`;
  });
}

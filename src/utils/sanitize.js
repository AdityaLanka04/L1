import DOMPurify from 'dompurify';

// Sanitize AI-generated or user-generated HTML before rendering via dangerouslySetInnerHTML
export const sanitizeHtml = (html) => {
  if (!html) return '';
  return DOMPurify.sanitize(String(html), {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'meta', 'base'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur',
                  'onchange', 'onsubmit', 'onkeydown', 'onkeyup', 'onkeypress'],
  });
};

// Escape plain text for insertion into HTML templates (document.write / string concatenation)
export const escapeHtml = (str) => {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

// Validate that a URL is http/https before using it in href attributes
export const sanitizeUrl = (url) => {
  if (!url || typeof url !== 'string') return '';
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol) ? url : '';
  } catch {
    return '';
  }
};

// Validate that a navigation path is a safe relative internal path
export const safeInternalPath = (path) => {
  if (!path || typeof path !== 'string') return null;
  if (!path.startsWith('/')) return null;
  // Block javascript: and protocol-relative URLs embedded in paths
  if (/^\/\/|javascript:/i.test(path)) return null;
  return path;
};

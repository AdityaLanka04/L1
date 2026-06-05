

import DOMPurify from 'dompurify';
import { escapeHtml } from './sanitize';
import { formatCompactRelativeTime } from './dateUtils';

const asText = (value) => (value === null || value === undefined ? '' : String(value));

export const parsePageLinks = (content) => {
  const linkRegex = /\[\[([^\]]+)\]\]/g;
  const links = [];
  let match;
  const source = asText(content);

  while ((match = linkRegex.exec(source)) !== null) {
    links.push({
      text: match[1],
      index: match.index,
      fullMatch: match[0]
    });
  }

  return links;
};

export const parseTags = (content) => {

  const textContent = asText(content).replace(/<[^>]*>/g, ' ');
  const tagRegex = /#([a-zA-Z0-9_-]+)/g;
  const tags = new Set();
  let match;

  while ((match = tagRegex.exec(textContent)) !== null) {
    tags.add(match[1]);
  }

  return Array.from(tags);
};

export const renderPageLinks = (content, notes) => {
  const source = asText(content);
  const safeNotes = Array.isArray(notes) ? notes : [];
  const links = parsePageLinks(source);

  if (links.length === 0) return source;

  let result = source;

  for (let i = links.length - 1; i >= 0; i--) {
    const link = links[i];
    const linkedNote = safeNotes.find(n =>
      asText(n.title).toLowerCase() === link.text.toLowerCase()
    );
    const safeText = escapeHtml(link.text);

    const replacement = linkedNote
      ? `<span class="page-link" data-note-id="${escapeHtml(linkedNote.id)}">${safeText}</span>`
      : `<span class="page-link-missing">${safeText}</span>`;

    result = result.substring(0, link.index) + replacement + result.substring(link.index + link.fullMatch.length);
  }

  return result;
};

export const renderTags = (content) => {

  const parts = asText(content).split(/(<[^>]*>)/);

  return parts.map((part, index) => {
    if (part.startsWith('<')) return part;

    return part.replace(/#([a-zA-Z0-9_-]+)/g, (match, tag) => {
      return `<span class="tag" data-tag="${tag}">#${tag}</span>`;
    });
  }).join('');
};

export const findBacklinks = (noteTitle, allNotes) => {
  const title = asText(noteTitle).toLowerCase();
  if (!title || !Array.isArray(allNotes)) return [];

  return allNotes.filter(note => {
    const links = parsePageLinks(note.content);
    return links.some(link =>
      link.text.toLowerCase() === title
    );
  });
};

export const getAllTags = (notes) => {
  const allTags = new Set();

  (Array.isArray(notes) ? notes : []).forEach(note => {
    const tags = parseTags(note.content);
    tags.forEach(tag => allTags.add(tag));
  });

  return Array.from(allTags).sort();
};

export const filterNotesByTag = (notes, tag) => {
  return (Array.isArray(notes) ? notes : []).filter(note => {
    const tags = parseTags(note.content);
    return tags.includes(tag);
  });
};

export const getNotesSuggestions = (notes, query) => {
  const safeNotes = Array.isArray(notes) ? notes : [];
  if (!query) return safeNotes.slice(0, 10);

  const lowerQuery = asText(query).toLowerCase();
  return safeNotes
    .filter(note => asText(note.title).toLowerCase().includes(lowerQuery))
    .slice(0, 10);
};

export const formatDate = formatCompactRelativeTime;

export const extractPlainText = (html) => {
  if (!html) return '';
  const div = document.createElement('div');
  div.innerHTML = DOMPurify.sanitize(String(html), { ALLOWED_TAGS: [] });
  return div.textContent || div.innerText || '';
};

export const getNoteSnippet = (content, maxLength = 150) => {
  const text = extractPlainText(content);
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

/**
 * Utility functions for enhanced notes features
 */

// Parse page links [[Note Name]] from content
export const parsePageLinks = (content) => {
  const linkRegex = /\[\[([^\]]+)\]\]/g;
  const links = [];
  let match;
  
  while ((match = linkRegex.exec(content)) !== null) {
    links.push({
      text: match[1],
      index: match.index,
      fullMatch: match[0]
    });
  }
  
  return links;
};

// Parse tags #tag from content
export const parseTags = (content) => {
  // Remove HTML tags first
  const textContent = content.replace(/<[^>]*>/g, ' ');
  const tagRegex = /#([a-zA-Z0-9_-]+)/g;
  const tags = new Set();
  let match;
  
  while ((match = tagRegex.exec(textContent)) !== null) {
    tags.add(match[1]);
  }
  
  return Array.from(tags);
};

// Convert content with page links to HTML with clickable links
export const renderPageLinks = (content, notes, onLinkClick) => {
  const links = parsePageLinks(content);
  
  if (links.length === 0) return content;
  
  let result = content;
  
  // Replace in reverse order to maintain indices
  for (let i = links.length - 1; i >= 0; i--) {
    const link = links[i];
    const linkedNote = notes.find(n => 
      n.title.toLowerCase() === link.text.toLowerCase()
    );
    
    const replacement = linkedNote
      ? `<span class="page-link" data-note-id="${linkedNote.id}">${link.text}</span>`
      : `<span class="page-link-missing">${link.text}</span>`;
    
    result = result.substring(0, link.index) + replacement + result.substring(link.index + link.fullMatch.length);
  }
  
  return result;
};

// Convert content with tags to HTML with clickable tags
export const renderTags = (content, onTagClick) => {
  // Don't process HTML tags
  const parts = content.split(/(<[^>]*>)/);
  
  return parts.map((part, index) => {
    if (part.startsWith('<')) return part;
    
    return part.replace(/#([a-zA-Z0-9_-]+)/g, (match, tag) => {
      return `<span class="tag" data-tag="${tag}">#${tag}</span>`;
    });
  }).join('');
};

// Find backlinks (notes that link to this note)
export const findBacklinks = (noteTitle, allNotes) => {
  return allNotes.filter(note => {
    const links = parsePageLinks(note.content);
    return links.some(link => 
      link.text.toLowerCase() === noteTitle.toLowerCase()
    );
  });
};

// Get all unique tags from all notes
export const getAllTags = (notes) => {
  const allTags = new Set();
  
  notes.forEach(note => {
    const tags = parseTags(note.content);
    tags.forEach(tag => allTags.add(tag));
  });
  
  return Array.from(allTags).sort();
};

// Filter notes by tag
export const filterNotesByTag = (notes, tag) => {
  return notes.filter(note => {
    const tags = parseTags(note.content);
    return tags.includes(tag);
  });
};

// Create a note link suggestion list
export const getNotesSuggestions = (notes, query) => {
  if (!query) return notes.slice(0, 10);
  
  const lowerQuery = query.toLowerCase();
  return notes
    .filter(note => note.title.toLowerCase().includes(lowerQuery))
    .slice(0, 10);
};

// Format date for display
export const formatDate = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString();
};

// Extract plain text from HTML
export const extractPlainText = (html) => {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
};

// Get note snippet for preview
export const getNoteSnippet = (content, maxLength = 150) => {
  const text = extractPlainText(content);
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

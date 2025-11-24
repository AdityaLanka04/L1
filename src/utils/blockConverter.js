/**
 * Utility functions to convert between HTML (Quill format) and Block format
 */

// Convert HTML content to blocks
export const htmlToBlocks = (html) => {
  if (!html || html.trim() === '') {
    return [{
      id: Date.now(),
      type: 'paragraph',
      content: '',
      properties: {}
    }];
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const blocks = [];
  let blockId = Date.now();

  const processNode = (node) => {
    const tagName = node.tagName?.toLowerCase();
    const textContent = node.textContent || '';

    switch (tagName) {
      case 'h1':
        blocks.push({
          id: blockId++,
          type: 'heading1',
          content: textContent,
          properties: {}
        });
        break;
      case 'h2':
        blocks.push({
          id: blockId++,
          type: 'heading2',
          content: textContent,
          properties: {}
        });
        break;
      case 'h3':
        blocks.push({
          id: blockId++,
          type: 'heading3',
          content: textContent,
          properties: {}
        });
        break;
      case 'pre':
        const code = node.querySelector('code');
        blocks.push({
          id: blockId++,
          type: 'code',
          content: code ? code.textContent : textContent,
          properties: {}
        });
        break;
      case 'blockquote':
        blocks.push({
          id: blockId++,
          type: 'quote',
          content: textContent,
          properties: {}
        });
        break;
      case 'hr':
        blocks.push({
          id: blockId++,
          type: 'divider',
          content: '',
          properties: {}
        });
        break;
      case 'ul':
        Array.from(node.children).forEach(li => {
          blocks.push({
            id: blockId++,
            type: 'bulletList',
            content: li.textContent || '',
            properties: {}
          });
        });
        break;
      case 'ol':
        Array.from(node.children).forEach(li => {
          blocks.push({
            id: blockId++,
            type: 'numberedList',
            content: li.textContent || '',
            properties: {}
          });
        });
        break;
      case 'p':
        if (textContent.trim()) {
          blocks.push({
            id: blockId++,
            type: 'paragraph',
            content: textContent,
            properties: {}
          });
        }
        break;
      default:
        if (node.nodeType === Node.TEXT_NODE && textContent.trim()) {
          blocks.push({
            id: blockId++,
            type: 'paragraph',
            content: textContent,
            properties: {}
          });
        }
    }
  };

  Array.from(doc.body.childNodes).forEach(processNode);

  if (blocks.length === 0) {
    blocks.push({
      id: blockId,
      type: 'paragraph',
      content: '',
      properties: {}
    });
  }

  return blocks;
};

// Convert blocks to HTML
export const blocksToHtml = (blocks) => {
  if (!blocks || blocks.length === 0) return '';

  return blocks.map(block => {
    const content = block.content || '';
    
    switch (block.type) {
      case 'heading1':
        return `<h1>${content}</h1>`;
      case 'heading2':
        return `<h2>${content}</h2>`;
      case 'heading3':
        return `<h3>${content}</h3>`;
      case 'code':
        return `<pre><code>${content}</code></pre>`;
      case 'quote':
        return `<blockquote>${content}</blockquote>`;
      case 'divider':
        return '<hr/>';
      case 'bulletList':
        return `<ul><li>${content}</li></ul>`;
      case 'numberedList':
        return `<ol><li>${content}</li></ol>`;
      case 'todo':
        const checked = block.properties?.checked ? 'checked' : '';
        return `<div class="todo-item"><input type="checkbox" ${checked}/><span>${content}</span></div>`;
      case 'callout':
        return `<div class="callout">${content}</div>`;
      case 'toggle':
        return `<details ${block.properties?.expanded ? 'open' : ''}><summary>${content}</summary></details>`;
      case 'paragraph':
      default:
        return `<p>${content}</p>`;
    }
  }).join('\n');
};

// Merge consecutive list items
export const mergeListBlocks = (blocks) => {
  const merged = [];
  let currentList = null;

  blocks.forEach(block => {
    if (block.type === 'bulletList' || block.type === 'numberedList') {
      if (currentList && currentList.type === block.type) {
        currentList.items.push(block);
      } else {
        if (currentList) {
          merged.push(currentList);
        }
        currentList = {
          type: block.type,
          items: [block]
        };
      }
    } else {
      if (currentList) {
        merged.push(currentList);
        currentList = null;
      }
      merged.push(block);
    }
  });

  if (currentList) {
    merged.push(currentList);
  }

  return merged;
};

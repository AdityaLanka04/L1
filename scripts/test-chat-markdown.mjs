import assert from 'node:assert/strict';
import fs from 'node:fs';
const markedUrl = import.meta.resolve('marked');
const source = fs.readFileSync(new URL('../src/utils/mathMarkdown.js', import.meta.url), 'utf8')
  .replace("from 'marked'", `from '${markedUrl}'`);
const { renderMarkdownWithMath } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const markdown = '| # | Assumption | Rationale |\n|---|---|---|\n| 1 | Students use the backend | Course content |\n\n5. Repository layout\n\n6. Setup';
for (const tutorStepList of [true, false]) {
  const html = renderMarkdownWithMath(markdown, { tutorStepList });
  assert.match(html, /<table>/);
  assert.match(html, /<th>#<\/th>/);
  assert.match(html, /start="5"/);
  assert.match(html, /Repository layout/);
  assert.match(html, /Setup/);
  const nested = renderMarkdownWithMath('- **First**\n  - Nested detail', { tutorStepList });
  assert.match(nested, /<ul[\s>]/);
  assert.match(nested, /Nested detail/);
}
console.log('Chat Markdown: tables, list numbering and nested content passed');

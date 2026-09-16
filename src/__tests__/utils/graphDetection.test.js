import { detectGraphLanguage } from '../../components/GraphRenderer';

test.each([
  ['bash', 'git clone repo && cd backend && docker compose up --build -d'],
  ['text', 'project/\n├── backend/\n└── frontend/'],
  ['', '+----------+\n| Frontend | <--API--> | Backend |'],
  ['python', 'if ready:\n    send() # end'],
  ['javascript', 'graph LR; const end = true;'],
])('keeps ordinary %s blocks out of Mermaid', (lang, code) => {
  expect(detectGraphLanguage(lang, code)).toBeNull();
});
test.each(['flowchart TD\nA --> B', 'sequenceDiagram\nA->>B: Hello'])('detects real diagrams', code => {
  expect(detectGraphLanguage('', code)).toBe('mermaid');
});

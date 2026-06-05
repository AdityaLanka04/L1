import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, extname, basename } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, 'src');

function getAllCssFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllCssFiles(full));
    } else if (entry.isFile() && extname(entry.name) === '.css') {
      files.push(full);
    }
  }
  return files;
}

// Remove lines like:  --foo: var(--foo);  (self-referential)
// The regex captures the variable name and checks if it references itself
const SELF_REF = /^(\s*)(--[\w-]+)\s*:\s*var\(\s*\2\s*\)\s*;?\s*$/;

const changedFiles = [];

for (const cssFile of getAllCssFiles(SRC)) {
  const original = readFileSync(cssFile, 'utf-8');
  const lines = original.split('\n');
  const filtered = lines.filter(line => !SELF_REF.test(line));

  if (filtered.length !== lines.length) {
    const content = filtered.join('\n');
    writeFileSync(cssFile, content, 'utf-8');
    const removed = lines.length - filtered.length;
    changedFiles.push(`${cssFile.replace(SRC + '\\', '').replace(SRC + '/', '')} (removed ${removed} self-ref lines)`);
  }
}

console.log(`Fixed ${changedFiles.length} CSS files:`);
changedFiles.forEach(f => console.log(`  ${f}`));

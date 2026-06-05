import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, 'src');

function getAllJsFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.includes('__tests__') && entry.name !== 'node_modules') {
      files.push(...getAllJsFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.js') && !entry.name.endsWith('.test.js')) {
      files.push(full);
    }
  }
  return files;
}

// Match catch blocks that are empty (only whitespace, optionally with an existing comment)
// Pattern: catch (...) { <optional whitespace> }
// We want to add "// silenced" if the block is truly empty (no code)
const EMPTY_CATCH = /catch\s*\([^)]*\)\s*\{\s*\}/g;
const NEAR_EMPTY_CATCH = /catch\s*\([^)]*\)\s*\{\s*\n(\s*)\n\s*\}/g;

const changedFiles = [];

for (const jsFile of getAllJsFiles(SRC)) {
  const original = readFileSync(jsFile, 'utf-8');
  let content = original;

  // Replace empty inline catch: catch (e) {} -> catch (e) { /* silenced */ }
  content = content.replace(/\bcatch\s*\(([^)]*)\)\s*\{\s*\}/g, (match, param) => {
    return `catch (${param}) { /* silenced */ }`;
  });

  // Replace multiline empty catch blocks
  // catch (e) {
  //   [blank lines or just whitespace]
  // }
  // Add "// silenced" inside
  content = content.replace(/\bcatch\s*\(([^)]*)\)\s*\{\s*\n(\s*)\n(\s*)\}/g, (match, param, indent1, closingIndent) => {
    return `catch (${param}) {\n${closingIndent}  // silenced\n${closingIndent}}`;
  });

  if (content !== original) {
    writeFileSync(jsFile, content, 'utf-8');
    const rel = jsFile.replace(SRC + '\\', '').replace(SRC + '/', '');
    changedFiles.push(rel);
  }
}

console.log(`Fixed empty catch blocks in ${changedFiles.length} files:`);
changedFiles.forEach(f => console.log(`  ${f}`));

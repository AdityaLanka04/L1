import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
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

// Matches rgba(215, 179, 140, X) with optional spaces
const RGBA_PAT = /rgba\(\s*215\s*,\s*179\s*,\s*140\s*,\s*([0-9]+(?:\.[0-9]+)?)\s*\)/g;

function alphaToPct(alphaStr) {
  const a = parseFloat(alphaStr);
  const pct = a * 100;
  if (pct === Math.round(pct)) return String(Math.round(pct));
  return parseFloat(pct.toFixed(2)).toString();
}

function replaceRgba(content, cssVar) {
  return content.replace(RGBA_PAT, (_, alpha) => {
    const pct = alphaToPct(alpha);
    return `color-mix(in srgb, ${cssVar} ${pct}%, transparent)`;
  });
}

const changedFiles = [];
const cssFiles = getAllCssFiles(SRC);

for (const cssFile of cssFiles) {
  const original = readFileSync(cssFile, 'utf-8');
  let content = original;
  const fname = basename(cssFile);

  // Use component-specific var for Atlas (its own design system)
  const cssVar = fname === 'Atlas.css' ? 'var(--g-main)' : 'var(--accent)';
  content = replaceRgba(content, cssVar);

  // Replace hardcoded text colors (skip Atlas with its own design system)
  if (fname !== 'Atlas.css') {
    content = content.replace(/#EAECEF\b/gi, 'var(--text-primary)');
    content = content.replace(/#B8C0CC\b/gi, 'var(--text-secondary)');
  }

  if (content !== original) {
    writeFileSync(cssFile, content, 'utf-8');
    const rel = cssFile.replace(SRC + '\\', '').replace(SRC + '/', '');
    changedFiles.push(rel);
  }
}

console.log(`Changed ${changedFiles.length} CSS files:`);
changedFiles.forEach(f => console.log(`  ${f}`));

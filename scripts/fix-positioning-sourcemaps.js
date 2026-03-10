const fs = require('fs');
const path = require('path');

const rootDir = process.cwd();
const targets = [
  path.join(rootDir, 'node_modules', 'positioning', 'dist', 'entry.js'),
  path.join(rootDir, 'node_modules', 'positioning', 'dist', 'positioning.js'),
];

function stripSourceMapComment(filePath) {
  if (!fs.existsSync(filePath)) {
    return false;
  }

  const original = fs.readFileSync(filePath, 'utf8');
  const updated = original.replace(/\n\/\/# sourceMappingURL=.*$/m, '');

  if (updated !== original) {
    fs.writeFileSync(filePath, updated, 'utf8');
  }
  return true;
}

let touched = 0;
for (const file of targets) {
  if (stripSourceMapComment(file)) {
    touched += 1;
  }
}

if (touched > 0) {
  console.log(`[fix-positioning-sourcemaps] processed ${touched} file(s)`);
} else {
  console.log('[fix-positioning-sourcemaps] positioning package not found, skipped');
}

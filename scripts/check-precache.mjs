// Fails when the offline precache (dist/sw.js) and the build disagree. Run after `npm run build`.
// Inverted on purpose: instead of listing what must be cached, it lists what may stay out (neural engine and the
// Supabase client), so any new chunk, lazy or not, is cached unless someone decides otherwise here.
import { existsSync, readdirSync, readFileSync } from 'node:fs';

const DIST = new URL('../dist/', import.meta.url);
const NOT_PRECACHED = [/^nam-/, /^supabase-/];

const sw = readFileSync(new URL('sw.js', DIST), 'utf8');
const match = sw.match(/const SHELL_FILES = (\[.*?\])\r?\n/s);
if (!match) {
  console.error('dist/sw.js has no SHELL_FILES list: run `npm run build` first.');
  process.exit(1);
}
const shell = new Set(JSON.parse(match[1]));
const failures = [];

for (const file of shell) {
  if (!existsSync(new URL(file, DIST))) failures.push(`in the precache but not in dist: ${file}`);
}
for (const file of readdirSync(new URL('assets/', DIST))) {
  if (NOT_PRECACHED.some((pattern) => pattern.test(file))) {
    if (shell.has(`assets/${file}`)) failures.push(`should stay out of the precache: assets/${file}`);
  } else if (!shell.has(`assets/${file}`)) {
    failures.push(`built but not precached (opens blank offline): assets/${file}`);
  }
}

const manifest = JSON.parse(readFileSync(new URL('manifest.webmanifest', DIST), 'utf8'));
for (const icon of manifest.icons) {
  const path = icon.src.replace(/^\.\//, '');
  if (path.endsWith('.png') && !shell.has(path)) failures.push(`manifest icon not precached: ${path}`);
}
if (manifest.orientation === 'landscape') failures.push('manifest.orientation locks the app in landscape');

console.log(`precache: ${shell.size} files`);
if (failures.length > 0) {
  console.error('\nOffline precache check failed:\n  ' + failures.join('\n  '));
  process.exit(1);
}

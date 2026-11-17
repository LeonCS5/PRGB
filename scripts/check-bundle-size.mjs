// Fails the build when what the browser downloads grows past the budget. Run after `npm run build`.
// Limits are gzip bytes (what the visitor downloads) with some headroom over the current sizes; raise one on
// purpose, in the same commit that explains why, never to make the check pass.
import { readdirSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const DIR = new URL('../dist/assets/', import.meta.url);
const KB = 1024;
const BUDGETS = [
  { name: 'entry (index-*)', test: (file) => file.startsWith('index-'), max: 150 * KB },
  { name: 'react', test: (file) => file.startsWith('react-'), max: 75 * KB },
  { name: 'supabase client (dist-*)', test: (file) => file.startsWith('dist-'), max: 65 * KB }
];
const OTHER_CHUNK_MAX = 30 * KB; // every other lazy chunk (screens, pieces, engines)
const TOTAL_MAX = 300 * KB;

const files = readdirSync(DIR).filter((file) => file.endsWith('.js'));
if (files.length === 0) {
  console.error('No JS files in dist/assets: run `npm run build` first.');
  process.exit(1);
}
const sizes = files.map((file) => ({ file, gzip: gzipSync(readFileSync(new URL(file, DIR))).length }));
const failures = [];
for (const { file, gzip } of sizes) {
  const budget = BUDGETS.find((item) => item.test(file));
  const max = budget ? budget.max : OTHER_CHUNK_MAX;
  const status = gzip > max ? 'OVER' : 'ok';
  console.log(`${status.padEnd(4)} ${(gzip / KB).toFixed(1).padStart(7)} kB  max ${(max / KB).toFixed(0).padStart(3)} kB  ${file}`);
  if (gzip > max) failures.push(`${file}: ${(gzip / KB).toFixed(1)} kB gzip > ${(max / KB).toFixed(0)} kB`);
}
const total = sizes.reduce((sum, item) => sum + item.gzip, 0);
console.log(`     ${(total / KB).toFixed(1).padStart(7)} kB  max ${(TOTAL_MAX / KB).toFixed(0).padStart(3)} kB  total JS`);
if (total > TOTAL_MAX) failures.push(`total JS: ${(total / KB).toFixed(1)} kB gzip > ${(TOTAL_MAX / KB).toFixed(0)} kB`);
if (failures.length > 0) {
  console.error('\nBundle budget exceeded:\n  ' + failures.join('\n  '));
  process.exit(1);
}

// Fails the build when what the browser downloads grows past the budget. Run after `npm run build`.
// Limits are gzip bytes (what the visitor downloads) with some headroom over the current sizes; raise one on
// purpose, in the same commit that explains why, never to make the check pass.
import { readdirSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const DIR = new URL('../dist/assets/', import.meta.url);
const KB = 1024;
const BUDGETS = [
  { name: 'entry (index-*)', test: (file) => file.startsWith('index-'), max: 75 * KB },
  { name: 'react', test: (file) => file.startsWith('react-'), max: 75 * KB },
  { name: 'supabase client (supabase-*)', test: (file) => file.startsWith('supabase-'), max: 65 * KB }
];
const OTHER_CHUNK_MAX = 30 * KB; // every other lazy chunk (screens, pieces, engines)
// Every chunk together: only matters for the offline precache, not for the first visit.
// 340 -> 350 kB for the lane techniques (blocks, slides, palm mute), the spacing map, the guide shadow and its options.
const TOTAL_MAX = 350 * KB;
const FIRST_LOAD_MAX = 140 * KB; // entry + react: what a first visitor downloads before the page works

const files = readdirSync(DIR).filter((file) => file.endsWith('.js'));
if (files.length === 0) {
  console.error('No JS files in dist/assets: run `npm run build` first.');
  process.exit(1);
}
const sizes = files.map((file) => ({ file, gzip: gzipSync(readFileSync(new URL(file, DIR))).length }));
const failures = [];
const firstLoad = sizes.filter(({ file }) => file.startsWith('index-') || file.startsWith('react-')).reduce((sum, item) => sum + item.gzip, 0);
console.log(`     ${(firstLoad / KB).toFixed(1).padStart(7)} kB  max ${(FIRST_LOAD_MAX / KB).toFixed(0).padStart(3)} kB  first load (entry + react)`);
if (firstLoad > FIRST_LOAD_MAX) failures.push(`first load: ${(firstLoad / KB).toFixed(1)} kB gzip > ${(FIRST_LOAD_MAX / KB).toFixed(0)} kB`);
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

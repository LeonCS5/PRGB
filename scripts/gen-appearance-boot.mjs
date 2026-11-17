// Regenerates public/appearance-boot.js from src/appearance/bootScript.ts (TypeScript, so it goes through Vite).
// A test fails when the committed file differs from what this writes.
import { writeFileSync } from 'node:fs';
import { createServer } from 'vite';

const server = await createServer({
  configFile: false,
  appType: 'custom',
  logLevel: 'error',
  server: { middlewareMode: true, hmr: false, ws: false }
});
try {
  const { buildBootScript } = await server.ssrLoadModule('/src/appearance/bootScript.ts');
  writeFileSync(new URL('../public/appearance-boot.js', import.meta.url), buildBootScript(), 'utf8');
  console.log('public/appearance-boot.js regenerated');
} finally {
  await server.close();
}

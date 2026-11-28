// `npm run e2e:supabase [-- --reset] [-- --stop] [-- <playwright args>]`
//
// Runs the end-to-end tests that need a Supabase (ranking, account, online pair) against the LOCAL stack in Docker:
//   1. checks that Docker answers;
//   2. starts the local Supabase if it is not running (`supabase start`, without the services the app never uses);
//   3. serves the Edge Function register-part locally if nobody does, allowing only the origin of the test preview;
//   4. runs Playwright with playwright.supabase.config.ts.
// It never touches the hosted project: no `link`, no `login`, no `--linked`, no `db push`, no `functions deploy`.
//
// --reset  re-creates the local database from the migrations (`supabase db reset`, local only) before the tests
// --stop   stops the local Supabase when the tests end (by default Docker is left as it is, so the next run is fast)
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const isWindows = process.platform === 'win32';
const args = process.argv.slice(2);
const wantsReset = args.includes('--reset');
const wantsStop = args.includes('--stop');
const playwrightArgs = args.filter((arg) => arg !== '--reset' && arg !== '--stop');

const FORBIDDEN = /(^|\s)(link|login|push|deploy|--linked)(\s|$)/;
const run = (command, commandArgs, options = {}) => {
  if (FORBIDDEN.test(commandArgs.join(' '))) throw new Error(`Refusing to run a command that could touch the hosted project: ${commandArgs.join(' ')}`);
  return spawnSync(command, commandArgs, { stdio: 'inherit', shell: isWindows, ...options });
};
const quiet = (command, commandArgs) =>
  spawnSync(command, commandArgs, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'], shell: isWindows });

const fail = (message) => {
  console.error(`\n${message}\n`);
  process.exit(1);
};

// 1. Docker
const docker = quiet('docker', ['info', '--format', '{{.ServerVersion}}']);
if (docker.status !== 0 || !docker.stdout.trim()) {
  fail('Docker is not running. Open Docker Desktop, wait until it says it is running, and try again.');
}

// 2. Local Supabase
const status = quiet('npx', ['supabase', 'status', '-o', 'env']);
const isUp = status.status === 0 && /API_URL=/.test(status.stdout);
if (!isUp) {
  console.log('Starting the local Supabase (the first run downloads several images)...');
  const started = run('npx', ['supabase', 'start', '-x', 'studio,imgproxy,storage-api,postgres-meta,logflare,vector,supavisor']);
  if (started.status !== 0) fail('`supabase start` failed.');
}
if (wantsReset) {
  console.log('Re-creating the local database from the migrations...');
  if (run('npx', ['supabase', 'db', 'reset', '--local', '--no-seed']).status !== 0) fail('`supabase db reset --local` failed.');
}

const env = quiet('npx', ['supabase', 'status', '-o', 'env']).stdout;
const apiUrl = /API_URL="?([^"\r\n]+)/.exec(env)?.[1];
if (!apiUrl || !/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(apiUrl)) fail('The local Supabase did not report a local API URL: refusing to continue.');

// 3. register-part, served locally. Without the apikey header the gateway answers 401 before it looks at the
// function, so the probe sends the local publishable key (read from `supabase status` here, in memory) and tells
// the function's own answer ("not_authenticated": no session) from "function not found".
const probeKey = /PUBLISHABLE_KEY="?([^"\r\n]+)/.exec(env)?.[1] ?? /ANON_KEY="?([^"\r\n]+)/.exec(env)?.[1];
if (!probeKey) fail('`supabase status` did not report a local key: refusing to continue.');
const functionUrl = `${apiUrl}/functions/v1/register-part`;
const isServed = async () => {
  try {
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: { apikey: probeKey, 'content-type': 'application/json' },
      body: '{}'
    });
    const text = await response.text();
    return response.status !== 404 && response.status < 500 && !/not.?found/i.test(text);
  } catch {
    return false;
  }
};
let functionsProcess = null;
let envDir = null;
if (!(await isServed())) {
  console.log('Serving the Edge Function register-part locally...');
  envDir = mkdtempSync(join(tmpdir(), 'prgb-e2e-'));
  const envFile = join(envDir, 'functions.env');
  // Only the origin of the test preview (the app is not on Vercel here)
  writeFileSync(envFile, 'ALLOWED_ORIGINS=http://127.0.0.1:4174\n');
  functionsProcess = spawn('npx', ['supabase', 'functions', 'serve', '--env-file', envFile], { stdio: 'ignore', shell: isWindows });
  let ready = false;
  for (let i = 0; i < 60 && !ready; i++) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    ready = await isServed();
  }
  if (!ready) {
    functionsProcess.kill();
    fail('The Edge Function did not start locally (`npx supabase functions serve`).');
  }
}

// 4. The tests
const tests = run('npx', ['playwright', 'test', '-c', 'playwright.supabase.config.ts', ...playwrightArgs]);

if (functionsProcess) {
  // On Windows the process tree is the shell and npx: kill it by pid with its children
  if (isWindows && functionsProcess.pid) spawnSync('taskkill', ['/pid', String(functionsProcess.pid), '/t', '/f'], { stdio: 'ignore' });
  else functionsProcess.kill();
}
if (envDir) rmSync(envDir, { recursive: true, force: true });
if (wantsStop) run('npx', ['supabase', 'stop']);

process.exit(tests.status ?? 1);

import { execFileSync } from 'node:child_process';

// The local Supabase (Docker) that the e2e:supabase tests talk to. Nothing in here can reach the hosted project:
// every URL is checked to be on this machine, and the keys come from `supabase status` at run time, in memory,
// never from a file (the local stack generates its own demo keys).

export const LOCAL_API_PORT = 54321;
// project_id of supabase/config.toml names the local containers (supabase_db_<id>); it is only a label
export const DB_CONTAINER = 'supabase_db_wpgjynobjocziltkasvv';
export const STACK_ENV = 'PRGB_E2E_STACK';

export interface LocalStack {
  apiUrl: string;
  publishableKey: string;
}

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost']);

// Refuses anything that is not plain http on this machine: the hosted project is always https on supabase.co
export const assertLocalUrl = (raw: string | undefined, what: string): URL => {
  if (!raw) throw new Error(`${what} is not set: the e2e:supabase tests only run against the local Supabase.`);
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`${what} is not a URL: refusing to run.`);
  }
  if (url.protocol !== 'http:' || !LOCAL_HOSTS.has(url.hostname)) {
    throw new Error(`${what} (${url.origin}) is not the local Supabase (http://127.0.0.1): refusing to run.`);
  }
  return url;
};

const parseEnvLines = (text: string): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const match = /^([A-Z_]+)="?(.*?)"?$/.exec(line.trim());
    if (match) out[match[1]] = match[2];
  }
  return out;
};

// Reads the running local stack once and keeps it in the environment of this process (workers inherit it)
export const readStack = (): LocalStack => {
  const cached = process.env[STACK_ENV];
  if (cached) {
    const parsed = JSON.parse(cached) as LocalStack;
    assertLocalUrl(parsed.apiUrl, 'API_URL of the local stack');
    return parsed;
  }
  let output: string;
  try {
    // Constant arguments, no user input. npx is a .cmd on Windows, which Node only runs through a shell
    output = execFileSync('npx', ['supabase', 'status', '-o', 'env'], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32'
    });
  } catch {
    throw new Error('The local Supabase is not running. Start Docker Desktop and run `npm run e2e:supabase` (it starts the stack).');
  }
  const values = parseEnvLines(output);
  assertLocalUrl(values.API_URL, 'API_URL of the local stack');
  const publishableKey = values.PUBLISHABLE_KEY || values.ANON_KEY;
  if (!publishableKey) throw new Error('`supabase status` did not return a publishable key.');
  const stack: LocalStack = { apiUrl: values.API_URL, publishableKey };
  process.env[STACK_ENV] = JSON.stringify(stack);
  return stack;
};

// SQL on the local database, through the Docker container: only for checks and clean-up of the tests
export const sql = (query: string): string => {
  return execFileSync('docker', ['exec', DB_CONTAINER, 'psql', '-U', 'postgres', '-At', '-F', '|', '-c', query], {
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim();
};

export const sqlNumber = (query: string): number => Number(sql(query));

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assertLocalUrl, readStack, sql, sqlNumber } from './localStack';

// Runs once, after the preview server is up and before the first test: the guards that make a wrong run impossible,
// and what the tests assume of the local stack. It returns the clean-up that removes the accounts the run created.
const BUNDLE_DIR = 'dist-e2e-local/assets';

const readBundle = (): string => {
  let text = '';
  for (const name of readdirSync(BUNDLE_DIR)) {
    if (name.endsWith('.js')) text += readFileSync(join(BUNDLE_DIR, name), 'utf-8');
  }
  return text;
};

export default async function globalSetup(): Promise<() => Promise<void>> {
  const stack = readStack();
  const api = assertLocalUrl(stack.apiUrl, 'API_URL of the local stack');

  // The app under test was built against this local API and not against the hosted project
  const bundle = readBundle();
  if (/[a-z0-9]{20}\.supabase\.co/.test(bundle)) throw new Error('The e2e bundle names a hosted Supabase project: refusing to run.');
  if (!bundle.includes(api.origin)) throw new Error('The e2e bundle was not built against the local API.');
  if (/eyJ[A-Za-z0-9_-]{20,}\.eyJ/.test(bundle)) throw new Error('The e2e bundle embeds a JWT-shaped key: the local build must use the publishable key.');

  // The stack answers, and Auth has anonymous sign-ins on (the ranking account starts as one)
  const health = await fetch(`${api.origin}/auth/v1/settings`, { headers: { apikey: stack.publishableKey } });
  if (!health.ok) throw new Error(`The local Auth answered ${health.status}. Is the stack healthy? (npx supabase status)`);
  const settings = (await health.json()) as { external?: { anonymous_users?: boolean }; disable_signup?: boolean };
  if (!settings.external?.anonymous_users) throw new Error('Anonymous sign-ins are off in the local Auth: see [auth] in supabase/config.toml.');

  // The migrations were applied from scratch and the seed is there (the exercise and the first piece are rankable)
  if (sqlNumber('select count(*) from public.song_parts where song_id in (-1, -200010)') !== 2) {
    throw new Error('The local database lacks the seeded parts: run `npx supabase db reset` (local) and try again.');
  }

  // The Edge Function runs (npx supabase functions serve): without a session it answers with its own error
  const fn = await fetch(`${api.origin}/functions/v1/register-part`, {
    method: 'POST',
    headers: { apikey: stack.publishableKey, 'content-type': 'application/json' },
    body: JSON.stringify({ songId: -1, partId: 0 })
  });
  if (fn.status === 404 || fn.status >= 500) throw new Error(`register-part is not being served locally (status ${fn.status}): run \`npx supabase functions serve\`.`);

  const startedAt = sql('select now()');
  return async () => {
    // Accounts the run created (anonymous users) and everything that hangs from them
    try {
      sql(`delete from auth.users where is_anonymous and created_at >= '${startedAt}'`);
    } catch (error) {
      console.warn('e2e:supabase clean-up skipped:', error instanceof Error ? error.message.split('\n')[0] : error);
    }
  };
}

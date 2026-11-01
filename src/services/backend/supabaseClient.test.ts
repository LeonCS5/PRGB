import { afterEach, describe, expect, it, vi } from 'vitest';

const createClient = vi.fn((url: string, key: string, options: unknown) => ({ url, key, options }));
vi.mock('@supabase/supabase-js', () => ({ createClient }));

// Fresh module each time: the client is cached at module level
const load = async () => {
  vi.resetModules();
  return import('./supabaseClient');
};

afterEach(() => {
  vi.unstubAllEnvs();
  createClient.mockClear();
});

describe('isBackendConfigured', () => {
  it('needs both the URL and the anon key', async () => {
    const { isBackendConfigured } = await load();
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    expect(isBackendConfigured()).toBe(false);
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '   ');
    expect(isBackendConfigured()).toBe(false);
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'public-anon-key');
    expect(isBackendConfigured()).toBe(true);
    vi.stubEnv('VITE_SUPABASE_URL', '');
    expect(isBackendConfigured()).toBe(false);
  });
});

describe('getSupabaseClient', () => {
  it('is null without configuration and never loads supabase-js', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    const { getSupabaseClient } = await load();
    expect(await getSupabaseClient()).toBeNull();
    expect(createClient).not.toHaveBeenCalled();
  });

  it('creates one client, without reading sessions from the URL', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', ' https://example.supabase.co ');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'public-anon-key');
    const { getSupabaseClient, AUTH_STORAGE_KEY } = await load();
    const [first, second] = await Promise.all([getSupabaseClient(), getSupabaseClient()]);
    expect(first).toBe(second);
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(createClient).toHaveBeenCalledWith('https://example.supabase.co', 'public-anon-key', {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: AUTH_STORAGE_KEY }
    });
  });
});

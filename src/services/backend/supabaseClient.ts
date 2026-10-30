// Supabase client for the optional online features (ranking, later online rooms). The game works
// without it: when the env vars are missing the backend is simply "not configured".

import type { SupabaseClient } from '@supabase/supabase-js';

export interface BackendConfig {
  url: string;
  anonKey: string;
}

// Session storage key, created only once the player signs in to the ranking (after consenting)
export const AUTH_STORAGE_KEY = 'prgb:auth';

// Read by name, so the keys declared in ImportMetaEnv (src/vite-env.d.ts) don't apply: check the value here
const readEnv = (name: string): string | undefined => {
  const value: unknown = (import.meta.env as Record<string, unknown>)[name];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
};

export function getBackendConfig(): BackendConfig | null {
  const url = readEnv('VITE_SUPABASE_URL');
  const anonKey = readEnv('VITE_SUPABASE_ANON_KEY');
  return url && anonKey ? { url, anonKey } : null;
}

export const isBackendConfigured = (): boolean => getBackendConfig() !== null;

let clientPromise: Promise<SupabaseClient> | null = null;

/**
 * The shared client, created on first use; null when the backend is not configured. supabase-js is
 * loaded on demand, so players who never open the ranking don't download it. Creating the client does
 * not create an account (see ensureAnonymousSession in rankingApi.ts).
 */
export function getSupabaseClient(): Promise<SupabaseClient | null> {
  const config = getBackendConfig();
  if (!config) return Promise.resolve(null);
  clientPromise ??= import('@supabase/supabase-js')
    .then(({ createClient }) => createClient(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: AUTH_STORAGE_KEY
      }
    }))
    .catch((error: unknown) => {
      // Let a later call retry, e.g. when the chunk failed to load offline
      clientPromise = null;
      throw error;
    });
  return clientPromise;
}

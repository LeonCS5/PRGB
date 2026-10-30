// Deno entry point of the register-part Edge Function. POST { songId, partId } with the player's session
// JWT; the logic lives in handler.ts. Database access uses a secret key (service role, bypasses RLS).

import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import {
  DEFAULT_ALLOWED_ORIGINS,
  createRegisterPartHandler,
  type NewSongPart,
  type RegisterPartStore,
  type SongPart
} from './handler.ts';

interface SongPartRow {
  song_id: number;
  part_id: number;
  revision_id: number;
  title: string;
  artist: string;
  track_name: string;
  scorable_notes: number;
  duration_ms: number;
  max_score: number;
}

const SONG_PART_COLUMNS =
  'song_id, part_id, revision_id, title, artist, track_name, scorable_notes, duration_ms, max_score';

// The new secret key when the project has one; the legacy service_role key otherwise (Supabase retires
// the legacy keys at the end of 2026)
function readSecretKey(): string | undefined {
  const keys = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (keys) {
    try {
      const parsed: unknown = JSON.parse(keys);
      const key = (parsed as Record<string, unknown> | null)?.default;
      if (typeof key === 'string' && key) return key;
    } catch {
      // Malformed: fall back to the legacy key
    }
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
}

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const secretKey = readSecretKey();
if (!supabaseUrl || !secretKey) {
  throw new Error('register-part needs SUPABASE_URL and SUPABASE_SECRET_KEYS or SUPABASE_SERVICE_ROLE_KEY');
}

const admin = createClient(supabaseUrl, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
});

const toSongPart = (row: SongPartRow): SongPart => ({
  songId: row.song_id,
  partId: row.part_id,
  revisionId: row.revision_id,
  title: row.title,
  artist: row.artist,
  trackName: row.track_name,
  scorableNotes: row.scorable_notes,
  durationMs: row.duration_ms,
  maxScore: row.max_score
});

const store: RegisterPartStore = {
  async getUserId(jwt) {
    // Asks Auth, so a token of a deleted account is refused even before it expires
    const { data, error } = await admin.auth.getUser(jwt);
    return error || !data.user ? null : data.user.id;
  },

  async hasProfile(userId) {
    const { data, error } = await admin.from('profiles').select('id').eq('id', userId).maybeSingle();
    if (error) throw new Error(`profiles: ${error.code}`);
    return data !== null;
  },

  async findPart(songId, partId) {
    const { data, error } = await admin
      .from('song_parts')
      .select(SONG_PART_COLUMNS)
      .eq('song_id', songId)
      .eq('part_id', partId)
      .maybeSingle();
    if (error) throw new Error(`song_parts: ${error.code}`);
    return data ? toSongPart(data as SongPartRow) : null;
  },

  async consumeQuota(userId, limit) {
    const { data, error } = await admin.rpc('consume_register_part_quota', { p_user_id: userId, p_limit: limit });
    if (error) throw new Error(`register_part_quota: ${error.code}`);
    return data === true;
  },

  async insertPart(part) {
    const { error } = await admin.from('song_parts')
      .upsert(toRow(part), { onConflict: 'song_id,part_id', ignoreDuplicates: true });
    if (error) throw new Error(`song_parts insert: ${error.code}`);
    return readBack(part);
  },

  async updatePart(part) {
    const { error } = await admin.from('song_parts')
      .update({ ...toRow(part), registered_at: new Date().toISOString() })
      .eq('song_id', part.songId)
      .eq('part_id', part.partId);
    if (error) throw new Error(`song_parts update: ${error.code}`);
    return readBack(part);
  }
};

function toRow(part: NewSongPart) {
  return {
    song_id: part.songId,
    part_id: part.partId,
    revision_id: part.revisionId,
    title: part.title,
    artist: part.artist,
    track_name: part.trackName,
    scorable_notes: part.scorableNotes,
    duration_ms: part.durationMs,
    max_score: part.maxScore,
    registered_by: part.registeredBy
  };
}

async function readBack(part: NewSongPart): Promise<SongPart> {
  const stored = await store.findPart(part.songId, part.partId);
  if (!stored) throw new Error('song_parts: row missing after write');
  return stored;
}

// Optional override, comma-separated (e.g. to allow a Vercel preview URL)
const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

Deno.serve(createRegisterPartHandler({
  store,
  fetch,
  allowedOrigins: allowedOrigins.length > 0 ? allowedOrigins : DEFAULT_ALLOWED_ORIGINS,
  log: (message) => console.error(message)
}));

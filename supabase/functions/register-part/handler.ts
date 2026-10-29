// register-part: counts a Songsterr track on the server, with the game's own parser, so submit_score can
// bound the scores sent for it. Request handling only; index.ts wires Deno, Supabase and the network,
// which keeps this file runnable in Vitest. Never logs personal data (user ids, tokens).

import { countScorableNotes, maxPossibleScore } from '../_shared/scoreLimits.ts';
import {
  normalizeSongMeta,
  normalizeTab,
  type NormalizedSongTab,
  type SongsterrMeta
} from '../_shared/tabNormalizer.ts';

export const DEFAULT_ALLOWED_ORIGINS: readonly string[] = [
  'https://prgb.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173'
];
export const SONGSTERR_META_URL = 'https://www.songsterr.com/api/meta';
export const SONGSTERR_CDN_HOSTS: readonly string[] = [
  'https://dqsljvtekg760.cloudfront.net',
  'https://d3d3l6a6rcgkaf.cloudfront.net'
];
export const REGISTRATIONS_PER_HOUR = 30;
export const FETCH_TIMEOUT_MS = 8000;

// Same as the app's dev proxy (vite.config.ts): Songsterr answers browser-like clients
const SONGSTERR_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};
const INT4_MAX = 2_147_483_647;
const TEXT_MAX = 200;

/** Response body on success: the part as counted for the Songsterr tab revision `revisionId`. */
export interface SongPart {
  songId: number;
  partId: number;
  revisionId: number;
  title: string;
  artist: string;
  trackName: string;
  scorableNotes: number;
  durationMs: number;
  maxScore: number;
}

export interface NewSongPart extends SongPart {
  registeredBy: string;
}

/** Database access, done with the service role in index.ts. */
export interface RegisterPartStore {
  /** Id of the user behind a session JWT, or null when it is not a valid session. */
  getUserId(jwt: string): Promise<string | null>;
  hasProfile(userId: string): Promise<boolean>;
  findPart(songId: number, partId: number): Promise<SongPart | null>;
  countRegistrationsSince(userId: string, since: Date): Promise<number>;
  /** Inserts unless the part already exists (a concurrent request won), then returns the stored row. */
  insertPart(part: NewSongPart): Promise<SongPart>;
  /** Replaces the counts of an existing part with those of a newer revision, then returns the stored row. */
  updatePart(part: NewSongPart): Promise<SongPart>;
}

/** Response body on failure: `{ error: code }`. */
export type RegisterPartErrorCode =
  | 'method_not_allowed'
  | 'invalid_input'
  | 'not_authenticated'
  | 'profile_required'
  | 'rate_limited'
  | 'song_not_found'
  | 'part_not_found'
  | 'songsterr_unavailable'
  | 'tab_invalid'
  | 'tab_empty'
  | 'internal_error';

export interface RegisterPartDeps {
  store: RegisterPartStore;
  fetch: typeof fetch;
  allowedOrigins?: readonly string[];
  timeoutMs?: number;
  now?: () => Date;
  log?: (message: string) => void;
}

class HttpError extends Error {
  readonly status: number;
  readonly code: RegisterPartErrorCode;

  constructor(status: number, code: RegisterPartErrorCode) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

const isInt4 = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && Math.abs(value) <= INT4_MAX;

const shortText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '').slice(0, TEXT_MAX);

function corsHeaders(origin: string | null, allowedOrigins: readonly string[]): Record<string, string> {
  const headers: Record<string, string> = { Vary: 'Origin' };
  if (origin && allowedOrigins.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Headers'] = 'authorization, x-client-info, apikey, content-type, x-region';
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    headers['Access-Control-Max-Age'] = '86400';
  }
  return headers;
}

const json = (status: number, body: unknown, headers: Record<string, string>): Response =>
  new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } });

const isRevision = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

/** Body: `{ songId, partId, revisionId? }`, revisionId being the revision of the tab the app loaded. */
async function readRequest(request: Request): Promise<{ songId: number; partId: number; revisionId?: number }> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new HttpError(400, 'invalid_input');
  }
  const { songId, partId, revisionId } = (body ?? {}) as Record<string, unknown>;
  if (!isInt4(songId) || !isInt4(partId)) throw new HttpError(400, 'invalid_input');
  if (revisionId === undefined || revisionId === null) return { songId, partId };
  if (!isRevision(revisionId)) throw new HttpError(400, 'invalid_input');
  return { songId, partId, revisionId };
}

export function createRegisterPartHandler(deps: RegisterPartDeps): (request: Request) => Promise<Response> {
  const allowedOrigins = deps.allowedOrigins ?? DEFAULT_ALLOWED_ORIGINS;
  const timeoutMs = deps.timeoutMs ?? FETCH_TIMEOUT_MS;
  const now = deps.now ?? (() => new Date());
  const log = deps.log ?? (() => undefined);

  const fetchSongsterr = async (url: string): Promise<Response> => {
    try {
      return await deps.fetch(url, { headers: SONGSTERR_HEADERS, signal: AbortSignal.timeout(timeoutMs) });
    } catch {
      throw new HttpError(502, 'songsterr_unavailable');
    }
  };

  const readJson = async (response: Response, failure: HttpError): Promise<unknown> => {
    try {
      return await response.json();
    } catch {
      throw failure;
    }
  };

  async function fetchMeta(songId: number): Promise<SongsterrMeta> {
    const response = await fetchSongsterr(`${SONGSTERR_META_URL}/${songId}`);
    if (response.status === 404) throw new HttpError(404, 'song_not_found');
    if (!response.ok) throw new HttpError(502, 'songsterr_unavailable');
    const data = await readJson(response, new HttpError(502, 'songsterr_unavailable'));
    let meta: SongsterrMeta;
    try {
      meta = normalizeSongMeta(data);
    } catch {
      throw new HttpError(404, 'song_not_found');
    }
    // The ids end up in the CDN path and in the database
    if (meta.songId !== songId || !isRevision(meta.revisionId)) throw new HttpError(502, 'songsterr_unavailable');
    return meta;
  }

  // Same CDN path and fallback order as SongsterrApi.getTrackTabJson
  async function fetchTab(meta: SongsterrMeta, partId: number): Promise<unknown> {
    const path = `/${meta.songId}/${meta.revisionId}/${encodeURIComponent(String(meta.image))}/${partId}.json`;
    for (const host of SONGSTERR_CDN_HOSTS) {
      let response: Response;
      try {
        response = await fetchSongsterr(`${host}${path}`);
      } catch {
        continue;
      }
      if (response.ok) return readJson(response, new HttpError(422, 'tab_invalid'));
    }
    throw new HttpError(502, 'songsterr_unavailable');
  }

  async function countPart(meta: SongsterrMeta, partId: number, registeredBy: string): Promise<NewSongPart> {
    const trackIndex = meta.tracks.findIndex((track) => track.partId === partId);
    if (trackIndex < 0) throw new HttpError(404, 'part_not_found');

    const rawTab = await fetchTab(meta, partId);
    // Same acceptance as the app's loadSongTrack
    if (!rawTab || typeof rawTab !== 'object' || !Array.isArray((rawTab as { measures?: unknown }).measures)) {
      throw new HttpError(422, 'tab_invalid');
    }
    let tab: NormalizedSongTab;
    try {
      tab = normalizeTab(rawTab, meta, trackIndex);
    } catch {
      throw new HttpError(422, 'tab_invalid');
    }
    if (tab.notes.length === 0) throw new HttpError(422, 'tab_empty');

    const scorableNotes = countScorableNotes(tab.notes);
    const maxScore = maxPossibleScore(scorableNotes);
    if (!isInt4(tab.totalDurationMs) || tab.totalDurationMs <= 0 || !isInt4(maxScore)) {
      throw new HttpError(422, 'tab_invalid');
    }
    return {
      songId: meta.songId,
      partId,
      revisionId: meta.revisionId,
      title: shortText(meta.title),
      artist: shortText(meta.artist),
      trackName: shortText(tab.trackName),
      scorableNotes,
      durationMs: tab.totalDurationMs,
      maxScore,
      registeredBy
    };
  }

  return async (request: Request): Promise<Response> => {
    const cors = corsHeaders(request.headers.get('Origin'), allowedOrigins);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    try {
      if (request.method !== 'POST') throw new HttpError(405, 'method_not_allowed');

      const jwt = /^Bearer\s+(\S+)$/i.exec(request.headers.get('Authorization') ?? '')?.[1];
      const userId = jwt ? await deps.store.getUserId(jwt) : null;
      if (!userId) throw new HttpError(401, 'not_authenticated');
      if (!(await deps.store.hasProfile(userId))) throw new HttpError(403, 'profile_required');

      const { songId, partId, revisionId } = await readRequest(request);
      const existing = await deps.store.findPart(songId, partId);
      // Songsterr ids are positive; negative ones are reserved for parts seeded by migrations (the demo)
      const seeded = songId <= 0 || partId < 0;
      // Counted already, and the app saw no other revision: nothing to fetch
      if (existing && (seeded || revisionId === undefined || revisionId === existing.revisionId)) {
        return json(200, existing, cors);
      }
      if (seeded) throw new HttpError(404, 'song_not_found');

      const since = new Date(now().getTime() - 3_600_000);
      if ((await deps.store.countRegistrationsSince(userId, since)) >= REGISTRATIONS_PER_HOUR) {
        throw new HttpError(429, 'rate_limited');
      }

      // Songsterr decides the current revision; the one the app sent only triggers the check
      const meta = await fetchMeta(songId);
      if (existing && meta.revisionId === existing.revisionId) return json(200, existing, cors);
      const counted = await countPart(meta, partId, userId);
      const stored = existing ? await deps.store.updatePart(counted) : await deps.store.insertPart(counted);
      return json(200, stored, cors);
    } catch (error) {
      if (error instanceof HttpError) return json(error.status, { error: error.code }, cors);
      // Store errors carry only a table name and an error code (see index.ts)
      log(`register-part: ${error instanceof Error ? `${error.name}: ${error.message}` : typeof error}`);
      return json(500, { error: 'internal_error' }, cors);
    }
  };
}

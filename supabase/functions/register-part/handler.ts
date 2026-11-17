// register-part: returns the counts of a part already stored in the database (seeded by a migration, or
// registered by an earlier version of this function) so the app can start a ranked run. It never contacts an
// external catalog: the ranking only accepts content the database already knows. Request handling only;
// index.ts wires Deno and Supabase, which keeps this file runnable in Vitest. Never logs personal data.

export const DEFAULT_ALLOWED_ORIGINS: readonly string[] = [
  'https://prgb.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173'
];
const INT4_MAX = 2_147_483_647;

/** Response body on success: the stored part, as counted for the tab revision `revisionId`. */
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

/** Database access, done with the service role in index.ts. */
export interface RegisterPartStore {
  /** Id of the user behind a session JWT, or null when it is not a valid session. */
  getUserId(jwt: string): Promise<string | null>;
  hasProfile(userId: string): Promise<boolean>;
  findPart(songId: number, partId: number): Promise<SongPart | null>;
}

/** Response body on failure: `{ error: code }`. */
export type RegisterPartErrorCode =
  | 'method_not_allowed'
  | 'invalid_input'
  | 'not_authenticated'
  | 'profile_required'
  | 'song_not_found'
  | 'internal_error';

export interface RegisterPartDeps {
  store: RegisterPartStore;
  allowedOrigins?: readonly string[];
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

/** Body: `{ songId, partId, revisionId? }`. The revision is still validated, but there is nothing to refetch. */
async function readRequest(request: Request): Promise<{ songId: number; partId: number }> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new HttpError(400, 'invalid_input');
  }
  const { songId, partId, revisionId } = (body ?? {}) as Record<string, unknown>;
  if (!isInt4(songId) || !isInt4(partId)) throw new HttpError(400, 'invalid_input');
  if (revisionId !== undefined && revisionId !== null && !isRevision(revisionId)) throw new HttpError(400, 'invalid_input');
  return { songId, partId };
}

export function createRegisterPartHandler(deps: RegisterPartDeps): (request: Request) => Promise<Response> {
  const allowedOrigins = deps.allowedOrigins ?? DEFAULT_ALLOWED_ORIGINS;
  const log = deps.log ?? (() => undefined);

  return async (request: Request): Promise<Response> => {
    const cors = corsHeaders(request.headers.get('Origin'), allowedOrigins);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    try {
      if (request.method !== 'POST') throw new HttpError(405, 'method_not_allowed');

      const jwt = /^Bearer\s+(\S+)$/i.exec(request.headers.get('Authorization') ?? '')?.[1];
      const userId = jwt ? await deps.store.getUserId(jwt) : null;
      if (!userId) throw new HttpError(401, 'not_authenticated');
      if (!(await deps.store.hasProfile(userId))) throw new HttpError(403, 'profile_required');

      const { songId, partId } = await readRequest(request);
      const part = await deps.store.findPart(songId, partId);
      // Not stored means not rankable: no other source is consulted
      if (!part) throw new HttpError(404, 'song_not_found');
      return json(200, part, cors);
    } catch (error) {
      if (error instanceof HttpError) return json(error.status, { error: error.code }, cors);
      // Store errors carry only a table name and an error code (see index.ts)
      log(`register-part: ${error instanceof Error ? `${error.name}: ${error.message}` : typeof error}`);
      return json(500, { error: 'internal_error' }, cors);
    }
  };
}

// Online ranking client: typed wrappers over the database RPCs (supabase/migrations) and the register-part
// Edge Function. Every function rejects with a RankingError whose `code` is stable, for the UI to map to a
// pt-BR message. Ranked flow: ensureAnonymousSession (only after consent) -> createProfile ->
// registerPart -> startRankedSession (at 1x speed) -> submitScore -> getLeaderboard / getMyPosition.

import type { SupabaseClient, User } from '@supabase/supabase-js';
import { getSupabaseClient } from './supabaseClient';

export type RankingErrorCode =
  // Client side
  | 'not_configured' // VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing
  | 'network'
  | 'unknown'
  // Any call
  | 'not_authenticated'
  | 'invalid_input'
  | 'rate_limited'
  // Profile
  | 'consent_required'
  | 'nickname_invalid'
  | 'nickname_blocked'
  | 'nickname_taken'
  | 'profile_exists'
  | 'profile_required'
  // Ranked play
  | 'part_unregistered'
  | 'revision_mismatch' // the server counted another tab revision: registerPart with yours, then start again
  | 'session_invalid'
  | 'session_too_short'
  | 'session_expired'
  | 'already_submitted'
  | 'score_implausible'
  | 'empty_run' // nothing judged or nothing scored: the run does not enter the leaderboard
  // registerPart
  | 'song_not_found'
  | 'part_not_found'
  | 'songsterr_unavailable'
  | 'tab_invalid'
  | 'tab_empty';

// Codes the server sends: RPC exception messages and the Edge Function's { error } body
const SERVER_CODES: ReadonlySet<string> = new Set<RankingErrorCode>([
  'not_authenticated', 'invalid_input', 'rate_limited', 'consent_required', 'nickname_invalid', 'nickname_blocked',
  'nickname_taken', 'profile_exists', 'profile_required', 'part_unregistered', 'revision_mismatch', 'session_invalid',
  'session_too_short',
  'session_expired', 'already_submitted', 'score_implausible', 'empty_run', 'song_not_found', 'part_not_found',
  'songsterr_unavailable', 'tab_invalid', 'tab_empty'
]);

export class RankingError extends Error {
  readonly code: RankingErrorCode;

  constructor(code: RankingErrorCode, options?: ErrorOptions) {
    super(code, options);
    this.name = 'RankingError';
    this.code = code;
  }
}

// Supabase Auth error codes meaning the stored session can't be used any more
const AUTH_SESSION_GONE: ReadonlySet<string> = new Set([
  'user_not_found', 'session_not_found', 'refresh_token_not_found', 'refresh_token_already_used', 'bad_jwt',
  'no_authorization'
]);

const isServerCode = (value: unknown): value is RankingErrorCode =>
  typeof value === 'string' && SERVER_CODES.has(value);

/** Maps an error from supabase-js (PostgREST, Auth, Functions) to a RankingError. */
export function toRankingError(error: unknown): RankingError {
  if (error instanceof RankingError) return error;
  if (typeof error === 'object' && error !== null) {
    const { message, code, name, status } = error as Record<string, unknown>;
    if (isServerCode(message)) return new RankingError(message, { cause: error });
    // Permission denied (anon calling a player RPC) or a JWT PostgREST refused
    if (code === '42501' || (typeof code === 'string' && /^PGRST30[123]$/.test(code)) || status === 401) {
      return new RankingError('not_authenticated', { cause: error });
    }
    // Auth refusing the stored session, e.g. its account was deleted by the player or by the retention purge
    if (name === 'AuthSessionMissingError' || (typeof code === 'string' && AUTH_SESSION_GONE.has(code))
      || ('__isAuthError' in error && status === 403)) {
      return new RankingError('not_authenticated', { cause: error });
    }
    if (name === 'AuthRetryableFetchError' || name === 'FunctionsFetchError' || name === 'FunctionsRelayError') {
      return new RankingError('network', { cause: error });
    }
    if (status === 429) return new RankingError('rate_limited', { cause: error });
  }
  return new RankingError('unknown', { cause: error });
}

// Edge Function failures carry the Response; its body is { error: code } when it comes from our code
async function toFunctionError(error: unknown): Promise<RankingError> {
  const { name, context } = (error ?? {}) as { name?: unknown; context?: unknown };
  const response = context as Partial<Response> | undefined;
  if (name === 'FunctionsHttpError' && typeof response?.status === 'number' && typeof response.clone === 'function') {
    let body: unknown = null;
    try {
      body = await response.clone().json();
    } catch {
      // Not JSON: the platform answered before our function (e.g. "Invalid JWT")
    }
    const code = (body as { error?: unknown } | null)?.error;
    if (isServerCode(code)) return new RankingError(code, { cause: error });
    if (response.status === 401) return new RankingError('not_authenticated', { cause: error });
    if (response.status === 429) return new RankingError('rate_limited', { cause: error });
    return new RankingError('unknown', { cause: error });
  }
  return toRankingError(error);
}

// Types -----------------------------------------------------------------------------------------------

export interface RankingSession {
  userId: string;
  isAnonymous: boolean;
}

export interface RankingProfile {
  nickname: string;
  ageConfirmedAt: string; // ISO timestamps
  consentAt: string;
  consentVersion: string;
  createdAt: string;
  lastSeenAt: string;
}

export interface TermsAcceptance {
  ageConfirmed: boolean; // 18+, self-declared
  consent: boolean;
  consentVersion: string; // version of the text the player accepted: 1-32 of [0-9A-Za-z._-]
}

export interface CreateProfileInput extends TermsAcceptance {
  nickname: string;
}

/**
 * A Songsterr track as counted by the server (register-part), for tab revision `revisionId`. If it differs
 * from the revision the app loaded (SongsterrMeta.revisionId), reload the tab before a ranked run.
 */
export interface RegisteredPart {
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

export interface SubmitScoreInput {
  sessionId: string;
  score: number;
  perfect: number;
  good: number;
  miss: number;
  maxCombo: number;
  accuracy: number; // 0-100, as shown by the game
}

export interface SubmitScoreResult {
  accepted: boolean;
  personalBest: boolean; // this run became the player's best for the part
  weeklyBest: boolean;
  rankAll: number; // rank of the player's current best, all time
  rankWeek: number; // rank of the player's best this week (weeks start Monday, Brasília time)
}

export type LeaderboardPeriod = 'all' | 'week';

export interface LeaderboardQuery {
  songId: number;
  partId: number;
  period?: LeaderboardPeriod; // default 'all'
  limit?: number; // 1-100, default 50
}

export interface LeaderboardEntry {
  rank: number; // equal scores share a rank
  nickname: string;
  score: number;
  accuracy: number;
  maxCombo: number;
  achievedAt: string;
  isMe: boolean;
}

export interface ServerTime {
  serverTimeMs: number;
  offsetMs: number; // add to Date.now() to estimate the server clock
  roundTripMs: number;
}

/** export_my_data(): everything linked to the account, as stored (snake_case), for a JSON download. */
export interface RankingDataExport {
  exported_at: string;
  account: { id: string; created_at: string; is_anonymous: boolean } | null;
  profile: {
    nickname: string;
    age_confirmed_at: string;
    consent_at: string;
    consent_version: string;
    created_at: string;
    last_seen_at: string;
  } | null;
  scores_best: ExportedScore[];
  scores_weekly: (ExportedScore & { week_start: string })[];
  play_sessions: {
    song_id: number;
    part_id: number;
    revision_id: number;
    started_at: string;
    submitted_at: string | null;
  }[];
  registered_parts: { song_id: number; part_id: number; title: string; track_name: string; registered_at: string }[];
  register_part_quota: { window_start: string; used: number }[]; // Songsterr fetches per hour, kept 1 day
  room_seats: { code: string; seat: 1 | 2; joined_at: string }[];
  room_create_quota: string[]; // At most ten creation timestamps from the rolling hourly limit
}

export interface ExportedScore {
  song_id: number;
  part_id: number;
  title: string;
  artist: string;
  track_name: string;
  score: number;
  accuracy: number;
  max_combo: number;
  perfect: number;
  good: number;
  miss: number;
  achieved_at: string;
}

// Response parsing (the network is a system boundary) --------------------------------------------------

const invalidResponse = (): RankingError => new RankingError('unknown', { cause: new Error('Unexpected response') });

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw invalidResponse();
  return value as Record<string, unknown>;
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string') throw invalidResponse();
  return value;
}

function readNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) throw invalidResponse();
  return value;
}

function readBoolean(record: Record<string, unknown>, key: string): boolean {
  const value = record[key];
  if (typeof value !== 'boolean') throw invalidResponse();
  return value;
}

function parseProfile(data: unknown): RankingProfile {
  const record = asRecord(data);
  return {
    nickname: readString(record, 'nickname'),
    ageConfirmedAt: readString(record, 'ageConfirmedAt'),
    consentAt: readString(record, 'consentAt'),
    consentVersion: readString(record, 'consentVersion'),
    createdAt: readString(record, 'createdAt'),
    lastSeenAt: readString(record, 'lastSeenAt')
  };
}

function parseRegisteredPart(data: unknown): RegisteredPart {
  const record = asRecord(data);
  return {
    songId: readNumber(record, 'songId'),
    partId: readNumber(record, 'partId'),
    revisionId: readNumber(record, 'revisionId'),
    title: readString(record, 'title'),
    artist: readString(record, 'artist'),
    trackName: readString(record, 'trackName'),
    scorableNotes: readNumber(record, 'scorableNotes'),
    durationMs: readNumber(record, 'durationMs'),
    maxScore: readNumber(record, 'maxScore')
  };
}

function parseLeaderboardEntry(data: unknown): LeaderboardEntry {
  const record = asRecord(data);
  return {
    rank: readNumber(record, 'rank'),
    nickname: readString(record, 'nickname'),
    score: readNumber(record, 'score'),
    accuracy: readNumber(record, 'accuracy'),
    maxCombo: readNumber(record, 'max_combo'),
    achievedAt: readString(record, 'achieved_at'),
    isMe: readBoolean(record, 'is_me')
  };
}

const parseRows = (data: unknown): LeaderboardEntry[] => {
  if (!Array.isArray(data)) throw invalidResponse();
  return data.map(parseLeaderboardEntry);
};

// Calls -----------------------------------------------------------------------------------------------

async function requireClient(): Promise<SupabaseClient> {
  let client: SupabaseClient | null;
  try {
    client = await getSupabaseClient();
  } catch (error) {
    // supabase-js is loaded on demand; this fails when its chunk can't be downloaded
    throw new RankingError('network', { cause: error });
  }
  if (!client) throw new RankingError('not_configured');
  return client;
}

async function callRpc(client: SupabaseClient, fn: string, args?: Record<string, unknown>): Promise<unknown> {
  const { data, error, status } = await client.rpc(fn, args);
  if (error) throw status === 0 ? new RankingError('network', { cause: error }) : toRankingError(error);
  return data;
}

const toSession = (user: User): RankingSession => ({ userId: user.id, isAnonymous: user.is_anonymous === true });

async function readSession(client: SupabaseClient): Promise<RankingSession | null> {
  const { data, error } = await client.auth.getSession();
  if (error) throw toRankingError(error);
  return data.session ? toSession(data.session.user) : null;
}

function assertIntegers(values: number[]): void {
  if (!values.every(Number.isSafeInteger)) throw new RankingError('invalid_input');
}

function assertPeriod(period: string): void {
  if (period !== 'all' && period !== 'week') throw new RankingError('invalid_input');
}

/** The current session, or null. Reads local storage; never creates an account. */
export async function getSession(): Promise<RankingSession | null> {
  return readSession(await requireClient());
}

/**
 * Returns the session, creating an anonymous account when there is none. Call it only after the player
 * accepted the terms and confirmed being 18+: the account is the start of data processing (LGPD).
 */
export async function ensureAnonymousSession(): Promise<RankingSession> {
  const client = await requireClient();
  try {
    const existing = await readSession(client);
    if (existing) {
      // The stored session may belong to an account deleted meanwhile (by the player or the purge)
      const { error } = await client.auth.getUser();
      if (!error) return existing;
      throw toRankingError(error);
    }
  } catch (error) {
    // Only a refused session is replaced; a network failure must not create another account
    if (toRankingError(error).code !== 'not_authenticated') throw toRankingError(error);
    await signOutLocally(client);
  }
  return signInAnonymously(client);
}

async function signInAnonymously(client: SupabaseClient): Promise<RankingSession> {
  const { data, error } = await client.auth.signInAnonymously();
  if (error || !data.user) throw toRankingError(error);
  return toSession(data.user);
}

async function signOutLocally(client: SupabaseClient): Promise<void> {
  try {
    await client.auth.signOut({ scope: 'local' });
  } catch {
    // The local copy is all there is to clear; a failure here changes nothing for the player
  }
}

/** null without a session or before createProfile. */
export async function getMyProfile(): Promise<RankingProfile | null> {
  const client = await requireClient();
  if (!(await readSession(client))) return null;
  const data = await callRpc(client, 'get_my_profile');
  return data === null ? null : parseProfile(data);
}

/**
 * Creates the profile with the consent given right now. If the stored session belongs to an account that no
 * longer exists, it signs in anonymously again and retries once (the player is consenting, so the new
 * account is covered).
 */
export async function createProfile(input: CreateProfileInput): Promise<RankingProfile> {
  const client = await requireClient();
  const create = async () => parseProfile(await callRpc(client, 'create_profile', {
    p_nickname: input.nickname,
    p_age_confirmed: input.ageConfirmed,
    p_consent: input.consent,
    p_consent_version: input.consentVersion
  }));
  try {
    return await create();
  } catch (error) {
    if (!(error instanceof RankingError) || error.code !== 'not_authenticated') throw error;
    await signOutLocally(client);
    await signInAnonymously(client);
    return create();
  }
}

/** Records a new acceptance when the terms change (needs a profile): consent_required, profile_required. */
export async function reacceptTerms(input: TermsAcceptance): Promise<RankingProfile> {
  const client = await requireClient();
  return parseProfile(await callRpc(client, 'reaccept_terms', {
    p_age_confirmed: input.ageConfirmed,
    p_consent: input.consent,
    p_consent_version: input.consentVersion
  }));
}

export async function updateNickname(nickname: string): Promise<RankingProfile> {
  const client = await requireClient();
  return parseProfile(await callRpc(client, 'update_nickname', { p_nickname: nickname }));
}

/** Marks the player as active (accounts idle for 12 months are deleted). */
export async function touchLastSeen(): Promise<void> {
  const client = await requireClient();
  await callRpc(client, 'touch_last_seen');
}

export async function exportMyData(): Promise<RankingDataExport> {
  const client = await requireClient();
  const data = asRecord(await callRpc(client, 'export_my_data'));
  readString(data, 'exported_at');
  return data as unknown as RankingDataExport;
}

/** Deletes the account and everything linked to it, then clears the local session. */
export async function deleteMyAccount(): Promise<void> {
  const client = await requireClient();
  await callRpc(client, 'delete_my_account');
  // The account no longer exists, so only the local copy of the session is left to clear; the deletion
  // succeeded even if that fails
  await signOutLocally(client);
}

/**
 * Asks the server to count a track, or returns the stored count. Pass the revision of the tab you loaded
 * (SongsterrMeta.revisionId): when it differs from the stored one the server checks Songsterr and recounts
 * if there is a newer revision. Needs a session and a profile.
 */
export async function registerPart(songId: number, partId: number, revisionId?: number): Promise<RegisteredPart> {
  assertIntegers(revisionId === undefined ? [songId, partId] : [songId, partId, revisionId]);
  const client = await requireClient();
  // Without a session the platform would refuse the request before the function runs
  if (!(await readSession(client))) throw new RankingError('not_authenticated');
  const body = revisionId === undefined ? { songId, partId } : { songId, partId, revisionId };
  const { data, error } = await client.functions.invoke('register-part', { body, timeout: 30_000 });
  if (error) throw await toFunctionError(error);
  return parseRegisteredPart(data);
}

/**
 * Starts a ranked run and returns its id. The app must lock it to 1x speed without seeking: the server only
 * refuses runs shorter than 90% of the song. With `revisionId`, a different revision on the server is
 * refused (revision_mismatch) instead of checking the run against other numbers.
 */
export async function startRankedSession(songId: number, partId: number, revisionId?: number): Promise<string> {
  assertIntegers(revisionId === undefined ? [songId, partId] : [songId, partId, revisionId]);
  const client = await requireClient();
  const data = await callRpc(client, 'start_session', revisionId === undefined
    ? { p_song_id: songId, p_part_id: partId }
    : { p_song_id: songId, p_part_id: partId, p_revision_id: revisionId });
  if (typeof data !== 'string') throw invalidResponse();
  return data;
}

export async function submitScore(input: SubmitScoreInput): Promise<SubmitScoreResult> {
  assertIntegers([input.score, input.perfect, input.good, input.miss, input.maxCombo, input.accuracy]);
  const client = await requireClient();
  const record = asRecord(await callRpc(client, 'submit_score', {
    p_session_id: input.sessionId,
    p_score: input.score,
    p_perfect: input.perfect,
    p_good: input.good,
    p_miss: input.miss,
    p_max_combo: input.maxCombo,
    p_accuracy: input.accuracy
  }));
  return {
    accepted: readBoolean(record, 'accepted'),
    personalBest: readBoolean(record, 'personalBest'),
    weeklyBest: readBoolean(record, 'weeklyBest'),
    rankAll: readNumber(record, 'rankAll'),
    rankWeek: readNumber(record, 'rankWeek')
  };
}

/** Public: works without a session. */
export async function getLeaderboard({ songId, partId, period = 'all', limit = 50 }: LeaderboardQuery): Promise<LeaderboardEntry[]> {
  assertIntegers([songId, partId, limit]);
  assertPeriod(period);
  const client = await requireClient();
  return parseRows(await callRpc(client, 'get_leaderboard', {
    p_song_id: songId,
    p_part_id: partId,
    p_period: period,
    p_limit: limit
  }));
}

/** The player's own row, for when they are outside the top; null without a session or a score. */
export async function getMyPosition({ songId, partId, period = 'all' }: Omit<LeaderboardQuery, 'limit'>): Promise<LeaderboardEntry | null> {
  assertIntegers([songId, partId]);
  assertPeriod(period);
  const client = await requireClient();
  if (!(await readSession(client))) return null;
  const rows = parseRows(await callRpc(client, 'get_my_position', { p_song_id: songId, p_part_id: partId, p_period: period }));
  return rows[0] ?? null;
}

/** Server clock, with the offset to the local one (half the round trip assumed each way). */
export async function getServerTime(): Promise<ServerTime> {
  const client = await requireClient();
  const sentAt = Date.now();
  const data = await callRpc(client, 'server_time');
  const receivedAt = Date.now();
  const serverTimeMs = typeof data === 'string' ? Date.parse(data) : Number.NaN;
  if (!Number.isFinite(serverTimeMs)) throw invalidResponse();
  const roundTripMs = receivedAt - sentAt;
  return { serverTimeMs, roundTripMs, offsetMs: serverTimeMs - (sentAt + roundTripMs / 2) };
}

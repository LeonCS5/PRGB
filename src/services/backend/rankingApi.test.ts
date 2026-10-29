import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from './rankingApi';
import { RankingError, toRankingError } from './rankingApi';
import { getSupabaseClient } from './supabaseClient';

vi.mock('./supabaseClient', () => ({ getSupabaseClient: vi.fn() }));

const USER = { id: 'user-1', is_anonymous: true };
const PROFILE = {
  nickname: 'João Silva', ageConfirmedAt: '2026-10-29T10:00:00+00:00', consentAt: '2026-10-29T10:00:00+00:00',
  consentVersion: '2026-10', createdAt: '2026-10-29T10:00:00+00:00', lastSeenAt: '2026-10-29T10:00:00+00:00'
};
const ROW = { rank: 1, nickname: 'Ana', score: 4000, accuracy: 90, max_combo: 12, achieved_at: '2026-10-29T10:00:00+00:00', is_me: true };

type RpcResult = { data: unknown; error: unknown; status: number };

function fakeClient(options: { session?: boolean; rpc?: RpcResult } = {}) {
  return {
    rpc: vi.fn(async (): Promise<RpcResult> => options.rpc ?? { data: null, error: null, status: 200 }),
    auth: {
      getSession: vi.fn(async () => ({ data: { session: options.session === false ? null : { user: USER } }, error: null })),
      signInAnonymously: vi.fn(async () => ({ data: { user: USER, session: {} }, error: null })),
      signOut: vi.fn(async () => ({ error: null }))
    },
    functions: { invoke: vi.fn() }
  };
}

let client: ReturnType<typeof fakeClient>;
const useClient = (fake: ReturnType<typeof fakeClient>) => {
  client = fake;
  vi.mocked(getSupabaseClient).mockResolvedValue(fake as unknown as SupabaseClient);
};

const rejectsWith = (promise: Promise<unknown>, code: api.RankingErrorCode) =>
  expect(promise).rejects.toMatchObject({ name: 'RankingError', code });

beforeEach(() => useClient(fakeClient()));
afterEach(() => vi.restoreAllMocks());

describe('toRankingError', () => {
  it.each<[unknown, api.RankingErrorCode]>([
    [{ message: 'nickname_taken', code: 'P0001' }, 'nickname_taken'],
    [{ message: 'score_implausible', code: 'P0001' }, 'score_implausible'],
    [{ message: 'permission denied for function create_profile', code: '42501' }, 'not_authenticated'],
    [{ message: 'JWT expired', code: 'PGRST301' }, 'not_authenticated'],
    [{ name: 'AuthRetryableFetchError', status: 0, message: 'Failed to fetch' }, 'network'],
    [{ name: 'AuthApiError', status: 429, message: 'Request rate limit reached' }, 'rate_limited'],
    [{ name: 'FunctionsFetchError', message: 'Failed to send a request to the Edge Function' }, 'network'],
    [{ message: 'something else', code: 'XX000' }, 'unknown'],
    [null, 'unknown'],
    ['boom', 'unknown']
  ])('maps %j to %s', (error, code) => {
    expect(toRankingError(error)).toMatchObject({ code });
  });

  it('keeps a RankingError and the original cause', () => {
    const error = new RankingError('tab_empty');
    expect(toRankingError(error)).toBe(error);
    const cause = { message: 'nickname_blocked' };
    expect(toRankingError(cause).cause).toBe(cause);
  });
});

describe('when the backend is not configured or unreachable', () => {
  const calls: [string, () => Promise<unknown>][] = [
    ['getSession', () => api.getSession()],
    ['ensureAnonymousSession', () => api.ensureAnonymousSession()],
    ['getMyProfile', () => api.getMyProfile()],
    ['createProfile', () => api.createProfile({ nickname: 'Ana', ageConfirmed: true, consent: true, consentVersion: 'v1' })],
    ['updateNickname', () => api.updateNickname('Ana')],
    ['touchLastSeen', () => api.touchLastSeen()],
    ['exportMyData', () => api.exportMyData()],
    ['deleteMyAccount', () => api.deleteMyAccount()],
    ['registerPart', () => api.registerPart(1, 0)],
    ['startRankedSession', () => api.startRankedSession(1, 0)],
    ['submitScore', () => api.submitScore({ sessionId: 's', score: 0, perfect: 0, good: 0, miss: 0, maxCombo: 0, accuracy: 100 })],
    ['getLeaderboard', () => api.getLeaderboard({ songId: 1, partId: 0 })],
    ['getMyPosition', () => api.getMyPosition({ songId: 1, partId: 0 })],
    ['getServerTime', () => api.getServerTime()]
  ];

  it.each(calls)('%s rejects with not_configured', async (_name, call) => {
    vi.mocked(getSupabaseClient).mockResolvedValue(null);
    await rejectsWith(call(), 'not_configured');
  });

  it('reports network when supabase-js cannot be loaded', async () => {
    vi.mocked(getSupabaseClient).mockRejectedValue(new TypeError('Failed to fetch dynamically imported module'));
    await rejectsWith(api.getLeaderboard({ songId: 1, partId: 0 }), 'network');
  });

  it('reports network when PostgREST is unreachable', async () => {
    useClient(fakeClient({ rpc: { data: null, error: { message: 'TypeError: Failed to fetch', code: '' }, status: 0 } }));
    await rejectsWith(api.getLeaderboard({ songId: 1, partId: 0 }), 'network');
  });
});

describe('session and profile', () => {
  it('creates an anonymous account only when there is no session', async () => {
    expect(await api.ensureAnonymousSession()).toEqual({ userId: 'user-1', isAnonymous: true });
    expect(client.auth.signInAnonymously).not.toHaveBeenCalled();

    useClient(fakeClient({ session: false }));
    expect(await api.getSession()).toBeNull();
    expect(await api.ensureAnonymousSession()).toEqual({ userId: 'user-1', isAnonymous: true });
    expect(client.auth.signInAnonymously).toHaveBeenCalledTimes(1);
  });

  it('maps a failed anonymous sign-in', async () => {
    useClient(fakeClient({ session: false }));
    client.auth.signInAnonymously.mockResolvedValue({ data: { user: null, session: null }, error: { name: 'AuthApiError', status: 429 } } as never);
    await rejectsWith(api.ensureAnonymousSession(), 'rate_limited');
  });

  it('returns no profile without a session, without calling the server', async () => {
    useClient(fakeClient({ session: false }));
    expect(await api.getMyProfile()).toBeNull();
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it('creates the profile with the consent fields', async () => {
    useClient(fakeClient({ rpc: { data: PROFILE, error: null, status: 200 } }));
    expect(await api.createProfile({ nickname: 'João Silva', ageConfirmed: true, consent: true, consentVersion: '2026-10' }))
      .toEqual(PROFILE);
    expect(client.rpc).toHaveBeenCalledWith('create_profile', {
      p_nickname: 'João Silva', p_age_confirmed: true, p_consent: true, p_consent_version: '2026-10'
    });
  });

  it('surfaces the server codes', async () => {
    useClient(fakeClient({ rpc: { data: null, error: { message: 'nickname_blocked', code: 'P0001' }, status: 400 } }));
    await rejectsWith(api.updateNickname('Admin'), 'nickname_blocked');
  });

  it('treats an unexpected response shape as unknown', async () => {
    useClient(fakeClient({ rpc: { data: { ...PROFILE, nickname: 5 }, error: null, status: 200 } }));
    await rejectsWith(api.getMyProfile(), 'unknown');
  });

  it('signs out locally after deleting the account, and not when deletion fails', async () => {
    await api.deleteMyAccount();
    expect(client.rpc).toHaveBeenCalledWith('delete_my_account', undefined);
    expect(client.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });

    useClient(fakeClient({ rpc: { data: null, error: { message: 'not_authenticated' }, status: 400 } }));
    await rejectsWith(api.deleteMyAccount(), 'not_authenticated');
    expect(client.auth.signOut).not.toHaveBeenCalled();
  });

  it('returns the data export as stored', async () => {
    const data = { exported_at: '2026-10-29T10:00:00+00:00', account: { id: 'user-1' }, play_sessions: [] };
    useClient(fakeClient({ rpc: { data, error: null, status: 200 } }));
    expect(await api.exportMyData()).toEqual(data);
  });
});

describe('registerPart', () => {
  const part = { songId: 7, partId: 0, title: 'Song', artist: 'Band', trackName: 'Lead', scorableNotes: 41, durationMs: 18667, maxScore: 20100 };
  const httpError = (status: number, body: string) =>
    ({ name: 'FunctionsHttpError', context: new Response(body, { status }) });

  it('invokes the Edge Function with the ids', async () => {
    client.functions.invoke.mockResolvedValue({ data: part, error: null });
    expect(await api.registerPart(7, 0)).toEqual(part);
    expect(client.functions.invoke).toHaveBeenCalledWith('register-part', { body: { songId: 7, partId: 0 }, timeout: 30_000 });
  });

  it('needs a session and integer ids', async () => {
    await rejectsWith(api.registerPart(7.5, 0), 'invalid_input');
    useClient(fakeClient({ session: false }));
    await rejectsWith(api.registerPart(7, 0), 'not_authenticated');
    expect(client.functions.invoke).not.toHaveBeenCalled();
  });

  it.each<[unknown, api.RankingErrorCode]>([
    [httpError(429, '{"error":"rate_limited"}'), 'rate_limited'],
    [httpError(404, '{"error":"part_not_found"}'), 'part_not_found'],
    [httpError(502, '{"error":"songsterr_unavailable"}'), 'songsterr_unavailable'],
    [httpError(401, '{"code":401,"message":"Invalid JWT"}'), 'not_authenticated'],
    [httpError(500, 'Internal Server Error'), 'unknown'],
    [{ name: 'FunctionsFetchError', context: new TypeError('Failed to fetch') }, 'network'],
    [{ name: 'FunctionsRelayError', context: {} }, 'network']
  ])('maps the failure %#', async (error, code) => {
    client.functions.invoke.mockResolvedValue({ data: null, error });
    await rejectsWith(api.registerPart(7, 0), code);
  });
});

describe('ranked play', () => {
  it('starts a session and submits integers only', async () => {
    useClient(fakeClient({ rpc: { data: 'session-uuid', error: null, status: 200 } }));
    expect(await api.startRankedSession(7, 0)).toBe('session-uuid');
    expect(client.rpc).toHaveBeenCalledWith('start_session', { p_song_id: 7, p_part_id: 0 });

    await rejectsWith(
      api.submitScore({ sessionId: 'session-uuid', score: 10, perfect: 1, good: 0, miss: 0, maxCombo: 1, accuracy: 97.5 }),
      'invalid_input');
  });

  it('returns the submission result', async () => {
    const result = { accepted: true, personalBest: true, weeklyBest: false, rankAll: 3, rankWeek: 1 };
    useClient(fakeClient({ rpc: { data: result, error: null, status: 200 } }));
    expect(await api.submitScore({ sessionId: 's', score: 4000, perfect: 15, good: 3, miss: 2, maxCombo: 12, accuracy: 90 }))
      .toEqual(result);
    expect(client.rpc).toHaveBeenCalledWith('submit_score', {
      p_session_id: 's', p_score: 4000, p_perfect: 15, p_good: 3, p_miss: 2, p_max_combo: 12, p_accuracy: 90
    });
  });

  it('maps leaderboard rows and checks the period', async () => {
    useClient(fakeClient({ rpc: { data: [ROW], error: null, status: 200 } }));
    expect(await api.getLeaderboard({ songId: 7, partId: 0, period: 'week', limit: 10 })).toEqual([
      { rank: 1, nickname: 'Ana', score: 4000, accuracy: 90, maxCombo: 12, achievedAt: ROW.achieved_at, isMe: true }
    ]);
    expect(client.rpc).toHaveBeenCalledWith('get_leaderboard', { p_song_id: 7, p_part_id: 0, p_period: 'week', p_limit: 10 });
    await rejectsWith(api.getLeaderboard({ songId: 7, partId: 0, period: 'month' as api.LeaderboardPeriod }), 'invalid_input');
  });

  it('returns the own position or null', async () => {
    useClient(fakeClient({ rpc: { data: [ROW], error: null, status: 200 } }));
    expect(await api.getMyPosition({ songId: 7, partId: 0 })).toMatchObject({ rank: 1, isMe: true });
    useClient(fakeClient({ rpc: { data: [], error: null, status: 200 } }));
    expect(await api.getMyPosition({ songId: 7, partId: 0 })).toBeNull();
    useClient(fakeClient({ session: false }));
    expect(await api.getMyPosition({ songId: 7, partId: 0 })).toBeNull();
  });
});

describe('getServerTime', () => {
  it('estimates the clock offset from the round trip', async () => {
    useClient(fakeClient({ rpc: { data: '2026-10-29T10:00:01.000000+00:00', error: null, status: 200 } }));
    const local = Date.parse('2026-10-29T10:00:00.000Z');
    vi.spyOn(Date, 'now').mockReturnValueOnce(local).mockReturnValueOnce(local + 200);
    expect(await api.getServerTime()).toEqual({ serverTimeMs: local + 1000, roundTripMs: 200, offsetMs: 900 });
  });
});

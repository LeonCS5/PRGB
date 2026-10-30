import { describe, expect, it, vi } from 'vitest';
import { getDemoSong, rawDemo } from '../../../src/services/demoSong';
import { countScorableNotes, maxPossibleScore } from '../_shared/scoreLimits.ts';
import {
  REGISTRATIONS_PER_HOUR,
  SONGSTERR_CDN_HOSTS,
  SONGSTERR_META_URL,
  createRegisterPartHandler,
  type NewSongPart,
  type RegisterPartDeps,
  type SongPart
} from './handler.ts';

const USER = '11111111-1111-1111-1111-111111111111';
const ORIGIN = 'https://prgb.vercel.app';

const META = {
  songId: 77,
  revisionId: 5,
  title: 'Song',
  artist: 'Band',
  image: 'img',
  tracks: [
    { instrumentId: 30, instrument: 'Guitar', name: 'Lead', partId: 0 },
    { instrumentId: 33, instrument: 'Bass', name: 'Bass', partId: 1 }
  ]
};
const META_URL = `${SONGSTERR_META_URL}/77`;
const tabUrl = (host: string) => `${host}/77/5/img/0.json`;

type Route = Response | Error | 'hang';

function setup(routes: Record<string, Route> = {}, options: { profile?: boolean; quotaLeft?: boolean; parts?: SongPart[] } = {}) {
  const parts = new Map((options.parts ?? []).map((part) => [`${part.songId}/${part.partId}`, part]));
  const inserted: NewSongPart[] = [];
  const updated: NewSongPart[] = [];
  const quotaLimits: number[] = [];
  const store = (part: NewSongPart): SongPart => {
    const { registeredBy: _registeredBy, ...stored } = part;
    return stored;
  };
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const route = routes[String(input)];
    if (route === 'hang') {
      return new Promise((_, reject) => init?.signal?.addEventListener('abort', () => reject(init.signal?.reason)));
    }
    if (route instanceof Error) throw route;
    return route?.clone() ?? new Response('not found', { status: 404 });
  });
  const log = vi.fn();
  const deps: RegisterPartDeps = {
    fetch: fetchMock,
    log,
    timeoutMs: 50,
    store: {
      getUserId: async (jwt) => (jwt === 'valid-token' ? USER : null),
      hasProfile: async () => options.profile ?? true,
      findPart: async (songId, partId) => parts.get(`${songId}/${partId}`) ?? null,
      consumeQuota: async (_userId, limit) => {
        quotaLimits.push(limit);
        return options.quotaLeft ?? true;
      },
      insertPart: async (part) => {
        inserted.push(part);
        return store(part);
      },
      updatePart: async (part) => {
        updated.push(part);
        return store(part);
      }
    }
  };
  return { handler: createRegisterPartHandler(deps), fetchMock, inserted, updated, quotaLimits, log };
}

const ok = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });

const post = (body: unknown, headers: Record<string, string> = { Authorization: 'Bearer valid-token' }) =>
  new Request('https://functions.test/register-part', {
    method: 'POST',
    headers: { Origin: ORIGIN, 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body)
  });

const call = async (handler: (request: Request) => Promise<Response>, request: Request) => {
  const response = await handler(request);
  return { status: response.status, body: await response.json(), headers: response.headers };
};

const demo = getDemoSong();
const DEMO_COUNT = {
  scorableNotes: countScorableNotes(demo.notes),
  durationMs: demo.totalDurationMs,
  maxScore: maxPossibleScore(countScorableNotes(demo.notes))
};

describe('register-part handler', () => {
  it('answers CORS preflight only for allowed origins', async () => {
    const { handler } = setup();
    const preflight = (origin: string) => handler(new Request('https://functions.test/register-part', {
      method: 'OPTIONS', headers: { Origin: origin }
    }));
    const allowed = await preflight('http://localhost:5173');
    expect(allowed.status).toBe(204);
    expect(allowed.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
    expect(allowed.headers.get('Access-Control-Allow-Headers')).toContain('authorization');
    expect((await preflight('https://evil.example')).headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('only accepts POST', async () => {
    const { handler } = setup();
    const response = await handler(new Request('https://functions.test/register-part', { method: 'GET' }));
    expect([response.status, await response.json()]).toEqual([405, { error: 'method_not_allowed' }]);
  });

  it('requires a valid session and a profile', async () => {
    expect(await call(setup().handler, post({ songId: 77, partId: 0 }, {}))).toMatchObject(
      { status: 401, body: { error: 'not_authenticated' } });
    expect(await call(setup().handler, post({ songId: 77, partId: 0 }, { Authorization: 'Bearer forged' })))
      .toMatchObject({ status: 401, body: { error: 'not_authenticated' } });
    expect(await call(setup({}, { profile: false }).handler, post({ songId: 77, partId: 0 }))).toMatchObject(
      { status: 403, body: { error: 'profile_required' } });
  });

  it.each([
    'not json', { songId: '77', partId: 0 }, { songId: 77, partId: 1.5 }, { songId: 77 }, { songId: 2 ** 31, partId: 0 },
    { songId: 77, partId: 0, revisionId: -1 }, { songId: 77, partId: 0, revisionId: 1.5 }, { songId: 77, partId: 0, revisionId: '5' }
  ])('rejects the body %j', async (body) => {
    expect(await call(setup().handler, post(body))).toMatchObject({ status: 400, body: { error: 'invalid_input' } });
  });

  it('returns an already registered part without calling Songsterr', async () => {
    const part: SongPart = {
      songId: -1, partId: 0, revisionId: 0, title: 'Demo', artist: 'PRGB', trackName: 'Exercício', ...DEMO_COUNT
    };
    const { handler, fetchMock } = setup({}, { parts: [part] });
    const { status, body, headers } = await call(handler, post({ songId: -1, partId: 0 }));
    expect([status, body]).toEqual([200, part]);
    expect(headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
    // Seeded parts are never recounted, whatever revision the app sends
    expect(await call(handler, post({ songId: -1, partId: 0, revisionId: 9 }))).toMatchObject({ status: 200, body: part });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('never fetches unseeded negative ids', async () => {
    const { handler, fetchMock } = setup();
    expect(await call(handler, post({ songId: -5, partId: 0 }))).toMatchObject({ status: 404, body: { error: 'song_not_found' } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('counts a new part with the same parser and scoring as the game', async () => {
    const { handler, fetchMock, inserted } = setup({ [META_URL]: ok(META), [tabUrl(SONGSTERR_CDN_HOSTS[0])]: ok(rawDemo) });
    const { status, body } = await call(handler, post({ songId: 77, partId: 0 }));
    const expected = { songId: 77, partId: 0, revisionId: 5, title: 'Song', artist: 'Band', trackName: 'Lead', ...DEMO_COUNT };
    expect([status, body]).toEqual([200, expected]);
    expect(inserted).toEqual([{ ...expected, registeredBy: USER }]);
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([META_URL, tabUrl(SONGSTERR_CDN_HOSTS[0])]);
    const init = fetchMock.mock.calls[0][1];
    expect(new Headers(init?.headers).get('User-Agent')).toContain('Mozilla');
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it('falls back to the second CDN', async () => {
    const { handler } = setup({
      [META_URL]: ok(META),
      [tabUrl(SONGSTERR_CDN_HOSTS[0])]: new Error('connection reset'),
      [tabUrl(SONGSTERR_CDN_HOSTS[1])]: ok(rawDemo)
    });
    expect(await call(handler, post({ songId: 77, partId: 0 }))).toMatchObject({ status: 200, body: DEMO_COUNT });
  });

  describe('tab revisions', () => {
    const stored: SongPart = {
      songId: 77, partId: 0, revisionId: 4, title: 'Song', artist: 'Band', trackName: 'Lead',
      scorableNotes: 10, durationMs: 30_000, maxScore: maxPossibleScore(10)
    };

    it('does not fetch when the app has the stored revision or sends none', async () => {
      const { handler, fetchMock } = setup({}, { parts: [stored] });
      expect(await call(handler, post({ songId: 77, partId: 0, revisionId: 4 }))).toMatchObject({ status: 200, body: stored });
      expect(await call(handler, post({ songId: 77, partId: 0 }))).toMatchObject({ status: 200, body: stored });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('recounts and updates when Songsterr has a newer revision', async () => {
      const { handler, updated, inserted } = setup(
        { [META_URL]: ok(META), [tabUrl(SONGSTERR_CDN_HOSTS[0])]: ok(rawDemo) }, { parts: [stored] });
      const { status, body } = await call(handler, post({ songId: 77, partId: 0, revisionId: 5 }));
      expect([status, body]).toEqual([200, { ...stored, revisionId: 5, ...DEMO_COUNT }]);
      expect(updated).toEqual([{ ...stored, revisionId: 5, ...DEMO_COUNT, registeredBy: USER }]);
      expect(inserted).toEqual([]);
    });

    it('keeps the stored count when Songsterr still serves that revision', async () => {
      const { handler, fetchMock, updated } = setup({ [META_URL]: ok({ ...META, revisionId: 4 }) }, { parts: [stored] });
      expect(await call(handler, post({ songId: 77, partId: 0, revisionId: 6 }))).toMatchObject({ status: 200, body: stored });
      expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([META_URL]);
      expect(updated).toEqual([]);
    });
  });

  it('limits Songsterr fetches per user and hour through the database quota', async () => {
    const { handler, fetchMock, quotaLimits } = setup({ [META_URL]: ok(META) }, { quotaLeft: false });
    expect(await call(handler, post({ songId: 77, partId: 0 }))).toMatchObject({ status: 429, body: { error: 'rate_limited' } });
    expect(quotaLimits).toEqual([REGISTRATIONS_PER_HOUR]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('never follows redirects', async () => {
    const { handler, fetchMock } = setup({ [META_URL]: ok(META), [tabUrl(SONGSTERR_CDN_HOSTS[0])]: ok(rawDemo) });
    await call(handler, post({ songId: 77, partId: 0 }));
    expect(fetchMock.mock.calls.map(([, init]) => init?.redirect)).toEqual(['error', 'error']);
  });

  it.each<[string, Record<string, Route>, number, string]>([
    ['an unknown song', {}, 404, 'song_not_found'],
    ['meta without tracks', { [META_URL]: ok({ songId: 77 }) }, 404, 'song_not_found'],
    ['a part the song does not have', { [META_URL]: ok({ ...META, tracks: [META.tracks[1]] }) }, 404, 'part_not_found'],
    ['meta of another song', { [META_URL]: ok({ ...META, songId: 78 }) }, 502, 'songsterr_unavailable'],
    ['meta without a revision', { [META_URL]: ok({ ...META, revisionId: 'x' }) }, 502, 'songsterr_unavailable'],
    ['Songsterr failing', { [META_URL]: new Response('', { status: 503 }) }, 502, 'songsterr_unavailable'],
    ['no network', { [META_URL]: new TypeError('fetch failed') }, 502, 'songsterr_unavailable'],
    ['a timeout', { [META_URL]: 'hang' }, 502, 'songsterr_unavailable'],
    ['both CDNs failing', { [META_URL]: ok(META) }, 502, 'songsterr_unavailable'],
    ['a tab without measures', { [META_URL]: ok(META), [tabUrl(SONGSTERR_CDN_HOSTS[0])]: ok({}) }, 422, 'tab_invalid'],
    ['a tab with no notes', { [META_URL]: ok(META), [tabUrl(SONGSTERR_CDN_HOSTS[0])]: ok({ measures: [] }) }, 422, 'tab_empty']
  ])('reports %s', async (_label, routes, status, error) => {
    const { handler, inserted } = setup(routes);
    expect(await call(handler, post({ songId: 77, partId: 0 }))).toMatchObject({ status, body: { error } });
    expect(inserted).toEqual([]);
  });

  it('hides unexpected failures and logs no personal data', async () => {
    const log = vi.fn();
    const failing = createRegisterPartHandler({
      fetch: vi.fn(),
      log,
      store: {
        getUserId: async () => USER,
        hasProfile: async () => {
          throw new Error('profiles: 08006');
        },
        findPart: async () => null,
        consumeQuota: async () => true,
        insertPart: async () => {
          throw new Error('unreachable');
        },
        updatePart: async () => {
          throw new Error('unreachable');
        }
      }
    });
    const { status, body, headers } = await call(failing, post({ songId: 77, partId: 0 }));
    expect([status, body]).toEqual([500, { error: 'internal_error' }]);
    expect(headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
    expect(log).toHaveBeenCalledWith('register-part: Error: profiles: 08006');
    expect(JSON.stringify(log.mock.calls)).not.toContain(USER);
  });
});

import { describe, expect, it, vi } from 'vitest';
import { getDemoSong } from '../../../src/services/demoSong';
import { countScorableNotes, maxPossibleScore } from '../_shared/scoreLimits.ts';
import { createRegisterPartHandler, type RegisterPartDeps, type SongPart } from './handler.ts';

const USER = '11111111-1111-1111-1111-111111111111';
const ORIGIN = 'https://prgb.vercel.app';

const demo = getDemoSong();
const DEMO_PART: SongPart = {
  songId: -1, partId: 0, revisionId: 0, title: 'Demo', artist: 'PRGB', trackName: 'Exercício',
  scorableNotes: countScorableNotes(demo.notes),
  durationMs: demo.totalDurationMs,
  maxScore: maxPossibleScore(countScorableNotes(demo.notes))
};
// A part registered by an earlier version of the function, from the external catalog
const OLD_CATALOG_PART: SongPart = { ...DEMO_PART, songId: 77, partId: 1, revisionId: 5, title: 'Song', artist: 'Band' };

function setup(options: { profile?: boolean; parts?: SongPart[] } = {}) {
  const parts = new Map((options.parts ?? []).map((part) => [`${part.songId}/${part.partId}`, part]));
  const log = vi.fn();
  const findPart = vi.fn(async (songId: number, partId: number) => parts.get(`${songId}/${partId}`) ?? null);
  const deps: RegisterPartDeps = {
    log,
    store: {
      getUserId: async (jwt) => (jwt === 'valid-token' ? USER : null),
      hasProfile: async () => options.profile ?? true,
      findPart
    }
  };
  return { handler: createRegisterPartHandler(deps), log, findPart };
}

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
    expect(await call(setup().handler, post({ songId: -1, partId: 0 }, {}))).toMatchObject(
      { status: 401, body: { error: 'not_authenticated' } });
    expect(await call(setup().handler, post({ songId: -1, partId: 0 }, { Authorization: 'Bearer forged' })))
      .toMatchObject({ status: 401, body: { error: 'not_authenticated' } });
    expect(await call(setup({ profile: false }).handler, post({ songId: -1, partId: 0 }))).toMatchObject(
      { status: 403, body: { error: 'profile_required' } });
  });

  it.each([
    'not json', { songId: '77', partId: 0 }, { songId: 77, partId: 1.5 }, { songId: 77 }, { songId: 2 ** 31, partId: 0 },
    { songId: 77, partId: 0, revisionId: -1 }, { songId: 77, partId: 0, revisionId: 1.5 }, { songId: 77, partId: 0, revisionId: '5' }
  ])('rejects the body %j', async (body) => {
    expect(await call(setup().handler, post(body))).toMatchObject({ status: 400, body: { error: 'invalid_input' } });
  });

  it('returns a stored part', async () => {
    const { handler } = setup({ parts: [DEMO_PART] });
    expect(await call(handler, post({ songId: -1, partId: 0 }))).toMatchObject({ status: 200, body: DEMO_PART });
  });

  it('returns a part an earlier version registered, whatever revision the app sends', async () => {
    const { handler } = setup({ parts: [OLD_CATALOG_PART] });
    expect(await call(handler, post({ songId: 77, partId: 1, revisionId: 9 }))).toMatchObject(
      { status: 200, body: OLD_CATALOG_PART });
  });

  it('answers song_not_found for anything not stored, without consulting any source', async () => {
    const network = vi.fn();
    vi.stubGlobal('fetch', network);
    try {
      const { handler, findPart } = setup({ parts: [DEMO_PART] });
      for (const body of [{ songId: 1234, partId: 0 }, { songId: -1, partId: 3 }, { songId: -1000, partId: 0 }]) {
        expect(await call(handler, post(body))).toMatchObject({ status: 404, body: { error: 'song_not_found' } });
      }
      expect(findPart).toHaveBeenCalledTimes(3);
      expect(network).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('hides unexpected failures and logs no personal data', async () => {
    const log = vi.fn();
    const failing = createRegisterPartHandler({
      log,
      store: {
        getUserId: async () => USER,
        hasProfile: async () => {
          throw new Error('profiles: 08006');
        },
        findPart: async () => null
      }
    });
    const { status, body, headers } = await call(failing, post({ songId: -1, partId: 0 }));
    expect([status, body]).toEqual([500, { error: 'internal_error' }]);
    expect(headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
    expect(log).toHaveBeenCalledWith('register-part: Error: profiles: 08006');
    expect(JSON.stringify(log.mock.calls)).not.toContain(USER);
  });
});

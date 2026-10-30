import type { PGlite, Transaction } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getDemoSong } from '../../src/services/demoSong';
import {
  BLOCKED_TERMS,
  MODERATION_ALLOWLIST,
  MODERATION_CONFUSABLES,
  NICKNAME_MAX,
  NICKNAME_MIN,
  NICKNAME_PATTERN,
  containsBlockedTerm,
  foldForModeration,
  nicknameKey,
  normalizeNickname
} from '../../src/services/nickname';
import { countScorableNotes, maxPossibleScore } from '../functions/_shared/scoreLimits.ts';
import { callAs, createDatabase, createUser, rpc } from './harness.ts';

let db: PGlite;

beforeAll(async () => {
  db = await createDatabase();
}, 30_000);

afterAll(async () => {
  await db?.close();
});

const PUBLIC_RPCS = ['get_leaderboard', 'server_time'];
const PLAYER_RPCS = [
  'create_profile', 'delete_my_account', 'export_my_data', 'get_my_position', 'get_my_profile',
  'start_session', 'submit_score', 'touch_last_seen', 'update_nickname'
];

let partCounter = 1000;
let nicknameCounter = 0;

const expectError = (promise: Promise<unknown>, message: string) =>
  expect(promise).rejects.toMatchObject({ message });

const createProfile = (userId: string, nickname: string, age = true, consent = true, version: string | null = 'v1') =>
  rpc<Record<string, unknown>>(db, userId, 'public.create_profile($1, $2, $3, $4)', [nickname, age, consent, version]);

async function newPlayer(nickname = `Jogador ${++nicknameCounter}`): Promise<string> {
  const id = await createUser(db);
  await createProfile(id, nickname);
  return id;
}

// What the register-part Edge Function does, with the service role
async function registerPart(fields: { scorable?: number; durationMs?: number; by?: string | null } = {}) {
  const songId = ++partCounter;
  const scorable = fields.scorable ?? 20;
  await callAs(db, 'service_role', null,
    `insert into public.song_parts
       (song_id, part_id, revision_id, title, artist, track_name, scorable_notes, duration_ms, max_score, registered_by)
     values ($1, 0, 1, 'Música', 'Banda', 'Guitarra', $2, $3, $4, $5)`,
    [songId, scorable, fields.durationMs ?? 60_000, maxPossibleScore(scorable), fields.by ?? null]);
  return { songId, partId: 0 };
}

const startSession = (userId: string, songId: number, partId = 0) =>
  rpc<string>(db, userId, 'public.start_session($1, $2)', [songId, partId]);

const backdate = (sessionId: string, interval: string) =>
  db.query('update public.play_sessions set started_at = now() - $2::interval where id = $1', [sessionId, interval]);

interface Result { score: number; perfect: number; good: number; miss: number; maxCombo: number; accuracy: number }
// 15 Perfect, 3 Good, 2 Miss out of 20 notes: accuracy 90%
const PLAUSIBLE: Result = { score: 4000, perfect: 15, good: 3, miss: 2, maxCombo: 12, accuracy: 90 };

const submit = (userId: string, sessionId: string, r: Partial<Result> = {}) => {
  const v = { ...PLAUSIBLE, ...r };
  return rpc<Record<string, unknown>>(db, userId, 'public.submit_score($1, $2, $3, $4, $5, $6, $7)',
    [sessionId, v.score, v.perfect, v.good, v.miss, v.maxCombo, v.accuracy]);
};

/** Starts a session, backdates it past the song length and submits. */
async function play(userId: string, part: { songId: number; partId: number }, r: Partial<Result> = {}) {
  const sessionId = await startSession(userId, part.songId, part.partId);
  await backdate(sessionId, '61 seconds');
  return submit(userId, sessionId, r);
}

describe('access control', () => {
  it('enables RLS on every table and revokes all table privileges from the API roles', async () => {
    const { rows } = await db.query<{ table: string; rls: boolean; anon: boolean; authenticated: boolean }>(`
      select c.relname as table, c.relrowsecurity as rls,
        has_table_privilege('anon', c.oid, 'select, insert, update, delete') as anon,
        has_table_privilege('authenticated', c.oid, 'select, insert, update, delete') as authenticated
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'`);
    expect(rows.map((r) => r.table).sort()).toEqual([
      'blocked_terms', 'moderation_allowlist', 'moderation_confusables', 'play_sessions', 'profiles',
      'register_part_quota', 'scores_best', 'scores_weekly', 'song_parts'
    ]);
    for (const row of rows) expect(row, row.table).toMatchObject({ rls: true, anon: false, authenticated: false });
  });

  it('rejects direct reads by players', async () => {
    const userId = await newPlayer();
    for (const table of ['profiles', 'scores_best', 'song_parts', 'blocked_terms']) {
      await expect(callAs(db, 'authenticated', userId, `select * from public.${table}`))
        .rejects.toMatchObject({ code: '42501' });
    }
  });

  it('still hides every row through RLS if a privilege were granted by mistake', async () => {
    const userId = await newPlayer();
    await play(userId, await registerPart());
    const count = await db.transaction(async (tx) => {
      await tx.exec('grant select on public.scores_best, public.profiles to authenticated');
      await tx.query("select set_config('role', 'authenticated', true), set_config('request.jwt.claim.sub', $1, true)", [userId]);
      const { rows } = await tx.query<{ n: number }>(
        'select (select count(*) from public.scores_best) + (select count(*) from public.profiles) as n');
      await tx.rollback();
      return rows[0].n;
    });
    expect(count).toBe(0);
  });

  it('lets anon run only the public reads and players only their RPCs', async () => {
    const { rows } = await db.query<{ name: string; anon: boolean; authenticated: boolean; config: string[] | null }>(`
      select p.proname as name, has_function_privilege('anon', p.oid, 'execute') as anon,
        has_function_privilege('authenticated', p.oid, 'execute') as authenticated, p.proconfig as config
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'`);
    expect(rows.filter((r) => r.anon).map((r) => r.name).sort()).toEqual(PUBLIC_RPCS);
    expect(rows.filter((r) => r.authenticated).map((r) => r.name).sort())
      .toEqual([...PUBLIC_RPCS, ...PLAYER_RPCS].sort());
    for (const row of rows) expect(row.config, row.name).toContain('search_path=""');
    await expect(callAs(db, 'anon', null, "select public.create_profile('Anônimo', true, true, 'v1')"))
      .rejects.toMatchObject({ code: '42501' });
    await expect(callAs(db, 'authenticated', await createUser(db), "select public.is_blocked_nickname('x')"))
      .rejects.toMatchObject({ code: '42501' });
  });

  it('lets the service role read profiles and register song parts (Edge Function)', async () => {
    const userId = await newPlayer();
    const rows = await callAs(db, 'service_role', null, 'select id from public.profiles where id = $1', [userId]);
    expect(rows).toHaveLength(1);
    await expect(registerPart({ by: userId })).resolves.toBeDefined();
  });

  it('requires a JWT subject for player RPCs', async () => {
    await expectError(callAs(db, 'authenticated', null, 'select public.get_my_profile()'), 'not_authenticated');
  });
});

describe('create_profile', () => {
  it('requires explicit age confirmation, consent and the accepted text version', async () => {
    const userId = await createUser(db);
    await expectError(createProfile(userId, 'Sem Idade', false, true), 'consent_required');
    await expectError(createProfile(userId, 'Sem Aceite', true, false), 'consent_required');
    await expectError(createProfile(userId, 'Sem Versão', true, true, null), 'consent_required');
    await expectError(createProfile(userId, 'Versão Ruim', true, true, 'v 1'), 'consent_required');
    expect(await rpc(db, userId, 'public.get_my_profile()')).toBeNull();
  });

  it('stores consent and returns the profile', async () => {
    const userId = await createUser(db);
    const profile = await createProfile(userId, '  Zé   Ramalho ', true, true, '2026-10');
    expect(profile).toMatchObject({ nickname: 'Zé Ramalho', consentVersion: '2026-10' });
    expect(Object.keys(profile).sort()).toEqual(
      ['ageConfirmedAt', 'consentAt', 'consentVersion', 'createdAt', 'lastSeenAt', 'nickname']);
    expect(await rpc(db, userId, 'public.get_my_profile()')).toEqual(profile);
    await expectError(createProfile(userId, 'Outro Nome'), 'profile_exists');
  });

  it('normalizes a decomposed accent (NFC)', async () => {
    const profile = await createProfile(await createUser(db), 'Jose\u0301 Lima');
    expect(profile.nickname).toBe('José Lima');
  });

  it.each([
    'ab', 'a'.repeat(21), 'Dj <b>', 'x×y', 'emoji 🎸', 'Łukasz 日本語',
    '\u0410dmin', // Cyrillic "\u0410"
    '\u3164\u3164\u3164', // Hangul filler, renders as blank
    '\u0192uck', // Latin Extended-B "f" with hook
    '\u01c3\u01c3\u01c3' // click letters that look like "!!!"
  ])('rejects the invalid nickname %j', async (nickname) => {
    await expectError(createProfile(await createUser(db), nickname), 'nickname_invalid');
  });

  it('accepts accented Latin letters', async () => {
    await expect(createProfile(await createUser(db), 'ÀÉÎÕÜçñøÿ ß.æ_-1')).resolves.toBeDefined();
    await expect(createProfile(await createUser(db), 'Łukasz Đorđević')).resolves.toBeDefined();
    await expect(createProfile(await createUser(db), 'Ølsen')).resolves.toBeDefined();
  });

  it.each([
    'Admin1', 'Merdaaaa', 'Fuuuck you', 'C.a.r.a.l.h.o', 'Pútá', 'xX_ADMIN_Xx', 'PRGB oficial', 'FilhoDaPuta', 'AdminPRGB',
    // Look-alike Latin letters
    'Adm\u0131n', 'H\u0131tler', 'Naz\u0131', 'Pørno', 'Merđa'
  ])('blocks %j', async (nickname) => {
    await expectError(createProfile(await createUser(db), nickname), 'nickname_blocked');
  });

  it.each(['Computador', 'Scunthorpe', 'Cuca Fresca', 'Gustaf', 'Ponta Porã'])('allows %j', async (nickname) => {
    await expect(createProfile(await createUser(db), nickname)).resolves.toBeDefined();
  });

  it('refuses a nickname already taken, ignoring case, accents and look-alike letters', async () => {
    await newPlayer('Guitarrista');
    await expectError(createProfile(await createUser(db), 'GUITARRISTA'), 'nickname_taken');
    await newPlayer('Joao Pedro');
    await expectError(createProfile(await createUser(db), 'João Pedro'), 'nickname_taken');
    await expectError(createProfile(await createUser(db), 'JOÃO PEDRO'), 'nickname_taken');
    await newPlayer('Olsen Silva');
    await expectError(createProfile(await createUser(db), 'ØLSEN SILVA'), 'nickname_taken');
    const { rows } = await db.query<{ nickname: string; nickname_key: string }>(
      "select nickname, nickname_key from public.profiles where nickname in ('Joao Pedro', 'Olsen Silva') order by 1");
    expect(rows).toEqual([
      { nickname: 'Joao Pedro', nickname_key: 'joao pedro' }, { nickname: 'Olsen Silva', nickname_key: 'olsen silva' }
    ]);
  });
});

// The database must judge every nickname exactly like src/services/nickname.ts: same lists, and the same
// fold, block, key and validation results on the app's own test inputs plus some extra ones.
describe('nickname rules match src/services/nickname.ts', () => {
  const CLICKS = String.fromCodePoint(0x1c0, 0x1c1, 0x1c2, 0x1c3);
  const CORPUS = [
    // nickname.test.ts
    'João', '  João \t  Silva\n', 'Joao', 'JOÃO', 'joao', '  João   Silva ', 'Ølsen', 'Łukasz', 'Straße', 'Adm\u0131n', 'Admin',
    'Leo', 'Leo1', 'Ana_B', 'Ana B', 'Lea', 'João Silva', 'ana_b.r-1', 'Zoë', 'Søren', 'Ğül', 'ÀÖØöøÿĀſ',
    '\u0192uck', 'Ǆemal', CLICKS, 'Ｌｅｏ', 'a×b', 'a÷b', 'ẞig', 'Leo!', 'a@b', 'Leo🎸', 'Le\u200bo', 'a  b', ' ab',
    'ab ', 'a\tb', '', '\u0420RG\u0412', '\u0430dmin', 'Adμin', '日本語', '𝐀𝐝𝐦𝐢𝐧', '\u3164\u3164\u3164',
    '\uffa0\uffa0\uffa0', '\u115f\u115f\u115f', 'a\u1160b', '\u1160\u1160\u1160', 'ab', '   ', 'abc', 'a'.repeat(20),
    'a'.repeat(21), '𝐀'.repeat(20), '𝐀'.repeat(21), 'a<b>c', 'a!', '!'.repeat(21),
    'Puta', 'Admin1', 'PRGB Oficial', 'Moderador', 'Suporte', 'H\u0131tler', 'Naz\u0131', 'Pørno', 'Merđa', 'B\u0131tch',
    'Đickhead', 'Caralħo', 'ßhit', 'FuckYou', 'FilhoDaPuta', 'VaiTomarNoCu', 'PutaMerda', 'ShitHead', 'Putinha',
    'Bucetinha', 'Viadinho', 'Merdinha', 'Cuzinho', 'Nazismo', 'Pornstar', 'AdminPRGB', 'PRGBAdmin', 'OficialPRGB',
    'PRGBteam', 'Cássio', 'Assis', 'Scunthorpe', 'Analice', 'Ana L', 'Computador', 'Deputado', 'Disputa', 'Reputação',
    'Enviado', 'Analista', 'Fagundes', 'Fagote', 'Bichano', 'Desviado', 'Badminton', 'Nigéria', 'Bostaph', 'Shiitake',
    'Nazareth', 'Spice Girls', 'Ponta Porã', 'Pica-Pau', 'Kkkkk', 'Joao 1990', 'Guitar 5150',
    'ÁÉÍÓÚ Çãõ', 'İstanbul', '@dm1n$', 'P0RR4 M3RD4', '5h17', '𝐟𝐮𝐜𝐤', 'ｆｕｃｋ', 'Joao_da-Silva.2', 'f.u.c.k',
    'A B C Banda', 'FUUUUCK', 'kkkkk', '\u0131ĸłħŧđŋ', 'ð', 'ŒUVRE Æther Ølsen Þor', 'ŁĐØ', 'ÉdsonÁvila', '4dm1n', 'PuTa',
    'puta', 'Pút4', 'p.u.t.a', 'Filho da Puta', 'C4r4lh0', 'Caralhada', 'b.u.c.e.t.a', 'ｐｕｔａ', 'Foda-se', 'Fodase',
    'Motherfucker', 'Pornô', 'Admin123', 'admin_01', 'Merda123', 'Nazi88', 'fu2ck', 'Administrador', 'Moderadora',
    'PRGBOficial', 'Equipe PRGB', '𝐏𝐑𝐆𝐁', 'Suporte Técnico', 'Staff', 'Faggot', 'N1gg3r', 'Nigga', 'Viado', 'v14d0',
    'Boiola', 'Traveco', 'Retardada', 'Mongoloide', 'fuckyou', 'filhodaputa', 'putamerda', 'CaRaLhO', 'mErDa', 'FuCk',
    'aDmIn', 'Pu7A', 'cArAlH0', 'Curitiba', 'Escudo', 'Gustaf', 'Amputado', 'Imputável', 'Diputado', 'Nazir', 'Nazim',
    'Disputa Puta', 'BadmintonAdmin', 'Nazareth Nazi', 'badmintonadmin', 'Pinto', 'Macaco', 'Capricorno', 'Dick Dale',
    'Pussy Riot', 'Hancock', 'Cocktail', 'Therapist', 'Moderado', 'Kkkkkk', 'Cássio 10', 'vaitomarnocu', 'xcux',
    'x cu x', 'xfuckx',
    // Extra: Latin Extended-A camelCase and look-alikes, decompositions into non-letters
    'ZłotyŁoś', 'ÆsirStraße', 'Fuck Łord', 'ĿeoŉPuta', 'Ĳsselmeer', 'ſhit', 'Ŧwat Ħitler',
    ...BLOCKED_TERMS.map(({ term }) => term), ...MODERATION_ALLOWLIST
  ];

  it('seeds exactly the lists of nickname.ts', async () => {
    const { rows: terms } = await db.query<{ term: string; mode: string }>('select term, mode from public.blocked_terms');
    expect(Object.fromEntries(terms.map(({ term, mode }) => [term, mode])))
      .toEqual(Object.fromEntries(BLOCKED_TERMS.map(({ term, mode }) => [term, mode])));
    expect(terms).toHaveLength(BLOCKED_TERMS.length);
    const { rows: allowlist } = await db.query<{ fragment: string }>(
      'select fragment from public.moderation_allowlist order by position');
    expect(allowlist.map(({ fragment }) => fragment)).toEqual([...MODERATION_ALLOWLIST]);
    const { rows: confusables } = await db.query<{ src: string; dst: string }>(
      'select src, dst from public.moderation_confusables');
    expect(Object.fromEntries(confusables.map(({ src, dst }) => [src, dst]))).toEqual({ ...MODERATION_CONFUSABLES });
  });

  it('folds, blocks, keys and validates every input like the app', async () => {
    const { rows } = await db.query<{ input: string; fold: string; blocked: boolean; clean: string; key: string; valid: boolean }>(
      `select c as input, public.fold_for_moderation(c) as fold, public.is_blocked_nickname(c) as blocked,
         public.clean_nickname(c) as clean, public.nickname_key(public.clean_nickname(c)) as key,
         public.is_valid_nickname(public.clean_nickname(c)) as valid
       from unnest($1::text[]) with ordinality as t(c, n) order by n`, [CORPUS]);
    const app = (input: string) => {
      const clean = normalizeNickname(input);
      const length = Array.from(clean).length;
      return {
        input,
        fold: foldForModeration(input),
        blocked: containsBlockedTerm(input),
        clean,
        key: nicknameKey(input),
        valid: length >= NICKNAME_MIN && length <= NICKNAME_MAX && NICKNAME_PATTERN.test(clean)
      };
    };
    const differences = rows.filter((row) => JSON.stringify(row) !== JSON.stringify(app(row.input)));
    expect(differences.map((row) => ({ database: row, app: app(row.input) }))).toEqual([]);
    expect(rows).toHaveLength(CORPUS.length);
  });

  it('is driven by the lists: modes, allowlist and confusables are rows', async () => {
    const check = async (tx: Transaction) => {
      const { rows } = await tx.query<{ c: string; blocked: boolean }>(
        `select c, public.is_blocked_nickname(c) as blocked
         from unnest(array['Curitiba', 'Computador', 'Pørno']) with ordinality as t(c, n) order by n`);
      return rows.map((row) => row.blocked);
    };
    await db.transaction(async (tx) => {
      expect(await check(tx)).toEqual([false, false, true]);
      await tx.query("update public.blocked_terms set mode = 'part' where term = 'cu'");
      await tx.query("delete from public.moderation_allowlist where fragment = 'computa'");
      await tx.query("delete from public.moderation_confusables where src = 'ø'");
      expect(await check(tx)).toEqual([true, true, false]);
      await tx.rollback();
    });
  });

  it('only accepts folded terms and fragments', async () => {
    await expect(db.query("insert into public.blocked_terms values ('Staff', 'word')")).rejects.toMatchObject({ code: '23514' });
    await expect(db.query("insert into public.blocked_terms values ('xyz', 'both')")).rejects.toMatchObject({ code: '23514' });
    await expect(db.query("insert into public.moderation_allowlist values ('Computa', 99)"))
      .rejects.toMatchObject({ code: '23514' });
  });
});

describe('update_nickname and touch_last_seen', () => {
  it('corrects the nickname with the same rules', async () => {
    const userId = await newPlayer('Nome Antigo');
    await newPlayer('Nome Ocupado');
    expect(await rpc(db, userId, 'public.update_nickname($1)', ['Nome Novo'])).toMatchObject({ nickname: 'Nome Novo' });
    expect(await rpc(db, userId, 'public.update_nickname($1)', ['NOME NOVO'])).toMatchObject({ nickname: 'NOME NOVO' });
    await expectError(rpc(db, userId, 'public.update_nickname($1)', ['nome ocupado']), 'nickname_taken');
    await expectError(rpc(db, userId, 'public.update_nickname($1)', ['merda']), 'nickname_blocked');
    await expectError(rpc(db, userId, 'public.update_nickname($1)', ['x']), 'nickname_invalid');
    await expectError(rpc(db, await createUser(db), 'public.update_nickname($1)', ['Sem Perfil']), 'profile_required');
  });

  it('marks the player as active', async () => {
    const userId = await newPlayer();
    await db.query("update public.profiles set last_seen_at = now() - interval '300 days' where id = $1", [userId]);
    await rpc(db, userId, 'public.touch_last_seen()');
    const { rows } = await db.query<{ recent: boolean }>(
      "select last_seen_at > now() - interval '1 minute' as recent from public.profiles where id = $1", [userId]);
    expect(rows[0].recent).toBe(true);
  });
});

describe('start_session', () => {
  it('requires a profile and a registered part', async () => {
    const part = await registerPart();
    await expectError(startSession(await createUser(db), part.songId), 'profile_required');
    await expectError(startSession(await newPlayer(), 999_999), 'part_unregistered');
    expect(await startSession(await newPlayer(), part.songId)).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('allows 60 sessions per hour', async () => {
    const userId = await newPlayer();
    const part = await registerPart();
    await db.query(
      `insert into public.play_sessions (user_id, song_id, part_id, revision_id, scorable_notes, duration_ms, max_score, started_at)
       select $1, $2, 0, 1, 20, 60000, 7500, now() - interval '30 minutes' from generate_series(1, 60)`, [userId, part.songId]);
    await expectError(startSession(userId, part.songId), 'rate_limited');
    await db.query("update public.play_sessions set started_at = now() - interval '61 minutes' where user_id = $1", [userId]);
    await expect(startSession(userId, part.songId)).resolves.toBeTruthy();
  });
});

describe('register-part quota', () => {
  it('counts fetches atomically per player and hour, for the service role only', async () => {
    const userId = await newPlayer();
    const other = await newPlayer();
    const consume = async (id: string) => {
      const [row] = await callAs<{ ok: boolean }>(
        db, 'service_role', null, 'select public.consume_register_part_quota($1, 3) as ok', [id]);
      return row.ok;
    };
    expect([await consume(userId), await consume(userId), await consume(userId), await consume(userId)])
      .toEqual([true, true, true, false]);
    expect(await consume(other)).toBe(true);
    await expect(callAs(db, 'authenticated', userId, 'select public.consume_register_part_quota($1, 30)', [userId]))
      .rejects.toMatchObject({ code: '42501' });
    const data = await rpc<{ register_part_quota: { used: number }[] }>(db, userId, 'public.export_my_data()');
    expect(data.register_part_quota).toEqual([expect.objectContaining({ used: 4 })]);
  });
});

describe('tab revisions', () => {
  it('copies the revision and its numbers into the session, refusing another revision from the app', async () => {
    const userId = await newPlayer();
    const part = await registerPart(); // revision 1, 20 notes, 60 s
    await expectError(rpc(db, userId, 'public.start_session($1, 0, $2)', [part.songId, 2]), 'revision_mismatch');
    const sessionId = await rpc<string>(db, userId, 'public.start_session($1, 0, $2)', [part.songId, 1]);
    const { rows } = await db.query(
      'select revision_id, scorable_notes, duration_ms, max_score from public.play_sessions where id = $1', [sessionId]);
    expect(rows[0]).toEqual({ revision_id: 1, scorable_notes: 20, duration_ms: 60_000, max_score: maxPossibleScore(20) });
  });

  it('checks an open session against the revision it started with', async () => {
    const userId = await newPlayer();
    const part = await registerPart();
    const before = await startSession(userId, part.songId);
    // register-part recounts a new revision: half the notes
    await callAs(db, 'service_role', null,
      `update public.song_parts set revision_id = 2, scorable_notes = 10, duration_ms = 30000, max_score = $2
       where song_id = $1`, [part.songId, maxPossibleScore(10)]);
    const after = await startSession(userId, part.songId);
    await backdate(before, '61 seconds');
    await backdate(after, '61 seconds');
    // 20 judged notes only fit the revision the first session started with
    await expect(submit(userId, before)).resolves.toMatchObject({ accepted: true });
    await expectError(submit(userId, after), 'score_implausible');
  });
});

describe('submit_score', () => {
  it('accepts a plausible run once and reports records and ranks', async () => {
    const userId = await newPlayer();
    const part = await registerPart();
    const sessionId = await startSession(userId, part.songId);
    await backdate(sessionId, '55 seconds'); // 90% of the 60 s song is 54 s
    expect(await submit(userId, sessionId)).toEqual(
      { accepted: true, personalBest: true, weeklyBest: true, rankAll: 1, rankWeek: 1 });
    await expectError(submit(userId, sessionId), 'already_submitted');
  });

  it('refuses sessions shorter than 90% of the song, expired or not owned', async () => {
    const userId = await newPlayer();
    const part = await registerPart();
    const sessionId = await startSession(userId, part.songId);
    await expectError(submit(userId, sessionId), 'session_too_short');
    await backdate(sessionId, '53 seconds');
    await expectError(submit(userId, sessionId), 'session_too_short');
    await expectError(submit(await newPlayer(), sessionId), 'session_invalid');
    await expectError(submit(userId, '00000000-0000-0000-0000-000000000000'), 'session_invalid');
    await backdate(sessionId, '2 hours 1 minute');
    await expectError(submit(userId, sessionId), 'session_expired');
  });

  it.each<[string, Partial<Result>]>([
    ['more judged notes than the song has', { perfect: 18, good: 2, miss: 1, accuracy: 95 }],
    ['a combo longer than the hits', { maxCombo: 19 }],
    ['a score above the song maximum', { perfect: 20, good: 0, miss: 0, maxCombo: 20, accuracy: 100, score: maxPossibleScore(20) + 1 }],
    ['a score above 4x the hit points', { perfect: 1, good: 0, miss: 0, maxCombo: 1, accuracy: 100, score: 601 }],
    ['an accuracy off by more than 1', { accuracy: 92 }],
    ['an accuracy above 100', { perfect: 1, good: 0, miss: 0, maxCombo: 1, score: 150, accuracy: 101 }],
    ['negative counts', { miss: -1 }]
  ])('refuses %s', async (_label, result) => {
    const userId = await newPlayer();
    const sessionId = await startSession(userId, (await registerPart()).songId);
    await backdate(sessionId, '61 seconds');
    await expectError(submit(userId, sessionId, result), 'score_implausible');
    // The session stays open for a valid result
    await expect(submit(userId, sessionId, { accuracy: 91 })).resolves.toMatchObject({ accepted: true });
  });

  it.each<[string, Partial<Result>]>([
    ['nothing judged', { score: 0, perfect: 0, good: 0, miss: 0, maxCombo: 0, accuracy: 100 }],
    ['only misses', { score: 0, perfect: 0, good: 0, miss: 20, maxCombo: 0, accuracy: 0 }]
  ])('keeps an empty run off the leaderboard: %s', async (_label, result) => {
    const userId = await newPlayer();
    const part = await registerPart();
    const sessionId = await startSession(userId, part.songId);
    await backdate(sessionId, '61 seconds');
    await expectError(submit(userId, sessionId, result), 'empty_run');
    const { rows } = await db.query('select 1 from public.scores_best where user_id = $1', [userId]);
    expect(rows).toEqual([]);
  });

  it('keeps only the best score', async () => {
    const userId = await newPlayer();
    const part = await registerPart();
    await play(userId, part, { score: 4000 });
    expect(await play(userId, part, { score: 3000 })).toMatchObject({ personalBest: false, weeklyBest: false });
    expect(await play(userId, part, { score: 5000 })).toMatchObject({ personalBest: true, weeklyBest: true });
    const { rows } = await db.query<{ score: number }>(
      'select score from public.scores_best where user_id = $1 and song_id = $2', [userId, part.songId]);
    expect(rows).toEqual([{ score: 5000 }]);
  });
});

describe('leaderboard', () => {
  const columns = ['accuracy', 'achieved_at', 'is_me', 'max_combo', 'nickname', 'rank', 'score'];

  it('ranks equal scores together, flags the caller and never exposes user ids', async () => {
    const part = await registerPart();
    const ana = await newPlayer('Ana Board');
    const bia = await newPlayer('Bia Board');
    const caio = await newPlayer('Caio Board');
    await play(ana, part, { score: 5000 });
    await play(bia, part, { score: 5000 });
    expect(await play(caio, part, { score: 3000 })).toMatchObject({ rankAll: 3, rankWeek: 3 });

    const board = (userId: string | null, period = 'all', limit = 50) => callAs<Record<string, unknown>>(
      db, userId ? 'authenticated' : 'anon', userId, 'select * from public.get_leaderboard($1, 0, $2, $3)',
      [part.songId, period, limit]);

    const anon = await board(null);
    expect(anon.map((r) => [r.rank, r.nickname, r.score, r.is_me])).toEqual([
      [1, 'Ana Board', 5000, false], [1, 'Bia Board', 5000, false], [3, 'Caio Board', 3000, false]
    ]);
    expect(Object.keys(anon[0]).sort()).toEqual(columns);
    expect((await board(bia)).map((r) => r.is_me)).toEqual([false, true, false]);
    expect(await board(null, 'week')).toHaveLength(3);
    expect(await board(null, 'all', 1)).toHaveLength(1);
    expect(await board(null, 'all', 0)).toHaveLength(1);
    await expectError(board(null, 'month'), 'invalid_input');

    const position = await callAs<Record<string, unknown>>(db, 'authenticated', caio,
      'select * from public.get_my_position($1, 0)', [part.songId]);
    expect(position).toEqual([expect.objectContaining({ rank: 3, nickname: 'Caio Board', is_me: true })]);
    expect(Object.keys(position[0]).sort()).toEqual(columns);
    expect(await callAs(db, 'authenticated', await newPlayer(), 'select * from public.get_my_position($1, 0)', [part.songId]))
      .toEqual([]);
  });

  it('shows only this week on the weekly board', async () => {
    const part = await registerPart();
    const userId = await newPlayer();
    await play(userId, part);
    await db.query('update public.scores_weekly set week_start = week_start - 7 where user_id = $1', [userId]);
    const week = await callAs(db, 'anon', null, "select * from public.get_leaderboard($1, 0, 'week')", [part.songId]);
    const all = await callAs(db, 'anon', null, "select * from public.get_leaderboard($1, 0, 'all')", [part.songId]);
    expect([week.length, all.length]).toEqual([0, 1]);
  });

  it('starts weeks on Monday, Brasília time', async () => {
    const { rows } = await db.query<{ dow: number; matches: boolean }>(`
      select extract(isodow from public.current_week_start())::int as dow,
        public.current_week_start() = date_trunc('week', now() at time zone 'America/Sao_Paulo')::date as matches`);
    expect(rows[0]).toEqual({ dow: 1, matches: true });
  });
});

describe('export_my_data', () => {
  it('returns everything linked to the account and nothing about other players', async () => {
    const other = await newPlayer('Outra Pessoa');
    const userId = await newPlayer('Titular Export');
    const mine = await registerPart({ by: userId });
    const theirs = await registerPart({ by: other });
    await play(userId, mine, { score: 4200 });
    await play(other, mine, { score: 4300 });
    await play(other, theirs);
    await startSession(userId, mine.songId);

    const data = await rpc<Record<string, unknown>>(db, userId, 'public.export_my_data()');
    expect(Object.keys(data).sort()).toEqual(
      ['account', 'exported_at', 'play_sessions', 'profile', 'register_part_quota', 'registered_parts', 'scores_best',
        'scores_weekly']);
    expect(data.account).toEqual({ id: userId, created_at: expect.any(String), is_anonymous: true });
    expect(data.profile).toMatchObject({ nickname: 'Titular Export', consent_version: 'v1' });
    expect(data.scores_best).toEqual([expect.objectContaining({ song_id: mine.songId, score: 4200, title: 'Música' })]);
    expect(data.scores_weekly).toEqual([expect.objectContaining({ song_id: mine.songId, score: 4200, week_start: expect.any(String) })]);
    expect(data.play_sessions).toEqual([
      { song_id: mine.songId, part_id: 0, revision_id: 1, started_at: expect.any(String), submitted_at: expect.any(String) },
      { song_id: mine.songId, part_id: 0, revision_id: 1, started_at: expect.any(String), submitted_at: null }
    ]);
    expect(data.registered_parts).toEqual([
      { song_id: mine.songId, part_id: 0, title: 'Música', track_name: 'Guitarra', registered_at: expect.any(String) }
    ]);
    // The exact lists above already leave out the other player's rows; also no id or nickname anywhere
    const text = JSON.stringify(data);
    expect(text).not.toContain(other);
    expect(text).not.toContain('Outra Pessoa');
    expect(theirs.songId).not.toBe(mine.songId);
  });
});

describe('delete_my_account', () => {
  it('deletes the auth user and everything that cascades from it', async () => {
    const other = await newPlayer();
    const userId = await newPlayer('Apagar Conta');
    const part = await registerPart({ by: userId });
    await play(userId, part);
    await play(other, part);
    await startSession(userId, part.songId);

    await rpc(db, userId, 'public.delete_my_account()');

    const { rows } = await db.query<Record<string, number>>(`
      select
        (select count(*) from auth.users where id = $1) as users,
        (select count(*) from public.profiles where id = $1) as profiles,
        (select count(*) from public.play_sessions where user_id = $1) as sessions,
        (select count(*) from public.scores_best where user_id = $1) as best,
        (select count(*) from public.scores_weekly where user_id = $1) as weekly,
        (select count(*) from public.song_parts where registered_by = $1) as registered,
        (select count(*) from public.song_parts where song_id = $2) as part_kept,
        (select count(*) from public.scores_best where user_id = $3) as other_best`, [userId, part.songId, other]);
    expect(rows[0]).toEqual({
      users: 0, profiles: 0, sessions: 0, best: 0, weekly: 0, registered: 0, part_kept: 1, other_best: 1
    });
    // A token that outlives the account can't recreate data for it
    await expectError(createProfile(userId, 'Fantasma'), 'not_authenticated');
  });
});

describe('server_time and seed data', () => {
  it('returns the database clock to anyone, without elevated rights', async () => {
    const time = await rpc<Date>(db, null, 'public.server_time()');
    expect(Math.abs(time.getTime() - Date.now())).toBeLessThan(5_000);
    const { rows } = await db.query<{ definer: boolean }>(
      "select prosecdef as definer from pg_proc where oid = 'public.server_time()'::regprocedure");
    expect(rows).toEqual([{ definer: false }]);
  });

  it('indexes the columns the purge and foreign keys scan', async () => {
    const { rows } = await db.query<{ indexname: string }>(
      `select indexname from pg_indexes
       where indexname in ('play_sessions_started_idx', 'play_sessions_part_idx', 'scores_weekly_week_idx')
       order by indexname`);
    expect(rows.map((row) => row.indexname)).toEqual(
      ['play_sessions_part_idx', 'play_sessions_started_idx', 'scores_weekly_week_idx']);
  });

  it('seeds the offline demo with the numbers the app computes', async () => {
    const demo = getDemoSong();
    const scorable = countScorableNotes(demo.notes);
    const { rows } = await db.query('select * from public.song_parts where song_id = -1 and part_id = 0');
    expect(rows[0]).toMatchObject({
      title: demo.title,
      artist: demo.artist,
      track_name: demo.trackName,
      scorable_notes: scorable,
      duration_ms: demo.totalDurationMs,
      max_score: maxPossibleScore(scorable),
      registered_by: null
    });
  });
});

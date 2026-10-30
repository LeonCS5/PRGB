import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '../../src/services/backend/roomChannel';
import { callAs, createDatabase, createUser, readMigration, rpc } from './harness.ts';

// Realtime runs the policies on realtime.messages with the channel topic in realtime.topic, as the joining
// player, and rolls back; here the same queries run against the shim.
let db: PGlite;

beforeAll(async () => {
  db = await createDatabase();
}, 30_000);

afterAll(async () => {
  await db?.close();
});

type Role = 'anon' | 'authenticated';

interface Seat { code: string; seat: 1 | 2 }
interface StoredSeat extends Seat { user_id: string; joined_at: Date }

let counter = 0;

async function player(): Promise<string> {
  const id = await createUser(db);
  await rpc(db, id, "public.create_profile($1, true, true, 'v1')", [`Sala ${++counter}`]);
  return id;
}

const create = (userId: string) => rpc<Seat>(db, userId, 'public.create_room()');
const join = (userId: string, code: string | null) => rpc<Seat>(db, userId, 'public.join_room($1)', [code]);
const leave = (userId: string, code: string) => rpc<void>(db, userId, 'public.leave_room($1)', [code]);
const member = (userId: string, code: string) => rpc<boolean>(db, userId, 'public.is_room_member($1)', [`room:${code}`]);
const seats = async (code: string) => (await db.query<StoredSeat>(
  'select code, seat, user_id, joined_at from public.room_seats where code = $1 order by seat', [code])).rows;
const expectError = (promise: Promise<unknown>, message: string) =>
  expect(promise).rejects.toMatchObject({ message });

async function asRealtime(role: Role, userId: string | null, topic: string, action: 'read' | 'send', extension = 'broadcast') {
  return db.transaction(async (tx) => {
    await tx.query(
      `select set_config('role', $1, true), set_config('request.jwt.claim.sub', $2, true),
        set_config('realtime.topic', $3, true)`, [role, userId ?? '', topic]);
    try {
      if (action === 'send') {
        await tx.query('insert into realtime.messages (topic, extension) values ($1, $2)', [topic, extension]);
        return true;
      }
      const { rows } = await tx.query('select 1 from realtime.messages where topic = $1 and extension = $2',
        [topic, extension]);
      return rows.length > 0;
    } catch (error) {
      if ((error as { code?: string }).code === '42501') return false;
      throw error;
    } finally {
      await tx.rollback();
    }
  });
}

describe('room admission', () => {
  it('requires an existing profile and never creates an account or profile', async () => {
    const userId = await createUser(db);
    await expectError(create(userId), 'profile_required');
    await expectError(join(userId, 'ABC234'), 'profile_required');
    expect(await rpc(db, userId, 'public.get_my_profile()')).toBeNull();
    expect((await db.query('select 1 from public.room_seats where user_id = $1', [userId])).rows).toEqual([]);
    await expectError(callAs(db, 'authenticated', null, 'select public.create_room()'), 'not_authenticated');
    await expectError(callAs(db, 'authenticated', null, "select public.join_room('ABC234')"), 'not_authenticated');
  });

  it('generates server codes with the client alphabet and returns the host seat', async () => {
    const host = await player();
    const room = await create(host);
    expect(Object.keys(room).sort()).toEqual(['code', 'seat']);
    expect(room.seat).toBe(1);
    expect(room.code).toMatch(new RegExp(`^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`));
    expect(await seats(room.code)).toEqual([{ ...room, user_id: host, joined_at: expect.any(Date) }]);
    expect(await member(host, room.code)).toBe(true);
  });

  it('retries a generated code collision without stealing the occupied room', async () => {
    const original = await player();
    const host = await player();
    const result = await db.transaction(async (tx) => {
      await tx.query("insert into public.room_seats (code, seat, user_id) values ('AAAAAA', 1, $1)", [original]);
      // Control only the random source; the production code still uses the real pgcrypto extension.
      await tx.exec(`
        create sequence public.room_test_random;
        create or replace function extensions.gen_random_bytes(integer) returns bytea language sql as $$
          select decode(repeat(case when nextval('public.room_test_random') = 1 then '00' else '01' end, $1), 'hex')
        $$;`);
      await tx.query("select set_config('role', 'authenticated', true), set_config('request.jwt.claim.sub', $1, true)", [host]);
      const { rows } = await tx.query<{ value: Seat }>('select public.create_room() as value');
      await tx.query("select set_config('role', 'postgres', true)");
      const kept = (await tx.query<{ user_id: string }>("select user_id from public.room_seats where code = 'AAAAAA'")).rows;
      await tx.rollback();
      return { room: rows[0].value, kept };
    });
    expect(result.room).toEqual({ code: 'BBBBBB', seat: 1 });
    expect(result.kept).toEqual([{ user_id: original }]);
  });

  it('admits one of two simultaneous joins and rejects the other as room_full', async () => {
    const host = await player();
    const guests = await Promise.all([player(), player()]);
    const room = await create(host);
    // PGlite serializes transactions on one connection. This tests simultaneous callers and the resulting
    // seat invariant, but lock contention between actual PostgreSQL sessions still needs integration testing.
    const results = await Promise.allSettled(guests.map((id) => join(id, room.code)));
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toEqual([
      expect.objectContaining({ reason: expect.objectContaining({ message: 'room_full' }) })
    ]);
    const occupied = await seats(room.code);
    expect(occupied.map((row) => row.seat)).toEqual([1, 2]);
    expect(occupied[0].user_id).toBe(host);
    expect(guests).toContain(occupied[1].user_id);
    const winner = guests[results.findIndex((result) => result.status === 'fulfilled')];
    const loser = guests.find((id) => id !== winner)!;
    expect(await member(winner, room.code)).toBe(true);
    expect(await member(loser, room.code)).toBe(false);
  });

  it('returns the original seat on reconnect without changing its creation time', async () => {
    const host = await player();
    const guest = await player();
    const room = await create(host);
    expect(await join(guest, room.code)).toEqual({ code: room.code, seat: 2 });
    const before = await seats(room.code);
    expect(await join(host, room.code)).toEqual(room);
    expect(await join(guest, room.code)).toEqual({ code: room.code, seat: 2 });
    expect(await seats(room.code)).toEqual(before);
  });

  it('distinguishes invalid codes from missing rooms', async () => {
    const userId = await player();
    for (const code of [null, '', 'abc234', 'ABC23', 'ABC2345', 'ABCO10', 'ABC234 ', 'room:ABC234']) {
      await expectError(join(userId, code), 'invalid_code');
    }
    await expectError(join(userId, 'ZZZZZZ'), 'room_not_found');
  });

  it('moves a guest into another room only after admission succeeds', async () => {
    const hostA = await player();
    const hostB = await player();
    const guest = await player();
    const blocker = await player();
    const a = await create(hostA);
    const b = await create(hostB);
    await join(guest, a.code);
    await join(blocker, b.code);
    await expectError(join(guest, b.code), 'room_full');
    await expectError(join(guest, 'ZZZZZZ'), 'room_not_found');
    expect(await member(guest, a.code)).toBe(true);
    await leave(blocker, b.code);
    await join(guest, b.code);
    expect((await seats(a.code)).map((row) => row.user_id)).toEqual([hostA]);
    expect(await member(guest, b.code)).toBe(true);
  });

  it('ends the previous room when its host creates or joins another', async () => {
    const host = await player();
    const guest = await player();
    const targetHost = await player();
    const a = await create(host);
    await join(guest, a.code);
    const b = await create(host);
    expect(await seats(a.code)).toEqual([]);
    await join(guest, b.code);
    const target = await create(targetHost);
    await join(host, target.code);
    expect(await seats(b.code)).toEqual([]);
    expect(await member(guest, b.code)).toBe(false);
    expect(await member(host, target.code)).toBe(true);
    expect((await db.query('select 1 from public.room_seats where user_id = $1', [host])).rows).toHaveLength(1);
  });

  it('allows at most ten creations per rolling hour, even after leaving every room', async () => {
    const host = await player();
    for (let i = 0; i < 10; i++) {
      const room = await create(host);
      await leave(host, room.code);
    }
    await expectError(create(host), 'rate_limited');
    await db.query("update public.room_create_quota set created_at = array_fill(now() - interval '61 minutes', array[10]) where user_id = $1", [host]);
    await expect(create(host)).resolves.toMatchObject({ seat: 1 });
    const { rows } = await db.query<{ count: number }>(
      'select cardinality(created_at) as count from public.room_create_quota where user_id = $1', [host]);
    expect(rows).toEqual([{ count: 1 }]);
  });

  it('keeps the current room when a new creation is rate limited', async () => {
    const host = await player();
    let room = await create(host);
    for (let i = 1; i < 10; i++) room = await create(host);
    await expectError(create(host), 'rate_limited');
    expect(await member(host, room.code)).toBe(true);
  });

  it('releases only the caller guest and lets a replacement join', async () => {
    const host = await player();
    const guest = await player();
    const stranger = await player();
    const room = await create(host);
    await join(guest, room.code);
    await leave(stranger, room.code);
    expect(await seats(room.code)).toHaveLength(2);
    await leave(guest, room.code);
    await leave(guest, room.code);
    expect((await seats(room.code)).map((row) => row.user_id)).toEqual([host]);
    expect(await join(stranger, room.code)).toEqual({ code: room.code, seat: 2 });
  });

  it('removes both seats when the host leaves and keeps leave idempotent', async () => {
    const host = await player();
    const guest = await player();
    const room = await create(host);
    await join(guest, room.code);
    await leave(host, room.code);
    await leave(host, room.code);
    await leave(guest, room.code);
    expect(await seats(room.code)).toEqual([]);
    expect(await member(guest, room.code)).toBe(false);
    await expectError(join(guest, room.code), 'room_not_found');
  });
});

describe('room channel policies', () => {
  it('accepts SELECT and INSERT for seated host and guest, only for Broadcast and Presence', async () => {
    const host = await player();
    const guest = await player();
    const room = await create(host);
    await join(guest, room.code);
    const topic = `room:${room.code}`;
    await db.query("insert into realtime.messages (topic, extension) values ($1, 'broadcast'), ($1, 'presence')", [topic]);
    for (const id of [host, guest]) {
      for (const extension of ['broadcast', 'presence']) {
        for (const action of ['read', 'send'] as const) {
          expect(await asRealtime('authenticated', id, topic, action, extension), `${id} ${action} ${extension}`).toBe(true);
        }
      }
    }
  });

  it('refuses SELECT and INSERT for invisible observers, rejected thirds and anonymous callers', async () => {
    const host = await player();
    const guest = await player();
    const observer = await player();
    const room = await create(host);
    await join(guest, room.code);
    await expectError(join(observer, room.code), 'room_full');
    const topic = `room:${room.code}`;
    await db.query("insert into realtime.messages (topic, extension) values ($1, 'broadcast'), ($1, 'presence')", [topic]);
    for (const extension of ['broadcast', 'presence']) {
      for (const action of ['read', 'send'] as const) {
        expect(await asRealtime('authenticated', observer, topic, action, extension)).toBe(false);
        expect(await asRealtime('anon', null, topic, action, extension)).toBe(false);
      }
    }
  });

  it('revokes admission after leaving and rejects malformed topics, other rooms and extensions', async () => {
    const host = await player();
    const guest = await player();
    const otherHost = await player();
    const room = await create(host);
    const other = await create(otherHost);
    await join(guest, room.code);
    const topics = ['lobby', 'room:abc234', 'room:ABC23', 'room:ABC2340', 'room:ABCO10', 'room:ABC234 ', `room:${other.code}`];
    for (const topic of topics) {
      await db.query("insert into realtime.messages (topic, extension) values ($1, 'broadcast')", [topic]);
      for (const action of ['read', 'send'] as const) {
        expect(await asRealtime('authenticated', host, topic, action), `${topic} ${action}`).toBe(false);
      }
    }
    const topic = `room:${room.code}`;
    await db.query("insert into realtime.messages (topic, extension) values ($1, 'broadcast'), ($1, 'postgres_changes')", [topic]);
    for (const action of ['read', 'send'] as const) {
      expect(await asRealtime('authenticated', host, topic, action, 'postgres_changes')).toBe(false);
    }
    await leave(guest, room.code);
    for (const action of ['read', 'send'] as const) {
      expect(await asRealtime('authenticated', guest, topic, action)).toBe(false);
    }
    expect(await rpc(db, host, 'public.is_room_member(null)')).toBe(false);
  });

  it('restricts room RPCs to authenticated and pins security definer search paths', async () => {
    const names = ['create_room', 'join_room', 'leave_room', 'is_room_member'];
    const { rows } = await db.query<{
      name: string; definer: boolean; config: string[]; anon: boolean; authenticated: boolean; volatility: string;
    }>(`select p.proname as name, p.prosecdef as definer, p.proconfig as config, p.provolatile as volatility,
        has_function_privilege('anon', p.oid, 'execute') as anon,
        has_function_privilege('authenticated', p.oid, 'execute') as authenticated
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = any($1::text[])`, [names]);
    expect(rows).toHaveLength(names.length);
    for (const row of rows) {
      expect(row).toMatchObject({ definer: true, anon: false, authenticated: true });
      expect(row.config).toContain('search_path=""');
      if (row.name === 'is_room_member') expect(row.volatility).toBe('s');
    }
    for (const call of ['public.create_room()', "public.join_room('ABC234')", "public.leave_room('ABC234')", "public.is_room_member('room:ABC234')"]) {
      await expect(callAs(db, 'anon', null, `select ${call}`)).rejects.toMatchObject({ code: '42501' });
    }
  });

  it('denies direct table reads and writes even for a seated player', async () => {
    const host = await player();
    await create(host);
    for (const table of ['room_seats', 'room_create_quota']) {
      await expect(callAs(db, 'authenticated', host, `select * from public.${table}`)).rejects.toMatchObject({ code: '42501' });
      await expect(callAs(db, 'authenticated', host, `delete from public.${table}`)).rejects.toMatchObject({ code: '42501' });
    }
    await expect(callAs(db, 'authenticated', host,
      "insert into public.room_seats (code, seat, user_id) values ('ABC234', 1, $1)", [host])).rejects.toMatchObject({ code: '42501' });
    const visible = await db.transaction(async (tx) => {
      await tx.exec('grant select on public.room_seats, public.room_create_quota to authenticated');
      await tx.query("select set_config('role', 'authenticated', true), set_config('request.jwt.claim.sub', $1, true)", [host]);
      const { rows } = await tx.query<{ count: number }>(
        'select (select count(*) from public.room_seats) + (select count(*) from public.room_create_quota) as count');
      await tx.rollback();
      return rows[0].count;
    });
    expect(visible).toBe(0);
  });
});

describe('room data lifecycle', () => {
  it('exports only the caller seat and quota, retaining the earlier export contract', async () => {
    const host = await player();
    const guest = await player();
    const room = await create(host);
    await join(guest, room.code);
    const before = await seats(room.code);
    for (const [id, seat] of [[host, 1], [guest, 2]] as const) {
      const data = await rpc<Record<string, unknown>>(db, id, 'public.export_my_data()');
      expect(data.room_seats).toEqual([{ code: room.code, seat, joined_at: expect.any(String) }]);
      const exported = data.room_seats as { joined_at: string }[];
      expect(new Date(exported[0].joined_at).getTime()).toBe(before[seat - 1].joined_at.getTime());
      expect(JSON.stringify(data)).not.toContain(id === host ? guest : host);
      expect(data).toMatchObject({ account: { id }, scores_best: [], scores_weekly: [], play_sessions: [] });
      expect(data.room_create_quota).toEqual(id === host ? [expect.any(String)] : []);
    }
    await leave(guest, room.code);
    expect((await rpc<Record<string, unknown>>(db, guest, 'public.export_my_data()')).room_seats).toEqual([]);
  });

  it('cleans guest seats on account deletion and removes the whole room when deleting its host', async () => {
    const host = await player();
    const guest = await player();
    const room = await create(host);
    await join(guest, room.code);
    await rpc(db, guest, 'public.delete_my_account()');
    expect((await seats(room.code)).map((row) => row.user_id)).toEqual([host]);
    const replacement = await player();
    await join(replacement, room.code);
    await rpc(db, host, 'public.delete_my_account()');
    expect(await seats(room.code)).toEqual([]);
    expect((await db.query('select 1 from public.room_create_quota where user_id = $1', [host])).rows).toEqual([]);
    expect(await member(replacement, room.code)).toBe(false);
    await expectError(create(host), 'profile_required');
  });

  it('schedules its own hourly purge without changing the ranking purge', async () => {
    const { rows } = await db.query<{ schedule: string; command: string }>(
      "select schedule, command from cron.job where jobname = 'prgb-room-seats'");
    expect(rows).toHaveLength(1);
    expect(rows[0].schedule).toMatch(/^\d{1,2} \* \* \* \*$/);
    expect(rows[0].command).toContain('public.purge_expired_room_seats()');
    expect(readMigration('retention')).not.toContain('room_seats');
    const { rows: indexes } = await db.query<{ indexdef: string }>(
      "select indexdef from pg_indexes where schemaname = 'public' and tablename = 'room_seats'");
    expect(indexes.some((index) => index.indexdef.includes('(joined_at)'))).toBe(true);
    await expect(callAs(db, 'authenticated', await player(), 'select public.purge_expired_room_seats()'))
      .rejects.toMatchObject({ code: '42501' });
  });

  it('purges old seats, closes an expired host room, and leaves fresh rooms intact', async () => {
    const oldHost = await player();
    const freshGuest = await player();
    const freshHost = await player();
    const oldGuest = await player();
    const oldRoom = await create(oldHost);
    await join(freshGuest, oldRoom.code);
    const freshRoom = await create(freshHost);
    await join(oldGuest, freshRoom.code);
    await db.query("update public.room_seats set joined_at = now() - interval '7 hours' where user_id = any($1::uuid[])", [[oldHost, oldGuest]]);
    await db.query("update public.room_create_quota set created_at = array[now() - interval '7 hours'] where user_id = $1", [oldHost]);
    await db.query('select public.purge_expired_room_seats()');
    expect(await seats(oldRoom.code)).toEqual([]);
    expect((await seats(freshRoom.code)).map((row) => row.user_id)).toEqual([freshHost]);
    expect((await db.query('select 1 from public.room_create_quota where user_id = $1', [oldHost])).rows).toEqual([]);
    expect((await db.query('select 1 from public.room_create_quota where user_id = $1', [freshHost])).rows).toHaveLength(1);
    expect((await db.query('select 1 from auth.users where id = any($1::uuid[])', [[oldHost, oldGuest]])).rows).toHaveLength(2);
  });
});

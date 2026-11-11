import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { callAs, createDatabase, createUser, rpc } from './harness.ts';

let db: PGlite;

beforeAll(async () => {
  db = await createDatabase();
}, 30_000);

afterAll(async () => {
  await db?.close();
});

let counter = 0;

async function player(): Promise<string> {
  const id = await createUser(db);
  await rpc(db, id, "public.create_profile($1, true, true, 'v1')", [`Limite ${++counter}`]);
  return id;
}

const expectError = (promise: Promise<unknown>, message: string) =>
  expect(promise).rejects.toMatchObject({ message });

const used = async (userId: string, action: string) =>
  (await db.query<{ used: number }>(
    'select coalesce(sum(used), 0)::int as used from public.rpc_quota where user_id = $1 and action = $2',
    [userId, action]
  )).rows[0].used;

/** Pretends the player already spent `count` calls of this action in the current hour. */
const spend = (userId: string, action: string, count: number) =>
  db.query(
    `insert into public.rpc_quota (user_id, action, window_start, used)
     values ($1, $2, date_trunc('hour', now()), $3)
     on conflict (user_id, action, window_start) do update set used = excluded.used`,
    [userId, action, count]
  );

const age = (userId: string, hours = 2) =>
  db.query(`update public.rpc_quota set window_start = window_start - make_interval(hours => $2) where user_id = $1`, [userId, hours]);

describe('create_profile limit', () => {
  it('counts the profile it creates and refuses past 5 an hour, without leaving a profile behind', async () => {
    const id = await createUser(db);
    await spend(id, 'create_profile', 4);
    await rpc(db, id, "public.create_profile('Quinto limite', true, true, 'v1')");
    expect(await used(id, 'create_profile')).toBe(5);

    const other = await createUser(db);
    await spend(other, 'create_profile', 5);
    await expectError(rpc(db, other, "public.create_profile('Sexto limite', true, true, 'v1')"), 'rate_limited');
    expect((await db.query('select 1 from public.profiles where id = $1', [other])).rows).toEqual([]);
    expect(await used(other, 'create_profile')).toBe(5);

    await age(other);
    await rpc(db, other, "public.create_profile('Sexto limite', true, true, 'v1')");
  });

  it('keeps the existing errors ahead of the limit', async () => {
    const id = await createUser(db);
    await spend(id, 'create_profile', 5);
    await expectError(rpc(db, id, "public.create_profile('Sem aceite', false, true, 'v1')"), 'consent_required');
    const withProfile = await player();
    await spend(withProfile, 'create_profile', 5);
    await expectError(rpc(db, withProfile, "public.create_profile('Outro nome', true, true, 'v1')"), 'profile_exists');
  });
});

describe('update_nickname limit', () => {
  it('stops at the 11th change in an hour and works again after the window', async () => {
    const id = await player();
    for (let i = 1; i <= 10; i++) await rpc(db, id, 'public.update_nickname($1)', [`Troca ${counter}x${i}`]);
    await expectError(rpc(db, id, 'public.update_nickname($1)', ['Troca demais']), 'rate_limited');
    const { rows } = await db.query<{ nickname: string }>('select nickname from public.profiles where id = $1', [id]);
    expect(rows[0].nickname).toBe(`Troca ${counter}x10`);
    expect(await used(id, 'update_nickname')).toBe(10);

    await age(id);
    await rpc(db, id, 'public.update_nickname($1)', ['Troca depois']);
  });

  it('does not use up the hour with calls the rules refuse', async () => {
    const id = await player();
    await expectError(rpc(db, id, 'public.update_nickname($1)', ['a']), 'nickname_invalid');
    expect(await used(id, 'update_nickname')).toBe(0);
  });

  it('is counted per player', async () => {
    const [a, b] = [await player(), await player()];
    await spend(a, 'update_nickname', 10);
    await expectError(rpc(db, a, 'public.update_nickname($1)', ['Bloqueado A']), 'rate_limited');
    await rpc(db, b, 'public.update_nickname($1)', ['Livre B']);
  });
});

describe('join_room limit', () => {
  it('allows 30 seat changes an hour, still lets the player reconnect, and recovers after the window', async () => {
    const [hostA, hostB, guest] = [await player(), await player(), await player()];
    const roomA = await rpc<{ code: string }>(db, hostA, 'public.create_room()');
    const roomB = await rpc<{ code: string }>(db, hostB, 'public.create_room()');
    for (let i = 0; i < 30; i++) {
      await rpc(db, guest, 'public.join_room($1)', [i % 2 === 0 ? roomA.code : roomB.code]);
    }
    expect(await used(guest, 'join_room')).toBe(30);
    // Last join was room B (i = 29)
    await expectError(rpc(db, guest, 'public.join_room($1)', [roomA.code]), 'rate_limited');
    expect(await rpc(db, guest, 'public.join_room($1)', [roomB.code])).toEqual({ code: roomB.code, seat: 2 });
    const seat = await db.query<{ code: string }>('select code from public.room_seats where user_id = $1', [guest]);
    expect(seat.rows).toEqual([{ code: roomB.code }]);

    await age(guest);
    expect(await rpc(db, guest, 'public.join_room($1)', [roomA.code])).toEqual({ code: roomA.code, seat: 2 });
  });

  it('keeps room_not_found, room_full and invalid_code ahead of the limit', async () => {
    const [host, a, b] = [await player(), await player(), await player()];
    const room = await rpc<{ code: string }>(db, host, 'public.create_room()');
    await spend(b, 'join_room', 30);
    await rpc(db, a, 'public.join_room($1)', [room.code]);
    await expectError(rpc(db, b, 'public.join_room($1)', [room.code]), 'room_full');
    await expectError(rpc(db, b, 'public.join_room($1)', ['AAAAAA']), 'room_not_found');
    await expectError(rpc(db, b, 'public.join_room($1)', ['x']), 'invalid_code');
  });
});

describe('export_my_data limit', () => {
  it('allows 10 exports an hour and lists the quota rows in the export', async () => {
    const id = await player();
    for (let i = 0; i < 10; i++) await rpc(db, id, 'public.export_my_data()');
    await expectError(rpc(db, id, 'public.export_my_data()'), 'rate_limited');
    await age(id);
    const data = await rpc<{ rpc_quota: { action: string; used: number }[]; profile: { nickname: string } }>(
      db, id, 'public.export_my_data()');
    expect(data.profile.nickname).toMatch(/^Limite/);
    expect(data.rpc_quota).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: 'create_profile', used: 1 }),
      expect.objectContaining({ action: 'export_my_data', used: 1 })
    ]));
  });

  it('refuses a token whose account no longer exists', async () => {
    await expectError(rpc(db, '11111111-1111-4111-8111-111111111111', 'public.export_my_data()'), 'not_authenticated');
  });
});

describe('rpc_quota access and retention', () => {
  it('is closed to the API roles', async () => {
    const id = await player();
    for (const [role, user] of [['anon', null], ['authenticated', id]] as const) {
      await expect(callAs(db, role, user, 'select * from public.rpc_quota')).rejects.toThrow(/permission denied/);
      await expect(callAs(db, role, user, "select public.consume_rpc_quota($1, 'join_room', 1)", [id]))
        .rejects.toThrow(/permission denied/);
      await expect(callAs(db, role, user, 'select public.purge_expired_rpc_quota()')).rejects.toThrow(/permission denied/);
      await expect(callAs(db, role, user, 'select public.purge_cron_history()')).rejects.toThrow(/permission denied/);
    }
  });

  it('keeps the player-facing RPCs closed to anon', async () => {
    await expect(callAs(db, 'anon', null, 'select public.export_my_data()')).rejects.toThrow(/permission denied/);
    await expect(callAs(db, 'anon', null, 'select public.join_room($1)', ['AAAAAA'])).rejects.toThrow(/permission denied/);
  });

  it('is deleted with the account', async () => {
    const id = await player();
    await db.query('delete from auth.users where id = $1', [id]);
    expect((await db.query('select 1 from public.rpc_quota where user_id = $1', [id])).rows).toEqual([]);
  });

  it('schedules a daily purge and deletes only rows older than a day', async () => {
    const { rows } = await db.query("select * from cron.job where jobname = 'prgb-rpc-quota-retention'");
    expect(rows).toEqual([{
      jobname: 'prgb-rpc-quota-retention',
      schedule: '37 6 * * *',
      command: 'select public.purge_expired_rpc_quota()'
    }]);
    const id = await player();
    await db.query(
      `insert into public.rpc_quota (user_id, action, window_start, used) values
         ($1, 'join_room', now() - interval '25 hours', 3), ($1, 'update_nickname', now() - interval '23 hours', 2)`, [id]);
    await db.query('select public.purge_expired_rpc_quota()');
    const left = await db.query<{ action: string }>(
      "select action from public.rpc_quota where user_id = $1 and action <> 'create_profile'", [id]);
    expect(left.rows).toEqual([{ action: 'update_nickname' }]);
  });
});

describe('cron history cleanup', () => {
  it('schedules a daily job', async () => {
    const { rows } = await db.query("select * from cron.job where jobname = 'prgb-cron-history-retention'");
    expect(rows).toEqual([{
      jobname: 'prgb-cron-history-retention',
      schedule: '47 6 * * *',
      command: 'select public.purge_cron_history()'
    }]);
  });

  it('deletes runs older than 30 days and keeps the rest, including ones still running', async () => {
    await db.exec('truncate cron.job_run_details');
    await db.exec(`
      insert into cron.job_run_details (jobid, status, start_time, end_time) values
        (1, 'succeeded', now() - interval '31 days', now() - interval '31 days'),
        (2, 'running', now() - interval '31 days', null),
        (3, 'succeeded', now() - interval '29 days', now() - interval '29 days'),
        (4, 'running', now() - interval '1 hour', null)`);
    await db.query('select public.purge_cron_history()');
    const { rows } = await db.query<{ jobid: number }>('select jobid from cron.job_run_details order by jobid');
    expect(rows.map((row) => Number(row.jobid))).toEqual([3, 4]);
  });
});

describe('submit_feedback repeated text', () => {
  const send = (message: string, category = 'audio') =>
    callAs(db, 'anon', null, "select public.submit_feedback($1, 'inicio', $2)", [category, message]);

  it('takes the same text 3 times an hour, then refuses it while other texts still go through', async () => {
    await db.exec('truncate public.feedback');
    await send('O som some depois de um minuto.');
    await send('o som some depois de um minuto');
    await send('O  SOM some depois de um minuto 123!');
    await expectError(send('O som some depois de um minuto.', 'outro'), 'rate_limited');
    await send('Outro problema bem diferente aqui.');
    expect((await db.query('select 1 from public.feedback')).rows).toHaveLength(4);

    await db.exec("update public.feedback set created_at = now() - interval '61 minutes'");
    await send('O som some depois de um minuto.');
  });

  it('keeps the global limit of 60 an hour', async () => {
    await db.exec('truncate public.feedback');
    await db.exec(`
      insert into public.feedback (category, screen, message)
      select 'outro', 'inicio', 'Relato anterior numero ' || n from generate_series(1, 60) n`);
    await expectError(send('Texto totalmente novo e longo.'), 'rate_limited');
  });
});

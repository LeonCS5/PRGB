import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CREATE_PG_CRON, callAs, createDatabase, createUser, readMigration } from './harness.ts';

let db: PGlite;

beforeAll(async () => {
  // pg_cron is stubbed by the harness
  expect(readMigration('retention')).toContain(CREATE_PG_CRON);
  db = await createDatabase({ retention: true });
}, 30_000);

afterAll(async () => {
  await db?.close();
});

let counter = 0;

async function player(fields: { lastSeen?: string; isAnonymous?: boolean } = {}): Promise<string> {
  const id = await createUser(db, { isAnonymous: fields.isAnonymous });
  await callAs(db, 'authenticated', id, "select public.create_profile($1, true, true, 'v1')", [`Retido ${++counter}`]);
  if (fields.lastSeen) {
    await db.query('update public.profiles set last_seen_at = now() - $2::interval where id = $1', [id, fields.lastSeen]);
  }
  return id;
}

const exists = async (sql: string, params: unknown[]) => (await db.query(sql, params)).rows.length > 0;
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

describe('retention', () => {
  it('schedules a daily purge', async () => {
    const { rows } = await db.query("select * from cron.job where jobname = 'prgb-ranking-retention'");
    expect(rows).toEqual([{
      jobname: 'prgb-ranking-retention',
      schedule: '17 6 * * *',
      command: 'select public.purge_expired_ranking_data()'
    }]);
  });

  it('is not callable by players', async () => {
    await expect(callAs(db, 'authenticated', await createUser(db), 'select public.purge_expired_ranking_data()'))
      .rejects.toMatchObject({ code: '42501' });
  });

  it('deletes idle accounts, old sessions and old weekly scores, and unlinks old registrations', async () => {
    const idle = await player({ lastSeen: '13 months' });
    const active = await player({ lastSeen: '11 months' });
    const idlePermanent = await player({ lastSeen: '13 months', isAnonymous: false });
    // Anonymous accounts that never created a profile go after 2 days
    const orphanOld = await createUser(db, { createdAt: daysAgo(3) });
    const orphanNew = await createUser(db, { createdAt: daysAgo(1) });

    await db.query(
      `insert into public.song_parts (song_id, part_id, revision_id, title, artist, track_name, scorable_notes, duration_ms,
         max_score, registered_by, registered_at)
       values (1, 0, 1, 'Velha', 'Banda', 'Guitarra', 10, 60000, 4500, $1, now() - interval '8 days'),
              (2, 0, 1, 'Nova', 'Banda', 'Guitarra', 10, 60000, 4500, $1, now() - interval '1 day')`, [active]);
    await db.query(
      `insert into public.play_sessions (user_id, song_id, part_id, revision_id, scorable_notes, duration_ms, max_score, started_at)
       values ($1, 1, 0, 1, 10, 60000, 4500, now() - interval '8 days'),
              ($1, 1, 0, 1, 10, 60000, 4500, now() - interval '6 days')`, [active]);
    await db.query(
      `insert into public.scores_weekly (user_id, song_id, part_id, week_start, score, accuracy, max_combo, perfect, good, miss)
       values ($1, 1, 0, public.current_week_start() - 56, 100, 100, 1, 1, 0, 0),
              ($1, 1, 0, public.current_week_start() - 63, 100, 100, 1, 1, 0, 0)`, [active]);
    await db.query(
      `insert into public.scores_best (user_id, song_id, part_id, score, accuracy, max_combo, perfect, good, miss)
       values ($1, 1, 0, 100, 100, 1, 1, 0, 0)`, [idle]);

    await db.query(
      `insert into public.register_part_quota (user_id, window_start, used)
       values ($1, date_trunc('hour', now()) - interval '2 days', 5), ($1, date_trunc('hour', now()), 1)`, [active]);

    await db.query('select public.purge_expired_ranking_data()');

    const user = (id: string) => exists('select 1 from auth.users where id = $1', [id]);
    const profile = (id: string) => exists('select 1 from public.profiles where id = $1', [id]);
    expect([await user(idle), await profile(idle)]).toEqual([false, false]);
    expect(await exists('select 1 from public.scores_best where user_id = $1', [idle])).toBe(false);
    expect([await user(active), await profile(active)]).toEqual([true, true]);
    // A permanent account is kept, only its ranking profile goes
    expect([await user(idlePermanent), await profile(idlePermanent)]).toEqual([true, false]);
    expect([await user(orphanOld), await user(orphanNew)]).toEqual([false, true]);

    const { rows: sessions } = await db.query<{ days: number }>(
      "select extract(day from now() - started_at)::int as days from public.play_sessions where user_id = $1", [active]);
    expect(sessions).toEqual([{ days: 6 }]);
    const { rows: weeks } = await db.query<{ age: number }>(
      'select public.current_week_start() - week_start as age from public.scores_weekly where user_id = $1', [active]);
    expect(weeks).toEqual([{ age: 56 }]);
    const { rows: parts } = await db.query<{ song_id: number; registered_by: string | null }>(
      'select song_id, registered_by from public.song_parts where song_id in (1, 2) order by song_id');
    expect(parts).toEqual([{ song_id: 1, registered_by: null }, { song_id: 2, registered_by: active }]);
    const { rows: quota } = await db.query<{ used: number }>(
      'select used from public.register_part_quota where user_id = $1', [active]);
    expect(quota).toEqual([{ used: 1 }]);
  });

  it('runs every step even when one fails', async () => {
    const orphan = await createUser(db, { createdAt: daysAgo(3) });
    const owner = await player();
    await db.query(
      `insert into public.play_sessions (user_id, song_id, part_id, revision_id, scorable_notes, duration_ms, max_score, started_at)
       values ($1, 1, 0, 1, 10, 60000, 4500, now() - interval '8 days')`, [owner]);

    const after = await db.transaction(async (tx) => {
      // Make the session cleanup fail
      await tx.exec(`
        create function public.refuse_delete() returns trigger language plpgsql as $$
        begin raise exception 'refused'; end; $$;
        create trigger refuse_delete before delete on public.play_sessions
          for each row execute function public.refuse_delete();`);
      await tx.query('select public.purge_expired_ranking_data()');
      const { rows } = await tx.query<{ orphan: boolean; sessions: number }>(
        `select exists (select 1 from auth.users where id = $1) as orphan,
          (select count(*) from public.play_sessions where user_id = $2) as sessions`, [orphan, owner]);
      await tx.rollback();
      return rows[0];
    });
    // The account step still ran; the failing session step kept its rows
    expect(after).toEqual({ orphan: false, sessions: 1 });
  });
});

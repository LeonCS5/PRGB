import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { callAs, createDatabase, createUser } from './harness.ts';

let db: PGlite;

beforeAll(async () => {
  db = await createDatabase();
}, 30_000);

afterAll(async () => {
  await db?.close();
});

beforeEach(async () => {
  await db.exec('truncate public.feedback');
});

const submit = (message: unknown, category: unknown = 'audio', screen: unknown = 'inicio') =>
  callAs(db, 'anon', null, 'select public.submit_feedback($1, $2, $3)', [category, screen, message]);

const stored = async () =>
  (await db.query<{ category: string; screen: string; message: string }>(
    'select category, screen, message from public.feedback order by id'
  )).rows;

describe('submit_feedback', () => {
  it('stores a report sent with no account', async () => {
    await submit('O som some depois de um minuto.', 'audio', 'play_free');
    expect(await stored()).toEqual([
      { category: 'audio', screen: 'play_free', message: 'O som some depois de um minuto.' }
    ]);
  });

  it('accepts a signed-in player too, without recording who sent it', async () => {
    const id = await createUser(db);
    await callAs(db, 'authenticated', id, 'select public.submit_feedback($1, $2, $3)', ['outro', 'jogo', 'Texto com mais de dez letras.']);
    const { rows } = await db.query('select * from public.feedback');
    expect(Object.keys(rows[0] as object).sort()).toEqual(['category', 'created_at', 'id', 'message', 'screen']);
  });

  it('trims the text before measuring it', async () => {
    await submit('\n  Texto com margem em volta.  \n');
    expect((await stored())[0].message).toBe('Texto com margem em volta.');
    await expect(submit('  curto    ')).rejects.toThrow('invalid_input');
  });

  it.each([
    ['a short text', 'curto', 'audio', 'inicio'],
    ['a long text', 'x'.repeat(1001), 'audio', 'inicio'],
    ['no text', null, 'audio', 'inicio'],
    ['an unknown category', 'Texto com mais de dez letras.', 'spam', 'inicio'],
    ['no category', 'Texto com mais de dez letras.', null, 'inicio'],
    ['an unknown screen', 'Texto com mais de dez letras.', 'audio', 'outra'],
    ['no screen', 'Texto com mais de dez letras.', 'audio', null]
  ])('refuses %s', async (_label, message, category, screen) => {
    await expect(submit(message, category, screen)).rejects.toThrow('invalid_input');
    expect(await stored()).toEqual([]);
  });

  it('takes the longest text allowed', async () => {
    await submit('x'.repeat(1000));
    expect(await stored()).toHaveLength(1);
  });

  it('stops at 60 reports an hour and starts again once they age', async () => {
    await db.exec(`
      insert into public.feedback (category, screen, message)
      select 'outro', 'inicio', 'Relato anterior de teste' from generate_series(1, 60)
    `);
    await expect(submit('Texto com mais de dez letras.')).rejects.toThrow('rate_limited');
    await db.exec("update public.feedback set created_at = now() - interval '61 minutes'");
    await submit('Texto com mais de dez letras.');
    expect(await stored()).toHaveLength(61);
  });
});

describe('feedback access', () => {
  it('gives the API roles no way to read or write the table', async () => {
    const id = await createUser(db);
    await submit('Relato que ninguém pode ler.');
    for (const [role, user] of [['anon', null], ['authenticated', id]] as const) {
      await expect(callAs(db, role, user, 'select * from public.feedback')).rejects.toThrow(/permission denied/);
      await expect(callAs(db, role, user, "insert into public.feedback (category, screen, message) values ('outro', 'inicio', 'Texto direto na tabela')"))
        .rejects.toThrow(/permission denied/);
      await expect(callAs(db, role, user, 'delete from public.feedback')).rejects.toThrow(/permission denied/);
    }
  });

  it('keeps the purge out of the API', async () => {
    await expect(callAs(db, 'anon', null, 'select public.purge_expired_feedback()')).rejects.toThrow(/permission denied/);
  });
});

describe('feedback retention', () => {
  it('schedules a daily purge', async () => {
    const { rows } = await db.query("select * from cron.job where jobname = 'prgb-feedback-retention'");
    expect(rows).toEqual([{
      jobname: 'prgb-feedback-retention',
      schedule: '27 6 * * *',
      command: 'select public.purge_expired_feedback()'
    }]);
  });

  it('deletes reports older than 180 days and keeps the rest', async () => {
    await submit('Relato que já venceu.');
    await submit('Relato ainda dentro do prazo.');
    await db.exec(`update public.feedback set created_at = now() - interval '181 days' where message = 'Relato que já venceu.'`);
    await db.exec(`update public.feedback set created_at = now() - interval '179 days' where message like 'Relato ainda%'`);
    await db.query('select public.purge_expired_feedback()');
    expect((await stored()).map(({ message }) => message)).toEqual(['Relato ainda dentro do prazo.']);
  });
});

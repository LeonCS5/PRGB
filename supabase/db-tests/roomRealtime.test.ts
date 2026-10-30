import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabase, createUser } from './harness.ts';

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

async function asRealtime(role: Role, topic: string, action: 'read' | 'send', extension = 'broadcast') {
  const userId = role === 'authenticated' ? await createUser(db) : '';
  return db.transaction(async (tx) => {
    await tx.query(
      `select set_config('role', $1, true), set_config('request.jwt.claim.sub', $2, true),
        set_config('realtime.topic', $3, true)`, [role, userId, topic]);
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

describe('room channel policies', () => {
  beforeAll(async () => {
    // Rows to read back, as Realtime's own check query would see them
    await db.query(
      `insert into realtime.messages (topic, extension) values
        ('room:ABC234', 'broadcast'), ('room:ABC234', 'presence'), ('lobby', 'broadcast'), ('room:abc234', 'broadcast'),
        ('room:ABC234', 'postgres_changes')`);
  });

  it('lets signed-in players use Broadcast and Presence on valid room topics', async () => {
    for (const extension of ['broadcast', 'presence']) {
      expect(await asRealtime('authenticated', 'room:ABC234', 'send', extension), extension).toBe(true);
      expect(await asRealtime('authenticated', 'room:ABC234', 'read', extension), extension).toBe(true);
    }
  });

  it('refuses players without a session', async () => {
    expect(await asRealtime('anon', 'room:ABC234', 'send')).toBe(false);
    expect(await asRealtime('anon', 'room:ABC234', 'read')).toBe(false);
  });

  it('refuses other topics, malformed codes and other extensions', async () => {
    for (const topic of ['lobby', 'room:abc234', 'room:ABC23', 'room:ABC2340', 'room:ABCO10', 'room:ABC234 ']) {
      expect(await asRealtime('authenticated', topic, 'send'), topic).toBe(false);
    }
    expect(await asRealtime('authenticated', 'lobby', 'read')).toBe(false);
    expect(await asRealtime('authenticated', 'room:abc234', 'read')).toBe(false);
    expect(await asRealtime('authenticated', 'room:ABC234', 'read', 'postgres_changes')).toBe(false);
    expect(await asRealtime('authenticated', 'room:ABC234', 'send', 'postgres_changes')).toBe(false);
  });
});

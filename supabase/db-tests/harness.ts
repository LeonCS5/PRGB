// Runs the migrations in PGlite (real Postgres compiled to WASM) on top of a minimal stand-in for what
// Supabase provides: the API roles, auth.users, auth.uid() and the default privileges that grant every
// new table and function in public to the API roles (so the tests prove the migrations revoke them).
// Not reproduced here: pg_cron (stubbed in retention.test.ts), Supabase's non-superuser postgres role,
// PostgREST and GoTrue themselves.

import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';

const MIGRATIONS_DIR = new URL('../migrations/', import.meta.url);

export function readMigration(name: string): string {
  const file = readdirSync(MIGRATIONS_DIR).find((entry) => entry.endsWith(`_${name}.sql`));
  if (!file) throw new Error(`Migration "${name}" not found`);
  return readFileSync(new URL(file, MIGRATIONS_DIR), 'utf8');
}

export const SUPABASE_SHIM = `
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  is_anonymous boolean not null default true,
  created_at timestamptz not null default now(),
  last_sign_in_at timestamptz
);

-- PostgREST exposes the JWT subject to SQL through this setting
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`;

/** Fresh database with the shim, the ranking migration and any extra SQL, in order. */
export async function createDatabase(...extraSql: string[]): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(SUPABASE_SHIM);
  await db.exec(readMigration('ranking'));
  for (const sql of extraSql) await db.exec(sql);
  return db;
}

export type ApiRole = 'anon' | 'authenticated' | 'service_role';

/** Runs a statement like a PostgREST request: its own transaction, an API role and the JWT subject. */
export async function callAs<T = Record<string, unknown>>(
  db: PGlite,
  role: ApiRole,
  userId: string | null,
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  return db.transaction(async (tx) => {
    await tx.query("select set_config('role', $1, true), set_config('request.jwt.claim.sub', $2, true)", [
      role,
      userId ?? ''
    ]);
    return (await tx.query<T>(sql, params)).rows;
  });
}

/** Single-value call: `select public.fn(...) as value`. */
export async function rpc<T>(db: PGlite, userId: string | null, call: string, params: unknown[] = []): Promise<T> {
  const role: ApiRole = userId ? 'authenticated' : 'anon';
  const [row] = await callAs<{ value: T }>(db, role, userId, `select ${call} as value`, params);
  return row.value;
}

export async function createUser(
  db: PGlite,
  fields: { isAnonymous?: boolean; createdAt?: string } = {}
): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    'insert into auth.users (is_anonymous, created_at) values ($1, coalesce($2::timestamptz, now())) returning id',
    [fields.isAnonymous ?? true, fields.createdAt ?? null]
  );
  return rows[0].id;
}

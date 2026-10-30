-- Seats, never Presence, decide who may join a private room:<CODE> channel. Disable "Allow public access"
-- in Realtime settings too. Realtime evaluates these policies on channel authorization, not each message.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table public.room_seats (
  code text not null check (code ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$'),
  seat smallint not null check (seat in (1, 2)),
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (code, seat),
  unique (code, user_id),
  unique (user_id)
);
create index room_seats_joined_at_idx on public.room_seats (joined_at);

-- Leaving a room must not reset its creation limit. Keep only the ten timestamps needed for a rolling
-- hour, without codes or a room history; the hourly job removes stale quota rows as well.
create table public.room_create_quota (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz[] not null check (cardinality(created_at) between 1 and 10)
);
alter table public.room_seats enable row level security;
alter table public.room_create_quota enable row level security;
revoke all on public.room_seats, public.room_create_quota from public, anon, authenticated, service_role;

-- Also handles account deletion and expiry: a guest must never outlive the host's seat.
create function public.close_room_after_host_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.seat = 1 then
    delete from public.room_seats s where s.code = old.code;
  end if;
  return old;
end;
$$;
create trigger room_seats_host_deleted
after delete on public.room_seats
for each row execute function public.close_room_after_host_delete();

create function public.create_room()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_user();
  v_previous_code text;
  v_code text;
  v_bytes bytea;
  v_lock integer;
  v_created_at timestamptz[];
begin
  -- Separate advisory namespaces for users and rooms. Every RPC locks its user first and room hashes
  -- in numeric order, including both old and new rooms, so concurrent swaps cannot deadlock each other.
  perform pg_catalog.pg_advisory_xact_lock(726001, pg_catalog.hashtext(v_uid::text));
  if not exists (select 1 from public.profiles p where p.id = v_uid) then
    raise exception 'profile_required';
  end if;
  select coalesce(pg_catalog.array_agg(t.created_at order by t.created_at), '{}'::timestamptz[])
  into v_created_at
  from public.room_create_quota q
  cross join lateral pg_catalog.unnest(q.created_at) as t(created_at)
  where q.user_id = v_uid and t.created_at > now() - interval '1 hour';
  if pg_catalog.cardinality(v_created_at) >= 10 then
    raise exception 'rate_limited';
  end if;
  select s.code into v_previous_code from public.room_seats s where s.user_id = v_uid;

  loop
    -- The alphabet has exactly 32 symbols, so byte % 32 is uniform. The exception block releases the
    -- candidate's locks on collision before retrying; no failed attempt consumes quota or the old seat.
    begin
      v_bytes := extensions.gen_random_bytes(6);
      v_code := '';
      for i in 0..5 loop
        v_code := v_code || pg_catalog.substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
          pg_catalog.get_byte(v_bytes, i) % 32 + 1, 1);
      end loop;
      for v_lock in
        select distinct pg_catalog.hashtext(c.code)
        from pg_catalog.unnest(array[v_previous_code, v_code]) as c(code)
        where c.code is not null
        order by 1
      loop
        perform pg_catalog.pg_advisory_xact_lock(726002, v_lock);
      end loop;
      if exists (select 1 from public.room_seats s where s.code = v_code) then
        raise unique_violation;
      end if;
      delete from public.room_seats s where s.user_id = v_uid;
      insert into public.room_seats (code, seat, user_id) values (v_code, 1, v_uid);
      exit;
    exception when unique_violation then
      null;
    end;
  end loop;

  insert into public.room_create_quota (user_id, created_at)
  values (v_uid, pg_catalog.array_append(v_created_at, now()))
  on conflict (user_id) do update set created_at = excluded.created_at;
  return pg_catalog.jsonb_build_object('code', v_code, 'seat', 1);
end;
$$;

create function public.join_room(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_user();
  v_previous_code text;
  v_seat smallint;
  v_lock integer;
begin
  if p_code is null or p_code !~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$' then
    raise exception 'invalid_code';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(726001, pg_catalog.hashtext(v_uid::text));
  if not exists (select 1 from public.profiles p where p.id = v_uid) then
    raise exception 'profile_required';
  end if;
  select s.code into v_previous_code from public.room_seats s where s.user_id = v_uid;
  for v_lock in
    select distinct pg_catalog.hashtext(c.code)
    from pg_catalog.unnest(array[v_previous_code, p_code]) as c(code)
    where c.code is not null
    order by 1
  loop
    perform pg_catalog.pg_advisory_xact_lock(726002, v_lock);
  end loop;

  -- The row lock also serializes against deletion via auth.users CASCADE and the expiry job, whose
  -- callers do not take our advisory locks. The host-deletion trigger removes any admitted guest.
  perform 1 from public.room_seats s where s.code = p_code and s.seat = 1 for update;
  if not found then
    raise exception 'room_not_found';
  end if;
  select s.seat into v_seat from public.room_seats s where s.code = p_code and s.user_id = v_uid;
  if found then
    return pg_catalog.jsonb_build_object('code', p_code, 'seat', v_seat);
  end if;
  if exists (select 1 from public.room_seats s where s.code = p_code and s.seat = 2) then
    raise exception 'room_full';
  end if;
  delete from public.room_seats s where s.user_id = v_uid;
  insert into public.room_seats (code, seat, user_id) values (p_code, 2, v_uid);
  return pg_catalog.jsonb_build_object('code', p_code, 'seat', 2);
end;
$$;

create function public.leave_room(p_code text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_user();
begin
  if p_code is null or p_code !~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$' then
    raise exception 'invalid_code';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(726001, pg_catalog.hashtext(v_uid::text));
  perform pg_catalog.pg_advisory_xact_lock(726002, pg_catalog.hashtext(p_code));
  delete from public.room_seats s where s.code = p_code and s.user_id = v_uid;
end;
$$;

create function public.is_room_member(p_topic text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(p_topic ~ '^room:[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$', false)
    and exists (
      select 1 from public.room_seats s
      where s.code = pg_catalog.substr(p_topic, 6) and s.user_id = auth.uid()
    )
$$;

create policy "prgb rooms: seated players receive"
on realtime.messages
for select
to authenticated
using (
  (select public.is_room_member(realtime.topic()))
  and realtime.messages.extension in ('broadcast', 'presence')
);

create policy "prgb rooms: seated players send"
on realtime.messages
for insert
to authenticated
with check (
  (select public.is_room_member(realtime.topic()))
  and realtime.messages.extension in ('broadcast', 'presence')
);

create function public.purge_expired_room_seats()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.room_seats s where s.joined_at < now() - interval '6 hours';
  delete from public.room_create_quota q
  where not exists (
    select 1 from pg_catalog.unnest(q.created_at) as t(created_at)
    where t.created_at > now() - interval '1 hour'
  );
end;
$$;

revoke all on function public.close_room_after_host_delete(), public.create_room(), public.join_room(text),
  public.leave_room(text), public.is_room_member(text), public.purge_expired_room_seats()
from public, anon, authenticated, service_role;
grant execute on function public.create_room(), public.join_room(text), public.leave_room(text),
  public.is_room_member(text) to authenticated;

create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('prgb-room-seats', '0 * * * *', $$select public.purge_expired_room_seats()$$);

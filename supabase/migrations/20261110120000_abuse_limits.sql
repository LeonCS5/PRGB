-- Hourly limits for the authenticated RPCs that had none (create_profile, update_nickname, join_room,
-- export_my_data), the same way create_room / start_session / register-part already have, plus the cleanup
-- of the pg_cron run history. Error codes the app maps are untouched: rate_limited is only added.
--   * create_profile 5/h, update_nickname 10/h, join_room 30/h (seat changes, not reconnections),
--     export_my_data 10/h per player and clock hour;
--   * submit_feedback (anonymous) also refuses the same text sent more than 3 times in an hour;
--   * rpc_quota rows are deleted after 1 day, cron.job_run_details after 30 days.
-- Only calls that succeed count: an RPC that raises rolls back its own quota row, as with create_room.

create extension if not exists pg_cron with schema pg_catalog;

-- Calls per player, RPC and clock hour. No codes, nicknames or any content: only counters (LGPD).
create table public.rpc_quota (
  user_id uuid not null references auth.users (id) on delete cascade,
  action text not null check (action in ('create_profile', 'update_nickname', 'join_room', 'export_my_data')),
  window_start timestamptz not null,
  used integer not null check (used > 0),
  primary key (user_id, action, window_start)
);
alter table public.rpc_quota enable row level security;
revoke all on table public.rpc_quota from public, anon, authenticated, service_role;

-- The upsert counts atomically (the row lock serializes concurrent calls), so the limit cannot be passed.
-- Raising undoes the count, so the player stays exactly at the limit.
create function public.consume_rpc_quota(p_user_id uuid, p_action text, p_limit integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_used integer;
begin
  insert into public.rpc_quota as q (user_id, action, window_start, used)
  values (p_user_id, p_action, pg_catalog.date_trunc('hour', now()), 1)
  on conflict (user_id, action, window_start) do update set used = q.used + 1
  returning q.used into v_used;
  if v_used > p_limit then
    raise exception 'rate_limited';
  end if;
exception
  when foreign_key_violation then
    -- Valid token for an account that no longer exists
    raise exception 'not_authenticated';
end;
$$;

create function public.purge_expired_rpc_quota()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.rpc_quota q where q.window_start < now() - interval '1 day';
$$;

-- The history only helps while debugging a recent job
create function public.purge_cron_history()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from cron.job_run_details d where coalesce(d.end_time, d.start_time) < now() - interval '30 days';
$$;

-- create_profile: the count goes after the insert, so every existing error keeps its precedence
create or replace function public.create_profile(
  p_nickname text,
  p_age_confirmed boolean,
  p_consent boolean,
  p_consent_version text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_user();
  v_nickname text := public.clean_nickname(p_nickname);
  v_constraint text;
begin
  -- Age (18+, self-declared) and consent must both be explicit, and the accepted text version recorded
  if p_age_confirmed is not true or p_consent is not true
    or coalesce(p_consent_version, '') !~ '^[0-9A-Za-z._-]{1,32}$' then
    raise exception 'consent_required';
  end if;
  if exists (select 1 from public.profiles p where p.id = v_uid) then
    raise exception 'profile_exists';
  end if;
  perform public.assert_nickname_allowed(v_nickname, v_uid);

  begin
    insert into public.profiles (id, nickname, nickname_key, age_confirmed_at, consent_at, consent_version)
    values (v_uid, v_nickname, public.nickname_key(v_nickname), now(), now(), p_consent_version);
  exception
    when unique_violation then
      -- Lost a race with a concurrent request
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'profiles_pkey' then
        raise exception 'profile_exists';
      end if;
      raise exception 'nickname_taken';
    when foreign_key_violation then
      -- Valid token for an account that no longer exists
      raise exception 'not_authenticated';
  end;

  perform public.consume_rpc_quota(v_uid, 'create_profile', 5);
  return public.profile_json(v_uid);
end;
$$;

create or replace function public.update_nickname(p_nickname text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_user();
  v_nickname text := public.clean_nickname(p_nickname);
begin
  if not exists (select 1 from public.profiles p where p.id = v_uid) then
    raise exception 'profile_required';
  end if;
  perform public.assert_nickname_allowed(v_nickname, v_uid);

  begin
    update public.profiles
    set nickname = v_nickname, nickname_key = public.nickname_key(v_nickname), last_seen_at = now()
    where id = v_uid;
  exception
    when unique_violation then
      raise exception 'nickname_taken';
  end;

  perform public.consume_rpc_quota(v_uid, 'update_nickname', 10);
  return public.profile_json(v_uid);
end;
$$;

-- join_room: reconnecting to the room the player already sits in returns before the count; only a seat
-- change consumes quota, after every existing check (room_not_found, room_full) has passed.
create or replace function public.join_room(p_code text)
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
  perform public.consume_rpc_quota(v_uid, 'join_room', 30);
  delete from public.room_seats s where s.user_id = v_uid;
  insert into public.room_seats (code, seat, user_id) values (p_code, 2, v_uid);
  return pg_catalog.jsonb_build_object('code', p_code, 'seat', 2);
end;
$$;

-- export_my_data: the previous body, now volatile (it writes the count) and with the player's own
-- rpc_quota rows added, like the other quota tables.
create or replace function public.export_my_data()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_user();
begin
  perform public.consume_rpc_quota(v_uid, 'export_my_data', 10);
  return jsonb_build_object(
    'exported_at', now(),
    'account', (
      select jsonb_build_object('id', u.id, 'created_at', u.created_at, 'is_anonymous', u.is_anonymous)
      from auth.users u
      where u.id = v_uid
    ),
    'profile', (
      select jsonb_build_object(
        'nickname', p.nickname,
        'age_confirmed_at', p.age_confirmed_at,
        'consent_at', p.consent_at,
        'consent_version', p.consent_version,
        'created_at', p.created_at,
        'last_seen_at', p.last_seen_at
      )
      from public.profiles p
      where p.id = v_uid
    ),
    'scores_best', coalesce((
      select jsonb_agg(jsonb_build_object(
        'song_id', b.song_id, 'part_id', b.part_id,
        'title', s.title, 'artist', s.artist, 'track_name', s.track_name,
        'score', b.score, 'accuracy', b.accuracy, 'max_combo', b.max_combo,
        'perfect', b.perfect, 'good', b.good, 'miss', b.miss, 'achieved_at', b.achieved_at
      ) order by b.achieved_at)
      from public.scores_best b
      join public.song_parts s on s.song_id = b.song_id and s.part_id = b.part_id
      where b.user_id = v_uid
    ), '[]'::jsonb),
    'scores_weekly', coalesce((
      select jsonb_agg(jsonb_build_object(
        'song_id', w.song_id, 'part_id', w.part_id, 'week_start', w.week_start,
        'title', s.title, 'artist', s.artist, 'track_name', s.track_name,
        'score', w.score, 'accuracy', w.accuracy, 'max_combo', w.max_combo,
        'perfect', w.perfect, 'good', w.good, 'miss', w.miss, 'achieved_at', w.achieved_at
      ) order by w.week_start, w.achieved_at)
      from public.scores_weekly w
      join public.song_parts s on s.song_id = w.song_id and s.part_id = w.part_id
      where w.user_id = v_uid
    ), '[]'::jsonb),
    'play_sessions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'song_id', ps.song_id, 'part_id', ps.part_id, 'revision_id', ps.revision_id,
        'started_at', ps.started_at, 'submitted_at', ps.submitted_at
      ) order by ps.started_at)
      from public.play_sessions ps
      where ps.user_id = v_uid
    ), '[]'::jsonb),
    'registered_parts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'song_id', sp.song_id, 'part_id', sp.part_id,
        'title', sp.title, 'track_name', sp.track_name, 'registered_at', sp.registered_at
      ) order by sp.registered_at)
      from public.song_parts sp
      where sp.registered_by = v_uid
    ), '[]'::jsonb),
    'register_part_quota', coalesce((
      select jsonb_agg(jsonb_build_object('window_start', q.window_start, 'used', q.used) order by q.window_start)
      from public.register_part_quota q
      where q.user_id = v_uid
    ), '[]'::jsonb),
    'room_seats', coalesce((
      select jsonb_agg(jsonb_build_object('code', s.code, 'seat', s.seat, 'joined_at', s.joined_at)
        order by s.joined_at)
      from public.room_seats s
      where s.user_id = v_uid
    ), '[]'::jsonb),
    'room_create_quota', coalesce((
      select to_jsonb(q.created_at) from public.room_create_quota q where q.user_id = v_uid
    ), '[]'::jsonb),
    'rpc_quota', coalesce((
      select jsonb_agg(jsonb_build_object('action', r.action, 'window_start', r.window_start, 'used', r.used)
        order by r.window_start, r.action)
      from public.rpc_quota r
      where r.user_id = v_uid
    ), '[]'::jsonb)
  );
end;
$$;

-- submit_feedback: besides the global 60/hour, the same text (ignoring case, spaces, digits and punctuation)
-- is accepted at most 3 times an hour, so a script repeating one message cannot fill the box alone.
-- It compares against the reports already stored (at most 60 an hour), so nothing new is kept.
create or replace function public.submit_feedback(p_category text, p_screen text, p_message text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_message text := btrim(p_message, E' \t\r\n');
begin
  if p_category is null or p_category not in ('audio', 'notas', 'musica', 'ranking', 'sugestao', 'outro')
    or p_screen is null or p_screen not in ('inicio', 'play_free', 'jogo', 'sala')
    or v_message is null or char_length(v_message) not between 10 and 1000 then
    raise exception 'invalid_input';
  end if;

  -- With no account to count by, the limit is for everybody: a flood fills it, not the database. The app
  -- offers the contact e-mail when a report can't be sent.
  if (
    select count(*) from public.feedback f where f.created_at > now() - interval '1 hour'
  ) >= 60 then
    raise exception 'rate_limited';
  end if;

  if (
    select count(*) from public.feedback f
    where f.created_at > now() - interval '1 hour'
      and pg_catalog.regexp_replace(pg_catalog.lower(f.message), '[^[:alpha:]]+', '', 'g')
        = pg_catalog.regexp_replace(pg_catalog.lower(v_message), '[^[:alpha:]]+', '', 'g')
  ) >= 3 then
    raise exception 'rate_limited';
  end if;

  insert into public.feedback (category, screen, message) values (p_category, p_screen, v_message);
end;
$$;

revoke all on function public.consume_rpc_quota(uuid, text, integer), public.purge_expired_rpc_quota(),
  public.purge_cron_history()
from public, anon, authenticated, service_role;

-- create or replace keeps the grants of the existing functions; stated again so the file stands alone
revoke all on function public.create_profile(text, boolean, boolean, text), public.update_nickname(text),
  public.export_my_data(), public.join_room(text), public.submit_feedback(text, text, text)
from public, anon, authenticated;
grant execute on function public.create_profile(text, boolean, boolean, text), public.update_nickname(text),
  public.export_my_data(), public.join_room(text) to authenticated;
grant execute on function public.submit_feedback(text, text, text) to anon, authenticated;

-- 06:37 and 06:47 UTC = 03:37 and 03:47 in Brasília. Scheduling an existing job name updates it, so this is
-- safe to rerun.
select cron.schedule('prgb-rpc-quota-retention', '37 6 * * *', $$select public.purge_expired_rpc_quota()$$);
select cron.schedule('prgb-cron-history-retention', '47 6 * * *', $$select public.purge_cron_history()$$);

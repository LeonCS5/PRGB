-- PRGB online ranking: profiles, registered song parts, play sessions and scores.
--
-- Privacy (LGPD): the personal data in these tables is the nickname, the pseudonymous id of the Supabase
-- anonymous account (created only after the player consents) and the consent/activity timestamps. No
-- e-mail, real name, IP address or location is stored in our tables. Supabase Auth itself keeps session
-- metadata (IP address, user agent) in the auth schema, deleted together with the account; the provider's
-- own audit logs follow the provider's retention. Players can export, correct and delete their data through
-- the functions below; retention runs in the separate _retention migration.
--
-- Access: clients never touch the tables. RLS is enabled on all of them without policies (deny all) and
-- every table privilege is revoked from anon and authenticated. Everything goes through security definer
-- functions that pin search_path to '' and qualify every name. The only public read is the leaderboard:
-- nicknames and numbers, never user ids.
--
-- Anti-cheat: the score is computed in the browser, so it can be forged. submit_score only accepts a result
-- that fits the song part as counted on the server (register-part Edge Function) and a session that lasted
-- at least 90% of the song. The server can only enforce that minimum time: the app locks ranked runs to 1x
-- speed and disables seeking.
--
-- Errors are raised as stable snake_case codes in the message (raise exception 'nickname_taken'), which the
-- app maps in src/services/backend/rankingApi.ts.

-- Nickname rules: the same as src/services/nickname.ts (validateNickname, foldForModeration,
-- containsBlockedTerm). The rules are code in both places, change them together; the word lists are the
-- tables blocked_terms, moderation_allowlist and moderation_confusables. db-tests/ranking.test.ts runs the
-- app's cases here.

-- normalizeNickname: NFC, whitespace runs collapsed to one space, trimmed
create function public.clean_nickname(p_nickname text)
returns text
language sql
immutable
set search_path = ''
as $$
  select btrim(regexp_replace(normalize(coalesce(p_nickname, ''), nfc), '[[:space:]]+', ' ', 'g'))
$$;

-- 3 to 20 code points of A-Z, a-z and U+00C0-U+017F (Latin-1 and Latin Extended-A letters, without the
-- signs U+00D7 and U+00F7), ASCII digits, _ - . and single spaces between words; only the normalized form
-- passes. Other scripts and Latin Extended-B are refused, which keeps out look-alike letters (Cyrillic "a",
-- U+0192 "f", the click letters U+01C0-U+01C3) and invisible fillers (Hangul). The class is explicit so it
-- does not depend on the database locale.
create function public.is_valid_nickname(p_nickname text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_nickname is not null
    and p_nickname is nfc normalized
    and char_length(p_nickname) between 3 and 20
    and p_nickname ~ '^[A-Za-zÀ-ÖØ-öø-ſ0-9_.-]+( [A-Za-zÀ-ÖØ-öø-ſ0-9_.-]+)*$'
$$;

-- Shared start of the moderation fold and of nickname_key: NFKD, lowercase, combining marks removed (accents;
-- styled letters such as math bold or full-width "a" become "a"), then the look-alike letters NFKD leaves
-- alone mapped by moderation_confusables (dotless i -> i, o with stroke -> o, ae -> ae). Postgres has no
-- \p{M}, so the combining mark blocks are listed.
create function public.moderation_base(p_text text)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_text text := regexp_replace(lower(normalize(coalesce(p_text, ''), nfkd)),
    '[\u0300-\u036f\u1ab0-\u1aff\u1dc0-\u1dff\u20d0-\u20ff\ufe20-\ufe2f]', '', 'g');
  v_pair record;
begin
  for v_pair in select c.src, c.dst from public.moderation_confusables c loop
    v_text := replace(v_text, v_pair.src, v_pair.dst);
  end loop;
  return v_text;
end;
$$;

-- Uniqueness key of a nickname: moderation_base with whitespace collapsed, so "Joao", "João" and "JOÃO"
-- (or "Olsen" and "Ølsen") are the same nickname. Kept in profiles.nickname_key by the RPCs.
create function public.nickname_key(p_nickname text)
returns text
language sql
stable
set search_path = ''
as $$
  select btrim(regexp_replace(public.moderation_base(p_nickname), '[[:space:]]+', ' ', 'g'))
$$;

-- foldForModeration: camelCase split first (a lowercase letter followed by an uppercase one gets a space:
-- "FilhoDaPuta" -> "Filho Da Puta"; digits stay glued, they may be leetspeak), then moderation_base,
-- leetspeak, every run of non-letters becomes one space, consecutive one-letter words joined ("p.u.t.a" ->
-- "puta"), repeated letters collapsed ("fuuuck" -> "fuck"). [[:lower:]], [[:upper:]] and [[:alpha:]] stand
-- for \p{Ll}, \p{Lu} and \p{L} and follow the database locale, like lower() (UTF-8 on Supabase); kra and
-- n-apostrophe (U+0138, U+0149) are lowercase letters without an uppercase form that the locale does not
-- count as [[:lower:]].
create function public.fold_for_moderation(p_text text)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_piece text;
  v_spelled text := '';
  v_words text[] := '{}';
begin
  foreach v_piece in array regexp_split_to_array(
    translate(
      public.moderation_base(
        regexp_replace(coalesce(p_text, ''), '([[:lower:]\u0138\u0149])([[:upper:]])', '\1 \2', 'g')),
      '013457@$', 'oieastas'),
    '[^[:alpha:]]+')
  loop
    continue when v_piece = '';
    if char_length(v_piece) = 1 then
      v_spelled := v_spelled || v_piece;
      continue;
    end if;
    if v_spelled <> '' then
      v_words := v_words || v_spelled;
    end if;
    v_spelled := '';
    v_words := v_words || v_piece;
  end loop;
  if v_spelled <> '' then
    v_words := v_words || v_spelled;
  end if;
  return regexp_replace(array_to_string(v_words, ' '), '([[:alpha:]])\1+', '\1', 'g');
end;
$$;

-- Tables -----------------------------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null constraint profiles_nickname_valid check (public.is_valid_nickname(nickname)),
  -- public.nickname_key(nickname), written by the RPCs (not a generated column: it reads a table)
  nickname_key text not null constraint profiles_nickname_key_not_blank check (nickname_key <> ''),
  age_confirmed_at timestamptz not null,
  consent_at timestamptz not null,
  consent_version text not null constraint profiles_consent_version_valid
    check (consent_version ~ '^[0-9A-Za-z._-]{1,32}$'),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create unique index profiles_nickname_key on public.profiles (nickname_key);

-- Moderation lists are data, so syncing them with the app only changes rows.

-- Look-alike letters that NFKD leaves alone, mapped after lowercase (moderation_base)
create table public.moderation_confusables (
  src text primary key constraint moderation_confusables_src check (char_length(src) = 1),
  dst text not null constraint moderation_confusables_dst check (dst ~ '^[a-z]+$')
);

insert into public.moderation_confusables (src, dst) values
  ('ı', 'i'), ('ĸ', 'k'), ('ł', 'l'), ('ħ', 'h'), ('ŧ', 't'), ('đ', 'd'), ('ð', 'd'), ('ŋ', 'n'),
  ('œ', 'oe'), ('æ', 'ae'), ('ø', 'o'), ('þ', 'th'), ('ß', 'ss');

-- Terms and fragments are stored folded (lowercase ASCII, no repeated letters; some terms are stems).
-- mode 'word': whole word only ("cunt" must not block "Scunthorpe"); 'part': also inside a word ("caralh"
-- blocks "caralhada").
create table public.blocked_terms (
  term text primary key constraint blocked_terms_folded
    check (term ~ '^[a-z]+$' and public.fold_for_moderation(term) = term),
  mode text not null constraint blocked_terms_mode check (mode in ('word', 'part'))
);

-- Fragments erased from the folded text before matching, one at a time in `position` order, so everyday
-- words and names that hold a 'part' term pass ("computador" stops holding "puta")
create table public.moderation_allowlist (
  fragment text primary key constraint moderation_allowlist_folded
    check (fragment ~ '^[a-z]+$' and public.fold_for_moderation(fragment) = fragment),
  position smallint not null unique
);

-- The seeds are BLOCKED_TERMS, MODERATION_ALLOWLIST and MODERATION_CONFUSABLES of src/services/nickname.ts;
-- db-tests/ranking.test.ts compares them.
insert into public.blocked_terms (term, mode)
select t.term, 'part' from unnest(array[
  -- Pretending to be the PRGB team
  'admin', 'moderador', 'moderator', 'moderacao', 'suporte', 'prgb',
  -- Profanity and sexual terms (pt-BR)
  'puta', 'putinh', 'cuzao', 'cuzinh', 'foda', 'merd', 'bosta', 'caralh', 'bucet', 'bocet', 'xoxota', 'xereca',
  'piroca', 'punhet', 'boquete', 'vagabunda', 'prostitut', 'arombad',
  -- Profanity and sexual terms (English)
  'fuck', 'shit', 'bitch', 'whore', 'ashole', 'dickhead', 'porn', 'dildo',
  -- Homophobic and transphobic slurs
  'viadinh', 'viadao', 'boiola', 'baitola', 'traveco',
  -- Racist slurs and hate
  'nazi', 'hitler',
  -- Ableist slurs
  'retardad', 'retarded', 'mongoloide',
  -- Sexual violence
  'estupr', 'pedofil'
]) as t(term)
union all
select t.term, 'word' from unnest(array[
  'staf', -- "Gustaf"
  'cu', 'vadia', 'fdp', 'pqp', 'vsf', 'vtnc', -- "Curitiba", "vadiar"
  'cunt', 'slut', 'twat', 'anal', -- "Scunthorpe", "Analice", "Canal"
  'viado', 'bicha', 'fag', 'fagot', -- "Desviado", "Bichano", "Fagundes", "Fagote"
  'niger', 'niga', 'chink', 'spic' -- "Nigéria", "Spice Girls"
]) as t(term);

insert into public.moderation_allowlist (position, fragment) values
  (1, 'computa'), (2, 'deputa'), (3, 'diputa'), (4, 'disputa'), (5, 'reputa'), (6, 'imputa'), (7, 'amputa'),
  (8, 'badminton'), (9, 'bostaph'), (10, 'shitake'), (11, 'nazir'), (12, 'nazim');

-- One row per Songsterr track that can be ranked, counted on the server by the register-part Edge Function
-- for the tab revision in revision_id. When Songsterr publishes a new revision the function recounts and
-- updates the row in place; sessions keep a copy of the numbers they started with (see play_sessions), so
-- a recount never changes how an open session is checked. Scores of all revisions share one leaderboard.
create table public.song_parts (
  song_id integer not null,
  part_id integer not null,
  revision_id bigint not null check (revision_id >= 0),
  title text not null,
  artist text not null,
  track_name text not null,
  scorable_notes integer not null check (scorable_notes >= 0),
  duration_ms integer not null check (duration_ms > 0),
  max_score integer not null check (max_score >= 0),
  registered_by uuid references auth.users (id) on delete set null,
  registered_at timestamptz not null default now(),
  primary key (song_id, part_id)
);

create index song_parts_registered_by_idx on public.song_parts (registered_by, registered_at)
  where registered_by is not null;

-- Offline demo (src/services/demoSong.ts, getDemoSong()). A test checks these numbers against the app.
insert into public.song_parts (
  song_id, part_id, revision_id, title, artist, track_name, scorable_notes, duration_ms, max_score
) values (-1, 0, 0, 'Pentatônica em Lá menor', 'Exercício PRGB', 'Exercício', 41, 18667, 20100);

-- revision_id and the numbers are copied from song_parts when the session starts
create table public.play_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  song_id integer not null,
  part_id integer not null,
  revision_id bigint not null,
  scorable_notes integer not null,
  duration_ms integer not null,
  max_score integer not null,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  foreign key (song_id, part_id) references public.song_parts (song_id, part_id) on delete cascade
);

create index play_sessions_user_started_idx on public.play_sessions (user_id, started_at);

create table public.scores_best (
  user_id uuid not null references public.profiles (id) on delete cascade,
  song_id integer not null,
  part_id integer not null,
  score integer not null check (score >= 0),
  accuracy smallint not null check (accuracy between 0 and 100),
  max_combo integer not null check (max_combo >= 0),
  perfect integer not null check (perfect >= 0),
  good integer not null check (good >= 0),
  miss integer not null check (miss >= 0),
  achieved_at timestamptz not null default now(),
  primary key (user_id, song_id, part_id),
  foreign key (song_id, part_id) references public.song_parts (song_id, part_id) on delete cascade
);

create index scores_best_board_idx on public.scores_best (song_id, part_id, score desc, achieved_at);

-- Weeks start on Monday, Brasília time (see current_week_start)
create table public.scores_weekly (
  user_id uuid not null references public.profiles (id) on delete cascade,
  song_id integer not null,
  part_id integer not null,
  week_start date not null,
  score integer not null check (score >= 0),
  accuracy smallint not null check (accuracy between 0 and 100),
  max_combo integer not null check (max_combo >= 0),
  perfect integer not null check (perfect >= 0),
  good integer not null check (good >= 0),
  miss integer not null check (miss >= 0),
  achieved_at timestamptz not null default now(),
  primary key (user_id, song_id, part_id, week_start),
  foreign key (song_id, part_id) references public.song_parts (song_id, part_id) on delete cascade
);

create index scores_weekly_board_idx on public.scores_weekly (song_id, part_id, week_start, score desc, achieved_at);

-- Table access -----------------------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.blocked_terms enable row level security;
alter table public.moderation_allowlist enable row level security;
alter table public.moderation_confusables enable row level security;
alter table public.song_parts enable row level security;
alter table public.play_sessions enable row level security;
alter table public.scores_best enable row level security;
alter table public.scores_weekly enable row level security;

-- Supabase grants new tables to the API roles by default; the app only reaches them through the functions
revoke all on table
  public.profiles, public.blocked_terms, public.moderation_allowlist, public.moderation_confusables,
  public.song_parts, public.play_sessions,
  public.scores_best, public.scores_weekly
from public, anon, authenticated;

-- The register-part Edge Function runs with the service role (bypasses RLS): it checks that the caller has
-- a profile and registers or recounts song parts. Explicit so it does not rely on Supabase's defaults.
grant select on table public.profiles to service_role;
grant select, insert, update on table public.song_parts to service_role;

-- Internal helpers -------------------------------------------------------------------------------------

create function public.current_week_start()
returns date
language sql
stable
set search_path = ''
as $$
  select date_trunc('week', now() at time zone 'America/Sao_Paulo')::date
$$;

create function public.require_user()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  return v_uid;
end;
$$;

create function public.profile_json(p_user_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'nickname', p.nickname,
    'ageConfirmedAt', p.age_confirmed_at,
    'consentAt', p.consent_at,
    'consentVersion', p.consent_version,
    'createdAt', p.created_at,
    'lastSeenAt', p.last_seen_at
  )
  from public.profiles p
  where p.id = p_user_id
$$;

-- Folded text with the allowlisted fragments erased, one at a time in position order
create function public.strip_allowed_fragments(p_folded text)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_text text := coalesce(p_folded, '');
  v_fragment text;
begin
  for v_fragment in
    select a.fragment from public.moderation_allowlist a order by a.position
  loop
    v_text := replace(v_text, v_fragment, '');
  end loop;
  return v_text;
end;
$$;

-- hasBlockedTerm on folded text, after the allowlist
create function public.has_blocked_term(p_folded text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.blocked_terms b
    cross join (select public.strip_allowed_fragments(p_folded) as folded) t
    where case b.mode
      when 'word' then position(' ' || b.term || ' ' in ' ' || t.folded || ' ') > 0
      else position(b.term in t.folded) > 0
    end
  )
$$;

-- containsBlockedTerm: checked with digits read as leetspeak ("4dm1n") and with digits removed, because a
-- trailing number would otherwise glue a letter to a short term ("Admin1" folds to "admini"). Each is
-- folded as written (camelCase split: "FilhoDaPuta") and lowercased first (no split), since alternating
-- case would otherwise cut a term apart ("PuTa" splits into "pu ta").
-- Security invoker: only the RPCs below call it, already running as the table owner.
create function public.is_blocked_nickname(p_nickname text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from unnest(array[coalesce(p_nickname, ''), regexp_replace(coalesce(p_nickname, ''), '[0-9]', '', 'g')]) v(text)
    where public.has_blocked_term(public.fold_for_moderation(v.text))
      or public.has_blocked_term(public.fold_for_moderation(lower(v.text)))
  )
$$;

create function public.assert_nickname_allowed(p_nickname text, p_user_id uuid)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if not public.is_valid_nickname(p_nickname) then
    raise exception 'nickname_invalid';
  end if;
  if public.is_blocked_nickname(p_nickname) then
    raise exception 'nickname_blocked';
  end if;
  if exists (
    select 1 from public.profiles p where p.nickname_key = public.nickname_key(p_nickname) and p.id <> p_user_id
  ) then
    raise exception 'nickname_taken';
  end if;
end;
$$;

-- Profile (consent, rectification, export, deletion) ---------------------------------------------------

create function public.create_profile(
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

  return public.profile_json(v_uid);
end;
$$;

-- null when the account has no profile yet
create function public.get_my_profile()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return public.profile_json(public.require_user());
end;
$$;

create function public.update_nickname(p_nickname text)
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

  return public.profile_json(v_uid);
end;
$$;

-- Activity mark for the 12-month inactivity rule
create function public.touch_last_seen()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set last_seen_at = now() where id = public.require_user();
end;
$$;

-- Everything linked to the caller's pseudonymous id (LGPD access/portability), as stored (snake_case);
-- song titles are added for readability. Nothing about other players.
create function public.export_my_data()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_user();
begin
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
    ), '[]'::jsonb)
  );
end;
$$;

-- Deleting the auth user cascades to profiles, play_sessions, scores_best and scores_weekly, and clears
-- song_parts.registered_by. This needs the function owner (postgres on Supabase) to be allowed to delete
-- from auth.users, which is Supabase's default: verify it after deploying (see the deploy checklist).
create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from auth.users u where u.id = public.require_user();
end;
$$;

-- Ranked play ------------------------------------------------------------------------------------------

-- p_revision_id: the Songsterr revision of the tab the app loaded. When given and different from the one the
-- server counted, the run would be checked against other numbers, so it is refused (revision_mismatch): the
-- app should call register-part with its revision (which recounts) and start again.
create function public.start_session(p_song_id integer, p_part_id integer, p_revision_id bigint default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_user();
  v_part public.song_parts%rowtype;
  v_session_id uuid;
begin
  -- Locking the profile row serializes concurrent starts of the same player, so the hourly limit holds
  perform 1 from public.profiles p where p.id = v_uid for update;
  if not found then
    raise exception 'profile_required';
  end if;
  select * into v_part from public.song_parts s where s.song_id = p_song_id and s.part_id = p_part_id;
  if not found then
    raise exception 'part_unregistered';
  end if;
  if p_revision_id is not null and p_revision_id <> v_part.revision_id then
    raise exception 'revision_mismatch';
  end if;
  if (
    select count(*) from public.play_sessions ps
    where ps.user_id = v_uid and ps.started_at > now() - interval '1 hour'
  ) >= 60 then
    raise exception 'rate_limited';
  end if;

  insert into public.play_sessions (user_id, song_id, part_id, revision_id, scorable_notes, duration_ms, max_score)
  values (v_uid, p_song_id, p_part_id, v_part.revision_id, v_part.scorable_notes, v_part.duration_ms, v_part.max_score)
  returning id into v_session_id;
  update public.profiles set last_seen_at = now() where id = v_uid;
  return v_session_id;
end;
$$;

-- Returns {accepted, personalBest, weeklyBest, rankAll, rankWeek}; the ranks are those of the player's
-- current best (all time / this week), which may be an earlier run.
create function public.submit_score(
  p_session_id uuid,
  p_score integer,
  p_perfect integer,
  p_good integer,
  p_miss integer,
  p_max_combo integer,
  p_accuracy integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_user();
  v_week date := public.current_week_start();
  v_session public.play_sessions%rowtype;
  v_judged bigint;
  v_expected_accuracy integer;
  v_personal_best boolean;
  v_weekly_best boolean;
  v_best_score integer;
  v_week_score integer;
begin
  select * into v_session
  from public.play_sessions ps
  where ps.id = p_session_id and ps.user_id = v_uid
  for update;
  if not found then
    raise exception 'session_invalid';
  end if;
  if v_session.submitted_at is not null then
    raise exception 'already_submitted';
  end if;
  if now() - v_session.started_at > interval '2 hours' then
    raise exception 'session_expired';
  end if;

  -- The numbers are those of the revision the session started with (copied by start_session).
  -- Ranking only counts 1x speed: the session must have lasted at least 90% of the song
  if extract(epoch from now() - v_session.started_at) * 1000 < v_session.duration_ms * 0.9 then
    raise exception 'session_too_short';
  end if;

  -- Plausibility against the server's count of the song (rules in supabase/functions/_shared/scoreLimits.ts)
  if p_score is null or p_perfect is null or p_good is null or p_miss is null
    or p_max_combo is null or p_accuracy is null
    or least(p_score, p_perfect, p_good, p_miss, p_max_combo, p_accuracy) < 0
    or p_accuracy > 100 then
    raise exception 'score_implausible';
  end if;
  v_judged := p_perfect::bigint + p_good + p_miss;
  -- Same formula as the game; with nothing judged it shows 100%
  v_expected_accuracy := case
    when v_judged > 0 then round((p_perfect::numeric + p_good) * 100 / v_judged)
    else 100
  end;
  if v_judged > v_session.scorable_notes
    or p_max_combo > p_perfect::bigint + p_good
    or p_score > v_session.max_score
    or p_score > (p_perfect::bigint * 150 + p_good::bigint * 100) * 4
    or abs(p_accuracy - v_expected_accuracy) > 1 then
    raise exception 'score_implausible';
  end if;

  update public.play_sessions set submitted_at = now() where id = p_session_id;

  insert into public.scores_best as b (
    user_id, song_id, part_id, score, accuracy, max_combo, perfect, good, miss, achieved_at
  ) values (
    v_uid, v_session.song_id, v_session.part_id, p_score, p_accuracy, p_max_combo, p_perfect, p_good, p_miss, now()
  )
  on conflict (user_id, song_id, part_id) do update
    set score = excluded.score, accuracy = excluded.accuracy, max_combo = excluded.max_combo,
      perfect = excluded.perfect, good = excluded.good, miss = excluded.miss, achieved_at = excluded.achieved_at
    where excluded.score > b.score;
  v_personal_best := found;

  insert into public.scores_weekly as w (
    user_id, song_id, part_id, week_start, score, accuracy, max_combo, perfect, good, miss, achieved_at
  ) values (
    v_uid, v_session.song_id, v_session.part_id, v_week, p_score, p_accuracy, p_max_combo, p_perfect, p_good,
    p_miss, now()
  )
  on conflict (user_id, song_id, part_id, week_start) do update
    set score = excluded.score, accuracy = excluded.accuracy, max_combo = excluded.max_combo,
      perfect = excluded.perfect, good = excluded.good, miss = excluded.miss, achieved_at = excluded.achieved_at
    where excluded.score > w.score;
  v_weekly_best := found;

  select b.score into v_best_score
  from public.scores_best b
  where b.user_id = v_uid and b.song_id = v_session.song_id and b.part_id = v_session.part_id;
  select w.score into v_week_score
  from public.scores_weekly w
  where w.user_id = v_uid and w.song_id = v_session.song_id and w.part_id = v_session.part_id
    and w.week_start = v_week;

  return jsonb_build_object(
    'accepted', true,
    'personalBest', v_personal_best,
    'weeklyBest', v_weekly_best,
    'rankAll', 1 + (
      select count(*) from public.scores_best b
      where b.song_id = v_session.song_id and b.part_id = v_session.part_id and b.score > v_best_score
    ),
    'rankWeek', 1 + (
      select count(*) from public.scores_weekly w
      where w.song_id = v_session.song_id and w.part_id = v_session.part_id and w.week_start = v_week
        and w.score > v_week_score
    )
  );
end;
$$;

-- Leaderboard ------------------------------------------------------------------------------------------

-- Equal scores share a rank; within a rank the earlier result is listed first. period: 'all' | 'week'.
create function public.get_leaderboard(
  p_song_id integer,
  p_part_id integer,
  p_period text default 'all',
  p_limit integer default 50
)
returns table (
  rank bigint,
  nickname text,
  score integer,
  accuracy smallint,
  max_combo integer,
  achieved_at timestamptz,
  is_me boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
begin
  if coalesce(p_period, 'all') = 'all' then
    return query
      select rank() over (order by b.score desc), p.nickname, b.score, b.accuracy, b.max_combo, b.achieved_at,
        coalesce(b.user_id = v_uid, false)
      from public.scores_best b
      join public.profiles p on p.id = b.user_id
      where b.song_id = p_song_id and b.part_id = p_part_id
      order by b.score desc, b.achieved_at, p.nickname
      limit v_limit;
  elsif p_period = 'week' then
    return query
      select rank() over (order by w.score desc), p.nickname, w.score, w.accuracy, w.max_combo, w.achieved_at,
        coalesce(w.user_id = v_uid, false)
      from public.scores_weekly w
      join public.profiles p on p.id = w.user_id
      where w.song_id = p_song_id and w.part_id = p_part_id and w.week_start = public.current_week_start()
      order by w.score desc, w.achieved_at, p.nickname
      limit v_limit;
  else
    raise exception 'invalid_input';
  end if;
end;
$$;

-- The caller's own row (same shape as get_leaderboard), for when they are outside the top; empty if none
create function public.get_my_position(p_song_id integer, p_part_id integer, p_period text default 'all')
returns table (
  rank bigint,
  nickname text,
  score integer,
  accuracy smallint,
  max_combo integer,
  achieved_at timestamptz,
  is_me boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := public.require_user();
begin
  if coalesce(p_period, 'all') = 'all' then
    return query
      select 1 + (
          select count(*) from public.scores_best o
          where o.song_id = b.song_id and o.part_id = b.part_id and o.score > b.score
        ),
        p.nickname, b.score, b.accuracy, b.max_combo, b.achieved_at, true
      from public.scores_best b
      join public.profiles p on p.id = b.user_id
      where b.user_id = v_uid and b.song_id = p_song_id and b.part_id = p_part_id;
  elsif p_period = 'week' then
    return query
      select 1 + (
          select count(*) from public.scores_weekly o
          where o.song_id = w.song_id and o.part_id = w.part_id and o.week_start = w.week_start
            and o.score > w.score
        ),
        p.nickname, w.score, w.accuracy, w.max_combo, w.achieved_at, true
      from public.scores_weekly w
      join public.profiles p on p.id = w.user_id
      where w.user_id = v_uid and w.song_id = p_song_id and w.part_id = p_part_id
        and w.week_start = public.current_week_start();
  else
    raise exception 'invalid_input';
  end if;
end;
$$;

-- Clock reference for online rooms
create function public.server_time()
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  return clock_timestamp();
end;
$$;

-- Function access --------------------------------------------------------------------------------------

-- Supabase grants new functions to anon/authenticated by default, so revoke everything first
revoke all on function
  public.clean_nickname(text),
  public.is_valid_nickname(text),
  public.moderation_base(text),
  public.nickname_key(text),
  public.fold_for_moderation(text),
  public.strip_allowed_fragments(text),
  public.has_blocked_term(text),
  public.current_week_start(),
  public.require_user(),
  public.profile_json(uuid),
  public.is_blocked_nickname(text),
  public.assert_nickname_allowed(text, uuid),
  public.create_profile(text, boolean, boolean, text),
  public.get_my_profile(),
  public.update_nickname(text),
  public.touch_last_seen(),
  public.export_my_data(),
  public.delete_my_account(),
  public.start_session(integer, integer, bigint),
  public.submit_score(uuid, integer, integer, integer, integer, integer, integer),
  public.get_leaderboard(integer, integer, text, integer),
  public.get_my_position(integer, integer, text),
  public.server_time()
from public, anon, authenticated;

-- Signed-in players (Supabase anonymous accounts use the authenticated role)
grant execute on function
  public.create_profile(text, boolean, boolean, text),
  public.get_my_profile(),
  public.update_nickname(text),
  public.touch_last_seen(),
  public.export_my_data(),
  public.delete_my_account(),
  public.start_session(integer, integer, bigint),
  public.submit_score(uuid, integer, integer, integer, integer, integer, integer),
  public.get_my_position(integer, integer, text)
to authenticated;

-- Public reads
grant execute on function
  public.get_leaderboard(integer, integer, text, integer),
  public.server_time()
to anon, authenticated;

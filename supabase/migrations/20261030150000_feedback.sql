-- Problem reports from the app's feedback box. A report is anonymous on purpose: no account, IP or e-mail is
-- stored with it, so sending one takes neither a sign-in nor consent. Reports are read in the Supabase
-- dashboard and deleted after 180 days (LGPD).

create table public.feedback (
  id bigint generated always as identity primary key,
  category text not null check (category in ('audio', 'notas', 'musica', 'ranking', 'sugestao', 'outro')),
  screen text not null check (screen in ('inicio', 'play_free', 'jogo', 'sala')),
  message text not null check (char_length(message) between 10 and 1000),
  created_at timestamptz not null default now()
);

create index feedback_created_idx on public.feedback (created_at); -- hourly limit and retention purge

-- RLS with no policies, like the rest of the schema: the only way in is the function below
alter table public.feedback enable row level security;
revoke all on table public.feedback from public, anon, authenticated;

create function public.submit_feedback(p_category text, p_screen text, p_message text)
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

  insert into public.feedback (category, screen, message) values (p_category, p_screen, v_message);
end;
$$;

create function public.purge_expired_feedback()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.feedback f where f.created_at < now() - interval '180 days';
$$;

-- Supabase grants new functions to anon/authenticated by default, so revoke everything first
revoke all on function public.submit_feedback(text, text, text) from public, anon, authenticated;
revoke all on function public.purge_expired_feedback() from public, anon, authenticated;
grant execute on function public.submit_feedback(text, text, text) to anon, authenticated;

-- 06:27 UTC = 03:27 in Brasília. Scheduling an existing job name updates it, so this is safe to rerun.
select cron.schedule(
  'prgb-feedback-retention',
  '27 6 * * *',
  $$select public.purge_expired_feedback()$$
);

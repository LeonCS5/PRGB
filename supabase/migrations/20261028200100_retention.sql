-- Data retention for the online ranking (LGPD), run daily by pg_cron. Kept apart from the ranking
-- migration because it needs the pg_cron extension.
--   * accounts idle for 12 months are deleted (auth.users cascades to profile, sessions and scores);
--   * play sessions are kept 7 days, weekly scores 8 weeks;
--   * song_parts.registered_by (only used by the hourly registration limit) is cleared after 7 days.

create extension if not exists pg_cron with schema pg_catalog;

create function public.purge_expired_ranking_data()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_week date := public.current_week_start();
begin
  -- Activity is the profile's last_seen_at, or the sign-in time for accounts that never made a profile
  delete from auth.users u
  where u.is_anonymous
    and coalesce(
      (select p.last_seen_at from public.profiles p where p.id = u.id),
      greatest(u.created_at, u.last_sign_in_at)
    ) < now() - interval '12 months';

  -- A permanent (non-anonymous) account is not ours to delete, but its idle ranking profile is
  delete from public.profiles p where p.last_seen_at < now() - interval '12 months';

  delete from public.play_sessions ps where ps.started_at < now() - interval '7 days';

  -- Keeps the current week and the 8 before it
  delete from public.scores_weekly w where w.week_start < v_week - 56;

  update public.song_parts s set registered_by = null
  where s.registered_by is not null and s.registered_at < now() - interval '7 days';
end;
$$;

revoke all on function public.purge_expired_ranking_data() from public, anon, authenticated;

-- 06:17 UTC = 03:17 in Brasília. Scheduling an existing job name updates it, so this is safe to rerun.
select cron.schedule(
  'prgb-ranking-retention',
  '17 6 * * *',
  $$select public.purge_expired_ranking_data()$$
);

-- Data retention for the online ranking (LGPD), run daily by pg_cron. Kept apart from the ranking
-- migration because it needs the pg_cron extension.
--   * anonymous accounts that never created a profile (sign-up abandoned) are deleted after 2 days;
--   * accounts idle for 12 months are deleted (auth.users cascades to profile, sessions and scores);
--   * play sessions are kept 7 days, weekly scores 8 weeks;
--   * song_parts.registered_by is cleared after 7 days, register-part quota rows deleted after 1 day.
-- Each step runs on its own: a failure is logged as a warning and the other steps still run.

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
  begin
    delete from auth.users u
    where u.is_anonymous
      and not exists (select 1 from public.profiles p where p.id = u.id)
      and greatest(u.created_at, u.last_sign_in_at) < now() - interval '2 days';
  exception when others then
    raise warning 'purge_expired_ranking_data: accounts without profile: % (%)', sqlerrm, sqlstate;
  end;

  begin
    delete from auth.users u
    where u.is_anonymous
      and exists (
        select 1 from public.profiles p where p.id = u.id and p.last_seen_at < now() - interval '12 months'
      );
  exception when others then
    raise warning 'purge_expired_ranking_data: idle accounts: % (%)', sqlerrm, sqlstate;
  end;

  -- A permanent (non-anonymous) account is not ours to delete, but its idle ranking profile is
  begin
    delete from public.profiles p where p.last_seen_at < now() - interval '12 months';
  exception when others then
    raise warning 'purge_expired_ranking_data: idle profiles: % (%)', sqlerrm, sqlstate;
  end;

  begin
    delete from public.play_sessions ps where ps.started_at < now() - interval '7 days';
  exception when others then
    raise warning 'purge_expired_ranking_data: sessions: % (%)', sqlerrm, sqlstate;
  end;

  -- Keeps the current week and the 8 before it
  begin
    delete from public.scores_weekly w where w.week_start < v_week - 56;
  exception when others then
    raise warning 'purge_expired_ranking_data: weekly scores: % (%)', sqlerrm, sqlstate;
  end;

  begin
    update public.song_parts s set registered_by = null
    where s.registered_by is not null and s.registered_at < now() - interval '7 days';
  exception when others then
    raise warning 'purge_expired_ranking_data: song part registrations: % (%)', sqlerrm, sqlstate;
  end;

  -- The quota only matters within its hour
  begin
    delete from public.register_part_quota q where q.window_start < now() - interval '1 day';
  exception when others then
    raise warning 'purge_expired_ranking_data: register-part quota: % (%)', sqlerrm, sqlstate;
  end;
end;
$$;

revoke all on function public.purge_expired_ranking_data() from public, anon, authenticated;

-- 06:17 UTC = 03:17 in Brasília. Scheduling an existing job name updates it, so this is safe to rerun.
select cron.schedule(
  'prgb-ranking-retention',
  '17 6 * * *',
  $$select public.purge_expired_ranking_data()$$
);

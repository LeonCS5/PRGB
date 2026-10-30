-- Preserve the applied export verbatim and include the temporary room data.
create or replace function public.export_my_data()
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
    ), '[]'::jsonb)
  );
end;
$$;

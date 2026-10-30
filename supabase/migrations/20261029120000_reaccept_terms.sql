-- Re-acceptance of the terms: when the text changes the app asks again, and the new acceptance (18+ and
-- consent, with the version of the text) replaces the recorded one. Same rules and error codes as
-- create_profile: consent_required, profile_required, not_authenticated.

create function public.reaccept_terms(p_age_confirmed boolean, p_consent boolean, p_consent_version text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_user();
begin
  if p_age_confirmed is not true or p_consent is not true
    or coalesce(p_consent_version, '') !~ '^[0-9A-Za-z._-]{1,32}$' then
    raise exception 'consent_required';
  end if;

  update public.profiles
  set age_confirmed_at = now(), consent_at = now(), consent_version = p_consent_version, last_seen_at = now()
  where id = v_uid;
  if not found then
    raise exception 'profile_required';
  end if;

  return public.profile_json(v_uid);
end;
$$;

revoke all on function public.reaccept_terms(boolean, boolean, text) from public, anon, authenticated;
grant execute on function public.reaccept_terms(boolean, boolean, text) to authenticated;

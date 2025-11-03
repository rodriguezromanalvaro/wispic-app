-- Upsert profile location (coords + optional label/place/country) for a user
create or replace function public.set_profile_location(
  p_user uuid,
  p_lat double precision,
  p_lng double precision,
  p_label text default null,
  p_place_id text default null,
  p_country_code text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer := 0;
begin
  if auth.uid() is null or auth.uid() <> p_user then
    raise exception 'not allowed';
  end if;

  insert into public.profile_locations(user_id, lat, lng, city_label, place_id, country_code, updated_at)
  values(p_user, p_lat, p_lng, p_label, p_place_id, p_country_code, now())
  on conflict (user_id) do update set
    lat = excluded.lat,
    lng = excluded.lng,
    city_label = coalesce(excluded.city_label, public.profile_locations.city_label),
    place_id = coalesce(excluded.place_id, public.profile_locations.place_id),
    country_code = coalesce(excluded.country_code, public.profile_locations.country_code),
    updated_at = now();

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

revoke all on function public.set_profile_location(uuid,double precision,double precision,text,text,text) from public;
grant execute on function public.set_profile_location(uuid,double precision,double precision,text,text,text) to anon, authenticated;

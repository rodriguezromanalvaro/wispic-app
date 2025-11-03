-- Drop previous version (different return type)
drop function if exists public.set_profile_city_by_coords(uuid, double precision, double precision);

-- Return a boolean to indicate if the profile city was actually updated
create or replace function public.set_profile_city_by_coords(
  p_user uuid,
  p_lat double precision,
  p_lng double precision
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cid bigint;
  v_cname text;
  v_updated integer := 0;
begin
  -- Enforce that caller is the same user
  if auth.uid() is null or auth.uid() <> p_user then
    raise exception 'not allowed';
  end if;

  -- Find nearest city with known coords
  select c.id, c.name into v_cid, v_cname
  from public.cities c
  where c.lat is not null and c.lng is not null
  order by (
    2 * 6371 * asin(
      sqrt(
        pow(sin(radians((c.lat - p_lat) / 2)), 2) +
        cos(radians(p_lat)) * cos(radians(c.lat)) * pow(sin(radians((c.lng - p_lng) / 2)), 2)
      )
    )
  ) asc
  limit 1;

  if v_cid is null then
    return false; -- no city with coordinates
  end if;

  update public.profiles
  set city_id = v_cid,
      city = v_cname
  where id = p_user;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  return v_updated > 0;
end;
$$;

revoke all on function public.set_profile_city_by_coords(uuid,double precision,double precision) from public;
grant execute on function public.set_profile_city_by_coords(uuid,double precision,double precision) to anon, authenticated;

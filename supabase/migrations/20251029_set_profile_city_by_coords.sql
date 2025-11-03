-- Set profile city_id (and city name) to nearest city by coordinates
-- Security: Only allow user to set their own profile

create or replace function public.set_profile_city_by_coords(
  p_user uuid,
  p_lat double precision,
  p_lng double precision
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cid bigint;
  v_cname text;
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
    -- no city with coordinates; do nothing
    return;
  end if;

  update public.profiles
  set city_id = v_cid,
      city = v_cname
  where id = p_user;
end;
$$;

revoke all on function public.set_profile_city_by_coords(uuid,double precision,double precision) from public;
grant execute on function public.set_profile_city_by_coords(uuid,double precision,double precision) to anon, authenticated;

-- Enhanced city name -> city_id resolver
-- Handles comma-separated labels (e.g., "Málaga, Andalucía, España"),
-- tries diacritic/slug matches, partial ILIKE, and as a last resort uses
-- profile_locations coordinates to pick nearest city within a reasonable threshold.

-- Ensure slugs are populated for any new cities
update public.cities
set slug = public._slugify_city_name(name)
where coalesce(slug,'') = '' and coalesce(name,'') <> '';

create or replace function public.sync_profile_city_id_from_name()
returns trigger
language plpgsql
as $$
declare
  v_city_id bigint;
  v_name text;
  v_lat double precision;
  v_lng double precision;
  v_cc text;
  v_near_id bigint;
  v_near_km double precision;
begin
  -- Only attempt when city_id is null and there is a city label
  if new.city_id is null and coalesce(new.city,'') <> '' then
    -- Take the first token before comma as the core city name
    v_name := trim(split_part(new.city, ',', 1));

    -- Strong matches: exact, diacritic-insensitive, slug
    select c.id into v_city_id
    from public.cities c
    where lower(c.name) = lower(v_name)
       or lower(public._strip_diacritics(c.name)) = lower(public._strip_diacritics(v_name))
       or (coalesce(c.slug,'') <> '' and c.slug = public._slugify_city_name(v_name))
    limit 1;

    if v_city_id is null then
      -- Partial matches: starts with then contains
      select c.id into v_city_id
      from public.cities c
      where c.name ilike v_name || '%'
         or c.name ilike '%' || v_name || '%'
      order by (case when c.name ilike v_name || '%' then 0 else 1 end), length(c.name) asc
      limit 1;
    end if;

    if v_city_id is null then
      -- Coordinate-based fallback using profile_locations
      select lat, lng, country_code into v_lat, v_lng, v_cc
      from public.profile_locations
      where user_id = new.id;

      if v_lat is not null and v_lng is not null then
        -- Pick nearest city; prefer same country when available
        select c.id,
               (ST_Distance(
                  ST_SetSRID(ST_MakePoint(c.lng, c.lat), 4326)::geography,
                  ST_SetSRID(ST_MakePoint(v_lng, v_lat), 4326)::geography
                ) / 1000.0) as dist_km
        into v_near_id, v_near_km
        from public.cities c
        where c.lat is not null and c.lng is not null
          and (v_cc is null or c.country_code is null or c.country_code = v_cc)
        order by dist_km asc
        limit 1;

        -- Only assign if reasonably close (<= 300 km)
        if v_near_id is not null and v_near_km <= 300 then
          v_city_id := v_near_id;
        end if;
      end if;
    end if;

    if v_city_id is not null then
      new.city_id := v_city_id;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_profile_city_id_from_name on public.profiles;
create trigger trg_sync_profile_city_id_from_name
before insert or update of city on public.profiles
for each row execute function public.sync_profile_city_id_from_name();

comment on function public.sync_profile_city_id_from_name() is 'Resolves profiles.city into city_id using exact/diacritic/slug, partial ILIKE, and profile_locations-based nearest city fallback.';

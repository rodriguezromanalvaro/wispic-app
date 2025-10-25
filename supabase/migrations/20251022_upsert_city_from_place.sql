-- Upsert city from a Google Place selection
-- Adds google_place_id column (unique) and a SECURITY DEFINER RPC to normalize and insert/update cities

-- Safe extension for accent stripping in slugs
create extension if not exists unaccent;

-- Column to track Google Place ID (optional but helpful for idempotency)
alter table public.cities
  add column if not exists google_place_id text;

-- Ensure uniqueness on google_place_id when present
create unique index if not exists cities_google_place_id_uidx on public.cities(google_place_id) where google_place_id is not null;

-- Helper: slugify (lowercase, unaccent, hyphens)
create or replace function public._slugify_city_name(p_name text)
returns text language sql immutable as $$
  select regexp_replace(lower(trim(unaccent(p_name))), '[^a-z0-9]+', '-', 'g')
$$;

-- RPC: upsert by google_place_id or by (slug, country_code)
create or replace function public.upsert_city_from_place(
  p_name text,
  p_country_code text,
  p_lat double precision,
  p_lng double precision,
  p_google_place_id text default null,
  p_country text default null
) returns bigint
language plpgsql
security definer
set search_path = public
as $$
DECLARE
  v_slug text;
  v_cc text;
  v_id bigint;
BEGIN
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'city name required';
  end if;
  if p_country_code is null or length(trim(p_country_code)) = 0 then
    raise exception 'country_code required';
  end if;

  v_cc := upper(trim(p_country_code));
  v_slug := public._slugify_city_name(p_name);

  -- 1) Try by google_place_id if provided
  if p_google_place_id is not null then
    select id into v_id from public.cities where google_place_id = p_google_place_id;
    if found then
      -- update missing fields opportunistically
      update public.cities c
        set name = coalesce(c.name, p_name),
            country = coalesce(c.country, p_country),
            country_code = coalesce(c.country_code, v_cc),
            slug = coalesce(c.slug, v_slug),
            lat = coalesce(c.lat, p_lat),
            lng = coalesce(c.lng, p_lng)
      where c.id = v_id;
      return v_id;
    end if;
  end if;

  -- 2) Try by (slug, country_code)
  select id into v_id from public.cities where slug = v_slug and country_code = v_cc;
  if found then
    update public.cities c
      set google_place_id = coalesce(c.google_place_id, p_google_place_id),
          country = coalesce(c.country, p_country),
          lat = coalesce(c.lat, p_lat),
          lng = coalesce(c.lng, p_lng)
    where c.id = v_id;
    return v_id;
  end if;

  -- 3) Insert new
  insert into public.cities(name, country, lat, lng, slug, country_code, google_place_id)
  values (p_name, p_country, p_lat, p_lng, v_slug, v_cc, p_google_place_id)
  returning id into v_id;
  return v_id;
END;
$$;

-- Permissions: allow authenticated users to execute
revoke all on function public.upsert_city_from_place(text, text, double precision, double precision, text, text) from public;
grant execute on function public.upsert_city_from_place(text, text, double precision, double precision, text, text) to authenticated;

comment on function public.upsert_city_from_place(text, text, double precision, double precision, text, text)
  is 'Upserts a city row from a Google Place (name+country_code+coords+place_id) and returns the city id. SECURITY DEFINER handles INSERT regardless of RLS.';

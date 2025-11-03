-- Improve city name -> city_id resolution using slug/diacritic-insensitive matches
-- Idempotent and safe to re-run

-- 1) Ensure cities.slug is populated for easier matching
update public.cities
set slug = public._slugify_city_name(name)
where coalesce(slug, '') = '' and coalesce(name,'') <> '';

-- 2) Replace the resolver to try multiple strategies
create or replace function public.sync_profile_city_id_from_name()
returns trigger
language plpgsql
as $$
declare
  v_city_id bigint;
begin
  -- Only try to resolve if city_id is null and we have a city name
  if new.city_id is null and coalesce(new.city, '') <> '' then
    select c.id into v_city_id
    from public.cities c
    where
      -- exact (case-insensitive) name match
      lower(c.name) = lower(new.city)
      or
      -- diacritic-insensitive equality
      lower(public._strip_diacritics(c.name)) = lower(public._strip_diacritics(new.city))
      or
      -- slug match
      coalesce(c.slug, '') <> '' and c.slug = public._slugify_city_name(new.city)
    limit 1;

    if v_city_id is not null then
      new.city_id := v_city_id;
    end if;
  end if;

  return new;
end;
$$;

-- Recreate trigger to be safe (noop if already exists)
drop trigger if exists trg_sync_profile_city_id_from_name on public.profiles;
create trigger trg_sync_profile_city_id_from_name
before insert or update of city on public.profiles
for each row execute function public.sync_profile_city_id_from_name();

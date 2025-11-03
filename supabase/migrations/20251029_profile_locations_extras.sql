-- Add extra fields to profile_locations for global disambiguation and analytics
alter table public.profile_locations
  add column if not exists place_id text,
  add column if not exists country_code text;

-- Optional: simple index to query by country if needed later
-- create index if not exists idx_profile_locations_country_code on public.profile_locations(country_code);

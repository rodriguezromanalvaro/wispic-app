-- Drop discovery_on column from profiles (idempotent)
ALTER TABLE public.profiles DROP COLUMN IF EXISTS discovery_on;

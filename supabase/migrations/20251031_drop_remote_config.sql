-- Drop remote_config table (no feature flags in use)
-- Safe guard: IF EXISTS; CASCADE in case of FKs/views depending on it

DROP TABLE IF EXISTS public.remote_config CASCADE;

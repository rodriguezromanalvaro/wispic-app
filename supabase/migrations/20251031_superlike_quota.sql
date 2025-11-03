-- Enforce daily superlike quota (3 per user, resets daily UTC)
-- Uses public.superlike_counters (PK: user_id, day)
-- Applies on INSERT of likes with type='superlike' and on UPDATE when switching to superlike

-- 1) Ensure helper comments and optional constraint (skip if you plan configurable quotas)
-- Note: We rely on atomic UPDATE with used < 3 to avoid overshoot; CHECK could be added if desired.
-- ALTER TABLE public.superlike_counters ADD CONSTRAINT superlike_used_nonnegative CHECK (used >= 0);
-- ALTER TABLE public.superlike_counters ADD CONSTRAINT superlike_used_max CHECK (used <= 3);

-- 2) Trigger function to enforce quota atomically (UTC day)
CREATE OR REPLACE FUNCTION public.enforce_superlike_quota() RETURNS trigger AS $$
DECLARE
  v_used integer;
  v_day date := (now() at time zone 'UTC')::date;
BEGIN
  -- Only enforce for superlikes; defensive guard when attached WITH WHEN clause
  IF NEW.type::text <> 'superlike' THEN
    RETURN NEW;
  END IF;

  -- Optimistic in-place increment when row exists and still under quota
  UPDATE public.superlike_counters
     SET used = used + 1
   WHERE user_id = NEW.liker
     AND day = v_day
     AND used < 3
   RETURNING used INTO v_used;

  IF NOT FOUND THEN
    -- Ensure row exists with used=1 when first use of the day
    INSERT INTO public.superlike_counters(user_id, day, used)
      VALUES (NEW.liker, v_day, 1)
      ON CONFLICT (user_id, day) DO NOTHING;

    -- Try increment again with guard; if still not possible, quota is exhausted
    UPDATE public.superlike_counters
       SET used = used + 1
     WHERE user_id = NEW.liker
       AND day = v_day
       AND used < 3
     RETURNING used INTO v_used;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'No te quedan superlikes hoy'
        USING ERRCODE = 'P0001', DETAIL = 'quota=3; scope=daily; tz=UTC';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

COMMENT ON FUNCTION public.enforce_superlike_quota() IS 'Enforces max 3 superlikes per user per UTC day using superlike_counters; safe under concurrency via guarded UPDATE.';

-- 3) Triggers on likes
DROP TRIGGER IF EXISTS trg_enforce_superlike_quota_ins ON public.likes;
CREATE TRIGGER trg_enforce_superlike_quota_ins
BEFORE INSERT ON public.likes
FOR EACH ROW
WHEN (NEW.type = 'superlike')
EXECUTE FUNCTION public.enforce_superlike_quota();

DROP TRIGGER IF EXISTS trg_enforce_superlike_quota_upd ON public.likes;
CREATE TRIGGER trg_enforce_superlike_quota_upd
BEFORE UPDATE OF type ON public.likes
FOR EACH ROW
WHEN (NEW.type = 'superlike' AND (OLD.type IS DISTINCT FROM 'superlike'))
EXECUTE FUNCTION public.enforce_superlike_quota();

-- 4) Optional RPC: remaining superlikes today for the current user (defaults to auth.uid())
CREATE OR REPLACE FUNCTION public.superlikes_remaining_today(p_user uuid DEFAULT auth.uid())
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT GREATEST(0, 3 - COALESCE((
    SELECT used FROM public.superlike_counters
    WHERE user_id = p_user AND day = (now() at time zone 'UTC')::date
  ), 0))::int;
$$;

COMMENT ON FUNCTION public.superlikes_remaining_today(uuid) IS 'Returns remaining superlikes for the UTC day (3 - used).';

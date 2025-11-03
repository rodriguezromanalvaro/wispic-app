-- ==========================================
-- Set onboarding_completed based on mandatory fields only
-- Idempotent and safe to re-run
-- ==========================================

-- Mandatory set: display_name, birthdate, gender, interested_in (non-empty)
-- Optional steps (bio, prompts, photos, relationship, etc.) DO NOT block completion

CREATE OR REPLACE FUNCTION public.update_onboarding_completed()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Compute dynamically on every insert/update
  NEW.onboarding_completed :=
    (NEW.display_name IS NOT NULL AND btrim(NEW.display_name) <> '')
    AND NEW.birthdate IS NOT NULL
    AND NEW.gender IS NOT NULL
    AND COALESCE(array_length(NEW.interested_in, 1), 0) > 0;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_onboarding_completed ON public.profiles;
CREATE TRIGGER trg_update_onboarding_completed
BEFORE INSERT OR UPDATE OF display_name, birthdate, gender, interested_in ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_onboarding_completed();

-- NOTE: if you prefer "sticky" completion (never revert to false once true),
-- replace the function body with:
-- BEGIN
--   IF (COALESCE(OLD.onboarding_completed, false) = true) THEN
--     NEW.onboarding_completed := true;
--   ELSE
--     NEW.onboarding_completed :=
--       (NEW.display_name IS NOT NULL AND btrim(NEW.display_name) <> '')
--       AND NEW.birthdate IS NOT NULL
--       AND NEW.gender IS NOT NULL
--       AND COALESCE(array_length(NEW.interested_in, 1), 0) > 0;
--   END IF;
--   RETURN NEW;
-- END;

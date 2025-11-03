-- ==========================================
-- Ensure profiles.avatar_url gets set when first photo is added
-- Idempotent and safe to re-run
-- ==========================================

CREATE OR REPLACE FUNCTION public.set_avatar_on_first_photo()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- If profile has no avatar yet, set it to the newly inserted photo URL
  UPDATE public.profiles p
     SET avatar_url = NEW.url,
         updated_at = now()
   WHERE p.id = NEW.user_id
     AND (p.avatar_url IS NULL OR length(trim(p.avatar_url)) = 0);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_avatar_on_first_photo ON public.user_photos;
CREATE TRIGGER trg_set_avatar_on_first_photo
AFTER INSERT ON public.user_photos
FOR EACH ROW
EXECUTE FUNCTION public.set_avatar_on_first_photo();

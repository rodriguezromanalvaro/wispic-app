


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."like_type" AS ENUM (
    'like',
    'superlike',
    'pass'
);


ALTER TYPE "public"."like_type" OWNER TO "postgres";


CREATE TYPE "public"."platform_type" AS ENUM (
    'ios',
    'android',
    'web'
);


ALTER TYPE "public"."platform_type" OWNER TO "postgres";


CREATE TYPE "public"."staff_role" AS ENUM (
    'owner',
    'manager',
    'staff'
);


ALTER TYPE "public"."staff_role" OWNER TO "postgres";


CREATE TYPE "public"."venue_category" AS ENUM (
    'bar',
    'discoteca',
    'sala_conciertos',
    'sala_eventos',
    'pub',
    'otro'
);


ALTER TYPE "public"."venue_category" OWNER TO "postgres";


CREATE TYPE "public"."venue_type" AS ENUM (
    'nightclub',
    'concert_hall',
    'festival'
);


ALTER TYPE "public"."venue_type" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."archive_inactive_matches"("older_than" interval) RETURNS integer
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'extensions', 'public'
    AS $$
DECLARE
    archived_count integer;
BEGIN
    WITH inactive_matches AS (
        SELECT id FROM public.matches
        WHERE last_message_at < NOW() - older_than
    )
    SELECT COUNT(*) INTO archived_count
    FROM inactive_matches;

    -- Here you would implement the actual archiving logic
    -- For now, we just return the count of matches that would be archived
    
    RETURN archived_count;
END;
$$;


ALTER FUNCTION "public"."archive_inactive_matches"("older_than" interval) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_age"("birth_date" "date") RETURNS integer
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'pg_catalog', 'extensions', 'public'
    AS $$
BEGIN
    RETURN calculate_age_immutable(birth_date);
END;
$$;


ALTER FUNCTION "public"."calculate_age"("birth_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_age_immutable"("birthdate" "date") RETURNS integer
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'pg_catalog', 'extensions', 'public'
    AS $$
BEGIN
    RETURN EXTRACT(YEAR FROM AGE(CURRENT_DATE, birthdate));
END;
$$;


ALTER FUNCTION "public"."calculate_age_immutable"("birthdate" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_level"("xp" integer) RETURNS integer
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'extensions', 'public'
    AS $$
BEGIN
    -- Fórmula simple: nivel = √(XP / 50)
    -- Esta fórmula hace que cada nivel requiera más XP que el anterior
    RETURN floor(sqrt(xp::float / 50));
END;
$$;


ALTER FUNCTION "public"."calculate_level"("xp" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_achievement_progress"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'extensions', 'public'
    AS $$
BEGIN
    -- Implementación segura que no falle
    BEGIN
        -- Solo marcar como completado si alcanza el 100%
        IF NEW.current_value >= 100 AND NEW.progress < 100 THEN
            UPDATE user_achievements
            SET progress = 100,
                completed_at = now(),
                updated_at = now()
            WHERE user_id = NEW.user_id AND achievement_id = NEW.achievement_id;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Error al verificar progreso: %', SQLERRM;
    END;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."check_achievement_progress"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_upper_country_code"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'extensions', 'public'
    AS $$
begin
  if new.country_code is not null then
    new.country_code := upper(new.country_code);
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."enforce_upper_country_code"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_event_presence"("event_ids" bigint[], "recent_minutes" integer DEFAULT 90) RETURNS TABLE("event_id" bigint, "verified_count" integer, "manual_count" integer, "present_count" numeric, "last_sample_at" timestamp with time zone)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT 
    e.id AS event_id,
    COALESCE(COUNT(*) FILTER (WHERE ec.verified), 0) AS verified_count,
    COALESCE(COUNT(*) FILTER (WHERE NOT ec.verified AND ec.method = 'manual'), 0) AS manual_count,
    (COALESCE(COUNT(*) FILTER (WHERE ec.verified), 0))::numeric
      + 0.25 * (COALESCE(COUNT(*) FILTER (WHERE NOT ec.verified AND ec.method = 'manual'), 0))::numeric AS present_count,
    MAX(ec.last_seen_at) AS last_sample_at
  FROM public.events e
  LEFT JOIN public.event_checkins ec
    ON ec.event_id = e.id
    AND ec.last_seen_at > (now() - ((COALESCE(recent_minutes, 90))::text || ' minutes')::interval)
  WHERE e.id = ANY(event_ids)
  GROUP BY e.id
  ORDER BY e.id;
$$;


ALTER FUNCTION "public"."get_event_presence"("event_ids" bigint[], "recent_minutes" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_feed_occurrences"("p_city" "text", "p_from_ts" timestamp with time zone) RETURNS TABLE("id" bigint, "kind" "text", "starts_at" timestamp with time zone, "ends_at" timestamp with time zone, "venue" "text", "city" "text", "title" "text", "banner_url" "text", "going_count" integer)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  return query
  select
    v.id, v.kind, v.starts_at, v.ends_at, v.venue, v.city, v.title, v.banner_url,
    (select count(*)::int
       from public.event_rsvps r
      where r.occurrence_id = v.id
        and r.status = 'going') as going_count
  from public.v_feed_occurrences v
  where v.city = coalesce(p_city, v.city)
    and v.starts_at >= coalesce(p_from_ts, now())
  order by v.starts_at asc
  limit 200;
end;
$$;


ALTER FUNCTION "public"."get_feed_occurrences"("p_city" "text", "p_from_ts" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_open_today"("p_city" "text") RETURNS TABLE("id" bigint, "kind" "text", "starts_at" timestamp with time zone, "ends_at" timestamp with time zone, "venue" "text", "city" "text", "title" "text", "banner_url" "text", "going_count" integer)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  return query
  select
    v.id, v.kind, v.starts_at, v.ends_at, v.venue, v.city, v.title, v.banner_url,
    (select count(*)::int
       from public.event_rsvps r
      where r.occurrence_id = v.id
        and r.status = 'going') as going_count
  from public.v_feed_occurrences v
  where v.city = coalesce(p_city, v.city)
    and v.starts_at >= date_trunc('day', now())
    and v.starts_at <  date_trunc('day', now()) + interval '1 day'
  order by v.starts_at asc;
end;
$$;


ALTER FUNCTION "public"."get_open_today"("p_city" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_like_create"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'extensions', 'public'
    AS $$
BEGIN
  IF NEW.type = 'like'::public.like_type AND EXISTS (
    SELECT 1 FROM public.likes
    WHERE liker = NEW.liked
    AND liked = NEW.liker
    AND type = 'like'::public.like_type
  ) THEN
    INSERT INTO public.matches (user_a, user_b, created_by_like_id, superlike)
    VALUES (
      LEAST(NEW.liker, NEW.liked),
      GREATEST(NEW.liker, NEW.liked),
      NEW.id,
      NEW.type = 'superlike'::public.like_type
    );
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_like_create"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_match"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_like likes;
    v_match matches;
BEGIN
    SELECT * INTO v_like FROM likes WHERE id = NEW.created_by_like_id;

    -- If there's already a match between these users, do nothing
    IF EXISTS (
        SELECT 1 FROM matches 
        WHERE (user_a = v_like.liker AND user_b = v_like.liked)
           OR (user_a = v_like.liked AND user_b = v_like.liker)
    ) THEN
        RETURN NULL;
    END IF;

    -- Create a new match
    INSERT INTO matches (user_a, user_b, created_by_like_id, superlike)
    SELECT
        LEAST(v_like.liker, v_like.liked),
        GREATEST(v_like.liker, v_like.liked),
        v_like.id,
        v_like.type = 'superlike'
    RETURNING * INTO v_match;

    -- Return the new match
    RETURN v_match;
END;
$$;


ALTER FUNCTION "public"."handle_match"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."initialize_user_gamification"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'extensions', 'public'
    AS $$
DECLARE
    achievement_record RECORD;
BEGIN
    -- Manejo de errores para evitar fallos durante el registro
    BEGIN
        -- Crear registro de estadísticas
        INSERT INTO user_statistics (user_id) VALUES (NEW.id);
    EXCEPTION WHEN OTHERS THEN
        -- Si falla, registrar el error pero continuar
        RAISE NOTICE 'Error al crear estadísticas para el usuario %: %', NEW.id, SQLERRM;
    END;
    
    BEGIN
        -- Crear registro de nivel
        INSERT INTO user_levels (user_id) VALUES (NEW.id);
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Error al crear nivel para el usuario %: %', NEW.id, SQLERRM;
    END;
    
    BEGIN
        -- Crear registros de logros iniciales con manejo de errores
        FOR achievement_record IN 
            SELECT id FROM achievement_templates
        LOOP
            BEGIN
                INSERT INTO user_achievements (user_id, achievement_id, current_value, progress)
                VALUES (NEW.id, achievement_record.id, 0, 0);
            EXCEPTION WHEN OTHERS THEN
                RAISE NOTICE 'Error al crear logro % para usuario %: %', 
                    achievement_record.id, NEW.id, SQLERRM;
            END;
        END LOOP;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Error general en logros para el usuario %: %', NEW.id, SQLERRM;
    END;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."initialize_user_gamification"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."join_event"("p_event" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into event_attendance(event_id, user_id, status)
  values (p_event, auth.uid(), 'going')
  on conflict (event_id, user_id) do update set status = 'going';
end;
$$;


ALTER FUNCTION "public"."join_event"("p_event" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."leave_event"("p_event" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  delete from event_attendance
  where event_id = p_event
    and user_id = auth.uid();
end;
$$;


ALTER FUNCTION "public"."leave_event"("p_event" integer) OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "display_name" "text" NOT NULL,
    "birthdate" "date",
    "bio" "text",
    "gender" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_premium" boolean DEFAULT false NOT NULL,
    "push_token" "text",
    "is_admin" boolean DEFAULT false,
    "verified_at" timestamp with time zone,
    "avatar_url" "text",
    "calculated_age" integer,
    "interested_in" "text"[] DEFAULT '{}'::"text"[],
    "show_orientation" boolean DEFAULT true NOT NULL,
    "show_gender" boolean DEFAULT true NOT NULL,
    "seeking" "text"[] DEFAULT '{}'::"text"[],
    "show_seeking" boolean DEFAULT true,
    "relationship_status" "text",
    "location_opt_in" boolean DEFAULT false,
    "push_opt_in" boolean DEFAULT false,
    "notify_messages" boolean DEFAULT true,
    "notify_likes" boolean DEFAULT true,
    "notify_friend_requests" boolean DEFAULT true,
    "expo_push_token" "text",
    "onboarding_version" smallint DEFAULT 2,
    "onboarding_completed" boolean DEFAULT false,
    "camera_opt_in" boolean DEFAULT false NOT NULL,
    "show_relationship" boolean DEFAULT true NOT NULL,
    "city" "text",
    CONSTRAINT "profiles_birthdate_check" CHECK (("public"."calculate_age"("birthdate") >= 18)),
    CONSTRAINT "profiles_relationship_status_check" CHECK (("relationship_status" = ANY (ARRAY['single'::"text", 'inRelationship'::"text", 'open'::"text", 'itsComplicated'::"text", 'preferNot'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."profiles"."show_relationship" IS 'Controla si la situación sentimental se muestra en el perfil público';



CREATE OR REPLACE VIEW "public"."public_profile_public" WITH ("security_invoker"='true') AS
 SELECT "id",
    "display_name",
    "bio",
        CASE
            WHEN "show_gender" THEN "gender"
            ELSE NULL::"text"
        END AS "gender",
        CASE
            WHEN "show_orientation" THEN "interested_in"
            ELSE '{}'::"text"[]
        END AS "interested_in",
    "avatar_url",
    "updated_at"
   FROM "public"."profiles" "p";


ALTER VIEW "public"."public_profile_public" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_profiles"("_viewer" "uuid", "_limit" integer DEFAULT 50, "_offset" integer DEFAULT 0) RETURNS SETOF "public"."public_profile_public"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'pg_catalog', 'extensions', 'public'
    AS $$
  WITH me AS (
    SELECT id, gender, interested_in
    FROM profiles
    WHERE id = _viewer
  ),
  candidates AS (
    SELECT p.*
    FROM profiles p
    CROSS JOIN me
    WHERE p.id <> me.id
      AND me.gender IS NOT NULL
      AND p.gender IS NOT NULL
      AND array_length(me.interested_in,1) > 0
      AND array_length(p.interested_in,1) > 0
      -- Mutual interest
      AND me.gender = ANY(p.interested_in)
      AND p.gender = ANY(me.interested_in)
      -- Optional: enforce candidate shows gender (uncomment next line to REQUIRE visibility)
      -- AND p.show_gender = true
  )
  SELECT
    c.id,
    c.display_name,
    c.bio,
    CASE WHEN c.show_gender THEN c.gender ELSE NULL END AS gender,
    CASE WHEN c.show_orientation THEN c.interested_in ELSE '{}'::text[] END AS interested_in,
    c.avatar_url,
    c.updated_at
  FROM candidates c
  ORDER BY c.updated_at DESC
  LIMIT COALESCE(_limit,50)
  OFFSET COALESCE(_offset,0);
$$;


ALTER FUNCTION "public"."match_profiles"("_viewer" "uuid", "_limit" integer, "_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."migrate_venue_data"() RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'extensions', 'public'
    AS $$
DECLARE
    v_city_id bigint;
    v_venue_id bigint;
    v_city text;
    v_venue text;
    v_record record;
BEGIN
    -- Migrate unique cities from events
    FOR v_city IN 
        SELECT DISTINCT city 
        FROM (
            SELECT city FROM public.events WHERE city IS NOT NULL
            UNION
            SELECT city FROM public.event_occurrences WHERE city IS NOT NULL
        ) unique_cities
    LOOP
        INSERT INTO public.cities (name, country)
        VALUES (v_city, 'Unknown')
        ON CONFLICT (name) DO NOTHING;
    END LOOP;

    -- Migrate venues and update references
    FOR v_record IN
        SELECT DISTINCT venue, city
        FROM (
            SELECT venue, city FROM public.events 
            WHERE venue IS NOT NULL AND city IS NOT NULL
            UNION
            SELECT venue, city FROM public.event_occurrences 
            WHERE venue IS NOT NULL AND city IS NOT NULL
        ) unique_venues
    LOOP
        -- Get city id
        SELECT id INTO v_city_id 
        FROM public.cities 
        WHERE name = v_record.city;

        -- Insert venue if it doesn't exist
        INSERT INTO public.venues (name, city_id)
        VALUES (v_record.venue, v_city_id)
        ON CONFLICT (name, city_id) DO NOTHING
        RETURNING id INTO v_venue_id;

        -- If venue was already inserted, get its id
        IF v_venue_id IS NULL THEN
            SELECT id INTO v_venue_id 
            FROM public.venues 
            WHERE name = v_record.venue AND city_id = v_city_id;
        END IF;

        -- Update events
        UPDATE public.events
        SET venue_id = v_venue_id,
            city_id = v_city_id
        WHERE venue = v_record.venue 
        AND city = v_record.city;

        -- Update event_occurrences
        UPDATE public.event_occurrences
        SET venue_id = v_venue_id,
            city_id = v_city_id
        WHERE venue = v_record.venue 
        AND city = v_record.city;
    END LOOP;
END;
$$;


ALTER FUNCTION "public"."migrate_venue_data"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."moddatetime"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'extensions', 'public'
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."moddatetime"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."owner_onboarding_upsert"("p_user_id" "uuid", "p_name" "text", "p_email" "text", "p_phone" "text", "p_category" "public"."venue_category", "p_city_id" bigint, "p_location_text" "text", "p_description" "text", "p_avatar_url" "text", "p_promote" boolean, "p_attract" boolean, "p_other" "text") RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'extensions', 'public'
    AS $$
DECLARE
  v_venue_id bigint;
BEGIN
  INSERT INTO public.venues (name, email, phone, category, city_id, location_text, description, avatar_url)
  VALUES (p_name, p_email, p_phone, p_category, p_city_id, p_location_text, p_description, p_avatar_url)
  RETURNING id INTO v_venue_id;

  INSERT INTO public.venue_staff (venue_id, user_id, role)
  VALUES (v_venue_id, p_user_id, 'owner')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.venue_goals (venue_id, promote, attract, other)
  VALUES (v_venue_id, p_promote, p_attract, p_other)
  ON CONFLICT (venue_id) DO UPDATE
  SET promote = EXCLUDED.promote,
      attract = EXCLUDED.attract,
      other = EXCLUDED.other,
      updated_at = now();

  RETURN v_venue_id;
END; $$;


ALTER FUNCTION "public"."owner_onboarding_upsert"("p_user_id" "uuid", "p_name" "text", "p_email" "text", "p_phone" "text", "p_category" "public"."venue_category", "p_city_id" bigint, "p_location_text" "text", "p_description" "text", "p_avatar_url" "text", "p_promote" boolean, "p_attract" boolean, "p_other" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."owner_state"() RETURNS TABLE("is_owner" boolean, "needs_onboarding" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'extensions', 'public'
    AS $$
declare
  v_is_owner boolean := false;
  v_needs boolean := false;
begin
  -- Is the current user an owner in any venue?
  select exists(
    select 1 from public.venue_staff vs
    where vs.user_id = auth.uid()
      and vs.role = 'owner'
  ) into v_is_owner;

  if not v_is_owner then
    return query select false::boolean, false::boolean;
    return;
  end if;

  -- Needs onboarding if any owned venue is missing required fields
  select exists(
    select 1
    from public.venue_staff vs
    join public.venues v on v.id = vs.venue_id
    where vs.user_id = auth.uid()
      and vs.role = 'owner'
      and (
        v.name is null
        or v.category is null
        or v.location_text is null
        or v.description is null
        or v.avatar_url is null
      )
  ) into v_needs;

  return query select true::boolean, v_needs::boolean;
end;
$$;


ALTER FUNCTION "public"."owner_state"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" bigint NOT NULL,
    "match_id" bigint NOT NULL,
    "sender" "uuid" NOT NULL,
    "content" "text",
    "image_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "client_msg_id" "uuid"
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."send_message_idempotent"("p_match_id" bigint, "p_sender" "uuid", "p_content" "text", "p_client_msg_id" "uuid") RETURNS "public"."messages"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'extensions', 'public'
    AS $$
DECLARE
  result public.messages%ROWTYPE;
BEGIN
  INSERT INTO public.messages (match_id, sender, content, client_msg_id)
  VALUES (p_match_id, p_sender, p_content, p_client_msg_id)
  ON CONFLICT (client_msg_id) DO UPDATE
    SET content = EXCLUDED.content
  RETURNING * INTO result;

  RETURN result;
END
$$;


ALTER FUNCTION "public"."send_message_idempotent"("p_match_id" bigint, "p_sender" "uuid", "p_content" "text", "p_client_msg_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_match_last_message_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'extensions', 'public'
    AS $$
BEGIN
  UPDATE matches
     SET last_message_at = NEW.created_at
   WHERE id = NEW.match_id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_match_last_message_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'extensions', 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."slugify_prompt"("txt" "text") RETURNS "text"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'extensions', 'public'
    AS $$
DECLARE
  base text;
BEGIN
  IF txt IS NULL OR length(trim(txt)) = 0 THEN
    RETURN NULL;
  END IF;
  base := lower(regexp_replace(unaccent(txt), '[^a-z0-9]+', '_', 'g'));
  base := trim(both '_' from base);
  IF length(base) = 0 THEN
    base := 'prompt';
  END IF;
  IF length(base) > 48 THEN
    base := substring(base for 48);
  END IF;
  RETURN base;
END;
$$;


ALTER FUNCTION "public"."slugify_prompt"("txt" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'extensions', 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END; $$;


ALTER FUNCTION "public"."touch_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."undo_last_decision"("p_event_id" integer, "p_target" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_like_id bigint;
  v_has_match boolean;
begin
  -- Si ya hay match, no permitimos deshacer (consistencia de chat)
  select exists(
    select 1 from public.matches
    where (user_a = auth.uid() and user_b = p_target)
       or (user_b = auth.uid() and user_a = p_target)
  ) into v_has_match;

  if v_has_match then
    return false;
  end if;

  -- Última decisión mía hacia ese target en ese evento
  select id
    into v_like_id
  from public.likes
  where liker = auth.uid()
    and liked = p_target
    and context_event_id = p_event_id
  order by created_at desc
  limit 1;

  if v_like_id is null then
    return false;
  end if;

  delete from public.likes where id = v_like_id;
  return true;
end;
$$;


ALTER FUNCTION "public"."undo_last_decision"("p_event_id" integer, "p_target" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_calculated_age_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'extensions', 'public'
    AS $$
BEGIN
    -- Siempre calculamos calculated_age a partir de birthdate, sin importar
    -- si se proporcionó un valor o no para calculated_age en la operación
    IF NEW.birthdate IS NOT NULL THEN
        NEW.calculated_age = calculate_age_immutable(NEW.birthdate);
    ELSE
        NEW.calculated_age = NULL;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_calculated_age_trigger"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_profile_completion_achievement"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'extensions', 'public'
    AS $$
DECLARE
    achievement_id INT;
    has_photos BOOLEAN DEFAULT FALSE;
    has_prompts BOOLEAN DEFAULT FALSE;
    completion_pct INT DEFAULT 0;
BEGIN
    -- Para actualizaciones, calcular completitud real
    -- Calcular el porcentaje de completitud del perfil
    completion_pct := 0;
    
    -- Usar display_name en lugar de full_name
    IF NEW.display_name IS NOT NULL THEN completion_pct := completion_pct + 15; END IF;
    IF NEW.avatar_url IS NOT NULL THEN completion_pct := completion_pct + 15; END IF;
    IF NEW.birthdate IS NOT NULL THEN completion_pct := completion_pct + 15; END IF;
    IF NEW.gender IS NOT NULL THEN completion_pct := completion_pct + 15; END IF;
    IF NEW.bio IS NOT NULL THEN completion_pct := completion_pct + 15; END IF;
    
    -- Verificar si el usuario tiene fotos
    BEGIN
        SELECT EXISTS(SELECT 1 FROM user_photos WHERE user_id = NEW.id LIMIT 1) 
        INTO has_photos;
        
        IF has_photos THEN 
            completion_pct := completion_pct + 15;
        END IF;
    EXCEPTION
        WHEN OTHERS THEN has_photos := FALSE;
    END;
    
    -- Verificar si el usuario ha respondido preguntas
    BEGIN
        SELECT EXISTS(SELECT 1 FROM profile_prompts WHERE profile_id = NEW.id LIMIT 1) 
        INTO has_prompts;
        
        IF has_prompts THEN 
            completion_pct := completion_pct + 10;
        END IF;
    EXCEPTION
        WHEN OTHERS THEN has_prompts := FALSE;
    END;
    
    -- Buscar o crear el logro de completitud del perfil
    BEGIN
        SELECT id INTO achievement_id 
        FROM achievements 
        WHERE user_id = NEW.id AND achievement_type = 'profile_completion';
        
        IF FOUND THEN
            -- Actualizar logro existente
            UPDATE achievements
            SET progress = completion_pct,
                updated_at = now()
            WHERE id = achievement_id;
        ELSE
            -- Crear nuevo logro
            INSERT INTO achievements (user_id, achievement_type, progress, max_progress)
            VALUES (NEW.id, 'profile_completion', completion_pct, 100);
        END IF;
    EXCEPTION
        WHEN OTHERS THEN 
            -- Si la tabla de logros no existe, ignoramos silenciosamente
            NULL;
    END;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_profile_completion_achievement"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_level"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'extensions', 'public'
    AS $$
BEGIN
    -- Implementación segura que no falle
    BEGIN
        -- Actualizar nivel basado en logros completados
        IF NEW.progress = 100 AND OLD.progress < 100 THEN
            UPDATE user_levels
            SET level = level + 1,
                updated_at = now()
            WHERE user_id = NEW.user_id;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Error al actualizar nivel: %', SQLERRM;
    END;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_user_level"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."achievement_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" character varying(50) NOT NULL,
    "title" character varying(100) NOT NULL,
    "description" "text" NOT NULL,
    "icon" character varying(50) NOT NULL,
    "reward_type" character varying(50) NOT NULL,
    "reward_value" character varying(255) NOT NULL,
    "required_value" integer NOT NULL,
    "category" character varying(50) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."achievement_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."match_reads" (
    "match_id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "last_read_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."match_reads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."matches" (
    "id" bigint NOT NULL,
    "user_a" "uuid" NOT NULL,
    "user_b" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by_like_id" bigint,
    "superlike" boolean DEFAULT false NOT NULL,
    "last_message_at" timestamp with time zone,
    CONSTRAINT "users_ordered" CHECK (("user_a" < "user_b"))
);


ALTER TABLE "public"."matches" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."active_matches" WITH ("security_invoker"='true') AS
 SELECT "m"."id",
    "m"."user_a",
    "m"."user_b",
    "m"."created_at",
    "m"."created_by_like_id",
    "mr_a"."last_read_at" AS "last_read_a",
    "mr_b"."last_read_at" AS "last_read_b",
    "m"."superlike",
    "m"."last_message_at",
    GREATEST(COALESCE("m"."last_message_at", "m"."created_at"), COALESCE("mr_a"."last_read_at", "m"."created_at"), COALESCE("mr_b"."last_read_at", "m"."created_at")) AS "last_activity_at"
   FROM (("public"."matches" "m"
     LEFT JOIN "public"."match_reads" "mr_a" ON ((("mr_a"."match_id" = "m"."id") AND ("mr_a"."user_id" = "m"."user_a"))))
     LEFT JOIN "public"."match_reads" "mr_b" ON ((("mr_b"."match_id" = "m"."id") AND ("mr_b"."user_id" = "m"."user_b"))))
  WHERE ("m"."last_message_at" > ("now"() - '3 mons'::interval));


ALTER VIEW "public"."active_matches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cities" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "country" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "lat" double precision,
    "lng" double precision,
    "slug" "text",
    "country_code" "text",
    "lon" numeric
);


ALTER TABLE "public"."cities" OWNER TO "postgres";


ALTER TABLE "public"."cities" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."cities_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."event_attendance" (
    "event_id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "status" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "event_attendance_status_check" CHECK (("status" = ANY (ARRAY['going'::"text", 'interested'::"text"])))
);


ALTER TABLE "public"."event_attendance" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_checkins" (
    "event_id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "last_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "method" "text" DEFAULT 'manual'::"text" NOT NULL,
    "verified" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."event_checkins" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_occurrences" (
    "id" bigint NOT NULL,
    "event_id" bigint,
    "opening_schedule_id" bigint,
    "venue" "text" NOT NULL,
    "city" "text" NOT NULL,
    "title" "text",
    "banner_url" "text",
    "kind" "text" NOT NULL,
    "starts_at" timestamp with time zone NOT NULL,
    "ends_at" timestamp with time zone,
    "is_published" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "venue_id" bigint,
    "city_id" bigint,
    CONSTRAINT "event_occurrences_kind_check" CHECK (("kind" = ANY (ARRAY['event'::"text", 'recurring'::"text"])))
);


ALTER TABLE "public"."event_occurrences" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."event_occurrences_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."event_occurrences_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."event_occurrences_id_seq" OWNED BY "public"."event_occurrences"."id";



CREATE TABLE IF NOT EXISTS "public"."event_rsvps" (
    "occurrence_id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'going'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "event_rsvps_status_check" CHECK (("status" = ANY (ARRAY['going'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."event_rsvps" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_series" (
    "id" bigint NOT NULL,
    "venue_id" bigint NOT NULL,
    "title" "text" NOT NULL,
    "recurrence_rule" "text",
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."event_series" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."event_series_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."event_series_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."event_series_id_seq" OWNED BY "public"."event_series"."id";



CREATE TABLE IF NOT EXISTS "public"."event_sponsorships" (
    "id" bigint NOT NULL,
    "event_id" bigint NOT NULL,
    "starts_at" timestamp with time zone,
    "ends_at" timestamp with time zone,
    "priority" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."event_sponsorships" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."event_sponsorships_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."event_sponsorships_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."event_sponsorships_id_seq" OWNED BY "public"."event_sponsorships"."id";



CREATE TABLE IF NOT EXISTS "public"."events" (
    "id" bigint NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "start_at" timestamp with time zone NOT NULL,
    "venue" "text",
    "city" "text",
    "cover_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "venue_id" bigint,
    "city_id" bigint,
    "is_sponsored" boolean DEFAULT false NOT NULL,
    "sponsored_until" timestamp with time zone,
    "sponsored_priority" integer DEFAULT 0,
    "series_id" bigint,
    "status" "text" DEFAULT 'published'::"text" NOT NULL,
    "published_at" timestamp with time zone,
    "is_free" boolean,
    "price_cents" integer,
    "currency" "text" DEFAULT 'EUR'::"text",
    CONSTRAINT "events_currency_required" CHECK ((("price_cents" IS NULL) OR ("currency" IS NOT NULL))),
    CONSTRAINT "events_price_consistency" CHECK (((("is_free" IS TRUE) AND ("price_cents" IS NULL)) OR (("is_free" IS FALSE) AND ("price_cents" IS NOT NULL) AND ("price_cents" >= 0)) OR (("is_free" IS NULL) AND ("price_cents" IS NULL)))),
    CONSTRAINT "events_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'published'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."events" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."events_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."events_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."events_id_seq" OWNED BY "public"."events"."id";



CREATE TABLE IF NOT EXISTS "public"."interests" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL
);


ALTER TABLE "public"."interests" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."interests_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."interests_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."interests_id_seq" OWNED BY "public"."interests"."id";



CREATE TABLE IF NOT EXISTS "public"."likes" (
    "id" bigint NOT NULL,
    "liker" "uuid" NOT NULL,
    "liked" "uuid" NOT NULL,
    "context_event_id" bigint,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "type" "public"."like_type" DEFAULT 'like'::"public"."like_type" NOT NULL
);


ALTER TABLE "public"."likes" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."likes_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."likes_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."likes_id_seq" OWNED BY "public"."likes"."id";



CREATE TABLE IF NOT EXISTS "public"."match_notes" (
    "match_id" bigint NOT NULL,
    "author" "uuid" NOT NULL,
    "note" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."match_notes" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."matches_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."matches_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."matches_id_seq" OWNED BY "public"."matches"."id";



CREATE SEQUENCE IF NOT EXISTS "public"."messages_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."messages_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."messages_id_seq" OWNED BY "public"."messages"."id";



CREATE TABLE IF NOT EXISTS "public"."opening_schedules" (
    "id" bigint NOT NULL,
    "venue" "text" NOT NULL,
    "city" "text" NOT NULL,
    "weekday" integer NOT NULL,
    "open_time" time without time zone NOT NULL,
    "close_time" time without time zone,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "opening_schedules_weekday_check" CHECK ((("weekday" >= 0) AND ("weekday" <= 6)))
);


ALTER TABLE "public"."opening_schedules" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."opening_schedules_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."opening_schedules_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."opening_schedules_id_seq" OWNED BY "public"."opening_schedules"."id";



CREATE TABLE IF NOT EXISTS "public"."profile_interests" (
    "profile_id" "uuid" NOT NULL,
    "interest_id" bigint NOT NULL
);


ALTER TABLE "public"."profile_interests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profile_prompt_template_locales" (
    "id" bigint NOT NULL,
    "template_id" bigint NOT NULL,
    "locale" "text" NOT NULL,
    "title" "text",
    "placeholder" "text",
    "choices_labels" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."profile_prompt_template_locales" OWNER TO "postgres";


ALTER TABLE "public"."profile_prompt_template_locales" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."profile_prompt_template_locales_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."profile_prompt_templates" (
    "id" bigint NOT NULL,
    "question" "text" NOT NULL,
    "category" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "key" "text",
    "type" "text" DEFAULT 'choice'::"text" NOT NULL,
    "choices" "jsonb",
    "max_choices" integer DEFAULT 1 NOT NULL,
    "display_order" integer DEFAULT 0 NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "icon" "text",
    "max_len" integer,
    CONSTRAINT "profile_prompt_templates_category_check" CHECK (("category" = ANY (ARRAY['Icebreaker'::"text", 'Personal'::"text", 'Intereses'::"text", 'Planes'::"text", 'Humor'::"text", 'Esenciales'::"text", 'Sueños'::"text", 'Crecimiento'::"text", 'Inspiración'::"text", 'Citas'::"text"]))),
    CONSTRAINT "profile_prompt_templates_type_check" CHECK (("type" = ANY (ARRAY['choice'::"text", 'text'::"text"])))
);


ALTER TABLE "public"."profile_prompt_templates" OWNER TO "postgres";


ALTER TABLE "public"."profile_prompt_templates" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."profile_prompt_templates_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."profile_prompts" (
    "id" bigint NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "prompt_id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "answer" "jsonb"
);


ALTER TABLE "public"."profile_prompts" OWNER TO "postgres";


ALTER TABLE "public"."profile_prompts" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."profile_prompts_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."prompt_categories" (
    "id" bigint NOT NULL,
    "key" "text" NOT NULL,
    "icon" "text",
    "color" "text",
    "display_order" integer DEFAULT 0 NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."prompt_categories" OWNER TO "postgres";


ALTER TABLE "public"."prompt_categories" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."prompt_categories_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."prompt_interactions" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "prompt_template_id" bigint NOT NULL,
    "action" "text" NOT NULL,
    "choice_key" "text",
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "prompt_interactions_action_check" CHECK (("action" = ANY (ARRAY['view'::"text", 'select'::"text", 'deselect'::"text", 'open_preview'::"text", 'skip_all'::"text"])))
);


ALTER TABLE "public"."prompt_interactions" OWNER TO "postgres";


ALTER TABLE "public"."prompt_interactions" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."prompt_interactions_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE OR REPLACE VIEW "public"."prompt_locale_audit" WITH ("security_invoker"='true') AS
 SELECT "id",
    "key",
    "active",
    (EXISTS ( SELECT 1
           FROM "public"."profile_prompt_template_locales" "l"
          WHERE (("l"."template_id" = "t"."id") AND ("l"."locale" = 'en'::"text")))) AS "has_en",
    (EXISTS ( SELECT 1
           FROM "public"."profile_prompt_template_locales" "l"
          WHERE (("l"."template_id" = "t"."id") AND ("l"."locale" = 'es'::"text")))) AS "has_es",
    (NOT (EXISTS ( SELECT 1
           FROM "public"."profile_prompt_template_locales" "l"
          WHERE (("l"."template_id" = "t"."id") AND ("l"."locale" = 'es'::"text"))))) AS "missing_es"
   FROM "public"."profile_prompt_templates" "t";


ALTER VIEW "public"."prompt_locale_audit" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."prompt_template_categories" (
    "template_id" bigint NOT NULL,
    "category_id" bigint NOT NULL
);


ALTER TABLE "public"."prompt_template_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."push_tokens" (
    "user_id" "uuid" NOT NULL,
    "token" "text" NOT NULL,
    "platform" "public"."platform_type",
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."push_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."remote_config" (
    "key" "text" NOT NULL,
    "value" "jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."remote_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."series_sponsorships" (
    "id" bigint NOT NULL,
    "series_id" bigint NOT NULL,
    "starts_at" timestamp with time zone,
    "ends_at" timestamp with time zone,
    "priority" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."series_sponsorships" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."series_sponsorships_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."series_sponsorships_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."series_sponsorships_id_seq" OWNED BY "public"."series_sponsorships"."id";



CREATE TABLE IF NOT EXISTS "public"."superlike_counters" (
    "user_id" "uuid" NOT NULL,
    "day" "date" NOT NULL,
    "used" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."superlike_counters" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_achievements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "achievement_id" "uuid",
    "current_value" integer DEFAULT 0,
    "progress" integer DEFAULT 0,
    "is_unlocked" boolean DEFAULT false,
    "unlocked_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_achievements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_levels" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "current_level" integer DEFAULT 1,
    "current_xp" integer DEFAULT 0,
    "xp_to_next_level" integer DEFAULT 100,
    "total_xp_earned" integer DEFAULT 0,
    "last_xp_earned_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_levels" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_photos" (
    "id" bigint NOT NULL,
    "user_id" "uuid",
    "url" "text" NOT NULL,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_photos_sort_range" CHECK ((("sort_order" >= 0) AND ("sort_order" <= 5)))
);


ALTER TABLE "public"."user_photos" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."user_photos_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."user_photos_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."user_photos_id_seq" OWNED BY "public"."user_photos"."id";



CREATE TABLE IF NOT EXISTS "public"."user_statistics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "total_matches" integer DEFAULT 0,
    "total_likes" integer DEFAULT 0,
    "total_views" integer DEFAULT 0,
    "total_messages" integer DEFAULT 0,
    "avg_response_time" interval,
    "last_activity" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_statistics" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_feed_occurrences" AS
SELECT
    NULL::bigint AS "id",
    NULL::"text" AS "kind",
    NULL::timestamp with time zone AS "starts_at",
    NULL::timestamp with time zone AS "ends_at",
    NULL::"text" AS "venue",
    NULL::"text" AS "city",
    NULL::"text" AS "title",
    NULL::"text" AS "banner_url",
    NULL::bigint AS "going_count";


ALTER VIEW "public"."v_feed_occurrences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."venue_goals" (
    "venue_id" bigint NOT NULL,
    "promote" boolean DEFAULT false,
    "attract" boolean DEFAULT false,
    "other" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."venue_goals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."venue_staff" (
    "venue_id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."staff_role" DEFAULT 'owner'::"public"."staff_role" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "onboarded_at" timestamp with time zone,
    "verified_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."venue_staff" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."venues" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "city_id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "venue_type" "public"."venue_type" DEFAULT 'nightclub'::"public"."venue_type" NOT NULL,
    "email" "text",
    "phone" "text",
    "category" "public"."venue_category",
    "location_text" "text",
    "description" "text",
    "avatar_url" "text"
);


ALTER TABLE "public"."venues" OWNER TO "postgres";


ALTER TABLE "public"."venues" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."venues_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE ONLY "public"."event_occurrences" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."event_occurrences_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."event_series" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."event_series_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."event_sponsorships" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."event_sponsorships_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."events" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."events_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."interests" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."interests_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."likes" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."likes_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."matches" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."matches_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."messages" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."messages_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."opening_schedules" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."opening_schedules_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."series_sponsorships" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."series_sponsorships_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."user_photos" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."user_photos_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."achievement_templates"
    ADD CONSTRAINT "achievement_templates_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."achievement_templates"
    ADD CONSTRAINT "achievement_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cities"
    ADD CONSTRAINT "cities_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."cities"
    ADD CONSTRAINT "cities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_attendance"
    ADD CONSTRAINT "event_attendance_pkey" PRIMARY KEY ("event_id", "user_id");



ALTER TABLE ONLY "public"."event_checkins"
    ADD CONSTRAINT "event_checkins_pkey" PRIMARY KEY ("event_id", "user_id");



ALTER TABLE ONLY "public"."event_occurrences"
    ADD CONSTRAINT "event_occurrences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_rsvps"
    ADD CONSTRAINT "event_rsvps_pkey" PRIMARY KEY ("occurrence_id", "user_id");



ALTER TABLE ONLY "public"."event_series"
    ADD CONSTRAINT "event_series_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_sponsorships"
    ADD CONSTRAINT "event_sponsorships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."interests"
    ADD CONSTRAINT "interests_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."interests"
    ADD CONSTRAINT "interests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."likes"
    ADD CONSTRAINT "likes_liker_liked_context_event_id_key" UNIQUE ("liker", "liked", "context_event_id");



ALTER TABLE ONLY "public"."likes"
    ADD CONSTRAINT "likes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."match_notes"
    ADD CONSTRAINT "match_notes_pkey" PRIMARY KEY ("match_id", "author");



ALTER TABLE ONLY "public"."match_reads"
    ADD CONSTRAINT "match_reads_pkey" PRIMARY KEY ("match_id", "user_id");



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_user_a_user_b_key" UNIQUE ("user_a", "user_b");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."opening_schedules"
    ADD CONSTRAINT "opening_schedules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profile_interests"
    ADD CONSTRAINT "profile_interests_pkey" PRIMARY KEY ("profile_id", "interest_id");



ALTER TABLE ONLY "public"."profile_prompt_template_locales"
    ADD CONSTRAINT "profile_prompt_template_locales_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profile_prompt_template_locales"
    ADD CONSTRAINT "profile_prompt_template_locales_template_id_locale_key" UNIQUE ("template_id", "locale");



ALTER TABLE ONLY "public"."profile_prompt_templates"
    ADD CONSTRAINT "profile_prompt_templates_key_key" UNIQUE ("key");



ALTER TABLE ONLY "public"."profile_prompt_templates"
    ADD CONSTRAINT "profile_prompt_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profile_prompts"
    ADD CONSTRAINT "profile_prompts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profile_prompts"
    ADD CONSTRAINT "profile_prompts_profile_id_prompt_id_key" UNIQUE ("profile_id", "prompt_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."prompt_categories"
    ADD CONSTRAINT "prompt_categories_key_key" UNIQUE ("key");



ALTER TABLE ONLY "public"."prompt_categories"
    ADD CONSTRAINT "prompt_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."prompt_interactions"
    ADD CONSTRAINT "prompt_interactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."prompt_template_categories"
    ADD CONSTRAINT "prompt_template_categories_pkey" PRIMARY KEY ("template_id", "category_id");



ALTER TABLE ONLY "public"."push_tokens"
    ADD CONSTRAINT "push_tokens_pkey" PRIMARY KEY ("user_id", "token");



ALTER TABLE ONLY "public"."remote_config"
    ADD CONSTRAINT "remote_config_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."series_sponsorships"
    ADD CONSTRAINT "series_sponsorships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."superlike_counters"
    ADD CONSTRAINT "superlike_counters_pkey" PRIMARY KEY ("user_id", "day");



ALTER TABLE ONLY "public"."user_achievements"
    ADD CONSTRAINT "user_achievements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_achievements"
    ADD CONSTRAINT "user_achievements_user_id_achievement_id_key" UNIQUE ("user_id", "achievement_id");



ALTER TABLE ONLY "public"."user_levels"
    ADD CONSTRAINT "user_levels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_levels"
    ADD CONSTRAINT "user_levels_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."user_photos"
    ADD CONSTRAINT "user_photos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_photos"
    ADD CONSTRAINT "user_photos_unique_user_order" UNIQUE ("user_id", "sort_order");



ALTER TABLE ONLY "public"."user_statistics"
    ADD CONSTRAINT "user_statistics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."venue_goals"
    ADD CONSTRAINT "venue_goals_pkey" PRIMARY KEY ("venue_id");



ALTER TABLE ONLY "public"."venue_staff"
    ADD CONSTRAINT "venue_staff_pkey" PRIMARY KEY ("venue_id", "user_id");



ALTER TABLE ONLY "public"."venues"
    ADD CONSTRAINT "venues_name_city_id_key" UNIQUE ("name", "city_id");



ALTER TABLE ONLY "public"."venues"
    ADD CONSTRAINT "venues_pkey" PRIMARY KEY ("id");



CREATE UNIQUE INDEX "cities_slug_country_uidx" ON "public"."cities" USING "btree" ("slug", "country_code") WHERE (("slug" IS NOT NULL) AND ("country_code" IS NOT NULL));



CREATE INDEX "idx_cities_lat" ON "public"."cities" USING "btree" ("lat");



CREATE INDEX "idx_cities_lng" ON "public"."cities" USING "btree" ("lng");



CREATE INDEX "idx_event_checkins_event" ON "public"."event_checkins" USING "btree" ("event_id");



CREATE INDEX "idx_event_checkins_last_seen" ON "public"."event_checkins" USING "btree" ("last_seen_at" DESC);



CREATE INDEX "idx_event_checkins_user" ON "public"."event_checkins" USING "btree" ("user_id");



CREATE INDEX "idx_event_occurrences_city_starts" ON "public"."event_occurrences" USING "btree" ("city", "starts_at") WHERE ("is_published" = true);



CREATE INDEX "idx_event_occurrences_dates" ON "public"."event_occurrences" USING "btree" ("starts_at", "ends_at");



CREATE INDEX "idx_event_occurrences_kind" ON "public"."event_occurrences" USING "btree" ("kind");



CREATE INDEX "idx_event_occurrences_venue_city" ON "public"."event_occurrences" USING "btree" ("venue_id", "city_id");



CREATE INDEX "idx_event_rsvps_user" ON "public"."event_rsvps" USING "btree" ("user_id");



CREATE INDEX "idx_event_sponsorships_active" ON "public"."event_sponsorships" USING "btree" ("event_id", "starts_at", "ends_at", "priority");



CREATE INDEX "idx_events_series_id" ON "public"."events" USING "btree" ("series_id");



CREATE INDEX "idx_events_sponsored" ON "public"."events" USING "btree" ("is_sponsored", "sponsored_priority" DESC);



CREATE INDEX "idx_events_sponsored_until" ON "public"."events" USING "btree" ("sponsored_until") WHERE ("is_sponsored" = true);



CREATE INDEX "idx_events_venue_city" ON "public"."events" USING "btree" ("venue_id", "city_id");



CREATE INDEX "idx_events_venue_status" ON "public"."events" USING "btree" ("venue_id", "status");



CREATE INDEX "idx_likes_liked" ON "public"."likes" USING "btree" ("liked");



CREATE INDEX "idx_likes_liker" ON "public"."likes" USING "btree" ("liker");



CREATE INDEX "idx_likes_liker_liked_created" ON "public"."likes" USING "btree" ("liker", "liked", "created_at" DESC);



CREATE INDEX "idx_match_reads_user" ON "public"."match_reads" USING "btree" ("user_id");



CREATE INDEX "idx_matches_user_a" ON "public"."matches" USING "btree" ("user_a");



CREATE INDEX "idx_matches_user_b" ON "public"."matches" USING "btree" ("user_b");



CREATE INDEX "idx_matches_users" ON "public"."matches" USING "btree" ("user_a", "user_b");



CREATE INDEX "idx_messages_match_created" ON "public"."messages" USING "btree" ("match_id", "created_at" DESC);



CREATE INDEX "idx_opening_schedules_city_weekday" ON "public"."opening_schedules" USING "btree" ("city", "weekday") WHERE ("is_active" = true);



CREATE INDEX "idx_profile_prompts_profile" ON "public"."profile_prompts" USING "btree" ("profile_id");



CREATE INDEX "idx_profiles_calculated_age" ON "public"."profiles" USING "btree" ("calculated_age");



CREATE INDEX "idx_prompt_templates_active_order" ON "public"."profile_prompt_templates" USING "btree" ("active", "display_order", "id");



CREATE INDEX "idx_series_sponsorships_active" ON "public"."series_sponsorships" USING "btree" ("series_id", "starts_at", "ends_at", "priority");



CREATE INDEX "idx_superlike_counters_user_day" ON "public"."superlike_counters" USING "btree" ("user_id", "day");



CREATE INDEX "idx_user_photos_user_sort" ON "public"."user_photos" USING "btree" ("user_id", "sort_order");



CREATE INDEX "idx_venue_staff_user" ON "public"."venue_staff" USING "btree" ("user_id");



CREATE INDEX "idx_venue_staff_venue" ON "public"."venue_staff" USING "btree" ("venue_id");



CREATE INDEX "idx_venues_city" ON "public"."venues" USING "btree" ("city_id");



CREATE INDEX "idx_venues_type" ON "public"."venues" USING "btree" ("venue_type");



CREATE UNIQUE INDEX "messages_client_msg_id_key" ON "public"."messages" USING "btree" ("client_msg_id");



CREATE INDEX "profiles_gender_idx" ON "public"."profiles" USING "btree" ("gender");



CREATE INDEX "profiles_interested_in_gin" ON "public"."profiles" USING "gin" ("interested_in");



CREATE INDEX "profiles_seeking_gin" ON "public"."profiles" USING "gin" ("seeking");



CREATE INDEX "profiles_updated_at_idx" ON "public"."profiles" USING "btree" ("updated_at");



CREATE INDEX "prompt_interactions_action_idx" ON "public"."prompt_interactions" USING "btree" ("action");



CREATE INDEX "prompt_interactions_user_time_idx" ON "public"."prompt_interactions" USING "btree" ("user_id", "occurred_at" DESC);



CREATE UNIQUE INDEX "uniq_matches_pair" ON "public"."matches" USING "btree" (LEAST("user_a", "user_b"), GREATEST("user_a", "user_b"));



CREATE OR REPLACE VIEW "public"."v_feed_occurrences" WITH ("security_invoker"='true') AS
 SELECT "o"."id",
    'occurrence'::"text" AS "kind",
    "o"."starts_at",
    "o"."ends_at",
    "o"."venue",
    "o"."city",
    "e"."title",
    "o"."banner_url",
    "count"("a"."user_id") AS "going_count"
   FROM (("public"."event_occurrences" "o"
     LEFT JOIN "public"."events" "e" ON (("e"."id" = "o"."event_id")))
     LEFT JOIN "public"."event_attendance" "a" ON (("a"."event_id" = "o"."id")))
  WHERE ("o"."is_published" = true)
  GROUP BY "o"."id", "e"."title";



CREATE OR REPLACE TRIGGER "cities_upper_cc" BEFORE INSERT OR UPDATE ON "public"."cities" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_upper_country_code"();



CREATE OR REPLACE TRIGGER "on_like_create" AFTER INSERT ON "public"."likes" FOR EACH ROW EXECUTE FUNCTION "public"."handle_like_create"();



CREATE OR REPLACE TRIGGER "set_profile_prompt_template_locales_updated_at" BEFORE UPDATE ON "public"."profile_prompt_template_locales" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_profile_prompts_updated_at" BEFORE UPDATE ON "public"."profile_prompts" FOR EACH ROW EXECUTE FUNCTION "public"."moddatetime"();



CREATE OR REPLACE TRIGGER "set_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_messages_last_message" AFTER INSERT ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."set_match_last_message_at"();



CREATE OR REPLACE TRIGGER "trg_profile_prompt_templates_updated" BEFORE UPDATE ON "public"."profile_prompt_templates" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_check_achievement_progress" AFTER UPDATE ON "public"."user_achievements" FOR EACH ROW EXECUTE FUNCTION "public"."check_achievement_progress"();



CREATE OR REPLACE TRIGGER "trigger_update_calculated_age" BEFORE INSERT OR UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_calculated_age_trigger"();



CREATE OR REPLACE TRIGGER "trigger_update_profile_completion_achievement" AFTER INSERT OR UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_profile_completion_achievement"();



CREATE OR REPLACE TRIGGER "trigger_update_user_level" AFTER UPDATE ON "public"."user_achievements" FOR EACH ROW EXECUTE FUNCTION "public"."update_user_level"();



CREATE OR REPLACE TRIGGER "trigger_update_user_level" BEFORE UPDATE OF "total_xp_earned" ON "public"."user_levels" FOR EACH ROW WHEN (("old"."total_xp_earned" IS DISTINCT FROM "new"."total_xp_earned")) EXECUTE FUNCTION "public"."update_user_level"();



CREATE OR REPLACE TRIGGER "venue_goals_touch" BEFORE UPDATE ON "public"."venue_goals" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



ALTER TABLE ONLY "public"."event_attendance"
    ADD CONSTRAINT "event_attendance_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_attendance"
    ADD CONSTRAINT "event_attendance_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_checkins"
    ADD CONSTRAINT "event_checkins_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_checkins"
    ADD CONSTRAINT "event_checkins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_occurrences"
    ADD CONSTRAINT "event_occurrences_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id");



ALTER TABLE ONLY "public"."event_occurrences"
    ADD CONSTRAINT "event_occurrences_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_occurrences"
    ADD CONSTRAINT "event_occurrences_opening_schedule_id_fkey" FOREIGN KEY ("opening_schedule_id") REFERENCES "public"."opening_schedules"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_occurrences"
    ADD CONSTRAINT "event_occurrences_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id");



ALTER TABLE ONLY "public"."event_rsvps"
    ADD CONSTRAINT "event_rsvps_occurrence_id_fkey" FOREIGN KEY ("occurrence_id") REFERENCES "public"."event_occurrences"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_series"
    ADD CONSTRAINT "event_series_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_sponsorships"
    ADD CONSTRAINT "event_sponsorships_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "public"."event_series"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id");



ALTER TABLE ONLY "public"."likes"
    ADD CONSTRAINT "likes_context_event_id_fkey" FOREIGN KEY ("context_event_id") REFERENCES "public"."events"("id");



ALTER TABLE ONLY "public"."likes"
    ADD CONSTRAINT "likes_liked_fkey" FOREIGN KEY ("liked") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."likes"
    ADD CONSTRAINT "likes_liker_fkey" FOREIGN KEY ("liker") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."match_notes"
    ADD CONSTRAINT "match_notes_author_fkey" FOREIGN KEY ("author") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."match_notes"
    ADD CONSTRAINT "match_notes_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."match_reads"
    ADD CONSTRAINT "match_reads_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id");



ALTER TABLE ONLY "public"."match_reads"
    ADD CONSTRAINT "match_reads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_created_by_like_id_fkey" FOREIGN KEY ("created_by_like_id") REFERENCES "public"."likes"("id");



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_user_a_fkey" FOREIGN KEY ("user_a") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_user_b_fkey" FOREIGN KEY ("user_b") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_sender_fkey" FOREIGN KEY ("sender") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profile_interests"
    ADD CONSTRAINT "profile_interests_interest_id_fkey" FOREIGN KEY ("interest_id") REFERENCES "public"."interests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profile_interests"
    ADD CONSTRAINT "profile_interests_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profile_prompt_template_locales"
    ADD CONSTRAINT "profile_prompt_template_locales_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."profile_prompt_templates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profile_prompts"
    ADD CONSTRAINT "profile_prompts_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profile_prompts"
    ADD CONSTRAINT "profile_prompts_prompt_id_fkey" FOREIGN KEY ("prompt_id") REFERENCES "public"."profile_prompt_templates"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."prompt_interactions"
    ADD CONSTRAINT "prompt_interactions_prompt_template_id_fkey" FOREIGN KEY ("prompt_template_id") REFERENCES "public"."profile_prompt_templates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."prompt_interactions"
    ADD CONSTRAINT "prompt_interactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."prompt_template_categories"
    ADD CONSTRAINT "prompt_template_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."prompt_categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."prompt_template_categories"
    ADD CONSTRAINT "prompt_template_categories_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."profile_prompt_templates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."push_tokens"
    ADD CONSTRAINT "push_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."series_sponsorships"
    ADD CONSTRAINT "series_sponsorships_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "public"."event_series"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."superlike_counters"
    ADD CONSTRAINT "superlike_counters_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_achievements"
    ADD CONSTRAINT "user_achievements_achievement_id_fkey" FOREIGN KEY ("achievement_id") REFERENCES "public"."achievement_templates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_achievements"
    ADD CONSTRAINT "user_achievements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_levels"
    ADD CONSTRAINT "user_levels_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_photos"
    ADD CONSTRAINT "user_photos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_statistics"
    ADD CONSTRAINT "user_statistics_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."venue_goals"
    ADD CONSTRAINT "venue_goals_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."venue_staff"
    ADD CONSTRAINT "venue_staff_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."venue_staff"
    ADD CONSTRAINT "venue_staff_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."venues"
    ADD CONSTRAINT "venues_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id");



CREATE POLICY "Achievement templates are viewable by all authenticated users" ON "public"."achievement_templates" FOR SELECT USING ((( SELECT "auth"."role"() AS "role") = 'authenticated'::"text"));



CREATE POLICY "Enable read access for all users" ON "public"."venues" FOR SELECT USING (true);



CREATE POLICY "Event series are viewable by everyone" ON "public"."event_series" FOR SELECT USING (true);



CREATE POLICY "Event sponsorships are viewable by everyone" ON "public"."event_sponsorships" FOR SELECT USING (true);



CREATE POLICY "Events are viewable by everyone" ON "public"."events" FOR SELECT USING (true);



CREATE POLICY "Series sponsorships are viewable by everyone" ON "public"."series_sponsorships" FOR SELECT USING (true);



CREATE POLICY "System can update user achievements" ON "public"."user_achievements" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "System can update user levels" ON "public"."user_levels" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "System can update user statistics" ON "public"."user_statistics" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view their own achievements" ON "public"."user_achievements" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view their own levels" ON "public"."user_levels" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view their own statistics" ON "public"."user_statistics" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."achievement_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cities" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cities_select_all" ON "public"."cities" FOR SELECT USING (true);



CREATE POLICY "delete_own_token" ON "public"."push_tokens" FOR DELETE USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."event_attendance" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "event_attendance_insert_self2" ON "public"."event_attendance" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "event_attendance_select_all" ON "public"."event_attendance" FOR SELECT USING (true);



CREATE POLICY "event_attendance_update_self2" ON "public"."event_attendance" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."event_checkins" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_occurrences" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "event_occurrences_delete_admin" ON "public"."event_occurrences" FOR DELETE TO "authenticated" USING (( SELECT "profiles"."is_admin"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "event_occurrences_update_admin" ON "public"."event_occurrences" FOR UPDATE TO "authenticated" USING (( SELECT "profiles"."is_admin"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")))) WITH CHECK (( SELECT "profiles"."is_admin"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = ( SELECT "auth"."uid"() AS "uid"))));



ALTER TABLE "public"."event_rsvps" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "event_rsvps_cud_own" ON "public"."event_rsvps" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."event_series" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_sponsorships" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "events_select" ON "public"."events" FOR SELECT USING (true);



CREATE POLICY "events_select_published" ON "public"."events" FOR SELECT USING (("status" = 'published'::"text"));



CREATE POLICY "insert_own_token" ON "public"."push_tokens" FOR INSERT WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."interests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "interests_update_admin" ON "public"."interests" FOR UPDATE TO "authenticated" USING (( SELECT "profiles"."is_admin"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")))) WITH CHECK (( SELECT "profiles"."is_admin"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = ( SELECT "auth"."uid"() AS "uid"))));



ALTER TABLE "public"."likes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "likes_delete" ON "public"."likes" FOR DELETE TO "authenticated" USING ((("auth"."uid"() = "liker") AND ("liker" = ( SELECT "auth"."uid"() AS "uid"))));



ALTER TABLE "public"."match_notes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."match_reads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."matches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "occurrences_select" ON "public"."event_occurrences" FOR SELECT USING (("is_published" = true));



ALTER TABLE "public"."opening_schedules" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "opening_schedules_update_admin" ON "public"."opening_schedules" FOR UPDATE TO "authenticated" USING (( SELECT "profiles"."is_admin"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")))) WITH CHECK (( SELECT "profiles"."is_admin"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = ( SELECT "auth"."uid"() AS "uid"))));



ALTER TABLE "public"."profile_interests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profile_interests_cud" ON "public"."profile_interests" USING (("profile_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("profile_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."profile_prompt_template_locales" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profile_prompt_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profile_prompts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_insert" ON "public"."profiles" FOR INSERT WITH CHECK ((("auth"."uid"() = "id") AND ("id" = ( SELECT "auth"."uid"() AS "uid"))));



ALTER TABLE "public"."prompt_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."prompt_interactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."prompt_template_categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "prompt_template_locales_select" ON "public"."profile_prompt_template_locales" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "prompt_templates_select_all" ON "public"."profile_prompt_templates" FOR SELECT TO "authenticated" USING ("active");



ALTER TABLE "public"."push_tokens" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "read all profiles" ON "public"."profiles" FOR SELECT USING (true);



CREATE POLICY "read flags" ON "public"."remote_config" FOR SELECT USING (true);



CREATE POLICY "read_own_venue_staff" ON "public"."venue_staff" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "read_prompt_categories_authenticated" ON "public"."prompt_categories" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "read_prompt_template_categories_authenticated" ON "public"."prompt_template_categories" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "read_venue_goals_as_staff" ON "public"."venue_goals" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."venue_staff" "vs"
  WHERE (("vs"."venue_id" = "venue_goals"."venue_id") AND ("vs"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("vs"."active" = true)))));



ALTER TABLE "public"."remote_config" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "rls_cities_delete_700633a1_merged" ON "public"."cities" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "rls_cities_select_700633a1_merged" ON "public"."cities" FOR SELECT TO "authenticated" USING ((true OR true OR true));



CREATE POLICY "rls_cities_select_85c9da30_merged" ON "public"."cities" FOR SELECT;



CREATE POLICY "rls_cities_update_700633a1_merged" ON "public"."cities" FOR UPDATE TO "authenticated" WITH CHECK (true);



CREATE POLICY "rls_event_attendance_delete_700633a1_merged" ON "public"."event_attendance" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "rls_event_attendance_select_700633a1_merged" ON "public"."event_attendance" FOR SELECT TO "authenticated" USING ((true OR true));



CREATE POLICY "rls_event_attendance_select_85c9da30_merged" ON "public"."event_attendance" FOR SELECT USING (true);



CREATE POLICY "rls_event_attendance_update_700633a1_merged" ON "public"."event_attendance" FOR UPDATE TO "authenticated" WITH CHECK (("user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")));



CREATE POLICY "rls_event_checkins_select_700633a1_merged" ON "public"."event_checkins" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")));



CREATE POLICY "rls_event_occurrences_select_700633a1_merged" ON "public"."event_occurrences" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "rls_event_occurrences_select_85c9da30_merged" ON "public"."event_occurrences" FOR SELECT;



CREATE POLICY "rls_events_delete_700633a1_merged" ON "public"."events" FOR DELETE TO "authenticated" USING ((( SELECT "profiles"."is_admin"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid"))) OR true));



CREATE POLICY "rls_events_select_700633a1_merged" ON "public"."events" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."venue_staff" "vs"
  WHERE (("vs"."venue_id" = "events"."venue_id") AND ("vs"."user_id" = ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid")) AND ("vs"."role" = 'owner'::"public"."staff_role")))) OR true OR true));



CREATE POLICY "rls_events_select_85c9da30_merged" ON "public"."events" FOR SELECT USING (true);



CREATE POLICY "rls_events_update_700633a1_merged" ON "public"."events" FOR UPDATE TO "authenticated" WITH CHECK (( SELECT "profiles"."is_admin"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid"))));



CREATE POLICY "rls_interests_delete_700633a1_merged" ON "public"."interests" FOR DELETE TO "authenticated" USING ((( SELECT "profiles"."is_admin"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid"))) OR true));



CREATE POLICY "rls_likes_select_700633a1_merged" ON "public"."likes" FOR SELECT TO "authenticated" USING (((((( SELECT "auth"."uid"() AS "uid") = "liker") OR (( SELECT "auth"."uid"() AS "uid") = "liked")) AND ((( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") = "liker") OR (( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") = "liked"))) OR true));



CREATE POLICY "rls_match_notes_select_700633a1_merged" ON "public"."match_notes" FOR SELECT TO "authenticated" USING ((("author" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")) OR true));



CREATE POLICY "rls_match_reads_delete_700633a1_merged" ON "public"."match_reads" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "rls_match_reads_select_700633a1_merged" ON "public"."match_reads" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid")) OR true OR true));



CREATE POLICY "rls_match_reads_update_700633a1_merged" ON "public"."match_reads" FOR UPDATE TO "authenticated" WITH CHECK (("user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")));



CREATE POLICY "rls_matches_select_700633a1_merged" ON "public"."matches" FOR SELECT TO "authenticated" USING (((( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") = "user_a") OR (( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") = "user_b") OR true));



CREATE POLICY "rls_messages_select_700633a1_merged" ON "public"."messages" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."matches" "m"
  WHERE (("m"."id" = "messages"."match_id") AND ((( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") = "m"."user_a") OR (( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") = "m"."user_b"))))) OR true));



CREATE POLICY "rls_opening_schedules_select_700633a1_merged" ON "public"."opening_schedules" FOR SELECT TO "authenticated" USING ((true OR true));



CREATE POLICY "rls_profile_prompts_select_700633a1_merged" ON "public"."profile_prompts" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "rls_profiles_select_700633a1_merged" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((("id" = ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid")) OR (EXISTS ( SELECT 1
   FROM ("public"."event_attendance" "ea1"
     JOIN "public"."event_attendance" "ea2" ON (("ea1"."event_id" = "ea2"."event_id")))
  WHERE (("ea1"."user_id" = "profiles"."id") AND ("ea2"."user_id" = ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid"))))) OR true));



CREATE POLICY "rls_profiles_select_85c9da30_merged" ON "public"."profiles" FOR SELECT USING (true);



CREATE POLICY "rls_prompt_interactions_select_700633a1_merged" ON "public"."prompt_interactions" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")) OR true));



CREATE POLICY "rls_push_tokens_delete_85c9da30_merged" ON "public"."push_tokens" FOR DELETE;



CREATE POLICY "rls_push_tokens_select_85c9da30_merged" ON "public"."push_tokens" FOR SELECT;



CREATE POLICY "rls_superlike_counters_select_700633a1_merged" ON "public"."superlike_counters" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")) OR true));



CREATE POLICY "rls_user_photos_delete_700633a1_merged" ON "public"."user_photos" FOR DELETE TO "authenticated" USING (("user_id" = ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid")));



CREATE POLICY "rls_user_photos_delete_85c9da30_merged" ON "public"."user_photos" FOR DELETE USING (true);



CREATE POLICY "rls_user_photos_select_700633a1_merged" ON "public"."user_photos" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "rls_user_photos_select_85c9da30_merged" ON "public"."user_photos" FOR SELECT USING (true);



CREATE POLICY "rls_venues_select_700633a1_merged" ON "public"."venues" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "rls_venues_select_85c9da30_merged" ON "public"."venues" FOR SELECT USING (true);



CREATE POLICY "select_own_tokens" ON "public"."push_tokens" FOR SELECT USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."series_sponsorships" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."superlike_counters" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "update own counters" ON "public"."superlike_counters" FOR UPDATE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "update own matches" ON "public"."matches" FOR UPDATE TO "authenticated" USING ((("user_a" = ( SELECT "auth"."uid"() AS "uid")) OR ("user_b" = ( SELECT "auth"."uid"() AS "uid")))) WITH CHECK ((("user_a" = ( SELECT "auth"."uid"() AS "uid")) OR ("user_b" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "update own notes" ON "public"."match_notes" FOR UPDATE TO "authenticated" USING (("author" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("author" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."user_achievements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_levels" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_photos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_photos_cud" ON "public"."user_photos" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "user_photos_delete" ON "public"."user_photos" FOR DELETE USING (((( SELECT "auth"."uid"() AS "uid"))::"text" = ("user_id")::"text"));



CREATE POLICY "user_photos_insert" ON "public"."user_photos" WITH CHECK (((( SELECT "auth"."uid"() AS "uid"))::"text" = ("user_id")::"text"));



CREATE POLICY "user_photos_select" ON "public"."user_photos" FOR SELECT USING (true);



CREATE POLICY "user_photos_update" ON "public"."user_photos" USING (((( SELECT "auth"."uid"() AS "uid"))::"text" = ("user_id")::"text"));



ALTER TABLE "public"."user_statistics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."venue_goals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."venue_staff" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."venues" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."archive_inactive_matches"("older_than" interval) TO "anon";
GRANT ALL ON FUNCTION "public"."archive_inactive_matches"("older_than" interval) TO "authenticated";
GRANT ALL ON FUNCTION "public"."archive_inactive_matches"("older_than" interval) TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_age"("birth_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_age"("birth_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_age"("birth_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_age_immutable"("birthdate" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_age_immutable"("birthdate" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_age_immutable"("birthdate" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_level"("xp" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_level"("xp" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_level"("xp" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."check_achievement_progress"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_achievement_progress"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_achievement_progress"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_upper_country_code"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_upper_country_code"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_upper_country_code"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_event_presence"("event_ids" bigint[], "recent_minutes" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_event_presence"("event_ids" bigint[], "recent_minutes" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_event_presence"("event_ids" bigint[], "recent_minutes" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_feed_occurrences"("p_city" "text", "p_from_ts" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_feed_occurrences"("p_city" "text", "p_from_ts" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_feed_occurrences"("p_city" "text", "p_from_ts" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_open_today"("p_city" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_open_today"("p_city" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_open_today"("p_city" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_like_create"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_like_create"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_like_create"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_match"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_match"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_match"() TO "service_role";



GRANT ALL ON FUNCTION "public"."initialize_user_gamification"() TO "anon";
GRANT ALL ON FUNCTION "public"."initialize_user_gamification"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."initialize_user_gamification"() TO "service_role";



GRANT ALL ON FUNCTION "public"."join_event"("p_event" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."join_event"("p_event" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."join_event"("p_event" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."leave_event"("p_event" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."leave_event"("p_event" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."leave_event"("p_event" integer) TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."public_profile_public" TO "anon";
GRANT ALL ON TABLE "public"."public_profile_public" TO "authenticated";
GRANT ALL ON TABLE "public"."public_profile_public" TO "service_role";



GRANT ALL ON FUNCTION "public"."match_profiles"("_viewer" "uuid", "_limit" integer, "_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."match_profiles"("_viewer" "uuid", "_limit" integer, "_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_profiles"("_viewer" "uuid", "_limit" integer, "_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."migrate_venue_data"() TO "anon";
GRANT ALL ON FUNCTION "public"."migrate_venue_data"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."migrate_venue_data"() TO "service_role";



GRANT ALL ON FUNCTION "public"."moddatetime"() TO "anon";
GRANT ALL ON FUNCTION "public"."moddatetime"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."moddatetime"() TO "service_role";



GRANT ALL ON FUNCTION "public"."owner_onboarding_upsert"("p_user_id" "uuid", "p_name" "text", "p_email" "text", "p_phone" "text", "p_category" "public"."venue_category", "p_city_id" bigint, "p_location_text" "text", "p_description" "text", "p_avatar_url" "text", "p_promote" boolean, "p_attract" boolean, "p_other" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."owner_onboarding_upsert"("p_user_id" "uuid", "p_name" "text", "p_email" "text", "p_phone" "text", "p_category" "public"."venue_category", "p_city_id" bigint, "p_location_text" "text", "p_description" "text", "p_avatar_url" "text", "p_promote" boolean, "p_attract" boolean, "p_other" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."owner_onboarding_upsert"("p_user_id" "uuid", "p_name" "text", "p_email" "text", "p_phone" "text", "p_category" "public"."venue_category", "p_city_id" bigint, "p_location_text" "text", "p_description" "text", "p_avatar_url" "text", "p_promote" boolean, "p_attract" boolean, "p_other" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."owner_state"() TO "anon";
GRANT ALL ON FUNCTION "public"."owner_state"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."owner_state"() TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON FUNCTION "public"."send_message_idempotent"("p_match_id" bigint, "p_sender" "uuid", "p_content" "text", "p_client_msg_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."send_message_idempotent"("p_match_id" bigint, "p_sender" "uuid", "p_content" "text", "p_client_msg_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."send_message_idempotent"("p_match_id" bigint, "p_sender" "uuid", "p_content" "text", "p_client_msg_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_match_last_message_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_match_last_message_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_match_last_message_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."slugify_prompt"("txt" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."slugify_prompt"("txt" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."slugify_prompt"("txt" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."undo_last_decision"("p_event_id" integer, "p_target" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."undo_last_decision"("p_event_id" integer, "p_target" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."undo_last_decision"("p_event_id" integer, "p_target" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."undo_last_decision"("p_event_id" integer, "p_target" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_calculated_age_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_calculated_age_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_calculated_age_trigger"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_profile_completion_achievement"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_profile_completion_achievement"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_profile_completion_achievement"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_level"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_level"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_level"() TO "service_role";



GRANT ALL ON TABLE "public"."achievement_templates" TO "anon";
GRANT ALL ON TABLE "public"."achievement_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."achievement_templates" TO "service_role";



GRANT ALL ON TABLE "public"."match_reads" TO "anon";
GRANT ALL ON TABLE "public"."match_reads" TO "authenticated";
GRANT ALL ON TABLE "public"."match_reads" TO "service_role";



GRANT ALL ON TABLE "public"."matches" TO "anon";
GRANT ALL ON TABLE "public"."matches" TO "authenticated";
GRANT ALL ON TABLE "public"."matches" TO "service_role";



GRANT ALL ON TABLE "public"."active_matches" TO "anon";
GRANT ALL ON TABLE "public"."active_matches" TO "authenticated";
GRANT ALL ON TABLE "public"."active_matches" TO "service_role";



GRANT ALL ON TABLE "public"."cities" TO "anon";
GRANT ALL ON TABLE "public"."cities" TO "authenticated";
GRANT ALL ON TABLE "public"."cities" TO "service_role";



GRANT ALL ON SEQUENCE "public"."cities_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."cities_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."cities_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."event_attendance" TO "anon";
GRANT ALL ON TABLE "public"."event_attendance" TO "authenticated";
GRANT ALL ON TABLE "public"."event_attendance" TO "service_role";



GRANT ALL ON TABLE "public"."event_checkins" TO "anon";
GRANT ALL ON TABLE "public"."event_checkins" TO "authenticated";
GRANT ALL ON TABLE "public"."event_checkins" TO "service_role";



GRANT ALL ON TABLE "public"."event_occurrences" TO "anon";
GRANT ALL ON TABLE "public"."event_occurrences" TO "authenticated";
GRANT ALL ON TABLE "public"."event_occurrences" TO "service_role";



GRANT ALL ON SEQUENCE "public"."event_occurrences_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."event_occurrences_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."event_occurrences_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."event_rsvps" TO "anon";
GRANT ALL ON TABLE "public"."event_rsvps" TO "authenticated";
GRANT ALL ON TABLE "public"."event_rsvps" TO "service_role";



GRANT ALL ON TABLE "public"."event_series" TO "anon";
GRANT ALL ON TABLE "public"."event_series" TO "authenticated";
GRANT ALL ON TABLE "public"."event_series" TO "service_role";



GRANT ALL ON SEQUENCE "public"."event_series_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."event_series_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."event_series_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."event_sponsorships" TO "anon";
GRANT ALL ON TABLE "public"."event_sponsorships" TO "authenticated";
GRANT ALL ON TABLE "public"."event_sponsorships" TO "service_role";



GRANT ALL ON SEQUENCE "public"."event_sponsorships_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."event_sponsorships_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."event_sponsorships_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."events" TO "anon";
GRANT ALL ON TABLE "public"."events" TO "authenticated";
GRANT ALL ON TABLE "public"."events" TO "service_role";



GRANT ALL ON SEQUENCE "public"."events_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."events_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."events_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."interests" TO "anon";
GRANT ALL ON TABLE "public"."interests" TO "authenticated";
GRANT ALL ON TABLE "public"."interests" TO "service_role";



GRANT ALL ON SEQUENCE "public"."interests_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."interests_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."interests_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."likes" TO "anon";
GRANT ALL ON TABLE "public"."likes" TO "authenticated";
GRANT ALL ON TABLE "public"."likes" TO "service_role";



GRANT ALL ON SEQUENCE "public"."likes_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."likes_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."likes_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."match_notes" TO "anon";
GRANT ALL ON TABLE "public"."match_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."match_notes" TO "service_role";



GRANT ALL ON SEQUENCE "public"."matches_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."matches_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."matches_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."messages_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."messages_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."messages_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."opening_schedules" TO "anon";
GRANT ALL ON TABLE "public"."opening_schedules" TO "authenticated";
GRANT ALL ON TABLE "public"."opening_schedules" TO "service_role";



GRANT ALL ON SEQUENCE "public"."opening_schedules_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."opening_schedules_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."opening_schedules_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."profile_interests" TO "anon";
GRANT ALL ON TABLE "public"."profile_interests" TO "authenticated";
GRANT ALL ON TABLE "public"."profile_interests" TO "service_role";



GRANT ALL ON TABLE "public"."profile_prompt_template_locales" TO "anon";
GRANT ALL ON TABLE "public"."profile_prompt_template_locales" TO "authenticated";
GRANT ALL ON TABLE "public"."profile_prompt_template_locales" TO "service_role";



GRANT ALL ON SEQUENCE "public"."profile_prompt_template_locales_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."profile_prompt_template_locales_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."profile_prompt_template_locales_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."profile_prompt_templates" TO "anon";
GRANT ALL ON TABLE "public"."profile_prompt_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."profile_prompt_templates" TO "service_role";



GRANT ALL ON SEQUENCE "public"."profile_prompt_templates_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."profile_prompt_templates_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."profile_prompt_templates_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."profile_prompts" TO "anon";
GRANT ALL ON TABLE "public"."profile_prompts" TO "authenticated";
GRANT ALL ON TABLE "public"."profile_prompts" TO "service_role";



GRANT ALL ON SEQUENCE "public"."profile_prompts_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."profile_prompts_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."profile_prompts_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."prompt_categories" TO "anon";
GRANT ALL ON TABLE "public"."prompt_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."prompt_categories" TO "service_role";



GRANT ALL ON SEQUENCE "public"."prompt_categories_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."prompt_categories_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."prompt_categories_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."prompt_interactions" TO "anon";
GRANT ALL ON TABLE "public"."prompt_interactions" TO "authenticated";
GRANT ALL ON TABLE "public"."prompt_interactions" TO "service_role";



GRANT ALL ON SEQUENCE "public"."prompt_interactions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."prompt_interactions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."prompt_interactions_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."prompt_locale_audit" TO "anon";
GRANT ALL ON TABLE "public"."prompt_locale_audit" TO "authenticated";
GRANT ALL ON TABLE "public"."prompt_locale_audit" TO "service_role";



GRANT ALL ON TABLE "public"."prompt_template_categories" TO "anon";
GRANT ALL ON TABLE "public"."prompt_template_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."prompt_template_categories" TO "service_role";



GRANT ALL ON TABLE "public"."push_tokens" TO "anon";
GRANT ALL ON TABLE "public"."push_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."push_tokens" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."remote_config" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."remote_config" TO "authenticated";
GRANT ALL ON TABLE "public"."remote_config" TO "service_role";



GRANT ALL ON TABLE "public"."series_sponsorships" TO "anon";
GRANT ALL ON TABLE "public"."series_sponsorships" TO "authenticated";
GRANT ALL ON TABLE "public"."series_sponsorships" TO "service_role";



GRANT ALL ON SEQUENCE "public"."series_sponsorships_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."series_sponsorships_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."series_sponsorships_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."superlike_counters" TO "anon";
GRANT ALL ON TABLE "public"."superlike_counters" TO "authenticated";
GRANT ALL ON TABLE "public"."superlike_counters" TO "service_role";



GRANT ALL ON TABLE "public"."user_achievements" TO "anon";
GRANT ALL ON TABLE "public"."user_achievements" TO "authenticated";
GRANT ALL ON TABLE "public"."user_achievements" TO "service_role";



GRANT ALL ON TABLE "public"."user_levels" TO "anon";
GRANT ALL ON TABLE "public"."user_levels" TO "authenticated";
GRANT ALL ON TABLE "public"."user_levels" TO "service_role";



GRANT ALL ON TABLE "public"."user_photos" TO "anon";
GRANT ALL ON TABLE "public"."user_photos" TO "authenticated";
GRANT ALL ON TABLE "public"."user_photos" TO "service_role";



GRANT ALL ON SEQUENCE "public"."user_photos_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."user_photos_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."user_photos_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."user_statistics" TO "anon";
GRANT ALL ON TABLE "public"."user_statistics" TO "authenticated";
GRANT ALL ON TABLE "public"."user_statistics" TO "service_role";



GRANT ALL ON TABLE "public"."v_feed_occurrences" TO "anon";
GRANT ALL ON TABLE "public"."v_feed_occurrences" TO "authenticated";
GRANT ALL ON TABLE "public"."v_feed_occurrences" TO "service_role";



GRANT ALL ON TABLE "public"."venue_goals" TO "anon";
GRANT ALL ON TABLE "public"."venue_goals" TO "authenticated";
GRANT ALL ON TABLE "public"."venue_goals" TO "service_role";



GRANT ALL ON TABLE "public"."venue_staff" TO "anon";
GRANT ALL ON TABLE "public"."venue_staff" TO "authenticated";
GRANT ALL ON TABLE "public"."venue_staff" TO "service_role";



GRANT ALL ON TABLE "public"."venues" TO "anon";
GRANT ALL ON TABLE "public"."venues" TO "authenticated";
GRANT ALL ON TABLE "public"."venues" TO "service_role";



GRANT ALL ON SEQUENCE "public"."venues_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."venues_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."venues_id_seq" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







RESET ALL;

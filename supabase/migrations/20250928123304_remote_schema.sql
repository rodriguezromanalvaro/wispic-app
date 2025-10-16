-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.achievement_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code character varying NOT NULL UNIQUE,
  title character varying NOT NULL,
  description text NOT NULL,
  icon character varying NOT NULL,
  reward_type character varying NOT NULL,
  reward_value character varying NOT NULL,
  required_value integer NOT NULL,
  category character varying NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT achievement_templates_pkey PRIMARY KEY (id)
);
CREATE TABLE public.cities (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  name text NOT NULL UNIQUE,
  country text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  lat double precision,
  lng double precision,
  slug text,
  country_code text,
  lon numeric,
  CONSTRAINT cities_pkey PRIMARY KEY (id)
);
CREATE TABLE public.event_attendance (
  event_id bigint NOT NULL,
  user_id uuid NOT NULL,
  status text NOT NULL CHECK (status = ANY (ARRAY['going'::text, 'interested'::text])),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT event_attendance_pkey PRIMARY KEY (event_id, user_id),
  CONSTRAINT event_attendance_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id),
  CONSTRAINT event_attendance_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.event_checkins (
  event_id bigint NOT NULL,
  user_id uuid NOT NULL,
  last_seen_at timestamp with time zone NOT NULL DEFAULT now(),
  method text NOT NULL DEFAULT 'manual'::text,
  verified boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT event_checkins_pkey PRIMARY KEY (event_id, user_id),
  CONSTRAINT event_checkins_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id),
  CONSTRAINT event_checkins_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.event_occurrences (
  id bigint NOT NULL DEFAULT nextval('event_occurrences_id_seq'::regclass),
  event_id bigint,
  opening_schedule_id bigint,
  venue text NOT NULL,
  city text NOT NULL,
  title text,
  banner_url text,
  kind text NOT NULL CHECK (kind = ANY (ARRAY['event'::text, 'recurring'::text])),
  starts_at timestamp with time zone NOT NULL,
  ends_at timestamp with time zone,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  venue_id bigint,
  city_id bigint,
  CONSTRAINT event_occurrences_pkey PRIMARY KEY (id),
  CONSTRAINT event_occurrences_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id),
  CONSTRAINT event_occurrences_opening_schedule_id_fkey FOREIGN KEY (opening_schedule_id) REFERENCES public.opening_schedules(id),
  CONSTRAINT event_occurrences_venue_id_fkey FOREIGN KEY (venue_id) REFERENCES public.venues(id),
  CONSTRAINT event_occurrences_city_id_fkey FOREIGN KEY (city_id) REFERENCES public.cities(id)
);
CREATE TABLE public.event_rsvps (
  occurrence_id bigint NOT NULL,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'going'::text CHECK (status = ANY (ARRAY['going'::text, 'cancelled'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT event_rsvps_pkey PRIMARY KEY (occurrence_id, user_id),
  CONSTRAINT event_rsvps_occurrence_id_fkey FOREIGN KEY (occurrence_id) REFERENCES public.event_occurrences(id)
);
CREATE TABLE public.event_series (
  id bigint NOT NULL DEFAULT nextval('event_series_id_seq'::regclass),
  venue_id bigint NOT NULL,
  title text NOT NULL,
  recurrence_rule text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT event_series_pkey PRIMARY KEY (id),
  CONSTRAINT event_series_venue_id_fkey FOREIGN KEY (venue_id) REFERENCES public.venues(id)
);
CREATE TABLE public.event_sponsorships (
  id bigint NOT NULL DEFAULT nextval('event_sponsorships_id_seq'::regclass),
  event_id bigint NOT NULL,
  starts_at timestamp with time zone,
  ends_at timestamp with time zone,
  priority integer NOT NULL DEFAULT 1,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT event_sponsorships_pkey PRIMARY KEY (id),
  CONSTRAINT event_sponsorships_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id)
);
CREATE TABLE public.events (
  id bigint NOT NULL DEFAULT nextval('events_id_seq'::regclass),
  title text NOT NULL,
  description text,
  start_at timestamp with time zone NOT NULL,
  venue text,
  city text,
  cover_url text,
  created_at timestamp with time zone DEFAULT now(),
  venue_id bigint,
  city_id bigint,
  is_sponsored boolean NOT NULL DEFAULT false,
  sponsored_until timestamp with time zone,
  sponsored_priority integer DEFAULT 0,
  series_id bigint,
  status text NOT NULL DEFAULT 'published'::text CHECK (status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text])),
  published_at timestamp with time zone,
  CONSTRAINT events_pkey PRIMARY KEY (id),
  CONSTRAINT events_venue_id_fkey FOREIGN KEY (venue_id) REFERENCES public.venues(id),
  CONSTRAINT events_city_id_fkey FOREIGN KEY (city_id) REFERENCES public.cities(id),
  CONSTRAINT events_series_id_fkey FOREIGN KEY (series_id) REFERENCES public.event_series(id)
);
CREATE TABLE public.interests (
  id bigint NOT NULL DEFAULT nextval('interests_id_seq'::regclass),
  name text NOT NULL UNIQUE,
  CONSTRAINT interests_pkey PRIMARY KEY (id)
);
CREATE TABLE public.likes (
  id bigint NOT NULL DEFAULT nextval('likes_id_seq'::regclass),
  liker uuid NOT NULL,
  liked uuid NOT NULL,
  context_event_id bigint,
  created_at timestamp with time zone DEFAULT now(),
  type USER-DEFINED NOT NULL DEFAULT 'like'::like_type,
  CONSTRAINT likes_pkey PRIMARY KEY (id),
  CONSTRAINT likes_liker_fkey FOREIGN KEY (liker) REFERENCES auth.users(id),
  CONSTRAINT likes_liked_fkey FOREIGN KEY (liked) REFERENCES auth.users(id),
  CONSTRAINT likes_context_event_id_fkey FOREIGN KEY (context_event_id) REFERENCES public.events(id)
);
CREATE TABLE public.match_notes (
  match_id bigint NOT NULL,
  author uuid NOT NULL,
  note text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT match_notes_pkey PRIMARY KEY (match_id, author),
  CONSTRAINT match_notes_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.matches(id),
  CONSTRAINT match_notes_author_fkey FOREIGN KEY (author) REFERENCES auth.users(id)
);
CREATE TABLE public.match_reads (
  match_id bigint NOT NULL,
  user_id uuid NOT NULL,
  last_read_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT match_reads_pkey PRIMARY KEY (match_id, user_id),
  CONSTRAINT match_reads_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.matches(id),
  CONSTRAINT match_reads_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.matches (
  id bigint NOT NULL DEFAULT nextval('matches_id_seq'::regclass),
  user_a uuid NOT NULL,
  user_b uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  created_by_like_id bigint,
  superlike boolean NOT NULL DEFAULT false,
  last_message_at timestamp with time zone,
  CONSTRAINT matches_pkey PRIMARY KEY (id),
  CONSTRAINT matches_user_a_fkey FOREIGN KEY (user_a) REFERENCES auth.users(id),
  CONSTRAINT matches_user_b_fkey FOREIGN KEY (user_b) REFERENCES auth.users(id),
  CONSTRAINT matches_created_by_like_id_fkey FOREIGN KEY (created_by_like_id) REFERENCES public.likes(id)
);
CREATE TABLE public.messages (
  id bigint NOT NULL DEFAULT nextval('messages_id_seq'::regclass),
  match_id bigint NOT NULL,
  sender uuid NOT NULL,
  content text,
  image_url text,
  created_at timestamp with time zone DEFAULT now(),
  client_msg_id uuid,
  CONSTRAINT messages_pkey PRIMARY KEY (id),
  CONSTRAINT messages_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.matches(id),
  CONSTRAINT messages_sender_fkey FOREIGN KEY (sender) REFERENCES auth.users(id)
);
CREATE TABLE public.opening_schedules (
  id bigint NOT NULL DEFAULT nextval('opening_schedules_id_seq'::regclass),
  venue text NOT NULL,
  city text NOT NULL,
  weekday integer NOT NULL CHECK (weekday >= 0 AND weekday <= 6),
  open_time time without time zone NOT NULL,
  close_time time without time zone,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT opening_schedules_pkey PRIMARY KEY (id)
);
CREATE TABLE public.profile_interests (
  profile_id uuid NOT NULL,
  interest_id bigint NOT NULL,
  CONSTRAINT profile_interests_pkey PRIMARY KEY (profile_id, interest_id),
  CONSTRAINT profile_interests_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES auth.users(id),
  CONSTRAINT profile_interests_interest_id_fkey FOREIGN KEY (interest_id) REFERENCES public.interests(id)
);
CREATE TABLE public.profile_prompt_template_locales (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  template_id bigint NOT NULL,
  locale text NOT NULL,
  title text,
  placeholder text,
  choices_labels jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT profile_prompt_template_locales_pkey PRIMARY KEY (id),
  CONSTRAINT profile_prompt_template_locales_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.profile_prompt_templates(id)
);
CREATE TABLE public.profile_prompt_templates (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  question text NOT NULL,
  category text CHECK (category = ANY (ARRAY['Icebreaker'::text, 'Personal'::text, 'Intereses'::text, 'Planes'::text, 'Humor'::text, 'Esenciales'::text, 'Sueños'::text, 'Crecimiento'::text, 'Inspiración'::text, 'Citas'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  key text UNIQUE,
  type text NOT NULL DEFAULT 'choice'::text CHECK (type = ANY (ARRAY['choice'::text, 'text'::text])),
  choices jsonb,
  max_choices integer NOT NULL DEFAULT 1,
  display_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  icon text,
  max_len integer,
  CONSTRAINT profile_prompt_templates_pkey PRIMARY KEY (id)
);
CREATE TABLE public.profile_prompts (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  profile_id uuid NOT NULL,
  prompt_id bigint NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  answer jsonb,
  CONSTRAINT profile_prompts_pkey PRIMARY KEY (id),
  CONSTRAINT profile_prompts_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id),
  CONSTRAINT profile_prompts_prompt_id_fkey FOREIGN KEY (prompt_id) REFERENCES public.profile_prompt_templates(id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  display_name text NOT NULL,
  birthdate date CHECK (calculate_age(birthdate) >= 18),
  bio text,
  gender text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  is_premium boolean NOT NULL DEFAULT false,
  push_token text,
  is_admin boolean DEFAULT false,
  verified_at timestamp with time zone,
  avatar_url text,
  calculated_age integer,
  interested_in ARRAY DEFAULT '{}'::text[],
  show_orientation boolean NOT NULL DEFAULT true,
  show_gender boolean NOT NULL DEFAULT true,
  seeking ARRAY DEFAULT '{}'::text[],
  show_seeking boolean DEFAULT true,
  relationship_status text CHECK (relationship_status = ANY (ARRAY['single'::text, 'inRelationship'::text, 'open'::text, 'itsComplicated'::text, 'preferNot'::text])),
  location_opt_in boolean DEFAULT false,
  push_opt_in boolean DEFAULT false,
  notify_messages boolean DEFAULT true,
  notify_likes boolean DEFAULT true,
  notify_friend_requests boolean DEFAULT true,
  expo_push_token text,
  onboarding_version smallint DEFAULT 2,
  onboarding_completed boolean DEFAULT false,
  camera_opt_in boolean NOT NULL DEFAULT false,
  show_relationship boolean NOT NULL DEFAULT true,
  city text,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.prompt_categories (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  key text NOT NULL UNIQUE,
  icon text,
  color text,
  display_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT prompt_categories_pkey PRIMARY KEY (id)
);
CREATE TABLE public.prompt_interactions (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id uuid NOT NULL,
  prompt_template_id bigint NOT NULL,
  action text NOT NULL CHECK (action = ANY (ARRAY['view'::text, 'select'::text, 'deselect'::text, 'open_preview'::text, 'skip_all'::text])),
  choice_key text,
  occurred_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT prompt_interactions_pkey PRIMARY KEY (id),
  CONSTRAINT prompt_interactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT prompt_interactions_prompt_template_id_fkey FOREIGN KEY (prompt_template_id) REFERENCES public.profile_prompt_templates(id)
);
CREATE TABLE public.prompt_template_categories (
  template_id bigint NOT NULL,
  category_id bigint NOT NULL,
  CONSTRAINT prompt_template_categories_pkey PRIMARY KEY (template_id, category_id),
  CONSTRAINT prompt_template_categories_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.profile_prompt_templates(id),
  CONSTRAINT prompt_template_categories_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.prompt_categories(id)
);
CREATE TABLE public.push_tokens (
  user_id uuid NOT NULL,
  token text NOT NULL,
  platform USER-DEFINED,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT push_tokens_pkey PRIMARY KEY (user_id, token),
  CONSTRAINT push_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.remote_config (
  key text NOT NULL,
  value jsonb NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT remote_config_pkey PRIMARY KEY (key)
);
CREATE TABLE public.series_sponsorships (
  id bigint NOT NULL DEFAULT nextval('series_sponsorships_id_seq'::regclass),
  series_id bigint NOT NULL,
  starts_at timestamp with time zone,
  ends_at timestamp with time zone,
  priority integer NOT NULL DEFAULT 1,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT series_sponsorships_pkey PRIMARY KEY (id),
  CONSTRAINT series_sponsorships_series_id_fkey FOREIGN KEY (series_id) REFERENCES public.event_series(id)
);
CREATE TABLE public.superlike_counters (
  user_id uuid NOT NULL,
  day date NOT NULL,
  used integer NOT NULL DEFAULT 0,
  CONSTRAINT superlike_counters_pkey PRIMARY KEY (user_id, day),
  CONSTRAINT superlike_counters_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.user_achievements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  achievement_id uuid,
  current_value integer DEFAULT 0,
  progress integer DEFAULT 0,
  is_unlocked boolean DEFAULT false,
  unlocked_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_achievements_pkey PRIMARY KEY (id),
  CONSTRAINT user_achievements_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT user_achievements_achievement_id_fkey FOREIGN KEY (achievement_id) REFERENCES public.achievement_templates(id)
);
CREATE TABLE public.user_levels (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE,
  current_level integer DEFAULT 1,
  current_xp integer DEFAULT 0,
  xp_to_next_level integer DEFAULT 100,
  total_xp_earned integer DEFAULT 0,
  last_xp_earned_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_levels_pkey PRIMARY KEY (id),
  CONSTRAINT user_levels_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.user_photos (
  id bigint NOT NULL DEFAULT nextval('user_photos_id_seq'::regclass),
  user_id uuid,
  url text NOT NULL,
  sort_order integer DEFAULT 0 CHECK (sort_order >= 0 AND sort_order <= 5),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_photos_pkey PRIMARY KEY (id),
  CONSTRAINT user_photos_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.user_statistics (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  total_matches integer DEFAULT 0,
  total_likes integer DEFAULT 0,
  total_views integer DEFAULT 0,
  total_messages integer DEFAULT 0,
  avg_response_time interval,
  last_activity timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_statistics_pkey PRIMARY KEY (id),
  CONSTRAINT user_statistics_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.venue_goals (
  venue_id bigint NOT NULL,
  promote boolean DEFAULT false,
  attract boolean DEFAULT false,
  other text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT venue_goals_pkey PRIMARY KEY (venue_id),
  CONSTRAINT venue_goals_venue_id_fkey FOREIGN KEY (venue_id) REFERENCES public.venues(id)
);
CREATE TABLE public.venue_staff (
  venue_id bigint NOT NULL,
  user_id uuid NOT NULL,
  role USER-DEFINED NOT NULL DEFAULT 'owner'::staff_role,
  active boolean NOT NULL DEFAULT true,
  onboarded_at timestamp with time zone,
  verified_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT venue_staff_pkey PRIMARY KEY (venue_id, user_id),
  CONSTRAINT venue_staff_venue_id_fkey FOREIGN KEY (venue_id) REFERENCES public.venues(id),
  CONSTRAINT venue_staff_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.venues (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  name text NOT NULL,
  city_id bigint NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  venue_type USER-DEFINED NOT NULL DEFAULT 'nightclub'::venue_type,
  email text,
  phone text,
  category USER-DEFINED,
  location_text text,
  description text,
  avatar_url text,
  CONSTRAINT venues_pkey PRIMARY KEY (id),
  CONSTRAINT venues_city_id_fkey FOREIGN KEY (city_id) REFERENCES public.cities(id)
);
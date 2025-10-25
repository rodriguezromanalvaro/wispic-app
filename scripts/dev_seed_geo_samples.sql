-- Dev seed: sample venues and events around Madrid and Leganés with proper lat/lng so Geo Pro works
-- Safe to run multiple times (idempotent inserts via WHERE NOT EXISTS)
-- Run this in your Supabase SQL editor for your dev project.

DO $$
DECLARE
  v_madrid_id bigint;
  v_leganes_id bigint;
  v_wizink_id bigint;
  v_sol_id bigint;
  v_leganes_venue_id bigint;
  seq_cities text := pg_get_serial_sequence('public.cities','id');
  seq_venues text := pg_get_serial_sequence('public.venues','id');
  seq_events text := pg_get_serial_sequence('public.events','id');
  has_country boolean := (
    select exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='cities' and column_name='country'
    )
  );
  has_country_code boolean := (
    select exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='cities' and column_name='country_code'
    )
  );
BEGIN
  -- Repair sequences (if identity/serial got out of sync) to avoid duplicate key on insert
  IF seq_cities IS NOT NULL THEN
    PERFORM setval(seq_cities, COALESCE((SELECT max(id) FROM public.cities), 0), true);
  END IF;
  IF seq_venues IS NOT NULL THEN
    PERFORM setval(seq_venues, COALESCE((SELECT max(id) FROM public.venues), 0), true);
  END IF;
  IF seq_events IS NOT NULL THEN
    PERFORM setval(seq_events, COALESCE((SELECT max(id) FROM public.events), 0), true);
  END IF;
  -- Cities (insert with country/country_code if required by schema)
  IF has_country AND has_country_code THEN
    INSERT INTO public.cities(name, country, country_code, lat, lng)
    SELECT 'Madrid', 'España', 'ES', 40.4168, -3.7038
    WHERE NOT EXISTS (SELECT 1 FROM public.cities WHERE name='Madrid');
    INSERT INTO public.cities(name, country, country_code, lat, lng)
    SELECT 'Leganés', 'España', 'ES', 40.3270, -3.7630
    WHERE NOT EXISTS (SELECT 1 FROM public.cities WHERE name='Leganés');
  ELSIF has_country THEN
    INSERT INTO public.cities(name, country, lat, lng)
    SELECT 'Madrid', 'España', 40.4168, -3.7038
    WHERE NOT EXISTS (SELECT 1 FROM public.cities WHERE name='Madrid');
    INSERT INTO public.cities(name, country, lat, lng)
    SELECT 'Leganés', 'España', 40.3270, -3.7630
    WHERE NOT EXISTS (SELECT 1 FROM public.cities WHERE name='Leganés');
  ELSIF has_country_code THEN
    INSERT INTO public.cities(name, country_code, lat, lng)
    SELECT 'Madrid', 'ES', 40.4168, -3.7038
    WHERE NOT EXISTS (SELECT 1 FROM public.cities WHERE name='Madrid');
    INSERT INTO public.cities(name, country_code, lat, lng)
    SELECT 'Leganés', 'ES', 40.3270, -3.7630
    WHERE NOT EXISTS (SELECT 1 FROM public.cities WHERE name='Leganés');
  ELSE
    INSERT INTO public.cities(name, lat, lng)
    SELECT 'Madrid', 40.4168, -3.7038
    WHERE NOT EXISTS (SELECT 1 FROM public.cities WHERE name='Madrid');
    INSERT INTO public.cities(name, lat, lng)
    SELECT 'Leganés', 40.3270, -3.7630
    WHERE NOT EXISTS (SELECT 1 FROM public.cities WHERE name='Leganés');
  END IF;

  SELECT id INTO v_madrid_id FROM public.cities WHERE name='Madrid' LIMIT 1;
  SELECT id INTO v_leganes_id FROM public.cities WHERE name='Leganés' LIMIT 1;

  -- Venues (ensure lat/lng so triggers backfill geography)
  INSERT INTO public.venues(name, venue_type, lat, lng)
  SELECT 'WiZink Center', 'concert_hall', 40.4238, -3.6719
  WHERE NOT EXISTS (SELECT 1 FROM public.venues WHERE name='WiZink Center');
  SELECT id INTO v_wizink_id FROM public.venues WHERE name='WiZink Center' LIMIT 1;

  INSERT INTO public.venues(name, venue_type, lat, lng)
  SELECT 'Puerta del Sol', 'nightclub', 40.4168, -3.7038
  WHERE NOT EXISTS (SELECT 1 FROM public.venues WHERE name='Puerta del Sol');
  SELECT id INTO v_sol_id FROM public.venues WHERE name='Puerta del Sol' LIMIT 1;

  INSERT INTO public.venues(name, venue_type, lat, lng)
  SELECT 'Leganés Centro', 'nightclub', 40.3270, -3.7630
  WHERE NOT EXISTS (SELECT 1 FROM public.venues WHERE name='Leganés Centro');
  SELECT id INTO v_leganes_venue_id FROM public.venues WHERE name='Leganés Centro' LIMIT 1;

  -- Sample upcoming events (make sure start_at is in the future)
  INSERT INTO public.events(title, start_at, venue_id, city, city_id, is_free, price_cents, currency)
  SELECT 'Concierto en WiZink', now() + interval '2 days', v_wizink_id, 'Madrid', v_madrid_id, false, 2500, 'EUR'
  WHERE NOT EXISTS (SELECT 1 FROM public.events WHERE title='Concierto en WiZink');

  INSERT INTO public.events(title, start_at, venue_id, city, city_id, is_free, price_cents, currency)
  SELECT 'Fiesta en Sol', now() + interval '8 hours', v_sol_id, 'Madrid', v_madrid_id, true, NULL, 'EUR'
  WHERE NOT EXISTS (SELECT 1 FROM public.events WHERE title='Fiesta en Sol');

  INSERT INTO public.events(title, start_at, venue_id, city, city_id, is_free, price_cents, currency)
  SELECT 'Plan en Leganés', now() + interval '1 day', v_leganes_venue_id, 'Leganés', v_leganes_id, true, NULL, 'EUR'
  WHERE NOT EXISTS (SELECT 1 FROM public.events WHERE title='Plan en Leganés');

  -- Simulate an older event missing geog (RPC will skip it; helps validate fallback behavior)
  IF NOT EXISTS (SELECT 1 FROM public.events WHERE title='Viejo evento sin geog') THEN
    INSERT INTO public.events(title, start_at, venue_id, city, city_id, is_free, price_cents, currency)
    VALUES ('Viejo evento sin geog', now() + interval '3 days', v_wizink_id, 'Madrid', v_madrid_id, false, 1000, 'EUR');
    UPDATE public.events SET geog = NULL WHERE title='Viejo evento sin geog';
  END IF;
END $$;
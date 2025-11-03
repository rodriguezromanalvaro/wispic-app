-- Minimal seed for public.cities (Spain) to enable proximity and linking
-- Idempotent: uses ON CONFLICT DO NOTHING on unique(name)

insert into public.cities (name, country, country_code, lat, lng, slug)
values
  ('Madrid', 'Spain', 'ES', 40.4168, -3.7038, public._slugify_city_name('Madrid')),
  ('Barcelona', 'Spain', 'ES', 41.3874, 2.1686, public._slugify_city_name('Barcelona')),
  ('Valencia', 'Spain', 'ES', 39.4699, -0.3763, public._slugify_city_name('Valencia')),
  ('Sevilla', 'Spain', 'ES', 37.3891, -5.9845, public._slugify_city_name('Sevilla')),
  ('Zaragoza', 'Spain', 'ES', 41.6488, -0.8891, public._slugify_city_name('Zaragoza')),
  ('Málaga', 'Spain', 'ES', 36.7213, -4.4213, public._slugify_city_name('Málaga')),
  ('Bilbao', 'Spain', 'ES', 43.2630, -2.9350, public._slugify_city_name('Bilbao'))
ON CONFLICT (name) DO NOTHING;

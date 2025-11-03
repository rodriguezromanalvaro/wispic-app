-- Minimal seed for public.cities (Germany) to enable name matching and proximity
-- Idempotent: uses ON CONFLICT DO NOTHING on unique(name)

insert into public.cities (name, country, country_code, lat, lng, slug)
values
  ('Berlin', 'Germany', 'DE', 52.5200, 13.4050, public._slugify_city_name('Berlin')),
  ('Hamburg', 'Germany', 'DE', 53.5511, 9.9937, public._slugify_city_name('Hamburg')),
  ('Munich', 'Germany', 'DE', 48.1351, 11.5820, public._slugify_city_name('Munich')),
  ('Cologne', 'Germany', 'DE', 50.9375, 6.9603, public._slugify_city_name('Cologne')),
  ('Frankfurt', 'Germany', 'DE', 50.1109, 8.6821, public._slugify_city_name('Frankfurt')),
  ('Stuttgart', 'Germany', 'DE', 48.7758, 9.1829, public._slugify_city_name('Stuttgart')),
  ('Düsseldorf', 'Germany', 'DE', 51.2277, 6.7735, public._slugify_city_name('Düsseldorf')),
  ('Dortmund', 'Germany', 'DE', 51.5136, 7.4653, public._slugify_city_name('Dortmund')),
  ('Leipzig', 'Germany', 'DE', 51.3397, 12.3731, public._slugify_city_name('Leipzig')),
  ('Bremen', 'Germany', 'DE', 53.0793, 8.8017, public._slugify_city_name('Bremen'))
ON CONFLICT (name) DO NOTHING;

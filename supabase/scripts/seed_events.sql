-- SEED DE EVENTOS / SERIES / SPONSORSHIPS / CHECKINS PARA PRUEBAS UX
-- Fecha de referencia: 2025-10-05 (ajusta si corres otro día)
-- Ejecutar en el SQL Editor de Supabase (o psql) en un entorno NO producción.
-- Si quieres conservar otras tablas de usuarios/perfiles, este script NO las toca.

-- ========================= AVISO ==================================
-- Esto BORRA datos previos de eventos y dependencias.
-- Revisa antes de ejecutar en un entorno que no quieras limpiar.
-- ==================================================================

-- Limpieza completa usando TRUNCATE (reinicia IDs) sin transacción explícita para evitar error en editor
truncate table 
  event_checkins,
  event_attendance,
  event_sponsorships,
  series_sponsorships,
  events,
  event_series,
  venues,
  cities
restart identity cascade;

-- NOTA: la tabla cities exige country NOT NULL según error reportado.
-- Añadimos 'ES' para todas. Ajusta si gestionas países múltiples.
insert into cities (id, name, country, lat, lng) values
  (1,'Madrid','ES',40.4168,-3.7038),
  (2,'Toledo','ES',39.8628,-4.0273),
  (3,'Segovia','ES',40.9429,-4.1088),
  (4,'Barcelona','ES',41.3874,2.1686),
  (5,'Valencia','ES',39.4699,-0.3763);

-- Venues (nightclub, concert hall, festival)
insert into venues (id, name, venue_type, city_id) values
  (101,'Club Nebula','nightclub',1),
  (102,'Sala Pulsar','concert_hall',1),
  (103,'La Terraza Toledana','nightclub',2),
  (104,'Segovia Beats','nightclub',3),
  (105,'Auditori Blau','concert_hall',4),
  (106,'Valencia Fest Park','festival',5),
  (107,'Club Orbit','nightclub',1),
  (108,'Teatro Centaurus','concert_hall',1);

-- Series (weekly / multi‑day). Dos en Madrid, una en Barcelona
insert into event_series (id, title, venue_id) values
  (201,'Galaxy Nights',101),         -- Nightclub multi-días (Jue, Vie, Sáb)
  (202,'Afterwork Pulse',102),       -- Concert hall (Mié fijo)
  (203,'BCN Late Sessions',105);     -- Barcelona nightclub (Vie, Sáb)

-- Helpers: fechas base
-- Hoy (asumiendo 2025-10-05) es domingo; ajusta si cambias fecha base.
-- Construimos eventos distribuidos: hoy, próximos 7 días, dentro de 30 y >30.

-- Standalone events (sin series)
-- id rango: 300+ ; usamos distintas ciudades y tipos
insert into events (id, title, start_at, city, city_id, venue_id, series_id, is_sponsored, sponsored_priority)
values
  -- HOY (mañana y noche)
  (301,'Opening Sunday Brunch', '2025-10-05T11:00:00Z','Madrid',1,102,null,false,0),
  (302,'Sunset Closing Sunday', '2025-10-05T19:30:00Z','Madrid',1,101,null,true,2), -- patrocinado (priority 2)
  -- Dentro de 7 días
  (303,'Toledo Electro Night', '2025-10-07T22:30:00Z','Toledo',2,103,null,false,0),
  (304,'Segovia Drum Circle', '2025-10-08T21:00:00Z','Segovia',3,104,null,true,1),
  (305,'Valencia Indie Live', '2025-10-10T20:00:00Z','Valencia',5,106,null,false,0),
  -- Dentro de 30 días
  (306,'Madrid Autumn Jam', '2025-10-25T23:00:00Z','Madrid',1,107,null,false,0),
  (307,'Barcelona Electro Fest Launch', '2025-10-28T18:00:00Z','Barcelona',4,105,null,true,3), -- prioridad alta -> debería subir arriba
  -- >30 días (solo visible en rango ALL)
  (308,'Far Future Winter Warmup', '2025-12-01T22:00:00Z','Madrid',1,108,null,false,0);

-- Eventos de series (Galaxy Nights: Jue, Vie, Sáb futuros de esta semana + próxima)
-- Determinamos manualmente fechas Jue(2025-10-09), Vie(10), Sáb(11) y siguientes Jue(16), Vie(17)
insert into events (id, title, start_at, city, city_id, venue_id, series_id, is_sponsored, sponsored_priority) values
  (401,'Galaxy Nights Thu', '2025-10-09T22:30:00Z','Madrid',1,101,201,false,0),
  (402,'Galaxy Nights Fri', '2025-10-10T23:00:00Z','Madrid',1,101,201,false,0),
  (403,'Galaxy Nights Sat', '2025-10-11T23:15:00Z','Madrid',1,101,201,true,1),
  (404,'Galaxy Nights Thu+', '2025-10-16T22:30:00Z','Madrid',1,101,201,false,0),
  (405,'Galaxy Nights Fri+', '2025-10-17T23:00:00Z','Madrid',1,101,201,false,0);

-- Afterwork Pulse (Miércoles) Mié 2025-10-08 y Mié 2025-10-15
insert into events (id, title, start_at, city, city_id, venue_id, series_id, is_sponsored, sponsored_priority) values
  (410,'Afterwork Pulse Midweek', '2025-10-08T18:30:00Z','Madrid',1,102,202,false,0),
  (411,'Afterwork Pulse Midweek+', '2025-10-15T18:30:00Z','Madrid',1,102,202,false,0);

-- BCN Late Sessions (Vie / Sáb) 2025-10-10, 11
insert into events (id, title, start_at, city, city_id, venue_id, series_id, is_sponsored, sponsored_priority) values
  (420,'BCN Late Sessions Fri', '2025-10-10T22:45:00Z','Barcelona',4,105,203,false,0),
  (421,'BCN Late Sessions Sat', '2025-10-11T22:45:00Z','Barcelona',4,105,203,false,0);

-- Sponsorships adicionales (event + series) para probar mezcla prioridades
-- Serie Galaxy Nights (id 201) prioridad 2 activa toda la semana → debe influir en todas sus próximas cards
insert into series_sponsorships (series_id, starts_at, ends_at, priority)
values (201, '2025-10-01T00:00:00Z','2025-10-20T00:00:00Z', 2);

-- Sponsorship puntual para evento 304 (ya marcado is_sponsored true) con mayor prioridad
insert into event_sponsorships (event_id, starts_at, ends_at, priority)
values (304,'2025-10-01T00:00:00Z','2025-10-12T00:00:00Z', 2);

-- Alta prioridad para evento 307 (ya priority 3 en columna -> aquí confirmamos)
insert into event_sponsorships (event_id, starts_at, ends_at, priority)
values (307,'2025-10-01T00:00:00Z','2025-11-01T00:00:00Z', 3);

-- Presencia simulada (event_checkins) para Top de hoy.
-- Necesitas user_ids existentes. Si no conoces IDs reales, crea usuarios dummy o sustituye por IDs válidos.
-- Recomendación: sustituye '00000000-0000-0000-0000-000000000001' etc. por UUIDs reales de tu tabla profiles.

-- Ejemplo suponiendo 3 usuarios existentes (ajusta):
-- delete from event_checkins; (ya se borró al inicio)
insert into event_checkins (event_id, user_id, last_seen_at, method, verified) values
  (301,'00000000-0000-0000-0000-000000000001', now() - interval '10 minutes','manual',false),
  (302,'00000000-0000-0000-0000-000000000001', now() - interval '5 minutes','manual',false),
  (302,'00000000-0000-0000-0000-000000000002', now() - interval '3 minutes','manual',false),
  (302,'00000000-0000-0000-0000-000000000003', now() - interval '2 minutes','manual',false),
  (303,'00000000-0000-0000-0000-000000000001', now() - interval '15 minutes','manual',false),
  (304,'00000000-0000-0000-0000-000000000001', now() - interval '30 minutes','manual',false),
  (304,'00000000-0000-0000-0000-000000000002', now() - interval '25 minutes','manual',false),
  (304,'00000000-0000-0000-0000-000000000003', now() - interval '20 minutes','manual',false),
  (304,'00000000-0000-0000-0000-000000000004', now() - interval '10 minutes','manual',false);

-- (Sin COMMIT explícito: el editor ejecuta en auto‑commit)

-- ===================== GUÍA DE VERIFICACIÓN =========================
-- 1. Rango "Hoy": Deben aparecer 301 y 302 (standalone) y ningún evento > hoy.
-- 2. Rango 7 días: incluye 303,304,305 + eventos de series 401..403,410,420,421.
-- 3. Rango 30 días: añade 306,307,404,405,411.
-- 4. Rango Todos: añade 308.
-- 5. Series: Galaxy Nights (multi-días) debe mostrar barra semanal con J V S activos (letras iniciales L M X J V S D -> resaltadas J V S).
-- 6. Patrocinados fuertes (prioridad 3) => 307 debe ir arriba entre su rango.
-- 7. Patrocinio por serie (201) eleva prioridad de todos los próximos de la serie.
-- 8. Cercanos: si seleccionas Madrid, Toledo (303) y Segovia (304) deben aparecer en sección “Otras ciudades cercanas” (<150 km).
-- 9. Búsqueda: "Galaxy" filtra solo serie y sus eventos; "Barcelona" muestra 307, 420, 421.
-- 10. Top de hoy: presencia más alta en 302 y 304 (por número de checkins simulados) debería reflejarse en orden del Top.

-- Nota: Ajusta user_ids en event_checkins para que el RPC get_event_presence los considere; si tu lógica distingue verificados necesitarás registros con verified=true.

-- Enable PostGIS extension for geography/geometry types and functions
create extension if not exists postgis;
-- Optional extensions (commented out by default)
-- create extension if not exists postgis_topology;
-- create extension if not exists fuzzystrmatch;
-- create extension if not exists postgis_tiger_geocoder;

-- Ensure PostGIS is available for geography/geometry functions used by proximity and triggers
-- Safe to run multiple times
CREATE EXTENSION IF NOT EXISTS postgis;

-- Optional related extensions (uncomment if needed later)
-- CREATE EXTENSION IF NOT EXISTS postgis_raster;
-- CREATE EXTENSION IF NOT EXISTS postgis_topology;

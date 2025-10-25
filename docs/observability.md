# Observabilidad de BD

## Reporte de consultas “hot” (solo app)
- PowerShell:
  - `$env:APP_ONLY='1'`
  - `npm run report:top-queries`

## Resetear métricas (con confirmación)
- PowerShell (en ventana tranquila):
  - `$env:CONFIRM_RESET='YES'`
  - `npm run perf:reset-pgss`

## GitHub Actions semanal
- Workflow: `.github/workflows/weekly-db-observability.yml`
- Requiere secret `SUPABASE_DB_URL_OBS` con cadena del pooler de Supabase.
- Sube un artefacto `weekly-top-queries` con el JSON.

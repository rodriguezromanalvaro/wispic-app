# Legal site (wispic.app)

Este directorio contiene páginas estáticas listas para desplegar en Vercel (o cualquier hosting estático):

- /privacy → `privacy.html`
- /terms → `terms.html`

## Despliegue rápido en Vercel

1. Crea un nuevo proyecto en https://vercel.com/import
2. Elige este repositorio y configura la raíz del proyecto como `legal-site`.
3. Framework: "Other" (Static)
4. Build Command: (deja vacío)
5. Output Directory: (deja vacío). Vercel servirá los archivos tal cual.
6. Despliega.
7. Asocia el dominio `wispic.app` a este proyecto en Vercel (Project Settings → Domains):
   - Raíz: `wispic.app`
   - Opcional: `www.wispic.app`
8. En Cloudflare, crea un CNAME o usa los Nameservers de Vercel si prefieres. Recomendado: mantén Cloudflare como DNS y apunta los registros A/AAAA/CNAME que indique Vercel.

## Rutas

- https://wispic.app/privacy → privacy.html
- https://wispic.app/terms → terms.html

Puedes editar el contenido sin romper nada del proyecto móvil.

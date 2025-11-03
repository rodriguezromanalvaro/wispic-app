# DNS para wispic.app (Cloudflare)

Añade estos registros en Cloudflare para preparar correo (Google Workspace) y seguridad básica.

> Sustituye o elimina registros antiguos que entren en conflicto. Mantén el proxy de Cloudflare desactivado (modo "DNS only") para MX y TXT.

## MX (correo Gmail)

Tipo | Nombre | Contenido | Prioridad | Proxy
---|---|---|---|---
MX | @ | ASPMX.L.GOOGLE.COM. | 1 | DNS only
MX | @ | ALT1.ASPMX.L.GOOGLE.COM. | 5 | DNS only
MX | @ | ALT2.ASPMX.L.GOOGLE.COM. | 5 | DNS only
MX | @ | ALT3.ASPMX.L.GOOGLE.COM. | 10 | DNS only
MX | @ | ALT4.ASPMX.L.GOOGLE.COM. | 10 | DNS only

## SPF (envío de correo)

- Tipo: TXT
- Nombre: @
- Valor: `v=spf1 include:_spf.google.com ~all`
- Proxy: DNS only

## DMARC (monitorización de suplantación)

- Tipo: TXT
- Nombre: `_dmarc`
- Valor: `v=DMARC1; p=none; rua=mailto:dmarc@wispic.app; fo=1; pct=100`
- Proxy: DNS only

> "p=none" solo monitoriza. Tras 1-2 semanas, podrás subir a `p=quarantine` o `p=reject`.

## DKIM (autenticación criptográfica)

- Después de activar DKIM en Google Admin, Google te dará un TXT parecido a:
  - Tipo: TXT
  - Nombre (host): `google._domainkey`
  - Valor: una cadena muy larga que empieza por `v=DKIM1; k=rsa; p=...`
  - Proxy: DNS only

## Notas

- Crea los buzones/alias en Google Workspace: support@ (principal), hello@, info@, contact@, no-reply@, dmarc@ (alias o grupo que reciba informes). 
- Asegúrate de que no existan MX de proveedores anteriores.
- Tras añadir los registros, espera 5–30 min para propagación.

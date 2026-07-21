# Seguridad de la capa HTTP y gestión de secretos

## Cabeceras de seguridad

El backend aplica `secureHeaders()` de Hono a todas las rutas (`backend/src/app.ts`):

- `Strict-Transport-Security` (HSTS) — fuerza HTTPS en producción.
- `X-Content-Type-Options: nosniff` — evita el sniffing de MIME.
- `X-Frame-Options: SAMEORIGIN` — mitiga clickjacking.
- `Referrer-Policy`, `X-XSS-Protection: 0` y demás valores por defecto seguros de Hono.

## CORS estricto

- La lista blanca de orígenes vive en la variable `ALLOWED_ORIGINS` (CSV). Si no está
  definida se usa `FRONTEND_URL`; nunca se responde `Access-Control-Allow-Origin: *`.
- Un origen fuera de la lista no recibe cabeceras CORS (el navegador bloquea la respuesta).
- En producción, configurar `ALLOWED_ORIGINS` con los dominios reales del frontend.

## Gestión de secretos

- **Ningún secreto se versiona.** `.env` está en `.gitignore`; `.env.example` solo
  documenta las variables con placeholders.
- En producción (Railway) los secretos se configuran como *service variables* del
  servicio backend: `MONGODB_URI`, `CLERK_SECRET_KEY`, `STRIPE_SECRET_KEY`,
  `STRIPE_WEBHOOK_SECRET` (cuando exista el webhook), `ALLOWED_ORIGINS`.
- Railway cifra las variables en reposo y las inyecta como entorno del proceso;
  cumplen el rol de gestor de secretos del proyecto. Si el despliegue migra a otra
  plataforma, usar su equivalente (Vault, AWS Secrets Manager, etc.).
- Rotación: al rotar una clave (Stripe/Clerk), actualizar la variable en Railway y
  redeployar; las claves de test y live nunca se mezclan en el mismo entorno.

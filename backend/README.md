# backend

API de Chocao (Bun + Hono + Mongoose).

## Instalación y ejecución

```bash
bun install
bun run dev        # desarrollo (watch)
bun run start      # migraciones + servidor
bun test           # suite de tests (MongoDB en memoria)
bun run typecheck  # tsc --noEmit
```

## Variables de entorno

Bun carga `.env` automáticamente. (`.env.example` está git-ignorado en este
repo, así que la referencia vive aquí.)

| Variable | Requerida | Descripción |
|---|---|---|
| `MONGODB_URI` | Sí | Cadena de conexión a MongoDB. |
| `CLERK_SECRET_KEY` | Sí | Clave secreta de Clerk (verificación de JWT). |
| `STRIPE_SECRET_KEY` | Sí | Clave secreta de Stripe. |
| `STRIPE_WEBHOOK_SECRET` | Sí | Secreto de firma del webhook `checkout.session.completed`. |
| `STRIPE_SUCCESS_URL` | Sí | URL de retorno tras pagar (frontend `/checkout/success`). |
| `STRIPE_CANCEL_URL` | Sí | URL de retorno al cancelar el pago. |
| `FRONTEND_URL` | No | Origen del frontend (default `http://localhost:5173`). |
| `ALLOWED_ORIGINS` | No | Lista CSV de orígenes CORS; si falta se usa `FRONTEND_URL`. |
| `RESEND_API_KEY` | No | Clave de Resend para emails de notificación. **Sin ella, los emails quedan en modo log (no se envían) y todo lo demás funciona igual.** |
| `RESEND_FROM` | No | Remitente de los emails (default `Chocao <notificaciones@chocao.app>`). |
| `PORT` | No | Puerto del servidor (default `3000`). |
| `LOG_LEVEL` | No | `debug` \| `info` \| `warn` \| `error` (default `info`). |
| `METRICS_TOKEN` | No | Bearer token opcional para `GET /metrics`. |

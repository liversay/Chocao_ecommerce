# E2E determinístico de flujos críticos (Playwright)

**Goal:** Suite Playwright determinística y autocontenida (sin red externa, sin secretos)
que cubra los flujos críticos: sesión → pujar → adjudicación → checkout/recibo → backoffice.

**Decisión de auth (aprobada):** modo E2E autocontenido tras flags. Nada de esto se activa
sin `E2E=1` (backend) / `VITE_E2E=1` (frontend).

## Arquitectura

1. **Backend** `scripts/e2e-server.ts`: MongoMemoryReplSet (misma infra que los 189 tests)
   + seed determinístico fijo + `createApp()` en :3000 con `E2E=1`.
2. **Auth shortcut** en `middlewares/auth.ts`: con `E2E=1`, `Bearer e2e:<clerkId>` se acepta
   como payload `{sub: clerkId}` (mismo atajo que el mock de bun test). Sin el flag, cero cambios.
3. **Stripe fake** en `lib/stripe.ts`: con `E2E=1` exporta un objeto compatible (create/retrieve/refunds)
   cuya URL de checkout apunta a `/checkout/success?session_id=…` del propio frontend y
   `retrieve()` devuelve `paid` — el ciclo de compra completo corre end-to-end sin Stripe real.
4. **Frontend stub** `src/lib/clerkStub.tsx` + alias de `@clerk/react` en `vite.config.ts`
   cuando `process.env.VITE_E2E`: sesión desde `localStorage.e2e_user`; `getToken()` → `e2e:<clerkId>`.
   Superficie: ClerkProvider, useAuth, useUser, useClerk, SignIn, SignUp.
5. **Playwright** levanta ambos servers (`webServer: []`); helper `loginAs(page, "ana"|"admin")`
   setea localStorage antes de navegar.

## Seed fijo (e2e-server)

- Usuarios: `e2e_admin` (admin), `e2e_ana`, `e2e_bruno` (customers).
- Vehículos: "Corolla E2E" (active, $10.000, cierra en 7d), "Civic E2E" (active, $8.000),
  "F-150 E2E" (closed, con puja **winner de Ana por $15.000** → flujo de pago listo).

## Specs (flujos críticos)

- `bidding.spec.ts`: Ana puja en Corolla (input + botón +5%), historial refleja; Bruno la supera
  (2º contexto); Ana ve badge en la campana y la notificación "Te superaron".
- `checkout.spec.ts`: Ana → Mis subastas → "Pagar ahora" → success → Mis compras → "Ver recibo" → recibo.
- `account-watchlist.spec.ts`: corazón en catálogo, `/watchlist`, toggle de preferencia en `/account`, `/notifications`.
- `admin.spec.ts` (smoke): admin ve `/admin` con fondo oscuro (`#0f172a`), KPIs y gráficos; Usuarios
  lista y filtra; Órdenes muestra el pago de Ana y permite reembolsar (modal); Auditoría registra el reembolso.

## CI

`playwright.yml`: instalar deps de backend además de frontend y exportar `E2E=1`/`VITE_E2E=1`;
el webServer de Playwright arranca ambos procesos.

## Verificación

`cd frontend && bunx playwright test` en local (todo verde, sin backend externo);
`bun test` backend sigue 189/189; CI verde en el PR.

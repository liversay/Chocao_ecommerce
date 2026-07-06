# Chocao — Documentación Técnica

Plataforma B2G (Business-to-Government) para subastar vehículos aprehendidos por el Gobierno de Panamá. Permite a ciudadanos registrarse, pujar en subastas activas y completar pagos en línea, mientras un panel administrativo gestiona el inventario y monitorea la actividad.

---

## Índice

1. [Stack Tecnológico](#1-stack-tecnológico)
2. [Arquitectura](#2-arquitectura)
3. [Estructura del Proyecto](#3-estructura-del-proyecto)
4. [Modelo de Datos](#4-modelo-de-datos)
5. [API REST](#5-api-rest)
6. [Autenticación y Autorización](#6-autenticación-y-autorización)
7. [Integración con Stripe](#7-integración-con-stripe)
8. [Frontend — Componentes y Rutas](#8-frontend--componentes-y-rutas)
9. [Reglas de Negocio](#9-reglas-de-negocio)
10. [Sistema de Diseño](#10-sistema-de-diseño)
11. [Variables de Entorno](#11-variables-de-entorno)
12. [Flujos End-to-End](#12-flujos-end-to-end)

---

## 1. Stack Tecnológico

### Backend

| Tecnología | Versión | Rol |
|---|---|---|
| **Bun** | ≥ 1.3 | Runtime JavaScript/TypeScript (alternativa a Node.js) |
| **Hono** | 4.12.15 | Framework HTTP minimalista, edge-ready |
| **MongoDB** | local 7.x | Base de datos NoSQL |
| **Mongoose** | 9.5.0 | ODM para MongoDB con esquemas tipados |
| **@clerk/backend** | 3.4.1 | Verificación de JWT emitidos por Clerk |
| **Stripe Node SDK** | 22.1.0 | Integración con API de Stripe (versión `2026-04-22.dahlia`) |
| **dotenv** | 17.4.2 | Carga de variables de entorno |

### Frontend

| Tecnología | Versión | Rol |
|---|---|---|f
| **React** | 19.2.5 | UI declarativa |
| **Vite** | 8.0.10 | Bundler + dev server con HMR |
| **TypeScript** | 6.0.x | Tipado estático |
| **React Router** | 7.14.2 | Enrutado SPA con layouts anidados |
| **@clerk/react** | 6.4.5 | SDK de autenticación cliente |
| **axios** | 1.15.2 | Cliente HTTP con interceptores |

### Herramientas

- **MongoDB local** (`mongodb://localhost:27017/chocao`)
- **Clerk** (instancia de desarrollo) — autenticación + email OTP
- **Stripe** (modo Test) — checkout y procesamiento de pagos

---

## 2. Arquitectura

```
┌──────────────────────────────────────────────────────────────────┐
│                      Cliente (Navegador)                         │
│  ┌────────────────────┐         ┌────────────────────────────┐   │
│  │ React + Vite       │◄───────►│ Clerk SDK (sesión + JWT)   │   │
│  │ React Router       │         └────────────────────────────┘   │
│  │ Axios + interceptor│                                          │
│  └─────────┬──────────┘                                          │
└────────────┼─────────────────────────────────────────────────────┘
             │ HTTPS · Authorization: Bearer <JWT>
             ▼
┌──────────────────────────────────────────────────────────────────┐
│                    Backend (Hono + Bun)                          │
│  ┌──────────────────┐  ┌──────────────────┐                      │
│  │ Middleware Auth  │  │ Middleware CORS  │                      │
│  │ verifyToken()    │  │ Logger           │                      │
│  └────────┬─────────┘  └──────────────────┘                      │
│           ▼                                                      │
│  ┌──────────────────────────────────────────────────────┐        │
│  │ Routers: /api/users /api/vehicles /api/bids          │        │
│  │          /api/payments /api/dashboard                │        │
│  └────────┬─────────────────────────────────────────────┘        │
│           ▼                                                      │
│  ┌──────────────────┐         ┌──────────────────────────┐       │
│  │ Mongoose Models  │◄───────►│ MongoDB local            │       │
│  │ User · Vehicle   │         │ (chocao database)        │       │
│  │ Bid · Payment    │         └──────────────────────────┘       │
│  └────────┬─────────┘                                            │
│           ▼                                                      │
│  ┌──────────────────────────────────────────────────────┐        │
│  │ Stripe Singleton (lib/stripe.ts) ──► Stripe API      │        │
│  │ Clerk Backend  (verifyToken)     ──► Clerk JWKS      │        │
│  └──────────────────────────────────────────────────────┘        │
└──────────────────────────────────────────────────────────────────┘
```

### Patrones aplicados

- **Separación frontend/backend** en directorios independientes (no monorepo).
- **Stateless API**: el backend no guarda sesiones; cada request lleva el JWT de Clerk.
- **Middleware chain**: `requireAuth` y `requireAdmin` interceptan rutas protegidas y populan `c.get("user")`.
- **Singleton de Stripe** (`lib/stripe.ts`) — instancia única reutilizada en todas las peticiones.
- **Sync diferido de usuarios**: Clerk maneja el registro; al primer login, un endpoint `POST /api/users/sync` crea/actualiza la fila en MongoDB.

---

## 3. Estructura del Proyecto

```
chocao/
├── backend/
│   ├── src/
│   │   ├── index.ts                # Bootstrap Hono + CORS + routers
│   │   ├── lib/
│   │   │   ├── db.ts               # mongoose.connect()
│   │   │   └── stripe.ts           # Singleton Stripe
│   │   ├── middlewares/
│   │   │   └── auth.ts             # requireAuth, requireAdmin
│   │   ├── models/
│   │   │   ├── User.ts             # Schema usuarios
│   │   │   ├── Vehicle.ts          # Schema vehículos
│   │   │   ├── Bid.ts              # Schema pujas
│   │   │   └── Payment.ts          # Schema pagos Stripe
│   │   └── routes/
│   │       ├── users.ts
│   │       ├── vehicles.ts
│   │       ├── bids.ts
│   │       ├── payments.ts
│   │       └── dashboard.ts
│   ├── .env                        # Secretos (no commit)
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── main.tsx                # ClerkProvider + createRoot
│   │   ├── App.tsx                 # BrowserRouter + Routes + SyncUser
│   │   ├── index.css               # Design tokens (CSS variables)
│   │   ├── types/
│   │   │   └── index.ts            # User, Vehicle, Bid, Payment, etc.
│   │   ├── lib/
│   │   │   └── api.ts              # axios instance pública
│   │   ├── hooks/
│   │   │   └── useApi.ts           # axios autenticado (Bearer token)
│   │   ├── layouts/
│   │   │   ├── PublicLayout.tsx    # Navbar + Outlet + Footer
│   │   │   └── AdminLayout.tsx     # Sidebar + Outlet + Modal logout
│   │   ├── components/             # 18 componentes reutilizables
│   │   │   ├── GlassCard.tsx
│   │   │   ├── GlassButton.tsx
│   │   │   ├── GlassInput.tsx
│   │   │   ├── NeumorphicSelect.tsx
│   │   │   ├── DataTable.tsx
│   │   │   ├── StatusBadge.tsx
│   │   │   ├── PageHeader.tsx
│   │   │   ├── EmptyState.tsx
│   │   │   ├── LoadingState.tsx
│   │   │   ├── Countdown.tsx
│   │   │   ├── VehicleCard.tsx
│   │   │   ├── AdminStatCard.tsx
│   │   │   ├── BidForm.tsx
│   │   │   ├── ImageDropzone.tsx
│   │   │   ├── EmailOtpForm.tsx
│   │   │   ├── AuthMethodTabs.tsx
│   │   │   ├── Logo.tsx
│   │   │   ├── Navbar.tsx
│   │   │   ├── UserMenu.tsx
│   │   │   ├── ProtectedRoute.tsx
│   │   │   └── AdminRoute.tsx
│   │   └── pages/
│   │       ├── Landing.tsx
│   │       ├── LoginPage.tsx
│   │       ├── RegisterPage.tsx
│   │       ├── CatalogPage.tsx
│   │       ├── VehicleDetailPage.tsx
│   │       ├── MyBidsPage.tsx
│   │       ├── MyPurchasesPage.tsx
│   │       ├── CheckoutResultPage.tsx
│   │       └── admin/
│   │           ├── AdminDashboard.tsx
│   │           ├── AdminVehicles.tsx
│   │           ├── AdminBids.tsx
│   │           └── AdminReports.tsx
│   ├── .env
│   ├── .env.example
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
│
├── README.md
├── DOCUMENTATION.md                # este archivo
├── .env.example                    # plantilla combinada
└── .gitignore
```

---

## 4. Modelo de Datos

### 4.1 User

Representa a un usuario sincronizado desde Clerk.

```ts
{
  _id: ObjectId,
  clerkId: string,        // Identificador de Clerk (único)
  name: string,
  email: string,          // Único
  role: "customer" | "admin",
  createdAt: Date
}
```

**Índices:** `clerkId` único, `email` único.

### 4.2 Vehicle

```ts
{
  _id: ObjectId,
  title: string,
  brand: string,
  model: string,
  year: number,
  color?: string,
  mileage?: number,
  condition?: "excellent" | "good" | "fair" | "poor",
  description?: string,
  images: string[],       // URLs o data URLs base64 (drag & drop)
  basePrice: number,
  currentPrice: number,   // Inicializado en basePrice, sube con cada puja
  status: "draft" | "published" | "active" | "closed" | "awarded",
  auctionStartDate?: Date,
  auctionEndDate?: Date,
  createdBy: ObjectId,    // → User
  createdAt: Date,
  updatedAt: Date
}
```

**Estados y transiciones:**

```
draft ──► published ──► active ──► closed ──► awarded
   │           │            ▲
   └───────────┴────────────┘  (admin puede revertir)
```

- `draft`: solo visible en backoffice.
- `published`: visible en catálogo público, sin pujas.
- `active`: única en la que se aceptan pujas.
- `closed`: subasta finalizada; al transicionar, **el sistema marca automáticamente la puja más alta como `winner` y el resto como `outbid`**.
- `awarded`: vehículo pagado y entregado.

### 4.3 Bid

```ts
{
  _id: ObjectId,
  vehicleId: ObjectId,    // → Vehicle
  userId: ObjectId,       // → User
  amount: number,
  status: "active" | "outbid" | "winner" | "paid",
  createdAt: Date
}
```

**Ciclo de vida:**

1. Se crea con `status: "active"`.
2. Cuando otra puja la supera → `outbid`.
3. Al cerrarse la subasta, la mayor → `winner`.
4. Al pagar el ganador → `paid`.

### 4.4 Payment

```ts
{
  _id: ObjectId,
  userId: ObjectId,       // → User
  vehicleId: ObjectId,    // → Vehicle
  bidId: ObjectId,        // → Bid
  stripeSessionId: string,
  amount: number,
  status: "pending" | "paid" | "cancelled",
  createdAt: Date
}
```

**Relaciones:**

```
User 1 ─── N Bid       N ─── 1 Vehicle
                        │
                        └── 1 Payment ── 1 Vehicle
```

---

## 5. API REST

Base: `http://localhost:3000`. Todas las respuestas son JSON. Errores: `{ "error": "<mensaje en español>" }`.

### 5.1 Auth Headers

Endpoints protegidos requieren:
```
Authorization: Bearer <Clerk JWT>
```
El frontend lo inyecta automáticamente vía interceptor (`hooks/useApi.ts`).

### 5.2 Users

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `GET` | `/api/users/me` | ✅ User | Retorna el usuario autenticado |
| `POST` | `/api/users/sync` | ❌ | Crea/actualiza usuario por `clerkId` o `email`. Idempotente. |
| `PATCH` | `/api/users/:id/role` | 🔒 Admin | Cambia rol entre `customer` y `admin` |

**`POST /api/users/sync` body:**
```json
{ "clerkId": "user_xxx", "name": "Simón Espino", "email": "..." }
```

### 5.3 Vehicles

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `GET` | `/api/vehicles` | ❌ | Catálogo público. Excluye `draft`. Acepta `?status=` |
| `GET` | `/api/vehicles/admin/all` | 🔒 Admin | Todos los vehículos incluyendo `draft` |
| `GET` | `/api/vehicles/:id` | ❌ | Detalle |
| `POST` | `/api/vehicles` | 🔒 Admin | Crear |
| `PUT` | `/api/vehicles/:id` | 🔒 Admin | Actualizar |
| `DELETE` | `/api/vehicles/:id` | 🔒 Admin | Eliminar |
| `PATCH` | `/api/vehicles/:id/status` | 🔒 Admin | Cambiar estado. Si pasa a `closed`/`awarded` → marca winner/outbid automáticamente |

### 5.4 Bids

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `GET` | `/api/bids` | 🔒 Admin | Todas las pujas con populate de vehicle/user |
| `GET` | `/api/bids/my` | ✅ User | Mis pujas |
| `GET` | `/api/bids/my/purchases` | ✅ User | Solo pujas en estado `paid` (autos comprados) |
| `GET` | `/api/bids/vehicle/:id` | ❌ | Pujas de un vehículo |
| `POST` | `/api/bids/vehicle/:id` | ✅ User | Realizar puja |

**`POST /api/bids/vehicle/:id` body:**
```json
{ "amount": 12500 }
```

**Validaciones aplicadas:**
- `amount` debe ser número.
- `vehicle.status` debe ser `active`.
- `amount > vehicle.currentPrice`.
- Las pujas anteriores con `status: "active"` se marcan como `outbid` antes de insertar la nueva.
- Se actualiza `vehicle.currentPrice` al monto de la nueva puja.

### 5.5 Payments

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `POST` | `/api/payments/create-checkout-session` | ✅ User | Crea sesión de Stripe Checkout para un bid |
| `GET` | `/api/payments/success?session_id=` | ✅ User | Verifica pago, marca bid como `paid` y vehicle como `awarded` |
| `GET` | `/api/payments/cancel` | ✅ User | Endpoint de retorno cuando el usuario cancela |

**`POST /api/payments/create-checkout-session` body:**
```json
{ "bidId": "..." }
```

**Respuesta:**
```json
{ "url": "https://checkout.stripe.com/c/pay/cs_test_..." }
```

### 5.6 Dashboard (Admin)

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/dashboard/summary` | Conteos: vehículos, pujas, usuarios, ingresos |
| `GET` | `/api/dashboard/reports` | Distribución por estado + top pujas + vehículos recientes |

---

## 6. Autenticación y Autorización

### 6.1 Flujo

1. El usuario inicia sesión vía **Clerk** (con OTP por email o contraseña).
2. Clerk emite un **JWT firmado** con el `clerkId` (`sub`) en el payload.
3. El frontend lo agrega como `Authorization: Bearer <token>` a cada request.
4. El middleware `requireAuth` verifica el JWT con `verifyToken()` de `@clerk/backend`.
5. Si es válido, busca al usuario en MongoDB por `clerkId` y lo guarda en `c.set("user", user)`.

### 6.2 Middleware de Autorización

```ts
// backend/src/middlewares/auth.ts
import { verifyToken } from "@clerk/backend";

async function getVerifiedUser(c) {
  const token = c.req.header("Authorization")?.slice(7);
  const payload = await verifyToken(token, {
    secretKey: process.env.CLERK_SECRET_KEY,
    authorizedParties: ["http://localhost:5173"],
  });
  return User.findOne({ clerkId: payload.sub });
}

export const requireAuth = async (c, next) => { /* 401 si no hay user */ };
export const requireAdmin = async (c, next) => { /* 403 si role !== admin */ };
```

### 6.3 Roles

- **`customer`** (default): puede ver catálogo, pujar, pagar y consultar sus subastas/compras.
- **`admin`**: acceso al backoffice (`/admin/*`) con CRUD completo.

Asignación inicial de admin (manual):
```bash
mongosh chocao --eval 'db.users.updateOne({ email: "..." }, { $set: { role: "admin" } })'
```

### 6.4 OTP por Email (Headless)

`components/EmailOtpForm.tsx` implementa el flujo en 2 pasos sin usar el componente `<SignIn>` prefabricado:

1. **Paso 1**: usuario ingresa email → `clerk.client.signIn.create({ identifier: email })` → `prepareFirstFactor({ strategy: "email_code" })`.
2. **Paso 2**: usuario ingresa código de 6 dígitos → `attemptFirstFactor({ strategy: "email_code", code })` → `setActive({ session })`.

Para sign-up es análogo con `signUp.create()` + `prepareEmailAddressVerification()` + `attemptEmailAddressVerification()`.

Incluye `<div id="clerk-captcha" />` requerido para el bot protection de Clerk.

---

## 7. Integración con Stripe

### 7.1 Modo

Stripe se usa en **modo test** (clave `sk_test_...`). API version fija: `2026-04-22.dahlia`.

### 7.2 Singleton

```ts
// backend/src/lib/stripe.ts
import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-04-22.dahlia",
});
export default stripe;
```

### 7.3 Checkout Session

Se usa **Checkout Sessions API** (recomendación oficial de Stripe sobre PaymentIntents directo). Configuración:

```ts
stripe.checkout.sessions.create({
  customer_email: user.email,                  // Aparece en Stripe Dashboard
  line_items: [{ price_data: {...} }],
  mode: "payment",
  success_url: `${SUCCESS_URL}?session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: CANCEL_URL,
  metadata: { bidId, userId, vehicleId, vehicleTitle, buyerEmail, buyerName },
  payment_intent_data: {
    description: `Chocao · ${vehicle.title} · Puja ganadora`,
    metadata: { bidId, vehicleId, buyerEmail },
  },
});
```

**No se especifica `payment_method_types`** — Stripe selecciona dinámicamente según ubicación del comprador.

### 7.4 Confirmación de Pago

`GET /api/payments/success?session_id=...` consulta `stripe.checkout.sessions.retrieve(session_id)`:

```ts
if (session.payment_status === "paid") {
  payment.status = "paid";
  bid.status = "paid";       // antes era "winner"
  vehicle.status = "awarded";
}
```

> **Nota:** En producción se debería implementar un webhook (`stripe.webhooks.constructEvent`) para recibir el evento `checkout.session.completed` de forma asíncrona y resistente a fallos. El polling actual es suficiente para el MVP.

### 7.5 Visualización en Stripe Dashboard

Los pagos aparecen en `https://dashboard.stripe.com/test/payments` con:
- Email del comprador (gracias a `customer_email`).
- Descripción del vehículo.
- Metadata enriquecida (bidId, vehicleId, buyerName, etc.).

---

## 8. Frontend — Componentes y Rutas

### 8.1 Rutas

```ts
/                       → Landing
/login/*                → LoginPage (OTP / Password tabs)
/register/*             → RegisterPage (OTP / Password tabs)
/vehicles               → CatalogPage
/vehicles/:id           → VehicleDetailPage
/my-bids                → MyBidsPage         (protegido)
/my-purchases           → MyPurchasesPage    (protegido)
/checkout/success       → CheckoutResultPage (protegido)
/checkout/cancel        → CheckoutResultPage (protegido)
/admin                  → AdminDashboard     (admin)
/admin/vehicles         → AdminVehicles      (admin)
/admin/bids             → AdminBids          (admin)
/admin/reports          → AdminReports       (admin)
```

### 8.2 Componentes Reutilizables

| Componente | Propósito |
|---|---|
| `GlassCard` | Superficie neumórfica (variantes: raised, inset, flat) |
| `GlassButton` | Botón con estados pressed/hover/disabled (variantes: primary, accent, danger, ghost) |
| `GlassInput` | Input con efecto inset y manejo de error/hint |
| `NeumorphicSelect` | Select estilizado consistente |
| `DataTable<T>` | Tabla genérica con accessor por keyof o función |
| `StatusBadge` | Badge semántico con etiquetas en español |
| `PageHeader` | Encabezado con eyebrow + actions |
| `EmptyState` | Estado vacío con ícono + acción |
| `LoadingState` | Spinner neumórfico |
| `Countdown` | Cuenta regresiva (días/horas/min/seg, refresco cada 1s) |
| `VehicleCard` | Tarjeta de vehículo con imagen, precio, countdown |
| `AdminStatCard` | KPI con ícono e índice de color |
| `BidForm` | Form con sugerencias de monto (+5%, +10%, +20%) |
| `ImageDropzone` | Drag & drop, base64, reorden, máx 6 × 2MB |
| `EmailOtpForm` | OTP headless en 2 pasos |
| `AuthMethodTabs` | Toggle OTP / Password |
| `Logo` | SVG inline (mazo de subasta) |
| `Navbar` | Top bar con navegación pill + UserMenu |
| `UserMenu` | Dropdown con confirmación de logout |
| `ProtectedRoute` | HOC: redirige a `/login` si no hay sesión |
| `AdminRoute` | HOC: verifica `role === "admin"` vía `/api/users/me` |

### 8.3 Hook `useApi()`

```ts
// frontend/src/hooks/useApi.ts
export function useApi() {
  const { getToken } = useAuth();©©
  const authAxios = axios.create({ baseURL: BASE_URL });
  authAxios.interceptors.request.use(async (config) => {
    const token = await getToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });
  return authAxios;
}
```

Cada request adjunta automáticamente el JWT actual de Clerk.

### 8.4 SyncUser (efecto global)

`App.tsx` monta un componente `<SyncUser />` que, cuando detecta sesión activa, hace `POST /api/users/sync` con `{ clerkId, name, email }`. Esto garantiza que el usuario exista en MongoDB en su primer login.

---

## 9. Reglas de Negocio

| # | Regla | Implementación |
|---|---|---|
| 1 | Solo usuarios autenticados pueden pujar | `requireAuth` en `POST /api/bids/vehicle/:id` |
| 2 | Una puja debe ser mayor a la oferta actual | Validación en backend con error 400 |
| 3 | Solo se puede pujar si el vehículo está `active` | Validación en backend |
| 4 | Solo admin puede CRUD vehículos | `requireAdmin` |
| 5 | Al cerrar la subasta, la puja más alta se marca como `winner` automáticamente | `PATCH /api/vehicles/:id/status` con `closed` o `awarded` |
| 6 | Las demás pujas pasan a `outbid` al cerrar la subasta | Mismo endpoint |
| 7 | Tras pago exitoso, el bid pasa a `paid` y el vehículo a `awarded` | `GET /api/payments/success` |
| 8 | El botón "Pagar" solo aparece si `bid.status === "winner"` | `MyBidsPage.tsx` |
| 9 | El historial de compras solo muestra pujas con `status: "paid"` | `GET /api/bids/my/purchases` |

---

## 10. Sistema de Diseño

### 10.1 Estilo: Neumorfismo Institucional

Diseño basado en **soft UI** con sombras duales (luz superior-izquierda, oscuridad inferior-derecha) sobre superficies del mismo tono que el fondo. Paleta institucional con azul profundo, dorado y verde sobrio.

### 10.2 Design Tokens

Definidos como CSS variables en `index.css`:

```css
--bg: #e6ecf2;            /* Fondo principal */
--surface: #edf1f6;       /* Tarjetas */
--primary: #1e3a8a;       /* Azul institucional */
--accent: #b88a2e;        /* Dorado */
--success: #1f7a4d;       /* Verde sobrio */
--danger: #9b2c2c;
--text: #2a3340;          /* Carbón */
--text-muted: #5a6878;

/* Neumorphism shadows calibradas para #e6ecf2 */
--nm-out-sm: 4px 4px 8px var(--nm-dark), -4px -4px 8px var(--nm-light);
--nm-out-md: 6px 6px 14px var(--nm-dark), -6px -6px 14px var(--nm-light);
--nm-in-sm: inset 2px 2px 5px var(--nm-dark), inset -2px -2px 5px var(--nm-light);
```

### 10.3 Tipografía

- **Inter** (300, 400, 500, 600, 700, 800).
- Escala: `--t-xs` (0.75rem) → `--t-3xl` (2.6rem).

### 10.4 Componentes Base

Todas las superficies usan combinaciones de:
- `box-shadow: var(--nm-out-md)` para elevación.
- `box-shadow: var(--nm-in-sm)` para campos hundidos (inputs, tablas).
- `border-radius: var(--radius-md|lg|pill)`.

---

## 11. Variables de Entorno

### Backend (`backend/.env`)

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/chocao
CLERK_SECRET_KEY=sk_test_xxxxx
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_SUCCESS_URL=http://localhost:5173/checkout/success
STRIPE_CANCEL_URL=http://localhost:5173/checkout/cancel
FRONTEND_URL=http://localhost:5173
```

### Frontend (`frontend/.env`)

```env
VITE_API_URL=http://localhost:3000
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
```

---

## 12. Flujos End-to-End

### 12.1 Registro y Primer Login (OTP)

```
Usuario → /register
       → Tab "Código por email"
       → Ingresa email + nombre + apellido
       → clerk.client.signUp.create({ emailAddress, firstName, lastName })
       → clerk.client.signUp.prepareEmailAddressVerification()
       → Recibe código en email
       → Ingresa 6 dígitos
       → attemptEmailAddressVerification({ code })
       → setActive({ session })
       → SyncUser dispara POST /api/users/sync
       → Backend crea User con role="customer"
       → Redirige a /vehicles
```

### 12.2 Pujar en una Subasta

```
Customer → /vehicles/:id
        → BidForm valida amount > currentPrice
        → POST /api/bids/vehicle/:id { amount }
        → Backend:
          ├─ Verifica vehicle.status === "active"
          ├─ Verifica amount > vehicle.currentPrice
          ├─ Marca pujas previas como "outbid"
          ├─ Crea Bid { status: "active" }
          └─ Actualiza vehicle.currentPrice = amount
        → Frontend recarga historial y muestra feedback
```

### 12.3 Cierre de Subasta y Adjudicación Automática

```
Admin → /admin/vehicles
     → Cambia status de un vehículo activo a "closed" o "awarded"
     → PATCH /api/vehicles/:id/status { status: "closed" }
     → Backend:
       ├─ Bid.findOne({ vehicleId }).sort({ amount: -1 })  ← más alta
       ├─ Bid.updateMany({ vehicleId, _id: { $ne: highest._id } }, { status: "outbid" })
       └─ highestBid.status = "winner"
     → El usuario ganador ve el badge "Ganador" + botón "Pagar ahora" en /my-bids
```

### 12.4 Pago con Stripe

```
Usuario ganador → /my-bids
              → Click "Pagar ahora" en bid con status "winner"
              → POST /api/payments/create-checkout-session { bidId }
              → Backend crea Stripe Checkout Session + Payment con status "pending"
              → Devuelve { url }
              → Frontend hace window.location.href = url
              → Usuario paga en Stripe Checkout (4242 4242 4242 4242)
              → Stripe redirige a /checkout/success?session_id=...
              → CheckoutResultPage llama GET /api/payments/success?session_id=...
              → Backend:
                ├─ stripe.checkout.sessions.retrieve(session_id)
                ├─ Si payment_status === "paid":
                │  ├─ Payment.status = "paid"
                │  ├─ Bid.status = "paid"
                │  └─ Vehicle.status = "awarded"
              → Frontend muestra confirmación
              → /my-bids ya no muestra "Pagar ahora"
              → /my-purchases lista el vehículo comprado
```

### 12.5 Diagrama de Estados de un Vehículo

```
                    admin crea
                   ┌──────────┐
                   ▼          │
     ┌──────► draft ──────► published
     │                          │
     │                          ▼
     │                       active ◄─────┐
     │                          │          │
     │              admin       │          │ admin reabre
     │              cierra      │          │ (raro)
     │                          ▼          │
     │                       closed ───────┘
     │                          │
     │   pago confirmado        │
     │       o admin            ▼
     └────────────────────── awarded
```

---

## Apéndice A — Tarjetas de prueba Stripe

| Tarjeta | Número | Resultado |
|---|---|---|
| Visa exitosa | `4242 4242 4242 4242` | Pago aprobado |
| Visa declinada | `4000 0000 0000 0002` | Pago rechazado |
| Requiere 3DS | `4000 0027 6000 3184` | Autenticación 3DS |

Fecha: cualquier futura · CVC: cualquier 3 dígitos · ZIP: cualquier 5 dígitos.

## Apéndice B — Comandos útiles

```bash
# Listar usuarios
mongosh chocao --eval 'db.users.find().toArray()'

# Asignar admin
mongosh chocao --eval 'db.users.updateOne({ email: "..." }, { $set: { role: "admin" } })'

# Ver pujas con vehículo populado
mongosh chocao --eval 'db.bids.aggregate([{$lookup:{from:"vehicles",localField:"vehicleId",foreignField:"_id",as:"vehicle"}}]).toArray()'

# Resetear pujas de un vehículo
mongosh chocao --eval 'db.bids.deleteMany({ vehicleId: ObjectId("...") })'
```

---

*Documento generado para Universidad — DSIX · Parcial 2 · 2026*

# Chocao

**Plataforma B2G de subastas oficiales de vehículos aprehendidos** por el Gobierno de Panamá. Permite a la ciudadanía registrarse, pujar en línea sobre vehículos retenidos por el Estado y completar pagos digitales — con un panel administrativo para gestionar el catálogo, monitorear pujas y generar reportes.

> Proyecto universitario · Universidad — DSIX · Parcial 2

---

## Funcionalidades

### Para ciudadanos (customer)
- Registro/login con **email + código OTP** (sin contraseña) o método tradicional, vía **Clerk**
- Catálogo público de vehículos con filtros por estado y búsqueda
- Detalle de vehículo con galería, especificaciones técnicas y **cuenta regresiva en vivo** (días/horas/min/seg)
- Realizar pujas con sugerencias automáticas (+5%, +10%, +20%)
- Sección **"Mis subastas"** con stats (pujas totales, activas, ganadas)
- Pago en línea vía **Stripe Checkout** (modo test)
- Sección **"Mis compras"** con todos los vehículos pagados
- Confirmación de logout para evitar cierres accidentales

### Para administradores (admin)
- Dashboard con KPIs en tiempo real (vehículos, pujas, usuarios, recaudación)
- CRUD de vehículos con **drag & drop de imágenes** (hasta 6 imágenes, 2 MB c/u)
- Cambio de estado inline desde la tabla (`draft → published → active → closed → awarded`)
- **Adjudicación automática**: al cerrar la subasta, la puja más alta se marca como ganadora
- Vista de todas las pujas del sistema
- Reportes con distribución por estado y métricas derivadas

---

## Stack Tecnológico

### Backend

| Tecnología | Versión | Rol |
|---|---|---|
| **Bun** | ≥ 1.3 | Runtime JavaScript/TypeScript |
| **Hono** | 4.12.15 | Framework HTTP minimalista, edge-ready |
| **MongoDB** | local 7.x | Base de datos NoSQL |
| **Mongoose** | 9.5.0 | ODM con esquemas tipados |
| **@clerk/backend** | 3.4.1 | Verificación de JWT emitidos por Clerk |
| **Stripe Node SDK** | 22.1.0 | Integración Stripe (API version `2026-04-22.dahlia`) |
| **dotenv** | 17.4.2 | Carga de variables de entorno |

### Frontend

| Tecnología | Versión | Rol |
|---|---|---|
| **React** | 19.2.5 | UI declarativa |
| **Vite** | 8.0.10 | Bundler + dev server con HMR |
| **TypeScript** | 6.0.x | Tipado estático |
| **React Router** | 7.14.2 | Enrutado SPA con layouts anidados |
| **@clerk/react** | 6.4.5 | SDK de autenticación cliente |
| **axios** | 1.15.2 | Cliente HTTP con interceptores |

---

## Arquitectura

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

**Patrones aplicados:**
- **Stateless API**: el backend no guarda sesiones; cada request lleva el JWT de Clerk.
- **Middleware chain**: `requireAuth` y `requireAdmin` interceptan rutas protegidas y populan `c.get("user")`.
- **Singleton de Stripe** (`lib/stripe.ts`) — instancia única reutilizada en todas las peticiones.
- **Sync diferido de usuarios**: Clerk maneja el registro; al primer login, `POST /api/users/sync` crea/actualiza la fila en MongoDB.

---

## Estructura del Proyecto

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
│   │   │   ├── User.ts
│   │   │   ├── Vehicle.ts
│   │   │   ├── Bid.ts
│   │   │   └── Payment.ts
│   │   └── routes/
│   │       ├── users.ts
│   │       ├── vehicles.ts
│   │       ├── bids.ts
│   │       ├── payments.ts
│   │       └── dashboard.ts
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── main.tsx                # ClerkProvider + createRoot
│   │   ├── App.tsx                 # BrowserRouter + Routes + SyncUser
│   │   ├── index.css               # Design tokens (CSS variables)
│   │   ├── types/index.ts
│   │   ├── lib/api.ts              # axios instance pública
│   │   ├── hooks/useApi.ts         # axios autenticado (Bearer token)
│   │   ├── layouts/
│   │   │   ├── PublicLayout.tsx
│   │   │   └── AdminLayout.tsx
│   │   ├── components/             # 21 componentes reutilizables
│   │   └── pages/                  # 9 páginas públicas + 4 admin
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
└── README.md
```

---

## Modelo de Datos

### User

```ts
{
  clerkId: string,        // Identificador único de Clerk
  name: string,
  email: string,          // Único
  role: "customer" | "admin",
  createdAt: Date
}
```

### Vehicle

```ts
{
  title, brand, model, year, color?, mileage?,
  condition?: "excellent" | "good" | "fair" | "poor",
  images: string[],       // URLs base64 (drag & drop)
  basePrice: number,
  currentPrice: number,   // Sube con cada puja
  status: "draft" | "published" | "active" | "closed" | "awarded",
  auctionStartDate?, auctionEndDate?,
  createdBy: ObjectId     // → User
}
```

**Transiciones de estado:**
```
draft ──► published ──► active ──► closed ──► awarded
```

- `draft`: solo visible en backoffice.
- `published`: visible en catálogo, sin pujas.
- `active`: acepta pujas.
- `closed`: al transicionar, **la puja más alta pasa a `winner` y el resto a `outbid` automáticamente**.
- `awarded`: vehículo pagado.

### Bid

```ts
{
  vehicleId: ObjectId,
  userId: ObjectId,
  amount: number,
  status: "active" | "outbid" | "winner" | "paid",
  createdAt: Date
}
```

### Payment

```ts
{
  userId, vehicleId, bidId: ObjectId,
  stripeSessionId: string,
  amount: number,
  status: "pending" | "paid" | "cancelled",
  createdAt: Date
}
```

---

## API REST

Base: `http://localhost:3000`. Todas las respuestas son JSON. Errores: `{ "error": "<mensaje>" }`.

Endpoints protegidos requieren: `Authorization: Bearer <Clerk JWT>`

### Usuarios

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `GET` | `/api/users/me` | User | Retorna el usuario autenticado |
| `POST` | `/api/users/sync` | — | Crea/actualiza usuario por `clerkId`. Idempotente. |
| `PATCH` | `/api/users/:id/role` | Admin | Cambia rol |

### Vehículos

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `GET` | `/api/vehicles` | — | Catálogo público (excluye `draft`). Acepta `?status=` |
| `GET` | `/api/vehicles/admin/all` | Admin | Todos, incluye `draft` |
| `GET` | `/api/vehicles/:id` | — | Detalle |
| `POST` | `/api/vehicles` | Admin | Crear |
| `PUT` | `/api/vehicles/:id` | Admin | Actualizar |
| `DELETE` | `/api/vehicles/:id` | Admin | Eliminar |
| `PATCH` | `/api/vehicles/:id/status` | Admin | Cambiar estado — si pasa a `closed`, marca winner automáticamente |

### Pujas

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `GET` | `/api/bids` | Admin | Todas las pujas |
| `GET` | `/api/bids/my` | User | Mis pujas |
| `GET` | `/api/bids/my/purchases` | User | Solo pujas en estado `paid` |
| `GET` | `/api/bids/vehicle/:id` | — | Pujas de un vehículo |
| `POST` | `/api/bids/vehicle/:id` | User | Realizar puja — body: `{ "amount": 12500 }` |

**Validaciones:** `amount` debe ser mayor a `vehicle.currentPrice`; `vehicle.status` debe ser `active`.

### Pagos

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `POST` | `/api/payments/create-checkout-session` | User | Crea sesión Stripe — body: `{ "bidId": "..." }` |
| `GET` | `/api/payments/success?session_id=` | User | Verifica pago, marca bid `paid` y vehicle `awarded` |
| `GET` | `/api/payments/cancel` | User | Retorno de cancelación |

### Dashboard (Admin)

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/dashboard/summary` | KPIs: vehículos, pujas, usuarios, ingresos |
| `GET` | `/api/dashboard/reports` | Distribución por estado + top pujas |

---

## Autenticación y Autorización

1. El usuario inicia sesión vía **Clerk** (OTP por email o contraseña).
2. Clerk emite un **JWT firmado** con el `clerkId` (`sub`) en el payload.
3. El frontend lo adjunta como `Authorization: Bearer <token>` a cada request via interceptor (`hooks/useApi.ts`).
4. El middleware `requireAuth` verifica el JWT con `verifyToken()` de `@clerk/backend`.
5. Si es válido, busca al usuario en MongoDB por `clerkId` y lo guarda en `c.set("user", user)`.

**Roles:**
- **`customer`** (default): puede ver catálogo, pujar, pagar y consultar sus subastas/compras.
- **`admin`**: acceso al backoffice con CRUD completo.

### OTP por Email (Headless)

`components/EmailOtpForm.tsx` implementa el flujo en 2 pasos sin usar el componente prefabricado de Clerk:

1. Usuario ingresa email → `clerk.client.signIn.create()` → `prepareFirstFactor({ strategy: "email_code" })`.
2. Usuario ingresa código → `attemptFirstFactor({ strategy: "email_code", code })` → `setActive({ session })`.

---

## Integración con Stripe

Stripe se usa en **modo test** (clave `sk_test_...`). API version fija: `2026-04-22.dahlia`.

Se usa **Checkout Sessions API** (recomendación oficial sobre PaymentIntents directo):

```ts
stripe.checkout.sessions.create({
  customer_email: user.email,
  line_items: [{ price_data: {...} }],
  mode: "payment",
  success_url: `${SUCCESS_URL}?session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: CANCEL_URL,
  metadata: { bidId, vehicleId, vehicleTitle, buyerName },
});
```

`GET /api/payments/success` consulta `stripe.checkout.sessions.retrieve(session_id)` y, si `payment_status === "paid"`, marca el pago, la puja y el vehículo como completados.

> En producción se debería implementar un webhook (`checkout.session.completed`) para mayor robustez. El polling actual es suficiente para el MVP.

---

## Frontend — Pantallas y Componentes

### Rutas

| Ruta | Acceso | Descripción |
|---|---|---|
| `/` | Público | Landing con hero, beneficios y vehículos destacados |
| `/login` | Público | Login con tabs OTP / Password |
| `/register` | Público | Registro con tabs OTP / Password |
| `/vehicles` | Público | Catálogo con filtros + búsqueda |
| `/vehicles/:id` | Público | Detalle, galería, historial de pujas, countdown |
| `/my-bids` | Customer | Historial de pujas con stats |
| `/my-purchases` | Customer | Vehículos comprados |
| `/checkout/success` | Customer | Confirmación de pago Stripe |
| `/checkout/cancel` | Customer | Cancelación de pago |
| `/admin` | Admin | Dashboard con KPIs |
| `/admin/vehicles` | Admin | CRUD de vehículos + drag & drop |
| `/admin/bids` | Admin | Tabla de todas las pujas |
| `/admin/reports` | Admin | Distribución de inventario y métricas |

### Componentes Reutilizables

| Componente | Propósito |
|---|---|
| `GlassCard` | Superficie neumórfica (raised / inset / flat) |
| `GlassButton` | Botón con estados pressed/hover/disabled |
| `GlassInput` | Input con efecto inset y manejo de error |
| `NeumorphicSelect` | Select estilizado consistente |
| `DataTable<T>` | Tabla genérica tipada |
| `StatusBadge` | Badge semántico con etiquetas en español |
| `Countdown` | Cuenta regresiva en tiempo real (refresco 1 s) |
| `VehicleCard` | Tarjeta con imagen, precio y countdown |
| `BidForm` | Form con sugerencias (+5%, +10%, +20%) |
| `ImageDropzone` | Drag & drop, base64, reorden, máx 6 × 2 MB |
| `EmailOtpForm` | OTP headless en 2 pasos |
| `ProtectedRoute` | Redirige a `/login` si no hay sesión |
| `AdminRoute` | Verifica `role === "admin"` vía `/api/users/me` |

---

## Reglas de Negocio

| # | Regla | Implementación |
|---|---|---|
| 1 | Solo usuarios autenticados pueden pujar | `requireAuth` en `POST /api/bids/vehicle/:id` |
| 2 | Una puja debe superar la oferta actual | Validación backend, error 400 |
| 3 | Solo se puede pujar si el vehículo está `active` | Validación backend |
| 4 | Solo admin puede CRUD vehículos | `requireAdmin` |
| 5 | Al cerrar la subasta, la puja más alta se marca `winner` automáticamente | `PATCH /api/vehicles/:id/status { status: "closed" }` |
| 6 | Las demás pujas pasan a `outbid` al cerrar | Mismo endpoint |
| 7 | Tras pago exitoso, bid → `paid` y vehicle → `awarded` | `GET /api/payments/success` |
| 8 | El botón "Pagar" solo aparece si `bid.status === "winner"` | `MyBidsPage.tsx` |
| 9 | Historial de compras solo muestra bids con `status: "paid"` | `GET /api/bids/my/purchases` |

---

## Sistema de Diseño

**Estilo**: Neumorfismo institucional sobre fondo gris azulado claro (`#e6ecf2`).

**Paleta:**
- Azul institucional `#1e3a8a`
- Dorado de acento `#b88a2e`
- Verde sobrio `#1f7a4d`
- Carbón para texto `#2a3340`

**Tokens (CSS variables en `index.css`):**
```css
--bg: #e6ecf2;
--surface: #edf1f6;
--primary: #1e3a8a;
--accent: #b88a2e;
--success: #1f7a4d;
--nm-out-md: 6px 6px 14px var(--nm-dark), -6px -6px 14px var(--nm-light);
--nm-in-sm: inset 2px 2px 5px var(--nm-dark), inset -2px -2px 5px var(--nm-light);
```

**Tipografía:** Inter (300–800). Escala `--t-xs` (0.75rem) → `--t-3xl` (2.6rem).

---

## Instalación y Ejecución

### Requisitos previos
- [Bun](https://bun.sh) `≥ 1.0`
- [MongoDB](https://www.mongodb.com/try/download/community) corriendo en `mongodb://localhost:27017`
- Cuenta en [Clerk](https://clerk.com) (instancia de desarrollo)
- Cuenta en [Stripe](https://stripe.com) (modo test)

### 1. Clonar

```bash
git clone https://github.com/liversay/Chocao_ecommerce.git
cd Chocao_ecommerce
```

### 2. Configurar Backend

```bash
cd backend
cp .env.example .env   # o crea el archivo manualmente
```

Edita `backend/.env`:

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/chocao
CLERK_SECRET_KEY=sk_test_xxxxx
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_SUCCESS_URL=http://localhost:5173/checkout/success
STRIPE_CANCEL_URL=http://localhost:5173/checkout/cancel
FRONTEND_URL=http://localhost:5173
```

```bash
bun install
bun run dev   # http://localhost:3000
```

### 3. Configurar Frontend

```bash
cd ../frontend
cp .env.example .env   # o crea el archivo manualmente
```

Edita `frontend/.env`:

```env
VITE_API_URL=http://localhost:3000
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
```

```bash
bun install
bun run dev   # http://localhost:5173
```

### 4. Configurar Clerk

En el dashboard de Clerk → **User & Authentication → Email, Phone, Username**:
1. **Email address**: required
2. **Authentication strategies**: habilitar **Email verification code** (OTP)
3. **Username**: opcional / off

### 5. Asignar primer admin

Después de registrarte por primera vez:

```bash
mongosh chocao --eval 'db.users.updateOne({ email: "tu@email.com" }, { $set: { role: "admin" } })'
```

Recarga el frontend — verás el botón **Backoffice** en la navbar.

---

## Flujos End-to-End

### Registro y Primer Login (OTP)

```
Usuario → /register → Tab "Código por email"
       → Ingresa email + nombre
       → clerk.client.signUp.create() → prepareEmailAddressVerification()
       → Recibe código → attemptEmailAddressVerification({ code })
       → setActive({ session })
       → SyncUser: POST /api/users/sync
       → Backend crea User con role="customer"
       → Redirige a /vehicles
```

### Pujar en una Subasta

```
Customer → /vehicles/:id → BidForm valida amount > currentPrice
        → POST /api/bids/vehicle/:id { amount }
        → Backend: verifica status "active" + amount > currentPrice
                   marca pujas previas como "outbid"
                   crea Bid { status: "active" }
                   actualiza vehicle.currentPrice
```

### Cierre y Adjudicación Automática

```
Admin → PATCH /api/vehicles/:id/status { status: "closed" }
     → Backend: Bid.findOne().sort({ amount: -1 }) → winner
                Bid.updateMany({ $ne: highest }) → outbid
     → Usuario ganador ve badge "Ganador" + botón "Pagar ahora"
```

### Pago con Stripe

```
Usuario → /my-bids → "Pagar ahora"
        → POST /api/payments/create-checkout-session { bidId }
        → Redirige a Stripe Checkout (4242 4242 4242 4242)
        → Stripe → /checkout/success?session_id=...
        → GET /api/payments/success
        → Backend: stripe.checkout.sessions.retrieve()
                   si paid → Payment.status="paid", Bid.status="paid", Vehicle.status="awarded"
        → /my-purchases lista el vehículo comprado
```

---

## Tarjetas de Prueba Stripe

| Tarjeta | Número | Resultado |
|---|---|---|
| Visa exitosa | `4242 4242 4242 4242` | Aprobado |
| Visa declinada | `4000 0000 0000 0002` | Rechazado |
| Requiere 3DS | `4000 0027 6000 3184` | Autenticación 3DS |

Fecha: cualquier futura · CVC: cualquier 3 dígitos · ZIP: cualquier 5 dígitos.

---

## Comandos Útiles

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

*Proyecto académico · Universidad — DSIX · Parcial 2 · 2026*

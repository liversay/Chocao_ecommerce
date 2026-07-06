# 🏛️ Chocao

**Plataforma B2G de subastas oficiales de vehículos aprehendidos** por el Gobierno de Panamá. Permite a la ciudadanía registrarse, pujar en línea sobre vehículos retenidos por el Estado, y completar pagos digitales — con un panel administrativo para gestionar el catálogo, monitorear pujas y generar reportes.

> Proyecto universitario · Universidad — DSIX · Parcial 2

---

## ✨ Funcionalidades

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
- CRUD de vehículos con **drag & drop de imágenes** (hasta 6 imágenes, 2MB c/u)
- Cambio de estado inline desde la tabla (`draft → published → active → closed → awarded`)
- **Adjudicación automática**: al cerrar la subasta, la puja más alta se marca como ganadora
- Vista de todas las pujas del sistema
- Reportes con distribución por estado y métricas derivadas

---

## 🛠 Stack Tecnológico

| Capa | Tecnología | Versión |
|---|---|---|
| **Runtime** | Bun | ≥ 1.3 |
| **Backend** | Hono + Mongoose | 4.12 + 9.5 |
| **Frontend** | React + Vite + TypeScript | 19 + 8 + 6 |
| **Routing** | React Router | 7.14 |
| **HTTP Client** | Axios (con interceptor JWT) | 1.15 |
| **Base de datos** | MongoDB local | 7.x |
| **Auth** | Clerk (`@clerk/react` + `@clerk/backend`) | 6.4 + 3.4 |
| **Pagos** | Stripe Checkout (`apiVersion 2026-04-22.dahlia`) | 22.1 |
| **Diseño** | CSS Variables + Neumorfismo institucional | - |

---

## 📁 Estructura

```
chocao/
├── backend/             # Hono + Bun
│   └── src/
│       ├── index.ts     # CORS, routers, bootstrap
│       ├── lib/         # db.ts, stripe.ts (singleton)
│       ├── middlewares/ # requireAuth, requireAdmin
│       ├── models/      # User, Vehicle, Bid, Payment
│       └── routes/      # users, vehicles, bids, payments, dashboard
├── frontend/            # React + Vite
│   └── src/
│       ├── main.tsx     # ClerkProvider
│       ├── App.tsx      # Routes + SyncUser
│       ├── components/  # 21 componentes reutilizables
│       ├── pages/       # 9 páginas públicas + 4 admin
│       ├── layouts/     # PublicLayout, AdminLayout
│       ├── hooks/       # useApi (axios autenticado)
│       └── types/       # User, Vehicle, Bid, Payment
├── README.md            # Este archivo
├── DOCUMENTATION.md     # Documentación técnica completa
└── .env.example
```

---

## 🚀 Instalación y Ejecución

### Requisitos previos
- [Bun](https://bun.sh) `≥ 1.0`
- [MongoDB](https://www.mongodb.com/try/download/community) corriendo localmente en `mongodb://localhost:27017`
- Cuenta en [Clerk](https://clerk.com) (instancia de desarrollo)
- Cuenta en [Stripe](https://stripe.com) (modo test)

### 1. Clonar e instalar

```bash
git clone <repo-url>
cd chocao
```

### 2. Configurar Backend

```bash
cd backend
cp .env.example .env
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

Instala y arranca:

```bash
bun install
bun run dev
```

Backend disponible en `http://localhost:3000`.

### 3. Configurar Frontend

```bash
cd ../frontend
cp .env.example .env
```

Edita `frontend/.env`:

```env
VITE_API_URL=http://localhost:3000
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
```

Instala y arranca:

```bash
bun install
bun run dev
```

Frontend disponible en `http://localhost:5173`.

### 4. Asignar tu primer admin

Después de registrarte por primera vez en la app:

```bash
mongosh chocao --eval 'db.users.updateOne({ email: "tu@email.com" }, { $set: { role: "admin" } })'
```

Recarga el frontend — verás el botón **Backoffice** en la navbar.

---

## 🔐 Configuración de Clerk

En el dashboard de Clerk → **User & Authentication → Email, Phone, Username**:

1. **Email address**: required
2. **Authentication strategies**:
   - ✅ **Email verification code** (OTP)
   - ⬜ **Password** (opcional, no marcar como required si quieres usar solo OTP)
3. **Username**: opcional / off

Esto habilita el flujo OTP sin contraseña por defecto.

---

## 💳 Pagos con Stripe (modo test)

Tarjetas de prueba:

| Tarjeta | Número | Resultado |
|---|---|---|
| Visa exitosa | `4242 4242 4242 4242` | ✅ Aprobado |
| Visa declinada | `4000 0000 0000 0002` | ❌ Rechazado |

Fecha: cualquier futura · CVC: cualquier 3 dígitos · ZIP: cualquier 5 dígitos.

Los pagos aparecen en `https://dashboard.stripe.com/test/payments` con el email del comprador, descripción del vehículo y metadata enriquecida (`bidId`, `vehicleId`, `vehicleTitle`, `buyerName`).

---

## 🗺 Pantallas

| Ruta | Acceso | Descripción |
|---|---|---|
| `/` | Público | Landing con hero, beneficios, vehículos destacados, proceso |
| `/login` | Público | Login con tabs OTP / Password |
| `/register` | Público | Registro con tabs OTP / Password |
| `/vehicles` | Público | Catálogo con filtros + búsqueda |
| `/vehicles/:id` | Público | Detalle, galería, historial de pujas, countdown |
| `/my-bids` | Customer | Historial de pujas con stats |
| `/my-purchases` | Customer | Vehículos comprados (pagados) |
| `/checkout/success` | Customer | Confirmación de pago Stripe |
| `/checkout/cancel` | Customer | Cancelación de pago |
| `/admin` | Admin | Dashboard con KPIs y tablas |
| `/admin/vehicles` | Admin | CRUD de vehículos + drag & drop imágenes |
| `/admin/bids` | Admin | Tabla de todas las pujas |
| `/admin/reports` | Admin | Distribución de inventario y métricas |

---

## 🔌 API Endpoints (resumen)

```
# Usuarios
GET    /api/users/me                         (auth)
POST   /api/users/sync                       (público, idempotente)
PATCH  /api/users/:id/role                   (admin)

# Vehículos
GET    /api/vehicles                         (público, ?status=)
GET    /api/vehicles/admin/all               (admin)
GET    /api/vehicles/:id                     (público)
POST   /api/vehicles                         (admin)
PUT    /api/vehicles/:id                     (admin)
DELETE /api/vehicles/:id                     (admin)
PATCH  /api/vehicles/:id/status              (admin) ← marca winner automáticamente

# Pujas
GET    /api/bids                             (admin)
GET    /api/bids/my                          (auth)
GET    /api/bids/my/purchases                (auth) ← solo bids pagados
GET    /api/bids/vehicle/:id                 (público)
POST   /api/bids/vehicle/:id                 (auth)

# Pagos
POST   /api/payments/create-checkout-session (auth)
GET    /api/payments/success?session_id=     (auth)
GET    /api/payments/cancel                  (auth)

# Dashboard
GET    /api/dashboard/summary                (admin)
GET    /api/dashboard/reports                (admin)
```

> Documentación completa de modelos, validaciones y flujos en **[DOCUMENTATION.md](./DOCUMENTATION.md)**.

---

## 📊 Estados de Subasta

| Estado | Descripción |
|---|---|
| `draft` | Vehículo creado, solo visible en backoffice |
| `published` | Visible en catálogo público pero sin pujas |
| `active` | Subasta abierta, acepta pujas |
| `closed` | Subasta cerrada (puja más alta marcada como `winner` automáticamente) |
| `awarded` | Adjudicado y pagado |

---

## 🎨 Sistema de Diseño

**Estilo**: Neumorfismo institucional sobre fondo gris azulado claro (`#e6ecf2`).

**Paleta**:
- Azul institucional `#1e3a8a`
- Dorado de acento `#b88a2e`
- Verde sobrio `#1f7a4d`
- Carbón para texto `#2a3340`

**Componentes neumórficos**: tarjetas elevadas con sombras duales, inputs hundidos (inset), botones soft UI con estados pressed/hover. 21 componentes reutilizables.

---

## 📚 Documentación adicional

- **[DOCUMENTATION.md](./DOCUMENTATION.md)** — Documentación técnica completa: arquitectura, modelo de datos, flujos end-to-end, integración Stripe, autenticación.

---

## 📜 Licencia

Proyecto académico — Universidad — DSIX · Parcial 2 · 2026

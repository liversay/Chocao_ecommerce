# Cumplimiento de Subasta y Entrega — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Acercar chocao a las reglas de negocio de subasta y entrega de vehículos aprehendidos (acreditación básica del proponente, adjudicación/pago con plazo legal, entrega física post-adjudicación) sin migrar el modelo de datos existente — todo aditivo sobre el ecommerce genérico actual.

**Architecture:** Nuevos modelos (`Proponente`, `Adjudicacion`, `Deposito`, `Entrega`) y servicios (`acreditacion`, `entrega`, `contrato`) siguiendo exactamente los patrones ya existentes (Hono routes finas que delegan en `services/`, Zod validation vía `validate()`, Mongoose con `timestamps`, `AuditLog` inmutable vía `recordAudit`, claims atómicos `findOneAndUpdate` para concurrencia, RBAC vía `requirePermission`). El gate de acreditación se inserta en `services/bids.ts::placeBid`. La inhabilitación reutiliza el baneo existente (`User.banned`) — no hay modelo de inhabilitados nuevo.

**Tech Stack:** Bun + Hono + Mongoose (backend), React 19 + Vite + `lucide-react` + tokens CSS (frontend), Zod v4, Clerk, Stripe. Sin librerías nuevas.

## Global Constraints

- **No se migra el modelo de datos existente.** `Vehicle.status` (`draft|published|active|closed|awarded`), `Bid.status` (`active|outbid|winner|paid`), `Payment.status` (`pending|paid|cancelled|refunded`) permanecen sin cambios de enum. Todo cambio es aditivo (campos nuevos, modelos nuevos).
- **Roles nuevos:** exactamente `auditor` y `custodio`, agregados a `Role` en `backend/src/lib/permissions.ts` y al enum `role` de `backend/src/models/User.ts`. No se agregan `juridico` ni `financiero`.
- **Inhabilitación = baneo existente.** No se crea un modelo `Inhabilitado`. Se reutiliza `User.banned` + el flujo de `backend/src/services/users.ts` (ya expuesto en `PATCH /api/users/:id/role` y `/:id/ban`, ya bloqueado en `requireAuth`/`requirePermission` vía `rejectIfBanned`).
- **Plazo de pago legal: exactamente 5 días hábiles** desde la fecha del acto (cierre del vehículo), calculados con un servicio de calendario — **nunca `fecha + 5`**.
- **Ventana de oferta al segundo postor: 2 días hábiles**, configurable vía `process.env.SEGUNDO_POSTOR_DIAS_HABILES` (default `"2"`).
- **Sin fianza.** La modalidad es siempre electrónica en este sistema — no se implementa RA-07/RA-08 (fianza), ni su deducción en RP-03.
- **Idioma y estilo:** todo texto de usuario (mensajes de error, labels, UI) en español, igual que el resto del código. Comentarios de código en español, siguiendo el tono ya presente (explican el "por qué", no el "qué").
- **Sin librerías nuevas.** PDFs de contrato/acta se generan como HTML imprimible (mismo patrón que `ReceiptPage.tsx` actual), no con una librería PDF.
- **Todo evento sensible nuevo se audita** vía `recordAudit()` (`backend/src/services/audit.ts`), siguiendo el patrón ya usado en `services/auctions.ts` y `services/payments.ts` (acción con antes/después).
- **Cada tarea que toca un servicio de negocio existente (`services/bids.ts`, `services/auctions.ts`, `services/payments.ts`) debe mantener verdes los tests actuales de ese archivo** (`bun test` dirigido al archivo) antes de tocar el resto de la suite.

---

### Task 1: RBAC — roles `auditor` y `custodio`

**Files:**
- Modify: `backend/src/models/User.ts` (enum `role`)
- Modify: `backend/src/lib/permissions.ts`
- Test: `backend/src/lib/permissions.test.ts` (nuevo — no existe hoy; verificar primero con `ls backend/src/lib/*.test.ts`)

**Interfaces:**
- Produces: `Role = "customer" | "admin" | "auditor" | "custodio"`; permisos nuevos `"entrega:read"`, `"entrega:execute"`, `"acreditacion:review"` añadidos a `PERMISSIONS`.

- [ ] **Step 1: Escribe el test que fija el contrato de permisos**

En un archivo nuevo `backend/src/lib/permissions.test.ts` (mirar `backend/src/models/models.test.ts` para el estilo de `import { test, expect } from "bun:test"` usado en este repo):

```ts
import { test, expect } from "bun:test";
import { checkPermission, permissionsForRole } from "./permissions";

test("auditor solo tiene permisos de lectura", () => {
  const auditor = { role: "auditor" as const };
  expect(checkPermission(auditor, "audit:read")).toBe(true);
  expect(checkPermission(auditor, "catalog:read")).toBe(true);
  expect(checkPermission(auditor, "entrega:read")).toBe(true);
  expect(checkPermission(auditor, "vehicle:write")).toBe(false);
  expect(checkPermission(auditor, "bids:write")).toBe(false);
  expect(checkPermission(auditor, "payment:refund")).toBe(false);
  expect(checkPermission(auditor, "entrega:execute")).toBe(false);
});

test("custodio solo puede leer catálogo y ejecutar entregas", () => {
  const custodio = { role: "custodio" as const };
  expect(checkPermission(custodio, "catalog:read")).toBe(true);
  expect(checkPermission(custodio, "entrega:read")).toBe(true);
  expect(checkPermission(custodio, "entrega:execute")).toBe(true);
  expect(checkPermission(custodio, "vehicle:write")).toBe(false);
  expect(checkPermission(custodio, "users:manage")).toBe(false);
});

test("admin conserva todos los permisos, incluidos los nuevos", () => {
  expect(permissionsForRole("admin")).toContain("entrega:read");
  expect(permissionsForRole("admin")).toContain("entrega:execute");
  expect(permissionsForRole("admin")).toContain("acreditacion:review");
});
```

- [ ] **Step 2: Corre el test y confirma que falla**

Run: `cd backend && bun test src/lib/permissions.test.ts`
Expected: FAIL — `Role`/`PERMISSIONS` aún no incluyen `auditor`/`custodio`/los permisos nuevos (error de tipos o `checkPermission` devolviendo `false` donde el test espera `true`).

- [ ] **Step 3: Amplía el enum de rol en el modelo**

En `backend/src/models/User.ts`, cambia:
```ts
role: "customer" | "admin";
```
a:
```ts
role: "customer" | "admin" | "auditor" | "custodio";
```
y el schema:
```ts
role: { type: String, enum: ["customer", "admin", "auditor", "custodio"], default: "customer" },
```

- [ ] **Step 4: Amplía el catálogo de permisos**

En `backend/src/lib/permissions.ts`, agrega a `PERMISSIONS` (antes del `] as const;`):
```ts
  "entrega:read", // ver el estado de una entrega (custodio, comprador dueño, admin)
  "entrega:execute", // ejecutar el checklist de inspección y generar el acta (custodio)
  "acreditacion:review", // aprobar/rechazar la acreditación de un proponente (admin)
```
y `ROLE_PERMISSIONS`:
```ts
const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  customer: ["catalog:read", "bids:read", "bids:write", "payments:write"],
  admin: [...PERMISSIONS],
  auditor: [
    "catalog:read",
    "bids:read",
    "payments:read",
    "dashboard:read",
    "report:read",
    "audit:read",
    "entrega:read",
    "users:read",
  ],
  custodio: ["catalog:read", "entrega:read", "entrega:execute"],
};
```

- [ ] **Step 5: Corre el test y confirma que pasa**

Run: `cd backend && bun test src/lib/permissions.test.ts`
Expected: PASS, 3/3.

- [ ] **Step 6: Corre la suite completa de backend para confirmar que nada más se rompió**

Run: `cd backend && bun test`
Expected: todos los tests existentes en verde (el cambio es aditivo — ampliar un enum de string no debería romper nada que compare por valor exacto contra `"customer"`/`"admin"`).

- [ ] **Step 7: Commit**

```bash
git add backend/src/models/User.ts backend/src/lib/permissions.ts backend/src/lib/permissions.test.ts
git commit -m "feat(rbac): agrega roles auditor y custodio con permisos de solo-lectura/entrega"
```

---

### Task 2: Servicio de calendario de días hábiles

**Files:**
- Create: `backend/src/lib/calendario.ts`
- Create: `backend/src/data/feriados.json`
- Test: `backend/src/lib/calendario.test.ts`

**Interfaces:**
- Produces: `addBusinessDays(date: Date, n: number): Date`, `isBusinessDay(date: Date): boolean` — usados por Task 8 (plazo de pago y ventana del 2º postor).
- Consumes: nada de tareas anteriores.

- [ ] **Step 1: Crea el calendario de feriados (dato, no código)**

`backend/src/data/feriados.json` — feriados nacionales de Panamá, formato `YYYY-MM-DD`, versionado por año. **Nota:** lista ilustrativa para esta demo (confirmar contra fuente oficial antes de un uso real — punto abierto #7 del documento de reglas de negocio):

```json
{
  "2025": [
    "2025-01-01", "2025-01-09", "2025-03-03", "2025-03-04",
    "2025-04-18", "2025-05-01", "2025-11-03", "2025-11-04",
    "2025-11-05", "2025-11-10", "2025-11-28", "2025-12-08", "2025-12-25"
  ],
  "2026": [
    "2026-01-01", "2026-01-09", "2026-02-16", "2026-02-17",
    "2026-04-03", "2026-05-01", "2026-11-03", "2026-11-04",
    "2026-11-05", "2026-11-10", "2026-11-28", "2026-12-08", "2026-12-25"
  ]
}
```

- [ ] **Step 2: Escribe los tests que fijan el contrato del servicio**

`backend/src/lib/calendario.test.ts`:
```ts
import { test, expect } from "bun:test";
import { addBusinessDays, isBusinessDay } from "./calendario";

test("isBusinessDay: un feriado nacional no es día hábil", () => {
  expect(isBusinessDay(new Date("2026-01-01T12:00:00Z"))).toBe(false);
});

test("isBusinessDay: un sábado o domingo no es día hábil", () => {
  expect(isBusinessDay(new Date("2026-07-25T12:00:00Z"))).toBe(false); // sábado
  expect(isBusinessDay(new Date("2026-07-26T12:00:00Z"))).toBe(false); // domingo
});

test("isBusinessDay: un jueves laborable normal sí es día hábil", () => {
  expect(isBusinessDay(new Date("2026-07-23T12:00:00Z"))).toBe(true);
});

test("addBusinessDays: salta fin de semana sin cruzar feriados", () => {
  // jueves 2026-07-23 + 5 hábiles: vie24, (sáb25 dom26 saltan), lun27, mar28, mié29, jue30
  const result = addBusinessDays(new Date("2026-07-23T15:00:00Z"), 5);
  expect(result.toISOString().slice(0, 10)).toBe("2026-07-30");
});

test("addBusinessDays: salta un feriado nacional intermedio", () => {
  // viernes 2026-01-08 + 1 hábil: sábado/domingo no cuentan, 01-09 es feriado -> cae 01-12 (lunes)
  const result = addBusinessDays(new Date("2026-01-08T15:00:00Z"), 1);
  expect(result.toISOString().slice(0, 10)).toBe("2026-01-12");
});

test("addBusinessDays: n=0 devuelve la misma fecha calendario", () => {
  const d = new Date("2026-07-23T15:00:00Z");
  const result = addBusinessDays(d, 0);
  expect(result.toISOString().slice(0, 10)).toBe("2026-07-23");
});
```

- [ ] **Step 2b: Corre los tests y confirma que fallan**

Run: `cd backend && bun test src/lib/calendario.test.ts`
Expected: FAIL — el módulo `./calendario` no existe todavía.

- [ ] **Step 3: Implementa el servicio**

`backend/src/lib/calendario.ts`:
```ts
import feriadosPorAnio from "../data/feriados.json";

// Servicio de dominio para cómputo de plazos en días hábiles (RP-02). Nunca
// usar `fecha + N días` para un plazo legal: un cómputo errado invalida el
// procedimiento. Los feriados están versionados por año en data/feriados.json
// — confirmar el calendario oficial vigente antes de fijarlo en producción
// (punto abierto #7 del documento de reglas de negocio).
const feriados: Record<string, string[]> = feriadosPorAnio;

function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isWeekend(d: Date): boolean {
  const day = d.getUTCDay();
  return day === 0 || day === 6;
}

function isFeriado(d: Date): boolean {
  const year = String(d.getUTCFullYear());
  return (feriados[year] ?? []).includes(toDateKey(d));
}

export function isBusinessDay(d: Date): boolean {
  return !isWeekend(d) && !isFeriado(d);
}

// Suma n días hábiles a partir de `date` (la fecha de partida NO cuenta como
// uno de los n días, igual que "5 días hábiles siguientes a la fecha del
// acto" en RP-01). Devuelve la fecha resultante normalizada a medianoche UTC.
export function addBusinessDays(date: Date, n: number): Date {
  const result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  let remaining = n;
  while (remaining > 0) {
    result.setUTCDate(result.getUTCDate() + 1);
    if (isBusinessDay(result)) remaining -= 1;
  }
  return result;
}
```

- [ ] **Step 4: Corre los tests y confirma que pasan**

Run: `cd backend && bun test src/lib/calendario.test.ts`
Expected: PASS, 6/6.

- [ ] **Step 5: Commit**

```bash
git add backend/src/lib/calendario.ts backend/src/lib/calendario.test.ts backend/src/data/feriados.json
git commit -m "feat(calendario): servicio de días hábiles parametrizable para plazos legales"
```

---

### Task 3: Validación de identidad + modelo `Proponente` + proveedor mock

**Files:**
- Create: `backend/src/lib/identidad.ts`
- Create: `backend/src/models/Proponente.ts`
- Create: `backend/src/lib/providers/identity.ts`
- Test: `backend/src/lib/identidad.test.ts`
- Test: `backend/src/models/proponente.test.ts` (seguir el estilo de `backend/src/models/models.test.ts`)

**Interfaces:**
- Produces: `normalizarDocumento(raw: string): { canonico: string; categoria: string } | null` (null si no matchea ninguna categoría); `IdentityProvider.verify(input): Promise<{estado: "APROBADO"|"RECHAZADO"; motivo?: string}>`; modelo `Proponente` con `estado: "BORRADOR"|"EN_REVISION"|"ACREDITADO"|"RECHAZADO"`.
- Consumes: nada de tareas anteriores (independiente).

- [ ] **Step 1: Test del validador de identidad**

`backend/src/lib/identidad.test.ts`:
```ts
import { test, expect } from "bun:test";
import { normalizarDocumento } from "./identidad";

test("acepta cédula nacional y normaliza a forma canónica", () => {
  const r = normalizarDocumento(" 8-888-8888 ");
  expect(r).not.toBeNull();
  expect(r?.categoria).toBe("NACIONAL");
  expect(r?.canonico).toBe("8-888-8888");
});

test("normaliza variantes de espaciado/mayúsculas a la misma forma canónica", () => {
  const a = normalizarDocumento("8-888-8888");
  const b = normalizarDocumento("8 - 888 - 8888");
  expect(a?.canonico).toBe(b?.canonico);
});

test("acepta cédula de extranjero residente (prefijo E)", () => {
  const r = normalizarDocumento("e-123-4567");
  expect(r?.categoria).toBe("EXTRANJERO_RESIDENTE");
  expect(r?.canonico).toBe("E-123-4567");
});

test("acepta pasaporte alfanumérico", () => {
  const r = normalizarDocumento("ab1234567");
  expect(r?.categoria).toBe("PASAPORTE");
  expect(r?.canonico).toBe("AB1234567");
});

test("rechaza formato que no matchea ninguna categoría", () => {
  expect(normalizarDocumento("no-es-un-documento")).toBeNull();
  expect(normalizarDocumento("")).toBeNull();
});
```

- [ ] **Step 2: Corre el test y confirma que falla**

Run: `cd backend && bun test src/lib/identidad.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementa el validador por estrategia intercambiable**

`backend/src/lib/identidad.ts`:
```ts
// Validación ESTRUCTURAL del documento de identidad (RI-01). No existe una
// fuente pública confiable del algoritmo real de dígito verificador
// panameño ni del catálogo exacto de prefijos/provincias — por eso NO se
// inventa un checksum, y el catálogo de patrones abajo es ILUSTRATIVO para
// esta demo (confirmar contra la fuente oficial antes de un uso real; punto
// abierto #1 del documento de reglas de negocio). El diseño es una
// estrategia por categoría, no una única regex monolítica, para que cada
// categoría pueda corregirse de forma aislada.
interface EstrategiaDocumento {
  categoria: string;
  patron: RegExp;
  canonizar: (raw: string) => string;
}

const estrategias: EstrategiaDocumento[] = [
  {
    // Cédula nacional: dígito(s) de provincia - libro - tomo
    categoria: "NACIONAL",
    patron: /^\d{1,2}-\d{2,4}-\d{2,6}$/,
    canonizar: (raw) => raw,
  },
  {
    // Extranjero residente con cédula de extranjería
    categoria: "EXTRANJERO_RESIDENTE",
    patron: /^E-\d{2,4}-\d{2,6}$/i,
    canonizar: (raw) => raw.toUpperCase(),
  },
  {
    // Pasaporte extranjero: alfanumérico simple, sin guiones
    categoria: "PASAPORTE",
    patron: /^[A-Z0-9]{6,9}$/i,
    canonizar: (raw) => raw.toUpperCase(),
  },
];

// Quita espacios sobrantes alrededor de los separadores ("8 - 888" -> "8-888")
// para que variantes de tipeo normalicen a la misma forma canónica.
function limpiar(raw: string): string {
  return raw.trim().replace(/\s*-\s*/g, "-").replace(/\s+/g, "");
}

export interface DocumentoNormalizado {
  categoria: string;
  canonico: string;
}

// Devuelve la forma canónica única (RI-02) y la categoría detectada, o null
// si el documento no matchea ninguna estrategia conocida. La forma canónica
// es la que lleva el índice único en Proponente (RI-03: un documento = un
// sujeto).
export function normalizarDocumento(raw: string): DocumentoNormalizado | null {
  const limpio = limpiar(raw);
  if (!limpio) return null;
  for (const estrategia of estrategias) {
    if (estrategia.patron.test(limpio)) {
      return { categoria: estrategia.categoria, canonico: estrategia.canonizar(limpio) };
    }
  }
  return null;
}
```

- [ ] **Step 4: Corre el test y confirma que pasa**

Run: `cd backend && bun test src/lib/identidad.test.ts`
Expected: PASS, 5/5.

- [ ] **Step 5: Test del modelo `Proponente`**

`backend/src/models/proponente.test.ts` (sigue el patrón de conexión in-memory usado por `backend/src/models/models.test.ts` — leé ese archivo primero para copiar exactamente su setup de `mongodb-memory-server`/`beforeAll`/`afterAll`):
```ts
import { test, expect } from "bun:test";
import { Proponente } from "./Proponente";

test("estado por defecto es BORRADOR", () => {
  const p = new Proponente({ userId: "507f1f77bcf86cd799439011", documento: { canonico: "8-888-8888", original: "8-888-8888" } });
  expect(p.estado).toBe("BORRADOR");
  expect(p.aceptoPliego).toBe(false);
});

test("valida el índice único de documento.canonico al guardar dos proponentes con el mismo documento", async () => {
  await Proponente.create({
    userId: "507f1f77bcf86cd799439011",
    documento: { canonico: "8-888-8888", original: "8-888-8888" },
  });
  await expect(
    Proponente.create({
      userId: "507f1f77bcf86cd799439012",
      documento: { canonico: "8-888-8888", original: "8-888-8888" },
    })
  ).rejects.toThrow();
});
```
(Si el proyecto no corre este test contra una base real por defecto, sigue exactamente el mismo mecanismo de conexión que `models.test.ts` usa para sus propios tests de índices únicos — mirar cómo `User.email` único se testea ahí, si existe un caso así, y replicarlo.)

- [ ] **Step 6: Implementa el modelo**

`backend/src/models/Proponente.ts`:
```ts
import mongoose, { type HydratedDocument, Types } from "mongoose";

export type EstadoProponente = "BORRADOR" | "EN_REVISION" | "ACREDITADO" | "RECHAZADO";
export type MotivoRechazo = "DOCUMENTO_INVALIDO" | "DOCUMENTO_DUPLICADO" | "VERIFICACION_FALLIDA" | "OTRO";

export interface IProponente {
  userId: Types.ObjectId;
  documento: {
    canonico: string;
    original: string;
    categoria: string;
  };
  estado: EstadoProponente;
  motivoRechazo?: MotivoRechazo;
  aceptoPliego: boolean;
  aceptoPliegoEn?: Date;
  verificacion: {
    estado: "PENDIENTE" | "APROBADO" | "RECHAZADO";
    verificadoEn?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

export type ProponenteDoc = HydratedDocument<IProponente>;

const proponenteSchema = new mongoose.Schema<IProponente>(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    documento: {
      canonico: { type: String, required: true, unique: true },
      original: { type: String, required: true },
      categoria: { type: String, required: true },
    },
    estado: {
      type: String,
      enum: ["BORRADOR", "EN_REVISION", "ACREDITADO", "RECHAZADO"],
      default: "BORRADOR",
    },
    motivoRechazo: {
      type: String,
      enum: ["DOCUMENTO_INVALIDO", "DOCUMENTO_DUPLICADO", "VERIFICACION_FALLIDA", "OTRO"],
    },
    aceptoPliego: { type: Boolean, default: false },
    aceptoPliegoEn: { type: Date },
    verificacion: {
      estado: { type: String, enum: ["PENDIENTE", "APROBADO", "RECHAZADO"], default: "PENDIENTE" },
      verificadoEn: { type: Date },
    },
  },
  { timestamps: true }
);

export const Proponente = mongoose.model<IProponente>("Proponente", proponenteSchema);
```

- [ ] **Step 7: Corre el test del modelo y confirma que pasa**

Run: `cd backend && bun test src/models/proponente.test.ts`
Expected: PASS, 2/2.

- [ ] **Step 8: Implementa el proveedor mock de verificación de identidad**

`backend/src/lib/providers/identity.ts` — mismo patrón que `backend/src/lib/stripe.ts` (selección real-vs-fake por env, aquí siempre fake porque no hay proveedor real en este sistema):
```ts
// Adaptador de verificación de identidad. No hay integración real: esta app
// es una demo de cumplimiento normativo, así que el "proveedor" es una
// simulación determinística. La interfaz queda lista para sustituirse por
// un proveedor real sin tocar el resto del sistema (RI-05 simplificado: sin
// biometría/prueba de vida en este alcance, solo aprobación estructural).
export interface VerificationInput {
  documentoCanonico: string;
}

export interface VerificationResult {
  estado: "APROBADO" | "RECHAZADO";
  motivo?: string;
}

export interface IdentityProvider {
  verify(input: VerificationInput): Promise<VerificationResult>;
}

// Regla determinística de la simulación: cualquier documento válido se
// aprueba, salvo que termine en "0000" (para poder demostrar el camino de
// rechazo en la demo sin depender de azar).
class MockIdentityProvider implements IdentityProvider {
  async verify({ documentoCanonico }: VerificationInput): Promise<VerificationResult> {
    if (documentoCanonico.endsWith("0000")) {
      return { estado: "RECHAZADO", motivo: "No se pudo verificar la identidad con el documento provisto" };
    }
    return { estado: "APROBADO" };
  }
}

export const identityProvider: IdentityProvider = new MockIdentityProvider();
```

- [ ] **Step 9: Commit**

```bash
git add backend/src/lib/identidad.ts backend/src/lib/identidad.test.ts backend/src/models/Proponente.ts backend/src/models/proponente.test.ts backend/src/lib/providers/identity.ts
git commit -m "feat(acreditacion): validador de identidad, modelo Proponente y proveedor mock de verificación"
```

---

### Task 4: Servicio y rutas de acreditación

**Files:**
- Create: `backend/src/services/acreditacion.ts`
- Create: `backend/src/routes/acreditacion.ts`
- Create: `backend/src/schemas/acreditacion.ts`
- Modify: `backend/src/app.ts` (montar la ruta)
- Test: `backend/src/test/acreditacion.integration.test.ts` (mirar `backend/src/test/refunds.integration.test.ts` o similar para el setup de test de integración con la app real)

**Interfaces:**
- Consumes: `normalizarDocumento` y `Proponente` (Task 3), `identityProvider` (Task 3), `recordAudit` (`backend/src/services/audit.ts`, ya existe), `validate`/`objectIdSchema` (`backend/src/schemas/common.ts`, ya existe), `requireAuth`/`requirePermission("acreditacion:review")` (`backend/src/middlewares/auth.ts`).
- Produces: `crearOActualizarBorrador(user, documento: string): Promise<ProponenteDoc>`, `enviarARevision(user): Promise<ProponenteDoc>`, `revisarAcreditacion(actor, proponenteId, decision): Promise<ProponenteDoc>`, `getMiAcreditacion(user): Promise<ProponenteDoc|null>`, `estaAcreditado(userId): Promise<boolean>` — este último lo usa Task 5.

- [ ] **Step 1: Escribe el schema Zod**

`backend/src/schemas/acreditacion.ts` (sigue el patrón de `backend/src/schemas/watchlist.ts`):
```ts
import { z } from "zod";
import { objectIdSchema } from "./common";

export const guardarBorradorSchema = z.object({
  documento: z.string().min(3, "El documento es requerido"),
});

export const aceptarPliegoSchema = z.object({
  aceptoPliego: z.literal(true, { message: "Debes aceptar el pliego de cargos para continuar" }),
});

export const revisarAcreditacionParamSchema = z.object({ id: objectIdSchema });

export const revisarAcreditacionBodySchema = z.object({
  decision: z.enum(["APROBAR", "RECHAZAR"]),
  motivoRechazo: z.enum(["DOCUMENTO_INVALIDO", "DOCUMENTO_DUPLICADO", "VERIFICACION_FALLIDA", "OTRO"]).optional(),
}).refine((v) => v.decision !== "RECHAZAR" || !!v.motivoRechazo, {
  message: "motivoRechazo es requerido al rechazar",
  path: ["motivoRechazo"],
});
```

- [ ] **Step 2: Escribe el test de integración (escenario feliz + rechazo por duplicado)**

`backend/src/test/acreditacion.integration.test.ts` — leé primero `backend/src/test/refunds.integration.test.ts` (o el test de integración más simple que encuentres en ese directorio) para copiar el setup exacto: cómo se levanta `createApp()`, cómo se conecta a `mongodb-memory-server`, y cómo se simula un usuario autenticado (el atajo `E2E=1` + `Bearer e2e:<clerkId>` que ya usa `middlewares/auth.ts`). Con ese mismo mecanismo:
```ts
import { test, expect, beforeAll, afterAll } from "bun:test";
// import el mismo setup de app + db que usa refunds.integration.test.ts

test("flujo feliz: borrador -> revisión -> acreditado, y pliego rechaza sin aceptar", async () => {
  // 1. POST /api/acreditacion con { documento: "8-888-8888" } como usuario A -> 200, estado BORRADOR
  // 2. PATCH /api/acreditacion/pliego con { aceptoPliego: true } -> 200
  // 3. POST /api/acreditacion/enviar -> 200, estado EN_REVISION o ACREDITADO (según si el mock aprueba)
  // 4. GET /api/acreditacion/me -> refleja el estado
});

test("dos usuarios con el mismo documento canónico: el segundo es rechazado (RI-03)", async () => {
  // usuario A registra "8-888-8888" y llega a ACREDITADO
  // usuario B intenta registrar "8 - 888 - 8888" (misma forma canónica) -> 409 Conflict
});

test("admin puede listar y aprobar/rechazar una acreditación en EN_REVISION", async () => {
  // GET /api/acreditacion?estado=EN_REVISION como admin -> incluye al proponente
  // PATCH /api/acreditacion/:id/revisar { decision: "RECHAZAR", motivoRechazo: "DOCUMENTO_INVALIDO" } -> 200, estado RECHAZADO
});
```

- [ ] **Step 3: Corre el test y confirma que falla**

Run: `cd backend && bun test src/test/acreditacion.integration.test.ts`
Expected: FAIL — rutas inexistentes (404).

- [ ] **Step 4: Implementa el servicio**

`backend/src/services/acreditacion.ts`:
```ts
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../lib/errors";
import { normalizarDocumento } from "../lib/identidad";
import { identityProvider } from "../lib/providers/identity";
import { Proponente, type ProponenteDoc, type MotivoRechazo } from "../models/Proponente";
import type { UserDoc } from "../models/User";
import { recordAudit } from "./audit";

// Crea el borrador de acreditación del usuario o actualiza su documento
// mientras siga en BORRADOR o RECHAZADO (RA-10: corrección permitida antes
// de enviar a revisión). Valida formato (RI-01) y unicidad canónica (RI-03).
export async function guardarBorrador(user: UserDoc, documentoRaw: string): Promise<ProponenteDoc> {
  const normalizado = normalizarDocumento(documentoRaw);
  if (!normalizado) throw new ValidationError("El documento no tiene un formato reconocido");

  const existenteAjeno = await Proponente.findOne({
    "documento.canonico": normalizado.canonico,
    userId: { $ne: user._id },
  });
  if (existenteAjeno) throw new ConflictError("Este documento ya está registrado por otro usuario");

  let proponente = await Proponente.findOne({ userId: user._id });
  if (proponente && !["BORRADOR", "RECHAZADO"].includes(proponente.estado)) {
    throw new ConflictError("Tu acreditación ya no admite cambios de documento");
  }

  if (proponente) {
    proponente.documento = { canonico: normalizado.canonico, original: documentoRaw, categoria: normalizado.categoria };
    proponente.estado = "BORRADOR";
    proponente.motivoRechazo = undefined;
    await proponente.save();
  } else {
    proponente = await Proponente.create({
      userId: user._id,
      documento: { canonico: normalizado.canonico, original: documentoRaw, categoria: normalizado.categoria },
    });
  }
  return proponente;
}

// Registra la aceptación del pliego de cargos (RA-03/RB-04), con timestamp.
export async function aceptarPliego(user: UserDoc): Promise<ProponenteDoc> {
  const proponente = await Proponente.findOne({ userId: user._id });
  if (!proponente) throw new NotFoundError("Aún no iniciaste tu acreditación");
  proponente.aceptoPliego = true;
  proponente.aceptoPliegoEn = new Date();
  await proponente.save();
  return proponente;
}

// Envía la acreditación a revisión: corre la verificación (mock) y, si la
// aprueba, marca ACREDITADO directamente (verificación automática); si la
// rechaza, queda RECHAZADA con motivo tipificado (RA-10).
export async function enviarARevision(user: UserDoc): Promise<ProponenteDoc> {
  const proponente = await Proponente.findOne({ userId: user._id });
  if (!proponente) throw new NotFoundError("Aún no iniciaste tu acreditación");
  if (!proponente.aceptoPliego) throw new ValidationError("Debes aceptar el pliego de cargos antes de continuar");
  if (proponente.estado === "ACREDITADO") return proponente;

  const resultado = await identityProvider.verify({ documentoCanonico: proponente.documento.canonico });
  proponente.verificacion = { estado: resultado.estado, verificadoEn: new Date() };
  proponente.estado = resultado.estado === "APROBADO" ? "ACREDITADO" : "RECHAZADO";
  if (resultado.estado === "RECHAZADO") proponente.motivoRechazo = "VERIFICACION_FALLIDA";
  await proponente.save();

  await recordAudit({
    actor: user,
    action: proponente.estado === "ACREDITADO" ? "acreditacion.aprobada" : "acreditacion.rechazada",
    resource: "proponente",
    resourceId: proponente._id.toString(),
    after: { estado: proponente.estado, motivoRechazo: proponente.motivoRechazo },
  });

  return proponente;
}

export async function getMiAcreditacion(user: UserDoc): Promise<ProponenteDoc | null> {
  return Proponente.findOne({ userId: user._id });
}

// Usado por el gate de puja (Task 5): true solo si ACREDITADO.
export async function estaAcreditado(userId: string): Promise<boolean> {
  const proponente = await Proponente.findOne({ userId, estado: "ACREDITADO" });
  return !!proponente;
}

export interface ListAcreditacionesParams {
  estado?: string;
  page?: number;
  limit?: number;
}

export async function listAcreditaciones({ estado, page = 1, limit = 20 }: ListAcreditacionesParams) {
  const filter: Record<string, unknown> = {};
  if (estado) filter.estado = estado;
  const [items, total] = await Promise.all([
    Proponente.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("userId", "name email"),
    Proponente.countDocuments(filter),
  ]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / limit)) };
}

// Aprobación/rechazo manual por un revisor (permiso acreditacion:review).
// Complementa la verificación automática de enviarARevision para los casos
// EN_REVISION que requieran juicio humano, o para revertir un RECHAZADO.
export async function revisarAcreditacion(
  actor: UserDoc,
  proponenteId: string,
  decision: "APROBAR" | "RECHAZAR",
  motivoRechazo?: MotivoRechazo
): Promise<ProponenteDoc> {
  const proponente = await Proponente.findById(proponenteId);
  if (!proponente) throw new NotFoundError("Proponente no encontrado");

  const estadoAnterior = proponente.estado;
  proponente.estado = decision === "APROBAR" ? "ACREDITADO" : "RECHAZADO";
  proponente.motivoRechazo = decision === "RECHAZAR" ? motivoRechazo : undefined;
  await proponente.save();

  await recordAudit({
    actor,
    action: "acreditacion.revisada",
    resource: "proponente",
    resourceId: proponente._id.toString(),
    before: { estado: estadoAnterior },
    after: { estado: proponente.estado, motivoRechazo: proponente.motivoRechazo },
  });

  return proponente;
}
```

- [ ] **Step 5: Implementa las rutas**

`backend/src/routes/acreditacion.ts` — mirar `backend/src/routes/watchlist.ts` para la estructura exacta (Hono + `validate()` + servicios), sin lógica de negocio en el handler:
```ts
import { Hono } from "hono";
import type { AppEnv } from "../types";
import { requireAuth, requirePermission } from "../middlewares/auth";
import { validate } from "../schemas/common";
import {
  guardarBorradorSchema,
  aceptarPliegoSchema,
  revisarAcreditacionParamSchema,
  revisarAcreditacionBodySchema,
} from "../schemas/acreditacion";
import {
  guardarBorrador,
  aceptarPliego,
  enviarARevision,
  getMiAcreditacion,
  listAcreditaciones,
  revisarAcreditacion,
} from "../services/acreditacion";

const acreditacion = new Hono<AppEnv>();

acreditacion.get("/me", requireAuth, async (c) => {
  return c.json(await getMiAcreditacion(c.get("user")));
});

acreditacion.post("/", requireAuth, validate("json", guardarBorradorSchema), async (c) => {
  const { documento } = c.req.valid("json");
  return c.json(await guardarBorrador(c.get("user"), documento), 201);
});

acreditacion.patch("/pliego", requireAuth, validate("json", aceptarPliegoSchema), async (c) => {
  return c.json(await aceptarPliego(c.get("user")));
});

acreditacion.post("/enviar", requireAuth, async (c) => {
  return c.json(await enviarARevision(c.get("user")));
});

acreditacion.get("/", requirePermission("acreditacion:review"), async (c) => {
  const estado = c.req.query("estado");
  const page = Number(c.req.query("page") ?? 1);
  const limit = Number(c.req.query("limit") ?? 20);
  return c.json(await listAcreditaciones({ estado, page, limit }));
});

acreditacion.patch(
  "/:id/revisar",
  requirePermission("acreditacion:review"),
  validate("param", revisarAcreditacionParamSchema),
  validate("json", revisarAcreditacionBodySchema),
  async (c) => {
    const { id } = c.req.valid("param");
    const { decision, motivoRechazo } = c.req.valid("json");
    return c.json(await revisarAcreditacion(c.get("user"), id, decision, motivoRechazo));
  }
);

export default acreditacion;
```

- [ ] **Step 6: Monta la ruta en `app.ts`**

En `backend/src/app.ts`, agrega el import (junto a los demás routers) y el `app.route`:
```ts
import acreditacionRouter from "./routes/acreditacion";
// ...
app.route("/api/acreditacion", acreditacionRouter);
```

- [ ] **Step 7: Corre el test de integración y confirma que pasa**

Run: `cd backend && bun test src/test/acreditacion.integration.test.ts`
Expected: PASS.

- [ ] **Step 8: Corre la suite completa**

Run: `cd backend && bun test`
Expected: todo verde.

- [ ] **Step 9: Commit**

```bash
git add backend/src/services/acreditacion.ts backend/src/routes/acreditacion.ts backend/src/schemas/acreditacion.ts backend/src/app.ts backend/src/test/acreditacion.integration.test.ts
git commit -m "feat(acreditacion): servicio y rutas de acreditación de proponentes con revisión de backoffice"
```

---

### Task 5: Gate de acreditación en `placeBid`

**Files:**
- Modify: `backend/src/services/bids.ts`
- Test: `backend/src/services/bids.test.ts` o el archivo de test que ya cubra `placeBid` — revisar `backend/src/test/concurrency.integration.test.ts` y buscar cuál test unit/integration ejercita `placeBid` hoy, y extenderlo.

**Interfaces:**
- Consumes: `estaAcreditado(userId)` de `backend/src/services/acreditacion.ts` (Task 4).
- Global constraint aplicable: cada evento de rechazo se audita (`recordAudit`).

- [ ] **Step 1: Localiza y lee el test existente de `placeBid`**

Run: `cd backend && grep -rl "placeBid" src/test src/services --include="*.test.ts"`
Lee ese archivo completo para entender el setup de fixtures (vehículo activo, usuario, etc.) ya usado.

- [ ] **Step 2: Agrega el test que fija el nuevo comportamiento (RED)**

En ese mismo archivo, agrega:
```ts
test("placeBid rechaza a un usuario no acreditado y audita el intento", async () => {
  // arrange: vehículo activo, usuario SIN Proponente (o con estado != ACREDITADO)
  await expect(placeBid(usuarioNoAcreditado, vehicle._id.toString(), vehicle.currentPrice + 100))
    .rejects.toThrow(/acredita/i);

  // el intento debe quedar en el rastro de auditoría
  const entry = await AuditLog.findOne({ action: "bid.rechazada", resourceId: vehicle._id.toString() }).sort({ createdAt: -1 });
  expect(entry).not.toBeNull();
});

test("placeBid permite pujar a un usuario ACREDITADO", async () => {
  // arrange: crear un Proponente con estado: "ACREDITADO" para el usuario de fixture existente
  const { bid } = await placeBid(usuarioAcreditado, vehicle._id.toString(), vehicle.currentPrice + 100);
  expect(bid.status).toBe("active");
});
```

- [ ] **Step 3: Corre el test y confirma que falla**

Run: `cd backend && bun test <archivo>`
Expected: FAIL — hoy `placeBid` no exige acreditación, así que el primer test (que espera rechazo) falla.

- [ ] **Step 4: Implementa el gate**

En `backend/src/services/bids.ts`, importa `estaAcreditado` desde `./acreditacion` y `recordAudit` desde `./audit`, y agrega la validación **antes** del claim atómico (después de las validaciones de vehículo existentes):
```ts
import { estaAcreditado } from "./acreditacion";
import { recordAudit } from "./audit";

// ... dentro de placeBid, después de validar vehicle.status/auctionEndDate/amount:

  if (!(await estaAcreditado(user._id.toString()))) {
    await recordAudit({
      actor: user,
      action: "bid.rechazada",
      resource: "vehicle",
      resourceId: vehicleId,
      after: { motivo: "PROPONENTE_NO_ACREDITADO", amount },
    });
    throw new ValidationError("Debes completar tu acreditación antes de poder pujar");
  }
```

- [ ] **Step 5: Corre el test y confirma que pasa**

Run: `cd backend && bun test <archivo>`
Expected: PASS.

- [ ] **Step 6: Corre toda la suite de bids/concurrencia**

Run: `cd backend && bun test src/test/concurrency.integration.test.ts` y cualquier otro test que toque `placeBid`.
Expected: verde. Si algún test existente pujaba con un usuario de fixture que no tiene `Proponente` ACREDITADO, ese fixture ahora necesita uno — créalo en el `beforeEach`/`beforeAll` de ese test siguiendo el patrón de `backend/src/test/factories.ts` (revisar si existe una factory de usuario para extenderla con un `Proponente` acreditado por defecto).

- [ ] **Step 7: Commit**

```bash
git add backend/src/services/bids.ts backend/src/services/bids.test.ts backend/src/test/factories.ts
git commit -m "feat(bids): exige acreditación vigente antes de pujar y audita los intentos rechazados"
```

---

### Task 6: Frontend — wizard de acreditación

**Files:**
- Create: `frontend/src/components/AcreditacionWizard.tsx`
- Modify: `frontend/src/pages/RegisterPage.tsx` (o el punto de entrada post-signup — ver Contexto)
- Modify: `frontend/src/pages/AccountPage.tsx` (estado de acreditación)
- Modify: `frontend/src/pages/VehicleDetailPage.tsx` (bloquear "pujar" si no acreditado)
- Modify: `frontend/src/components/BidForm.tsx` (si el bloqueo vive ahí en vez de en la página)

**Interfaces:**
- Consumes: `GET/POST /api/acreditacion*` (Task 4). Contrato de `Proponente` tal como lo devuelve `GET /api/acreditacion/me`: `{ estado: "BORRADOR"|"EN_REVISION"|"ACREDITADO"|"RECHAZADO", documento: {...}, aceptoPliego: boolean, motivoRechazo?: string }` o `null` si nunca inició.

**Contexto:** El wizard se muestra **después** del alta con Clerk (`SyncUser`/`/api/users/sync` ya corre en `App.tsx` y en `RegisterPage.tsx`), no reemplaza el login/registro de Clerk. Un usuario recién sincronizado sin `Proponente` (`GET /api/acreditacion/me` devuelve `null`) debe ver el wizard antes de poder pujar. Reusa el patrón `step`-en-`useState` de `frontend/src/components/EmailOtpForm.tsx` (leído arriba) y los componentes `Input`/`Button`/`Card` ya existentes.

- [ ] **Step 1: Implementa el componente del wizard**

`frontend/src/components/AcreditacionWizard.tsx` — tres pasos (`documento` → `verificacion` → `pliego`), estilo inline con tokens CSS como el resto del proyecto (ver `EmailOtpForm.tsx` para el patrón exacto de `style={{...}}` con `var(--sp-*)`, `var(--t-*)`, etc.):

```tsx
import { useState } from "react";
import { useApi } from "../hooks/useApi";
import Button from "./Button";
import Input from "./Input";

type Step = "documento" | "verificando" | "pliego" | "listo" | "rechazado";

interface Props {
  onCompletado: () => void;
}

export default function AcreditacionWizard({ onCompletado }: Props) {
  const api = useApi();
  const [step, setStep] = useState<Step>("documento");
  const [documento, setDocumento] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [motivoRechazo, setMotivoRechazo] = useState("");

  async function handleGuardarDocumento(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.post("/api/acreditacion", { documento });
      setStep("pliego");
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || "No pudimos validar tu documento");
    } finally {
      setLoading(false);
    }
  }

  async function handleAceptarPliego() {
    setError("");
    setLoading(true);
    try {
      await api.patch("/api/acreditacion/pliego", { aceptoPliego: true });
      setStep("verificando");
      const { data } = await api.post("/api/acreditacion/enviar");
      if (data.estado === "ACREDITADO") {
        setStep("listo");
        onCompletado();
      } else {
        setMotivoRechazo(data.motivoRechazo || "");
        setStep("rechazado");
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || "No pudimos completar la verificación");
      setStep("pliego");
    } finally {
      setLoading(false);
    }
  }

  if (step === "documento") {
    return (
      <form onSubmit={handleGuardarDocumento} style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
        <h3 style={{ fontSize: "var(--t-lg)" }}>Acreditación de proponente</h3>
        <p style={{ color: "var(--text-muted)", fontSize: "var(--t-sm)" }}>
          Para pujar en subastas de bienes aprehendidos necesitas acreditarte con tu documento de identidad.
        </p>
        <Input
          label="Documento de identidad (cédula o pasaporte)"
          value={documento}
          onChange={(e) => setDocumento(e.target.value)}
          placeholder="8-888-8888"
          required
          autoFocus
        />
        {error && <p style={{ color: "var(--danger)", fontSize: "var(--t-xs)" }}>{error}</p>}
        <Button type="submit" variant="primary" fullWidth disabled={loading || !documento}>
          {loading ? "Validando..." : "Continuar"}
        </Button>
      </form>
    );
  }

  if (step === "pliego") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
        <h3 style={{ fontSize: "var(--t-lg)" }}>Pliego de cargos</h3>
        <div style={{ maxHeight: 180, overflowY: "auto", fontSize: "var(--t-xs)", color: "var(--text-muted)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "var(--sp-3)" }}>
          Los vehículos se subastan "en el estado en que se encuentran", sin garantía de funcionamiento
          ni saneamiento por vicios ocultos. Al aceptar, declaras haber leído y aceptado esta condición.
        </div>
        {error && <p style={{ color: "var(--danger)", fontSize: "var(--t-xs)" }}>{error}</p>}
        <Button variant="primary" fullWidth onClick={handleAceptarPliego} disabled={loading}>
          {loading ? "Procesando..." : "Acepto y continúo"}
        </Button>
      </div>
    );
  }

  if (step === "verificando") {
    return <p style={{ textAlign: "center", color: "var(--text-muted)" }}>Verificando tu identidad...</p>;
  }

  if (step === "rechazado") {
    return (
      <div style={{ textAlign: "center" }}>
        <p style={{ color: "var(--danger)", fontWeight: 600 }}>No pudimos acreditarte</p>
        <p style={{ color: "var(--text-muted)", fontSize: "var(--t-sm)" }}>Motivo: {motivoRechazo || "verificación fallida"}</p>
        <Button variant="ghost" onClick={() => setStep("documento")}>Corregir e intentar de nuevo</Button>
      </div>
    );
  }

  return <p style={{ textAlign: "center", color: "var(--success)" }}>¡Acreditación completada! Ya puedes pujar.</p>;
}
```

- [ ] **Step 2: Muestra el wizard tras el alta si no hay acreditación**

En `frontend/src/pages/RegisterPage.tsx`, tras el `useEffect` que hace `POST /api/users/sync` y antes de `navigate("/vehicles")`, verifica `GET /api/acreditacion/me`: si es `null`, en vez de navegar, renderiza `AcreditacionWizard` con `onCompletado={() => navigate("/vehicles")}` (mantener el diseño de `Card` ya usado en la página). Si ya existe con `estado !== "ACREDITADO"`, navega igual (el usuario completará luego desde `/account`, ver Step 3) — no bloquear el login normal, solo el primer registro.

- [ ] **Step 3: Estado de acreditación en `AccountPage`**

En `frontend/src/pages/AccountPage.tsx`, agrega una sección que haga `GET /api/acreditacion/me` al montar y muestre: si `null` o `estado !== "ACREDITADO"`, un banner con el estado (`StatusBadge` reutilizable) y el `AcreditacionWizard` embebido para completarlo; si `"ACREDITADO"`, un badge de confirmación.

- [ ] **Step 4: Bloquea el botón de pujar si no está acreditado**

En `frontend/src/pages/VehicleDetailPage.tsx` (donde se renderiza `BidForm`), obtén el estado de acreditación (mismo `GET /api/acreditacion/me`) y, si no es `"ACREDITADO"`, reemplaza el `BidForm` por un aviso: "Debes completar tu acreditación para pujar" con un link a `/account`.

- [ ] **Step 5: Verificación manual (no hay test runner de frontend E2E en esta tarea — se cubre en Task 12)**

Corre `cd frontend && bun run build` para confirmar que TypeScript compila sin errores tras los cambios.
Expected: build exitoso.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/AcreditacionWizard.tsx frontend/src/pages/RegisterPage.tsx frontend/src/pages/AccountPage.tsx frontend/src/pages/VehicleDetailPage.tsx
git commit -m "feat(acreditacion): wizard de acreditación de proponente y bloqueo de puja sin acreditar"
```

---

### Task 7: Frontend — backoffice de acreditaciones

**Files:**
- Create: `frontend/src/pages/admin/AdminAcreditaciones.tsx`
- Modify: `frontend/src/layouts/AdminLayout.tsx` (nav item)
- Modify: `frontend/src/App.tsx` (ruta `/admin/acreditaciones`)

**Interfaces:**
- Consumes: `GET /api/acreditacion?estado=`, `PATCH /api/acreditacion/:id/revisar` (Task 4).

- [ ] **Step 1: Crea la página, mirando `frontend/src/pages/admin/AdminOrders.tsx` como plantilla exacta**

`frontend/src/pages/admin/AdminAcreditaciones.tsx` — mismo esqueleto que `AdminOrders.tsx` (leído arriba): `PageHeader`, `Select` de filtro por estado (`BORRADOR|EN_REVISION|ACREDITADO|RECHAZADO`), `DataTable` con columnas (proponente: nombre/email vía `userId` poblado, documento, estado vía `StatusBadge`, fecha) y una acción por fila cuando `estado === "EN_REVISION"`: dos botones "Aprobar"/"Rechazar" que abren un modal de confirmación (mismo patrón `pendingRefund`/modal de `AdminOrders.tsx`); el modal de rechazo debe pedir `motivoRechazo` con un `<Select>` de las 4 opciones tipificadas antes de habilitar el botón de confirmar.

- [ ] **Step 2: Agrega el nav item**

En `frontend/src/layouts/AdminLayout.tsx`, agrega a `navGroups` (grupo "Gestión"): `{ to: "/admin/acreditaciones", label: "Acreditaciones", icon: UserCheck, end: false }` (importar `UserCheck` de `lucide-react`).

- [ ] **Step 3: Agrega la ruta**

En `frontend/src/App.tsx`, dentro del bloque de rutas admin (mismo patrón que `/admin/orders`), agrega `<Route path="acreditaciones" element={<AdminAcreditaciones />} />`.

- [ ] **Step 4: Verifica el build**

Run: `cd frontend && bun run build`
Expected: exitoso, sin errores de tipos.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/admin/AdminAcreditaciones.tsx frontend/src/layouts/AdminLayout.tsx frontend/src/App.tsx
git commit -m "feat(admin): backoffice de revisión de acreditaciones"
```

---

### Task 8: Adjudicación con 2º postor + plazo de pago legal + incumplimiento

**Files:**
- Create: `backend/src/models/Adjudicacion.ts`
- Modify: `backend/src/services/auctions.ts` (`adjudicateVehicle`)
- Modify: `backend/src/models/Payment.ts` (campos aditivos)
- Modify: `backend/src/services/payments.ts` (`createCheckout`, nuevo servicio de incumplimiento y oferta al 2º postor)
- Modify: `backend/src/jobs/closeExpiredAuctions.ts` (o nuevo job hermano)
- Create: `backend/src/routes/adjudicaciones.ts` (endpoint para que el 2º postor acepte/decline la oferta)
- Modify: `backend/src/app.ts`
- Test: `backend/src/services/auctions.test.ts`, `backend/src/test/payment-deadline.integration.test.ts` (nuevo)

**Interfaces:**
- Consumes: `addBusinessDays` (Task 2).
- Produces: `Adjudicacion` con `estado: "ADJUDICADA_PENDIENTE_PAGO"|"PAGADA"|"INCUMPLIDA"|"OFERTA_A_SEGUNDO"|"DESIERTO_POR_INCUMPLIMIENTO"`, campo `fechaLimitePago: Date`. Este modelo lo consume Task 10 (entrega) vía `adjudicacionId`.

- [ ] **Step 1: Modelo `Adjudicacion`**

`backend/src/models/Adjudicacion.ts`:
```ts
import mongoose, { type HydratedDocument, Types } from "mongoose";

export type EstadoAdjudicacion =
  | "ADJUDICADA_PENDIENTE_PAGO"
  | "PAGADA"
  | "INCUMPLIDA"
  | "OFERTA_A_SEGUNDO"
  | "DESIERTO_POR_INCUMPLIMIENTO";

export interface IAdjudicacion {
  vehicleId: Types.ObjectId;
  ganadorBidId: Types.ObjectId;
  segundoBidId?: Types.ObjectId;
  segundoMonto?: number;
  fechaActo: Date;
  fechaLimitePago: Date;
  estado: EstadoAdjudicacion;
  ofertaSegundoVenceEn?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type AdjudicacionDoc = HydratedDocument<IAdjudicacion>;

const adjudicacionSchema = new mongoose.Schema<IAdjudicacion>(
  {
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle", required: true, unique: true },
    ganadorBidId: { type: mongoose.Schema.Types.ObjectId, ref: "Bid", required: true },
    segundoBidId: { type: mongoose.Schema.Types.ObjectId, ref: "Bid" },
    segundoMonto: { type: Number },
    fechaActo: { type: Date, required: true },
    fechaLimitePago: { type: Date, required: true },
    estado: {
      type: String,
      enum: ["ADJUDICADA_PENDIENTE_PAGO", "PAGADA", "INCUMPLIDA", "OFERTA_A_SEGUNDO", "DESIERTO_POR_INCUMPLIMIENTO"],
      default: "ADJUDICADA_PENDIENTE_PAGO",
    },
    ofertaSegundoVenceEn: { type: Date },
  },
  { timestamps: true }
);

export const Adjudicacion = mongoose.model<IAdjudicacion>("Adjudicacion", adjudicacionSchema);
```

- [ ] **Step 2: Test de `adjudicateVehicle` con ranking + empate**

En `backend/src/services/auctions.test.ts` (mirar el test de integración de subastas existente para el setup de fixtures de `Vehicle`/`Bid`), agrega:
```ts
test("adjudicateVehicle persiste ganador, segundo postor y fechaLimitePago a 5 días hábiles", async () => {
  // arrange: vehículo con 3 bids activos de montos 100, 200, 300 (el mayor gana)
  await adjudicateVehicle(vehicle._id.toString());
  const adjudicacion = await Adjudicacion.findOne({ vehicleId: vehicle._id });
  expect(adjudicacion?.segundoMonto).toBe(200);
  expect(adjudicacion?.estado).toBe("ADJUDICADA_PENDIENTE_PAGO");
  expect(adjudicacion?.fechaLimitePago.getTime()).toBeGreaterThan(adjudicacion!.fechaActo.getTime());
});

test("adjudicateVehicle aborta y no adjudica si detecta un empate en el monto más alto (RJ-02)", async () => {
  // arrange: dos bids con el mismo monto más alto (simula una violación de RS-10 ya ocurrida)
  const winnerBidId = await adjudicateVehicle(vehicle._id.toString());
  expect(winnerBidId).toBeUndefined();
  const adjudicacion = await Adjudicacion.findOne({ vehicleId: vehicle._id });
  expect(adjudicacion).toBeNull();
  // y debe quedar auditado como anomalía para intervención manual
  const entry = await AuditLog.findOne({ action: "adjudicacion.empate_detectado" });
  expect(entry).not.toBeNull();
});
```

- [ ] **Step 3: Corre el test y confirma que falla**

Run: `cd backend && bun test src/services/auctions.test.ts`
Expected: FAIL — `Adjudicacion` aún no se crea desde `adjudicateVehicle`.

- [ ] **Step 4: Modifica `adjudicateVehicle`**

En `backend/src/services/auctions.ts`, reemplaza el cuerpo de `adjudicateVehicle` para: (a) traer todos los bids ordenados por monto desc, (b) detectar empate en el tope y abortar con auditoría si lo hay, (c) crear/actualizar el `Adjudicacion` con el segundo postor y `fechaLimitePago = addBusinessDays(fechaActo, 5)`:
```ts
import { addBusinessDays } from "../lib/calendario";
import { Adjudicacion } from "../models/Adjudicacion";

export async function adjudicateVehicle(vehicleId: string): Promise<string | undefined> {
  const ranking = await Bid.find({ vehicleId }).sort({ amount: -1, createdAt: 1 });
  if (ranking.length === 0) return undefined;

  const [highestBid, secondBid] = ranking;
  if (secondBid && secondBid.amount === highestBid.amount) {
    // RJ-02: el empate es estructuralmente imposible bajo RS-10 (toda puja
    // debe superar estrictamente la vigente). Si ocurre, es un bug de
    // concurrencia — se aborta el cierre y se escala, nunca se desempata.
    await recordAudit({
      action: "adjudicacion.empate_detectado",
      resource: "vehicle",
      resourceId: vehicleId,
      after: { montoEmpatado: highestBid.amount, bidIds: [highestBid._id, secondBid._id] },
    });
    logger.error("empate detectado al adjudicar — requiere intervención manual", { vehicleId });
    return undefined;
  }

  await Bid.updateMany(
    { vehicleId, _id: { $ne: highestBid._id }, status: { $ne: "paid" } },
    { status: "outbid" }
  );

  const wasAlreadyWinner = highestBid.status === "winner";
  if (highestBid.status !== "paid") {
    highestBid.status = "winner";
    await highestBid.save();
  }

  const fechaActo = new Date();
  await Adjudicacion.findOneAndUpdate(
    { vehicleId },
    {
      vehicleId,
      ganadorBidId: highestBid._id,
      segundoBidId: secondBid?._id,
      segundoMonto: secondBid?.amount,
      fechaActo,
      fechaLimitePago: addBusinessDays(fechaActo, 5),
      estado: "ADJUDICADA_PENDIENTE_PAGO",
    },
    { upsert: true, setDefaultOnInsert: true }
  );

  if (!wasAlreadyWinner) {
    const vehicle = await Vehicle.findById(vehicleId).select("title");
    await notify({
      userId: highestBid.userId,
      type: "won",
      title: "¡Ganaste la subasta!",
      body: `Tu puja fue la más alta por "${vehicle?.title ?? "el vehículo"}". Tienes 5 días hábiles para completar el pago.`,
      data: { vehicleId, bidId: highestBid._id.toString() },
    });
  }
  return highestBid._id.toString();
}
```
(Nota: `logger` ya está importado en ese archivo; confirmar que sigue siéndolo tras el diff.)

- [ ] **Step 5: Corre el test y confirma que pasa**

Run: `cd backend && bun test src/services/auctions.test.ts`
Expected: PASS.

- [ ] **Step 6: Campos aditivos en `Payment`**

En `backend/src/models/Payment.ts`, agrega a la interfaz y al schema:
```ts
  paidAt?: Date;
  referenciaPago?: string;
```
```ts
    paidAt: { type: Date },
    referenciaPago: { type: String, unique: true, sparse: true },
```

- [ ] **Step 7: Test del plazo de pago (rechazo fuera de plazo)**

`backend/src/test/payment-deadline.integration.test.ts` (mirar `backend/src/test/webhook.integration.test.ts` para el setup de checkout con Stripe fake E2E):
```ts
test("createCheckout rechaza si venció fechaLimitePago de la adjudicación", async () => {
  // arrange: Adjudicacion con fechaLimitePago en el pasado para el bid ganador
  await expect(createCheckout(user, bidId)).rejects.toThrow(/plazo/i);
});

test("createCheckout genera referenciaPago única ligada a vehículo+adjudicatario", async () => {
  const { url } = await createCheckout(user, bidId);
  const payment = await Payment.findOne({ bidId });
  expect(payment?.referenciaPago).toBeTruthy();
});
```

- [ ] **Step 8: Corre el test y confirma que falla**

Run: `cd backend && bun test src/test/payment-deadline.integration.test.ts`
Expected: FAIL.

- [ ] **Step 9: Implementa el gate de plazo en `createCheckout` y la referencia única**

En `backend/src/services/payments.ts`, dentro de `createCheckout`, después de validar `bid.status !== "winner"` y antes de crear la sesión de Stripe:
```ts
import { Adjudicacion } from "../models/Adjudicacion";
import crypto from "node:crypto";

  const adjudicacion = await Adjudicacion.findOne({ vehicleId: vehicle._id });
  if (adjudicacion && adjudicacion.fechaLimitePago < new Date() && adjudicacion.estado === "ADJUDICADA_PENDIENTE_PAGO") {
    throw new ConflictError("Venció el plazo de pago de 5 días hábiles para esta adjudicación");
  }
```
Y al crear el `Payment` (rama `else` donde se hace `Payment.create`), agrega:
```ts
      referenciaPago: `${vehicle._id.toString()}-${user._id.toString()}-${crypto.randomUUID()}`,
```
Y en `confirmCheckoutSession`, tras el claim atómico exitoso (`claimed`), setea `paidAt` y marca la `Adjudicacion` como `PAGADA`:
```ts
import { Adjudicacion } from "../models/Adjudicacion";
// dentro de confirmCheckoutSession, después del claim:
  claimed.paidAt = new Date();
  await claimed.save();
  await Adjudicacion.findOneAndUpdate({ vehicleId: claimed.vehicleId }, { estado: "PAGADA" });
```

- [ ] **Step 10: Corre el test y confirma que pasa**

Run: `cd backend && bun test src/test/payment-deadline.integration.test.ts`
Expected: PASS.

- [ ] **Step 11: Test del job de incumplimiento**

Agrega a `backend/src/services/auctions.test.ts` (o un nuevo `backend/src/services/incumplimiento.test.ts` si prefieres separar responsabilidades — decide según cómo quede de grande el archivo):
```ts
test("procesarIncumplimientos banea al adjudicatario y marca DESIERTO_POR_INCUMPLIMIENTO sin segundo postor", async () => {
  // arrange: Adjudicacion ADJUDICADA_PENDIENTE_PAGO con fechaLimitePago vencida, sin segundoBidId
  await procesarIncumplimientos();
  const user = await User.findById(bidGanador.userId);
  expect(user?.banned).toBe(true);
  expect(user?.banReason).toBe("INCUMPLIMIENTO_PAGO");
  const adjudicacion = await Adjudicacion.findOne({ vehicleId });
  expect(adjudicacion?.estado).toBe("DESIERTO_POR_INCUMPLIMIENTO");
});

test("procesarIncumplimientos ofrece al segundo postor cuando existe", async () => {
  // arrange: Adjudicacion vencida CON segundoBidId
  await procesarIncumplimientos();
  const adjudicacion = await Adjudicacion.findOne({ vehicleId });
  expect(adjudicacion?.estado).toBe("OFERTA_A_SEGUNDO");
  expect(adjudicacion?.ofertaSegundoVenceEn).toBeTruthy();
});
```

- [ ] **Step 12: Corre el test y confirma que falla**

Run: `cd backend && bun test <archivo del step 11>`
Expected: FAIL — `procesarIncumplimientos` no existe.

- [ ] **Step 13: Campos aditivos en `User` + implementa `procesarIncumplimientos`**

En `backend/src/models/User.ts`, agrega:
```ts
  banReason?: "INCUMPLIMIENTO_PAGO" | "OTRO";
  bannedAt?: Date;
```
```ts
    banReason: { type: String, enum: ["INCUMPLIMIENTO_PAGO", "OTRO"] },
    bannedAt: { type: Date },
```

En `backend/src/services/auctions.ts` (o el archivo nuevo elegido en Step 11), agrega:
```ts
const SEGUNDO_POSTOR_DIAS_HABILES = Number(process.env.SEGUNDO_POSTOR_DIAS_HABILES ?? "2");

// Recorre las adjudicaciones vencidas sin pago y aplica la consecuencia de
// RP-04: pérdida de la adjudicación y, la inhabilitación se modela con el
// baneo ya existente en el sistema (User.banned + banReason), no con un
// registro de inhabilitados aparte. Si hay segundo postor, se le ofrece la
// adjudicación (RP-05) en vez de declarar desierto directamente.
export async function procesarIncumplimientos(): Promise<number> {
  let procesados = 0;
  for (;;) {
    const vencida = await Adjudicacion.findOneAndUpdate(
      { estado: "ADJUDICADA_PENDIENTE_PAGO", fechaLimitePago: { $lte: new Date() } },
      { estado: "INCUMPLIDA" },
      { returnDocument: "after" }
    );
    if (!vencida) break;

    const bidGanador = await Bid.findById(vencida.ganadorBidId);
    if (bidGanador) {
      await User.findByIdAndUpdate(bidGanador.userId, {
        banned: true,
        banReason: "INCUMPLIMIENTO_PAGO",
        bannedAt: new Date(),
      });
      await notify({
        userId: bidGanador.userId,
        type: "banned",
        title: "Cuenta suspendida por incumplimiento de pago",
        body: "No completaste el pago dentro del plazo legal de 5 días hábiles y tu cuenta fue suspendida.",
        data: {},
      });
    }

    if (vencida.segundoBidId) {
      vencida.estado = "OFERTA_A_SEGUNDO";
      vencida.ofertaSegundoVenceEn = addBusinessDays(new Date(), SEGUNDO_POSTOR_DIAS_HABILES);
      await vencida.save();
      const segundoBid = await Bid.findById(vencida.segundoBidId);
      if (segundoBid) {
        await notify({
          userId: segundoBid.userId,
          type: "won",
          title: "Se te ofrece la adjudicación como segundo mejor postor",
          body: "El adjudicatario original incumplió el pago. Puedes aceptar la adjudicación por tu oferta.",
          data: { vehicleId: vencida.vehicleId.toString() },
        });
      }
    } else {
      vencida.estado = "DESIERTO_POR_INCUMPLIMIENTO";
      await vencida.save();
    }

    await recordAudit({
      action: "adjudicacion.incumplida",
      resource: "adjudicacion",
      resourceId: vencida._id.toString(),
      after: { estado: vencida.estado },
      source: "job",
    });
    procesados += 1;
  }
  return procesados;
}

// El segundo postor acepta la oferta (RP-05): se convierte en el nuevo
// ganador con su propio plazo de pago de 5 días hábiles.
export async function aceptarOfertaSegundoPostor(adjudicacionId: string, user: UserDoc): Promise<AdjudicacionDoc> {
  const adjudicacion = await Adjudicacion.findById(adjudicacionId);
  if (!adjudicacion) throw new NotFoundError("Adjudicación no encontrada");
  if (adjudicacion.estado !== "OFERTA_A_SEGUNDO") throw new ConflictError("Esta oferta ya no está disponible");
  if (adjudicacion.ofertaSegundoVenceEn && adjudicacion.ofertaSegundoVenceEn < new Date()) {
    adjudicacion.estado = "DESIERTO_POR_INCUMPLIMIENTO";
    await adjudicacion.save();
    throw new ConflictError("La ventana para aceptar la oferta ya venció");
  }
  const segundoBid = await Bid.findById(adjudicacion.segundoBidId);
  if (!segundoBid || segundoBid.userId.toString() !== user._id.toString()) {
    throw new ForbiddenError("Solo el segundo mejor postor puede aceptar esta oferta");
  }

  segundoBid.status = "winner";
  await segundoBid.save();
  const fechaActo = new Date();
  adjudicacion.ganadorBidId = segundoBid._id;
  adjudicacion.segundoBidId = undefined;
  adjudicacion.segundoMonto = undefined;
  adjudicacion.fechaActo = fechaActo;
  adjudicacion.fechaLimitePago = addBusinessDays(fechaActo, 5);
  adjudicacion.estado = "ADJUDICADA_PENDIENTE_PAGO";
  adjudicacion.ofertaSegundoVenceEn = undefined;
  await adjudicacion.save();

  await recordAudit({
    actor: user,
    action: "adjudicacion.segundo_postor_acepto",
    resource: "adjudicacion",
    resourceId: adjudicacion._id.toString(),
    after: { estado: adjudicacion.estado },
  });

  return adjudicacion;
}
```
Agrega los imports que falten (`User`, `ConflictError`, `ForbiddenError`, `NotFoundError`) al tope del archivo.

- [ ] **Step 14: Corre el test y confirma que pasa**

Run: `cd backend && bun test <archivo del step 11>`
Expected: PASS.

- [ ] **Step 15: Extiende el job periódico**

En `backend/src/jobs/closeExpiredAuctions.ts`, agrega una tercera llamada dentro del `tick`, junto a `closeExpiredAuctions`/`notifyClosingSoonWatchers`, siguiendo el mismo patrón `try/catch` + log:
```ts
    try {
      const procesados = await procesarIncumplimientos();
      if (procesados > 0) logger.info("job de incumplimientos de pago", { procesados });
    } catch (err) {
      logger.error("el job de incumplimientos falló", { error: err instanceof Error ? err.message : String(err) });
    }
```
(importar `procesarIncumplimientos` desde `../services/auctions`.)

- [ ] **Step 16: Ruta para que el segundo postor acepte la oferta**

`backend/src/routes/adjudicaciones.ts`:
```ts
import { Hono } from "hono";
import type { AppEnv } from "../types";
import { requireAuth } from "../middlewares/auth";
import { validate } from "../schemas/common";
import { idParamSchema } from "../schemas/common";
import { aceptarOfertaSegundoPostor } from "../services/auctions";

const adjudicaciones = new Hono<AppEnv>();

adjudicaciones.post("/:id/aceptar-oferta", requireAuth, validate("param", idParamSchema), async (c) => {
  const { id } = c.req.valid("param");
  return c.json(await aceptarOfertaSegundoPostor(id, c.get("user")));
});

export default adjudicaciones;
```
Móntala en `app.ts`: `app.route("/api/adjudicaciones", adjudicacionesRouter);`.

- [ ] **Step 17: Corre toda la suite de backend**

Run: `cd backend && bun test`
Expected: verde.

- [ ] **Step 18: Commit**

```bash
git add backend/src/models/Adjudicacion.ts backend/src/models/Payment.ts backend/src/models/User.ts backend/src/services/auctions.ts backend/src/services/payments.ts backend/src/jobs/closeExpiredAuctions.ts backend/src/routes/adjudicaciones.ts backend/src/app.ts backend/src/services/auctions.test.ts backend/src/test/payment-deadline.integration.test.ts
git commit -m "feat(adjudicacion): ranking y segundo postor, plazo de pago legal, incumplimiento e inhabilitación"
```

---

### Task 9: Frontend — plazos, incumplimiento y oferta al segundo postor

**Files:**
- Modify: `frontend/src/pages/MyBidsPage.tsx`
- Modify: `frontend/src/pages/MyPurchasesPage.tsx`
- Modify: `frontend/src/pages/admin/AdminOrders.tsx`

**Interfaces:**
- Consumes: el campo `fechaLimitePago`/`estado` de `Adjudicacion` — expón esto agregando el join en el backend (`getMyBids`/`getMyPurchases` en `backend/src/services/bids.ts`) si no llega hoy. **Antes de escribir el frontend, confirma qué payload exponen esos endpoints tras el Task 8** (probablemente haga falta un pequeño ajuste de backend aquí — si `getMyBids`/`getMyPurchases` no incluyen la adjudicación, agrégalo poblando `Adjudicacion` por `vehicleId` igual que se hace con `Payment` en `getMyPurchases`).

- [ ] **Step 1: Backend — expón `fechaLimitePago` y `estado` de adjudicación en `getMyBids`**

En `backend/src/services/bids.ts`, dentro de `getMyBids`, añade una consulta a `Adjudicacion` por los `vehicleId` de los bids (mismo patrón `Map` que usa `getMyPurchases` para `Payment`) y agrega al objeto devuelto: `adjudicacion: { estado, fechaLimitePago } | null`.

- [ ] **Step 2: Test de backend para el nuevo campo**

Agrega en el test existente de `getMyBids` (buscar con `grep -rl "getMyBids" backend/src/test backend/src/services`) una aserción de que el bid ganador incluye `adjudicacion.fechaLimitePago`.

- [ ] **Step 3: Corre el test, confirma que pasa tras el cambio**

Run: `cd backend && bun test <archivo>`
Expected: PASS.

- [ ] **Step 4: Frontend — cuenta regresiva de plazo en `MyBidsPage`**

En `frontend/src/pages/MyBidsPage.tsx`, para cada bid con `requiresPayment: true`, muestra `adjudicacion?.fechaLimitePago` con un componente de cuenta regresiva (reusa `Countdown` si su API lo permite, o un cálculo simple de días/horas restantes) y **deshabilita el botón "Pagar ahora"** si `new Date() > fechaLimitePago`, mostrando en su lugar "Plazo de pago vencido".

- [ ] **Step 5: Acción "Aceptar oferta" para el segundo postor**

En `frontend/src/pages/MyBidsPage.tsx`, si un bid tiene `adjudicacion?.estado === "OFERTA_A_SEGUNDO"` y el usuario es el segundo postor (el backend ya lo filtra: solo llega a `getMyBids` de ese usuario si es suyo), muestra un botón "Aceptar oferta" que llama `POST /api/adjudicaciones/:id/aceptar-oferta` y refresca la lista.

- [ ] **Step 6: Columna de plazo en `AdminOrders`**

En `frontend/src/pages/admin/AdminOrders.tsx`, agrega una columna que muestre el estado de la adjudicación asociada (si el backend de `listPayments` no la expone, es un ajuste menor análogo al Step 1 sobre `backend/src/services/payments.ts::listPayments`, poblando `Adjudicacion` por `vehicleId`).

- [ ] **Step 7: Verifica el build**

Run: `cd frontend && bun run build`
Expected: exitoso.

- [ ] **Step 8: Commit**

```bash
git add backend/src/services/bids.ts backend/src/services/payments.ts frontend/src/pages/MyBidsPage.tsx frontend/src/pages/admin/AdminOrders.tsx
git commit -m "feat(pago): muestra plazo legal de pago, incumplimiento y oferta al segundo postor en el frontend"
```

---

### Task 10: Backend — proceso de entrega

**Files:**
- Modify: `backend/src/models/Vehicle.ts` (campo `vin` aditivo)
- Create: `backend/src/models/Deposito.ts`
- Create: `backend/src/models/Entrega.ts`
- Create: `backend/src/services/entrega.ts`
- Create: `backend/src/services/contrato.ts`
- Create: `backend/src/routes/entrega.ts`
- Create: `backend/src/schemas/entrega.ts`
- Modify: `backend/src/app.ts`
- Test: `backend/src/test/entrega.integration.test.ts`

**Interfaces:**
- Consumes: `Adjudicacion` (Task 8, para precondición de pago), rol `custodio` + permiso `entrega:execute`/`entrega:read` (Task 1).
- Produces: `Entrega` con `estado: "CITA_AGENDADA"|"EN_INSPECCION"|"ENTREGADA"|"BLOQUEADA"`, consumido por Task 11 (frontend).

- [ ] **Step 1: Campo `vin` en `Vehicle`**

En `backend/src/models/Vehicle.ts`, agrega (aditivo, sin tocar `status`):
```ts
  vin?: string;
```
```ts
    vin: { type: String, index: { unique: true, sparse: true } },
```

- [ ] **Step 2: Modelo `Deposito`**

`backend/src/models/Deposito.ts`:
```ts
import mongoose, { type HydratedDocument, Types } from "mongoose";

export interface ISlot {
  inicio: Date;
  fin: Date;
  capacidad: number;
  ocupados: number;
}

export interface IDeposito {
  nombre: string;
  direccion: string;
  custodioIds: Types.ObjectId[];
  slots: ISlot[];
  createdAt: Date;
  updatedAt: Date;
}

export type DepositoDoc = HydratedDocument<IDeposito>;

const slotSchema = new mongoose.Schema<ISlot>(
  {
    inicio: { type: Date, required: true },
    fin: { type: Date, required: true },
    capacidad: { type: Number, required: true, default: 1 },
    ocupados: { type: Number, required: true, default: 0 },
  },
  { _id: true }
);

const depositoSchema = new mongoose.Schema<IDeposito>(
  {
    nombre: { type: String, required: true },
    direccion: { type: String, required: true },
    custodioIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    slots: [slotSchema],
  },
  { timestamps: true }
);

export const Deposito = mongoose.model<IDeposito>("Deposito", depositoSchema);
```

- [ ] **Step 3: Modelo `Entrega`**

`backend/src/models/Entrega.ts`:
```ts
import mongoose, { type HydratedDocument, Types } from "mongoose";

export type EstadoEntrega = "CITA_AGENDADA" | "EN_INSPECCION" | "ENTREGADA" | "BLOQUEADA";

export interface IChecklistItem {
  clave: string; // "vin" | "odometro" | "placa" | "frontal" | "posterior" | "lateral_izq" | "lateral_der" | "interior" | "vano_motor" | "danio_preexistente"
  fotoUrl: string;
  capturadoEn: Date;
  geolocalizacion?: { lat: number; lng: number };
}

export interface IInventarioItem {
  item: string; // "llaves" | "documentos" | "llanta_repuesto" | "herramientas" | "bateria" | "accesorio"
  cantidad: number;
  faltante: boolean;
}

export interface IEntrega {
  adjudicacionId: Types.ObjectId;
  vehicleId: Types.ObjectId;
  paymentId: Types.ObjectId;
  compradorId: Types.ObjectId;
  depositoId: Types.ObjectId;
  citaProgramadaEn: Date;
  reprogramaciones: number;
  custodioId?: Types.ObjectId;
  estado: EstadoEntrega;
  checklist: IChecklistItem[];
  inventario: IInventarioItem[];
  vinCapturado?: string;
  actaHash?: string;
  actaGeneradaEn?: Date;
  motivoBloqueo?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type EntregaDoc = HydratedDocument<IEntrega>;

const checklistItemSchema = new mongoose.Schema<IChecklistItem>(
  {
    clave: { type: String, required: true },
    fotoUrl: { type: String, required: true },
    capturadoEn: { type: Date, required: true },
    geolocalizacion: { lat: Number, lng: Number },
  },
  { _id: false }
);

const inventarioItemSchema = new mongoose.Schema<IInventarioItem>(
  {
    item: { type: String, required: true },
    cantidad: { type: Number, required: true, default: 0 },
    faltante: { type: Boolean, required: true, default: false },
  },
  { _id: false }
);

const entregaSchema = new mongoose.Schema<IEntrega>(
  {
    adjudicacionId: { type: mongoose.Schema.Types.ObjectId, ref: "Adjudicacion", required: true, unique: true },
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle", required: true },
    paymentId: { type: mongoose.Schema.Types.ObjectId, ref: "Payment", required: true },
    compradorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    depositoId: { type: mongoose.Schema.Types.ObjectId, ref: "Deposito", required: true },
    citaProgramadaEn: { type: Date, required: true },
    reprogramaciones: { type: Number, default: 0 },
    custodioId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    estado: { type: String, enum: ["CITA_AGENDADA", "EN_INSPECCION", "ENTREGADA", "BLOQUEADA"], default: "CITA_AGENDADA" },
    checklist: [checklistItemSchema],
    inventario: [inventarioItemSchema],
    vinCapturado: { type: String },
    actaHash: { type: String },
    actaGeneradaEn: { type: Date },
    motivoBloqueo: { type: String },
  },
  { timestamps: true }
);

export const Entrega = mongoose.model<IEntrega>("Entrega", entregaSchema);
```

**Nota de diseño (irreversibilidad, RE-08):** no se implementa `pre('save')` que bloquee la transición — la garantía se aplica en el servicio (Step 5), rechazando cualquier operación sobre una `Entrega` cuyo `estado === "ENTREGADA"`.

- [ ] **Step 4: Schemas Zod**

`backend/src/schemas/entrega.ts`:
```ts
import { z } from "zod";
import { objectIdSchema } from "./common";

export const agendarCitaSchema = z.object({
  depositoId: objectIdSchema,
  slotId: objectIdSchema,
});

export const CHECKLIST_CLAVES = [
  "vin", "odometro", "placa", "frontal", "posterior",
  "lateral_izq", "lateral_der", "interior", "vano_motor",
] as const;

export const registrarChecklistItemSchema = z.object({
  clave: z.enum(CHECKLIST_CLAVES),
  fotoUrl: z.string().url(),
  geolocalizacion: z.object({ lat: z.number(), lng: z.number() }).optional(),
});

export const registrarVinSchema = z.object({
  vin: z.string().regex(/^[A-HJ-NPR-Z0-9]{17}$/i, "El VIN debe tener 17 caracteres alfanuméricos válidos"),
});

export const inventarioItemSchema = z.object({
  item: z.enum(["llaves", "documentos", "llanta_repuesto", "herramientas", "bateria", "accesorio"]),
  cantidad: z.number().int().min(0),
  faltante: z.boolean(),
});

export const registrarInventarioSchema = z.object({ items: z.array(inventarioItemSchema).min(1) });

export const entregaIdParamSchema = z.object({ id: objectIdSchema });
```

- [ ] **Step 5: Test de integración de entrega (escenario feliz + bloqueo por VIN)**

`backend/src/test/entrega.integration.test.ts` — mismo setup de app+db que Task 4/8. Casos:
```ts
test("flujo feliz: precondiciones cumplidas -> cita -> checklist completo con VIN correcto -> acta generada, ENTREGADA", async () => {
  // arrange: Payment.status="paid", Adjudicacion.estado="PAGADA", Vehicle.vin="1HGCM82633A004352"
  // 1. POST /api/entrega { paymentId } -> crea Entrega en CITA_AGENDADA (o el endpoint que definas para "iniciar")
  // 2. POST /api/entrega/:id/checklist con las 9 claves + fotoUrl, la última transiciona a EN_INSPECCION o queda pendiente hasta VIN
  // 3. POST /api/entrega/:id/vin { vin: "1HGCM82633A004352" } (coincide) -> no bloquea
  // 4. POST /api/entrega/:id/inventario -> ok
  // 5. POST /api/entrega/:id/acta -> 200, estado ENTREGADA, actaHash presente
});

test("bloquea automáticamente si el VIN capturado no coincide con el del vehículo (RE-06)", async () => {
  // arrange: Vehicle.vin="1HGCM82633A004352"
  // POST /api/entrega/:id/vin { vin: "DIFERENTE1234567" } -> la Entrega pasa a BLOQUEADA con motivoBloqueo
  // y ningún endpoint posterior (acta) permite avanzar mientras siga BLOQUEADA
});

test("rechaza iniciar la entrega si el pago no está conciliado (RE-01)", async () => {
  // arrange: Payment.status="pending"
  // POST /api/entrega -> 409
});

test("ENTREGADA es irreversible: no admite otro POST de checklist/vin/inventario (RE-08)", async () => {
  // arrange: Entrega ya en estado ENTREGADA
  // cualquier mutación posterior -> 409
});
```

- [ ] **Step 6: Corre el test y confirma que falla**

Run: `cd backend && bun test src/test/entrega.integration.test.ts`
Expected: FAIL — nada de esto existe aún.

- [ ] **Step 7: Implementa `services/contrato.ts`**

`backend/src/services/contrato.ts`:
```ts
import crypto from "node:crypto";

// Genera el contenido HTML del contrato de compraventa (mismo patrón que el
// recibo imprimible existente — sin librería PDF nueva) y su hash de sellado
// (RE-02/RE-07). El frontend lo renderiza e imprime; aquí solo se produce el
// contenido y el hash que queda en el registro.
export interface DatosContrato {
  vehicleTitle: string;
  vin?: string;
  precio: number;
  adjudicatarioNombre: string;
  fecha: Date;
}

export function generarContratoHtml(datos: DatosContrato): { html: string; hash: string } {
  const html = `
    <h1>Contrato de compraventa</h1>
    <p>Vehículo: ${datos.vehicleTitle} ${datos.vin ? `(VIN ${datos.vin})` : ""}</p>
    <p>Precio: $${datos.precio.toLocaleString()}</p>
    <p>Adquirente: ${datos.adjudicatarioNombre}</p>
    <p>Fecha: ${datos.fecha.toISOString()}</p>
    <p>El vehículo se vende en el estado en que se encuentra, sin garantía de funcionamiento
    ni saneamiento por vicios ocultos.</p>
  `.trim();
  const hash = crypto.createHash("sha256").update(html).digest("hex");
  return { html, hash };
}
```

- [ ] **Step 8: Implementa `services/entrega.ts`**

```ts
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../lib/errors";
import { Adjudicacion } from "../models/Adjudicacion";
import { Entrega, type EntregaDoc } from "../models/Entrega";
import { Payment } from "../models/Payment";
import { Vehicle } from "../models/Vehicle";
import type { UserDoc } from "../models/User";
import { recordAudit } from "./audit";
import { generarContratoHtml } from "./contrato";
import { notify } from "./notifications";
import { CHECKLIST_CLAVES } from "../schemas/entrega";

// Precondiciones de RE-01: pago conciliado y adjudicatario no inhabilitado
// (baneo) sobrevenidamente. El contrato se genera en este mismo paso (RE-02).
export async function iniciarEntrega(paymentId: string, depositoId: string, slotId: string): Promise<EntregaDoc> {
  const payment = await Payment.findById(paymentId);
  if (!payment) throw new NotFoundError("Pago no encontrado");
  if (payment.status !== "paid") throw new ConflictError("La entrega requiere un pago conciliado");

  const comprador = await import("../models/User").then((m) => m.User.findById(payment.userId));
  if (!comprador || comprador.banned) throw new ForbiddenError("El adjudicatario no puede recibir la entrega");

  const existente = await Entrega.findOne({ paymentId });
  if (existente) return existente;

  const adjudicacion = await Adjudicacion.findOne({ vehicleId: payment.vehicleId });
  if (!adjudicacion) throw new NotFoundError("No se encontró la adjudicación de este pago");

  const vehicle = await Vehicle.findById(payment.vehicleId);
  if (!vehicle) throw new NotFoundError("Vehículo no encontrado");

  const { hash } = generarContratoHtml({
    vehicleTitle: vehicle.title,
    vin: vehicle.vin,
    precio: payment.amount,
    adjudicatarioNombre: comprador.name,
    fecha: new Date(),
  });

  const entrega = await Entrega.create({
    adjudicacionId: adjudicacion._id,
    vehicleId: vehicle._id,
    paymentId: payment._id,
    compradorId: comprador._id,
    depositoId,
    citaProgramadaEn: new Date(), // el slot exacto se resuelve contra Deposito.slots en una iteración posterior
    estado: "CITA_AGENDADA",
    checklist: [],
    inventario: [],
    actaHash: hash,
  });

  await recordAudit({
    action: "entrega.iniciada",
    resource: "entrega",
    resourceId: entrega._id.toString(),
    after: { estado: entrega.estado, vehicleId: vehicle._id.toString() },
  });

  return entrega;
}

function assertNoIrreversible(entrega: EntregaDoc) {
  if (entrega.estado === "ENTREGADA") {
    throw new ConflictError("Esta entrega ya fue completada y no admite cambios (RE-08)");
  }
  if (entrega.estado === "BLOQUEADA") {
    throw new ConflictError("Esta entrega está bloqueada por discrepancia de VIN; requiere intervención de un administrador");
  }
}

// Checklist bloqueante (RE-04): no se puede avanzar con ítems pendientes.
export async function registrarChecklistItem(
  entregaId: string,
  clave: string,
  fotoUrl: string,
  geolocalizacion?: { lat: number; lng: number }
): Promise<EntregaDoc> {
  const entrega = await Entrega.findById(entregaId);
  if (!entrega) throw new NotFoundError("Entrega no encontrada");
  assertNoIrreversible(entrega);

  entrega.checklist = entrega.checklist.filter((c) => c.clave !== clave);
  entrega.checklist.push({ clave, fotoUrl, capturadoEn: new Date(), geolocalizacion });
  if (entrega.estado === "CITA_AGENDADA") entrega.estado = "EN_INSPECCION";
  await entrega.save();
  return entrega;
}

export function checklistCompleto(entrega: EntregaDoc): boolean {
  const claves = new Set(entrega.checklist.map((c) => c.clave));
  return CHECKLIST_CLAVES.every((c) => claves.has(c));
}

// Validación cruzada de VIN (RE-06): discrepancia bloquea automáticamente y
// escala a un administrador. No es omitible por ningún rol.
export async function registrarVin(entregaId: string, vinCapturado: string): Promise<EntregaDoc> {
  const entrega = await Entrega.findById(entregaId);
  if (!entrega) throw new NotFoundError("Entrega no encontrada");
  assertNoIrreversible(entrega);

  const vehicle = await Vehicle.findById(entrega.vehicleId);
  entrega.vinCapturado = vinCapturado;

  if (vehicle?.vin && vehicle.vin.toUpperCase() !== vinCapturado.toUpperCase()) {
    entrega.estado = "BLOQUEADA";
    entrega.motivoBloqueo = "Discrepancia de VIN entre el registro y la inspección";
    await entrega.save();
    await recordAudit({
      action: "entrega.bloqueada_vin",
      resource: "entrega",
      resourceId: entrega._id.toString(),
      after: { vinRegistrado: vehicle.vin, vinCapturado },
    });
    throw new ConflictError("El VIN capturado no coincide con el registrado; la entrega quedó bloqueada y escalada");
  }

  await entrega.save();
  return entrega;
}

export async function registrarInventario(
  entregaId: string,
  items: { item: string; cantidad: number; faltante: boolean }[]
): Promise<EntregaDoc> {
  const entrega = await Entrega.findById(entregaId);
  if (!entrega) throw new NotFoundError("Entrega no encontrada");
  assertNoIrreversible(entrega);
  entrega.inventario = items;
  await entrega.save();
  return entrega;
}

// Acta de entrega (RE-07): exige checklist completo y VIN validado antes de
// cerrar. Irreversible (RE-08) desde este punto.
export async function generarActa(entregaId: string, custodio: UserDoc): Promise<EntregaDoc> {
  const entrega = await Entrega.findById(entregaId);
  if (!entrega) throw new NotFoundError("Entrega no encontrada");
  assertNoIrreversible(entrega);
  if (!checklistCompleto(entrega)) {
    throw new ValidationError("El checklist de inspección tiene ítems pendientes");
  }
  if (!entrega.vinCapturado) {
    throw new ValidationError("Falta capturar y validar el VIN antes de generar el acta");
  }

  entrega.estado = "ENTREGADA";
  entrega.custodioId = custodio._id;
  entrega.actaGeneradaEn = new Date();
  await entrega.save();

  await recordAudit({
    actor: custodio,
    action: "entrega.completada",
    resource: "entrega",
    resourceId: entrega._id.toString(),
    after: { estado: entrega.estado },
  });

  await notify({
    userId: entrega.compradorId,
    type: "payment_confirmed", // reutiliza un tipo de notificación existente; no se agrega un tipo nuevo en este alcance
    title: "Entrega completada",
    body: "Tu vehículo fue entregado y el acta quedó registrada.",
    data: { vehicleId: entrega.vehicleId.toString() },
  });

  return entrega;
}

export async function getEntrega(entregaId: string, user: UserDoc): Promise<EntregaDoc> {
  const entrega = await Entrega.findById(entregaId);
  if (!entrega) throw new NotFoundError("Entrega no encontrada");
  if (entrega.compradorId.toString() !== user._id.toString() && user.role !== "admin" && user.role !== "custodio") {
    throw new ForbiddenError("No tienes permisos sobre esta entrega");
  }
  return entrega;
}
```

- [ ] **Step 9: Implementa las rutas**

`backend/src/routes/entrega.ts` — sigue el patrón de `routes/watchlist.ts`:
```ts
import { Hono } from "hono";
import type { AppEnv } from "../types";
import { requireAuth, requirePermission } from "../middlewares/auth";
import { validate } from "../schemas/common";
import {
  agendarCitaSchema,
  registrarChecklistItemSchema,
  registrarVinSchema,
  registrarInventarioSchema,
  entregaIdParamSchema,
} from "../schemas/entrega";
import { z } from "zod";
import { objectIdSchema } from "../schemas/common";
import {
  iniciarEntrega,
  registrarChecklistItem,
  registrarVin,
  registrarInventario,
  generarActa,
  getEntrega,
} from "../services/entrega";

const entrega = new Hono<AppEnv>();

const iniciarEntregaSchema = z.object({ paymentId: objectIdSchema, depositoId: objectIdSchema, slotId: objectIdSchema });

entrega.post("/", requireAuth, validate("json", iniciarEntregaSchema), async (c) => {
  const { paymentId, depositoId, slotId } = c.req.valid("json");
  return c.json(await iniciarEntrega(paymentId, depositoId, slotId), 201);
});

entrega.get("/:id", requireAuth, validate("param", entregaIdParamSchema), async (c) => {
  return c.json(await getEntrega(c.req.valid("param").id, c.get("user")));
});

entrega.post(
  "/:id/checklist",
  requirePermission("entrega:execute"),
  validate("param", entregaIdParamSchema),
  validate("json", registrarChecklistItemSchema),
  async (c) => {
    const { id } = c.req.valid("param");
    const { clave, fotoUrl, geolocalizacion } = c.req.valid("json");
    return c.json(await registrarChecklistItem(id, clave, fotoUrl, geolocalizacion));
  }
);

entrega.post(
  "/:id/vin",
  requirePermission("entrega:execute"),
  validate("param", entregaIdParamSchema),
  validate("json", registrarVinSchema),
  async (c) => {
    const { id } = c.req.valid("param");
    const { vin } = c.req.valid("json");
    return c.json(await registrarVin(id, vin));
  }
);

entrega.post(
  "/:id/inventario",
  requirePermission("entrega:execute"),
  validate("param", entregaIdParamSchema),
  validate("json", registrarInventarioSchema),
  async (c) => {
    const { id } = c.req.valid("param");
    const { items } = c.req.valid("json");
    return c.json(await registrarInventario(id, items));
  }
);

entrega.post("/:id/acta", requirePermission("entrega:execute"), validate("param", entregaIdParamSchema), async (c) => {
  const { id } = c.req.valid("param");
  return c.json(await generarActa(id, c.get("user")));
});

export default entrega;
```
Móntala en `app.ts`: `app.route("/api/entrega", entregaRouter);`.

- [ ] **Step 10: Corre el test y confirma que pasa**

Run: `cd backend && bun test src/test/entrega.integration.test.ts`
Expected: PASS, 4/4.

- [ ] **Step 11: Corre toda la suite de backend**

Run: `cd backend && bun test`
Expected: verde.

- [ ] **Step 12: Commit**

```bash
git add backend/src/models/Vehicle.ts backend/src/models/Deposito.ts backend/src/models/Entrega.ts backend/src/services/entrega.ts backend/src/services/contrato.ts backend/src/routes/entrega.ts backend/src/schemas/entrega.ts backend/src/app.ts backend/src/test/entrega.integration.test.ts
git commit -m "feat(entrega): proceso de entrega con checklist bloqueante, validación cruzada de VIN y acta"
```

---

### Task 11: Frontend — entrega (comprador, custodio, admin)

**Files:**
- Modify: `frontend/src/pages/MyPurchasesPage.tsx` (tracker de entrega para el comprador)
- Create: `frontend/src/pages/CustodioInspeccion.tsx`
- Create: `frontend/src/pages/admin/AdminEntregasBloqueadas.tsx`
- Modify: `frontend/src/layouts/AdminLayout.tsx`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: rutas de Task 10 (`/api/entrega*`).

- [ ] **Step 1: Tracker de entrega en `MyPurchasesPage`**

En `frontend/src/pages/MyPurchasesPage.tsx`, para cada compra pagada, si existe una `Entrega` asociada (agrega `GET /api/entrega?paymentId=` o expón la relación en el `payment` que ya devuelve `getMyPurchases` — decide el approach más simple: exponer `entregaId`/`estado` en el payload de `getMyPurchases`, análogo a como ya expone `payment`), muestra su `estado` con `StatusBadge` y, si `estado === "CITA_AGENDADA"` o `"EN_INSPECCION"`, un botón para ver detalle; si `"ENTREGADA"`, un link para ver/descargar el acta (renderiza el HTML del acta en una página imprimible, mismo patrón que `ReceiptPage.tsx`).

- [ ] **Step 2: Vista de inspección para custodio**

`frontend/src/pages/CustodioInspeccion.tsx` — formulario con las 9 claves de `CHECKLIST_CLAVES` (mismas del backend, cópialas o expĺicítalas), cada una con un input de archivo/URL de foto (reusa el flujo de `ImageDropzone`/Cloudinary ya usado para vehículos) que al completarse llama `POST /api/entrega/:id/checklist`; un campo de VIN capturado que llama `POST /api/entrega/:id/vin` y muestra el error de bloqueo de forma prominente si el backend responde 409; un formulario de inventario (`POST /api/entrega/:id/inventario`); y un botón final "Generar acta" (`POST /api/entrega/:id/acta`) **deshabilitado hasta que las 9 claves del checklist estén completas y el VIN esté validado** (replica en el cliente la misma regla bloqueante que ya aplica el backend, para feedback inmediato — el backend sigue siendo la fuente de verdad).

- [ ] **Step 3: Bandeja de entregas bloqueadas para admin**

`frontend/src/pages/admin/AdminEntregasBloqueadas.tsx` — mismo esqueleto que `AdminOrders.tsx`: lista de entregas con `estado === "BLOQUEADA"`, mostrando `motivoBloqueo`, vehículo y comprador (necesitarás un endpoint de listado — agrega `GET /api/entrega?estado=BLOQUEADA` en `backend/src/routes/entrega.ts` con permiso `entrega:read`, delegando en un `listEntregas` nuevo y pequeño en `services/entrega.ts` antes de este paso si no existe).

- [ ] **Step 4: Nav y rutas**

En `AdminLayout.tsx`, agrega `{ to: "/admin/entregas-bloqueadas", label: "Entregas bloqueadas", icon: AlertTriangle, end: false }`. En `App.tsx`, agrega la ruta admin correspondiente y una ruta protegida (no-admin) para `CustodioInspeccion` gated por rol `custodio` (sigue el patrón de `AdminRoute.tsx` pero comprobando `role === "custodio" || role === "admin"` — si no existe un guard genérico por rol, créalo como `RoleRoute.tsx` a partir de `AdminRoute.tsx`).

- [ ] **Step 5: Verifica el build**

Run: `cd frontend && bun run build`
Expected: exitoso.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/MyPurchasesPage.tsx frontend/src/pages/CustodioInspeccion.tsx frontend/src/pages/admin/AdminEntregasBloqueadas.tsx frontend/src/layouts/AdminLayout.tsx frontend/src/App.tsx frontend/src/components/RoleRoute.tsx backend/src/routes/entrega.ts backend/src/services/entrega.ts
git commit -m "feat(entrega): tracker de comprador, inspección de custodio y bandeja de bloqueadas en backoffice"
```

---

### Task 12: Fixtures — seed y servidor E2E

**Files:**
- Modify: `backend/scripts/seed.ts`
- Modify: `backend/scripts/e2e-server.ts`

**Interfaces:**
- Consumes: todos los modelos de las tareas anteriores.

- [ ] **Step 1: Lee ambos scripts completos** para entender el formato exacto de sus fixtures actuales (usuarios, vehículos, bids) antes de extenderlos.

- [ ] **Step 2: Agrega a `seed.ts` (idempotente, igual que el resto del script)**

- Un usuario custodio (`role: "custodio"`).
- Un usuario auditor (`role: "auditor"`).
- Un `Proponente` `ACREDITADO` para cada comprador de fixture ya existente (para que las pujas de esos usuarios sigan funcionando tras el gate del Task 5).
- Un `Deposito` con al menos un slot futuro.
- Un `vin` de ejemplo en al menos un `Vehicle` ya `awarded` para poder demostrar el flujo de entrega manualmente.

- [ ] **Step 3: Agrega lo mismo a `e2e-server.ts`**, siguiendo su patrón de dataset determinístico (Ana/Bruno/admin + vehículos Corolla/Civic/F-150/Ranger descrito en el proyecto): agrega `Proponente` `ACREDITADO` para Ana y Bruno (para que los specs Playwright existentes de puja/checkout sigan pasando sin modificarse), un usuario custodio de fixture, y un `Deposito`.

- [ ] **Step 4: Corre la suite completa de backend una vez más para confirmar que el seed/e2e-server no rompió nada**

Run: `cd backend && bun test`
Expected: verde.

- [ ] **Step 5: Levanta el servidor E2E y confirma manualmente que arranca sin errores**

Run: `cd backend && bun run scripts/e2e-server.ts &` (o el script `bun run` equivalente que ya use el proyecto — revisar `package.json`), esperar el log de arranque, y detenerlo.
Expected: arranca sin excepciones no controladas.

- [ ] **Step 6: Commit**

```bash
git add backend/scripts/seed.ts backend/scripts/e2e-server.ts
git commit -m "chore(fixtures): agrega proponentes acreditados, depósito y roles custodio/auditor al seed y al servidor E2E"
```

---

## Nota sobre specs Playwright existentes

Los Task 5 y 12 son los puntos donde el gate de acreditación puede romper los specs Playwright actuales (`frontend/tests/e2e/01-bidding.spec.ts`, `02-checkout.spec.ts`) porque Ana/Bruno pujan sin haber pasado por el wizard. El Task 12 lo resuelve dándoles un `Proponente` `ACREDITADO` de fixture directamente (sin pasar por el wizard UI), que es la solución correcta: esos specs prueban pujas/pagos, no el wizard de acreditación (que no tiene spec propio en este plan — el proyecto no pidió cobertura E2E nueva de Playwright, solo que la suite existente de backend y el build de frontend sigan verdes). Si al ejecutar la suite Playwright completa al final del branch aparecen fallos por este motivo, es la señal de que falta ese fixture — no se agregó un Task explícito de "correr Playwright" porque no hay Playwright disponible como comando en el entorno de subagentes sin un navegador headless preinstalado; queda como verificación manual final del usuario (ver sección de Verificación en el plan de arquitectura aprobado).

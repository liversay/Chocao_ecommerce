# Chocao Production-Ready E-commerce Robustness — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add e-commerce-style robustness to Chocao (a government vehicle auction marketplace) — watchlist with alerts, an in-app + email notification system, account/profile with receipts on the client side — and a materially more elaborate backoffice: dark "slate" theme distinct from the client, real charts, date-range analytics, user management, orders/refunds, and an audit-log viewer with CSV export.

**Architecture:** Backend (Bun + Hono + Mongoose) gets two new collections (`Notification`, `Watchlist`), a best-effort email abstraction (Resend, log-only fallback), a `notify()`/`notifyMany()` service hooked into the four existing business-logic points that already produce the right events (outbid in `placeBid`, won in `adjudicateVehicle`, paid in `confirmCheckoutSession`, refunded in `refundPayment`), plus a new idempotent "closing soon" watcher check riding the existing 60s auction-closer job. New read endpoints (`/api/dashboard/analytics`, `/api/users`, `/api/payments`) reuse the existing aggregation/pagination idioms. Frontend adds client pages (watchlist, notifications, account, receipt) and rebuilds the four admin pages on top of a new dark CSS theme, Recharts, and small reusable admin components (stat card, date range picker, CSV export, paginated/sortable table).

**Tech Stack:** Bun, Hono 4, Mongoose 9, Zod 4, `@hono/zod-validator`, Stripe 22, Clerk (`@clerk/backend`), `mongodb-memory-server` + `bun:test` for backend tests. React 19, Vite 8, react-router-dom 7, axios, plain CSS with custom properties (no Tailwind/component lib), Recharts 3 (new).

## Global Constraints

- Runtime is **Bun** everywhere in `backend/`: `bun test`, `bun run typecheck` (= `tsc --noEmit`), never `node`/`jest`/`ts-node`. `.env` is auto-loaded (backend still has an explicit `import "dotenv/config"` in `src/index.ts` — do not remove it, do not add a second loader).
- Frontend has **no unit/component test runner** (only unconfigured Playwright E2E scaffolding with zero spec files, out of scope here). Frontend task acceptance = `bunx tsc -b` (from `frontend/`) compiles with zero errors. Do not invent frontend test files.
- Money is always plain `number` (USD, no cents conversion) formatted with `.toLocaleString()`, matching every existing page — do not introduce a currency library.
- All new backend error paths use the existing `AppError` subclasses from `backend/src/lib/errors.ts` (`ValidationError` 400, `UnauthorizedError` 401, `ForbiddenError` 403, `NotFoundError` 404, `ConflictError` 409) — never throw a bare `Error` from a route or service.
- All new Zod validation goes through `validate(target, schema)` from `backend/src/schemas/common.ts`, the same wrapper every existing route uses.
- Resource ownership checks use `assertOwner(ownerId, user, message?)` from `backend/src/lib/ownership.ts` (403, never 404-with-data).
- Every new backend collection is indexed **twice**, matching the existing `AuditLog` precedent (`backend/src/models/AuditLog.ts` + `backend/scripts/migrations.ts` version 1): once as a `schema.index(...)` call in the Mongoose model (so `bun test`, which never disables `autoIndex`, actually builds and enforces the index) and once as a `db.collection(...).createIndex(...)` call in a new `migrations.ts` entry (for production, where `autoIndex` is set to `false` in `connectDB()`). Skipping either half is an incomplete task.
- `notify()` (Task 3) **never throws** — it must swallow and log its own errors exactly like `recordAudit()` in `backend/src/services/audit.ts` does, so a notification failure never breaks the bidding/payment/adjudication flow that triggered it. Callers in Task 5 must NOT wrap `notify()`/`notifyMany()` calls in their own try/catch — that would be redundant with this contract.
- Notification types are exactly this closed union, used verbatim everywhere (model, service, frontend type, badge labels): `"outbid" | "won" | "payment_confirmed" | "refunded" | "watch_closing"`.
- `User.notificationPrefs` has exactly these four boolean keys, each defaulting to `true`: `outbid`, `won`, `payment` (gates both `payment_confirmed` and `refunded`), `watchClosing`. A user with a preference off gets **neither** the in-app `Notification` row **nor** the email for that type — one gate, not two.
- Admin dark theme: change **only** CSS custom-property values inside the existing `.admin-theme` block in `frontend/src/index.css` (lines 49-72) plus the one named bugfix in Task 9 (`AdminRoute.tsx`'s loading-screen text color). Do not touch `.admin-shell`/`.admin-sidebar`/`.admin-main`/`.kpi`/`.table`/`.badge`/etc. structural rules — they already read the variables and will re-theme automatically. Exact new values are given in Task 9; do not deviate. The logout-confirmation modal overlay in `AdminLayout.tsx` is intentionally left unchanged (a neutral black scrim, correct on both themes) — do not "fix" it.
- New admin chart colors are literal hex (SVG can't read CSS custom properties): `#0f172a` bg, `#1e293b` surface, `#334155` border/grid, `#94a3b8` muted text, `#e2e8f0` text, `#3b82f6` primary/blue, `#f2b84b` accent/gold, `#34d399` success/green, `#f87171` danger/red — centralized once in `frontend/src/components/admin/charts/palette.ts` (Task 15), imported everywhere else that needs one of them.
- `RESEND_API_KEY` / `RESEND_FROM` are the only new env vars. Without `RESEND_API_KEY` set, `sendEmail()` must log-and-return, never call `fetch`, never throw — the whole feature stays fully functional without a Resend account.
- Commit after every task (or sub-task where a task has multiple TDD steps) with a Conventional-Commits-style message in Spanish matching the existing log (`feat(...)`, `fix(...)`, `chore(...)`).

---

### Task 1: Notification & Watchlist models, User/Vehicle field extensions, migration indexes

**Files:**
- Create: `backend/src/models/Notification.ts`
- Create: `backend/src/models/Watchlist.ts`
- Modify: `backend/src/models/User.ts`
- Modify: `backend/src/models/Vehicle.ts`
- Modify: `backend/scripts/migrations.ts`
- Test: `backend/src/models/notification.test.ts`

**Interfaces:**
- Produces: `Notification` model with `INotification { userId: Types.ObjectId; type: "outbid"|"won"|"payment_confirmed"|"refunded"|"watch_closing"; title: string; body: string; data?: { vehicleId?: string; bidId?: string; paymentId?: string }; read: boolean; createdAt: Date }`, exported `NotificationDoc = HydratedDocument<INotification>`.
- Produces: `Watchlist` model with `IWatchlist { userId: Types.ObjectId; vehicleId: Types.ObjectId; createdAt: Date }`, exported `WatchlistDoc = HydratedDocument<IWatchlist>`, unique compound index on `{userId, vehicleId}`.
- Produces: `IUser` gains `phone?: string` and `notificationPrefs: { outbid: boolean; won: boolean; payment: boolean; watchClosing: boolean }` (always present, defaults all `true`).
- Produces: `IVehicle` gains `closingSoonNotifiedAt?: Date` (absent = not yet notified).
- Consumes: nothing (foundation task).

- [ ] **Step 1: Write the failing model smoke test**

```ts
// backend/src/models/notification.test.ts
import { describe, expect, test } from "bun:test";
import { Notification } from "./Notification";
import { Watchlist } from "./Watchlist";
import { User } from "./User";
import { Vehicle } from "./Vehicle";

describe("modelos de notificaciones y watchlist", () => {
  test("Notification define type, read y el shape de data", () => {
    const typePath = Notification.schema.path("type") as unknown as { options: { enum: string[] } };
    expect(typePath.options.enum).toEqual([
      "outbid",
      "won",
      "payment_confirmed",
      "refunded",
      "watch_closing",
    ]);
    expect(Notification.schema.path("read").options.default).toBe(false);
    expect(Notification.schema.path("userId")).toBeDefined();
  });

  test("Watchlist referencia userId y vehicleId", () => {
    expect(Watchlist.schema.path("userId")).toBeDefined();
    expect(Watchlist.schema.path("vehicleId")).toBeDefined();
  });

  test("User define notificationPrefs con las 4 llaves y default true", () => {
    const prefs = User.schema.path("notificationPrefs") as unknown as {
      schema: { path: (k: string) => { options: { default: unknown } } };
    };
    for (const key of ["outbid", "won", "payment", "watchClosing"]) {
      expect(prefs.schema.path(key).options.default).toBe(true);
    }
    expect(User.schema.path("phone")).toBeDefined();
  });

  test("Vehicle define closingSoonNotifiedAt", () => {
    expect(Vehicle.schema.path("closingSoonNotifiedAt")).toBeDefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && bun test src/models/notification.test.ts`
Expected: FAIL — `Cannot find module './Notification'` (and `./Watchlist`).

- [ ] **Step 3: Create the Notification model**

```ts
// backend/src/models/Notification.ts
import mongoose, { type HydratedDocument, Types } from "mongoose";

export interface INotificationData {
  vehicleId?: string;
  bidId?: string;
  paymentId?: string;
}

export interface INotification {
  userId: Types.ObjectId;
  type: "outbid" | "won" | "payment_confirmed" | "refunded" | "watch_closing";
  title: string;
  body: string;
  data?: INotificationData;
  read: boolean;
  createdAt: Date;
}

export type NotificationDoc = HydratedDocument<INotification>;

const notificationSchema = new mongoose.Schema<INotification>(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: {
      type: String,
      enum: ["outbid", "won", "payment_confirmed", "refunded", "watch_closing"],
      required: true,
    },
    title: { type: String, required: true },
    body: { type: String, required: true },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    read: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: false } }
);

notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, read: 1 });

export const Notification = mongoose.model<INotification>("Notification", notificationSchema);
```

- [ ] **Step 4: Create the Watchlist model**

```ts
// backend/src/models/Watchlist.ts
import mongoose, { type HydratedDocument, Types } from "mongoose";

export interface IWatchlist {
  userId: Types.ObjectId;
  vehicleId: Types.ObjectId;
  createdAt: Date;
}

export type WatchlistDoc = HydratedDocument<IWatchlist>;

const watchlistSchema = new mongoose.Schema<IWatchlist>(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle", required: true },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: false } }
);

// Un vehículo aparece a lo sumo una vez en la watchlist de cada usuario.
watchlistSchema.index({ userId: 1, vehicleId: 1 }, { unique: true });

export const Watchlist = mongoose.model<IWatchlist>("Watchlist", watchlistSchema);
```

- [ ] **Step 5: Extend the User model**

In `backend/src/models/User.ts`, replace the whole file with:

```ts
import mongoose, { type HydratedDocument } from "mongoose";

export interface INotificationPrefs {
  outbid: boolean;
  won: boolean;
  payment: boolean;
  watchClosing: boolean;
}

export interface IUser {
  clerkId: string;
  name: string;
  email: string;
  role: "customer" | "admin";
  phone?: string;
  notificationPrefs: INotificationPrefs;
  createdAt: Date;
}

export type UserDoc = HydratedDocument<IUser>;

const notificationPrefsSchema = new mongoose.Schema<INotificationPrefs>(
  {
    outbid: { type: Boolean, default: true },
    won: { type: Boolean, default: true },
    payment: { type: Boolean, default: true },
    watchClosing: { type: Boolean, default: true },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema<IUser>(
  {
    clerkId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    role: { type: String, enum: ["customer", "admin"], default: "customer" },
    phone: { type: String },
    notificationPrefs: { type: notificationPrefsSchema, default: () => ({}) },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: false } }
);

export const User = mongoose.model<IUser>("User", userSchema);
```

- [ ] **Step 6: Extend the Vehicle model**

In `backend/src/models/Vehicle.ts`, add one field to `IVehicle` and one to the schema. Change:

```ts
export interface IVehicle {
  title: string;
  brand: string;
  model: string;
  year: number;
  color?: string;
  mileage?: number;
  condition: "excellent" | "good" | "fair" | "poor";
  description?: string;
  images: string[];
  basePrice: number;
  currentPrice: number;
  status: "draft" | "published" | "active" | "closed" | "awarded";
  auctionStartDate?: Date;
  auctionEndDate?: Date;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
```

to:

```ts
export interface IVehicle {
  title: string;
  brand: string;
  model: string;
  year: number;
  color?: string;
  mileage?: number;
  condition: "excellent" | "good" | "fair" | "poor";
  description?: string;
  images: string[];
  basePrice: number;
  currentPrice: number;
  status: "draft" | "published" | "active" | "closed" | "awarded";
  auctionStartDate?: Date;
  auctionEndDate?: Date;
  closingSoonNotifiedAt?: Date;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
```

and in the schema definition, change:

```ts
    auctionStartDate: { type: Date },
    auctionEndDate: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
```

to:

```ts
    auctionStartDate: { type: Date },
    auctionEndDate: { type: Date },
    closingSoonNotifiedAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `cd backend && bun test src/models/notification.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 8: Run the full backend suite to confirm no regressions**

Run: `cd backend && bun test`
Expected: PASS, same or higher count than the pre-task baseline (146 passing) — the User/Vehicle field additions are additive with defaults, no existing factory or test should break.

- [ ] **Step 9: Add the migration entry**

In `backend/scripts/migrations.ts`, add a new entry at the end of the `migrations` array (after version 2):

```ts
  {
    version: 3,
    name: "notificaciones-y-watchlist",
    up: async (connection) => {
      const db = connection.db!;
      await db.collection("notifications").createIndex({ userId: 1, createdAt: -1 });
      await db.collection("notifications").createIndex({ userId: 1, read: 1 });
      await db
        .collection("watchlists")
        .createIndex({ userId: 1, vehicleId: 1 }, { unique: true });
    },
  },
```

- [ ] **Step 10: Typecheck and commit**

Run: `cd backend && bun run typecheck`
Expected: no errors.

```bash
git add backend/src/models/Notification.ts backend/src/models/Watchlist.ts backend/src/models/User.ts backend/src/models/Vehicle.ts backend/src/models/notification.test.ts backend/scripts/migrations.ts
git commit -m "feat(backend): modelos Notification y Watchlist, extiende User y Vehicle"
```

---

### Task 2: Mailer (Resend, best-effort, log-only fallback)

**Files:**
- Create: `backend/src/lib/mailer.ts`
- Test: `backend/src/lib/mailer.test.ts`

**Interfaces:**
- Consumes: `logger` from `backend/src/lib/logger.ts` (already read: `logger.info(message, fields)`, `logger.error(message, fields)`).
- Produces: `sendEmail({ to, subject, html }: { to: string; subject: string; html: string }): Promise<void>` — never throws.

- [ ] **Step 1: Write the failing tests**

```ts
// backend/src/lib/mailer.test.ts
import { afterEach, describe, expect, mock, test } from "bun:test";
import { sendEmail } from "./mailer";

describe("sendEmail", () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.RESEND_API_KEY;
  const originalFrom = process.env.RESEND_FROM;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = originalKey;
    if (originalFrom === undefined) delete process.env.RESEND_FROM;
    else process.env.RESEND_FROM = originalFrom;
  });

  test("sin RESEND_API_KEY no llama a fetch y no lanza", async () => {
    delete process.env.RESEND_API_KEY;
    const fetchMock = mock(async () => new Response("{}"));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await sendEmail({ to: "a@test.dev", subject: "Hola", html: "<p>hi</p>" });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("con RESEND_API_KEY llama a la API de Resend con el payload correcto", async () => {
    process.env.RESEND_API_KEY = "re_test_123";
    process.env.RESEND_FROM = "Chocao <no-reply@chocao.test>";
    const fetchMock = mock(async () => new Response("{}", { status: 200 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await sendEmail({ to: "a@test.dev", subject: "Hola", html: "<p>hi</p>" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer re_test_123");
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      from: "Chocao <no-reply@chocao.test>",
      to: ["a@test.dev"],
      subject: "Hola",
      html: "<p>hi</p>",
    });
  });

  test("si fetch falla, no lanza (best-effort)", async () => {
    process.env.RESEND_API_KEY = "re_test_123";
    globalThis.fetch = mock(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;

    await expect(
      sendEmail({ to: "a@test.dev", subject: "Hola", html: "<p>hi</p>" })
    ).resolves.toBeUndefined();
  });

  test("si Resend responde con error HTTP, no lanza", async () => {
    process.env.RESEND_API_KEY = "re_test_123";
    globalThis.fetch = mock(async () => new Response("{}", { status: 422 })) as unknown as typeof fetch;

    await expect(
      sendEmail({ to: "a@test.dev", subject: "Hola", html: "<p>hi</p>" })
    ).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && bun test src/lib/mailer.test.ts`
Expected: FAIL — `Cannot find module './mailer'`.

- [ ] **Step 3: Implement the mailer**

```ts
// backend/src/lib/mailer.ts
import { logger } from "./logger";

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

// Envío de email best-effort: nunca lanza. Sin RESEND_API_KEY queda en modo
// log (desarrollo/demos); con la clave configurada llama a la API REST de
// Resend directamente por fetch (sin SDK adicional).
export async function sendEmail({ to, subject, html }: SendEmailParams): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    logger.info("email (dev, no enviado)", { to, subject });
    return;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || "Chocao <notificaciones@chocao.app>",
        to: [to],
        subject,
        html,
      }),
    });
    if (!res.ok) {
      logger.error("Resend respondió con error", { status: res.status, to, subject });
    }
  } catch (err) {
    logger.error("no se pudo enviar el email", {
      to,
      subject,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && bun test src/lib/mailer.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Create the test mock module (for later tasks)**

```ts
// backend/src/test/mocks/mailer.ts
import { mock } from "bun:test";

export const sendEmailMock = mock(async () => {});

export function resetMailerMock() {
  sendEmailMock.mockClear();
}

mock.module("../../lib/mailer", () => ({ sendEmail: sendEmailMock }));
```

- [ ] **Step 6: Full suite + typecheck + commit**

Run: `cd backend && bun test && bun run typecheck`
Expected: all pass, no type errors.

```bash
git add backend/src/lib/mailer.ts backend/src/lib/mailer.test.ts backend/src/test/mocks/mailer.ts
git commit -m "feat(backend): mailer best-effort sobre Resend con fallback a log"
```

---

### Task 3: Notification service (create/list/read) + email rendering

**Files:**
- Create: `backend/src/services/emails.ts`
- Create: `backend/src/services/notifications.ts`
- Test: `backend/src/services/notifications.test.ts`

**Interfaces:**
- Consumes: `Notification`, `NotificationDoc` from Task 1 (`../models/Notification`); `User`, `UserDoc` from `../models/User`; `sendEmail` from Task 2 (`../lib/mailer`); `logger` from `../lib/logger`; `NotFoundError` from `../lib/errors`; `assertOwner` from `../lib/ownership`.
- Produces:
  - `renderEmail(title: string, body: string): { subject: string; html: string }` (`../services/emails`).
  - `notify(input: { userId: Types.ObjectId | string; type: INotification["type"]; title: string; body: string; data?: INotificationData }): Promise<void>` — never throws; skips creation entirely if the user's `notificationPrefs` for that type's gate is `false`.
  - `notifyMany<T extends Types.ObjectId | string>(userIds: T[], type: INotification["type"], factory: (userId: T) => { title: string; body: string; data?: INotificationData }): Promise<void>`.
  - `listNotifications(user: UserDoc, { page, limit }?: { page?: number; limit?: number }): Promise<{ items: NotificationDoc[]; total: number; page: number; pages: number }>`.
  - `unreadCount(user: UserDoc): Promise<number>`.
  - `markRead(user: UserDoc, id: string): Promise<NotificationDoc>` — 404 if missing, 403 (via `assertOwner`) if not owner.
  - `markAllRead(user: UserDoc): Promise<{ modified: number }>`.

- [ ] **Step 1: Write the failing tests**

```ts
// backend/src/services/notifications.test.ts
import "../test/mocks/mailer";
import { beforeEach, describe, expect, test } from "bun:test";
import { setupTestDB } from "../test/db";
import { createUser } from "../test/factories";
import { sendEmailMock, resetMailerMock } from "../test/mocks/mailer";
import { Notification } from "../models/Notification";
import {
  markAllRead,
  markRead,
  notify,
  notifyMany,
  unreadCount,
  listNotifications,
} from "./notifications";

setupTestDB();
beforeEach(() => resetMailerMock());

describe("notify", () => {
  test("crea la notificación in-app y envía el email cuando la preferencia está activa", async () => {
    const user = await createUser();

    await notify({
      userId: user._id,
      type: "outbid",
      title: "Te superaron",
      body: "Alguien pujó más alto.",
      data: { vehicleId: "v1" },
    });

    const notifications = await Notification.find({ userId: user._id });
    expect(notifications).toHaveLength(1);
    expect(notifications[0]!.type).toBe("outbid");
    expect(notifications[0]!.read).toBe(false);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });

  test("respeta notificationPrefs desactivadas: no crea ni envía", async () => {
    const user = await createUser({
      notificationPrefs: { outbid: false, won: true, payment: true, watchClosing: true },
    });

    await notify({ userId: user._id, type: "outbid", title: "Te superaron", body: "..." });

    expect(await Notification.countDocuments({ userId: user._id })).toBe(0);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  test("payment_confirmed y refunded comparten la preferencia 'payment'", async () => {
    const user = await createUser({
      notificationPrefs: { outbid: true, won: true, payment: false, watchClosing: true },
    });

    await notify({ userId: user._id, type: "payment_confirmed", title: "Pago", body: "..." });
    await notify({ userId: user._id, type: "refunded", title: "Reembolso", body: "..." });

    expect(await Notification.countDocuments({ userId: user._id })).toBe(0);
  });

  test("un userId inexistente no crea nada ni lanza", async () => {
    await expect(
      notify({ userId: "000000000000000000000000", type: "won", title: "t", body: "b" })
    ).resolves.toBeUndefined();
    expect(await Notification.countDocuments()).toBe(0);
  });
});

describe("notifyMany", () => {
  test("notifica a cada userId con el resultado de su propia factory", async () => {
    const [a, b] = await Promise.all([createUser(), createUser()]);

    await notifyMany([a._id, b._id], "outbid", (userId) => ({
      title: "Te superaron",
      body: `body-${userId.toString()}`,
    }));

    expect(await Notification.countDocuments()).toBe(2);
  });
});

describe("lectura y marcado", () => {
  test("listNotifications pagina y unreadCount cuenta solo no leídas", async () => {
    const user = await createUser();
    for (let i = 0; i < 3; i++) {
      await notify({ userId: user._id, type: "won", title: `t${i}`, body: "b" });
    }

    const page = await listNotifications(user, { page: 1, limit: 2 });
    expect(page.items).toHaveLength(2);
    expect(page.total).toBe(3);
    expect(page.pages).toBe(2);
    expect(await unreadCount(user)).toBe(3);
  });

  test("markRead marca como leída y rechaza a un usuario que no es el dueño (403)", async () => {
    const [owner, other] = await Promise.all([createUser(), createUser()]);
    await notify({ userId: owner._id, type: "won", title: "t", body: "b" });
    const [notification] = await Notification.find({ userId: owner._id });

    const updated = await markRead(owner, notification!._id.toString());
    expect(updated.read).toBe(true);

    await notify({ userId: owner._id, type: "won", title: "t2", body: "b" });
    const [, second] = await Notification.find({ userId: owner._id }).sort({ createdAt: 1 });
    await expect(markRead(other, second!._id.toString())).rejects.toThrow();
  });

  test("markAllRead marca todas las no leídas del usuario", async () => {
    const user = await createUser();
    await Promise.all([
      notify({ userId: user._id, type: "won", title: "t1", body: "b" }),
      notify({ userId: user._id, type: "won", title: "t2", body: "b" }),
    ]);

    const result = await markAllRead(user);
    expect(result.modified).toBe(2);
    expect(await unreadCount(user)).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && bun test src/services/notifications.test.ts`
Expected: FAIL — `Cannot find module './notifications'` (and `../services/emails`).

- [ ] **Step 3: Implement the email renderer**

```ts
// backend/src/services/emails.ts

// Plantilla única, minimalista, con la identidad visual de Chocao. title/body
// ya vienen redactados por el llamador (mismo texto que la notificación
// in-app), así que no hay una plantilla distinta por tipo de evento.
export function renderEmail(title: string, body: string): { subject: string; html: string } {
  return {
    subject: `Chocao · ${title}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1a2233;">
        <p style="font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #b88a2e; margin-bottom: 16px;">Chocao · Subastas de vehículos</p>
        <h1 style="font-size: 20px; margin-bottom: 12px;">${title}</h1>
        <p style="font-size: 14px; line-height: 1.6; color: #414552;">${body}</p>
        <p style="font-size: 11px; color: #8390a0; margin-top: 32px;">República de Panamá · Este es un mensaje automático, no respondas a este correo.</p>
      </div>
    `.trim(),
  };
}
```

- [ ] **Step 4: Implement the notification service**

```ts
// backend/src/services/notifications.ts
import type { Types } from "mongoose";
import { NotFoundError } from "../lib/errors";
import { logger } from "../lib/logger";
import { sendEmail } from "../lib/mailer";
import { assertOwner } from "../lib/ownership";
import { Notification, type INotification, type INotificationData, type NotificationDoc } from "../models/Notification";
import { User, type INotificationPrefs, type UserDoc } from "../models/User";
import { renderEmail } from "./emails";

export interface NotifyInput {
  userId: Types.ObjectId | string;
  type: INotification["type"];
  title: string;
  body: string;
  data?: INotificationData;
}

const PREF_KEY_BY_TYPE: Record<INotification["type"], keyof INotificationPrefs> = {
  outbid: "outbid",
  won: "won",
  payment_confirmed: "payment",
  refunded: "payment",
  watch_closing: "watchClosing",
};

// Crea la notificación in-app y dispara el email best-effort, solo si la
// preferencia del usuario para ese tipo está activa. Nunca lanza — igual que
// recordAudit(), un fallo aquí no debe reventar el flujo de negocio que
// disparó el evento (puja, adjudicación, pago, reembolso).
export async function notify(input: NotifyInput): Promise<void> {
  try {
    const user = await User.findById(input.userId);
    if (!user) return;

    const prefKey = PREF_KEY_BY_TYPE[input.type];
    if (!user.notificationPrefs[prefKey]) return;

    await Notification.create({
      userId: user._id,
      type: input.type,
      title: input.title,
      body: input.body,
      data: input.data ?? {},
    });

    const { subject, html } = renderEmail(input.title, input.body);
    await sendEmail({ to: user.email, subject, html });
  } catch (err) {
    logger.error("no se pudo notificar", {
      userId: input.userId.toString(),
      type: input.type,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function notifyMany<T extends Types.ObjectId | string>(
  userIds: T[],
  type: INotification["type"],
  factory: (userId: T) => { title: string; body: string; data?: INotificationData }
): Promise<void> {
  await Promise.all(
    userIds.map((userId) => {
      const { title, body, data } = factory(userId);
      return notify({ userId, type, title, body, data });
    })
  );
}

export async function listNotifications(
  user: UserDoc,
  { page = 1, limit = 20 }: { page?: number; limit?: number } = {}
): Promise<{ items: NotificationDoc[]; total: number; page: number; pages: number }> {
  const filter = { userId: user._id };
  const [items, total] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Notification.countDocuments(filter),
  ]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / limit)) };
}

export async function unreadCount(user: UserDoc): Promise<number> {
  return Notification.countDocuments({ userId: user._id, read: false });
}

export async function markRead(user: UserDoc, id: string): Promise<NotificationDoc> {
  const notification = await Notification.findById(id);
  if (!notification) throw new NotFoundError("Notificación no encontrada");
  assertOwner(notification.userId, user, "No tienes permisos sobre esta notificación");
  notification.read = true;
  await notification.save();
  return notification;
}

export async function markAllRead(user: UserDoc): Promise<{ modified: number }> {
  const result = await Notification.updateMany({ userId: user._id, read: false }, { read: true });
  return { modified: result.modifiedCount };
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `cd backend && bun test src/services/notifications.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 6: Full suite + typecheck + commit**

Run: `cd backend && bun test && bun run typecheck`
Expected: all pass, no type errors.

```bash
git add backend/src/services/emails.ts backend/src/services/notifications.ts backend/src/services/notifications.test.ts
git commit -m "feat(backend): servicio de notificaciones (in-app + email best-effort)"
```

---

### Task 4: Watchlist service + notifications/watchlist routes, mounted in app.ts

**Files:**
- Create: `backend/src/services/watchlist.ts`
- Create: `backend/src/schemas/notifications.ts`
- Create: `backend/src/schemas/watchlist.ts`
- Create: `backend/src/routes/notifications.ts`
- Create: `backend/src/routes/watchlist.ts`
- Modify: `backend/src/app.ts`
- Test: `backend/src/test/notifications-routes.integration.test.ts`
- Test: `backend/src/test/watchlist.integration.test.ts`

**Interfaces:**
- Consumes: `listNotifications`, `unreadCount`, `markRead`, `markAllRead` from Task 3 (`../services/notifications`); `objectIdSchema`, `idParamSchema`, `validate` from `../schemas/common`; `requireAuth` from `../middlewares/auth`; `Watchlist`, `WatchlistDoc` from `../models/Watchlist`.
- Produces:
  - `listWatchlist(user: UserDoc): Promise<WatchlistDoc[]>` (populated `vehicleId`), `addToWatchlist(user, vehicleId): Promise<WatchlistDoc>` (idempotent — returns the existing row if already present), `removeFromWatchlist(user, vehicleId): Promise<void>` (idempotent no-op if absent).
  - Routes: `GET /api/notifications`, `GET /api/notifications/unread-count`, `PATCH /api/notifications/:id/read`, `PATCH /api/notifications/read-all`, `GET /api/watchlist`, `POST /api/watchlist/:vehicleId`, `DELETE /api/watchlist/:vehicleId` — all `requireAuth`.

- [ ] **Step 1: Write the failing route tests**

```ts
// backend/src/test/notifications-routes.integration.test.ts
import "./mocks/clerk";
import "./mocks/mailer";
import { describe, expect, test } from "bun:test";
import { createApp } from "../app";
import { setupTestDB } from "./db";
import { authHeader, createUser } from "./factories";
import { notify } from "../services/notifications";

setupTestDB();
const app = createApp();

describe("rutas de notificaciones", () => {
  test("GET /api/notifications lista solo las mías, paginadas", async () => {
    const [me, other] = await Promise.all([createUser(), createUser()]);
    await notify({ userId: me._id, type: "won", title: "t", body: "b" });
    await notify({ userId: other._id, type: "won", title: "t", body: "b" });

    const res = await app.request("/api/notifications", { headers: authHeader(me) });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: unknown[]; total: number };
    expect(body.items).toHaveLength(1);
    expect(body.total).toBe(1);
  });

  test("GET /api/notifications/unread-count", async () => {
    const me = await createUser();
    await notify({ userId: me._id, type: "won", title: "t", body: "b" });

    const res = await app.request("/api/notifications/unread-count", { headers: authHeader(me) });
    expect(res.status).toBe(200);
    expect((await res.json()) as { count: number }).toMatchObject({ count: 1 });
  });

  test("PATCH /api/notifications/:id/read marca como leída; ajeno da 403", async () => {
    const [me, other] = await Promise.all([createUser(), createUser()]);
    await notify({ userId: me._id, type: "won", title: "t", body: "b" });
    const listRes = await app.request("/api/notifications", { headers: authHeader(me) });
    const { items } = (await listRes.json()) as { items: { _id: string }[] };

    const okRes = await app.request(`/api/notifications/${items[0]!._id}/read`, {
      method: "PATCH",
      headers: authHeader(me),
    });
    expect(okRes.status).toBe(200);

    const forbiddenRes = await app.request(`/api/notifications/${items[0]!._id}/read`, {
      method: "PATCH",
      headers: authHeader(other),
    });
    expect(forbiddenRes.status).toBe(403);
  });

  test("PATCH /api/notifications/read-all marca todas como leídas", async () => {
    const me = await createUser();
    await notify({ userId: me._id, type: "won", title: "t1", body: "b" });
    await notify({ userId: me._id, type: "won", title: "t2", body: "b" });

    const res = await app.request("/api/notifications/read-all", {
      method: "PATCH",
      headers: authHeader(me),
    });
    expect(res.status).toBe(200);

    const countRes = await app.request("/api/notifications/unread-count", { headers: authHeader(me) });
    expect((await countRes.json()) as { count: number }).toMatchObject({ count: 0 });
  });

  test("sin autenticación responde 401", async () => {
    const res = await app.request("/api/notifications");
    expect(res.status).toBe(401);
  });
});
```

```ts
// backend/src/test/watchlist.integration.test.ts
import "./mocks/clerk";
import { describe, expect, test } from "bun:test";
import { createApp } from "../app";
import { setupTestDB } from "./db";
import { authHeader, createUser, createVehicle } from "./factories";

setupTestDB();
const app = createApp();

describe("rutas de watchlist", () => {
  test("agregar, listar y quitar un vehículo de mi watchlist", async () => {
    const user = await createUser();
    const vehicle = await createVehicle();

    const addRes = await app.request(`/api/watchlist/${vehicle._id}`, {
      method: "POST",
      headers: authHeader(user),
    });
    expect(addRes.status).toBe(201);

    const listRes = await app.request("/api/watchlist", { headers: authHeader(user) });
    const items = (await listRes.json()) as { vehicleId: { _id: string } }[];
    expect(items).toHaveLength(1);
    expect(items[0]!.vehicleId._id).toBe(vehicle._id.toString());

    const delRes = await app.request(`/api/watchlist/${vehicle._id}`, {
      method: "DELETE",
      headers: authHeader(user),
    });
    expect(delRes.status).toBe(200);

    const listAfter = await app.request("/api/watchlist", { headers: authHeader(user) });
    expect(await listAfter.json()).toHaveLength(0);
  });

  test("agregar dos veces el mismo vehículo es idempotente", async () => {
    const user = await createUser();
    const vehicle = await createVehicle();

    await app.request(`/api/watchlist/${vehicle._id}`, { method: "POST", headers: authHeader(user) });
    const second = await app.request(`/api/watchlist/${vehicle._id}`, {
      method: "POST",
      headers: authHeader(user),
    });
    expect(second.status).toBe(201);

    const listRes = await app.request("/api/watchlist", { headers: authHeader(user) });
    expect(await listRes.json()).toHaveLength(1);
  });

  test("quitar un vehículo que no está en la watchlist es un no-op (200)", async () => {
    const user = await createUser();
    const vehicle = await createVehicle();

    const res = await app.request(`/api/watchlist/${vehicle._id}`, {
      method: "DELETE",
      headers: authHeader(user),
    });
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd backend && bun test src/test/notifications-routes.integration.test.ts src/test/watchlist.integration.test.ts`
Expected: FAIL — routes don't exist yet (404s / import errors once wired incorrectly).

- [ ] **Step 3: Implement schemas**

```ts
// backend/src/schemas/notifications.ts
import { z } from "zod";

export const listNotificationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
```

```ts
// backend/src/schemas/watchlist.ts
import { z } from "zod";
import { objectIdSchema } from "./common";

export const vehicleIdParamSchema = z.object({ vehicleId: objectIdSchema });
```

- [ ] **Step 4: Implement the watchlist service**

```ts
// backend/src/services/watchlist.ts
import { Watchlist, type WatchlistDoc } from "../models/Watchlist";
import type { UserDoc } from "../models/User";

export async function listWatchlist(user: UserDoc): Promise<WatchlistDoc[]> {
  return Watchlist.find({ userId: user._id }).populate("vehicleId").sort({ createdAt: -1 });
}

// Idempotente: reintentar agregar el mismo vehículo no crea duplicados ni
// falla — devuelve la fila existente.
export async function addToWatchlist(user: UserDoc, vehicleId: string): Promise<WatchlistDoc> {
  const existing = await Watchlist.findOne({ userId: user._id, vehicleId });
  if (existing) return existing;
  return Watchlist.create({ userId: user._id, vehicleId });
}

export async function removeFromWatchlist(user: UserDoc, vehicleId: string): Promise<void> {
  await Watchlist.deleteOne({ userId: user._id, vehicleId });
}
```

- [ ] **Step 5: Implement the notifications route**

```ts
// backend/src/routes/notifications.ts
import { Hono } from "hono";
import type { AppEnv } from "../types";
import { requireAuth } from "../middlewares/auth";
import { idParamSchema, validate } from "../schemas/common";
import { listNotificationsQuerySchema } from "../schemas/notifications";
import { listNotifications, markAllRead, markRead, unreadCount } from "../services/notifications";

const notifications = new Hono<AppEnv>();

notifications.get("/", requireAuth, validate("query", listNotificationsQuerySchema), async (c) => {
  const { page, limit } = c.req.valid("query");
  return c.json(await listNotifications(c.get("user"), { page, limit }));
});

notifications.get("/unread-count", requireAuth, async (c) => {
  return c.json({ count: await unreadCount(c.get("user")) });
});

notifications.patch("/read-all", requireAuth, async (c) => {
  return c.json(await markAllRead(c.get("user")));
});

notifications.patch("/:id/read", requireAuth, validate("param", idParamSchema), async (c) => {
  const notification = await markRead(c.get("user"), c.req.valid("param").id);
  return c.json(notification);
});

export default notifications;
```

Note the route order: `/read-all` (static) is registered **before** `/:id/read` (dynamic) — Hono matches in registration order, and `/read-all` would otherwise never be reached if `/:id/read` were registered first with `id="read-all"` swallowing it. (In this file `/read-all` is a `PATCH` with no further segment while `/:id/read` requires a second segment, so they wouldn't actually collide — but keep the static-before-dynamic order regardless, it's the safer default and matches the codebase's existing habit of listing specific paths before parameterized ones.)

- [ ] **Step 6: Implement the watchlist route**

```ts
// backend/src/routes/watchlist.ts
import { Hono } from "hono";
import type { AppEnv } from "../types";
import { requireAuth } from "../middlewares/auth";
import { validate } from "../schemas/common";
import { vehicleIdParamSchema } from "../schemas/watchlist";
import { addToWatchlist, listWatchlist, removeFromWatchlist } from "../services/watchlist";

const watchlist = new Hono<AppEnv>();

watchlist.get("/", requireAuth, async (c) => {
  return c.json(await listWatchlist(c.get("user")));
});

watchlist.post("/:vehicleId", requireAuth, validate("param", vehicleIdParamSchema), async (c) => {
  const item = await addToWatchlist(c.get("user"), c.req.valid("param").vehicleId);
  return c.json(item, 201);
});

watchlist.delete("/:vehicleId", requireAuth, validate("param", vehicleIdParamSchema), async (c) => {
  await removeFromWatchlist(c.get("user"), c.req.valid("param").vehicleId);
  return c.json({ removed: true });
});

export default watchlist;
```

- [ ] **Step 7: Mount both routers**

In `backend/src/app.ts`, add two imports near the existing route imports:

```ts
import notificationsRouter from "./routes/notifications";
import watchlistRouter from "./routes/watchlist";
```

and two `app.route(...)` calls next to the existing ones:

```ts
  app.route("/api/dashboard", dashboardRouter);
  app.route("/api/audit", auditRouter);
  app.route("/api/notifications", notificationsRouter);
  app.route("/api/watchlist", watchlistRouter);
```

- [ ] **Step 8: Run to verify they pass**

Run: `cd backend && bun test src/test/notifications-routes.integration.test.ts src/test/watchlist.integration.test.ts`
Expected: PASS (5 + 3 tests).

- [ ] **Step 9: Full suite + typecheck + commit**

Run: `cd backend && bun test && bun run typecheck`
Expected: all pass, no type errors.

```bash
git add backend/src/services/watchlist.ts backend/src/schemas/notifications.ts backend/src/schemas/watchlist.ts backend/src/routes/notifications.ts backend/src/routes/watchlist.ts backend/src/app.ts backend/src/test/notifications-routes.integration.test.ts backend/src/test/watchlist.integration.test.ts
git commit -m "feat(backend): endpoints de notificaciones y watchlist"
```

---

### Task 5: Hook notify() into bids/auctions/payments + closing-soon watchlist job

**Files:**
- Modify: `backend/src/services/bids.ts`
- Modify: `backend/src/services/auctions.ts`
- Modify: `backend/src/services/payments.ts`
- Modify: `backend/src/jobs/closeExpiredAuctions.ts`
- Test: `backend/src/test/notification-hooks.integration.test.ts`

**Interfaces:**
- Consumes: `notify`, `notifyMany` from Task 3 (`./notifications`); `Watchlist` from Task 1 (`../models/Watchlist`).
- Produces: `notifyClosingSoonWatchers(): Promise<number>` in `backend/src/services/auctions.ts` (returns the number of watcher-notifications sent; idempotent per vehicle via `closingSoonNotifiedAt`).

- [ ] **Step 1: Write the failing integration test**

```ts
// backend/src/test/notification-hooks.integration.test.ts
import "./mocks/clerk";
import "./mocks/stripe";
import "./mocks/mailer";
import { beforeEach, describe, expect, test } from "bun:test";
import { createApp } from "../app";
import { Notification } from "../models/Notification";
import { Payment } from "../models/Payment";
import { Watchlist } from "../models/Watchlist";
import { setupTestDB } from "./db";
import { authHeader, createBid, createUser, createVehicle } from "./factories";
import { markSessionPaid, resetStripeMock } from "./mocks/stripe";
import { notifyClosingSoonWatchers } from "../services/auctions";

setupTestDB();
const app = createApp();
beforeEach(() => resetStripeMock());

describe("notificaciones disparadas por eventos de negocio", () => {
  test("al ser superado, el pujador anterior recibe una notificación outbid", async () => {
    const [ana, bruno] = await Promise.all([createUser(), createUser()]);
    const vehicle = await createVehicle({ basePrice: 10_000, currentPrice: 11_000 });
    await createBid(vehicle, ana!, { amount: 11_000 });

    const res = await app.request(`/api/bids/vehicle/${vehicle._id}`, {
      method: "POST",
      headers: authHeader(bruno!),
      body: JSON.stringify({ amount: 12_000 }),
    });
    expect(res.status).toBe(201);

    const notifications = await Notification.find({ userId: ana!._id });
    expect(notifications).toHaveLength(1);
    expect(notifications[0]!.type).toBe("outbid");
  });

  test("un usuario no se notifica a sí mismo al superar su propia puja anterior", async () => {
    const ana = await createUser();
    const vehicle = await createVehicle({ basePrice: 10_000, currentPrice: 11_000 });
    await createBid(vehicle, ana, { amount: 11_000 });

    const res = await app.request(`/api/bids/vehicle/${vehicle._id}`, {
      method: "POST",
      headers: authHeader(ana),
      body: JSON.stringify({ amount: 12_000 }),
    });
    expect(res.status).toBe(201);

    expect(await Notification.countDocuments({ userId: ana._id })).toBe(0);
  });

  test("el ganador recibe una notificación won al cerrarse la subasta", async () => {
    const [admin, ganador] = await Promise.all([createUser({ role: "admin" }), createUser()]);
    const vehicle = await createVehicle();
    await createBid(vehicle, ganador!, { amount: 15_000 });

    const res = await app.request(`/api/vehicles/${vehicle._id}/status`, {
      method: "PATCH",
      headers: authHeader(admin!),
      body: JSON.stringify({ status: "closed" }),
    });
    expect(res.status).toBe(200);

    expect(await Notification.countDocuments({ userId: ganador!._id, type: "won" })).toBe(1);
  });

  test("no duplica la notificación won si el vehículo ya estaba adjudicado", async () => {
    const [admin, ganador] = await Promise.all([createUser({ role: "admin" }), createUser()]);
    const vehicle = await createVehicle();
    await createBid(vehicle, ganador!, { amount: 15_000 });

    await app.request(`/api/vehicles/${vehicle._id}/status`, {
      method: "PATCH",
      headers: authHeader(admin!),
      body: JSON.stringify({ status: "closed" }),
    });
    await app.request(`/api/vehicles/${vehicle._id}/status`, {
      method: "PATCH",
      headers: authHeader(admin!),
      body: JSON.stringify({ status: "awarded" }),
    });

    expect(await Notification.countDocuments({ userId: ganador!._id, type: "won" })).toBe(1);
  });

  test("al confirmarse el pago, el comprador recibe payment_confirmed", async () => {
    const buyer = await createUser();
    const vehicle = await createVehicle();
    const bid = await createBid(vehicle, buyer, { amount: 12_000, status: "winner" });

    const checkout = await app.request("/api/payments/create-checkout-session", {
      method: "POST",
      headers: authHeader(buyer),
      body: JSON.stringify({ bidId: bid._id.toString() }),
    });
    expect(checkout.status).toBe(200);
    const payment = (await Payment.findOne({ bidId: bid._id }))!;
    markSessionPaid(payment.stripeSessionId!);

    const confirm = await app.request(`/api/payments/success?session_id=${payment.stripeSessionId}`, {
      headers: authHeader(buyer),
    });
    expect(confirm.status).toBe(200);

    expect(await Notification.countDocuments({ userId: buyer._id, type: "payment_confirmed" })).toBe(1);
  });

  test("al reembolsar, el comprador recibe refunded", async () => {
    const [admin, buyer] = await Promise.all([createUser({ role: "admin" }), createUser()]);
    const vehicle = await createVehicle();
    const bid = await createBid(vehicle, buyer!, { amount: 12_000, status: "winner" });

    const checkout = await app.request("/api/payments/create-checkout-session", {
      method: "POST",
      headers: authHeader(buyer!),
      body: JSON.stringify({ bidId: bid._id.toString() }),
    });
    expect(checkout.status).toBe(200);
    const payment = (await Payment.findOne({ bidId: bid._id }))!;
    markSessionPaid(payment.stripeSessionId!);
    await app.request(`/api/payments/success?session_id=${payment.stripeSessionId}`, {
      headers: authHeader(buyer!),
    });

    const refund = await app.request(`/api/payments/${payment._id}/refund`, {
      method: "POST",
      headers: authHeader(admin!),
    });
    expect(refund.status).toBe(200);

    expect(await Notification.countDocuments({ userId: buyer!._id, type: "refunded" })).toBe(1);
  });
});

describe("aviso de subasta por cerrar a quienes la siguen (watchlist)", () => {
  test("notifyClosingSoonWatchers notifica a los watchers y no repite en una segunda corrida", async () => {
    const watcher = await createUser();
    const vehicle = await createVehicle({
      status: "active",
      auctionEndDate: new Date(Date.now() + 30 * 60 * 1000),
    });
    await Watchlist.create({ userId: watcher._id, vehicleId: vehicle._id });

    const firstRun = await notifyClosingSoonWatchers();
    expect(firstRun).toBe(1);
    expect(await Notification.countDocuments({ userId: watcher._id, type: "watch_closing" })).toBe(1);

    const secondRun = await notifyClosingSoonWatchers();
    expect(secondRun).toBe(0);
    expect(await Notification.countDocuments({ userId: watcher._id, type: "watch_closing" })).toBe(1);
  });

  test("no notifica vehículos fuera de la ventana de una hora", async () => {
    const watcher = await createUser();
    const vehicle = await createVehicle({
      status: "active",
      auctionEndDate: new Date(Date.now() + 3 * 60 * 60 * 1000),
    });
    await Watchlist.create({ userId: watcher._id, vehicleId: vehicle._id });

    expect(await notifyClosingSoonWatchers()).toBe(0);
    expect(await Notification.countDocuments({ userId: watcher._id })).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && bun test src/test/notification-hooks.integration.test.ts`
Expected: FAIL — `notifyClosingSoonWatchers` doesn't exist yet; notification counts will be 0 where 1 is expected.

- [ ] **Step 3: Hook bids.ts (outbid)**

In `backend/src/services/bids.ts`, add the import at the top (alongside the existing ones):

```ts
import { notifyMany } from "./notifications";
```

Then replace:

```ts
  const bid = await Bid.create({ vehicleId: vehicle._id, userId: user._id, amount, status: "active" });

  // Reconciliación por comparación de monto, no por identidad de un "top"
```

with:

```ts
  const bid = await Bid.create({ vehicleId: vehicle._id, userId: user._id, amount, status: "active" });

  // Antes de degradar las pujas superadas, capturamos a quiénes pertenecían
  // (para notificarlos) — el updateMany no devuelve los documentos afectados.
  const outbidUserIds = await Bid.distinct("userId", {
    vehicleId: vehicle._id,
    status: "active",
    amount: { $lt: amount },
    userId: { $ne: user._id },
  });

  // Reconciliación por comparación de monto, no por identidad de un "top"
```

and replace the tail of the function:

```ts
  invalidateCatalog();
  metrics.increment("chocao_bids_total");
  return { bid, currentPrice: claimed.currentPrice };
```

with:

```ts
  invalidateCatalog();
  metrics.increment("chocao_bids_total");

  if (outbidUserIds.length > 0) {
    await notifyMany(outbidUserIds, "outbid", () => ({
      title: "Te superaron en una puja",
      body: `Alguien ofreció más por "${vehicle.title}". El precio actual es $${claimed.currentPrice.toLocaleString()}.`,
      data: { vehicleId: vehicle._id.toString() },
    }));
  }

  return { bid, currentPrice: claimed.currentPrice };
```

- [ ] **Step 4: Hook auctions.ts (won) and add notifyClosingSoonWatchers**

In `backend/src/services/auctions.ts`, add two imports:

```ts
import { notify, notifyMany } from "./notifications";
import { Watchlist } from "../models/Watchlist";
```

Replace the body of `adjudicateVehicle`:

```ts
  await Bid.updateMany(
    { vehicleId, _id: { $ne: highestBid._id }, status: { $ne: "paid" } },
    { status: "outbid" }
  );
  if (highestBid.status !== "paid") {
    highestBid.status = "winner";
    await highestBid.save();
  }
  return highestBid._id.toString();
```

with:

```ts
  await Bid.updateMany(
    { vehicleId, _id: { $ne: highestBid._id }, status: { $ne: "paid" } },
    { status: "outbid" }
  );
  if (highestBid.status !== "paid") {
    const wasAlreadyWinner = highestBid.status === "winner";
    highestBid.status = "winner";
    await highestBid.save();

    if (!wasAlreadyWinner) {
      const vehicle = await Vehicle.findById(vehicleId).select("title");
      await notify({
        userId: highestBid.userId,
        type: "won",
        title: "¡Ganaste la subasta!",
        body: `Tu puja fue la más alta por "${vehicle?.title ?? "el vehículo"}". Completa el pago para adjudicarlo.`,
        data: { vehicleId, bidId: highestBid._id.toString() },
      });
    }
  }
  return highestBid._id.toString();
```

Then append this new function at the end of the file:

```ts

const CLOSING_SOON_WINDOW_MS = 60 * 60 * 1000; // 1 hora

// Avisa a quienes siguen (watchlist) un vehículo activo que está por cerrar
// dentro de la próxima hora. Idempotente vía claim atómico sobre
// closingSoonNotifiedAt — mismo patrón que closeExpiredAuctions: un tick
// duplicado o varias instancias del job no reenvían el aviso.
export async function notifyClosingSoonWatchers(): Promise<number> {
  const now = new Date();
  const soon = new Date(now.getTime() + CLOSING_SOON_WINDOW_MS);
  const vehicles = await Vehicle.find({
    status: "active",
    auctionEndDate: { $gt: now, $lte: soon },
    closingSoonNotifiedAt: { $exists: false },
  }).select("title");

  let notified = 0;
  for (const vehicle of vehicles) {
    const claimed = await Vehicle.findOneAndUpdate(
      { _id: vehicle._id, closingSoonNotifiedAt: { $exists: false } },
      { closingSoonNotifiedAt: now },
      { returnDocument: "after" }
    );
    if (!claimed) continue;

    const watcherIds = await Watchlist.distinct("userId", { vehicleId: vehicle._id });
    if (watcherIds.length === 0) continue;

    await notifyMany(watcherIds, "watch_closing", () => ({
      title: "Una subasta que sigues está por cerrar",
      body: `"${vehicle.title}" cierra en menos de una hora.`,
      data: { vehicleId: vehicle._id.toString() },
    }));
    notified += watcherIds.length;
  }
  return notified;
}
```

- [ ] **Step 5: Hook payments.ts (payment_confirmed, refunded)**

In `backend/src/services/payments.ts`, add the import:

```ts
import { notify } from "./notifications";
```

In `confirmCheckoutSession`, replace:

```ts
  logger.info("pago confirmado", {
    paymentId: claimed._id.toString(),
    bidId: claimed.bidId.toString(),
    sessionId: session.id,
  });

  return { payment: claimed, transitioned: true };
```

with:

```ts
  logger.info("pago confirmado", {
    paymentId: claimed._id.toString(),
    bidId: claimed.bidId.toString(),
    sessionId: session.id,
  });

  const vehicle = await Vehicle.findById(claimed.vehicleId).select("title");
  await notify({
    userId: claimed.userId,
    type: "payment_confirmed",
    title: "Pago confirmado",
    body: `Tu pago de $${claimed.amount.toLocaleString()} por "${vehicle?.title ?? "el vehículo"}" fue confirmado.`,
    data: { vehicleId: claimed.vehicleId.toString(), bidId: claimed.bidId.toString(), paymentId: claimed._id.toString() },
  });

  return { payment: claimed, transitioned: true };
```

In `refundPayment`, replace the end of the function:

```ts
  logger.info("pago reembolsado", {
    paymentId: payment._id.toString(),
    bidId: payment.bidId.toString(),
    actor: actor._id.toString(),
  });

  return payment;
```

with:

```ts
  logger.info("pago reembolsado", {
    paymentId: payment._id.toString(),
    bidId: payment.bidId.toString(),
    actor: actor._id.toString(),
  });

  const vehicle = await Vehicle.findById(payment.vehicleId).select("title");
  await notify({
    userId: payment.userId,
    type: "refunded",
    title: "Tu pago fue reembolsado",
    body: `El pago de $${payment.amount.toLocaleString()} por "${vehicle?.title ?? "el vehículo"}" fue reembolsado.`,
    data: { vehicleId: payment.vehicleId.toString(), bidId: payment.bidId.toString(), paymentId: payment._id.toString() },
  });

  return payment;
```

- [ ] **Step 6: Wire the closing-soon check into the job**

In `backend/src/jobs/closeExpiredAuctions.ts`, replace:

```ts
import { logger } from "../lib/logger";
import { closeExpiredAuctions } from "../services/auctions";

// Job liviano sin dependencias: revisa cada minuto si hay subastas activas
// vencidas y las cierra/adjudica. La idempotencia vive en el servicio (claim
// atómico), así que un tick duplicado o un reinicio no adjudican dos veces.
export function startAuctionCloser(intervalMs = 60_000): NodeJS.Timeout {
  const tick = async () => {
    try {
      const closed = await closeExpiredAuctions();
      if (closed > 0) logger.info("job de cierre de subastas", { closed });
    } catch (err) {
      logger.error("el job de cierre de subastas falló", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  };

  void tick();
  return setInterval(tick, intervalMs);
}
```

with:

```ts
import { logger } from "../lib/logger";
import { closeExpiredAuctions, notifyClosingSoonWatchers } from "../services/auctions";

// Job liviano sin dependencias: revisa cada minuto si hay subastas activas
// vencidas y las cierra/adjudica, y además avisa a quienes siguen (watchlist)
// las que están por cerrar dentro de la próxima hora. Ambos pasos son
// idempotentes en el servicio (claim atómico), así que un tick duplicado o
// un reinicio no repiten adjudicaciones ni avisos.
export function startAuctionCloser(intervalMs = 60_000): NodeJS.Timeout {
  const tick = async () => {
    try {
      const closed = await closeExpiredAuctions();
      if (closed > 0) logger.info("job de cierre de subastas", { closed });
    } catch (err) {
      logger.error("el job de cierre de subastas falló", {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    try {
      await notifyClosingSoonWatchers();
    } catch (err) {
      logger.error("el chequeo de watchlist por cierre falló", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  };

  void tick();
  return setInterval(tick, intervalMs);
}
```

- [ ] **Step 7: Run to verify it passes**

Run: `cd backend && bun test src/test/notification-hooks.integration.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 8: Full suite + typecheck + commit**

Run: `cd backend && bun test && bun run typecheck`
Expected: all pass (existing bids/auctions/payments/webhook/refunds integration tests must still pass unchanged), no type errors.

```bash
git add backend/src/services/bids.ts backend/src/services/auctions.ts backend/src/services/payments.ts backend/src/jobs/closeExpiredAuctions.ts backend/src/test/notification-hooks.integration.test.ts
git commit -m "feat(backend): dispara notificaciones en puja superada, adjudicación, pago y reembolso"
```

---

### Task 6: User profile (PATCH /me) + payment receipt endpoint

**Files:**
- Modify: `backend/src/schemas/users.ts`
- Modify: `backend/src/routes/users.ts`
- Modify: `backend/src/services/payments.ts`
- Modify: `backend/src/routes/payments.ts`
- Test: `backend/src/test/profile-and-receipt.integration.test.ts`

**Interfaces:**
- Produces: `PATCH /api/users/me` (`requireAuth`) — body `{ phone?: string; notificationPrefs?: Partial<INotificationPrefs> }`, returns the updated `User`.
- Produces: `getReceipt(paymentId: string, user: UserDoc): Promise<Receipt>` in `../services/payments`, where `Receipt = { paymentId: string; amount: number; paidAt: Date; buyerName: string; buyerEmail: string; vehicle: { title: string; brand: string; model: string; year: number }; stripeSessionId?: string }`. 403 via `assertOwner` if not the payment's owner, 409 if the payment isn't `paid` yet.
- Produces: `GET /api/payments/:id/receipt` (`requireAuth`).

- [ ] **Step 1: Write the failing tests**

```ts
// backend/src/test/profile-and-receipt.integration.test.ts
import "./mocks/clerk";
import "./mocks/stripe";
import { describe, expect, test } from "bun:test";
import { createApp } from "../app";
import { setupTestDB } from "./db";
import { authHeader, createBid, createUser, createVehicle } from "./factories";
import { markSessionPaid } from "./mocks/stripe";
import { Payment } from "../models/Payment";

setupTestDB();
const app = createApp();

describe("PATCH /api/users/me", () => {
  test("actualiza phone y notificationPrefs parcialmente", async () => {
    const user = await createUser();

    const res = await app.request("/api/users/me", {
      method: "PATCH",
      headers: authHeader(user),
      body: JSON.stringify({ phone: "+507 6000-0000", notificationPrefs: { outbid: false } }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { phone: string; notificationPrefs: Record<string, boolean> };
    expect(body.phone).toBe("+507 6000-0000");
    expect(body.notificationPrefs.outbid).toBe(false);
    expect(body.notificationPrefs.won).toBe(true);
  });

  test("sin autenticación responde 401", async () => {
    const res = await app.request("/api/users/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "x" }),
    });
    expect(res.status).toBe(401);
  });
});

describe("GET /api/payments/:id/receipt", () => {
  async function paidPayment() {
    const buyer = await createUser();
    const vehicle = await createVehicle();
    const bid = await createBid(vehicle, buyer, { amount: 12_000, status: "winner" });

    const checkout = await app.request("/api/payments/create-checkout-session", {
      method: "POST",
      headers: authHeader(buyer),
      body: JSON.stringify({ bidId: bid._id.toString() }),
    });
    expect(checkout.status).toBe(200);
    const payment = (await Payment.findOne({ bidId: bid._id }))!;
    markSessionPaid(payment.stripeSessionId!);
    await app.request(`/api/payments/success?session_id=${payment.stripeSessionId}`, {
      headers: authHeader(buyer),
    });
    return { buyer, vehicle, payment: (await Payment.findById(payment._id))! };
  }

  test("el dueño obtiene su recibo con los datos del vehículo", async () => {
    const { buyer, vehicle, payment } = await paidPayment();

    const res = await app.request(`/api/payments/${payment._id}/receipt`, { headers: authHeader(buyer) });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { vehicle: { title: string }; amount: number };
    expect(body.vehicle.title).toBe(vehicle.title);
    expect(body.amount).toBe(12_000);
  });

  test("otro usuario recibe 403", async () => {
    const { payment } = await paidPayment();
    const other = await createUser();

    const res = await app.request(`/api/payments/${payment._id}/receipt`, { headers: authHeader(other) });
    expect(res.status).toBe(403);
  });

  test("un pago pendiente responde 409", async () => {
    const buyer = await createUser();
    const vehicle = await createVehicle();
    const bid = await createBid(vehicle, buyer, { amount: 12_000, status: "winner" });
    await app.request("/api/payments/create-checkout-session", {
      method: "POST",
      headers: authHeader(buyer),
      body: JSON.stringify({ bidId: bid._id.toString() }),
    });
    const pending = (await Payment.findOne({ bidId: bid._id }))!;

    const res = await app.request(`/api/payments/${pending._id}/receipt`, { headers: authHeader(buyer) });
    expect(res.status).toBe(409);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && bun test src/test/profile-and-receipt.integration.test.ts`
Expected: FAIL — `PATCH /api/users/me` and `GET /api/payments/:id/receipt` are 404.

- [ ] **Step 3: Add the profile schema**

In `backend/src/schemas/users.ts`, append:

```ts

export const updateProfileSchema = z.object({
  phone: z.string().trim().max(30).optional(),
  notificationPrefs: z
    .object({
      outbid: z.boolean().optional(),
      won: z.boolean().optional(),
      payment: z.boolean().optional(),
      watchClosing: z.boolean().optional(),
    })
    .optional(),
});
```

- [ ] **Step 4: Add the PATCH /me route**

In `backend/src/routes/users.ts`, add `updateProfileSchema` to the existing import from `../schemas/users`, then add this route right after `users.get("/me", ...)`:

```ts
users.patch("/me", requireAuth, validate("json", updateProfileSchema), async (c) => {
  const user = c.get("user");
  const { phone, notificationPrefs } = c.req.valid("json");
  if (phone !== undefined) user.phone = phone;
  if (notificationPrefs) Object.assign(user.notificationPrefs, notificationPrefs);
  await user.save();
  return c.json(user);
});
```

- [ ] **Step 5: Add getReceipt to the payments service**

In `backend/src/services/payments.ts`, add `ConflictError` to the existing error import if not already there, and append:

```ts

export interface Receipt {
  paymentId: string;
  amount: number;
  paidAt: Date;
  buyerName: string;
  buyerEmail: string;
  vehicle: { title: string; brand: string; model: string; year: number };
  stripeSessionId?: string;
}

// Recibo de un pago completado (comprador dueño únicamente). paidAt usa
// createdAt del Payment: el modelo no tiene un campo separado para el
// momento de confirmación, y el registro solo existe una vez creado en
// createCheckout (createdAt ≈ momento del intento de pago, suficientemente
// preciso para un recibo).
export async function getReceipt(paymentId: string, user: UserDoc): Promise<Receipt> {
  const payment = await Payment.findById(paymentId).populate<{ vehicleId: VehicleDoc }>("vehicleId");
  if (!payment) throw new NotFoundError("Pago no encontrado");
  assertOwner(payment.userId, user, "No tienes permisos sobre este recibo");
  if (payment.status !== "paid") {
    throw new ConflictError("El recibo solo está disponible para pagos completados");
  }

  const vehicle = payment.vehicleId;
  return {
    paymentId: payment._id.toString(),
    amount: payment.amount,
    paidAt: payment.createdAt,
    buyerName: user.name,
    buyerEmail: user.email,
    vehicle: { title: vehicle.title, brand: vehicle.brand, model: vehicle.model, year: vehicle.year },
    stripeSessionId: payment.stripeSessionId,
  };
}
```

- [ ] **Step 6: Add the receipt route**

In `backend/src/routes/payments.ts`, add `getReceipt` to the existing import from `../services/payments`, then append at the end (before `export default payments;`):

```ts
payments.get("/:id/receipt", requireAuth, validate("param", idParamSchema), async (c) => {
  const receipt = await getReceipt(c.req.valid("param").id, c.get("user"));
  return c.json(receipt);
});

```

- [ ] **Step 7: Run to verify it passes**

Run: `cd backend && bun test src/test/profile-and-receipt.integration.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 8: Full suite + typecheck + commit**

Run: `cd backend && bun test && bun run typecheck`
Expected: all pass, no type errors.

```bash
git add backend/src/schemas/users.ts backend/src/routes/users.ts backend/src/services/payments.ts backend/src/routes/payments.ts backend/src/test/profile-and-receipt.integration.test.ts
git commit -m "feat(backend): perfil editable (PATCH /me) y recibo de pago"
```

---

### Task 7: Dashboard analytics (time series + sales metrics)

**Files:**
- Modify: `backend/src/services/dashboard.ts`
- Modify: `backend/src/routes/dashboard.ts`
- Test: `backend/src/services/dashboard.analytics.test.ts`

**Interfaces:**
- Consumes: `ReportsParams` (already defined in `dashboard.ts`: `{ from?: Date; to?: Date }`); `reportsQuerySchema` from `../schemas/dashboard` (already validates `from`/`to`).
- Produces: `getAnalytics(params?: ReportsParams): Promise<Analytics>` where `Analytics = { vehiclesByStatus: {_id:string;count:number}[]; revenueByDay: {date:string;value:number}[]; bidsByDay: {date:string;value:number}[]; averageTicket: number; adjudicationRate: number; totalRefunded: number; uniqueBuyers: number }`. Produces `GET /api/dashboard/analytics?from&to` (`requirePermission("report:read")`).

- [ ] **Step 1: Write the failing test**

```ts
// backend/src/services/dashboard.analytics.test.ts
import { describe, expect, test } from "bun:test";
import { setupTestDB } from "../test/db";
import { createBid, createUser, createVehicle } from "../test/factories";
import { Payment } from "../models/Payment";
import { getAnalytics } from "./dashboard";

setupTestDB();

describe("getAnalytics", () => {
  test("agrega ingresos y pujas por día, y calcula métricas derivadas", async () => {
    const [buyer1, buyer2] = await Promise.all([createUser(), createUser()]);
    const vehicle1 = await createVehicle({ status: "awarded" });
    const vehicle2 = await createVehicle({ status: "published" });
    await createBid(vehicle1, buyer1, { amount: 10_000 });
    await createBid(vehicle2, buyer2, { amount: 5_000 });

    await Payment.create({
      userId: buyer1._id,
      vehicleId: vehicle1._id,
      bidId: (await createBid(vehicle1, buyer1, { amount: 10_500 }))._id,
      amount: 10_000,
      status: "paid",
    });
    await Payment.create({
      userId: buyer2._id,
      vehicleId: vehicle2._id,
      bidId: (await createBid(vehicle2, buyer2, { amount: 6_000 }))._id,
      amount: 3_000,
      status: "refunded",
    });

    const analytics = await getAnalytics();

    expect(analytics.revenueByDay.length).toBeGreaterThan(0);
    expect(analytics.revenueByDay[0]!.value).toBe(10_000);
    expect(analytics.bidsByDay.length).toBeGreaterThan(0);
    expect(analytics.averageTicket).toBe(10_000);
    expect(analytics.totalRefunded).toBe(3_000);
    expect(analytics.uniqueBuyers).toBe(1);
    expect(analytics.adjudicationRate).toBeCloseTo(0.5, 5);
    expect(analytics.vehiclesByStatus.length).toBeGreaterThan(0);
  });

  test("sin datos, devuelve ceros sin lanzar", async () => {
    const analytics = await getAnalytics();
    expect(analytics.averageTicket).toBe(0);
    expect(analytics.totalRefunded).toBe(0);
    expect(analytics.uniqueBuyers).toBe(0);
    expect(analytics.adjudicationRate).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && bun test src/services/dashboard.analytics.test.ts`
Expected: FAIL — `getAnalytics` doesn't exist.

- [ ] **Step 3: Implement getAnalytics**

In `backend/src/services/dashboard.ts`, append at the end of the file:

```ts

export interface TimeSeriesPoint {
  date: string;
  value: number;
}

export interface Analytics {
  vehiclesByStatus: { _id: string; count: number }[];
  revenueByDay: TimeSeriesPoint[];
  bidsByDay: TimeSeriesPoint[];
  averageTicket: number;
  adjudicationRate: number;
  totalRefunded: number;
  uniqueBuyers: number;
}

// Analítica elaborada del backoffice: series de tiempo de ingresos y pujas,
// más métricas derivadas (ticket promedio, tasa de adjudicación, reembolsado
// total, compradores únicos). Acotable al mismo rango [from, to] que
// getReports. Mismo servicio para GET /api/dashboard/analytics.
export async function getAnalytics({ from, to }: ReportsParams = {}): Promise<Analytics> {
  const createdAtFilter =
    from || to
      ? { createdAt: { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) } }
      : {};

  const [
    vehiclesByStatus,
    revenueByDay,
    bidsByDay,
    paidPayments,
    refundedPayments,
    totalVehicles,
    awardedVehicles,
  ] = await Promise.all([
    Vehicle.aggregate([
      ...(from || to ? [{ $match: createdAtFilter }] : []),
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    Payment.aggregate([
      { $match: { status: "paid", ...createdAtFilter } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          value: { $sum: "$amount" },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Bid.aggregate([
      { $match: createdAtFilter },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          value: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Payment.find({ status: "paid", ...createdAtFilter }),
    Payment.find({ status: "refunded", ...createdAtFilter }),
    Vehicle.countDocuments(createdAtFilter),
    Vehicle.countDocuments({ status: "awarded", ...createdAtFilter }),
  ]);

  const averageTicket =
    paidPayments.length > 0 ? paidPayments.reduce((s, p) => s + p.amount, 0) / paidPayments.length : 0;
  const totalRefunded = refundedPayments.reduce((s, p) => s + p.amount, 0);
  const uniqueBuyers = new Set(paidPayments.map((p) => p.userId.toString())).size;
  const adjudicationRate = totalVehicles > 0 ? awardedVehicles / totalVehicles : 0;

  return {
    vehiclesByStatus,
    revenueByDay: revenueByDay.map((r) => ({ date: r._id as string, value: r.value as number })),
    bidsByDay: bidsByDay.map((r) => ({ date: r._id as string, value: r.value as number })),
    averageTicket,
    adjudicationRate,
    totalRefunded,
    uniqueBuyers,
  };
}
```

- [ ] **Step 4: Add the route**

In `backend/src/routes/dashboard.ts`, add `getAnalytics` to the existing import from `../services/dashboard`, then append before `export default dashboard;`:

```ts
dashboard.get(
  "/analytics",
  requirePermission("report:read"),
  validate("query", reportsQuerySchema),
  async (c) => {
    const { from, to } = c.req.valid("query");
    return c.json(await getAnalytics({ from, to }));
  }
);

```

- [ ] **Step 5: Run to verify it passes**

Run: `cd backend && bun test src/services/dashboard.analytics.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Full suite + typecheck + commit**

Run: `cd backend && bun test && bun run typecheck`
Expected: all pass, no type errors.

```bash
git add backend/src/services/dashboard.ts backend/src/routes/dashboard.ts backend/src/services/dashboard.analytics.test.ts
git commit -m "feat(backend): analítica de dashboard (series de tiempo y métricas de ventas)"
```

---

### Task 8: Users & payments listings for the backoffice + permission additions

**Files:**
- Modify: `backend/src/lib/permissions.ts`
- Create: `backend/src/services/users.ts`
- Modify: `backend/src/schemas/users.ts`
- Modify: `backend/src/routes/users.ts`
- Modify: `backend/src/schemas/payments.ts`
- Modify: `backend/src/services/payments.ts`
- Modify: `backend/src/routes/payments.ts`
- Test: `backend/src/test/admin-listings.integration.test.ts`

**Interfaces:**
- Produces: two new permissions `payments:read` and `users:read`, both granted to `admin` only (not `customer`).
- Produces: `listUsers({ q?, role?, page?, limit? }): Promise<{ items: (User & {bidCount:number})[]; total; page; pages }>` in `../services/users`, `GET /api/users` (`requirePermission("users:read")`).
- Produces: `listPayments({ status?, from?, to?, page?, limit? }): Promise<{ items: PaymentDoc[]; total; page; pages }>` (populated `userId`/`vehicleId`) in `../services/payments`, `GET /api/payments` (`requirePermission("payments:read")`).

- [ ] **Step 1: Write the failing tests**

```ts
// backend/src/test/admin-listings.integration.test.ts
import "./mocks/clerk";
import { describe, expect, test } from "bun:test";
import { createApp } from "../app";
import { Payment } from "../models/Payment";
import { setupTestDB } from "./db";
import { authHeader, createBid, createUser, createVehicle } from "./factories";

setupTestDB();
const app = createApp();

describe("GET /api/users", () => {
  test("un admin lista usuarios con bidCount, filtrables por texto y rol", async () => {
    const admin = await createUser({ role: "admin" });
    const cliente = await createUser({ name: "Ana Pérez", email: "ana@test.dev" });
    const vehicle = await createVehicle();
    await createBid(vehicle, cliente, { amount: 12_000 });

    const res = await app.request("/api/users?q=ana", { headers: authHeader(admin) });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: { email: string; bidCount: number }[]; total: number };
    expect(body.items.some((u) => u.email === "ana@test.dev" && u.bidCount === 1)).toBe(true);
  });

  test("un customer recibe 403", async () => {
    const customer = await createUser();
    const res = await app.request("/api/users", { headers: authHeader(customer) });
    expect(res.status).toBe(403);
  });
});

describe("GET /api/payments", () => {
  test("un admin lista pagos filtrables por estado", async () => {
    const admin = await createUser({ role: "admin" });
    const buyer = await createUser();
    const vehicle = await createVehicle();
    const bid = await createBid(vehicle, buyer, { amount: 12_000 });
    await Payment.create({
      userId: buyer._id,
      vehicleId: vehicle._id,
      bidId: bid._id,
      amount: 12_000,
      status: "paid",
    });

    const res = await app.request("/api/payments?status=paid", { headers: authHeader(admin) });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: { status: string }[]; total: number };
    expect(body.total).toBe(1);
    expect(body.items[0]!.status).toBe("paid");
  });

  test("un customer recibe 403", async () => {
    const customer = await createUser();
    const res = await app.request("/api/payments", { headers: authHeader(customer) });
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && bun test src/test/admin-listings.integration.test.ts`
Expected: FAIL — both routes 404, or 403 for admin (permission missing).

- [ ] **Step 3: Add the two permissions**

In `backend/src/lib/permissions.ts`, change:

```ts
export const PERMISSIONS = [
  "catalog:read", // catálogo público
  "bids:read", // ver las pujas propias
  "bids:write", // pujar
  "payments:write", // iniciar checkout de pujas propias
  "payment:refund", // reembolsar pagos (finanzas)
  "vehicle:write", // CRUD y ciclo de vida de vehículos (catálogo)
  "dashboard:read", // KPIs del dashboard
  "report:read", // reportes y actividad global (todas las pujas)
  "users:manage", // cambiar roles de usuarios
  "audit:read", // consultar el registro de auditoría
  "mcp:manage", // revocar clientes MCP comprometidos (HU-60)
] as const;
```

to:

```ts
export const PERMISSIONS = [
  "catalog:read", // catálogo público
  "bids:read", // ver las pujas propias
  "bids:write", // pujar
  "payments:write", // iniciar checkout de pujas propias
  "payments:read", // listar pagos/órdenes (backoffice)
  "payment:refund", // reembolsar pagos (finanzas)
  "vehicle:write", // CRUD y ciclo de vida de vehículos (catálogo)
  "dashboard:read", // KPIs del dashboard
  "report:read", // reportes y actividad global (todas las pujas)
  "users:manage", // cambiar roles de usuarios
  "users:read", // listar usuarios (backoffice)
  "audit:read", // consultar el registro de auditoría
  "mcp:manage", // revocar clientes MCP comprometidos (HU-60)
] as const;
```

`ROLE_PERMISSIONS.admin` is `[...PERMISSIONS]`, so both new permissions reach `admin` automatically — no other change needed there; `customer` keeps its explicit short list unchanged.

- [ ] **Step 4: Add listUsersQuerySchema**

In `backend/src/schemas/users.ts`, append:

```ts

export const listUsersQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  role: z.enum(["customer", "admin"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
```

- [ ] **Step 5: Implement listUsers**

```ts
// backend/src/services/users.ts
import { Bid } from "../models/Bid";
import { User } from "../models/User";

export interface ListUsersParams {
  q?: string;
  role?: "customer" | "admin";
  page?: number;
  limit?: number;
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Listado de usuarios para el backoffice, con el conteo de pujas de cada uno
// (para reconocer a los más activos de un vistazo).
export async function listUsers({ q, role, page = 1, limit = 20 }: ListUsersParams) {
  const filter: Record<string, unknown> = {};
  if (role) filter.role = role;
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    filter.$or = [{ name: rx }, { email: rx }];
  }

  const [users, total] = await Promise.all([
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    User.countDocuments(filter),
  ]);

  const bidCounts = await Bid.aggregate([
    { $match: { userId: { $in: users.map((u) => u._id) } } },
    { $group: { _id: "$userId", count: { $sum: 1 } } },
  ]);
  const countByUser = new Map(bidCounts.map((b) => [b._id.toString(), b.count as number]));

  return {
    items: users.map((u) => ({ ...u.toObject(), bidCount: countByUser.get(u._id.toString()) ?? 0 })),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
  };
}
```

- [ ] **Step 6: Add the GET /api/users route**

In `backend/src/routes/users.ts`, add imports `listUsersQuerySchema` from `../schemas/users` and `listUsers` from `../services/users`. Add this route right after `users.get("/me", ...)`:

```ts
users.get("/", requirePermission("users:read"), validate("query", listUsersQuerySchema), async (c) => {
  return c.json(await listUsers(c.req.valid("query")));
});
```

- [ ] **Step 7: Add listPaymentsQuerySchema**

In `backend/src/schemas/payments.ts`, append:

```ts

export const listPaymentsQuerySchema = z.object({
  status: z.enum(["pending", "paid", "cancelled", "refunded"]).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
```

- [ ] **Step 8: Implement listPayments**

In `backend/src/services/payments.ts`, append at the end of the file:

```ts

export interface ListPaymentsParams {
  status?: IPayment["status"];
  from?: Date;
  to?: Date;
  page?: number;
  limit?: number;
}

// Listado de pagos/órdenes para el backoffice, filtrable por estado y rango
// de fecha, con comprador y vehículo poblados para la tabla.
export async function listPayments({ status, from, to, page = 1, limit = 20 }: ListPaymentsParams) {
  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  if (from || to) filter.createdAt = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };

  const [items, total] = await Promise.all([
    Payment.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("userId", "name email")
      .populate("vehicleId", "title brand model"),
    Payment.countDocuments(filter),
  ]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / limit)) };
}
```

Add `type IPayment` to the existing `../models/Payment` import at the top of the file if it isn't imported already.

- [ ] **Step 9: Add the GET /api/payments route**

In `backend/src/routes/payments.ts`, add imports `listPaymentsQuerySchema` from `../schemas/payments` and `listPayments` from `../services/payments`. Add this route right after the router is created (before the webhook route, since it's a plain authenticated GET with no raw-body concerns):

```ts
payments.get(
  "/",
  requirePermission("payments:read"),
  validate("query", listPaymentsQuerySchema),
  async (c) => {
    return c.json(await listPayments(c.req.valid("query")));
  }
);

```

- [ ] **Step 10: Run to verify it passes**

Run: `cd backend && bun test src/test/admin-listings.integration.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 11: Full suite + typecheck + commit**

Run: `cd backend && bun test && bun run typecheck`
Expected: all pass, no type errors. This closes out the backend half of the plan — the full suite should now be comfortably above the 146-test baseline.

```bash
git add backend/src/lib/permissions.ts backend/src/services/users.ts backend/src/schemas/users.ts backend/src/routes/users.ts backend/src/schemas/payments.ts backend/src/services/payments.ts backend/src/routes/payments.ts backend/src/test/admin-listings.integration.test.ts
git commit -m "feat(backend): listados de usuarios y pagos para el backoffice"
```

---

### Task 9: Frontend types + admin dark theme + AdminRoute FOUC fix

**Files:**
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/index.css`
- Modify: `frontend/src/components/AdminRoute.tsx`

**Interfaces:**
- Produces: `Notification`, `WatchlistItem`, `Receipt` types; `User` gains `phone?` and `notificationPrefs`.
- Consumes: nothing new (pure frontend foundation task, unblocks Tasks 10-18).

This task has no backend to TDD against — acceptance is `bunx tsc -b` from `frontend/` compiling clean, plus (where feasible) a quick look at `/admin` in a running dev server to confirm the dark theme renders and the public site is untouched.

- [ ] **Step 1: Extend the shared types**

In `frontend/src/types/index.ts`, replace:

```ts
export interface User {
  _id: string;
  clerkId: string;
  name: string;
  email: string;
  role: "customer" | "admin";
  createdAt: string;
}
```

with:

```ts
export interface NotificationPrefs {
  outbid: boolean;
  won: boolean;
  payment: boolean;
  watchClosing: boolean;
}

export interface User {
  _id: string;
  clerkId: string;
  name: string;
  email: string;
  role: "customer" | "admin";
  phone?: string;
  notificationPrefs: NotificationPrefs;
  createdAt: string;
}
```

and append at the end of the file:

```ts

export interface AppNotification {
  _id: string;
  type: "outbid" | "won" | "payment_confirmed" | "refunded" | "watch_closing";
  title: string;
  body: string;
  data?: { vehicleId?: string; bidId?: string; paymentId?: string };
  read: boolean;
  createdAt: string;
}

export interface WatchlistItem {
  _id: string;
  vehicleId: Vehicle;
  createdAt: string;
}

export interface Receipt {
  paymentId: string;
  amount: number;
  paidAt: string;
  buyerName: string;
  buyerEmail: string;
  vehicle: { title: string; brand: string; model: string; year: number };
  stripeSessionId?: string;
}
```

(Named `AppNotification`, not `Notification`, to avoid shadowing the global DOM `Notification` type.)

- [ ] **Step 2: Repaint the admin theme dark**

In `frontend/src/index.css`, replace the entire `.admin-theme` block:

```css
/* ================= TEMA ADMIN (Stripe docs) ================= */
.admin-theme {
  --bg: #ffffff;
  --bg-alt: #f5f6f8;
  --surface: #ffffff;

  --border: #ebeef1;
  --border-strong: #d8dee4;
  --hairline: #ebeef1;

  --primary: #1e3a8a;
  --primary-hover: #172e70;
  --primary-soft: #eef2fb;

  /* cero dorado: accent = primary en admin */
  --accent: #1e3a8a;
  --accent-soft: #eef2fb;

  --text: #414552;
  --text-muted: #687385;
  --text-soft: #87909f;

  font-size: 14px;
}
```

with:

```css
/* ================= TEMA ADMIN (slate oscuro) ================= */
/* Fondo oscuro deliberado: distingue el backoffice del sitio público de un
   vistazo. Solo valores de variables — la estructura (.admin-shell,
   .admin-sidebar, .kpi, .table, .badge...) ya las consume y se re-tematiza
   sola. */
.admin-theme {
  --bg: #0f172a;
  --bg-alt: #0b1220;
  --surface: #1e293b;

  --border: #334155;
  --border-strong: #475569;
  --hairline: #334155;

  --primary: #3b82f6;
  --primary-hover: #60a5fa;
  --primary-soft: rgba(59, 130, 246, 0.16);

  --accent: #f2b84b;
  --accent-soft: rgba(242, 184, 75, 0.16);
  --success: #34d399;
  --success-soft: rgba(52, 211, 153, 0.16);
  --danger: #f87171;
  --danger-soft: rgba(248, 113, 113, 0.16);
  --warning: #fbbf24;
  --warning-soft: rgba(251, 191, 36, 0.16);

  --text: #e2e8f0;
  --text-muted: #94a3b8;
  --text-soft: #64748b;
  --text-inverse: #0f172a;

  font-size: 14px;
}
```

- [ ] **Step 3: Fix the AdminRoute loading-screen FOUC**

In `frontend/src/components/AdminRoute.tsx`, replace:

```tsx
  if (!isLoaded || checking) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
        <p style={{ color: "rgba(240,244,255,0.5)" }}>Verificando permisos...</p>
      </div>
    );
  }
```

with:

```tsx
  if (!isLoaded || checking) {
    return (
      <div
        className="admin-theme"
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
          background: "var(--bg)",
        }}
      >
        <p style={{ color: "var(--text-muted)" }}>Verificando permisos...</p>
      </div>
    );
  }
```

This was originally an unreadable light-on-white color; wrapping it in `.admin-theme` also means the permission-check screen is already dark before the sidebar mounts, instead of flashing white first. (The logout-confirmation modal overlay in `AdminLayout.tsx` — `rgba(31, 41, 55, 0.4)` — is a neutral black scrim and works correctly on both themes; it is intentionally left unchanged.)

- [ ] **Step 4: Verify and commit**

Run: `cd frontend && bunx tsc -b`
Expected: no errors.

If a dev server is easy to run (`bun run dev` in `frontend/`, `bun run dev` in `backend/`), visiting `/admin` should show a dark slate background with light text, and `/` (public) should be unaffected — do this check if convenient, it is not required to complete the task.

```bash
git add frontend/src/types/index.ts frontend/src/index.css frontend/src/components/AdminRoute.tsx
git commit -m "feat(frontend): tema oscuro del backoffice y tipos de notificaciones/watchlist"
```

---

### Task 10: NotificationBell + NotificationsPage

**Files:**
- Create: `frontend/src/components/NotificationBell.tsx`
- Create: `frontend/src/pages/NotificationsPage.tsx`
- Modify: `frontend/src/components/Navbar.tsx`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: `useApi` (`../hooks/useApi`), `AppNotification` type from Task 9, `GET /api/notifications`, `GET /api/notifications/unread-count`, `PATCH /api/notifications/:id/read`, `PATCH /api/notifications/read-all` from Task 4, `Card`/`Button`/`PageHeader`/`EmptyState`/`LoadingState` from `../components/*`.
- Produces: `<NotificationBell />` (mounted in `Navbar` only when `isSignedIn`), route `/notifications`.

Acceptance: `bunx tsc -b` compiles clean.

- [ ] **Step 1: Implement NotificationBell**

```tsx
// frontend/src/components/NotificationBell.tsx
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApi } from "../hooks/useApi";
import type { AppNotification } from "../types";

const TYPE_ICON: Record<AppNotification["type"], string> = {
  outbid: "⚠",
  won: "🏆",
  payment_confirmed: "✓",
  refunded: "↺",
  watch_closing: "⏱",
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "ahora";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.floor(hours / 24)} d`;
}

export default function NotificationBell() {
  const api = useApi();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    function poll() {
      api
        .get("/api/notifications/unread-count")
        .then((r) => {
          if (!cancelled) setUnread(r.data.count);
        })
        .catch(() => {});
    }
    poll();
    const id = setInterval(poll, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  function loadLatest() {
    api
      .get("/api/notifications?limit=5")
      .then((r) => setItems(r.data.items))
      .catch(() => {});
  }

  function toggle() {
    if (!open) loadLatest();
    setOpen((o) => !o);
  }

  function handleItemClick(n: AppNotification) {
    setOpen(false);
    if (!n.read) {
      api.patch(`/api/notifications/${n._id}/read`).catch(() => {});
      setUnread((u) => Math.max(0, u - 1));
    }
    if (n.data?.vehicleId) navigate(`/vehicles/${n.data.vehicleId}`);
    else navigate("/notifications");
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={toggle}
        aria-label="Notificaciones"
        style={{
          position: "relative",
          width: 40,
          height: 40,
          borderRadius: "50%",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "1.1rem",
        }}
      >
        🔔
        {unread > 0 && (
          <span
            style={{
              position: "absolute",
              top: -2,
              right: -2,
              minWidth: 18,
              height: 18,
              borderRadius: "var(--radius-pill)",
              background: "var(--danger)",
              color: "#fff",
              fontSize: "10px",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 4px",
            }}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="card card-elevated"
          style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, width: 340, zIndex: 200 }}
        >
          <div
            style={{
              padding: "var(--sp-3) var(--sp-4)",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <p style={{ fontSize: "var(--t-sm)", fontWeight: 700, color: "var(--text)" }}>Notificaciones</p>
            <button
              onClick={() => {
                api.patch("/api/notifications/read-all").catch(() => {});
                setUnread(0);
                setItems((prev) => prev.map((n) => ({ ...n, read: true })));
              }}
              style={{ fontSize: "var(--t-xs)", color: "var(--primary)", fontWeight: 600 }}
            >
              Marcar todas
            </button>
          </div>

          <div style={{ maxHeight: 320, overflowY: "auto" }}>
            {items.length === 0 ? (
              <p style={{ padding: "var(--sp-5)", textAlign: "center", color: "var(--text-soft)", fontSize: "var(--t-sm)" }}>
                Sin notificaciones
              </p>
            ) : (
              items.map((n) => (
                <button
                  key={n._id}
                  onClick={() => handleItemClick(n)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "var(--sp-3) var(--sp-4)",
                    borderBottom: "1px solid var(--hairline)",
                    background: n.read ? "transparent" : "var(--primary-soft)",
                    display: "flex",
                    gap: "var(--sp-3)",
                  }}
                >
                  <span style={{ fontSize: "1rem" }}>{TYPE_ICON[n.type]}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: "var(--t-sm)", fontWeight: 600, color: "var(--text)" }}>{n.title}</p>
                    <p style={{ fontSize: "var(--t-xs)", color: "var(--text-muted)", marginTop: 2 }}>{n.body}</p>
                    <p style={{ fontSize: "10px", color: "var(--text-soft)", marginTop: 4 }}>{timeAgo(n.createdAt)}</p>
                  </span>
                </button>
              ))
            )}
          </div>

          <button
            onClick={() => {
              setOpen(false);
              navigate("/notifications");
            }}
            style={{
              width: "100%",
              textAlign: "center",
              padding: "var(--sp-3)",
              fontSize: "var(--t-xs)",
              fontWeight: 600,
              color: "var(--primary)",
            }}
          >
            Ver todas →
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Mount it in Navbar**

In `frontend/src/components/Navbar.tsx`, add the import:

```tsx
import NotificationBell from "./NotificationBell";
```

and in the "Right actions" block, change:

```tsx
          {isLoaded && isSignedIn ? (
            <>
              {role === "admin" && (
                <Link to="/admin">
                  <Button variant="secondary" size="sm">
                    Backoffice
                  </Button>
                </Link>
              )}
              <UserMenu />
            </>
          ) : (
```

to:

```tsx
          {isLoaded && isSignedIn ? (
            <>
              {role === "admin" && (
                <Link to="/admin">
                  <Button variant="secondary" size="sm">
                    Backoffice
                  </Button>
                </Link>
              )}
              <NotificationBell />
              <UserMenu />
            </>
          ) : (
```

- [ ] **Step 3: Implement NotificationsPage**

```tsx
// frontend/src/pages/NotificationsPage.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApi } from "../hooks/useApi";
import Card from "../components/Card";
import Button from "../components/Button";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";
import LoadingState from "../components/LoadingState";
import type { AppNotification } from "../types";

const TYPE_ICON: Record<AppNotification["type"], string> = {
  outbid: "⚠",
  won: "🏆",
  payment_confirmed: "✓",
  refunded: "↺",
  watch_closing: "⏱",
};

export default function NotificationsPage() {
  const api = useApi();
  const navigate = useNavigate();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  function load(p: number) {
    setLoading(true);
    api
      .get(`/api/notifications?page=${p}&limit=20`)
      .then((r) => {
        setItems(r.data.items);
        setPages(r.data.pages);
        setPage(r.data.page);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => load(1), []);

  function handleClick(n: AppNotification) {
    if (!n.read) api.patch(`/api/notifications/${n._id}/read`).catch(() => {});
    if (n.data?.vehicleId) navigate(`/vehicles/${n.data.vehicleId}`);
  }

  return (
    <div className="container fade-in" style={{ padding: "var(--sp-6) var(--sp-5)" }}>
      <PageHeader
        eyebrow="Mi cuenta"
        title="Notificaciones"
        subtitle="Pujas superadas, adjudicaciones, pagos y avisos de tu watchlist"
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              api.patch("/api/notifications/read-all").catch(() => {});
              setItems((prev) => prev.map((n) => ({ ...n, read: true })));
            }}
          >
            Marcar todas como leídas
          </Button>
        }
      />

      <Card padding="none">
        {loading ? (
          <LoadingState />
        ) : items.length === 0 ? (
          <EmptyState icon="🔔" title="Sin notificaciones" description="Aquí verás avisos de tus subastas y compras." />
        ) : (
          <div>
            {items.map((n) => (
              <button
                key={n._id}
                onClick={() => handleClick(n)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "var(--sp-4) var(--sp-5)",
                  borderBottom: "1px solid var(--hairline)",
                  background: n.read ? "transparent" : "var(--primary-soft)",
                  display: "flex",
                  gap: "var(--sp-4)",
                }}
              >
                <span style={{ fontSize: "1.2rem" }}>{TYPE_ICON[n.type]}</span>
                <span style={{ flex: 1 }}>
                  <p style={{ fontSize: "var(--t-sm)", fontWeight: 600, color: "var(--text)" }}>{n.title}</p>
                  <p style={{ fontSize: "var(--t-sm)", color: "var(--text-muted)", marginTop: 4 }}>{n.body}</p>
                  <p style={{ fontSize: "var(--t-xs)", color: "var(--text-soft)", marginTop: 6 }}>
                    {new Date(n.createdAt).toLocaleString("es-PA")}
                  </p>
                </span>
              </button>
            ))}
          </div>
        )}
      </Card>

      {pages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: "var(--sp-3)", marginTop: "var(--sp-5)" }}>
          <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => load(page - 1)}>
            ← Anterior
          </Button>
          <span style={{ alignSelf: "center", fontSize: "var(--t-sm)", color: "var(--text-muted)" }}>
            Página {page} de {pages}
          </span>
          <Button variant="ghost" size="sm" disabled={page >= pages} onClick={() => load(page + 1)}>
            Siguiente →
          </Button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Wire the route**

In `frontend/src/App.tsx`, add the import:

```tsx
import NotificationsPage from "./pages/NotificationsPage";
```

and add the route inside the protected block, right after `/my-purchases`:

```tsx
          <Route
            path="/notifications"
            element={
              <ProtectedRoute>
                <NotificationsPage />
              </ProtectedRoute>
            }
          />
```

- [ ] **Step 5: Verify and commit**

Run: `cd frontend && bunx tsc -b`
Expected: no errors.

```bash
git add frontend/src/components/NotificationBell.tsx frontend/src/pages/NotificationsPage.tsx frontend/src/components/Navbar.tsx frontend/src/App.tsx
git commit -m "feat(frontend): campana de notificaciones y página de notificaciones"
```

---

### Task 11: Watchlist button (catalog + detail) + MyWatchlistPage

**Files:**
- Create: `frontend/src/components/WatchlistButton.tsx`
- Create: `frontend/src/pages/MyWatchlistPage.tsx`
- Modify: `frontend/src/components/VehicleCard.tsx`
- Modify: `frontend/src/pages/VehicleDetailPage.tsx`
- Modify: `frontend/src/components/UserMenu.tsx`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: `useApi`, `WatchlistItem`/`Vehicle` types, `GET/POST/DELETE /api/watchlist(/:vehicleId)` from Task 4.
- Produces: `<WatchlistButton vehicleId size?="sm"|"md" />`, route `/watchlist`.

Acceptance: `bunx tsc -b` compiles clean.

- [ ] **Step 1: Implement WatchlistButton**

```tsx
// frontend/src/components/WatchlistButton.tsx
import { useEffect, useState } from "react";
import type { MouseEvent } from "react";
import { useApi } from "../hooks/useApi";

interface Props {
  vehicleId: string;
  size?: "sm" | "md";
}

export default function WatchlistButton({ vehicleId, size = "md" }: Props) {
  const api = useApi();
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .get("/api/watchlist")
      .then((r) => {
        if (cancelled) return;
        const items = r.data as { vehicleId: { _id: string } }[];
        setSaved(items.some((i) => i.vehicleId?._id === vehicleId));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [vehicleId]);

  async function toggle(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;
    setLoading(true);
    try {
      if (saved) {
        await api.delete(`/api/watchlist/${vehicleId}`);
        setSaved(false);
      } else {
        await api.post(`/api/watchlist/${vehicleId}`);
        setSaved(true);
      }
    } catch {
      // deja el estado como estaba ante un error de red
    } finally {
      setLoading(false);
    }
  }

  const dim = size === "sm" ? 32 : 40;
  return (
    <button
      onClick={toggle}
      disabled={loading}
      aria-label={saved ? "Quitar de mi watchlist" : "Guardar en mi watchlist"}
      title={saved ? "Quitar de mi watchlist" : "Guardar en mi watchlist"}
      style={{
        width: dim,
        height: dim,
        borderRadius: "50%",
        background: saved ? "var(--danger-soft)" : "var(--surface)",
        border: "1px solid var(--border)",
        color: saved ? "var(--danger)" : "var(--text-muted)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size === "sm" ? "0.9rem" : "1.05rem",
        flexShrink: 0,
      }}
    >
      {saved ? "♥" : "♡"}
    </button>
  );
}
```

- [ ] **Step 2: Add it to VehicleCard (signed-in users only)**

In `frontend/src/components/VehicleCard.tsx`, add imports:

```tsx
import { useAuth } from "@clerk/react";
import WatchlistButton from "./WatchlistButton";
```

Add `const { isSignedIn } = useAuth();` at the top of the component body. Then replace:

```tsx
          <div style={{ position: "absolute", top: 12, right: 12 }}>
            <StatusBadge status={vehicle.status} />
          </div>
```

with:

```tsx
          <div style={{ position: "absolute", top: 12, right: 12 }}>
            <StatusBadge status={vehicle.status} />
          </div>
          {isSignedIn && (
            <div style={{ position: "absolute", top: 12, left: 12 }}>
              <WatchlistButton vehicleId={vehicle._id} size="sm" />
            </div>
          )}
```

- [ ] **Step 3: Add it to VehicleDetailPage**

In `frontend/src/pages/VehicleDetailPage.tsx`, add the import:

```tsx
import WatchlistButton from "../components/WatchlistButton";
```

Replace:

```tsx
              <div>
                <p className="eyebrow" style={{ marginBottom: 4 }}>
                  {vehicle.brand} · {vehicle.year}
                </p>
                <h1 style={{ fontSize: "var(--t-2xl)" }}>{vehicle.title}</h1>
              </div>
              <StatusBadge status={vehicle.status} />
```

with:

```tsx
              <div>
                <p className="eyebrow" style={{ marginBottom: 4 }}>
                  {vehicle.brand} · {vehicle.year}
                </p>
                <h1 style={{ fontSize: "var(--t-2xl)" }}>{vehicle.title}</h1>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)" }}>
                <StatusBadge status={vehicle.status} />
                {isSignedIn && <WatchlistButton vehicleId={vehicle._id} />}
              </div>
```

(`isSignedIn` is already destructured from `useAuth()` at the top of this file.)

- [ ] **Step 4: Implement MyWatchlistPage**

```tsx
// frontend/src/pages/MyWatchlistPage.tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useApi } from "../hooks/useApi";
import VehicleCard from "../components/VehicleCard";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";
import LoadingState from "../components/LoadingState";
import Button from "../components/Button";
import type { WatchlistItem } from "../types";

export default function MyWatchlistPage() {
  const api = useApi();
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/api/watchlist")
      .then((r) => setItems(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="container fade-in" style={{ padding: "var(--sp-6) var(--sp-5)" }}>
      <PageHeader
        eyebrow="Mi cuenta"
        title="Mi watchlist"
        subtitle="Vehículos que sigues — te avisamos si te superan o si la subasta está por cerrar"
      />

      {loading ? (
        <LoadingState />
      ) : items.length === 0 ? (
        <EmptyState
          icon="♡"
          title="Aún no sigues ningún vehículo"
          description="Guarda un vehículo desde el catálogo para hacerle seguimiento aquí."
          action={
            <Link to="/vehicles">
              <Button variant="primary">Ver catálogo</Button>
            </Link>
          }
        />
      ) : (
        <div className="grid-cards">
          {items.map((item) => (
            <VehicleCard key={item._id} vehicle={item.vehicleId} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Add the menu entry and the route**

In `frontend/src/components/UserMenu.tsx`, add a new menu button right after the "★ Mis compras" button (same style, copy the block and change label/route):

```tsx
            <button
              onClick={() => { setOpen(false); navigate("/watchlist"); }}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "10px 12px",
                background: "transparent",
                border: "none",
                color: "var(--text)",
                fontSize: "var(--t-sm)",
                fontWeight: 500,
                borderRadius: "var(--radius-sm)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-alt)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
            >
              ♡ Mi watchlist
            </button>
```

In `frontend/src/App.tsx`, add the import:

```tsx
import MyWatchlistPage from "./pages/MyWatchlistPage";
```

and the route right after `/notifications`:

```tsx
          <Route
            path="/watchlist"
            element={
              <ProtectedRoute>
                <MyWatchlistPage />
              </ProtectedRoute>
            }
          />
```

- [ ] **Step 6: Verify and commit**

Run: `cd frontend && bunx tsc -b`
Expected: no errors.

```bash
git add frontend/src/components/WatchlistButton.tsx frontend/src/pages/MyWatchlistPage.tsx frontend/src/components/VehicleCard.tsx frontend/src/pages/VehicleDetailPage.tsx frontend/src/components/UserMenu.tsx frontend/src/App.tsx
git commit -m "feat(frontend): botón de watchlist en catálogo/detalle y página Mi watchlist"
```

---

### Task 12: AccountPage (profile + notification preferences)

**Files:**
- Create: `frontend/src/pages/AccountPage.tsx`
- Modify: `frontend/src/components/UserMenu.tsx`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: `useApi`, `User`/`NotificationPrefs` types, `GET /api/users/me`, `PATCH /api/users/me` from Task 6.
- Produces: route `/account`.

Acceptance: `bunx tsc -b` compiles clean.

- [ ] **Step 1: Implement AccountPage**

```tsx
// frontend/src/pages/AccountPage.tsx
import { useEffect, useState } from "react";
import { useApi } from "../hooks/useApi";
import Card from "../components/Card";
import Button from "../components/Button";
import Input from "../components/Input";
import PageHeader from "../components/PageHeader";
import LoadingState from "../components/LoadingState";
import type { NotificationPrefs, User } from "../types";

const PREF_LABELS: Record<keyof NotificationPrefs, { title: string; hint: string }> = {
  outbid: { title: "Puja superada", hint: "Cuando alguien ofrece más que tu puja activa." },
  won: { title: "Subasta ganada", hint: "Cuando tu puja resulta ganadora al cerrar la subasta." },
  payment: { title: "Pagos y reembolsos", hint: "Confirmación de pago y avisos de reembolso." },
  watchClosing: { title: "Watchlist por cerrar", hint: "Cuando un vehículo que sigues está por cerrar." },
};

export default function AccountPage() {
  const api = useApi();
  const [user, setUser] = useState<User | null>(null);
  const [phone, setPhone] = useState("");
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api
      .get("/api/users/me")
      .then((r) => {
        setUser(r.data);
        setPhone(r.data.phone || "");
        setPrefs(r.data.notificationPrefs);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    if (!prefs) return;
    setSaving(true);
    setSaved(false);
    try {
      const res = await api.patch("/api/users/me", { phone, notificationPrefs: prefs });
      setUser(res.data);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  if (loading || !user || !prefs) {
    return (
      <div className="container" style={{ padding: "var(--sp-6) var(--sp-5)" }}>
        <LoadingState />
      </div>
    );
  }

  return (
    <div className="container fade-in" style={{ padding: "var(--sp-6) var(--sp-5)", maxWidth: 720 }}>
      <PageHeader eyebrow="Mi cuenta" title="Perfil y preferencias" subtitle="Tus datos y cómo quieres que te avisemos" />

      <Card padding="lg" style={{ marginBottom: "var(--sp-5)" }}>
        <h2 style={{ fontSize: "var(--t-md)", marginBottom: "var(--sp-4)" }}>Datos personales</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
          <Input label="Nombre" value={user.name} disabled hint="Gestionado por tu cuenta de acceso" />
          <Input label="Correo" value={user.email} disabled hint="Gestionado por tu cuenta de acceso" />
          <Input
            label="Teléfono"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+507 6000-0000"
          />
        </div>
      </Card>

      <Card padding="lg" style={{ marginBottom: "var(--sp-5)" }}>
        <h2 style={{ fontSize: "var(--t-md)", marginBottom: "var(--sp-4)" }}>Preferencias de notificación</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
          {(Object.keys(PREF_LABELS) as (keyof NotificationPrefs)[]).map((key) => (
            <label
              key={key}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "var(--sp-4)",
                cursor: "pointer",
              }}
            >
              <span>
                <p style={{ fontSize: "var(--t-sm)", fontWeight: 600, color: "var(--text)" }}>
                  {PREF_LABELS[key].title}
                </p>
                <p style={{ fontSize: "var(--t-xs)", color: "var(--text-muted)", marginTop: 2 }}>
                  {PREF_LABELS[key].hint}
                </p>
              </span>
              <input
                type="checkbox"
                checked={prefs[key]}
                onChange={(e) => setPrefs({ ...prefs, [key]: e.target.checked })}
                style={{ width: 20, height: 20, flexShrink: 0, cursor: "pointer" }}
              />
            </label>
          ))}
        </div>
      </Card>

      <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)" }}>
        <Button variant="primary" onClick={handleSave} disabled={saving}>
          {saving ? "Guardando..." : "Guardar cambios"}
        </Button>
        {saved && <span style={{ color: "var(--success)", fontSize: "var(--t-sm)", fontWeight: 600 }}>Guardado ✓</span>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add the menu entry and the route**

In `frontend/src/components/UserMenu.tsx`, add another button, in the same style, right after the "♡ Mi watchlist" button added in Task 11:

```tsx
            <button
              onClick={() => { setOpen(false); navigate("/account"); }}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "10px 12px",
                background: "transparent",
                border: "none",
                color: "var(--text)",
                fontSize: "var(--t-sm)",
                fontWeight: 500,
                borderRadius: "var(--radius-sm)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-alt)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
            >
              ⚙ Mi cuenta
            </button>
```

In `frontend/src/App.tsx`, add the import:

```tsx
import AccountPage from "./pages/AccountPage";
```

and the route right after `/watchlist`:

```tsx
          <Route
            path="/account"
            element={
              <ProtectedRoute>
                <AccountPage />
              </ProtectedRoute>
            }
          />
```

- [ ] **Step 3: Verify and commit**

Run: `cd frontend && bunx tsc -b`
Expected: no errors.

```bash
git add frontend/src/pages/AccountPage.tsx frontend/src/components/UserMenu.tsx frontend/src/App.tsx
git commit -m "feat(frontend): página de cuenta con perfil y preferencias de notificación"
```

---

### Task 13: ReceiptPage (printable receipt)

**Files:**
- Create: `frontend/src/pages/ReceiptPage.tsx`
- Modify: `frontend/src/pages/MyPurchasesPage.tsx`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: `useApi`, `Receipt` type, `GET /api/payments/:id/receipt` from Task 6. `MyPurchasesPage`'s `Bid` rows need their `Payment` id — the `GET /api/bids/my/purchases` payload (unchanged, `backend/src/services/bids.ts` `getMyPurchases`) already includes `payment: { id, status }` per row.
- Produces: route `/receipt/:paymentId`.

Acceptance: `bunx tsc -b` compiles clean.

- [ ] **Step 1: Implement ReceiptPage**

```tsx
// frontend/src/pages/ReceiptPage.tsx
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useApi } from "../hooks/useApi";
import Card from "../components/Card";
import Button from "../components/Button";
import LoadingState from "../components/LoadingState";
import EmptyState from "../components/EmptyState";
import Logo from "../components/Logo";
import type { Receipt } from "../types";

export default function ReceiptPage() {
  const { paymentId } = useParams<{ paymentId: string }>();
  const api = useApi();
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    api
      .get(`/api/payments/${paymentId}/receipt`)
      .then((r) => setReceipt(r.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [paymentId]);

  if (loading) {
    return (
      <div className="container" style={{ padding: "var(--sp-6) var(--sp-5)" }}>
        <LoadingState />
      </div>
    );
  }

  if (error || !receipt) {
    return (
      <div className="container" style={{ padding: "var(--sp-6) var(--sp-5)" }}>
        <EmptyState icon="🧾" title="Recibo no disponible" description="No pudimos encontrar este recibo o no te pertenece." />
      </div>
    );
  }

  return (
    <div className="container fade-in" style={{ padding: "var(--sp-6) var(--sp-5)", maxWidth: 640 }}>
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--sp-5)" }}>
        <Link to="/my-purchases" className="text-muted" style={{ fontSize: "var(--t-sm)", fontWeight: 500 }}>
          ← Volver a mis compras
        </Link>
        <Button variant="secondary" size="sm" onClick={() => window.print()}>
          Imprimir / Guardar PDF
        </Button>
      </div>

      <Card padding="lg" variant="elevated">
        <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)", marginBottom: "var(--sp-6)" }}>
          <Logo size={40} />
          <div>
            <p style={{ fontWeight: 800, fontSize: "var(--t-md)" }}>Chocao</p>
            <p className="eyebrow">Recibo de pago · República de Panamá</p>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--sp-5)" }}>
          <div>
            <p className="eyebrow" style={{ marginBottom: 4 }}>Recibo</p>
            <p className="mono" style={{ fontSize: "var(--t-sm)" }}>{receipt.paymentId}</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p className="eyebrow" style={{ marginBottom: 4 }}>Fecha</p>
            <p style={{ fontSize: "var(--t-sm)" }}>
              {new Date(receipt.paidAt).toLocaleString("es-PA", { dateStyle: "long", timeStyle: "short" })}
            </p>
          </div>
        </div>

        <div style={{ borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", padding: "var(--sp-4) 0", marginBottom: "var(--sp-5)" }}>
          <p className="eyebrow" style={{ marginBottom: 8 }}>Vehículo adjudicado</p>
          <p style={{ fontSize: "var(--t-md)", fontWeight: 600 }}>{receipt.vehicle.title}</p>
          <p className="text-muted" style={{ fontSize: "var(--t-sm)", marginTop: 4 }}>
            {receipt.vehicle.brand} · {receipt.vehicle.model} · {receipt.vehicle.year}
          </p>
        </div>

        <div style={{ borderBottom: "1px solid var(--border)", padding: "var(--sp-4) 0", marginBottom: "var(--sp-5)" }}>
          <p className="eyebrow" style={{ marginBottom: 8 }}>Comprador</p>
          <p style={{ fontSize: "var(--t-sm)", fontWeight: 600 }}>{receipt.buyerName}</p>
          <p className="text-muted" style={{ fontSize: "var(--t-sm)" }}>{receipt.buyerEmail}</p>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <p style={{ fontSize: "var(--t-md)", fontWeight: 600 }}>Total pagado</p>
          <p className="price-accent" style={{ fontSize: "var(--t-2xl)" }}>${receipt.amount.toLocaleString()}</p>
        </div>

        {receipt.stripeSessionId && (
          <p className="mono text-soft" style={{ fontSize: "10px", marginTop: "var(--sp-4)" }}>
            Sesión de pago: {receipt.stripeSessionId}
          </p>
        )}
      </Card>

      <style>{`@media print { .no-print { display: none !important; } }`}</style>
    </div>
  );
}
```

- [ ] **Step 2: Link to it from MyPurchasesPage**

In `frontend/src/pages/MyPurchasesPage.tsx`, add the import:

```tsx
import { useNavigate } from "react-router-dom";
```

(merge into the existing `import { Link } from "react-router-dom";` line, changing it to `import { Link, useNavigate } from "react-router-dom";`). Add `const navigate = useNavigate();` inside the component. Then extend the `Bid` type usage: `bid.payment` (already returned by `GET /api/bids/my/purchases`, shape `{ id: string; status: string } | undefined`, not currently in the frontend `Bid` type) — add it to `frontend/src/types/index.ts`'s `Bid` interface:

```ts
export interface Bid {
  _id: string;
  vehicleId: Vehicle | string;
  userId: User | string;
  amount: number;
  status: "active" | "outbid" | "winner" | "paid";
  createdAt: string;
  payment?: { id: string; status: string };
}
```

Then in the `DataTable<Bid>` columns array in `MyPurchasesPage.tsx`, replace the last column:

```tsx
              {
                header: "Estado",
                accessor: () => <StatusBadge status="paid" />,
              },
```

with:

```tsx
              {
                header: "Estado",
                accessor: () => <StatusBadge status="paid" />,
              },
              {
                header: "",
                align: "right",
                accessor: (bid) =>
                  bid.payment ? (
                    <Button variant="ghost" size="sm" onClick={() => navigate(`/receipt/${bid.payment!.id}`)}>
                      Ver recibo
                    </Button>
                  ) : null,
              },
```

- [ ] **Step 3: Wire the route**

In `frontend/src/App.tsx`, add the import:

```tsx
import ReceiptPage from "./pages/ReceiptPage";
```

and the route right after `/account`:

```tsx
          <Route
            path="/receipt/:paymentId"
            element={
              <ProtectedRoute>
                <ReceiptPage />
              </ProtectedRoute>
            }
          />
```

- [ ] **Step 4: Verify and commit**

Run: `cd frontend && bunx tsc -b`
Expected: no errors.

```bash
git add frontend/src/pages/ReceiptPage.tsx frontend/src/pages/MyPurchasesPage.tsx frontend/src/types/index.ts frontend/src/App.tsx
git commit -m "feat(frontend): recibo de pago imprimible enlazado desde mis compras"
```

---

### Task 14: AdminStatCard, sortable/paginated DataTable, ExportCsvButton, DateRangePicker

**Files:**
- Create: `frontend/src/components/AdminStatCard.tsx`
- Create: `frontend/src/components/admin/DateRangePicker.tsx`
- Create: `frontend/src/components/admin/ExportCsvButton.tsx`
- Modify: `frontend/src/components/DataTable.tsx`

**Interfaces:**
- Produces: `<AdminStatCard icon? label value hint? />` (renders inside an existing `.kpi-row`/`.kpi` wrapper, same DOM shape the four admin pages already use).
- Produces: `<DateRangePicker from to onChange={(range)=>void} />` where `from`/`to` are `yyyy-mm-dd` strings.
- Produces: `<ExportCsvButton data columns filename />` generic component, `columns: { header: string; accessor: (row: T) => string | number }[]`.
- Produces: `DataTable` gains **optional, additive** props: `sortKey?`/`sortValue?` per column (enables client-side sort by clicking the header) and `page?`/`pages?`/`onPageChange?` (renders a footer pager when all three are given). Every existing `<DataTable>` usage in the codebase must keep compiling and behaving identically without passing any of the new props.

Acceptance: `bunx tsc -b` compiles clean. This task touches no page — it only adds capability consumed by Tasks 15-18.

- [ ] **Step 1: Implement AdminStatCard**

```tsx
// frontend/src/components/AdminStatCard.tsx
interface Props {
  icon?: string;
  label: string;
  value: string | number;
  hint?: string;
}

export default function AdminStatCard({ icon, label, value, hint }: Props) {
  return (
    <div className="kpi">
      {icon && <p style={{ fontSize: "1rem", marginBottom: 4 }}>{icon}</p>}
      <p className="kpi-value">{value}</p>
      <p className="kpi-label">{label}</p>
      {hint && <p style={{ fontSize: "10.5px", color: "var(--text-soft)", marginTop: 4 }}>{hint}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Implement DateRangePicker**

```tsx
// frontend/src/components/admin/DateRangePicker.tsx
interface Range {
  from: string;
  to: string;
}

interface Props {
  from: string;
  to: string;
  onChange: (range: Range) => void;
}

export default function DateRangePicker({ from, to, onChange }: Props) {
  return (
    <div style={{ display: "flex", gap: "var(--sp-2)", alignItems: "center" }}>
      <input
        type="date"
        className="input"
        value={from}
        max={to || undefined}
        onChange={(e) => onChange({ from: e.target.value, to })}
        style={{ width: 152 }}
      />
      <span className="text-soft" style={{ fontSize: "var(--t-xs)" }}>a</span>
      <input
        type="date"
        className="input"
        value={to}
        min={from || undefined}
        onChange={(e) => onChange({ from, to: e.target.value })}
        style={{ width: 152 }}
      />
    </div>
  );
}
```

- [ ] **Step 3: Implement ExportCsvButton**

```tsx
// frontend/src/components/admin/ExportCsvButton.tsx
import Button from "../Button";

interface Column<T> {
  header: string;
  accessor: (row: T) => string | number;
}

interface Props<T> {
  data: T[];
  filename: string;
  columns: Column<T>[];
}

function toCsvValue(value: string | number): string {
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export default function ExportCsvButton<T>({ data, filename, columns }: Props<T>) {
  function handleExport() {
    const header = columns.map((c) => toCsvValue(c.header)).join(",");
    const rows = data.map((row) => columns.map((c) => toCsvValue(c.accessor(row))).join(","));
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <Button variant="secondary" size="sm" onClick={handleExport} disabled={data.length === 0}>
      Exportar CSV
    </Button>
  );
}
```

- [ ] **Step 4: Extend DataTable with optional sort + pagination**

Replace the full contents of `frontend/src/components/DataTable.tsx` with:

```tsx
import React, { useMemo, useState } from "react";
import Button from "./Button";

interface Column<T> {
  header: string;
  accessor: keyof T | ((row: T) => React.ReactNode);
  width?: string;
  align?: "left" | "right" | "center";
  /** Habilita el ordenamiento por esta columna al hacer click en el header. */
  sortKey?: string;
  /** Valor comparable a usar al ordenar (requerido si accessor es una función). */
  sortValue?: (row: T) => string | number;
}

interface Props<T> {
  columns: Column<T>[];
  data: T[];
  emptyMessage?: string;
  dense?: boolean;
  /** Paginación opcional: si se pasan los tres, se renderiza el pie con controles. */
  page?: number;
  pages?: number;
  onPageChange?: (page: number) => void;
}

export default function DataTable<T extends { _id?: string }>({
  columns,
  data,
  emptyMessage = "Sin datos para mostrar",
  dense = false,
  page,
  pages,
  onPageChange,
}: Props<T>) {
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(null);

  const sortedData = useMemo(() => {
    if (!sort) return data;
    const col = columns.find((c) => c.sortKey === sort.key);
    if (!col) return data;
    const valueOf = (row: T): string | number =>
      col.sortValue ? col.sortValue(row) : String(typeof col.accessor === "function" ? "" : row[col.accessor] ?? "");
    const copy = [...data];
    copy.sort((a, b) => {
      const av = valueOf(a);
      const bv = valueOf(b);
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [data, sort, columns]);

  function toggleSort(col: Column<T>) {
    if (!col.sortKey) return;
    setSort((prev) => {
      if (!prev || prev.key !== col.sortKey) return { key: col.sortKey!, dir: "asc" };
      return { key: col.sortKey!, dir: prev.dir === "asc" ? "desc" : "asc" };
    });
  }

  const showPager = page !== undefined && pages !== undefined && onPageChange !== undefined && pages > 1;

  return (
    <div>
      <div className="table-wrap">
        <table className={`table ${dense ? "table-dense" : ""}`}>
          <thead>
            <tr>
              {columns.map((col, i) => (
                <th
                  key={i}
                  style={{
                    width: col.width,
                    textAlign: col.align || "left",
                    cursor: col.sortKey ? "pointer" : undefined,
                    userSelect: col.sortKey ? "none" : undefined,
                  }}
                  onClick={() => toggleSort(col)}
                >
                  {col.header}
                  {col.sortKey && sort?.key === col.sortKey ? (sort.dir === "asc" ? " ▲" : " ▼") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="table-empty">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              sortedData.map((row, ri) => (
                <tr key={row._id || ri}>
                  {columns.map((col, ci) => (
                    <td key={ci} style={{ textAlign: col.align || "left" }}>
                      {typeof col.accessor === "function"
                        ? col.accessor(row)
                        : String(row[col.accessor] ?? "")}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showPager && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "var(--sp-3)",
            padding: "var(--sp-4) 0",
          }}
        >
          <Button variant="ghost" size="sm" disabled={page! <= 1} onClick={() => onPageChange!(page! - 1)}>
            ← Anterior
          </Button>
          <span style={{ fontSize: "var(--t-sm)", color: "var(--text-muted)" }}>
            Página {page} de {pages}
          </span>
          <Button variant="ghost" size="sm" disabled={page! >= pages!} onClick={() => onPageChange!(page! + 1)}>
            Siguiente →
          </Button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Verify and commit**

Run: `cd frontend && bunx tsc -b`
Expected: no errors — every existing `<DataTable>` call site (Landing/admin pages) must still typecheck since all new props are optional.

```bash
git add frontend/src/components/AdminStatCard.tsx frontend/src/components/admin/DateRangePicker.tsx frontend/src/components/admin/ExportCsvButton.tsx frontend/src/components/DataTable.tsx
git commit -m "feat(frontend): componentes admin reutilizables (stat card, rango de fechas, export CSV, tabla ordenable/paginada)"
```

---

### Task 15: Recharts, chart components, AdminDashboard + AdminReports rebuild

**Files:**
- Modify: `frontend/package.json`, `frontend/bun.lock` (via `bun add recharts`, Step 1 — not hand-edited)
- Create: `frontend/src/components/admin/charts/palette.ts`
- Create: `frontend/src/components/admin/charts/RevenueAreaChart.tsx`
- Create: `frontend/src/components/admin/charts/BidsBarChart.tsx`
- Create: `frontend/src/components/admin/charts/StatusDonutChart.tsx`
- Modify: `frontend/src/pages/admin/AdminDashboard.tsx`
- Modify: `frontend/src/pages/admin/AdminReports.tsx`

**Interfaces:**
- Consumes: `AdminStatCard`, `DateRangePicker`, `ExportCsvButton` from Task 14; `GET /api/dashboard/analytics?from&to` from Task 7 (`Analytics` shape: `vehiclesByStatus`, `revenueByDay`, `bidsByDay`, `averageTicket`, `adjudicationRate`, `totalRefunded`, `uniqueBuyers`); existing `GET /api/dashboard/summary` and `GET /api/dashboard/reports` (unchanged).
- Produces: `<RevenueAreaChart data={{date,value}[]} />`, `<BidsBarChart data={{date,value}[]} />`, `<StatusDonutChart data={{_id,count}[]} />`.

Acceptance: `bunx tsc -b` compiles clean.

- [ ] **Step 1: Install Recharts**

Run: `cd frontend && bun add recharts`
Expected: `recharts` appears under `dependencies` in `frontend/package.json`.

- [ ] **Step 2: Create the shared palette**

```ts
// frontend/src/components/admin/charts/palette.ts
// Colores hexadecimales literales — un <svg> de Recharts no puede leer
// custom properties de CSS. Estos valores son exactamente los del tema
// oscuro del admin (frontend/src/index.css, bloque .admin-theme).
export const CHART_COLORS = {
  bg: "#0f172a",
  surface: "#1e293b",
  border: "#334155",
  textMuted: "#94a3b8",
  text: "#e2e8f0",
  primary: "#3b82f6",
  accent: "#f2b84b",
  success: "#34d399",
  danger: "#f87171",
} as const;

export const STATUS_COLORS: Record<string, string> = {
  draft: CHART_COLORS.textMuted,
  published: CHART_COLORS.primary,
  active: CHART_COLORS.success,
  closed: CHART_COLORS.danger,
  awarded: CHART_COLORS.accent,
};

export const chartTooltipStyle: React.CSSProperties = {
  background: CHART_COLORS.surface,
  border: `1px solid ${CHART_COLORS.border}`,
  borderRadius: 8,
  fontSize: 12,
  color: CHART_COLORS.text,
};
```

(This file needs `import type React from "react";` at the top for the `React.CSSProperties` reference.)

- [ ] **Step 3: Implement RevenueAreaChart**

```tsx
// frontend/src/components/admin/charts/RevenueAreaChart.tsx
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART_COLORS, chartTooltipStyle } from "./palette";

interface Props {
  data: { date: string; value: number }[];
}

export default function RevenueAreaChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART_COLORS.accent} stopOpacity={0.35} />
            <stop offset="100%" stopColor={CHART_COLORS.accent} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.border} vertical={false} />
        <XAxis dataKey="date" stroke={CHART_COLORS.textMuted} fontSize={11} tickLine={false} axisLine={false} />
        <YAxis
          stroke={CHART_COLORS.textMuted}
          fontSize={11}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
        />
        <Tooltip contentStyle={chartTooltipStyle} formatter={(value: number) => [`$${value.toLocaleString()}`, "Ingresos"]} />
        <Area type="monotone" dataKey="value" stroke={CHART_COLORS.accent} strokeWidth={2} fill="url(#revenueFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 4: Implement BidsBarChart**

```tsx
// frontend/src/components/admin/charts/BidsBarChart.tsx
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART_COLORS, chartTooltipStyle } from "./palette";

interface Props {
  data: { date: string; value: number }[];
}

export default function BidsBarChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.border} vertical={false} />
        <XAxis dataKey="date" stroke={CHART_COLORS.textMuted} fontSize={11} tickLine={false} axisLine={false} />
        <YAxis stroke={CHART_COLORS.textMuted} fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip contentStyle={chartTooltipStyle} formatter={(value: number) => [value, "Pujas"]} />
        <Bar dataKey="value" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 5: Implement StatusDonutChart**

```tsx
// frontend/src/components/admin/charts/StatusDonutChart.tsx
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { CHART_COLORS, chartTooltipStyle, STATUS_COLORS } from "./palette";

interface Props {
  data: { _id: string; count: number }[];
}

export default function StatusDonutChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          dataKey="count"
          nameKey="_id"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
          stroke={CHART_COLORS.surface}
        >
          {data.map((entry) => (
            <Cell key={entry._id} fill={STATUS_COLORS[entry._id] ?? CHART_COLORS.textMuted} />
          ))}
        </Pie>
        <Tooltip contentStyle={chartTooltipStyle} />
      </PieChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 6: Rebuild AdminDashboard**

Replace the full contents of `frontend/src/pages/admin/AdminDashboard.tsx` with:

```tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useApi } from "../../hooks/useApi";
import Card from "../../components/Card";
import Button from "../../components/Button";
import DataTable from "../../components/DataTable";
import StatusBadge from "../../components/StatusBadge";
import PageHeader from "../../components/PageHeader";
import LoadingState from "../../components/LoadingState";
import AdminStatCard from "../../components/AdminStatCard";
import DateRangePicker from "../../components/admin/DateRangePicker";
import RevenueAreaChart from "../../components/admin/charts/RevenueAreaChart";
import BidsBarChart from "../../components/admin/charts/BidsBarChart";
import type { DashboardSummary } from "../../types";

interface RecentVehicle {
  _id: string;
  title: string;
  brand: string;
  model: string;
  status: string;
  currentPrice: number;
  createdAt: string;
}

interface TopBid {
  _id: string;
  amount: number;
  vehicleId: { title: string; brand: string } | null;
  userId: { name: string; email: string } | null;
  createdAt: string;
}

interface Analytics {
  revenueByDay: { date: string; value: number }[];
  bidsByDay: { date: string; value: number }[];
  averageTicket: number;
  adjudicationRate: number;
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export default function AdminDashboard() {
  const api = useApi();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [recentVehicles, setRecentVehicles] = useState<RecentVehicle[]>([]);
  const [topBids, setTopBids] = useState<TopBid[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState({ from: isoDaysAgo(30), to: isoDaysAgo(0) });

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ from: range.from, to: range.to });
    Promise.all([
      api.get("/api/dashboard/summary"),
      api.get("/api/dashboard/reports"),
      api.get(`/api/dashboard/analytics?${params}`),
    ])
      .then(([sumRes, repRes, anaRes]) => {
        setSummary(sumRes.data);
        setRecentVehicles(repRes.data.recentVehicles);
        setTopBids(repRes.data.topBids);
        setAnalytics(anaRes.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [range.from, range.to]);

  if (loading && !summary) return <LoadingState message="Cargando dashboard..." />;

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Panel administrativo"
        title="Dashboard"
        subtitle="Resumen general del sistema y métricas en tiempo real"
        actions={<DateRangePicker from={range.from} to={range.to} onChange={setRange} />}
      />

      {summary && (
        <div className="kpi-row" style={{ marginBottom: "var(--sp-5)" }}>
          <AdminStatCard label="Vehículos totales" value={summary.totalVehicles} />
          <AdminStatCard label="Subastas activas" value={summary.activeAuctions} />
          <AdminStatCard label="Adjudicados" value={summary.awardedVehicles} />
          <AdminStatCard label="Total pujas" value={summary.totalBids} />
          <AdminStatCard label="Usuarios" value={summary.totalUsers} />
          <AdminStatCard label="Recaudado" value={`$${summary.totalRevenue.toLocaleString()}`} />
        </div>
      )}

      {analytics && (
        <div className="kpi-row" style={{ marginBottom: "var(--sp-6)" }}>
          <AdminStatCard label="Ticket promedio" value={`$${Math.round(analytics.averageTicket).toLocaleString()}`} hint="En el rango seleccionado" />
          <AdminStatCard label="Tasa de adjudicación" value={`${Math.round(analytics.adjudicationRate * 100)}%`} hint="En el rango seleccionado" />
        </div>
      )}

      {analytics && (
        <div className="grid-2" style={{ gap: "var(--sp-4)", marginBottom: "var(--sp-6)" }}>
          <Card padding="lg">
            <h2 style={{ fontSize: "var(--t-md)", marginBottom: "var(--sp-4)" }}>Ingresos por día</h2>
            <RevenueAreaChart data={analytics.revenueByDay} />
          </Card>
          <Card padding="lg">
            <h2 style={{ fontSize: "var(--t-md)", marginBottom: "var(--sp-4)" }}>Pujas por día</h2>
            <BidsBarChart data={analytics.bidsByDay} />
          </Card>
        </div>
      )}

      <div className="grid-2" style={{ gap: "var(--sp-4)" }}>
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--sp-4)" }}>
            <h2 style={{ fontSize: "var(--t-md)", color: "var(--text)" }}>Vehículos recientes</h2>
            <Link to="/admin/vehicles">
              <Button variant="ghost" size="sm">Ver todos →</Button>
            </Link>
          </div>
          <DataTable
            dense
            columns={[
              { header: "Título", accessor: (v) => (
                <span style={{ fontWeight: 600, color: "var(--text)" }}>{v.title}</span>
              ) },
              { header: "Estado", accessor: (v) => <StatusBadge status={v.status} /> },
              { header: "Precio", align: "right", accessor: (v) => (
                <span className="mono">${v.currentPrice.toLocaleString()}</span>
              ) },
            ]}
            data={recentVehicles}
            emptyMessage="Sin vehículos"
          />
        </Card>

        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--sp-4)" }}>
            <h2 style={{ fontSize: "var(--t-md)", color: "var(--text)" }}>Top pujas</h2>
            <Link to="/admin/bids">
              <Button variant="ghost" size="sm">Ver todas →</Button>
            </Link>
          </div>
          <DataTable
            dense
            columns={[
              { header: "Monto", accessor: (b) => (
                <span className="mono">${b.amount.toLocaleString()}</span>
              ) },
              { header: "Vehículo", accessor: (b) => b.vehicleId?.title || "—" },
              { header: "Usuario", accessor: (b) => (
                <span style={{ color: "var(--text-muted)", fontSize: "var(--t-xs)" }}>
                  {b.userId?.name || "—"}
                </span>
              ) },
            ]}
            data={topBids}
            emptyMessage="Sin pujas"
          />
        </Card>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Rebuild AdminReports**

Replace the full contents of `frontend/src/pages/admin/AdminReports.tsx` with:

```tsx
import { useEffect, useState } from "react";
import { useApi } from "../../hooks/useApi";
import Card from "../../components/Card";
import PageHeader from "../../components/PageHeader";
import LoadingState from "../../components/LoadingState";
import AdminStatCard from "../../components/AdminStatCard";
import DateRangePicker from "../../components/admin/DateRangePicker";
import StatusDonutChart from "../../components/admin/charts/StatusDonutChart";
import ExportCsvButton from "../../components/admin/ExportCsvButton";

interface StatusGroup {
  _id: string;
  count: number;
}

interface Analytics {
  vehiclesByStatus: StatusGroup[];
  averageTicket: number;
  adjudicationRate: number;
  totalRefunded: number;
  uniqueBuyers: number;
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export default function AdminReports() {
  const api = useApi();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState({ from: isoDaysAgo(30), to: isoDaysAgo(0) });

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ from: range.from, to: range.to });
    api
      .get(`/api/dashboard/analytics?${params}`)
      .then((r) => setAnalytics(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [range.from, range.to]);

  const vehiclesByStatus = analytics?.vehiclesByStatus ?? [];
  const total = vehiclesByStatus.reduce((s, g) => s + g.count, 0);

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Análisis"
        title="Reportes"
        subtitle="Distribución del inventario y métricas de negocio"
        actions={<DateRangePicker from={range.from} to={range.to} onChange={setRange} />}
      />

      {loading && !analytics ? (
        <LoadingState />
      ) : (
        <>
          <div className="kpi-row" style={{ marginBottom: "var(--sp-5)" }}>
            <AdminStatCard label="Inventario en el rango" value={total} />
            <AdminStatCard label="Ticket promedio" value={`$${Math.round(analytics?.averageTicket ?? 0).toLocaleString()}`} />
            <AdminStatCard label="Tasa de adjudicación" value={`${Math.round((analytics?.adjudicationRate ?? 0) * 100)}%`} />
            <AdminStatCard label="Compradores únicos" value={analytics?.uniqueBuyers ?? 0} />
            <AdminStatCard label="Reembolsado" value={`$${(analytics?.totalRefunded ?? 0).toLocaleString()}`} />
          </div>

          <Card padding="lg">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "var(--sp-5)" }}>
              <div>
                <h2 style={{ fontSize: "var(--t-md)", color: "var(--text)" }}>Vehículos por estado</h2>
                <p style={{ fontSize: "var(--t-sm)", color: "var(--text-muted)", marginTop: 4 }}>
                  Distribución en el rango seleccionado ({total} totales)
                </p>
              </div>
              <ExportCsvButton
                data={vehiclesByStatus}
                filename="vehiculos-por-estado"
                columns={[
                  { header: "Estado", accessor: (g) => g._id },
                  { header: "Cantidad", accessor: (g) => g.count },
                ]}
              />
            </div>

            {vehiclesByStatus.length === 0 ? (
              <p style={{ color: "var(--text-soft)", textAlign: "center", padding: "var(--sp-5)" }}>
                Sin datos disponibles
              </p>
            ) : (
              <StatusDonutChart data={vehiclesByStatus} />
            )}
          </Card>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 8: Verify and commit**

Run: `cd frontend && bunx tsc -b`
Expected: no errors.

```bash
git add frontend/package.json frontend/bun.lock frontend/src/components/admin/charts frontend/src/pages/admin/AdminDashboard.tsx frontend/src/pages/admin/AdminReports.tsx
git commit -m "feat(frontend): analítica elaborada del backoffice con Recharts (ingresos, pujas, distribución)"
```

---

### Task 16: AdminUsers page

**Files:**
- Create: `frontend/src/pages/admin/AdminUsers.tsx`

**Interfaces:**
- Consumes: `DataTable` (sortable/paginated), `ExportCsvButton` from Task 14; `GET /api/users?q&role&page&limit` and `PATCH /api/users/:id/role` from Task 8 / pre-existing.
- Produces: nothing consumed by other tasks — wired into routing in Task 18.

Acceptance: `bunx tsc -b` compiles clean.

- [ ] **Step 1: Implement AdminUsers**

```tsx
// frontend/src/pages/admin/AdminUsers.tsx
import { useEffect, useState } from "react";
import { useApi } from "../../hooks/useApi";
import Card from "../../components/Card";
import Button from "../../components/Button";
import Input from "../../components/Input";
import Select from "../../components/Select";
import DataTable from "../../components/DataTable";
import PageHeader from "../../components/PageHeader";
import LoadingState from "../../components/LoadingState";
import ExportCsvButton from "../../components/admin/ExportCsvButton";
import type { User } from "../../types";

interface AdminUser extends User {
  bidCount: number;
}

const ROLE_OPTIONS = [
  { value: "", label: "Todos los roles" },
  { value: "customer", label: "Ciudadano" },
  { value: "admin", label: "Administrador" },
];

export default function AdminUsers() {
  const api = useApi();
  const [items, setItems] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [pendingChange, setPendingChange] = useState<{ user: AdminUser; role: "customer" | "admin" } | null>(null);

  function load() {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (q.trim()) params.set("q", q.trim());
    if (role) params.set("role", role);
    api
      .get(`/api/users?${params}`)
      .then((r) => {
        setItems(r.data.items);
        setTotal(r.data.total);
        setPages(r.data.pages);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const timer = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(timer);
  }, [q, role, page]);

  async function confirmRoleChange() {
    if (!pendingChange) return;
    await api.patch(`/api/users/${pendingChange.user._id}/role`, { role: pendingChange.role });
    setPendingChange(null);
    load();
  }

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Gestión"
        title="Usuarios"
        subtitle={`${total} usuarios registrados`}
        actions={
          <ExportCsvButton
            data={items}
            filename="usuarios"
            columns={[
              { header: "Nombre", accessor: (u) => u.name },
              { header: "Email", accessor: (u) => u.email },
              { header: "Rol", accessor: (u) => u.role },
              { header: "Pujas", accessor: (u) => u.bidCount },
            ]}
          />
        }
      />

      <Card padding="md" style={{ marginBottom: "var(--sp-4)", display: "flex", gap: "var(--sp-3)" }}>
        <div style={{ flex: 1 }}>
          <Input placeholder="Buscar por nombre o email..." value={q} onChange={(e) => { setPage(1); setQ(e.target.value); }} />
        </div>
        <div style={{ width: 220 }}>
          <Select options={ROLE_OPTIONS} value={role} onChange={(e) => { setPage(1); setRole(e.target.value); }} />
        </div>
      </Card>

      <Card padding="none">
        {loading && items.length === 0 ? (
          <LoadingState />
        ) : (
          <DataTable<AdminUser>
            columns={[
              { header: "Nombre", sortKey: "name", accessor: (u) => (
                <span style={{ fontWeight: 600, color: "var(--text)" }}>{u.name}</span>
              ) },
              { header: "Email", sortKey: "email", accessor: (u) => (
                <span style={{ color: "var(--text-muted)", fontSize: "var(--t-xs)" }}>{u.email}</span>
              ) },
              { header: "Pujas", align: "right", sortKey: "bidCount", sortValue: (u) => u.bidCount, accessor: (u) => (
                <span className="mono">{u.bidCount}</span>
              ) },
              {
                header: "Rol",
                accessor: (u) => (
                  <select
                    className="select"
                    value={u.role}
                    onChange={(e) => setPendingChange({ user: u, role: e.target.value as "customer" | "admin" })}
                    style={{ width: 160 }}
                  >
                    <option value="customer">Ciudadano</option>
                    <option value="admin">Administrador</option>
                  </select>
                ),
              },
            ]}
            data={items}
            emptyMessage="Sin usuarios que coincidan con el filtro"
            page={page}
            pages={pages}
            onPageChange={setPage}
          />
        )}
      </Card>

      {pendingChange && (
        <div
          onClick={() => setPendingChange(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "var(--sp-4)",
          }}
        >
          <Card
            variant="elevated"
            padding="lg"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 420, width: "100%", textAlign: "center" }}
          >
            <h3 style={{ fontSize: "var(--t-lg)", color: "var(--text)", marginBottom: "var(--sp-2)" }}>
              ¿Cambiar rol de {pendingChange.user.name}?
            </h3>
            <p style={{ color: "var(--text-muted)", fontSize: "var(--t-sm)", marginBottom: "var(--sp-5)" }}>
              Pasará de <strong>{pendingChange.user.role}</strong> a <strong>{pendingChange.role}</strong>. Esta acción queda registrada en auditoría.
            </p>
            <div style={{ display: "flex", gap: "var(--sp-2)", justifyContent: "center" }}>
              <Button variant="ghost" onClick={() => setPendingChange(null)}>Cancelar</Button>
              <Button variant="primary" onClick={confirmRoleChange}>Confirmar</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify and commit**

Run: `cd frontend && bunx tsc -b`
Expected: no errors.

```bash
git add frontend/src/pages/admin/AdminUsers.tsx
git commit -m "feat(frontend): página de gestión de usuarios en el backoffice"
```

---

### Task 17: AdminOrders page (payments + refund action)

**Files:**
- Create: `frontend/src/pages/admin/AdminOrders.tsx`

**Interfaces:**
- Consumes: `DataTable`, `DateRangePicker`, `ExportCsvButton` from Task 14; `GET /api/payments?status&from&to&page&limit` from Task 8; `POST /api/payments/:id/refund` (pre-existing).
- Produces: nothing consumed by other tasks — wired into routing in Task 18.

Acceptance: `bunx tsc -b` compiles clean.

- [ ] **Step 1: Implement AdminOrders**

```tsx
// frontend/src/pages/admin/AdminOrders.tsx
import { useEffect, useState } from "react";
import { useApi } from "../../hooks/useApi";
import Card from "../../components/Card";
import Button from "../../components/Button";
import Select from "../../components/Select";
import DataTable from "../../components/DataTable";
import StatusBadge from "../../components/StatusBadge";
import PageHeader from "../../components/PageHeader";
import LoadingState from "../../components/LoadingState";
import DateRangePicker from "../../components/admin/DateRangePicker";
import ExportCsvButton from "../../components/admin/ExportCsvButton";

interface AdminPayment {
  _id: string;
  amount: number;
  status: "pending" | "paid" | "cancelled" | "refunded";
  createdAt: string;
  userId: { name: string; email: string } | null;
  vehicleId: { title: string; brand: string; model: string } | null;
}

const STATUS_OPTIONS = [
  { value: "", label: "Todos los estados" },
  { value: "pending", label: "Pendiente" },
  { value: "paid", label: "Pagado" },
  { value: "refunded", label: "Reembolsado" },
  { value: "cancelled", label: "Cancelado" },
];

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export default function AdminOrders() {
  const api = useApi();
  const [items, setItems] = useState<AdminPayment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [status, setStatus] = useState("");
  const [range, setRange] = useState({ from: "", to: "" });
  const [loading, setLoading] = useState(true);
  const [pendingRefund, setPendingRefund] = useState<AdminPayment | null>(null);
  const [refunding, setRefunding] = useState(false);

  function load() {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (status) params.set("status", status);
    if (range.from) params.set("from", range.from);
    if (range.to) params.set("to", range.to);
    api
      .get(`/api/payments?${params}`)
      .then((r) => {
        setItems(r.data.items);
        setTotal(r.data.total);
        setPages(r.data.pages);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(load, [status, range.from, range.to, page]);

  async function confirmRefund() {
    if (!pendingRefund) return;
    setRefunding(true);
    try {
      await api.post(`/api/payments/${pendingRefund._id}/refund`);
      setPendingRefund(null);
      load();
    } finally {
      setRefunding(false);
    }
  }

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Gestión"
        title="Órdenes y pagos"
        subtitle={`${total} pagos registrados`}
        actions={<DateRangePicker from={range.from} to={range.to} onChange={setRange} />}
      />

      <Card padding="md" style={{ marginBottom: "var(--sp-4)", display: "flex", justifyContent: "space-between", gap: "var(--sp-3)" }}>
        <div style={{ width: 220 }}>
          <Select options={STATUS_OPTIONS} value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }} />
        </div>
        <ExportCsvButton
          data={items}
          filename="pagos"
          columns={[
            { header: "Comprador", accessor: (p) => p.userId?.email ?? "—" },
            { header: "Vehículo", accessor: (p) => p.vehicleId?.title ?? "—" },
            { header: "Monto", accessor: (p) => p.amount },
            { header: "Estado", accessor: (p) => p.status },
            { header: "Fecha", accessor: (p) => new Date(p.createdAt).toISOString() },
          ]}
        />
      </Card>

      <Card padding="none">
        {loading && items.length === 0 ? (
          <LoadingState />
        ) : (
          <DataTable<AdminPayment>
            columns={[
              { header: "Comprador", accessor: (p) => (
                <div>
                  <p style={{ fontWeight: 600, color: "var(--text)", fontSize: "var(--t-sm)" }}>{p.userId?.name ?? "—"}</p>
                  <p style={{ color: "var(--text-soft)", fontSize: "10.5px" }}>{p.userId?.email ?? ""}</p>
                </div>
              ) },
              { header: "Vehículo", accessor: (p) => p.vehicleId?.title ?? "—" },
              { header: "Monto", align: "right", accessor: (p) => (
                <span className="mono" style={{ fontWeight: 700 }}>${p.amount.toLocaleString()}</span>
              ) },
              { header: "Estado", accessor: (p) => <StatusBadge status={p.status} /> },
              { header: "Fecha", accessor: (p) => (
                <span style={{ color: "var(--text-muted)", fontSize: "var(--t-xs)" }}>
                  {new Date(p.createdAt).toLocaleDateString("es-PA", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              ) },
              {
                header: "",
                align: "right",
                accessor: (p) =>
                  p.status === "paid" ? (
                    <Button variant="danger" size="sm" onClick={() => setPendingRefund(p)}>
                      Reembolsar
                    </Button>
                  ) : null,
              },
            ]}
            data={items}
            emptyMessage="Sin pagos que coincidan con el filtro"
            page={page}
            pages={pages}
            onPageChange={setPage}
          />
        )}
      </Card>

      {pendingRefund && (
        <div
          onClick={() => !refunding && setPendingRefund(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "var(--sp-4)",
          }}
        >
          <Card
            variant="elevated"
            padding="lg"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 420, width: "100%", textAlign: "center" }}
          >
            <h3 style={{ fontSize: "var(--t-lg)", color: "var(--text)", marginBottom: "var(--sp-2)" }}>
              ¿Reembolsar ${pendingRefund.amount.toLocaleString()}?
            </h3>
            <p style={{ color: "var(--text-muted)", fontSize: "var(--t-sm)", marginBottom: "var(--sp-5)" }}>
              Se reembolsará a {pendingRefund.userId?.email ?? "el comprador"} y el vehículo volverá a estado
              cerrado, disponible para re-adjudicar. Se registra en auditoría.
            </p>
            <div style={{ display: "flex", gap: "var(--sp-2)", justifyContent: "center" }}>
              <Button variant="ghost" onClick={() => setPendingRefund(null)} disabled={refunding}>Cancelar</Button>
              <Button variant="danger" onClick={confirmRefund} disabled={refunding}>
                {refunding ? "Reembolsando..." : "Confirmar reembolso"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify and commit**

Run: `cd frontend && bunx tsc -b`
Expected: no errors.

```bash
git add frontend/src/pages/admin/AdminOrders.tsx
git commit -m "feat(frontend): página de órdenes/pagos con reembolso en el backoffice"
```

---

### Task 18: AdminAudit page + wire all new admin routes and sidebar nav

**Files:**
- Create: `frontend/src/pages/admin/AdminAudit.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/layouts/AdminLayout.tsx`

**Interfaces:**
- Consumes: `DataTable`, `ExportCsvButton` from Task 14; `GET /api/audit?resource&page&limit` (pre-existing, `audit:read` permission already granted to `admin`).
- Produces: route `/admin/audit`; sidebar entries for Users/Orders/Audit; this is the final task — after it, all 18 tasks' UI is reachable.

Acceptance: `bunx tsc -b` compiles clean; `/admin` sidebar shows Dashboard, Vehículos, Pujas, Usuarios, Órdenes under "Gestión" and Reportes, Auditoría under "Análisis".

- [ ] **Step 1: Implement AdminAudit**

```tsx
// frontend/src/pages/admin/AdminAudit.tsx
import { useEffect, useState } from "react";
import { useApi } from "../../hooks/useApi";
import Card from "../../components/Card";
import Select from "../../components/Select";
import DataTable from "../../components/DataTable";
import PageHeader from "../../components/PageHeader";
import LoadingState from "../../components/LoadingState";
import ExportCsvButton from "../../components/admin/ExportCsvButton";

interface AuditEntry {
  _id: string;
  actor?: { name: string; email: string; role: string } | null;
  actorEmail?: string;
  action: string;
  resource: string;
  resourceId?: string;
  before?: unknown;
  after?: unknown;
  source: "api" | "mcp" | "job";
  createdAt: string;
}

const RESOURCE_OPTIONS = [
  { value: "", label: "Todos los recursos" },
  { value: "vehicle", label: "Vehículo" },
  { value: "payment", label: "Pago" },
  { value: "user", label: "Usuario" },
];

function summarize(value: unknown): string {
  if (value === undefined || value === null) return "—";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export default function AdminAudit() {
  const api = useApi();
  const [items, setItems] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [resource, setResource] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "30" });
    if (resource) params.set("resource", resource);
    api
      .get(`/api/audit?${params}`)
      .then((r) => {
        setItems(r.data.items);
        setTotal(r.data.total);
        setPages(r.data.pages);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [resource, page]);

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Análisis"
        title="Auditoría"
        subtitle={`${total} acciones registradas — registro de solo-anexado`}
        actions={
          <ExportCsvButton
            data={items}
            filename="auditoria"
            columns={[
              { header: "Fecha", accessor: (a) => new Date(a.createdAt).toISOString() },
              { header: "Actor", accessor: (a) => a.actor?.email ?? a.actorEmail ?? "sistema" },
              { header: "Acción", accessor: (a) => a.action },
              { header: "Recurso", accessor: (a) => `${a.resource}${a.resourceId ? `:${a.resourceId}` : ""}` },
              { header: "Origen", accessor: (a) => a.source },
            ]}
          />
        }
      />

      <Card padding="md" style={{ marginBottom: "var(--sp-4)", width: 260 }}>
        <Select options={RESOURCE_OPTIONS} value={resource} onChange={(e) => { setPage(1); setResource(e.target.value); }} />
      </Card>

      <Card padding="none">
        {loading && items.length === 0 ? (
          <LoadingState />
        ) : (
          <DataTable<AuditEntry>
            dense
            columns={[
              { header: "Fecha", accessor: (a) => (
                <span style={{ color: "var(--text-muted)", fontSize: "var(--t-xs)" }}>
                  {new Date(a.createdAt).toLocaleString("es-PA", { dateStyle: "short", timeStyle: "short" })}
                </span>
              ) },
              { header: "Actor", accessor: (a) => a.actor?.email ?? a.actorEmail ?? "sistema" },
              { header: "Acción", accessor: (a) => <span className="mono" style={{ fontSize: "var(--t-xs)" }}>{a.action}</span> },
              { header: "Recurso", accessor: (a) => `${a.resource}${a.resourceId ? ` · ${a.resourceId.slice(-6)}` : ""}` },
              {
                header: "Antes → Después",
                accessor: (a) => (
                  <span className="mono" style={{ fontSize: "10.5px", color: "var(--text-soft)" }}>
                    {summarize(a.before)} → {summarize(a.after)}
                  </span>
                ),
              },
              { header: "Origen", accessor: (a) => <span className="badge badge-draft">{a.source}</span> },
            ]}
            data={items}
            emptyMessage="Sin acciones registradas"
            page={page}
            pages={pages}
            onPageChange={setPage}
          />
        )}
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Wire the three routes in App.tsx**

In `frontend/src/App.tsx`, add the imports next to the other admin page imports:

```tsx
import AdminUsers from "./pages/admin/AdminUsers";
import AdminOrders from "./pages/admin/AdminOrders";
import AdminAudit from "./pages/admin/AdminAudit";
```

and add three routes inside the `/admin` block, right after `<Route path="reports" element={<AdminReports />} />`:

```tsx
          <Route path="users" element={<AdminUsers />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="audit" element={<AdminAudit />} />
```

- [ ] **Step 3: Add the sidebar entries**

In `frontend/src/layouts/AdminLayout.tsx`, replace:

```tsx
const navGroups = [
  {
    label: "Gestión",
    items: [
      { to: "/admin", label: "Dashboard", icon: "▤", end: true },
      { to: "/admin/vehicles", label: "Vehículos", icon: "▦", end: false },
      { to: "/admin/bids", label: "Pujas", icon: "◈", end: false },
    ],
  },
  {
    label: "Análisis",
    items: [{ to: "/admin/reports", label: "Reportes", icon: "▣", end: false }],
  },
];
```

with:

```tsx
const navGroups = [
  {
    label: "Gestión",
    items: [
      { to: "/admin", label: "Dashboard", icon: "▤", end: true },
      { to: "/admin/vehicles", label: "Vehículos", icon: "▦", end: false },
      { to: "/admin/bids", label: "Pujas", icon: "◈", end: false },
      { to: "/admin/users", label: "Usuarios", icon: "☺", end: false },
      { to: "/admin/orders", label: "Órdenes", icon: "$", end: false },
    ],
  },
  {
    label: "Análisis",
    items: [
      { to: "/admin/reports", label: "Reportes", icon: "▣", end: false },
      { to: "/admin/audit", label: "Auditoría", icon: "⎘", end: false },
    ],
  },
];
```

- [ ] **Step 4: Verify and commit**

Run: `cd frontend && bunx tsc -b`
Expected: no errors — this is the last frontend task, so also do a final full-repo check per the Verification section below before considering the plan complete.

```bash
git add frontend/src/pages/admin/AdminAudit.tsx frontend/src/App.tsx frontend/src/layouts/AdminLayout.tsx
git commit -m "feat(frontend): página de auditoría y navegación completa del backoffice"
```

---

## Verification (end-to-end, after Task 18)

1. **Backend:** `cd backend && bun test && bun run typecheck` — all tests pass (baseline 146 + every test file added in Tasks 1-8), zero type errors.
2. **Frontend:** `cd frontend && bunx tsc -b && bun run build` — compiles and builds with zero errors.
3. **Manual client flow** (run `bun run dev` in both `backend/` and `frontend/`, two browser sessions with different Clerk users):
   - User A bids on a vehicle; User B outbids them → User A sees the bell badge increment and an "outbid" entry in `/notifications`.
   - User A saves a vehicle to their watchlist (heart icon on the card or detail page) → it appears in `/watchlist`.
   - User A turns off the "Puja superada" toggle in `/account` → a subsequent outbid produces no new notification for A.
   - An admin closes the auction with User B's bid winning → User B gets a "won" notification and can pay; after paying, User B gets "payment_confirmed" and can open `/receipt/:paymentId` and print it.
4. **Manual backoffice flow:**
   - Visit `/admin` — background is dark slate (`#0f172a`), clearly different from the white public site; KPIs, revenue/bids charts, and the date range picker all render with real data.
   - `/admin/reports` shows the status donut chart and CSV export.
   - `/admin/users` — search, filter by role, change a role with the confirm modal (verify the change lands in `/admin/audit`).
   - `/admin/orders` — filter by status/date, refund a paid order (verify the buyer receives a "refunded" notification and the entry appears in `/admin/audit`).
   - `/admin/audit` — filter by resource, confirm before/after values render, CSV export works.
5. If a live check is impractical in this environment, at minimum confirm both `bun test`/`tsc -b` gates are green and do a visual read of the diff for the admin theme (Task 9) and the four new admin pages (Tasks 15-18) against the CSS variables defined in `frontend/src/index.css`.


import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { setupTestDB } from "../test/db";
import { createUser } from "../test/factories";
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

// Igual que lib/mailer.test.ts: se prueba a través de la frontera real
// (globalThis.fetch) en vez de mock.module-ear sendEmail. mock.module
// reemplaza el módulo para TODO el proceso de "bun test" — si este archivo
// mockeara "../lib/mailer", lib/mailer.test.ts (que prueba la implementación
// REAL) quedaría contaminado por ese reemplazo global según el orden en que
// Bun cargue los archivos, produciendo fallos dependientes del orden.
const originalFetch = globalThis.fetch;
const originalKey = process.env.RESEND_API_KEY;
let fetchMock: ReturnType<typeof mock>;

beforeEach(() => {
  process.env.RESEND_API_KEY = "re_test_notifications";
  fetchMock = mock(async () => new Response("{}", { status: 200 }));
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = originalKey;
});

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
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("respeta notificationPrefs desactivadas: no crea ni envía", async () => {
    const user = await createUser({
      notificationPrefs: { outbid: false, won: true, payment: true, watchClosing: true },
    });

    await notify({ userId: user._id, type: "outbid", title: "Te superaron", body: "..." });

    expect(await Notification.countDocuments({ userId: user._id })).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("payment_confirmed y refunded comparten la preferencia 'payment'", async () => {
    const user = await createUser({
      notificationPrefs: { outbid: true, won: true, payment: false, watchClosing: true },
    });

    await notify({ userId: user._id, type: "payment_confirmed", title: "Pago", body: "..." });
    await notify({ userId: user._id, type: "refunded", title: "Reembolso", body: "..." });

    expect(await Notification.countDocuments({ userId: user._id })).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
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

import "./mocks/clerk";
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

import "./mocks/clerk";
import "./mocks/stripe";
import { describe, expect, test } from "bun:test";
import { createApp } from "../app";
import { AuditLog } from "../models/AuditLog";
import { Notification } from "../models/Notification";
import { User } from "../models/User";
import { setupTestDB } from "./db";
import { markSessionPaid } from "./mocks/stripe";
import { authHeader, createBid, createUser, createVehicle } from "./factories";

setupTestDB();
const app = createApp();

describe("ownership (acceso horizontal)", () => {
  test("un usuario no puede crear checkout sobre la puja de otro (403)", async () => {
    const [ana, bruno] = await Promise.all([createUser(), createUser()]);
    const vehicle = await createVehicle();
    const bidDeAna = await createBid(vehicle, ana!, { amount: 12_000, status: "winner" });

    const res = await app.request("/api/payments/create-checkout-session", {
      method: "POST",
      headers: authHeader(bruno!),
      body: JSON.stringify({ bidId: bidDeAna._id.toString() }),
    });

    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("permisos");
  });

  test("un usuario no puede confirmar/ver el pago de otro vía /success (403)", async () => {
    const [ana, bruno] = await Promise.all([createUser(), createUser()]);
    const vehicle = await createVehicle();
    const bidDeAna = await createBid(vehicle, ana!, { amount: 12_000, status: "winner" });

    const checkout = await app.request("/api/payments/create-checkout-session", {
      method: "POST",
      headers: authHeader(ana!),
      body: JSON.stringify({ bidId: bidDeAna._id.toString() }),
    });
    expect(checkout.status).toBe(200);

    const sessionId = new URL((await checkout.json() as { url: string }).url).pathname.split("/").pop();
    const paymentSessionId = `cs_test_${sessionId}`;
    markSessionPaid(paymentSessionId);

    const res = await app.request(`/api/payments/success?session_id=${paymentSessionId}`, {
      headers: authHeader(bruno!),
    });
    expect(res.status).toBe(403);
  });

  test("el dueño sí confirma su pago y la puja pasa a paid", async () => {
    const ana = await createUser();
    const vehicle = await createVehicle();
    const bid = await createBid(vehicle, ana, { amount: 12_000, status: "winner" });

    const checkout = await app.request("/api/payments/create-checkout-session", {
      method: "POST",
      headers: authHeader(ana),
      body: JSON.stringify({ bidId: bid._id.toString() }),
    });
    const { url } = (await checkout.json()) as { url: string };
    const sessionId = `cs_test_${url.split("/").pop()}`;
    markSessionPaid(sessionId);

    const res = await app.request(`/api/payments/success?session_id=${sessionId}`, {
      headers: authHeader(ana),
    });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { success: boolean }).success).toBe(true);
  });
});

describe("RBAC en rutas reales", () => {
  test("un customer no puede cambiar roles (403) y un admin sí (con auditoría)", async () => {
    const [admin, customer, objetivo] = await Promise.all([
      createUser({ role: "admin" }),
      createUser(),
      createUser(),
    ]);

    const prohibido = await app.request(`/api/users/${objetivo!._id}/role`, {
      method: "PATCH",
      headers: authHeader(customer!),
      body: JSON.stringify({ role: "admin" }),
    });
    expect(prohibido.status).toBe(403);

    const permitido = await app.request(`/api/users/${objetivo!._id}/role`, {
      method: "PATCH",
      headers: authHeader(admin!),
      body: JSON.stringify({ role: "admin" }),
    });
    expect(permitido.status).toBe(200);

    // HU-27: el cambio de rol queda en el registro de auditoría inmutable
    const entry = await AuditLog.findOne({ action: "user.role.change" });
    expect(entry).not.toBeNull();
    expect(entry!.before).toEqual({ role: "customer" });
    expect(entry!.after).toEqual({ role: "admin" });
    expect(entry!.actor!.toString()).toBe(admin!._id.toString());
  });

  test("la auditoría es de solo-anexado también con documentos reales", async () => {
    const admin = await createUser({ role: "admin" });
    const vehicle = await createVehicle();

    await app.request(`/api/vehicles/${vehicle._id}/status`, {
      method: "PATCH",
      headers: authHeader(admin),
      body: JSON.stringify({ status: "closed" }),
    });

    const entry = await AuditLog.findOne({ action: "vehicle.status.change" });
    expect(entry).not.toBeNull();
    expect(AuditLog.deleteMany({}).exec()).rejects.toThrow(/inmutable/);
    entry!.action = "manipulada";
    expect(entry!.save()).rejects.toThrow(/inmutable/);
  });

  test("GET /api/audit responde para admin y 403 para customer", async () => {
    const [admin, customer] = await Promise.all([createUser({ role: "admin" }), createUser()]);
    expect((await app.request("/api/audit", { headers: authHeader(customer!) })).status).toBe(403);
    expect((await app.request("/api/audit", { headers: authHeader(admin!) })).status).toBe(200);
  });
});

describe("baneo de usuarios", () => {
  test("un customer no puede banear (403) y un admin sí, con auditoría y notificación", async () => {
    const [admin, customer, objetivo] = await Promise.all([
      createUser({ role: "admin" }),
      createUser(),
      createUser(),
    ]);

    const prohibido = await app.request(`/api/users/${objetivo!._id}/ban`, {
      method: "PATCH",
      headers: authHeader(customer!),
      body: JSON.stringify({ banned: true }),
    });
    expect(prohibido.status).toBe(403);

    const permitido = await app.request(`/api/users/${objetivo!._id}/ban`, {
      method: "PATCH",
      headers: authHeader(admin!),
      body: JSON.stringify({ banned: true }),
    });
    expect(permitido.status).toBe(200);
    expect((await User.findById(objetivo!._id))!.banned).toBe(true);

    const entry = await AuditLog.findOne({ action: "user.ban" });
    expect(entry).not.toBeNull();
    expect(entry!.before).toEqual({ banned: false });
    expect(entry!.after).toEqual({ banned: true });

    const notification = await Notification.findOne({ userId: objetivo!._id, type: "banned" });
    expect(notification).not.toBeNull();
    expect(notification!.title).toContain("suspendida");
  });

  test("un admin no puede banearse a sí mismo", async () => {
    const admin = await createUser({ role: "admin" });

    const res = await app.request(`/api/users/${admin._id}/ban`, {
      method: "PATCH",
      headers: authHeader(admin),
      body: JSON.stringify({ banned: true }),
    });
    expect(res.status).toBe(400);
    expect((await User.findById(admin._id))!.banned).toBe(false);
  });

  test("desbanear limpia el flag y no reenvía la notificación de baneo", async () => {
    const [admin, objetivo] = await Promise.all([createUser({ role: "admin" }), createUser({ banned: true })]);

    const res = await app.request(`/api/users/${objetivo._id}/ban`, {
      method: "PATCH",
      headers: authHeader(admin),
      body: JSON.stringify({ banned: false }),
    });
    expect(res.status).toBe(200);
    expect((await User.findById(objetivo._id))!.banned).toBe(false);
    expect(await Notification.countDocuments({ userId: objetivo._id, type: "banned" })).toBe(0);
  });

  test("un usuario baneado recibe 403 en cualquier ruta autenticada (perfil, pujar, pagar)", async () => {
    const baneado = await createUser({ banned: true });
    const vehicle = await createVehicle();

    const me = await app.request("/api/users/me", { headers: authHeader(baneado) });
    expect(me.status).toBe(403);
    expect(((await me.json()) as { error: string }).error).toContain("suspendida");

    const bid = await app.request(`/api/bids/vehicle/${vehicle._id}`, {
      method: "POST",
      headers: authHeader(baneado),
      body: JSON.stringify({ amount: vehicle.currentPrice + 1000 }),
    });
    expect(bid.status).toBe(403);

    const checkout = await app.request("/api/payments/create-checkout-session", {
      method: "POST",
      headers: authHeader(baneado),
      body: JSON.stringify({ bidId: "000000000000000000000000" }),
    });
    expect(checkout.status).toBe(403);
  });
});

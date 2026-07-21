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

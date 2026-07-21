import "./mocks/clerk";
import "./mocks/stripe";
import { createHmac } from "node:crypto";
import { beforeAll, describe, expect, test } from "bun:test";
import { createApp } from "../app";
import { Bid } from "../models/Bid";
import { Payment } from "../models/Payment";
import { Vehicle } from "../models/Vehicle";
import { setupTestDB } from "./db";
import { authHeader, createBid, createUser, createVehicle } from "./factories";

setupTestDB();
const app = createApp();

const WEBHOOK_SECRET = "whsec_test_secret";
beforeAll(() => {
  process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
});

// Firma manual con el esquema de Stripe (t=<ts>,v1=HMAC_SHA256(secret, "ts.payload"))
// — generateTestHeaderString es síncrono y el proveedor de crypto del build
// ESM solo soporta async.
function signPayload(payload: string, secret: string) {
  const t = Math.floor(Date.now() / 1000);
  const v1 = createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
  return `t=${t},v1=${v1}`;
}

function signedRequest(payload: string, secret = WEBHOOK_SECRET) {
  const signature = signPayload(payload, secret);
  return app.request("/api/payments/webhook", {
    method: "POST",
    headers: { "stripe-signature": signature, "Content-Type": "application/json" },
    body: payload,
  });
}

function checkoutCompletedEvent(sessionId: string) {
  return JSON.stringify({
    id: `evt_${sessionId}`,
    type: "checkout.session.completed",
    data: { object: { id: sessionId, payment_status: "paid" } },
  });
}

async function createPendingPayment() {
  const ana = await createUser();
  const vehicle = await createVehicle();
  const bid = await createBid(vehicle, ana, { amount: 12_000, status: "winner" });

  const checkout = await app.request("/api/payments/create-checkout-session", {
    method: "POST",
    headers: authHeader(ana),
    body: JSON.stringify({ bidId: bid._id.toString() }),
  });
  expect(checkout.status).toBe(200);
  const payment = await Payment.findOne({ bidId: bid._id });
  return { ana, vehicle, bid, payment: payment! };
}

describe("webhook de Stripe (HU-17)", () => {
  test("checkout.session.completed con firma válida confirma pago, puja y vehículo", async () => {
    const { vehicle, bid, payment } = await createPendingPayment();

    const res = await signedRequest(checkoutCompletedEvent(payment.stripeSessionId!));
    expect(res.status).toBe(200);

    expect((await Payment.findById(payment._id))!.status).toBe("paid");
    expect((await Bid.findById(bid._id))!.status).toBe("paid");
    expect((await Vehicle.findById(vehicle._id))!.status).toBe("awarded");
  });

  test("un evento duplicado es idempotente (no repite transiciones)", async () => {
    const { payment } = await createPendingPayment();
    const payload = checkoutCompletedEvent(payment.stripeSessionId!);

    expect((await signedRequest(payload)).status).toBe(200);
    const afterFirst = await Payment.findById(payment._id);
    expect((await signedRequest(payload)).status).toBe(200);
    const afterSecond = await Payment.findById(payment._id);

    expect(afterFirst!.status).toBe("paid");
    expect(afterSecond!.status).toBe("paid");
  });

  test("una firma inválida se rechaza con 401 sin tocar la base", async () => {
    const { payment } = await createPendingPayment();
    const payload = checkoutCompletedEvent(payment.stripeSessionId!);

    const res = await app.request("/api/payments/webhook", {
      method: "POST",
      headers: { "stripe-signature": "t=1,v1=firma_falsa", "Content-Type": "application/json" },
      body: payload,
    });

    expect(res.status).toBe(401);
    expect((await Payment.findById(payment._id))!.status).toBe("pending");
  });

  test("sin cabecera de firma responde 401", async () => {
    const res = await app.request("/api/payments/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    expect(res.status).toBe(401);
  });

  test("otros tipos de evento se reciben (200) sin efectos", async () => {
    const { payment } = await createPendingPayment();
    const payload = JSON.stringify({
      id: "evt_otro",
      type: "payment_intent.created",
      data: { object: { id: "pi_1" } },
    });

    expect((await signedRequest(payload)).status).toBe(200);
    expect((await Payment.findById(payment._id))!.status).toBe("pending");
  });
});

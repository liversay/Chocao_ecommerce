import "./mocks/clerk";
import "./mocks/stripe";
import { beforeEach, describe, expect, test } from "bun:test";
import { createApp } from "../app";
import { AuditLog } from "../models/AuditLog";
import { Bid } from "../models/Bid";
import { Payment } from "../models/Payment";
import { Vehicle } from "../models/Vehicle";
import { setupTestDB } from "./db";
import { markSessionPaid, resetStripeMock, stripeMock } from "./mocks/stripe";
import { authHeader, createBid, createUser, createVehicle } from "./factories";

setupTestDB();
const app = createApp();
beforeEach(() => resetStripeMock());

// Crea un pago COMPLETADO end-to-end: checkout + webhook-like confirm vía /success
async function paidScenario() {
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
  const confirm = await app.request(`/api/payments/success?session_id=${payment.stripeSessionId}`, {
    headers: authHeader(buyer!),
  });
  expect(confirm.status).toBe(200);

  return { admin: admin!, buyer: buyer!, vehicle, bid, payment };
}

describe("reembolsos (HU-19)", () => {
  test("un admin reembolsa: Payment→refunded, Bid→winner, Vehicle→closed + auditoría", async () => {
    const { admin, vehicle, bid, payment } = await paidScenario();

    const res = await app.request(`/api/payments/${payment._id}/refund`, {
      method: "POST",
      headers: authHeader(admin),
    });

    expect(res.status).toBe(200);
    expect((await Payment.findById(payment._id))!.status).toBe("refunded");
    expect((await Bid.findById(bid._id))!.status).toBe("winner");
    expect((await Vehicle.findById(vehicle._id))!.status).toBe("closed");

    // Se creó el refund en Stripe con el payment_intent de la sesión
    expect(stripeMock.refunds.create.mock.calls.length).toBe(1);

    const audit = await AuditLog.findOne({ action: "payment.refund" });
    expect(audit).not.toBeNull();
    expect(audit!.actor!.toString()).toBe(admin._id.toString());
  });

  test("un customer no puede reembolsar (403, requiere payment:refund)", async () => {
    const { buyer, payment } = await paidScenario();
    const res = await app.request(`/api/payments/${payment._id}/refund`, {
      method: "POST",
      headers: authHeader(buyer),
    });
    expect(res.status).toBe(403);
    expect((await Payment.findById(payment._id))!.status).toBe("paid");
  });

  test("un pago no completado no se puede reembolsar (409)", async () => {
    const [admin, buyer] = await Promise.all([createUser({ role: "admin" }), createUser()]);
    const vehicle = await createVehicle();
    const bid = await createBid(vehicle, buyer!, { amount: 12_000, status: "winner" });
    const pending = await Payment.create({
      userId: buyer!._id,
      vehicleId: vehicle._id,
      bidId: bid._id,
      stripeSessionId: "cs_sin_pagar",
      amount: 12_000,
      status: "pending",
    });

    const res = await app.request(`/api/payments/${pending._id}/refund`, {
      method: "POST",
      headers: authHeader(admin!),
    });
    expect(res.status).toBe(409);
  });

  test("un doble reembolso responde 409 (ya no está paid)", async () => {
    const { admin, payment } = await paidScenario();
    const first = await app.request(`/api/payments/${payment._id}/refund`, {
      method: "POST",
      headers: authHeader(admin),
    });
    expect(first.status).toBe(200);

    const second = await app.request(`/api/payments/${payment._id}/refund`, {
      method: "POST",
      headers: authHeader(admin),
    });
    expect(second.status).toBe(409);
    expect(stripeMock.refunds.create.mock.calls.length).toBe(1);
  });
});

import "./mocks/clerk";
import "./mocks/stripe";
import { describe, expect, test } from "bun:test";
import { createApp } from "../app";
import { Adjudicacion } from "../models/Adjudicacion";
import { Payment } from "../models/Payment";
import { adjudicateVehicle } from "../services/auctions";
import { createCheckout } from "../services/payments";
import { setupTestDB } from "./db";
import { authHeader, createBid, createUser, createVehicle } from "./factories";

setupTestDB();
const app = createApp();

// Deja al bid ganador con su Adjudicacion asociada (mismo camino real que el
// cierre de subasta), y opcionalmente vence el plazo de pago para probar el
// gate — adjudicateVehicle siempre computa fechaLimitePago en el futuro, así
// que el vencimiento se simula ajustando el documento después.
async function ganadorConAdjudicacion(overrides: { fechaLimitePagoVencida?: boolean } = {}) {
  const user = await createUser();
  const vehicle = await createVehicle();
  const bid = await createBid(vehicle, user, { amount: 12_000 });
  await adjudicateVehicle(vehicle._id.toString());

  if (overrides.fechaLimitePagoVencida) {
    await Adjudicacion.findOneAndUpdate(
      { vehicleId: vehicle._id },
      { fechaLimitePago: new Date(Date.now() - 1000) }
    );
  }

  return { user, vehicle, bid };
}

describe("plazo legal de pago de la adjudicación (RP-02)", () => {
  test("createCheckout rechaza si venció fechaLimitePago de la adjudicación", async () => {
    const { user, bid } = await ganadorConAdjudicacion({ fechaLimitePagoVencida: true });

    await expect(createCheckout(user, bid._id.toString())).rejects.toThrow(/plazo/i);
    // no debe haber creado ningún Payment tras el rechazo
    expect(await Payment.countDocuments({ bidId: bid._id })).toBe(0);
  });

  test("createCheckout responde 409 vía HTTP cuando venció el plazo", async () => {
    const { user, bid } = await ganadorConAdjudicacion({ fechaLimitePagoVencida: true });

    const res = await app.request("/api/payments/create-checkout-session", {
      method: "POST",
      headers: authHeader(user),
      body: JSON.stringify({ bidId: bid._id.toString() }),
    });

    expect(res.status).toBe(409);
  });

  test("createCheckout permite pagar mientras el plazo sigue vigente", async () => {
    const { user, bid } = await ganadorConAdjudicacion();

    const { url } = await createCheckout(user, bid._id.toString());
    expect(url).toBeTruthy();
  });

  test("createCheckout genera referenciaPago única ligada a vehículo+adjudicatario", async () => {
    const { user, vehicle, bid } = await ganadorConAdjudicacion();

    await createCheckout(user, bid._id.toString());

    const payment = await Payment.findOne({ bidId: bid._id });
    expect(payment?.referenciaPago).toBeTruthy();
    expect(payment!.referenciaPago).toContain(vehicle._id.toString());
    expect(payment!.referenciaPago).toContain(user._id.toString());
  });

  test("dos checkouts de bids distintos generan referenciaPago distintas", async () => {
    const primero = await ganadorConAdjudicacion();
    const segundo = await ganadorConAdjudicacion();

    await createCheckout(primero.user, primero.bid._id.toString());
    await createCheckout(segundo.user, segundo.bid._id.toString());

    const [p1, p2] = await Promise.all([
      Payment.findOne({ bidId: primero.bid._id }),
      Payment.findOne({ bidId: segundo.bid._id }),
    ]);
    expect(p1!.referenciaPago).not.toBe(p2!.referenciaPago);
  });

  test("createCheckout sin Adjudicacion (fixture legacy) no revienta el gate de plazo", async () => {
    // Escenario real de otros tests de pago que crean el bid winner
    // directamente sin pasar por adjudicateVehicle — no debe existir una
    // Adjudicacion para este vehículo.
    const user = await createUser();
    const vehicle = await createVehicle();
    const bid = await createBid(vehicle, user, { amount: 9_000, status: "winner" });
    expect(await Adjudicacion.findOne({ vehicleId: vehicle._id })).toBeNull();

    const { url } = await createCheckout(user, bid._id.toString());
    expect(url).toBeTruthy();
  });
});

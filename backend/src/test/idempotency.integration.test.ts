import "./mocks/clerk";
import "./mocks/stripe";
import { beforeAll, beforeEach, describe, expect, test } from "bun:test";
import mongoose from "mongoose";
import { createApp } from "../app";
import { Payment } from "../models/Payment";
import { runMigrations } from "../../scripts/migrate";
import { setupTestDB } from "./db";
import { resetStripeMock, stripeMock } from "./mocks/stripe";
import { authHeader, createBid, createUser, createVehicle } from "./factories";

setupTestDB();
const app = createApp();

// El mock de Stripe es compartido entre archivos de test: los contadores se
// limpian antes de cada test de este archivo.
beforeEach(() => resetStripeMock());

async function winnerBidWithUser() {
  const user = await createUser();
  const vehicle = await createVehicle();
  const bid = await createBid(vehicle, user, { amount: 12_000, status: "winner" });
  return { user, vehicle, bid };
}

function checkout(user: Awaited<ReturnType<typeof createUser>>, bidId: string) {
  return app.request("/api/payments/create-checkout-session", {
    method: "POST",
    headers: authHeader(user),
    body: JSON.stringify({ bidId }),
  });
}

describe("idempotencia end-to-end en pagos (HU-18)", () => {
  test("dos requests de checkout para el mismo bid reutilizan la misma sesión", async () => {
    const { user, bid } = await winnerBidWithUser();

    const r1 = await checkout(user, bid._id.toString());
    const r2 = await checkout(user, bid._id.toString());
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);

    const { url: url1 } = (await r1.json()) as { url: string };
    const { url: url2 } = (await r2.json()) as { url: string };
    expect(url2).toBe(url1);

    // Una sola sesión creada en Stripe y un solo Payment vivo
    expect(stripeMock.checkout.sessions.create.mock.calls.length).toBe(1);
    expect(await Payment.countDocuments({ bidId: bid._id })).toBe(1);
  });

  test("un bid ya pagado rechaza nuevos checkouts con 409", async () => {
    const { user, bid } = await winnerBidWithUser();
    bid.status = "paid";
    await bid.save();

    const res = await checkout(user, bid._id.toString());
    expect(res.status).toBe(409);
    expect(((await res.json()) as { error: string }).error).toContain("ya fue pagada");
  });

  test("la creación hacia Stripe lleva Idempotency-Key derivada del bid", async () => {
    const { user, bid } = await winnerBidWithUser();
    await checkout(user, bid._id.toString());

    const call = stripeMock.checkout.sessions.create.mock.calls.at(-1) as unknown as [
      unknown,
      { idempotencyKey?: string },
    ];
    expect(call[1]?.idempotencyKey).toBe(`checkout-${bid._id.toString()}-12000`);
  });

  test("la migración 002 impone unicidad de pago vivo por bid en la base", async () => {
    await runMigrations(mongoose.connection);
    const { user, vehicle, bid } = await winnerBidWithUser();

    await Payment.create({
      userId: user._id,
      vehicleId: vehicle._id,
      bidId: bid._id,
      stripeSessionId: "cs_dup_1",
      amount: 12_000,
      status: "pending",
    });

    expect(
      Payment.create({
        userId: user._id,
        vehicleId: vehicle._id,
        bidId: bid._id,
        stripeSessionId: "cs_dup_2",
        amount: 12_000,
        status: "pending",
      })
    ).rejects.toThrow(/duplicate key|E11000/);
  });
});

beforeAll(() => {
  process.env.STRIPE_SUCCESS_URL = "http://localhost:5173/checkout/success";
  process.env.STRIPE_CANCEL_URL = "http://localhost:5173/checkout/cancel";
});

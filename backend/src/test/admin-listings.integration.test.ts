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

import "./mocks/clerk";
import "./mocks/stripe";
import { describe, expect, test } from "bun:test";
import { createApp } from "../app";
import { Bid } from "../models/Bid";
import { Vehicle } from "../models/Vehicle";
import { setupTestDB } from "./db";
import { authHeader, createUser, createVehicle } from "./factories";

setupTestDB();
const app = createApp();

describe("concurrencia en pujas (HU-21)", () => {
  test("N pujas simultáneas no corrompen currentPrice ni dejan más de una activa", async () => {
    const vehicle = await createVehicle({ basePrice: 10_000 });
    const users = await Promise.all(Array.from({ length: 8 }, () => createUser()));
    const amounts = [11_000, 12_000, 13_000, 14_000, 15_000, 16_000, 17_000, 18_000];

    const responses = await Promise.all(
      users.map((user, i) =>
        app.request(`/api/bids/vehicle/${vehicle._id}`, {
          method: "POST",
          headers: authHeader(user),
          body: JSON.stringify({ amount: amounts[i] }),
        })
      )
    );

    const accepted = responses.filter((r) => r.status === 201).length;
    const rejected = responses.filter((r) => r.status === 409 || r.status === 400).length;
    expect(accepted + rejected).toBe(8);
    expect(accepted).toBeGreaterThanOrEqual(1);

    const finalVehicle = await Vehicle.findById(vehicle._id);
    const allBids = await Bid.find({ vehicleId: vehicle._id }).sort({ amount: -1 });
    const activeBids = allBids.filter((b) => b.status === "active");

    // Exactamente una puja activa: la más alta registrada
    expect(activeBids.length).toBe(1);
    expect(activeBids[0]!.amount).toBe(Math.max(...allBids.map((b) => b.amount)));
    // El precio del vehículo coincide con la puja activa (sin corrupción)
    expect(finalVehicle!.currentPrice).toBe(activeBids[0]!.amount);
    // Solo se crearon bids que en su momento superaron el precio (todas ≤ precio final)
    expect(allBids.every((b) => b.amount <= finalVehicle!.currentPrice)).toBe(true);
  });

  test("dos pujas por el MISMO monto: solo una gana, la otra recibe 409", async () => {
    const vehicle = await createVehicle({ basePrice: 10_000 });
    const [ana, bruno] = await Promise.all([createUser(), createUser()]);

    const [r1, r2] = await Promise.all([
      app.request(`/api/bids/vehicle/${vehicle._id}`, {
        method: "POST",
        headers: authHeader(ana!),
        body: JSON.stringify({ amount: 12_000 }),
      }),
      app.request(`/api/bids/vehicle/${vehicle._id}`, {
        method: "POST",
        headers: authHeader(bruno!),
        body: JSON.stringify({ amount: 12_000 }),
      }),
    ]);

    const statuses = [r1.status, r2.status].sort();
    expect(statuses[0]!).toBe(201);
    expect([400, 409]).toContain(statuses[1]!);

    expect(await Bid.countDocuments({ vehicleId: vehicle._id })).toBe(1);
    expect((await Vehicle.findById(vehicle._id))!.currentPrice).toBe(12_000);
  });

  test("el claim rechaza cuando el precio ya avanzó (409 con el precio vigente)", async () => {
    const vehicle = await createVehicle({ basePrice: 10_000, currentPrice: 15_000 });
    const user = await createUser();

    const res = await app.request(`/api/bids/vehicle/${vehicle._id}`, {
      method: "POST",
      headers: authHeader(user),
      body: JSON.stringify({ amount: 12_000 }),
    });

    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toContain("15,000");
  });
});

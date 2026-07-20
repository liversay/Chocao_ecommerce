import "./mocks/clerk";
import "./mocks/stripe";
import { describe, expect, test } from "bun:test";
import { createApp } from "../app";
import { Bid } from "../models/Bid";
import { Vehicle } from "../models/Vehicle";
import { setupTestDB } from "./db";
import { authHeader, createBid, createUser, createVehicle } from "./factories";

setupTestDB();
const app = createApp();

describe("reglas de negocio de pujas", () => {
  test("una puja válida se crea, actualiza currentPrice y marca la previa como outbid", async () => {
    const [ana, bruno] = await Promise.all([createUser(), createUser()]);
    const vehicle = await createVehicle({ basePrice: 10_000 });
    const previa = await createBid(vehicle, ana!, { amount: 11_000 });
    vehicle.currentPrice = 11_000;
    await vehicle.save();

    const res = await app.request(`/api/bids/vehicle/${vehicle._id}`, {
      method: "POST",
      headers: authHeader(bruno!),
      body: JSON.stringify({ amount: 12_500 }),
    });

    expect(res.status).toBe(201);
    const updated = await Vehicle.findById(vehicle._id);
    expect(updated!.currentPrice).toBe(12_500);
    expect((await Bid.findById(previa._id))!.status).toBe("outbid");
  });

  test("una puja menor o igual al precio actual responde 400", async () => {
    const user = await createUser();
    const vehicle = await createVehicle({ basePrice: 10_000 });

    const res = await app.request(`/api/bids/vehicle/${vehicle._id}`, {
      method: "POST",
      headers: authHeader(user),
      body: JSON.stringify({ amount: 10_000 }),
    });

    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toContain("mayor a la oferta actual");
  });

  test("no se puede pujar sobre un vehículo que no está active", async () => {
    const user = await createUser();
    const vehicle = await createVehicle({ status: "published" });

    const res = await app.request(`/api/bids/vehicle/${vehicle._id}`, {
      method: "POST",
      headers: authHeader(user),
      body: JSON.stringify({ amount: 99_999 }),
    });

    expect(res.status).toBe(400);
  });

  test("no se puede pujar en una subasta vencida", async () => {
    const user = await createUser();
    const vehicle = await createVehicle({ auctionEndDate: new Date(Date.now() - 1000) });

    const res = await app.request(`/api/bids/vehicle/${vehicle._id}`, {
      method: "POST",
      headers: authHeader(user),
      body: JSON.stringify({ amount: 99_999 }),
    });

    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toContain("finalizó");
  });

  test("al cerrar la subasta, la puja más alta queda winner y el resto outbid", async () => {
    const [admin, ana, bruno] = await Promise.all([
      createUser({ role: "admin" }),
      createUser(),
      createUser(),
    ]);
    const vehicle = await createVehicle();
    const baja = await createBid(vehicle, ana!, { amount: 11_000, status: "outbid" });
    const alta = await createBid(vehicle, bruno!, { amount: 15_000 });

    const res = await app.request(`/api/vehicles/${vehicle._id}/status`, {
      method: "PATCH",
      headers: authHeader(admin!),
      body: JSON.stringify({ status: "closed" }),
    });

    expect(res.status).toBe(200);
    expect((await Bid.findById(alta._id))!.status).toBe("winner");
    expect((await Bid.findById(baja._id))!.status).toBe("outbid");
  });
});

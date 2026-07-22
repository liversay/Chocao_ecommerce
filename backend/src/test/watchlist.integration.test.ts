import "./mocks/clerk";
import { describe, expect, test } from "bun:test";
import { createApp } from "../app";
import { setupTestDB } from "./db";
import { authHeader, createUser, createVehicle } from "./factories";

setupTestDB();
const app = createApp();

describe("rutas de watchlist", () => {
  test("agregar, listar y quitar un vehículo de mi watchlist", async () => {
    const user = await createUser();
    const vehicle = await createVehicle();

    const addRes = await app.request(`/api/watchlist/${vehicle._id}`, {
      method: "POST",
      headers: authHeader(user),
    });
    expect(addRes.status).toBe(201);

    const listRes = await app.request("/api/watchlist", { headers: authHeader(user) });
    const items = (await listRes.json()) as { vehicleId: { _id: string } }[];
    expect(items).toHaveLength(1);
    expect(items[0]!.vehicleId._id).toBe(vehicle._id.toString());

    const delRes = await app.request(`/api/watchlist/${vehicle._id}`, {
      method: "DELETE",
      headers: authHeader(user),
    });
    expect(delRes.status).toBe(200);

    const listAfter = await app.request("/api/watchlist", { headers: authHeader(user) });
    expect(await listAfter.json()).toHaveLength(0);
  });

  test("agregar dos veces el mismo vehículo es idempotente", async () => {
    const user = await createUser();
    const vehicle = await createVehicle();

    await app.request(`/api/watchlist/${vehicle._id}`, { method: "POST", headers: authHeader(user) });
    const second = await app.request(`/api/watchlist/${vehicle._id}`, {
      method: "POST",
      headers: authHeader(user),
    });
    expect(second.status).toBe(201);

    const listRes = await app.request("/api/watchlist", { headers: authHeader(user) });
    expect(await listRes.json()).toHaveLength(1);
  });

  test("quitar un vehículo que no está en la watchlist es un no-op (200)", async () => {
    const user = await createUser();
    const vehicle = await createVehicle();

    const res = await app.request(`/api/watchlist/${vehicle._id}`, {
      method: "DELETE",
      headers: authHeader(user),
    });
    expect(res.status).toBe(200);
  });
});

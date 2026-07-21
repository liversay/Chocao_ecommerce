import { describe, expect, test } from "bun:test";
import { createApp } from "../app";
import { objectIdSchema } from "./common";
import { placeBidSchema } from "./bids";
import { createVehicleSchema } from "./vehicles";
import { syncUserSchema } from "./users";

describe("schemas", () => {
  test("objectIdSchema acepta un ObjectId y rechaza basura", () => {
    expect(objectIdSchema.safeParse("64b5f0c8a2f4e1d9c3b7a611").success).toBe(true);
    expect(objectIdSchema.safeParse("no-es-un-id").success).toBe(false);
    expect(objectIdSchema.safeParse("' OR 1=1 --").success).toBe(false);
  });

  test("placeBidSchema exige monto numérico positivo", () => {
    expect(placeBidSchema.safeParse({ amount: 15000 }).success).toBe(true);
    expect(placeBidSchema.safeParse({ amount: "15000" }).success).toBe(false);
    expect(placeBidSchema.safeParse({ amount: -5 }).success).toBe(false);
    expect(placeBidSchema.safeParse({}).success).toBe(false);
  });

  test("createVehicleSchema valida campos obligatorios y rangos", () => {
    const valido = {
      title: "Toyota Hilux 2020",
      brand: "Toyota",
      model: "Hilux",
      year: 2020,
      basePrice: 18000,
      images: ["https://res.cloudinary.com/demo/image/upload/v1/hilux.jpg"],
    };
    expect(createVehicleSchema.safeParse(valido).success).toBe(true);
    expect(createVehicleSchema.safeParse({ ...valido, year: 1800 }).success).toBe(false);
    expect(createVehicleSchema.safeParse({ ...valido, basePrice: 0 }).success).toBe(false);
    expect(createVehicleSchema.safeParse({ ...valido, images: Array(7).fill("https://x.com/a.jpg") }).success).toBe(false);
    expect(createVehicleSchema.safeParse({ ...valido, title: undefined }).success).toBe(false);
  });

  test("syncUserSchema exige email válido", () => {
    expect(syncUserSchema.safeParse({ name: "Ana", email: "ana@example.com" }).success).toBe(true);
    expect(syncUserSchema.safeParse({ name: "Ana", email: "no-email" }).success).toBe(false);
  });
});

describe("validación en rutas (endpoints públicos)", () => {
  test("GET /api/vehicles/:id con id inválido responde 400 en español", async () => {
    const res = await createApp().request("/api/vehicles/no-es-objectid");
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("identificador");
  });

  test("GET /api/vehicles?status=malo responde 400", async () => {
    const res = await createApp().request("/api/vehicles?status=malo");
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toContain("Estado inválido");
  });

  test("POST /api/users/sync sin token responde 401", async () => {
    const res = await createApp().request("/api/users/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Ana", email: "ana@example.com" }),
    });
    expect(res.status).toBe(401);
  });

  test("POST /api/users/sync con body inválido responde 400 antes de tocar auth/DB", async () => {
    const res = await createApp().request("/api/users/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "no-email" }),
    });
    expect(res.status).toBe(400);
  });

  test("un payload gigante responde 413", async () => {
    const res = await createApp().request("/api/users/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "x".repeat(2 * 1024 * 1024), email: "a@b.com" }),
    });
    expect(res.status).toBe(413);
  });
});

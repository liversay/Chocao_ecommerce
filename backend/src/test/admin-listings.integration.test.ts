import "./mocks/clerk";
import { describe, expect, test } from "bun:test";
import { createApp } from "../app";
import { addBusinessDays } from "../lib/calendario";
import { Adjudicacion } from "../models/Adjudicacion";
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

  test("un item con Adjudicacion trae adjudicacion.{estado,fechaLimitePago}; sin Adjudicacion trae null", async () => {
    const admin = await createUser({ role: "admin" });
    const buyer = await createUser();

    const vehicleConAdjudicacion = await createVehicle();
    const bidConAdjudicacion = await createBid(vehicleConAdjudicacion, buyer, { amount: 12_000, status: "winner" });
    await Payment.create({
      userId: buyer._id,
      vehicleId: vehicleConAdjudicacion._id,
      bidId: bidConAdjudicacion._id,
      amount: 12_000,
      status: "pending",
    });
    const fechaActo = new Date();
    const fechaLimitePago = addBusinessDays(fechaActo, 5);
    await Adjudicacion.create({
      vehicleId: vehicleConAdjudicacion._id,
      ganadorBidId: bidConAdjudicacion._id,
      fechaActo,
      fechaLimitePago,
      estado: "ADJUDICADA_PENDIENTE_PAGO",
    });

    const vehicleSinAdjudicacion = await createVehicle();
    const bidSinAdjudicacion = await createBid(vehicleSinAdjudicacion, buyer, { amount: 9_000, status: "winner" });
    await Payment.create({
      userId: buyer._id,
      vehicleId: vehicleSinAdjudicacion._id,
      bidId: bidSinAdjudicacion._id,
      amount: 9_000,
      status: "pending",
    });

    const res = await app.request("/api/payments?status=pending", { headers: authHeader(admin) });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      items: { vehicleId: { _id: string }; adjudicacion: { estado: string; fechaLimitePago: string } | null }[];
    };

    const rowCon = body.items.find((i) => i.vehicleId._id === vehicleConAdjudicacion._id.toString())!;
    expect(rowCon.adjudicacion).not.toBeNull();
    expect(rowCon.adjudicacion!.estado).toBe("ADJUDICADA_PENDIENTE_PAGO");
    expect(new Date(rowCon.adjudicacion!.fechaLimitePago).getTime()).toBe(fechaLimitePago.getTime());

    const rowSin = body.items.find((i) => i.vehicleId._id === vehicleSinAdjudicacion._id.toString())!;
    expect(rowSin.adjudicacion).toBeNull();
  });
});

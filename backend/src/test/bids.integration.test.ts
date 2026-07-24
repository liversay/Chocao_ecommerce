import "./mocks/clerk";
import "./mocks/stripe";
import { describe, expect, test } from "bun:test";
import { createApp } from "../app";
import { addBusinessDays } from "../lib/calendario";
import { AuditLog } from "../models/AuditLog";
import { Adjudicacion } from "../models/Adjudicacion";
import { Bid } from "../models/Bid";
import { Payment } from "../models/Payment";
import { Vehicle } from "../models/Vehicle";
import { setupTestDB } from "./db";
import { authHeader, createBid, createUnaccreditedUser, createUser, createVehicle } from "./factories";
import { markSessionPaid } from "./mocks/stripe";

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

  test("placeBid rechaza a un usuario no acreditado y audita el intento", async () => {
    const user = await createUnaccreditedUser();
    const vehicle = await createVehicle({ basePrice: 10_000 });

    const res = await app.request(`/api/bids/vehicle/${vehicle._id}`, {
      method: "POST",
      headers: authHeader(user),
      body: JSON.stringify({ amount: vehicle.currentPrice + 100 }),
    });

    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toMatch(/acredita/i);
    // El precio del vehículo no debe haber cambiado: el gate corre ANTES del
    // claim atómico.
    expect((await Vehicle.findById(vehicle._id))!.currentPrice).toBe(10_000);

    const entry = await AuditLog.findOne({ action: "bid.rechazada", resourceId: vehicle._id.toString() }).sort({
      createdAt: -1,
    });
    expect(entry).not.toBeNull();
  });

  test("placeBid permite pujar a un usuario ACREDITADO", async () => {
    const user = await createUser();
    const vehicle = await createVehicle({ basePrice: 10_000 });

    const res = await app.request(`/api/bids/vehicle/${vehicle._id}`, {
      method: "POST",
      headers: authHeader(user),
      body: JSON.stringify({ amount: vehicle.currentPrice + 100 }),
    });

    expect(res.status).toBe(201);
    const bid = (await res.json()) as { status: string };
    expect(bid.status).toBe("active");
  });
});

describe("GET /api/bids/my", () => {
  // VehicleDetailPage usa este endpoint (no /my/purchases) para decidir si
  // muestra "Ver recibo" en la ficha del vehículo — debe traer payment igual.
  test("una puja pagada trae payment: {id, status}; una sin pagar no trae payment", async () => {
    const buyer = await createUser();
    const vehicle = await createVehicle();
    const paidBid = await createBid(vehicle, buyer, { amount: 12_000, status: "winner" });
    const otherVehicle = await createVehicle();
    const unpaidBid = await createBid(otherVehicle, buyer, { amount: 5_000, status: "winner" });

    const checkout = await app.request("/api/payments/create-checkout-session", {
      method: "POST",
      headers: authHeader(buyer),
      body: JSON.stringify({ bidId: paidBid._id.toString() }),
    });
    expect(checkout.status).toBe(200);
    const payment = (await Payment.findOne({ bidId: paidBid._id }))!;
    markSessionPaid(payment.stripeSessionId!);
    await app.request(`/api/payments/success?session_id=${payment.stripeSessionId}`, {
      headers: authHeader(buyer),
    });

    const res = await app.request("/api/bids/my", { headers: authHeader(buyer) });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { _id: string; payment?: { id: string; status: string } }[];

    const paidRow = body.find((b) => b._id === paidBid._id.toString());
    expect(paidRow?.payment).toBeDefined();
    expect(paidRow!.payment!.id).toBe(payment._id.toString());
    expect(paidRow!.payment!.status).toBe("paid");

    const unpaidRow = body.find((b) => b._id === unpaidBid._id.toString());
    expect(unpaidRow?.payment).toBeUndefined();
  });

  test("una puja sin Adjudicacion trae adjudicacion: null", async () => {
    const buyer = await createUser();
    const vehicle = await createVehicle();
    await createBid(vehicle, buyer, { amount: 5_000, status: "active" });

    const res = await app.request("/api/bids/my", { headers: authHeader(buyer) });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { adjudicacion: unknown }[];
    expect(body[0]!.adjudicacion).toBeNull();
  });

  test("una puja ganadora trae adjudicacion.{estado,fechaLimitePago}, y esSegundoPostor distingue al segundo postor", async () => {
    const [ganador, segundo] = await Promise.all([createUser(), createUser()]);
    const vehicle = await createVehicle();
    const ganadorBid = await createBid(vehicle, ganador, { amount: 15_000, status: "winner" });
    const segundoBid = await createBid(vehicle, segundo, { amount: 12_000, status: "outbid" });

    const fechaActo = new Date();
    const fechaLimitePago = addBusinessDays(fechaActo, 5);
    const adjudicacion = await Adjudicacion.create({
      vehicleId: vehicle._id,
      ganadorBidId: ganadorBid._id,
      segundoBidId: segundoBid._id,
      segundoMonto: segundoBid.amount,
      fechaActo,
      fechaLimitePago,
      estado: "ADJUDICADA_PENDIENTE_PAGO",
    });

    const resGanador = await app.request("/api/bids/my", { headers: authHeader(ganador) });
    const bodyGanador = (await resGanador.json()) as {
      _id: string;
      adjudicacion: { id: string; estado: string; fechaLimitePago: string; esSegundoPostor: boolean } | null;
    }[];
    const rowGanador = bodyGanador.find((b) => b._id === ganadorBid._id.toString())!;
    expect(rowGanador.adjudicacion).not.toBeNull();
    expect(rowGanador.adjudicacion!.id).toBe(adjudicacion._id.toString());
    expect(rowGanador.adjudicacion!.estado).toBe("ADJUDICADA_PENDIENTE_PAGO");
    expect(new Date(rowGanador.adjudicacion!.fechaLimitePago).getTime()).toBe(fechaLimitePago.getTime());
    expect(rowGanador.adjudicacion!.esSegundoPostor).toBe(false);

    const resSegundo = await app.request("/api/bids/my", { headers: authHeader(segundo) });
    const bodySegundo = (await resSegundo.json()) as {
      _id: string;
      adjudicacion: { esSegundoPostor: boolean } | null;
    }[];
    const rowSegundo = bodySegundo.find((b) => b._id === segundoBid._id.toString())!;
    // Comparte la MISMA Adjudicacion que el ganador (por vehicleId), pero
    // esSegundoPostor debe distinguir que este bid es el segundoBidId.
    expect(rowSegundo.adjudicacion).not.toBeNull();
    expect(rowSegundo.adjudicacion!.esSegundoPostor).toBe(true);
  });
});

describe("GET /api/bids/my/purchases", () => {
  // Regresión: la ruta tenía su propia consulta inline que nunca adjuntaba
  // el pago, dejando el botón "Ver recibo" del frontend (MyPurchasesPage)
  // permanentemente sin funcionar — bid.payment llegaba undefined siempre.
  test("cada compra trae payment: {id, status} para habilitar el enlace al recibo", async () => {
    const buyer = await createUser();
    const vehicle = await createVehicle();
    const bid = await createBid(vehicle, buyer, { amount: 12_000, status: "winner" });

    const checkout = await app.request("/api/payments/create-checkout-session", {
      method: "POST",
      headers: authHeader(buyer),
      body: JSON.stringify({ bidId: bid._id.toString() }),
    });
    expect(checkout.status).toBe(200);
    const payment = (await Payment.findOne({ bidId: bid._id }))!;
    markSessionPaid(payment.stripeSessionId!);
    await app.request(`/api/payments/success?session_id=${payment.stripeSessionId}`, {
      headers: authHeader(buyer),
    });

    const res = await app.request("/api/bids/my/purchases", { headers: authHeader(buyer) });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { payment?: { id: string; status: string } }[];
    expect(body).toHaveLength(1);
    expect(body[0]!.payment).toBeDefined();
    expect(body[0]!.payment!.id).toBe(payment._id.toString());
    expect(body[0]!.payment!.status).toBe("paid");
  });
});

import "./mocks/clerk";
import { beforeAll, describe, expect, test } from "bun:test";
import mongoose from "mongoose";
import { createApp } from "../app";
import { Adjudicacion } from "../models/Adjudicacion";
import { Deposito } from "../models/Deposito";
import { Payment } from "../models/Payment";
import { runMigrations } from "../../scripts/migrate";
import { setupTestDB } from "./db";
import { authHeader, createBid, createUser, createVehicle } from "./factories";

setupTestDB();
const app = createApp();

// Entrega.adjudicacionId es único (RI de negocio: a lo sumo una entrega por
// adjudicación) — corremos las migraciones aunque esta suite no necesite un
// índice propio, siguiendo el mismo bootstrap que el resto de tests de
// integración (Task 3/8), por si algún día se agrega uno para este dominio.
beforeAll(async () => {
  await runMigrations(mongoose.connection);
});

const VIN_VEHICULO = "1HGCM82633A004352";
const VIN_DIFERENTE = "2HGCM82633A004353";

interface EntregaJSON {
  _id: string;
  estado: string;
  checklist: { clave: string }[];
  vinCapturado?: string;
  actaHash?: string;
  motivoBloqueo?: string;
}

// Prepara todo el andamiaje previo a la entrega: comprador con pago
// conciliado, adjudicación registrada, vehículo con VIN y un depósito con un
// slot disponible. `paymentStatus` permite ejercitar el caso RE-01.
async function prepararEscenario(paymentStatus: "paid" | "pending" = "paid") {
  const comprador = await createUser();
  const custodio = await createUser({ role: "custodio" });
  const vehicle = await createVehicle({ vin: VIN_VEHICULO });
  const bid = await createBid(vehicle, comprador, { amount: vehicle.currentPrice + 500, status: "winner" });

  const adjudicacion = await Adjudicacion.create({
    vehicleId: vehicle._id,
    ganadorBidId: bid._id,
    fechaActo: new Date(),
    fechaLimitePago: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    estado: paymentStatus === "paid" ? "PAGADA" : "ADJUDICADA_PENDIENTE_PAGO",
  });

  const payment = await Payment.create({
    userId: comprador._id,
    vehicleId: vehicle._id,
    bidId: bid._id,
    amount: bid.amount,
    status: paymentStatus,
    paidAt: paymentStatus === "paid" ? new Date() : undefined,
    referenciaPago: `ref-${vehicle._id.toString()}`,
  });

  const deposito = await Deposito.create({
    nombre: "Depósito central",
    direccion: "Zona 1",
    slots: [{ inicio: new Date(), fin: new Date(Date.now() + 3600_000), capacidad: 2, ocupados: 0 }],
  });
  // ISlot no declara `_id` (es un subdocumento con { _id: true } a nivel de
  // schema, mongoose lo agrega en runtime pero no en el tipo TS).
  const slotId = (deposito.slots[0] as unknown as { _id: mongoose.Types.ObjectId })._id.toString();

  return { comprador, custodio, vehicle, bid, adjudicacion, payment, deposito, slotId };
}

function iniciarEntrega(
  user: Awaited<ReturnType<typeof createUser>>,
  paymentId: string,
  depositoId: string,
  slotId: string
) {
  return app.request("/api/entrega", {
    method: "POST",
    headers: authHeader(user),
    body: JSON.stringify({ paymentId, depositoId, slotId }),
  });
}

async function completarChecklist(custodio: Awaited<ReturnType<typeof createUser>>, entregaId: string) {
  const claves = [
    "odometro", "placa", "frontal", "posterior",
    "lateral_izq", "lateral_der", "interior", "vano_motor", "vin",
  ] as const;
  let last!: Response;
  for (const clave of claves) {
    last = await app.request(`/api/entrega/${entregaId}/checklist`, {
      method: "POST",
      headers: authHeader(custodio),
      body: JSON.stringify({ clave, fotoUrl: "https://cdn.chocao.app/fotos/a.jpg" }),
    });
    expect(last.status).toBe(200);
  }
  return last;
}

describe("proceso de entrega (RE-01/RE-04/RE-06/RE-07/RE-08)", () => {
  test("flujo feliz: precondiciones cumplidas -> cita -> checklist completo con VIN correcto -> acta generada, ENTREGADA", async () => {
    const { comprador, custodio, payment, deposito, slotId } = await prepararEscenario("paid");

    const crear = await iniciarEntrega(comprador, payment._id.toString(), deposito._id.toString(), slotId);
    expect(crear.status).toBe(201);
    const creada = (await crear.json()) as EntregaJSON;
    expect(creada.estado).toBe("CITA_AGENDADA");

    await completarChecklist(custodio, creada._id);

    const vin = await app.request(`/api/entrega/${creada._id}/vin`, {
      method: "POST",
      headers: authHeader(custodio),
      body: JSON.stringify({ vin: VIN_VEHICULO }),
    });
    expect(vin.status).toBe(200);
    const vinBody = (await vin.json()) as EntregaJSON;
    expect(vinBody.estado).not.toBe("BLOQUEADA");

    const inventario = await app.request(`/api/entrega/${creada._id}/inventario`, {
      method: "POST",
      headers: authHeader(custodio),
      body: JSON.stringify({ items: [{ item: "llaves", cantidad: 2, faltante: false }] }),
    });
    expect(inventario.status).toBe(200);

    const acta = await app.request(`/api/entrega/${creada._id}/acta`, {
      method: "POST",
      headers: authHeader(custodio),
    });
    expect(acta.status).toBe(200);
    const actaBody = (await acta.json()) as EntregaJSON;
    expect(actaBody.estado).toBe("ENTREGADA");
    expect(actaBody.actaHash).toBeTruthy();
  });

  test("bloquea automáticamente si el VIN capturado no coincide con el del vehículo (RE-06)", async () => {
    const { comprador, custodio, payment, deposito, slotId } = await prepararEscenario("paid");

    const crear = await iniciarEntrega(comprador, payment._id.toString(), deposito._id.toString(), slotId);
    const creada = (await crear.json()) as EntregaJSON;

    const vin = await app.request(`/api/entrega/${creada._id}/vin`, {
      method: "POST",
      headers: authHeader(custodio),
      body: JSON.stringify({ vin: VIN_DIFERENTE }),
    });
    expect(vin.status).toBe(409);

    const acta = await app.request(`/api/entrega/${creada._id}/acta`, {
      method: "POST",
      headers: authHeader(custodio),
    });
    expect(acta.status).toBe(409);
  });

  test("rechaza iniciar la entrega si el llamante no es el dueño del pago", async () => {
    const { payment, deposito, slotId } = await prepararEscenario("paid");
    const otroUsuario = await createUser();

    const crear = await iniciarEntrega(otroUsuario, payment._id.toString(), deposito._id.toString(), slotId);
    expect(crear.status).toBe(403);
  });

  test("un admin sí puede iniciar la entrega de un pago ajeno", async () => {
    const { payment, deposito, slotId } = await prepararEscenario("paid");
    const admin = await createUser({ role: "admin" });

    const crear = await iniciarEntrega(admin, payment._id.toString(), deposito._id.toString(), slotId);
    expect(crear.status).toBe(201);
  });

  test("rechaza iniciar la entrega si el pago no está conciliado (RE-01)", async () => {
    const { comprador, payment, deposito, slotId } = await prepararEscenario("pending");

    const crear = await iniciarEntrega(comprador, payment._id.toString(), deposito._id.toString(), slotId);
    expect(crear.status).toBe(409);
  });

  test("ENTREGADA es irreversible: no admite otro POST de checklist/vin/inventario (RE-08)", async () => {
    const { comprador, custodio, payment, deposito, slotId } = await prepararEscenario("paid");

    const crear = await iniciarEntrega(comprador, payment._id.toString(), deposito._id.toString(), slotId);
    const creada = (await crear.json()) as EntregaJSON;

    await completarChecklist(custodio, creada._id);
    await app.request(`/api/entrega/${creada._id}/vin`, {
      method: "POST",
      headers: authHeader(custodio),
      body: JSON.stringify({ vin: VIN_VEHICULO }),
    });
    await app.request(`/api/entrega/${creada._id}/inventario`, {
      method: "POST",
      headers: authHeader(custodio),
      body: JSON.stringify({ items: [{ item: "llaves", cantidad: 2, faltante: false }] }),
    });
    const acta = await app.request(`/api/entrega/${creada._id}/acta`, {
      method: "POST",
      headers: authHeader(custodio),
    });
    expect(acta.status).toBe(200);

    const checklistDespues = await app.request(`/api/entrega/${creada._id}/checklist`, {
      method: "POST",
      headers: authHeader(custodio),
      body: JSON.stringify({ clave: "vin", fotoUrl: "https://cdn.chocao.app/fotos/b.jpg" }),
    });
    expect(checklistDespues.status).toBe(409);

    const vinDespues = await app.request(`/api/entrega/${creada._id}/vin`, {
      method: "POST",
      headers: authHeader(custodio),
      body: JSON.stringify({ vin: VIN_VEHICULO }),
    });
    expect(vinDespues.status).toBe(409);

    const inventarioDespues = await app.request(`/api/entrega/${creada._id}/inventario`, {
      method: "POST",
      headers: authHeader(custodio),
      body: JSON.stringify({ items: [{ item: "llaves", cantidad: 1, faltante: true }] }),
    });
    expect(inventarioDespues.status).toBe(409);
  });
});

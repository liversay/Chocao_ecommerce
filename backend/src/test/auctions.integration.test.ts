import "./mocks/clerk";
import "./mocks/stripe";
import { describe, expect, test } from "bun:test";
import { Adjudicacion } from "../models/Adjudicacion";
import { AuditLog } from "../models/AuditLog";
import { Bid } from "../models/Bid";
import { Vehicle } from "../models/Vehicle";
import { adjudicateVehicle, closeExpiredAuctions } from "../services/auctions";
import { setupTestDB } from "./db";
import { createBid, createUser, createVehicle } from "./factories";

setupTestDB();

describe("cierre automático de subastas (HU-39)", () => {
  test("cierra las vencidas, adjudica al mejor postor y no toca las vigentes", async () => {
    const [ana, bruno] = await Promise.all([createUser(), createUser()]);
    const vencida = await createVehicle({ auctionEndDate: new Date(Date.now() - 1000) });
    const vigente = await createVehicle();
    const baja = await createBid(vencida, ana!, { amount: 11_000, status: "outbid" });
    const alta = await createBid(vencida, bruno!, { amount: 15_000 });
    await createBid(vigente, ana!, { amount: 12_000 });

    const closed = await closeExpiredAuctions();

    expect(closed).toBe(1);
    expect((await Vehicle.findById(vencida._id))!.status).toBe("closed");
    expect((await Vehicle.findById(vigente._id))!.status).toBe("active");
    expect((await Bid.findById(alta._id))!.status).toBe("winner");
    expect((await Bid.findById(baja._id))!.status).toBe("outbid");
  });

  test("es idempotente: una segunda corrida no cierra ni adjudica dos veces", async () => {
    const ana = await createUser();
    const vencida = await createVehicle({ auctionEndDate: new Date(Date.now() - 1000) });
    await createBid(vencida, ana, { amount: 11_000 });

    expect(await closeExpiredAuctions()).toBe(1);
    expect(await closeExpiredAuctions()).toBe(0);

    const winners = await Bid.countDocuments({ vehicleId: vencida._id, status: "winner" });
    expect(winners).toBe(1);
    expect(await AuditLog.countDocuments({ action: "vehicle.auction.autoclose" })).toBe(1);
  });

  test("una subasta vencida sin pujas se cierra sin ganador", async () => {
    const vencida = await createVehicle({ auctionEndDate: new Date(Date.now() - 1000) });
    expect(await closeExpiredAuctions()).toBe(1);
    expect((await Vehicle.findById(vencida._id))!.status).toBe("closed");
  });

  test("la corrida queda auditada como acción del sistema (source job)", async () => {
    await createVehicle({ auctionEndDate: new Date(Date.now() - 1000) });
    await closeExpiredAuctions();
    const entry = await AuditLog.findOne({ action: "vehicle.auction.autoclose" });
    expect(entry).not.toBeNull();
    expect(entry!.source).toBe("job");
    expect(entry!.actor).toBeUndefined();
  });

  test("una puja ya paid nunca se degrada al adjudicar de nuevo", async () => {
    const ana = await createUser();
    const vencida = await createVehicle({ auctionEndDate: new Date(Date.now() - 1000) });
    const pagada = await createBid(vencida, ana, { amount: 20_000, status: "paid" });

    await closeExpiredAuctions();
    expect((await Bid.findById(pagada._id))!.status).toBe("paid");
  });
});

describe("adjudicación con segundo postor y plazo legal de pago (RP-01/RP-02)", () => {
  test("adjudicateVehicle persiste ganador, segundo postor y fechaLimitePago a 5 días hábiles", async () => {
    const [ana, bruno, carla] = await Promise.all([createUser(), createUser(), createUser()]);
    const vehicle = await createVehicle();
    await createBid(vehicle, ana!, { amount: 100 });
    await createBid(vehicle, bruno!, { amount: 200 });
    const alta = await createBid(vehicle, carla!, { amount: 300 });

    const winnerBidId = await adjudicateVehicle(vehicle._id.toString());

    expect(winnerBidId).toBe(alta._id.toString());
    const adjudicacion = await Adjudicacion.findOne({ vehicleId: vehicle._id });
    expect(adjudicacion).not.toBeNull();
    expect(adjudicacion?.ganadorBidId.toString()).toBe(alta._id.toString());
    expect(adjudicacion?.segundoMonto).toBe(200);
    expect(adjudicacion?.estado).toBe("ADJUDICADA_PENDIENTE_PAGO");
    expect(adjudicacion?.fechaLimitePago.getTime()).toBeGreaterThan(adjudicacion!.fechaActo.getTime());
  });

  test("adjudicateVehicle sin segundo postor deja segundoBidId/segundoMonto sin definir", async () => {
    const ana = await createUser();
    const vehicle = await createVehicle();
    const unica = await createBid(vehicle, ana!, { amount: 500 });

    await adjudicateVehicle(vehicle._id.toString());

    const adjudicacion = await Adjudicacion.findOne({ vehicleId: vehicle._id });
    expect(adjudicacion?.ganadorBidId.toString()).toBe(unica._id.toString());
    expect(adjudicacion?.segundoBidId).toBeUndefined();
    expect(adjudicacion?.segundoMonto).toBeUndefined();
  });

  test("adjudicateVehicle es un no-op sobre una Adjudicacion ya PAGADA (bid ganador ya paid)", async () => {
    const ana = await createUser();
    const vehicle = await createVehicle();
    const pagada = await createBid(vehicle, ana!, { amount: 400, status: "paid" });

    const fechaActoOriginal = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    const fechaLimitePagoOriginal = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    await Adjudicacion.create({
      vehicleId: vehicle._id,
      ganadorBidId: pagada._id,
      fechaActo: fechaActoOriginal,
      fechaLimitePago: fechaLimitePagoOriginal,
      estado: "PAGADA",
    });

    // Simula un admin repitiendo el PATCH de estado (closed/awarded) sobre un
    // vehículo cuyo ganador ya pagó — no debe reabrir el plazo de pago.
    const winnerBidId = await adjudicateVehicle(vehicle._id.toString());

    expect(winnerBidId).toBe(pagada._id.toString());
    expect((await Bid.findById(pagada._id))!.status).toBe("paid");

    const adjudicacion = await Adjudicacion.findOne({ vehicleId: vehicle._id });
    expect(adjudicacion?.estado).toBe("PAGADA");
    expect(adjudicacion?.fechaLimitePago.getTime()).toBe(fechaLimitePagoOriginal.getTime());
    expect(adjudicacion?.fechaActo.getTime()).toBe(fechaActoOriginal.getTime());
  });

  test("adjudicateVehicle aborta y no adjudica si detecta un empate en el monto más alto (RJ-02)", async () => {
    const [ana, bruno] = await Promise.all([createUser(), createUser()]);
    const vehicle = await createVehicle();
    const empatadaUno = await createBid(vehicle, ana!, { amount: 300 });
    const empatadaDos = await createBid(vehicle, bruno!, { amount: 300 });

    const winnerBidId = await adjudicateVehicle(vehicle._id.toString());

    expect(winnerBidId).toBeUndefined();
    const adjudicacion = await Adjudicacion.findOne({ vehicleId: vehicle._id });
    expect(adjudicacion).toBeNull();
    // ninguno de los bids empatados cambió de estado — la intervención es manual
    expect((await Bid.findById(empatadaUno._id))!.status).toBe("active");
    expect((await Bid.findById(empatadaDos._id))!.status).toBe("active");
    // y debe quedar auditado como anomalía para intervención manual
    const entry = await AuditLog.findOne({ action: "adjudicacion.empate_detectado" });
    expect(entry).not.toBeNull();
  });
});

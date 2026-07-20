import "./mocks/clerk";
import "./mocks/stripe";
import { describe, expect, test } from "bun:test";
import { AuditLog } from "../models/AuditLog";
import { Bid } from "../models/Bid";
import { Vehicle } from "../models/Vehicle";
import { closeExpiredAuctions } from "../services/auctions";
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

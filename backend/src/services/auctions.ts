import { logger } from "../lib/logger";
import { NotFoundError } from "../lib/errors";
import { Bid } from "../models/Bid";
import { Vehicle, type IVehicle, type VehicleDoc } from "../models/Vehicle";
import { recordAudit } from "./audit";
import { invalidateCatalog } from "./vehicles";
import type { UserDoc } from "../models/User";

// Adjudicación: la puja más alta del vehículo queda winner y el resto outbid.
// Idempotente — re-ejecutarla no cambia el resultado. La comparten el cambio
// de estado manual (ruta admin), el job de cierre automático y la futura tool
// MCP chocao_set_vehicle_status.
export async function adjudicateVehicle(vehicleId: string): Promise<string | undefined> {
  const highestBid = await Bid.findOne({ vehicleId }).sort({ amount: -1 });
  if (!highestBid) return undefined;

  await Bid.updateMany(
    { vehicleId, _id: { $ne: highestBid._id }, status: { $ne: "paid" } },
    { status: "outbid" }
  );
  if (highestBid.status !== "paid") {
    highestBid.status = "winner";
    await highestBid.save();
  }
  return highestBid._id.toString();
}

// Cierra todas las subastas activas ya vencidas. Cada vehículo se reclama de
// forma atómica (active→closed), así el job es idempotente y tolerante a
// reinicios o a varias instancias corriendo a la vez: nadie adjudica dos veces.
export async function closeExpiredAuctions(actor?: UserDoc): Promise<number> {
  let closed = 0;

  for (;;) {
    const vehicle = await Vehicle.findOneAndUpdate(
      { status: "active", auctionEndDate: { $lte: new Date() } },
      { status: "closed" },
      { returnDocument: "after" }
    );
    if (!vehicle) break;

    const winnerBidId = await adjudicateVehicle(vehicle._id.toString());
    invalidateCatalog();
    closed += 1;

    await recordAudit({
      actor,
      action: "vehicle.auction.autoclose",
      resource: "vehicle",
      resourceId: vehicle._id.toString(),
      before: { status: "active" },
      after: { status: "closed", ...(winnerBidId ? { winnerBidId } : {}) },
      source: "job",
    });

    logger.info("subasta cerrada automáticamente", {
      vehicleId: vehicle._id.toString(),
      winnerBidId,
    });
  }

  return closed;
}

// Cambia el estado de un vehículo (admin). Si transiciona a closed/awarded,
// reaplica la misma adjudicación que el cierre automático. Auditado con el
// actor real. La comparten PATCH /vehicles/:id/status y la tool MCP
// chocao_set_vehicle_status.
export async function setVehicleStatus(
  actor: UserDoc,
  vehicleId: string,
  status: IVehicle["status"],
  requestId?: string
): Promise<{ vehicle: VehicleDoc; winnerBidId?: string }> {
  const vehicle = await Vehicle.findById(vehicleId);
  if (!vehicle) throw new NotFoundError("Vehículo no encontrado");

  const previousStatus = vehicle.status;
  vehicle.status = status;
  await vehicle.save();
  invalidateCatalog();

  let winnerBidId: string | undefined;
  if (status === "closed" || status === "awarded") {
    winnerBidId = await adjudicateVehicle(vehicleId);
  }

  await recordAudit({
    actor,
    action: "vehicle.status.change",
    resource: "vehicle",
    resourceId: vehicle._id.toString(),
    before: { status: previousStatus },
    after: { status, ...(winnerBidId ? { winnerBidId } : {}) },
    requestId,
  });

  return { vehicle, winnerBidId };
}

import { logger } from "../lib/logger";
import { Bid } from "../models/Bid";
import { Vehicle } from "../models/Vehicle";
import { recordAudit } from "./audit";
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

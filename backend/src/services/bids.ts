import { ConflictError, NotFoundError, ValidationError } from "../lib/errors";
import { metrics } from "../lib/metrics";
import { Bid } from "../models/Bid";
import type { UserDoc } from "../models/User";
import { Vehicle } from "../models/Vehicle";

// Registra una puja con control de concurrencia optimista. La reutilizan la
// ruta HTTP y (más adelante) la tool MCP chocao_place_bid — toda la regla de
// negocio vive aquí, no en la capa de transporte.
export async function placeBid(user: UserDoc, vehicleId: string, amount: number) {
  const vehicle = await Vehicle.findById(vehicleId);
  if (!vehicle) throw new NotFoundError("Vehículo no encontrado");
  if (vehicle.status !== "active") {
    throw new ValidationError("Este vehículo no está abierto para pujas en este momento");
  }
  if (vehicle.auctionEndDate && vehicle.auctionEndDate < new Date()) {
    throw new ValidationError("La subasta ya finalizó; no se aceptan más pujas");
  }
  if (amount <= vehicle.currentPrice) {
    throw new ValidationError(
      `Tu puja debe ser mayor a la oferta actual ($${vehicle.currentPrice.toLocaleString()})`
    );
  }

  // Claim atómico (optimistic locking): el update solo procede si, EN ESTE
  // INSTANTE, la puja sigue superando el precio vigente y la subasta sigue
  // abierta. De dos pujas simultáneas por el mismo monto, solo una gana; la
  // otra recibe 409 con el precio ya actualizado.
  const claimed = await Vehicle.findOneAndUpdate(
    {
      _id: vehicle._id,
      status: "active",
      currentPrice: { $lt: amount },
      $or: [{ auctionEndDate: { $exists: false } }, { auctionEndDate: { $gt: new Date() } }],
    },
    { $set: { currentPrice: amount } },
    { returnDocument: "after" }
  );
  if (!claimed) {
    const fresh = await Vehicle.findById(vehicle._id);
    throw new ConflictError(
      `Otra puja superó la tuya; la oferta actual es $${(fresh?.currentPrice ?? amount).toLocaleString()}`
    );
  }

  const bid = await Bid.create({ vehicleId: vehicle._id, userId: user._id, amount, status: "active" });

  // Reconciliación idempotente y auto-correctiva: la puja activa más alta se
  // conserva y el resto pasa a outbid. Bajo interleavings concurrentes, la
  // última reconciliación deja exactamente una puja activa (la más alta).
  const top = await Bid.findOne({ vehicleId: vehicle._id, status: "active" }).sort({ amount: -1 });
  if (top) {
    await Bid.updateMany(
      { vehicleId: vehicle._id, status: "active", _id: { $ne: top._id } },
      { status: "outbid" }
    );
  }

  metrics.increment("chocao_bids_total");
  return { bid, currentPrice: claimed.currentPrice };
}

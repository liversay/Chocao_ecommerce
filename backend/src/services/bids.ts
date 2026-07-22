import { ConflictError, NotFoundError, ValidationError } from "../lib/errors";
import { metrics } from "../lib/metrics";
import { Bid } from "../models/Bid";
import { Payment } from "../models/Payment";
import type { UserDoc } from "../models/User";
import { Vehicle } from "../models/Vehicle";
import { notifyMany } from "./notifications";
import { publishPublic } from "./realtime";
import { invalidateCatalog } from "./vehicles";

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

  // Antes de degradar las pujas superadas, capturamos a quiénes pertenecían
  // (para notificarlos) — el updateMany no devuelve los documentos afectados.
  const outbidUserIds = await Bid.distinct("userId", {
    vehicleId: vehicle._id,
    status: "active",
    amount: { $lt: amount },
    userId: { $ne: user._id },
  });

  // Reconciliación por comparación de monto, no por identidad de un "top"
  // leído antes: con `_id != top._id` un reconciliador con una vista vieja
  // (que no veía aún la puja más alta, todavía en vuelo) podía outbidear a
  // esa puja más alta al ejecutarse después que ella. Filtrando por
  // `amount < la mía` cada puja SOLO puede degradar a las estrictamente
  // menores — nunca a una mayor — así que el resultado converge sin
  // importar en qué orden se intercalen los reconciliadores concurrentes:
  // la puja global más alta termina siendo la única activa siempre que su
  // propio paso de reconciliación llegue a ejecutarse (garantizado, porque
  // sigue a su propio claim+create).
  await Bid.updateMany(
    { vehicleId: vehicle._id, status: "active", amount: { $lt: amount } },
    { status: "outbid" }
  );

  invalidateCatalog();
  metrics.increment("chocao_bids_total");

  // Público: cualquier visitante viendo este vehículo (logueado o no) ve el
  // precio/historial actualizarse sin recargar.
  publishPublic({
    type: "bid.placed",
    payload: {
      vehicleId: vehicle._id.toString(),
      currentPrice: claimed.currentPrice,
      amount,
      createdAt: bid.createdAt,
    },
  });

  if (outbidUserIds.length > 0) {
    await notifyMany(outbidUserIds, "outbid", () => ({
      title: "Te superaron en una puja",
      body: `Alguien ofreció más por "${vehicle.title}". El precio actual es $${claimed.currentPrice.toLocaleString()}.`,
      data: { vehicleId: vehicle._id.toString() },
    }));
  }

  return { bid, currentPrice: claimed.currentPrice };
}

export interface BidHistoryEntry {
  amount: number;
  status: string;
  createdAt: Date;
}

export interface BidHistoryResult {
  currentPrice: number;
  highestBid: number | null;
  bids: BidHistoryEntry[];
  total: number;
  page: number;
  pages: number;
}

// Historial de pujas de un vehículo, SIN exponer identidad de los postores
// (ni userId ni nombre/email) — apto para que un agente lo muestre a
// cualquier usuario sin filtrar PII ajena.
export async function getBidHistory(
  vehicleId: string,
  { page = 1, limit = 20 }: { page?: number; limit?: number } = {}
): Promise<BidHistoryResult> {
  const vehicle = await Vehicle.findById(vehicleId);
  if (!vehicle) throw new NotFoundError("Vehículo no encontrado");

  const [bids, total] = await Promise.all([
    Bid.find({ vehicleId })
      .select("amount status createdAt")
      .sort({ amount: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Bid.countDocuments({ vehicleId }),
  ]);

  const highest = await Bid.findOne({ vehicleId }).sort({ amount: -1 }).select("amount");

  return {
    currentPrice: vehicle.currentPrice,
    highestBid: highest?.amount ?? null,
    bids: bids.map((b) => ({ amount: b.amount, status: b.status, createdAt: b.createdAt })),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
  };
}

// Pujas del usuario dueño del token, con el vehículo asociado y una señal
// clara de qué requiere acción (pago pendiente en las ganadoras).
export async function getMyBids(user: UserDoc) {
  const bids = await Bid.find({ userId: user._id }).populate("vehicleId").sort({ createdAt: -1 });
  return bids.map((b) => {
    const vehicle = b.vehicleId as unknown as {
      _id: unknown;
      title: string;
      brand: string;
      model: string;
      year: number;
      currentPrice: number;
      status: string;
    } | null;
    return {
      bidId: b._id.toString(),
      amount: b.amount,
      status: b.status,
      createdAt: b.createdAt,
      requiresPayment: b.status === "winner",
      vehicle: vehicle && {
        id: vehicle._id?.toString(),
        title: vehicle.title,
        brand: vehicle.brand,
        model: vehicle.model,
        year: vehicle.year,
        currentPrice: vehicle.currentPrice,
        status: vehicle.status,
      },
    };
  });
}

// Compras (bids pagados) del usuario dueño del token, con referencia del
// pago — nunca datos de otros compradores.
export async function getMyPurchases(user: UserDoc) {
  const bids = await Bid.find({ userId: user._id, status: "paid" })
    .populate("vehicleId")
    .sort({ createdAt: -1 });

  const payments = await Payment.find({ bidId: { $in: bids.map((b) => b._id) } });
  const paymentByBid = new Map(payments.map((p) => [p.bidId.toString(), p]));

  return bids.map((b) => {
    const vehicle = b.vehicleId as unknown as {
      _id: unknown;
      title: string;
      brand: string;
      model: string;
      year: number;
    } | null;
    const payment = paymentByBid.get(b._id.toString());
    return {
      bidId: b._id.toString(),
      amount: b.amount,
      purchasedAt: b.createdAt,
      vehicle: vehicle && {
        id: vehicle._id?.toString(),
        title: vehicle.title,
        brand: vehicle.brand,
        model: vehicle.model,
        year: vehicle.year,
      },
      payment: payment && { id: payment._id.toString(), status: payment.status },
    };
  });
}

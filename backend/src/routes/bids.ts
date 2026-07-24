import { Hono } from "hono";
import type { AppEnv } from "../types";
import { requireAuth, requirePermission } from "../middlewares/auth";
import { rateLimit } from "../middlewares/rateLimit";
import { idParamSchema, validate } from "../schemas/common";
import { placeBidSchema } from "../schemas/bids";
import { placeBid } from "../services/bids";
import { Adjudicacion } from "../models/Adjudicacion";
import { Bid } from "../models/Bid";
import { Payment } from "../models/Payment";

const bids = new Hono<AppEnv>();

// Admin: all bids
bids.get("/", requirePermission("report:read"), async (c) => {
  const list = await Bid.find().populate("vehicleId userId").sort({ createdAt: -1 });
  return c.json(list);
});

// Customer: my bids. Las pagadas traen `payment: {id, status}` (igual que
// /my/purchases) — VehicleDetailPage lo usa para enlazar "Ver recibo" sin
// depender de qué endpoint trajo la puja. También trae `adjudicacion: {id,
// estado, fechaLimitePago, esSegundoPostor} | null` (join por vehicleId,
// mismo patrón Map que el join de payment) — MyBidsPage lo usa para mostrar
// el plazo legal de pago y el botón "Aceptar oferta" del segundo postor tras
// un incumplimiento (RP-05). `esSegundoPostor` distingue, cuando el mismo
// vehículo aparece en dos bids (el ganador original y el segundo postor,
// ambos comparten la misma Adjudicacion), cuál de los dos es el que puede
// aceptar la oferta.
bids.get("/my", requireAuth, async (c) => {
  const user = c.get("user");
  const list = await Bid.find({ userId: user._id })
    .populate("vehicleId")
    .sort({ createdAt: -1 })
    .lean();

  const paidIds = list.filter((b) => b.status === "paid").map((b) => b._id);
  const payments = paidIds.length ? await Payment.find({ bidId: { $in: paidIds } }).lean() : [];
  const paymentByBid = new Map(payments.map((p) => [p.bidId.toString(), p]));

  const vehicleIds = list
    .map((b) => (b.vehicleId as unknown as { _id?: unknown } | null)?._id)
    .filter(Boolean);
  const adjudicaciones = vehicleIds.length
    ? await Adjudicacion.find({ vehicleId: { $in: vehicleIds } }).lean()
    : [];
  const adjudicacionByVehicle = new Map(adjudicaciones.map((a) => [a.vehicleId.toString(), a]));

  const withPayment = list.map((bid) => {
    const payment = paymentByBid.get(bid._id.toString());
    const vehicleId = (bid.vehicleId as unknown as { _id?: unknown } | null)?._id;
    const adjudicacion = vehicleId ? adjudicacionByVehicle.get(String(vehicleId)) : undefined;
    return {
      ...bid,
      payment: payment && { id: payment._id.toString(), status: payment.status },
      adjudicacion: adjudicacion
        ? {
            id: adjudicacion._id.toString(),
            estado: adjudicacion.estado,
            fechaLimitePago: adjudicacion.fechaLimitePago,
            esSegundoPostor: adjudicacion.segundoBidId?.toString() === bid._id.toString(),
          }
        : null,
    };
  });
  return c.json(withPayment);
});

// Customer: my purchases (paid bids only). Cada fila trae `payment: {id,
// status}` — el frontend (MyPurchasesPage → botón "Ver recibo") lo usa para
// enlazar a GET /api/payments/:id/receipt.
bids.get("/my/purchases", requireAuth, async (c) => {
  const user = c.get("user");
  const list = await Bid.find({ userId: user._id, status: "paid" })
    .populate("vehicleId")
    .sort({ createdAt: -1 })
    .lean();

  const payments = await Payment.find({ bidId: { $in: list.map((b) => b._id) } }).lean();
  const paymentByBid = new Map(payments.map((p) => [p.bidId.toString(), p]));

  const withPayment = list.map((bid) => {
    const payment = paymentByBid.get(bid._id.toString());
    return { ...bid, payment: payment && { id: payment._id.toString(), status: payment.status } };
  });
  return c.json(withPayment);
});

// Bids for a vehicle
bids.get("/vehicle/:id", validate("param", idParamSchema), async (c) => {
  const list = await Bid.find({ vehicleId: c.req.valid("param").id })
    .populate("userId", "name email")
    .sort({ amount: -1 });
  return c.json(list);
});

// Place a bid — la regla de negocio y el control de concurrencia viven en
// services/bids.placeBid
bids.post(
  "/vehicle/:id",
  requireAuth,
  // tras requireAuth el límite es por usuario, no por IP
  rateLimit({ name: "place-bid", max: 15 }),
  validate("param", idParamSchema),
  validate("json", placeBidSchema),
  async (c) => {
    const { bid } = await placeBid(c.get("user"), c.req.valid("param").id, c.req.valid("json").amount);
    return c.json(bid, 201);
  }
);

export default bids;

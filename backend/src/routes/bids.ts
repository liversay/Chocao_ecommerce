import { Hono } from "hono";
import type { AppEnv } from "../types";
import { requireAuth, requirePermission } from "../middlewares/auth";
import { NotFoundError, ValidationError } from "../lib/errors";
import { idParamSchema, validate } from "../schemas/common";
import { placeBidSchema } from "../schemas/bids";
import { Bid } from "../models/Bid";
import { Vehicle } from "../models/Vehicle";

const bids = new Hono<AppEnv>();

// Admin: all bids
bids.get("/", requirePermission("report:read"), async (c) => {
  const list = await Bid.find().populate("vehicleId userId").sort({ createdAt: -1 });
  return c.json(list);
});

// Customer: my bids
bids.get("/my", requireAuth, async (c) => {
  const user = c.get("user");
  const list = await Bid.find({ userId: user._id })
    .populate("vehicleId")
    .sort({ createdAt: -1 });
  return c.json(list);
});

// Customer: my purchases (paid bids only)
bids.get("/my/purchases", requireAuth, async (c) => {
  const user = c.get("user");
  const list = await Bid.find({ userId: user._id, status: "paid" })
    .populate("vehicleId")
    .sort({ createdAt: -1 });
  return c.json(list);
});

// Bids for a vehicle
bids.get("/vehicle/:id", validate("param", idParamSchema), async (c) => {
  const list = await Bid.find({ vehicleId: c.req.valid("param").id })
    .populate("userId", "name email")
    .sort({ amount: -1 });
  return c.json(list);
});

// Place a bid
bids.post(
  "/vehicle/:id",
  requireAuth,
  validate("param", idParamSchema),
  validate("json", placeBidSchema),
  async (c) => {
    const user = c.get("user");
    const vehicleId = c.req.valid("param").id;
    const { amount } = c.req.valid("json");

    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) throw new NotFoundError("Vehículo no encontrado");
    if (vehicle.status !== "active") {
      throw new ValidationError("Este vehículo no está abierto para pujas en este momento");
    }
    if (vehicle.auctionEndDate && new Date(vehicle.auctionEndDate) < new Date()) {
      throw new ValidationError("La subasta ya finalizó; no se aceptan más pujas");
    }
    if (amount <= vehicle.currentPrice) {
      throw new ValidationError(
        `Tu puja debe ser mayor a la oferta actual ($${vehicle.currentPrice.toLocaleString()})`
      );
    }

    // Mark previous winning bid as outbid
    await Bid.updateMany({ vehicleId, status: "active" }, { status: "outbid" });

    const bid = await Bid.create({ vehicleId, userId: user._id, amount, status: "active" });
    vehicle.currentPrice = amount;
    await vehicle.save();

    return c.json(bid, 201);
  }
);

export default bids;

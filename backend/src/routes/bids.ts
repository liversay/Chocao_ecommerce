import { Hono } from "hono";
import type { AppEnv } from "../types";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { Bid } from "../models/Bid";
import { Vehicle } from "../models/Vehicle";

const bids = new Hono<AppEnv>();

// Admin: all bids
bids.get("/", requireAdmin, async (c) => {
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
bids.get("/vehicle/:id", async (c) => {
  const list = await Bid.find({ vehicleId: c.req.param("id") })
    .populate("userId", "name email")
    .sort({ amount: -1 });
  return c.json(list);
});

// Place a bid
bids.post("/vehicle/:id", requireAuth, async (c) => {
  const user = c.get("user");
  const vehicleId = c.req.param("id");
  const { amount } = await c.req.json();

  if (!amount || typeof amount !== "number") {
    return c.json({ error: "El monto debe ser un número válido" }, 400);
  }

  const vehicle = await Vehicle.findById(vehicleId);
  if (!vehicle) return c.json({ error: "Vehículo no encontrado" }, 404);
  if (vehicle.status !== "active") {
    return c.json({ error: "Este vehículo no está abierto para pujas en este momento" }, 400);
  }
  if (vehicle.auctionEndDate && new Date(vehicle.auctionEndDate) < new Date()) {
    return c.json({ error: "La subasta ya finalizó; no se aceptan más pujas" }, 400);
  }
  if (amount <= vehicle.currentPrice) {
    return c.json({ error: `Tu puja debe ser mayor a la oferta actual ($${vehicle.currentPrice.toLocaleString()})` }, 400);
  }

  // Mark previous winning bid as outbid
  await Bid.updateMany({ vehicleId, status: "active" }, { status: "outbid" });

  const bid = await Bid.create({ vehicleId, userId: user._id, amount, status: "active" });
  vehicle.currentPrice = amount;
  await vehicle.save();

  return c.json(bid, 201);
});

export default bids;

import { Hono } from "hono";
import { requireAdmin } from "../middlewares/auth";
import { Vehicle } from "../models/Vehicle";
import { Bid } from "../models/Bid";

const vehicles = new Hono();

vehicles.get("/", async (c) => {
  const { status } = c.req.query();
  const filter: Record<string, unknown> = {};
  if (!status || status === "all") {
    filter.status = { $in: ["published", "active", "closed", "awarded"] };
  } else {
    filter.status = status;
  }
  const list = await Vehicle.find(filter).sort({ createdAt: -1 });
  return c.json(list);
});

// Admin-only: all vehicles including draft
vehicles.get("/admin/all", requireAdmin, async (c) => {
  const list = await Vehicle.find().sort({ createdAt: -1 });
  return c.json(list);
});

vehicles.get("/:id", async (c) => {
  const vehicle = await Vehicle.findById(c.req.param("id"));
  if (!vehicle) return c.json({ error: "Vehículo no encontrado" }, 404);
  return c.json(vehicle);
});

vehicles.post("/", requireAdmin, async (c) => {
  const body = await c.req.json();
  const admin = c.get("user");

  const { title, brand, model, year, basePrice } = body;
  if (!title || !brand || !model || !year || !basePrice) {
    return c.json({ error: "Los campos título, marca, modelo, año y precio base son obligatorios" }, 400);
  }

  const vehicle = await Vehicle.create({
    ...body,
    currentPrice: basePrice,
    createdBy: admin._id,
  });
  return c.json(vehicle, 201);
});

vehicles.put("/:id", requireAdmin, async (c) => {
  const body = await c.req.json();
  const vehicle = await Vehicle.findByIdAndUpdate(c.req.param("id"), body, { new: true });
  if (!vehicle) return c.json({ error: "Vehículo no encontrado" }, 404);
  return c.json(vehicle);
});

vehicles.delete("/:id", requireAdmin, async (c) => {
  const vehicle = await Vehicle.findByIdAndDelete(c.req.param("id"));
  if (!vehicle) return c.json({ error: "Vehículo no encontrado" }, 404);
  return c.json({ message: "Vehículo eliminado" });
});

vehicles.patch("/:id/status", requireAdmin, async (c) => {
  const { status } = await c.req.json();
  const validStatuses = ["draft", "published", "active", "closed", "awarded"];
  if (!validStatuses.includes(status)) {
    return c.json({ error: "Estado inválido" }, 400);
  }

  const vehicleId = c.req.param("id");
  const vehicle = await Vehicle.findByIdAndUpdate(vehicleId, { status }, { new: true });
  if (!vehicle) return c.json({ error: "Vehículo no encontrado" }, 404);

  // When the auction transitions to closed/awarded, mark the highest bid as winner
  // and the rest as outbid. Idempotent — safe to re-run if the admin toggles status.
  if (status === "closed" || status === "awarded") {
    const highestBid = await Bid.findOne({ vehicleId }).sort({ amount: -1 });

    if (highestBid) {
      // All other bids on this vehicle become outbid
      await Bid.updateMany(
        { vehicleId, _id: { $ne: highestBid._id } },
        { status: "outbid" }
      );
      // The highest one is the winner
      highestBid.status = "winner";
      await highestBid.save();
    }
  }

  return c.json(vehicle);
});

export default vehicles;

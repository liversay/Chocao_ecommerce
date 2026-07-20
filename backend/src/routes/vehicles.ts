import { Hono } from "hono";
import type { AppEnv } from "../types";
import { requirePermission } from "../middlewares/auth";
import { NotFoundError } from "../lib/errors";
import { idParamSchema, validate } from "../schemas/common";
import {
  createVehicleSchema,
  listVehiclesQuerySchema,
  patchVehicleStatusSchema,
  updateVehicleSchema,
} from "../schemas/vehicles";
import { recordAudit } from "../services/audit";
import { Vehicle } from "../models/Vehicle";
import { Bid } from "../models/Bid";

const vehicles = new Hono<AppEnv>();

vehicles.get("/", validate("query", listVehiclesQuerySchema), async (c) => {
  const { status } = c.req.valid("query");
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
vehicles.get("/admin/all", requirePermission("vehicle:write"), async (c) => {
  const list = await Vehicle.find().sort({ createdAt: -1 });
  return c.json(list);
});

vehicles.get("/:id", validate("param", idParamSchema), async (c) => {
  const vehicle = await Vehicle.findById(c.req.valid("param").id);
  if (!vehicle) throw new NotFoundError("Vehículo no encontrado");
  return c.json(vehicle);
});

vehicles.post("/", requirePermission("vehicle:write"), validate("json", createVehicleSchema), async (c) => {
  const body = c.req.valid("json");
  const admin = c.get("user");

  const vehicle = await Vehicle.create({
    ...body,
    currentPrice: body.basePrice,
    createdBy: admin._id,
  });
  return c.json(vehicle, 201);
});

vehicles.put(
  "/:id",
  requirePermission("vehicle:write"),
  validate("param", idParamSchema),
  validate("json", updateVehicleSchema),
  async (c) => {
    const vehicle = await Vehicle.findByIdAndUpdate(c.req.valid("param").id, c.req.valid("json"), {
      returnDocument: "after",
    });
    if (!vehicle) throw new NotFoundError("Vehículo no encontrado");
    return c.json(vehicle);
  }
);

vehicles.delete("/:id", requirePermission("vehicle:write"), validate("param", idParamSchema), async (c) => {
  const vehicle = await Vehicle.findByIdAndDelete(c.req.valid("param").id);
  if (!vehicle) throw new NotFoundError("Vehículo no encontrado");

  await recordAudit({
    actor: c.get("user"),
    action: "vehicle.delete",
    resource: "vehicle",
    resourceId: vehicle._id.toString(),
    before: { title: vehicle.title, status: vehicle.status, currentPrice: vehicle.currentPrice },
    requestId: c.get("requestId"),
  });

  return c.json({ message: "Vehículo eliminado" });
});

vehicles.patch(
  "/:id/status",
  requirePermission("vehicle:write"),
  validate("param", idParamSchema),
  validate("json", patchVehicleStatusSchema),
  async (c) => {
    const { status } = c.req.valid("json");
    const vehicleId = c.req.valid("param").id;

    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) throw new NotFoundError("Vehículo no encontrado");

    const previousStatus = vehicle.status;
    vehicle.status = status;
    await vehicle.save();

    // When the auction transitions to closed/awarded, mark the highest bid as winner
    // and the rest as outbid. Idempotent — safe to re-run if the admin toggles status.
    let winnerBidId: string | undefined;
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
        winnerBidId = highestBid._id.toString();
      }
    }

    await recordAudit({
      actor: c.get("user"),
      action: "vehicle.status.change",
      resource: "vehicle",
      resourceId: vehicle._id.toString(),
      before: { status: previousStatus },
      after: { status, ...(winnerBidId ? { winnerBidId } : {}) },
      requestId: c.get("requestId"),
    });

    return c.json(vehicle);
  }
);

export default vehicles;

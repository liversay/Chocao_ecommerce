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
import { adjudicateVehicle } from "../services/auctions";
import { Vehicle } from "../models/Vehicle";

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

    // When the auction transitions to closed/awarded, mark the highest bid as
    // winner and the rest as outbid (services/auctions — same logic as the
    // automatic close job). Idempotent — safe to re-run.
    let winnerBidId: string | undefined;
    if (status === "closed" || status === "awarded") {
      winnerBidId = await adjudicateVehicle(vehicleId);
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

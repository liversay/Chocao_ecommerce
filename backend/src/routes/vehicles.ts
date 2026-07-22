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
import { setVehicleStatus } from "../services/auctions";
import { publishPublic } from "../services/realtime";
import { invalidateCatalog, listVehicles } from "../services/vehicles";
import { Vehicle } from "../models/Vehicle";

const vehicles = new Hono<AppEnv>();

// Catálogo público paginado con filtros indexados y caché (services/vehicles).
// Los borradores nunca se exponen aquí (includeDrafts solo en flujos admin).
vehicles.get("/", validate("query", listVehiclesQuerySchema), async (c) => {
  const result = await listVehicles({ ...c.req.valid("query"), includeDrafts: false });
  return c.json(result);
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
  invalidateCatalog();
  publishPublic({ type: "vehicle.updated", payload: { vehicleId: vehicle._id.toString() } });
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
    invalidateCatalog();
    publishPublic({ type: "vehicle.updated", payload: { vehicleId: vehicle._id.toString() } });
    return c.json(vehicle);
  }
);

vehicles.delete("/:id", requirePermission("vehicle:write"), validate("param", idParamSchema), async (c) => {
  const vehicle = await Vehicle.findByIdAndDelete(c.req.valid("param").id);
  if (!vehicle) throw new NotFoundError("Vehículo no encontrado");
  invalidateCatalog();
  publishPublic({ type: "vehicle.removed", payload: { vehicleId: vehicle._id.toString() } });

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
    const { vehicle } = await setVehicleStatus(
      c.get("user"),
      c.req.valid("param").id,
      status,
      c.get("requestId")
    );
    return c.json(vehicle);
  }
);

export default vehicles;

import { NotFoundError, ValidationError } from "../lib/errors";
import { Vehicle, type IVehicle, type VehicleDoc } from "../models/Vehicle";
import type { UserDoc } from "../models/User";
import { recordAudit } from "./audit";

export interface ListVehiclesParams {
  status?: "all" | "draft" | "published" | "active" | "closed" | "awarded";
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  q?: string;
  page?: number;
  limit?: number;
  /** Solo el catálogo admin/MCP con scope admin puede ver borradores. */
  includeDrafts?: boolean;
}

export interface ListVehiclesResult {
  items: VehicleDoc[];
  total: number;
  page: number;
  pages: number;
}

const PUBLIC_STATUSES = ["published", "active", "closed", "awarded"] as const;

// Caché en memoria del catálogo con invalidación por versión: cualquier
// cambio de inventario (CRUD, cambio de estado, puja, cierre automático)
// llama a invalidateCatalog() y las claves viejas dejan de usarse.
let cacheVersion = 0;
const cache = new Map<string, ListVehiclesResult>();

export function invalidateCatalog() {
  cacheVersion += 1;
  if (cache.size > 200) cache.clear();
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function listVehicles(params: ListVehiclesParams = {}): Promise<ListVehiclesResult> {
  const page = params.page ?? 1;
  const limit = params.limit ?? 12;

  const filter: Record<string, unknown> = {};
  if (params.status === "draft") {
    // Los borradores jamás se exponen al público
    filter.status = params.includeDrafts ? "draft" : { $in: [...PUBLIC_STATUSES] };
  } else if (!params.status || params.status === "all") {
    filter.status = { $in: [...PUBLIC_STATUSES] };
  } else {
    filter.status = params.status;
  }

  if (params.brand) filter.brand = new RegExp(escapeRegex(params.brand), "i");

  if (params.minPrice !== undefined || params.maxPrice !== undefined) {
    filter.currentPrice = {
      ...(params.minPrice !== undefined ? { $gte: params.minPrice } : {}),
      ...(params.maxPrice !== undefined ? { $lte: params.maxPrice } : {}),
    };
  }

  if (params.q) {
    const rx = new RegExp(escapeRegex(params.q), "i");
    filter.$or = [{ title: rx }, { brand: rx }, { model: rx }];
  }

  const key = JSON.stringify({ v: cacheVersion, ...params, page, limit });
  const cached = cache.get(key);
  if (cached) return cached;

  const [items, total] = await Promise.all([
    Vehicle.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Vehicle.countDocuments(filter),
  ]);

  const result: ListVehiclesResult = {
    items,
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
  };
  cache.set(key, result);
  return result;
}

// Detalle de un vehículo por id. NotFoundError si no existe o si es un
// borrador y quien pregunta no tiene scope admin.
export async function getVehicleById(id: string, includeDrafts = false): Promise<VehicleDoc> {
  const vehicle = await Vehicle.findById(id);
  if (!vehicle) throw new NotFoundError("Vehículo no encontrado");
  if (vehicle.status === "draft" && !includeDrafts) {
    throw new NotFoundError("Vehículo no encontrado");
  }
  return vehicle;
}

export interface UpsertVehicleInput {
  id?: string;
  title?: string;
  brand?: string;
  model?: string;
  year?: number;
  color?: string;
  mileage?: number;
  condition?: IVehicle["condition"];
  description?: string;
  images?: string[];
  basePrice?: number;
  auctionStartDate?: Date;
  auctionEndDate?: Date;
}

const REQUIRED_ON_CREATE = ["title", "brand", "model", "year", "basePrice"] as const;

// Crea o actualiza un vehículo (admin, scope vehicle:write). Las creaciones
// quedan siempre en "draft" hasta publicación explícita (PATCH status);
// nunca se puede saltar ese paso desde upsert. Cada operación se audita con
// el actor real (el usuario del token, no el sistema).
export async function upsertVehicle(
  actor: UserDoc,
  input: UpsertVehicleInput,
  requestId?: string
): Promise<VehicleDoc> {
  if (input.id) {
    const vehicle = await Vehicle.findById(input.id);
    if (!vehicle) throw new NotFoundError("Vehículo no encontrado");

    const before = vehicle.toObject();
    const { id: _id, ...fields } = input;
    Object.assign(vehicle, fields);
    await vehicle.save();
    invalidateCatalog();

    await recordAudit({
      actor,
      action: "vehicle.upsert",
      resource: "vehicle",
      resourceId: vehicle._id.toString(),
      before: { title: before.title, basePrice: before.basePrice, status: before.status },
      after: { title: vehicle.title, basePrice: vehicle.basePrice, status: vehicle.status },
      requestId,
    });
    return vehicle;
  }

  const missing = REQUIRED_ON_CREATE.filter((key) => input[key] === undefined);
  if (missing.length > 0) {
    throw new ValidationError(`Faltan campos obligatorios para crear el vehículo: ${missing.join(", ")}`);
  }

  const vehicle = await Vehicle.create({
    ...input,
    status: "draft", // nunca se crea publicado directamente
    currentPrice: input.basePrice,
    createdBy: actor._id,
  });
  invalidateCatalog();

  await recordAudit({
    actor,
    action: "vehicle.upsert",
    resource: "vehicle",
    resourceId: vehicle._id.toString(),
    after: { title: vehicle.title, basePrice: vehicle.basePrice, status: vehicle.status },
    requestId,
  });
  return vehicle;
}

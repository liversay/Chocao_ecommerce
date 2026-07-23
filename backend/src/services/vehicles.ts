import { NotFoundError, ValidationError } from "../lib/errors";
import { Vehicle, type IVehicle, type VehicleDoc } from "../models/Vehicle";
import type { UserDoc } from "../models/User";
import { recordAudit } from "./audit";
import { publishPublic } from "./realtime";

export interface ListVehiclesParams {
  /** Comma-separated en HTTP; también acepta un único valor (compat MCP). */
  status?: string;
  /** Comma-separated: cada marca matchea por substring case-insensitive, combinadas con OR. */
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  minYear?: number;
  maxYear?: number;
  minMileage?: number;
  maxMileage?: number;
  /** Comma-separated: "manual"|"automatic" */
  transmission?: string;
  /** Comma-separated: "sedan"|"suv"|"pickup"|"van"|"panel" */
  bodyStyle?: string;
  sort?: string;
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

function splitCsv(value: string): string[] {
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

export async function listVehicles(params: ListVehiclesParams = {}): Promise<ListVehiclesResult> {
  const page = params.page ?? 1;
  const limit = params.limit ?? 12;

  const filter: Record<string, unknown> = {};

  // Resolución de estado: sin status (o incluye "all") => todos los
  // públicos; si no, exactamente lo pedido, pero sin admitir "draft" salvo
  // includeDrafts — y si al quitarlo la lista queda vacía (p.ej. alguien
  // pidió solo status=draft sin ser admin), caemos de vuelta a los públicos
  // en vez de devolver una lista vacía o un filtro imposible.
  const requestedStatuses = params.status ? splitCsv(params.status) : [];
  let statuses: string[] =
    requestedStatuses.length === 0 || requestedStatuses.includes("all")
      ? [...PUBLIC_STATUSES]
      : requestedStatuses;
  if (!params.includeDrafts) {
    const withoutDrafts = statuses.filter((s) => s !== "draft");
    statuses = withoutDrafts.length > 0 ? withoutDrafts : [...PUBLIC_STATUSES];
  }
  filter.status = { $in: statuses };

  // Marca: lista separada por comas, cada una substring case-insensitive,
  // combinadas con OR.
  const brandConditions = params.brand
    ? splitCsv(params.brand).map((b) => ({ brand: new RegExp(escapeRegex(b), "i") }))
    : [];

  if (params.minPrice !== undefined || params.maxPrice !== undefined) {
    filter.currentPrice = {
      ...(params.minPrice !== undefined ? { $gte: params.minPrice } : {}),
      ...(params.maxPrice !== undefined ? { $lte: params.maxPrice } : {}),
    };
  }

  if (params.minYear !== undefined || params.maxYear !== undefined) {
    filter.year = {
      ...(params.minYear !== undefined ? { $gte: params.minYear } : {}),
      ...(params.maxYear !== undefined ? { $lte: params.maxYear } : {}),
    };
  }

  if (params.minMileage !== undefined || params.maxMileage !== undefined) {
    filter.mileage = {
      ...(params.minMileage !== undefined ? { $gte: params.minMileage } : {}),
      ...(params.maxMileage !== undefined ? { $lte: params.maxMileage } : {}),
    };
  }

  if (params.transmission) {
    const list = splitCsv(params.transmission);
    if (list.length > 0) filter.transmission = { $in: list };
  }

  if (params.bodyStyle) {
    const list = splitCsv(params.bodyStyle);
    if (list.length > 0) filter.bodyStyle = { $in: list };
  }

  // q y brand arman cada uno su propio $or — no se pueden asignar ambos a
  // filter.$or (el segundo pisaría al primero), así que si ambos están
  // presentes se combinan con $and en vez de sobreescribirse.
  const searchConditions = params.q
    ? [{ title: new RegExp(escapeRegex(params.q), "i") }, { brand: new RegExp(escapeRegex(params.q), "i") }, { model: new RegExp(escapeRegex(params.q), "i") }]
    : [];

  if (brandConditions.length > 0 && searchConditions.length > 0) {
    filter.$and = [{ $or: brandConditions }, { $or: searchConditions }];
  } else if (brandConditions.length > 0) {
    filter.$or = brandConditions;
  } else if (searchConditions.length > 0) {
    filter.$or = searchConditions;
  }

  const sort: Record<string, 1 | -1> =
    params.sort === "price_desc"
      ? { currentPrice: -1 }
      : params.sort === "price_asc"
        ? { currentPrice: 1 }
        : params.sort === "oldest"
          ? { createdAt: 1 }
          : { createdAt: -1 };

  const key = JSON.stringify({ v: cacheVersion, ...params, page, limit });
  const cached = cache.get(key);
  if (cached) return cached;

  const [items, total] = await Promise.all([
    Vehicle.find(filter)
      .sort(sort)
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
    publishPublic({ type: "vehicle.updated", payload: { vehicleId: vehicle._id.toString() } });

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
  publishPublic({ type: "vehicle.updated", payload: { vehicleId: vehicle._id.toString() } });

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

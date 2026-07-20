import { Vehicle, type VehicleDoc } from "../models/Vehicle";

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

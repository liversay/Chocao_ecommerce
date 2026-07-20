import { z } from "zod";
import { defineTool } from "../registry";
import { listVehicles } from "../../services/vehicles";

// chocao_search_vehicles (HU-47): busca/filtra el catálogo. Reutiliza el
// mismo servicio que GET /api/vehicles (HU-44) — sin duplicar lógica.
defineTool({
  name: "chocao_search_vehicles",
  title: "Buscar vehículos",
  description:
    "Busca y filtra el catálogo de vehículos en subasta por estado, marca, rango de precio o texto. " +
    "Excluye vehículos en borrador salvo que el token tenga scope de administrador.",
  scope: "catalog:read",
  readOnly: true,
  schema: z.object({
    status: z.enum(["all", "published", "active", "closed", "awarded"]).optional(),
    brand: z.string().max(60).optional(),
    minPrice: z.number().nonnegative().optional(),
    maxPrice: z.number().nonnegative().optional(),
    q: z.string().max(100).optional().describe("Texto libre sobre título, marca o modelo"),
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(50).default(12),
  }),
  handler: async (args, auth) => {
    const result = await listVehicles({
      ...args,
      includeDrafts: auth.scopes.includes("vehicle:write"),
    });
    return {
      items: result.items.map((v) => ({
        id: v._id.toString(),
        title: v.title,
        brand: v.brand,
        model: v.model,
        year: v.year,
        status: v.status,
        currentPrice: v.currentPrice,
        auctionEndDate: v.auctionEndDate,
      })),
      total: result.total,
      page: result.page,
      pages: result.pages,
    };
  },
});

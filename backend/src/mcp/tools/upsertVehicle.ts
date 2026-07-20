import { z } from "zod";
import { defineTool } from "../registry";
import { upsertVehicle } from "../../services/vehicles";

const CURRENT_YEAR = new Date().getFullYear();

// chocao_upsert_vehicle (HU-54): alta/edición de inventario por instrucción
// en lenguaje natural. Las creaciones quedan en draft hasta publicación
// explícita (chocao_set_vehicle_status, HU-55); cada operación se audita
// con el actor del token (services/vehicles.upsertVehicle).
defineTool({
  name: "chocao_upsert_vehicle",
  title: "Crear o editar vehículo",
  description:
    "Crea o edita un vehículo del catálogo. Sin id crea uno nuevo (siempre en estado draft); " +
    "con id edita el existente. Cada operación queda registrada en auditoría.",
  scope: "vehicle:write",
  requiresConfirmation: true,
  schema: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, "id inválido").optional(),
    title: z.string().trim().min(3).max(120).optional(),
    brand: z.string().trim().min(1).max(60).optional(),
    model: z.string().trim().min(1).max(60).optional(),
    year: z.number().int().min(1950).max(CURRENT_YEAR + 1).optional(),
    color: z.string().trim().max(40).optional(),
    mileage: z.number().nonnegative().optional(),
    condition: z.enum(["excellent", "good", "fair", "poor"]).optional(),
    description: z.string().trim().max(4000).optional(),
    images: z.array(z.string().url()).max(6).optional(),
    basePrice: z.number().positive().max(100_000_000).optional(),
    // string ISO 8601, no Date: z.coerce.date() no es representable en
    // JSON Schema y rompería tools/list (los clientes MCP describen las
    // tools con JSON Schema). Mongoose castea el string a Date al asignar.
    auctionStartDate: z.iso.datetime({ offset: true }).optional(),
    auctionEndDate: z.iso.datetime({ offset: true }).optional(),
  }),
  handler: async (args, auth) => {
    const vehicle = await upsertVehicle(
      auth.user,
      {
        ...args,
        auctionStartDate: args.auctionStartDate ? new Date(args.auctionStartDate) : undefined,
        auctionEndDate: args.auctionEndDate ? new Date(args.auctionEndDate) : undefined,
      },
      undefined
    );
    return {
      id: vehicle._id.toString(),
      title: vehicle.title,
      status: vehicle.status,
      basePrice: vehicle.basePrice,
      currentPrice: vehicle.currentPrice,
    };
  },
});

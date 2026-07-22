import { z } from "zod";
import { defineTool } from "../registry";
import { objectIdSchema } from "../../schemas/common";
import { getBidHistory } from "../../services/bids";

// chocao_get_bid_history (HU-49): historial de pujas de un vehículo, para
// que el agente explique la dinámica de la subasta y sugiera un monto
// competitivo. Nunca expone identidad de los postores (services/bids).
defineTool({
  name: "chocao_get_bid_history",
  title: "Historial de pujas",
  description:
    "Devuelve el historial de pujas de un vehículo ordenado por monto, con el precio actual y " +
    "la puja más alta vigente. No expone la identidad de los postores.",
  scope: "catalog:read",
  readOnly: true,
  schema: z.object({
    vehicleId: objectIdSchema,
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(100).default(20),
  }),
  handler: async ({ vehicleId, page, limit }) => getBidHistory(vehicleId, { page, limit }),
});

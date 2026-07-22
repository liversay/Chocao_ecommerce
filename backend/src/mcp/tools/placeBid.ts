import { z } from "zod";
import { defineTool } from "../registry";
import { objectIdSchema } from "../../schemas/common";
import { placeBid } from "../../services/bids";

// chocao_place_bid (HU-50): puja en nombre del usuario autenticado del
// token. Reaplica TODAS las validaciones del backend (services/bids —
// mismo servicio que POST /api/bids/vehicle/:id) y el mismo control de
// concurrencia optimista. Acción sensible: compromete dinero, el cliente
// MCP debe confirmar explícitamente con el usuario antes de invocarla
// (annotations.destructiveHint via requiresConfirmation).
defineTool({
  name: "chocao_place_bid",
  title: "Pujar por un vehículo",
  description:
    "Registra una puja en nombre del usuario autenticado. Requiere confirmación explícita del " +
    "usuario antes de invocarse: compromete dinero. Reaplica todas las reglas de negocio " +
    "(vehículo activo, monto mayor al precio actual, subasta no vencida).",
  scope: "bids:write",
  requiresConfirmation: true,
  schema: z.object({
    vehicleId: objectIdSchema,
    amount: z.number().positive().max(100_000_000),
  }),
  handler: async ({ vehicleId, amount }, auth) => {
    const { bid, currentPrice } = await placeBid(auth.user, vehicleId, amount);
    return {
      bidId: bid._id.toString(),
      amount: bid.amount,
      status: bid.status,
      currentPrice,
    };
  },
});

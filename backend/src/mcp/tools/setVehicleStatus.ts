import { z } from "zod";
import { defineTool } from "../registry";
import { objectIdSchema } from "../../schemas/common";
import { vehicleStatusSchema } from "../../schemas/vehicles";
import { setVehicleStatus } from "../../services/auctions";

// chocao_set_vehicle_status (HU-55): opera el ciclo de vida de una subasta
// (publicar, activar, cerrar, adjudicar). Reutiliza services/auctions —
// misma lógica que PATCH /vehicles/:id/status y el cierre automático
// (HU-39). Acción irreversible al adjudicar: requiere confirmación.
defineTool({
  name: "chocao_set_vehicle_status",
  title: "Cambiar estado de vehículo",
  description:
    "Cambia el estado de un vehículo (draft → published → active → closed → awarded). Al cerrar o " +
    "adjudicar, reaplica el marcado automático de la puja ganadora. Requiere confirmación del " +
    "usuario: la adjudicación es irreversible.",
  scope: "vehicle:write",
  requiresConfirmation: true,
  schema: z.object({
    vehicleId: objectIdSchema,
    status: vehicleStatusSchema,
  }),
  handler: async ({ vehicleId, status }, auth) => {
    const { vehicle, winnerBidId } = await setVehicleStatus(auth.user, vehicleId, status);
    return {
      id: vehicle._id.toString(),
      status: vehicle.status,
      ...(winnerBidId ? { winnerBidId } : {}),
    };
  },
});

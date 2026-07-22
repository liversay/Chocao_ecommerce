import { z } from "zod";
import { defineTool } from "../registry";
import { objectIdSchema } from "../../schemas/common";
import { getVehicleById } from "../../services/vehicles";

// chocao_get_vehicle (HU-48): detalle completo, incluido el tiempo restante
// de la subasta, para que el agente asesore al usuario antes de pujar.
defineTool({
  name: "chocao_get_vehicle",
  title: "Detalle de vehículo",
  description:
    "Obtiene el detalle completo de un vehículo (specs, precio actual, estado, fechas y " +
    "segundos restantes de subasta). 404 estructurado si no existe.",
  scope: "catalog:read",
  readOnly: true,
  schema: z.object({ vehicleId: objectIdSchema }),
  handler: async (args, auth) => {
    const vehicle = await getVehicleById(args.vehicleId, auth.scopes.includes("vehicle:write"));

    const remainingMs = vehicle.auctionEndDate ? vehicle.auctionEndDate.getTime() - Date.now() : null;
    const remainingSeconds = remainingMs !== null ? Math.max(0, Math.floor(remainingMs / 1000)) : null;

    return {
      id: vehicle._id.toString(),
      title: vehicle.title,
      brand: vehicle.brand,
      model: vehicle.model,
      year: vehicle.year,
      color: vehicle.color,
      mileage: vehicle.mileage,
      condition: vehicle.condition,
      description: vehicle.description,
      images: vehicle.images,
      basePrice: vehicle.basePrice,
      currentPrice: vehicle.currentPrice,
      status: vehicle.status,
      auctionStartDate: vehicle.auctionStartDate,
      auctionEndDate: vehicle.auctionEndDate,
      remainingSeconds,
      acceptsBids: vehicle.status === "active" && (remainingSeconds === null || remainingSeconds > 0),
    };
  },
});

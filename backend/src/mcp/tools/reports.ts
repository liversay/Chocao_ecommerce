import { z } from "zod";
import { defineTool } from "../registry";
import { getReports } from "../../services/dashboard";

// chocao_reports (HU-57): distribución por estado, top de pujas y
// vehículos recientes, acotable a un rango temporal — para análisis y
// resúmenes ejecutivos a pedido del agente.
defineTool({
  name: "chocao_reports",
  title: "Reportes de inventario y actividad",
  description:
    "Devuelve distribución de vehículos por estado, el top de pujas y los vehículos más recientes. " +
    "Acepta un rango temporal opcional (from/to, ISO 8601) para acotar el reporte.",
  scope: "report:read",
  readOnly: true,
  schema: z.object({
    from: z.iso.datetime({ offset: true }).optional(),
    to: z.iso.datetime({ offset: true }).optional(),
  }),
  handler: async ({ from, to }) =>
    getReports({
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    }),
});

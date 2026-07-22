import { z } from "zod";
import { defineTool } from "../registry";
import { getDashboardSummary } from "../../services/dashboard";

// chocao_dashboard_summary (HU-56): mismos agregados que
// GET /api/dashboard/summary, estructurados para que el agente los resuma
// en reporting conversacional.
defineTool({
  name: "chocao_dashboard_summary",
  title: "Resumen del dashboard",
  description:
    "Devuelve los KPIs en tiempo real de la plataforma: vehículos, pujas, usuarios, recaudación, " +
    "subastas activas y vehículos adjudicados.",
  scope: "dashboard:read",
  readOnly: true,
  schema: z.object({}),
  handler: async () => getDashboardSummary(),
});

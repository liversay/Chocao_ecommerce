import { Hono } from "hono";
import type { AppEnv } from "../types";
import { requirePermission } from "../middlewares/auth";
import { validate } from "../schemas/common";
import { reportsQuerySchema } from "../schemas/dashboard";
import { getDashboardSummary, getReports } from "../services/dashboard";

const dashboard = new Hono<AppEnv>();

dashboard.get("/summary", requirePermission("dashboard:read"), async (c) => {
  return c.json(await getDashboardSummary());
});

dashboard.get("/reports", requirePermission("report:read"), validate("query", reportsQuerySchema), async (c) => {
  const { from, to } = c.req.valid("query");
  return c.json(await getReports({ from, to }));
});

export default dashboard;

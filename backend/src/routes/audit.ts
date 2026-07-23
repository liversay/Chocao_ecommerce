import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../types";
import { requirePermission } from "../middlewares/auth";
import { validate } from "../schemas/common";
import { AuditLog } from "../models/AuditLog";

const audit = new Hono<AppEnv>();

const listAuditQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  resource: z.string().max(60).optional(),
  from: z.coerce.date("Fecha de inicio inválida").optional(),
  to: z.coerce.date("Fecha de fin inválida").optional(),
});

// Consulta del registro de auditoría (solo admins autorizados)
audit.get("/", requirePermission("audit:read"), validate("query", listAuditQuerySchema), async (c) => {
  const { page, limit, resource, from, to } = c.req.valid("query");
  const filter: Record<string, unknown> = {};
  if (resource) filter.resource = resource;
  if (from || to) {
    filter.createdAt = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
  }
  const [items, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("actor", "name email role"),
    AuditLog.countDocuments(filter),
  ]);
  return c.json({ items, total, page, pages: Math.ceil(total / limit) });
});

export default audit;
